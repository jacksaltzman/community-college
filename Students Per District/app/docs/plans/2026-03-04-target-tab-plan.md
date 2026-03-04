# Target Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a "Target" tab with cascading state→district→campus filters and an expandable accordion results tree for GTM geography targeting.

**Architecture:** Single-page layout with a 320px filter sidebar (left) and a flex results panel (right). All filter state lives in `TargetView.jsx`. Cascade logic: campus filters run first, then district, then state — each level only survives if it has qualifying children AND matches its own criteria. **Cook PVI and Party filters cascade down** — setting PVI to "Swing" at the state level also filters districts to swing PVI. Senator party also cascades to representative party. Results display as an expandable tree.

**Tech Stack:** React 18, Vite, existing CSS design system (tokens.css), hash-based routing. No test framework — verify via dev server + build.

---

### Task 1: Add routing for Target page

**Files:**
- Modify: `src/App.jsx` (lines 5-6, 12-13, 44-46)
- Modify: `src/components/Layout.jsx` (lines 9-13, 27, 99-134)

**Step 1: Update App.jsx routing**

In `src/App.jsx`, add `'target'` to `VALID_PAGES` array (line 5):
```js
const VALID_PAGES = ['map', 'data', 'target', 'methodology']
```

The `navigate` function (line 43) currently only appends subView for `map` and `data`. Target has no subView so no change needed there.

**Step 2: Update Layout.jsx tabs and rendering**

In `src/components/Layout.jsx`:

Add Target to TABS array (around line 9):
```js
const TABS = [
  { key: 'map', label: 'Map' },
  { key: 'data', label: 'Data' },
  { key: 'target', label: 'Target' },
  { key: 'methodology', label: 'Methodology' },
]
```

Add import at top:
```js
import TargetView from './target/TargetView'
```

The `hasSubNav` check (line 27) stays as-is — Target has no sub-nav.

Add render block inside the `<>` fragment, after the methodology conditional (around line 133):
```jsx
{page === 'target' && (
  <TargetView data={data} navigate={navigate} />
)}
```

**Step 3: Create placeholder TargetView**

Create `src/components/target/TargetView.jsx` with a placeholder:
```jsx
export default function TargetView({ data, navigate }) {
  return <div style={{ padding: 24 }}>Target tab placeholder</div>
}
```

**Step 4: Verify**

Run `npm run build` — no errors. Open dev server, click Target tab — see placeholder text.

**Step 5: Commit**

```
feat: add Target tab routing and placeholder
```

---

### Task 2: Build the cascade filter engine (TargetView.jsx)

**Files:**
- Modify: `src/components/target/TargetView.jsx`

This is the core logic component. It holds all filter state and computes the cascading filtered data structure.

**Step 1: Define filter state shapes**

```jsx
import { useState, useMemo, useCallback } from 'react'
import TargetFilters from './TargetFilters'
import TargetResults from './TargetResults'
import '../../styles/target.css'

const INITIAL_STATE_FILTERS = {
  pvi: '',            // '', 'D-lean', 'Swing', 'R-lean'
  senatorElection: '', // '', '2026', '2028', '2030'
  senatorParty: [],    // ['D'], ['R'], ['D','R'], []
  enrollMin: '',
  enrollMax: '',
  turnoutMin: '',
  turnoutMax: '',
  eitcMin: '',
  eitcMax: '',
}

const INITIAL_DISTRICT_FILTERS = {
  pvi: '',
  repParty: [],       // ['D'], ['R'], ['D','R'], []
  enrollMin: '',
  enrollMax: '',
  campusMin: '',
  campusMax: '',
}

const INITIAL_CAMPUS_FILTERS = {
  enrollMin: '',
  enrollMax: '',
  campusTypes: [],     // multi-select from campus_type field
  districtsMin: '',
  districtsMax: '',
}
```

**Step 2: Implement cascade logic as useMemo**

The cascade runs bottom-up in a single `useMemo`:

