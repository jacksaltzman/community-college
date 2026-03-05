# Target Tab Design

**Date:** 2026-03-05
**Status:** Approved
**Audience:** Accountable internal team (not public-facing)
**Purpose:** Interactive state-level strategic targeting tool with adjustable scoring model, based on the 50-State Analysis v43.6 spreadsheet

---

## Overview

The Target tab lets the team rank all 50 states (+DC) by configurable Acquisition and Civic Leverage scores, filter by hard constraints, and drill into districts within each state. It recreates the spreadsheet's two-lens scoring model in an interactive UI where users can adjust dimension weights and see rankings update live.

## Architecture: Score → Filter → Rank → Drill Down

### Layer 1: Scoring Model Panel (collapsible, top of page)

A collapsible section at the top of the Target tab. Default state: expanded on first visit, remembers collapsed/expanded state.

**Layout:** Two side-by-side columns — Acquisition Score (left) and Civic Leverage Score (right).

**Alpha slider** spans both columns at the top. Controls the blend between lenses in the composite SVS score. Default: 50/50. Formula: `SVS = alpha * Acquisition + (1 - alpha) * Civic`.

**Each column lists the 10 dimensions as rows.** Each row contains:
- Toggle checkbox (on/off) — off sets weight to 0 for this lens
- Dimension name
- Weight slider (0-100) with numeric display
- Expand chevron to reveal underlying raw fields

**A dimension can have different weights in each lens.** Weights auto-normalize within each column so they always sum to 100%.

**Default weights (matching v43.6 spreadsheet):**

| # | Dimension | Acquisition | Civic Leverage |
|---|-----------|-------------|----------------|
| 1 | Senator Responsiveness | 3% | 35% |
| 2 | Civic Engagement | 20% | 30% |
| 3 | Senator Influence | 2% | 18% |
| 4 | Tax Density | 5% | 3% |
| 5 | EITC Opportunity | 0% | 2% |
| 6 | Urban Concentration | 15% | 1% |
| 7 | Filing Complexity | 12% | 0% |
| 8 | Digital Adoption | 10% | 1% |
| 9 | Young Prof Concentration | 33% | 0% |
| 10 | Competitive District Density | 0% | 10% |

**Dimension expansion:** Clicking the expand chevron on any dimension reveals the raw fields that compose its score. For example, expanding "EITC Opportunity" shows: EITC Claims, EITC Participation Rate, EITC Unclaimed Rate, EITC Claim Rate. Users can see but not edit the pre-computed dimension score formula (it mirrors the spreadsheet). Future: allow overriding individual field weights within a dimension.

**"+ Add field" button:** At the bottom of each column. Opens a dropdown of all available raw fields from states.json. Adding a field creates a new weighted dimension row. If the selected field already contributes to an existing dimension, a yellow warning appears: "This field is already included in [Dimension Name] (weight: X%)."

**"Reset to defaults" link:** Restores v43.6 spreadsheet weights.

### Layer 2: Filters Bar

A horizontal bar below the scoring panel, matching the Airtable-style toolbar on the Data tab.

**Filter controls:**
- **Election Cycle:** All / 2026 / 2028 / 2030 — filters to states where at least one senator faces that election
- **Senator Party:** All / D / R / I — filters to states with at least one senator of that party
- **Tier:** All / Tier 1 / Tier 2 / Tier 3 — computed from current composite rank (1-12, 13-30, 31+)
- **Quadrant:** All / Launch Priority / Revenue Opportunity / Civic Beachhead / Deprioritize

Active filters show a count badge. "Clear all" link resets. Count updates: "12 of 51 states."

**Key behavior:** Tier and Quadrant are computed from the current scoring weights, so they update live as weights change. A filter on "Launch Priority" applies against the recalculated quadrant assignments.

### Layer 3: Results Table

Full-width ranked table, same visual style as Data tab tables. Supports the same Airtable-style toolbar features (hide fields, sort, search, export CSV).

**Columns:**

| Column | Description |
|--------|-------------|
| Rank | Based on composite SVS, recalculated live |
| State | State abbreviation, clickable to expand drill-down |
| Tier | Badge (T1/T2/T3), computed from rank cutoffs |
| Quadrant | Colored pill badge (4 quadrant colors) |
| Acquisition Score | Numeric + inline horizontal bar |
| Civic Leverage Score | Numeric + inline horizontal bar |
| Composite SVS | Numeric, bold |
| CC Enrollment | Contextual data from campus aggregation |
| Young Professionals | From states.json |
| College Enrollment | From states.json |
| Districts | Count of congressional districts |

