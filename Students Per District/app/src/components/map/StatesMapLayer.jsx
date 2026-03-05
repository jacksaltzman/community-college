import { useState, useCallback, useMemo, useEffect } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import DetailPanel from './DetailPanel'
import { DISTRICTS_TILESET_URL, DISTRICTS_SOURCE_LAYER } from '../../config'

const METRICS = [
  { key: 'pviNumeric', label: 'Cook PVI' },
  { key: 'campusCount', label: 'Campus Count' },
  { key: 'avgDistricts', label: 'Avg Districts Reached' },
  { key: 'midtermTurnout', label: '2022 Midterm Turnout' },
]

/* ── Color scales ── */
const PAPER = [253, 251, 249] // #FDFBF9
const TEAL = [76, 105, 113]  // #4C6971

/* Standard linear scale (paper → teal) */
function lerpColor(t) {
  const r = Math.round(PAPER[0] + (TEAL[0] - PAPER[0]) * t)
  const g = Math.round(PAPER[1] + (TEAL[1] - PAPER[1]) * t)
  const b = Math.round(PAPER[2] + (TEAL[2] - PAPER[2]) * t)
  return `rgb(${r},${g},${b})`
}

/* Diverging partisan scale: blue (D) ↔ white ↔ red (R) */
const BLUE = [37, 99, 175]   // #2563AF  Democrat
const RED  = [200, 45, 40]   // #C82D28  Republican
const WHITE = [250, 250, 250]

function pviColor(val, absMax) {
  if (absMax === 0) return `rgb(${WHITE.join(',')})`
  const t = Math.max(-1, Math.min(1, val / absMax)) // -1 (D) to +1 (R)
  const from = WHITE
  const to = t < 0 ? BLUE : RED
  const s = Math.abs(t)
  const r = Math.round(from[0] + (to[0] - from[0]) * s)
  const g = Math.round(from[1] + (to[1] - from[1]) * s)
  const b = Math.round(from[2] + (to[2] - from[2]) * s)
  return `rgb(${r},${g},${b})`
}

/* Parse PVI string → numeric: D+X → -X, R+X → +X, EVEN → 0 */
function parsePVI(s) {
  if (!s || s === 'EVEN') return 0
  const m = s.match(/^([DR])\+(\d+)$/)
  if (!m) return 0
  return m[1] === 'D' ? -Number(m[2]) : Number(m[2])
}

