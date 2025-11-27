// app/api/profile/calendar/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const year = Number(url.searchParams.get('year') || new Date().getFullYear())

  // ✅ Only select the fields we need, so Prisma ignores the broken lastStudyDate column
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      timezone: true,
      dailyGoalReviews: true,
    },
  })

  if (!profile) return NextResponse.json({ error: 'no_profile' }, { status: 404 })
  const tz = profile.timezone || 'UTC'

  const atMidnightTZ = (y: number, m: number, d: number) =>
    new Date(new Date(Date.UTC(y, m, d)).toLocaleString('en-US', { timeZone: tz }))

  // Year bounds in user's tz
  const jan1 = atMidnightTZ(year, 0, 1); jan1.setHours(0, 0, 0, 0)
  const dec31 = atMidnightTZ(year, 11, 31); dec31.setHours(0, 0, 0, 0)

  // Sunday-aligned to full weeks (GitHub-style calendar)
  const start = new Date(jan1); start.setDate(start.getDate() - start.getDay())       // back to Sun
  const end   = new Date(dec31); end.setDate(end.getDate() + (6 - end.getDay()))      // fwd to Sat

  const ymd = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)

  const DAY = 24 * 60 * 60 * 1000
  const weeks = Math.round((end.getTime() - start.getTime() + DAY) / (7 * DAY))

  // Month ticks: label the column whose Sunday falls within day <= 7
  const monthTicks: Array<{ col: number; label: string }> = []
  for (let col = 0; col < weeks; col++) {
    const colDate = new Date(start.getTime() + col * 7 * DAY) // Sunday of that column
    if (colDate.getDate() <= 7) {
      monthTicks.push({
        col,
        label: new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          month: 'short',
        }).format(colDate),
      })
    }
  }

  // Pull PracticeDay with XP (← important for hover)
  const rows = await prisma.practiceDay.findMany({
    where: { userId: session.user.id, dateKey: { gte: ymd(start), lte: ymd(end) } },
    select: { dateKey: true, reviews: true, xp: true },
  })

  return NextResponse.json({
    tz,
    goal: profile.dailyGoalReviews,
    startKey: ymd(start),
    endKey: ymd(end),
    weeks,
    monthTicks,
    days: rows, // [{ dateKey, reviews, xp }]
    year,
  })
}
