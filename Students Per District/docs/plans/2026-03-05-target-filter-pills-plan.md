# Target Tab Filter Pills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the off-the-shelf Target tab filter bar with Airtable-quality pill-based filters, adding 4 numeric range filters (CC Enrollment, Districts, Composite SVS, Young Professionals).

**Architecture:** Rewrite `TargetFiltersBar.jsx` to render categorical filters as styled pill wrappers around stripped-down native `<select>` elements, and numeric filters as pill wrappers around inline min/max `<input>` fields. Add numeric filter keys to the `filters` state in `TargetView.jsx` and extend `filteredStates` to apply min/max bounds. Pass `rankedStates` to `TargetFiltersBar` so it can compute placeholder ranges from the data.

**Tech Stack:** React, CSS

---

### Task 1: Add pill CSS to target.css

**Files:**
- Modify: `app/src/styles/target.css`

**Step 1: Replace the existing filter bar CSS block (lines 463–548) with the new pill-based styles**

Find the `FILTERS BAR` section comment (line 463) through `.target-filters-clear:hover` (around line 547). Replace the entire block with:

```css
/* ================================================================
   FILTERS BAR
   ================================================================ */
.target-filters-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: white;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.target-filters-label {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gray-muted);
  white-space: nowrap;
  margin-right: 2px;
}

/* ── Divider between categorical and numeric groups ── */
.target-filters-divider {
  width: 1px;
  height: 20px;
  background: var(--border-light);
  margin: 0 4px;
  flex-shrink: 0;
}

/* ── Pill: shared base for both categorical and numeric ── */
.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--border-light);
  background: white;
  font-family: var(--font-body);
  font-size: 12px;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s;
}
.filter-pill.active {
  background: rgba(76, 105, 113, 0.08);
  border-color: var(--teal);
}

.filter-pill-label {
  font-family: var(--font-heading);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--gray-muted);
}

/* ── Categorical pill: stripped-down native select inside pill ── */
.filter-pill select {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-body);
  padding: 0;
  cursor: pointer;
  outline: none;
}
.filter-pill.active select {
  color: var(--black);
  font-weight: 600;
}

/* ── Numeric pill: min/max inputs ── */
.filter-pill input[type="number"] {
  -moz-appearance: textfield;
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-body);
  width: 52px;
  padding: 0;
  outline: none;
  text-align: right;
}
.filter-pill input[type="number"]::-webkit-inner-spin-button,
.filter-pill input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.filter-pill.active input[type="number"] {
  color: var(--black);
  font-weight: 600;
}
.filter-pill input[type="number"]::placeholder {
  color: var(--gray-lighter, #C5C0B8);
  font-weight: 400;
}
.filter-pill-dash {
  color: var(--gray-muted);
  font-size: 11px;
  margin: 0 1px;
}

/* ── Right-side controls: count, clear, export ── */
.target-filters-right-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.target-filters-count {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--gray-muted);
  white-space: nowrap;
}

.target-filters-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--border-light);
  background: white;
  font-size: 12px;
  line-height: 1;
  color: var(--gray-muted);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.target-filters-clear-btn:hover {
  background: #FEE2E2;
  color: var(--coral);
  border-color: var(--coral);
}
```

**Step 2: Commit**

```bash
git add app/src/styles/target.css
git commit -m "style: replace filter bar CSS with Airtable-quality pill-based design"
```

---

### Task 2: Add numeric filter keys to TargetView and extend filteredStates

**Files:**
- Modify: `app/src/components/target/TargetView.jsx`

**Step 1: Extend the initial `filters` state (line 17) to include numeric keys**

Change:

```javascript
const [filters, setFilters] = useState({
    electionCycle: '',
    senatorParty: '',
    tier: '',
    quadrant: '',
  })
```

to:

```javascript
const [filters, setFilters] = useState({
    electionCycle: '',
    senatorParty: '',
    tier: '',
    quadrant: '',
    ccEnrollmentMin: '',
    ccEnrollmentMax: '',
    districtCountMin: '',
    districtCountMax: '',
    compositeMin: '',
    compositeMax: '',
    youngProfessionalPopMin: '',
    youngProfessionalPopMax: '',
  })
```

**Step 2: Extend `filteredStates` useMemo (lines 29-49) to apply numeric bounds**

After the existing `if (filters.quadrant)` block (line 46) and before `return result`, add:

```javascript
    // Numeric range filters
    const numericFilters = [
      { key: 'ccEnrollment', min: filters.ccEnrollmentMin, max: filters.ccEnrollmentMax },
      { key: 'districtCount', min: filters.districtCountMin, max: filters.districtCountMax },
      { key: 'composite', min: filters.compositeMin, max: filters.compositeMax },
      { key: 'youngProfessionalPop', min: filters.youngProfessionalPopMin, max: filters.youngProfessionalPopMax },
    ]
    numericFilters.forEach(({ key, min, max }) => {
      if (min !== '') result = result.filter((s) => (s[key] || 0) >= Number(min))
      if (max !== '') result = result.filter((s) => (s[key] || 0) <= Number(max))
    })
```

**Step 3: Pass `rankedStates` to TargetFiltersBar (line 114-120)**

Change:

```jsx
<TargetFiltersBar
  filters={filters}
  onFiltersChange={setFilters}
  resultCount={filteredStates.length}
  totalCount={rankedStates.length}
  onExport={handleExport}
/>
```

to:

