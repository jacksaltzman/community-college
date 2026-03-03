# Design: Community College Congressional District Intersection Pipeline

**Date:** 2026-03-02
**Status:** Approved

## Objective

Build a dataset covering every U.S. community college that answers: how many congressional districts does each campus's commute-shed circle intersect, and which specific districts are they?

## Architecture

Single Python script (`code/pipeline.py`) that runs end-to-end. No modular step files — this is a one-shot batch analysis.

## File Layout

```
Students Per District/
├── Students Per District Prompt    # spec
├── Environment.txt                 # Census API key
├── code/
│   ├── pipeline.py                 # single end-to-end script
│   └── requirements.txt            # pinned dependencies
├── data/                           # downloaded/intermediate data
│   ├── HD2023.csv
│   ├── EFFY2023.csv
│   ├── cd118/                      # congressional district shapefiles
│   └── tracts/                     # Census tract shapefiles
├── output/
│   └── cc_district_intersections.xlsx
└── docs/plans/
    └── this file
```

## Pipeline Steps

### Step 1: Download Data
- IPEDS HD2023.zip and EFFY2023.zip via HTTP → extract CSVs to `data/`
- CD118 shapefile (`cb_2023_us_cd118_500k.zip`) → `data/cd118/`
- Census tract shapefiles (TIGER/Line with ACS population) → `data/tracts/`

### Step 2: Build Campus List
- Load HD2023, filter to SECTOR in (1=public 2-year, 3=private nonprofit 2-year)
- Join EFFY2023 for enrollment
- Extract lat/lon, city, state, locale code, unitid
- ~1,000-1,100 main campuses expected

### Step 3: Classify Campuses by Tract Density
- Spatial join campus points against Census tract geometries
- Compute density = population / (ALAND → sq miles)
- Apply 4-tier classification: Compact (≥15k), Mid-Size (3k-15k), Large Metro (1k-3k), Sprawl (<1k)
- Fallback to IPEDS locale code if tract density unavailable

### Step 4: Build Commute-Shed Circles
- Project to EPSG:5070 (CONUS), EPSG:3338 (AK), EPSG:102007 (HI)
- Buffer each point by assigned radius (miles → meters)
- Produces ~1,000 circle polygons

### Step 5: Intersect with Congressional Districts
- Load CD118 shapefile, project to matching CRS
- R-tree spatial index pre-filters candidate districts per campus
- Compute fractional overlap = intersection area / district area
- Filter ≥ 0.01 threshold
- Flag primary district (highest overlap per campus)

### Step 6: Validate
- 5 checks: zero districts, high count (>25), overlap sum deviation (>5%), duplicate IDs, missing density
- Collect flagged rows into validation DataFrame

### Step 7: Write Excel
- 3 sheets (Detail, Summary, Validation) → `output/cc_district_intersections.xlsx`
- Using pandas ExcelWriter with openpyxl engine

## Key Technical Decisions

- **Tract density via shapefiles, not API calls:** Download tract shapefiles with ACS data rather than ~1,000 individual Census API calls. Faster and avoids rate limits.
- **Three projection zones:** CONUS, Alaska, Hawaii processed separately then concatenated.
- **Territories:** Included if in IPEDS, flagged in validation sheet.
- **Census API key:** Read from `Environment.txt` in project root.
