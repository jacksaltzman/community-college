# Data Tab Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add active sort/filter indicators on column headers and sticky footer summary rows to all three Data tab tables.

**Architecture:** CSS classes for header highlighting, driven by TanStack's `getIsSorted()` / `getIsFiltered()`. Footer summary row via `<tfoot>` with aggregates computed from filtered rows. Column `meta.aggregate` declares sum vs avg per column.

**Tech Stack:** React, TanStack Table, CSS

---

### Task 1: Add CSS for header indicators and footer summary row

**Files:**
- Modify: `app/src/styles/data.css`

**Step 1: Add header indicator styles after the existing `.data-table th.num` rule (line 384)**

```css
/* ── Active Sort / Filter Indicators ── */
.data-table th.th-sorted {
  background: rgba(76, 105, 113, 0.08);
}
.data-table th.th-filtered {
  background: rgba(76, 105, 113, 0.08);
}
.data-table th.th-sorted.th-filtered {
  background: rgba(76, 105, 113, 0.14);
}
.data-table th.th-sorted .sort-icon,
.data-table th.th-filtered .sort-icon {
  color: var(--teal);
}
```

**Step 2: Add footer summary row styles after the table row hover rule (around line 468)**

```css
/* ── Footer Summary Row ── */
.data-table tfoot {
  position: sticky;
  bottom: 0;
  z-index: 2;
}
.data-table tfoot td {
  background: #FAFAF8;
  border-top: 2px solid var(--border-light);
  border-bottom: none;
  padding: 8px 12px;
  font-family: var(--font-body);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  vertical-align: top;
}
.data-table tfoot td.num {
  text-align: right;
}
.data-table tfoot .footer-label {
  display: block;
  font-family: var(--font-heading);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gray-muted);
  margin-bottom: 2px;
}
.data-table tfoot .footer-value {
  color: var(--black);
  font-weight: 600;
}
```

**Step 3: Hide footer on mobile (inside the `@media (max-width: 768px)` block)**

```css
.data-table tfoot { display: none; }
```

**Step 4: Commit**

```bash
git add app/src/styles/data.css
git commit -m "style: add CSS for header sort/filter indicators and footer summary row"
```

---

### Task 2: Add header indicators and footer to DistrictsTable

**Files:**
- Modify: `app/src/components/data/DistrictsTable.jsx`

**Step 1: Add `meta.aggregate` to each numeric column definition**

For each column in the `columns` useMemo, add an `aggregate` field to `meta`:

- `enrollment`: `meta: { isNumeric: true, fieldKey: 'enrollment', aggregate: 'sum' }`
- `campusCount`: `meta: { isNumeric: true, aggregate: 'sum' }`
- `medianIncome`: `meta: { isNumeric: true, fieldKey: 'median_income', aggregate: 'avg' }`
- `povertyRate`: `meta: { isNumeric: true, fieldKey: 'poverty_rate', aggregate: 'avg' }`
- `pctAssociatesPlus`: `meta: { isNumeric: true, fieldKey: 'pct_associates_plus', aggregate: 'avg' }`
- `pct1824`: `meta: { isNumeric: true, fieldKey: 'pct_18_24', aggregate: 'avg' }`
- `totalVotes2022`: `meta: { isNumeric: true, fieldKey: 'total_votes_2022', aggregate: 'sum' }`
- `totalVotes2024`: `meta: { isNumeric: true, fieldKey: 'total_votes_2024', aggregate: 'sum' }`
- `turnoutRate2022`: `meta: { isNumeric: true, fieldKey: 'turnout_rate_2022', aggregate: 'avg' }`
- `turnoutRate2024`: `meta: { isNumeric: true, fieldKey: 'turnout_rate_2024', aggregate: 'avg' }`

**Step 2: Add header class computation to the header render loop**

In the header mapping (around line 496), build a className that includes sort/filter state. Change the `DraggableHeader` className from:

```javascript
className={isNum ? 'num' : ''}
```

to:

```javascript
className={[
  isNum ? 'num' : '',
  header.column.getIsSorted() ? 'th-sorted' : '',
  header.column.getIsFiltered() ? 'th-filtered' : '',
].filter(Boolean).join(' ')}
```

**Step 3: Restore sort icon to header rendering**

