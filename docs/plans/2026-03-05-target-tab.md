# Target Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing filter-only Target tab with an interactive two-lens scoring engine (Acquisition + Civic Leverage) that ranks states, supports adjustable weights, filtering, and district drill-down.

**Architecture:** Pre-compute 10 dimension scores (0-100) in `states.json` via Python. Client-side scoring hook applies user weights to produce lens scores, composite SVS, quadrants, and tiers. UI has 4 layers: collapsible scoring panel → filters bar → ranked results table → inline district drill-down.

**Tech Stack:** React 18, Vite, CSS custom properties (no CSS modules), existing design tokens in `tokens.css`. No new dependencies needed.

**Design doc:** `docs/plans/2026-03-05-target-tab-design.md`

---

## Task 1: Pre-Compute Dimension Scores in states.json

**Files:**
- Create: `Students Per District/code/compute_state_scores.py`
- Modify: `Students Per District/app/public/data/states.json`

**Context:** The v43.6 spreadsheet at `/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/gtm/State Models/accountable_50_state_analysis_v43_6.xlsx` contains pre-computed dimension scores in the "State Detail Data" sheet, columns AB-AV. We need to extract these 10 scores and add them to states.json.

**Step 1: Write Python script to extract scores from the spreadsheet**

Read the spreadsheet's "State Detail Data" sheet. Map each state's dimension scores (columns AB-AT) to our field names. The 10 dimensions and their spreadsheet columns:

| Field Name | Spreadsheet Column | Header |
|---|---|---|
| `civicEngagementScore` | AB | Civic Engagement Score |
| `senatorInfluenceScore` | AC | Senator Influence Score |
| `filingComplexityScore` | AG | Filing Complexity Score |
| `senatorResponsivenessScore` | AJ | Senator Responsiveness Score |
| `digitalAdoptionScore` | AL | Digital Adoption Score |
| `eitcOpportunityScore` | X | EITC Opportunity Score |
| `urbanConcentrationScore` | Y | Urban Concentration Score |
| `taxDensityScore` | R | Tax Density Score |
| `youngProfConcentrationScore` | AR | Young Prof Concentration Score |
| `competitiveDistrictDensityScore` | AT | CDD Score |

Script reads the xlsx (using openpyxl with data_only=True), maps state names to abbreviations, and merges the 10 new fields into the existing states.json. Print a summary table of the top 5 states for validation.

**Step 2: Run the script**

```bash
cd "Students Per District" && python3 code/compute_state_scores.py
```

Expected: "Merged 10 dimension scores for 50 states" + summary table.

**Step 3: Verify states.json has the new fields**

```bash
python3 -c "import json; d=json.load(open('app/public/data/states.json')); print(json.dumps({k: d['CO'][k] for k in d['CO'] if 'Score' in k}, indent=2))"
```

Expected: 10 score fields for Colorado, all numeric 0-100.

**Step 4: Verify build still passes**

```bash
cd app && npm run build
```

**Step 5: Commit**

```bash
git add code/compute_state_scores.py app/public/data/states.json
git commit -m "feat: pre-compute 10 dimension scores in states.json from v43.6 spreadsheet"
```

---

## Task 2: Create Scoring Engine Hook

**Files:**
- Create: `Students Per District/app/src/hooks/useTargetScoring.js`

**Context:** This hook takes states data + dimension scores + user weight configuration and produces ranked results with lens scores, composite SVS, quadrant, and tier. It runs client-side, recomputing whenever weights change.

**Step 1: Write the hook**

The hook signature:

```javascript
export default function useTargetScoring(statesData, campuses, config)
```

Where `config` is:
```javascript
{
  alpha: 0.5,  // Acquisition vs Civic blend
  acquisitionWeights: { senatorResponsiveness: 3, civicEngagement: 20, ... },
  civicWeights: { senatorResponsiveness: 35, civicEngagement: 30, ... },
  customFields: [],  // { fieldKey, weight, lens }
}
```

Returns:
```javascript
{
  rankedStates: [{ code, name, tier, quadrant, acqScore, civicScore, composite, ...rawData }],
  medians: { acq, civic },
}
```

