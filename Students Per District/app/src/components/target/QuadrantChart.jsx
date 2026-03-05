import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { QUADRANT_COLORS } from './scoringDefaults'

const PAD = { top: 20, right: 16, bottom: 32, left: 40 }

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

  /* ── Axis ranges from data with 3-point padding, clamped 0-100 ── */
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (!rankedStates || rankedStates.length === 0) {
      return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
    }
    const acqs = rankedStates.map((s) => s.acqScore)
    const civs = rankedStates.map((s) => s.civicScore)
    return {
      xMin: Math.max(0, Math.min(...acqs) - 3),
      xMax: Math.min(100, Math.max(...acqs) + 3),
      yMin: Math.max(0, Math.min(...civs) - 3),
      yMax: Math.min(100, Math.max(...civs) + 3),
    }
  }, [rankedStates])

  /* ── Scale helpers ── */
  const sx = useCallback((v) => PAD.left + ((v - xMin) / (xMax - xMin)) * plotW, [xMin, xMax, plotW])
  const sy = useCallback((v) => PAD.top + ((yMax - v) / (yMax - yMin)) * plotH, [yMin, yMax, plotH])

  /* ── Mouse interaction: find nearest dot within 16px ── */
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
      onHoverState(bestDist <= 16 && nearest ? nearest.code : null)
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
    const inset = 6
    return [
      { label: 'Civic Beachhead', x: PAD.left + inset, y: PAD.top + inset + 12, anchor: 'start' },
      { label: 'Launch Priority', x: PAD.left + plotW - inset, y: PAD.top + inset + 12, anchor: 'end' },
      { label: 'Deprioritize', x: PAD.left + inset, y: PAD.top + plotH - inset, anchor: 'start' },
      { label: 'Revenue Opp.', x: PAD.left + plotW - inset, y: PAD.top + plotH - inset, anchor: 'end' },
    ]
  }, [plotW, plotH])

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
          {/* Quadrant background fills */}
          {quadRects.map((q) => (
            <rect
              key={q.key}
              x={q.x}
              y={q.y}
              width={Math.max(0, q.w)}
              height={Math.max(0, q.h)}
              fill={QUADRANT_COLORS[q.key]}
              opacity={0.05}
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
            opacity={0.5}
          />
          <line
            x1={PAD.left}
            y1={myPx}
            x2={PAD.left + plotW}
            y2={myPx}
            stroke="#78716C"
            strokeDasharray="4,3"
            opacity={0.5}
          />

          {/* Region labels */}
          {regionLabels.map((rl) => (
            <text
              key={rl.label}
              className="quadrant-region-label"
              x={rl.x}
              y={rl.y}
              textAnchor={rl.anchor}
              fill="#78716C"
              fontSize={10}
              fontFamily="var(--font-body, 'DM Sans', sans-serif)"
              opacity={0.7}
            >
              {rl.label}
            </text>
          ))}

          {/* Axis label: Acquisition Score (bottom center) */}
          <text
            className="quadrant-axis-label"
            x={PAD.left + plotW / 2}
            y={size.h - 4}
            textAnchor="middle"
            fill="var(--gray-muted, #78716C)"
            fontSize={11}
            fontFamily="var(--font-body, 'DM Sans', sans-serif)"
          >
            Acquisition Score
          </text>

          {/* Axis label: Political Change (left center, rotated) */}
          <text
            className="quadrant-axis-label"
            x={12}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
            fill="var(--gray-muted, #78716C)"
            fontSize={11}
            fontFamily="var(--font-body, 'DM Sans', sans-serif)"
            transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}
          >
            Political Change
          </text>

          {/* State dots */}
          {rankedStates.map((s) => {
            const isHovered = hoveredState === s.code
            const anyHovered = hoveredState != null
            const cx = sx(s.acqScore)
            const cy = sy(s.civicScore)
            return (
              <circle
                key={s.code}
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 4}
                fill={QUADRANT_COLORS[s.quadrant] || '#9CA3AF'}
                stroke={isHovered ? '#111' : '#fff'}
                strokeWidth={isHovered ? 2 : 1}
                opacity={anyHovered && !isHovered ? 0.3 : 1}
                style={{ transition: 'opacity 0.15s, r 0.15s' }}
              />
            )
          })}

          {/* Hovered dot label */}
          {hoveredState &&
            (() => {
              const s = rankedStates.find((st) => st.code === hoveredState)
              if (!s) return null
              const cx = sx(s.acqScore)
              const cy = sy(s.civicScore)
              return (
                <text
                  className="quadrant-dot-label"
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  fill="var(--black, #111)"
                  fontSize={11}
                  fontWeight={600}
                  fontFamily="var(--font-body, 'DM Sans', sans-serif)"
                >
                  {s.code} ({Math.round(s.composite)})
                </text>
              )
            })()}
        </svg>
      )}
    </div>
  )
}
