import { useState } from 'react'
import ToolbarButton from './ToolbarButton'

export default function FilterDropdown({ columns, columnFilters, onColumnFiltersChange }) {
  const [addingFilter, setAddingFilter] = useState(false)
  const activeCount = columnFilters.filter(f => {
    if (Array.isArray(f.value)) return f.value[0] !== '' || f.value[1] !== ''
    return !!f.value
  }).length

  function removeFilter(columnId) {
    onColumnFiltersChange(prev => prev.filter(f => f.id !== columnId))
  }

  function updateFilter(columnId, value) {
    onColumnFiltersChange(prev => {
      const exists = prev.find(f => f.id === columnId)
      if (exists) {
        return prev.map(f => f.id === columnId ? { ...f, value } : f)
      }
      return [...prev, { id: columnId, value }]
    })
  }

  function addFilter(columnId) {
    const col = columns.find(c => c.id === columnId)
    const isNumeric = col?.columnDef?.meta?.isNumeric
    const defaultValue = isNumeric ? ['', ''] : ''
    onColumnFiltersChange(prev => [...prev, { id: columnId, value: defaultValue }])
    setAddingFilter(false)
  }

  const availableColumns = columns.filter(c => !columnFilters.find(f => f.id === c.id))

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.5A.5.5 0 0 1 .5 1h15a.5.5 0 0 1 .37.84L10 8.52V14.5a.5.5 0 0 1-.74.44l-3-1.5A.5.5 0 0 1 6 13V8.52L.13 1.84A.5.5 0 0 1 .5 1z"/></svg>}
      label="Filter"
      active={activeCount > 0}
      count={activeCount}
    >
      <div className="toolbar-dropdown-filters">
        {columnFilters.length === 0 && !addingFilter && (
          <div className="toolbar-dropdown-empty">No filters applied</div>
        )}

        {columnFilters.map(filter => {
          const col = columns.find(c => c.id === filter.id)
          if (!col) return null
          const isNumeric = col.columnDef?.meta?.isNumeric
          const headerText = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id

          return (
            <div key={filter.id} className="toolbar-filter-row">
              <span className="toolbar-filter-col">{headerText}</span>
              {isNumeric ? (
                <div className="toolbar-filter-inputs">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filter.value?.[0] ?? ''}
                    onChange={e => updateFilter(filter.id, [e.target.value, filter.value?.[1] ?? ''])}
                  />
                  <span className="toolbar-filter-sep">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filter.value?.[1] ?? ''}
                    onChange={e => updateFilter(filter.id, [filter.value?.[0] ?? '', e.target.value])}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Contains..."
                  value={filter.value ?? ''}
                  onChange={e => updateFilter(filter.id, e.target.value || undefined)}
                />
              )}
              <button className="toolbar-filter-remove" onClick={() => removeFilter(filter.id)} title="Remove filter">&times;</button>
            </div>
          )
        })}

        {addingFilter ? (
          <div className="toolbar-filter-add-row">
            <select
              autoFocus
              defaultValue=""
              onChange={e => { if (e.target.value) addFilter(e.target.value) }}
            >
              <option value="" disabled>Pick a field...</option>
              {availableColumns.map(c => (
                <option key={c.id} value={c.id}>
                  {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                </option>
              ))}
            </select>
            <button className="toolbar-filter-cancel" onClick={() => setAddingFilter(false)}>Cancel</button>
          </div>
        ) : (
          <button className="toolbar-filter-add" onClick={() => setAddingFilter(true)}>
            + Add filter
          </button>
        )}
      </div>
    </ToolbarButton>
  )
}
