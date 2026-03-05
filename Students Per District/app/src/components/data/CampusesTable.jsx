import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import TableControls from './TableControls'
import { numericRangeFilter, makeGlobalSearchFilter } from './tableFilters'
import Toast from '../Toast'

/* ── Constants ── */

const globalSearchFilter = makeGlobalSearchFilter(['name', 'city', 'state', 'primary_district'])

const CAMPUS_TYPE_COLORS = {
  'Large City': '#FE4F40',
  'Midsize City': '#4C6971',
  'Suburban': '#7CB518',
  'Small City': '#E8A838',
  'Rural': '#8B6F47',
  'Town / Remote': '#9CA3AF',
  'Town or Remote': '#9CA3AF',
}

const GROUP_BY_OPTIONS = [
  { value: 'state', label: 'State' },
  { value: 'campus_type', label: 'Campus Type' },
  { value: 'city', label: 'City' },
  { value: 'primary_district', label: 'Primary District' },
]

const INITIAL_VISIBLE = 50
const LOAD_MORE_COUNT = 50

const numFmt = new Intl.NumberFormat('en-US')

/* ── Main Component ── */

export default function CampusesTable({ campuses, navigate, params }) {
  const [globalFilter, setGlobalFilter] = useState(params?.state || params?.campus || '')
  const [groupBy, setGroupBy] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [toast, setToast] = useState(null)

  /* ── Sync global filter from URL params ── */
  useEffect(() => {
    if (params?.state) setGlobalFilter(params.state)
    else if (params?.campus) setGlobalFilter(params.campus)
  }, [params?.state, params?.campus])

  /* ── Flatten GeoJSON features into row data ── */
  const data = useMemo(() => {
    if (!campuses?.features) return []
    return campuses.features.map((f) => ({ ...f.properties }))
  }, [campuses])

  /* ── Column definitions ── */
  const columns = useMemo(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        filterFn: 'includesString',
        cell: ({ getValue, row }) => (
          <a
            className="campus-link"
            onClick={(e) => {
              e.preventDefault()
              navigate('map', 'campuses', { campus: row.original.name })
            }}
            href={`#map/campuses?campus=${encodeURIComponent(row.original.name)}`}
          >
            {getValue()}
          </a>
        ),
      },
      {
        id: 'city',
        accessorKey: 'city',
        header: 'City',
        filterFn: 'includesString',
      },
      {
        id: 'state',
        accessorKey: 'state',
        header: 'State',
        filterFn: 'includesString',
      },
      {
        id: 'enrollment',
        accessorKey: 'enrollment',
        header: 'Enrollment',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'campus_type',
        accessorKey: 'campus_type',
        header: 'Campus Type',
        filterFn: 'includesString',
        cell: ({ getValue }) => {
          const type = getValue()
          return (
            <>
              <span
                className="type-dot"
                style={{ backgroundColor: CAMPUS_TYPE_COLORS[type] || '#ccc' }}
              />
              {type}
            </>
          )
        },
      },
      {
        id: 'radius_miles',
        accessorKey: 'radius_miles',
        header: 'Radius',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => `${getValue()} mi`,
        sortDescFirst: true,
      },
      {
        id: 'districts_reached',
        accessorKey: 'districts_reached',
        header: 'Districts',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'primary_district',
        accessorKey: 'primary_district',
        header: 'Primary District',
        filterFn: 'includesString',
      },
      {
        id: 'primary_district_coverage',
        accessorKey: 'primary_district_coverage',
        header: 'Coverage',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${(v * 100).toFixed(1)}%` : ''
        },
        sortDescFirst: true,
      },
      {
        id: 'all_districts',
        accessorKey: 'all_districts',
        header: 'All Districts',
        filterFn: 'includesString',
        cell: ({ getValue }) => {
          const v = getValue()
          return (
            <span className="districts-cell">
              {v ? v.replace(/\|/g, ', ') : ''}
            </span>
          )
        },
      },
    ],
    [navigate],
  )

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  /* ── TanStack Table instance ── */
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: globalSearchFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Reset visible count when filters/sorting/grouping change
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE)
  }, [globalFilter, columnFilters, sorting, groupBy])

  const filteredRows = table.getFilteredRowModel().rows
  const sortedRows = table.getSortedRowModel().rows

  /* ── Grouping logic ── */
  const groups = useMemo(() => {
    if (!groupBy) return null
    const map = new Map()
    for (const row of sortedRows) {
      const key = row.original[groupBy] ?? '(none)'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    }
    // Sort group keys
    const entries = [...map.entries()]
    entries.sort((a, b) => {
      if (typeof a[0] === 'string' && typeof b[0] === 'string') {
        return a[0].localeCompare(b[0])
      }
      return 0
    })
    return entries
  }, [groupBy, sortedRows])

  /* ── Visible rows (show-more pattern, only when not grouped) ── */
  const visibleRows = useMemo(() => {
    if (groupBy) return sortedRows
    return sortedRows.slice(0, visibleCount)
  }, [groupBy, sortedRows, visibleCount])

  const hasMore = !groupBy && visibleCount < sortedRows.length

  /* ── Group toggle ── */
  const toggleGroup = useCallback((key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  /* ── Group stats helper ── */
  function groupStats(rows) {
    let totalEnrollment = 0
    let totalDistricts = 0
    for (const row of rows) {
      totalEnrollment += row.original.enrollment || 0
      totalDistricts += row.original.districts_reached || 0
    }
    const avgDistricts = rows.length > 0 ? (totalDistricts / rows.length).toFixed(1) : 0
    return { totalEnrollment, avgDistricts }
  }

  /* ── CSV Export ── */
  const handleExport = useCallback(() => {
    const headers = [
      'Name',
      'City',
      'State',
      'Enrollment',
      'Campus Type',
      'Radius (mi)',
      'Districts Reached',
      'Primary District',
      'Coverage (%)',
      'All Districts',
    ]
    const notes = [
      'Institution name',
      'City location',
      'State abbreviation',
      'Total enrollment',
      'NCES locale classification',
      'Radius used for district intersection',
      'Number of congressional districts reached',
      'District with highest student share',
      'Percentage of students in primary district',
      'All congressional districts within radius',
    ]

    function csvEscape(val) {
      if (val == null) return ''
      const s = String(val)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const rowsToExport = sortedRows
    const lines = [
      headers.map(csvEscape).join(','),
      notes.map(csvEscape).join(','),
    ]

    for (const row of rowsToExport) {
      const d = row.original
      const coveragePct = d.primary_district_coverage != null
        ? (d.primary_district_coverage * 100).toFixed(1)
        : ''
      const allDists = d.all_districts ? d.all_districts.replace(/\|/g, ', ') : ''
      lines.push(
        [
          d.name,
          d.city,
          d.state,
          d.enrollment,
          d.campus_type,
          d.radius_miles,
          d.districts_reached,
          d.primary_district,
          coveragePct,
          allDists,
        ]
          .map(csvEscape)
          .join(','),
      )
    }

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campuses_data.csv'
    a.click()
    URL.revokeObjectURL(url)
    setToast('CSV exported')
  }, [sortedRows])

  /* ── Sort icon helper ── */
  function sortIcon(column) {
    const dir = column.getIsSorted()
    if (!dir) return <span className="sort-icon">&nbsp;&nbsp;</span>
    return <span className="sort-icon">{dir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
  }

  /* ── Header columns (for rendering) ── */
  const headerGroups = table.getHeaderGroups()

  /* ── Render rows (grouped or paginated) ── */
  function renderBody() {
    if (groups) {
      return groups.map(([key, rows]) => {
        const collapsed = !!collapsedGroups[key]
        const stats = groupStats(rows)
        return (
          <tbody key={key}>
            <tr
              className="group-header-row"
              onClick={() => toggleGroup(key)}
            >
              <td colSpan={columns.length}>
                <span className={`group-toggle${collapsed ? ' collapsed' : ''}`}>
                  &#9660;
                </span>
                <span className="group-name">{key}</span>
                <span className="group-count">({rows.length})</span>
                <span className="group-stats">
                  {numFmt.format(stats.totalEnrollment)} enrolled
                  <span className="stat-sep">|</span>
                  {stats.avgDistricts} avg districts
                </span>
              </td>
            </tr>
            {!collapsed &&
              rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const isNum = cell.column.columnDef.meta?.isNumeric
                    return (
                      <td
                        key={cell.id}
                        className={isNum ? 'num' : ''}
                        data-label={cell.column.columnDef.header}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        )
      })
    }

    return (
      <tbody>
        {visibleRows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
              const isNum = cell.column.columnDef.meta?.isNumeric
              return (
                <td
                  key={cell.id}
                  className={isNum ? 'num' : ''}
                  data-label={cell.column.columnDef.header}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    )
  }

  return (
    <div className="data-page">
      <TableControls
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        groupByOptions={GROUP_BY_OPTIONS}
        rowCount={filteredRows.length}
        totalCount={data.length}
        onExport={handleExport}
        searchPlaceholder="Search campuses..."
        columns={table.getAllLeafColumns()}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
      />

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const isNum = header.column.columnDef.meta?.isNumeric
                  const alignRight = idx >= headerGroup.headers.length - 4
                  return (
                    <th
                      key={header.id}
                      className={isNum ? 'num' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="th-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortIcon(header.column)}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          {renderBody()}
        </table>
      </div>

      {hasMore && (
        <div className="data-show-more">
          <button
            className="show-more-btn"
            onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
          >
            Show more ({sortedRows.length - visibleCount} remaining)
          </button>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
