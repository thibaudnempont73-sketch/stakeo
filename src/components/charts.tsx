import { useLayoutEffect, useRef, useState } from 'react'
import type { SeriesPoint } from '../lib/stats'

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

export function AreaChart({
  points,
  height = 200,
  formatValue,
  formatDate,
}: {
  points: SeriesPoint[]
  height?: number
  formatValue: (v: number) => string
  formatDate: (d: string) => string
}) {
  const { ref, width } = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const pts = points.length === 1 ? [points[0], { ...points[0], date: new Date().toISOString() }] : points
  const t0 = new Date(pts[0].date).getTime()
  const t1 = new Date(pts[pts.length - 1].date).getTime()
  const span = Math.max(t1 - t0, 1)
  let min = Math.min(...pts.map((p) => p.value))
  let max = Math.max(...pts.map((p) => p.value))
  if (max - min < 1) {
    max += 1
    min -= 1
  }
  const padY = (max - min) * 0.12
  min -= padY
  max += padY

  const padL = 8
  const padR = 8
  const w = Math.max(width - padL - padR, 10)
  const h = height - 24

  const X = (d: string) => padL + ((new Date(d).getTime() - t0) / span) * w
  const Y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (h - 16)

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.date).toFixed(1)},${Y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${X(pts[pts.length - 1].date).toFixed(1)},${h} L${X(pts[0].date).toFixed(1)},${h} Z`
  const up = pts[pts.length - 1].value >= pts[0].value
  const color = up ? 'var(--pos)' : 'var(--neg)'
  const gid = up ? 'grad-up' : 'grad-down'

  const onMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    let best = 0
    let bestD = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(X(p.date) - x)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setHover(best)
  }

  const hp = hover != null ? pts[hover] : null

  return (
    <div ref={ref} className="chart-wrap" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="grad-up" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--pos)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="grad-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neg)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--neg)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={padL} x2={width - padR} y1={8 + f * (h - 16)} y2={8 + f * (h - 16)} className="grid-line" />
          ))}
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {hp && (
            <g>
              <line x1={X(hp.date)} x2={X(hp.date)} y1={8} y2={h} className="hover-line" />
              <circle cx={X(hp.date)} cy={Y(hp.value)} r="4.5" fill={color} stroke="var(--bg1)" strokeWidth="2" />
            </g>
          )}
          <circle cx={X(pts[pts.length - 1].date)} cy={Y(pts[pts.length - 1].value)} r="3.5" fill={color} />
        </svg>
      )}
      {hp && width > 0 && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(X(hp.date) - 50, 0), width - 110),
            top: Math.max(Y(hp.value) - 54, 0),
          }}
        >
          <strong>{formatValue(hp.value)}</strong>
          <span>{formatDate(hp.date)}</span>
        </div>
      )}
    </div>
  )
}

export function MonthlyBars({
  data,
  formatValue,
  height = 170,
}: {
  data: { label: string; value: number }[]
  formatValue: (v: number) => string
  height?: number
}) {
  const { ref, width } = useWidth()
  if (data.length === 0) return null
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1)
  const h = height - 26
  const zero = h / 2
  const barW = Math.min(40, Math.max(10, (width - 16) / data.length - 8))

  return (
    <div ref={ref} className="chart-wrap" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height}>
          <line x1={0} x2={width} y1={zero} y2={zero} className="grid-line" />
          {data.map((d, i) => {
            const x = 8 + (i + 0.5) * ((width - 16) / data.length) - barW / 2
            const bh = (Math.abs(d.value) / maxAbs) * (h / 2 - 10)
            const y = d.value >= 0 ? zero - bh : zero
            return (
              <g key={d.label}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(bh, 1.5)}
                  rx="4"
                  fill={d.value >= 0 ? 'var(--pos)' : 'var(--neg)'}
                  opacity="0.85"
                >
                  <title>{`${d.label}: ${formatValue(d.value)}`}</title>
                </rect>
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="axis-label">
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export function BarList({
  rows,
  formatMoney,
  formatPct,
  betsLabel,
}: {
  rows: { key: string; profit: number; count: number; yield: number }[]
  formatMoney: (v: number) => string
  formatPct: (v: number) => string
  betsLabel: (n: number) => string
}) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.profit)), 0.01)
  return (
    <div className="bar-list">
      {rows.map((r) => (
        <div key={r.key} className="bar-row">
          <div className="bar-row-head">
            <span className="bar-key">{r.key}</span>
            <span className="bar-meta">
              {betsLabel(r.count)}
              <span className={`yield-badge ${r.yield >= 0 ? 'pos' : 'neg'}`}>{formatPct(r.yield)}</span>
            </span>
            <span className={`bar-profit ${r.profit >= 0 ? 'pos' : 'neg'}`}>{formatMoney(r.profit)}</span>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill ${r.profit >= 0 ? 'pos' : 'neg'}`}
              style={{ width: `${Math.max((Math.abs(r.profit) / maxAbs) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