In the `<span className="th-content">` block, add back the sort icon call after the header text and before the SourceFootnote:

```jsx
<span className="th-content" onClick={header.column.getToggleSortingHandler()}>
  {flexRender(header.column.columnDef.header, header.getContext())}
  {sortIcon(header.column)}
  {fieldKey && <SourceFootnote fieldKey={fieldKey} sources={sources} />}
</span>
```

**Step 4: Add footer summary useMemo**

After the `visibleRows` useMemo, add:

```javascript
const footerSummary = useMemo(() => {
  const cols = table.getAllLeafColumns()
  const rows = filteredRows
  if (!rows.length) return null

  return cols.map((col) => {
    const agg = col.columnDef.meta?.aggregate
    if (!agg) return { id: col.id, value: null }

    const values = rows
      .map((r) => r.getValue(col.id))
      .filter((v) => v != null && !isNaN(v))

    if (!values.length) return { id: col.id, value: null }

    if (agg === 'sum') {
      return { id: col.id, label: 'Sum', value: values.reduce((a, b) => a + b, 0), agg }
    }
    if (agg === 'avg') {
      return { id: col.id, label: 'Avg', value: values.reduce((a, b) => a + b, 0) / values.length, agg }
    }
    return { id: col.id, value: null }
  })
}, [filteredRows, table])
```

**Step 5: Add `<tfoot>` after `</tbody>` and before `</table>`**

```jsx
{footerSummary && (
  <tfoot>
    <tr>
      {footerSummary.map((col) => {
        const colDef = table.getColumn(col.id)?.columnDef
        const isNum = colDef?.meta?.isNumeric
        return (
          <td key={col.id} className={isNum ? 'num' : ''}>
            {col.value != null && (
              <>
                <span className="footer-label">{col.label}</span>
                <span className="footer-value">
                  {col.agg === 'sum'
                    ? numFmt.format(Math.round(col.value))
                    : col.id === 'medianIncome'
                      ? dollarFmt.format(Math.round(col.value))
                      : `${col.value.toFixed(1)}%`}
                </span>
              </>
            )}
          </td>
        )
      })}
    </tr>
  </tfoot>
)}
```

**Step 6: Commit**

```bash
git add app/src/components/data/DistrictsTable.jsx
git commit -m "feat: add header indicators and footer summary to Districts table"
```

---

### Task 3: Add header indicators and footer to CampusesTable

**Files:**
- Modify: `app/src/components/data/CampusesTable.jsx`

**Step 1: Add `meta.aggregate` to numeric column definitions**

- `enrollment`: `meta: { isNumeric: true, aggregate: 'sum' }`
- `radius_miles`: `meta: { isNumeric: true, aggregate: 'avg' }`
- `districts_reached`: `meta: { isNumeric: true, aggregate: 'avg' }`
- `primary_district_coverage`: `meta: { isNumeric: true, aggregate: 'avg' }`

**Step 2: Add header class computation**

Same pattern as Districts — in the header mapping, change className to include sort/filter state:

```javascript
className={[
  isNum ? 'num' : '',
  header.column.getIsSorted() ? 'th-sorted' : '',
  header.column.getIsFiltered() ? 'th-filtered' : '',
].filter(Boolean).join(' ')}
```

**Step 3: Add footer summary useMemo**

Same pattern as Districts. After `visibleRows` useMemo, add the `footerSummary` computation. For Campuses, the formatting in `<tfoot>` is simpler — all numeric columns use `numFmt.format()` for sums, and for avg coverage use percentage format:

```javascript
const footerSummary = useMemo(() => {
  const cols = table.getAllLeafColumns()
  const rows = filteredRows
  if (!rows.length) return null

  return cols.map((col) => {
    const agg = col.columnDef.meta?.aggregate
    if (!agg) return { id: col.id, value: null }

    const values = rows
      .map((r) => r.getValue(col.id))
      .filter((v) => v != null && !isNaN(v))

    if (!values.length) return { id: col.id, value: null }

    if (agg === 'sum') {
      return { id: col.id, label: 'Sum', value: values.reduce((a, b) => a + b, 0), agg }
    }
    if (agg === 'avg') {
      return { id: col.id, label: 'Avg', value: values.reduce((a, b) => a + b, 0) / values.length, agg }
    }
    return { id: col.id, value: null }
  })
}, [filteredRows, table])
```

