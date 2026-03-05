import { useCallback } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'
import { QUADRANT_COLORS } from './scoringDefaults'

const TIER_COLORS = {
  T1: 'var(--teal)',
  T2: 'var(--gray-body)',
  T3: 'var(--gray-muted)',
}

export default function CompactRankedList({
  rankedStates,
  hoveredState,
  onHoverState,
  onSelectState,
}) {
  const handleMouseEnter = useCallback(
    (code) => onHoverState(code),
    [onHoverState],
  )

  const handleMouseLeave = useCallback(
    () => onHoverState(null),
    [onHoverState],
  )

  const handleClick = useCallback(
    (code) => onSelectState(code),
    [onSelectState],
  )

  if (!rankedStates || !rankedStates.length) {
    return (
      <div className="compact-list-wrap">
        <div className="compact-list-empty">No states to display.</div>
      </div>
    )
  }

  return (
    <div className="compact-list-wrap">
      <table className="compact-list-table">
        <thead>
          <tr>
            <th className="compact-list-th num">#</th>
            <th className="compact-list-th">State</th>
            <th className="compact-list-th">Tier</th>
            <th className="compact-list-th">SVS</th>
          </tr>
        </thead>
        <tbody>
          {rankedStates.map((s) => {
            const isHovered = hoveredState === s.code
            const quadColor = QUADRANT_COLORS[s.quadrant] || '#9CA3AF'
            const tierColor = TIER_COLORS[s.tier] || TIER_COLORS.T3
            const fullName = STATE_NAMES[s.code] || s.code
            const barWidth = Math.min(100, Math.max(0, s.composite))

            return (
              <tr
                key={s.code}
                className={`compact-list-row${isHovered ? ' hovered' : ''}`}
                onMouseEnter={() => handleMouseEnter(s.code)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(s.code)}
              >
                <td className="compact-list-td num">
                  <span className="compact-list-rank">{s.rank}</span>
                </td>
                <td className="compact-list-td">
                  <div className="compact-list-state">
                    <span className="compact-list-code">{s.code}</span>
                    <span className="compact-list-name">{fullName}</span>
                  </div>
                </td>
                <td className="compact-list-td">
                  <span
                    className={`compact-list-tier compact-list-tier-${s.tier}`}
                    style={{ color: tierColor }}
                  >
                    {s.tier}
                  </span>
                </td>
                <td className="compact-list-td">
                  <div className="compact-list-score">
                    <span className="compact-list-score-num">
                      {Math.round(s.composite)}
                    </span>
                    <div className="compact-list-bar">
                      <div
                        className="compact-list-bar-fill"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: quadColor,
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
