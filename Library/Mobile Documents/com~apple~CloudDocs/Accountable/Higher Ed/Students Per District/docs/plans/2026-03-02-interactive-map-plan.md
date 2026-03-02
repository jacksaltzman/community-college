# Interactive Community College District Map — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive Mapbox GL JS map showing every U.S. community college with commute-shed circles and congressional district boundaries, styled to Accountable brand.

**Architecture:** Python script (`generate_map_data.py`) converts pipeline Excel output + CD118 shapefile into GeoJSON files. Single HTML file (`index.html`) loads those GeoJSONs with Mapbox GL JS for rendering, filtering, and popups. No build step.

**Tech Stack:** Python 3.11 (geopandas, pandas, openpyxl, json), Mapbox GL JS v3, vanilla HTML/CSS/JS

---

### Task 1: Create generate_map_data.py — campuses GeoJSON

**Files:**
- Create: `code/generate_map_data.py`

**Step 1: Write the script that reads the Excel Summary sheet and outputs campuses.geojson**

```python
"""
Generate GeoJSON data files for the interactive map.

Reads:
  - output/cc_district_intersections.xlsx  (Summary sheet)
  - data/cd118/*.shp                       (CD118 shapefile)

Writes:
  - map/data/campuses.geojson
  - map/data/districts.geojson
"""

import glob
import json
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent  # Students Per District/
EXCEL_PATH = BASE_DIR / "output" / "cc_district_intersections.xlsx"
CD118_DIR = BASE_DIR / "data" / "cd118"
MAP_DATA_DIR = BASE_DIR / "map" / "data"

# FIPS → state abbreviation (same as pipeline.py)
FIPS_TO_STATE = {
    "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
    "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
    "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
    "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
    "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
    "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
    "54":"WV","55":"WI","56":"WY","60":"AS","66":"GU","69":"MP","72":"PR","78":"VI",
}


def generate_campuses_geojson() -> None:
    """Read Summary sheet from Excel and write campuses.geojson."""
    MAP_DATA_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_excel(EXCEL_PATH, sheet_name="Summary")

    # The Excel has human-friendly column names from write_excel().
    # Map them back to internal names for processing.
    col_map = {
        "IPEDS ID": "unitid",
        "Institution": "name",
        "City": "city",
        "State": "state",
        "Latitude": "lat",
        "Longitude": "lon",
        "Enrollment": "enrollment",
        "Tract Density (pop/sq mi)": "tract_density",
        "Campus Type": "campus_type",
        "Commute Radius (mi)": "radius_miles",
        "Districts Reached": "districts_reached",
        "Primary District": "primary_district",
        "Primary District Coverage": "primary_district_coverage",
        "All Districts": "all_districts",
    }
    df = df.rename(columns=col_map)

    features = []
    for _, row in df.iterrows():
        lat = row.get("lat")
        lon = row.get("lon")
        if pd.isna(lat) or pd.isna(lon):
            continue

        props = {}
        for col in ["unitid", "name", "city", "state", "enrollment",
                     "campus_type", "radius_miles", "tract_density",
                     "districts_reached", "primary_district",
                     "primary_district_coverage", "all_districts",
                     "lat", "lon"]:
            val = row.get(col)
            if pd.isna(val):
                props[col] = None
            elif isinstance(val, float) and val == int(val):
                props[col] = int(val)
            else:
                props[col] = val

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)],
            },
            "properties": props,
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}
    out_path = MAP_DATA_DIR / "campuses.geojson"
    with open(out_path, "w") as f:
        json.dump(geojson, f)

    print(f"Wrote {len(features)} campuses to {out_path}")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  File size: {size_mb:.2f} MB")
```

**Step 2: Run and verify**

Run: `cd "Students Per District" && python3 -c "from code.generate_map_data import generate_campuses_geojson; generate_campuses_geojson()"`

Or add a `main()` at the bottom and run: `python3 code/generate_map_data.py`

Expected: `map/data/campuses.geojson` created with ~1,170 features. File size < 1 MB.

---

### Task 2: Add districts GeoJSON generation

**Files:**
- Modify: `code/generate_map_data.py`

**Step 1: Add generate_districts_geojson() function**