Scoring logic:
1. For each state, read the 10 dimension scores from statesData
2. Normalize weights within each lens (sum to 1.0)
3. Compute `acqScore = sum(normalizedWeight_i * dimensionScore_i)` for enabled acquisition dimensions
4. Compute `civicScore = sum(normalizedWeight_i * dimensionScore_i)` for enabled civic dimensions
5. For custom fields: percentile-rank the raw field value across all states (0-100), then weight it in
6. Compute `composite = alpha * acqScore + (1 - alpha) * civicScore`
7. Sort by composite descending, assign ranks
8. Compute medians at 60th percentile for quadrant thresholds
9. Assign quadrants: Launch Priority (both above), Revenue Opportunity (acq above, civic below), Civic Beachhead (civic above, acq below), Deprioritize (both below)
10. Assign tiers: T1 (rank 1-12), T2 (13-30), T3 (31+)

Also aggregate campus data by state (CC enrollment, campus count, district count) — same pattern as StatesTable.jsx lines 66-126.

**Step 2: Verify build passes**

```bash
cd app && npm run build
```

**Step 3: Commit**

```bash
git add src/hooks/useTargetScoring.js
git commit -m "feat: add useTargetScoring hook for weighted two-lens state scoring"
```

---

## Task 3: Create Default Weights Configuration

**Files:**
- Create: `Students Per District/app/src/components/target/scoringDefaults.js`

**Context:** Central place for the default dimension weights matching the v43.6 spreadsheet. Shared by the scoring hook and the scoring panel UI.

**Step 1: Write the defaults file**

```javascript
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
```

**Step 2: Commit**

```bash
git add src/components/target/scoringDefaults.js
git commit -m "feat: add default scoring weights and dimension config for Target tab"
```

---

## Task 4: Build Scoring Panel Component

**Files:**
- Create: `Students Per District/app/src/components/target/ScoringPanel.jsx`

**Context:** Collapsible top section showing the two-lens weight configuration. Each lens is a column of dimension rows with toggles and weight sliders. Alpha slider at top. Reset button at bottom.

**Step 1: Write the ScoringPanel component**

Props:
```javascript
{ config, onConfigChange, collapsed, onToggleCollapsed }
```

Where `config` matches the shape from Task 2. The component renders:

1. **Header bar** with "Scoring Model" title + collapse chevron + "Reset to defaults" link
2. When expanded, **alpha slider** at top: "Acquisition ←→ Civic Leverage" with value display (e.g., "50 / 50")
3. **Two side-by-side columns** (flex layout, stacks on mobile):
   - Left: "Acquisition Score" header, list of dimension rows
   - Right: "Civic Leverage Score" header, list of dimension rows
4. Each **dimension row** has:
   - Checkbox toggle (on/off)
   - Dimension label
   - Weight slider (input type="range" min=0 max=100)
   - Numeric weight display
   - Expand chevron (future: shows raw fields — for now just the icon, no expansion)
5. **"+ Add field" button** at bottom of each column (shows dropdown of AVAILABLE_RAW_FIELDS, with warning if field overlaps existing dimension)

Weight sliders dispatch `onConfigChange` with updated weights. Display normalized percentages next to each slider.

Use CSS classes prefixed with `.scoring-*`. Sliders styled with the warm palette (--teal for thumb, --border-light for track).

**Step 2: Verify build passes**

```bash
cd app && npm run build
```

**Step 3: Commit**

```bash
git add src/components/target/ScoringPanel.jsx
git commit -m "feat: add ScoringPanel component with weight sliders and alpha control"
```

---

## Task 5: Build Target Filters Bar Component

**Files:**
- Create: `Students Per District/app/src/components/target/TargetFiltersBar.jsx`

**Context:** Horizontal bar below the scoring panel. Contains 4 dropdown filters: Election Cycle, Senator Party, Tier, Quadrant. Similar style to the Airtable toolbar on the Data tab. This REPLACES the old sidebar-based TargetFilters.jsx.

**Step 1: Write the TargetFiltersBar component**

Props:
```javascript
{ filters, onFiltersChange, resultCount, totalCount }
```

Where `filters` is:
```javascript
{ electionCycle: '', senatorParty: '', tier: '', quadrant: '' }
```

Renders a horizontal flex bar with:
- 4 `<select>` dropdowns styled like `.styled-select`
- Active filter count badge
- "Clear all" link
- Count display: "12 of 51 states"

Reuse `.data-toolbar` styling pattern from data.css (same background `#F3F0EB`, same gap, same flex layout).

**Step 2: Verify build passes**

**Step 3: Commit**

```bash
git add src/components/target/TargetFiltersBar.jsx
git commit -m "feat: add horizontal TargetFiltersBar with 4 filter dropdowns"
```

---

