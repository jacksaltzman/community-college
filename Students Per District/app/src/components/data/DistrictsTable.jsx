import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import TableControls from './TableControls'

/* ── Constants ── */

const PAGE_SIZE = 50

const numFmt = new Intl.NumberFormat('en-US')

/* ── Column-level filter function for numeric range ── */

function numericRangeFilter(row, columnId, filterValue) {
  if (!filterValue) return true
  const [min, max] = filterValue
  const hasMin = min !== '' && min != null
  const hasMax = max !== '' && max != null
  if (!hasMin && !hasMax) return true
  const val = row.getValue(columnId)
  if (val == null) return false
  if (hasMin && val < Number(min)) return false
  if (hasMax && val > Number(max)) return false
  return true
}

/* ── Global multi-word search filter ── */

function globalSearchFilter(row, _columnId, filterValue) {
  if (!filterValue) return true
  const words = filterValue.toLowerCase().split(/\s+/).filter(Boolean)
  const searchable = [row.original.district, row.original.state]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return words.every((w) => searchable.includes(w))
}

/* ── Column Filter Popover ── */

function ColumnFilterPopover({ column, isNumeric, alignRight }) {
  const [open, setOpen] = useState(false)
  const popRef = useRef(null)
  const filterValue = column.getFilterValue()
  const isActive = isNumeric
    ? filterValue && (filterValue[0] !== '' || filterValue[1] !== '')
    : !!filterValue

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleClear() {
    column.setFilterValue(undefined)
    setOpen(false)
  }

  return (
    <span style={{ position: 'relative' }} ref={popRef}>
      <button
        className={`col-filter-btn${isActive ? ' active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        title="Filter column"
      >
        &#9660;
      </button>
      <div
        className={`col-filter-pop${open ? ' open' : ''}${alignRight ? ' pop-right' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {isNumeric ? (
          <div className="num-range">
            <input
              type="number"
              placeholder="Min"
              value={filterValue?.[0] ?? ''}
              onChange={(e) =>
                column.setFilterValue((old) => [e.target.value, old?.[1] ?? ''])
              }
            />
            <input
              type="number"
              placeholder="Max"
              value={filterValue?.[1] ?? ''}
              onChange={(e) =>
                column.setFilterValue((old) => [old?.[0] ?? '', e.target.value])
              }
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder="Filter..."
            value={filterValue ?? ''}
            onChange={(e) => column.setFilterValue(e.target.value || undefined)}
          />
        )}
        <button className="filter-clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>
    </span>
  )
}

/* ── Main Component ── */

export default function DistrictsTable({ campuses, navigate }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([{ id: 'enrollment', desc: true }])
  const [columnFilters, setColumnFilters] = useState([])

  /* ── Aggregate campus data into district-level rows ── */
  const data = useMemo(() => {
    if (!campuses?.features) return []
    const metrics = {}
    campuses.features.forEach((f) => {
      const allDistricts = f.properties.all_districts
      if (!allDistricts) return
      allDistricts.split('|').forEach((cd) => {
        cd = cd.trim()
        if (!cd) return
        if (!metrics[cd]) metrics[cd] = { enrollment: 0, campusCount: 0 }
        metrics[cd].enrollment += f.properties.enrollment || 0
        metrics[cd].campusCount += 1
      })
    })

    return Object.entries(metrics).map(([district, m]) => {
      // Extract state from district code (e.g., "CA-12" -> "CA")
      const dashIdx = district.indexOf('-')
      const state = dashIdx > 0 ? district.substring(0, dashIdx) : district
      return {
        district,
        state,
        enrollment: m.enrollment,
        campusCount: m.campusCount,
      }
    })
  }, [campuses])

  /* ── Column definitions ── */
  const columns = useMemo(
    () => [
      {
        id: 'district',
        accessorKey: 'district',
        header: 'District',
        filterFn: 'includesString',
        cell: ({ getValue }) => {
          const cd = getValue()
          return (
            <a
              className="campus-link"
              onClick={(e) => {
                e.preventDefault()
                navigate('map', 'districts', { district: cd })
              }}
              href={`#map/districts?district=${encodeURIComponent(cd)}`}
            >
              {cd}
            </a>
          )
        },
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
        id: 'campusCount',
        accessorKey: 'campusCount',
        header: 'Campus Count',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'cookPVI',
        header: 'Cook PVI',
        accessorFn: () => null,
        filterFn: numericRangeFilter,
        meta: { isNumeric: true },
        cell: () => '\u2014',
        sortDescFirst: true,
        enableSorting: false,
      },
      {
        id: 'midtermTurnout',
        header: 'Midterm Turnout',
        accessorFn: () => null,
        filterFn: numericRangeFilter,
        meta: { isNumeric: true },
        cell: () => '\u2014',
        sortDescFirst: true,
        enableSorting: false,
      },
    ],
    [navigate],
  )

  /* ── TanStack Table instance ── */
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination: {
        pageIndex: 0,
        pageSize: PAGE_SIZE,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearchFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  /* ── Pagination state ── */
  const [pageIndex, setPageIndex] = useState(0)

  // Reset page when filters/sorting change
  useEffect(() => {
    setPageIndex(0)
  }, [globalFilter, columnFilters, sorting])

  const filteredRows = table.getFilteredRowModel().rows
  const sortedRows = table.getSortedRowModel().rows

  /* ── Paginated rows ── */
  const paginatedRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE
    return sortedRows.slice(start, start + PAGE_SIZE)
  }, [sortedRows, pageIndex])

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE)

  /* ── CSV Export ── */
  const handleExport = useCallback(() => {
    const headers = [
      'District',
      'State',
      'Enrollment',
      'Campus Count',
      'Cook PVI',
      'Midterm Turnout',
    ]
    const notes = [
      'Congressional district code',
      'State abbreviation',
      'Sum of enrollment from campuses reaching this district',
      'Number of community college campuses reaching this district',
      'Deferred — data not yet available',
      'Deferred — data not yet available',
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
      lines.push(
        [
          d.district,
          d.state,
          d.enrollment,
          d.campusCount,
          '',
          '',
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
    a.download = 'districts_data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [sortedRows])

  /* ── Sort icon helper ── */
  function sortIcon(column) {
    const dir = column.getIsSorted()
    if (!dir) return <span className="sort-icon">&nbsp;&nbsp;</span>
    return <span className="sort-icon">{dir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
  }

  /* ── Header columns (for rendering) ── */
  const headerGroups = table.getHeaderGroups()

  /* ── Pagination info ── */
  const start = pageIndex * PAGE_SIZE + 1
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, sortedRows.length)

  return (
    <div className="data-page">
      <TableControls
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        groupBy=""
        onGroupByChange={() => {}}
        groupByOptions={[]}
        rowCount={filteredRows.length}
        totalCount={data.length}
        onExport={handleExport}
        searchPlaceholder="Search by district or state..."
        entityName="districts"
      />

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const isNum = header.column.columnDef.meta?.isNumeric
                  const alignRight = idx >= headerGroup.headers.length - 3
                  return (
                    <th
                      key={header.id}
                      className={isNum ? 'num' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="th-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortIcon(header.column)}
                        <ColumnFilterPopover
                          column={header.column}
                          isNumeric={!!isNum}
                          alignRight={alignRight}
                        />
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
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
        </table>
      </div>

      {totalPages > 1 && (
        <div className="data-pagination">
          <button
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="page-info">
            Page {pageIndex + 1} of {totalPages}
            {' \u00B7 '}
            Showing {start.toLocaleString()}&ndash;{end.toLocaleString()} of{' '}
            {sortedRows.length.toLocaleString()} districts
          </span>
          <button
            disabled={pageIndex >= totalPages - 1}
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
