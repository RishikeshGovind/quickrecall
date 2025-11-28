// components/StreakCounter.tsx
'use client'
import React from 'react'

export default function StreakCounter({
  currentStreak,
  bestStreak,
}: {
  currentStreak: number
  bestStreak: number
}) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-2xl">🔥</div>
        <div>
          <div className="text-sm text-gray-500">Current streak</div>
          <div className="text-xl font-semibold tabular-nums">{currentStreak} day{currentStreak === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm text-gray-500">Best streak</div>
        <div className="text-base font-medium tabular-nums">{bestStreak} day{bestStreak === 1 ? '' : 's'}</div>
      </div>
    </div>
  )
}