```jsx
<TargetFiltersBar
  filters={filters}
  onFiltersChange={setFilters}
  rankedStates={rankedStates}
  resultCount={filteredStates.length}
  totalCount={rankedStates.length}
  onExport={handleExport}
/>
```

**Step 4: Commit**

```bash
git add app/src/components/target/TargetView.jsx
git commit -m "feat: add numeric filter state and filtering logic to TargetView"
```

---

### Task 3: Rewrite TargetFiltersBar as pill-based UI

**Files:**
- Modify: `app/src/components/target/TargetFiltersBar.jsx`

**Step 1: Replace the entire file content with the new pill-based implementation**

```jsx
import { useMemo } from 'react'

const CATEGORICAL_FILTERS = [
  {
    key: 'electionCycle',
    label: 'Cycle',
    options: [
      { value: '', label: 'Any' },
      { value: '2026', label: '2026' },
      { value: '2028', label: '2028' },
      { value: '2030', label: '2030' },
    ],
  },
  {
    key: 'senatorParty',
    label: 'Party',
    options: [
      { value: '', label: 'Any' },
      { value: 'D', label: 'Dem' },
      { value: 'R', label: 'Rep' },
    ],
  },
  {
    key: 'tier',
    label: 'Tier',
    options: [
      { value: '', label: 'Any' },
      { value: 'T1', label: 'T1' },
      { value: 'T2', label: 'T2' },
      { value: 'T3', label: 'T3' },
    ],
  },
  {
    key: 'quadrant',
    label: 'Quad',
    options: [
      { value: '', label: 'Any' },
      { value: 'Launch Priority', label: 'Launch' },
      { value: 'Revenue Opportunity', label: 'Revenue' },
      { value: 'Civic Beachhead', label: 'Civic' },
      { value: 'Deprioritize', label: 'Depri' },
    ],
  },
]

const NUMERIC_FILTERS = [
  { key: 'ccEnrollment', label: 'Enrollment', field: 'ccEnrollment' },
  { key: 'districtCount', label: 'Districts', field: 'districtCount' },
  { key: 'composite', label: 'SVS', field: 'composite' },
  { key: 'youngProfessionalPop', label: 'YP Pop', field: 'youngProfessionalPop' },
]

function formatCompact(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}

export default function TargetFiltersBar({
  filters,
  onFiltersChange,
  rankedStates,
  resultCount,
  totalCount,
  onExport,
}) {
  const activeCount = useMemo(() => {
    let c = 0
    if (filters.electionCycle) c++
    if (filters.senatorParty) c++
    if (filters.tier) c++
    if (filters.quadrant) c++
    NUMERIC_FILTERS.forEach(({ key }) => {
      if (filters[`${key}Min`] !== '') c++
      if (filters[`${key}Max`] !== '') c++
    })
    return c
  }, [filters])

  /* Compute data ranges for placeholders */
  const ranges = useMemo(() => {
    const r = {}
    NUMERIC_FILTERS.forEach(({ key, field }) => {
      const vals = (rankedStates || []).map((s) => s[field] || 0).filter((v) => v != null)
      r[key] = {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
      }
    })
    return r
  }, [rankedStates])

  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const handleClear = () => {
    const cleared = { ...filters }
    Object.keys(cleared).forEach((k) => (cleared[k] = ''))
    onFiltersChange(cleared)
  }

  return (
    <div className="target-filters-bar">
      <span className="target-filters-label">Filters</span>

      {/* ── Categorical pills ── */}
      {CATEGORICAL_FILTERS.map(({ key, label, options }) => (
        <div key={key} className={`filter-pill${filters[key] ? ' active' : ''}`}>
          <span className="filter-pill-label">{label}</span>
          <select value={filters[key]} onChange={(e) => handleChange(key, e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="target-filters-divider" />

      {/* ── Numeric pills ── */}
      {NUMERIC_FILTERS.map(({ key, label }) => {
        const minKey = `${key}Min`
        const maxKey = `${key}Max`
        const isActive = filters[minKey] !== '' || filters[maxKey] !== ''
        const range = ranges[key] || { min: 0, max: 0 }
        return (
          <div key={key} className={`filter-pill${isActive ? ' active' : ''}`}>
            <span className="filter-pill-label">{label}</span>
            <input
              type="number"
              placeholder={formatCompact(range.min)}
              value={filters[minKey]}
              onChange={(e) => handleChange(minKey, e.target.value)}
            />
            <span className="filter-pill-dash">–</span>
            <input
              type="number"
              placeholder={formatCompact(range.max)}
              value={filters[maxKey]}
              onChange={(e) => handleChange(maxKey, e.target.value)}
            />
          </div>
        )
      })}

      {/* ── Right controls ── */}
      <div className="target-filters-right-controls">
        {activeCount > 0 && (
          <button
            className="target-filters-clear-btn"
            onClick={handleClear}
            title="Clear all filters"
            type="button"
          >
            ✕
          </button>
        )}
        <span className="target-filters-count">
          {resultCount === totalCount
            ? `${totalCount} states`
            : `${resultCount} of ${totalCount}`}
        </span>
        {onExport && (
          <button className="toolbar-btn" onClick={onExport} type="button">
            <span className="toolbar-btn-label">Export</span>
          </button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/src/components/target/TargetFiltersBar.jsx
git commit -m "feat: rewrite TargetFiltersBar with pill-based UI and numeric range filters"
```

---

### Task 4: Build, verify, and push

**Step 1: Build the app**

Run: `cd app && npm run build`
Expected: Build succeeds.

**Step 2: Commit any remaining changes and push**

```bash
git push
```
