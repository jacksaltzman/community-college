import { useEffect, useRef, useState } from 'react'
import { STATE_NAMES } from '../../utils/stateNames'

/**
 * DetailPanel — Shared slide-in panel for state or district details.
 *
 * Props:
 *   type       — 'state' | 'district'
 *   data       — { stateCode, enrollment, campusCount, districtCount, avgDistricts }
 *                 OR { cdCode, name, state, enrollment, campusCount }
 *   onClose    — callback to close the panel
 *   navigate   — hash-router navigate function
 */
export default function DetailPanel({ type, data, onClose, navigate }) {
  const panelRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)

  /* Animate open after mount */
  useEffect(() => {
    if (!data) {
      setIsOpen(false)
      return
    }
    // Delay adding the `open` class so the CSS transition fires
    const id = requestAnimationFrame(() => setIsOpen(true))
    return () => cancelAnimationFrame(id)
  }, [data])

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!data) return null

  const fmt = (n) =>
    n != null ? Number(n).toLocaleString() : 'N/A'

  const panelClass = `detail-panel${isOpen ? ' open' : ''}`

  /* ── State detail ── */
  if (type === 'state') {
    const fullName = STATE_NAMES[data.stateCode] || data.stateCode
    return (
      <div className={panelClass} ref={panelRef}>
        <div className="detail-panel-header">
          <div>
            <div className="detail-panel-title">{fullName}</div>
            <div className="detail-panel-subtitle">{data.stateCode}</div>
          </div>
          <button className="detail-panel-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="detail-panel-metrics">
          <div className="detail-metric-row">
            <span className="detail-metric-label">TOTAL ENROLLMENT</span>
            <span className="detail-metric-value">{fmt(data.enrollment)}</span>
          </div>
          <div className="detail-metric-row">
            <span className="detail-metric-label">CAMPUS COUNT</span>
            <span className="detail-metric-value">{fmt(data.campusCount)}</span>
          </div>
          <div className="detail-metric-row">
            <span className="detail-metric-label">DISTRICTS</span>
            <span className="detail-metric-value">{fmt(data.districtCount)}</span>
          </div>
          <div className="detail-metric-row">
            <span className="detail-metric-label">AVG DISTRICTS REACHED</span>
            <span className="detail-metric-value">{data.avgDistricts}</span>
          </div>
        </div>

        <button
          className="detail-panel-link"
          onClick={() => navigate('data', 'states', { state: data.stateCode })}
        >
          View in Data Table &rarr;
        </button>
      </div>
    )
  }

  /* ── District detail ── */
  if (type === 'district') {
    const stateFull = STATE_NAMES[data.state] || data.state
    return (
      <div className={panelClass} ref={panelRef}>
        <div className="detail-panel-header">
          <div>
            <div className="detail-panel-title">{data.cdCode}</div>
            {data.name && (
              <div className="detail-panel-subtitle">{data.name}</div>
            )}
            <div className="detail-panel-subtitle">{stateFull}</div>
          </div>
          <button className="detail-panel-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="detail-panel-metrics">
          <div className="detail-metric-row">
            <span className="detail-metric-label">ENROLLMENT</span>
            <span className="detail-metric-value">{fmt(data.enrollment)}</span>
          </div>
          <div className="detail-metric-row">
            <span className="detail-metric-label">CAMPUS COUNT</span>
            <span className="detail-metric-value">{fmt(data.campusCount)}</span>
          </div>
          {data.cookPVI && (
            <div className="detail-metric-row">
              <span className="detail-metric-label">COOK PVI</span>
              <span className="detail-metric-value">{data.cookPVI}</span>
            </div>
          )}
          {data.member && (
            <div className="detail-metric-row">
              <span className="detail-metric-label">REPRESENTATIVE</span>
              <span className="detail-metric-value">{data.member} ({data.party})</span>
            </div>
          )}
        </div>

        <button
          className="detail-panel-link"
          onClick={() => navigate('data', 'districts', { district: data.cdCode })}
        >
          View in Data Table &rarr;
        </button>
      </div>
    )
  }

  return null
}
