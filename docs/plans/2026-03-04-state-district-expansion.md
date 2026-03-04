# State & District Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Community College District Map from a single-file vanilla HTML app to a React + Vite SPA with new State and District data views.

**Architecture:** React + Vite SPA deployed to Vercel. Single Mapbox GL map instance shared across three sub-views (States, Districts, Campuses). TanStack Table for all data tables. URL hash routing without a router library. Static JSON/GeoJSON data files — no backend.

**Tech Stack:** React 18, Vite, react-map-gl v7, @tanstack/react-table v8, mapbox-gl v3.4, CSS custom properties

**Design Doc:** `docs/plans/2026-03-04-state-district-expansion-design.md`

---

## Phase 1: Data Pipeline — Enrich Districts + Generate State Data

### Task 1: Add Cook PVI to District Data

**Files:**
- Modify: `Students Per District/code/generate_map_data.py`
- Create: `Students Per District/data/cook_pvi.csv` (user-provided)

**Step 1: Get Cook PVI CSV from user**

Ask the user for their Cook PVI CSV. Expected format:
```csv
district_code,pvi_score
AL-1,R+25
AL-2,R+6
...
```

Place at `Students Per District/data/cook_pvi.csv`.

**Step 2: Modify generate_map_data.py to load Cook PVI**

Add after the existing `FIPS_TO_STATE` mapping:

```python
COOK_PVI_PATH = BASE_DIR / "data" / "cook_pvi.csv"
```

Add a function to load and join PVI data:

```python
def load_cook_pvi() -> dict:
    """Load Cook PVI scores as a dict: cd_code -> pvi_score string."""
    if not COOK_PVI_PATH.exists():
        log.warning(f"Cook PVI file not found at {COOK_PVI_PATH}, skipping")
        return {}
    df = pd.read_csv(COOK_PVI_PATH)
    # Normalize column names
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
    result = {}
    for _, row in df.iterrows():
        code = str(row.get('district_code', '')).strip()
        pvi = str(row.get('pvi_score', '')).strip()
        if code and pvi:
            result[code] = pvi
    log.info(f"  Loaded {len(result)} PVI scores")
    return result
```

**Step 3: Modify generate_districts_geojson to include PVI**

In `generate_districts_geojson()`, after building the features list, join PVI:

```python
pvi_lookup = load_cook_pvi()

# In the feature loop, add to properties:
properties["cook_pvi"] = pvi_lookup.get(cd_code, None)
```

**Step 4: Run and verify**

Run: `cd "Students Per District" && python3 code/generate_map_data.py`
Expected: districts.geojson now has `cook_pvi` in each feature's properties.

Verify: `python3 -c "import json; d=json.load(open('map/data/districts.geojson')); print(d['features'][0]['properties'].keys())"`
Expected output includes `cook_pvi`.

**Step 5: Commit**

```bash
git add "Students Per District/code/generate_map_data.py" "Students Per District/data/cook_pvi.csv"
git commit -m "feat: add Cook PVI to district GeoJSON pipeline"
```

---

### Task 2: Add Midterm Turnout to District Data

**Files:**
- Modify: `Students Per District/code/generate_map_data.py`
- Create: `Students Per District/data/midterm_turnout.csv` (to be sourced)

**Step 1: Source and place midterm turnout data**

Source 2022 midterm turnout by congressional district. The FEC and Census Bureau publish this. Place at `Students Per District/data/midterm_turnout.csv`.

Expected format:
```csv
district_code,turnout_pct
AL-1,42.3
AL-2,38.7
...
```

If district-level data isn't readily available, use state-level turnout and assign to all districts in that state as a starting point.

**Step 2: Add turnout loading to generate_map_data.py**

```python
TURNOUT_PATH = BASE_DIR / "data" / "midterm_turnout.csv"

def load_midterm_turnout() -> dict:
    """Load midterm turnout as dict: cd_code -> turnout_pct float."""
    if not TURNOUT_PATH.exists():
        log.warning(f"Turnout file not found at {TURNOUT_PATH}, skipping")
        return {}
    df = pd.read_csv(TURNOUT_PATH)
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
    result = {}
    for _, row in df.iterrows():
        code = str(row.get('district_code', '')).strip()
        pct = row.get('turnout_pct', None)
        if code and pct is not None:
            result[code] = float(pct)
    log.info(f"  Loaded {len(result)} turnout records")
    return result
```

