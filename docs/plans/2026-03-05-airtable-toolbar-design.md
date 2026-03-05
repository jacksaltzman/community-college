# Airtable-Style Toolbar Design

## Summary

Replace the existing filter bar (search input, groupBy select, export button, column picker icon) with an Airtable-inspired horizontal toolbar of icon+label buttons, each opening its own dropdown panel.

## Toolbar Buttons

Left-aligned, in order:

1. **Hide fields** (eye-off icon) — column visibility checkboxes. Shows "(N)" count when columns are hidden.
2. **Filter** (funnel icon) — centralized filter panel. Lists active filters, add new filter by picking column + condition + value. Replaces per-column ColumnFilterPopover icons in headers.
3. **Group** (stack icon) — groupBy radio list. Only rendered for tables with groupByOptions (Campuses). Shows active group name.
4. **Sort** (arrows-up-down icon) — sort column picker with asc/desc toggle. Column header sorting still works. Shows "(N)" count.
5. **Share and sync** (share icon) — dropdown with "Export CSV" and "Copy link".

Right-aligned:

6. **Row count** — muted text showing "N entities" or "N of M entities"
7. **Search** (magnifying glass icon) — text input with placeholder

## Behavior

- Each button toggles its own dropdown panel on click
- Only one dropdown open at a time (opening one closes others)
- Active buttons (filters applied, columns hidden, sort active) show teal accent color + count badge
- Filter dropdown: "Add filter" button to add a new condition row. Each row: column select, condition (contains/between), value input, remove (x) button. Conditions: text = "contains", numeric = "between (min-max)"
- Sort dropdown: shows current sort. "Pick a field to sort by" column select + asc/desc radio. Clicking column headers in the table still changes sort.
- Group dropdown: radio list of options + "None". Only Campuses has group options.
- Share dropdown: two menu items — "Export CSV" (existing) and "Copy link" (copies window.location.href)

## Visual Style

- Buttons: transparent bg, 1px solid var(--border-light), border-radius 6px, padding 4px 10px, font-size 12px, font-family var(--font-body), color var(--gray-body)
- Hover: bg var(--hover-bg), border-color var(--border-main)
- Active: color var(--teal), border-color var(--teal), count in parentheses
- Dropdowns: white, border-radius 8px, box-shadow, positioned below button, max-width ~300px
- Overall bar: bg #F3F0EB, padding 10px 24px, flex row with gap 6px

## Component Architecture

- `TableControls.jsx` — toolbar layout shell
- `toolbar/HideFieldsDropdown.jsx` — column visibility checkboxes
- `toolbar/FilterDropdown.jsx` — centralized filter management
- `toolbar/SortDropdown.jsx` — sort column picker + asc/desc
- `toolbar/GroupDropdown.jsx` — groupBy radio list
- `toolbar/ShareDropdown.jsx` — export CSV + copy link
- `toolbar/ToolbarButton.jsx` — shared button with icon + label + active state

## Props Interface

TableControls gains two new props (sorting and columnFilters state passed down from each table):

```jsx
<TableControls
  globalFilter / onGlobalFilterChange  // existing
  groupBy / onGroupByChange / groupByOptions  // existing
  rowCount / totalCount / entityName  // existing
  onExport  // existing
  searchPlaceholder  // existing
  columns  // existing (for hide fields)
  sorting / onSortingChange  // NEW
  columnFilters / onColumnFiltersChange  // NEW
/>
```

## What Gets Removed

- ColumnFilterPopover icons from all three table <th> elements
- The <select> for groupBy
- The Export CSV button
- The column picker grid icon
- ColumnFilterPopover.jsx can be deleted entirely

## Files to Modify

- Rewrite: `TableControls.jsx`
- Create: `toolbar/ToolbarButton.jsx`, `toolbar/HideFieldsDropdown.jsx`, `toolbar/FilterDropdown.jsx`, `toolbar/SortDropdown.jsx`, `toolbar/GroupDropdown.jsx`, `toolbar/ShareDropdown.jsx`
- Modify: `StatesTable.jsx`, `DistrictsTable.jsx`, `CampusesTable.jsx` (pass new props, remove ColumnFilterPopover imports/usage)
- Modify: `data.css` (new toolbar styles, remove old filter bar styles)
- Delete: `ColumnFilterPopover.jsx` (functionality moved to FilterDropdown)
