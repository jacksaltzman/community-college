# CC District Intersection Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python script that maps every U.S. community college's commute-shed onto congressional district boundaries and produces an Excel workbook with intersection data.

**Architecture:** Single script (`pipeline.py`) with sequential functions: download → build campus list → classify by density → construct circles → intersect districts → validate → write Excel. All data flows through pandas/geopandas DataFrames in memory.

**Tech Stack:** Python 3.11, geopandas, shapely, pyproj, requests, openpyxl, pandas (all pre-installed)

---

### Task 1: Create requirements.txt and scaffold pipeline.py

**Files:**
- Create: `code/requirements.txt`
- Create: `code/pipeline.py`

**Step 1: Write requirements.txt**

```
geopandas>=0.14
shapely>=2.0
pyproj>=3.6
requests>=2.31
openpyxl>=3.0
pandas>=2.0
```

**Step 2: Scaffold pipeline.py with imports, constants, and main()**

Write the full script skeleton with:
- All imports (geopandas, shapely, pyproj, requests, pandas, zipfile, io, os, pathlib, logging)
- Path constants: `BASE_DIR`, `DATA_DIR`, `OUTPUT_DIR`, `ENV_FILE`
- Census API key loaded from `Environment.txt`
- URL constants for IPEDS HD2023, EFFY2023, CD118 shapefile
- Classification thresholds as a dict
- Projection CRS constants (EPSG:5070, EPSG:3338, EPSG:102007 for HI)
- Empty function stubs for each pipeline step
- `main()` that calls each step in order with logging
- `if __name__ == "__main__"` entry point

**Step 3: Run to verify it imports cleanly**

Run: `cd "Students Per District" && python3 code/pipeline.py`
Expected: Runs without error, logs start/end messages, produces no output yet

---

### Task 2: Implement data download functions

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Implement `download_ipeds_data()`**

- Download `HD2023.zip` from `https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip`
- Extract CSV to `data/HD2023.csv` (the CSV inside is named `hd2023.csv` — handle case)
- Download `EFFY2023.zip` from same base URL
- Extract to `data/EFFY2023.csv`
- Skip download if files already exist (cache for re-runs)
- Log file sizes and row counts after extraction

**Step 2: Implement `download_cd_shapefile()`**

- Download `cb_2023_us_cd118_500k.zip` from `https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_cd118_500k.zip`
- Extract all files to `data/cd118/`
- Skip if `.shp` file already exists
- Log number of districts loaded

**Step 3: Implement `download_tract_shapefiles(state_fips_list)`**

- For each state FIPS code, download `tl_2022_{fips}_tract.zip` from `https://www2.census.gov/geo/tiger/TIGER2022/TRACT/`
- Extract to `data/tracts/`
- Skip states already downloaded
- Log progress (e.g., "Downloaded tracts for 41/56 states")

**Step 4: Run download functions to verify**

Run: `python3 code/pipeline.py`
Expected: Downloads complete, files exist in `data/`, logs show row counts (~7,000+ rows in HD2023, ~435 districts in CD118)

---

### Task 3: Implement campus list builder

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Implement `build_campus_list()`**

- Load `data/HD2023.csv` (IPEDS uses pipe or comma delimiters — detect automatically)
- Key columns: `UNITID`, `INSTNM`, `CITY`, `STABBR`, `LATITUDE`, `LONGITUD`, `LOCALE`, `SECTOR`
- Filter: `SECTOR` in [1, 3] (public 2-year = 1, private nonprofit 2-year = 3)
- Drop rows where LATITUDE or LONGITUD is null/zero
- Load `data/EFFY2023.csv`, filter to `EFFYLEV == 1` (all students) and `LSTUDY == 999` (total), take `EFYTOTLT` (total enrollment)
- Left-join enrollment on UNITID
- Return a GeoDataFrame with Point geometry from lat/lon, CRS=EPSG:4326
- Log: campus count, states represented, enrollment range

**Step 2: Run and verify**

Run: `python3 code/pipeline.py`
Expected: ~900-1,100 campuses loaded, all 50 states + DC represented, no null geometries

---

### Task 4: Implement campus classification by tract density

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Implement `fetch_tract_populations(state_fips_list)`**

- For each state FIPS, call Census API: `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E&for=tract:*&in=state:{fips}&key={key}`
- Parse JSON response into DataFrame with columns: state, county, tract, population
- Build composite GEOID: `{state}{county}{tract}` (string, zero-padded)
- Concatenate all states into one DataFrame
- Log: total tracts fetched

**Step 2: Implement `classify_campuses(campuses_gdf)`**

- Load tract shapefiles from `data/tracts/` into a single GeoDataFrame (concat per-state files)
- Join tract population data on GEOID
- Compute density: `population / (ALAND / 2_589_988.11)` (sq meters to sq miles)
- Spatial join campuses to tracts (point-in-polygon)
- Apply classification thresholds:
  - ≥15,000 → Compact, radius 10
  - 3,000–14,999 → Mid-Size, radius 13
  - 1,000–2,999 → Large Metro, radius 17
  - <1,000 → Sprawl/Fragmented, radius 22
