# Voter Turnout by Congressional District — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 2022 and 2024 voter turnout (total votes + turnout rate) to every congressional district in the app.

**Architecture:** New Python script downloads MEDSL House returns CSV + Census CVAP, computes turnout, merges into districts-meta.json. Then wire 4 new columns into DistrictsTable.jsx.

**Tech Stack:** Python 3 (csv, json, urllib), Census ACS API, Harvard Dataverse file API, React/TanStack Table

---

### Task 1: Create `pull_district_turnout.py` — download and parse MEDSL data

**Files:**
- Create: `code/pull_district_turnout.py`

**Step 1: Create the script with imports, config, and MEDSL download function**

```python
#!/usr/bin/env python3
"""
pull_district_turnout.py
Download MEDSL U.S. House returns and Census CVAP data, compute voter turnout
per congressional district for 2022 and 2024, and merge into districts-meta.json.
"""

import csv
import io
import json
import logging
import os
import statistics
import sys
from datetime import date
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / "Environment.txt"
META_FILE = PROJECT_ROOT / "app" / "public" / "data" / "districts-meta.json"
SOURCES_FILE = PROJECT_ROOT / "app" / "public" / "data" / "sources.json"
DATA_DIR = PROJECT_ROOT / "data"

# MEDSL U.S. House 1976-2024 (Harvard Dataverse file ID 12066706)
MEDSL_URL = "https://dataverse.harvard.edu/api/access/datafile/12066706"
MEDSL_CACHE = DATA_DIR / "medsl_house_1976_2024.csv"

ACS_BASE = "https://api.census.gov/data/2023/acs/acs5"
CVAP_VAR = "B29001_001E"

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

YEARS = [2022, 2024]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)
```

**Step 2: Add MEDSL download + parse functions**

```python
def download_medsl() -> str:
    """Download MEDSL House returns CSV, cache locally. Return file path."""
    if MEDSL_CACHE.exists():
        log.info("Using cached MEDSL data: %s", MEDSL_CACHE)
        return str(MEDSL_CACHE)

    log.info("Downloading MEDSL House returns from Harvard Dataverse ...")
    req = Request(MEDSL_URL)
    try:
        with urlopen(req, timeout=120) as resp:
            content = resp.read()
    except (HTTPError, URLError) as exc:
        log.error("MEDSL download failed: %s", exc)
        sys.exit(1)

    MEDSL_CACHE.write_bytes(content)
    log.info("Saved %d bytes to %s", len(content), MEDSL_CACHE)
    return str(MEDSL_CACHE)


def make_district_code_medsl(state_po: str, district: str) -> str:
    """Convert MEDSL state_po + district to our code (e.g., 'CA-12', 'WY-AL')."""
    d = district.strip().strip('"')
    if d == "0":
        return f"{state_po}-AL"
    try:
        return f"{state_po}-{int(d)}"
    except ValueError:
        return f"{state_po}-{d}"


def parse_medsl(file_path: str) -> dict[int, dict[str, int]]:
    """
    Parse MEDSL CSV, return {year: {district_code: total_votes}}.
    Filter to general elections, non-special, non-runoff.
    """
    results = {y: {} for y in YEARS}

    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Handle quoted fields from the tab-format
            year_raw = row.get("year", "").strip().strip('"')
            try:
                year = int(year_raw)
            except ValueError:
                continue
            if year not in YEARS:
                continue

            stage = row.get("stage", "").strip().strip('"').upper()
            special = row.get("special", "").strip().strip('"').upper()
            runoff = row.get("runoff", "").strip().strip('"').upper()

            if stage != "GEN" or special == "TRUE" or runoff == "TRUE":
                continue

            state_po = row.get("state_po", "").strip().strip('"')
            district = row.get("district", "").strip().strip('"')
            totalvotes_raw = row.get("totalvotes", "").strip().strip('"')

            if not state_po or not district:
                continue

            try:
                totalvotes = int(totalvotes_raw)
            except (ValueError, TypeError):
                continue

            dc = make_district_code_medsl(state_po, district)
            # totalvotes repeats per candidate; just take it (they're all the same)
            results[year][dc] = totalvotes

    for y in YEARS:
        log.info("MEDSL %d: %d districts with vote totals", y, len(results[y]))

    return results
```

**Step 3: Add Census CVAP fetch function**

