# Airtable-Style Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing filter bar with an Airtable-inspired horizontal toolbar of icon+label buttons (Hide fields, Filter, Group, Sort, Share, Search), each opening its own dropdown panel.

**Architecture:** Create a shared ToolbarButton component for the icon+label+dropdown pattern. Build five dropdown sub-components (HideFields, Filter, Sort, Group, Share). Rewrite TableControls as the layout shell. Remove per-column ColumnFilterPopover from all table headers. Pass sorting/columnFilters state up to TableControls.

**Tech Stack:** React 18, @tanstack/react-table v8, CSS custom properties

---

### Task 1: Create shared ToolbarButton component

**Files:**
- Create: `Students Per District/app/src/components/data/toolbar/ToolbarButton.jsx`

**Step 1: Create the toolbar directory and ToolbarButton**

```jsx
import { useState, useRef, useEffect } from 'react'

export default function ToolbarButton({ icon, label, active, count, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const activeClass = active ? ' toolbar-btn-active' : ''

  return (
    <div className="toolbar-item" ref={ref}>
      <button
        className={`toolbar-btn${activeClass}`}
        onClick={() => setOpen(o => !o)}
      >
        {icon}
        <span className="toolbar-btn-label">{label}</span>
        {count > 0 && <span className="toolbar-btn-count">{count}</span>}
      </button>
      {open && (
        <div className="toolbar-dropdown">
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds (component not imported yet).

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/toolbar/ToolbarButton.jsx"
git commit -m "feat: create shared ToolbarButton component for Airtable toolbar"
```

---

### Task 2: Create HideFieldsDropdown component

**Files:**
- Create: `Students Per District/app/src/components/data/toolbar/HideFieldsDropdown.jsx`

**Step 1: Create HideFieldsDropdown**

This replaces the existing column picker. It receives the `columns` array from `table.getAllLeafColumns()` and renders checkboxes.

```jsx
import ToolbarButton from './ToolbarButton'

export default function HideFieldsDropdown({ columns }) {
  const hiddenCount = columns.filter(c => !c.getIsVisible()).length

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
      label="Hide fields"
      active={hiddenCount > 0}
      count={hiddenCount}
    >
      <div className="toolbar-dropdown-list">
        {columns.map(column => (
          <label key={column.id} className="toolbar-dropdown-item">
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            <span>{typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}</span>
          </label>
        ))}
      </div>
    </ToolbarButton>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/toolbar/HideFieldsDropdown.jsx"
git commit -m "feat: create HideFieldsDropdown for column visibility"
```

---

### Task 3: Create FilterDropdown component

**Files:**
- Create: `Students Per District/app/src/components/data/toolbar/FilterDropdown.jsx`

**Step 1: Create FilterDropdown**

This replaces the per-column ColumnFilterPopover. It shows all active column filters and lets users add new ones. It receives `columns` (from `table.getAllLeafColumns()`), `columnFilters`, and `onColumnFiltersChange`.

