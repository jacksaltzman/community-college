import { useState, useCallback, useMemo, Fragment } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'
import { QUADRANT_COLORS } from './scoringDefaults'

const numFmt = (n) => Number(n).toLocaleString()

/* ── District Drill-Down Sub-Component ── */

function DistrictDrillDown({ stateCode, districtsMeta, campuses, navigate }) {
  // Gather all districts for this state
  const districts = useMemo(() => {
    if (!districtsMeta?.districts) return []

    const stateDistricts = {}
    Object.entries(districtsMeta.districts).forEach(([cd, meta]) => {
      const st = meta.state || cd.split('-')[0]
      if (st !== stateCode) return
      stateDistricts[cd] = { meta, campusCount: 0, ccEnrollment: 0 }
    })

    // Aggregate campus data per district
    if (campuses?.features) {
      campuses.features.forEach((f) => {
        const allDistricts = f.properties.all_districts
        if (!allDistricts) return
        allDistricts.split('|').forEach((cd) => {
          cd = cd.trim()
          if (!cd || !stateDistricts[cd]) return
          stateDistricts[cd].campusCount += 1
          stateDistricts[cd].ccEnrollment += f.properties.enrollment || 0
        })
      })
    }

    return Object.entries(stateDistricts)
      .map(([cd, d]) => ({ cd, ...d }))
      .sort((a, b) => a.cd.localeCompare(b.cd))
  }, [stateCode, districtsMeta, campuses])

  if (!districts.length) {
    return (
      <tr className="district-drilldown-row">
        <td colSpan={10} className="district-drilldown-empty">
          No district data available for {stateCode}.
        </td>
      </tr>
    )
  }

  return (
    <tr className="district-drilldown-row">
      <td colSpan={10} className="district-drilldown-cell">
        <table className="district-drilldown-table">
          <thead>
            <tr>
              <th className="district-drilldown-th">District</th>
              <th className="district-drilldown-th">Member</th>
              <th className="district-drilldown-th">Party</th>
              <th className="district-drilldown-th">Cook PVI</th>
              <th className="district-drilldown-th num">Campuses</th>
              <th className="district-drilldown-th num">CC Enrollment</th>
              <th className="district-drilldown-th"></th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <tr key={d.cd} className="district-drilldown-tr">
                <td className="district-drilldown-td">{d.cd}</td>
                <td className="district-drilldown-td">{d.meta.member || ''}</td>
                <td className="district-drilldown-td">
                  {d.meta.party && (
                    <span
                      className={`target-party-dot ${
                        d.meta.party === 'D' ? 'party-d' : d.meta.party === 'R' ? 'party-r' : ''
                      }`}
                    />
                  )}
                </td>
                <td className="district-drilldown-td">{d.meta.cook_pvi || ''}</td>
                <td className="district-drilldown-td num">{numFmt(d.campusCount)}</td>
                <td className="district-drilldown-td num">{numFmt(d.ccEnrollment)}</td>
                <td className="district-drilldown-td">
                  <button
                    className="district-drilldown-map-btn"
                    onClick={() => navigate('map', 'districts', { district: d.cd })}
                  >
                    View on map
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

/* ── Main Ranked Results Table ── */

export default function TargetResultsTable({ rankedStates, navigate, districtsMeta, campuses }) {
  const [expandedState, setExpandedState] = useState(null)

  const toggleExpand = useCallback(
    (code) => {
      setExpandedState((prev) => (prev === code ? null : code))
    },
    []
  )

  if (!rankedStates || !rankedStates.length) {
    return (
      <div className="target-ranked-wrap">
        <div className="target-ranked-empty">
          No ranked states to display. Adjust scoring weights or filters.
        </div>
      </div>
    )
  }

  return (
    <div className="target-ranked-wrap">
      <table className="target-ranked-table">
        <thead>
          <tr>
            <th className="target-ranked-th">Rank</th>
            <th className="target-ranked-th">State</th>
            <th className="target-ranked-th">Tier</th>
            <th className="target-ranked-th">Quadrant</th>
            <th className="target-ranked-th">Acquisition Score</th>
            <th className="target-ranked-th">Civic Leverage Score</th>
            <th className="target-ranked-th">Composite SVS</th>
            <th className="target-ranked-th num">CC Enrollment</th>
            <th className="target-ranked-th num">Young Professionals</th>
            <th className="target-ranked-th num">Districts</th>
          </tr>
        </thead>
        <tbody>
          {rankedStates.map((s) => {
            const isExpanded = expandedState === s.code
            const quadColor = QUADRANT_COLORS[s.quadrant] || '#9CA3AF'
            const fullName = STATE_NAMES[s.code] || s.code

            return (
              <Fragment key={s.code}>
                <tr
                  className={`target-ranked-row${isExpanded ? ' target-ranked-row-expanded' : ''}`}
                  onClick={() => toggleExpand(s.code)}
                >
                  <td className="target-ranked-td target-ranked-rank">{s.rank}</td>
                  <td className="target-ranked-td target-ranked-state">
                    <span className="target-ranked-state-code">{s.code}</span>
                    <span className="target-ranked-state-name">{fullName}</span>
                  </td>
                  <td className={`target-ranked-td target-ranked-tier target-ranked-tier-${s.tier}`}>
                    {s.tier}
                  </td>
                  <td className="target-ranked-td target-ranked-quadrant">
                    <span
                      className="target-quadrant-dot"
                      style={{ backgroundColor: quadColor }}
                    />
                    <span className="target-quadrant-label">{s.quadrant}</span>
                  </td>
                  <td className="target-ranked-td target-ranked-score-cell">
                    <span className="target-ranked-score-num">
                      {Math.round(s.acqScore)}
                    </span>
                    <div className="score-bar-wrap">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, s.acqScore))}%`,
                          backgroundColor: quadColor,
                        }}
                      />
                    </div>
                  </td>
                  <td className="target-ranked-td target-ranked-score-cell">
                    <span className="target-ranked-score-num">
                      {Math.round(s.civicScore)}
                    </span>
                    <div className="score-bar-wrap">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, s.civicScore))}%`,
                          backgroundColor: quadColor,
                        }}
                      />
                    </div>
                  </td>
                  <td className="target-ranked-td target-ranked-composite">
                    {Math.round(s.composite)}
                  </td>
                  <td className="target-ranked-td num">{numFmt(s.ccEnrollment)}</td>
                  <td className="target-ranked-td num">
                    {numFmt(s.youngProfessionalPop || 0)}
                  </td>
                  <td className="target-ranked-td num">{s.districtCount}</td>
                </tr>
                {isExpanded && (
                  <DistrictDrillDown
                    stateCode={s.code}
                    districtsMeta={districtsMeta}
                    campuses={campuses}
                    navigate={navigate}
                  />
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