## Task 6: Build Ranked Results Table Component

**Files:**
- Create: `Students Per District/app/src/components/target/TargetResultsTable.jsx`

**Context:** Full-width ranked table showing scored states. Each row has inline score bars. Clicking a row toggles a district drill-down sub-table. This REPLACES the old TargetResults.jsx tree/flat view.

**Step 1: Write the TargetResultsTable component**

Props:
```javascript
{ rankedStates, navigate, districtsMeta, campuses }
```

Table columns:
- Rank (number)
- State (abbreviation + full name)
- Tier (badge: T1/T2/T3)
- Quadrant (colored pill using QUADRANT_COLORS)
- Acquisition Score (number + inline bar div)
- Civic Leverage Score (number + inline bar div)
- Composite SVS (number, bold)
- CC Enrollment (from campus aggregation)
- Young Professionals (from statesData)
- Districts (count)

Inline score bar: a `<div>` with fixed width, containing a colored inner `<div>` with width proportional to score (0-100). Height ~6px, rounded.

Row click toggles `expandedState` — shows/hides a DistrictDrillDown sub-component for that state.

Use `.target-ranked-table` class prefix. Match `.data-table` styling from data.css (same font, borders, hover states).

**Step 2: Write the DistrictDrillDown sub-component (inline in same file or separate)**

When a state row is expanded, render a `<tr>` spanning all columns containing a sub-table of that state's districts. Sub-table columns:
- District (e.g., "CO-1")
- Member (House rep name)
- Party (D/R dot)
- Cook PVI
- Median Income
- Poverty Rate
- Campuses (count in district)
- CC Enrollment (sum in district)

Data comes from `districtsMeta.districts` filtered to matching state, plus campus aggregation.

Each district row has a "View on map" link calling `navigate('map', 'districts', { district: cd })`.

**Step 3: Verify build passes**

**Step 4: Commit**

```bash
git add src/components/target/TargetResultsTable.jsx
git commit -m "feat: add ranked results table with score bars and district drill-down"
```

---

## Task 7: Rewrite TargetView.jsx to Wire Everything Together

**Files:**
- Modify: `Students Per District/app/src/components/target/TargetView.jsx`

**Context:** Replace the old filter sidebar + tree view architecture with the new scoring panel + filters bar + ranked table. The old TargetFilters.jsx and TargetResults.jsx will be replaced by the new components.

**Step 1: Rewrite TargetView.jsx**

New state management:
```javascript
const [config, setConfig] = useState({
  alpha: 0.5,
  acquisitionWeights: { ...DEFAULT_ACQ_WEIGHTS },
  civicWeights: { ...DEFAULT_CIVIC_WEIGHTS },
  customFields: [],
})
const [filters, setFilters] = useState({ electionCycle: '', senatorParty: '', tier: '', quadrant: '' })
const [scoringCollapsed, setScoringCollapsed] = useState(false)
```

Data flow:
1. Call `useTargetScoring(statesData, campuses, config)` → get `rankedStates`
2. Apply filters to `rankedStates` (election cycle, senator party, tier, quadrant)
3. Pass filtered results to `TargetResultsTable`

Layout:
```jsx
<div className="target-page-v2">
  <ScoringPanel config={config} onConfigChange={setConfig}
    collapsed={scoringCollapsed} onToggleCollapsed={() => setScoringCollapsed(p => !p)} />
  <TargetFiltersBar filters={filters} onFiltersChange={setFilters}
    resultCount={filteredStates.length} totalCount={rankedStates.length} />
  <TargetResultsTable rankedStates={filteredStates} navigate={navigate}
    districtsMeta={data?.districtsMeta} campuses={data?.campuses} />
</div>
```

Keep the CSV export logic but update headers/fields to include scores.

URL serialization: encode scoring config + filters into hash params (compact format).

**Step 2: Update Layout.jsx if needed**

The existing Layout.jsx already passes `data={data}` to TargetView. No changes needed unless the prop interface changes.

**Step 3: Verify build passes**

**Step 4: Commit**

```bash
git add src/components/target/TargetView.jsx
git commit -m "feat: rewrite TargetView with scoring panel, filters bar, and ranked table"
```

---

## Task 8: Write Target Tab CSS

**Files:**
- Modify: `Students Per District/app/src/styles/target.css`

**Context:** Replace old sidebar + tree CSS with new scoring panel + filters bar + ranked table styles. Keep any reusable styles. Old classes: `.target-page`, `.target-tree`, `.target-state-group`, etc. New classes: `.target-page-v2`, `.scoring-*`, `.target-filters-bar`, `.target-ranked-table`, etc.

