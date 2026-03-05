import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import TableControls from './TableControls'
import ColumnFilterPopover from './ColumnFilterPopover'
import { numericRangeFilter, makeGlobalSearchFilter } from './tableFilters'
import Toast from '../Toast'

/* ── Constants ── */

const INITIAL_VISIBLE = 50
const LOAD_MORE_COUNT = 50

const numFmt = new Intl.NumberFormat('en-US')

const globalSearchFilter = makeGlobalSearchFilter(['state', 'cookPVI', 'senator1', 'senator2'])

/* ── Main Component ── */

export default function StatesTable({ campuses, statesData, navigate, params }) {
  const [globalFilter, setGlobalFilter] = useState(params?.state || '')
  const [sorting, setSorting] = useState([{ id: 'enrollment', desc: true }])
  const [columnFilters, setColumnFilters] = useState([])
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [columnVisibility, setColumnVisibility] = useState({})
  const [toast, setToast] = useState(null)

  /* ── Sync global filter from URL params ── */
  useEffect(() => {
    if (params?.state) setGlobalFilter(params.state)
  }, [params?.state])

  /* Reset visible count when filters/sorting change */
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE)
  }, [globalFilter, columnFilters, sorting])

  /* ── Aggregate campus data into state-level rows ── */
  const data = useMemo(() => {
    if (!campuses?.features) return []
    const metrics = {}
    campuses.features.forEach((f) => {
      const st = f.properties.state
      if (!st) return
      if (!metrics[st]) {
        metrics[st] = {
          enrollment: 0,
          campusCount: 0,
          totalDistrictsReached: 0,
          uniqueDistricts: new Set(),
        }
      }
      metrics[st].enrollment += f.properties.enrollment || 0
      metrics[st].campusCount += 1
      metrics[st].totalDistrictsReached += f.properties.districts_reached || 0

      // Parse all_districts to count unique districts per state
      const allDistricts = f.properties.all_districts
      if (allDistricts) {
        allDistricts.split('|').forEach((cd) => {
          cd = cd.trim()
          if (cd) metrics[st].uniqueDistricts.add(cd)
        })
      }
    })

    return Object.entries(metrics).map(([state, m]) => {
      const stInfo = statesData?.[state] || {}
      return {
        state,
        enrollment: m.enrollment,
        campusCount: m.campusCount,
        districtCount: m.uniqueDistricts.size,
        avgDistrictsReached:
          m.campusCount > 0
            ? Math.round((m.totalDistrictsReached / m.campusCount) * 10) / 10
            : 0,
        cookPVI: stInfo.cookPVI || '',
        midtermTurnout2022: stInfo.midtermTurnout2022 ?? null,
        senator1: stInfo.senator1 || '',
        senator1Party: stInfo.senator1Party || '',
        senator1NextElection: stInfo.senator1NextElection ?? null,
        senator1LastMargin: stInfo.senator1LastMargin ?? null,
        senator2: stInfo.senator2 || '',
        senator2Party: stInfo.senator2Party || '',
        senator2NextElection: stInfo.senator2NextElection ?? null,
        senator2LastMargin: stInfo.senator2LastMargin ?? null,
        adultPop18: stInfo.adultPop18 ?? null,
        totalFilers: stInfo.totalFilers ?? null,
        totalFedTaxPaidB: stInfo.totalFedTaxPaidB ?? null,
        eitcClaimsThousands: stInfo.eitcClaimsThousands ?? null,
        eitcParticipationRate: stInfo.eitcParticipationRate ?? null,
        eitcUnclaimedRate: stInfo.eitcUnclaimedRate ?? null,
        urbanPopPct: stInfo.urbanPopPct ?? null,
      }
    })
  }, [campuses, statesData])

  /* ── Column definitions ── */
  const columns = useMemo(
    () => [
      {
        id: 'state',
        accessorKey: 'state',
        header: 'State',
        filterFn: 'includesString',
        cell: ({ getValue }) => {
          const st = getValue()
          return (
            <a
              className="campus-link"
              onClick={(e) => {
                e.preventDefault()
                navigate('map', 'states', { state: st })
              }}
              href={`#map/states?state=${encodeURIComponent(st)}`}
            >
              {st}
            </a>
          )
        },
      },
      {
        id: 'enrollment',
        accessorKey: 'enrollment',
        header: 'Total Enrollment',
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
        id: 'districtCount',
        accessorKey: 'districtCount',
        header: 'District Count',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'avgDistrictsReached',
        accessorKey: 'avgDistrictsReached',
        header: 'Avg Districts Reached',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => getValue().toFixed(1),
        sortDescFirst: true,
      },
      {
        id: 'cookPVI',
        accessorKey: 'cookPVI',
        header: 'Cook PVI',
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
        sortingFn: (rowA, rowB) => {
          const parse = (s) => {
            if (!s || s === 'EVEN') return 0
            const m = s.match(/^([DR])\+(\d+)$/)
            if (!m) return 0
            return m[1] === 'D' ? -Number(m[2]) : Number(m[2])
          }
          return parse(rowA.original.cookPVI) - parse(rowB.original.cookPVI)
        },
      },
      {
        id: 'midtermTurnout2022',
        accessorKey: 'midtermTurnout2022',
        header: '2022 Turnout',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'senator1',
        accessorKey: 'senator1',
        header: 'Senator 1',
        filterFn: 'includesString',
        cell: ({ row }) => {
          const d = row.original
          if (!d.senator1) return '\u2014'
          const party = d.senator1Party ? ` (${d.senator1Party})` : ''
          const margin = d.senator1LastMargin != null ? `, +${d.senator1LastMargin}%` : ''
          const election = d.senator1NextElection ? ` \u00B7 ${d.senator1NextElection}` : ''
          return `${d.senator1}${party}${margin}${election}`
        },
      },
      {
        id: 'senator2',
        accessorKey: 'senator2',
        header: 'Senator 2',
        filterFn: 'includesString',
        cell: ({ row }) => {
          const d = row.original
          if (!d.senator2) return '\u2014'
          const party = d.senator2Party ? ` (${d.senator2Party})` : ''
          const margin = d.senator2LastMargin != null ? `, +${d.senator2LastMargin}%` : ''
          const election = d.senator2NextElection ? ` \u00B7 ${d.senator2NextElection}` : ''
          return `${d.senator2}${party}${margin}${election}`
        },
      },
      {
        id: 'adultPop18',
        accessorKey: 'adultPop18',
        header: 'Adult Pop (18+)',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? numFmt.format(v) : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'totalFedTaxPaidB',
        accessorKey: 'totalFedTaxPaidB',
        header: 'Fed Tax Paid ($B)',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `$${v.toFixed(1)}B` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'eitcClaimsThousands',
        accessorKey: 'eitcClaimsThousands',
        header: 'EITC Claims (K)',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${numFmt.format(v)}K` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'eitcUnclaimedRate',
        accessorKey: 'eitcUnclaimedRate',
        header: 'EITC Unclaimed',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
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

  const filteredRows = table.getFilteredRowModel().rows
  const sortedRows = table.getSortedRowModel().rows

  /* ── Visible rows (show-more pattern) ── */
  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount],
  )

  const hasMore = visibleCount < sortedRows.length

  /* ── CSV Export ── */
  const handleExport = useCallback(() => {
    const headers = [
      'State',
      'Total Enrollment',
      'Campus Count',
      'District Count',
      'Avg Districts Reached',
      'Cook PVI',
      '2022 Midterm Turnout (%)',
      'Senator 1',
      'Senator 1 Party',
      'S1 Next Election',
      'S1 Last Margin (%)',
      'Senator 2',
      'Senator 2 Party',
      'S2 Next Election',
      'S2 Last Margin (%)',
      'Adult Pop (18+)',
      'Total Filers',
      'Fed Tax Paid ($B)',
      'EITC Claims (thousands)',
      'EITC Participation Rate (%)',
      'EITC Unclaimed Rate (%)',
      'Urban Pop (%)',
    ]
    const notes = [
      'State abbreviation',
      'Sum of enrollment across all campuses in state',
      'Number of community college campuses',
      'Number of unique congressional districts reached',
      'Average districts reached per campus',
      'Cook Partisan Voting Index (2022)',
      'VEP turnout rate, 2022 midterm (US Elections Project)',
      'U.S. Senator (119th Congress)',
      'Party affiliation',
      'Next election year',
      'Last election margin percentage',
      'U.S. Senator (119th Congress)',
      'Party affiliation',
      'Next election year',
      'Last election margin percentage',
      'Adult population age 18+',
      'Total tax filers in state',
      'Total federal tax paid in billions',
      'EITC claims in thousands',
      'EITC participation rate',
      'EITC unclaimed rate',
      'Urban population percentage',
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
          d.state,
          d.enrollment,
          d.campusCount,
          d.districtCount,
          d.avgDistrictsReached.toFixed(1),
          d.cookPVI,
          d.midtermTurnout2022 != null ? d.midtermTurnout2022.toFixed(1) : '',
          d.senator1,
          d.senator1Party,
          d.senator1NextElection ?? '',
          d.senator1LastMargin ?? '',
          d.senator2,
          d.senator2Party,
          d.senator2NextElection ?? '',
          d.senator2LastMargin ?? '',
          d.adultPop18 ?? '',
          d.totalFilers ?? '',
          d.totalFedTaxPaidB ?? '',
          d.eitcClaimsThousands ?? '',
          d.eitcParticipationRate ?? '',
          d.eitcUnclaimedRate ?? '',
          d.urbanPopPct ?? '',
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
    a.download = 'states_data.csv'
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
        searchPlaceholder="Search by state, PVI, or senator..."
        entityName="states"
        columns={table.getAllLeafColumns()}
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
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="data-row-clickable"
                onClick={() => navigate('map', 'states', { state: row.original.state })}
              >
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