Score bars use the quadrant color scheme. Table is sortable by any column, searchable by state name.

**Row click behavior:** Expands an inline panel below the row showing the district drill-down.

### Layer 4: District Drill-Down (inline expansion)

When a state row is clicked, an inline sub-table expands below it showing that state's congressional districts.

**District sub-table columns:**

| Column | Source |
|--------|--------|
| District | e.g., "CO-1" |
| Member | House representative name |
| Party | D/R |
| Cook PVI | District-level PVI |
| Median Income | ACS data |
| Poverty Rate | ACS data |
| Campuses | Count of CC campuses in district |
| CC Enrollment | Sum of campus enrollment in district |
| Competitive? | Based on Cook House ratings |

Sorted by default: competitive districts with more campuses first. Each district row links to the Map tab centered on that district.

No scoring engine at this level — just a sortable, filterable sub-table using existing district-meta.json and campus aggregation data.

---

## Data Architecture

### Pre-computed dimension scores

Each of the 10 dimension scores (0-100 scale) is pre-computed and stored in `states.json` (new fields). These match the v43.6 spreadsheet formulas exactly:

- `senatorResponsivenessScore`
- `civicEngagementScore`
- `senatorInfluenceScore`
- `taxDensityScore`
- `eitcOpportunityScore`
- `urbanConcentrationScore`
- `filingComplexityScore`
- `digitalAdoptionScore`
- `youngProfConcentrationScore`
- `competitiveDistrictDensityScore`

The client applies weights and computes lens scores and composite SVS in real-time.

### Raw fields available for custom dimensions

All existing fields in states.json are available: totalFilers, totalFedTaxPaidB, adultPop18, urbanPopPct, youngProfessionalPop, collegeEnrollment, eitcClaimsThousands, eitcParticipationRate, eitcUnclaimedRate, midtermTurnout2022, etc.

When a user adds a raw field, it's percentile-ranked across all states (0-100) to create a comparable score, then weighted alongside the pre-computed dimensions.

### District-level data

Already exists in districts-meta.json: cook_pvi, member, party, median_income, poverty_rate, pct_associates_plus, pct_18_24, committees. Campus data aggregated from campuses.geojson per district.

---

## Scoring Formulas

### Lens scores
```
Acquisition = sum(weight_i * dimension_score_i) for all enabled dimensions
Civic       = sum(weight_i * dimension_score_i) for all enabled dimensions
```
Where weights are normalized to sum to 1.0 within each lens.

### Composite
```
SVS = alpha * Acquisition + (1 - alpha) * Civic
```

### Quadrant assignment
- Launch Priority: Acquisition >= median AND Civic >= median
- Revenue Opportunity: Acquisition >= median AND Civic < median
- Civic Beachhead: Acquisition < median AND Civic >= median
- Deprioritize: Acquisition < median AND Civic < median

The median threshold is the 60th percentile (matching v43.6's `quadrant_percentile_threshold = 0.6`), configurable.

### Tier assignment
- Tier 1: Rank 1-12
- Tier 2: Rank 13-30
- Tier 3: Rank 31+

---

## Visual Design

- Matches existing app design system: --teal (#4C6971), --coral (#FE4F40), --border-light (#EEEAE4), DM Sans body, Oswald headings
- Quadrant colors: 4 distinct colors for the quadrant badges (to be determined, coordinated with existing palette)
- Score bars: thin horizontal bars inside table cells, colored by score range
- Collapsible scoring panel: smooth expand/collapse animation, chevron indicator
- Dimension rows: compact, with subtle hover state and drag handle (future: reorder dimensions)
- Sliders: styled to match the app's warm palette, not default browser sliders

---

## Scope Boundaries

**In scope:**
- Scoring model panel with 10 dimensions, adjustable weights, alpha slider
- Filters bar with 4 filter types
- Ranked results table with inline score bars
- District drill-down on state row click
- CSV export of ranked results
- Pre-computed dimension scores in states.json
- Reset to defaults

**Out of scope (future):**
- Saving custom weight configurations
- Scatter plot / quadrant chart visualization
- Campus-level scoring
- Sharing a specific weight configuration via URL
- Growth scenario modeling (from the spreadsheet's Growth Scenarios tab)