```python
def read_api_key() -> str:
    """Read Census API key from Environment.txt."""
    text = ENV_FILE.read_text().strip()
    for line in text.splitlines():
        if line.startswith("CENSUS_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError(f"CENSUS_API_KEY not found in {ENV_FILE}")


def make_district_code_census(state_fips: str, cd_num: str) -> str | None:
    """Convert state FIPS + CD number to our district code."""
    state = FIPS_TO_STATE.get(state_fips)
    if state is None:
        return None
    if cd_num == "00":
        return f"{state}-AL"
    if cd_num == "98":
        return f"{state}-98"
    try:
        return f"{state}-{int(cd_num)}"
    except ValueError:
        return None


def fetch_cvap(api_key: str) -> dict[str, int]:
    """Fetch CVAP (citizen voting-age population) for all CDs. Return {district_code: cvap}."""
    url = (
        f"{ACS_BASE}?get={CVAP_VAR}"
        f"&for=congressional%20district:*&in=state:*&key={api_key}"
    )
    log.info("Fetching CVAP from Census API ...")
    req = Request(url)
    try:
        with urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        log.error("Census API request failed: %s", exc)
        sys.exit(1)

    header = data[0]
    rows = data[1:]
    col = {name: idx for idx, name in enumerate(header)}

    results = {}
    for row in rows:
        state_fips = row[col["state"]]
        cd_num = row[col["congressional district"]]
        dc = make_district_code_census(state_fips, cd_num)
        if dc is None:
            continue
        raw = row[col[CVAP_VAR]]
        try:
            val = int(float(raw))
        except (ValueError, TypeError):
            continue
        if val < 0:
            continue
        results[dc] = val

    log.info("CVAP: %d districts fetched", len(results))
    return results
```

**Step 4: Add turnout computation, validation, merge, and main**

