# District ACS Fields + Source Registry — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 Census ACS demographic fields to the Districts data table and build a centralized source registry with inline footnotes so every data field is traceable.

**Architecture:** A new Python script (`code/pull_district_acs.py`) pulls ACS data from the Census API, validates it, and merges it into the existing `districts-meta.json`. A new `sources.json` file acts as the canonical registry for all data sources. The React app loads `sources.json` and uses a shared `SourceFootnote` component to display source info on column headers. The Districts table gets 4 new columns.

**Tech Stack:** Python 3.11 (requests, json, pathlib), React 19, TanStack Table, Vite

---

### Task 1: Create the source registry JSON

**Files:**
- Create: `app/public/data/sources.json`

**Step 1: Write sources.json with all existing + new source entries**

Create the file with every data source currently used in the app, plus the 4 new ACS sources. Each entry has: name, provider, url, vintage, retrieved, description. The `fieldMap` section maps every UI field to its source key.

```json
{
  "sources": {
    "ipeds_hd2023": {
      "name": "Institutional Characteristics (HD2023)",
      "provider": "IPEDS / NCES, U.S. Department of Education",
      "url": "https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip",
      "vintage": "2022-23",
      "retrieved": "2026-03-02",
      "description": "Campus name, city, state, coordinates, sector, locale code, highest level of offering"
    },
    "ipeds_effy2023": {
      "name": "12-Month Enrollment (EFFY2023)",
      "provider": "IPEDS / NCES, U.S. Department of Education",
      "url": "https://nces.ed.gov/ipeds/datacenter/data/EFFY2023.zip",
      "vintage": "2022-23",
      "retrieved": "2026-03-02",
      "description": "Unduplicated 12-month headcount enrollment (EFFYLEV=1, LSTUDY=999)"
    },
    "census_cd118": {
      "name": "Congressional District Boundaries (CD118)",
      "provider": "U.S. Census Bureau",
      "url": "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_cd118_500k.zip",
      "vintage": "2023",
      "retrieved": "2026-03-02",
      "description": "118th Congress cartographic boundary shapefiles, coast-clipped, 1:500k resolution"
    },
    "npsas20": {
      "name": "Student-to-Campus Distance (NPSAS:20)",
      "provider": "NCES PowerStats",
      "url": "https://nces.ed.gov/datalab/powerstats/",
      "vintage": "2019-20",
      "retrieved": "2026-03-02",
      "description": "75th-percentile student-to-campus crow-flies distance by NCES locale code (retrieval code: swopse)"
    },
    "cook_pvi_2024": {
      "name": "Cook Partisan Voter Index",
      "provider": "The Cook Political Report",
      "url": "https://www.cookpolitical.com/cook-pvi",
      "vintage": "2024",
      "retrieved": "2026-03-02",
      "description": "Partisan lean of each congressional district based on the two most recent presidential elections"
    },
    "house_members_119": {
      "name": "U.S. House Representatives (119th Congress)",
      "provider": "Office of the Clerk, U.S. House of Representatives",
      "url": "https://clerk.house.gov/members",
      "vintage": "January 2025",
      "retrieved": "2026-03-02",
      "description": "Current representative name and party affiliation for each congressional district"
    },
    "acs5_2023_b19013": {
      "name": "Median Household Income (B19013)",
      "provider": "U.S. Census Bureau, American Community Survey 5-Year Estimates",
      "url": "https://api.census.gov/data/2023/acs/acs5",
      "vintage": "2023 (2019-2023)",
      "retrieved": null,
      "variable": "B19013_001E",
      "geography": "Congressional District (118th Congress)",
      "description": "Median household income in the past 12 months, inflation-adjusted to survey-year dollars"
    },
    "acs5_2023_b17001": {
      "name": "Poverty Status (B17001)",
      "provider": "U.S. Census Bureau, American Community Survey 5-Year Estimates",
      "url": "https://api.census.gov/data/2023/acs/acs5",
      "vintage": "2023 (2019-2023)",
      "retrieved": null,
      "variable": "B17001_001E (total), B17001_002E (below poverty)",
      "geography": "Congressional District (118th Congress)",
      "description": "Poverty rate computed as population below poverty level / total population for whom poverty status is determined"
    },
    "acs5_2023_b15003": {
      "name": "Educational Attainment (B15003)",
      "provider": "U.S. Census Bureau, American Community Survey 5-Year Estimates",
      "url": "https://api.census.gov/data/2023/acs/acs5",
      "vintage": "2023 (2019-2023)",
      "retrieved": null,
      "variable": "B15003_001E (total 25+), B15003_021E-025E (associate's through doctorate)",
      "geography": "Congressional District (118th Congress)",
      "description": "Percentage of population 25+ with an associate's degree or higher"
    },
    "acs5_2023_b01001": {
      "name": "Age Distribution (B01001)",
      "provider": "U.S. Census Bureau, American Community Survey 5-Year Estimates",
      "url": "https://api.census.gov/data/2023/acs/acs5",
      "vintage": "2023 (2019-2023)",
      "retrieved": null,
      "variable": "B01001_001E (total), B01001_007E-010E + B01001_031E-034E (male + female 18-24)",
      "geography": "Congressional District (118th Congress)",
      "description": "Percentage of total population aged 18-24"
    }
  },
  "fieldMap": {
    "institution_name": "ipeds_hd2023",
    "campus_city": "ipeds_hd2023",
    "campus_state": "ipeds_hd2023",
    "campus_lat": "ipeds_hd2023",
    "campus_lon": "ipeds_hd2023",
    "locale_code": "ipeds_hd2023",
    "campus_type": "npsas20",
    "radius_miles": "npsas20",
    "enrollment": "ipeds_effy2023",
    "districts_reached": "census_cd118",
    "primary_district": "census_cd118",
    "primary_district_coverage": "census_cd118",
    "all_districts": "census_cd118",
    "cook_pvi": "cook_pvi_2024",
    "member": "house_members_119",
    "party": "house_members_119",
    "median_income": "acs5_2023_b19013",
    "poverty_rate": "acs5_2023_b17001",
    "pct_associates_plus": "acs5_2023_b15003",
    "pct_18_24": "acs5_2023_b01001"
  }
}
```

