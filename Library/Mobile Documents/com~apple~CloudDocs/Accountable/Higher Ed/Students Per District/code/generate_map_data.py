"""
Generate GeoJSON data files for the interactive Mapbox map.

Reads the pipeline's Excel output and congressional-district shapefiles,
then writes lightweight GeoJSON files to map/data/ for the browser.

Functions
---------
generate_campuses_geojson : Read the Summary sheet → campuses.geojson
generate_districts_geojson : Read CD118 shapefile → districts.geojson
"""

# ── Standard library ────────────────────────────────────────────
import json
import glob
import logging
import math
from pathlib import Path

# ── Third-party ─────────────────────────────────────────────────
import geopandas as gpd
import pandas as pd

# ── Logging setup ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Path constants ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent        # Students Per District/
EXCEL_PATH = BASE_DIR / "output" / "cc_district_intersections.xlsx"
CD118_DIR = BASE_DIR / "data" / "cd118"
MAP_DATA_DIR = BASE_DIR / "map" / "data"

# ── FIPS code → state abbreviation mapping ──────────────────────
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


# ====================================================================
#  Column name mapping: Excel (human-friendly) → GeoJSON (short)
# ====================================================================

SUMMARY_TO_GEOJSON = {
    "IPEDS ID":                   "unitid",
    "Institution":                "name",
    "City":                       "city",
    "State":                      "state",
    "Latitude":                   "lat",
    "Longitude":                  "lon",
    "Enrollment":                 "enrollment",
    "Tract Density (pop/sq mi)":  "tract_density",
    "Campus Type":                "campus_type",
    "Commute Radius (mi)":        "radius_miles",
    "Districts Reached":          "districts_reached",
    "Primary District":           "primary_district",
    "Primary District Coverage":  "primary_district_coverage",
    "All Districts":              "all_districts",
}


# ====================================================================
#  Helper utilities
# ====================================================================

def _clean_value(val):
    """Convert a single value for JSON serialization.

    - NaN / None  → None  (becomes JSON null)
    - Float that is a whole number → int  (e.g. 6627.0 → 6627)
    - Everything else passes through unchanged.
    """
    if val is None:
        return None
    if isinstance(val, float):
        if math.isnan(val):
            return None
        if val == int(val):
            return int(val)
    return val


# ====================================================================
#  generate_campuses_geojson
# ====================================================================

def generate_campuses_geojson() -> Path:
    """Read the Excel Summary sheet and write campuses.geojson.

    Each feature is a GeoJSON Point with coordinates [lon, lat].
    Properties use the short names defined in SUMMARY_TO_GEOJSON.

    Returns
    -------
    Path
        Path to the written campuses.geojson file.
    """
    log.info(f"Reading Summary sheet from {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH, sheet_name="Summary")
    log.info(f"  Loaded {len(df):,} rows, {len(df.columns)} columns")

    # Rename to short property names
    df = df.rename(columns=SUMMARY_TO_GEOJSON)

    # Build GeoJSON feature collection
    features = []
    for _, row in df.iterrows():
        lon = row["lon"]
        lat = row["lat"]

        # Skip rows with missing coordinates
        if pd.isna(lon) or pd.isna(lat):
            log.warning(f"Skipping row with missing coords: unitid={row.get('unitid')}")
            continue

        # Build properties dict with all fields except lat/lon
        properties = {}
        for col in df.columns:
            if col in ("lat", "lon"):
                continue
            properties[col] = _clean_value(row[col])

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [_clean_value(lon), _clean_value(lat)],
            },
            "properties": properties,
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    # Write output
    MAP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    output_path = MAP_DATA_DIR / "campuses.geojson"
    with open(output_path, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"Wrote {output_path}")
    log.info(f"  Features: {len(features):,}")
    log.info(f"  File size: {file_size_kb:.1f} KB")

    return output_path


# ====================================================================
#  generate_districts_geojson
# ====================================================================

def generate_districts_geojson() -> Path:
    """Read the CD118 shapefile and write districts.geojson.

    Each feature is a GeoJSON Polygon/MultiPolygon with properties
    identifying the congressional district (cd_code, state, state_fips,
    district_number, name).

    Returns
    -------
    Path
        Path to the written districts.geojson file.
    """
    # Locate the shapefile
    shp_files = glob.glob(str(CD118_DIR / "*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No .shp file found in {CD118_DIR}")
    shp_path = shp_files[0]
    log.info(f"Reading CD118 shapefile from {shp_path}")

    gdf = gpd.read_file(shp_path)
    log.info(f"  Loaded {len(gdf):,} rows, CRS={gdf.crs}")

    # Reproject to EPSG:4326 (WGS 84) if needed
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        log.info(f"  Reprojecting from EPSG:{gdf.crs.to_epsg()} to EPSG:4326")
        gdf = gdf.to_crs(epsg=4326)

    # Build GeoJSON feature collection
    features = []
    for _, row in gdf.iterrows():
        state_fips = row["STATEFP"]
        cd_fp = row["CD118FP"]
        district_number = int(cd_fp)

        state_abbrev = FIPS_TO_STATE.get(state_fips, state_fips)

        if district_number == 0:
            cd_code = f"{state_abbrev}-AL"
        else:
            cd_code = f"{state_abbrev}-{district_number}"

        properties = {
            "cd_code": cd_code,
            "state": state_abbrev,
            "state_fips": state_fips,
            "district_number": district_number,
            "name": row["NAMELSAD"],
        }

        feature = {
            "type": "Feature",
            "geometry": row.geometry.__geo_interface__,
            "properties": properties,
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    # Write output
    MAP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    output_path = MAP_DATA_DIR / "districts.geojson"
    with open(output_path, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    file_size_kb = output_path.stat().st_size / 1024
    log.info(f"Wrote {output_path}")
    log.info(f"  Features: {len(features):,}")
    log.info(f"  File size: {file_size_kb:.1f} KB")

    return output_path


# ====================================================================
#  Main
# ====================================================================

def main() -> None:
    """Generate all map data files."""
    log.info("=== generate_map_data START ===")
    generate_campuses_geojson()
    generate_districts_geojson()
    log.info("=== generate_map_data END ===")


if __name__ == "__main__":
    main()
