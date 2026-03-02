"""
Pipeline: Map every U.S. community-college commute-shed onto
congressional-district boundaries and produce an Excel workbook
with Detail, Summary, and Validation sheets.
"""

# ── Standard library ────────────────────────────────────────────
import io
import logging
import math
import zipfile
from pathlib import Path

# ── Third-party ─────────────────────────────────────────────────
import geopandas as gpd
import pandas as pd
import pyproj
import requests
import shapely
from openpyxl import Workbook

# ── Logging setup ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Path constants ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent        # Students Per District/
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
# ── URL constants ───────────────────────────────────────────────
IPEDS_HD2023_URL = (
    "https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip"
)
IPEDS_EFFY2023_URL = (
    "https://nces.ed.gov/ipeds/datacenter/data/EFFY2023.zip"
)
CD118_SHAPEFILE_URL = (
    "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_cd118_500k.zip"
)

# ── NPSAS:20 P75 radius by NCES locale code (retrieval code: swopse) ──
LOCALE_RADIUS = {
    11: 15,   # City Large
    12: 19,   # City Midsize
    13: 25,   # City Small (conservative; raw P75=35 unstable)
    21: 15,   # Suburb Large
    22: 22,   # Suburb Midsize
    23: 22,   # Suburb Small
    31: 39,   # Town Fringe
    32: 44,   # Town Distant
    33: 58,   # Town Remote
    41: 27,   # Rural Fringe
    42: 37,   # Rural Distant
    43: 55,   # Rural Remote
}

LOCALE_LABEL = {
    11: "Large City",
    12: "Midsize City",
    13: "Small City",
    21: "Large City",
    22: "Suburban",
    23: "Suburban",
    31: "Town / Remote",
    32: "Town / Remote",
    33: "Town / Remote",
    41: "Rural",
    42: "Rural",
    43: "Town / Remote",
}

FALLBACK_RADIUS = 22
FALLBACK_LABEL = "Suburban"

# ── Projection CRS constants ───────────────────────────────────
CRS_CONUS = "EPSG:5070"      # Albers Equal-Area for CONUS
CRS_ALASKA = "EPSG:3338"     # Alaska Albers
CRS_HAWAII = "ESRI:102007"   # Hawaii Albers Equal-Area Conic

# ── FIPS code → state abbreviation mapping ────────────────────────
FIPS_TO_STATE = {
    "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
    "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
    "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
    "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
    "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
    "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
    "54":"WV","55":"WI","56":"WY","60":"AS","66":"GU","69":"MP","72":"PR","78":"VI",
}


# ====================================================================
#  Pipeline steps (stubs)
# ====================================================================

