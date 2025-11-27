// app/api/review/next/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDistractors, shuffle } from '@/lib/quiz'

type Mode = 'mc' | 'reveal'
type SessionType = 'practice' | 'study'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({} as any))

    const deckId: string | undefined = body?.deckId
    const rawMode = body?.mode
    const mode: Mode = rawMode === 'mc' ? 'mc' : 'reveal'

    const sessionType: SessionType =
      body?.sessionType === 'practice' ? 'practice' : 'study'

    const excludeCardIds: string[] = Array.isArray(body?.excludeCardIds)
      ? body.excludeCardIds.filter((id: unknown): id is string => typeof id === 'string')
      : []

    if (!deckId) {
      return NextResponse.json({ error: 'deckId required' }, { status: 400 })
    }

    const userId = session.user.id

    // 🔐 Make sure this deck belongs to the user
    const deck = await prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { id: true },
    })
    if (!deck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()

    // -------------------------
    // 1) PRACTICE MODE (random)
    // -------------------------
    if (sessionType === 'practice') {
      const count = await prisma.card.count({
        where: {
          deckId,
          deck: { userId },
        },
      })
      if (count === 0) return NextResponse.json({ empty: true })

      const skip = Math.floor(Math.random() * count)
      const cards = await prisma.card.findMany({
        where: {
          deckId,
          deck: { userId },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: 1,
      })
      const card = cards[0]
      if (!card) return NextResponse.json({ empty: true })

      let choices: string[] | undefined
      if (mode === 'mc') {
        const distractors = await getDistractors(deckId, card.id, card.back).catch((e) => {
          console.error('[getDistractors] error (practice):', e)
          return [] as string[]
        })
        choices = shuffle([card.back, ...distractors]).slice(0, 4)
      }

      return NextResponse.json({
        card: {
          id: card.id,
          front: card.front,
          back: card.back,
        },
        reviewState: null,
        choices,
      })
    }

    // --------------------
    // 2) STUDY MODE (SRS-ish, but session-aware)
    // --------------------

    // 2a) Try the earliest *due* card that we haven't shown yet in this session
    let rs = await prisma.reviewState.findFirst({
      where: {
        userId,
        dueAt: { lte: now },
        card: {
          deckId,
          deck: { userId },
          ...(excludeCardIds.length ? { id: { notIn: excludeCardIds } } : {}),
        },
      },
      include: { card: true },
      orderBy: { dueAt: 'asc' },
    })

    // 2b) If no due card, try the earliest *unseen* card (no ReviewState for this user)
    if (!rs) {
      const unseen = await prisma.card.findFirst({
        where: {
          deckId,
          deck: { userId },
          ...(excludeCardIds.length ? { id: { notIn: excludeCardIds } } : {}),
          reviewStates: {
            none: { userId },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (unseen) {
        rs = await prisma.reviewState.create({
          data: {
            userId,
            cardId: unseen.id,
            ease: 2.5,
            intervalDays: 0,
            repetitions: 0,
            dueAt: now,
          },
          include: { card: true },
        })
      }
    }

    // 2c) Still nothing? As a last resort, pick ANY card in this deck
    // that hasn't been shown in this session yet, ignoring dueAt.
    if (!rs) {
      const anyCard = await prisma.card.findFirst({
        where: {
          deckId,
          deck: { userId },
          ...(excludeCardIds.length ? { id: { notIn: excludeCardIds } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      })

      if (anyCard) {
        const existing = await prisma.reviewState.findFirst({
          where: { userId, cardId: anyCard.id },
          include: { card: true },
        })

        if (existing) {
          rs = existing
        } else {
          rs = await prisma.reviewState.create({
            data: {
              userId,
              cardId: anyCard.id,
              ease: 2.5,
              intervalDays: 0,
              repetitions: 0,
              dueAt: now,
            },
            include: { card: true },
          })
        }
      }
    }

    // 2d) If we still have nothing at this point, there are truly no cards left
    if (!rs) {
      return NextResponse.json({ empty: true })
    }

    // Build MC choices if needed
    let choices: string[] | undefined
    if (mode === 'mc') {
      const distractors = await getDistractors(deckId, rs.cardId, rs.card.back).catch(
        (e) => {
          console.error('[getDistractors] error (study):', e)
          return [] as string[]
        },
      )
      choices = shuffle([rs.card.back, ...distractors]).slice(0, 4)
    }

    return NextResponse.json({
      card: {
        id: rs.card.id,
        front: rs.card.front,
        back: rs.card.back,
      },
      reviewState: {
        id: rs.id,
        ease: rs.ease,
        intervalDays: rs.intervalDays,
        repetitions: rs.repetitions,
        dueAt: rs.dueAt,
      },
      choices,
    })
  } catch (err) {
    console.error('[review/next] error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
