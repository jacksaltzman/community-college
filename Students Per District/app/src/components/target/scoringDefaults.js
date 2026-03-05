export const DIMENSIONS = [
  { id: 'senatorResponsiveness', label: 'Senator Responsiveness', scoreKey: 'senatorResponsivenessScore', fields: ['senator1LastMargin', 'senator2LastMargin', 'senator1NextElection', 'senator2NextElection'], desc: 'How electorally vulnerable senators are, based on last margins and upcoming elections' },
  { id: 'civicEngagement', label: 'Civic Engagement', scoreKey: 'civicEngagementScore', fields: ['midtermTurnout2022'], desc: 'Voter participation rate based on 2022 midterm turnout' },
  { id: 'senatorInfluence', label: 'Senator Influence', scoreKey: 'senatorInfluenceScore', fields: ['senator1TaxCommittees', 'senator2TaxCommittees'], desc: 'Senator committee positions relevant to tax and finance policy' },
  { id: 'taxDensity', label: 'Tax Density', scoreKey: 'taxDensityScore', fields: ['totalFilers', 'totalFedTaxPaidB'], desc: 'Concentration of tax filing activity and federal tax revenue' },
  { id: 'eitcOpportunity', label: 'EITC Opportunity', scoreKey: 'eitcOpportunityScore', fields: ['eitcClaimsThousands', 'eitcParticipationRate', 'eitcUnclaimedRate'], desc: 'Potential for EITC outreach based on claims volume and unclaimed benefits' },
  { id: 'urbanConcentration', label: 'Urban Concentration', scoreKey: 'urbanConcentrationScore', fields: ['urbanPopPct'], desc: 'Urban population share as a proxy for market accessibility' },
  { id: 'filingComplexity', label: 'Filing Complexity', scoreKey: 'filingComplexityScore', fields: [], desc: 'Complexity of state tax filing requirements' },
  { id: 'digitalAdoption', label: 'Digital Adoption', scoreKey: 'digitalAdoptionScore', fields: [], desc: 'Digital readiness and technology adoption rates' },
  { id: 'youngProfConcentration', label: 'Young Prof Concentration', scoreKey: 'youngProfConcentrationScore', fields: ['youngProfessionalPop'], desc: 'Concentration of young professionals in the target demographic' },
  { id: 'competitiveDistrictDensity', label: 'Competitive District Density', scoreKey: 'competitiveDistrictDensityScore', fields: [], desc: 'Number of politically competitive congressional districts' },
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

export const FIELD_LABELS = {
  senator1LastMargin: 'Senator 1 Last Margin',
  senator2LastMargin: 'Senator 2 Last Margin',
  senator1NextElection: 'Senator 1 Next Election',
  senator2NextElection: 'Senator 2 Next Election',
  midtermTurnout2022: '2022 Midterm Turnout %',
  senator1TaxCommittees: 'Senator 1 Tax Committees',
  senator2TaxCommittees: 'Senator 2 Tax Committees',
  totalFilers: 'Total Filers',
  totalFedTaxPaidB: 'Fed Tax Paid ($B)',
  eitcClaimsThousands: 'EITC Claims (K)',
  eitcParticipationRate: 'EITC Participation Rate',
  eitcUnclaimedRate: 'EITC Unclaimed %',
  urbanPopPct: 'Urban Pop %',
  youngProfessionalPop: 'Young Professionals',
}

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
