#!/usr/bin/env python3
"""
pull_winner_margins.py
Parse the cached MEDSL House returns CSV to compute winner margins
(votes and percentage) for 2022 and 2024, then derive a Coalition
Threshold for each district and merge everything into districts-meta.json.

Fields produced:
  - winner_margin_2022     : vote difference between 1st and 2nd place (int)
  - winner_margin_pct_2022 : margin as % of total votes (float, 1 decimal)
  - winner_margin_2024     : same for 2024
  - winner_margin_pct_2024 : same for 2024
  - coalition_threshold    : estimated # of organized users needed to
                             influence the representative (int)
"""

import json
import logging
import statistics
import sys
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
META_FILE = PROJECT_ROOT / "app" / "public" / "data" / "districts-meta.json"
SOURCES_FILE = PROJECT_ROOT / "app" / "public" / "data" / "sources.json"
MEDSL_CACHE = PROJECT_ROOT / "data" / "medsl_house_1976_2024.csv"

YEARS_OF_INTEREST = {2022, 2024}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# Column indices in the MEDSL CSV (0-based)
COL_YEAR = 0
COL_STATE_PO = 2
COL_DISTRICT = 7
COL_STAGE = 8
COL_RUNOFF = 9
COL_SPECIAL = 10
COL_CANDIDATE = 11
COL_PARTY = 12
COL_WRITEIN = 13
COL_CANDIDATEVOTES = 15
COL_TOTALVOTES = 16


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
def parse_candidate_votes(csv_path: Path) -> dict:
    """
    Parse MEDSL CSV and return per-candidate votes for 2022+2024.
    Returns {(year, district_code): [(candidate, party, cand_votes, total_votes), ...]}
    """
    log.info("Parsing MEDSL CSV for candidate-level votes ...")
    lines = csv_path.read_text(encoding="utf-8").splitlines()

    if not lines:
        log.error("MEDSL CSV is empty")
        sys.exit(1)

    races: dict[tuple[int, str], list] = {}
    skipped = 0

    for line in lines[1:]:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('"') and stripped.endswith('"'):
            stripped = stripped[1:-1]

        parts = stripped.split(",")
        if len(parts) < 17:
            skipped += 1
            continue

        try:
            year = int(parts[COL_YEAR])
        except ValueError:
            skipped += 1
            continue
        if year not in YEARS_OF_INTEREST:
            continue

        # Only general elections, no specials or runoffs
        if parts[COL_STAGE] != "GEN" or parts[COL_SPECIAL] != "FALSE" or parts[COL_RUNOFF] != "FALSE":
            continue

        # Skip write-ins (they inflate candidate count without meaningful vote share)
        if parts[COL_WRITEIN] == "TRUE":
            continue

        state_po = parts[COL_STATE_PO].strip()
        raw_district = parts[COL_DISTRICT].strip()

        if raw_district == "0":
            dc = f"{state_po}-AL"
        else:
            try:
                dc = f"{state_po}-{int(raw_district)}"
            except ValueError:
                skipped += 1
                continue

        try:
            cand_votes = int(parts[COL_CANDIDATEVOTES])
        except ValueError:
            skipped += 1
            continue

        try:
            total_votes = int(parts[COL_TOTALVOTES])
        except ValueError:
            total_votes = None

        candidate = parts[COL_CANDIDATE].strip()
        party = parts[COL_PARTY].strip()

        key = (year, dc)
        if key not in races:
            races[key] = []
        races[key].append((candidate, party, cand_votes, total_votes))

    log.info("Parsed %d races across 2022+2024 (%d rows skipped)", len(races), skipped)
    return races


