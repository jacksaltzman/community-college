import { useMemo } from 'react'

const ELECTION_OPTIONS = [
  { value: '', label: 'Any cycle' },
  { value: '2026', label: '2026' },
  { value: '2028', label: '2028' },
  { value: '2030', label: '2030' },
]

const PARTY_OPTIONS = [
  { value: '', label: 'Any party' },
  { value: 'D', label: 'Democrat' },
  { value: 'R', label: 'Republican' },
]

const TIER_OPTIONS = [
  { value: '', label: 'Any tier' },
  { value: 'T1', label: 'T1 (Top 12)' },
  { value: 'T2', label: 'T2 (13-30)' },
  { value: 'T3', label: 'T3 (31+)' },
]

const QUADRANT_OPTIONS = [
  { value: '', label: 'Any quadrant' },
  { value: 'Launch Priority', label: 'Launch Priority' },
  { value: 'Revenue Opportunity', label: 'Revenue Opportunity' },
  { value: 'Civic Beachhead', label: 'Civic Beachhead' },
  { value: 'Deprioritize', label: 'Deprioritize' },
]

export default function TargetFiltersBar({ filters, onFiltersChange, resultCount, totalCount, onExport }) {
  const activeCount = useMemo(() => {
    let c = 0
    if (filters.electionCycle) c++
    if (filters.senatorParty) c++
    if (filters.tier) c++
    if (filters.quadrant) c++
    return c
  }, [filters])

  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const handleClear = () => {
    onFiltersChange({ electionCycle: '', senatorParty: '', tier: '', quadrant: '' })
  }

  return (
    <div className="target-filters-bar">
      <div className="target-filters-left">
        <span className="target-filters-label">Filters</span>
        <span className="target-filters-count">
          {resultCount === totalCount
            ? `${totalCount} states`
            : `${resultCount} of ${totalCount} states`}
        </span>
        {activeCount > 0 && (
          <span className="target-filters-badge">{activeCount}</span>
        )}
      </div>

      <div className="target-filters-right">
        <select
          className="styled-select"
          value={filters.electionCycle}
          onChange={(e) => handleChange('electionCycle', e.target.value)}
        >
          {ELECTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="styled-select"
          value={filters.senatorParty}
          onChange={(e) => handleChange('senatorParty', e.target.value)}
        >
          {PARTY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="styled-select"
          value={filters.tier}
          onChange={(e) => handleChange('tier', e.target.value)}
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="styled-select"
          value={filters.quadrant}
          onChange={(e) => handleChange('quadrant', e.target.value)}
        >
          {QUADRANT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {activeCount > 0 && (
          <button className="target-filters-clear" onClick={handleClear}>
            Clear all
          </button>
        )}
        {onExport && (
          <button className="toolbar-btn" onClick={onExport} type="button">
            <span className="toolbar-btn-label">Export CSV</span>
          </button>
        )}
      </div>
    </div>
  )
}
