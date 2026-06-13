import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateSessionCode } from '@/lib/chess-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const puzzleIds: string[] = Array.isArray(body.puzzleIds) ? body.puzzleIds : []
  if (puzzleIds.length === 0) {
    return NextResponse.json({ error: 'Sélectionnez au moins un puzzle' }, { status: 400 })
  }
  const timeLimit = Math.min(600, Math.max(10, Number(body.timeLimit) || 60))
  const name = typeof body.name === 'string' ? body.name.slice(0, 100) : null

  const puzzles = await prisma.puzzle.findMany({ where: { id: { in: puzzleIds } } })
  const byId = new Map(puzzles.map((p) => [p.id, p]))
  const ordered = puzzleIds.filter((id) => byId.has(id))
  if (ordered.length === 0) {
    return NextResponse.json({ error: 'Puzzles introuvables' }, { status: 400 })
  }

  // Réessaie en cas de collision (improbable) sur le code unique
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSessionCode()
    try {
      const session = await prisma.session.create({
        data: {
          code,
          name,
          timeLimit,
          puzzles: {
            create: ordered.map((id, i) => ({ puzzleId: id, order: i })),
          },
        },
      })
      return NextResponse.json({ code: session.code, id: session.id })
    } catch {
      continue
    }
  }
  return NextResponse.json({ error: 'Impossible de créer la session' }, { status: 500 })
}
