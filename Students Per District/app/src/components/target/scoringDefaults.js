export const DIMENSIONS = [
  { id: 'senatorResponsiveness', label: 'Senator Responsiveness', scoreKey: 'senatorResponsivenessScore', fields: ['senator1LastMargin', 'senator2LastMargin', 'senator1NextElection', 'senator2NextElection'], desc: 'How electorally vulnerable senators are, based on last margins and upcoming elections', formula: 'MAX(senator\u2081, senator\u2082). Per senator: (PVI distance \u00d7 50% + margin tightness \u00d7 50%) \u00d7 cycle multiplier (1.3\u00d7 2026, 1.1\u00d7 2028, 0.9\u00d7 2030). Cap 100.' },
  { id: 'civicEngagement', label: 'Civic Engagement', scoreKey: 'civicEngagementScore', fields: ['midtermTurnout2022'], desc: 'Voter participation rate based on 2022 midterm turnout', formula: 'Min-max normalization of 2022 midterm VEP turnout across 50 states. Range: 0\u2013100.' },
  { id: 'senatorInfluence', label: 'Senator Influence', scoreKey: 'senatorInfluenceScore', fields: ['senator1TaxCommittees', 'senator2TaxCommittees'], desc: 'Senator committee positions relevant to tax and finance policy', formula: 'Tiered score by committee rank: Finance=100, Budget=90, Banking=75, SmallBiz=65, Other=55\u201360, None=10. +5 bonus if both senators serve on relevant committees.' },
  { id: 'taxDensity', label: 'Tax Density', scoreKey: 'taxDensityScore', fields: ['totalFilers', 'totalFedTaxPaidB'], desc: 'Concentration of tax filing activity and federal tax revenue', formula: 'Min-max normalization of average federal tax paid per filer (Total Fed Tax Paid / Total Filers). Range: 0\u2013100.' },
  { id: 'eitcOpportunity', label: 'EITC Opportunity', scoreKey: 'eitcOpportunityScore', fields: ['eitcClaimsThousands', 'eitcParticipationRate', 'eitcUnclaimedRate'], desc: 'Potential for EITC outreach based on claims volume and unclaimed benefits', formula: '50% \u00d7 min-max(EITC claim rate) + 50% \u00d7 min-max(unclaimed rate). Equal blend of participation and opportunity.' },
  { id: 'urbanConcentration', label: 'Urban Concentration', scoreKey: 'urbanConcentrationScore', fields: ['urbanPopPct'], desc: 'Urban population share as a proxy for market accessibility', formula: 'Min-max normalization of Census 2020 urban population percentage. Range: 0\u2013100.' },
  { id: 'filingComplexity', label: 'Filing Complexity', scoreKey: 'filingComplexityScore', fields: [], desc: 'Complexity of state tax filing requirements', formula: 'Tiered by state income tax type: no income tax = 0, flat rate = 50, graduated brackets = 100.' },
  { id: 'digitalAdoption', label: 'Digital Adoption', scoreKey: 'digitalAdoptionScore', fields: [], desc: 'Digital readiness and technology adoption rates', formula: 'Min-max normalization of FDIC fully-banked household rate. Range: 0\u2013100.' },
  { id: 'youngProfConcentration', label: 'Young Prof Concentration', scoreKey: 'youngProfConcentrationScore', fields: ['youngProfessionalPop'], desc: 'Concentration of young professionals in the target demographic', formula: 'Min-max normalization of ACS 2023 BA+ rate among adults 25\u201334. Range: 0\u2013100.' },
  { id: 'competitiveDistrictDensity', label: 'Competitive District Density', scoreKey: 'competitiveDistrictDensityScore', fields: [], desc: 'Number of politically competitive congressional districts', formula: 'Min-max normalization of fraction of districts with Cook PVI within \u00b18. Range: 0\u2013100.' },
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
