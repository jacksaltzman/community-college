import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import TargetFilters from './TargetFilters'
import TargetResults from './TargetResults'
import Toast from '../Toast'
import '../../styles/target.css'

const INITIAL_STATE_FILTERS = {
  pvi: '',
  senatorElection: '',
  senatorParty: [],
  enrollMin: '',
  enrollMax: '',
  turnoutMin: '',
  turnoutMax: '',
  eitcMin: '',
  eitcMax: '',
}

const INITIAL_DISTRICT_FILTERS = {
  pvi: '',
  repParty: [],
  enrollMin: '',
  enrollMax: '',
  campusMin: '',
  campusMax: '',
}

const INITIAL_CAMPUS_FILTERS = {
  enrollMin: '',
  enrollMax: '',
  campusTypes: [],
  districtsMin: '',
  districtsMax: '',
}

export default function TargetView({ data, navigate, params }) {
  const [stateFilters, setStateFilters] = useState(INITIAL_STATE_FILTERS)
  const [districtFilters, setDistrictFilters] = useState(INITIAL_DISTRICT_FILTERS)
  const [campusFilters, setCampusFilters] = useState(INITIAL_CAMPUS_FILTERS)
  const [toast, setToast] = useState(null)

  // Serialize filters to URL
  useEffect(() => {
    const p = {}
    // State filters
    if (stateFilters.pvi) p.spvi = stateFilters.pvi
    if (stateFilters.senatorElection) p.sse = stateFilters.senatorElection
    if (stateFilters.senatorParty.length) p.ssp = stateFilters.senatorParty.join(',')
    if (stateFilters.enrollMin !== '') p.semin = stateFilters.enrollMin
    if (stateFilters.enrollMax !== '') p.semax = stateFilters.enrollMax
    if (stateFilters.turnoutMin !== '') p.stmin = stateFilters.turnoutMin
    if (stateFilters.turnoutMax !== '') p.stmax = stateFilters.turnoutMax
    if (stateFilters.eitcMin !== '') p.simin = stateFilters.eitcMin
    if (stateFilters.eitcMax !== '') p.simax = stateFilters.eitcMax
    // District filters
    if (districtFilters.pvi) p.dpvi = districtFilters.pvi
    if (districtFilters.repParty.length) p.drp = districtFilters.repParty.join(',')
    if (districtFilters.enrollMin !== '') p.demin = districtFilters.enrollMin
    if (districtFilters.enrollMax !== '') p.demax = districtFilters.enrollMax
    if (districtFilters.campusMin !== '') p.dcmin = districtFilters.campusMin
    if (districtFilters.campusMax !== '') p.dcmax = districtFilters.campusMax
    // Campus filters
    if (campusFilters.enrollMin !== '') p.cemin = campusFilters.enrollMin
    if (campusFilters.enrollMax !== '') p.cemax = campusFilters.enrollMax
    if (campusFilters.campusTypes.length) p.cct = campusFilters.campusTypes.join(',')
    if (campusFilters.districtsMin !== '') p.cdmin = campusFilters.districtsMin
    if (campusFilters.districtsMax !== '') p.cdmax = campusFilters.districtsMax

    const qs = Object.entries(p)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    const hash = qs ? `#target?${qs}` : '#target'
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [stateFilters, districtFilters, campusFilters])

  // Restore filters from URL on mount
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current || !params || Object.keys(params).length === 0) return
    initializedRef.current = true

    // State filters
    const sf = { ...INITIAL_STATE_FILTERS }
    if (params.spvi) sf.pvi = params.spvi
    if (params.sse) sf.senatorElection = params.sse
    if (params.ssp) sf.senatorParty = params.ssp.split(',')
    if (params.semin) sf.enrollMin = params.semin
    if (params.semax) sf.enrollMax = params.semax
    if (params.stmin) sf.turnoutMin = params.stmin
    if (params.stmax) sf.turnoutMax = params.stmax
    if (params.simin) sf.eitcMin = params.simin
    if (params.simax) sf.eitcMax = params.simax
    setStateFilters(sf)

    // District filters
    const df = { ...INITIAL_DISTRICT_FILTERS }
    if (params.dpvi) df.pvi = params.dpvi
    if (params.drp) df.repParty = params.drp.split(',')
    if (params.demin) df.enrollMin = params.demin
    if (params.demax) df.enrollMax = params.demax
    if (params.dcmin) df.campusMin = params.dcmin
    if (params.dcmax) df.campusMax = params.dcmax
    setDistrictFilters(df)

    // Campus filters
    const cf = { ...INITIAL_CAMPUS_FILTERS }
    if (params.cemin) cf.enrollMin = params.cemin
    if (params.cemax) cf.enrollMax = params.cemax
    if (params.cct) cf.campusTypes = params.cct.split(',')
    if (params.cdmin) cf.districtsMin = params.cdmin
    if (params.cdmax) cf.districtsMax = params.cdmax
    setCampusFilters(cf)
  }, [params])

  const campusesData = data?.campuses
  const districtsMeta = data?.districtsMeta
  const statesData = data?.statesData

  const parsePVI = useCallback((s) => {
    if (!s || s === 'EVEN') return 0
    const m = s.match(/^([DR])\+(\d+)$/)
    if (!m) return 0
    return m[1] === 'D' ? -Number(m[2]) : Number(m[2])
  }, [])

  const matchesPVI = useCallback((pviStr, filter) => {
    if (!filter) return true
    const n = parsePVI(pviStr)
    switch (filter) {
      case 'D-lean': return n < -5
      case 'Swing':  return n >= -5 && n <= 5
      case 'R-lean': return n > 5
      default: return true
    }
  }, [parsePVI])

  const { filteredStates, summary } = useMemo(() => {
    if (!campusesData?.features || !districtsMeta?.districts) {
      return { filteredStates: [], summary: { states: 0, districts: 0, campuses: 0 } }
    }

    // 1. Filter campuses
    const cf = campusFilters
    const survivingCampuses = campusesData.features.filter((f) => {
      const p = f.properties
      if (cf.enrollMin !== '' && (p.enrollment || 0) < parseFloat(cf.enrollMin)) return false
      if (cf.enrollMax !== '' && (p.enrollment || 0) > parseFloat(cf.enrollMax)) return false
      if (cf.campusTypes.length > 0 && !cf.campusTypes.includes(p.campus_type)) return false
      if (cf.districtsMin !== '' && (p.districts_reached || 0) < parseFloat(cf.districtsMin)) return false
      if (cf.districtsMax !== '' && (p.districts_reached || 0) > parseFloat(cf.districtsMax)) return false
      return true
    })

    // 2. Group campuses by district
    const districtMap = {}
    survivingCampuses.forEach((f) => {
      const allDistricts = f.properties.all_districts
      if (!allDistricts) return
      allDistricts.split('|').forEach((cd) => {
        cd = cd.trim()
        if (!cd) return
        if (!districtMap[cd]) districtMap[cd] = { campuses: [], enrollment: 0, campusCount: 0 }
        districtMap[cd].campuses.push(f)
        districtMap[cd].enrollment += f.properties.enrollment || 0
        districtMap[cd].campusCount += 1
      })
    })

    // 3. Filter districts
    const df = districtFilters
    const survivingDistricts = {}
    Object.entries(districtMap).forEach(([cd, dm]) => {
      const meta = districtsMeta.districts[cd] || {}
      if (!matchesPVI(meta.cook_pvi, df.pvi)) return
      if (df.repParty.length > 0 && !df.repParty.includes(meta.party)) return
      if (df.enrollMin !== '' && dm.enrollment < parseFloat(df.enrollMin)) return
      if (df.enrollMax !== '' && dm.enrollment > parseFloat(df.enrollMax)) return
      if (df.campusMin !== '' && dm.campusCount < parseFloat(df.campusMin)) return
      if (df.campusMax !== '' && dm.campusCount > parseFloat(df.campusMax)) return
      survivingDistricts[cd] = { ...dm, meta }
    })

    // 4. Group districts by state
    const stateMap = {}
    Object.entries(survivingDistricts).forEach(([cd, d]) => {
      const st = d.meta.state || cd.split('-')[0]
      if (!stateMap[st]) stateMap[st] = { districts: {}, enrollment: 0, campusCount: 0, districtCount: 0 }
      stateMap[st].districts[cd] = d
      stateMap[st].enrollment += d.enrollment
      stateMap[st].campusCount += d.campusCount
      stateMap[st].districtCount += 1
    })

    // 5. Filter states
    const sf = stateFilters
    const finalStates = []
    Object.entries(stateMap).forEach(([st, sm]) => {
      const stInfo = statesData?.[st] || {}
      if (!matchesPVI(stInfo.cookPVI, sf.pvi)) return
      if (sf.senatorElection) {
        const year = parseInt(sf.senatorElection)
        const s1 = stInfo.senator1NextElection === year
        const s2 = stInfo.senator2NextElection === year
        if (!s1 && !s2) return
      }
      if (sf.senatorParty.length > 0) {
        const parties = new Set([stInfo.senator1Party, stInfo.senator2Party].filter(Boolean))
        if (!sf.senatorParty.some((p) => parties.has(p))) return
      }
      if (sf.enrollMin !== '' && sm.enrollment < parseFloat(sf.enrollMin)) return
      if (sf.enrollMax !== '' && sm.enrollment > parseFloat(sf.enrollMax)) return
      if (sf.turnoutMin !== '' && (stInfo.midtermTurnout2022 ?? 100) < parseFloat(sf.turnoutMin)) return
      if (sf.turnoutMax !== '' && (stInfo.midtermTurnout2022 ?? 0) > parseFloat(sf.turnoutMax)) return
      if (sf.eitcMin !== '' && (stInfo.eitcUnclaimedRate ?? 100) < parseFloat(sf.eitcMin)) return
      if (sf.eitcMax !== '' && (stInfo.eitcUnclaimedRate ?? 0) > parseFloat(sf.eitcMax)) return

      finalStates.push({ code: st, stInfo, ...sm })
    })

    finalStates.sort((a, b) => a.code.localeCompare(b.code))

    let totalCampuses = 0
    let totalEnrollment = 0
    const seenCampuses = new Set()
    finalStates.forEach((s) => {
      Object.values(s.districts).forEach((d) => {
        d.campuses.forEach((c) => {
          const id = c.properties.unitid
          if (!seenCampuses.has(id)) {
            seenCampuses.add(id)
            totalCampuses++
            totalEnrollment += c.properties.enrollment || 0
          }
        })
      })
    })

    return {
      filteredStates: finalStates,
      summary: {
        states: finalStates.length,
        districts: finalStates.reduce((s, st) => s + st.districtCount, 0),
        campuses: totalCampuses,
        enrollment: totalEnrollment,
      },
    }
  }, [campusesData, districtsMeta, statesData, campusFilters, districtFilters, stateFilters, matchesPVI])

  const handleReset = useCallback(() => {
    setStateFilters(INITIAL_STATE_FILTERS)
    setDistrictFilters(INITIAL_DISTRICT_FILTERS)
    setCampusFilters(INITIAL_CAMPUS_FILTERS)
    window.history.replaceState(null, '', '#target')
  }, [])

  const handleExport = useCallback(() => {
    const headers = [
      'State', 'District', 'Campus Name', 'City', 'Campus Type',
      'Enrollment', 'Districts Reached',
      'Cook PVI (State)', 'Cook PVI (District)', 'Representative', 'Party',
    ]

    function csvEscape(val) {
      if (val == null) return ''
      const s = String(val)
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s
    }

    const lines = [headers.map(csvEscape).join(',')]
    const seen = new Set()

    filteredStates.forEach((st) => {
      const stInfo = st.stInfo || {}
      Object.entries(st.districts).forEach(([cd, d]) => {
        d.campuses.forEach((c) => {
          const key = `${cd}-${c.properties.unitid}`
          if (seen.has(key)) return
          seen.add(key)
          const p = c.properties
          lines.push([
            st.code, cd, p.name, p.city, p.campus_type,
            p.enrollment, p.districts_reached,
            stInfo.cookPVI || '', d.meta.cook_pvi || '',
            d.meta.member || '', d.meta.party || '',
          ].map(csvEscape).join(','))
        })
      })
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'target_campuses.csv'
    a.click()
    URL.revokeObjectURL(url)
    setToast('CSV exported')
  }, [filteredStates])

  if (data?.loading) return null

  return (
    <div className="target-page">
      <TargetFilters
        stateFilters={stateFilters}
        setStateFilters={setStateFilters}
        districtFilters={districtFilters}
        setDistrictFilters={setDistrictFilters}
        campusFilters={campusFilters}
        setCampusFilters={setCampusFilters}
        onReset={handleReset}
        onExport={handleExport}
        summary={summary}
      />
      <TargetResults
        filteredStates={filteredStates}
        summary={summary}
        navigate={navigate}
        onExport={handleExport}
      />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