def compute_margins(races: dict) -> dict[str, dict]:
    """
    For each race, find the top-2 vote-getters and compute margin.
    Returns {district_code: {winner_margin_YYYY, winner_margin_pct_YYYY, ...}}
    """
    all_districts: dict[str, dict] = {}

    for (year, dc), candidates in races.items():
        # Sort candidates by votes descending
        sorted_cands = sorted(candidates, key=lambda c: c[2], reverse=True)

        if len(sorted_cands) < 1:
            continue

        winner_votes = sorted_cands[0][2]
        total_votes = sorted_cands[0][3]

        if len(sorted_cands) >= 2:
            runner_up_votes = sorted_cands[1][2]
            margin_votes = winner_votes - runner_up_votes
        else:
            # Uncontested: margin = all votes
            margin_votes = winner_votes

        margin_pct = None
        if total_votes and total_votes > 0:
            margin_pct = round(margin_votes / total_votes * 100, 1)

        if dc not in all_districts:
            all_districts[dc] = {}

        all_districts[dc][f"winner_margin_{year}"] = margin_votes
        all_districts[dc][f"winner_margin_pct_{year}"] = margin_pct

    log.info("Computed margins for %d districts", len(all_districts))
    return all_districts


# ---------------------------------------------------------------------------
# Coalition Threshold
# ---------------------------------------------------------------------------
def compute_coalition_thresholds(
    margin_data: dict[str, dict],
    meta_districts: dict,
) -> dict[str, int]:
    """
    Compute Coalition Threshold: the estimated number of organized users
    needed to influence the representative.

    Formula:
      threshold = winner_margin_votes × coefficient

    Where coefficient scales with competitiveness:
      margin_pct < 5%   → 0.05  (very competitive — small bloc matters)
      margin_pct 5–15%  → 0.10  (competitive)
      margin_pct 15–30% → 0.15  (leaning safe)
      margin_pct > 30%  → 0.20  (safe — need larger bloc)

    Floor: 500 users (minimum to be taken seriously)
    Uses 2024 data primarily, 2022 as fallback.
    """
    thresholds: dict[str, int] = {}

    for dc in margin_data:
        # Prefer 2024 data, fall back to 2022
        margin_votes = margin_data[dc].get("winner_margin_2024")
        margin_pct = margin_data[dc].get("winner_margin_pct_2024")

        if margin_votes is None:
            margin_votes = margin_data[dc].get("winner_margin_2022")
            margin_pct = margin_data[dc].get("winner_margin_pct_2022")

        if margin_votes is None:
            continue

        # Determine coefficient based on competitiveness
        if margin_pct is not None:
            if margin_pct < 5:
                coeff = 0.05
            elif margin_pct < 15:
                coeff = 0.10
            elif margin_pct < 30:
                coeff = 0.15
            else:
                coeff = 0.20
        else:
            coeff = 0.10  # default if no percentage available

        raw = margin_votes * coeff
        threshold = max(500, round(raw / 100) * 100)  # round to nearest 100, floor 500
        thresholds[dc] = threshold

    log.info("Coalition thresholds computed for %d districts", len(thresholds))

    # Stats
    vals = list(thresholds.values())
    if vals:
        log.info(
            "  min=%s  median=%s  max=%s  mean=%s",
            f"{min(vals):,}",
            f"{int(statistics.median(vals)):,}",
            f"{max(vals):,}",
            f"{int(statistics.mean(vals)):,}",
        )

    return thresholds


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------
def merge_into_meta(margin_data: dict[str, dict], thresholds: dict[str, int]) -> int:
    """Merge margin + coalition threshold fields into districts-meta.json."""
    log.info("Reading %s ...", META_FILE)
    meta = json.loads(META_FILE.read_text())
    districts = meta["districts"]

    matched = 0
    unmatched = []

    for dc, fields in margin_data.items():
        if dc in districts:
            districts[dc].update(fields)
            if dc in thresholds:
                districts[dc]["coalition_threshold"] = thresholds[dc]
            matched += 1
        else:
            unmatched.append(dc)

    missing = [dc for dc in districts if dc not in margin_data]

    log.info("Matched %d / %d districts in meta", matched, len(districts))
    if unmatched:
        log.info("Margin districts not in meta (%d): %s", len(unmatched), unmatched[:10])
    if missing:
        log.info("Meta districts missing margins (%d): %s", len(missing), missing[:10])

    log.info("Writing updated %s ...", META_FILE)
    META_FILE.write_text(json.dumps(meta, separators=(",", ":")))
    return matched


