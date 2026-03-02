# Interactive Community College District Map — Design

**Goal:** Build a browser-based interactive map showing every U.S. community college, its commute-shed radius, and congressional district boundaries, styled to Accountable brand guidelines.

**Architecture:** Python data-generation script + single self-contained HTML file using Mapbox GL JS. No build step — open index.html in a browser.

**Tech Stack:** Mapbox GL JS (vector tiles + GeoJSON layers), vanilla HTML/CSS/JS, Python (data generation)

---

## File Structure

```
Students Per District/
├── code/
│   ├── pipeline.py              (existing)
│   └── generate_map_data.py     (new — generates GeoJSON from Excel + shapefile)
├── map/
│   ├── index.html               (new — interactive map)
│   └── data/
│       ├── campuses.geojson     (generated)
│       └── districts.geojson    (generated)
├── Environment.txt              (existing — add MAPBOX_TOKEN=pk.xxx)
```

---

## Data Layer

### generate_map_data.py

Reads pipeline output and produces two GeoJSON files:

**campuses.geojson** — Point features from the Summary sheet:
- Properties: unitid, name, city, state, enrollment, campus_type, radius_miles, tract_density, districts_reached, primary_district, primary_district_coverage, all_districts, lat, lon

**districts.geojson** — Polygon features from CD118 shapefile:
- Reproject to EPSG:4326
- Properties: cd_code (e.g., "CA-12", "WY-0"), state, district_number, state_fips
- 500k resolution (already web-optimized from Census)

---

## Map UI

### Layout

Full-viewport map with branded sidebar (~320px) on the left.

### Sidebar Components

1. **Header** — Black bar with Accountable logo (SVG, inverted white), "Community College District Map" in Oswald uppercase
2. **Search** — Type-ahead filter by college name
3. **State filter** — Dropdown to zoom to a specific state
4. **Layer toggles** — Checkboxes: Campus Points, Commute Circles, District Boundaries
5. **Campus type legend** — Color-coded dots for each type
6. **Stats summary** — Total campuses, average districts reached

### Map Layers (bottom to top)

1. Mapbox basemap (light/minimal style)
2. Congressional district polygons — `#111111` borders, `#F5F0EB` fill at ~30% opacity
3. Commute-shed circles — fill by campus type at ~15% opacity, stroke at ~50% opacity
4. Campus point dots — solid color by campus type, ~8px radius

### Campus Type Colors (from brand palette)

| Type               | Color     | Token        |
|--------------------|-----------|--------------|
| Compact            | `#FE4F40` | Brand Coral  |
| Mid-Size           | `#4C6971` | Brand Teal   |
| Large Metro        | `#D4F72A` | Brand Lime   |
| Sprawl-Fragmented  | `#9CA3AF` | Gray         |

### Interactions

**Click campus dot** → Popup with:
- Institution name (Oswald bold)
- City, State
- Enrollment, Campus Type, Commute Radius
- Districts Reached count
- Primary District + coverage %
- All districts list

**Hover district polygon** → Tooltip with district code (e.g., "CA-12")

**Search** → Filters campus dots, clicking result flies to campus and opens popup

**State filter** → Zooms to state bounding box

**Layer toggles** → Show/hide each layer independently

### Responsive

Mobile: sidebar collapses to hamburger / bottom sheet toggle.

---

## Brand Compliance

- **Colors:** Coral, Teal, Lime, Gray from brand palette. Black (#111111) for nav/headers. Paper (#FDFBF9) warmth.
- **Typography:** DM Sans (body), Oswald (headings/labels, uppercase + tracking)
- **Components:** rounded-lg cards, rounded-sm badges, no shadows, flat aesthetic
- **Logo:** SVG version, inverted white on black header
- **Prohibited:** No shadows, no rounded-2xl, no serif fonts, no blue gradients

---

## Configuration

Mapbox token stored in `Environment.txt`:
```
CENSUS_API_KEY=...
MAPBOX_TOKEN=pk.xxx
```

`generate_map_data.py` does not need the Mapbox token. `index.html` reads it from a JS constant at the top of the file (user pastes it once).