def download_ipeds_data() -> None:
    """Download HD2023 and EFFY2023 IPEDS data files."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    files_to_download = [
        (IPEDS_HD2023_URL, "hd2023.csv", "HD2023"),
        (IPEDS_EFFY2023_URL, "effy2023.csv", "EFFY2023"),
    ]

    for url, csv_name, label in files_to_download:
        csv_path = DATA_DIR / csv_name
        if csv_path.exists():
            log.info(f"{label}: {csv_path} already exists, skipping download")
        else:
            log.info(f"{label}: Downloading from {url}")
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                # The CSV inside the zip is lowercase
                inner_name = csv_name  # e.g. hd2023.csv
                # Find the matching file (case-insensitive) inside the zip
                match = [n for n in zf.namelist() if n.lower() == inner_name.lower()]
                if not match:
                    raise FileNotFoundError(
                        f"Could not find {inner_name} inside {url}; "
                        f"zip contains: {zf.namelist()}"
                    )
                # Extract the matched file, writing to the expected lowercase name
                with zf.open(match[0]) as src, open(csv_path, "wb") as dst:
                    dst.write(src.read())
            log.info(f"{label}: Extracted to {csv_path}")

        # Log file size and row count
        size_mb = csv_path.stat().st_size / (1024 * 1024)
        row_count = sum(1 for _ in open(csv_path, encoding="latin-1")) - 1
        log.info(f"{label}: {size_mb:.1f} MB, {row_count:,} rows")


def download_cd_shapefile() -> None:
    """Download the 118th-Congress congressional-district shapefile."""
    cd_dir = DATA_DIR / "cd118"
    cd_dir.mkdir(parents=True, exist_ok=True)

    # Check if .shp already exists
    shp_files = list(cd_dir.glob("*.shp"))
    if shp_files:
        log.info(f"CD shapefile already exists: {shp_files[0]}, skipping download")
    else:
        log.info(f"Downloading CD shapefile from {CD118_SHAPEFILE_URL}")
        resp = requests.get(CD118_SHAPEFILE_URL, timeout=120)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            zf.extractall(cd_dir)
        log.info(f"Extracted CD shapefile to {cd_dir}")
        shp_files = list(cd_dir.glob("*.shp"))

    # Load and log district count
    if shp_files:
        gdf = gpd.read_file(shp_files[0])
        log.info(f"CD shapefile: {len(gdf)} congressional districts loaded")


def build_campus_list() -> gpd.GeoDataFrame:
    """Build the filtered list of community-college campuses from IPEDS.

    Returns
    -------
    gpd.GeoDataFrame
        One row per campus with Point geometry (EPSG:4326), enrollment,
        and institutional metadata columns.
    """
    # ── 1. Load HD2023 (institutional characteristics) ────────────
    hd_path = DATA_DIR / "hd2023.csv"
    hd = pd.read_csv(hd_path, encoding="latin-1")
    # Strip BOM from column names (latin-1 doesn't auto-strip UTF-8 BOM)
    hd.columns = [c.lstrip("\ufeff").lstrip("ï»¿") for c in hd.columns]
    log.info(f"HD2023 loaded: {len(hd):,} institutions")

    # ── 2. Filter to community colleges (three groups) ─────────────
    #   Group 1: SECTOR 4 = public 2-year (traditional CCs)
    #   Group 2: SECTOR 5 = private not-for-profit 2-year
    #   Group 3: SECTOR 1 + HLOFFER 5 = reclassified CCs now granting bachelor's
    group_1 = hd["SECTOR"] == 4
    group_2 = hd["SECTOR"] == 5
    group_3 = (hd["SECTOR"] == 1) & (hd["HLOFFER"] == 5)
    hd = hd[group_1 | group_2 | group_3].copy()
    log.info(
        f"After CC filter: {len(hd):,} campuses "
        f"(sector 4: {group_1.sum()}, sector 5: {group_2.sum()}, "
        f"sector 1 + HLOFFER=5: {group_3.sum()})"
    )

    # ── 3. Drop rows with missing/zero coordinates ────────────────
    hd = hd[
        hd["LATITUDE"].notna()
        & (hd["LATITUDE"] != 0)
        & hd["LONGITUD"].notna()
        & (hd["LONGITUD"] != 0)
    ].copy()
    log.info(f"After dropping null/zero coords: {len(hd):,} campuses")

    # ── 4. Load EFFY2023 (enrollment) ─────────────────────────────
    effy_path = DATA_DIR / "effy2023.csv"
    effy = pd.read_csv(effy_path, encoding="latin-1")
    # Strip BOM from column names
    effy.columns = [c.lstrip("\ufeff").lstrip("ï»¿") for c in effy.columns]
    log.info(f"EFFY2023 loaded: {len(effy):,} rows")

    # Filter to all-students total (EFFYLEV == 1, LSTUDY == 999)
    effy = effy[(effy["EFFYLEV"] == 1) & (effy["LSTUDY"] == 999)].copy()
    log.info(f"EFFY after EFFYLEV=1, LSTUDY=999 filter: {len(effy):,} rows")

    # Keep only needed columns
    effy = effy[["UNITID", "EFYTOTLT"]]

    # ── 5. Left-join enrollment onto campus list ──────────────────
    campuses = hd.merge(effy, on="UNITID", how="left")

    # ── 6. Rename columns to output spec ──────────────────────────
    rename_map = {
        "UNITID":   "ipeds_unitid",
        "INSTNM":   "institution_name",
        "CITY":     "campus_city",
        "STABBR":   "campus_state",
        "LATITUDE": "campus_lat",
        "LONGITUD": "campus_lon",
        "EFYTOTLT": "total_enrollment",
        "LOCALE":   "locale_code",
    }
    campuses = campuses.rename(columns=rename_map)

    # Keep only the columns we care about
    keep_cols = list(rename_map.values())
    campuses = campuses[keep_cols].copy()

    # ── 7. Build GeoDataFrame with Point geometry ─────────────────
    geometry = gpd.points_from_xy(campuses["campus_lon"], campuses["campus_lat"])
    campuses = gpd.GeoDataFrame(campuses, geometry=geometry, crs="EPSG:4326")

    # ── 8. Summary logging ────────────────────────────────────────
    n_states = campuses["campus_state"].nunique()
    states_list = sorted(campuses["campus_state"].unique())
    enroll = campuses["total_enrollment"].dropna()

    log.info(f"Campus list built: {len(campuses):,} campuses")
    log.info(f"States represented: {n_states} — {', '.join(states_list)}")
    if len(enroll) > 0:
        log.info(
            f"Enrollment range: min={enroll.min():,.0f}, "
            f"max={enroll.max():,.0f}, median={enroll.median():,.0f}"
        )
    else:
        log.warning("No enrollment data joined — EFYTOTLT column is all null")

    null_geom = campuses.geometry.is_empty.sum() + campuses.geometry.isna().sum()
    log.info(f"Null/empty geometries: {null_geom}")

    return campuses


def classify_campuses(campuses: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Classify each campus by NCES locale code and assign P75 radius.

    Uses NPSAS:20 75th-percentile student-to-campus distance by locale.
    """
    def _assign(locale_code):
        try:
            lc = int(locale_code)
        except (TypeError, ValueError):
            return FALLBACK_LABEL, FALLBACK_RADIUS
        label = LOCALE_LABEL.get(lc, FALLBACK_LABEL)
        radius = LOCALE_RADIUS.get(lc, FALLBACK_RADIUS)
        return label, radius

    results = campuses["locale_code"].apply(_assign)
    campuses["city_type"] = [r[0] for r in results]
    campuses["radius_miles"] = [r[1] for r in results]

    log.info(f"Campus classification complete: {len(campuses):,} campuses")
    counts = campuses["city_type"].value_counts()
    for ct, n in counts.items():
        log.info(f"  {ct}: {n}")
    fallback_count = campuses["locale_code"].apply(
        lambda x: int(x) not in LOCALE_RADIUS if pd.notna(x) else True
    ).sum()
    if fallback_count:
        log.info(f"  Fallback classifications: {fallback_count}")

    return campuses


