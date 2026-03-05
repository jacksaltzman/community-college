# Collapsible Senator Column Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add expand/collapse toggles to senator group headers so each group can switch between a single name column (collapsed) and the full 5 sub-columns (expanded).

**Architecture:** Add `expandedGroups` state (Set). The `columns` useMemo checks this state to emit either a flat column or a grouped column for each senator. The group header `<th>` gets a chevron icon and click handler.

**Tech Stack:** React 18, @tanstack/react-table v8, CSS

---

### Task 1: Add expandedGroups state and dynamic column builder

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx:25-31` (state declarations)
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx:107-355` (columns useMemo)

**Step 1: Add state**

After line 30 (`const [columnVisibility, setColumnVisibility] = useState({})`), add:

```jsx
const [expandedGroups, setExpandedGroups] = useState(new Set())
```

**Step 2: Create toggle helper**

After the state declarations (around line 32), add:

```jsx
const toggleGroup = useCallback((groupId) => {
  setExpandedGroups(prev => {
    const next = new Set(prev)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    return next
  })
}, [])
```

**Step 3: Add expandedGroups to columns useMemo dependency**

Change line 355 from:
```jsx
[navigate],
```
to:
```jsx
[navigate, expandedGroups],
```

**Step 4: Replace senator1Group column definition (lines 194-249)**

Replace the senator1Group object with:

```jsx
...(expandedGroups.has('senator1Group')
  ? [{
      id: 'senator1Group',
      header: 'Senator 1',
      columns: [
        {
          id: 'senator1Name',
          accessorKey: 'senator1',
          header: 'Name',
          filterFn: 'includesString',
          cell: ({ getValue }) => getValue() || '\u2014',
        },
        {
          id: 'senator1Party',
          accessorKey: 'senator1Party',
          header: 'Party',
          filterFn: 'includesString',
          cell: ({ getValue }) => getValue() || '\u2014',
          size: 60,
        },
        {
          id: 'senator1LastMargin',
          accessorKey: 'senator1LastMargin',
          header: 'Margin',
          meta: { isNumeric: true },
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
          meta: { isNumeric: true },
          filterFn: numericRangeFilter,
          cell: ({ getValue }) => getValue() ?? '\u2014',
          size: 80,
        },
        {
          id: 'senator1TaxCommittees',
          accessorKey: 'senator1TaxCommittees',
          header: 'Tax Cmte',
          meta: { isNumeric: true },
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
      meta: { collapsedGroup: 'senator1Group' },
    }]
),
```

**Step 5: Replace senator2Group column definition (lines 250-305)**

Same pattern for senator 2:

```jsx
...(expandedGroups.has('senator2Group')
  ? [{
      id: 'senator2Group',
      header: 'Senator 2',
      columns: [
        {
          id: 'senator2Name',
          accessorKey: 'senator2',
          header: 'Name',
          filterFn: 'includesString',
          cell: ({ getValue }) => getValue() || '\u2014',
        },
        {
          id: 'senator2Party',
          accessorKey: 'senator2Party',
          header: 'Party',
          filterFn: 'includesString',
          cell: ({ getValue }) => getValue() || '\u2014',
          size: 60,
        },
        {
          id: 'senator2LastMargin',
          accessorKey: 'senator2LastMargin',
          header: 'Margin',
          meta: { isNumeric: true },
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
          meta: { isNumeric: true },
          filterFn: numericRangeFilter,
          cell: ({ getValue }) => getValue() ?? '\u2014',
          size: 80,
        },
        {
          id: 'senator2TaxCommittees',
          accessorKey: 'senator2TaxCommittees',
          header: 'Tax Cmte',
          meta: { isNumeric: true },
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
      meta: { collapsedGroup: 'senator2Group' },
    }]
),
```

**Step 6: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds with no errors.

---

