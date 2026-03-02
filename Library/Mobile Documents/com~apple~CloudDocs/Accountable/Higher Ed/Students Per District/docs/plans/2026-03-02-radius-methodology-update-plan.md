# Radius Methodology Update — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace density-based radius classification with NPSAS:20 locale-code-based P75 radii.

**Architecture:** Delete tract density infrastructure (shapefiles, Census API, spatial join). Replace with a dict lookup on the LOCALE column already in HD2023. Re-run pipeline, cleanup, and map data. Update map legend from 4 to 6 categories.

**Tech Stack:** Python (pandas, geopandas, openpyxl), HTML/JS (Mapbox GL JS)

---

### Task 1: Update pipeline.py — Replace classification constants and delete dead code

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Replace CITY_TYPE_RULES with new locale-based lookup (lines 61-68)**

Replace:
```python
CITY_TYPE_RULES = [
    (15_000, "Compact",            10),
    ( 3_000, "Mid-Size",           13),
    ( 1_000, "Large Metro",        17),
    (     0, "Sprawl-Fragmented",  22),
]
```

With:
```python
# ── NPSAS:20 P75 radius by NCES locale code (retrieval code: swopse) ──
LOCALE_RADIUS = {
    11: 15,   # City Large
    12: 19,   # City Midsize
    13: 25,   # City Small (conservative; raw P75=35 unstable)
    21: 15,   # Suburb Large
    22: 22,   # Suburb Midsize
    23: 22,   # Suburb Small
    31: 39,   # Town Fringe
    32: 44,   # Town Distant
    33: 58,   # Town Remote
    41: 27,   # Rural Fringe
    42: 37,   # Rural Distant
    43: 55,   # Rural Remote
}

LOCALE_LABEL = {
    11: "Large City",
    12: "Midsize City",
    13: "Small City",
    21: "Large City",
    22: "Suburban",
    23: "Suburban",
    31: "Town / Remote",
    32: "Town / Remote",
    33: "Town / Remote",
    41: "Rural",
    42: "Rural",
    43: "Town / Remote",
}

FALLBACK_RADIUS = 22
FALLBACK_LABEL = "Suburban"
```

**Step 2: Delete Census API key loading (lines 38-48)**

Delete the `_load_api_key()` function and the `CENSUS_API_KEY = _load_api_key()` line.

**Step 3: Delete tract-related URL constants and FIPS lists**

Remove `CD118_SHAPEFILE_URL` stays (used by `download_cd_shapefile`). Remove the tract shapefile URL pattern (it's inline in `download_tract_shapefiles`). The `ALL_STATE_FIPS` list is only used by `download_tract_shapefiles` and `fetch_tract_populations` — keep it only if `download_cd_shapefile` needs it (it doesn't). Delete `ALL_STATE_FIPS`.

**Step 4: Delete three functions entirely**

Delete:
- `download_tract_shapefiles()` (~40 lines)
- `fetch_tract_populations()` (~55 lines)

These are no longer called.

**Step 5: Rewrite `classify_campuses()` (lines 360-481)**

Replace the entire function with:

```python
def classify_campuses(campuses: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Classify each campus by NCES locale code and assign P75 radius.

    Uses NPSAS:20 75th-percentile student-to-campus distance by locale.
    """
    def _assign(locale_code):
        try:
            lc = int(locale_code)
        except (TypeError, ValueError):
            return FALLBACK_LABEL, FALLBACK_RADIUS
        label = LOCALE_LABEL.get(lc, FALLBACK_LABEL)
        radius = LOCALE_RADIUS.get(lc, FALLBACK_RADIUS)
        return label, radius

    results = campuses["locale_code"].apply(_assign)
    campuses["city_type"] = [r[0] for r in results]
    campuses["radius_miles"] = [r[1] for r in results]

    log.info(f"Campus classification complete: {len(campuses):,} campuses")
    counts = campuses["city_type"].value_counts()
    for ct, n in counts.items():
        log.info(f"  {ct}: {n}")
    fallback_count = campuses["locale_code"].apply(
        lambda x: int(x) not in LOCALE_RADIUS if pd.notna(x) else True
    ).sum()
    if fallback_count:
        log.info(f"  Fallback classifications: {fallback_count}")

    return campuses
```

**Step 6: Update `main()` — remove tract download call**

In `main()`, delete the line:
```python
download_tract_shapefiles(ALL_STATE_FIPS)
```

**Step 7: Verify**

Run: `cd "Students Per District" && python3 -c "from code.pipeline import classify_campuses; print('import OK')"`

**Step 8: Commit**

```
git add code/pipeline.py
git commit -m "Replace density-based classification with NPSAS:20 locale-code radii"
```