```jsx
import { useState } from 'react'
import ToolbarButton from './ToolbarButton'

export default function FilterDropdown({ columns, columnFilters, onColumnFiltersChange }) {
  const [addingFilter, setAddingFilter] = useState(false)
  const activeCount = columnFilters.filter(f => {
    if (Array.isArray(f.value)) return f.value[0] !== '' || f.value[1] !== ''
    return !!f.value
  }).length

  function removeFilter(columnId) {
    onColumnFiltersChange(prev => prev.filter(f => f.id !== columnId))
  }

  function updateFilter(columnId, value) {
    onColumnFiltersChange(prev => {
      const exists = prev.find(f => f.id === columnId)
      if (exists) {
        return prev.map(f => f.id === columnId ? { ...f, value } : f)
      }
      return [...prev, { id: columnId, value }]
    })
  }

  function addFilter(columnId) {
    const col = columns.find(c => c.id === columnId)
    const isNumeric = col?.columnDef?.meta?.isNumeric
    const defaultValue = isNumeric ? ['', ''] : ''
    onColumnFiltersChange(prev => [...prev, { id: columnId, value: defaultValue }])
    setAddingFilter(false)
  }

  // Columns not yet filtered
  const availableColumns = columns.filter(c => !columnFilters.find(f => f.id === c.id))

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.5A.5.5 0 0 1 .5 1h15a.5.5 0 0 1 .37.84L10 8.52V14.5a.5.5 0 0 1-.74.44l-3-1.5A.5.5 0 0 1 6 13V8.52L.13 1.84A.5.5 0 0 1 .5 1z"/></svg>}
      label="Filter"
      active={activeCount > 0}
      count={activeCount}
    >
      <div className="toolbar-dropdown-filters">
        {columnFilters.length === 0 && !addingFilter && (
          <div className="toolbar-dropdown-empty">No filters applied</div>
        )}

        {columnFilters.map(filter => {
          const col = columns.find(c => c.id === filter.id)
          if (!col) return null
          const isNumeric = col.columnDef?.meta?.isNumeric
          const headerText = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id

          return (
            <div key={filter.id} className="toolbar-filter-row">
              <span className="toolbar-filter-col">{headerText}</span>
              {isNumeric ? (
                <div className="toolbar-filter-inputs">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filter.value?.[0] ?? ''}
                    onChange={e => updateFilter(filter.id, [e.target.value, filter.value?.[1] ?? ''])}
                  />
                  <span className="toolbar-filter-sep">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filter.value?.[1] ?? ''}
                    onChange={e => updateFilter(filter.id, [filter.value?.[0] ?? '', e.target.value])}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Contains..."
                  value={filter.value ?? ''}
                  onChange={e => updateFilter(filter.id, e.target.value || undefined)}
                />
              )}
              <button className="toolbar-filter-remove" onClick={() => removeFilter(filter.id)} title="Remove filter">&times;</button>
            </div>
          )
        })}

        {addingFilter ? (
          <div className="toolbar-filter-add-row">
            <select
              autoFocus
              defaultValue=""
              onChange={e => { if (e.target.value) addFilter(e.target.value) }}
            >
              <option value="" disabled>Pick a field...</option>
              {availableColumns.map(c => (
                <option key={c.id} value={c.id}>
                  {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                </option>
              ))}
            </select>
            <button className="toolbar-filter-cancel" onClick={() => setAddingFilter(false)}>Cancel</button>
          </div>
        ) : (
          <button className="toolbar-filter-add" onClick={() => setAddingFilter(true)}>
            + Add filter
          </button>
        )}
      </div>
    </ToolbarButton>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/toolbar/FilterDropdown.jsx"
git commit -m "feat: create FilterDropdown for centralized column filtering"
```

---

### Task 4: Create SortDropdown component

**Files:**
- Create: `Students Per District/app/src/components/data/toolbar/SortDropdown.jsx`

**Step 1: Create SortDropdown**

Shows the current sort state and lets users pick a column + direction. Receives `columns`, `sorting`, `onSortingChange`.

