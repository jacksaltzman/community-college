import { useState, useMemo, useCallback } from 'react'
import ScoringPanel from './ScoringPanel'
import TargetFiltersBar from './TargetFiltersBar'
import CompactRankedList from './CompactRankedList'
import QuadrantChart from './QuadrantChart'
import TargetMap from './TargetMap'
import useTargetScoring from '../../hooks/useTargetScoring'
import { DEFAULT_ACQ_WEIGHTS, DEFAULT_CIVIC_WEIGHTS } from './scoringDefaults'
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

  /* ── CSV export ── */
  const handleExport = useCallback(() => {
    const headers = ['State', 'Rank', 'Tier', 'Quadrant', 'Acquisition Score', 'Political Change Score', 'Composite SVS', 'CC Enrollment', 'Young Professionals', 'Districts']
    function csvEscape(val) {
      if (val == null) return ''
      const s = String(val)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.map(csvEscape).join(',')]
    filteredStates.forEach((s) => {
      lines.push([s.code, s.rank, s.tier, s.quadrant, s.acqScore, s.civicScore, s.composite, s.ccEnrollment, s.youngProfessionalPop || 0, s.districtCount].map(csvEscape).join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'target_states.csv'
    a.click()
    URL.revokeObjectURL(url)
    setToast('CSV exported')
  }, [filteredStates])

  /* ── Select state → navigate to map ── */
  const handleSelectState = useCallback(
    (code) => {
      navigate('map', 'states', { state: code })
    },
    [navigate],
  )

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
      />
      <div className="target-dashboard">
        <div className="target-dashboard-left">
          <CompactRankedList
            rankedStates={filteredStates}
            hoveredState={hoveredState}
            onHoverState={setHoveredState}
            onSelectState={handleSelectState}
          />
        </div>
        <div className="target-dashboard-right">
          <div className="target-dashboard-chart">
            <QuadrantChart
              rankedStates={filteredStates}
              medians={medians}
              hoveredState={hoveredState}
              onHoverState={setHoveredState}
            />
          </div>
          <div className="target-dashboard-map">
            <TargetMap
              rankedStates={filteredStates}
              hoveredState={hoveredState}
              onHoverState={setHoveredState}
            />
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
