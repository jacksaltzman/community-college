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
