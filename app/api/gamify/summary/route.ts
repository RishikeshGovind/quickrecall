// app/api/gamify/summary/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { todayKey } from '@/lib/gamify'
import { getCached, clearCacheKey } from '@/lib/serverCache'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const url = new URL(req.url)
  const noCache = url.searchParams.get('noCache') === '1'

  const cacheKey = `gamify:summary:${userId}`

  async function loadSummary() {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        timezone: true,
        dailyGoalReviews: true,
        hearts: true,
        heartsMax: true,
        streakCurrent: true,
      },
    })

    if (!profile) {
      return {
        reviewsToday: 0,
        xpToday: 0,
        dailyGoalReviews: 0,
        completedToday: false,
        streak: 0,
        hearts: 0,
        heartsMax: 0,
      }
    }

    const tz = profile.timezone || 'UTC'
    const key = todayKey(tz)

    const day = await prisma.practiceDay.findUnique({
      where: { userId_dateKey: { userId, dateKey: key } },
    })

    return {
      reviewsToday: day?.reviews ?? 0,
      xpToday: day?.xp ?? 0,
      dailyGoalReviews: profile.dailyGoalReviews,
      completedToday: !!day?.completed,
      streak: profile.streakCurrent,
      hearts: profile.hearts,
      heartsMax: profile.heartsMax,
    }
  }

  try {
    // Force fresh DB read (used when the user just answered a card)
    if (noCache) {
      const fresh = await loadSummary()
      clearCacheKey(cacheKey)
      return NextResponse.json(fresh)
    }

    // Normal path: a small per-user cache (e.g. 30 seconds)
    const summary = await getCached(cacheKey, 1000 * 30, loadSummary)
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[gamify/summary] error:', err)
    try {
      const fallback = await loadSummary()
      return NextResponse.json(fallback)
    } catch (inner) {
      console.error('[gamify/summary] fallback error:', inner)
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }
  }
}
