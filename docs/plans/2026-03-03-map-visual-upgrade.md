# Map Visual Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the map tab with point clustering, custom basemap, improved popup card, district hover, fly-to animations, and sidebar polish.

**Architecture:** All changes are in the single `index.html` file. The campuses source gains `cluster: true` which automatically groups points. Basemap is customized via runtime `setPaintProperty` calls on `light-v11`. Popup HTML gets a color-coded stripe. Sidebar sections get visual spacing improvements.

**Tech Stack:** Mapbox GL JS v3.4.0, vanilla JS/CSS, single-file HTML app.

---

### Task 1: Custom Basemap Overrides

**Files:**
- Modify: `Students Per District/map/index.html` — inside `map.on('load', ...)` callback (~line 2440)

**Step 1: Add basemap style overrides after `map.on('load', async () => {`**

Add this block right after the `map.on('load', async () => {` line (before the circle features computation):

```javascript
/* ── Custom basemap overrides ── */
map.setPaintProperty('land', 'background-color', '#FAF8F5');
map.setPaintProperty('water', 'fill-color', '#D4E8E4');

// Tone down roads at low zoom
['road-simple', 'road-path', 'road-path-trail', 'road-path-cycleway-piste',
 'road-pedestrian', 'road-steps', 'road-rail'].forEach(id => {
  try { map.setPaintProperty(id, 'line-opacity', 0.3); } catch(e) {}
});

// Soften labels
['road-label-simple', 'waterway-label', 'water-line-label', 'water-point-label'].forEach(id => {
  try { map.setLayoutProperty(id, 'text-opacity', 0.7); } catch(e) {}
});
```

**Step 2: Verify basemap looks warm/branded**

Reload the page, navigate to Map tab. Land should be cream-tinted, water should be muted teal, roads nearly invisible.

**Step 3: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: apply custom basemap overrides for warmer branded look"
```

---

### Task 2: Point Clustering

This is the biggest change. The `campuses` source needs `cluster: true`, and we add cluster-specific layers. The existing `campus-points` layer handles unclustered points.

**Files:**
- Modify: `Students Per District/map/index.html` — source definition (~line 2455), layer definitions (~2544-2554), and `applyMapFilters` (~2807-2810)

**Step 1: Modify the campuses source to enable clustering**

Change:
```javascript
map.addSource('campuses', { type: 'geojson', data: campusesData });
```

To:
```javascript
map.addSource('campuses', {
  type: 'geojson',
  data: campusesData,
  cluster: true,
  clusterMaxZoom: 9,
  clusterRadius: 50,
});
```

**Step 2: Add cluster layers BEFORE the `campus-points` layer**

Insert these two layers just before the existing `campus-points` addLayer call:

```javascript
/* Cluster circles */
map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'campuses',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#4C6971',
    'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28, 100, 34],
    'circle-stroke-width': 2,
    'circle-stroke-color': 'rgba(255,255,255,0.7)',
  },
});

/* Cluster count labels */
map.addLayer({
  id: 'cluster-count',
  type: 'symbol',
  source: 'campuses',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-size': 12,
    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
    'text-allow-overlap': true,
  },
  paint: {
    'text-color': '#ffffff',
  },
});
```

**Step 3: Add `filter: ['!', ['has', 'point_count']]` to campus-points layer**

The existing `campus-points` layer needs to only show unclustered points. Change its definition to add a filter:

```javascript
map.addLayer({
  id: 'campus-points',
  type: 'circle',
  source: 'campuses',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 10, 8],
    'circle-color': campusTypeColors,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#111111',
  },
});
```

**Step 4: Add click-to-zoom on clusters**

After `setupMapFilters()` in the load callback, add:

```javascript
/* Click cluster to zoom in */
map.on('click', 'clusters', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
  const clusterId = features[0].properties.cluster_id;
  map.getSource('campuses').getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err) return;
    map.flyTo({ center: features[0].geometry.coordinates, zoom: zoom + 1, duration: 800 });
  });
});

map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
```

**Step 5: Update `applyMapFilters()` to include cluster layers**

In `applyMapFilters()`, change the three `setFilter` lines. We need to combine the user's filter with the cluster filter for `campus-points`:

```javascript
// Apply to campus layers (preserve cluster filter on campus-points)
const unclustered = mapFilter
  ? ['all', ['!', ['has', 'point_count']], ...conditions]
  : ['!', ['has', 'point_count']];
