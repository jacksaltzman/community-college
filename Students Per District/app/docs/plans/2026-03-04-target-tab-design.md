# Target Tab — GTM Geography Targeting Tool

## Purpose

A new 4th tab ("Target") that lets users apply cascading filters at the state, district, and campus levels to narrow down target geographies for GTM strategy. Filters at lower levels bubble up — if no campuses in a state match the campus filters, that state disappears from results.

## Layout

**Sidebar filter panel (left, 320px)** + **Results tree (right, flex-1)**.

Mirrors the existing campuses map sidebar pattern (`.map-sidebar` / `.map-page` layout).

## Data Flow (Cascade Logic)

1. Start with all ~900 campuses from `campuses.geojson`
2. Apply **campus filters** → surviving campuses
3. Group surviving campuses by district. Apply **district filters** → surviving districts (must have ≥1 surviving campus AND match district criteria)
4. Group surviving districts by state. Apply **state filters** → surviving states (must have ≥1 surviving district AND match state criteria)
5. Recompute aggregated metrics (enrollment, campus count) from surviving items only

Data sources:
- `campuses.geojson` — campus-level data
- `districts-meta.json` — district metadata (Cook PVI, member, party, bbox)
- `states.json` — state metadata (Cook PVI, senators, EITC, demographics)

## Filter Panel

Three collapsible sections, each with a header showing active filter count badge:

### State Filters
- Cook PVI — dropdown: Any, D-lean (D+1 or more), Swing (D+5 to R+5), R-lean (R+1 or more)
- Senator up for election — dropdown: Any, 2026, 2028, 2030
- Senator party — multi-select checkboxes: D, R
- Enrollment range — min/max inputs
- Midterm turnout range — min/max inputs
- EITC unclaimed rate — min/max inputs

### District Filters
- Enrollment range — min/max inputs
- Campus count range — min/max inputs

**Cascade-down behavior:** Cook PVI and Party filters from the State section automatically cascade to districts — state PVI filter also applies to district PVI, and senator party also filters representative party. No separate PVI/party controls at district level.

### Campus Filters
- Enrollment range — min/max inputs
- Campus type — multi-select checkboxes (Large City, Midsize City, Suburban, Small City, Rural, Town/Remote)
- Districts reached — min/max inputs

### Bottom Controls
- Reset All button
- Export CSV button (exports all filtered campuses with state + district context)

## Results Tree

### Summary Bar
Shows: "X states · Y districts · Z campuses" with current filtered counts.

### Accordion Tree
- **States** (collapsed by default): `State Name (Code) — Cook PVI — X districts · Y campuses · ZK enrollment`
- **Districts** (within expanded state): `CD Code — Cook PVI — Rep Name (Party) — X campuses · ZK enrollment`
- **Campuses** (within expanded district): `Campus Name — City — Type — Enrollment — Districts Reached`

Visual treatment:
- States: bold, larger text, teal left-border accent
- Districts: indented, medium weight
- Campuses: further indented, regular weight
- Expand/collapse chevrons on the left

## Files

### New
- `src/components/target/TargetView.jsx` — main component (orchestrates filter state + cascade logic)
- `src/components/target/TargetFilters.jsx` — sidebar with 3 collapsible filter sections
- `src/components/target/TargetResults.jsx` — accordion tree with summary bar
- `src/styles/target.css` — styles for filter panel, tree rows, accordion

### Modified
- `src/components/Layout.jsx` — add "Target" to TABS array, render TargetView
- `src/App.jsx` — handle `#target` route (if routing changes needed)

## CSV Export

All filtered campuses exported with context columns:
`State, District, Campus Name, City, Campus Type, Enrollment, Districts Reached, Cook PVI (State), Cook PVI (District), Representative, Party`
