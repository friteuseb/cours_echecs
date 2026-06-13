import { NextRequest, NextResponse } from 'next/server'
import { Chess } from 'chess.js'
import { prisma } from '@/lib/db'
import { computeScore, uciToMove } from '@/lib/chess-utils'
import type { MoveResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Marge de tolérance après la fin du chrono (latence réseau)
const GRACE_MS = 2000

/**
 * L'élève joue un coup. Le serveur valide contre la solution :
 * - coup attendu -> on joue la réponse de l'adversaire et on continue (ou "solved" si fin de ligne)
 * - coup donnant mat immédiat -> accepté comme correct (convention Lichess)
 * - autre coup -> "wrong", la question est terminée pour ce joueur
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const body = await req.json()
  const playerId = typeof body.playerId === 'string' ? body.playerId : ''
  const move = typeof body.move === 'string' ? body.move.toLowerCase() : ''
  if (!playerId || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    include: { puzzles: { orderBy: { order: 'asc' }, include: { puzzle: true } } },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }
  const current = session.puzzles[session.currentIndex]
  const closed: MoveResult = { result: 'closed', reply: null, score: 0 }
  if (session.status !== 'question' || !current || !session.questionStartedAt) {
    return NextResponse.json(closed)
  }
  const elapsedMs = Date.now() - session.questionStartedAt.getTime()
  if (elapsedMs > session.timeLimit * 1000 + GRACE_MS) {
    return NextResponse.json(closed)
  }

  const answer = await prisma.answer.upsert({
    where: { playerId_sessionPuzzleId: { playerId, sessionPuzzleId: current.id } },
    create: { playerId, sessionPuzzleId: current.id },
    update: {},
  })
  if (answer.status !== 'playing') {
    return NextResponse.json(closed)
  }

  // Rejoue la position : FEN de départ + coups déjà joués
  const solution = current.puzzle.solution.split(' ')
  const played = answer.movesPlayed ? answer.movesPlayed.split(' ') : []
  const chess = new Chess(current.puzzle.fen)
  for (const uci of played) chess.move(uciToMove(uci))

  const expected = solution[played.length]
  let isCorrect = move === expected

  // Convention Lichess : un coup qui mate immédiatement est toujours accepté
  if (!isCorrect) {
    try {
      const probe = new Chess(chess.fen())
      probe.move(uciToMove(move))
      if (probe.isCheckmate()) isCorrect = true
    } catch {
      // coup illégal : reste incorrect
    }
  }

  if (!isCorrect) {
    await prisma.answer.update({
      where: { id: answer.id },
      data: { status: 'wrong', timeMs: elapsedMs, score: 0 },
    })
    const res: MoveResult = { result: 'wrong', reply: null, score: 0 }
    return NextResponse.json(res)
  }

  const newPlayed = [...played, move]
  // Ligne terminée ? (soit on a tout joué, soit le coup alternatif a maté)
  const solvedByMate = move !== expected
  const isLastMove = newPlayed.length >= solution.length

  if (solvedByMate || isLastMove) {
    const score = computeScore(elapsedMs, session.timeLimit)
    await prisma.$transaction([
      prisma.answer.update({
        where: { id: answer.id },
        data: { status: 'correct', movesPlayed: newPlayed.join(' '), timeMs: elapsedMs, score },
      }),
      prisma.player.update({
        where: { id: playerId },
        data: { score: { increment: score } },
      }),
    ])
    const res: MoveResult = { result: 'solved', reply: null, score }
    return NextResponse.json(res)
  }

  // La ligne continue : on joue automatiquement la réponse de l'adversaire
  const reply = solution[newPlayed.length]
  newPlayed.push(reply)
  await prisma.answer.update({
    where: { id: answer.id },
    data: { movesPlayed: newPlayed.join(' ') },
  })
  const res: MoveResult = { result: 'continue', reply, score: 0 }
  return NextResponse.json(res)
}