**Step 4: Add `<tfoot>` after `{renderBody()}` and before `</table>`**

```jsx
{footerSummary && (
  <tfoot>
    <tr>
      {footerSummary.map((col) => {
        const colDef = table.getColumn(col.id)?.columnDef
        const isNum = colDef?.meta?.isNumeric
        return (
          <td key={col.id} className={isNum ? 'num' : ''}>
            {col.value != null && (
              <>
                <span className="footer-label">{col.label}</span>
                <span className="footer-value">
                  {col.agg === 'sum'
                    ? numFmt.format(Math.round(col.value))
                    : col.id === 'primary_district_coverage'
                      ? `${(col.value * 100).toFixed(1)}%`
                      : col.value.toFixed(1)}
                </span>
              </>
            )}
          </td>
        )
      })}
    </tr>
  </tfoot>
)}
```

**Step 5: Commit**

```bash
git add app/src/components/data/CampusesTable.jsx
git commit -m "feat: add header indicators and footer summary to Campuses table"
```

---

### Task 4: Add header indicators and footer to StatesTable

**Files:**
- Modify: `app/src/components/data/StatesTable.jsx`

This table is more complex due to grouped column headers. The changes are:

**Step 1: Add `meta.aggregate` to numeric column definitions**

- `enrollment`: `aggregate: 'sum'`
- `campusCount`: `aggregate: 'sum'`
- `districtCount`: `aggregate: 'sum'`
- `avgDistrictsReached`: `aggregate: 'avg'`
- `midtermTurnout2022`: `aggregate: 'avg'`
- `adultPop18`: `aggregate: 'sum'`
- `totalFedTaxPaidB`: `aggregate: 'sum'`
- `eitcClaimsThousands`: `aggregate: 'sum'`
- `eitcUnclaimedRate`: `aggregate: 'avg'`
- `youngProfessionalPop`: `aggregate: 'sum'`
- `collegeEnrollment`: `aggregate: 'sum'`
- `urbanPopPct`: `aggregate: 'avg'`
- Senator margin fields: `aggregate: 'avg'`
- Senator election/tax committee fields: no aggregate (skip)

**Step 2: Add header class computation to ALL header render paths**

The StatesTable has multiple header rendering paths (placeholder/rowSpan, group headers, collapsed headers, leaf headers). For each `DraggableHeader`, update className to include sort/filter state. Target every `DraggableHeader` that renders a leaf column (not group headers which use plain `<th>`).

For leaf headers and collapsed headers, the pattern is the same as Districts/Campuses — conditionally add `th-sorted` and `th-filtered`.

**Step 3: Add footer summary useMemo**

Same pattern as the other two tables.

**Step 4: Add `<tfoot>` before `</table>`**

Same pattern. For States, the formatting needs to handle the dollar-billions format for totalFedTaxPaidB and the thousands format for eitcClaimsThousands:

```jsx
{footerSummary && (
  <tfoot>
    <tr>
      {footerSummary.map((col) => {
        const colDef = table.getColumn(col.id)?.columnDef
        const isNum = colDef?.meta?.isNumeric
        return (
          <td key={col.id} className={isNum ? 'num' : ''}>
            {col.value != null && (
              <>
                <span className="footer-label">{col.label}</span>
                <span className="footer-value">
                  {col.agg === 'sum'
                    ? numFmt.format(Math.round(col.value))
                    : col.id === 'urbanPopPct' || col.id === 'eitcUnclaimedRate' || col.id === 'midtermTurnout2022'
                      ? `${col.value.toFixed(1)}%`
                      : col.value.toFixed(1)}
                </span>
              </>
            )}
          </td>
        )
      })}
    </tr>
  </tfoot>
)}
```

**Step 5: Commit**

```bash
git add app/src/components/data/StatesTable.jsx
git commit -m "feat: add header indicators and footer summary to States table"
```

---

### Task 5: Build, verify, and push

**Step 1: Build the app**

Run: `cd app && npm run build`
Expected: Build succeeds.

**Step 2: Commit any remaining changes and push**

```bash
git push
```
