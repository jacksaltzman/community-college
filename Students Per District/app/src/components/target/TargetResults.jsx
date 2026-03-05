import { useState, useMemo, useCallback } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'

const numFmt = (n) => Number(n).toLocaleString()

function pviClass(pviStr) {
  if (!pviStr || pviStr === 'EVEN') return 'swing'
  const m = pviStr.match(/^([DR])\+(\d+)$/)
  if (!m) return 'swing'
  const n = m[1] === 'D' ? -Number(m[2]) : Number(m[2])
  if (n < -5) return 'd-lean'
  if (n > 5) return 'r-lean'
  return 'swing'
}

export default function TargetResults({ filteredStates, summary, navigate }) {
  const [expandedStates, setExpandedStates] = useState({})
  const [expandedDistricts, setExpandedDistricts] = useState({})
  const [viewMode, setViewMode] = useState('grouped')

  const toggleState = useCallback((code) => {
    setExpandedStates((prev) => ({ ...prev, [code]: !prev[code] }))
  }, [])

  const toggleDistrict = useCallback((cd) => {
    setExpandedDistricts((prev) => ({ ...prev, [cd]: !prev[cd] }))
  }, [])

  const expandAll = useCallback(() => {
    const states = {}
    const districts = {}
    filteredStates.forEach((st) => {
      states[st.code] = true
      Object.keys(st.districts).forEach((cd) => { districts[cd] = true })
    })
    setExpandedStates(states)
    setExpandedDistricts(districts)
  }, [filteredStates])

  const collapseAll = useCallback(() => {
    setExpandedStates({})
    setExpandedDistricts({})
  }, [])

  const anyExpanded = Object.values(expandedStates).some(Boolean)

  /* Flat rows for table view */
  const flatRows = useMemo(() => {
    if (viewMode !== 'flat') return []
    const rows = []
    const seen = new Set()
    filteredStates.forEach((st) => {
      Object.entries(st.districts).forEach(([cd, d]) => {
        d.campuses.forEach((c) => {
          const id = c.properties.unitid
          const key = `${cd}-${id}`
          if (seen.has(key)) return
          seen.add(key)
          rows.push({
            ...c.properties,
            stateCode: st.code,
            statePVI: st.stInfo?.cookPVI,
            districtCode: cd,
            districtPVI: d.meta.cook_pvi,
            rep: d.meta.member,
            repParty: d.meta.party,
          })
        })
      })
    })
    return rows.sort((a, b) => (b.enrollment || 0) - (a.enrollment || 0))
  }, [filteredStates, viewMode])

  /* Summary bar */
  const summaryBar = (
    <div className="target-summary-bar">
      <div className="target-summary-left">
        <strong>{numFmt(summary.states)}</strong> state{summary.states !== 1 ? 's' : ''}
        <span className="target-summary-sep">·</span>
        <strong>{numFmt(summary.districts)}</strong> district{summary.districts !== 1 ? 's' : ''}
        <span className="target-summary-sep">·</span>
        <strong>{numFmt(summary.campuses)}</strong> campus{summary.campuses !== 1 ? 'es' : ''}
        <span className="target-summary-sep">·</span>
        <strong>{numFmt(summary.enrollment)}</strong> enrolled
      </div>
      <div className="target-summary-right">
        {viewMode === 'grouped' && filteredStates.length > 0 && (
          <button className="target-text-btn" onClick={anyExpanded ? collapseAll : expandAll}>
            {anyExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
        <div className="target-view-toggle">
          <button
            className={`target-view-btn${viewMode === 'grouped' ? ' active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Grouped view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="5" height="3" rx="0.5" />
              <rect x="1" y="6" width="5" height="3" rx="0.5" />
              <rect x="1" y="11" width="5" height="3" rx="0.5" />
              <rect x="8" y="1" width="7" height="3" rx="0.5" />
              <rect x="8" y="6" width="7" height="3" rx="0.5" />
              <rect x="8" y="11" width="7" height="3" rx="0.5" />
            </svg>
          </button>
          <button
            className={`target-view-btn${viewMode === 'flat' ? ' active' : ''}`}
            onClick={() => setViewMode('flat')}
            title="Table view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zM10 4H6v3h4V4zm0 4H6v3h4V8zm0 4H6v3h4v-3zM5 4H1v3h4V4zm0 4H1v3h4V8zm0 4H1v2a1 1 0 0 0 1 1h3v-3z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  if (!filteredStates.length) {
    return (
      <div className="target-results">
        {summaryBar}
        <div className="target-empty">
          No results match your filters. Try broadening your criteria.
        </div>
      </div>
    )
  }

  /* ── Flat table view ── */
  if (viewMode === 'flat') {
    return (
      <div className="target-results">
        {summaryBar}
        <div className="target-table-wrap">
          <table className="target-table">
            <thead>
              <tr>
                <th>Campus</th>
                <th>City</th>
                <th>State</th>
                <th>District</th>
                <th>Representative</th>
                <th>Type</th>
                <th className="num">Enrollment</th>
                <th className="num">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((r) => (
                <tr key={`${r.districtCode}-${r.unitid}`}>
                  <td>
                    <a
                      className="campus-link"
                      href={`#map/campuses?campus=${r.unitid}`}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate('map', 'campuses', { campus: String(r.unitid) })
                      }}
                    >
                      {r.name}
                    </a>
                  </td>
                  <td className="muted">{r.city}</td>
                  <td>
                    {r.stateCode}
                    {r.statePVI && <span className={`target-pvi ${pviClass(r.statePVI)}`}>{r.statePVI}</span>}
                  </td>
                  <td>
                    {r.districtCode}
                    {r.districtPVI && <span className={`target-pvi ${pviClass(r.districtPVI)}`}>{r.districtPVI}</span>}
                  </td>
                  <td>
                    {r.rep && (
                      <>
                        <span className={`target-party-dot ${r.repParty === 'D' ? 'party-d' : r.repParty === 'R' ? 'party-r' : ''}`} />
                        {r.rep}
                      </>
                    )}
                  </td>
                  <td className="muted">{r.campus_type}</td>
                  <td className="num">{numFmt(r.enrollment || 0)}</td>
                  <td className="num muted">{r.districts_reached}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ── Grouped tree view ── */
  return (
    <div className="target-results">
      {summaryBar}
      <div className="target-tree">
        {filteredStates.map((st) => {
          const stateOpen = expandedStates[st.code]
          const fullName = STATE_NAMES[st.code] || st.code
          const districts = Object.entries(st.districts).sort(([a], [b]) => a.localeCompare(b))

          return (
            <div key={st.code} className="target-state-group">
              <div className="target-state-row" onClick={() => toggleState(st.code)}>
                <span className={`target-chevron${stateOpen ? ' open' : ''}`}>&#9654;</span>
                <span className="target-state-name">{fullName} ({st.code})</span>
                {st.stInfo?.cookPVI && (
                  <span className={`target-pvi ${pviClass(st.stInfo.cookPVI)}`}>{st.stInfo.cookPVI}</span>
                )}
                <span className="target-meta">
                  {st.districtCount} dist. · {numFmt(st.campusCount)} campus{st.campusCount !== 1 ? 'es' : ''} · {numFmt(st.enrollment)} enrolled
                </span>
              </div>

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
                    <div className={`target-district-row pvi-border-${pviClass(d.meta.cook_pvi)}`} onClick={() => toggleDistrict(cd)}>
                      <span className={`target-chevron${distOpen ? ' open' : ''}`}>&#9654;</span>
                      <span className="target-district-name">{cd}</span>
                      {d.meta.cook_pvi && <span className={`target-pvi ${pviClass(d.meta.cook_pvi)}`}>{d.meta.cook_pvi}</span>}
                      {d.meta.member && (
                        <span className="target-rep">
                          <span className={`target-party-dot ${d.meta.party === 'D' ? 'party-d' : d.meta.party === 'R' ? 'party-r' : ''}`} />
                          {d.meta.member}
                        </span>
                      )}
                      <span className="target-meta">
                        {uniqueCampuses.length} campus{uniqueCampuses.length !== 1 ? 'es' : ''} · {numFmt(d.enrollment)} enrolled
                      </span>
                    </div>

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