def update_sources() -> None:
    """Add margin + coalition_threshold field map entries."""
    log.info("Updating %s ...", SOURCES_FILE)
    sources = json.loads(SOURCES_FILE.read_text())

    new_fields = {
        "winner_margin_2022": "medsl_house_2022",
        "winner_margin_pct_2022": "medsl_house_2022",
        "winner_margin_2024": "medsl_house_2024",
        "winner_margin_pct_2024": "medsl_house_2024",
        "coalition_threshold": "medsl_house_2024",
    }

    # Add a derived source entry for coalition threshold
    sources["sources"]["derived_coalition_threshold"] = {
        "name": "Derived: Coalition Threshold",
        "provider": "Accountable (computed from MEDSL election returns)",
        "vintage": "2024 (2022 fallback)",
        "description": (
            "Estimated number of organized users needed to influence a district's "
            "representative. Computed as winner_margin × coefficient (0.05–0.20 "
            "based on competitiveness), with a floor of 500."
        ),
    }

    new_fields["coalition_threshold"] = "derived_coalition_threshold"

    for field, source_key in new_fields.items():
        sources["fieldMap"][field] = source_key
        log.info("  fieldMap: %s -> %s", field, source_key)

    SOURCES_FILE.write_text(json.dumps(sources, indent=2) + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    log.info("=" * 60)
    log.info("pull_winner_margins.py — Winner margins + Coalition Threshold")
    log.info("=" * 60)

    if not MEDSL_CACHE.exists():
        log.error("MEDSL cache not found at %s", MEDSL_CACHE)
        log.error("Run pull_district_turnout.py first to download the data.")
        sys.exit(1)

    # Step 1: Parse candidate-level votes
    races = parse_candidate_votes(MEDSL_CACHE)

    # Stats
    for year in sorted(YEARS_OF_INTEREST):
        n = sum(1 for (y, _) in races if y == year)
        log.info("  %d races in %d", n, year)

    # Step 2: Compute margins
    margin_data = compute_margins(races)

    # Validation
    for year in sorted(YEARS_OF_INTEREST):
        field = f"winner_margin_pct_{year}"
        vals = [d[field] for d in margin_data.values() if d.get(field) is not None]
        if vals:
            log.info(
                "  %s: n=%d  min=%.1f%%  median=%.1f%%  max=%.1f%%",
                field, len(vals), min(vals), statistics.median(vals), max(vals),
            )

    # Examples
    for dc in ["VA-7", "CO-8", "NY-14", "TX-1", "CA-12"]:
        if dc in margin_data:
            d = margin_data[dc]
            log.info("  Example %s: %s", dc, d)

    # Step 3: Read meta for coalition threshold computation
    meta = json.loads(META_FILE.read_text())

    # Step 4: Compute coalition thresholds
    thresholds = compute_coalition_thresholds(margin_data, meta["districts"])

    # Examples
    for dc in ["VA-7", "CO-8", "NY-14", "TX-1", "CA-12"]:
        if dc in thresholds:
            margin = margin_data[dc].get("winner_margin_2024") or margin_data[dc].get("winner_margin_2022")
            pct = margin_data[dc].get("winner_margin_pct_2024") or margin_data[dc].get("winner_margin_pct_2022")
            log.info(
                "  %s: margin=%s (%.1f%%) → threshold=%s",
                dc, f"{margin:,}", pct or 0, f"{thresholds[dc]:,}",
            )

    # Step 5: Merge into districts-meta.json
    matched = merge_into_meta(margin_data, thresholds)

    # Step 6: Update sources.json
    update_sources()

    log.info("Done. %d districts enriched with margins + coalition threshold.", matched)


if __name__ == "__main__":
    main()
