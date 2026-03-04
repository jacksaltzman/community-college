import { useState, useCallback, useRef, useMemo } from 'react'
import Map, { NavigationControl } from 'react-map-gl/mapbox'
import CampusesMapLayer from './CampusesMapLayer'
import StatesMapLayer from './StatesMapLayer'
import DistrictsMapLayer from './DistrictsMapLayer'
import MapControls from './MapControls'
import '../../styles/map.css'

const MAPBOX_TOKEN =
  'pk.eyJ1IjoiamFja3NhbHR6bWFuIiwiYSI6ImNtbTltbmVuZTA0aWEycG9pNWJuZDR6dzYifQ.UT_hl5vyNQnGVDIq1GYkTw'

const INITIAL_VIEW = {
  longitude: -98.5,
  latitude: 39.8,
  zoom: 4,
}

export default function MapView({ subView, data, navigate }) {
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
    setViewState(INITIAL_VIEW)
    const map = mapRef.current?.getMap()
    if (map) {
      map.flyTo({
        center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
        zoom: INITIAL_VIEW.zoom,
      })
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

          {subView === 'campuses' && data?.campuses && data?.districts && (
            <CampusesMapLayer
              campusesData={data.campuses}
              districtsData={data.districts}
              filters={filters}
              layers={layers}
              searchSelection={searchSelection}
              onSearchSelectionHandled={() => setSearchSelection(null)}
              mapRef={mapRef}
            />
          )}

          {subView === 'states' && data?.campuses && data?.districts && (
            <StatesMapLayer
              campusesData={data.campuses}
              districtsData={data.districts}
              mapRef={mapRef}
              navigate={navigate}
            />
          )}

          {subView === 'districts' && data?.campuses && data?.districts && (
            <DistrictsMapLayer
              campusesData={data.campuses}
              districtsData={data.districts}
              mapRef={mapRef}
              navigate={navigate}
            />
          )}
        </Map>
      </div>
    </div>
  )
}
