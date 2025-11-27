// app/api/review/answer/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { applyGamification, type Grade, todayKey } from '@/lib/gamify'

// Allowed grades
const GRADES = ['Again', 'Hard', 'Good', 'Easy'] as const
function isGrade(x: unknown): x is Grade {
  return typeof x === 'string' && (GRADES as readonly string[]).includes(x)
}

// XP values (same as in lib/gamify)
const XP_BY_GRADE: Record<Grade, number> = {
  Again: 0,
  Hard: 6,
  Good: 10,
  Easy: 12,
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json().catch(() => ({} as any))
    const cardId: unknown = body.cardId
    const rawGrade: unknown = body.grade
    const correct: unknown = body.correct

    if (typeof cardId !== 'string' || !isGrade(rawGrade)) {
      return NextResponse.json(
        { error: 'cardId and valid grade required' },
        { status: 400 },
      )
    }

    const grade = rawGrade as Grade
    const xpGain = XP_BY_GRADE[grade]
    const now = new Date()

    // Make sure card belongs to this user
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        deck: { userId },
      },
      select: { id: true },
    })

    if (!card) {
      return NextResponse.json({ error: 'card_not_found' }, { status: 404 })
    }

    // ----- 1) Update review scheduling (SRS) -----
    const result = await prisma.$transaction(async (tx) => {
      const prev = await tx.reviewState.findUnique({
        where: { userId_cardId: { userId, cardId } },
      })

      let ease = prev?.ease ?? 2.5
      let intervalDays = prev?.intervalDays ?? 0
      let repetitions = prev?.repetitions ?? 0

      switch (grade) {
        case 'Again':
          intervalDays = 0
          ease = Math.max(1.3, ease - 0.2)
          repetitions = 0
          break

        case 'Hard':
          intervalDays = prev
            ? Math.max(1, Math.round(intervalDays * 1.2))
            : 1
          ease = Math.max(1.3, ease - 0.05)
          repetitions += 1
          break

        case 'Good':
          if (!prev) {
            intervalDays = 1
          } else if (repetitions === 0) {
            intervalDays = 1
          } else if (repetitions === 1) {
            intervalDays = 3
          } else {
            intervalDays = Math.max(1, Math.round(intervalDays * ease))
          }
          repetitions += 1
          break

        case 'Easy':
          if (!prev) {
            intervalDays = 3
          } else if (repetitions === 0) {
            intervalDays = 3
          } else {
            intervalDays = Math.max(
              1,
              Math.round(intervalDays * ease * 1.3),
            )
          }
          ease = Math.min(ease + 0.15, 3.0)
          repetitions += 1
          break
      }

      const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)

      let saved
      if (prev) {
        saved = await tx.reviewState.update({
          where: { id: prev.id },
          data: {
            ease,
            intervalDays,
            repetitions,
            lastReviewedAt: now,
            dueAt,
          },
        })
      } else {
        saved = await tx.reviewState.create({
          data: {
            userId,
            cardId,
            ease,
            intervalDays,
            repetitions,
            lastReviewedAt: now,
            dueAt,
          },
        })
      }

      return {
        id: saved.id,
        ease: saved.ease,
        intervalDays: saved.intervalDays,
        repetitions: saved.repetitions,
        dueAt: saved.dueAt,
      }
    })

    // ----- 2) Gamification: XP, hearts, streaks, etc. -----
    let gamify: any = null

    try {
      // main path: use our helper which updates PracticeDay + XpEvent + profile
      gamify = await applyGamification({
        userId,
        grade,
        cardId,
        correct: typeof correct === 'boolean' ? correct : undefined,
      })
    } catch (err) {
      console.error(
        '[review/answer] gamification error, using fallback:',
        err,
      )

      // Fallback: minimal but safe XP + PracticeDay + XpEvent
      try {
        const profile = await prisma.userProfile.findUnique({
          where: { userId },
          select: {
            timezone: true,
            dailyGoalReviews: true,
          },
        })

        const tz = profile?.timezone || 'UTC'
        const keyToday = todayKey(tz)

        const existingDay = await prisma.practiceDay.findUnique({
          where: { userId_dateKey: { userId, dateKey: keyToday } },
          select: {
            reviews: true,
            xp: true,
            completed: true,
          },
        })

        const prevReviews = existingDay?.reviews ?? 0
        const prevXp = existingDay?.xp ?? 0
        const prevCompleted = !!existingDay?.completed

        const nextReviews = prevReviews + 1
        const nextXp = prevXp + xpGain

        const dailyGoal = profile?.dailyGoalReviews ?? 0
        const willComplete =
          !prevCompleted && dailyGoal > 0 && nextReviews >= dailyGoal

        await prisma.practiceDay.upsert({
          where: { userId_dateKey: { userId, dateKey: keyToday } },
          create: {
            userId,
            dateKey: keyToday,
            reviews: nextReviews,
            xp: nextXp,
            completed: willComplete,
          },
          update: {
            reviews: nextReviews,
            xp: nextXp,
            completed: prevCompleted || willComplete,
          },
        })

        if (xpGain > 0) {
          await prisma.xpEvent.create({
            data: {
              userId,
              amount: xpGain,
              reason: `review:${grade}`,
            },
          })
        }

        gamify = {
          xpGain,
          hearts: 0,
          heartsMax: 0,
          completed: prevCompleted || willComplete,
          reviewsToday: nextReviews,
          dailyGoalReviews: dailyGoal,
          streakCurrent: 0,
          streakLongest: 0,
        }
      } catch (fallbackErr) {
        console.error(
          '[review/answer] fallback gamification also failed:',
          fallbackErr,
        )
        gamify = { xpGain }
      }
    }

    const safeGamify =
      gamify && typeof gamify === 'object'
        ? { ...gamify, xpGain: gamify.xpGain ?? xpGain }
        : { xpGain }

    return NextResponse.json({
      ok: true,
      reviewState: result,
      gamify: safeGamify,
    })
  } catch (err) {
    console.error('[review/answer] error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