- Fallback for missing density: use IPEDS LOCALE code mapping
- Return campuses GeoDataFrame with new columns: `census_tract_density`, `city_type`, `radius_miles`
- Log: count per city type

**Step 3: Run and verify**

Run: `python3 code/pipeline.py`
Expected: All campuses classified, distribution roughly — Compact: 5-10%, Mid-Size: 20-30%, Large Metro: 25-35%, Sprawl: 30-40%. No unclassified campuses.

---

### Task 5: Implement circle construction and district intersection

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Implement `build_circles(campuses_gdf)`**

- Split campuses into 3 groups by state: CONUS (not AK/HI), AK, HI
- For each group, project to appropriate CRS (5070, 3338, 102007)
- Buffer each point by `radius_miles * 1609.344` (miles to meters)
- Reproject all circles back to EPSG:4326 for storage, but keep projected versions for area calcs
- Return GeoDataFrame with circle geometries (projected CRS) and a reference back to campus data

**Step 2: Implement `intersect_districts(circles_gdf, districts_gdf)`**

- Load CD118 shapefile, project to same CRS as circles (handle CONUS/AK/HI separately)
- Use `geopandas.sjoin()` with R-tree index to find candidate district-circle pairs
- For each candidate pair, compute exact intersection geometry
- Calculate: `area_in_circle_sqmi = intersection.area / 2_589_988.11`
- Calculate: `district_total_area_sqmi = district.area / 2_589_988.11`
- Calculate: `fractional_overlap = area_in_circle_sqmi / district_total_area_sqmi` rounded to 4 decimals
- Filter: keep only rows where `fractional_overlap >= 0.01`
- Format `cd_code` as `{STATE}-{DISTRICT_NUM}` (e.g., OR-3, CA-11); use 0 for at-large
- Flag `is_primary_district` = TRUE for the highest overlap per campus
- Concatenate CONUS + AK + HI results
- Return detail DataFrame

**Step 3: Run and verify**

Run: `python3 code/pipeline.py`
Expected: Detail DataFrame has several thousand rows. Every campus has ≥1 district. Spot-check a known campus (e.g., Portland Community College should be in OR-3 area).

---

### Task 6: Implement summary, validation, and Excel export

**Files:**
- Modify: `code/pipeline.py`

**Step 1: Implement `build_summary(detail_df)`**

- Group detail_df by campus (ipeds_unitid)
- Compute: `districts_intersected` = count of rows per campus
- `primary_cd` = cd_code where is_primary_district == TRUE
- `primary_cd_overlap` = fractional_overlap of primary district
- `all_cds` = pipe-delimited cd_codes ordered by fractional_overlap descending
- Carry forward all campus identifier columns
- Return summary DataFrame

**Step 2: Implement `run_validation(detail_df, campuses_gdf)`**

- Check 1 — zero_districts: campuses in campuses_gdf not present in detail_df
- Check 2 — high_count: campuses with >25 districts in detail_df
- Check 3 — overlap_sum_deviation: for each campus, sum(area_in_circle_sqmi) vs. π * (radius_miles * 1609.344)² / 2_589_988.11 — flag if >5% deviation
- Check 4 — duplicate_id: duplicate UNITID in campuses_gdf
- Check 5 — missing_density: campuses where census_tract_density is null
- Return validation DataFrame with columns: ipeds_unitid, institution_name, check_type, detail

**Step 3: Implement `write_excel(detail_df, summary_df, validation_df)`**

- Use `pd.ExcelWriter` with openpyxl engine
- Write detail_df to "Detail" sheet
- Write summary_df to "Summary" sheet
- Write validation_df to "Validation" sheet
- Save to `output/cc_district_intersections.xlsx`
- Log: row counts per sheet, file size

**Step 4: Run full pipeline end-to-end**

Run: `python3 code/pipeline.py`
Expected: Excel file created in `output/`. Open and verify 3 sheets with correct columns. Summary sheet has ~1,000 rows. Detail sheet has several thousand rows.

---

### Task 7: End-to-end verification and cleanup

**Files:**
- Modify: `code/pipeline.py` (if fixes needed)

**Step 1: Verify output integrity**

- Load the Excel file back in Python
- Check: every campus in Summary appears in Detail
- Check: districts_intersected in Summary matches actual row count in Detail
- Check: no campus has 0 districts
- Check: fractional_overlap values are between 0 and 1
- Check: is_primary_district has exactly one TRUE per campus

**Step 2: Spot-check known campuses**

Verify a few by hand:
- A campus in a dense urban area (e.g., NYC) should have Compact classification, 10mi radius, and multiple districts
- A rural campus should have Sprawl classification, 22mi radius, and likely 1-2 districts
- An at-large state campus (e.g., Wyoming, Vermont) should show district number 0

**Step 3: Log final statistics**

Print summary stats: total campuses, mean/median districts per campus, city type distribution, states covered, total detail rows
