import { useCallback, useState, useRef, useEffect, Fragment } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'
import { QUADRANT_COLORS } from './scoringDefaults'

const compactNum = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

/* ── Inline district expansion panel ── */
function InlineDistricts({ stateData, expandRef }) {
  const [expandedDistrict, setExpandedDistrict] = useState(null)

  if (!stateData || !stateData.districts) return null
  const { districts } = stateData

  return (
    <tr className="compact-list-expand-row" ref={expandRef}>
      <td colSpan={7} className="compact-list-expand-cell">
        <div className="drilldown-districts-wrap inline">
          <div className="drilldown-section-label">
            {districts.length} Congressional District{districts.length !== 1 ? 's' : ''}
          </div>

          {districts.length === 0 && (
            <div className="drilldown-empty">No district data available.</div>
          )}

          {districts.map((d) => {
            const isExpanded = expandedDistrict === d.cd
            const partyClass = d.meta.party === 'D' ? 'party-d' : d.meta.party === 'R' ? 'party-r' : ''

            return (
              <div key={d.cd} className={`drilldown-district${isExpanded ? ' expanded' : ''}`}>
                <div
                  className="drilldown-district-row"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedDistrict((prev) => (prev === d.cd ? null : d.cd))
                  }}
                >
                  <span className={`drilldown-chevron${isExpanded ? ' open' : ''}`}>&#9654;</span>
                  <span className="drilldown-district-code">{d.cd}</span>
                  <span className="drilldown-district-member">{d.meta.member || 'Vacant'}</span>
                  {d.meta.party && (
                    <span className={`target-party-dot ${partyClass}`} />
                  )}
                  <span className="drilldown-district-pvi">{d.meta.cook_pvi || ''}</span>
                  <span className="drilldown-district-campuses">
                    {d.campusCount} campus{d.campusCount !== 1 ? 'es' : ''}
                  </span>
                </div>

                {isExpanded && (
                  <div className="drilldown-campus-list">
                    {d.campuses.length === 0 ? (
                      <div className="drilldown-campus-empty">No campuses in this district.</div>
                    ) : (
                      <>
                        <div className="drilldown-campus-header">
                          <span className="drilldown-campus-hcol name">School</span>
                          <span className="drilldown-campus-hcol city">City</span>
                          <span className="drilldown-campus-hcol num">Enrollment</span>
                          <span className="drilldown-campus-hcol type">Type</span>
                        </div>
                        {d.campuses.map((c) => (
                          <div key={c.unitid} className="drilldown-campus-row">
                            <span className="drilldown-campus-col name">{c.name}</span>
                            <span className="drilldown-campus-col city">{c.city}</span>
                            <span className="drilldown-campus-col num">
                              {(c.enrollment || 0).toLocaleString()}
                            </span>
                            <span className="drilldown-campus-col type">{c.campus_type || ''}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </td>
    </tr>
  )
}

export default function CompactRankedList({
  rankedStates,
  hoveredState,
  onHoverState,
  onSelectState,
  selectedState,
  selectedStateData,
}) {
  const expandRef = useRef(null)

  const handleMouseEnter = useCallback(
    (code) => onHoverState(code),
    [onHoverState],
  )

  const handleMouseLeave = useCallback(
    () => onHoverState(null),
    [onHoverState],
  )

  const handleClick = useCallback(
    (code) => {
      // Toggle: click same state again to collapse
      onSelectState(selectedState === code ? null : code)
    },
    [onSelectState, selectedState],
  )

  // Scroll the expanded row into view
  useEffect(() => {
    if (selectedState && expandRef.current) {
      expandRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedState])

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
              <th className="compact-list-th num">#CCs</th>
              <th className="compact-list-th num">Students</th>
              <th className="compact-list-th num">Dist.</th>
              <th className="compact-list-th">SVS</th>
              <th className="compact-list-th" style={{ width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {rankedStates.map((s) => {
              const isHovered = hoveredState === s.code
              const isSelected = selectedState === s.code
              const quadColor = QUADRANT_COLORS[s.quadrant] || '#9CA3AF'
              const fullName = STATE_NAMES[s.code] || s.code
              const barWidth = Math.min(100, Math.max(0, s.composite))

              return (
                <Fragment key={s.code}>
                  <tr
                    className={`compact-list-row${isHovered ? ' hovered' : ''}${isSelected ? ' selected' : ''}`}
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
                      <span className={`compact-list-chevron${isSelected ? ' open' : ''}`}>
                        &#9660;
                      </span>
                    </td>
                  </tr>
                  {isSelected && selectedStateData && (
                    <InlineDistricts
                      stateData={selectedStateData}
                      expandRef={expandRef}
                    />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
