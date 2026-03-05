export const DIMENSIONS = [
  { id: 'senatorResponsiveness', label: 'Senator Responsiveness', scoreKey: 'senatorResponsivenessScore', fields: ['senator1LastMargin', 'senator2LastMargin', 'senator1NextElection', 'senator2NextElection'] },
  { id: 'civicEngagement', label: 'Civic Engagement', scoreKey: 'civicEngagementScore', fields: ['midtermTurnout2022'] },
  { id: 'senatorInfluence', label: 'Senator Influence', scoreKey: 'senatorInfluenceScore', fields: ['senator1TaxCommittees', 'senator2TaxCommittees'] },
  { id: 'taxDensity', label: 'Tax Density', scoreKey: 'taxDensityScore', fields: ['totalFilers', 'totalFedTaxPaidB'] },
  { id: 'eitcOpportunity', label: 'EITC Opportunity', scoreKey: 'eitcOpportunityScore', fields: ['eitcClaimsThousands', 'eitcParticipationRate', 'eitcUnclaimedRate'] },
  { id: 'urbanConcentration', label: 'Urban Concentration', scoreKey: 'urbanConcentrationScore', fields: ['urbanPopPct'] },
  { id: 'filingComplexity', label: 'Filing Complexity', scoreKey: 'filingComplexityScore', fields: [] },
  { id: 'digitalAdoption', label: 'Digital Adoption', scoreKey: 'digitalAdoptionScore', fields: [] },
  { id: 'youngProfConcentration', label: 'Young Prof Concentration', scoreKey: 'youngProfConcentrationScore', fields: ['youngProfessionalPop'] },
  { id: 'competitiveDistrictDensity', label: 'Competitive District Density', scoreKey: 'competitiveDistrictDensityScore', fields: [] },
]

export const DEFAULT_ACQ_WEIGHTS = {
  senatorResponsiveness: 3,
  civicEngagement: 20,
  senatorInfluence: 2,
  taxDensity: 5,
  eitcOpportunity: 0,
  urbanConcentration: 15,
  filingComplexity: 12,
  digitalAdoption: 10,
  youngProfConcentration: 33,
  competitiveDistrictDensity: 0,
}

export const DEFAULT_CIVIC_WEIGHTS = {
  senatorResponsiveness: 35,
  civicEngagement: 30,
  senatorInfluence: 18,
  taxDensity: 3,
  eitcOpportunity: 2,
  urbanConcentration: 1,
  filingComplexity: 0,
  digitalAdoption: 1,
  youngProfConcentration: 0,
  competitiveDistrictDensity: 10,
}

export const QUADRANT_COLORS = {
  'Launch Priority': '#2563EB',
  'Revenue Opportunity': '#16A34A',
  'Civic Beachhead': '#D97706',
  'Deprioritize': '#9CA3AF',
}

export const TIER_CUTOFFS = { tier1: 12, tier2: 30 }

export const AVAILABLE_RAW_FIELDS = [
  { key: 'totalFilers', label: 'Total Filers', numeric: true },
  { key: 'totalFedTaxPaidB', label: 'Fed Tax Paid ($B)', numeric: true },
  { key: 'adultPop18', label: 'Adult Pop (18+)', numeric: true },
  { key: 'midtermTurnout2022', label: '2022 Turnout %', numeric: true },
  { key: 'eitcClaimsThousands', label: 'EITC Claims (K)', numeric: true },
  { key: 'eitcUnclaimedRate', label: 'EITC Unclaimed %', numeric: true },
  { key: 'urbanPopPct', label: 'Urban Pop %', numeric: true },
  { key: 'youngProfessionalPop', label: 'Young Professionals', numeric: true },
  { key: 'collegeEnrollment', label: 'College Enrollment', numeric: true },
]