### Task 2: Update thead rendering for collapsed group headers with chevron

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx:530-615` (thead rendering block)

**Step 1: Update the group header rendering branch**

In the thead rendering, find the `/* Group header: Senator 1, Senator 2 */` block (around line 575). Replace:

```jsx
/* Group header: Senator 1, Senator 2 */
if (isGroupHeader) {
  return (
    <th
      key={header.id}
      colSpan={header.colSpan}
      className="col-group-th"
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
    </th>
  )
}
```

With:

```jsx
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
      <span className="col-group-chevron">&#9662;</span>
    </th>
  )
}
```

**Step 2: Handle collapsed senator column header with chevron**

In the leaf header rendering branch (after the group header block), add a check BEFORE the existing leaf header code. This handles the collapsed senator column which appears as a regular leaf header but needs the expand chevron:

Find the `/* Leaf header - sortable, filterable */` comment. BEFORE that line, insert:

```jsx
/* Collapsed senator column — show as leaf header with expand chevron */
const collapsedGroupId = header.column.columnDef.meta?.collapsedGroup
if (collapsedGroupId) {
  const isNum = header.column.columnDef.meta?.isNumeric
  return (
    <th
      key={header.id}
      className={`col-group-collapsed ${isNum ? 'num' : ''}`}
      onClick={header.column.getToggleSortingHandler()}
    >
      <span className="th-content">
        <span
          className="col-group-expand-trigger"
          onClick={(e) => { e.stopPropagation(); toggleGroup(collapsedGroupId) }}
          title="Expand columns"
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          <span className="col-group-chevron">&#9656;</span>
        </span>
        {sortIcon(header.column)}
        <ColumnFilterPopover
          column={header.column}
          isNumeric={!!isNum}
          alignRight={false}
        />
      </span>
    </th>
  )
}
```

**Step 3: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

---

### Task 3: Add CSS styles for expandable group headers

**Files:**
- Modify: `Students Per District/app/src/styles/data.css:98-117` (column group header styles)

**Step 1: Add styles after the existing `.col-group-header-row th[rowspan]` block (line 117)**

```css
/* ── Expandable Group Headers ── */
.data-table .col-group-expandable {
  cursor: pointer;
  user-select: none;
}
.data-table .col-group-expandable:hover {
  background: #E8E5E0;
}
.data-table .col-group-chevron {
  display: inline-block;
  margin-left: 4px;
  font-size: 8px;
  vertical-align: middle;
  opacity: 0.6;
}
.data-table .col-group-collapsed {
  background: #FAFAF8;
}
.data-table .col-group-expand-trigger {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 2px;
}
.data-table .col-group-expand-trigger:hover {
  background: #E8E5E0;
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

---

### Task 4: Visual verification and commit

**Step 1: Start preview and navigate to Data > States**

Navigate to `#data/states` at desktop width (1600x900).

**Step 2: Verify collapsed state (default)**

- Both senator groups show as single columns: "Senator 1 ▸" and "Senator 2 ▸"
- The collapsed columns are sortable (click the header text area)
- The collapsed columns have filter popovers
- The table is narrower than before (only 13 columns instead of 21)

**Step 3: Verify expand**

- Click the "Senator 1 ▸" chevron/header area — it expands to 5 sub-columns with "Senator 1 ▾" group header
- Senator 2 remains collapsed
- Expand Senator 2 independently

**Step 4: Verify collapse**

- Click the "Senator 1 ▾" group header — collapses back to single column
- Data and sorting state preserved

**Step 5: Verify CSV export still includes all fields**

- Click Export CSV — file should contain all senator sub-fields regardless of collapsed state

**Step 6: Verify mobile card view**

- Resize to mobile (375x812) — all senator fields should appear in cards

**Step 7: Commit**

```bash
git add "Students Per District/app/src/components/data/StatesTable.jsx" "Students Per District/app/src/styles/data.css"
git commit -m "feat: collapsible senator column groups with expand/collapse toggle"
```