```python
def generate_districts_geojson() -> None:
    """Read CD118 shapefile and write districts.geojson."""
    MAP_DATA_DIR.mkdir(parents=True, exist_ok=True)

    shp_files = glob.glob(str(CD118_DIR / "*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No .shp file found in {CD118_DIR}")

    gdf = gpd.read_file(shp_files[0])

    # Ensure CRS is EPSG:4326 for Mapbox
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    features = []
    for _, row in gdf.iterrows():
        statefp = str(row["STATEFP"]).zfill(2)
        cd118fp = str(row["CD118FP"]).zfill(2)
        state_abbrev = FIPS_TO_STATE.get(statefp, statefp)
        cd_number = int(cd118fp) if cd118fp.isdigit() else 0

        if cd_number == 0:
            cd_code = f"{state_abbrev}-AL"
        else:
            cd_code = f"{state_abbrev}-{cd_number}"

        geom = row.geometry.__geo_interface__

        feature = {
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "cd_code": cd_code,
                "state": state_abbrev,
                "state_fips": statefp,
                "district_number": cd_number,
                "name": row.get("NAMELSAD", ""),
            },
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}
    out_path = MAP_DATA_DIR / "districts.geojson"
    with open(out_path, "w") as f:
        json.dump(geojson, f)

    print(f"Wrote {len(features)} districts to {out_path}")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  File size: {size_mb:.2f} MB")
```

**Step 2: Add main() to call both functions**

```python
def main() -> None:
    print("=== Generating map data ===")
    generate_campuses_geojson()
    generate_districts_geojson()
    print("=== Done ===")


if __name__ == "__main__":
    main()
```

**Step 3: Run and verify**

Run: `cd "Students Per District" && python3 code/generate_map_data.py`

Expected: Both files created in `map/data/`. `campuses.geojson` ~0.5 MB, `districts.geojson` ~5-15 MB. Both valid JSON.

Quick validation: `python3 -c "import json; d=json.load(open('map/data/districts.geojson')); print(len(d['features']), 'districts')"`

Expected: `441 districts`

---

### Task 3: Build the HTML map — basemap, sidebar shell, and campus points layer

**Files:**
- Create: `map/index.html`

**Step 1: Create index.html with Mapbox GL JS, branded sidebar, and campus points**

This is a single self-contained HTML file. The Mapbox token is set as a JS constant at the top — the user replaces `YOUR_MAPBOX_TOKEN_HERE` with their actual token.

The file must include:

1. **HTML structure:**
   - `<div id="sidebar">` (320px, left side) with:
     - Black header bar with inline Accountable logo SVG (the checkmark logo from `file.svg`, scaled to ~32px, white on black) and title "COMMUNITY COLLEGE DISTRICT MAP" in Oswald
     - Search input for college name
     - State dropdown filter (all 50 states + DC + territories)
     - Layer toggle checkboxes (Campus Points, Commute Circles, Districts)
     - Campus type legend (4 colored dots with labels)
     - Stats div (filled after data loads)
   - `<div id="map">` (fills remaining viewport)

2. **CSS (inline `<style>`):**
   - Import Google Fonts: DM Sans (400, 500, 700) and Oswald (700)
   - Sidebar: `width: 320px; background: #FDFBF9; border-right: 1px solid #C8C1B6`
   - Header: `background: #111111; padding: 12px 16px`
   - Title: `font-family: 'Oswald'; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: white; font-size: 14px`
   - Search input: `border: 1px solid #C8C1B6; border-radius: 6px; font-family: 'DM Sans'`
   - Toggles/labels: `font-family: 'Oswald'; text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; color: #78716C`
   - Legend dots: 10px circles with campus type colors
   - Map: `flex: 1; height: 100vh`
   - No shadows anywhere. `border-radius: 6px` for cards, `border-radius: 2px` for badges/buttons
   - Popup overrides: override Mapbox default popup with brand fonts/colors

3. **JavaScript:**
   - Initialize Mapbox map centered on CONUS `[-98.5, 39.8]`, zoom 4, style `mapbox://styles/mapbox/light-v11`
   - On map load, fetch `data/campuses.geojson` and `data/districts.geojson`
   - Add `campuses` source and `campus-points` layer:
     - Type: `circle`
     - `circle-radius`: 5 (zoom-interpolated: 3 at zoom 3, 8 at zoom 10)
     - `circle-color`: match on `campus_type` property:
       - Compact → `#FE4F40`
       - Mid-Size → `#4C6971`
       - Large Metro → `#D4F72A`
       - Sprawl-Fragmented → `#9CA3AF`
     - `circle-stroke-width`: 1
     - `circle-stroke-color`: `#111111`
   - Compute and display stats in sidebar (total campuses, avg districts reached)

**Step 2: Run and verify**

Open `map/index.html` in a browser (after adding Mapbox token).

