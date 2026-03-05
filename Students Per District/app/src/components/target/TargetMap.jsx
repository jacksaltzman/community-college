import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/mapbox'
import { DISTRICTS_TILESET_URL, DISTRICTS_SOURCE_LAYER } from '../../config'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/* ── Color ramp: paper white → teal ── */
const PAPER = [253, 251, 249]
const TEAL = [76, 105, 113]

function lerpColor(t) {
  const r = Math.round(PAPER[0] + (TEAL[0] - PAPER[0]) * t)
  const g = Math.round(PAPER[1] + (TEAL[1] - PAPER[1]) * t)
  const b = Math.round(PAPER[2] + (TEAL[2] - PAPER[2]) * t)
  return `rgb(${r},${g},${b})`
}

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 39,
  zoom: 3.5,
}

export default function TargetMap({ rankedStates, hoveredState, onHoverState }) {
  const mapRef = useRef(null)
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [tooltip, setTooltip] = useState(null)

  /* ── Build state → score lookup ── */
  const stateScoreMap = useMemo(() => {
    const map = {}
    if (!rankedStates) return map
    rankedStates.forEach((s) => {
      map[s.code] = s.composite
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
    if (!rankedStates || rankedStates.length === 0) return '#FDFBF9'
    const range = maxScore - minScore || 1
    const expr = ['match', ['get', 'state']]
    rankedStates.forEach((s) => {
      const t = (s.composite - minScore) / range
      expr.push(s.code, lerpColor(t))
    })
    expr.push('#FDFBF9') // fallback
    return expr
  }, [rankedStates, minScore, maxScore])

  /* ── Hover filter ── */
  const hoverFilter = useMemo(() => {
    if (!hoveredState) return ['==', ['get', 'state'], '']
    return ['==', ['get', 'state'], hoveredState]
  }, [hoveredState])

  /* ── Clear internal tooltip when hoveredState changes externally ── */
  useEffect(() => {
    // External hover (from scatter/table) does not have mouse coords,
    // so we clear any existing tooltip to avoid stale positioning.
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

        const score = stateScoreMap[stCode]
        setTooltip({
          text: `${stCode}: ${score != null ? Math.round(score) : 'N/A'}`,
          x: e.originalEvent.clientX + 12,
          y: e.originalEvent.clientY - 12,
        })
      } else {
        map.getCanvas().style.cursor = ''
        onHoverState(null)
        setTooltip(null)
      }
    },
    [onHoverState, stateScoreMap],
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
        map.setPaintProperty(id, 'line-opacity', 0.2)
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
              'fill-opacity': 0.75,
            }}
          />
          <Layer
            id="target-state-border"
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
            id="target-state-hover"
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
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                3, 0.8,
                10, 1.8,
              ],
              'line-opacity': 0.85,
            }}
          />
        </Source>
      </Map>

      {/* ── Legend ── */}
      <div className="target-map-legend">
        <div className="target-map-legend-label">Composite SVS</div>
        <div className="target-map-legend-bar" />
        <div className="target-map-legend-range">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="target-map-tooltip"
          style={{ left: tooltip.x + 'px', top: tooltip.y + 'px' }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
