import { useState } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'
import { QUADRANT_COLORS } from './scoringDefaults'

const compactNum = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export default function StateDrillDown({ stateData, onBack }) {
  const [expandedDistrict, setExpandedDistrict] = useState(null)

  const { stateInfo, districts } = stateData
  const fullName = STATE_NAMES[stateInfo.code] || stateInfo.code
  const quadColor = QUADRANT_COLORS[stateInfo.quadrant] || '#9CA3AF'

  return (
    <div className="drilldown-container">
      {/* ── Sticky header ── */}
      <div className="drilldown-header">
        <button className="drilldown-back-btn" onClick={onBack} type="button">
          &#8592; All States
        </button>

        <div className="drilldown-state-title">
          <span className="drilldown-state-code">{stateInfo.code}</span>
          <span className="drilldown-state-name">{fullName}</span>
        </div>

        <div className="drilldown-stats-row">
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">Rank</span>
            <span className="drilldown-stat-value">#{stateInfo.rank}</span>
          </div>
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">Tier</span>
            <span className="drilldown-stat-value">{stateInfo.tier}</span>
          </div>
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">Quadrant</span>
            <span className="drilldown-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                className="target-quadrant-dot"
                style={{ backgroundColor: quadColor }}
              />
              {stateInfo.quadrant}
            </span>
          </div>
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">SVS</span>
            <span className="drilldown-stat-value">{Math.round(stateInfo.composite)}</span>
          </div>
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">Enrollment</span>
            <span className="drilldown-stat-value">{compactNum(stateInfo.ccEnrollment)}</span>
          </div>
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">Campuses</span>
            <span className="drilldown-stat-value">{stateInfo.campusCount}</span>
          </div>
          <div className="drilldown-stat">
            <span className="drilldown-stat-label">Districts</span>
            <span className="drilldown-stat-value">{stateInfo.districtCount}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable district list ── */}
      <div className="drilldown-districts-wrap">
        <div className="drilldown-section-label">
          {districts.length} Congressional District{districts.length !== 1 ? 's' : ''}
        </div>

        {districts.length === 0 && (
          <div className="drilldown-empty">No district data available for {stateInfo.code}.</div>
        )}

        {districts.map((d) => {
          const isExpanded = expandedDistrict === d.cd
          const partyClass = d.meta.party === 'D' ? 'party-d' : d.meta.party === 'R' ? 'party-r' : ''

          return (
            <div key={d.cd} className={`drilldown-district${isExpanded ? ' expanded' : ''}`}>
              <div
                className="drilldown-district-row"
                onClick={() => setExpandedDistrict((prev) => (prev === d.cd ? null : d.cd))}
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
    </div>
  )
}