```jsx
export default function TargetView({ data, navigate }) {
  const [stateFilters, setStateFilters] = useState(INITIAL_STATE_FILTERS)
  const [districtFilters, setDistrictFilters] = useState(INITIAL_DISTRICT_FILTERS)
  const [campusFilters, setCampusFilters] = useState(INITIAL_CAMPUS_FILTERS)

  const campusesData = data?.campuses
  const districtsMeta = data?.districtsMeta
  const statesData = data?.statesData

  /* ── Helper: Parse PVI string to numeric ── */
  const parsePVI = useCallback((s) => {
    if (!s || s === 'EVEN') return 0
    const m = s.match(/^([DR])\+(\d+)$/)
    if (!m) return 0
    return m[1] === 'D' ? -Number(m[2]) : Number(m[2])
  }, [])

  /* ── Helper: Check PVI category ── */
  const matchesPVI = useCallback((pviStr, filter) => {
    if (!filter) return true
    const n = parsePVI(pviStr)
    switch (filter) {
      case 'D-lean': return n < -5    // D+6 or more
      case 'Swing':  return n >= -5 && n <= 5
      case 'R-lean': return n > 5     // R+6 or more
      default: return true
    }
  }, [parsePVI])

  /* ── CASCADE: campus → district → state ── */
  const { filteredStates, filteredDistricts, filteredCampuses, summary } = useMemo(() => {
    if (!campusesData?.features || !districtsMeta?.districts) {
      return { filteredStates: [], filteredDistricts: {}, filteredCampuses: {}, summary: { states: 0, districts: 0, campuses: 0 } }
    }

    // 1. Filter campuses
    const cf = campusFilters
    const survivingCampuses = campusesData.features.filter((f) => {
      const p = f.properties
      if (cf.enrollMin !== '' && (p.enrollment || 0) < parseFloat(cf.enrollMin)) return false
      if (cf.enrollMax !== '' && (p.enrollment || 0) > parseFloat(cf.enrollMax)) return false
      if (cf.campusTypes.length > 0 && !cf.campusTypes.includes(p.campus_type)) return false
      if (cf.districtsMin !== '' && (p.districts_reached || 0) < parseFloat(cf.districtsMin)) return false
      if (cf.districtsMax !== '' && (p.districts_reached || 0) > parseFloat(cf.districtsMax)) return false
      return true
    })

    // 2. Group campuses by district
    const districtMap = {} // cd_code → { campuses: [], enrollment, campusCount }
    survivingCampuses.forEach((f) => {
      const allDistricts = f.properties.all_districts
      if (!allDistricts) return
      allDistricts.split('|').forEach((cd) => {
        cd = cd.trim()
        if (!cd) return
        if (!districtMap[cd]) districtMap[cd] = { campuses: [], enrollment: 0, campusCount: 0 }
        districtMap[cd].campuses.push(f)
        districtMap[cd].enrollment += f.properties.enrollment || 0
        districtMap[cd].campusCount += 1
      })
    })

    // 3. Filter districts
    const df = districtFilters
    const survivingDistricts = {}
    Object.entries(districtMap).forEach(([cd, dm]) => {
      const meta = districtsMeta.districts[cd] || {}
      if (!matchesPVI(meta.cook_pvi, df.pvi)) return
      if (df.repParty.length > 0 && !df.repParty.includes(meta.party)) return
      if (df.enrollMin !== '' && dm.enrollment < parseFloat(df.enrollMin)) return
      if (df.enrollMax !== '' && dm.enrollment > parseFloat(df.enrollMax)) return
      if (df.campusMin !== '' && dm.campusCount < parseFloat(df.campusMin)) return
      if (df.campusMax !== '' && dm.campusCount > parseFloat(df.campusMax)) return
      survivingDistricts[cd] = { ...dm, meta }
    })

    // 4. Group districts by state
    const stateMap = {} // state → { districts: {cd: ...}, enrollment, campusCount, districtCount }
    Object.entries(survivingDistricts).forEach(([cd, d]) => {
      const st = d.meta.state || cd.split('-')[0]
      if (!stateMap[st]) stateMap[st] = { districts: {}, enrollment: 0, campusCount: 0, districtCount: 0 }
      stateMap[st].districts[cd] = d
      stateMap[st].enrollment += d.enrollment
      stateMap[st].campusCount += d.campusCount
      stateMap[st].districtCount += 1
    })

    // 5. Filter states
    const sf = stateFilters
    const finalStates = []
    Object.entries(stateMap).forEach(([st, sm]) => {
      const stInfo = statesData?.[st] || {}
      if (!matchesPVI(stInfo.cookPVI, sf.pvi)) return
      if (sf.senatorElection) {
        const year = parseInt(sf.senatorElection)
        const s1 = stInfo.senator1NextElection === year
        const s2 = stInfo.senator2NextElection === year
        if (!s1 && !s2) return
      }
      if (sf.senatorParty.length > 0) {
        const parties = new Set([stInfo.senator1Party, stInfo.senator2Party].filter(Boolean))
        if (!sf.senatorParty.some((p) => parties.has(p))) return
      }
      if (sf.enrollMin !== '' && sm.enrollment < parseFloat(sf.enrollMin)) return
      if (sf.enrollMax !== '' && sm.enrollment > parseFloat(sf.enrollMax)) return
      if (sf.turnoutMin !== '' && (stInfo.midtermTurnout2022 ?? 100) < parseFloat(sf.turnoutMin)) return
      if (sf.turnoutMax !== '' && (stInfo.midtermTurnout2022 ?? 0) > parseFloat(sf.turnoutMax)) return
      if (sf.eitcMin !== '' && (stInfo.eitcUnclaimedRate ?? 100) < parseFloat(sf.eitcMin)) return
      if (sf.eitcMax !== '' && (stInfo.eitcUnclaimedRate ?? 0) > parseFloat(sf.eitcMax)) return

      finalStates.push({ code: st, stInfo, ...sm })
    })

    // Sort states alphabetically
    finalStates.sort((a, b) => a.code.localeCompare(b.code))

    // Compute total campuses (deduplicated)
    let totalCampuses = 0
    const seenCampuses = new Set()
    finalStates.forEach((s) => {
      Object.values(s.districts).forEach((d) => {
        d.campuses.forEach((c) => {
          const id = c.properties.unitid
          if (!seenCampuses.has(id)) {
            seenCampuses.add(id)
            totalCampuses++
          }
        })
      })
    })

    return {
      filteredStates: finalStates,
      summary: {
        states: finalStates.length,
        districts: finalStates.reduce((s, st) => s + st.districtCount, 0),
        campuses: totalCampuses,
      },
    }
  }, [campusesData, districtsMeta, statesData, campusFilters, districtFilters, stateFilters, matchesPVI])

  const handleReset = useCallback(() => {
    setStateFilters(INITIAL_STATE_FILTERS)
    setDistrictFilters(INITIAL_DISTRICT_FILTERS)
    setCampusFilters(INITIAL_CAMPUS_FILTERS)
  }, [])

  /* ── CSV Export ── */
  const handleExport = useCallback(() => {
    const headers = [
      'State', 'District', 'Campus Name', 'City', 'Campus Type',
      'Enrollment', 'Districts Reached',
      'Cook PVI (State)', 'Cook PVI (District)', 'Representative', 'Party',
    ]

    function csvEscape(val) {
      if (val == null) return ''
      const s = String(val)
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s
    }

    const lines = [headers.map(csvEscape).join(',')]
    const seen = new Set()

    filteredStates.forEach((st) => {
      const stInfo = st.stInfo || {}
      Object.entries(st.districts).forEach(([cd, d]) => {
        d.campuses.forEach((c) => {
          const key = `${cd}-${c.properties.unitid}`
          if (seen.has(key)) return
          seen.add(key)
          const p = c.properties
          lines.push([
            st.code, cd, p.name, p.city, p.campus_type,
            p.enrollment, p.districts_reached,
            stInfo.cookPVI || '', d.meta.cook_pvi || '',
            d.meta.member || '', d.meta.party || '',
          ].map(csvEscape).join(','))
        })
      })
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'target_campuses.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredStates])

  if (data?.loading) return null

  return (
    <div className="target-page">
      <TargetFilters
        stateFilters={stateFilters}
        setStateFilters={setStateFilters}
        districtFilters={districtFilters}
        setDistrictFilters={setDistrictFilters}
        campusFilters={campusFilters}
        setCampusFilters={setCampusFilters}
        onReset={handleReset}
        onExport={handleExport}
        summary={summary}
      />
      <TargetResults
        filteredStates={filteredStates}
        summary={summary}
        navigate={navigate}
      />
    </div>
  )
}
```