**Step 3: Join turnout into districts**

In `generate_districts_geojson()`, after PVI join:

```python
turnout_lookup = load_midterm_turnout()

# In the feature loop:
properties["midterm_turnout"] = turnout_lookup.get(cd_code, None)
```

**Step 4: Run and verify**

Run: `cd "Students Per District" && python3 code/generate_map_data.py`
Verify: `python3 -c "import json; d=json.load(open('map/data/districts.geojson')); f=d['features'][0]['properties']; print(f.get('cook_pvi'), f.get('midterm_turnout'))"`

**Step 5: Commit**

```bash
git add "Students Per District/code/generate_map_data.py" "Students Per District/data/midterm_turnout.csv"
git commit -m "feat: add midterm turnout to district GeoJSON pipeline"
```

---

### Task 3: Aggregate Campus Metrics Per District

**Files:**
- Modify: `Students Per District/code/generate_map_data.py`

**Step 1: Add aggregation logic**

After generating campuses and before generating districts, compute per-district aggregates from the Excel Detail sheet:

```python
def compute_district_aggregates() -> dict:
    """Aggregate campus data per district from the Detail sheet.

    Returns dict: cd_code -> {enrollment, campus_count}
    """
    log.info(f"Computing district aggregates from Detail sheet")
    df = pd.read_excel(EXCEL_PATH, sheet_name="Detail")

    # The Detail sheet has one row per campus-district pair
    # Group by district code and aggregate
    agg = df.groupby("District").agg(
        campus_count=("IPEDS ID", "nunique"),
        enrollment=("Enrollment", "sum"),
    ).reset_index()

    result = {}
    for _, row in agg.iterrows():
        cd = str(row["District"]).strip()
        result[cd] = {
            "campus_count": int(row["campus_count"]),
            "enrollment": int(row["enrollment"]) if pd.notna(row["enrollment"]) else 0,
        }
    log.info(f"  Aggregated data for {len(result)} districts")
    return result
```

**Step 2: Join aggregates into districts GeoJSON**

In `generate_districts_geojson()`:

```python
district_aggs = compute_district_aggregates()

# In the feature loop:
agg = district_aggs.get(cd_code, {})
properties["enrollment"] = agg.get("enrollment", 0)
properties["campus_count"] = agg.get("campus_count", 0)
```

**Step 3: Run and verify**

Run: `cd "Students Per District" && python3 code/generate_map_data.py`
Verify: `python3 -c "import json; d=json.load(open('map/data/districts.geojson')); f=[x for x in d['features'] if x['properties'].get('enrollment',0)>0]; print(f'Districts with enrollment: {len(f)}')" `

**Step 4: Commit**

```bash
git add "Students Per District/code/generate_map_data.py"
git commit -m "feat: aggregate campus enrollment and count per district"
```

---

### Task 4: Generate State-Level Data Files

**Files:**
- Modify: `Students Per District/code/generate_map_data.py`

**Step 1: Add state aggregation and GeoJSON generation**

