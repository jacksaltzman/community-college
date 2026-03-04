import { useState, useCallback } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'

const numFmt = (n) => Number(n).toLocaleString()

export default function TargetResults({ filteredStates, summary, navigate }) {
  const [expandedStates, setExpandedStates] = useState({})
  const [expandedDistricts, setExpandedDistricts] = useState({})

  const toggleState = useCallback((code) => {
    setExpandedStates((prev) => ({ ...prev, [code]: !prev[code] }))
  }, [])

  const toggleDistrict = useCallback((cd) => {
    setExpandedDistricts((prev) => ({ ...prev, [cd]: !prev[cd] }))
  }, [])

  if (!filteredStates.length) {
    return (
      <div className="target-results">
        <div className="target-summary-bar">
          <span>0 states · 0 districts · 0 campuses</span>
        </div>
        <div className="target-empty">
          No results match your filters. Try broadening your criteria.
        </div>
      </div>
    )
  }

  return (
    <div className="target-results">
      {/* Summary bar */}
      <div className="target-summary-bar">
        <span>
          <strong>{summary.states}</strong> state{summary.states !== 1 ? 's' : ''}
          {' · '}
          <strong>{summary.districts}</strong> district{summary.districts !== 1 ? 's' : ''}
          {' · '}
          <strong>{summary.campuses}</strong> campus{summary.campuses !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Tree */}
      <div className="target-tree">
        {filteredStates.map((st) => {
          const stateOpen = expandedStates[st.code]
          const fullName = STATE_NAMES[st.code] || st.code
          const districts = Object.entries(st.districts).sort(([a], [b]) => a.localeCompare(b))

          return (
            <div key={st.code} className="target-state-group">
              {/* State row */}
              <div className="target-state-row" onClick={() => toggleState(st.code)}>
                <span className={`target-chevron${stateOpen ? ' open' : ''}`}>&#9654;</span>
                <span className="target-state-name">{fullName} ({st.code})</span>
                {st.stInfo?.cookPVI && (
                  <span className="target-pvi">{st.stInfo.cookPVI}</span>
                )}
                <span className="target-meta">
                  {st.districtCount} district{st.districtCount !== 1 ? 's' : ''}
                  {' · '}
                  {numFmt(st.campusCount)} campus{st.campusCount !== 1 ? 'es' : ''}
                  {' · '}
                  {numFmt(st.enrollment)} enrolled
                </span>
              </div>

              {/* Districts */}
              {stateOpen && districts.map(([cd, d]) => {
                const distOpen = expandedDistricts[cd]
                const seen = new Set()
                const uniqueCampuses = d.campuses.filter((c) => {
                  const id = c.properties.unitid
                  if (seen.has(id)) return false
                  seen.add(id)
                  return true
                })

                return (
                  <div key={cd} className="target-district-group">
                    {/* District row */}
                    <div className="target-district-row" onClick={() => toggleDistrict(cd)}>
                      <span className={`target-chevron${distOpen ? ' open' : ''}`}>&#9654;</span>
                      <span className="target-district-name">{cd}</span>
                      {d.meta.cook_pvi && <span className="target-pvi">{d.meta.cook_pvi}</span>}
                      {d.meta.member && (
                        <span className="target-rep">{d.meta.member} ({d.meta.party})</span>
                      )}
                      <span className="target-meta">
                        {uniqueCampuses.length} campus{uniqueCampuses.length !== 1 ? 'es' : ''}
                        {' · '}
                        {numFmt(d.enrollment)} enrolled
                      </span>
                    </div>

                    {/* Campuses */}
                    {distOpen && (
                      <div className="target-campus-list">
                        {uniqueCampuses
                          .sort((a, b) => (b.properties.enrollment || 0) - (a.properties.enrollment || 0))
                          .map((c) => {
                            const p = c.properties
                            return (
                              <div key={p.unitid} className="target-campus-row">
                                <span className="target-campus-name">
                                  <a
                                    className="campus-link"
                                    href={`#map/campuses?campus=${p.unitid}`}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      navigate('map', 'campuses', { campus: String(p.unitid) })
                                    }}
                                  >
                                    {p.name}
                                  </a>
                                </span>
                                <span className="target-campus-city">{p.city}</span>
                                <span className="target-campus-type">{p.campus_type}</span>
                                <span className="target-campus-enroll">{numFmt(p.enrollment || 0)}</span>
                                <span className="target-campus-districts">{p.districts_reached} dist.</span>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
