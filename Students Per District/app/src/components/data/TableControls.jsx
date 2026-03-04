/**
 * TableControls — Shared filter bar for data tables.
 * Renders: search input, group-by dropdown, row count, CSV export button.
 */
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
}) {
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
    </div>
  )
}
