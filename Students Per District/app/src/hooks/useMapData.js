import { useState, useEffect } from 'react'

export function useMapData() {
  const [data, setData] = useState({
    campuses: null,
    districtsMeta: null,
    statesData: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function load() {
      try {
        const [campuses, districtsMeta] = await Promise.all([
          fetch('/data/campuses.geojson').then((r) => r.json()),
          fetch('/data/districts-meta.json').then((r) => r.json()),
        ])

        let statesData = null
        try {
          statesData = await fetch('/data/states.json').then((r) => {
            if (!r.ok) return null
            return r.json()
          })
        } catch (e) {
          /* states.json optional */
        }

        setData({
          campuses,
          districtsMeta,
          statesData,
          loading: false,
          error: null,
        })
      } catch (error) {
        console.error('Failed to load map data:', error)
        setData((prev) => ({ ...prev, loading: false, error: error.message }))
      }
    }
    load()
  }, [])

  return data
}
