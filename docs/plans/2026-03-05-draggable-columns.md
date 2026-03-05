# Draggable Column Reordering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drag-and-drop column reordering to all three data tables using @dnd-kit and TanStack Table's columnOrder state.

**Architecture:** Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities. Create a shared DraggableHeader component using useSortable. Each table adds columnOrder state and wraps its thead in DndContext + SortableContext. The onDragEnd handler uses arrayMove to recompute column order.

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @tanstack/react-table v8

---

### Task 1: Install dnd-kit dependencies

**Files:**
- Modify: `Students Per District/app/package.json`

**Step 1: Install packages**

Run: `cd "Students Per District/app" && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Step 2: Verify installation**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/package.json" "Students Per District/app/package-lock.json"
git commit -m "deps: add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities"
```

---

### Task 2: Create shared DraggableHeader component

**Files:**
- Create: `Students Per District/app/src/components/data/DraggableHeader.jsx`
- Modify: `Students Per District/app/src/styles/data.css`

**Step 1: Create DraggableHeader.jsx**

This is a wrapper component that makes any `<th>` draggable. It uses `useSortable` from dnd-kit and applies CSS transforms during drag.

```jsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function DraggableHeader({ header, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    cursor: 'grab',
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      colSpan={header.colSpan}
    >
      {children}
    </th>
  )
}
```

**Note:** This is a starting point. The component will need refinements in Task 3 when integrating into StatesTable, since StatesTable has complex header rendering (grouped headers, placeholders, rowSpan). The DraggableHeader wraps the content but each table will pass appropriate props (className, onClick, etc.) from outside.

**Step 2: Add drag CSS to data.css**

After the existing expandable group header styles, add:

```css
/* ── Draggable Column Headers ── */
.data-table th[style*="cursor: grab"] {
  touch-action: none;
}
.data-table th.dragging {
  opacity: 0.5;
  z-index: 1;
}
```

**Step 3: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds (DraggableHeader not yet imported anywhere).

**Step 4: Commit**

```bash
git add "Students Per District/app/src/components/data/DraggableHeader.jsx" "Students Per District/app/src/styles/data.css"
git commit -m "feat: create shared DraggableHeader component for column DnD"
```

---

### Task 3: Integrate column DnD into StatesTable

This is the most complex table due to grouped senator columns, collapsed/expanded states, placeholders, and rowSpan headers.

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx`

**Step 1: Add imports**

At the top of StatesTable.jsx, add:

```jsx
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
```

**Step 2: Add columnOrder state**

After the existing state declarations, add:

```jsx
const [columnOrder, setColumnOrder] = useState([])
```

**Step 3: Initialize columnOrder when columns change**

After the `columns` useMemo, add an effect that sets the initial column order from the current column IDs whenever columns change (e.g. when senator groups expand/collapse):

```jsx
useEffect(() => {
  setColumnOrder(columns.flatMap(c => c.columns ? c.columns.map(sc => sc.id) : [c.id]))
}, [columns])
```

**Step 4: Add columnOrder to useReactTable state**

In the `useReactTable` config, add `columnOrder` to the `state` object and `onColumnOrderChange: setColumnOrder`:

```jsx
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
  // ... rest unchanged
})
```

**Step 5: Add DnD sensors and handler**

After the table instance, add:

```jsx
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
```

**Step 6: Wrap the table in DndContext and SortableContext**

Wrap the existing `<div className="data-table-wrap">` content:

```jsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <table className="data-table">
    <thead>
      <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
        {/* ... existing header rendering ... */}
      </SortableContext>
    </thead>
    {/* ... existing tbody ... */}
  </table>
</DndContext>
```

**Step 7: Wrap leaf header `<th>` elements with DraggableHeader**

In the thead rendering, for the **leaf header** branch (the regular sortable/filterable headers), wrap the `<th>` using DraggableHeader. Replace the leaf header return with:

```jsx
return (
  <DraggableHeader key={header.id} header={header}>
    <span className="th-content" onClick={header.column.getToggleSortingHandler()}>
      {flexRender(header.column.columnDef.header, header.getContext())}
      {sortIcon(header.column)}
      <ColumnFilterPopover ... />
    </span>
  </DraggableHeader>
)
```

**Important:** Move the `onClick` for sorting from the `<th>` to the inner `<span className="th-content">`, so that dnd-kit handles drag on the `<th>` while clicks on the content still trigger sort. The DraggableHeader's distance activation constraint (5px) ensures clicks pass through.

Apply the same pattern to:
- The collapsed senator header branch (collapsedGroupId check)
- The placeholder-with-rowSpan headers (these should NOT be draggable since they already have rowSpan — skip DraggableHeader for those)
- Group headers (col-group-th) should NOT be draggable individually

**Step 8: Update DraggableHeader to accept className and extra props**

Update `DraggableHeader.jsx` to forward className and other props:

```jsx
export default function DraggableHeader({ header, children, className = '', style: extraStyle = {}, ...rest }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    cursor: 'grab',
    ...extraStyle,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
      {...rest}
      colSpan={header.colSpan}
    >
      {children}
    </th>
  )
}
```

**Step 9: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 10: Commit**

```bash
git add "Students Per District/app/src/components/data/StatesTable.jsx" "Students Per District/app/src/components/data/DraggableHeader.jsx"
git commit -m "feat: add column drag-and-drop reordering to StatesTable"
```

---

### Task 4: Integrate column DnD into DistrictsTable

**Files:**
- Modify: `Students Per District/app/src/components/data/DistrictsTable.jsx`

Follow the same pattern as StatesTable but simpler (no grouped headers):

**Step 1: Add imports** (same dnd-kit imports + DraggableHeader)

**Step 2: Add columnOrder state**

```jsx
const [columnOrder, setColumnOrder] = useState([])
```

**Step 3: Initialize columnOrder from columns**

```jsx
useEffect(() => {
  setColumnOrder(columns.map(c => c.id))
}, [columns])
```

**Step 4: Add columnOrder to useReactTable state + onColumnOrderChange**

**Step 5: Add sensors and handleDragEnd** (identical to StatesTable)

**Step 6: Wrap table in DndContext, thead row in SortableContext**

**Step 7: Wrap each leaf `<th>` with DraggableHeader**

Move `onClick` for sorting from `<th>` to inner `<span className="th-content">`.

**Step 8: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 9: Commit**

```bash
git add "Students Per District/app/src/components/data/DistrictsTable.jsx"
git commit -m "feat: add column drag-and-drop reordering to DistrictsTable"
```

---

### Task 5: Integrate column DnD into CampusesTable

**Files:**
- Modify: `Students Per District/app/src/components/data/CampusesTable.jsx`

Identical pattern to DistrictsTable (no grouped headers).

**Step 1-7:** Same as DistrictsTable Task 4 steps.

**Step 8: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 9: Commit**

```bash
git add "Students Per District/app/src/components/data/CampusesTable.jsx"
git commit -m "feat: add column drag-and-drop reordering to CampusesTable"
```

---

### Task 6: Visual verification

**Step 1: Start preview, navigate to Data > States (desktop 1600x900)**

Verify:
- Column headers show grab cursor on hover
- Dragging a column header horizontally reorders it
- Sorting still works (click on header text)
- Filter popovers still work
- Collapsed senator columns can be dragged
- Expanded senator sub-columns can be reordered within the group

**Step 2: Navigate to Data > Districts**

Verify same drag behavior.

**Step 3: Navigate to Data > Campuses**

Verify same drag behavior.

**Step 4: Test mobile (375x812)**

Verify card view is unaffected (no drag behavior needed in card view).