```python
STATES_SHP_DIR = BASE_DIR / "data" / "states"

def generate_states_data() -> tuple[Path, Path]:
    """Generate states.json (metrics) and states.geojson (boundaries).

    Returns (states_json_path, states_geojson_path)
    """
    log.info("Generating state-level data")

    # Load campus summary data
    summary = pd.read_excel(EXCEL_PATH, sheet_name="Summary")

    # Aggregate per state
    state_agg = summary.groupby("State").agg(
        campus_count=("IPEDS ID", "nunique"),
        total_enrollment=("Enrollment", "sum"),
        avg_districts_reached=("Districts Reached", "mean"),
    ).reset_index()

    # Count districts per state from districts GeoJSON
    districts_path = MAP_DATA_DIR / "districts.geojson"
    with open(districts_path) as f:
        districts = json.load(f)

    state_district_counts = {}
    state_pvi_values = {}
    state_turnout_values = {}

    for feat in districts["features"]:
        st = feat["properties"]["state"]
        state_district_counts[st] = state_district_counts.get(st, 0) + 1

        pvi = feat["properties"].get("cook_pvi")
        if pvi:
            state_pvi_values.setdefault(st, []).append(pvi)

        turnout = feat["properties"].get("midterm_turnout")
        if turnout is not None:
            state_turnout_values.setdefault(st, []).append(turnout)

    # Build states.json
    states_records = []
    for _, row in state_agg.iterrows():
        st = row["State"]
        turnout_vals = state_turnout_values.get(st, [])
        avg_turnout = sum(turnout_vals) / len(turnout_vals) if turnout_vals else None

        states_records.append({
            "state": st,
            "state_name": FIPS_TO_STATE_NAME.get(st, st),
            "total_enrollment": int(row["total_enrollment"]) if pd.notna(row["total_enrollment"]) else 0,
            "campus_count": int(row["campus_count"]),
            "district_count": state_district_counts.get(st, 0),
            "avg_districts_reached": round(float(row["avg_districts_reached"]), 1) if pd.notna(row["avg_districts_reached"]) else None,
            "avg_midterm_turnout": round(avg_turnout, 1) if avg_turnout else None,
        })

    # Write states.json
    MAP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    states_json_path = MAP_DATA_DIR / "states.json"
    with open(states_json_path, "w") as f:
        json.dump(states_records, f, separators=(",", ":"))
    log.info(f"Wrote {states_json_path} ({len(states_records)} states)")

    # Generate states.geojson from Census states shapefile
    shp_files = glob.glob(str(STATES_SHP_DIR / "*.shp"))
    if not shp_files:
        log.warning(f"No states shapefile found in {STATES_SHP_DIR}, skipping states.geojson")
        return states_json_path, None

    gdf = gpd.read_file(shp_files[0])
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    # Build lookup from state records
    state_metrics = {r["state"]: r for r in states_records}

    features = []
    for _, row in gdf.iterrows():
        state_fips = row["STATEFP"]
        state_abbrev = FIPS_TO_STATE.get(state_fips, state_fips)
        metrics = state_metrics.get(state_abbrev, {})

        properties = {
            "state": state_abbrev,
            "state_name": row.get("NAME", state_abbrev),
            "state_fips": state_fips,
            **{k: v for k, v in metrics.items() if k not in ("state", "state_name")},
        }

        features.append({
            "type": "Feature",
            "geometry": row.geometry.__geo_interface__,
            "properties": properties,
        })

    states_geojson = {"type": "FeatureCollection", "features": features}
    states_geojson_path = MAP_DATA_DIR / "states.geojson"
    with open(states_geojson_path, "w") as f:
        json.dump(states_geojson, f, separators=(",", ":"))

    log.info(f"Wrote {states_geojson_path} ({len(features)} features)")
    return states_json_path, states_geojson_path
```

**Step 2: Add FIPS_TO_STATE_NAME mapping**

Add a reverse lookup from state abbreviation to full name (use STATE_NAMES from the existing JS as reference).

**Step 3: Download Census states shapefile**

Download from Census Bureau:
```bash
cd "Students Per District/data"
mkdir -p states
cd states
curl -O https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip
unzip cb_2023_us_state_500k.zip
```

**Step 4: Update main() to call generate_states_data()**

```python
def main() -> None:
    log.info("=== generate_map_data START ===")
    generate_campuses_geojson()
    generate_districts_geojson()
    generate_states_data()
    log.info("=== generate_map_data END ===")
```

**Step 5: Run and verify**

Run: `cd "Students Per District" && python3 code/generate_map_data.py`
Verify both output files exist:
```bash
ls -la map/data/states.json map/data/states.geojson
python3 -c "import json; d=json.load(open('map/data/states.json')); print(f'{len(d)} states'); print(d[0])"
```

**Step 6: Commit**

```bash
git add "Students Per District/code/generate_map_data.py" "Students Per District/data/states/"
git commit -m "feat: generate state-level metrics and GeoJSON boundaries"
```

---

## Phase 2: React + Vite Scaffold

### Task 5: Initialize React + Vite Project

**Files:**
- Create: `Students Per District/app/` (entire directory)

**Step 1: Create Vite project**

