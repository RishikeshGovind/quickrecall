// app/(app)/leaderboard/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { getCached } from '@/lib/serverCache'

function startOfWeekUTC(d = new Date()) {
  // Monday as start of week
  const day = d.getUTCDay() || 7
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  start.setUTCDate(start.getUTCDate() - (day - 1))
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function avatarUrl(seed?: string) {
  const s = encodeURIComponent(seed || 'Learner')
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${s}`
}

type LeaderboardRow = {
  userId: string
  total: number
  displayName: string
  avatarSeed: string
}

export default async function Leaderboard() {
  const start = startOfWeekUTC()
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)

  // We key the cache by the Monday-of-this-week so that when a new week
  // starts, the key automatically changes and we get fresh data.
  const cacheKey = `leaderboard:${start.toISOString()}`

  const rows = await getCached<LeaderboardRow[]>(cacheKey, 1000 * 60, async () => {
    // 1) Sum XP for each user for this week
    const grouped = await prisma.xpEvent.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        amount: true,
      },
    })

    const baseRows = grouped
      .map((g) => ({
        userId: g.userId,
        total: g._sum.amount ?? 0,
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    if (baseRows.length === 0) {
      return []
    }

    // 2) Pull profile info for the users who made it into the top list
    const userIds = baseRows.map((r) => r.userId)

    const profiles = await prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        displayName: true,
        avatarSeed: true,
      },
    })

    const nameOf = (uid: string) =>
      profiles.find((p) => p.userId === uid)?.displayName || 'Learner'

    const avatarOf = (uid: string) =>
      profiles.find((p) => p.userId === uid)?.avatarSeed || nameOf(uid)

    // 3) Attach the derived data (names + avatar seeds) so the render
    //    function can stay simple.
    return baseRows.map((row) => ({
      userId: row.userId,
      total: row.total,
      displayName: nameOf(row.userId),
      avatarSeed: avatarOf(row.userId),
    }))
  })

  if (rows.length === 0) {
    return (
      <div className="card">
        <h1 className="text-xl font-semibold mb-2">Weekly leaderboard</h1>
        <p className="text-sm text-gray-600">
          No XP earned yet this week. Start studying to appear here!
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <h1 className="text-xl font-semibold">Weekly leaderboard</h1>
      <p className="text-sm text-gray-600">
        Ranking by XP earned this week (Monday–Sunday, UTC).
      </p>
      <ol className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.userId}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-right tabular-nums text-gray-500">
                {index + 1}.
              </span>
              <Image
                src={avatarUrl(row.avatarSeed)}
                alt={row.displayName}
                width={28}
                height={28}
                className="rounded"
                unoptimized
              />
              <span>{row.displayName}</span>
            </div>
            <span className="tabular-nums">{row.total} XP</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
