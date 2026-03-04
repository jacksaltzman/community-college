import { useState } from 'react'
import SubNav from './SubNav'
import MapView from './map/MapView'
import CampusesTable from './data/CampusesTable'
import StatesTable from './data/StatesTable'
import DistrictsTable from './data/DistrictsTable'
import Methodology from './methodology/Methodology'

const TABS = [
  { key: 'map', label: 'Map' },
  { key: 'data', label: 'Data' },
  { key: 'methodology', label: 'Methodology' },
]

export default function Layout({ page, subView, params, navigate, data }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleTabClick = (tabKey) => {
    setMenuOpen(false)
    if (tabKey === 'methodology') {
      navigate(tabKey)
    } else {
      navigate(tabKey, subView)
    }
  }

  const hasSubNav = page === 'map' || page === 'data'

  return (
    <>
      {/* ── Top Navigation Bar ── */}
      <nav className="top-nav">
        <div className="nav-brand">
          <img
            src="/accountable_logo.avif"
            alt="Accountable"
            className="nav-brand-logo"
          />
          <span className="nav-brand-subtitle">
            Community College District Map
          </span>
        </div>

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
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Loading...
            </div>
          ) : data?.error ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'red',
              }}
            >
              Error: {data.error}
            </div>
          ) : (
            <>
              {page === 'map' && (
                <MapView
                  subView={subView}
                  data={data}
                  navigate={navigate}
                />
              )}
              {page === 'data' && subView === 'campuses' && (
                <CampusesTable
                  campuses={data?.campuses}
                  navigate={navigate}
                />
              )}
              {page === 'data' && subView === 'states' && (
                <StatesTable
                  campuses={data?.campuses}
                  navigate={navigate}
                />
              )}
              {page === 'data' && subView === 'districts' && (
                <DistrictsTable
                  campuses={data?.campuses}
                  navigate={navigate}
                />
              )}
              {page === 'methodology' && <Methodology />}
            </>
          )}
        </div>
      </div>
    </>
  )
}