```bash
cd "Students Per District"
npm create vite@latest app -- --template react
cd app
npm install
```

**Step 2: Install dependencies**

```bash
npm install react-map-gl mapbox-gl @tanstack/react-table
```

**Step 3: Copy data files into app**

```bash
mkdir -p public/data
cp ../map/data/campuses.geojson public/data/
cp ../map/data/districts.geojson public/data/
cp ../map/data/states.geojson public/data/
cp ../map/data/states.json public/data/
cp ../map/accountable_logo.avif public/
```

**Step 4: Set up Vite config**

Write `vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
```

**Step 5: Update root vercel.json for new app directory**

Update `/vercel.json`:
```json
{
  "framework": "vite",
  "installCommand": "cd 'Students Per District/app' && npm install",
  "buildCommand": "cd 'Students Per District/app' && npm run build",
  "outputDirectory": "Students Per District/app/dist"
}
```

**Step 6: Update .claude/launch.json for dev server**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "app-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    },
    {
      "name": "map-server",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8080", "--directory", "Students Per District/map"],
      "port": 8080
    }
  ]
}
```

**Step 7: Verify dev server starts**

Run: `cd "Students Per District/app" && npm run dev`
Expected: Vite dev server at http://localhost:5173 with default React template.

**Step 8: Commit**

```bash
git add "Students Per District/app/" vercel.json .claude/launch.json
git commit -m "feat: scaffold React + Vite project with dependencies"
```

---

### Task 6: Set Up Design Tokens and Global Styles

**Files:**
- Create: `Students Per District/app/src/styles/tokens.css`
- Create: `Students Per District/app/src/styles/global.css`
- Modify: `Students Per District/app/src/main.jsx`

**Step 1: Create tokens.css**

Port all CSS custom properties from the existing `index.html`:

```css
:root {
  --coral: #FE4F40;
  --teal: #4C6971;
  --lime: #D4F72A;
  --black: #111111;
  --paper: #FDFBF9;
  --border-main: #C8C1B6;
  --border-light: #EEEAE4;
  --gray-muted: #78716C;
  --gray-lighter: #9CA3AF;
  --gray-body: #44403C;
  --hover-bg: #F5F0EB;
  --color-large-city: #FE4F40;
  --color-midsize-city: #4C6971;
  --color-suburban: #7CB518;
  --color-small-city: #E8A838;
  --color-rural: #8B6F47;
  --color-town-remote: #9CA3AF;
  --font-body: 'DM Sans', sans-serif;
  --font-heading: 'Oswald', sans-serif;
  --nav-height: 56px;
}
```

**Step 2: Create global.css**

Port the reset, base styles, and shared component styles (search input, select dropdown, section label) from the existing CSS. Include Google Fonts import and mapbox-gl CSS import.

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Oswald:wght@700&display=swap');
@import 'mapbox-gl/dist/mapbox-gl.css';

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  background: var(--paper);
  color: var(--black);
}

/* Port shared styles: .search-input, .styled-select, .section-label, etc. */
```

**Step 3: Update main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 4: Verify styles load**

Start dev server: `cd "Students Per District/app" && npm run dev`
Check: page renders with correct fonts (DM Sans) and paper background color.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: set up design tokens and global styles"
```

---

### Task 7: Build Layout and Navigation Shell

**Files:**
- Create: `Students Per District/app/src/App.jsx`
- Create: `Students Per District/app/src/components/Layout.jsx`
- Create: `Students Per District/app/src/components/SubNav.jsx`
- Create: `Students Per District/app/src/styles/layout.css`

**Step 1: Build App.jsx with hash routing**

Port the existing hash router logic. App manages `currentPage` and `currentSubView` state, synced to URL hash.

```jsx
import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'

const VALID_PAGES = ['map', 'data', 'methodology']
const VALID_SUBVIEWS = ['states', 'districts', 'campuses']

function parseHash() {
  const hash = window.location.hash.replace('#', '')
  const [path, queryStr] = hash.split('?')
  const parts = path.split('/')
  const page = VALID_PAGES.includes(parts[0]) ? parts[0] : 'map'
  const subView = VALID_SUBVIEWS.includes(parts[1]) ? parts[1] : 'states'
  const params = {}
  if (queryStr) {
    queryStr.split('&').forEach(pair => {
      const [k, v] = pair.split('=')
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v)
    })
  }
  return { page, subView, params }
}