**Step 2: Verify the file is valid JSON**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District" && python3 -c "import json; json.load(open('app/public/data/sources.json')); print('Valid JSON')"`
Expected: `Valid JSON`

---

### Task 2: Create the Python script to pull Census ACS data

**Files:**
- Create: `code/pull_district_acs.py`

**Step 1: Write the full script**

The script should:
1. Read Census API key from `Environment.txt`
2. Define the 4 ACS field configurations (table, variables, computation logic)
3. For each field, call the Census API at `https://api.census.gov/data/2023/acs/acs5?get={variables}&for=congressional%20district:*&in=state:*&key={key}`
4. Parse JSON responses into a dict keyed by `{state_fips}-{cd_number}` (matching the cd_code format in districts-meta.json, but using FIPS→state abbreviation mapping)
5. Validate each field (null checks, range checks, distribution logging)
6. Load existing `districts-meta.json`, merge the 4 new fields into each district entry
7. Write updated `districts-meta.json`
8. Load `sources.json`, update the `retrieved` date for each ACS source
9. Write updated `sources.json`
10. Print a validation summary

```python
"""
Pull Census ACS 5-Year district-level fields and merge into districts-meta.json.

Usage:
    python pull_district_acs.py

Reads:  ../Environment.txt              (Census API key)
        ../app/public/data/districts-meta.json
        ../app/public/data/sources.json
Writes: ../app/public/data/districts-meta.json  (updated with ACS fields)
        ../app/public/data/sources.json          (updated retrieval dates)
"""

import json
import logging
import statistics
from datetime import date
from pathlib import Path

import requests

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / "Environment.txt"
DISTRICTS_META = BASE_DIR / "app" / "public" / "data" / "districts-meta.json"
SOURCES_JSON = BASE_DIR / "app" / "public" / "data" / "sources.json"

# ── Census API ───────────────────────────────────────────────────
ACS_BASE = "https://api.census.gov/data/2023/acs/acs5"

# ── FIPS → state abbreviation ────────────────────────────────────
FIPS_TO_STATE = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR",
    "78": "VI",
}


def load_api_key() -> str:
    """Read Census API key from Environment.txt."""
    text = ENV_FILE.read_text().strip()
    # Handle KEY=VALUE format
    if "=" in text:
        return text.split("=", 1)[1].strip()
    return text


def census_get(variables: list[str], api_key: str) -> list[list[str]]:
    """Call Census ACS API for congressional districts in all states.

    Returns the raw JSON rows (list of lists), including the header row.
    """
    var_str = ",".join(variables)
    url = (
        f"{ACS_BASE}?get={var_str}"
        f"&for=congressional%20district:*&in=state:*"
        f"&key={api_key}"
    )
    log.info(f"  GET {ACS_BASE}?get={var_str}&for=congressional district:*&in=state:*")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.json()


def rows_to_district_dict(
    rows: list[list[str]], header: list[str]
) -> dict[str, dict[str, str]]:
    """Convert Census API rows into a dict keyed by cd_code (e.g. 'CA-12').

    Returns {cd_code: {variable_name: value, ...}}
    """
    state_idx = header.index("state")
    cd_idx = header.index("congressional district")
    var_names = [h for h in header if h not in ("state", "congressional district")]

    result = {}
    for row in rows:
        state_fips = row[state_idx]
        cd_num_str = row[cd_idx]
        state_abbrev = FIPS_TO_STATE.get(state_fips)
        if not state_abbrev:
            continue

        cd_num = int(cd_num_str)
        if cd_num == 0 or cd_num == 98:
            cd_code = f"{state_abbrev}-AL"
        else:
            cd_code = f"{state_abbrev}-{cd_num}"

        values = {}
        for var_name in var_names:
            idx = header.index(var_name)
            values[var_name] = row[idx]

        result[cd_code] = values

    return result


def safe_float(val) -> float | None:
    """Convert a Census API value to float, returning None for missing/negative."""
    if val is None:
        return None
    try:
        f = float(val)
        # Census uses negative values as sentinel codes
        if f < 0:
            return None
        return f
    except (ValueError, TypeError):
        return None


def validate_field(values: dict[str, float | None], field_name: str,
                   min_val: float, max_val: float) -> None:
    """Log distribution stats and flag out-of-range values."""
    valid = [v for v in values.values() if v is not None]
    missing = sum(1 for v in values.values() if v is None)

    if not valid:
        log.error(f"  {field_name}: ALL values are null!")
        return

    log.info(
        f"  {field_name}: n={len(valid)}, missing={missing}, "
        f"min={min(valid):.1f}, median={statistics.median(valid):.1f}, "
        f"max={max(valid):.1f}"
    )

    out_of_range = {k: v for k, v in values.items()
                    if v is not None and (v < min_val or v > max_val)}
    if out_of_range:
        log.warning(
            f"  {field_name}: {len(out_of_range)} values out of "
            f"expected range [{min_val}, {max_val}]"
        )
        for cd, v in list(out_of_range.items())[:5]:
            log.warning(f"    {cd}: {v}")


def pull_median_income(api_key: str) -> dict[str, float | None]:
    """Pull B19013_001E (median household income) by CD."""
    log.info("Pulling median household income (B19013)...")
    rows = census_get(["B19013_001E"], api_key)
    header = rows[0]
    data = rows_to_district_dict(rows[1:], header)

    result = {}
    for cd, vals in data.items():
        result[cd] = safe_float(vals.get("B19013_001E"))

    validate_field(result, "median_income", 10000, 300000)
    return result


def pull_poverty_rate(api_key: str) -> dict[str, float | None]:
    """Pull B17001 (poverty status) and compute rate by CD."""
    log.info("Pulling poverty status (B17001)...")
    rows = census_get(["B17001_001E", "B17001_002E"], api_key)
    header = rows[0]
    data = rows_to_district_dict(rows[1:], header)

    result = {}
    for cd, vals in data.items():
        total = safe_float(vals.get("B17001_001E"))
        below = safe_float(vals.get("B17001_002E"))
        if total and total > 0 and below is not None:
            result[cd] = round(below / total * 100, 1)
        else:
            result[cd] = None

    validate_field(result, "poverty_rate", 0, 100)
    return result


def pull_education(api_key: str) -> dict[str, float | None]:
    """Pull B15003 (educational attainment 25+) and compute % associate's+."""
    log.info("Pulling educational attainment (B15003)...")
    # B15003_001E = total 25+
    # B15003_021E = associate's degree
    # B15003_022E = bachelor's degree
    # B15003_023E = master's degree
    # B15003_024E = professional school degree
    # B15003_025E = doctorate degree
    variables = [
        "B15003_001E",
        "B15003_021E", "B15003_022E", "B15003_023E",
        "B15003_024E", "B15003_025E",
    ]
    rows = census_get(variables, api_key)
    header = rows[0]
    data = rows_to_district_dict(rows[1:], header)

    result = {}
    for cd, vals in data.items():
        total = safe_float(vals.get("B15003_001E"))
        degree_vars = ["B15003_021E", "B15003_022E", "B15003_023E",
                       "B15003_024E", "B15003_025E"]
        degree_vals = [safe_float(vals.get(v)) for v in degree_vars]

        if total and total > 0 and all(v is not None for v in degree_vals):
            result[cd] = round(sum(degree_vals) / total * 100, 1)
        else:
            result[cd] = None

    validate_field(result, "pct_associates_plus", 0, 100)
    return result


def pull_age_18_24(api_key: str) -> dict[str, float | None]:
    """Pull B01001 (age by sex) and compute % aged 18-24."""
    log.info("Pulling age distribution (B01001)...")
    # Male 18-24: B01001_007E (18-19), _008E (20), _009E (21), _010E (22-24)
    # Female 18-24: B01001_031E (18-19), _032E (20), _033E (21), _034E (22-24)
    variables = [
        "B01001_001E",
        "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E",
        "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E",
    ]
    rows = census_get(variables, api_key)
    header = rows[0]
    data = rows_to_district_dict(rows[1:], header)

    result = {}
    for cd, vals in data.items():
        total = safe_float(vals.get("B01001_001E"))
        age_vars = [
            "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E",
            "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E",
        ]
        age_vals = [safe_float(vals.get(v)) for v in age_vars]

        if total and total > 0 and all(v is not None for v in age_vals):
            result[cd] = round(sum(age_vals) / total * 100, 1)
        else:
            result[cd] = None

    validate_field(result, "pct_18_24", 0, 100)
    return result


def main():
    log.info("=== pull_district_acs START ===")

    api_key = load_api_key()
    log.info(f"Census API key loaded ({len(api_key)} chars)")

    # Pull all 4 fields
    income = pull_median_income(api_key)
    poverty = pull_poverty_rate(api_key)
    education = pull_education(api_key)
    age = pull_age_18_24(api_key)

    # Load districts-meta.json
    log.info(f"Loading {DISTRICTS_META}...")
    with open(DISTRICTS_META) as f:
        meta = json.load(f)

    districts = meta["districts"]
    matched = 0
    unmatched_meta = []
    unmatched_acs = set(income.keys()) | set(poverty.keys())

    for cd_code, district in districts.items():
        if cd_code in income or cd_code in poverty or cd_code in education or cd_code in age:
            district["median_income"] = income.get(cd_code)
            district["poverty_rate"] = poverty.get(cd_code)
            district["pct_associates_plus"] = education.get(cd_code)
            district["pct_18_24"] = age.get(cd_code)
            matched += 1
            unmatched_acs.discard(cd_code)
        else:
            unmatched_meta.append(cd_code)

    log.info(f"Merge results: {matched} districts matched")
    if unmatched_meta:
        log.warning(f"  {len(unmatched_meta)} districts in meta with no ACS data: {unmatched_meta[:10]}")
    if unmatched_acs:
        log.warning(f"  {len(unmatched_acs)} ACS districts not in meta: {list(unmatched_acs)[:10]}")

    # Write updated districts-meta.json
    with open(DISTRICTS_META, "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    log.info(f"Wrote {DISTRICTS_META} ({DISTRICTS_META.stat().st_size / 1024:.1f} KB)")

    # Update sources.json retrieval dates
    today = date.today().isoformat()
    if SOURCES_JSON.exists():
        with open(SOURCES_JSON) as f:
            sources = json.load(f)

        acs_source_keys = [
            "acs5_2023_b19013",
            "acs5_2023_b17001",
            "acs5_2023_b15003",
            "acs5_2023_b01001",
        ]
        for key in acs_source_keys:
            if key in sources.get("sources", {}):
                sources["sources"][key]["retrieved"] = today

        with open(SOURCES_JSON, "w") as f:
            json.dump(sources, f, indent=2)
        log.info(f"Updated retrieval dates in {SOURCES_JSON}")

    log.info("=== pull_district_acs END ===")


if __name__ == "__main__":
    main()
```

