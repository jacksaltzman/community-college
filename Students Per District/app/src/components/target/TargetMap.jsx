import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/mapbox'
import { DISTRICTS_TILESET_URL, DISTRICTS_SOURCE_LAYER } from '../../config'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/* ── 3-stop color ramp: warm gray → sage → deep teal ── */
const RAMP = [
  { t: 0.0, r: 230, g: 225, b: 218 }, // warm light gray — clearly "low"
  { t: 0.45, r: 124, g: 175, b: 157 }, // sage green — middle
  { t: 1.0, r: 22, g: 75, b: 90 },     // deep dark teal — clearly "high"
]

function rampColor(t) {
  t = Math.max(0, Math.min(1, t))
  let lo = RAMP[0]
  let hi = RAMP[RAMP.length - 1]
  for (let i = 0; i < RAMP.length - 1; i++) {
    if (t >= RAMP[i].t && t <= RAMP[i + 1].t) {
      lo = RAMP[i]
      hi = RAMP[i + 1]
      break
    }
  }
  const f = (t - lo.t) / (hi.t - lo.t || 1)
  const r = Math.round(lo.r + (hi.r - lo.r) * f)
  const g = Math.round(lo.g + (hi.g - lo.g) * f)
  const b = Math.round(lo.b + (hi.b - lo.b) * f)
  return `rgb(${r},${g},${b})`
}

/* CSS color for the legend gradient */
const LEGEND_GRADIENT = `linear-gradient(to right, rgb(${RAMP[0].r},${RAMP[0].g},${RAMP[0].b}), rgb(${RAMP[1].r},${RAMP[1].g},${RAMP[1].b}), rgb(${RAMP[2].r},${RAMP[2].g},${RAMP[2].b}))`

/* ── Approximate US state centroids for label placement ── */
const STATE_CENTROIDS = {
  AL: [-86.8, 32.8], AK: [-153.5, 64.2], AZ: [-111.7, 34.3], AR: [-92.4, 34.8],
  CA: [-119.7, 37.2], CO: [-105.5, 39.0], CT: [-72.7, 41.6], DE: [-75.5, 39.0],
  FL: [-81.7, 28.7], GA: [-83.4, 32.7], HI: [-155.5, 20.0], ID: [-114.5, 44.4],
  IL: [-89.2, 40.0], IN: [-86.3, 39.8], IA: [-93.5, 42.0], KS: [-98.3, 38.5],
  KY: [-85.3, 37.8], LA: [-91.9, 31.0], ME: [-69.2, 45.4], MD: [-76.6, 39.0],
  MA: [-71.8, 42.3], MI: [-84.7, 44.3], MN: [-94.3, 46.3], MS: [-89.7, 32.7],
  MO: [-92.5, 38.4], MT: [-109.6, 47.0], NE: [-99.8, 41.5], NV: [-116.6, 39.3],
  NH: [-71.6, 43.7], NJ: [-74.7, 40.1], NM: [-106.0, 34.4], NY: [-75.5, 43.0],
  NC: [-79.4, 35.6], ND: [-100.5, 47.4], OH: [-82.8, 40.4], OK: [-97.5, 35.6],
  OR: [-120.5, 43.9], PA: [-77.6, 41.0], RI: [-71.5, 41.7], SC: [-80.9, 33.9],
  SD: [-100.2, 44.4], TN: [-86.3, 35.9], TX: [-99.0, 31.5], UT: [-111.7, 39.3],
  VT: [-72.6, 44.1], VA: [-79.4, 37.5], WA: [-120.5, 47.4], WV: [-80.6, 38.6],
  WI: [-89.8, 44.6], WY: [-107.6, 43.0],
}

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 39,
  zoom: 3.5,
}

