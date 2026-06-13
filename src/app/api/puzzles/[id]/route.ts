import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.puzzle.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
