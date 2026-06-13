import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validatePuzzle } from '@/lib/chess-utils'
import type { ImportPuzzleInput } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Liste paginée et filtrable :
 *   ?theme=fork  ?min=1000  ?max=1400  ?page=2  ?pageSize=24
 *   ?idsOnly=1 -> renvoie uniquement les ids correspondant au filtre (pour la sélection aléatoire)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const theme = sp.get('theme')
  const min = parseInt(sp.get('min') ?? '', 10)
  const max = parseInt(sp.get('max') ?? '', 10)

  const difficulty: { gte?: number; lte?: number } = {}
  if (!Number.isNaN(min)) difficulty.gte = min
  if (!Number.isNaN(max)) difficulty.lte = max
  const where = {
    ...(theme ? { themes: { contains: theme } } : {}),
    ...(difficulty.gte !== undefined || difficulty.lte !== undefined ? { difficulty } : {}),
  }

  if (sp.get('idsOnly') === '1') {
    const rows = await prisma.puzzle.findMany({ where, select: { id: true } })
    return NextResponse.json({ ids: rows.map((r) => r.id) })
  }

  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(1, parseInt(sp.get('pageSize') ?? '24', 10) || 24))
  const [total, puzzles] = await prisma.$transaction([
    prisma.puzzle.count({ where }),
    prisma.puzzle.findMany({
      where,
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return NextResponse.json({ puzzles, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const inputs: ImportPuzzleInput[] = Array.isArray(body.puzzles) ? body.puzzles : []
  if (inputs.length === 0) {
    return NextResponse.json({ error: 'Aucun puzzle fourni' }, { status: 400 })
  }
  const errors: string[] = []
  const valid: ImportPuzzleInput[] = []
  for (const p of inputs) {
    if (typeof p.fen !== 'string' || typeof p.solution !== 'string') {
      errors.push('Entrée invalide (fen/solution manquants)')
      continue
    }
    const solution = p.solution.trim().split(/\s+/).filter(Boolean)
    const error = validatePuzzle(p.fen.trim(), solution)
    if (error) {
      errors.push(error)
      continue
    }
    valid.push({ ...p, fen: p.fen.trim(), solution: solution.join(' ') })
  }
  const created = await prisma.puzzle.createMany({
    data: valid.map((p) => ({
      fen: p.fen,
      solution: p.solution,
      title: p.title?.slice(0, 200) ?? null,
      themes: p.themes?.slice(0, 500) ?? null,
      difficulty: p.difficulty ?? null,
      source: p.source?.slice(0, 100) ?? null,
    })),
  })
  return NextResponse.json({ created: created.count, errors })
}