**Step 1: Write new CSS**

Key style blocks:

1. **`.target-page-v2`**: Full-width column layout (no sidebar). `display: flex; flex-direction: column; height: 100%;`

2. **`.scoring-panel`**: Collapsible panel. Background: `#F3F0EB` (same as data toolbar). Padding: 16px 24px. Transition on max-height for collapse animation.

3. **`.scoring-panel-header`**: Flex row with title, collapse chevron, "Reset to defaults" link.

4. **`.scoring-alpha-row`**: Full-width slider for alpha. Label "Acquisition ← → Civic Leverage".

5. **`.scoring-columns`**: `display: flex; gap: 24px;` Two columns. On mobile (`@media max-width: 768px`): `flex-direction: column;`

6. **`.scoring-dimension`**: Single dimension row. Flex row: checkbox + label + slider + number. Height ~36px. Hover: `var(--hover-bg)`.

7. **`.scoring-slider`**: Custom styled range input. Track: `var(--border-light)`. Thumb: `var(--teal)`. Height: 4px.

8. **`.target-filters-bar`**: Same pattern as `.data-toolbar`. Background: `#F3F0EB`. Flex row. Gap: 8px.

9. **`.target-ranked-table`**: Same base as `.data-table` from data.css. Additional styles for inline score bars.

10. **`.score-bar`**: Container `width: 60px; height: 6px; background: var(--border-light); border-radius: 3px;`. Inner fill div with dynamic width and quadrant color.

11. **`.quadrant-pill`**: Rounded badge with quadrant color. `border-radius: 12px; padding: 2px 8px; font-size: 11px; color: white;`

12. **`.tier-badge`**: Small badge. `font-size: 10px; font-weight: 600; border-radius: 4px;`

13. **`.district-drilldown`**: Sub-table inside expanded state row. Left border accent. Slightly indented.

14. **Responsive**: On mobile, scoring panel stacks columns vertically. Filters bar wraps. Table scrolls horizontally.

**Step 2: Remove old unused CSS classes** (`.target-tree`, `.target-state-group`, `.target-district-group`, `.target-campus-list`, etc.) that are no longer referenced.

**Step 3: Verify build passes**

**Step 4: Commit**

```bash
git add src/styles/target.css
git commit -m "feat: add CSS for scoring panel, filters bar, ranked table, and score bars"
```

---

## Task 9: Clean Up Old Target Components

**Files:**
- Delete or archive: `Students Per District/app/src/components/target/TargetFilters.jsx`
- Delete or archive: `Students Per District/app/src/components/target/TargetResults.jsx`

**Context:** These are the old sidebar-filters and tree/flat view components, now replaced by ScoringPanel, TargetFiltersBar, and TargetResultsTable.

**Step 1: Remove old imports from TargetView.jsx** (should already be done in Task 7)

**Step 2: Delete the old files**

```bash
rm src/components/target/TargetFilters.jsx src/components/target/TargetResults.jsx
```

**Step 3: Verify build passes** (no references to deleted files)

**Step 4: Commit**

```bash
git add -A src/components/target/
git commit -m "chore: remove old TargetFilters and TargetResults (replaced by scoring model)"
```

---

## Task 10: Visual Verification and Polish

**Files:** Various — bug fixes discovered during verification.

**Step 1: Start dev server and navigate to Target tab**

Verify:
- Scoring panel renders with 10 dimensions, correct default weights
- Alpha slider works, scores update
- Weight sliders work, rankings update in real-time
- Filters bar filters states correctly
- Results table shows ranked states with score bars
- Clicking a state row expands district drill-down
- District rows have correct data
- "Reset to defaults" restores spreadsheet weights
- CSV export includes score columns
- Mobile view is usable (scoring columns stack, table scrolls)

**Step 2: Cross-check rankings against spreadsheet**

Verify the top 5 states with default weights match the v43.6 spreadsheet rankings:
1. Colorado
2. Minnesota
3. Oregon
4. Wisconsin
5. New Hampshire

**Step 3: Fix any issues found**

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: polish Target tab UI, verify rankings match v43.6 spreadsheet"
```

---

## Task 11: Push to Vercel

**Step 1: Push all changes**

```bash
git push
```

**Step 2: Verify Vercel build succeeds**

Check Vercel dashboard or wait for deployment.