def build_circles(campuses: gpd.GeoDataFrame) -> list[tuple[str, gpd.GeoDataFrame]]:
    """Build commute-shed circles (buffers) around each campus.

    Parameters
    ----------
    campuses : gpd.GeoDataFrame
        Campus points in EPSG:4326 with ``radius_miles`` column.

    Returns
    -------
    list[tuple[str, gpd.GeoDataFrame]]
        List of (crs_name, circles_gdf) tuples — one per geographic group
        (CONUS, Alaska, Hawaii). Each GeoDataFrame has buffered circle
        polygons in the group's projected CRS. Empty groups are omitted.
    """
    MILES_TO_METERS = 1609.344

    # Split into 3 geographic groups
    ak_mask = campuses["campus_state"] == "AK"
    hi_mask = campuses["campus_state"] == "HI"
    conus_mask = ~ak_mask & ~hi_mask

    groups = [
        ("CONUS", CRS_CONUS, campuses[conus_mask].copy()),
        ("Alaska", CRS_ALASKA, campuses[ak_mask].copy()),
        ("Hawaii", CRS_HAWAII, campuses[hi_mask].copy()),
    ]

    result: list[tuple[str, gpd.GeoDataFrame]] = []
    total_circles = 0

    for label, crs, gdf in groups:
        if gdf.empty:
            log.info(f"  {label}: 0 campuses — skipping")
            continue

        # Project to the appropriate equal-area CRS
        gdf = gdf.to_crs(crs)

        # Buffer each point by radius_miles converted to meters
        gdf["geometry"] = gdf.apply(
            lambda row: row.geometry.buffer(row["radius_miles"] * MILES_TO_METERS),
            axis=1,
        )

        # Store the projected CRS name on each row
        gdf["proj_crs"] = crs

        result.append((crs, gdf))
        total_circles += len(gdf)
        log.info(f"  {label}: {len(gdf):,} circles built (CRS={crs})")

    log.info(f"Total circles built: {total_circles:,}")
    return result


