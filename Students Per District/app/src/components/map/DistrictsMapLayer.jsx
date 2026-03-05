import { useState, useCallback, useMemo, useEffect } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import DetailPanel from './DetailPanel'
import { DISTRICTS_TILESET_URL, DISTRICTS_SOURCE_LAYER } from '../../config'

const METRICS = [
  { key: 'enrollment', label: 'Enrollment' },
  { key: 'campusCount', label: 'Campus Count' },
  { key: 'cookPVI', label: 'Cook PVI' },
]

/* Color-scale endpoints */
const PAPER = [253, 251, 249] // #FDFBF9
const TEAL = [76, 105, 113]  // #4C6971
const BLUE = [37, 99, 235]   // #2563EB
const RED = [220, 38, 38]    // #DC2626

function lerpColor(t) {
  const r = Math.round(PAPER[0] + (TEAL[0] - PAPER[0]) * t)
  const g = Math.round(PAPER[1] + (TEAL[1] - PAPER[1]) * t)
  const b = Math.round(PAPER[2] + (TEAL[2] - PAPER[2]) * t)
  return `rgb(${r},${g},${b})`
}

function parsePVI(s) {
  if (!s || s === 'EVEN') return 0
  const m = s.match(/^([DR])\+(\d+)$/)
  if (!m) return 0
  return m[1] === 'D' ? -Number(m[2]) : Number(m[2])
}

function pviColor(pviNum) {
  const clamped = Math.max(-30, Math.min(30, pviNum))
  const t = clamped / 30
  if (t <= 0) {
    const s = -t
    return `rgb(${Math.round(PAPER[0] + (BLUE[0] - PAPER[0]) * s)},${Math.round(PAPER[1] + (BLUE[1] - PAPER[1]) * s)},${Math.round(PAPER[2] + (BLUE[2] - PAPER[2]) * s)})`
  }
  return `rgb(${Math.round(PAPER[0] + (RED[0] - PAPER[0]) * t)},${Math.round(PAPER[1] + (RED[1] - PAPER[1]) * t)},${Math.round(PAPER[2] + (RED[2] - PAPER[2]) * t)})`
}

export default function DistrictsMapLayer({
  campusesData,
  districtsMeta,
  mapRef,
  navigate,
  params,
}) {
  const [selectedMetric, setSelectedMetric] = useState('cookPVI')
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
    if (selectedMetric === 'cookPVI') {
      if (districtsMeta?.districts) {
        Object.entries(districtsMeta.districts).forEach(([cd, meta]) => {
          map[cd] = pviColor(parsePVI(meta.cook_pvi))
        })
      }
    } else {
      const range = max - min || 1
      Object.entries(districtMetrics).forEach(([cd, m]) => {
        const val = m[selectedMetric] || 0
        const t = (val - min) / range
        map[cd] = lerpColor(t)
      })
    }
    return map
  }, [districtMetrics, districtsMeta, selectedMetric, min, max])

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
        let metricVal
        if (selectedMetric === 'cookPVI') {
          const meta = districtsMeta?.districts?.[cdCode]
          metricVal = meta?.cook_pvi || 'N/A'
        } else {
          metricVal = m ? Number(m[selectedMetric] || 0).toLocaleString() : '0'
        }

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

        // Use precomputed bounding box from metadata
        const meta = districtsMeta?.districts?.[cdCode]
        if (meta?.bbox) {
          const [minLng, minLat, maxLng, maxLat] = meta.bbox
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, duration: 1000 }
          )
        }

        const m = districtMetrics[cdCode] || {}
        const info = meta || props
        setDetailData({
          cdCode,
          name: info.name || '',
          state: info.state || '',
          enrollment: m.enrollment || 0,
          campusCount: m.campusCount || 0,
          cookPVI: info.cook_pvi || '',
          member: info.member || '',
          party: info.party || '',
        })
      }
    },
    [mapRef, districtsMeta, districtMetrics]
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
    if (!params?.district) setDetailData(null)
  }, [params?.district])

  /* ── Auto-select district from URL params ── */
  useEffect(() => {
    const cd = params?.district
    if (!cd || !districtsMeta || !campusesData) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Use precomputed bounding box from metadata
    const meta = districtsMeta.districts?.[cd]
    if (meta?.bbox) {
      const [minLng, minLat, maxLng, maxLat] = meta.bbox
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 60, duration: 1000 }
      )

      const m = districtMetrics[cd] || {}
      setDetailData({
        cdCode: cd,
        name: meta.name || '',
        state: meta.state || '',
        enrollment: m.enrollment || 0,
        campusCount: m.campusCount || 0,
        cookPVI: meta.cook_pvi || '',
        member: meta.member || '',
        party: meta.party || '',
      })
    }
  }, [params?.district, districtsMeta, campusesData, mapRef, districtMetrics])

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

      {/* ── Choropleth layers ── */}
      <Source id="districts-choropleth" type="vector" url={DISTRICTS_TILESET_URL}>
        <Layer
          id="districts-choropleth-fill"
          type="fill"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'fill-color': fillColorExpr,
            'fill-opacity': 0.7,
          }}
        />
        <Layer
          id="districts-choropleth-border"
          type="line"
          source-layer={DISTRICTS_SOURCE_LAYER}
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
          source-layer={DISTRICTS_SOURCE_LAYER}
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
        <div
          className="choropleth-legend-bar"
          style={selectedMetric === 'cookPVI'
            ? { background: 'linear-gradient(to right, #2563EB, #FDFBF9 50%, #DC2626)' }
            : undefined}
        />
        <div className="choropleth-legend-labels">
          {selectedMetric === 'cookPVI' ? (
            <>
              <span>D+30</span>
              <span>EVEN</span>
              <span>R+30</span>
            </>
          ) : (
            <>
              <span>{Math.round(min).toLocaleString()}</span>
              <span>{Math.round(max).toLocaleString()}</span>
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
          type="district"
          data={detailData}
          onClose={() => setDetailData(null)}
          navigate={navigate}
        />
      )}
    </>
  )
}
