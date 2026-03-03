# Design: District-Level Young Professional Density Analysis

**Date:** 2026-03-03
**Status:** Approved

## Goal

Identify which congressional districts have the highest density of young professionals matching Accountable's target persona, producing data joinable with the existing CC district analysis for overlay comparison.

## Persona Definition

| Filter | Definition | ACS Approach |
|--------|-----------|--------------|
| Age | 25-34 | ACS standard brackets 25-29, 30-34 (B01001) |
| Education | Bachelor's degree or higher | Bachelor's, master's, professional, doctorate (B15001) |
| Employment | Employed, civilian labor force | Civilian employed (B23001) |
| Income | $40K-$200K | Sum relevant ACS income brackets (B19037) |
| Enrollment | Not currently enrolled | Subtract enrolled from age cohort (B14001/B14004) |

**Age bracket note:** ACS provides 25-29 and 30-34 as standard brackets. The spec's 22-35 range doesn't align with ACS boundaries — the 20-24 bracket bleeds into college-age and 35-39 bleeds into older cohorts. Using 25-34 is the cleanest, most defensible approximation.

## Data Source

- American Community Survey (ACS) 5-year estimates, 2022 (most recent available)
- Congressional district level: CD118 (118th Congress, same as CC analysis)
- Census Bureau API (api.census.gov)
- API key from existing Environment.txt in CC project

## Estimation Method

Stepwise proportional estimation, applied per-district:

```
yp_estimate = pop_25_34
  x pct_bachelors_plus
  x pct_employed_civilian
  x pct_income_40k_200k
  x pct_not_enrolled
```

Each proportion is calculated from district-specific ACS data. This assumes approximate independence between filters (standard practice in market sizing). The independence assumption may slightly overcount since education and employment are positively correlated — documented as a caveat.

## ACS Tables

| Table | Content | Purpose |
|-------|---------|---------|
| B01001 | Sex by Age | Total 25-34 population per district |
| B15001 | Sex by Age by Educational Attainment | % with bachelor's+ among 25-34 |
| B23001 | Sex by Age by Employment Status | % employed civilian among 25-34 |
| B19037 | Age of Householder by Household Income | % in $40K-$200K range among 25-34 householders |
| B14001 or B14004 | School Enrollment by Age | % not enrolled among 25-34 |

## Output Structure

### Flat table (CSV + XLSX) — one row per district

| Column | Type | Example |
|--------|------|---------|
| district_code | str | TX-37, OH-3, AK-AL |
| state | str | TX |
| district_number | int | 37 (0 for at-large) |
| total_population | int | 770000 |
| pop_25_34 | int | 112000 |
| yp_estimate | int | 28500 |
| yp_density_pct | float | 3.70 |
| yp_share_of_cohort_pct | float | 25.45 |
| swing_state | bool | False |

District code format matches CC analysis for joining: `{State}-{Number}` or `{State}-AL`.

### Rankings & Summary (yp_analysis_summary.md)

- Top 50 districts by YP density (%)
- Top 50 districts by absolute YP count
- State-level rollups (total YP, average density)
- Swing state breakout (AZ, GA, MI, NC, NV, PA, WI)
- National summary stats: total YP estimate, median per district, distribution percentiles

### Interactive Map

- Mapbox GL JS choropleth (same stack as CC map)
- District polygons colored by YP density, sequential color scale
- Hover/click: district name, YP count, density, rank
- Reuse CD118 shapefiles from CC analysis
- Accountable logo branding

## File Structure

```
Young Professional/
  code/
    pipeline.py              # Main data pipeline
    generate_map_data.py     # GeoJSON generation for map
    requirements.txt         # Python dependencies
  data/                      # Downloaded/intermediate ACS data
  output/
    yp_density_by_district.csv
    yp_density_by_district.xlsx
    yp_analysis_summary.md
  map/
    index.html               # Interactive choropleth map
    data/
      districts.geojson      # District geometries with YP values
  docs/plans/
    2026-03-03-yp-density-design.md  # This document
```

## Pipeline Steps

1. **Load config** — API key, FIPS-to-state mapping
2. **Pull ACS tables** — B01001, B15001, B23001, B19037, B14001/B14004 for all CDs
3. **Parse & compute proportions** — per-district rates for each filter
4. **Calculate YP estimate** — multiply base population by all filter proportions
5. **Build rankings & summary** — top 50s, state rollups, swing state flags
6. **Export CSV/XLSX** — flat table with all columns
7. **Generate GeoJSON** — join YP density to CD118 geometries
8. **Write summary markdown** — methodology, findings, caveats

## Key Dependencies

- pandas, requests, openpyxl (data pipeline)
- geopandas, shapely (GeoJSON generation)
- Mapbox GL JS v3 (interactive map)

## Caveats to Document

1. Age range approximation: 25-34 vs spec's 22-35
2. Independence assumption between filters (may slightly overcount)
3. B19037 uses householder age, not individual age — may underrepresent YPs in shared households
4. ACS margin of error at CD level can be significant for small populations
5. Income brackets may not align exactly to $40K and $200K boundaries — will use nearest available brackets
