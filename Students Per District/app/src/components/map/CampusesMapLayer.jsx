import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Source, Layer, Popup } from 'react-map-gl/mapbox'
import { DISTRICTS_TILESET_URL, DISTRICTS_SOURCE_LAYER } from '../../config'

/* ── Campus type color match expression ── */
const campusTypeColors = [
  'match',
  ['get', 'campus_type'],
  'Large City',
  '#FE4F40',
  'Midsize City',
  '#4C6971',
  'Suburban',
  '#7CB518',
  'Small City',
  '#E8A838',
  'Rural',
  '#8B6F47',
  'Town / Remote',
  '#9CA3AF',
  '#9CA3AF',
]

const CAMPUS_TYPE_COLOR_MAP = {
  'Large City': '#FE4F40',
  'Midsize City': '#4C6971',
  Suburban: '#7CB518',
  'Small City': '#E8A838',
  Rural: '#8B6F47',
  'Town / Remote': '#9CA3AF',
}

/* ── Circle polygon generator (commute sheds) ── */
function createCirclePolygon(center, radiusMiles, properties) {
  const radiusKm = radiusMiles * 1.60934
  const points = 64
  const coords = []
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dx = radiusKm * Math.cos(angle)
    const dy = radiusKm * Math.sin(angle)
    const lat = center[1] + dy / 111.32
    const lon =
      center[0] + dx / (111.32 * Math.cos((center[1] * Math.PI) / 180))
    coords.push([lon, lat])
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: properties,
  }
}

/* ── Build filtered data for clustered source ── */
function buildFilteredCampuses(campusesData, filters) {
  if (!campusesData) return campusesData

  const { state, enrollMin, enrollMax, districtsMin, districtsMax } = filters
  const hasFilter =
    state ||
    enrollMin !== '' ||
    enrollMax !== '' ||
    districtsMin !== '' ||
    districtsMax !== ''

  if (!hasFilter) return campusesData

  const filtered = campusesData.features.filter((f) => {
    const p = f.properties
    if (state && p.state !== state) return false
    if (enrollMin !== '' && (p.enrollment || 0) < parseFloat(enrollMin))
      return false
    if (enrollMax !== '' && (p.enrollment || 0) > parseFloat(enrollMax))
      return false
    if (
      districtsMin !== '' &&
      (p.districts_reached || 0) < parseFloat(districtsMin)
    )
      return false
    if (
      districtsMax !== '' &&
      (p.districts_reached || 0) > parseFloat(districtsMax)
    )
      return false
    return true
  })

  return { type: 'FeatureCollection', features: filtered }
}

/* ── Build Mapbox GL filter for circle layers ── */
function buildCircleFilter(filters) {
  const conditions = []
  const { state, enrollMin, enrollMax, districtsMin, districtsMax } = filters

  if (state) conditions.push(['==', ['get', 'state'], state])
  if (enrollMin !== '' && !isNaN(parseFloat(enrollMin)))
    conditions.push(['>=', ['get', 'enrollment'], parseFloat(enrollMin)])
  if (enrollMax !== '' && !isNaN(parseFloat(enrollMax)))
    conditions.push(['<=', ['get', 'enrollment'], parseFloat(enrollMax)])
  if (districtsMin !== '' && !isNaN(parseFloat(districtsMin)))
    conditions.push([
      '>=',
      ['get', 'districts_reached'],
      parseFloat(districtsMin),
    ])
  if (districtsMax !== '' && !isNaN(parseFloat(districtsMax)))
    conditions.push([
      '<=',
      ['get', 'districts_reached'],
      parseFloat(districtsMax),
    ])

  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return ['all', ...conditions]
}