```jsx
import ToolbarButton from './ToolbarButton'

export default function SortDropdown({ columns, sorting, onSortingChange }) {
  const activeCount = sorting.length

  function setSort(columnId, desc) {
    onSortingChange([{ id: columnId, desc }])
  }

  function removeSort(columnId) {
    onSortingChange(prev => prev.filter(s => s.id !== columnId))
  }

  function clearAll() {
    onSortingChange([])
  }

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/></svg>}
      label="Sort"
      active={activeCount > 0}
      count={activeCount}
    >
      <div className="toolbar-dropdown-sort">
        {sorting.length === 0 && (
          <div className="toolbar-dropdown-empty">No sorts applied</div>
        )}

        {sorting.map(sort => {
          const col = columns.find(c => c.id === sort.id)
          if (!col) return null
          const headerText = typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
          return (
            <div key={sort.id} className="toolbar-sort-row">
              <span className="toolbar-sort-col">{headerText}</span>
              <div className="toolbar-sort-dir">
                <button
                  className={`toolbar-sort-dir-btn${!sort.desc ? ' active' : ''}`}
                  onClick={() => setSort(sort.id, false)}
                >
                  A→Z
                </button>
                <button
                  className={`toolbar-sort-dir-btn${sort.desc ? ' active' : ''}`}
                  onClick={() => setSort(sort.id, true)}
                >
                  Z→A
                </button>
              </div>
              <button className="toolbar-filter-remove" onClick={() => removeSort(sort.id)} title="Remove sort">&times;</button>
            </div>
          )
        })}

        <div className="toolbar-sort-add">
          <select
            value=""
            onChange={e => { if (e.target.value) setSort(e.target.value, true) }}
          >
            <option value="" disabled>Pick a field to sort by...</option>
            {columns.map(c => (
              <option key={c.id} value={c.id}>
                {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
              </option>
            ))}
          </select>
        </div>

        {sorting.length > 0 && (
          <button className="toolbar-sort-clear" onClick={clearAll}>Clear sort</button>
        )}
      </div>
    </ToolbarButton>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/toolbar/SortDropdown.jsx"
git commit -m "feat: create SortDropdown for sort column picker"
```

---

### Task 5: Create GroupDropdown component

**Files:**
- Create: `Students Per District/app/src/components/data/toolbar/GroupDropdown.jsx`

**Step 1: Create GroupDropdown**

Replaces the `<select>` for groupBy. Only rendered when `groupByOptions.length > 0`.

```jsx
import ToolbarButton from './ToolbarButton'

export default function GroupDropdown({ groupBy, onGroupByChange, groupByOptions }) {
  if (!groupByOptions || groupByOptions.length === 0) return null

  const activeLabel = groupByOptions.find(o => o.value === groupBy)?.label

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
      label={activeLabel ? `Group: ${activeLabel}` : 'Group'}
      active={!!groupBy}
    >
      {({ close }) => (
        <div className="toolbar-dropdown-list">
          <label className="toolbar-dropdown-item">
            <input
              type="radio"
              name="groupBy"
              checked={!groupBy}
              onChange={() => { onGroupByChange(''); close() }}
            />
            <span>None</span>
          </label>
          {groupByOptions.map(({ value, label }) => (
            <label key={value} className="toolbar-dropdown-item">
              <input
                type="radio"
                name="groupBy"
                checked={groupBy === value}
                onChange={() => { onGroupByChange(value); close() }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </ToolbarButton>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/toolbar/GroupDropdown.jsx"
git commit -m "feat: create GroupDropdown for row grouping"
```

---

### Task 6: Create ShareDropdown component

**Files:**
- Create: `Students Per District/app/src/components/data/toolbar/ShareDropdown.jsx`

**Step 1: Create ShareDropdown**

Has two options: Export CSV (existing behavior) and Copy link.

```jsx
import ToolbarButton from './ToolbarButton'

export default function ShareDropdown({ onExport }) {
  function copyLink(close) {
    navigator.clipboard.writeText(window.location.href)
    close()
  }

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>}
      label="Share"
    >
      {({ close }) => (
        <div className="toolbar-dropdown-menu">
          <button className="toolbar-menu-item" onClick={() => { onExport(); close() }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button className="toolbar-menu-item" onClick={() => copyLink(close)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Copy link
          </button>
        </div>
      )}
    </ToolbarButton>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/toolbar/ShareDropdown.jsx"
git commit -m "feat: create ShareDropdown with export CSV and copy link"
```

---

### Task 7: Rewrite TableControls as Airtable-style toolbar

**Files:**
- Modify: `Students Per District/app/src/components/data/TableControls.jsx`

**Step 1: Rewrite TableControls**

Replace the entire file with the new toolbar layout that composes the dropdown sub-components.

