"""
Generate GeoJSON for the YP density choropleth map.

Reads the pipeline CSV output and the CD118 congressional district shapefile,
joins YP density data onto district geometries, and writes a compact GeoJSON
file for the front-end map.
"""

import glob
import json
import logging
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd

# -- Logging ---------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# -- Paths ------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # Young Professional/
OUTPUT_DIR = BASE_DIR / "output"
MAP_DATA_DIR = BASE_DIR / "map" / "data"

CSV_PATH = OUTPUT_DIR / "yp_density_by_district.csv"
CD118_DIR = BASE_DIR.parent / "Higher Ed" / "Students Per District" / "data" / "cd118"

# -- FIPS -> state abbreviation ---------------------------------------------
FIPS_TO_STATE = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
    "72": "PR", "78": "VI",
}


def _clean_value(val):
    """Prepare a value for JSON serialization.

    - NaN / None -> None
    - Whole floats (e.g. 58131.0) -> int
    - Boolean strings -> bool
    - Otherwise return as-is
    """
    if val is None:
        return None
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        if val == int(val):
            return int(val)
        return round(val, 4)
    if isinstance(val, str):
        if val == "True":
            return True
        if val == "False":
            return False
    return val


def generate_districts_geojson() -> Path:
    """Read pipeline CSV + CD118 shapefile, join, and write GeoJSON.

    Returns
    -------
    Path
        Path to the written GeoJSON file.
    """
    # -- 1. Read the pipeline CSV output -----------------------------------
    log.info(f"Reading CSV: {CSV_PATH}")
    csv_df = pd.read_csv(CSV_PATH)
    log.info(f"  CSV rows: {len(csv_df)}")

    # -- 2. Read the CD118 shapefile ---------------------------------------
    shp_files = glob.glob(str(CD118_DIR / "*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No .shp file found in {CD118_DIR}")
    shp_path = shp_files[0]
    log.info(f"Reading shapefile: {shp_path}")

    gdf = gpd.read_file(shp_path)
    log.info(f"  Shapefile rows: {len(gdf)}, CRS: {gdf.crs}")

    # -- 3. Reproject to WGS 84 if needed ----------------------------------
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        log.info(f"  Reprojecting from {gdf.crs} to EPSG:4326")
        gdf = gdf.to_crs(epsg=4326)

    # -- 4. Filter out ZZ rows and build cd_code ---------------------------
    before = len(gdf)
    gdf = gdf[gdf["CD118FP"] != "ZZ"].copy()
    dropped = before - len(gdf)
    if dropped:
        log.info(f"  Dropped {dropped} ZZ rows")

    def _build_cd_code(row):
        state_abbr = FIPS_TO_STATE.get(row["STATEFP"])
        if state_abbr is None:
            return None
        cd_fp = row["CD118FP"]
        if cd_fp == "00":
            return f"{state_abbr}-AL"
        return f"{state_abbr}-{int(cd_fp)}"

    gdf["cd_code"] = gdf.apply(_build_cd_code, axis=1)

    # Drop rows where we couldn't map the FIPS code
    unmapped = gdf["cd_code"].isna().sum()
    if unmapped:
        log.warning(f"  Dropping {unmapped} rows with unmapped STATEFP")
        gdf = gdf.dropna(subset=["cd_code"]).copy()

    log.info(f"  Districts after filtering: {len(gdf)}")

    # -- 5. Join YP data onto shapefile rows -------------------------------
    yp_cols = [
        "district_code", "yp_estimate", "yp_density_pct",
        "yp_share_of_cohort_pct", "total_population", "pop_25_34",
        "swing_state",
    ]
    yp_df = csv_df[yp_cols].copy()
    yp_df = yp_df.rename(columns={"district_code": "cd_code"})

    gdf = gdf.merge(yp_df, on="cd_code", how="left")

    matched = gdf["yp_estimate"].notna().sum()
    unmatched = gdf["yp_estimate"].isna().sum()
    log.info(f"  Joined: {matched} matched, {unmatched} unmatched")

    # -- 6. Build properties and extract state/district_number from cd_code -
    def _extract_state(cd_code):
        if cd_code and "-" in cd_code:
            return cd_code.split("-")[0]
        return None

    def _extract_district_number(cd_code):
        if cd_code and "-" in cd_code:
            part = cd_code.split("-")[1]
            if part == "AL":
                return "AL"
            return part
        return None

    gdf["state"] = gdf["cd_code"].apply(_extract_state)
    gdf["district_number"] = gdf["cd_code"].apply(_extract_district_number)

    # -- 7. Build the GeoJSON feature collection ---------------------------
    property_cols = [
        "cd_code", "state", "district_number", "NAMELSAD",
        "yp_estimate", "yp_density_pct", "yp_share_of_cohort_pct",
        "total_population", "pop_25_34", "swing_state",
    ]

    features = []
    for _, row in gdf.iterrows():
        props = {}
        for col in property_cols:
            key = "name" if col == "NAMELSAD" else col
            props[key] = _clean_value(row.get(col))
        feature = {
            "type": "Feature",
            "properties": props,
            "geometry": json.loads(gpd.GeoSeries([row.geometry]).to_json())["features"][0]["geometry"],
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    # -- 8. Write output ---------------------------------------------------
    MAP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    output_path = MAP_DATA_DIR / "districts.geojson"

    with open(output_path, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    log.info(f"GeoJSON written: {output_path}")
    log.info(f"  Features: {len(features)}")
    log.info(f"  File size: {file_size_mb:.2f} MB")

    return output_path


def main() -> None:
    """Generate the districts GeoJSON file."""
    log.info("=== GeoJSON Generation START ===")
    output_path = generate_districts_geojson()
    log.info(f"Output: {output_path}")
    log.info("=== GeoJSON Generation END ===")


if __name__ == "__main__":
    main()
