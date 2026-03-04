import { useEffect, useRef } from 'react'

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AS: 'American Samoa', AZ: 'Arizona',
  AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  GU: 'Guam', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', MP: 'Northern Mariana Islands',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VI: 'U.S. Virgin Islands', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

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

  /* ── State detail ── */
  if (type === 'state') {
    const fullName = STATE_NAMES[data.stateCode] || data.stateCode
    return (
      <div className="detail-panel open" ref={panelRef}>
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
      <div className="detail-panel open" ref={panelRef}>
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
