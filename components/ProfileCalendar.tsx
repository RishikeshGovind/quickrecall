'use client'
import useSWR from 'swr'
import { useEffect, useRef, useState, MouseEvent, FocusEvent } from 'react'

const fetcher = (u: string) => fetch(u).then(r => r.json())
const DAY = 24 * 60 * 60 * 1000
const GAP = 2           // px gap between cells
const Y_AXIS_PAD = 40   // px for left labels

type Tip = { x: number; y: number; text: string } | null

export default function ProfileCalendar({ year }: { year?: number }) {
  const y = year ?? new Date().getFullYear()
  const key = `/api/profile/calendar?year=${y}`
  const { data } = useSWR(key, fetcher, { revalidateOnFocus: true })

  // --- hooks must always run in same order ---
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(12)
  const [tip, setTip] = useState<Tip>(null)
  const weeks = data?.weeks ?? 52

  // autosize so the full year fits without scrolling
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const width = el.clientWidth
      const usable = Math.max(0, width - Y_AXIS_PAD - (weeks - 1) * GAP)
      const nextCell = Math.max(9, Math.min(14, Math.floor(usable / weeks)))
      setCell(nextCell)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [weeks])

  if (!data || data.error) return null

  const { tz, goal, startKey, endKey, days, monthTicks } = data as {
    tz: string
    goal: number
    startKey: string
    endKey: string
    days: { dateKey: string; reviews: number; xp: number }[]
    monthTicks: { col: number; label: string }[]
  }

  // helpers
  const toUTCDate = (k: string) => {
    const [Y, M, D] = k.split('-').map(Number)
    return new Date(Date.UTC(Y, M - 1, D))
  }
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' }).format(d)

  const start = toUTCDate(startKey)   // Sunday-aligned (from API)
  const end = toUTCDate(endKey)
  const map = new Map(days.map(d => [d.dateKey, d]))

  // build cells: rows Sun..Sat (0..6), columns = weeks since start
  const cells: Array<{ key: string; row: number; col: number; reviews: number; xp: number }> = []
  for (let ts = start.getTime(), i = 0; ts <= end.getTime(); ts += DAY, i++) {
    const date = new Date(ts)
    const keyDay = ymd(date)
    const hit = map.get(keyDay)
    const row = date.getUTCDay() // 0..6
    const col = Math.floor(i / 7)
    cells.push({ key: keyDay, row, col, reviews: hit?.reviews ?? 0, xp: hit?.xp ?? 0 })
  }

  const colorFor = (n: number) =>
    n === 0 ? 'bg-gray-200'
    : n < goal * 0.25 ? 'bg-emerald-200'
    : n < goal * 0.5  ? 'bg-emerald-300'
    : n < goal        ? 'bg-emerald-400'
    : 'bg-emerald-600'

  // tooltip helpers
  const showTip = (e: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>, text: string) => {
    const host = wrapRef.current
    if (!host) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const hr = host.getBoundingClientRect()
    // position centered above the square
    const x = r.left - hr.left + r.width / 2
    const y = r.top - hr.top - 8
    setTip({ x, y, text })
  }
  const hideTip = () => setTip(null)

  const weekColWidth = cell + GAP

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Month labels (approx.) */}
      <div className="mb-1 flex text-xs text-gray-500" style={{ marginLeft: Y_AXIS_PAD }}>
        {monthTicks.map(t => (
          <div key={t.col} className="text-center" style={{ width: weekColWidth * 4 }}>
            {t.label}
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Y-axis labels */}
        <div style={{ width: Y_AXIS_PAD }} className="flex flex-col justify-between text-xs text-gray-500 py-1">
          <div>Mon</div><div>Wed</div><div>Fri</div>
        </div>

        {/* Grid: 7 rows (Sun..Sat), many columns (weeks) */}
        <div
          className="inline-grid [grid-auto-flow:column] gap-[2px]"
          style={{ gridTemplateRows: `repeat(7, ${cell}px)`, gridAutoColumns: `${cell}px` }}
        >
          {cells.map(c => {
            const [Y, M, D] = c.key.split('-').map(Number)
            const date = new Date(Date.UTC(Y, M - 1, D))
            const label = `${fmt(date)} — ${c.xp} XP • ${c.reviews} review${c.reviews === 1 ? '' : 's'}`
            return (
              <div
                key={c.key}
                className={`rounded-[3px] ${colorFor(c.reviews)}`}
                tabIndex={0}
                aria-label={label}
                style={{ gridRow: c.row + 1, gridColumn: c.col + 1, width: cell, height: cell }}
                onMouseEnter={(e) => showTip(e, label)}
                onMouseMove={(e) => showTip(e, label)}
                onMouseLeave={hideTip}
                onFocus={(e) => showTip(e, label)}
                onBlur={hideTip}
              />
            )
          })}
        </div>
      </div>

      {/* Custom tooltip */}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-black/90 px-2 py-1 text-[11px] text-white shadow"
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          {tip.text}
          <div className="absolute left-1/2 top-full -ml-1 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-black/90" />
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <span>Less</span>
        <span className="w-4 h-4 bg-gray-200 rounded-sm" />
        <span className="w-4 h-4 bg-emerald-200 rounded-sm" />
        <span className="w-4 h-4 bg-emerald-300 rounded-sm" />
        <span className="w-4 h-4 bg-emerald-400 rounded-sm" />
        <span className="w-4 h-4 bg-emerald-600 rounded-sm" />
        <span>More</span>
      </div>
    </div>
  )
}
