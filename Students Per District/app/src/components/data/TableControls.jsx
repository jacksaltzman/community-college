import HideFieldsDropdown from './toolbar/HideFieldsDropdown'
import FilterDropdown from './toolbar/FilterDropdown'
import SortDropdown from './toolbar/SortDropdown'
import GroupDropdown from './toolbar/GroupDropdown'
import ShareDropdown from './toolbar/ShareDropdown'

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
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
}) {
  return (
    <div className="data-toolbar">
      <div className="data-toolbar-left">
        <HideFieldsDropdown columns={columns} />

        <FilterDropdown
          columns={columns}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
        />

        <GroupDropdown
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          groupByOptions={groupByOptions}
        />

        <SortDropdown
          columns={columns}
          sorting={sorting}
          onSortingChange={onSortingChange}
        />

        <ShareDropdown onExport={onExport} />
      </div>

      <div className="data-toolbar-right">
        <span className="data-row-count">
          {rowCount === totalCount
            ? `${totalCount.toLocaleString()} ${entityName}`
            : `${rowCount.toLocaleString()} of ${totalCount.toLocaleString()} ${entityName}`}
        </span>

        <div className="toolbar-search">
          <svg className="toolbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="toolbar-search-input"
            type="text"
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
