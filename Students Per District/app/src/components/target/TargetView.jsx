import { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import ScoringPanel from './ScoringPanel'
import TargetFiltersBar from './TargetFiltersBar'
import CompactRankedList from './CompactRankedList'
import StateDrillDown from './StateDrillDown'
import QuadrantChart from './QuadrantChart'
import TargetMap from './TargetMap'
import useTargetScoring from '../../hooks/useTargetScoring'
import { DEFAULT_ACQ_WEIGHTS, DEFAULT_CIVIC_WEIGHTS } from './scoringDefaults'
import { STATE_NAMES } from '../../utils/stateNames'
import Toast from '../Toast'
import '../../styles/target.css'

export default function TargetView({ data, navigate, params }) {
  const [config, setConfig] = useState({
    alpha: 0.5,
    acquisitionWeights: { ...DEFAULT_ACQ_WEIGHTS },
    civicWeights: { ...DEFAULT_CIVIC_WEIGHTS },
    customFields: [],
  })
  const [filters, setFilters] = useState({
    electionCycle: '',
    senatorParty: '',
    tier: '',
    quadrant: '',
    ccEnrollmentMin: '',
    ccEnrollmentMax: '',
    districtCountMin: '',
    districtCountMax: '',
    compositeMin: '',
    compositeMax: '',
    youngProfessionalPopMin: '',
    youngProfessionalPopMax: '',
  })
  const [scoringCollapsed, setScoringCollapsed] = useState(true)
  const [hoveredState, setHoveredState] = useState(null)
  const [toast, setToast] = useState(null)
  const [selectedState, setSelectedState] = useState(null)

  const { rankedStates, medians } = useTargetScoring(data?.statesData, data?.campuses, config)

  /* ── Apply filters to ranked states ── */
  const filteredStates = useMemo(() => {
    let result = rankedStates
    if (filters.electionCycle) {
      const year = parseInt(filters.electionCycle)
      result = result.filter((s) => s.senator1NextElection === year || s.senator2NextElection === year)
    }
    if (filters.senatorParty) {
      result = result.filter((s) => s.senator1Party === filters.senatorParty || s.senator2Party === filters.senatorParty)
    }
    if (filters.tier) {
      result = result.filter((s) => s.tier === filters.tier)
    }
    if (filters.quadrant) {
      result = result.filter((s) => s.quadrant === filters.quadrant)
    }
    const numericFilters = [
      { key: 'ccEnrollment', min: filters.ccEnrollmentMin, max: filters.ccEnrollmentMax },
      { key: 'districtCount', min: filters.districtCountMin, max: filters.districtCountMax },
      { key: 'composite', min: filters.compositeMin, max: filters.compositeMax },
      { key: 'youngProfessionalPop', min: filters.youngProfessionalPopMin, max: filters.youngProfessionalPopMax },
    ]
    numericFilters.forEach(({ key, min, max }) => {
      if (min !== '') result = result.filter((s) => (s[key] || 0) >= Number(min))
      if (max !== '') result = result.filter((s) => (s[key] || 0) <= Number(max))
    })
    return result
  }, [rankedStates, filters])

  /* ── Drill-down: compute state detail data when a state is selected ── */
  const selectedStateData = useMemo(() => {
    if (!selectedState) return null
    const stateInfo = filteredStates.find((s) => s.code === selectedState)
    if (!stateInfo) return null

    // Gather districts for this state
    const districtMap = {}
    if (data?.districtsMeta?.districts) {
      Object.entries(data.districtsMeta.districts).forEach(([cd, meta]) => {
        const st = meta.state || cd.split('-')[0]
        if (st !== selectedState) return
        districtMap[cd] = { cd, meta, campusCount: 0, ccEnrollment: 0, campuses: [] }
      })
    }

    // Gather campuses, link to districts
    if (data?.campuses?.features) {
      data.campuses.features.forEach((f) => {
        const p = f.properties
        if (p.state !== selectedState) return
        const allDist = p.all_districts
        if (allDist) {
          allDist.split('|').forEach((cd) => {
            cd = cd.trim()
            if (cd && districtMap[cd]) {
              districtMap[cd].campuses.push(p)
              districtMap[cd].campusCount += 1
              districtMap[cd].ccEnrollment += p.enrollment || 0
            }
          })
        }
      })
    }

    const districts = Object.values(districtMap).sort((a, b) => a.cd.localeCompare(b.cd))
    return { stateInfo, districts }
  }, [selectedState, filteredStates, data])

  /* ── Multi-tab Excel export ── */
  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new()

    // Determine scope
    const exportStates = selectedState
      ? filteredStates.filter((s) => s.code === selectedState)
      : filteredStates
    const stateCodes = new Set(exportStates.map((s) => s.code))

    // Tab 1: States
    const statesRows = exportStates.map((s) => ({
      State: s.code,
      'State Name': STATE_NAMES[s.code] || s.code,
      Rank: s.rank,
      Tier: s.tier,
      Quadrant: s.quadrant,
      'Acquisition Score': s.acqScore,
      'Political Change Score': s.civicScore,
      'Composite SVS': s.composite,
      'CC Enrollment': s.ccEnrollment,
      'Campus Count': s.campusCount,
      Districts: s.districtCount,
      'Young Professionals': s.youngProfessionalPop || 0,
      'Senator 1': s.senator1 || '',
      'Senator 1 Party': s.senator1Party || '',
      'Senator 2': s.senator2 || '',
      'Senator 2 Party': s.senator2Party || '',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statesRows), 'States')

    // Tab 2: Districts
    const districtRows = []
    if (data?.districtsMeta?.districts) {
      Object.entries(data.districtsMeta.districts).forEach(([cd, meta]) => {
        const st = meta.state || cd.split('-')[0]
        if (!stateCodes.has(st)) return
        districtRows.push({
          District: cd,
          State: st,
          Member: meta.member || '',
          Party: meta.party || '',
          'Cook PVI': meta.cook_pvi || '',
          'Median Income': meta.median_income || '',
          'Poverty Rate': meta.poverty_rate || '',
          Committees: meta.committees || '',
          'Coalition Threshold': meta.coalition_threshold || '',
        })
      })
    }
    districtRows.sort((a, b) => a.District.localeCompare(b.District))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(districtRows), 'Districts')

    // Tab 3: Schools
    const schoolRows = []
    if (data?.campuses?.features) {
      data.campuses.features.forEach((f) => {
        const p = f.properties
        if (!stateCodes.has(p.state)) return
        schoolRows.push({
          Name: p.name || '',
          City: p.city || '',
          State: p.state || '',
          Enrollment: p.enrollment || 0,
          'Campus Type': p.campus_type || '',
          'Primary District': p.primary_district || '',
          'All Districts': p.all_districts || '',
          'Districts Reached': p.districts_reached || 0,
        })
      })
    }
    schoolRows.sort((a, b) => (a.State || '').localeCompare(b.State || '') || (a.Name || '').localeCompare(b.Name || ''))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schoolRows), 'Schools')

    // Download
    const filename = selectedState
      ? `target_${selectedState.toLowerCase()}.xlsx`
      : 'target_all_states.xlsx'
    XLSX.writeFile(wb, filename)
    setToast(selectedState ? `Exported ${selectedState} data` : 'Excel exported')
  }, [filteredStates, selectedState, data])

  /* ── Select state → drill down in-tab ── */
  const handleSelectState = useCallback((code) => {
    setSelectedState(code)
  }, [])

  const handleBackToList = useCallback(() => {
    setSelectedState(null)
  }, [])

  if (data?.loading) return null

  return (
    <div className="target-page-v2">
      <ScoringPanel
        config={config}
        onConfigChange={setConfig}
        collapsed={scoringCollapsed}
        onToggleCollapsed={() => setScoringCollapsed((p) => !p)}
      />
      <TargetFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        rankedStates={rankedStates}
        resultCount={filteredStates.length}
        totalCount={rankedStates.length}
        onExport={handleExport}
        selectedState={selectedState}
      />
      <div className="target-dashboard">
        <div className="target-dashboard-left">
          <CompactRankedList
            rankedStates={filteredStates}
            hoveredState={hoveredState}
            onHoverState={setHoveredState}
            onSelectState={handleSelectState}
            selectedState={selectedState}
            selectedStateData={selectedStateData}
          />
        </div>
        <div className="target-dashboard-right">
          <div className="target-dashboard-chart">
            <span className="target-panel-label">Quadrant Map</span>
            <QuadrantChart
              rankedStates={filteredStates}
              medians={medians}
              hoveredState={hoveredState}
              onHoverState={setHoveredState}
            />
          </div>
          <div className="target-dashboard-map">
            <span className="target-panel-label">Geographic View</span>
            <TargetMap
              rankedStates={filteredStates}
              hoveredState={hoveredState}
              onHoverState={setHoveredState}
              onSelectState={handleSelectState}
              campuses={data?.campuses}
              selectedState={selectedState}
              districtsMeta={data?.districtsMeta}
            />
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