**Step 2: Run the script**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District" && python3 code/pull_district_acs.py`

Expected output should show:
- 4 successful Census API calls
- Each field with plausible distributions (median income ~$50-80k, poverty ~5-30%, education ~30-70%, age 18-24 ~7-15%)
- ~435-441 districts matched
- `districts-meta.json` updated
- `sources.json` retrieval dates updated

**Step 3: Verify the data landed correctly**

Run: `python3 -c "import json; m=json.load(open('app/public/data/districts-meta.json')); d=list(m['districts'].values())[0]; print(json.dumps({k:d.get(k) for k in ['state','median_income','poverty_rate','pct_associates_plus','pct_18_24']}, indent=2))"`

Expected: A district entry with all 4 new fields populated with plausible numbers.

**Step 4: Commit**

```bash
git add code/pull_district_acs.py app/public/data/sources.json app/public/data/districts-meta.json
git commit -m "feat: add Census ACS district fields and source registry"
```

---

### Task 3: Load sources.json in the React app

**Files:**
- Modify: `app/src/hooks/useMapData.js`

**Step 1: Add sources.json to the data loading hook**

Add `sources.json` to the `Promise.all` fetch alongside existing data. Expose it as `sources` in the returned data object.

In `useMapData.js`, update the fetch call to:

