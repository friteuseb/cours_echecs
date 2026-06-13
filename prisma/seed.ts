import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Quelques problèmes classiques pour démarrer (positions et solutions vérifiées)
const puzzles = [
  {
    title: 'Mat du couloir',
    fen: '6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1',
    solution: 'e1e8',
    themes: 'mat, couloir',
    difficulty: 800,
  },
  {
    title: 'Mat du couloir (avec capture)',
    fen: '3r2k1/5ppp/8/8/8/8/5PPP/3QR1K1 w - - 0 1',
    solution: 'd1d8',
    themes: 'mat, couloir, capture',
    difficulty: 900,
  },
  {
    title: 'Mat étouffé',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    solution: 'g5f7',
    themes: 'mat, étouffé, cavalier',
    difficulty: 1000,
  },
  {
    title: 'Mat du berger',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: 'h5f7',
    themes: 'mat, ouverture',
    difficulty: 700,
  },
  {
    title: 'Fourchette royale',
    fen: '4k3/8/8/5q2/4N3/8/8/4K3 w - - 0 1',
    solution: 'e4d6 e8e7 d6f5',
    themes: 'fourchette, cavalier, gain de dame',
    difficulty: 1100,
  },
]

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  })
  const prisma = new PrismaClient({ adapter })
  for (const p of puzzles) {
    const exists = await prisma.puzzle.findFirst({ where: { fen: p.fen } })
    if (exists) continue
    await prisma.puzzle.create({ data: { ...p, source: 'exemples' } })
  }
  const count = await prisma.puzzle.count()
  console.log(`Seed terminé — ${count} problème(s) en bibliothèque.`)
  await prisma.$disconnect()
}

main()