---

### Task 2: Update pipeline.py — Fix Excel column names and validation

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Update `write_excel()` column mappings**

In `detail_rename`, change:
```python
"census_tract_density":   "Tract Density (pop/sq mi)",
```
to:
```python
"locale_code":            "Locale Code",
```

In `summary_rename`, same change:
```python
"census_tract_density":   "Tract Density (pop/sq mi)",
```
to:
```python
"locale_code":            "Locale Code",
```

**Step 2: Update `build_campus_list()` — keep locale_code, drop census_tract_density**

The `classify_campuses()` function no longer adds `census_tract_density`. The `locale_code` column is already carried through from `build_campus_list()`. No change needed in `build_campus_list()`.

But in the `id_cols` list in `build_summary()` (line 680-684), replace `"census_tract_density"` with `"locale_code"`:

```python
id_cols = [
    "ipeds_unitid", "institution_name", "campus_city", "campus_state",
    "campus_lat", "campus_lon", "total_enrollment",
    "locale_code", "city_type", "radius_miles",
]
```

And in `intersect_districts()`, the detail row dict (around line 606-623), replace `"census_tract_density"` with `"locale_code"`:

```python
all_detail_rows.append({
    ...
    "locale_code": row["locale_code"],
    ...
})
```

**Step 3: Update `run_validation()` — replace missing_density with missing_locale**

Replace check 5 (lines 812-821). Change from checking `census_tract_density` to checking `locale_code`:

```python
# ── Check 5: missing_locale ─────────────────────────────────
# Campuses where locale_code is null or -3
missing_mask = campuses["locale_code"].isna() | (campuses["locale_code"] == -3)
for _, row in campuses[missing_mask].iterrows():
    flags.append({
        "ipeds_unitid": row["ipeds_unitid"],
        "institution_name": row["institution_name"],
        "check_type": "missing_locale",
        "detail": f"locale_code is {row['locale_code']}; used fallback radius",
    })
```

**Step 4: Commit**

```
git add code/pipeline.py
git commit -m "Update Excel columns and validation for locale-based classification"
```

---

### Task 3: Run the full pipeline

**Files:**
- Output: `output/cc_district_intersections.xlsx`

**Step 1: Run pipeline**

```bash
cd "Students Per District" && python3 code/pipeline.py
```

Expected: completes without errors, skips tract downloads and Census API calls.

**Step 2: Verify output**

```python
python3 -c "
import pandas as pd
xls = pd.ExcelFile('output/cc_district_intersections.xlsx')
s = pd.read_excel(xls, 'Summary')
print(f'Summary: {len(s)} rows')
print(f'Columns: {list(s.columns)}')
print(f'Campus types: {s[\"Campus Type\"].value_counts().to_dict()}')
print(f'Radius values: {sorted(s[\"Commute Radius (mi)\"].unique())}')
"
```

Expected: ~1,256 rows, "Locale Code" column instead of "Tract Density", 6 campus type labels, radii = [15, 19, 22, 25, 27, 37, 39, 44, 55, 58].

**Step 3: Commit output**

```
git add output/cc_district_intersections.xlsx
git commit -m "Re-run pipeline with locale-based radii"
```

---

### Task 4: Run data quality cleanup

**Files:**
- Modify: `code/data_quality_cleanup.py` (minor — update validation text)
- Output: `output/cc_district_intersections.xlsx`

**Step 1: Update cleanup script validation text**

In `data_quality_cleanup.py`, the `missing_density` flag type reference needs updating. Change:

```python
mask = validation_clean["Flag Type"] == "missing_density"
validation_clean.loc[mask, "Details"] = (
    "Tract density=0; classified via IPEDS locale code fallback"
)
```

to:

```python
mask = validation_clean["Flag Type"] == "missing_locale"
validation_clean.loc[mask, "Details"] = (
    "Locale code missing or -3; used fallback radius of 22 mi"
)
```

**Step 2: Run cleanup**

```bash
cd "Students Per District" && python3 code/data_quality_cleanup.py
```

Expected: Summary 1,219 rows, Detail ~3,600 rows.

**Step 3: Commit**

```
git add code/data_quality_cleanup.py output/cc_district_intersections.xlsx
git commit -m "Run data quality cleanup with updated locale-based validation"
```

---

### Task 5: Update generate_map_data.py

**Files:**
- Modify: `code/generate_map_data.py`

**Step 1: Update SUMMARY_TO_GEOJSON mapping**

Change:
```python
"Tract Density (pop/sq mi)":  "tract_density",
```
to:
```python
"Locale Code":                "locale_code",
```

**Step 2: Run map data generation**