```jsx
import { useState } from 'react'
import HideFieldsDropdown from './toolbar/HideFieldsDropdown'
import FilterDropdown from './toolbar/FilterDropdown'
import SortDropdown from './toolbar/SortDropdown'
import GroupDropdown from './toolbar/GroupDropdown'
import ShareDropdown from './toolbar/ShareDropdown'

export default function TableControls({
  globalFilter,
  onGlobalFilterChange,
  groupBy,
  onGroupByChange,
  groupByOptions,
  rowCount,
  totalCount,
  onExport,
  searchPlaceholder = 'Search...',
  entityName = 'campuses',
  columns,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
}) {
  return (
    <div className="data-toolbar">
      <div className="data-toolbar-left">
        <HideFieldsDropdown columns={columns} />

        <FilterDropdown
          columns={columns}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
        />

        <GroupDropdown
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          groupByOptions={groupByOptions}
        />

        <SortDropdown
          columns={columns}
          sorting={sorting}
          onSortingChange={onSortingChange}
        />

        <ShareDropdown onExport={onExport} />
      </div>

      <div className="data-toolbar-right">
        <span className="data-row-count">
          {rowCount === totalCount
            ? `${totalCount.toLocaleString()} ${entityName}`
            : `${rowCount.toLocaleString()} of ${totalCount.toLocaleString()} ${entityName}`}
        </span>

        <div className="toolbar-search">
          <svg className="toolbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="toolbar-search-input"
            type="text"
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: May fail because table components don't pass the new props yet. That's fine — we'll fix in the next task.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/components/data/TableControls.jsx"
git commit -m "feat: rewrite TableControls as Airtable-style toolbar"
```

---

### Task 8: Add toolbar CSS styles

**Files:**
- Modify: `Students Per District/app/src/styles/data.css`

**Step 1: Replace old filter bar styles with toolbar styles**

Replace the entire `/* ── Filter Bar ── */` section (`.data-filter-bar` through `.data-export-btn:hover`) with:

```css
/* ── Airtable-Style Toolbar ── */
.data-toolbar {
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: #F3F0EB;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.data-toolbar-left {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.data-toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-left: auto;
}

/* ── Toolbar Button ── */
.toolbar-item {
  position: relative;
}
.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 5px 10px;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--gray-body);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.toolbar-btn:hover {
  background: var(--hover-bg);
  border-color: var(--border-main);
}
.toolbar-btn-active {
  color: var(--teal);
  border-color: var(--teal);
}
.toolbar-btn-label {
  line-height: 1;
}
.toolbar-btn-count {
  font-size: 10px;
  background: var(--teal);
  color: white;
  border-radius: 8px;
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
  line-height: 14px;
}

/* ── Toolbar Dropdown ── */
.toolbar-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  max-width: 380px;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06);
  z-index: 100;
  padding: 8px 0;
}

/* ── Dropdown list (Hide fields, Group) ── */
.toolbar-dropdown-list {
  display: flex;
  flex-direction: column;
}
.toolbar-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--gray-body);
  cursor: pointer;
  transition: background 0.1s;
}
.toolbar-dropdown-item:hover {
  background: var(--hover-bg);
}
.toolbar-dropdown-item input[type="checkbox"],
.toolbar-dropdown-item input[type="radio"] {
  accent-color: var(--teal);
  width: 14px;
  height: 14px;
  cursor: pointer;
}
.toolbar-dropdown-empty {
  padding: 12px 14px;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--gray-muted);
}

/* ── Filter dropdown ── */
.toolbar-dropdown-filters {
  padding: 4px 0;
}
.toolbar-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
}
.toolbar-filter-col {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-body);
  min-width: 80px;
  white-space: nowrap;
}
.toolbar-filter-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
}
.toolbar-filter-sep {
  color: var(--gray-muted);
  font-size: 12px;
}
.toolbar-filter-row input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--border-main);
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 12px;
  outline: none;
}
.toolbar-filter-row input:focus {
  border-color: var(--teal);
}
.toolbar-filter-remove {
  background: none;
  border: none;
  color: var(--gray-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.toolbar-filter-remove:hover {
  color: var(--coral);
}
.toolbar-filter-add {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 14px;
  background: none;
  border: none;
  border-top: 1px solid var(--border-light);
  margin-top: 4px;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--teal);
  cursor: pointer;
}
.toolbar-filter-add:hover {
  background: var(--hover-bg);
}
.toolbar-filter-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
}
.toolbar-filter-add-row select {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-main);
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 12px;
}
.toolbar-filter-cancel {
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--gray-muted);
  cursor: pointer;
}

/* ── Sort dropdown ── */
.toolbar-dropdown-sort {
  padding: 4px 0;
}
.toolbar-sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
}
.toolbar-sort-col {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-body);
  min-width: 80px;
}
.toolbar-sort-dir {
  display: flex;
  border: 1px solid var(--border-main);
  border-radius: 4px;
  overflow: hidden;
}
.toolbar-sort-dir-btn {
  padding: 3px 8px;
  background: white;
  border: none;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--gray-muted);
  cursor: pointer;
}
.toolbar-sort-dir-btn:first-child {
  border-right: 1px solid var(--border-main);
}
.toolbar-sort-dir-btn.active {
  background: var(--teal);
  color: white;
}
.toolbar-sort-add {
  padding: 6px 14px;
  border-top: 1px solid var(--border-light);
  margin-top: 4px;
}
.toolbar-sort-add select {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--border-main);
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 12px;
}
.toolbar-sort-clear {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 14px;
  background: none;
  border: none;
  border-top: 1px solid var(--border-light);
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--coral);
  cursor: pointer;
}
.toolbar-sort-clear:hover {
  background: var(--hover-bg);
}

/* ── Share dropdown (menu style) ── */
.toolbar-dropdown-menu {
  display: flex;
  flex-direction: column;
}
.toolbar-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 14px;
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--gray-body);
  cursor: pointer;
}
.toolbar-menu-item:hover {
  background: var(--hover-bg);
}

/* ── Search ── */
.toolbar-search {
  position: relative;
  width: 200px;
}
.toolbar-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-muted);
  pointer-events: none;
}
.toolbar-search-input {
  width: 100%;
  padding: 6px 10px 6px 28px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: 12px;
  background: white;
  color: var(--black);
  outline: none;
}
.toolbar-search-input::placeholder {
  color: var(--gray-lighter);
}
.toolbar-search-input:focus {
  border-color: var(--teal);
}
```

