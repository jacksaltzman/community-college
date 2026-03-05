#!/usr/bin/env python3
"""
pull_house_committees.py
Pull House committee assignments from the Clerk of the House XML feed
and merge them into districts-meta.json.

Source: https://clerk.house.gov/xml/lists/MemberData.xml
"""

import json
import logging
import sys
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
META_FILE = PROJECT_ROOT / "app" / "public" / "data" / "districts-meta.json"
SOURCES_FILE = PROJECT_ROOT / "app" / "public" / "data" / "sources.json"

MEMBER_DATA_URL = "https://clerk.house.gov/xml/lists/MemberData.xml"

STATE_ABBRS = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI",
    "WY", "AS", "GU", "MP", "PR", "VI",
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
def fetch_xml() -> ET.Element:
    """Fetch and parse the House MemberData XML."""
    log.info("Fetching %s ...", MEMBER_DATA_URL)
    req = Request(MEMBER_DATA_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(req, timeout=60) as resp:
            xml_bytes = resp.read()
    except (HTTPError, URLError) as exc:
        log.error("Failed to fetch MemberData XML: %s", exc)
        sys.exit(1)
    log.info("Received %d bytes", len(xml_bytes))
    return ET.fromstring(xml_bytes)


def build_committee_names(root: ET.Element) -> dict[str, str]:
    """Build comcode → short name mapping from the <committees> section."""
    lookup = {}
    comms_section = root.find("committees")
    if comms_section is None:
        log.warning("No <committees> section found in XML")
        return lookup

    for comm in comms_section.findall("committee"):
        code = comm.get("comcode", "")
        fullname_el = comm.find("committee-fullname")
        if fullname_el is not None and fullname_el.text:
            # Strip "Committee on " prefix for brevity
            name = fullname_el.text.strip()
            name = name.removeprefix("Committee on ")
            if name.startswith("the "):
                name = name[4:]
            lookup[code] = name

    log.info("Built name lookup for %d committees", len(lookup))
    return lookup


TERRITORIES = {"DC", "AS", "GU", "MP", "PR", "VI"}

def parse_district_code(statedistrict: str) -> str | None:
    """Convert 'AL01' / 'AK00' format to our 'AL-1' / 'AK-AL' / 'DC-98' format."""
    if len(statedistrict) < 4:
        return None
    state = statedistrict[:2].upper()
    dist = statedistrict[2:]
    if state not in STATE_ABBRS:
        return None
    if dist == "00":
        # Territories use -98 in our data; states use -AL
        if state in TERRITORIES:
            return f"{state}-98"
        return f"{state}-AL"
    try:
        num = int(dist)
        return f"{state}-{num}"
    except ValueError:
        return None


def parse_committees(root: ET.Element, name_lookup: dict[str, str]) -> dict[str, list[str]]:
    """
    Parse XML to extract committee assignments per district.
    Returns {district_code: [committee_name, ...]}.
    """
    district_committees: dict[str, list[str]] = {}

    members_section = root.find("members")
    if members_section is None:
        log.warning("No <members> section found in XML")
        return district_committees

    for member in members_section.findall("member"):
        # Get district from <statedistrict> element
        sd_el = member.find("statedistrict")
        if sd_el is None or not sd_el.text:
            continue

        dc = parse_district_code(sd_el.text.strip())
        if dc is None:
            continue

        # Get committee assignments
        ca = member.find("committee-assignments")
        if ca is None:
            continue

        committees = []
        for comm in ca.findall("committee"):
            comcode = comm.get("comcode", "")
            name = name_lookup.get(comcode)
            if name:
                committees.append(name)

        if committees:
            district_committees[dc] = committees

    return district_committees


def merge_into_meta(committee_data: dict[str, list[str]]) -> int:
    """Merge committee assignments into districts-meta.json."""
    log.info("Reading %s ...", META_FILE)
    meta = json.loads(META_FILE.read_text())
    districts = meta["districts"]

    matched = 0
    unmatched = []

    for dc, committees in committee_data.items():
        if dc in districts:
            districts[dc]["committees"] = ", ".join(committees)
            matched += 1
        else:
            unmatched.append(dc)

    # Districts in meta but missing committee data
    missing = [dc for dc in districts if "committees" not in districts[dc]]

    log.info("Matched %d / %d districts", matched, len(districts))
    if unmatched:
        log.info("Committee districts not in meta (%d): %s", len(unmatched), unmatched[:10])
    if missing:
        log.info("Meta districts without committees (%d): %s", len(missing), missing[:10])

    log.info("Writing updated %s ...", META_FILE)
    META_FILE.write_text(json.dumps(meta, separators=(",", ":")))
    return matched


def update_sources() -> None:
    """Add/update the house_committees source entry."""
    log.info("Updating %s ...", SOURCES_FILE)
    sources = json.loads(SOURCES_FILE.read_text())
    today = date.today().isoformat()

    sources["sources"]["house_committees_119"] = {
        "name": "House Committee Assignments (119th Congress)",
        "provider": "Office of the Clerk, U.S. House of Representatives",
        "url": "https://clerk.house.gov/xml/lists/MemberData.xml",
        "vintage": "119th Congress (2025-2027)",
        "retrieved": today,
        "description": "Standing committee assignments for each House member",
    }

    if "house_committees" not in sources["fieldMap"]:
        sources["fieldMap"]["house_committees"] = "house_committees_119"

    SOURCES_FILE.write_text(json.dumps(sources, indent=2) + "\n")
    log.info("  house_committees_119  retrieved → %s", today)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    log.info("=" * 60)
    log.info("pull_house_committees.py — House committee assignments")
    log.info("=" * 60)

    root = fetch_xml()

    name_lookup = build_committee_names(root)
    for code, name in sorted(name_lookup.items()):
        log.info("  %s → %s", code, name)

    committee_data = parse_committees(root, name_lookup)
    log.info("Parsed committees for %d districts", len(committee_data))

    # Stats
    counts = [len(v) for v in committee_data.values()]
    if counts:
        log.info("  Committees per member: min=%d, max=%d, avg=%.1f",
                 min(counts), max(counts), sum(counts) / len(counts))

    # Examples
    for dc, comms in list(committee_data.items())[:3]:
        log.info("  Example: %s → %s", dc, ", ".join(comms))

    matched = merge_into_meta(committee_data)
    update_sources()

    log.info("Done. %d districts enriched with committee data.", matched)


if __name__ == "__main__":
    main()
