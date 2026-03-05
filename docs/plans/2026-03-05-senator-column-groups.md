# Senator Column Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break the 2 composite senator columns in the States data table into 2 column groups of 5 sortable/filterable sub-columns each.

**Architecture:** Replace the flat `senator1`/`senator2` column definitions with TanStack Table column groups. Each group header spans 5 leaf columns (Name, Party, Margin, Election, Tax Cmte). Add CSS for the two-row grouped header. Update CSV export to include tax committee fields.

**Tech Stack:** React, @tanstack/react-table v8 (column groups), CSS

---

### Task 1: Add tax committee fields to row data

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx` (lines 72-101, data builder)

**Step 1: Add senator tax committee fields to the data builder**

In the `useMemo` that builds row data (~line 72), add these two fields to the return object, right after `senator2LastMargin`:

```js
senator1TaxCommittees: stInfo.senator1TaxCommittees ?? null,
senator2TaxCommittees: stInfo.senator2TaxCommittees ?? null,
```

**Step 2: Verify build**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add Students\ Per\ District/app/src/components/data/StatesTable.jsx
git commit -m "feat: load senator tax committee fields into states table data"
```

---

### Task 2: Replace senator columns with grouped column definitions

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx` (lines 105-268, column definitions)

**Step 1: Replace the two composite senator columns**

Remove the `senator1` column definition (lines 192-205) and `senator2` column definition (lines 206-219). Replace them with two column group objects. The column groups use TanStack Table's `columns` array nesting:

```js
{
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
},
{
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
},
```

**Step 2: Update the global search filter to include the new accessor keys**

Change line 21 from:
```js
const globalSearchFilter = makeGlobalSearchFilter(['state', 'cookPVI', 'senator1', 'senator2'])
```
to:
```js
const globalSearchFilter = makeGlobalSearchFilter(['state', 'cookPVI', 'senator1', 'senator2', 'senator1Party', 'senator2Party'])
```

**Step 3: Verify build**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add Students\ Per\ District/app/src/components/data/StatesTable.jsx
git commit -m "feat: replace composite senator columns with grouped sub-columns"
```

---

### Task 3: Update thead rendering to support grouped headers

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx` (lines 440-465, thead rendering)

**Step 1: Update the thead to render multiple header group rows**

TanStack Table's `getHeaderGroups()` already returns multiple rows when column groups are used. The existing code iterates `headerGroups` — but the inner render needs to handle group headers (which have `header.isPlaceholder` = false and `header.colSpan` > 1) differently from leaf headers.

Replace the thead block (lines 440-465) with:

```jsx
<thead>
  {headerGroups.map((headerGroup, groupIdx) => (
    <tr key={headerGroup.id} className={groupIdx === 0 && headerGroups.length > 1 ? 'col-group-header-row' : ''}>
      {headerGroup.headers.map((header) => {
        const isGroupHeader = header.depth === 0 && header.colSpan > 1
        const isNum = header.column.columnDef.meta?.isNumeric
        const isPlaceholder = header.isPlaceholder

        if (isPlaceholder) {
          return <th key={header.id} rowSpan={headerGroups.length} />
        }

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

        // Leaf header — sortable, filterable
        const allHeaders = headerGroups.flatMap(hg => hg.headers)
        const leafHeaders = allHeaders.filter(h => !h.isPlaceholder && !(h.depth === 0 && h.colSpan > 1))
        const leafIdx = leafHeaders.indexOf(header)
        const alignRight = leafIdx >= leafHeaders.length - 3

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
```

Note: The `isPlaceholder` check handles non-grouped columns (State, Enrollment, etc.) which appear as placeholders in the first header row and real headers in the second. We use `rowSpan` so they span both rows.

**Step 2: Verify build**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add Students\ Per\ District/app/src/components/data/StatesTable.jsx
git commit -m "feat: render grouped column headers with colSpan and rowSpan"
```

---

### Task 4: Style the grouped header row

**Files:**
- Modify: `Students Per District/app/src/styles/data.css`

**Step 1: Add CSS for grouped header cells**

Add after line 96 (`.data-table th.num`):

```css
/* ── Column Group Headers ── */
.data-table .col-group-th {
  text-align: center;
  background: #F0EDE8;
  border-bottom: 2px solid var(--border-main);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--black);
  cursor: default;
  padding: 8px 12px;
}
.data-table .col-group-header-row th {
  border-bottom: 2px solid var(--border-main);
}
/* Non-grouped columns in grouped header row span both rows */
.data-table .col-group-header-row th[rowspan] {
  vertical-align: bottom;
  background: #FAFAF8;
  border-bottom: 1px solid var(--border-light);
}
```

**Step 2: Update min-width for the wider table**

Change line 72 from:
```css
min-width: 1100px;
```
to:
```css
min-width: 1400px;
```

**Step 3: Verify build**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add Students\ Per\ District/app/src/styles/data.css
git commit -m "style: grouped column header styling for senator columns"
```

---

### Task 5: Update CSV export to include tax committee fields

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx` (lines 304-410, handleExport)

**Step 1: Add tax committee columns to CSV headers and data**

In the `headers` array, add `'S1 Tax Committees'` after `'S1 Last Margin (%)'` and `'S2 Tax Committees'` after `'S2 Last Margin (%)'`.

In the `notes` array, add `'Number of tax-relevant Senate committees'` in the same positions.

In the row export loop, add `d.senator1TaxCommittees ?? ''` after `d.senator1LastMargin ?? ''` and `d.senator2TaxCommittees ?? ''` after `d.senator2LastMargin ?? ''`.

**Step 2: Verify build**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add Students\ Per\ District/app/src/components/data/StatesTable.jsx
git commit -m "feat: add tax committee fields to CSV export"
```

---

### Task 6: Visual verification

**Step 1: Start dev server and navigate to Data > States**

Run: `cd "Students Per District/app" && npm run dev`
Navigate to: `#data/states`

**Step 2: Verify the grouped header renders**

Confirm:
- "Senator 1" and "Senator 2" group headers span 5 sub-columns each
- Sub-columns are: Name, Party, Margin, Election, Tax Cmte
- Non-grouped columns (State, Enrollment, etc.) span both header rows
- Group headers have a slightly darker background than leaf headers
- Each leaf column is individually sortable and filterable
- Column picker shows all 10 senator leaf columns individually

**Step 3: Test CSV export**

Click "Export CSV" and verify the CSV has the new tax committee columns.

**Step 4: Test column hiding**

Use column picker to hide individual senator sub-columns (e.g., hide "Tax Cmte" for both). Verify the group header colSpan adjusts.

**Step 5: Final commit (squash if desired)**

```bash
git add -A
git commit -m "feat: grouped senator columns with tax committee data in states table"
```
