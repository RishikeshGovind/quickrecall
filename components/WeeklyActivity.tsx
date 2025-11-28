// components/WeeklyActivity.tsx
'use client'
import React from 'react'

/**
 * last7Days: number[] oldest -> newest (length = 7)
 */
export default function WeeklyActivity({ last7Days }: { last7Days: number[] }) {
  // defensive: ensure length 7
  const data = Array.from({ length: 7 }).map((_, i) => last7Days[i] ?? 0)
  const total = data.reduce((a, b) => a + b, 0)
  const max = Math.max(...data, 1)

  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const todayIdx = new Date().getDay() // 0..6
  const dayLabels = data.map((_, idx) => {
    const dayIdx = (todayIdx - (6 - idx) + 7) % 7
    return labels[dayIdx]
  })

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm text-gray-500">Last 7 days</div>
          <div className="text-base font-medium">Activity</div>
        </div>
        <div className="text-sm text-gray-500">{total} reviews</div>
      </div>

      {/* Bars area: no fixed large height; use small minHeight so bars are visible */}
      <div
        className="flex items-end gap-2"
        style={{
          minHeight: 48, // small vertical space so bars are visible but no big gap
          alignItems: 'flex-end',
        }}
      >
        {data.map((count, idx) => {
          // compute a pixel height (scale to max) instead of % to avoid browser rounding gaps
          const maxPx = 56 // maximum pixel height for the tallest bar
          const heightPx = Math.max(12, Math.round((count / max) * maxPx)) // min 12px
          return (
            <div key={idx} className="flex flex-col items-center" style={{ width: 44 }}>
              <div
                style={{
                  width: '100%',
                  height: heightPx,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  overflow: 'hidden',
                }}
                title={`${dayLabels[idx]}: ${count} review${count === 1 ? '' : 's'}`}
              >
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(30,41,59,0.12), rgba(30,41,59,0.24))' }} />
              </div>

              <div className="text-xs mt-1 text-gray-600">{count}</div>
              <div className="text-xs text-gray-400 mt-0">{dayLabels[idx]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
