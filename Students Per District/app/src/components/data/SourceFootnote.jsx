import { useState, useRef, useEffect, useCallback } from 'react'

const POP_WIDTH = 280

export default function SourceFootnote({ fieldKey, sources }) {
  const [open, setOpen] = useState(false)
  const [popStyle, setPopStyle] = useState({})
  const btnRef = useRef(null)
  const popRef = useRef(null)

  const positionPop = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    let left = rect.left + rect.width / 2 - POP_WIDTH / 2
    // Clamp to viewport
    if (left + POP_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POP_WIDTH - 8
    }
    if (left < 8) left = 8
    setPopStyle({ top: rect.bottom + 6, left })
  }, [])

  useEffect(() => {
    if (!open) return
    positionPop()
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, positionPop])

  if (!sources || !sources.fieldMap || !sources.sources) return null

  const sourceKey = sources.fieldMap[fieldKey]
  if (!sourceKey) return null

  const source = sources.sources[sourceKey]
  if (!source) return null

  return (
    <span className="source-footnote">
      <button
        ref={btnRef}
        className="source-footnote-btn"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        title="View data source"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.93 12.412H7.07V7.1h1.86v5.312zM8 6.004a1.07 1.07 0 1 1 0-2.14 1.07 1.07 0 0 1 0 2.14z"/>
        </svg>
      </button>
      {open && (
        <div
          ref={popRef}
          className="source-footnote-pop"
          style={popStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="source-footnote-name">{source.name}</div>
          <div className="source-footnote-detail">
            <span className="source-footnote-label">Provider:</span> {source.provider}
          </div>
          <div className="source-footnote-detail">
            <span className="source-footnote-label">Vintage:</span> {source.vintage}
          </div>
          {source.retrieved && (
            <div className="source-footnote-detail">
              <span className="source-footnote-label">Retrieved:</span> {source.retrieved}
            </div>
          )}
          {source.url && (
            <a
              className="source-footnote-link"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              View source &rarr;
            </a>
          )}
        </div>
      )}
    </span>
  )
}
