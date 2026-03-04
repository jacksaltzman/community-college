import { useState, useMemo, useCallback } from 'react'

const CAMPUS_TYPES = [
  'Large City', 'Midsize City', 'Suburban', 'Small City', 'Rural', 'Town / Remote',
]

function debounce(fn, delay) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) }
}

/* Collapsible section wrapper */
function FilterSection({ title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="sidebar-section">
      <div
        className="section-label"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="target-chevron" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block', fontSize: 10 }}>&#9654;</span>
          {title}
          {count > 0 && <span className="map-filter-count">{count}</span>}
        </span>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

/* Range input pair */
function RangeFilter({ label, minVal, maxVal, onMinChange, onMaxChange, minKey, maxKey }) {
  return (
    <div className="map-filter-group">
      <label className="map-filter-label">{label}</label>
      <div className="map-filter-range">
        <input type="number" className="map-filter-input" placeholder="Min"
          defaultValue={minVal} onChange={(e) => onMinChange(e.target.value)}
          key={minKey + '-' + (minVal === '' ? 'reset' : 'active')} />
        <span className="map-filter-dash">&ndash;</span>
        <input type="number" className="map-filter-input" placeholder="Max"
          defaultValue={maxVal} onChange={(e) => onMaxChange(e.target.value)}
          key={maxKey + '-' + (maxVal === '' ? 'reset' : 'active')} />
      </div>
    </div>
  )
}

/* Multi-select checkboxes */
function CheckboxGroup({ label, options, selected, onChange }) {
  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val])
  }
  return (
    <div className="map-filter-group">
      <label className="map-filter-label">{label}</label>
      <div className="toggle-group">
        {options.map((opt) => (
          <label key={opt} className="toggle-label">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function TargetFilters({
  stateFilters, setStateFilters,
  districtFilters, setDistrictFilters,
  campusFilters, setCampusFilters,
  onReset, onExport, summary,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const debouncedState = useMemo(() => debounce((k, v) => setStateFilters((p) => ({ ...p, [k]: v })), 300), [setStateFilters])
  const debouncedDistrict = useMemo(() => debounce((k, v) => setDistrictFilters((p) => ({ ...p, [k]: v })), 300), [setDistrictFilters])
  const debouncedCampus = useMemo(() => debounce((k, v) => setCampusFilters((p) => ({ ...p, [k]: v })), 300), [setCampusFilters])

  const stateCount = useMemo(() => {
    let c = 0
    if (stateFilters.pvi) c++
    if (stateFilters.senatorElection) c++
    if (stateFilters.senatorParty.length) c++
    if (stateFilters.enrollMin !== '') c++
    if (stateFilters.enrollMax !== '') c++
    if (stateFilters.turnoutMin !== '') c++
    if (stateFilters.turnoutMax !== '') c++
    if (stateFilters.eitcMin !== '') c++
    if (stateFilters.eitcMax !== '') c++
    return c
  }, [stateFilters])

  const districtCount = useMemo(() => {
    let c = 0
    if (districtFilters.pvi) c++
    if (districtFilters.repParty.length) c++
    if (districtFilters.enrollMin !== '') c++
    if (districtFilters.enrollMax !== '') c++
    if (districtFilters.campusMin !== '') c++
    if (districtFilters.campusMax !== '') c++
    return c
  }, [districtFilters])

  const campusCount = useMemo(() => {
    let c = 0
    if (campusFilters.enrollMin !== '') c++
    if (campusFilters.enrollMax !== '') c++
    if (campusFilters.campusTypes.length) c++
    if (campusFilters.districtsMin !== '') c++
    if (campusFilters.districtsMax !== '') c++
    return c
  }, [campusFilters])

  const numFmt = (n) => Number(n).toLocaleString()

  return (
    <div className={`map-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* Mobile header */}
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <span className="logo-text">TARGET</span>
        </div>
        <button className="map-hamburger" onClick={() => setSidebarOpen((p) => !p)} aria-label="Toggle sidebar">
          <span /><span /><span />
        </button>
      </div>

      <div className="sidebar-controls">
        {/* Summary */}
        <div className="sidebar-section">
          <div className="section-label">Results</div>
          <div>
            <div className="stat-row">
              <span className="stat-label">STATES</span>
              <span className="stat-value">{numFmt(summary.states)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">DISTRICTS</span>
              <span className="stat-value">{numFmt(summary.districts)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">CAMPUSES</span>
              <span className="stat-value">{numFmt(summary.campuses)}</span>
            </div>
          </div>
        </div>

        {/* State Filters */}
        <FilterSection title="State Filters" count={stateCount}>
          <div className="map-filter-group">
            <label className="map-filter-label">Cook PVI</label>
            <select className="styled-select" value={stateFilters.pvi}
              onChange={(e) => setStateFilters((p) => ({ ...p, pvi: e.target.value }))}>
              <option value="">Any</option>
              <option value="D-lean">D-lean (D+6 or more)</option>
              <option value="Swing">Swing (D+5 to R+5)</option>
              <option value="R-lean">R-lean (R+6 or more)</option>
            </select>
          </div>
          <div className="map-filter-group">
            <label className="map-filter-label">Senator Up for Election</label>
            <select className="styled-select" value={stateFilters.senatorElection}
              onChange={(e) => setStateFilters((p) => ({ ...p, senatorElection: e.target.value }))}>
              <option value="">Any</option>
              <option value="2026">2026</option>
              <option value="2028">2028</option>
              <option value="2030">2030</option>
            </select>
          </div>
          <CheckboxGroup label="Senator Party" options={['D', 'R']}
            selected={stateFilters.senatorParty}
            onChange={(v) => setStateFilters((p) => ({ ...p, senatorParty: v }))} />
          <RangeFilter label="Total Enrollment" minVal={stateFilters.enrollMin} maxVal={stateFilters.enrollMax}
            onMinChange={(v) => debouncedState('enrollMin', v)} onMaxChange={(v) => debouncedState('enrollMax', v)}
            minKey="st-enrollMin" maxKey="st-enrollMax" />
          <RangeFilter label="2022 Turnout (%)" minVal={stateFilters.turnoutMin} maxVal={stateFilters.turnoutMax}
            onMinChange={(v) => debouncedState('turnoutMin', v)} onMaxChange={(v) => debouncedState('turnoutMax', v)}
            minKey="st-turnoutMin" maxKey="st-turnoutMax" />
          <RangeFilter label="EITC Unclaimed (%)" minVal={stateFilters.eitcMin} maxVal={stateFilters.eitcMax}
            onMinChange={(v) => debouncedState('eitcMin', v)} onMaxChange={(v) => debouncedState('eitcMax', v)}
            minKey="st-eitcMin" maxKey="st-eitcMax" />
        </FilterSection>

        {/* District Filters */}
        <FilterSection title="District Filters" count={districtCount}>
          <div className="map-filter-group">
            <label className="map-filter-label">Cook PVI</label>
            <select className="styled-select" value={districtFilters.pvi}
              onChange={(e) => setDistrictFilters((p) => ({ ...p, pvi: e.target.value }))}>
              <option value="">Any</option>
              <option value="D-lean">D-lean (D+6 or more)</option>
              <option value="Swing">Swing (D+5 to R+5)</option>
              <option value="R-lean">R-lean (R+6 or more)</option>
            </select>
          </div>
          <CheckboxGroup label="Representative Party" options={['D', 'R']}
            selected={districtFilters.repParty}
            onChange={(v) => setDistrictFilters((p) => ({ ...p, repParty: v }))} />
          <RangeFilter label="District Enrollment" minVal={districtFilters.enrollMin} maxVal={districtFilters.enrollMax}
            onMinChange={(v) => debouncedDistrict('enrollMin', v)} onMaxChange={(v) => debouncedDistrict('enrollMax', v)}
            minKey="dt-enrollMin" maxKey="dt-enrollMax" />
          <RangeFilter label="Campus Count" minVal={districtFilters.campusMin} maxVal={districtFilters.campusMax}
            onMinChange={(v) => debouncedDistrict('campusMin', v)} onMaxChange={(v) => debouncedDistrict('campusMax', v)}
            minKey="dt-campusMin" maxKey="dt-campusMax" />
        </FilterSection>

        {/* Campus Filters */}
        <FilterSection title="Campus Filters" count={campusCount}>
          <RangeFilter label="Enrollment" minVal={campusFilters.enrollMin} maxVal={campusFilters.enrollMax}
            onMinChange={(v) => debouncedCampus('enrollMin', v)} onMaxChange={(v) => debouncedCampus('enrollMax', v)}
            minKey="cm-enrollMin" maxKey="cm-enrollMax" />
          <CheckboxGroup label="Campus Type" options={CAMPUS_TYPES}
            selected={campusFilters.campusTypes}
            onChange={(v) => setCampusFilters((p) => ({ ...p, campusTypes: v }))} />
          <RangeFilter label="Districts Reached" minVal={campusFilters.districtsMin} maxVal={campusFilters.districtsMax}
            onMinChange={(v) => debouncedCampus('districtsMin', v)} onMaxChange={(v) => debouncedCampus('districtsMax', v)}
            minKey="cm-districtsMin" maxKey="cm-districtsMax" />
        </FilterSection>

        {/* Bottom controls */}
        <div className="sidebar-section">
          <button className="map-reset-btn" onClick={onReset}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            Reset All Filters
          </button>
          <button className="target-export-btn" onClick={onExport}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
