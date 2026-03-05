import { useState, useRef, useEffect } from 'react'

export default function TableControls({
  globalFilter,
  onGlobalFilterChange,
  groupBy,
  onGroupByChange,
  groupByOptions,
  rowCount,
  totalCount,
  onExport,
  searchPlaceholder = 'Search...',
  entityName = 'campuses',
  columns,
}) {
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef(null)

  useEffect(() => {
    if (!colPickerOpen) return
    function handleClick(e) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target)) {
        setColPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colPickerOpen])

  return (
    <div className="data-filter-bar">
      <input
        className="search-input"
        type="text"
        placeholder={searchPlaceholder}
        value={globalFilter}
        onChange={(e) => onGlobalFilterChange(e.target.value)}
      />

      <select
        className="styled-select"
        value={groupBy}
        onChange={(e) => onGroupByChange(e.target.value)}
      >
        <option value="">No grouping</option>
        {groupByOptions.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <span className="data-row-count">
        {rowCount === totalCount
          ? `${totalCount.toLocaleString()} ${entityName}`
          : `${rowCount.toLocaleString()} of ${totalCount.toLocaleString()} ${entityName}`}
      </span>

      <button className="data-export-btn" onClick={onExport}>
        Export CSV
      </button>

      {columns && columns.length > 0 && (
        <div className="col-picker" ref={colPickerRef}>
          <button
            className="col-picker-btn"
            onClick={() => setColPickerOpen((o) => !o)}
            title="Toggle columns"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          {colPickerOpen && (
            <div className="col-picker-dropdown">
              {columns.map((column) => (
                <label key={column.id} className="col-picker-item">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