def intersect_districts(circle_groups: list[tuple[str, gpd.GeoDataFrame]]) -> pd.DataFrame:
    """Intersect commute-shed circles with congressional districts.

    Parameters
    ----------
    circle_groups : list[tuple[str, gpd.GeoDataFrame]]
        Output of ``build_circles`` — list of (crs_name, circles_gdf) tuples.

    Returns
    -------
    pd.DataFrame
        Detail rows: one row per campus-district overlap, with area and
        fractional-overlap columns. Geometry is dropped.
    """
    SQ_METERS_PER_SQ_MILE = 2_589_988.11
    MIN_OVERLAP = 0.01

    # ── 1. Load the CD118 shapefile ────────────────────────────────
    cd_shp = list((DATA_DIR / "cd118").glob("*.shp"))[0]
    districts_raw = gpd.read_file(cd_shp)
    log.info(f"CD118 shapefile loaded: {len(districts_raw)} districts")

    all_detail_rows: list[dict] = []

    # ── 2. Process each geographic group ──────────────────────────
    for crs_name, circles_gdf in circle_groups:
        log.info(f"Intersecting group CRS={crs_name}: {len(circles_gdf):,} circles")

        # Project districts to the same CRS as the circles
        districts = districts_raw.to_crs(crs_name)

        # Spatial join to find candidate circle–district pairs
        joined = gpd.sjoin(circles_gdf, districts, how="inner", predicate="intersects")
        log.info(f"  Candidate pairs after sjoin: {len(joined):,}")

        # For each candidate pair, compute exact intersection area
        for idx, row in joined.iterrows():
            circle_geom = circles_gdf.loc[idx, "geometry"]
            # index_right gives us the district index in the projected districts GDF
            district_idx = row["index_right"]
            district_geom = districts.loc[district_idx, "geometry"]

            intersection_geom = circle_geom.intersection(district_geom)
            if intersection_geom.is_empty:
                continue

            area_in_circle_sqmi = intersection_geom.area / SQ_METERS_PER_SQ_MILE
            district_total_area_sqmi = district_geom.area / SQ_METERS_PER_SQ_MILE

            if district_total_area_sqmi == 0:
                continue

            fractional_overlap = round(
                area_in_circle_sqmi / district_total_area_sqmi, 4
            )

            # Build the cd_code
            statefp = str(row["STATEFP"]).zfill(2)
            cd118fp = str(row["CD118FP"]).zfill(2)
            state_abbrev = FIPS_TO_STATE.get(statefp, statefp)
            cd_number = int(cd118fp) if cd118fp.isdigit() else 0
            if cd_number == 0:
                cd_code = f"{state_abbrev}-AL"
            else:
                cd_code = f"{state_abbrev}-{cd_number}"

            all_detail_rows.append({
                "ipeds_unitid": row["ipeds_unitid"],
                "institution_name": row["institution_name"],
                "campus_city": row["campus_city"],
                "campus_state": row["campus_state"],
                "campus_lat": row["campus_lat"],
                "campus_lon": row["campus_lon"],
                "total_enrollment": row["total_enrollment"],
                "locale_code": row["locale_code"],
                "city_type": row["city_type"],
                "radius_miles": row["radius_miles"],
                "cd_code": cd_code,
                "cd_state": state_abbrev,
                "cd_number": cd_number,
                "district_total_area_sqmi": round(district_total_area_sqmi, 4),
                "area_in_circle_sqmi": round(area_in_circle_sqmi, 4),
                "fractional_overlap": fractional_overlap,
            })

    # ── 3. Build output DataFrame ──────────────────────────────────
    detail_df = pd.DataFrame(all_detail_rows)

    if detail_df.empty:
        log.warning("No intersection rows produced!")
        detail_df["is_primary_district"] = pd.Series(dtype=bool)
        return detail_df

    # ── 4. Filter: keep rows with fractional_overlap >= 0.01,
    #       but always retain the best-overlapping district per campus
    #       (ensures every campus has at least one district even for
    #       large at-large districts like AK, MT, WY, etc.) ─────────
    best_idx = detail_df.groupby("ipeds_unitid")["fractional_overlap"].idxmax()
    keep_mask = (detail_df["fractional_overlap"] >= MIN_OVERLAP) | (
        detail_df.index.isin(best_idx)
    )
    n_below = (~keep_mask).sum()
    detail_df = detail_df[keep_mask].reset_index(drop=True)
    if n_below:
        log.info(f"  Filtered out {n_below} rows below {MIN_OVERLAP} fractional overlap")

    # ── 5. Mark primary district (highest overlap per campus) ──────
    detail_df["is_primary_district"] = False
    primary_idx = detail_df.groupby("ipeds_unitid")["fractional_overlap"].idxmax()
    detail_df.loc[primary_idx, "is_primary_district"] = True

    # ── 6. Summary logging ─────────────────────────────────────────
    n_campuses = detail_df["ipeds_unitid"].nunique()
    n_districts = detail_df["cd_code"].nunique()
    log.info(f"Intersection complete: {len(detail_df):,} detail rows")
    log.info(f"  Campuses with results: {n_campuses:,}")
    log.info(f"  Districts intersected: {n_districts:,}")
    log.info(
        f"  Primary-district flags: {detail_df['is_primary_district'].sum():,} "
        f"(should equal {n_campuses})"
    )

    return detail_df