export default function TargetMap({ rankedStates, hoveredState, onHoverState, campuses }) {
  const mapRef = useRef(null)
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [tooltip, setTooltip] = useState(null)

  /* ── Build state → data lookup ── */
  const stateDataMap = useMemo(() => {
    const map = {}
    if (!rankedStates) return map
    rankedStates.forEach((s) => {
      map[s.code] = s
    })
    return map
  }, [rankedStates])

  /* ── Normalize composite scores to 0-1 for color interpolation ── */
  const { minScore, maxScore } = useMemo(() => {
    if (!rankedStates || rankedStates.length === 0) return { minScore: 0, maxScore: 100 }
    const scores = rankedStates.map((s) => s.composite)
    return {
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    }
  }, [rankedStates])

  /* ── Build Mapbox fill-color match expression ── */
  const fillColorExpr = useMemo(() => {
    if (!rankedStates || rankedStates.length === 0) return '#EDE9E3'
    const range = maxScore - minScore || 1
    const expr = ['match', ['get', 'state']]
    rankedStates.forEach((s) => {
      const t = (s.composite - minScore) / range
      expr.push(s.code, rampColor(t))
    })
    expr.push('#EDE9E3') // fallback
    return expr
  }, [rankedStates, minScore, maxScore])

  /* ── Border color: T1 darker, others lighter ── */
  const borderColorExpr = useMemo(() => {
    if (!rankedStates || rankedStates.length === 0) return '#C8C1B6'
    const t1Codes = rankedStates.filter((s) => s.tier === 'T1').map((s) => s.code)
    if (t1Codes.length === 0) return '#C8C1B6'
    const expr = ['match', ['get', 'state']]
    t1Codes.forEach((c) => expr.push(c, '#16505D'))
    expr.push('#B8B2A8') // fallback
    return expr
  }, [rankedStates])

  /* ── T1 states for label markers ── */
  const t1Markers = useMemo(() => {
    if (!rankedStates) return []
    return rankedStates
      .filter((s) => s.tier === 'T1' && STATE_CENTROIDS[s.code])
      .map((s) => ({
        code: s.code,
        rank: s.rank,
        score: Math.round(s.composite),
        lng: STATE_CENTROIDS[s.code][0],
        lat: STATE_CENTROIDS[s.code][1],
      }))
  }, [rankedStates])

  /* ── Hover filter ── */
  const hoverFilter = useMemo(() => {
    if (!hoveredState) return ['==', ['get', 'state'], '']
    return ['==', ['get', 'state'], hoveredState]
  }, [hoveredState])

  /* ── Clear internal tooltip when hoveredState changes externally ── */
  useEffect(() => {
    setTooltip(null)
  }, [hoveredState])

  /* ── Mouse move handler ── */
  const handleMouseMove = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['target-state-fill'],
      })

      if (features && features.length > 0) {
        const stCode = features[0].properties.state
        map.getCanvas().style.cursor = 'pointer'
        onHoverState(stCode)

        const stData = stateDataMap[stCode]
        if (stData) {
          setTooltip({
            code: stCode,
            rank: stData.rank,
            tier: stData.tier,
            score: Math.round(stData.composite),
            x: e.originalEvent.clientX + 14,
            y: e.originalEvent.clientY - 14,
          })
        }
      } else {
        map.getCanvas().style.cursor = ''
        onHoverState(null)
        setTooltip(null)
      }
    },
    [onHoverState, stateDataMap],
  )

  /* ── Mouse leave handler ── */
  const handleMouseLeave = useCallback(() => {
    onHoverState(null)
    setTooltip(null)
  }, [onHoverState])

  /* ── Basemap overrides on style load ── */
  const handleStyleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    try {
      map.setPaintProperty('land', 'background-color', '#FAF8F5')
    } catch (_) {}
    try {
      map.setPaintProperty('water', 'fill-color', '#D4E8E4')
    } catch (_) {}

    ;[
      'road-simple',
      'road-path',
      'road-path-trail',
      'road-path-cycleway-piste',
      'road-pedestrian',
      'road-steps',
      'road-rail',
    ].forEach((id) => {
      try {
        map.setPaintProperty(id, 'line-opacity', 0.15)
      } catch (_) {}
    })

    // Dim default place labels so our markers stand out
    ;[
      'settlement-major-label',
      'settlement-minor-label',
      'settlement-subdivision-label',
    ].forEach((id) => {
      try {
        map.setPaintProperty(id, 'text-opacity', 0.3)
      } catch (_) {}
    })
  }, [])

  return (
    <div className="target-map-wrap">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        projection="mercator"
        onLoad={handleStyleLoad}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['target-state-fill']}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* ── Choropleth fill on district vector tiles ── */}
        <Source id="target-districts" type="vector" url={DISTRICTS_TILESET_URL}>
          <Layer
            id="target-state-fill"
            type="fill"
            source-layer={DISTRICTS_SOURCE_LAYER}
            paint={{
              'fill-color': fillColorExpr,
              'fill-opacity': 0.85,
            }}
          />
          <Layer
            id="target-state-border"
            type="line"
            source-layer={DISTRICTS_SOURCE_LAYER}
            paint={{
              'line-color': borderColorExpr,
              'line-width': 0.5,
              'line-opacity': 0.7,
            }}
          />
          <Layer
            id="target-state-hover"
            type="fill"
            source-layer={DISTRICTS_SOURCE_LAYER}
            paint={{
              'fill-color': '#111111',
              'fill-opacity': 0.12,
            }}
            filter={hoverFilter}
          />
        </Source>

        {/* ── State borders from Mapbox vector tiles ── */}
        <Source
          id="target-state-boundaries"
          type="vector"
          url="mapbox://mapbox.mapbox-streets-v8"
        >
          <Layer
            id="target-state-borders"
            type="line"
            source-layer="admin"
            filter={[
              'all',
              ['==', ['get', 'admin_level'], 1],
              ['==', ['get', 'iso_3166_1'], 'US'],
            ]}
            paint={{
              'line-color': '#111111',
              'line-width': 0.8,
              'line-opacity': 0.7,
            }}
          />
        </Source>

        {/* ── Campus dots (clustered, sized by enrollment) ── */}
        {campuses && (
          <Source
            id="target-campuses"
            type="geojson"
            data={campuses}
            cluster={true}
            clusterMaxZoom={9}
            clusterRadius={50}
          >
            {/* Cluster circles */}
            <Layer
              id="target-campus-clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': '#4C6971',
                'circle-radius': [
                  'step', ['get', 'point_count'],
                  12, 10,
                  16, 30,
                  20, 100,
                  24,
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': 'rgba(255,255,255,0.7)',
                'circle-opacity': 0.75,
              }}
            />
            {/* Cluster count labels */}
            <Layer
              id="target-campus-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 10,
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#ffffff',
              }}
            />
            {/* Individual campus points */}
            <Layer
              id="target-campus-points"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': '#4C6971',
                'circle-radius': [
                  'interpolate', ['linear'], ['get', 'enrollment'],
                  0, 2.5,
                  2000, 3.5,
                  5000, 5,
                  15000, 7,
                  50000, 10,
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.8,
              }}
            />
          </Source>
        )}

        {/* ── T1 state label markers ── */}
        {t1Markers.map((m) => {
          const isHovered = hoveredState === m.code
          return (
            <Marker
              key={m.code}
              longitude={m.lng}
              latitude={m.lat}
              anchor="center"
            >
              <div
                className={`target-map-marker${isHovered ? ' hovered' : ''}`}
                onMouseEnter={() => onHoverState(m.code)}
                onMouseLeave={() => onHoverState(null)}
              >
                <span className="target-map-marker-code">{m.code}</span>
                <span className="target-map-marker-score">{m.score}</span>
              </div>
            </Marker>
          )
        })}
      </Map>

      {/* ── Legend ── */}
      <div className="target-map-legend">
        <div className="target-map-legend-label">SVS Score</div>
        <div
          className="target-map-legend-bar"
          style={{ background: LEGEND_GRADIENT }}
        />
        <div className="target-map-legend-range">
          <span>{Math.round(minScore)}</span>
          <span>{Math.round(maxScore)}</span>
        </div>
        <div className="target-map-legend-tiers">
          <span className="target-map-legend-tier t1">T1</span>
          <span className="target-map-legend-tier t2">T2</span>
          <span className="target-map-legend-tier t3">T3</span>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="target-map-tooltip"
          style={{ left: tooltip.x + 'px', top: tooltip.y + 'px' }}
        >
          <span className="target-map-tooltip-code">{tooltip.code}</span>
          <span className={`target-map-tooltip-tier ${tooltip.tier?.toLowerCase()}`}>
            {tooltip.tier}
          </span>
          <span className="target-map-tooltip-divider" />
          <span className="target-map-tooltip-score">
            #{tooltip.rank} &middot; SVS {tooltip.score}
          </span>
        </div>
      )}
    </div>
  )
}
