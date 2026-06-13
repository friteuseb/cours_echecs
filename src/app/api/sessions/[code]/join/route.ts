import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 30) : ''
  if (!name) {
    return NextResponse.json({ error: 'Prénom requis' }, { status: 400 })
  }
  const session = await prisma.session.findUnique({ where: { code: code.toUpperCase() } })
  if (!session) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }
  if (session.status === 'finished') {
    return NextResponse.json({ error: 'La session est terminée' }, { status: 400 })
  }
  // Si le prénom existe déjà dans la session, on reconnecte le même joueur
  // (utile si l'élève recharge la page ou perd sa connexion)
  const existing = await prisma.player.findUnique({
    where: { sessionId_name: { sessionId: session.id, name } },
  })
  if (existing) {
    return NextResponse.json({ playerId: existing.id, reconnected: true })
  }
  const player = await prisma.player.create({
    data: { sessionId: session.id, name },
  })
  return NextResponse.json({ playerId: player.id, reconnected: false })
}
