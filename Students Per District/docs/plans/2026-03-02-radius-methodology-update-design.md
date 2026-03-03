# Design: Update Commute Radius Methodology

## Summary

Replace the density-based radius classification with NCES locale-code-based radii derived from NPSAS:20 PowerStats data. The old system used Census tract population density thresholds mapped from Hillman (2023) medians. The new system uses 75th percentile student-to-campus distance by NCES locale code, computed directly from NPSAS:20.

## Data Source

Source: NPSAS:20 via NCES PowerStats (retrieval code: swopse).
Variable: DISTANCE (linear crow-flies miles, student home to campus).
Survey-weighted, ~5.5M weighted CC students across ~1,600 institutions.

## New Classification Table

| Label | Radius | Locale Codes | Description |
|-------|--------|-------------|-------------|
| Large City | 15 mi | 11, 21 | Large cities and large suburbs |
| Midsize City | 19 mi | 12 | Midsize cities (100K-250K pop) |
| Suburban | 22 mi | 22, 23 | Midsize and small suburbs |
| Small City | 25 mi | 13 | Small cities (<100K pop). Conservative value (raw P75=35 unstable) |
| Rural | 27-37 mi | 41, 42 | Rural fringe (27 mi) and rural distant (37 mi) |
| Town / Remote | 39-58 mi | 31, 32, 33, 43 | Town fringe (39), town distant (44), rural remote (55), town remote (58) |

Fallback: locale code -3 or null -> 22 mi, "Suburban" label.

Within Rural and Town/Remote, each locale code retains its specific P75 radius. The grouping is for display labels and legend colors only.

### Per-Locale Radius Lookup

| Locale | Radius |
|--------|--------|
| 11 | 15 |
| 12 | 19 |
| 13 | 25 |
| 21 | 15 |
| 22 | 22 |
| 23 | 22 |
| 31 | 39 |
| 32 | 44 |
| 33 | 58 |
| 41 | 27 |
| 42 | 37 |
| 43 | 55 |

## What Changes

### Pipeline (pipeline.py)

- **Delete:** `download_tract_shapefiles()`, `fetch_tract_populations()`, tract spatial join, density computation, `CITY_TYPE_RULES` constant, Census API key loading
- **Rewrite:** `classify_campuses()` becomes a ~20-line locale-code dict lookup
- **Column changes:** "Tract Density (pop/sq mi)" replaced with "Locale Code" in Excel output
- **Validation:** `missing_density` check becomes `missing_locale` check

### Map (index.html)

- Legend: 4 items -> 6 items with new names, descriptions, colors
- GeoJSON: `campus_type` carries new labels, `tract_density` becomes `locale_code`
- Popup: "TRACT DENSITY" row becomes "LOCALE CODE"

### Methodology.md

- Rewrite Step 3 to describe locale-code approach
- Update classification table, data source citation, assumptions

### generate_map_data.py

- Update property mappings for new column names

### No changes needed

- `data_quality_cleanup.py` (operates on IPEDS IDs)
- `build_circles()`, `intersect_districts()`, `build_summary()`, `write_excel()` (read city_type/radius_miles which still get set)
- Steps 3-4 from methodology PDF (concentration scores, penetration) are out of scope

## Re-run Sequence

1. Run pipeline.py (new classification)
2. Run data_quality_cleanup.py (remove 37 institutions)
3. Run generate_map_data.py (regenerate GeoJSON)
4. Verify map in preview