export default function App() {
  const [page, setPage] = useState('map')
  const [subView, setSubView] = useState('states')
  const [params, setParams] = useState({})

  const syncFromHash = useCallback(() => {
    const parsed = parseHash()
    setPage(parsed.page)
    setSubView(parsed.subView)
    setParams(parsed.params)
  }, [])

  useEffect(() => {
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [syncFromHash])

  const navigate = useCallback((newPage, newSubView, newParams) => {
    let hash = `#${newPage}`
    if (newSubView && (newPage === 'map' || newPage === 'data')) {
      hash += `/${newSubView}`
    }
    if (newParams) {
      const qs = Object.entries(newParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      if (qs) hash += `?${qs}`
    }
    window.location.hash = hash
  }, [])

  return (
    <Layout
      page={page}
      subView={subView}
      params={params}
      navigate={navigate}
    />
  )
}
```

**Step 2: Build Layout.jsx**

Port the top navigation bar HTML/CSS from the existing app. Include nav tabs for MAP, DATA, Methodology. Render SubNav for MAP and DATA pages. Render page content based on current page.

**Step 3: Build SubNav.jsx**

Segmented pill toggle for States | Districts | Campuses:

```jsx
export default function SubNav({ subView, onChange }) {
  const views = ['states', 'districts', 'campuses']
  return (
    <div className="sub-nav">
      {views.map(v => (
        <button
          key={v}
          className={`sub-nav-btn ${subView === v ? 'active' : ''}`}
          onClick={() => onChange(v)}
        >
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  )
}
```

**Step 4: Create layout.css**

Port the `#top-nav`, `.nav-tab`, `.nav-brand`, mobile hamburger styles from existing CSS. Add SubNav pill toggle styles.

**Step 5: Verify navigation works**

Start dev server. Click MAP → DATA → Methodology tabs. Click States → Districts → Campuses sub-nav. Verify URL hash updates correctly.

**Step 6: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: build layout shell with tab navigation and sub-nav"
```

---

## Phase 3: Data Loading Layer

### Task 8: Create Data Loading Hook

**Files:**
- Create: `Students Per District/app/src/hooks/useMapData.js`

**Step 1: Build useMapData hook**

Fetch and cache all GeoJSON/JSON data files. Return loading state and data objects.

```jsx
import { useState, useEffect } from 'react'

export function useMapData() {
  const [data, setData] = useState({
    campuses: null,
    districts: null,
    states: null,
    statesGeo: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function load() {
      try {
        const [campuses, districts, states, statesGeo] = await Promise.all([
          fetch('/data/campuses.geojson').then(r => r.json()),
          fetch('/data/districts.geojson').then(r => r.json()),
          fetch('/data/states.json').then(r => r.json()),
          fetch('/data/states.geojson').then(r => r.json()),
        ])
        setData({ campuses, districts, states, statesGeo, loading: false, error: null })
      } catch (error) {
        setData(prev => ({ ...prev, loading: false, error: error.message }))
      }
    }
    load()
  }, [])

  return data
}
```

**Step 2: Wire into App.jsx**

Call `useMapData()` at the top of App and pass data down to child components.

**Step 3: Verify data loads**

Add a temporary console.log in App.jsx:
```jsx
const data = useMapData()
useEffect(() => {
  if (!data.loading) console.log('Data loaded:', data.campuses?.features?.length, 'campuses')
}, [data.loading])
```

Check browser console shows "Data loaded: 1219 campuses".

**Step 4: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: add data loading hook for all GeoJSON/JSON files"
```

---

## Phase 4: Map Tab — Port Existing + Add State/District Layers

### Task 9: Build Shared MapView Component

**Files:**
- Create: `Students Per District/app/src/components/map/MapView.jsx`
- Create: `Students Per District/app/src/styles/map.css`

**Step 1: Build MapView with react-map-gl**

Single Map instance that persists across sub-view switches. Port the custom basemap overrides.

```jsx
import { useState, useCallback, useRef } from 'react'
import Map from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFja3NhbHR6bWFuIiwiYSI6ImNtbTltbmVuZTA0aWEycG9pNWJuZDR6dzYifQ.UT_hl5vyNQnGVDIq1GYkTw'

const INITIAL_VIEW = {
  longitude: -98.5,
  latitude: 39.8,
  zoom: 4,
}

export default function MapView({ subView, data, navigate }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const mapRef = useRef(null)

  const onLoad = useCallback((e) => {
    const map = e.target
    // Custom basemap overrides
    map.setPaintProperty('land', 'background-color', '#FAF8F5')
    map.setPaintProperty('water', 'fill-color', '#D4E8E4')
    // Tone down roads and labels (same as existing)
  }, [])

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        onLoad={onLoad}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Layer components render here based on subView */}
        {subView === 'states' && <StatesMapLayer data={data} />}
        {subView === 'districts' && <DistrictsMapLayer data={data} />}
        {subView === 'campuses' && <CampusesMapLayer data={data} />}
      </Map>
    </div>
  )
}
```

**Step 2: Create map.css**

Port map container styles, sidebar styles, popup styles from existing CSS.

**Step 3: Verify map renders**

Start dev server. Navigate to Map tab. Verify Mapbox map appears with custom basemap.

**Step 4: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: build shared MapView component with react-map-gl"
```

---

### Task 10: Build CampusesMapLayer (Port Existing Map)

**Files:**
- Create: `Students Per District/app/src/components/map/CampusesMapLayer.jsx`
- Create: `Students Per District/app/src/components/map/MapPopup.jsx`
- Create: `Students Per District/app/src/components/map/MapControls.jsx`

**Step 1: Build CampusesMapLayer**

Port all existing campus map functionality using react-map-gl's `<Source>` and `<Layer>` components:
- Campus points (sized by enrollment, colored by type)
- Commute circles (generated client-side)
- District boundaries (background)
- State borders (Mapbox vector tiles)
- Point clustering
- Campus click → fly-to, popup, district highlighting
- District hover → tooltip

This is the largest single task. Port the following from existing JS:
- `createCirclePolygon()` → utility function
- Campus source with clustering
- All layer definitions (district-fills, district-borders, district-hover, district-highlight-fills, district-highlight-borders, state-borders, circle-fills, circle-borders, clusters, cluster-count, campus-points)
- Click and hover handlers
- `highlightCampusDistricts()` and `clearDistrictHighlights()`

**Step 2: Build MapPopup**

Port `buildPopupHtml()` as a React component using react-map-gl's `<Popup>`.

**Step 3: Build MapControls**

Port the sidebar: search, state filter, layer toggles, numeric filters, summary stats, reset view button. This is a React component that receives campusesData and callbacks.

**Step 4: Verify all existing campus map functionality works**

Test: campus click → fly-to → popup → district highlight. Search. State filter. Layer toggles. Numeric filters. Clustering. Mobile hamburger.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: port campus map layer with all existing functionality"
```

---

### Task 11: Build StatesMapLayer

**Files:**
- Create: `Students Per District/app/src/components/map/StatesMapLayer.jsx`
- Create: `Students Per District/app/src/components/map/StateDetailPanel.jsx`

**Step 1: Build StatesMapLayer**

Choropleth of states colored by selected metric. Uses `<Source>` with states.geojson and `<Layer>` with data-driven fill-color.

```jsx
// Metric selector dropdown controls which property drives the fill color
// Hover → highlight border + tooltip
// Click → fly-to state bounds, open StateDetailPanel
```

Key implementation details:
- Metric options: enrollment, campus_count, avg_districts_reached, avg_midterm_turnout
- Color scales: Paper → Teal (sequential) for most metrics
- Use `feature-state` or `match` expressions for hover highlighting
- `fitBounds()` on state click using the state geometry bbox

**Step 2: Build StateDetailPanel**

Slide-in panel from right side showing:
- State name, key metrics
- List of districts in the state (with links to switch to Districts sub-view)
- List of campuses in the state (with links to switch to Campuses sub-view)

**Step 3: Add metric selector to MapControls**

When subView is 'states', show a metric dropdown in the sidebar/controls area.

**Step 4: Verify choropleth renders correctly**

Check: states are colored by metric, hover works, click zooms to state and opens panel.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: add states choropleth map layer with detail panel"
```

---

### Task 12: Build DistrictsMapLayer

**Files:**
- Create: `Students Per District/app/src/components/map/DistrictsMapLayer.jsx`
- Create: `Students Per District/app/src/components/map/DistrictDetailPanel.jsx`

**Step 1: Build DistrictsMapLayer**

Choropleth of districts colored by selected metric. Similar pattern to StatesMapLayer.

Key implementation details:
- Metric options: enrollment, campus_count, cook_pvi, midterm_turnout
- Cook PVI uses diverging scale: Coral (R) → Paper → Teal (D)
- Turnout uses: Paper → Coral (low → high)
- Other metrics use: Paper → Teal

**Step 2: Build DistrictDetailPanel**

Slide-in panel showing:
- District code, name, key metrics (PVI, turnout, enrollment, campus count)
- List of campuses reaching into this district (with links to Campuses sub-view)

**Step 3: Verify choropleth and interactions**

Check: districts colored by metric, hover tooltip, click zooms and opens detail panel, PVI diverging scale renders correctly.

**Step 4: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: add districts choropleth map layer with detail panel"
```

---

## Phase 5: Data Tab — Tables

### Task 13: Build CampusesTable (Port Existing Data Tab)

**Files:**
- Create: `Students Per District/app/src/components/data/CampusesTable.jsx`
- Create: `Students Per District/app/src/components/data/TableControls.jsx`
- Create: `Students Per District/app/src/styles/data.css`

**Step 1: Build CampusesTable with TanStack Table**

Port the existing data table using `@tanstack/react-table`:
- Columns: Name, City, State, Enrollment, Campus Type, Radius, Districts, Primary District, Coverage, All Districts
- Sorting (click column header)
- Column-level filtering (text and numeric range)
- Global search
- Group by (state, campus type, city, primary district)
- Pagination (50 per page)
- CSV export
- Campus name links → navigate to Map/Campuses sub-view zoomed to campus

**Step 2: Build TableControls**

Shared filter bar: search input, group-by dropdown, row count, export button.

**Step 3: Create data.css**

Port all data table styles from existing CSS (`.data-filter-bar`, `.data-table-wrap`, `.data-table`, column filters, pagination, mobile card layout).

**Step 4: Verify all existing table functionality works**

Test: sorting, filtering, searching, grouping, pagination, CSV export, campus link navigation.

**Step 5: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: port campus data table with TanStack Table"
```

---

### Task 14: Build StatesTable

**Files:**
- Create: `Students Per District/app/src/components/data/StatesTable.jsx`

**Step 1: Build StatesTable with TanStack Table**

Columns: State, Total Enrollment, Campus Count, District Count, Avg Districts Reached, Avg Midterm Turnout.

Features:
- Sorting (default: enrollment desc)
- Global search
- Column filtering
- Pagination
- CSV export
- State name links → navigate to Map/States sub-view zoomed to state

**Step 2: Verify table renders with real data**

Check: all states show, sorting works, enrollment totals match expected values, link navigation works.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: add states data table"
```

---

### Task 15: Build DistrictsTable

**Files:**
- Create: `Students Per District/app/src/components/data/DistrictsTable.jsx`

**Step 1: Build DistrictsTable with TanStack Table**

Columns: District, State, Enrollment, Campus Count, Cook PVI, Midterm Turnout.

Features:
- Sorting (default: enrollment desc)
- Global search
- Column filtering (including PVI text filter, turnout numeric range)
- Pagination
- CSV export
- District code links → navigate to Map/Districts sub-view zoomed to district

**Step 2: Verify table renders with real data**

Check: all districts show, Cook PVI displays correctly, filtering by PVI works, link navigation works.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: add districts data table"
```

---

## Phase 6: Methodology Tab + Cross-Linking

### Task 16: Port Methodology Tab

**Files:**
- Create: `Students Per District/app/src/components/methodology/Methodology.jsx`
- Create: `Students Per District/app/src/styles/methodology.css`

**Step 1: Port methodology content**

Convert the existing methodology HTML to a React component. Port the methodology CSS styles.

**Step 2: Verify content renders correctly**

Check: all tables, headings, lists, and code blocks render with correct styling.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: port methodology tab to React"
```

---

### Task 17: Wire Up Cross-View Navigation

**Files:**
- Modify: `Students Per District/app/src/components/map/StateDetailPanel.jsx`
- Modify: `Students Per District/app/src/components/map/DistrictDetailPanel.jsx`
- Modify: `Students Per District/app/src/components/data/StatesTable.jsx`
- Modify: `Students Per District/app/src/components/data/DistrictsTable.jsx`
- Modify: `Students Per District/app/src/components/data/CampusesTable.jsx`

**Step 1: Implement cross-linking navigation**

Wire up all cross-view links:
- State detail panel → "View Districts" button → `#data/districts?state=CA`
- State detail panel → "View Campuses" button → `#data/campuses?state=CA`
- District detail panel → "View Campuses" button → `#data/campuses?district=CA-12`
- States table → click state name → `#map/states?state=CA`
- Districts table → click district code → `#map/districts?district=CA-12`
- Campuses table → click campus name → `#map/campuses?campus=Name`

**Step 2: Handle URL params in each view**

When a view loads with params (e.g., `?state=CA`), apply the appropriate filter or zoom.

**Step 3: Verify all cross-links work**

Test each link type: data → map, map → data, state → district drill-down, district → campus drill-down.

**Step 4: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: wire up cross-view navigation between all views"
```

---

## Phase 7: Polish and Deploy

### Task 18: Mobile Responsive Design

**Files:**
- Modify: Various CSS files

**Step 1: Port mobile styles**

Ensure all views work on mobile (< 768px):
- Top nav hamburger menu
- Map sidebar collapse
- Data tables in card layout mode
- Side panels as full-screen overlays on mobile
- Touch-friendly buttons and inputs

**Step 2: Test at mobile viewport**

Use preview_resize to test at mobile (375x812) and tablet (768x1024) breakpoints.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "feat: mobile responsive design for all views"
```

---

### Task 19: Visual QA Against Existing App

**Files:**
- Various

**Step 1: Side-by-side comparison**

Run both the old app (port 8080) and new app (port 5173). Compare:
- Top navigation bar styling
- Map appearance (basemap, campus dots, circles, districts)
- Campus popup styling
- Data table styling
- Methodology page styling
- Color scheme accuracy
- Font rendering

**Step 2: Fix any visual discrepancies**

Match the existing app's visual design exactly for ported components.

**Step 3: Commit**

```bash
git add "Students Per District/app/src/"
git commit -m "fix: visual QA corrections to match existing design"
```

---

### Task 20: Update Vercel Deployment

**Files:**
- Modify: `vercel.json`
- Modify: `Students Per District/app/package.json`

**Step 1: Verify production build**

```bash
cd "Students Per District/app"
npm run build
```

Check: `dist/` directory contains `index.html` and bundled assets.

**Step 2: Test production build locally**

```bash
npx serve dist
```

Verify all functionality works in production build.

**Step 3: Update vercel.json if needed**

Ensure Vercel config points to the correct build output.

**Step 4: Commit**

```bash
git add vercel.json "Students Per District/app/"
git commit -m "chore: configure Vercel deployment for React app"
```

---

## Summary of Phases

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Data pipeline: enrich districts with PVI + turnout, aggregate per district/state, generate new data files |
| 2 | 5-7 | React + Vite scaffold: project init, design tokens, navigation shell |
| 3 | 8 | Data loading layer: useMapData hook |
| 4 | 9-12 | Map tab: shared MapView, port campuses layer, add states + districts choropleth |
| 5 | 13-15 | Data tab: port campuses table, add states + districts tables |
| 6 | 16-17 | Methodology + cross-view navigation |
| 7 | 18-20 | Mobile responsive, visual QA, deployment |

## Dependencies

- Tasks 1-4 are independent of Tasks 5-8 (can be parallelized)
- Task 8 depends on Tasks 1-4 (data must exist) and Task 5 (project must be scaffolded)
- Tasks 9-12 depend on Task 8 (data must be loadable)
- Tasks 13-15 depend on Task 8
- Task 16 depends on Task 7
- Task 17 depends on Tasks 9-15
- Tasks 18-20 depend on all prior tasks
