#!/usr/bin/env python3
"""
pull_district_turnout.py
Download MEDSL U.S. House returns (2022 + 2024), fetch CVAP from ACS 2023
5-Year, compute voter-turnout rates, and merge into districts-meta.json.

Fields produced:
  - total_votes_2022   : total ballots cast in the 2022 House general election
  - total_votes_2024   : total ballots cast in the 2024 House general election
  - turnout_rate_2022  : total_votes_2022 / CVAP * 100  (rounded to 1 decimal)
  - turnout_rate_2024  : total_votes_2024 / CVAP * 100  (rounded to 1 decimal)
"""

import json
import logging
import os
import statistics
import subprocess
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
MEDSL_CACHE = DATA_DIR / "medsl_house_1976_2024.csv"

MEDSL_URL = "https://dataverse.harvard.edu/api/access/datafile/12066706"
ACS_BASE = "https://api.census.gov/data/2023/acs/acs5"
CVAP_VAR = "B29001_001E"  # Citizen Voting-Age Population

YEARS_OF_INTEREST = {2022, 2024}

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


def download_medsl() -> Path:
    """Download MEDSL House returns CSV if not already cached."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if MEDSL_CACHE.exists():
        size_mb = MEDSL_CACHE.stat().st_size / (1024 * 1024)
        log.info("Using cached MEDSL file (%s, %.1f MB)", MEDSL_CACHE, size_mb)
        return MEDSL_CACHE

    log.info("Downloading MEDSL House returns from Harvard Dataverse ...")
    # Harvard Dataverse uses a 303 redirect to a presigned S3 URL.
    # Python's urllib sometimes fails on this redirect chain, so we
    # shell out to curl which handles it reliably.
    try:
        subprocess.run(
            ["curl", "-L", "-f", "-o", str(MEDSL_CACHE), MEDSL_URL],
            check=True, timeout=120,
            capture_output=True,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        log.error("Download failed: %s", exc)
        sys.exit(1)

    size_mb = MEDSL_CACHE.stat().st_size / (1024 * 1024)
    log.info("Saved %s (%.1f MB)", MEDSL_CACHE, size_mb)
    return MEDSL_CACHE


# Column indices in the MEDSL CSV (0-based, matching the header)
# year,state,state_po,state_fips,state_cen,state_ic,office,district,
# stage,runoff,special,candidate,party,writein,mode,candidatevotes,
# totalvotes,unofficial,version,fusion_ticket
COL_YEAR = 0
COL_STATE_PO = 2
COL_DISTRICT = 7
COL_STAGE = 8
COL_RUNOFF = 9
COL_SPECIAL = 10
COL_TOTALVOTES = 16


def parse_medsl(csv_path: Path) -> dict[tuple[int, str], int | None]:
    """
    Parse MEDSL CSV and return {(year, district_code): total_votes}
    for 2022 and 2024 general elections.

    The CSV has a normal header row, but each subsequent data row is wrapped
    in a single pair of double-quotes. We strip those before splitting.
    """
    log.info("Parsing MEDSL CSV ...")
    lines = csv_path.read_text(encoding="utf-8").splitlines()

    if not lines:
        log.error("MEDSL CSV is empty")
        sys.exit(1)

    # Skip header line
    header = lines[0]
    log.info("Header: %s", header[:120])

    # {(year, state_po, district): totalvotes}  -- used for dedup
    seen: dict[tuple[int, str, str], int] = {}
    parsed_rows = 0
    skipped_rows = 0

    for line in lines[1:]:
        # Strip the outer quotes that wrap each data row
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('"') and stripped.endswith('"'):
            stripped = stripped[1:-1]

        parts = stripped.split(",")
        if len(parts) < 17:
            skipped_rows += 1
            continue

        # Filter by year
        try:
            year = int(parts[COL_YEAR])
        except ValueError:
            skipped_rows += 1
            continue
        if year not in YEARS_OF_INTEREST:
            continue

        # Filter: stage=GEN, special=FALSE, runoff=FALSE
        stage = parts[COL_STAGE].strip()
        special = parts[COL_SPECIAL].strip()
        runoff = parts[COL_RUNOFF].strip()

        if stage != "GEN" or special != "FALSE" or runoff != "FALSE":
            continue

        state_po = parts[COL_STATE_PO].strip()
        raw_district = parts[COL_DISTRICT].strip()

        # Map district code
        if raw_district == "0":
            dc = f"{state_po}-AL"
        else:
            try:
                dc = f"{state_po}-{int(raw_district)}"
            except ValueError:
                skipped_rows += 1
                continue

        try:
            totalvotes = int(parts[COL_TOTALVOTES])
        except ValueError:
            skipped_rows += 1
            continue

        # Sentinel: -1 or 0 means no valid vote total (uncontested / missing)
        if totalvotes <= 0:
            totalvotes = None

        # Deduplicate: totalvotes is the same for every candidate row in a race
        key = (year, state_po, dc)
        if key not in seen:
            seen[key] = totalvotes
            parsed_rows += 1

    log.info(
        "MEDSL: %d unique (year, district) combos from %d candidate rows; "
        "%d rows skipped",
        len(seen), parsed_rows, skipped_rows,
    )

    # Collapse to {(year, district_code): totalvotes}
    result: dict[tuple[int, str], int | None] = {}
    for (year, _state_po, dc), votes in seen.items():
        result[(year, dc)] = votes

    return result


def fetch_cvap(api_key: str) -> dict[str, int]:
    """
    Fetch Citizen Voting-Age Population (B29001_001E) from ACS 2023 5-Year
    for all congressional districts. Returns {district_code: cvap}.
    """
    url = (
        f"{ACS_BASE}?get={CVAP_VAR}"
        f"&for=congressional%20district:*&in=state:*&key={api_key}"
    )
    log.info("Fetching CVAP (B29001_001E) from Census API ...")
    req = Request(url)
    try:
        with urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        log.error("Census API request failed: %s", exc)
        sys.exit(1)

    log.info("Received %d rows (including header)", len(data))

    header = data[0]
    col = {name: idx for idx, name in enumerate(header)}

    result: dict[str, int] = {}
    skipped = 0

    for row in data[1:]:
        state_fips = row[col["state"]]
        cd_num = row[col["congressional district"]]
        state = FIPS_TO_STATE.get(state_fips)
        if state is None:
            skipped += 1
            continue

        # District code mapping
        if cd_num == "00":
            dc = f"{state}-AL"
        elif cd_num == "98":
            dc = f"{state}-98"
        else:
            try:
                dc = f"{state}-{int(cd_num)}"
            except ValueError:
                skipped += 1
                continue

        raw_val = row[col[CVAP_VAR]]
        try:
            cvap = int(float(raw_val))
        except (ValueError, TypeError):
            skipped += 1
            continue

        if cvap < 0:
            # Census sentinel value
            skipped += 1
            continue

        result[dc] = cvap

    log.info("CVAP: %d districts parsed, %d skipped", len(result), skipped)
    return result


def compute_turnout(
    votes: dict[tuple[int, str], int | None],
    cvap: dict[str, int],
) -> dict[str, dict]:
    """
    Compute turnout fields for each district.
    Returns {district_code: {total_votes_2022, total_votes_2024,
                             turnout_rate_2022, turnout_rate_2024}}.
    """
    # Gather all district codes that appear in either year
    all_dcs = set()
    for (year, dc) in votes:
        all_dcs.add(dc)
    for dc in cvap:
        all_dcs.add(dc)

    results: dict[str, dict] = {}

    for dc in sorted(all_dcs):
        v2022 = votes.get((2022, dc))
        v2024 = votes.get((2024, dc))
        pop = cvap.get(dc)

        # Only include districts that have at least one vote count
        if v2022 is None and v2024 is None:
            continue

        tr2022 = None
        tr2024 = None
        if pop and pop > 0:
            if v2022 is not None:
                tr2022 = round(v2022 / pop * 100, 1)
            if v2024 is not None:
                tr2024 = round(v2024 / pop * 100, 1)

        results[dc] = {
            "total_votes_2022": v2022,
            "total_votes_2024": v2024,
            "turnout_rate_2022": tr2022,
            "turnout_rate_2024": tr2024,
        }

    log.info("Turnout computed for %d districts", len(results))
    return results


def validate_and_log(turnout_data: dict[str, dict]) -> None:
    """Log min/median/max for each turnout field and warn about nulls."""
    fields = [
        "total_votes_2022", "total_votes_2024",
        "turnout_rate_2022", "turnout_rate_2024",
    ]
    for field in fields:
        values = [d[field] for d in turnout_data.values() if d[field] is not None]
        nulls = sum(1 for d in turnout_data.values() if d[field] is None)
        if not values:
            log.warning("  %s: ALL VALUES NULL", field)
            continue
        lo = min(values)
        hi = max(values)
        med = round(statistics.median(values), 1)
        log.info(
            "  %-22s  n=%3d  null=%2d  min=%12s  median=%12s  max=%12s",
            field, len(values), nulls,
            f"{lo:,.1f}", f"{med:,.1f}", f"{hi:,.1f}",
        )

        # Sanity checks
        if "turnout_rate" in field and hi > 100:
            log.warning("  %s has value > 100%%: max=%.1f", field, hi)


def merge_into_meta(turnout_data: dict[str, dict]) -> int:
    """Merge turnout fields into districts-meta.json. Returns count of matched districts."""
    log.info("Reading %s ...", META_FILE)
    meta = json.loads(META_FILE.read_text())
    districts = meta["districts"]

    matched = 0
    unmatched = []

    for dc, fields in turnout_data.items():
        if dc in districts:
            districts[dc].update(fields)
            matched += 1
        else:
            unmatched.append(dc)

    missing = [dc for dc in districts if dc not in turnout_data]

    log.info("Matched %d / %d districts in meta", matched, len(districts))
    if unmatched:
        log.info(
            "Turnout districts not in meta (%d): %s",
            len(unmatched), unmatched[:10],
        )
    if missing:
        log.info(
            "Meta districts missing turnout (%d): %s",
            len(missing), missing[:10],
        )

    log.info("Writing updated %s ...", META_FILE)
    META_FILE.write_text(json.dumps(meta, separators=(",", ":")))
    return matched


def update_sources() -> None:
    """Add/update turnout source entries and fieldMap entries in sources.json."""
    log.info("Updating %s ...", SOURCES_FILE)
    sources = json.loads(SOURCES_FILE.read_text())
    today = date.today().isoformat()

    # --- Source entries ---
    new_sources = {
        "medsl_house_2022": {
            "name": "U.S. House Returns 2022 (MEDSL)",
            "provider": "MIT Election Data + Science Lab (MEDSL), Harvard Dataverse",
            "url": "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2",
            "vintage": "2022",
            "retrieved": today,
            "description": "Total votes cast in 2022 U.S. House general elections by congressional district",
        },
        "medsl_house_2024": {
            "name": "U.S. House Returns 2024 (MEDSL)",
            "provider": "MIT Election Data + Science Lab (MEDSL), Harvard Dataverse",
            "url": "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2",
            "vintage": "2024",
            "retrieved": today,
            "description": "Total votes cast in 2024 U.S. House general elections by congressional district",
        },
        "acs5_2023_b29001": {
            "name": "Citizen Voting-Age Population (B29001)",
            "provider": "U.S. Census Bureau, American Community Survey 5-Year Estimates",
            "url": "https://api.census.gov/data/2023/acs/acs5",
            "vintage": "2023 (2019-2023)",
            "retrieved": today,
            "variable": "B29001_001E",
            "geography": "Congressional District (118th Congress)",
            "description": "Total citizen voting-age population (18+) used as the denominator for district-level turnout rates",
        },
    }

    for key, entry in new_sources.items():
        sources["sources"][key] = entry
        log.info("  source: %s  retrieved -> %s", key, today)

    # --- Field map entries ---
    new_fields = {
        "total_votes_2022": "medsl_house_2022",
        "total_votes_2024": "medsl_house_2024",
        "turnout_rate_2022": "medsl_house_2022",
        "turnout_rate_2024": "medsl_house_2024",
    }

    for field, source_key in new_fields.items():
        sources["fieldMap"][field] = source_key
        log.info("  fieldMap: %s -> %s", field, source_key)

    SOURCES_FILE.write_text(json.dumps(sources, indent=2) + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    log.info("=" * 60)
    log.info("pull_district_turnout.py — Voter turnout (2022 + 2024)")
    log.info("=" * 60)

    api_key = read_api_key()
    log.info("Census API key loaded (%s...)", api_key[:8])

    # Step 1: Download / load MEDSL data
    csv_path = download_medsl()

    # Step 2: Parse MEDSL for 2022 + 2024 House general election totals
    votes = parse_medsl(csv_path)
    log.info(
        "Vote totals: %d entries for 2022, %d for 2024",
        sum(1 for (y, _) in votes if y == 2022),
        sum(1 for (y, _) in votes if y == 2024),
    )

    # Step 3: Fetch CVAP from Census
    cvap = fetch_cvap(api_key)

    # Step 4: Compute turnout
    turnout_data = compute_turnout(votes, cvap)

    # Step 5: Validate
    log.info("Validation summary:")
    validate_and_log(turnout_data)

    # Step 6: Merge into districts-meta.json
    matched = merge_into_meta(turnout_data)

    # Step 7: Update sources.json
    update_sources()

    log.info("Done. %d districts enriched with turnout data.", matched)


if __name__ == "__main__":
    main()
