# Voter Turnout by Congressional District — Design

**Date:** 2026-03-05

## Goal

Add 2022 midterm and 2024 presidential voter turnout data to the Districts tab, showing both raw total votes and turnout rate for each congressional district.

## Data Sources

### MIT Election Lab — U.S. House Returns 1976–2024
- **Provider:** MIT Election Data + Science Lab (MEDSL)
- **URL:** https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2
- **Format:** CSV with columns: `year`, `state_po`, `district`, `totalvotes`, `candidatevotes`, `stage`, `special`, `party`, `candidate`, etc.
- **Filter criteria:** `stage == "gen"`, `special == FALSE`, years 2022 and 2024
- **Note:** `totalvotes` repeats per candidate row within a district-year; deduplicate by taking one value per (year, state_po, district)

### ACS 2023 5-Year — Citizen Voting-Age Population (CVAP)
- **Variable:** B29001_001E (total citizen voting-age population)
- **Provider:** U.S. Census Bureau
- **Geography:** Congressional District (118th Congress)
- **Purpose:** Denominator for turnout rate calculation

## New Fields

Added to `districts-meta.json` per district:

| Field | Type | Description |
|-------|------|-------------|
| `total_votes_2022` | int | Total votes cast in 2022 House general election |
| `total_votes_2024` | int | Total votes cast in 2024 House general election |
| `turnout_rate_2022` | float | total_votes_2022 / CVAP × 100 |
| `turnout_rate_2024` | float | total_votes_2024 / CVAP × 100 |

## District Code Mapping

MEDSL uses `state_po` (e.g., "CA") + `district` (e.g., 12, or 0 for at-large). Map to our format:
- `district == 0` → `{state}-AL`
- Otherwise → `{state}-{district}`

## New Script: `code/pull_district_turnout.py`

Follows the established pattern from `pull_district_acs.py`:

1. Download MEDSL House returns CSV (cache locally in `data/`)
2. Filter to 2022 + 2024 general elections, non-special
3. Deduplicate totalvotes per (year, state_po, district)
4. Pull CVAP (B29001_001E) from Census ACS API for all CDs
5. Map district codes to our `{STATE}-{NUM}` format
6. Compute turnout rates: total_votes / cvap × 100
7. Validate: check for nulls, out-of-range values, district match counts
8. Merge 4 new fields into `districts-meta.json`
9. Register 2 new source entries in `sources.json`

## App Changes

### `DistrictsTable.jsx`
- 4 new column definitions:
  - `total_votes_2022` — "Votes 2022", numeric, formatted with commas
  - `total_votes_2024` — "Votes 2024", numeric, formatted with commas
  - `turnout_rate_2022` — "Turnout 2022", numeric, formatted as `XX.X%`
  - `turnout_rate_2024` — "Turnout 2024", numeric, formatted as `XX.X%`
- All four columns: sortable, filterable (numeric range), with SourceFootnote tooltips
- Default hidden or visible — user preference (visible by default since this is a requested feature)

### `sources.json`
Two new source entries:
- `medsl_house_2022` — MEDSL House returns, 2022
- `medsl_house_2024` — MEDSL House returns, 2024

Four new fieldMap entries:
- `total_votes_2022` → `medsl_house_2022`
- `total_votes_2024` → `medsl_house_2024`
- `turnout_rate_2022` → `medsl_house_2022` (derived with ACS CVAP denominator)
- `turnout_rate_2024` → `medsl_house_2024` (derived with ACS CVAP denominator)

### CSV Export
Add all 4 new columns to the Districts CSV export with appropriate headers and notes.

## Validation Checks

- Every CD118 district should have a 2022 match (2024 may have a few missing if data is still being finalized)
- Turnout rates should fall between 10–90% (flag outliers)
- Total votes should be > 0 for all matched districts
- Log min/median/max for each field
