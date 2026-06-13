import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Pilotage de la session par le prof : start | reveal | next | finish */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const { action } = await req.json()
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    include: { puzzles: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const total = session.puzzles.length

  if (action === 'start' && session.status === 'lobby') {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'question', currentIndex: 0, questionStartedAt: new Date() },
    })
  } else if (action === 'reveal' && session.status === 'question') {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'reveal' },
    })
  } else if (action === 'next' && session.status === 'reveal') {
    if (session.currentIndex + 1 < total) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'question',
          currentIndex: session.currentIndex + 1,
          questionStartedAt: new Date(),
        },
      })
    } else {
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'finished' },
      })
    }
  } else if (action === 'finish') {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'finished' },
    })
  } else {
    return NextResponse.json(
      { error: `Action "${action}" impossible depuis l'état "${session.status}"` },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true })
}
