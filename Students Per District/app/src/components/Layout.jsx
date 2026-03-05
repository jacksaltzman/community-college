import { useState } from 'react'
import SubNav from './SubNav'
import MapView from './map/MapView'
import CampusesTable from './data/CampusesTable'
import StatesTable from './data/StatesTable'
import DistrictsTable from './data/DistrictsTable'
import Methodology from './methodology/Methodology'
import TargetView from './target/TargetView'

const TABS = [
  { key: 'map', label: 'Map' },
  { key: 'data', label: 'Data' },
  { key: 'target', label: 'Target' },
  { key: 'methodology', label: 'Methodology' },
]

export default function Layout({ page, subView, params, navigate, data }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleTabClick = (tabKey) => {
    setMenuOpen(false)
    if (tabKey === 'target') {
      navigate(tabKey)
    } else {
      navigate(tabKey, subView)
    }
  }

  const hasSubNav = page === 'map' || page === 'data' || page === 'methodology'

  return (
    <>
      {/* ── Top Navigation Bar ── */}
      <nav className="top-nav">
        <a
          className="nav-brand"
          href="#map/states"
          onClick={(e) => {
            e.preventDefault()
            navigate('map', 'states')
          }}
        >
          <img
            src="/accountable_logo.avif"
            alt="Accountable"
            className="nav-brand-logo"
          />
          <span className="nav-brand-subtitle" />
        </a>

        {/* Desktop tabs */}
        <div className="nav-tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`nav-tab${page === key ? ' active' : ''}`}
              onClick={() => handleTabClick(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* ── Mobile Dropdown ── */}
      <div className={`nav-mobile-dropdown${menuOpen ? ' open' : ''}`}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`nav-tab${page === key ? ' active' : ''}`}
            onClick={() => handleTabClick(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Page Content ── */}
      <div className="app-container">
        {hasSubNav && (
          <SubNav subView={subView} page={page} navigate={navigate} />
        )}

        <div className="page-content">
          {data?.loading ? (
            <div className="page-status">
              <div className="page-status-spinner" />
              <span className="page-status-text">Loading data&hellip;</span>
            </div>
          ) : data?.error ? (
            <div className="page-status page-status-error">
              <span className="page-status-text">Error: {data.error}</span>
            </div>
          ) : (
            <>
              {/* MapView stays mounted (hidden) to avoid Mapbox GL teardown errors */}
              <div style={{ display: page === 'map' ? 'contents' : 'none' }}>
                <MapView
                  subView={subView}
                  data={data}
                  navigate={navigate}
                  params={params}
                  isVisible={page === 'map'}
                />
              </div>
              {page === 'data' && subView === 'campuses' && (
                <CampusesTable
                  campuses={data?.campuses}
                  navigate={navigate}
                  params={params}
                  sources={data?.sources}
                />
              )}
              {page === 'data' && subView === 'states' && (
                <StatesTable
                  campuses={data?.campuses}
                  statesData={data?.statesData}
                  navigate={navigate}
                  params={params}
                  sources={data?.sources}
                />
              )}
              {page === 'data' && subView === 'districts' && (
                <DistrictsTable
                  campuses={data?.campuses}
                  districtsMeta={data?.districtsMeta}
                  navigate={navigate}
                  params={params}
                  sources={data?.sources}
                />
              )}
              {page === 'methodology' && <Methodology subView={subView} sources={data?.sources} />}
              {page === 'target' && (
                <TargetView data={data} navigate={navigate} params={params} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
