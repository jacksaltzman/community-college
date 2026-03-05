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
import SourceFootnote from './SourceFootnote'
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

const INITIAL_VISIBLE = 60
const LOAD_MORE_COUNT = 50

const numFmt = new Intl.NumberFormat('en-US')

const globalSearchFilter = makeGlobalSearchFilter(['state', 'cookPVI', 'senator1', 'senator2', 'senator1Party', 'senator2Party'])

/* ── Main Component ── */

export default function StatesTable({ campuses, statesData, sources, navigate, params }) {
  const [globalFilter, setGlobalFilter] = useState(params?.state || '')
  const [sorting, setSorting] = useState([{ id: 'enrollment', desc: true }])
  const [columnFilters, setColumnFilters] = useState([])
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [columnVisibility, setColumnVisibility] = useState({})
  const [columnOrder, setColumnOrder] = useState([])
  const [toast, setToast] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

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
        senator1TaxCommittees: stInfo.senator1TaxCommittees ?? null,
        senator2TaxCommittees: stInfo.senator2TaxCommittees ?? null,
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
        meta: { isNumeric: true, fieldKey: 'state_enrollment' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'campusCount',
        accessorKey: 'campusCount',
        header: 'Campus Count',
        meta: { isNumeric: true, fieldKey: 'state_campus_count' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'districtCount',
        accessorKey: 'districtCount',
        header: 'District Count',
        meta: { isNumeric: true, fieldKey: 'state_district_count' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'avgDistrictsReached',
        accessorKey: 'avgDistrictsReached',
        header: 'Avg Districts Reached',
        meta: { isNumeric: true, fieldKey: 'state_avg_districts_reached' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => getValue().toFixed(1),
        sortDescFirst: true,
      },
      {
        id: 'cookPVI',
        accessorKey: 'cookPVI',
        header: 'Cook PVI',
        meta: { fieldKey: 'state_cook_pvi' },
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
        meta: { isNumeric: true, fieldKey: 'midterm_turnout_2022' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      ...(expandedGroups.has('senator1Group')
        ? [{
            id: 'senator1Group',
            header: 'Senator 1',
            columns: [
              {
                id: 'senator1Name',
                accessorKey: 'senator1',
                header: 'Name',
                meta: { fieldKey: 'senator_name' },
                filterFn: 'includesString',
                cell: ({ getValue }) => getValue() || '\u2014',
              },
              {
                id: 'senator1Party',
                accessorKey: 'senator1Party',
                header: 'Party',
                meta: { fieldKey: 'senator_party' },
                filterFn: 'includesString',
                cell: ({ getValue }) => getValue() || '\u2014',
                size: 60,
              },
              {
                id: 'senator1LastMargin',
                accessorKey: 'senator1LastMargin',
                header: 'Margin',
                meta: { isNumeric: true, fieldKey: 'senator_last_margin' },
                filterFn: numericRangeFilter,
                cell: ({ getValue }) => {
                  const v = getValue()
                  return v != null ? `+${v}%` : '\u2014'
                },
                sortDescFirst: true,
                size: 80,
              },
              {
                id: 'senator1NextElection',
                accessorKey: 'senator1NextElection',
                header: 'Election',
                meta: { isNumeric: true, fieldKey: 'senator_next_election' },
                filterFn: numericRangeFilter,
                cell: ({ getValue }) => getValue() ?? '\u2014',
                size: 80,
              },
              {
                id: 'senator1TaxCommittees',
                accessorKey: 'senator1TaxCommittees',
                header: 'Tax Cmte',
                meta: { isNumeric: true, fieldKey: 'senator_tax_committees' },
                filterFn: numericRangeFilter,
                cell: ({ getValue }) => {
                  const v = getValue()
                  return v != null ? v : '\u2014'
                },
                sortDescFirst: true,
                size: 80,
              },
            ],
          }]
        : [{
            id: 'senator1Collapsed',
            accessorKey: 'senator1',
            header: 'Senator 1',
            filterFn: 'includesString',
            cell: ({ getValue }) => getValue() || '\u2014',
            meta: { collapsedGroup: 'senator1Group', fieldKey: 'senator_name' },
          }]
      ),
      ...(expandedGroups.has('senator2Group')
        ? [{
            id: 'senator2Group',
            header: 'Senator 2',
            columns: [
              {
                id: 'senator2Name',
                accessorKey: 'senator2',
                header: 'Name',
                meta: { fieldKey: 'senator_name' },
                filterFn: 'includesString',
                cell: ({ getValue }) => getValue() || '\u2014',
              },
              {
                id: 'senator2Party',
                accessorKey: 'senator2Party',
                header: 'Party',
                meta: { fieldKey: 'senator_party' },
                filterFn: 'includesString',
                cell: ({ getValue }) => getValue() || '\u2014',
                size: 60,
              },
              {
                id: 'senator2LastMargin',
                accessorKey: 'senator2LastMargin',
                header: 'Margin',
                meta: { isNumeric: true, fieldKey: 'senator_last_margin' },
                filterFn: numericRangeFilter,
                cell: ({ getValue }) => {
                  const v = getValue()
                  return v != null ? `+${v}%` : '\u2014'
                },
                sortDescFirst: true,
                size: 80,
              },
              {
                id: 'senator2NextElection',
                accessorKey: 'senator2NextElection',
                header: 'Election',
                meta: { isNumeric: true, fieldKey: 'senator_next_election' },
                filterFn: numericRangeFilter,
                cell: ({ getValue }) => getValue() ?? '\u2014',
                size: 80,
              },
              {
                id: 'senator2TaxCommittees',
                accessorKey: 'senator2TaxCommittees',
                header: 'Tax Cmte',
                meta: { isNumeric: true, fieldKey: 'senator_tax_committees' },
                filterFn: numericRangeFilter,
                cell: ({ getValue }) => {
                  const v = getValue()
                  return v != null ? v : '\u2014'
                },
                sortDescFirst: true,
                size: 80,
              },
            ],
          }]
        : [{
            id: 'senator2Collapsed',
            accessorKey: 'senator2',
            header: 'Senator 2',
            filterFn: 'includesString',
            cell: ({ getValue }) => getValue() || '\u2014',
            meta: { collapsedGroup: 'senator2Group', fieldKey: 'senator_name' },
          }]
      ),
      {
        id: 'adultPop18',
        accessorKey: 'adultPop18',
        header: 'Adult Pop (18+)',
        meta: { isNumeric: true, fieldKey: 'adult_pop_18' },
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
        meta: { isNumeric: true, fieldKey: 'total_fed_tax_paid' },
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
        meta: { isNumeric: true, fieldKey: 'eitc_claims' },
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
        meta: { isNumeric: true, fieldKey: 'eitc_unclaimed_rate' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
    ],
    [navigate, expandedGroups],
  )

  useEffect(() => {
    setColumnOrder(columns.flatMap(c => c.columns ? c.columns.map(sc => sc.id) : [c.id]))
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
      'S1 Tax Committees',
      'Senator 2',
      'Senator 2 Party',
      'S2 Next Election',
      'S2 Last Margin (%)',
      'S2 Tax Committees',
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
      'Number of tax-relevant Senate committees (source: senate.gov)',
      'U.S. Senator (119th Congress)',
      'Party affiliation',
      'Next election year',
      'Last election margin percentage',
      'Number of tax-relevant Senate committees (source: senate.gov)',
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
          d.senator1TaxCommittees ?? '',
          d.senator2,
          d.senator2Party,
          d.senator2NextElection ?? '',
          d.senator2LastMargin ?? '',
          d.senator2TaxCommittees ?? '',
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
        searchPlaceholder="Search by state, PVI, or senator..."
        entityName="states"
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
                {headerGroups.map((headerGroup, groupIdx) => {
                  const isGroupRow = groupIdx === 0 && headerGroups.length > 1

                  return (
                    <tr key={headerGroup.id} className={isGroupRow ? 'col-group-header-row' : ''}>
                      {headerGroup.headers.map((header) => {
                        const isGroupHeader = !header.isPlaceholder && header.colSpan > 1
                        const isPlaceholder = header.isPlaceholder

                        /* Row 0 placeholder: render non-grouped column with rowSpan
                           so it spans both the group-header and leaf-header rows */
                        if (isPlaceholder && isGroupRow) {
                          const leafHeader = header.subHeaders?.[0]
                          if (leafHeader) {
                            const isLeafNum = leafHeader.column.columnDef.meta?.isNumeric
                            const placeholderCollapsedId = leafHeader.column.columnDef.meta?.collapsedGroup

                            /* Collapsed senator column appearing as placeholder in group row */
                            if (placeholderCollapsedId) {
                              const pfk = leafHeader.column.columnDef.meta?.fieldKey
                              return (
                                <DraggableHeader
                                  key={header.id}
                                  header={header}
                                  rowSpan={headerGroups.length}
                                  className="col-group-collapsed"
                                >
                                  <span className="th-content" onClick={leafHeader.column.getToggleSortingHandler()}>
                                    <span
                                      className="col-group-expand-trigger"
                                      onClick={(e) => { e.stopPropagation(); toggleGroup(placeholderCollapsedId) }}
                                      title="Expand columns"
                                    >
                                      {flexRender(leafHeader.column.columnDef.header, leafHeader.getContext())}
                                      <span className="col-group-toggle-icon">+</span>
                                    </span>
                                    {pfk && <SourceFootnote fieldKey={pfk} sources={sources} />}
                                    {sortIcon(leafHeader.column)}
                                  </span>
                                </DraggableHeader>
                              )
                            }

                            const leafFieldKey = leafHeader.column.columnDef.meta?.fieldKey
                            return (
                              <DraggableHeader
                                key={header.id}
                                header={header}
                                rowSpan={headerGroups.length}
                                className={isLeafNum ? 'num' : ''}
                              >
                                <span className="th-content" onClick={leafHeader.column.getToggleSortingHandler()}>
                                  {flexRender(leafHeader.column.columnDef.header, leafHeader.getContext())}
                                  {leafFieldKey && <SourceFootnote fieldKey={leafFieldKey} sources={sources} />}
                                  {sortIcon(leafHeader.column)}
                                </span>
                              </DraggableHeader>
                            )
                          }
                          return <th key={header.id} rowSpan={headerGroups.length} />
                        }

                        /* Row 1: skip non-grouped columns already rendered via rowSpan */
                        if (!isGroupRow && headerGroups.length > 1 && !header.column.parent) {
                          return null
                        }

                        /* Group header: Senator 1, Senator 2 (expanded) */
                        if (isGroupHeader) {
                          const groupId = header.column.id
                          return (
                            <th
                              key={header.id}
                              colSpan={header.colSpan}
                              className="col-group-th col-group-expandable"
                              onClick={() => toggleGroup(groupId)}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="col-group-toggle-icon">&minus;</span>
                            </th>
                          )
                        }

                        /* Collapsed senator column — show as leaf header with expand chevron */
                        const collapsedGroupId = header.column.columnDef.meta?.collapsedGroup
                        if (collapsedGroupId) {
                          const isNum = header.column.columnDef.meta?.isNumeric
                          const cfk = header.column.columnDef.meta?.fieldKey
                          return (
                            <DraggableHeader
                              key={header.id}
                              header={header}
                              className={`col-group-collapsed ${isNum ? 'num' : ''}`}
                            >
                              <span className="th-content" onClick={header.column.getToggleSortingHandler()}>
                                <span
                                  className="col-group-expand-trigger"
                                  onClick={(e) => { e.stopPropagation(); toggleGroup(collapsedGroupId) }}
                                  title="Expand columns"
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  <span className="col-group-toggle-icon">+</span>
                                </span>
                                {cfk && <SourceFootnote fieldKey={cfk} sources={sources} />}
                                {sortIcon(header.column)}
                              </span>
                            </DraggableHeader>
                          )
                        }

                        /* Leaf header — sortable, filterable */
                        const isNum = header.column.columnDef.meta?.isNumeric
                        const fieldKey = header.column.columnDef.meta?.fieldKey

                        return (
                          <DraggableHeader
                            key={header.id}
                            header={header}
                            className={isNum ? 'num' : ''}
                          >
                            <span className="th-content" onClick={header.column.getToggleSortingHandler()}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {fieldKey && <SourceFootnote fieldKey={fieldKey} sources={sources} />}
                              {sortIcon(header.column)}
                            </span>
                          </DraggableHeader>
                        )
                      })}
                    </tr>
                  )
                })}
              </SortableContext>
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
