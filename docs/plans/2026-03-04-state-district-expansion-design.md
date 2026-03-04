# State & District Expansion — Design Document

**Date:** 2026-03-04
**Status:** Approved

## Context

The campus-level analysis revealed that the district is the right unit of analysis for civic engagement, and states matter for GTM prioritization. The app needs State and District views oriented around helping the BD team find opportunities — which states and districts have the most untapped student organizing potential.

## Decision: React + Vite Migration

The app will be rebuilt as a React + Vite SPA. Rationale:
- `react-map-gl` (by Mapbox team) provides production-grade map integration
- TanStack Table replaces ~500 lines of hand-rolled table code
- Component model maps naturally to the three sub-views
- Already deployed on Vercel; Vite deploys trivially
- Best hiring/handoff story

Client-side SPA only — no SSR, no backend. All data remains static JSON/GeoJSON files.

## Information Architecture

Three top-level tabs:

```
[ MAP ]  [ DATA ]  [ Methodology ]
```

MAP and DATA each have three sub-views toggled by a segmented control:

```
[ States | Districts | Campuses ]
```

Dashboard and Summary tabs are removed.

### Cross-linking

- Click a state in DATA → MAP zooms to that state
- Click a district in DATA → MAP zooms to that district
- Click a campus in DATA → MAP zooms to that campus
- Side panels on MAP link back to DATA filtered views

## Data Model

### V1 Metrics per District

| Field | Source |
|-------|--------|
| District code (e.g., CA-12) | Census/existing |
| State | Derived |
| Total enrollment | Aggregated from campus commute overlaps |
| Campus count | Count of campuses reaching this district |
| Cook PVI | Cook Political Report (user-provided CSV) |
| Midterm voter turnout | FEC/Census 2022 data |

### V1 Metrics per State

| Field | Source |
|-------|--------|
| State | — |
| Total enrollment | Sum across all CC campuses |
| Campus count | Count of CC campuses |
| District count | Count of congressional districts |
| Avg districts reached per campus | Derived from campus data |
| Avg Cook PVI | Averaged across districts |
| Midterm voter turnout | Statewide 2022 data |

### Campus Data

Unchanged — `campuses.geojson` as-is.

## React App Architecture

```
Students Per District/app/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── Layout.jsx              # Top nav + tab routing
│   │   ├── SubNav.jsx              # States|Districts|Campuses toggle
│   │   ├── map/
│   │   │   ├── MapView.jsx         # Shared react-map-gl instance
│   │   │   ├── StatesMapLayer.jsx
│   │   │   ├── DistrictsMapLayer.jsx
│   │   │   ├── CampusesMapLayer.jsx
│   │   │   ├── MapPopup.jsx
│   │   │   └── MapControls.jsx
│   │   ├── data/
│   │   │   ├── StatesTable.jsx
│   │   │   ├── DistrictsTable.jsx
│   │   │   ├── CampusesTable.jsx
│   │   │   └── TableControls.jsx
│   │   └── methodology/
│   │       └── Methodology.jsx
│   ├── hooks/
│   │   ├── useMapData.js
│   │   └── useTableState.js
│   ├── data/
│   │   ├── campuses.geojson
│   │   ├── districts.geojson
│   │   └── states.json
│   └── styles/
│       ├── tokens.css
│       └── global.css
├── index.html
├── vite.config.js
├── package.json
└── vercel.json
```

### Key Decisions

- **One Map instance** shared across sub-views. Layer components add/remove their layers.
- **URL hash routing** (`#map/states`, `#data/districts`, `#methodology`). No router library.
- **TanStack Table** for all data tables.
- **React context + useReducer** for shared state. No Redux/Zustand.
- **CSS custom properties** ported from existing design tokens.

## Map Behavior

### States Sub-View

- State choropleth colored by selected metric (enrollment, campus count, PVI, turnout)
- Metric selector dropdown
- Hover → highlight border + tooltip
- Click → fly-to state bounds, open right side panel with state detail + district/campus lists
- Side panel links navigate to Districts/Campuses sub-views filtered by state

### Districts Sub-View

- District choropleth colored by selected metric
- Metric selector dropdown
- Hover → highlight border + tooltip
- Click → fly-to district bounds, open right side panel with district detail + campus list
- Side panel links navigate to Campuses sub-view filtered by district

### Campuses Sub-View

- Ported from existing: campus dots (sized by enrollment, colored by type), commute circles, district polygons
- Click campus → fly-to, popup with details + districts reached
- Sidebar search, state filter, layer toggles preserved
- Point clustering at national zoom preserved

### Shared

- Reset view button (compass) → national view
- Warm branded basemap
- Smooth fly-to animations

## Visual Design

### Brand Preservation

- Colors: Coral (#FE4F40), Teal (#4C6971), Lime (#D4F72A), Paper (#FDFBF9)
- Fonts: DM Sans (body), Oswald (headings)
- Black top nav (56px), white text
- Cards with soft shadows, rounded corners

### Tab Bar

- Top-level tabs in black header bar
- Sub-view segmented control as pill toggle below header

### Choropleth Color Scales

- Enrollment / Campus count: Paper → Teal (sequential)
- Cook PVI: Coral (R) → Paper (neutral) → Teal (D) (diverging)
- Turnout: Paper → Coral (sequential, low-to-high since low turnout = higher opportunity)

### Side Panels

- Slide in from right on state/district click
- Color stripe on left edge, shadow, rounded corners
- Close button (X), scrollable content

### Data Tables

- Minimal styling matching existing Data tab
- Alternating row tinting
- Sortable headers with arrows
- Per-column filter dropdowns
- Coral accent on active sort/filter

## Data Pipeline Changes

### New Inputs

- `cook_pvi.csv` — User-provided. Format: `district_code, pvi_score`
- `midterm_turnout.csv` — FEC/Census 2022. Format: `district_code, turnout_pct`
- Census states shapefile — For state boundary polygons on the map

### Pipeline Updates (generate_map_data.py)

1. Load Cook PVI and midterm turnout CSVs
2. Join onto district data by district code
3. Aggregate campus data per district (count, enrollment weighted by overlap)
4. Produce enriched `districts.geojson` with: enrollment, campus_count, cook_pvi, midterm_turnout
5. Aggregate per state: total enrollment, campus count, district count, avg districts reached, avg PVI, turnout
6. Produce `states.json` with state-level metrics
7. Produce `states.geojson` from Census states shapefile for map polygons

### Output Files

- `campuses.geojson` — Unchanged
- `districts.geojson` — Enriched with PVI, turnout, enrollment, campus count
- `states.geojson` — State boundary polygons with aggregated metrics
- `states.json` — State metrics (for DATA table, no geometry needed)

## Future Work (Not V1)

- Composite opportunity score (weighted multi-variable scoring)
- Senator responsiveness metric
- Average tax value per district
- Representative committee assignments
- BD team annotations/notes per state/district