export default function StatesMapLayer({
  campusesData,
  districtsMeta,
  statesData,
  mapRef,
  navigate,
  params,
}) {
  const [selectedMetric, setSelectedMetric] = useState('pviNumeric')
  const [hoveredState, setHoveredState] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [detailData, setDetailData] = useState(null)

  /* ── Aggregate campus data by state ── */
  const stateMetrics = useMemo(() => {
    if (!campusesData) return {}
    const metrics = {}
    campusesData.features.forEach((f) => {
      const st = f.properties.state
      if (!st) return
      if (!metrics[st]) {
        metrics[st] = { enrollment: 0, campusCount: 0, totalDistricts: 0 }
      }
      metrics[st].enrollment += f.properties.enrollment || 0
      metrics[st].campusCount += 1
      metrics[st].totalDistricts += f.properties.districts_reached || 0
    })
    Object.keys(metrics).forEach((st) => {
      const m = metrics[st]
      m.avgDistricts =
        m.campusCount > 0
          ? parseFloat((m.totalDistricts / m.campusCount).toFixed(1))
          : 0
      // Merge in state-level data (Cook PVI, midterm turnout)
      const stInfo = statesData?.[st] || {}
      m.cookPVI = stInfo.cookPVI || ''
      m.pviNumeric = parsePVI(stInfo.cookPVI)
      m.midtermTurnout = stInfo.midtermTurnout2022 ?? null
    })
    return metrics
  }, [campusesData, statesData])

  /* ── Collect unique district-count per state from metadata ── */
  const stateDistrictCounts = useMemo(() => {
    if (!districtsMeta?.districts) return {}
    const counts = {}
    Object.values(districtsMeta.districts).forEach((d) => {
      const st = d.state
      if (!st) return
      counts[st] = (counts[st] || 0) + 1
    })
    return counts
  }, [districtsMeta])

  /* ── Compute min/max for the active metric ── */
  const { min, max } = useMemo(() => {
    const vals = Object.values(stateMetrics).map((m) => m[selectedMetric] || 0)
    if (vals.length === 0) return { min: 0, max: 1 }
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [stateMetrics, selectedMetric])

  /* ── Build state -> color mapping ── */
  const stateColorMap = useMemo(() => {
    const map = {}
    if (selectedMetric === 'pviNumeric') {
      // Diverging: use symmetric range so EVEN = white
      const absMax = Math.max(Math.abs(min), Math.abs(max)) || 1
      Object.entries(stateMetrics).forEach(([st, m]) => {
        map[st] = pviColor(m.pviNumeric || 0, absMax)
      })
    } else {
      const range = max - min || 1
      Object.entries(stateMetrics).forEach(([st, m]) => {
        const val = m[selectedMetric] || 0
        const t = (val - min) / range
        map[st] = lerpColor(t)
      })
    }
    return map
  }, [stateMetrics, selectedMetric, min, max])

  /* ── Build Mapbox fill-color expression ── */
  const fillColorExpr = useMemo(() => {
    const entries = Object.entries(stateColorMap)
    if (entries.length === 0) return '#FDFBF9'
    const expr = ['match', ['get', 'state']]
    entries.forEach(([st, color]) => {
      expr.push(st, color)
    })
    expr.push('#FDFBF9') // fallback
    return expr
  }, [stateColorMap])

  /* ── Hover filter: highlight all districts in the hovered state ── */
  const hoverFilter = useMemo(() => {
    if (!hoveredState) return ['==', ['get', 'state'], '']
    return ['==', ['get', 'state'], hoveredState]
  }, [hoveredState])

  /* ── Event handlers ── */
  const handleMouseMove = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['state-choropleth-fill'],
      })

      if (features && features.length > 0) {
        const st = features[0].properties.state
        map.getCanvas().style.cursor = 'pointer'

        if (st !== hoveredState) {
          setHoveredState(st)
        }

        const m = stateMetrics[st]
        const metricLabel = METRICS.find((x) => x.key === selectedMetric)?.label
        let metricVal = 'N/A'
        if (m) {
          if (selectedMetric === 'pviNumeric') {
            metricVal = m.cookPVI || 'EVEN'
          } else if (selectedMetric === 'avgDistricts') {
            metricVal = m.avgDistricts
          } else if (selectedMetric === 'midtermTurnout') {
            metricVal = m.midtermTurnout != null ? `${m.midtermTurnout.toFixed(1)}%` : 'N/A'
          } else {
            metricVal = Number(m[selectedMetric] || 0).toLocaleString()
          }
        }

        setTooltip({
          text: `${st} — ${metricLabel}: ${metricVal}`,
          x: e.originalEvent.clientX + 12,
          y: e.originalEvent.clientY - 12,
        })
      } else {
        if (hoveredState) {
          setHoveredState(null)
          setTooltip(null)
          map.getCanvas().style.cursor = ''
        }
      }
    },
    [mapRef, hoveredState, stateMetrics, selectedMetric]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredState(null)
    setTooltip(null)
  }, [])

  const handleClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['state-choropleth-fill'],
      })

      if (features && features.length > 0) {
        const st = features[0].properties.state

        // Use precomputed state bounds from metadata
        const bounds = districtsMeta?.stateBounds?.[st]
        if (bounds) {
          const [minLng, minLat, maxLng, maxLat] = bounds
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, duration: 1000 }
          )
        }

        const m = stateMetrics[st] || {}
        const stInfo = statesData?.[st] || {}
        const children = Object.entries(districtsMeta.districts || {})
          .filter(([, d]) => d.state === st)
          .map(([cd, d]) => ({
            id: cd,
            name: cd,
            meta: `${d.member || 'Vacant'} (${d.party || '?'}) · ${d.cook_pvi || 'N/A'}`,
            onClick: () => navigate('map', 'districts', { district: cd }),
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setDetailData({
          stateCode: st,
          enrollment: m.enrollment || 0,
          campusCount: m.campusCount || 0,
          districtCount: stateDistrictCounts[st] || 0,
          avgDistricts: m.avgDistricts || 0,
          cookPVI: m.cookPVI || '',
          midtermTurnout2022: m.midtermTurnout ?? null,
          senator1: stInfo.senator1 || '',
          senator1Party: stInfo.senator1Party || '',
          senator1NextElection: stInfo.senator1NextElection ?? null,
          senator1LastMargin: stInfo.senator1LastMargin ?? null,
          senator2: stInfo.senator2 || '',
          senator2Party: stInfo.senator2Party || '',
          senator2NextElection: stInfo.senator2NextElection ?? null,
          senator2LastMargin: stInfo.senator2LastMargin ?? null,
          adultPop18: stInfo.adultPop18 ?? null,
          totalFedTaxPaidB: stInfo.totalFedTaxPaidB ?? null,
          eitcClaimsThousands: stInfo.eitcClaimsThousands ?? null,
          eitcUnclaimedRate: stInfo.eitcUnclaimedRate ?? null,
          children,
        })
      }
    },
    [mapRef, districtsMeta, stateMetrics, stateDistrictCounts, statesData, navigate]
  )

  /* ── Register/unregister map events ── */
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    map.on('mousemove', handleMouseMove)
    map.on('mouseleave', handleMouseLeave)
    map.on('click', handleClick)

    return () => {
      try {
        map.off('mousemove', handleMouseMove)
        map.off('mouseleave', handleMouseLeave)
        map.off('click', handleClick)
        map.getCanvas().style.cursor = ''
      } catch (_) {}
    }
  }, [mapRef, handleMouseMove, handleMouseLeave, handleClick])

  /* ── Clear detail panel when URL param is removed ── */
  useEffect(() => {
    if (!params?.state) setDetailData(null)
  }, [params?.state])

  /* ── Auto-select state from URL params ── */
  useEffect(() => {
    const st = params?.state
    if (!st || !districtsMeta || !campusesData) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Use precomputed state bounds from metadata
    const bounds = districtsMeta.stateBounds?.[st]
    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 60, duration: 1000 }
      )
    }

    const m = stateMetrics[st] || {}
    const stInfo = statesData?.[st] || {}
    const children = Object.entries(districtsMeta.districts || {})
      .filter(([, d]) => d.state === st)
      .map(([cd, d]) => ({
        id: cd,
        name: cd,
        meta: `${d.member || 'Vacant'} (${d.party || '?'}) · ${d.cook_pvi || 'N/A'}`,
        onClick: () => navigate('map', 'districts', { district: cd }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setDetailData({
      stateCode: st,
      enrollment: m.enrollment || 0,
      campusCount: m.campusCount || 0,
      districtCount: stateDistrictCounts[st] || 0,
      avgDistricts: m.avgDistricts || 0,
      cookPVI: m.cookPVI || '',
      midtermTurnout2022: m.midtermTurnout ?? null,
      senator1: stInfo.senator1 || '',
      senator1Party: stInfo.senator1Party || '',
      senator1NextElection: stInfo.senator1NextElection ?? null,
      senator1LastMargin: stInfo.senator1LastMargin ?? null,
      senator2: stInfo.senator2 || '',
      senator2Party: stInfo.senator2Party || '',
      senator2NextElection: stInfo.senator2NextElection ?? null,
      senator2LastMargin: stInfo.senator2LastMargin ?? null,
      adultPop18: stInfo.adultPop18 ?? null,
      totalFedTaxPaidB: stInfo.totalFedTaxPaidB ?? null,
      eitcClaimsThousands: stInfo.eitcClaimsThousands ?? null,
      eitcUnclaimedRate: stInfo.eitcUnclaimedRate ?? null,
      children,
    })
  }, [params?.state, districtsMeta, campusesData, mapRef, stateMetrics, stateDistrictCounts, statesData, navigate])

  if (!campusesData || !districtsMeta) return null

  return (
    <>
      {/* ── Metric selector ── */}
      <div className="metric-selector">
        <label className="metric-selector-label">Color by</label>
        <select
          className="metric-selector-select"
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Choropleth layers on district vector tiles ── */}
      <Source id="states-choropleth" type="vector" url={DISTRICTS_TILESET_URL}>
        <Layer
          id="state-choropleth-fill"
          type="fill"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'fill-color': fillColorExpr,
            'fill-opacity': 0.7,
          }}
        />
        <Layer
          id="state-choropleth-border"
          type="line"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'line-color': '#9CA3AF',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              3, 0.3,
              10, 1,
            ],
            'line-opacity': 0.5,
          }}
        />
        <Layer
          id="state-hover"
          type="fill"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'fill-color': '#4C6971',
            'fill-opacity': 0.15,
          }}
          filter={hoverFilter}
        />
      </Source>

      {/* ── State borders from Mapbox vector tiles ── */}
      <Source
        id="state-boundaries-choropleth"
        type="vector"
        url="mapbox://mapbox.mapbox-streets-v8"
      >
        <Layer
          id="state-borders-choropleth"
          type="line"
          source-layer="admin"
          filter={[
            'all',
            ['==', ['get', 'admin_level'], 1],
            ['==', ['get', 'iso_3166_1'], 'US'],
          ]}
          paint={{
            'line-color': '#111111',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              3, 0.8,
              10, 1.8,
            ],
            'line-opacity': 0.85,
          }}
        />
      </Source>

      {/* ── Color legend ── */}
      <div className="choropleth-legend">
        <div className="choropleth-legend-title">
          {METRICS.find((m) => m.key === selectedMetric)?.label}
        </div>
        <div
          className="choropleth-legend-bar"
          style={selectedMetric === 'pviNumeric'
            ? { background: 'linear-gradient(to right, #2563AF, #FAFAFA, #C82D28)' }
            : undefined
          }
        />
        <div className="choropleth-legend-labels">
          {selectedMetric === 'pviNumeric' ? (
            <>
              <span>D+{Math.abs(min)}</span>
              <span>EVEN</span>
              <span>R+{Math.abs(max)}</span>
            </>
          ) : (
            <>
              <span>
                {selectedMetric === 'avgDistricts' ? min.toFixed(1)
                  : selectedMetric === 'midtermTurnout' ? `${min.toFixed(1)}%`
                  : Math.round(min).toLocaleString()}
              </span>
              <span>
                {selectedMetric === 'avgDistricts' ? max.toFixed(1)
                  : selectedMetric === 'midtermTurnout' ? `${max.toFixed(1)}%`
                  : Math.round(max).toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="choropleth-tooltip visible"
          style={{ left: tooltip.x + 'px', top: tooltip.y + 'px' }}
        >
          {tooltip.text}
        </div>
      )}

      {/* ── Detail panel ── */}
      {detailData && (
        <DetailPanel
          type="state"
          data={detailData}
          onClose={() => setDetailData(null)}
          navigate={navigate}
        />
      )}
    </>
  )
}