```python
def compute_turnout(
    votes: dict[int, dict[str, int]],
    cvap: dict[str, int],
) -> dict[str, dict]:
    """
    Combine votes and CVAP into per-district turnout fields.
    Returns {district_code: {total_votes_2022, total_votes_2024, turnout_rate_2022, turnout_rate_2024}}.
    """
    all_districts = set()
    for year_data in votes.values():
        all_districts.update(year_data.keys())
    all_districts.update(cvap.keys())

    results = {}
    for dc in all_districts:
        entry = {}
        pop = cvap.get(dc)
        for year in YEARS:
            tv = votes[year].get(dc)
            entry[f"total_votes_{year}"] = tv
            if tv is not None and pop is not None and pop > 0:
                entry[f"turnout_rate_{year}"] = round(tv / pop * 100, 1)
            else:
                entry[f"turnout_rate_{year}"] = None
        results[dc] = entry

    return results


def validate_and_log(turnout: dict[str, dict]) -> None:
    """Log min/median/max for each field and warn about outliers."""
    fields = [f"total_votes_{y}" for y in YEARS] + [f"turnout_rate_{y}" for y in YEARS]
    for field in fields:
        values = [d[field] for d in turnout.values() if d[field] is not None]
        nulls = sum(1 for d in turnout.values() if d[field] is None)
        if not values:
            log.warning("  %s: ALL VALUES NULL", field)
            continue
        lo = min(values)
        hi = max(values)
        med = round(statistics.median(values), 1)
        log.info(
            "  %-22s  n=%3d  null=%2d  min=%10s  median=%10s  max=%10s",
            field, len(values), nulls, f"{lo:,.1f}", f"{med:,.1f}", f"{hi:,.1f}",
        )
        if "turnout_rate" in field and (lo < 5 or hi > 95):
            log.warning("  %s has extreme values: [%.1f, %.1f]", field, lo, hi)


def merge_into_meta(turnout: dict[str, dict]) -> int:
    """Merge turnout fields into districts-meta.json. Return count of matched districts."""
    log.info("Reading %s ...", META_FILE)
    meta = json.loads(META_FILE.read_text())
    districts = meta["districts"]

    matched = 0
    for dc, fields in turnout.items():
        if dc in districts:
            districts[dc].update(fields)
            matched += 1

    missing = [dc for dc in districts if dc not in turnout]
    if missing:
        log.info("Meta districts missing turnout data (%d): %s", len(missing), missing[:10])

    log.info("Writing updated %s ...", META_FILE)
    META_FILE.write_text(json.dumps(meta, separators=(",", ":")))
    log.info("Matched %d / %d districts in meta", matched, len(districts))
    return matched


def update_sources() -> None:
    """Add/update turnout source entries in sources.json."""
    log.info("Updating %s ...", SOURCES_FILE)
    sources = json.loads(SOURCES_FILE.read_text())
    today = date.today().isoformat()

    sources["sources"]["medsl_house_2022"] = {
        "name": "U.S. House Returns — 2022 Midterm",
        "provider": "MIT Election Data + Science Lab (MEDSL)",
        "url": "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2",
        "vintage": "2022",
        "retrieved": today,
        "description": "Total votes cast in 2022 U.S. House general elections by congressional district",
    }
    sources["sources"]["medsl_house_2024"] = {
        "name": "U.S. House Returns — 2024 General",
        "provider": "MIT Election Data + Science Lab (MEDSL)",
        "url": "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2",
        "vintage": "2024",
        "retrieved": today,
        "description": "Total votes cast in 2024 U.S. House general elections by congressional district",
    }
    sources["sources"]["acs5_2023_b29001"] = {
        "name": "Citizen Voting-Age Population (B29001)",
        "provider": "U.S. Census Bureau, American Community Survey 5-Year Estimates",
        "url": "https://api.census.gov/data/2023/acs/acs5",
        "vintage": "2023 (2019-2023)",
        "retrieved": today,
        "variable": "B29001_001E",
        "geography": "Congressional District (118th Congress)",
        "description": "Total citizen voting-age population (18+) used as denominator for turnout rate",
    }

    sources["fieldMap"]["total_votes_2022"] = "medsl_house_2022"
    sources["fieldMap"]["total_votes_2024"] = "medsl_house_2024"
    sources["fieldMap"]["turnout_rate_2022"] = "medsl_house_2022"
    sources["fieldMap"]["turnout_rate_2024"] = "medsl_house_2024"

    SOURCES_FILE.write_text(json.dumps(sources, indent=2) + "\n")
    log.info("Sources updated.")


def main() -> None:
    log.info("=" * 60)
    log.info("pull_district_turnout.py — Voter Turnout by District")
    log.info("=" * 60)

    # 1. MEDSL data
    medsl_path = download_medsl()
    votes = parse_medsl(medsl_path)

    # 2. Census CVAP
    api_key = read_api_key()
    log.info("API key loaded (%s...)", api_key[:8])
    cvap = fetch_cvap(api_key)

    # 3. Compute turnout
    turnout = compute_turnout(votes, cvap)

    # 4. Validate
    log.info("Validation summary:")
    validate_and_log(turnout)

    # 5. Merge + update sources
    matched = merge_into_meta(turnout)
    update_sources()

    log.info("Done. %d districts enriched with turnout data.", matched)


if __name__ == "__main__":
    main()
```

**Step 5: Run the script**

Run: `cd "/Users/jacksaltzman/Library/Mobile Documents/com~apple~CloudDocs/Accountable/Higher Ed/Students Per District" && python3 code/pull_district_turnout.py`

Expected: Script downloads MEDSL data, fetches CVAP, computes turnout for ~435 districts, merges into districts-meta.json, updates sources.json. Logs show validation summary with reasonable turnout rates (30-80% range typical).

**Step 6: Verify the output**

Run: `python3 -c "import json; d=json.load(open('app/public/data/districts-meta.json'))['districts']; s=d['CA-12']; print(json.dumps({k:s[k] for k in ['total_votes_2022','total_votes_2024','turnout_rate_2022','turnout_rate_2024']}, indent=2))"`

Expected: 4 new fields with reasonable values.

**Step 7: Commit**

```bash
git add code/pull_district_turnout.py data/medsl_house_1976_2024.csv app/public/data/districts-meta.json app/public/data/sources.json
git commit -m "feat: add voter turnout data (2022 + 2024) to districts metadata"
```

---

### Task 2: Wire turnout columns into DistrictsTable.jsx

**Files:**
- Modify: `app/src/components/data/DistrictsTable.jsx`

**Step 1: Add turnout fields to the data aggregation**

In the `data` useMemo (around line 76), the district rows are built from `districtsMeta`. Add the 4 new fields from `districtLookup`:

In the `districtLookup` useMemo, add:
```javascript
total_votes_2022: d.total_votes_2022 ?? null,
total_votes_2024: d.total_votes_2024 ?? null,
turnout_rate_2022: d.turnout_rate_2022 ?? null,
turnout_rate_2024: d.turnout_rate_2024 ?? null,
```

In the `data` useMemo return object, add:
```javascript
totalVotes2022: info.total_votes_2022,
totalVotes2024: info.total_votes_2024,
turnoutRate2022: info.turnout_rate_2022,
turnoutRate2024: info.turnout_rate_2024,
```

**Step 2: Add 4 new column definitions**

After the `pct1824` column definition, add:

```javascript
{
  id: 'totalVotes2022',
  accessorKey: 'totalVotes2022',
  header: 'Votes 2022',
  meta: { isNumeric: true, fieldKey: 'total_votes_2022' },
  filterFn: numericRangeFilter,
  cell: ({ getValue }) => {
    const v = getValue()
    return v != null ? numFmt.format(v) : '\u2014'
  },
  sortDescFirst: true,
},
{
  id: 'totalVotes2024',
  accessorKey: 'totalVotes2024',
  header: 'Votes 2024',
  meta: { isNumeric: true, fieldKey: 'total_votes_2024' },
  filterFn: numericRangeFilter,
  cell: ({ getValue }) => {
    const v = getValue()
    return v != null ? numFmt.format(v) : '\u2014'
  },
  sortDescFirst: true,
},
{
  id: 'turnoutRate2022',
  accessorKey: 'turnoutRate2022',
  header: 'Turnout 2022',
  meta: { isNumeric: true, fieldKey: 'turnout_rate_2022' },
  filterFn: numericRangeFilter,
  cell: ({ getValue }) => {
    const v = getValue()
    return v != null ? `${v.toFixed(1)}%` : '\u2014'
  },
  sortDescFirst: true,
},
{
  id: 'turnoutRate2024',
  accessorKey: 'turnoutRate2024',
  header: 'Turnout 2024',
  meta: { isNumeric: true, fieldKey: 'turnout_rate_2024' },
  filterFn: numericRangeFilter,
  cell: ({ getValue }) => {
    const v = getValue()
    return v != null ? `${v.toFixed(1)}%` : '\u2014'
  },
  sortDescFirst: true,
},
```

**Step 3: Update CSV export**

Add to the `headers` array:
```javascript
'Votes 2022',
'Votes 2024',
'Turnout 2022 (%)',
'Turnout 2024 (%)',
```

Add to the `notes` array:
```javascript
'Total votes cast in 2022 House general election (MEDSL)',
'Total votes cast in 2024 House general election (MEDSL)',
'Turnout rate: votes / citizen voting-age population (ACS 2023 CVAP)',
'Turnout rate: votes / citizen voting-age population (ACS 2023 CVAP)',
```

Add to each row's export array:
```javascript
d.totalVotes2022 != null ? d.totalVotes2022 : '',
d.totalVotes2024 != null ? d.totalVotes2024 : '',
d.turnoutRate2022 != null ? d.turnoutRate2022 : '',
d.turnoutRate2024 != null ? d.turnoutRate2024 : '',
```

**Step 4: Commit**

```bash
git add app/src/components/data/DistrictsTable.jsx
git commit -m "feat: add voter turnout columns to Districts table"
```

---

### Task 3: Copy updated data to app/public and verify

**Step 1: Copy districts-meta.json to app/public/data (if not already there)**

The script already writes directly to `app/public/data/districts-meta.json`, so this should already be done. Verify:

Run: `python3 -c "import json; d=json.load(open('app/public/data/districts-meta.json'))['districts']['NY-12']; print(d.get('turnout_rate_2024'))"`

Expected: A number like `45.2` (or similar).

**Step 2: Also copy to map/data if needed**

Run: `cp app/public/data/districts-meta.json map/data/districts-meta.json && cp app/public/data/sources.json map/data/sources.json`

**Step 3: Build and verify the app**

Run: `cd app && npm run build`

Expected: Build succeeds with no errors.

**Step 4: Commit all data files**

```bash
git add map/data/districts-meta.json map/data/sources.json
git commit -m "chore: sync updated data files to map directory"
```

---

### Task 4: Final push

**Step 1: Push all commits**

```bash
git push
```