def build_summary(detail_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate intersection results into a one-row-per-campus summary.

    Parameters
    ----------
    detail_df : pd.DataFrame
        Detail rows produced by ``intersect_districts``.

    Returns
    -------
    pd.DataFrame
        One row per campus with district counts, primary district info,
        and a pipe-delimited list of all overlapping districts.
    """
    # Columns to carry forward from each campus group
    id_cols = [
        "ipeds_unitid", "institution_name", "campus_city", "campus_state",
        "campus_lat", "campus_lon", "total_enrollment",
        "locale_code", "city_type", "radius_miles",
    ]

    rows: list[dict] = []
    for unitid, grp in detail_df.groupby("ipeds_unitid"):
        # Count of districts intersected
        districts_intersected = len(grp)

        # Primary district info
        primary_row = grp[grp["is_primary_district"] == True]
        if len(primary_row) > 0:
            primary_cd = primary_row.iloc[0]["cd_code"]
            primary_cd_overlap = primary_row.iloc[0]["fractional_overlap"]
        else:
            primary_cd = None
            primary_cd_overlap = None

        # All cd_codes ordered by fractional_overlap descending, pipe-delimited
        ordered = grp.sort_values("fractional_overlap", ascending=False)
        all_cds = "|".join(ordered["cd_code"].astype(str).tolist())

        # Build the summary row — carry forward campus identifiers from first row
        first = grp.iloc[0]
        row = {col: first[col] for col in id_cols}
        row["districts_intersected"] = districts_intersected
        row["primary_cd"] = primary_cd
        row["primary_cd_overlap"] = primary_cd_overlap
        row["all_cds"] = all_cds
        rows.append(row)

    summary_df = pd.DataFrame(rows)

    # Logging
    log.info(f"Summary built: {len(summary_df):,} campuses")
    if len(summary_df) > 0:
        mean_d = summary_df["districts_intersected"].mean()
        median_d = summary_df["districts_intersected"].median()
        log.info(
            f"  districts_intersected — mean: {mean_d:.2f}, median: {median_d:.1f}"
        )

    return summary_df


def run_validation(detail_df: pd.DataFrame, campuses: gpd.GeoDataFrame) -> pd.DataFrame:
    """Run validation checks and return a DataFrame of flagged anomalies.

    Parameters
    ----------
    detail_df : pd.DataFrame
        Detail rows produced by ``intersect_districts``.
    campuses : gpd.GeoDataFrame
        The classified campus GeoDataFrame (output of ``classify_campuses``).

    Returns
    -------
    pd.DataFrame
        Columns: ipeds_unitid, institution_name, check_type, detail.
        One row per flagged anomaly. Empty if no anomalies found.
    """
    SQ_METERS_PER_SQ_MILE = 2_589_988.11
    flags: list[dict] = []

    # ── Check 1: zero_districts ────────────────────────────────────
    # Campuses that have no rows in detail_df
    detail_unitids = set(detail_df["ipeds_unitid"].unique())
    for _, row in campuses.iterrows():
        uid = row["ipeds_unitid"]
        if uid not in detail_unitids:
            flags.append({
                "ipeds_unitid": uid,
                "institution_name": row["institution_name"],
                "check_type": "zero_districts",
                "detail": "Campus has no intersecting districts in detail_df",
            })

    # ── Check 2: high_count ────────────────────────────────────────
    # Campuses with > 25 districts
    district_counts = detail_df.groupby("ipeds_unitid").size()
    high_count_ids = district_counts[district_counts > 25].index
    for uid in high_count_ids:
        grp = detail_df[detail_df["ipeds_unitid"] == uid].iloc[0]
        flags.append({
            "ipeds_unitid": uid,
            "institution_name": grp["institution_name"],
            "check_type": "high_count",
            "detail": f"Campus intersects {district_counts[uid]} districts (>25)",
        })

    # ── Check 3: overlap_sum_deviation ─────────────────────────────
    # For each campus, compare sum of area_in_circle_sqmi to expected circle area.
    # Only flag when sum EXCEEDS expected (double-counting or projection error).
    # Sum < expected is normal for coastal campuses where the circle covers water
    # that has no district geometry (cartographic boundary files are coast-clipped).
    campus_detail = detail_df.groupby("ipeds_unitid").agg(
        sum_overlap=("area_in_circle_sqmi", "sum"),
        radius_miles=("radius_miles", "first"),
        institution_name=("institution_name", "first"),
    )
    for uid, row in campus_detail.iterrows():
        r_miles = row["radius_miles"]
        expected_circle_area = math.pi * (r_miles * 1609.344) ** 2 / SQ_METERS_PER_SQ_MILE
        sum_of_overlaps = row["sum_overlap"]
        if expected_circle_area > 0 and sum_of_overlaps > expected_circle_area * 1.05:
            deviation = (sum_of_overlaps - expected_circle_area) / expected_circle_area
            flags.append({
                "ipeds_unitid": uid,
                "institution_name": row["institution_name"],
                "check_type": "overlap_sum_deviation",
                "detail": (
                    f"Sum of overlaps={sum_of_overlaps:.2f} sq mi EXCEEDS "
                    f"expected circle area={expected_circle_area:.2f} sq mi "
                    f"(+{deviation:.1%}) — possible double-counting or projection error"
                ),
            })

    # ── Check 4: duplicate_id ──────────────────────────────────────
    # ipeds_unitid appearing more than once in the campuses input
    dup_counts = campuses["ipeds_unitid"].value_counts()
    dup_ids = dup_counts[dup_counts > 1].index
    for uid in dup_ids:
        name = campuses[campuses["ipeds_unitid"] == uid].iloc[0]["institution_name"]
        flags.append({
            "ipeds_unitid": uid,
            "institution_name": name,
            "check_type": "duplicate_id",
            "detail": f"ipeds_unitid appears {dup_counts[uid]} times in campus list",
        })

    # ── Check 5: missing_locale ─────────────────────────────────
    # Campuses where locale_code is null or -3
    missing_mask = campuses["locale_code"].isna() | (campuses["locale_code"] == -3)
    for _, row in campuses[missing_mask].iterrows():
        flags.append({
            "ipeds_unitid": row["ipeds_unitid"],
            "institution_name": row["institution_name"],
            "check_type": "missing_locale",
            "detail": f"locale_code is {row['locale_code']}; used fallback radius",
        })

    # ── Build result DataFrame ─────────────────────────────────────
    if flags:
        validation_df = pd.DataFrame(flags)
    else:
        validation_df = pd.DataFrame(
            columns=["ipeds_unitid", "institution_name", "check_type", "detail"]
        )

    # Logging
    log.info(f"Validation complete: {len(validation_df)} flags found")
    if len(validation_df) > 0:
        breakdown = validation_df["check_type"].value_counts()
        for check_type, count in breakdown.items():
            log.info(f"  {check_type}: {count}")

    return validation_df


def write_excel(
    detail_df: pd.DataFrame,
    summary_df: pd.DataFrame,
    validation_df: pd.DataFrame,
) -> None:
    """Write the three-sheet Excel workbook.

    Parameters
    ----------
    detail_df : pd.DataFrame
        Detail rows (one per campus-district overlap).
    summary_df : pd.DataFrame
        Summary rows (one per campus).
    validation_df : pd.DataFrame
        Validation flags.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "cc_district_intersections.xlsx"

    # ── Rename columns to human-friendly labels for the Excel output ──
    detail_rename = {
        "ipeds_unitid":           "IPEDS ID",
        "institution_name":       "Institution",
        "campus_city":            "City",
        "campus_state":           "State",
        "campus_lat":             "Latitude",
        "campus_lon":             "Longitude",
        "total_enrollment":       "Enrollment",
        "locale_code":            "Locale Code",
        "city_type":              "Campus Type",
        "radius_miles":           "Commute Radius (mi)",
        "cd_code":                "District",
        "cd_state":               "District State",
        "cd_number":              "District Number",
        "district_total_area_sqmi": "District Area (sq mi)",
        "area_in_circle_sqmi":    "Overlap Area (sq mi)",
        "fractional_overlap":     "% of District Covered",
        "is_primary_district":    "Primary District?",
    }
    summary_rename = {
        "ipeds_unitid":           "IPEDS ID",
        "institution_name":       "Institution",
        "campus_city":            "City",
        "campus_state":           "State",
        "campus_lat":             "Latitude",
        "campus_lon":             "Longitude",
        "total_enrollment":       "Enrollment",
        "locale_code":            "Locale Code",
        "city_type":              "Campus Type",
        "radius_miles":           "Commute Radius (mi)",
        "districts_intersected":  "Districts Reached",
        "primary_cd":             "Primary District",
        "primary_cd_overlap":     "Primary District Coverage",
        "all_cds":                "All Districts",
    }
    validation_rename = {
        "ipeds_unitid":           "IPEDS ID",
        "institution_name":       "Institution",
        "check_type":             "Flag Type",
        "detail":                 "Details",
    }

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        detail_df.rename(columns=detail_rename).to_excel(
            writer, sheet_name="Detail", index=False)
        summary_df.rename(columns=summary_rename).to_excel(
            writer, sheet_name="Summary", index=False)
        validation_df.rename(columns=validation_rename).to_excel(
            writer, sheet_name="Validation", index=False)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    log.info(f"Excel workbook written: {output_path}")
    log.info(f"  File size: {file_size_mb:.2f} MB")
    log.info(f"  Detail sheet: {len(detail_df):,} rows")
    log.info(f"  Summary sheet: {len(summary_df):,} rows")
    log.info(f"  Validation sheet: {len(validation_df):,} rows")


# ====================================================================
#  Main
# ====================================================================

def main() -> None:
    """Execute every pipeline step in order."""
    log.info("=== Pipeline START ===")

    download_ipeds_data()
    download_cd_shapefile()
    campuses = build_campus_list()
    campuses = classify_campuses(campuses)
    circle_groups = build_circles(campuses)
    detail_df = intersect_districts(circle_groups)
    summary_df = build_summary(detail_df)
    validation_df = run_validation(detail_df, campuses)
    write_excel(detail_df, summary_df, validation_df)

    log.info("=== Pipeline END ===")


if __name__ == "__main__":
    main()
