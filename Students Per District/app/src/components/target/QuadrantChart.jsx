import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { QUADRANT_COLORS } from './scoringDefaults'

const PAD = { top: 24, right: 20, bottom: 36, left: 44 }

/* ── Nice round tick values within a range ── */
function niceTicksInRange(lo, hi, maxTicks = 5) {
  const range = hi - lo
  if (range <= 0) return []
  const rough = range / maxTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const candidates = [1, 2, 5, 10]
  let step = candidates.find((c) => c * mag >= rough) * mag
  if (!step || step <= 0) step = rough
  const start = Math.ceil(lo / step) * step
  const ticks = []
  for (let v = start; v <= hi; v += step) {
    ticks.push(Math.round(v * 100) / 100)
  }
  return ticks
}

export default function QuadrantChart({ rankedStates, medians, hoveredState, onHoverState }) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  /* ── ResizeObserver for container dimensions ── */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const plotW = size.w - PAD.left - PAD.right
  const plotH = size.h - PAD.top - PAD.bottom

  /* ── Axis ranges from data with 5-point padding, clamped 0-100 ── */
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (!rankedStates || rankedStates.length === 0) {
      return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
    }
    const acqs = rankedStates.map((s) => s.acqScore)
    const civs = rankedStates.map((s) => s.civicScore)
    return {
      xMin: Math.max(0, Math.min(...acqs) - 5),
      xMax: Math.min(100, Math.max(...acqs) + 5),
      yMin: Math.max(0, Math.min(...civs) - 5),
      yMax: Math.min(100, Math.max(...civs) + 5),
    }
  }, [rankedStates])

  /* ── Scale helpers ── */
  const sx = useCallback((v) => PAD.left + ((v - xMin) / (xMax - xMin)) * plotW, [xMin, xMax, plotW])
  const sy = useCallback((v) => PAD.top + ((yMax - v) / (yMax - yMin)) * plotH, [yMin, yMax, plotH])

  /* ── Tick values ── */
  const xTicks = useMemo(() => niceTicksInRange(xMin, xMax, 5), [xMin, xMax])
  const yTicks = useMemo(() => niceTicksInRange(yMin, yMax, 4), [yMin, yMax])

  /* ── Mouse interaction: find nearest dot within 20px ── */
  const handleMouseMove = useCallback(
    (e) => {
      if (!rankedStates || rankedStates.length === 0 || plotW <= 0 || plotH <= 0) return
      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      let nearest = null
      let bestDist = Infinity
      for (const s of rankedStates) {
        const dx = sx(s.acqScore) - mx
        const dy = sy(s.civicScore) - my
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < bestDist) {
          bestDist = d
          nearest = s
        }
      }
      onHoverState(bestDist <= 20 && nearest ? nearest.code : null)
    },
    [rankedStates, sx, sy, plotW, plotH, onHoverState],
  )

  const handleMouseLeave = useCallback(() => onHoverState(null), [onHoverState])

  /* ── Median crosshair pixel positions (clamped to plot area) ── */
  const mxPx = sx(Math.max(xMin, Math.min(xMax, medians.acq)))
  const myPx = sy(Math.max(yMin, Math.min(yMax, medians.civic)))

  /* ── Quadrant background rects ── */
  const quadRects = useMemo(() => {
    if (plotW <= 0 || plotH <= 0) return []
    const cx = mxPx
    const cy = myPx
    const l = PAD.left
    const t = PAD.top
    const r = PAD.left + plotW
    const b = PAD.top + plotH
    return [
      { key: 'Civic Beachhead', x: l, y: t, w: cx - l, h: cy - t },
      { key: 'Launch Priority', x: cx, y: t, w: r - cx, h: cy - t },
      { key: 'Deprioritize', x: l, y: cy, w: cx - l, h: b - cy },
      { key: 'Revenue Opportunity', x: cx, y: cy, w: r - cx, h: b - cy },
    ]
  }, [plotW, plotH, mxPx, myPx])

  /* ── Region label positions (in quadrant corners) ── */
  const regionLabels = useMemo(() => {
    if (plotW <= 0 || plotH <= 0) return []
    const inset = 8
    return [
      { label: 'Civic Beachhead', x: PAD.left + inset, y: PAD.top + inset + 11, anchor: 'start', key: 'Civic Beachhead' },
      { label: 'Launch Priority', x: PAD.left + plotW - inset, y: PAD.top + inset + 11, anchor: 'end', key: 'Launch Priority' },
      { label: 'Deprioritize', x: PAD.left + inset, y: PAD.top + plotH - inset, anchor: 'start', key: 'Deprioritize' },
      { label: 'Revenue Opp.', x: PAD.left + plotW - inset, y: PAD.top + plotH - inset, anchor: 'end', key: 'Revenue Opportunity' },
    ]
  }, [plotW, plotH])

  /* ── Determine which dots should show labels (avoid overlap) ── */
  const labelledDots = useMemo(() => {
    if (!rankedStates || rankedStates.length === 0 || plotW <= 0) return new Set()
    // Show labels on all dots when count is manageable, or a sampled subset
    if (rankedStates.length <= 25) {
      return new Set(rankedStates.map((s) => s.code))
    }
    // For larger sets, show every Nth + always show hovered
    const shown = new Set()
    const sorted = [...rankedStates].sort((a, b) => b.composite - a.composite)
    // Always label top 10, bottom 3, and every 5th
    sorted.forEach((s, i) => {
      if (i < 10 || i >= sorted.length - 3 || i % 5 === 0) {
        shown.add(s.code)
      }
    })
    return shown
  }, [rankedStates, plotW])

  const ready = size.w > 0 && size.h > 0 && plotW > 0 && plotH > 0

  return (
    <div ref={wrapRef} className="quadrant-chart-wrap">
      {ready && (
        <svg
          className="quadrant-chart-svg"
          width={size.w}
          height={size.h}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Plot area background */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="#FAFAF8"
          />

          {/* Quadrant background fills */}
          {quadRects.map((q) => (
            <rect
              key={q.key}
              x={q.x}
              y={q.y}
              width={Math.max(0, q.w)}
              height={Math.max(0, q.h)}
              fill={QUADRANT_COLORS[q.key]}
              opacity={0.08}
            />
          ))}

          {/* Subtle grid lines (x ticks) */}
          {xTicks.map((v) => (
            <line
              key={`gx-${v}`}
              x1={sx(v)}
              y1={PAD.top}
              x2={sx(v)}
              y2={PAD.top + plotH}
              stroke="#E8E4DE"
              strokeWidth={0.5}
            />
          ))}
          {/* Subtle grid lines (y ticks) */}
          {yTicks.map((v) => (
            <line
              key={`gy-${v}`}
              x1={PAD.left}
              y1={sy(v)}
              x2={PAD.left + plotW}
              y2={sy(v)}
              stroke="#E8E4DE"
              strokeWidth={0.5}
            />
          ))}

          {/* Dashed median crosshair lines */}
          <line
            x1={mxPx}
            y1={PAD.top}
            x2={mxPx}
            y2={PAD.top + plotH}
            stroke="#78716C"
            strokeDasharray="4,3"
            opacity={0.6}
          />
          <line
            x1={PAD.left}
            y1={myPx}
            x2={PAD.left + plotW}
            y2={myPx}
            stroke="#78716C"
            strokeDasharray="4,3"
            opacity={0.6}
          />

          {/* Plot area border */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="#D4D0C8"
            strokeWidth={0.5}
          />

          {/* X-axis ticks & labels */}
          {xTicks.map((v) => {
            const px = sx(v)
            return (
              <g key={`xt-${v}`}>
                <line
                  x1={px}
                  y1={PAD.top + plotH}
                  x2={px}
                  y2={PAD.top + plotH + 4}
                  stroke="#9CA3AF"
                  strokeWidth={0.75}
                />
                <text
                  x={px}
                  y={PAD.top + plotH + 14}
                  textAnchor="middle"
                  fill="#9CA3AF"
                  fontSize={9}
                  fontFamily="var(--font-body, 'DM Sans', sans-serif)"
                >
                  {Math.round(v)}
                </text>
              </g>
            )
          })}

          {/* Y-axis ticks & labels */}
          {yTicks.map((v) => {
            const py = sy(v)
            return (
              <g key={`yt-${v}`}>
                <line
                  x1={PAD.left - 4}
                  y1={py}
                  x2={PAD.left}
                  y2={py}
                  stroke="#9CA3AF"
                  strokeWidth={0.75}
                />
                <text
                  x={PAD.left - 7}
                  y={py + 3}
                  textAnchor="end"
                  fill="#9CA3AF"
                  fontSize={9}
                  fontFamily="var(--font-body, 'DM Sans', sans-serif)"
                >
                  {Math.round(v)}
                </text>
              </g>
            )
          })}

          {/* Region labels with colored indicator */}
          {regionLabels.map((rl) => {
            const color = QUADRANT_COLORS[rl.key] || '#9CA3AF'
            return (
              <text
                key={rl.label}
                x={rl.x}
                y={rl.y}
                textAnchor={rl.anchor}
                fill={color}
                fontSize={9}
                fontWeight={700}
                fontFamily="var(--font-heading, 'Oswald', sans-serif)"
                letterSpacing="0.04em"
                opacity={0.65}
                style={{ textTransform: 'uppercase' }}
              >
                {rl.label}
              </text>
            )
          })}

          {/* Axis label: Acquisition Score (bottom center) */}
          <text
            x={PAD.left + plotW / 2}
            y={size.h - 2}
            textAnchor="middle"
            fill="#78716C"
            fontSize={10}
            fontWeight={700}
            fontFamily="var(--font-heading, 'Oswald', sans-serif)"
            letterSpacing="0.06em"
            style={{ textTransform: 'uppercase' }}
          >
            Acquisition Score
          </text>

          {/* Axis label: Political Change (left center, rotated) */}
          <text
            x={10}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
            fill="#78716C"
            fontSize={10}
            fontWeight={700}
            fontFamily="var(--font-heading, 'Oswald', sans-serif)"
            letterSpacing="0.06em"
            transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}
            style={{ textTransform: 'uppercase' }}
          >
            Political Change
          </text>

          {/* State dots — non-hovered first, then hovered on top */}
          {rankedStates
            .filter((s) => s.code !== hoveredState)
            .map((s) => {
              const anyHovered = hoveredState != null
              const cx = sx(s.acqScore)
              const cy = sy(s.civicScore)
              const showLabel = labelledDots.has(s.code)
              return (
                <g key={s.code} opacity={anyHovered ? 0.35 : 1} style={{ transition: 'opacity 0.15s' }}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4.5}
                    fill={QUADRANT_COLORS[s.quadrant] || '#9CA3AF'}
                    stroke="#fff"
                    strokeWidth={1.25}
                  />
                  {showLabel && (
                    <text
                      x={cx}
                      y={cy - 7}
                      textAnchor="middle"
                      fill="#44403C"
                      fontSize={8}
                      fontWeight={600}
                      fontFamily="var(--font-body, 'DM Sans', sans-serif)"
                      opacity={0.7}
                    >
                      {s.code}
                    </text>
                  )}
                </g>
              )
            })}

          {/* Hovered state dot — rendered last so it's on top */}
          {hoveredState &&
            (() => {
              const s = rankedStates.find((st) => st.code === hoveredState)
              if (!s) return null
              const cx = sx(s.acqScore)
              const cy = sy(s.civicScore)
              const labelX = cx
              const labelY = cy - 12
              const labelText = `${s.code} (${Math.round(s.composite)})`
              // Estimate text width for background pill
              const textW = labelText.length * 5.5 + 12
              return (
                <g>
                  {/* Hovered dot with ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill={QUADRANT_COLORS[s.quadrant] || '#9CA3AF'}
                    opacity={0.15}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={QUADRANT_COLORS[s.quadrant] || '#9CA3AF'}
                    stroke="#111"
                    strokeWidth={2}
                  />
                  {/* Label pill background */}
                  <rect
                    x={labelX - textW / 2}
                    y={labelY - 9}
                    width={textW}
                    height={16}
                    rx={4}
                    fill="#111"
                    opacity={0.85}
                  />
                  {/* Label text */}
                  <text
                    x={labelX}
                    y={labelY + 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="var(--font-body, 'DM Sans', sans-serif)"
                  >
                    {labelText}
                  </text>
                </g>
              )
            })()}
        </svg>
      )}
    </div>
  )
}