```javascript
import { useState, useEffect } from 'react'

export function useMapData() {
  const [data, setData] = useState({
    campuses: null,
    districtsMeta: null,
    statesData: null,
    sources: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function load() {
      try {
        const [campuses, districtsMeta] = await Promise.all([
          fetch('/data/campuses.geojson').then((r) => r.json()),
          fetch('/data/districts-meta.json').then((r) => r.json()),
        ])

        let statesData = null
        try {
          statesData = await fetch('/data/states.json').then((r) => {
            if (!r.ok) return null
            return r.json()
          })
        } catch (e) {
          /* states.json optional */
        }

        let sources = null
        try {
          sources = await fetch('/data/sources.json').then((r) => {
            if (!r.ok) return null
            return r.json()
          })
        } catch (e) {
          /* sources.json optional */
        }

        setData({
          campuses,
          districtsMeta,
          statesData,
          sources,
          loading: false,
          error: null,
        })
      } catch (error) {
        console.error('Failed to load map data:', error)
        setData((prev) => ({ ...prev, loading: false, error: error.message }))
      }
    }
    load()
  }, [])

  return data
}
```

**Step 2: Pass sources through Layout to DistrictsTable**

In `app/src/components/Layout.jsx`, update the DistrictsTable render (line ~125-131) to also pass `sources`:

```jsx
{page === 'data' && subView === 'districts' && (
  <DistrictsTable
    campuses={data?.campuses}
    districtsMeta={data?.districtsMeta}
    sources={data?.sources}
    navigate={navigate}
    params={params}
  />
)}
```

Also pass `sources` to `CampusesTable` and `StatesTable` for future footnote use:

```jsx
{page === 'data' && subView === 'campuses' && (
  <CampusesTable
    campuses={data?.campuses}
    sources={data?.sources}
    navigate={navigate}
    params={params}
  />
)}
{page === 'data' && subView === 'states' && (
  <StatesTable
    campuses={data?.campuses}
    statesData={data?.statesData}
    sources={data?.sources}
    navigate={navigate}
    params={params}
  />
)}
```

