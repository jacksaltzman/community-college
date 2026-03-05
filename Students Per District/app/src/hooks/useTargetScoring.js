import { useMemo } from 'react'

/* ── Dimension ID → statesData score key mapping ── */
const DIMENSION_SCORE_KEYS = {
  senatorResponsiveness: 'senatorResponsivenessScore',
  civicEngagement: 'civicEngagementScore',
  senatorInfluence: 'senatorInfluenceScore',
  taxDensity: 'taxDensityScore',
  eitcOpportunity: 'eitcOpportunityScore',
  urbanConcentration: 'urbanConcentrationScore',
  filingComplexity: 'filingComplexityScore',
  digitalAdoption: 'digitalAdoptionScore',
  youngProfConcentration: 'youngProfConcentrationScore',
  competitiveDistrictDensity: 'competitiveDistrictDensityScore',
}

/* ── Helpers ── */

/** Normalize a weights object so values sum to 1.0. Entries with weight 0 are excluded. */
function normalizeWeights(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  if (total === 0) return {}
  return Object.fromEntries(entries.map(([k, w]) => [k, w / total]))
}

/** Compute weighted score for a single lens given normalized weights and a state's data. */
function lensScore(normalizedWeights, stateData) {
  let score = 0
  for (const [dimId, nw] of Object.entries(normalizedWeights)) {
    const scoreKey = DIMENSION_SCORE_KEYS[dimId]
    const val = scoreKey ? (stateData[scoreKey] ?? 0) : 0
    score += nw * val
  }
  return score
}

/** Percentile-rank an array of values (0-100 scale). Ties share the same percentile. */
function percentileRank(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return values.map((v) => {
    // Count how many values are strictly less than v
    let below = 0
    for (const s of sorted) {
      if (s < v) below++
      else break
    }
    return sorted.length > 1 ? (below / (sorted.length - 1)) * 100 : 50
  })
}

/** Compute the value at a given percentile (0-1) from a sorted array. */
function quantile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/* ── Main hook ── */

export default function useTargetScoring(statesData, campuses, config) {
  return useMemo(() => {
    if (!statesData || !config) {
      return { rankedStates: [], medians: { acq: 0, civic: 0 } }
    }

    const { alpha = 0.5, acquisitionWeights = {}, civicWeights = {}, customFields = [] } = config

    /* ── 1. Aggregate campus data by state ── */
    const campusAgg = {}
    if (campuses?.features) {
      campuses.features.forEach((f) => {
        const st = f.properties.state
        if (!st) return
        if (!campusAgg[st]) {
          campusAgg[st] = {
            ccEnrollment: 0,
            campusCount: 0,
            uniqueDistricts: new Set(),
          }
        }
        campusAgg[st].ccEnrollment += f.properties.enrollment || 0
        campusAgg[st].campusCount += 1
        const allDistricts = f.properties.all_districts
        if (allDistricts) {
          allDistricts.split('|').forEach((cd) => {
            cd = cd.trim()
            if (cd) campusAgg[st].uniqueDistricts.add(cd)
          })
        }
      })
    }

    /* ── 2. Normalize weights for each lens ── */
    const normAcq = normalizeWeights(acquisitionWeights)
    const normCivic = normalizeWeights(civicWeights)

    /* ── 3. Collect state codes (skip _meta, non-state keys, and territories without scores) ── */
    const stateCodes = Object.keys(statesData).filter(
      (k) => k !== '_meta' && k.length === 2 && statesData[k].civicEngagementScore !== undefined
    )

    /* ── 4. Compute custom field percentile ranks ── */
    const customPercentiles = {} // { fieldKey: { [stateCode]: percentile } }
    for (const cf of customFields) {
      const rawValues = stateCodes.map((code) => {
        const val = statesData[code]?.[cf.fieldKey]
        return typeof val === 'number' ? val : 0
      })
      const pctiles = percentileRank(rawValues)
      const map = {}
      stateCodes.forEach((code, i) => {
        map[code] = pctiles[i]
      })
      customPercentiles[cf.fieldKey] = map
    }

    /* ── 5. Score each state ── */
    const scored = stateCodes.map((code) => {
      const stateData = statesData[code] || {}
      const agg = campusAgg[code] || { ccEnrollment: 0, campusCount: 0, uniqueDistricts: new Set() }

      // Base lens scores from dimension weights
      let acqScore = lensScore(normAcq, stateData)
      let civicScore = lensScore(normCivic, stateData)

      // Add custom field contributions
      for (const cf of customFields) {
        const pctile = customPercentiles[cf.fieldKey]?.[code] ?? 0
        const w = cf.weight || 0
        if (w === 0) continue
        if (cf.lens === 'acquisition') {
          // Re-weight: treat custom weight as additional unnormalized weight
          // Blend into the score proportionally
          const totalAcqWeight = Object.values(acquisitionWeights).reduce((s, v) => s + v, 0) + w
          if (totalAcqWeight > 0) {
            const baseShare = (totalAcqWeight - w) / totalAcqWeight
            const customShare = w / totalAcqWeight
            acqScore = acqScore * baseShare + pctile * customShare
          }
        } else if (cf.lens === 'civic') {
          const totalCivicWeight = Object.values(civicWeights).reduce((s, v) => s + v, 0) + w
          if (totalCivicWeight > 0) {
            const baseShare = (totalCivicWeight - w) / totalCivicWeight
            const customShare = w / totalCivicWeight
            civicScore = civicScore * baseShare + pctile * customShare
          }
        }
      }

      const composite = alpha * acqScore + (1 - alpha) * civicScore

      return {
        code,
        name: code, // state abbreviation serves as name
        acqScore: Math.round(acqScore * 100) / 100,
        civicScore: Math.round(civicScore * 100) / 100,
        composite: Math.round(composite * 100) / 100,
        ccEnrollment: agg.ccEnrollment,
        campusCount: agg.campusCount,
        districtCount: agg.uniqueDistricts.size,
        ...stateData,
      }
    })

    /* ── 6. Sort by composite descending, assign ranks ── */
    scored.sort((a, b) => b.composite - a.composite)
    scored.forEach((s, i) => {
      s.rank = i + 1
    })

    /* ── 7. Compute medians at 60th percentile for quadrant thresholds ── */
    const acqSorted = [...scored].map((s) => s.acqScore).sort((a, b) => a - b)
    const civicSorted = [...scored].map((s) => s.civicScore).sort((a, b) => a - b)
    const acqMedian = quantile(acqSorted, 0.6)
    const civicMedian = quantile(civicSorted, 0.6)

    /* ── 8. Assign quadrants and tiers ── */
    scored.forEach((s) => {
      const acqAbove = s.acqScore >= acqMedian
      const civicAbove = s.civicScore >= civicMedian

      if (acqAbove && civicAbove) {
        s.quadrant = 'Launch Priority'
      } else if (acqAbove && !civicAbove) {
        s.quadrant = 'Revenue Opportunity'
      } else if (!acqAbove && civicAbove) {
        s.quadrant = 'Civic Beachhead'
      } else {
        s.quadrant = 'Deprioritize'
      }

      if (s.rank <= 12) {
        s.tier = 'T1'
      } else if (s.rank <= 30) {
        s.tier = 'T2'
      } else {
        s.tier = 'T3'
      }
    })

    return {
      rankedStates: scored,
      medians: { acq: acqMedian, civic: civicMedian },
    }
  }, [statesData, campuses, config])
}
