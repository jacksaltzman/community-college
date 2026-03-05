# Draggable Column Reordering

## Summary

Add drag-and-drop column reordering to all three data tables (States, Districts, Campuses) using @dnd-kit/core + @dnd-kit/sortable with TanStack Table's built-in columnOrder state.

## Behavior

- Drag any column header left/right to reorder
- Grab cursor on hover, grabbing while dragging
- Subtle drop position indicator
- Column order resets on refresh (no persistence)
- Expanded senator group: dragging group header moves all sub-columns; sub-columns reorderable within group
- Collapsed senator columns drag like any regular column
- Sort/filter clicks still work (dnd-kit distance threshold distinguishes drag from click)

## Architecture

- Install `@dnd-kit/core` and `@dnd-kit/sortable`
- Add `columnOrder` state + `onColumnOrderChange` to each table's `useReactTable`
- Wrap `<thead>` row in `<SortableContext>` with horizontal strategy
- Each `<th>` uses `useSortable` hook keyed by column ID
- `DndContext` wraps the table with `onDragEnd` handler to recompute order
- Shared `DraggableHeader.jsx` component used by all 3 tables

## Files

- Create: `Students Per District/app/src/components/data/DraggableHeader.jsx`
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx`
- Modify: `Students Per District/app/src/components/data/DistrictsTable.jsx`
- Modify: `Students Per District/app/src/components/data/CampusesTable.jsx`
- Modify: `Students Per District/app/src/styles/data.css`
- Modify: `Students Per District/app/package.json` (new deps)
