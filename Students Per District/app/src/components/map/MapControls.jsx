import { useState, useMemo, useCallback, useRef, useEffect } from 'react'

const STATE_NAMES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AS: 'American Samoa',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  GU: 'Guam',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  MP: 'Northern Mariana Islands',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  PR: 'Puerto Rico',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VI: 'U.S. Virgin Islands',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
}

const LEGEND_ITEMS = [
  {
    type: 'Large City',
    color: 'var(--color-large-city)',
    desc: 'Large cities and suburbs. 15-mile radius.',
  },
  {
    type: 'Midsize City',
    color: 'var(--color-midsize-city)',
    desc: 'Midsize cities (100K-250K). 19-mile radius.',
  },
  {
    type: 'Suburban',
    color: 'var(--color-suburban)',
    desc: 'Midsize and small suburbs. 22-mile radius.',
  },
  {
    type: 'Small City',
    color: 'var(--color-small-city)',
    desc: 'Small cities (<100K). 25-mile radius.',
  },
  {
    type: 'Rural',
    color: 'var(--color-rural)',
    desc: 'Rural fringe and distant. 27-37-mile radius.',
  },
  {
    type: 'Town / Remote',
    color: 'var(--color-town-remote)',
    desc: 'Towns and remote areas. 39-58-mile radius.',
  },
]

function debounce(fn, delay) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