map.setFilter('campus-points', unclustered);
map.setFilter('circle-fills', mapFilter);
map.setFilter('circle-borders', mapFilter);
```

Note: Cluster layers (`clusters`, `cluster-count`) filter automatically from the source data, but Mapbox clustering doesn't support source-level filters. For filtered views, we need to update the source data directly. Add after the setFilter calls:

```javascript
// Update clustered source with filtered data when filters active
if (jsFilters.length > 0) {
  const filteredGeoJSON = { type: 'FeatureCollection', features: filtered };
  map.getSource('campuses').setData(filteredGeoJSON);
} else {
  map.getSource('campuses').setData(campusesData);
}
```

And remove the separate `map.setFilter('campus-points', ...)` since it's now handled by source data swap. The final filter block becomes:

```javascript
map.setFilter('circle-fills', mapFilter);
map.setFilter('circle-borders', mapFilter);

// Update clustered source data (clusters don't support setFilter)
let filtered = campusesData.features;
jsFilters.forEach(fn => { filtered = filtered.filter(fn); });
const filteredGeoJSON = { type: 'FeatureCollection', features: filtered };
map.getSource('campuses').setData(jsFilters.length > 0 ? filteredGeoJSON : campusesData);

updateMapStats(filtered);
updateMapFilterIndicators();
```

**Step 6: Update `setupLayerToggles` for new layers**

In the `toggle-campuses` handler, also toggle cluster layers:

```javascript
document.getElementById('toggle-campuses').addEventListener('change', function () {
  const vis = this.checked ? 'visible' : 'none';
  map.setLayoutProperty('campus-points', 'visibility', vis);
  map.setLayoutProperty('clusters', 'visibility', vis);
  map.setLayoutProperty('cluster-count', 'visibility', vis);
});
```

**Step 7: Verify clustering works**

Reload, navigate to Map. At national zoom, campuses should appear as teal bubbles with white counts. Zooming in should break them apart. Clicking a cluster should zoom in. Filters should update clusters.

**Step 8: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: add point clustering for campuses at national zoom"
```

---

### Task 3: Graduated Circle Sizes & White Stroke

**Files:**
- Modify: `Students Per District/map/index.html` — `campus-points` paint properties (~line 2548)

**Step 1: Update campus-points paint**

Change the `campus-points` paint to:

```javascript
paint: {
  'circle-radius': [
    'interpolate', ['linear'],
    ['coalesce', ['get', 'enrollment'], 0],
    0, 3,
    2000, 4,
    5000, 6,
    15000, 9,
    50000, 13
  ],
  'circle-color': campusTypeColors,
  'circle-stroke-width': 1.5,
  'circle-stroke-color': '#ffffff',
  'circle-opacity': 0.9,
},
```

Enrollment ranges: min=0, p25=1568, median=3887, p75=9278, max=164377. The interpolation gives visual hierarchy while keeping small campuses visible.

**Step 2: Verify individual points vary in size with white borders**

Zoom in to a metro area (e.g., Los Angeles). Large enrollment campuses should be noticeably bigger. All dots should have white strokes instead of black.

**Step 3: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: graduate campus dot sizes by enrollment, use white stroke"
```

---

### Task 4: Fly-To Animation on Campus Click

**Files:**
- Modify: `Students Per District/map/index.html` — `setupCampusClick()` function (~line 2610)

**Step 1: Add flyTo before popup**

In `setupCampusClick`, right after the `highlightCampusDistricts(...)` call (line ~2621), add:

```javascript
map.flyTo({
  center: coords,
  zoom: Math.max(map.getZoom(), 8),
  duration: 1000,
  essential: true,
});
```

This flies to the campus but only zooms in if current zoom is less than 8 — doesn't zoom out if already close.

**Step 2: Do the same in the search result click handler**

Find the search result click handler (where it also creates a popup after a search result is clicked) and add the same flyTo pattern there if not already present.

**Step 3: Verify**

Click a campus at national zoom — should smoothly fly to it. Click a campus while already zoomed in — should pan without zooming out.

**Step 4: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: add smooth fly-to animation on campus click"
```

---

### Task 5: District Hover Effect

**Files:**
- Modify: `Students Per District/map/index.html` — `setupDistrictHover()` function (~line 2591) and district layer paint

**Step 1: Add a hover highlight layer**

After the existing `district-borders` layer (around line 2478), add:

```javascript
map.addLayer({
  id: 'district-hover',
  type: 'fill',
  source: 'districts',
  paint: {
    'fill-color': '#4C6971',
    'fill-opacity': 0,
  },
});
```

