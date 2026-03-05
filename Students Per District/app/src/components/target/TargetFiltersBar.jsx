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
      <div className="target-filters-row">
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

      <div className="target-filters-row target-filters-numeric-row">
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
      </div>
    </div>
  )
}
