import ToolbarButton from './ToolbarButton'

export default function SortDropdown({ columns, sorting, onSortingChange }) {
  const activeCount = sorting.length

  function setSort(columnId, desc) {
    onSortingChange([{ id: columnId, desc }])
  }

  function removeSort(columnId) {
    onSortingChange(prev => prev.filter(s => s.id !== columnId))
  }

  function clearAll() {
    onSortingChange([])
  }

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/></svg>}
      label="Sort"
      active={activeCount > 0}
      count={activeCount}
    >
      <div className="toolbar-dropdown-sort">
        {sorting.length === 0 && (
          <div className="toolbar-dropdown-empty">No sorts applied</div>
        )}

        {sorting.map(sort => {
          const col = columns.find(c => c.id === sort.id)
          if (!col) return null
          const headerText = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
          return (
            <div key={sort.id} className="toolbar-sort-row">
              <span className="toolbar-sort-col">{headerText}</span>
              <div className="toolbar-sort-dir">
                <button
                  className={`toolbar-sort-dir-btn${!sort.desc ? ' active' : ''}`}
                  onClick={() => setSort(sort.id, false)}
                >
                  A→Z
                </button>
                <button
                  className={`toolbar-sort-dir-btn${sort.desc ? ' active' : ''}`}
                  onClick={() => setSort(sort.id, true)}
                >
                  Z→A
                </button>
              </div>
              <button className="toolbar-filter-remove" onClick={() => removeSort(sort.id)} title="Remove sort">&times;</button>
            </div>
          )
        })}

        <div className="toolbar-sort-add">
          <select
            value=""
            onChange={e => { if (e.target.value) setSort(e.target.value, true) }}
          >
            <option value="" disabled>Pick a field to sort by...</option>
            {columns.map(c => (
              <option key={c.id} value={c.id}>
                {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
              </option>
            ))}
          </select>
        </div>

        {sorting.length > 0 && (
          <button className="toolbar-sort-clear" onClick={clearAll}>Clear sort</button>
        )}
      </div>
    </ToolbarButton>
  )
}