Also pass `sources` to `Methodology`:

```jsx
{page === 'methodology' && <Methodology subView={subView} sources={data?.sources} />}
```

**Step 3: Verify the app builds**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app" && npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add app/src/hooks/useMapData.js app/src/components/Layout.jsx
git commit -m "feat: load sources.json and pass to table components"
```

---

### Task 4: Create the SourceFootnote component

**Files:**
- Create: `app/src/components/data/SourceFootnote.jsx`
- Modify: `app/src/styles/data.css` (add styles)

**Step 1: Create the component**

A small info icon button that, when clicked, shows a popover with source details. Takes a `fieldKey` and `sources` prop. Looks up the field in `sources.fieldMap`, then gets the source entry.

```jsx
import { useState, useRef, useEffect } from 'react'

export default function SourceFootnote({ fieldKey, sources }) {
  const [open, setOpen] = useState(false)
  const popRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!sources || !sources.fieldMap || !sources.sources) return null

  const sourceKey = sources.fieldMap[fieldKey]
  if (!sourceKey) return null

  const source = sources.sources[sourceKey]
  if (!source) return null

  return (
    <span className="source-footnote" ref={popRef}>
      <button
        className="source-footnote-btn"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        title="View data source"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.93 12.412H7.07V7.1h1.86v5.312zM8 6.004a1.07 1.07 0 1 1 0-2.14 1.07 1.07 0 0 1 0 2.14z"/>
        </svg>
      </button>
      {open && (
        <div className="source-footnote-pop" onClick={(e) => e.stopPropagation()}>
          <div className="source-footnote-name">{source.name}</div>
          <div className="source-footnote-detail">
            <span className="source-footnote-label">Provider:</span> {source.provider}
          </div>
          <div className="source-footnote-detail">
            <span className="source-footnote-label">Vintage:</span> {source.vintage}
          </div>
          {source.retrieved && (
            <div className="source-footnote-detail">
              <span className="source-footnote-label">Retrieved:</span> {source.retrieved}
            </div>
          )}
          {source.url && (
            <a
              className="source-footnote-link"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              View source &rarr;
            </a>
          )}
        </div>
      )}
    </span>
  )
}
```

**Step 2: Add CSS styles**

Append to `app/src/styles/data.css`:

```css
/* ── Source Footnote ── */
.source-footnote {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.source-footnote-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  color: var(--gray-lighter);
  border-radius: 50%;
  transition: color 0.15s;
  flex-shrink: 0;
}
.source-footnote-btn:hover {
  color: var(--teal);
}
.source-footnote-pop {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  background: white;
  border: 1px solid var(--border-main);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  padding: 12px 14px;
  min-width: 240px;
  max-width: 320px;
  margin-top: 6px;
}
.source-footnote-name {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 12px;
  color: var(--black);
  margin-bottom: 6px;
}
.source-footnote-detail {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--gray-body);
  margin-bottom: 3px;
}
.source-footnote-label {
  font-weight: 600;
  color: var(--gray-muted);
}
.source-footnote-link {
  display: inline-block;
  margin-top: 6px;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--teal);
  text-decoration: none;
  font-weight: 500;
}
.source-footnote-link:hover {
  text-decoration: underline;
}
```

**Step 3: Verify build**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app" && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add app/src/components/data/SourceFootnote.jsx app/src/styles/data.css
git commit -m "feat: add SourceFootnote component with info popover"
```

---

### Task 5: Add ACS fields and source footnotes to DistrictsTable

**Files:**
- Modify: `app/src/components/data/DistrictsTable.jsx`

**Step 1: Update the component**

Changes needed:
1. Accept `sources` prop
2. Add ACS fields to `districtLookup` (read from `districtsMeta`)
3. Add 4 new column definitions (after `party`)
4. Add `SourceFootnote` to all column headers
5. Update CSV export with new fields
6. Update `globalSearchFilter` fields list (no change needed — new fields are numeric)

Here is the full updated `DistrictsTable.jsx`:

```jsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import TableControls from './TableControls'
import ColumnFilterPopover from './ColumnFilterPopover'
import SourceFootnote from './SourceFootnote'
import { numericRangeFilter, makeGlobalSearchFilter } from './tableFilters'
import Toast from '../Toast'

/* ── Constants ── */

const INITIAL_VISIBLE = 50
const LOAD_MORE_COUNT = 50

const numFmt = new Intl.NumberFormat('en-US')
const dollarFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const globalSearchFilter = makeGlobalSearchFilter(['district', 'state', 'member', 'party', 'cookPVI'])

/* ── Main Component ── */

export default function DistrictsTable({ campuses, districtsMeta, sources, navigate, params }) {
  const [globalFilter, setGlobalFilter] = useState(params?.district || params?.state || '')
  const [sorting, setSorting] = useState([{ id: 'enrollment', desc: true }])
  const [columnFilters, setColumnFilters] = useState([])
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [columnVisibility, setColumnVisibility] = useState({})
  const [toast, setToast] = useState(null)

  /* ── Sync global filter from URL params ── */
  useEffect(() => {
    if (params?.district) setGlobalFilter(params.district)
    else if (params?.state) setGlobalFilter(params.state)
  }, [params?.district, params?.state])

  /* Reset visible count when filters/sorting change */
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE)
  }, [globalFilter, columnFilters, sorting])

  /* ── Build lookup from districts metadata ── */
  const districtLookup = useMemo(() => {
    if (!districtsMeta?.districts) return {}
    const lookup = {}
    Object.entries(districtsMeta.districts).forEach(([cd, d]) => {
      lookup[cd] = {
        cook_pvi: d.cook_pvi || '',
        member: d.member || '',
        party: d.party || '',
        median_income: d.median_income ?? null,
        poverty_rate: d.poverty_rate ?? null,
        pct_associates_plus: d.pct_associates_plus ?? null,
        pct_18_24: d.pct_18_24 ?? null,
      }
    })
    return lookup
  }, [districtsMeta])

  /* ── Aggregate campus data into district-level rows ── */
  const data = useMemo(() => {
    if (!campuses?.features) return []
    const metrics = {}
    campuses.features.forEach((f) => {
      const allDistricts = f.properties.all_districts
      if (!allDistricts) return
      allDistricts.split('|').forEach((cd) => {
        cd = cd.trim()
        if (!cd) return
        if (!metrics[cd]) metrics[cd] = { enrollment: 0, campusCount: 0 }
        metrics[cd].enrollment += f.properties.enrollment || 0
        metrics[cd].campusCount += 1
      })
    })

    return Object.entries(metrics).map(([district, m]) => {
      const dashIdx = district.indexOf('-')
      const state = dashIdx > 0 ? district.substring(0, dashIdx) : district
      const info = districtLookup[district] || {}
      return {
        district,
        state,
        enrollment: m.enrollment,
        campusCount: m.campusCount,
        cookPVI: info.cook_pvi || '',
        member: info.member || '',
        party: info.party || '',
        medianIncome: info.median_income,
        povertyRate: info.poverty_rate,
        pctAssociatesPlus: info.pct_associates_plus,
        pct1824: info.pct_18_24,
      }
    })
  }, [campuses, districtLookup])

  /* ── Column definitions ── */
  const columns = useMemo(
    () => [
      {
        id: 'district',
        accessorKey: 'district',
        header: 'District',
        meta: { fieldKey: 'districts_reached' },
        filterFn: 'includesString',
        cell: ({ getValue }) => {
          const cd = getValue()
          return (
            <a
              className="campus-link"
              onClick={(e) => {
                e.preventDefault()
                navigate('map', 'districts', { district: cd })
              }}
              href={`#map/districts?district=${encodeURIComponent(cd)}`}
            >
              {cd}
            </a>
          )
        },
      },
      {
        id: 'state',
        accessorKey: 'state',
        header: 'State',
        filterFn: 'includesString',
      },
      {
        id: 'enrollment',
        accessorKey: 'enrollment',
        header: 'Enrollment',
        meta: { isNumeric: true, fieldKey: 'enrollment' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'campusCount',
        accessorKey: 'campusCount',
        header: 'Campus Count',
        meta: { isNumeric: true },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => numFmt.format(getValue()),
        sortDescFirst: true,
      },
      {
        id: 'cookPVI',
        header: 'Cook PVI',
        accessorKey: 'cookPVI',
        meta: { fieldKey: 'cook_pvi' },
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
        sortingFn: (rowA, rowB) => {
          const parse = (s) => {
            if (!s || s === 'EVEN') return 0
            const m = s.match(/^([DR])\+(\d+)$/)
            if (!m) return 0
            return m[1] === 'D' ? -Number(m[2]) : Number(m[2])
          }
          return parse(rowA.original.cookPVI) - parse(rowB.original.cookPVI)
        },
      },
      {
        id: 'member',
        header: 'Representative',
        accessorKey: 'member',
        meta: { fieldKey: 'member' },
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
      },
      {
        id: 'party',
        header: 'Party',
        accessorKey: 'party',
        meta: { fieldKey: 'party' },
        filterFn: 'includesString',
        cell: ({ getValue }) => getValue() || '\u2014',
      },
      {
        id: 'medianIncome',
        accessorKey: 'medianIncome',
        header: 'Median Income',
        meta: { isNumeric: true, fieldKey: 'median_income' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? dollarFmt.format(v) : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'povertyRate',
        accessorKey: 'povertyRate',
        header: 'Poverty Rate',
        meta: { isNumeric: true, fieldKey: 'poverty_rate' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'pctAssociatesPlus',
        accessorKey: 'pctAssociatesPlus',
        header: "% Associate's+",
        meta: { isNumeric: true, fieldKey: 'pct_associates_plus' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
      {
        id: 'pct1824',
        accessorKey: 'pct1824',
        header: '% Age 18-24',
        meta: { isNumeric: true, fieldKey: 'pct_18_24' },
        filterFn: numericRangeFilter,
        cell: ({ getValue }) => {
          const v = getValue()
          return v != null ? `${v.toFixed(1)}%` : '\u2014'
        },
        sortDescFirst: true,
      },
    ],
    [navigate],
  )

  /* ── TanStack Table instance ── */
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: globalSearchFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredRows = table.getFilteredRowModel().rows
  const sortedRows = table.getSortedRowModel().rows

  /* ── Visible rows (show-more pattern) ── */
  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount],
  )

  const hasMore = visibleCount < sortedRows.length

  /* ── CSV Export ── */
  const handleExport = useCallback(() => {
    const headers = [
      'District',
      'State',
      'Enrollment',
      'Campus Count',
      'Cook PVI',
      'Representative',
      'Party',
      'Median Income',
      'Poverty Rate (%)',
      "% Associate's+",
      '% Age 18-24',
    ]
    const notes = [
      'Congressional district code',
      'State abbreviation',
      'Sum of enrollment from campuses reaching this district',
      'Number of community college campuses reaching this district',
      '2024 Cook Partisan Voter Index',
      'Current U.S. Representative',
      'Party affiliation (R/D)',
      'Median household income (ACS 2023 5-Year)',
      'Poverty rate (ACS 2023 5-Year)',
      'Pct of adults 25+ with associate\'s degree or higher (ACS 2023 5-Year)',
      'Pct of population aged 18-24 (ACS 2023 5-Year)',
    ]

    function csvEscape(val) {
      if (val == null) return ''
      const s = String(val)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const rowsToExport = sortedRows
    const lines = [
      headers.map(csvEscape).join(','),
      notes.map(csvEscape).join(','),
    ]

    for (const row of rowsToExport) {
      const d = row.original
      lines.push(
        [
          d.district,
          d.state,
          d.enrollment,
          d.campusCount,
          d.cookPVI,
          d.member,
          d.party,
          d.medianIncome != null ? d.medianIncome : '',
          d.povertyRate != null ? d.povertyRate : '',
          d.pctAssociatesPlus != null ? d.pctAssociatesPlus : '',
          d.pct1824 != null ? d.pct1824 : '',
        ]
          .map(csvEscape)
          .join(','),
      )
    }

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'districts_data.csv'
    a.click()
    URL.revokeObjectURL(url)
    setToast('CSV exported')
  }, [sortedRows])

  /* ── Sort icon helper ── */
  function sortIcon(column) {
    const dir = column.getIsSorted()
    if (!dir) return <span className="sort-icon">&nbsp;&nbsp;</span>
    return <span className="sort-icon">{dir === 'asc' ? ' \u25B2' : ' \u25BC'}</span>
  }

  /* ── Header columns (for rendering) ── */
  const headerGroups = table.getHeaderGroups()

  return (
    <div className="data-page">
      <TableControls
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        groupBy=""
        onGroupByChange={() => {}}
        groupByOptions={[]}
        rowCount={filteredRows.length}
        totalCount={data.length}
        onExport={handleExport}
        searchPlaceholder="Search by district or state..."
        entityName="districts"
        columns={table.getAllLeafColumns()}
      />

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const isNum = header.column.columnDef.meta?.isNumeric
                  const alignRight = idx >= headerGroup.headers.length - 3
                  const fieldKey = header.column.columnDef.meta?.fieldKey
                  return (
                    <th
                      key={header.id}
                      className={isNum ? 'num' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="th-content">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortIcon(header.column)}
                        {fieldKey && <SourceFootnote fieldKey={fieldKey} sources={sources} />}
                        <ColumnFilterPopover
                          column={header.column}
                          isNumeric={!!isNum}
                          alignRight={alignRight}
                        />
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="data-row-clickable"
                onClick={() => navigate('map', 'districts', { district: row.original.district })}
              >
                {row.getVisibleCells().map((cell) => {
                  const isNum = cell.column.columnDef.meta?.isNumeric
                  return (
                    <td
                      key={cell.id}
                      className={isNum ? 'num' : ''}
                      data-label={cell.column.columnDef.header}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="data-show-more">
          <button
            className="show-more-btn"
            onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
          >
            Show more ({sortedRows.length - visibleCount} remaining)
          </button>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
```

**Step 2: Verify build and test locally**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app" && npm run build`
Expected: Build succeeds.

Run: `npm run dev` and open the Districts data tab in browser. Verify:
- 4 new columns appear after Party
- Values display with correct formatting ($XX,XXX for income, XX.X% for percentages)
- Columns are sortable and filterable
- Source footnote icons appear on column headers with fieldKey
- Clicking info icon shows source popover
- CSV export includes new fields

**Step 3: Commit**

```bash
git add app/src/components/data/DistrictsTable.jsx
git commit -m "feat: add 4 ACS columns and source footnotes to Districts table"
```

---

### Task 6: Update Methodology page with ACS data sources

**Files:**
- Modify: `app/src/components/methodology/Methodology.jsx`

**Step 1: Update DistrictMethodology to include ACS field documentation**

Add a new section after "District Enrollment & Campus Count" in the `DistrictMethodology` function. Also add a "Data Sources" summary table at the top that references sources from the registry. The `sources` prop is passed down from Layout.

Add these sections to the `DistrictMethodology` component (insert after the "District Enrollment & Campus Count" `<h2>` section, before "Map Coloring"):

```jsx
function DistrictMethodology({ sources }) {
  // ... existing return JSX, add these sections before "Map Coloring":

  <h2>Census ACS Demographic Fields</h2>
  <p>Four demographic fields are sourced from the U.S. Census Bureau{'\u2019'}s American Community Survey (ACS) 5-Year Estimates, 2023 vintage (covering the 2019{'\u2013'}2023 period). All values are pulled at the congressional district level (118th Congress boundaries) via the Census API.</p>

  <table>
    <thead>
      <tr><th>Field</th><th>ACS Table</th><th>Computation</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Median Income</strong></td>
        <td>B19013</td>
        <td>Direct value from <code>B19013_001E</code> (median household income, inflation-adjusted)</td>
      </tr>
      <tr>
        <td><strong>Poverty Rate</strong></td>
        <td>B17001</td>
        <td><code>B17001_002E</code> (below poverty) / <code>B17001_001E</code> (total) &times; 100</td>
      </tr>
      <tr>
        <td><strong>% Associate{'\u2019'}s+</strong></td>
        <td>B15003</td>
        <td>Sum of <code>B15003_021E</code> through <code>B15003_025E</code> (associate{'\u2019'}s through doctorate) / <code>B15003_001E</code> (total 25+) &times; 100</td>
      </tr>
      <tr>
        <td><strong>% Age 18-24</strong></td>
        <td>B01001</td>
        <td>Sum of <code>B01001_007E</code>{'\u2013'}<code>010E</code> + <code>B01001_031E</code>{'\u2013'}<code>034E</code> (male + female 18{'\u2013'}24) / <code>B01001_001E</code> (total) &times; 100</td>
      </tr>
    </tbody>
  </table>
  <p>Census API values that are negative (sentinel codes for suppressed or unavailable data) are treated as null and displayed as {'\u201C'}{'\u2014'}{'\u201D'} in the table.</p>
```

Also update the `Methodology` component to accept and pass `sources`:

```jsx
export default function Methodology({ subView, sources }) {
  return (
    <div className="page-scroll">
      <div className="methodology-content">
        {subView === 'states' && <StateMethodology sources={sources} />}
        {subView === 'districts' && <DistrictMethodology sources={sources} />}
        {subView === 'campuses' && <CampusMethodology sources={sources} />}
      </div>
    </div>
  )
}
```

Add a "Data Sources" table at the top of `DistrictMethodology` that auto-generates from sources.json:

```jsx
function DistrictMethodology({ sources }) {
  // Build a list of sources relevant to district data
  const districtFieldKeys = ['cook_pvi', 'member', 'party', 'enrollment', 'median_income', 'poverty_rate', 'pct_associates_plus', 'pct_18_24']
  const districtSources = []
  const seen = new Set()
  if (sources?.fieldMap && sources?.sources) {
    for (const fk of districtFieldKeys) {
      const sk = sources.fieldMap[fk]
      if (sk && sources.sources[sk] && !seen.has(sk)) {
        seen.add(sk)
        districtSources.push(sources.sources[sk])
      }
    }
  }

  return (
    <>
      <h1>Methodology: District-Level Data</h1>
      <p>This page describes the data sources and derivations behind the congressional district-level fields.</p>

      {districtSources.length > 0 && (
        <>
          <h2>Data Sources</h2>
          <table>
            <thead>
              <tr><th>Source</th><th>Provider</th><th>Vintage</th><th>Retrieved</th></tr>
            </thead>
            <tbody>
              {districtSources.map((s, i) => (
                <tr key={i}>
                  <td><strong>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</strong></td>
                  <td>{s.provider}</td>
                  <td>{s.vintage}</td>
                  <td>{s.retrieved || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ... rest of existing content ... */}
    </>
  )
}
```

**Step 2: Verify build**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app" && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add app/src/components/methodology/Methodology.jsx
git commit -m "feat: add ACS field documentation and auto-generated sources table to Methodology"
```

---

### Task 7: Visual verification and final build

**Files:**
- No new files

**Step 1: Run the full app locally and verify end-to-end**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app" && npm run dev`

Check the following in the browser:

1. **Districts Data tab:** 11 columns visible, 4 new ACS columns show formatted data
2. **Sort/filter:** Click each new column header to sort; use column filter to set min/max ranges
3. **Source footnotes:** Click info icon on column headers — popover shows source details with link
4. **CSV export:** Click "Export CSV", open the file, verify new columns present with correct values
5. **Methodology > Districts:** Auto-generated "Data Sources" table appears at top; ACS fields section present
6. **No regressions:** Campuses tab, States tab, Map tab, Target tab all still work

**Step 2: Production build**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app" && npm run build`
Expected: Build succeeds with no errors or warnings.

**Step 3: Verify the built dist directory looks right**

Run: `ls -la "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District/app/dist/data/"`
Expected: `districts-meta.json` and `sources.json` are present alongside existing data files.

**Step 4: Final commit**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: address visual/build issues from verification"
```
