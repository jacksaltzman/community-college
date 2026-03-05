# Data Tab Polish — Active Header Indicators + Footer Summary Row

**Date:** 2026-03-05

## Goal

Add two Airtable-inspired polish features to all three Data tab tables (Campuses, Districts, States): active sort/filter indicators on column headers, and a sticky footer summary row with aggregates.

## Feature 1: Active Sort/Filter Indicators in Column Headers

### Visual Treatment
- **Sorted columns:** Light teal background tint (`rgba(76, 105, 113, 0.08)`) on `<th>`, plus a small arrow (▲/▼) in the header text
- **Filtered columns:** Same tint plus a small colored dot indicator
- Both are additive — a column that is both sorted and filtered gets both indicators
- On hover, indicators remain visible (no conflict with existing hover state)

### Implementation
- Add CSS classes `.th-sorted` and `.th-filtered` to `data.css`
- In each table's header render loop, conditionally apply classes using TanStack's `header.column.getIsSorted()` and `header.column.getIsFiltered()`
- Restore the sort arrow icon to DistrictsTable (was removed earlier) in the new styled form
- All three tables (Campuses, Districts, States) get the same treatment

### CSS
```css
.data-table th.th-sorted {
  background: rgba(76, 105, 113, 0.08);
}
.data-table th.th-filtered {
  background: rgba(76, 105, 113, 0.08);
}
.data-table th.th-sorted.th-filtered {
  background: rgba(76, 105, 113, 0.12);
}
```

## Feature 2: Sticky Footer Summary Row

### Visual Treatment
- `<tfoot>` with `position: sticky; bottom: 0`
- Background matches header (`#FAFAF8`), top border `2px solid var(--border-light)`
- Each numeric cell shows a small muted label ("Sum" or "Avg") above the formatted value
- Non-numeric cells are empty
- Font slightly smaller than data rows (12px vs 13px)

### Aggregation Rules
- **Sum columns:** enrollment, campusCount, totalVotes2022, totalVotes2024, total enrollment/campus counts in States
- **Average columns:** all percentage fields (turnoutRate, povertyRate, pctAssociatesPlus, pct1824), medianIncome, Cook PVI (skip — not numeric in simple sense)
- Rule of thumb: counts and totals get Sum; rates and per-unit measures get Avg

### Data Source
- Aggregates computed from `filteredRows` (reflects current search + column filters)
- Recomputed via useMemo when filteredRows changes

### Applied to All Three Tables
- Campuses, Districts, States each get a `<tfoot>` with the same pattern
- Column-specific aggregation type defined in column `meta`: `meta.aggregate: 'sum' | 'avg'`
