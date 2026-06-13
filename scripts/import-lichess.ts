/**
 * Import en masse depuis la base de puzzles Lichess (lichess_db_puzzle.csv.zst).
 *
 * Sélectionne un lot équilibré : un quota de puzzles par thème pédagogique
 * et par tranche de difficulté, en ne gardant que les puzzles populaires
 * (qualité éprouvée par des milliers de joueurs).
 *
 * Usage :
 *   npx tsx scripts/import-lichess.ts [fichier.csv.zst] [--quota 20]
 *   (fichier par défaut : /tmp/lichess_db_puzzle.csv.zst)
 */
import 'dotenv/config'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { Chess } from 'chess.js'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { FILTER_THEMES, themeLabel } from '../src/lib/themes'

// Thèmes ciblés, par ordre de priorité d'affectation
const TARGET_THEMES = FILTER_THEMES

// Tranches de difficulté (classement Lichess)
const BANDS: [number, number][] = [
  [0, 1000],
  [1000, 1400],
  [1400, 1800],
]

// Filtres de qualité
const MIN_POPULARITY = 85
const MIN_PLAYS = 1000
const MAX_RATING_DEVIATION = 90

const args = process.argv.slice(2)
const quotaIdx = args.indexOf('--quota')
const QUOTA = quotaIdx >= 0 ? parseInt(args[quotaIdx + 1], 10) || 20 : 20
const positional = args.filter((a, i) => !a.startsWith('--') && i !== quotaIdx + 1)
const file = positional[0] ?? '/tmp/lichess_db_puzzle.csv.zst'

function bandOf(rating: number): number {
  return BANDS.findIndex(([lo, hi]) => rating >= lo && rating < hi)
}

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  })
  const prisma = new PrismaClient({ adapter })

  // FEN déjà en base, pour ne pas importer deux fois le même puzzle
  const existing = new Set(
    (await prisma.puzzle.findMany({ select: { fen: true } })).map((p) => p.fen)
  )
  console.log(`${existing.size} puzzle(s) déjà en base — quota : ${QUOTA} par thème × tranche`)

  // quotas restants : clé "theme:bandIndex"
  const remaining = new Map<string, number>()
  for (const t of TARGET_THEMES) for (let b = 0; b < BANDS.length; b++) remaining.set(`${t}:${b}`, QUOTA)
  let totalRemaining = TARGET_THEMES.length * BANDS.length * QUOTA

  const zstd = spawn('zstd', ['-dc', file], { stdio: ['ignore', 'pipe', 'inherit'] })
  const rl = createInterface({ input: zstd.stdout, crlfDelay: Infinity })

  const toInsert: {
    fen: string
    solution: string
    title: string
    themes: string
    difficulty: number
    source: string
  }[] = []
  let scanned = 0

  for await (const line of rl) {
    scanned++
    if (totalRemaining <= 0) break
    if (line.startsWith('PuzzleId,')) continue
    const cols = line.split(',')
    if (cols.length < 8) continue
    const [id, fen, moves, ratingS, devS, popS, playsS, themesS] = cols

    const rating = parseInt(ratingS, 10)
    const band = bandOf(rating)
    if (band < 0) continue
    if (parseInt(popS, 10) < MIN_POPULARITY) continue
    if (parseInt(playsS, 10) < MIN_PLAYS) continue
    if (parseInt(devS, 10) > MAX_RATING_DEVIATION) continue

    const themes = themesS.split(' ').filter(Boolean)
    const target = TARGET_THEMES.find((t) => themes.includes(t) && (remaining.get(`${t}:${band}`) ?? 0) > 0)
    if (!target) continue

    // Convention Lichess : le premier coup est joué par l'adversaire
    const allMoves = moves.split(' ').filter(Boolean)
    if (allMoves.length < 2) continue
    let startFen: string
    let solution: string[]
    try {
      const chess = new Chess(fen)
      chess.move({
        from: allMoves[0].slice(0, 2),
        to: allMoves[0].slice(2, 4),
        promotion: allMoves[0].length > 4 ? allMoves[0].slice(4, 5) : undefined,
      })
      startFen = chess.fen()
      solution = allMoves.slice(1)
      // Vérifie que toute la solution est légale
      const check = new Chess(startFen)
      for (const uci of solution) {
        check.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
        })
      }
    } catch {
      continue
    }
    if (existing.has(startFen)) continue

    existing.add(startFen)
    remaining.set(`${target}:${band}`, (remaining.get(`${target}:${band}`) ?? 0) - 1)
    totalRemaining--
    toInsert.push({
      fen: startFen,
      solution: solution.join(' '),
      title: `${themeLabel(target)} (Lichess ${id})`,
      themes: themes.join(' '),
      difficulty: rating,
      source: 'lichess',
    })

    if (scanned % 500000 === 0) {
      console.log(`  ${scanned} lignes lues, ${toInsert.length} retenues…`)
    }
  }
  zstd.kill()

  // Insertion par lots
  for (let i = 0; i < toInsert.length; i += 200) {
    await prisma.puzzle.createMany({ data: toInsert.slice(i, i + 200) })
  }

  const count = await prisma.puzzle.count()
  console.log(`\nImport terminé : ${toInsert.length} puzzle(s) ajouté(s), ${count} au total en bibliothèque.`)

  // Récapitulatif par thème
  const byTheme = new Map<string, number>()
  for (const p of toInsert) {
    const t = TARGET_THEMES.find((t) => p.themes.includes(t)) ?? '?'
    byTheme.set(t, (byTheme.get(t) ?? 0) + 1)
  }
  for (const [t, n] of byTheme) console.log(`  ${themeLabel(t).padEnd(28)} ${n}`)

  await prisma.$disconnect()
}

main()
