import { useCallback } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'
import { QUADRANT_COLORS } from './scoringDefaults'

const compactNum = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
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
    <>
      <div className="compact-list-header">
        <span className="compact-list-title">State Rankings</span>
        <span className="compact-list-subtitle">
          Click a state to explore districts
        </span>
      </div>
      <div className="compact-list-wrap">
        <table className="compact-list-table">
          <thead>
            <tr>
              <th className="compact-list-th num">#</th>
              <th className="compact-list-th">State</th>
              <th className="compact-list-th num">Camp.</th>
              <th className="compact-list-th num">Students</th>
              <th className="compact-list-th num">Dist.</th>
              <th className="compact-list-th">SVS</th>
              <th className="compact-list-th" style={{ width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {rankedStates.map((s) => {
              const isHovered = hoveredState === s.code
              const quadColor = QUADRANT_COLORS[s.quadrant] || '#9CA3AF'
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
                  <td className="compact-list-td num">
                    {s.campusCount}
                  </td>
                  <td className="compact-list-td num">
                    {compactNum(s.ccEnrollment)}
                  </td>
                  <td className="compact-list-td num">
                    {s.districtCount}
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
                  <td className="compact-list-td chevron-cell">
                    <span className="compact-list-chevron">&#9654;</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