export default function CampusesMapLayer({
  campusesData,
  filters,
  layers,
  searchSelection,
  onSearchSelectionHandled,
  mapRef,
  params,
}) {
  const [popupInfo, setPopupInfo] = useState(null)
  const [highlightFilter, setHighlightFilter] = useState(['in', 'cd_code', ''])
  const [highlightPrimary, setHighlightPrimary] = useState('')
  const [tooltip, setTooltip] = useState(null)
  const [hoveredDistrict, setHoveredDistrict] = useState(null)
  const prevSearchSelectionRef = useRef(null)

  /* ── Generate commute circles (memoized) ── */
  const circlesData = useMemo(() => {
    if (!campusesData) return null
    const circleFeatures = campusesData.features.map((f) => {
      const [lon, lat] = f.geometry.coordinates
      return createCirclePolygon([lon, lat], f.properties.radius_miles, f.properties)
    })
    return { type: 'FeatureCollection', features: circleFeatures }
  }, [campusesData])

  /* ── Filtered campus data for clustered source ── */
  const filteredCampuses = useMemo(
    () => buildFilteredCampuses(campusesData, filters),
    [campusesData, filters]
  )

  /* ── Circle filter expression ── */
  const circleFilter = useMemo(() => buildCircleFilter(filters), [filters])

  /* ── District highlight helpers ── */
  const highlightCampusDistricts = useCallback(
    (allDistrictsStr, primaryDistrict) => {
      if (!allDistrictsStr) {
        clearDistrictHighlights()
        return
      }
      const codes = allDistrictsStr
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
      if (codes.length === 0) {
        clearDistrictHighlights()
        return
      }
      setHighlightFilter(['in', 'cd_code', ...codes])
      setHighlightPrimary(primaryDistrict || '')
    },
    []
  )

  const clearDistrictHighlights = useCallback(() => {
    setHighlightFilter(['in', 'cd_code', ''])
    setHighlightPrimary('')
  }, [])

  /* ── Handle search selection from sidebar ── */
  useEffect(() => {
    if (
      searchSelection &&
      searchSelection !== prevSearchSelectionRef.current
    ) {
      prevSearchSelectionRef.current = searchSelection
      const feat = searchSelection
      const [lon, lat] = feat.geometry.coordinates
      const map = mapRef.current?.getMap()
      if (map) {
        map.flyTo({
          center: [lon, lat],
          zoom: Math.max(map.getZoom(), 8),
          duration: 1000,
          essential: true,
        })

        // Show popup + highlight after fly-to completes
        setTimeout(() => {
          highlightCampusDistricts(
            feat.properties.all_districts,
            feat.properties.primary_district
          )
          setPopupInfo({
            longitude: lon,
            latitude: lat,
            properties: feat.properties,
          })
        }, 1000)
      }
      onSearchSelectionHandled()
    }
  }, [
    searchSelection,
    onSearchSelectionHandled,
    highlightCampusDistricts,
    mapRef,
  ])

  /* ── Handle campus param from URL ── */
  useEffect(() => {
    const campusName = params?.campus
    if (!campusName || !campusesData) return

    const feat = campusesData.features.find(
      (f) => f.properties.name === campusName
    )
    if (!feat) return

    const [lon, lat] = feat.geometry.coordinates
    const map = mapRef.current?.getMap()
    if (map) {
      map.flyTo({
        center: [lon, lat],
        zoom: Math.max(map.getZoom(), 8),
        duration: 1000,
        essential: true,
      })

      setTimeout(() => {
        highlightCampusDistricts(
          feat.properties.all_districts,
          feat.properties.primary_district
        )
        setPopupInfo({
          longitude: lon,
          latitude: lat,
          properties: feat.properties,
        })
      }, 1000)
    }
  }, [params?.campus, campusesData, mapRef, highlightCampusDistricts])

  /* ── Map event handlers ── */
  const handleMapClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      // Check for campus point click
      const campusFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['campus-points'],
      })
      if (campusFeatures && campusFeatures.length > 0) {
        const props = campusFeatures[0].properties
        const coords = campusFeatures[0].geometry.coordinates.slice()

        // Handle anti-meridian wrapping
        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
        }

        highlightCampusDistricts(props.all_districts, props.primary_district)

        map.flyTo({
          center: coords,
          zoom: Math.max(map.getZoom(), 8),
          duration: 1000,
          essential: true,
        })

        setPopupInfo({
          longitude: coords[0],
          latitude: coords[1],
          properties: props,
        })
        return
      }

      // Check for cluster click
      const clusterFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['clusters'],
      })
      if (clusterFeatures && clusterFeatures.length > 0) {
        const clusterId = clusterFeatures[0].properties.cluster_id
        const source = map.getSource('campuses')
        if (source) {
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return
            map.flyTo({
              center: clusterFeatures[0].geometry.coordinates,
              zoom: zoom + 1,
              duration: 800,
            })
          })
        }
        return
      }

      // Click on empty area -- clear highlights
      clearDistrictHighlights()
      setPopupInfo(null)
    },
    [mapRef, highlightCampusDistricts, clearDistrictHighlights]
  )

  const handleMapMouseMove = useCallback(
    (e) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      // District hover
      const districtFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['district-fills'],
      })

      if (districtFeatures && districtFeatures.length > 0) {
        const props = districtFeatures[0].properties
        const cdCode = props.cd_code
        const text = cdCode + (props.name ? ' \u2014 ' + props.name : '')

        setTooltip({
          text,
          x: e.originalEvent.clientX + 12,
          y: e.originalEvent.clientY - 12,
        })

        if (hoveredDistrict !== cdCode) {
          setHoveredDistrict(cdCode)
        }
      } else {
        if (tooltip) {
          setTooltip(null)
          setHoveredDistrict(null)
        }
      }

      // Cursor styling
      const campusFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['campus-points'],
      })
      const clusterFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['clusters'],
      })

      if (
        (campusFeatures && campusFeatures.length > 0) ||
        (clusterFeatures && clusterFeatures.length > 0)
      ) {
        map.getCanvas().style.cursor = 'pointer'
      } else {
        map.getCanvas().style.cursor = ''
      }
    },
    [mapRef, hoveredDistrict, tooltip]
  )

  const handleMapMouseLeave = useCallback(() => {
    setTooltip(null)
    setHoveredDistrict(null)
  }, [])

  /* ── Register map event handlers ── */
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    map.on('click', handleMapClick)
    map.on('mousemove', handleMapMouseMove)
    map.on('mouseleave', handleMapMouseLeave)

    return () => {
      map.off('click', handleMapClick)
      map.off('mousemove', handleMapMouseMove)
      map.off('mouseleave', handleMapMouseLeave)
    }
  }, [mapRef, handleMapClick, handleMapMouseMove, handleMapMouseLeave])

  /* ── District hover filter ── */
  const districtHoverFilter = useMemo(() => {
    if (!hoveredDistrict) return ['==', ['get', 'cd_code'], '']
    return ['==', ['get', 'cd_code'], hoveredDistrict]
  }, [hoveredDistrict])

  const districtHoverOpacity = hoveredDistrict ? 0.08 : 0

  /* ── District highlight fill opacity expression ── */
  const highlightFillOpacity = useMemo(() => {
    if (!highlightPrimary) return 0.2
    return ['case', ['==', ['get', 'cd_code'], highlightPrimary], 0.35, 0.2]
  }, [highlightPrimary])

  /* ── Layer visibility ── */
  const campusVis = layers.campuses ? 'visible' : 'none'
  const circleVis = layers.circles ? 'visible' : 'none'
  const districtVis = layers.districts ? 'visible' : 'none'

  /* ── Popup content ── */
  const renderPopup = () => {
    if (!popupInfo) return null

    const p = popupInfo.properties
    const enrollment = p.enrollment
      ? Number(p.enrollment).toLocaleString()
      : 'N/A'
    const coverage = p.primary_district_coverage
      ? (Number(p.primary_district_coverage) * 100).toFixed(1) + '%'
      : 'N/A'
    const allDistricts = p.all_districts
      ? String(p.all_districts).replace(/\|/g, ', ')
      : 'N/A'
    const borderColor =
      CAMPUS_TYPE_COLOR_MAP[p.campus_type] || '#9CA3AF'

    return (
      <Popup
        longitude={popupInfo.longitude}
        latitude={popupInfo.latitude}
        anchor="bottom"
        onClose={() => {
          setPopupInfo(null)
          clearDistrictHighlights()
        }}
        maxWidth={window.innerWidth <= 768 ? '280px' : '320px'}
        closeButton={true}
        closeOnClick={false}
      >
        <div className="campus-popup" style={{ borderLeftColor: borderColor }}>
          <div className="popup-title">{p.name}</div>
          <div className="popup-subtitle">
            {p.city}, {p.state}
          </div>
          <div className="popup-stats">
            <div className="popup-row">
              <span className="popup-label">ENROLLMENT</span>
              <span className="popup-value">{enrollment}</span>
            </div>
            <div className="popup-row">
              <span className="popup-label">CAMPUS TYPE</span>
              <span className="popup-value">{p.campus_type}</span>
            </div>
            <div className="popup-row">
              <span className="popup-label">COMMUTE RADIUS</span>
              <span className="popup-value">{p.radius_miles} mi</span>
            </div>
            <div className="popup-row">
              <span className="popup-label">DISTRICTS REACHED</span>
              <span className="popup-value">{p.districts_reached}</span>
            </div>
            <div className="popup-row">
              <span className="popup-label">PRIMARY DISTRICT</span>
              <span className="popup-value">
                {p.primary_district} ({coverage})
              </span>
            </div>
            <div className="popup-row">
              <span className="popup-label">ALL DISTRICTS</span>
              <span className="popup-value">{allDistricts}</span>
            </div>
          </div>
        </div>
      </Popup>
    )
  }

  if (!campusesData) return null

  return (
    <>
      {/* ── District source (vector tiles) ── */}
      <Source id="districts" type="vector" url={DISTRICTS_TILESET_URL}>
        <Layer
          id="district-fills"
          type="fill"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'fill-color': '#F5F0EB',
            'fill-opacity': 0.3,
          }}
          layout={{ visibility: districtVis }}
        />
        <Layer
          id="district-borders"
          type="line"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'line-color': '#9CA3AF',
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              3,
              0.2,
              10,
              1,
            ],
            'line-opacity': 0.6,
          }}
          layout={{ visibility: districtVis }}
        />
        <Layer
          id="district-hover"
          type="fill"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'fill-color': '#4C6971',
            'fill-opacity': districtHoverOpacity,
          }}
          filter={districtHoverFilter}
        />
        <Layer
          id="district-highlight-fills"
          type="fill"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'fill-color': '#FE4F40',
            'fill-opacity': highlightFillOpacity,
          }}
          filter={highlightFilter}
        />
        <Layer
          id="district-highlight-borders"
          type="line"
          source-layer={DISTRICTS_SOURCE_LAYER}
          paint={{
            'line-color': '#FE4F40',
            'line-width': 2.5,
            'line-opacity': 0.8,
          }}
          filter={highlightFilter}
        />
      </Source>

      {/* ── State borders (Mapbox vector tile source) ── */}
      <Source
        id="state-boundaries"
        type="vector"
        url="mapbox://mapbox.mapbox-streets-v8"
      >
        <Layer
          id="state-borders"
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
              'interpolate',
              ['linear'],
              ['zoom'],
              3,
              0.8,
              10,
              1.8,
            ],
            'line-opacity': 0.85,
          }}
        />
      </Source>

      {/* ── Commute circles ── */}
      {circlesData && (
        <Source id="commute-circles" type="geojson" data={circlesData}>
          <Layer
            id="circle-fills"
            type="fill"
            paint={{
              'fill-color': campusTypeColors,
              'fill-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                3,
                0,
                4,
                0.06,
                6,
                0.12,
              ],
            }}
            layout={{ visibility: circleVis }}
            {...(circleFilter ? { filter: circleFilter } : {})}
          />
          <Layer
            id="circle-borders"
            type="line"
            paint={{
              'line-color': campusTypeColors,
              'line-width': 1,
              'line-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                3,
                0,
                4,
                0.2,
                6,
                0.4,
              ],
            }}
            layout={{ visibility: circleVis }}
            {...(circleFilter ? { filter: circleFilter } : {})}
          />
        </Source>
      )}

      {/* ── Campuses (clustered source) ── */}
      <Source
        id="campuses"
        type="geojson"
        data={filteredCampuses}
        cluster={true}
        clusterMaxZoom={9}
        clusterRadius={50}
      >
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#4C6971',
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18,
              10,
              22,
              50,
              28,
              100,
              34,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255,255,255,0.7)',
          }}
          layout={{ visibility: campusVis }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            visibility: campusVis,
          }}
          paint={{
            'text-color': '#ffffff',
          }}
        />
        <Layer
          id="campus-points"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'enrollment'], 0],
              0,
              3,
              2000,
              4,
              5000,
              6,
              15000,
              9,
              50000,
              13,
            ],
            'circle-color': campusTypeColors,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          }}
          layout={{ visibility: campusVis }}
        />
      </Source>

      {/* ── Popup ── */}
      {renderPopup()}

      {/* ── District tooltip ── */}
      {tooltip && (
        <div
          className="district-tooltip visible"
          style={{
            left: tooltip.x + 'px',
            top: tooltip.y + 'px',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  )
}