Expected: Map renders with light basemap. ~1,170 colored dots visible across the US. Sidebar shows with logo, title, controls (not yet functional). Stats show at bottom.

---

### Task 4: Add congressional district polygons layer

**Files:**
- Modify: `map/index.html`

**Step 1: Add districts layer to the map**

After loading `districts.geojson`, add two layers:

1. `district-fills` layer:
   - Type: `fill`
   - `fill-color`: `#F5F0EB`
   - `fill-opacity`: 0.3

2. `district-borders` layer:
   - Type: `line`
   - `line-color`: `#111111`
   - `line-width`: 0.5 (zoom-interpolated: 0.3 at zoom 3, 1.5 at zoom 10)
   - `line-opacity`: 0.5

Add these BELOW the campus-points layer so dots render on top.

**Step 2: Add district hover tooltip**

On `mousemove` over `district-fills`:
- Show a simple tooltip div (positioned at mouse) with the `cd_code` property (e.g., "CA-12")
- Style: `background: white; border: 1px solid #C8C1B680; border-radius: 6px; padding: 4px 8px; font-family: 'Oswald'; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #111111`
- On `mouseleave`, hide the tooltip
- Change cursor to `pointer` on hover

**Step 3: Run and verify**

Expected: District boundaries visible as thin lines with light fill. Hover shows district code tooltip. Campus dots render on top of districts.

---

### Task 5: Add commute-shed circle layer

**Files:**
- Modify: `map/index.html`

**Step 1: Generate circle polygons from campus points**

After loading `campuses.geojson`, generate a new GeoJSON FeatureCollection where each feature is a circle polygon computed client-side:

```javascript
function createCircleFeature(center, radiusMiles, properties) {
    const radiusKm = radiusMiles * 1.60934;
    const points = 64;
    const coords = [];
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusKm * Math.cos(angle);
        const dy = radiusKm * Math.sin(angle);
        const lat = center[1] + (dy / 111.32);
        const lon = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));
        coords.push([lon, lat]);
    }
    coords.push(coords[0]); // close ring
    return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: properties,
    };
}
```

Build circle features for every campus using their `radius_miles` property.

**Step 2: Add circle layers**

Add `commute-circles` source with the generated GeoJSON, then two layers:

1. `circle-fills`:
   - Type: `fill`
   - `fill-color`: match on `campus_type` (same 4 colors)
   - `fill-opacity`: 0.12

2. `circle-borders`:
   - Type: `line`
   - `line-color`: match on `campus_type` (same 4 colors)
   - `line-width`: 1
   - `line-opacity`: 0.4

Insert these layers ABOVE district-borders but BELOW campus-points.

**Step 3: Run and verify**

Expected: Semi-transparent colored circles visible around each campus dot. Circles overlap in dense areas. Colors match the campus type of each dot.

---

### Task 6: Add campus click popup

**Files:**
- Modify: `map/index.html`

**Step 1: Add click handler for campus-points layer**

On click of `campus-points`:
- Get the clicked feature's properties
- Create a Mapbox `Popup` at the click coordinates
- Popup HTML content:

```html
<div class="campus-popup">
  <h3 class="popup-title">{name}</h3>
  <p class="popup-subtitle">{city}, {state}</p>
  <div class="popup-stats">
    <div class="popup-row">
      <span class="popup-label">ENROLLMENT</span>
      <span class="popup-value">{enrollment, formatted with commas}</span>
    </div>
    <div class="popup-row">
      <span class="popup-label">CAMPUS TYPE</span>
      <span class="popup-value">{campus_type}</span>
    </div>
    <div class="popup-row">
      <span class="popup-label">COMMUTE RADIUS</span>
      <span class="popup-value">{radius_miles} mi</span>
    </div>
    <div class="popup-row">
      <span class="popup-label">DISTRICTS REACHED</span>
      <span class="popup-value">{districts_reached}</span>
    </div>
    <div class="popup-row">
      <span class="popup-label">PRIMARY DISTRICT</span>
      <span class="popup-value">{primary_district} ({primary_district_coverage as %})</span>
    </div>
    <div class="popup-row">
      <span class="popup-label">ALL DISTRICTS</span>
      <span class="popup-value">{all_districts, pipes replaced with ", "}</span>
    </div>
  </div>
</div>
```

**Step 2: Style the popup**