Also remove the old `.col-picker`, `.col-picker-btn`, `.col-picker-dropdown`, `.col-picker-item` styles entirely (lines ~497-549 in the current file).

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/styles/data.css"
git commit -m "feat: add Airtable-style toolbar CSS and remove old filter bar styles"
```

---

### Task 9: Update StatesTable to pass new props and remove ColumnFilterPopover

**Files:**
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx`

**Step 1: Remove ColumnFilterPopover import**

Delete the line:
```jsx
import ColumnFilterPopover from './ColumnFilterPopover'
```

**Step 2: Pass sorting and columnFilters to TableControls**

In the `<TableControls>` JSX, add these props:

```jsx
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
```

**Step 3: Remove all ColumnFilterPopover usage from thead**

Find and remove every `<ColumnFilterPopover ... />` JSX element in the thead rendering. There are 4 instances (around lines 599, 619, 672, 699). Remove each one entirely (the `<ColumnFilterPopover` open tag through `/>` close).

**Step 4: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/components/data/StatesTable.jsx"
git commit -m "feat: wire StatesTable to Airtable toolbar, remove per-column filters"
```

---

### Task 10: Update DistrictsTable to pass new props and remove ColumnFilterPopover

**Files:**
- Modify: `Students Per District/app/src/components/data/DistrictsTable.jsx`

**Step 1: Remove ColumnFilterPopover import**

Delete:
```jsx
import ColumnFilterPopover from './ColumnFilterPopover'
```

**Step 2: Pass new props to TableControls**

Add `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange` props:

```jsx
<TableControls
  globalFilter={globalFilter}
  onGlobalFilterChange={setGlobalFilter}
  groupBy=""
  onGroupByChange={() => {}}
  groupByOptions={[]}
  rowCount={filteredRows.length}
  totalCount={data.length}
  onExport={handleExport}
  searchPlaceholder="Search by district or state..."
  entityName="districts"
  columns={table.getAllLeafColumns()}
  sorting={sorting}
  onSortingChange={setSorting}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