**Step 2: Verify**

Run `npm run build` — will fail because TargetFilters and TargetResults don't exist yet. That's expected.

**Step 3: Commit**

```
feat: implement Target cascade filter engine
```

---

### Task 3: Build TargetFilters sidebar

**Files:**
- Create: `src/components/target/TargetFilters.jsx`

This is the left sidebar with three collapsible filter sections. Reuses existing CSS classes from `.map-sidebar`, `.sidebar-section`, `.map-filter-group`, etc.

**Step 1: Write the component**

```jsx
import { useState, useMemo, useCallback } from 'react'

const CAMPUS_TYPES = [
  'Large City', 'Midsize City', 'Suburban', 'Small City', 'Rural', 'Town / Remote',
]

function debounce(fn, delay) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) }
}

/* ── Collapsible section wrapper ── */
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

/* ── Range input pair ── */
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

/* ── Multi-select checkboxes ── */
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

  /* ── Debounced numeric setters ── */
  const debouncedState = useMemo(() => debounce((k, v) => setStateFilters((p) => ({ ...p, [k]: v })), 300), [setStateFilters])
  const debouncedDistrict = useMemo(() => debounce((k, v) => setDistrictFilters((p) => ({ ...p, [k]: v })), 300), [setDistrictFilters])
  const debouncedCampus = useMemo(() => debounce((k, v) => setCampusFilters((p) => ({ ...p, [k]: v })), 300), [setCampusFilters])

  /* ── Filter counts ── */
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
        {/* ── Summary ── */}
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

        {/* ── State Filters ── */}
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

        {/* ── District Filters ── */}
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

        {/* ── Campus Filters ── */}
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

        {/* ── Bottom controls ── */}
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
```

