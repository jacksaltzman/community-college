# Design: Grouped Senator Columns in States Data Table

**Date:** 2026-03-05
**Scope:** Data tab > States table only

## Problem

The States data table currently crams all senator info into two composite columns ("Senator 1" and "Senator 2"), each rendering a long string like `Tommy Tuberville (R), +20.4% · 2026`. This makes individual fields unsortable, unfilterable, and hard to scan. The `senator1TaxCommittees` / `senator2TaxCommittees` fields exist in `states.json` but aren't displayed at all.

## Approach: Grouped Column Headers

Use TanStack Table's column grouping to create two parent header groups — "Senator 1" and "Senator 2" — each spanning 5 sub-columns.

### Table header structure

```
| State | ... | Cook PVI | Turnout |     Senator 1                                |     Senator 2                                | Adult Pop | ...
|       |     |          |         | Name | Party | Margin | Election | Tax Cmte   | Name | Party | Margin | Election | Tax Cmte   |           |
```

### Sub-columns per senator group

| Sub-column | Type    | Sortable | Filterable    | Default visible |
|------------|---------|----------|---------------|-----------------|
| Name       | text    | yes      | includesString | yes            |
| Party      | text    | yes      | includesString | yes            |
| Margin     | numeric | yes      | numericRange   | yes            |
| Election   | numeric | yes      | numericRange   | yes            |
| Tax Cmte   | numeric | yes      | numericRange   | yes            |

### Data source

- `senator1TaxCommittees` and `senator2TaxCommittees` already exist in `/data/states.json`
- Source: https://www.senate.gov/general/committee_assignments/assignments.htm
- Spreadsheet: iCloud > Accountable > gtm > State Models

### Changes required

1. **StatesTable.jsx** — Replace 2 composite senator columns with 2 column groups of 5 leaf columns each. Load `senator1TaxCommittees` and `senator2TaxCommittees` into row data.
2. **StatesTable.jsx** — Update CSV export to include Tax Committees columns.
3. **StatesTable.jsx** — Update global search fields.
4. **data.css** — Style grouped header row: subtle background differentiation and bottom border on group header cells.
5. **Methodology** — Update State methodology page to document Tax Committees data source.
