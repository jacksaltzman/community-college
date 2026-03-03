# Map Visual Upgrade — Design

**Date:** 2026-03-03
**Status:** Approved
**Scope:** Cartographic upgrade + polish pass for the Map tab

---

## 1. Campus Points & Clustering

### Clustering (zoom 3–6)
- Use Mapbox GL JS cluster source on `campuses` data
- Cluster bubbles sized by point count, colored teal (`#008080`), white count label
- Clicking a cluster zooms to expand it (`clusterExpansionZoom`)

### Individual Points (zoom 6+)
- Clusters break apart into individual campus dots
- **White stroke** instead of black — softer, more modern
- **Graduated circle size** by enrollment: interpolate radius from ~4px (small) to ~12px (large enrollment)
- Hover state: slight grow + brightness

### On Click
- **Smooth fly-to animation** (`map.flyTo()`) centering the clicked campus
- District highlights + popup behavior unchanged

---

## 2. Custom Basemap

Replace `mapbox://styles/mapbox/light-v11` with a **runtime-styled custom look** applied on top of `light-v11`:

- **Land fill**: warm cream `#FAF8F5`
- **Water fill**: muted teal `#D4E8E4`
- **Road lines**: reduced opacity, nearly invisible at low zoom
- **Labels**: toned down opacity (~0.7)
- State border layer unchanged (custom `#111111` layer already exists)

Implementation: keep `light-v11` as base, apply `map.setPaintProperty()` overrides on load for land, water, road, and label layers.

---

## 3. Popup & Interaction Upgrades

### Popup Card
- Left border stripe (3px) in the campus type color
- Campus name slightly larger, semi-bold
- More padding (16px), softer border-radius (10px)
- Subtle box-shadow for depth

### District Hover
- Light teal fill (`rgba(0,128,128,0.08)`) on hover over district polygons
- Small tooltip near cursor showing district name
- Distinct from coral click-highlight

---

## 4. Sidebar Cleanup

- Section headers get subtle background tint (`var(--hover-bg)`) with slight padding
- More vertical breathing room between sections (20px instead of 16px)
- Filter input focus ring animation (teal glow)

---

## Technical Notes

- Clustering requires restructuring the `campuses` source to use `cluster: true` option
- Existing filter functions (`applyMapFilters`) need to work with clustered source — filters apply to source, clusters auto-update
- `campusTypeColors` expression continues to drive individual point colors
- Fly-to uses `map.flyTo({ center, zoom: 10, duration: 1200 })`
- Basemap overrides target Mapbox Streets v8 source layers: `land`, `water`, `road`, `road-label`, etc.
