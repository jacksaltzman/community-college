# Collapsible Senator Column Groups

## Summary

Add expand/collapse toggles to the "Senator 1" and "Senator 2" group headers in the States data table. Collapsed state shows a single sortable/filterable name column per senator. Expanded state shows all 5 sub-columns (Name, Party, Margin, Election, Tax Cmte).

## Behavior

- Each group header gets a chevron icon (▸ collapsed, ▾ expanded)
- Clicking the group header toggles between collapsed and expanded
- Default state: **collapsed** (both groups start collapsed)
- Each group toggles independently
- Collapsed column is sortable by name and filterable via text search

## Implementation

- New React state `expandedGroups` (Set) tracks which group IDs are expanded; empty by default
- The `columns` useMemo dynamically builds each senator group based on expanded state:
  - Collapsed: single flat column with `accessorKey: 'senator1'`, header: 'Senator 1'
  - Expanded: existing 5-column group with group header + sub-columns
- Chevron rendered inside the group header `<th>` with a click handler toggling `expandedGroups`
- For collapsed groups, the header row naturally becomes a single-row header (no colSpan/group row needed)

## Visual

- Chevron sits right of group header text: "SENATOR 1 ▸"
- `cursor: pointer` on the group header
- No animation on column add/remove

## Edge Cases

- Column picker: collapsed shows "Senator 1" as single entry; expanded shows 5 sub-columns
- CSV export: always exports all fields regardless of collapsed/expanded state
- Mobile card view: always shows all fields (collapse only affects desktop table)

## Files to Modify

- `StatesTable.jsx` — state, dynamic columns, group header rendering
- `data.css` — cursor/chevron styles on group header
