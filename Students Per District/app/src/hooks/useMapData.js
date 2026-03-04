import { useState, useEffect } from 'react'

export function useMapData() {
  const [data, setData] = useState({
    campuses: null,
    districts: null,
    statesGeo: null,
    statesData: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function load() {
      try {
        const [campuses, districts] = await Promise.all([
          fetch('/data/campuses.geojson').then((r) => r.json()),
          fetch('/data/districts.geojson').then((r) => r.json()),
        ])

        let statesGeo = null
        let statesData = null

        try {
          statesGeo = await fetch('/data/states.geojson').then((r) => {
            if (!r.ok) return null
            return r.json()
          })
        } catch (e) {
          /* states.geojson doesn't exist yet */
        }

        try {
          statesData = await fetch('/data/states.json').then((r) => {
            if (!r.ok) return null
            return r.json()
          })
        } catch (e) {
          /* states.json doesn't exist yet */
        }

        setData({
          campuses,
          districts,
          statesGeo,
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