Override Mapbox popup styles:
- `.popup-title`: `font-family: 'Oswald'; font-weight: 700; font-size: 16px; color: #111111; text-transform: uppercase; margin: 0`
- `.popup-subtitle`: `font-family: 'DM Sans'; font-size: 13px; color: #78716C; margin: 2px 0 8px`
- `.popup-label`: `font-family: 'Oswald'; text-transform: uppercase; letter-spacing: 0.15em; font-size: 10px; color: #78716C`
- `.popup-value`: `font-family: 'DM Sans'; font-size: 13px; color: #111111; font-weight: 500`
- `.popup-row`: `display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #EEEAE4`
- Remove default Mapbox popup shadow, use `border: 1px solid #C8C1B680; border-radius: 6px`
- Max width: 320px

**Step 3: Change cursor to pointer when hovering campus dots**

**Step 4: Run and verify**

Expected: Click any campus dot → popup appears with full stats. Styled with Accountable fonts. Close button works. Clicking elsewhere closes popup.

---

### Task 7: Add sidebar interactivity — search, state filter, layer toggles

**Files:**
- Modify: `map/index.html`

**Step 1: Implement college name search**

- On input in the search box, filter the `campus-points` layer using `map.setFilter('campus-points', ['in', 'name', ...matchingNames])` — or more efficiently, use a case-insensitive string match:
  - Build a list of matching unitids from the loaded GeoJSON data
  - `map.setFilter('campus-points', ['in', ['get', 'unitid'], ['literal', matchingIds]])` if search has text
  - Clear filter when search is empty
- Also filter `circle-fills` and `circle-borders` the same way
- Show a dropdown of matching results (max 10) below the search input
- Clicking a result: flies to that campus (`map.flyTo`), opens its popup

**Step 2: Implement state dropdown filter**

- Populate dropdown with all unique states from the loaded campus data, sorted alphabetically, plus an "All States" option at top
- On change:
  - If "All States": clear all filters, fly to CONUS view `[-98.5, 39.8]` zoom 4
  - Otherwise: filter campus-points and circle layers to that state, compute the bounding box from the filtered features, `map.fitBounds(bbox, {padding: 50})`

**Step 3: Implement layer toggles**

Three checkboxes (all checked by default):
- "Campus Points" → toggles `campus-points` layer visibility
- "Commute Circles" → toggles `circle-fills` and `circle-borders` visibility
- "District Boundaries" → toggles `district-fills` and `district-borders` visibility

Use `map.setLayoutProperty(layerId, 'visibility', checked ? 'visible' : 'none')`.

**Step 4: Run and verify**

Expected:
- Type "Portland" in search → see matching campuses, click one → flies to it and opens popup
- Select "OR" from state dropdown → map zooms to Oregon, only Oregon campuses visible
- Uncheck "Commute Circles" → circles disappear, dots and districts remain
- Select "All States" → returns to full view

---

### Task 8: Mobile responsive layout

**Files:**
- Modify: `map/index.html`

**Step 1: Add responsive CSS**

At `@media (max-width: 768px)`:
- Sidebar: position absolute, full width, collapsed to a 48px header bar by default
- Add a hamburger toggle button (three lines) in the header bar, positioned right
- On toggle: expand sidebar to full overlay (with `z-index` above map)
- Map: full viewport behind sidebar

**Step 2: Adjust popup positioning for mobile**

Popups should anchor appropriately on small screens. Set `maxWidth: '280px'` on mobile.

**Step 3: Run and verify**

Resize browser to ~375px width. Expected: sidebar collapses to header bar. Hamburger button toggles full sidebar overlay. Map fills viewport. Popups fit on screen.

---

### Task 9: Final polish and verification

**Files:**
- Modify: `map/index.html` (if needed)
- Modify: `code/generate_map_data.py` (if needed)

**Step 1: Add a Mapbox token instruction banner**

If the user hasn't replaced the token placeholder, show a visible banner at top of page: "Add your Mapbox token to use this map. Get a free token at mapbox.com"

**Step 2: Run full pipeline**

Run: `cd "Students Per District" && python3 code/generate_map_data.py`

Verify both GeoJSON files exist and are valid.

**Step 3: Open map in browser and spot-check**

- Verify: all ~1,170 campus dots visible
- Verify: 4 campus type colors rendering correctly (coral for compact, teal for mid-size, lime for large metro, gray for sprawl)
- Verify: district boundaries visible with thin lines
- Verify: commute circles rendering with correct colors and transparency
- Click Portland Community College → popup shows OR-3 area districts
- Click a NYC campus → popup shows multiple districts
- Search for "Wyoming" → find College of Eastern Utah or similar
- State filter → select TX → zooms to Texas
- Toggle layers on/off
- Test mobile view at 375px width

**Step 4: Log final stats**

Print: total campuses rendered, total districts rendered, file sizes
