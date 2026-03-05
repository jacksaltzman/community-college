# Design: District ACS Fields + Source Registry

**Date:** 2026-03-05
**Status:** Approved

## Objective

Add 4 Census ACS demographic fields to the Districts table and build a centralized source registry so every data field in the app is traceable to its origin.

## Two Pieces

### 1. Source Registry System

A single JSON file (`app/public/data/sources.json`) acts as the canonical registry. Every data field in the app traces back to an entry here.

**Structure:**

```json
{
  "sources": {
    "ipeds_hd2023": {
      "name": "IPEDS Institutional Characteristics (HD2023)",
      "provider": "NCES / U.S. Department of Education",
      "url": "https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip",
      "vintage": "2022-23",
      "retrieved": "2026-03-02",
      "description": "Campus name, location, sector, locale code, highest level of offering"
    },
    "acs5_2023_b19013": {
      "name": "Median Household Income",
      "provider": "U.S. Census Bureau, ACS 5-Year Estimates",
      "url": "https://api.census.gov/data/2023/acs/acs5",
      "vintage": "2023 (2019-2023)",
      "retrieved": "2026-03-05",
      "variable": "B19013_001E",
      "geography": "Congressional District (118th Congress)",
      "description": "Median household income in the past 12 months (inflation-adjusted)"
    }
  },
  "fieldMap": {
    "enrollment": "ipeds_effy2023",
    "cook_pvi": "cook_pvi_2024",
    "median_income": "acs5_2023_b19013",
    "poverty_rate": "acs5_2023_b17001",
    "pct_associates_plus": "acs5_2023_b15003",
    "pct_18_24": "acs5_2023_b01001"
  }
}
```

`fieldMap` connects every UI data field to its source key. Footnotes use this to look up source info.

**UI:**
- Column headers in all data tables get a small info icon. Clicking shows a popover with source name, provider, vintage, and link to source URL.
- Methodology page auto-generates a "Data Sources" table from the registry. Existing prose (assumptions, methodology steps) stays.
- Shared `SourceFootnote` component used across all three table components.

**Data quality contract:** Every field in the app must have a `fieldMap` entry. Build-time scripts update `sources.json` with retrieval dates.

### 2. Census ACS District Fields

4 new fields pulled from the 2023 ACS 5-Year Estimates by congressional district (CD118):

| Field | Display Name | ACS Table | Variable(s) | Computation |
|-------|-------------|-----------|-------------|-------------|
| `median_income` | Median Income | B19013 | `B19013_001E` | Direct value (dollars) |
| `poverty_rate` | Poverty Rate | B17001 | `B17001_002E / B17001_001E` | Computed ratio (below poverty / total) x 100 |
| `pct_associates_plus` | % Associate's+ | B15003 | Sum of bins 021E-025E / `B15003_001E` | Sum(associate's through doctorate) / total 25+ pop x 100 |
| `pct_18_24` | % Age 18-24 | B01001 | `B01001_007E-010E` + `B01001_031E-034E` / `B01001_001E` | Sum(male + female 18-24 bins) / total pop x 100 |

Note: Poverty and education use detailed B-tables with computed ratios rather than subject tables (S1701, S1501) because B-tables are more reliably available at CD geography via the Census API.

**Python script:** `code/pull_district_acs.py`
1. Reads Census API key from `Environment.txt`
2. For each field, calls Census API with `for=congressional district:*&in=state:*`
3. Validates: checks for nulls, out-of-range values, expected ~441 districts
4. Merges into `districts-meta.json`
5. Updates `sources.json` with retrieval dates
6. Logs validation summary (min/median/max per field, missing values, districts matched)

**Data quality checks:**
- Every CD118 district in districts-meta.json should get a value (flag missing)
- Poverty rate: 0-100
- Income: positive
- % 18-24: 0-100
- % Associate's+: 0-100
- Log distributions for plausibility

**Districts table UI:**
- 4 new columns after Party: Median Income (`$XX,XXX`), Poverty Rate (`XX.X%`), % Associate's+ (`XX.X%`), % Age 18-24 (`XX.X%`)
- All visible by default, sortable, filterable (numeric range filters)
- Source footnote icons on all column headers (new and existing)
- CSV export updated to include new fields

## Data Flow

```
Census API  ->  pull_district_acs.py  ->  districts-meta.json  (adds 4 fields per district)
                                      ->  sources.json          (adds/updates source entries)

App load    ->  useMapData.js fetches districts-meta.json + sources.json
            ->  DistrictsTable.jsx reads new fields from districtLookup
            ->  Column headers reference sources.json for footnotes
```

## File Changes

### Created
| File | Purpose |
|------|---------|
| `code/pull_district_acs.py` | Pull Census ACS data, validate, merge into app data |
| `app/public/data/sources.json` | Canonical source registry |
| `app/src/components/data/SourceFootnote.jsx` | Shared info-icon + popover component |

### Modified
| File | Change |
|------|--------|
| `app/public/data/districts-meta.json` | Add 4 ACS fields to each district entry |
| `app/src/components/data/DistrictsTable.jsx` | Add 4 columns, source footnotes, update CSV export |
| `app/src/hooks/useMapData.js` | Load sources.json alongside existing data |
| `app/src/components/methodology/Methodology.jsx` | DistrictMethodology reads from sources registry |

### Not Modified
- `code/pipeline.py` -- core campus intersection pipeline unchanged
- `code/generate_map_data.py` -- districts-meta.json updated by new script
- `map/index.html` -- standalone Mapbox map not touched

## Out of Scope
- Non-Census fields (election margin, committee assignments, voting records, EITC)
- Map visualization changes
- Target tab filter changes
- Retroactive campus classification changes
