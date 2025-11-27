// lib/gamify.ts
import { prisma } from '@/lib/prisma'

/** The four review buttons we support everywhere. */
export type Grade = 'Again' | 'Hard' | 'Good' | 'Easy'

/** Map each grade to XP gained for that answer. Tweak to taste. */
const XP_BY_GRADE: Record<Grade, number> = {
  Again: 0,
  Hard: 6,
  Good: 10,
  Easy: 12,
}

/** Format a Date into YYYY-MM-DD for a given IANA timezone (e.g. "Asia/Kolkata"). */
export function toDateKey(d: Date, timeZone: string): string {
  // en-CA yields ISO-like YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Convenience: today's YYYY-MM-DD in the user's timezone. */
export function todayKey(timeZone: string): string {
  return toDateKey(new Date(), timeZone)
}

/**
 * Core gamification write.
 * - Records PracticeDay (reviews/xp/completed)
 * - Manages hearts on wrong answers
 * - Increments streak when the daily goal is completed
 * - Logs an XpEvent (with a reason)
 */
export async function applyGamification(opts: {
  userId: string
  grade: Grade
  cardId: string
  /** For MC: pass whether the chosen option was correct. Flashcard mode can omit. */
  correct?: boolean
}) {
  const { userId, grade, correct } = opts

  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.findUnique({
      where: { userId },
      // We rely on these fields below
      select: {
        userId: true,
        timezone: true,
        dailyGoalReviews: true,
        hearts: true,
        heartsMax: true,
        streakCurrent: true,
        streakLongest: true,
        lastPracticeCompletedDate: true,
      },
    })

    // If the profile row is missing, fail gracefully (no-op gamification).
    if (!profile) {
      return {
        xpGain: 0,
        hearts: 0,
        heartsMax: 0,
        completed: false,
        reviewsToday: 0,
        dailyGoalReviews: 0,
        streakCurrent: 0,
        streakLongest: 0,
      }
    }

    const tz = profile.timezone || 'UTC'
    const keyToday = todayKey(tz)
    const keyYesterday = toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000), tz)

    // Decide XP + hearts effects
    const xpGain = XP_BY_GRADE[grade]
    // Lose a heart if explicitly wrong (MC) or if graded "Again" (flashcard)
    const loseHeart = correct === false || grade === 'Again'
    const newHearts = Math.max(0, profile.hearts - (loseHeart ? 1 : 0))

    // Upsert today's PracticeDay and compute completion
    const existingDay = await tx.practiceDay.findUnique({
      where: { userId_dateKey: { userId, dateKey: keyToday } },
      select: { id: true, reviews: true, xp: true, completed: true },
    })

    const prevReviews = existingDay?.reviews ?? 0
    const prevXp = existingDay?.xp ?? 0
    const prevCompleted = !!existingDay?.completed

    const nextReviews = prevReviews + 1
    const nextXp = prevXp + xpGain

    const willComplete =
      !prevCompleted && profile.dailyGoalReviews > 0 && nextReviews >= profile.dailyGoalReviews

    // Write/Update today
    await tx.practiceDay.upsert({
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

    // If the user earned XP, log an event (reason helps analytics & satisfies Prisma)
    if (xpGain > 0) {
      await tx.xpEvent.create({
        data: {
          userId,
          amount: xpGain,
          reason: `review:${grade}`, // <- string reason so Prisma schema with required `reason` is happy
        },
      })
    }

    // Update hearts immediately
    let nextStreakCurrent = profile.streakCurrent
    let nextStreakLongest = profile.streakLongest
    let nextLastCompleted: Date | null = profile.lastPracticeCompletedDate ?? null

    // If they completed the goal now, maintain/increment the streak
    if (willComplete) {
      const lastKey = nextLastCompleted ? toDateKey(nextLastCompleted, tz) : null

      if (!lastKey) {
        // First ever completion
        nextStreakCurrent = 1
      } else if (lastKey === keyToday) {
        // Already marked completed earlier today (shouldn't happen together with willComplete)
        // Keep streak as-is.
      } else if (lastKey === keyYesterday) {
        // Consecutive day
        nextStreakCurrent = Math.max(1, nextStreakCurrent + 1)
      } else {
        // Broken streak
        nextStreakCurrent = 1
      }

      nextStreakLongest = Math.max(nextStreakLongest, nextStreakCurrent)
      nextLastCompleted = new Date() // mark completion timestamp (UTC); we compare via dateKey(tz) anyway
    }

    await tx.userProfile.update({
      where: { userId },
      data: {
        hearts: newHearts,
        streakCurrent: nextStreakCurrent,
        streakLongest: nextStreakLongest,
        lastPracticeCompletedDate: nextLastCompleted,
      },
      select: { heartsMax: true }, // we need heartsMax to return it
    })

    // Return a small bundle the client can use for toasts/UI
    return {
      xpGain,
      hearts: newHearts,
      heartsMax: profile.heartsMax,
      completed: prevCompleted || willComplete,
      reviewsToday: nextReviews,
      dailyGoalReviews: profile.dailyGoalReviews,
      streakCurrent: nextStreakCurrent,
      streakLongest: nextStreakLongest,
    }
  })
}
