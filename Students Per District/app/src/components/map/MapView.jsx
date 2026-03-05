import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Map, { NavigationControl } from 'react-map-gl/mapbox'
import CampusesMapLayer from './CampusesMapLayer'
import StatesMapLayer from './StatesMapLayer'
import DistrictsMapLayer from './DistrictsMapLayer'
import MapControls from './MapControls'
import '../../styles/map.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const INITIAL_VIEW = {
  longitude: -98.5,
  latitude: 39.8,
  zoom: 4,
}

// Continental US bounding box — tighter for a closer initial zoom
const US_BOUNDS = [[-120, 25], [-72, 49]]

export default function MapView({ subView, data, navigate, params, isVisible }) {
  const mapRef = useRef(null)
  const [viewState, setViewState] = useState(INITIAL_VIEW)

  // Shared state between sidebar and map layer (campuses sub-view)
  const [filters, setFilters] = useState({
    state: '',
    enrollMin: '',
    enrollMax: '',
    districtsMin: '',
    districtsMax: '',
  })
  const [layers, setLayers] = useState({
    campuses: true,
    circles: true,
    districts: true,
  })
  const [searchSelection, setSearchSelection] = useState(null)

  /* Resize the Mapbox canvas when the map becomes visible again.
     The always-mounted pattern (display:none ↔ contents) means
     Mapbox may have cached a zero-width container size. */
  useEffect(() => {
    if (!isVisible) return
    const map = mapRef.current?.getMap()
    if (!map) return
    // Small delay lets the browser finish layout before we measure
    const id = requestAnimationFrame(() => {
      try { map.resize() } catch (_) {}
    })
    return () => cancelAnimationFrame(id)
  }, [isVisible])

  /* Reset view when switching subViews so all tabs start centered on the US.
     Uses fitBounds so the continental US fills the available viewport
     consistently regardless of whether the sidebar is present.
     The 50ms timeout lets the sidebar fully mount/unmount before we
     resize the map and compute bounds for the correct container width. */
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const timer = setTimeout(() => {
      try {
        map.resize()
        map.fitBounds(US_BOUNDS, { duration: 0, padding: 20 })
      } catch (_) {}
    }, 50)
    return () => clearTimeout(timer)
  }, [subView])

  const handleStyleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Custom basemap overrides
    try {
      map.setPaintProperty('land', 'background-color', '#FAF8F5')
    } catch (_) {}
    try {
      map.setPaintProperty('water', 'fill-color', '#D4E8E4')
    } catch (_) {}

    // Tone down roads
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
        map.setPaintProperty(id, 'line-opacity', 0.3)
      } catch (_) {}
    })

    // Soften labels
    ;[
      'road-label-simple',
      'waterway-label',
      'water-line-label',
      'water-point-label',
    ].forEach((id) => {
      try {
        map.setLayoutProperty(id, 'text-opacity', 0.7)
      } catch (_) {}
    })
  }, [])

  const handleResetView = useCallback(() => {
    setFilters({
      state: '',
      enrollMin: '',
      enrollMax: '',
      districtsMin: '',
      districtsMax: '',
    })
    const map = mapRef.current?.getMap()
    if (map) {
      map.fitBounds(US_BOUNDS, { duration: 500, padding: 20 })
    }
  }, [])

  const flyTo = useCallback((coords, zoom) => {
    const map = mapRef.current?.getMap()
    if (map) {
      map.flyTo({
        center: coords,
        zoom: Math.max(map.getZoom(), zoom || 8),
        duration: 1000,
        essential: true,
      })
    }
  }, [])

  const fitBounds = useCallback((bounds, options) => {
    const map = mapRef.current?.getMap()
    if (map) {
      map.fitBounds(bounds, options)
    }
  }, [])

  /* Build interactiveLayerIds based on active subView */
  const interactiveLayerIds = useMemo(() => {
    switch (subView) {
      case 'states':
        return ['state-choropleth-fill']
      case 'districts':
        return ['districts-choropleth-fill']
      case 'campuses':
      default:
        return ['campus-points', 'clusters', 'district-fills']
    }
  }, [subView])

  const showCampusSidebar = subView === 'campuses'

  return (
    <div className="map-page">
      {showCampusSidebar && (
        <MapControls
          data={data}
          filters={filters}
          setFilters={setFilters}
          layers={layers}
          setLayers={setLayers}
          onResetView={handleResetView}
          onSearchSelect={setSearchSelection}
          flyTo={flyTo}
          fitBounds={fitBounds}
        />
      )}

      <div className="map-container">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v11"
          onLoad={handleStyleLoad}
          style={{ width: '100%', height: '100%' }}
          interactiveLayerIds={interactiveLayerIds}
        >
          <NavigationControl position="top-right" />

          {subView === 'campuses' && data?.campuses && (
            <CampusesMapLayer
              campusesData={data.campuses}
              filters={filters}
              layers={layers}
              searchSelection={searchSelection}
              onSearchSelectionHandled={() => setSearchSelection(null)}
              mapRef={mapRef}
              params={params}
            />
          )}

          {subView === 'states' && data?.campuses && data?.districtsMeta && (
            <StatesMapLayer
              campusesData={data.campuses}
              districtsMeta={data.districtsMeta}
              statesData={data.statesData}
              mapRef={mapRef}
              navigate={navigate}
              params={params}
            />
          )}

          {subView === 'districts' && data?.campuses && data?.districtsMeta && (
            <DistrictsMapLayer
              campusesData={data.campuses}
              districtsMeta={data.districtsMeta}
              mapRef={mapRef}
              navigate={navigate}
              params={params}
            />
          )}
        </Map>
      </div>
    </div>
  )
}
