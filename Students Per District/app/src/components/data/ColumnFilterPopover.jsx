import { useState, useRef, useEffect } from 'react'

export default function ColumnFilterPopover({ column, isNumeric, alignRight }) {
  const [open, setOpen] = useState(false)
  const popRef = useRef(null)
  const filterValue = column.getFilterValue()
  const isActive = isNumeric
    ? filterValue && (filterValue[0] !== '' || filterValue[1] !== '')
    : !!filterValue

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleClear() {
    column.setFilterValue(undefined)
    setOpen(false)
  }

  return (
    <span style={{ position: 'relative' }} ref={popRef}>
      <button
        className={`col-filter-btn${isActive ? ' active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        title="Filter column"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.5A.5.5 0 0 1 .5 1h15a.5.5 0 0 1 .37.84L10 8.52V14.5a.5.5 0 0 1-.74.44l-3-1.5A.5.5 0 0 1 6 13V8.52L.13 1.84A.5.5 0 0 1 .5 1z"/></svg>
      </button>
      <div
        className={`col-filter-pop${open ? ' open' : ''}${alignRight ? ' pop-right' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {isNumeric ? (
          <div className="num-range">
            <input
              type="number"
              placeholder="Min"
              value={filterValue?.[0] ?? ''}
              onChange={(e) =>
                column.setFilterValue((old) => [e.target.value, old?.[1] ?? ''])
              }
            />
            <input
              type="number"
              placeholder="Max"
              value={filterValue?.[1] ?? ''}
              onChange={(e) =>
                column.setFilterValue((old) => [old?.[0] ?? '', e.target.value])
              }
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder="Filter..."
            value={filterValue ?? ''}
            onChange={(e) => column.setFilterValue(e.target.value || undefined)}
          />
        )}
        <button className="filter-clear-btn" onClick={handleClear}>
          Clear
        </button>
      </div>
    </span>
  )
}
