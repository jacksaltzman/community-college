import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import TableControls from './TableControls'
import SourceFootnote from './SourceFootnote'
import { numericRangeFilter, makeGlobalSearchFilter } from './tableFilters'
import Toast from '../Toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import DraggableHeader from './DraggableHeader'

/* ── Constants ── */

const INITIAL_VISIBLE = 50
const LOAD_MORE_COUNT = 50

const numFmt = new Intl.NumberFormat('en-US')
const dollarFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const globalSearchFilter = makeGlobalSearchFilter(['district', 'state', 'member', 'party', 'cookPVI', 'committees'])

/* ── Main Component ── */

export default function DistrictsTable({ campuses, districtsMeta, sources, navigate, params }) {
  const [globalFilter, setGlobalFilter] = useState(params?.district || params?.state || '')
  const [sorting, setSorting] = useState([{ id: 'enrollment', desc: true }])
  const [columnFilters, setColumnFilters] = useState([])
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [columnVisibility, setColumnVisibility] = useState({})
  const [columnOrder, setColumnOrder] = useState([])
  const [toast, setToast] = useState(null)

  /* ── Sync global filter from URL params ── */
  useEffect(() => {
    if (params?.district) setGlobalFilter(params.district)
    else if (params?.state) setGlobalFilter(params.state)
  }, [params?.district, params?.state])

  /* Reset visible count when filters/sorting change */
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE)
  }, [globalFilter, columnFilters, sorting])

  /* ── Build lookup from districts metadata for Cook PVI / member / party ── */
  const districtLookup = useMemo(() => {
    if (!districtsMeta?.districts) return {}
    const lookup = {}
    Object.entries(districtsMeta.districts).forEach(([cd, d]) => {
      lookup[cd] = {
        cook_pvi: d.cook_pvi || '',
        member: d.member || '',
        party: d.party || '',
        median_income: d.median_income ?? null,
        poverty_rate: d.poverty_rate ?? null,
        pct_associates_plus: d.pct_associates_plus ?? null,
        pct_18_24: d.pct_18_24 ?? null,
        total_votes_2022: d.total_votes_2022 ?? null,
        total_votes_2024: d.total_votes_2024 ?? null,
        turnout_rate_2022: d.turnout_rate_2022 ?? null,
        turnout_rate_2024: d.turnout_rate_2024 ?? null,
        committees: d.committees || '',
      }
    })
    return lookup
  }, [districtsMeta])

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
      const dashIdx = district.indexOf('-')
      const state = dashIdx > 0 ? district.substring(0, dashIdx) : district
      const info = districtLookup[district] || {}
      return {
        district,
        state,
        enrollment: m.enrollment,
        campusCount: m.campusCount,
        cookPVI: info.cook_pvi || '',
        member: info.member || '',
        party: info.party || '',
        medianIncome: info.median_income,
        povertyRate: info.poverty_rate,
        pctAssociatesPlus: info.pct_associates_plus,
        pct1824: info.pct_18_24,
        totalVotes2022: info.total_votes_2022,
        totalVotes2024: info.total_votes_2024,
        turnoutRate2022: info.turnout_rate_2022,
        turnoutRate2024: info.turnout_rate_2024,
        committees: info.committees || '',
      }
    })
  }, [campuses, districtLookup])

  /* ── Column definitions ── */
  const columns = useMemo(
    () => [
      {
        id: 'district',
        accessorKey: 'district',
        header: 'District',
        meta: { fieldKey: 'districts_reached' },
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
        size: 60,
        filterFn: 'includesString',
      },
      {
        id: 'enrollment',
        accessorKey: 'enrollment',
        header: 'Enrollment',
        meta: { isNumeric: true, fieldKey: 'enrollment' },
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
        accessorKey: 'cookPVI',
        meta: { fieldKey: 'cook_pvi' },
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
        id: 'member',
        header: 'Representative',
        accessorKey: 'member',
        meta: { fieldKey: 'member' },
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
      },
      {
        id: 'party',
        header: 'Party',
        accessorKey: 'party',
        size: 60,
        meta: { fieldKey: 'party' },
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
      },
      {
        id: 'committees',
        header: 'Committees',
        accessorKey: 'committees',
        meta: { fieldKey: 'house_committees' },
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
        size: 260,
      },
      {
        id: 'medianIncome',
        accessorKey: 'medianIncome',
        header: 'Median Income',
        meta: { isNumeric: true, fieldKey: 'median_income' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? dollarFmt.format(v) : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'povertyRate',
        accessorKey: 'povertyRate',
        header: 'Poverty Rate',
        meta: { isNumeric: true, fieldKey: 'poverty_rate' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'pctAssociatesPlus',
        accessorKey: 'pctAssociatesPlus',
        header: "% Associate's+",
        meta: { isNumeric: true, fieldKey: 'pct_associates_plus' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'pct1824',
        accessorKey: 'pct1824',
        header: '% Age 18-24',
        meta: { isNumeric: true, fieldKey: 'pct_18_24' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'totalVotes2022',
        accessorKey: 'totalVotes2022',
        header: 'Votes 2022',
        meta: { isNumeric: true, fieldKey: 'total_votes_2022' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? numFmt.format(v) : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'totalVotes2024',
        accessorKey: 'totalVotes2024',
        header: 'Votes 2024',
        meta: { isNumeric: true, fieldKey: 'total_votes_2024' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? numFmt.format(v) : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'turnoutRate2022',
        accessorKey: 'turnoutRate2022',
        header: 'Turnout 2022',
        meta: { isNumeric: true, fieldKey: 'turnout_rate_2022' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'turnoutRate2024',
        accessorKey: 'turnoutRate2024',
        header: 'Turnout 2024',
        meta: { isNumeric: true, fieldKey: 'turnout_rate_2024' },
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

  useEffect(() => {
    setColumnOrder(columns.map(c => c.id))
  }, [columns])

  /* ── TanStack Table instance ── */
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
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
      'District',
      'State',
      'Enrollment',
      'Campus Count',
      'Cook PVI',
      'Representative',
      'Party',
      'Committees',
      'Median Income',
      'Poverty Rate (%)',
      "% Associate's+",
      '% Age 18-24',
      'Votes 2022',
      'Votes 2024',
      'Turnout 2022 (%)',
      'Turnout 2024 (%)',
    ]
    const notes = [
      'Congressional district code',
      'State abbreviation',
      'Sum of enrollment from campuses reaching this district',
      'Number of community college campuses reaching this district',
      '2022 Cook Partisan Voter Index',
      'Current U.S. Representative',
      'Party affiliation (R/D)',
      'House committee assignments (119th Congress)',
      'Median household income (ACS 2023 5-Year)',
      'Poverty rate (ACS 2023 5-Year)',
      "Pct of adults 25+ with associate's degree or higher (ACS 2023 5-Year)",
      'Pct of population aged 18-24 (ACS 2023 5-Year)',
      'Total votes cast in 2022 House general election (MEDSL)',
      'Total votes cast in 2024 House general election (MEDSL)',
      'Turnout rate: votes / citizen voting-age population (ACS 2023 CVAP)',
      'Turnout rate: votes / citizen voting-age population (ACS 2023 CVAP)',
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
          d.cookPVI,
          d.member,
          d.party,
          d.committees,
          d.medianIncome != null ? d.medianIncome : '',
          d.povertyRate != null ? d.povertyRate : '',
          d.pctAssociatesPlus != null ? d.pctAssociatesPlus : '',
          d.pct1824 != null ? d.pct1824 : '',
          d.totalVotes2022 != null ? d.totalVotes2022 : '',
          d.totalVotes2024 != null ? d.totalVotes2024 : '',
          d.turnoutRate2022 != null ? d.turnoutRate2022 : '',
          d.turnoutRate2024 != null ? d.turnoutRate2024 : '',
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
    setToast('CSV exported')
  }, [sortedRows])

  /* ── Sort icon helper ── */
  function sortIcon(column) {
    const dir = column.getIsSorted()
    if (!dir) return <span className="sort-icon">&nbsp;&nbsp;</span>
    return <span className="sort-icon">{dir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setColumnOrder(prev => {
        const oldIndex = prev.indexOf(active.id)
        const newIndex = prev.indexOf(over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
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
        searchPlaceholder="Search by district or state..."
        entityName="districts"
        columns={table.getAllLeafColumns()}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
      />

      <div className="data-table-wrap">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="data-table">
            <thead>
              <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                {headerGroups.map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header, idx) => {
                      const isNum = header.column.columnDef.meta?.isNumeric
                      const fieldKey = header.column.columnDef.meta?.fieldKey
                      const alignRight = idx >= headerGroup.headers.length - 3
                      const colSize = header.column.columnDef.size
                      return (
                        <DraggableHeader
                          key={header.id}
                          header={header}
                          className={isNum ? 'num' : ''}
                          style={colSize ? { width: colSize } : {}}
                        >
                          <span className="th-content" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {fieldKey && <SourceFootnote fieldKey={fieldKey} sources={sources} />}
                          </span>
                        </DraggableHeader>
                      )
                    })}
                  </tr>
                ))}
              </SortableContext>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="data-row-clickable"
                  onClick={() => navigate('map', 'districts', { district: row.original.district })}
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
        </DndContext>
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