export default function MapControls({
  data,
  filters,
  setFilters,
  layers,
  setLayers,
  onResetView,
  onSearchSelect,
  flyTo,
  fitBounds,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef(null)
  const resultsRef = useRef(null)

  const campusesData = data?.campuses

  /* ── State list ── */
  const stateOptions = useMemo(() => {
    if (!campusesData) return []
    const stateSet = new Set()
    campusesData.features.forEach((f) => stateSet.add(f.properties.state))
    return Array.from(stateSet).sort()
  }, [campusesData])

  /* ── Filtered features for stats ── */
  const filteredFeatures = useMemo(() => {
    if (!campusesData) return []

    const { state, enrollMin, enrollMax, districtsMin, districtsMax } = filters
    let features = campusesData.features

    if (state) features = features.filter((f) => f.properties.state === state)
    if (enrollMin !== '')
      features = features.filter(
        (f) => (f.properties.enrollment || 0) >= parseFloat(enrollMin)
      )
    if (enrollMax !== '')
      features = features.filter(
        (f) => (f.properties.enrollment || 0) <= parseFloat(enrollMax)
      )
    if (districtsMin !== '')
      features = features.filter(
        (f) =>
          (f.properties.districts_reached || 0) >= parseFloat(districtsMin)
      )
    if (districtsMax !== '')
      features = features.filter(
        (f) =>
          (f.properties.districts_reached || 0) <= parseFloat(districtsMax)
      )

    return features
  }, [campusesData, filters])

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = filteredFeatures.length
    const avgDistricts =
      total > 0
        ? (
            filteredFeatures.reduce(
              (sum, f) => sum + (f.properties.districts_reached || 0),
              0
            ) / total
          ).toFixed(1)
        : '0'
    return { total, avgDistricts }
  }, [filteredFeatures])

  /* ── Filter count ── */
  const filterCount = useMemo(() => {
    let count = 0
    if (filters.state) count++
    if (filters.enrollMin !== '') count++
    if (filters.enrollMax !== '') count++
    if (filters.districtsMin !== '') count++
    if (filters.districtsMax !== '') count++
    return count
  }, [filters])

  /* ── Search ── */
  const handleSearch = useCallback(
    (query) => {
      setSearchQuery(query)
      if (query.trim().length < 2 || !campusesData) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      const queryWords = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0)

      const matches = campusesData.features
        .filter((f) => {
          const name = (f.properties.name || '').toLowerCase()
          const city = (f.properties.city || '').toLowerCase()
          const state = (f.properties.state || '').toLowerCase()
          const searchable = name + ' ' + city + ' ' + state
          return queryWords.every((w) => searchable.includes(w))
        })
        .slice(0, 20)

      setSearchResults(matches)
      setShowResults(true)
    },
    [campusesData]
  )

  const handleResultClick = useCallback(
    (feat) => {
      setShowResults(false)
      setSearchQuery(feat.properties.name)

      // On mobile, collapse sidebar
      if (window.innerWidth <= 768) {
        setSidebarOpen(false)
      }

      onSearchSelect(feat)
    },
    [onSearchSelect]
  )

  /* ── Close search results on outside click ── */
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        resultsRef.current &&
        !resultsRef.current.contains(e.target)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  /* ── State filter change ── */
  const handleStateChange = useCallback(
    (e) => {
      const selected = e.target.value
      setFilters((prev) => ({ ...prev, state: selected }))

      if (selected && campusesData) {
        const filtered = campusesData.features.filter(
          (f) => f.properties.state === selected
        )
        if (filtered.length > 0) {
          let minLng = Infinity,
            maxLng = -Infinity,
            minLat = Infinity,
            maxLat = -Infinity
          filtered.forEach((f) => {
            const [lng, lat] = f.geometry.coordinates
            if (lng < minLng) minLng = lng
            if (lng > maxLng) maxLng = lng
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          })
          fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 60, maxZoom: 8 }
          )
        }
      } else if (!selected) {
        flyTo([-98.5, 39.8], 4)
      }
    },
    [campusesData, setFilters, flyTo, fitBounds]
  )

  /* ── Debounced numeric filter handlers ── */
  const debouncedSetFilters = useMemo(
    () =>
      debounce((key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
      }, 300),
    [setFilters]
  )

  /* ── Reset view handler ── */
  const handleResetView = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
    onResetView()
  }, [onResetView])

  /* ── Clear filters ── */
  const handleClearFilters = useCallback(() => {
    handleResetView()
  }, [handleResetView])

  return (
    <div className={`map-sidebar${sidebarOpen ? ' open' : ''}`}>
      {/* Mobile header */}
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <span className="logo-text">MAP CONTROLS</span>
        </div>
        <button
          className="map-hamburger"
          onClick={() => setSidebarOpen((prev) => !prev)}
          aria-label="Toggle sidebar"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="sidebar-controls">
        {/* ── Search & State Filter ── */}
        <div className="sidebar-section">
          <div className="section-label">Search</div>
          <input
            ref={searchRef}
            type="text"
            className="search-input"
            placeholder="Search colleges..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {showResults && (
            <div className="search-results" ref={resultsRef}>
              {searchResults.length === 0 ? (
                <div className="search-no-results">No colleges found</div>
              ) : (
                searchResults.map((f, i) => (
                  <div
                    key={i}
                    className="search-result-item"
                    onClick={() => handleResultClick(f)}
                  >
                    <div className="search-result-name">
                      {f.properties.name}
                    </div>
                    <div className="search-result-loc">
                      {f.properties.city}, {f.properties.state}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <select
            className="styled-select"
            style={{ marginTop: 8 }}
            value={filters.state}
            onChange={handleStateChange}
          >
            <option value="">All States</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {STATE_NAMES[s] ? STATE_NAMES[s] + ' (' + s + ')' : s}
              </option>
            ))}
          </select>
          <button className="map-reset-btn" onClick={handleResetView}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            Reset View
          </button>
        </div>

        {/* ── Layer Toggles ── */}
        <div className="sidebar-section">
          <div className="section-label">Layers</div>
          <div className="toggle-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={layers.campuses}
                onChange={(e) =>
                  setLayers((prev) => ({
                    ...prev,
                    campuses: e.target.checked,
                  }))
                }
              />
              Campus Points
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={layers.circles}
                onChange={(e) =>
                  setLayers((prev) => ({
                    ...prev,
                    circles: e.target.checked,
                  }))
                }
              />
              Commute Circles
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={layers.districts}
                onChange={(e) =>
                  setLayers((prev) => ({
                    ...prev,
                    districts: e.target.checked,
                  }))
                }
              />
              District Boundaries
            </label>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="sidebar-section">
          <div className="section-label">Campus Type</div>
          <div className="legend-items">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.type} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: item.color }}
                />
                <div className="legend-text">
                  <span className="legend-name">{item.type}</span>
                  <span className="legend-desc">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Numeric Filters ── */}
        <div className="sidebar-section">
          <div
            className="section-label"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            Filters
            {filterCount > 0 && (
              <button
                className="map-filter-clear-btn"
                onClick={handleClearFilters}
              >
                Clear All
              </button>
            )}
          </div>
          <div className="map-filter-group">
            <label className="map-filter-label">Enrollment</label>
            <div className="map-filter-range">
              <input
                type="number"
                className="map-filter-input"
                placeholder="Min"
                defaultValue={filters.enrollMin}
                onChange={(e) =>
                  debouncedSetFilters('enrollMin', e.target.value)
                }
                key={'enrollMin-' + (filters.enrollMin === '' ? 'reset' : 'active')}
              />
              <span className="map-filter-dash">&ndash;</span>
              <input
                type="number"
                className="map-filter-input"
                placeholder="Max"
                defaultValue={filters.enrollMax}
                onChange={(e) =>
                  debouncedSetFilters('enrollMax', e.target.value)
                }
                key={'enrollMax-' + (filters.enrollMax === '' ? 'reset' : 'active')}
              />
            </div>
          </div>
          <div className="map-filter-group">
            <label className="map-filter-label">Districts Reached</label>
            <div className="map-filter-range">
              <input
                type="number"
                className="map-filter-input"
                placeholder="Min"
                defaultValue={filters.districtsMin}
                onChange={(e) =>
                  debouncedSetFilters('districtsMin', e.target.value)
                }
                key={'districtsMin-' + (filters.districtsMin === '' ? 'reset' : 'active')}
              />
              <span className="map-filter-dash">&ndash;</span>
              <input
                type="number"
                className="map-filter-input"
                placeholder="Max"
                defaultValue={filters.districtsMax}
                onChange={(e) =>
                  debouncedSetFilters('districtsMax', e.target.value)
                }
                key={'districtsMax-' + (filters.districtsMax === '' ? 'reset' : 'active')}
              />
            </div>
          </div>
        </div>

        {/* ── Summary Stats ── */}
        <div className="sidebar-section">
          <div className="section-label">
            Summary
            {filterCount > 0 && (
              <span className="map-filter-count">{filterCount}</span>
            )}
          </div>
          <div>
            <div className="stat-row">
              <span className="stat-label">TOTAL CAMPUSES</span>
              <span className="stat-value">
                {stats.total.toLocaleString()}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">AVG DISTRICTS REACHED</span>
              <span className="stat-value">{stats.avgDistricts}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