**Step 2: Commit**

```
feat: build TargetFilters sidebar with 3 collapsible sections
```

---

### Task 4: Build TargetResults accordion tree

**Files:**
- Create: `src/components/target/TargetResults.jsx`

**Step 1: Write the component**

```jsx
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
      {/* ── Summary bar ── */}
      <div className="target-summary-bar">
        <span>
          <strong>{summary.states}</strong> state{summary.states !== 1 ? 's' : ''}
          {' · '}
          <strong>{summary.districts}</strong> district{summary.districts !== 1 ? 's' : ''}
          {' · '}
          <strong>{summary.campuses}</strong> campus{summary.campuses !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* ── Tree ── */}
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
                // Deduplicate campuses within this district
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
```

**Step 2: Commit**

```
feat: build TargetResults accordion tree component
```

---

### Task 5: Write target.css styles

**Files:**
- Create: `src/styles/target.css`

**Step 1: Write styles**

Use existing design tokens. The `.target-page` uses the same flexbox layout as `.map-page`. Reuses `.map-sidebar`, `.sidebar-section`, `.map-filter-*` classes from map.css. Only new classes needed are for the results tree.

```css
/* ================================================================
   TARGET — Filter sidebar + accordion results tree
   ================================================================ */

/* ── Page layout (mirrors .map-page) ── */
.target-page {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
}

/* ── Export button ── */
.target-export-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--teal);
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  background: var(--teal);
  color: white;
  cursor: pointer;
  margin-top: 8px;
  text-align: center;
  transition: background 0.15s, border-color 0.15s;
}
.target-export-btn:hover {
  background: #3d575e;
}

/* ── Results panel ── */
.target-results {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── Summary bar ── */
.target-summary-bar {
  padding: 12px 24px;
  background: #F3F0EB;
  border-bottom: 1px solid var(--border-light);
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--gray-body);
  flex-shrink: 0;
}
.target-summary-bar strong {
  color: var(--black);
  font-weight: 600;
}

/* ── Empty state ── */
.target-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--gray-muted);
  padding: 40px;
}

/* ── Tree container ── */
.target-tree {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* ── Chevron ── */
.target-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 9px;
  color: var(--gray-muted);
  flex-shrink: 0;
  transition: transform 0.15s;
  transform: rotate(0deg);
}
.target-chevron.open {
  transform: rotate(90deg);
}

/* ── State row ── */
.target-state-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  border-left: 4px solid var(--teal);
  transition: background 0.12s;
}
.target-state-row:hover {
  background: var(--hover-bg);
}
.target-state-name {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 15px;
  color: var(--black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ── PVI badge ── */
.target-pvi {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--hover-bg);
  color: var(--gray-body);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Meta text (counts) ── */
.target-meta {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--gray-muted);
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── District row ── */
.target-district-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px 10px 44px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.12s;
}
.target-district-row:hover {
  background: var(--hover-bg);
}
.target-district-name {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 13px;
  color: var(--black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.target-rep {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--gray-body);
  white-space: nowrap;
}

/* ── Campus list ── */
.target-campus-list {
  border-bottom: 1px solid var(--border-light);
}
.target-campus-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 20px 8px 68px;
  border-bottom: 1px solid #F5F3EF;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--gray-body);
}
.target-campus-row:last-child {
  border-bottom: none;
}
.target-campus-row:hover {
  background: #FAFAF8;
}
.target-campus-name {
  flex: 1;
  min-width: 0;
}
.target-campus-name .campus-link {
  color: var(--teal);
  text-decoration: none;
  font-weight: 500;
}
.target-campus-name .campus-link:hover {
  text-decoration: underline;
}
.target-campus-city {
  width: 120px;
  flex-shrink: 0;
  color: var(--gray-muted);
  font-size: 12px;
}
.target-campus-type {
  width: 100px;
  flex-shrink: 0;
  font-size: 12px;
}
.target-campus-enroll {
  width: 70px;
  flex-shrink: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.target-campus-districts {
  width: 50px;
  flex-shrink: 0;
  text-align: right;
  font-size: 12px;
  color: var(--gray-muted);
}

/* ── Mobile responsive ── */
@media (max-width: 768px) {
  .target-state-row {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
  }
  .target-meta {
    width: 100%;
    margin-left: 28px;
  }
  .target-district-row {
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px 8px 32px;
  }
  .target-campus-row {
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px 8px 48px;
  }
  .target-campus-city,
  .target-campus-type,
  .target-campus-enroll,
  .target-campus-districts {
    width: auto;
    font-size: 11px;
  }
}
```

**Step 2: Import in TargetView.jsx**

Already handled — the import `import '../../styles/target.css'` is in the TargetView code from Task 2.

**Step 3: Commit**

```
feat: add Target tab styles
```

---

### Task 6: Wire everything together and verify

**Step 1: Verify build**

Run: `npm run build`
Expected: No errors.

**Step 2: Manual verification checklist**

Open dev server and test:
- [ ] Target tab appears in nav, clicking it shows the page
- [ ] All 3 filter sections render and collapse/expand
- [ ] Default view shows all ~50 states in the tree
- [ ] Clicking a state expands to show its districts
- [ ] Clicking a district expands to show its campuses
- [ ] Setting a campus type filter (e.g., "Rural") reduces states/districts that have no rural campuses
- [ ] Setting Cook PVI "Swing" at state level removes deep-red/blue states
- [ ] Summary bar updates with each filter change
- [ ] Reset All clears everything
- [ ] Export CSV downloads a file with correct data
- [ ] Campus names link to the map view

**Step 3: Final commit**

```
feat: complete Target tab — cascading filters with accordion results
```