Insert this BEFORE the `district-highlight-fills` layer so click highlights render on top.

**Step 2: Update `setupDistrictHover()` to set hover opacity**

Add to the `mousemove` handler (after tooltip positioning):

```javascript
const hoveredId = e.features[0].id ?? e.features[0].properties.cd_code;
map.setPaintProperty('district-hover', 'fill-opacity', 0.08);
map.setFilter('district-hover', ['==', ['get', 'cd_code'], e.features[0].properties.cd_code]);
```

And in the `mouseleave` handler:

```javascript
map.setPaintProperty('district-hover', 'fill-opacity', 0);
map.setFilter('district-hover', ['==', ['get', 'cd_code'], '']);
```

**Step 3: Verify**

Hover over districts — should show a subtle teal wash. The tooltip should still follow cursor. Clicking a campus should still show coral highlights on top.

**Step 4: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: add teal hover effect on district polygons"
```

---

### Task 6: Popup Card Polish

**Files:**
- Modify: `Students Per District/map/index.html` — popup CSS (~line 688-743) and `buildPopupHtml()` function (~line 2031)

**Step 1: Update popup CSS**

Replace the `.mapboxgl-popup-content` rule:

```css
.mapboxgl-popup-content {
  border-radius: 10px;
  border: 1px solid rgba(200,193,182,0.4);
  padding: 0;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  overflow: hidden;
}
```

Update `.campus-popup`:

```css
.campus-popup {
  min-width: 220px;
  max-width: 300px;
  padding: 14px 16px;
  border-left: 4px solid var(--coral);
}
```

**Step 2: Update `buildPopupHtml()` to pass campus type color**

Create a color lookup and use it for the border:

```javascript
function getCampusTypeColor(type) {
  const colors = {
    'Large City': '#FE4F40',
    'Midsize City': '#4C6971',
    'Suburban': '#7CB518',
    'Small City': '#E8A838',
    'Rural': '#8B6F47',
    'Town / Remote': '#9CA3AF',
  };
  return colors[type] || '#9CA3AF';
}
```

Then update the popup HTML template to include the color as an inline style:

```javascript
return `
  <div class="campus-popup" style="border-left-color: ${getCampusTypeColor(props.campus_type)}">
    <div class="popup-title">${escapeHtml(props.name)}</div>
    ...
  </div>
`;
```

**Step 3: Verify**

Click a campus. Popup should have rounded corners, subtle shadow, and a left color stripe matching the campus type color.

**Step 4: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: polish popup card with color stripe, shadow, rounded corners"
```

---

### Task 7: Sidebar Section Polish

**Files:**
- Modify: `Students Per District/map/index.html` — sidebar CSS (~line 488), section-label CSS (~line 199), filter input CSS (~line 587)

**Step 1: Update `.sidebar-section` padding**

```css
.sidebar-section {
  padding: 18px 16px;
  border-bottom: 1px solid var(--border-light);
}
```

**Step 2: Update `.section-label` with background tint**

```css
.section-label {
  font-family: var(--font-heading);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 11px;
  color: var(--gray-muted);
  margin: -18px -16px 12px;
  padding: 8px 16px;
  font-weight: 700;
  background: var(--hover-bg);
  border-bottom: 1px solid var(--border-light);
}
```

Note: the negative margins pull the label to the edges of the section, creating a full-bleed header bar.

**Step 3: Add focus glow to filter inputs**

Update `.map-filter-input:focus`:

```css
.map-filter-input:focus {
  border-color: var(--teal);
  box-shadow: 0 0 0 2px rgba(76,105,113,0.12);
}
```

**Step 4: Verify**

Section headers should have a light cream background strip. Filter inputs should glow teal on focus.

**Step 5: Commit**

```bash
git add "Students Per District/map/index.html"
git commit -m "feat: polish sidebar sections with header tints and focus glow"
```

---

### Task 8: Final Verification & Push

**Step 1: Full smoke test**

- Load page → Summary tab shows
- Click Map → clusters visible at national zoom
- Zoom in → clusters break into colored, size-graduated dots
- Click a cluster → flies to expand
- Click a campus → flies to it, popup with color stripe appears, districts highlight coral
- Hover a district → subtle teal fill + tooltip
- Use state dropdown → filters and clusters update
- Use enrollment/districts filters → clusters and stats update
- Reset View → returns to national view, clears filters
- Toggle layers → clusters toggle with campus points
- Navigate to Data tab → works
- Navigate back to Map → state preserved

**Step 2: Push**

```bash
git push
```
