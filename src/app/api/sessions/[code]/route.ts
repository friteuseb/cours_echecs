import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sideToMove, uciLineToSan } from '@/lib/chess-utils'
import type { AnswerStatus, StudentState } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** État de la session pour le téléphone d'un élève. Ne révèle JAMAIS la solution avant le reveal. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const playerId = req.nextUrl.searchParams.get('playerId')
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      puzzles: { orderBy: { order: 'asc' }, include: { puzzle: true } },
    },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const current = session.puzzles[session.currentIndex] ?? null
  const showBoard = session.status === 'question' || session.status === 'reveal'
  const reveal = session.status === 'reveal' || session.status === 'finished'

  let answer: StudentState['answer'] = null
  if (playerId && current) {
    const a = await prisma.answer.findUnique({
      where: { playerId_sessionPuzzleId: { playerId, sessionPuzzleId: current.id } },
    })
    if (a) {
      answer = {
        status: a.status as AnswerStatus,
        movesPlayed: a.movesPlayed,
        score: a.score,
      }
    }
  }

  let leaderboard: StudentState['leaderboard'] = null
  if (reveal) {
    const players = await prisma.player.findMany({
      where: { sessionId: session.id },
      orderBy: { score: 'desc' },
    })
    leaderboard = players.map((p) => ({ id: p.id, name: p.name, score: p.score }))
  }

  const state: StudentState = {
    status: session.status as StudentState['status'],
    currentIndex: session.currentIndex,
    totalPuzzles: session.puzzles.length,
    timeLimit: session.timeLimit,
    questionStartedAt: session.questionStartedAt?.toISOString() ?? null,
    fen: showBoard && current ? current.puzzle.fen : null,
    orientation: showBoard && current ? sideToMove(current.puzzle.fen) : null,
    answer,
    leaderboard,
    solutionSan:
      reveal && current
        ? uciLineToSan(current.puzzle.fen, current.puzzle.solution.split(' '))
        : null,
  }
  return NextResponse.json(state)
}
