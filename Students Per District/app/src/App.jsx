import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import { useMapData } from './hooks/useMapData'

const VALID_PAGES = ['map', 'data', 'target', 'methodology']
const VALID_SUBVIEWS = ['states', 'districts', 'campuses']

function parseHash() {
  const hash = window.location.hash.replace('#', '')
  const [path, queryStr] = hash.split('?')
  const parts = path.split('/')
  const page = VALID_PAGES.includes(parts[0]) ? parts[0] : 'map'
  const subView = VALID_SUBVIEWS.includes(parts[1]) ? parts[1] : 'states'
  const params = {}
  if (queryStr) {
    queryStr.split('&').forEach((pair) => {
      const [k, v] = pair.split('=')
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v)
    })
  }
  return { page, subView, params }
}

export default function App() {
  const [page, setPage] = useState('map')
  const [subView, setSubView] = useState('states')
  const [params, setParams] = useState({})
  const data = useMapData()

  const syncFromHash = useCallback(() => {
    const parsed = parseHash()
    setPage(parsed.page)
    setSubView(parsed.subView)
    setParams(parsed.params)
  }, [])

  useEffect(() => {
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [syncFromHash])

  const navigate = useCallback((newPage, newSubView, newParams) => {
    let hash = `#${newPage}`
    if (newSubView && (newPage === 'map' || newPage === 'data' || newPage === 'methodology')) {
      hash += `/${newSubView}`
    }
    if (newParams && Object.keys(newParams).length > 0) {
      const qs = Object.entries(newParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      if (qs) hash += `?${qs}`
    }
    window.location.hash = hash
  }, [])

  return (
    <Layout
      page={page}
      subView={subView}
      params={params}
      navigate={navigate}
      data={data}
    />
  )
}
