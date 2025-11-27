export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deckId } = await req.json().catch(() => ({} as any))
  if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 })

  const now = new Date()

  // ensure RS exists for all cards in deck
  const cards = await prisma.card.findMany({ where: { deckId }, select: { id: true } })
  for (const c of cards) {
    await prisma.reviewState.upsert({
      where: { userId_cardId: { userId: session.user.id, cardId: c.id } },
      update: {},
      create: { userId: session.user.id, cardId: c.id, ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: now },
    })
  }

  // set all due now
  const updated = await prisma.reviewState.updateMany({
    where: { userId: session.user.id, card: { deckId } },
    data: { dueAt: now },
  })

  return NextResponse.json({ ok: true, count: updated.count })
}