```bash
cd "Students Per District" && python3 code/generate_map_data.py
```

Expected: 1,219 campus features.

**Step 3: Commit**

```
git add code/generate_map_data.py map/data/campuses.geojson
git commit -m "Update map data generator for locale code column"
```

---

### Task 6: Update map HTML — colors, legend, popup

**Files:**
- Modify: `map/index.html`

**Step 1: Update campusTypeColors expression (line 532-539)**

Replace:
```javascript
const campusTypeColors = [
  'match', ['get', 'campus_type'],
  'Compact', '#FE4F40',
  'Mid-Size', '#4C6971',
  'Large Metro', '#D4F72A',
  'Sprawl-Fragmented', '#9CA3AF',
  '#9CA3AF'
];
```

With (using brand palette + extensions):
```javascript
const campusTypeColors = [
  'match', ['get', 'campus_type'],
  'Large City', '#FE4F40',
  'Midsize City', '#4C6971',
  'Suburban', '#D4F72A',
  'Small City', '#E8A838',
  'Rural', '#8B6F47',
  'Town / Remote', '#9CA3AF',
  '#9CA3AF'
];
```

**Step 2: Update legend HTML (the legend-items div)**

Replace the 4 legend items with 6:

```html
<div class="legend-items">
  <div class="legend-item">
    <span class="legend-dot" style="background:#FE4F40"></span>
    <div class="legend-text">
      <span class="legend-name">Large City</span>
      <span class="legend-desc">Large cities and suburbs. 15-mile radius.</span>
    </div>
  </div>
  <div class="legend-item">
    <span class="legend-dot" style="background:#4C6971"></span>
    <div class="legend-text">
      <span class="legend-name">Midsize City</span>
      <span class="legend-desc">Midsize cities (100K–250K). 19-mile radius.</span>
    </div>
  </div>
  <div class="legend-item">
    <span class="legend-dot" style="background:#D4F72A"></span>
    <div class="legend-text">
      <span class="legend-name">Suburban</span>
      <span class="legend-desc">Midsize and small suburbs. 22-mile radius.</span>
    </div>
  </div>
  <div class="legend-item">
    <span class="legend-dot" style="background:#E8A838"></span>
    <div class="legend-text">
      <span class="legend-name">Small City</span>
      <span class="legend-desc">Small cities (<100K). 25-mile radius.</span>
    </div>
  </div>
  <div class="legend-item">
    <span class="legend-dot" style="background:#8B6F47"></span>
    <div class="legend-text">
      <span class="legend-name">Rural</span>
      <span class="legend-desc">Rural fringe and distant. 27–37-mile radius.</span>
    </div>
  </div>
  <div class="legend-item">
    <span class="legend-dot" style="background:#9CA3AF"></span>
    <div class="legend-text">
      <span class="legend-name">Town / Remote</span>
      <span class="legend-desc">Towns and remote areas. 39–58-mile radius.</span>
    </div>
  </div>
</div>
```

**Step 3: Update popup — replace "TRACT DENSITY" with "LOCALE CODE"**

In both popup templates (campus click ~line 706, and search click ~line 827), find:
```html
<div class="popup-row"><span class="popup-label">CAMPUS TYPE</span>...
```

The TRACT DENSITY row was already removed in a previous iteration. If present, replace with LOCALE CODE. If not, no change needed.

Check: search for "tract_density" in the file and replace any references with "locale_code".

**Step 4: Commit**

```
git add map/index.html
git commit -m "Update map legend and colors for 6 locale-based campus types"
```

---

### Task 7: Update Methodology.md

**Files:**
- Modify: `Methodology.md`

**Step 1: Rewrite Step 3**

Replace the entire "Step 3: Classify Campus Density" section with the new locale-code methodology. Include:
- Data source citation (NPSAS:20 via PowerStats, retrieval code: swopse)
- The 12-locale radius table
- The 6 display groupings
- The fallback rule
- Why P75 not median

**Step 2: Update the column definitions**

In the Detail and Summary sheet tables:
- Replace "Tract Density (pop/sq mi)" with "Locale Code"
- Update "Campus Type" description to reference locale-based labels

**Step 3: Update Key Assumptions**

Replace assumption 2 (density determines radius) with the locale-code approach.

**Step 4: Commit**

```
git add Methodology.md
git commit -m "Update methodology doc for locale-based radius classification"
```

---

### Task 8: Verify map in preview

**Step 1:** Reload the map preview server and take a screenshot
**Step 2:** Verify: 6 legend items, 1,219 campuses, correct colors, popup shows new labels
**Step 3:** Test search, state filter, layer toggles still work
**Step 4:** Test mobile layout
