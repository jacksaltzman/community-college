#!/usr/bin/env python3
"""
pull_district_acs.py
Pull ACS 2023 5-Year demographic fields for every congressional district
and merge them into districts-meta.json.

Fields pulled:
  - median_income      : B19013_001E (direct value)
  - poverty_rate       : B17001_002E / B17001_001E * 100
  - pct_associates_plus: sum(B15003_021E..025E) / B15003_001E * 100
  - pct_18_24          : sum(B01001_007E..010E, B01001_031E..034E) / B01001_001E * 100
"""

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

ACS_BASE = "https://api.census.gov/data/2023/acs/acs5"

# Variables we need (one API call fetches all of them)
INCOME_VARS = ["B19013_001E"]
POVERTY_VARS = ["B17001_001E", "B17001_002E"]
EDUCATION_VARS = [
    "B15003_001E",
    "B15003_021E", "B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E",
]
AGE_VARS = [
    "B01001_001E",
    "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E",
    "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E",
]

ALL_VARS = list(dict.fromkeys(
    INCOME_VARS + POVERTY_VARS + EDUCATION_VARS + AGE_VARS
))

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def read_api_key() -> str:
    """Read Census API key from Environment.txt."""
    text = ENV_FILE.read_text().strip()
    for line in text.splitlines():
        if line.startswith("CENSUS_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError(f"CENSUS_API_KEY not found in {ENV_FILE}")


def census_val(raw) -> float | None:
    """Convert a Census API value to float, treating negatives and None as null."""
    if raw is None:
        return None
    try:
        v = float(raw)
    except (ValueError, TypeError):
        return None
    # Census sentinel values: -666666666, -999999999, etc.
    if v < 0:
        return None
    return v


def safe_ratio(numerator: float | None, denominator: float | None) -> float | None:
    """Compute ratio * 100, returning None if inputs are invalid."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round(numerator / denominator * 100, 2)


def make_district_code(state_fips: str, cd_num: str) -> str | None:
    """Convert state FIPS + CD number to our district code (e.g., 'CA-12', 'SD-AL')."""
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


def fetch_acs(api_key: str) -> list[dict]:
    """Fetch ACS data for all congressional districts, return list of header+rows."""
    var_str = ",".join(ALL_VARS)
    url = (
        f"{ACS_BASE}?get={var_str}"
        f"&for=congressional%20district:*&in=state:*&key={api_key}"
    )
    log.info("Fetching ACS data from Census API ...")
    req = Request(url)
    try:
        with urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        log.error("Census API request failed: %s", exc)
        sys.exit(1)
    log.info("Received %d rows (including header)", len(data))
    return data


def parse_rows(raw: list[list]) -> dict[str, dict]:
    """Parse Census API response into {district_code: {field: value}} dict."""
    header = raw[0]
    rows = raw[1:]

    # Build column index lookup
    col = {name: idx for idx, name in enumerate(header)}

    results: dict[str, dict] = {}
    skipped = 0

    for row in rows:
        state_fips = row[col["state"]]
        cd_num = row[col["congressional district"]]
        dc = make_district_code(state_fips, cd_num)
        if dc is None:
            skipped += 1
            continue

        # --- Median income ---
        median_income_raw = census_val(row[col["B19013_001E"]])
        median_income = int(median_income_raw) if median_income_raw is not None else None

        # --- Poverty rate ---
        pov_total = census_val(row[col["B17001_001E"]])
        pov_below = census_val(row[col["B17001_002E"]])
        poverty_rate = safe_ratio(pov_below, pov_total)

        # --- Education (% associate's degree or higher) ---
        edu_total = census_val(row[col["B15003_001E"]])
        edu_assoc_plus = sum(filter(None, [
            census_val(row[col[f"B15003_{i:03d}E"]]) for i in range(21, 26)
        ]))
        pct_associates_plus = safe_ratio(edu_assoc_plus, edu_total) if edu_total else None

        # --- Age 18-24 ---
        age_total = census_val(row[col["B01001_001E"]])
        male_18_24 = sum(filter(None, [
            census_val(row[col[f"B01001_{i:03d}E"]]) for i in range(7, 11)
        ]))
        female_18_24 = sum(filter(None, [
            census_val(row[col[f"B01001_{i:03d}E"]]) for i in range(31, 35)
        ]))
        pct_18_24 = safe_ratio(male_18_24 + female_18_24, age_total) if age_total else None

        results[dc] = {
            "median_income": median_income,
            "poverty_rate": poverty_rate,
            "pct_associates_plus": pct_associates_plus,
            "pct_18_24": pct_18_24,
        }

    log.info("Parsed %d districts, skipped %d rows", len(results), skipped)
    return results


def validate_and_log(acs_data: dict[str, dict]) -> None:
    """Log min/median/max for each field and warn about nulls."""
    fields = ["median_income", "poverty_rate", "pct_associates_plus", "pct_18_24"]
    for field in fields:
        values = [d[field] for d in acs_data.values() if d[field] is not None]
        nulls = sum(1 for d in acs_data.values() if d[field] is None)
        if not values:
            log.warning("  %s: ALL VALUES NULL", field)
            continue
        lo = min(values)
        hi = max(values)
        med = round(statistics.median(values), 2)
        log.info(
            "  %-22s  n=%3d  null=%2d  min=%10s  median=%10s  max=%10s",
            field, len(values), nulls, f"{lo:,.2f}", f"{med:,.2f}", f"{hi:,.2f}",
        )

        # Range sanity checks
        if field == "median_income" and (lo < 5000 or hi > 500000):
            log.warning("  %s range looks suspicious: [%s, %s]", field, lo, hi)
        if field in ("poverty_rate", "pct_associates_plus", "pct_18_24"):
            if lo < 0 or hi > 100:
                log.warning("  %s outside 0-100 range: [%s, %s]", field, lo, hi)


def merge_into_meta(acs_data: dict[str, dict]) -> int:
    """Merge ACS fields into districts-meta.json. Returns count of matched districts."""
    log.info("Reading %s ...", META_FILE)
    meta = json.loads(META_FILE.read_text())
    districts = meta["districts"]

    matched = 0
    unmatched_acs = []

    for dc, fields in acs_data.items():
        if dc in districts:
            districts[dc].update(fields)
            matched += 1
        else:
            unmatched_acs.append(dc)

    # Districts in meta but missing ACS data
    missing_acs = [dc for dc in districts if dc not in acs_data]

    log.info("Matched %d / %d districts in meta", matched, len(districts))
    if unmatched_acs:
        log.info("ACS districts not in meta (%d): %s", len(unmatched_acs), unmatched_acs[:10])
    if missing_acs:
        log.info("Meta districts missing ACS data (%d): %s", len(missing_acs), missing_acs[:10])

    log.info("Writing updated %s ...", META_FILE)
    META_FILE.write_text(json.dumps(meta, separators=(",", ":")))
    return matched


def update_sources() -> None:
    """Update retrieval dates for the 4 ACS source keys in sources.json."""
    log.info("Updating %s ...", SOURCES_FILE)
    sources = json.loads(SOURCES_FILE.read_text())
    today = date.today().isoformat()

    acs_keys = [
        "acs5_2023_b19013",
        "acs5_2023_b17001",
        "acs5_2023_b15003",
        "acs5_2023_b01001",
    ]

    for key in acs_keys:
        if key in sources["sources"]:
            sources["sources"][key]["retrieved"] = today
            log.info("  %s  retrieved → %s", key, today)
        else:
            log.warning("  %s not found in sources.json", key)

    SOURCES_FILE.write_text(json.dumps(sources, indent=2) + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    log.info("=" * 60)
    log.info("pull_district_acs.py — ACS 2023 5-Year demographic pull")
    log.info("=" * 60)

    api_key = read_api_key()
    log.info("API key loaded (%s...)", api_key[:8])

    raw = fetch_acs(api_key)
    acs_data = parse_rows(raw)

    log.info("Validation summary:")
    validate_and_log(acs_data)

    matched = merge_into_meta(acs_data)
    update_sources()

    log.info("Done. %d districts enriched with ACS data.", matched)


if __name__ == "__main__":
    main()