/>
```

**Step 3: Remove ColumnFilterPopover from thead**

Remove the `<ColumnFilterPopover ... />` element from the header map. Also remove the `{fieldKey && <SourceFootnote ... />}` — wait, keep the SourceFootnote. Only remove ColumnFilterPopover.

**Step 4: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/components/data/DistrictsTable.jsx"
git commit -m "feat: wire DistrictsTable to Airtable toolbar, remove per-column filters"
```

---

### Task 11: Update CampusesTable to pass new props and remove ColumnFilterPopover

**Files:**
- Modify: `Students Per District/app/src/components/data/CampusesTable.jsx`

**Step 1: Remove ColumnFilterPopover import**

Delete:
```jsx
import ColumnFilterPopover from './ColumnFilterPopover'
```

**Step 2: Pass new props to TableControls**

```jsx
<TableControls
  globalFilter={globalFilter}
  onGlobalFilterChange={setGlobalFilter}
  groupBy={groupBy}
  onGroupByChange={setGroupBy}
  groupByOptions={GROUP_BY_OPTIONS}
  rowCount={filteredRows.length}
  totalCount={data.length}
  onExport={handleExport}
  searchPlaceholder="Search campuses..."
  columns={table.getAllLeafColumns()}
  sorting={sorting}
  onSortingChange={setSorting}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
/>
```

**Step 3: Remove ColumnFilterPopover from thead**

Remove the `<ColumnFilterPopover ... />` element from the header map.

**Step 4: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/components/data/CampusesTable.jsx"
git commit -m "feat: wire CampusesTable to Airtable toolbar, remove per-column filters"
```

---

### Task 12: Delete ColumnFilterPopover.jsx

**Files:**
- Delete: `Students Per District/app/src/components/data/ColumnFilterPopover.jsx`

**Step 1: Verify no remaining imports**

Run: `grep -r "ColumnFilterPopover" "Students Per District/app/src/"`
Expected: No matches.

**Step 2: Delete the file**

```bash
git rm "Students Per District/app/src/components/data/ColumnFilterPopover.jsx"
```

**Step 3: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git commit -m "chore: remove ColumnFilterPopover (replaced by toolbar FilterDropdown)"
```

---

### Task 13: Clean up old CSS for col-filter-pop and col-filter-btn

**Files:**
- Modify: `Students Per District/app/src/styles/data.css`

**Step 1: Remove old column filter popover CSS**

Find and remove all `.col-filter-btn`, `.col-filter-pop`, `.num-range`, `.filter-clear-btn` styles from data.css. These were used by the now-deleted ColumnFilterPopover.

**Step 2: Build and verify**

Run: `cd "Students Per District/app" && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/styles/data.css"
git commit -m "chore: remove old column filter popover CSS"
```

---

### Task 14: Visual verification

**Step 1: Start preview, navigate to Data > States (desktop 1600x900)**

Verify:
- Toolbar shows: Hide fields, Filter, Group (hidden — no options for States), Sort, Share buttons
- Search input on the right with magnifying glass icon
- Row count shows "55 states"
- Hide fields opens dropdown with column checkboxes
- Filter opens dropdown with "No filters applied" + "Add filter" button
- Sort opens dropdown showing current sort (Enrollment, Z→A) + picker
- Share opens dropdown with "Export CSV" and "Copy link"
- Clicking column headers still sorts
- Adding a filter via toolbar works (filters the data)

**Step 2: Navigate to Data > Districts**

Verify same toolbar behavior. Group button should be hidden (no groupByOptions).

**Step 3: Navigate to Data > Campuses**

Verify toolbar. Group button should be visible with options (State, Campus Type, City, Primary District). Select a group — table groups correctly.

**Step 4: Test mobile (375x812)**

Verify toolbar wraps gracefully on small screens.
