// components/GamificationBar.tsx
'use client'

import useSWR, { mutate as swrMutate } from 'swr'

type Summary = {
  reviewsToday: number
  xpToday: number
  dailyGoalReviews: number
  completedToday: boolean
  streak: number
  hearts: number
  heartsMax: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Used by the Study page after each answer.
// It calls ?noCache=1 so the API skips the cache, then puts that fresh
// value into SWR's cache for '/api/gamify/summary'.
export async function refreshGamifySummary() {
  await swrMutate(
    '/api/gamify/summary',
    async () => {
      const res = await fetch('/api/gamify/summary?noCache=1')
      return res.json()
    },
    false,
  )
}

export default function GamificationBar({ initial }: { initial?: Summary | null }) {
  const { data } = useSWR<Summary & { error?: unknown }>(
    '/api/gamify/summary',
    fetcher,
    {
      fallbackData: initial ?? undefined,
      revalidateOnFocus: true,
      revalidateIfStale: true,
      shouldRetryOnError: false,
      // Avoid hammering the endpoint: SWR will dedupe requests within this window.
      dedupingInterval: 15000,
    },
  )

  if (!data || (data as any).error) return null

  const pct = Math.min(
    100,
    Math.round((data.reviewsToday / Math.max(1, data.dailyGoalReviews)) * 100),
  )

  return (
    <div className="flex items-center gap-2 text-sm whitespace-nowrap">
      {/* Streak */}
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white leading-none">
        <span aria-hidden>🔥</span>
        <span className="tabular-nums">{data.streak}</span>
      </span>

      {/* Hearts */}
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white leading-none">
        <span aria-hidden>❤️</span>
        <span className="tabular-nums">
          {data.hearts}/{data.heartsMax}
        </span>
      </span>

      {/* XP today */}
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white leading-none">
        <span aria-hidden>⭐</span>
        <span className="tabular-nums">{data.xpToday} XP</span>
      </span>

      {/* Daily goal progress bar */}
      <div className="flex items-center gap-2">
        <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
          <div
            className={`h-full ${
              data.completedToday ? 'bg-green-600' : 'bg-green-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums">
          {data.reviewsToday}/{data.dailyGoalReviews}
        </span>
      </div>
    </div>
  )
}
