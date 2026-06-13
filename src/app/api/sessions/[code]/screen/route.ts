import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sideToMove, uciLineToSan } from '@/lib/chess-utils'
import type { ScreenState } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** État complet pour l'écran du prof (projecteur). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      puzzles: { orderBy: { order: 'asc' }, include: { puzzle: true } },
      players: { orderBy: { score: 'desc' } },
    },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const current = session.puzzles[session.currentIndex] ?? null
  const showBoard = session.status === 'question' || session.status === 'reveal'
  const reveal = session.status === 'reveal' || session.status === 'finished'

  let answers: ScreenState['answers'] = []
  if (current) {
    const rows = await prisma.answer.findMany({
      where: { sessionPuzzleId: current.id },
      include: { player: true },
    })
    answers = rows.map((a) => ({
      playerName: a.player.name,
      status: a.status as ScreenState['answers'][number]['status'],
      timeMs: a.timeMs,
      score: a.score,
    }))
  }

  const solution = current ? current.puzzle.solution.split(' ') : null

  const state: ScreenState = {
    status: session.status as ScreenState['status'],
    code: session.code,
    name: session.name,
    currentIndex: session.currentIndex,
    totalPuzzles: session.puzzles.length,
    timeLimit: session.timeLimit,
    questionStartedAt: session.questionStartedAt?.toISOString() ?? null,
    fen: showBoard && current ? current.puzzle.fen : null,
    orientation: showBoard && current ? sideToMove(current.puzzle.fen) : null,
    puzzleTitle: showBoard && current ? current.puzzle.title : null,
    solutionSan: reveal && current && solution ? uciLineToSan(current.puzzle.fen, solution) : null,
    solutionUci: reveal && solution ? solution : null,
    players: session.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    answers,
  }
  return NextResponse.json(state)
}
