import { useState, useCallback, useMemo, useEffect } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import DetailPanel from './DetailPanel'

const METRICS = [
  { key: 'enrollment', label: 'Total Enrollment' },
  { key: 'campusCount', label: 'Campus Count' },
  { key: 'avgDistricts', label: 'Avg Districts Reached' },
]

/* Color-scale endpoints */
const PAPER = [253, 251, 249] // #FDFBF9
const TEAL = [76, 105, 113]  // #4C6971

function lerpColor(t) {
  const r = Math.round(PAPER[0] + (TEAL[0] - PAPER[0]) * t)
  const g = Math.round(PAPER[1] + (TEAL[1] - PAPER[1]) * t)
  const b = Math.round(PAPER[2] + (TEAL[2] - PAPER[2]) * t)
  return `rgb(${r},${g},${b})`
}

export default function StatesMapLayer({
  campusesData,
  districtsData,
  mapRef,
  navigate,
  params,
}) {
  const [selectedMetric, setSelectedMetric] = useState('enrollment')
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
    })
    return metrics
  }, [campusesData])

  /* ── Collect unique district-count per state for the "districtCount" metric ── */
  const stateDistrictCounts = useMemo(() => {
    if (!districtsData) return {}
    const counts = {}
    districtsData.features.forEach((f) => {
      const st = f.properties.state
      if (!st) return
      counts[st] = (counts[st] || 0) + 1
    })
    return counts
  }, [districtsData])

  /* ── Compute min/max for the active metric ── */
  const { min, max } = useMemo(() => {
    const vals = Object.values(stateMetrics).map((m) => m[selectedMetric] || 0)
    if (vals.length === 0) return { min: 0, max: 1 }
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [stateMetrics, selectedMetric])

  /* ── Build state -> color mapping ── */
  const stateColorMap = useMemo(() => {
    const map = {}
    const range = max - min || 1
    Object.entries(stateMetrics).forEach(([st, m]) => {
      const val = m[selectedMetric] || 0
      const t = (val - min) / range
      map[st] = lerpColor(t)
    })
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
        const metricVal = m
          ? selectedMetric === 'avgDistricts'
            ? m.avgDistricts
            : Number(m[selectedMetric] || 0).toLocaleString()
          : 'N/A'

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

        // Compute bounds from all districts in this state
        const stateDistricts = districtsData.features.filter(
          (f) => f.properties.state === st
        )

        if (stateDistricts.length > 0) {
          let minLng = Infinity, maxLng = -Infinity
          let minLat = Infinity, maxLat = -Infinity

          stateDistricts.forEach((f) => {
            const coords = f.geometry.type === 'MultiPolygon'
              ? f.geometry.coordinates.flat(2)
              : f.geometry.coordinates.flat(1)
            coords.forEach(([lng, lat]) => {
              if (lng < minLng) minLng = lng
              if (lng > maxLng) maxLng = lng
              if (lat < minLat) minLat = lat
              if (lat > maxLat) maxLat = lat
            })
          })

          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, duration: 1000 }
          )
        }

        const m = stateMetrics[st] || {}
        setDetailData({
          stateCode: st,
          enrollment: m.enrollment || 0,
          campusCount: m.campusCount || 0,
          districtCount: stateDistrictCounts[st] || 0,
          avgDistricts: m.avgDistricts || 0,
        })
      }
    },
    [mapRef, districtsData, stateMetrics, stateDistrictCounts]
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

  /* ── Auto-select state from URL params ── */
  useEffect(() => {
    const st = params?.state
    if (!st || !districtsData || !campusesData) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Compute bounds from all districts in this state
    const stateDistricts = districtsData.features.filter(
      (f) => f.properties.state === st
    )

    if (stateDistricts.length > 0) {
      let minLng = Infinity, maxLng = -Infinity
      let minLat = Infinity, maxLat = -Infinity

      stateDistricts.forEach((f) => {
        const coords = f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates.flat(2)
          : f.geometry.coordinates.flat(1)
        coords.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        })
      })

      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 60, duration: 1000 }
      )
    }

    const m = stateMetrics[st] || {}
    setDetailData({
      stateCode: st,
      enrollment: m.enrollment || 0,
      campusCount: m.campusCount || 0,
      districtCount: stateDistrictCounts[st] || 0,
      avgDistricts: m.avgDistricts || 0,
    })
  }, [params?.state, districtsData, campusesData, mapRef, stateMetrics, stateDistrictCounts])

  if (!campusesData || !districtsData) return null

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

      {/* ── Choropleth layers on district source ── */}
      <Source id="states-choropleth" type="geojson" data={districtsData}>
        <Layer
          id="state-choropleth-fill"
          type="fill"
          paint={{
            'fill-color': fillColorExpr,
            'fill-opacity': 0.7,
          }}
        />
        <Layer
          id="state-choropleth-border"
          type="line"
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
        <div className="choropleth-legend-bar" />
        <div className="choropleth-legend-labels">
          <span>{selectedMetric === 'avgDistricts' ? min.toFixed(1) : Math.round(min).toLocaleString()}</span>
          <span>{selectedMetric === 'avgDistricts' ? max.toFixed(1) : Math.round(max).toLocaleString()}</span>
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
