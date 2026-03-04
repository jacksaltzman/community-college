import { useState, useCallback, useMemo, useEffect } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import DetailPanel from './DetailPanel'

const METRICS = [
  { key: 'enrollment', label: 'Enrollment' },
  { key: 'campusCount', label: 'Campus Count' },
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

export default function DistrictsMapLayer({
  campusesData,
  districtsData,
  mapRef,
  navigate,
  params,
}) {
  const [selectedMetric, setSelectedMetric] = useState('enrollment')
  const [hoveredDistrict, setHoveredDistrict] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [detailData, setDetailData] = useState(null)

  /* ── Aggregate campus data by district ── */
  const districtMetrics = useMemo(() => {
    if (!campusesData) return {}
    const metrics = {}
    campusesData.features.forEach((f) => {
      const allDistricts = f.properties.all_districts
      if (!allDistricts) return
      allDistricts.split('|').forEach((cd) => {
        cd = cd.trim()
        if (!cd) return
        if (!metrics[cd]) metrics[cd] = { enrollment: 0, campusCount: 0 }
        metrics[cd].enrollment += f.properties.enrollment || 0
        metrics[cd].campusCount += 1
      })
    })
    return metrics
  }, [campusesData])

  /* ── Compute min/max for the active metric ── */
  const { min, max } = useMemo(() => {
    const vals = Object.values(districtMetrics).map((m) => m[selectedMetric] || 0)
    if (vals.length === 0) return { min: 0, max: 1 }
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [districtMetrics, selectedMetric])

  /* ── Build cd_code -> color mapping ── */
  const districtColorMap = useMemo(() => {
    const map = {}
    const range = max - min || 1
    Object.entries(districtMetrics).forEach(([cd, m]) => {
      const val = m[selectedMetric] || 0
      const t = (val - min) / range
      map[cd] = lerpColor(t)
    })
    return map
  }, [districtMetrics, selectedMetric, min, max])

  /* ── Build Mapbox fill-color expression ── */
  const fillColorExpr = useMemo(() => {
    const entries = Object.entries(districtColorMap)
    if (entries.length === 0) return '#FDFBF9'
    const expr = ['match', ['get', 'cd_code']]
    entries.forEach(([cd, color]) => {
      expr.push(cd, color)
    })
    expr.push('#FDFBF9') // fallback
    return expr
  }, [districtColorMap])

  /* ── Hover filter ── */
  const hoverFilter = useMemo(() => {
    if (!hoveredDistrict) return ['==', ['get', 'cd_code'], '']
    return ['==', ['get', 'cd_code'], hoveredDistrict]
  }, [hoveredDistrict])

  /* ── Event handlers ── */
  const handleMouseMove = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['districts-choropleth-fill'],
      })

      if (features && features.length > 0) {
        const props = features[0].properties
        const cdCode = props.cd_code
        map.getCanvas().style.cursor = 'pointer'

        if (cdCode !== hoveredDistrict) {
          setHoveredDistrict(cdCode)
        }

        const m = districtMetrics[cdCode]
        const metricLabel = METRICS.find((x) => x.key === selectedMetric)?.label
        const metricVal = m
          ? Number(m[selectedMetric] || 0).toLocaleString()
          : '0'

        const name = props.name ? ` — ${props.name}` : ''
        setTooltip({
          text: `${cdCode}${name} — ${metricLabel}: ${metricVal}`,
          x: e.originalEvent.clientX + 12,
          y: e.originalEvent.clientY - 12,
        })
      } else {
        if (hoveredDistrict) {
          setHoveredDistrict(null)
          setTooltip(null)
          map.getCanvas().style.cursor = ''
        }
      }
    },
    [mapRef, hoveredDistrict, districtMetrics, selectedMetric]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredDistrict(null)
    setTooltip(null)
  }, [])

  const handleClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['districts-choropleth-fill'],
      })

      if (features && features.length > 0) {
        const props = features[0].properties
        const cdCode = props.cd_code

        // Compute bounds from the clicked district feature
        const districtFeature = districtsData.features.find(
          (f) => f.properties.cd_code === cdCode
        )

        if (districtFeature) {
          let minLng = Infinity, maxLng = -Infinity
          let minLat = Infinity, maxLat = -Infinity

          const coords = districtFeature.geometry.type === 'MultiPolygon'
            ? districtFeature.geometry.coordinates.flat(2)
            : districtFeature.geometry.coordinates.flat(1)

          coords.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng
            if (lng > maxLng) maxLng = lng
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          })

          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, duration: 1000 }
          )
        }

        const m = districtMetrics[cdCode] || {}
        setDetailData({
          cdCode,
          name: props.name || '',
          state: props.state || '',
          enrollment: m.enrollment || 0,
          campusCount: m.campusCount || 0,
        })
      }
    },
    [mapRef, districtsData, districtMetrics]
  )

  /* ── Register/unregister map events ── */
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    map.on('mousemove', handleMouseMove)
    map.on('mouseleave', handleMouseLeave)
    map.on('click', handleClick)

    return () => {
      map.off('mousemove', handleMouseMove)
      map.off('mouseleave', handleMouseLeave)
      map.off('click', handleClick)
      map.getCanvas().style.cursor = ''
    }
  }, [mapRef, handleMouseMove, handleMouseLeave, handleClick])

  /* ── Auto-select district from URL params ── */
  useEffect(() => {
    const cd = params?.district
    if (!cd || !districtsData || !campusesData) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Find the district feature
    const districtFeature = districtsData.features.find(
      (f) => f.properties.cd_code === cd
    )

    if (districtFeature) {
      let minLng = Infinity, maxLng = -Infinity
      let minLat = Infinity, maxLat = -Infinity

      const coords = districtFeature.geometry.type === 'MultiPolygon'
        ? districtFeature.geometry.coordinates.flat(2)
        : districtFeature.geometry.coordinates.flat(1)

      coords.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      })

      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 60, duration: 1000 }
      )

      const props = districtFeature.properties
      const m = districtMetrics[cd] || {}
      setDetailData({
        cdCode: cd,
        name: props.name || '',
        state: props.state || '',
        enrollment: m.enrollment || 0,
        campusCount: m.campusCount || 0,
      })
    }
  }, [params?.district, districtsData, campusesData, mapRef, districtMetrics])

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

      {/* ── Choropleth layers ── */}
      <Source id="districts-choropleth" type="geojson" data={districtsData}>
        <Layer
          id="districts-choropleth-fill"
          type="fill"
          paint={{
            'fill-color': fillColorExpr,
            'fill-opacity': 0.7,
          }}
        />
        <Layer
          id="districts-choropleth-border"
          type="line"
          paint={{
            'line-color': '#9CA3AF',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              3, 0.2,
              10, 1,
            ],
            'line-opacity': 0.6,
          }}
        />
        <Layer
          id="districts-hover"
          type="fill"
          paint={{
            'fill-color': '#4C6971',
            'fill-opacity': 0.2,
          }}
          filter={hoverFilter}
        />
      </Source>

      {/* ── State borders from Mapbox vector tiles ── */}
      <Source
        id="state-boundaries-districts"
        type="vector"
        url="mapbox://mapbox.mapbox-streets-v8"
      >
        <Layer
          id="state-borders-districts"
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
          <span>{Math.round(min).toLocaleString()}</span>
          <span>{Math.round(max).toLocaleString()}</span>
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
          type="district"
          data={detailData}
          onClose={() => setDetailData(null)}
          navigate={navigate}
        />
      )}
    </>
  )
}
