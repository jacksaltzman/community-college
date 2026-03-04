"""
Simplify districts.geojson geometry and generate districts-meta.json.

Usage:
    python simplify_districts.py

Reads:  ../app/public/data/districts.geojson
Writes: ../app/public/data/districts.geojson  (overwritten, simplified)
        ../app/public/data/districts-meta.json (properties + bboxes only)
"""

import json
from pathlib import Path
from shapely.geometry import shape, mapping

TOLERANCE = 0.002       # ~222m at equator — good for zoom 3-10
COORD_PRECISION = 5     # 5 decimal places ≈ 1.1m

DATA_DIR = Path(__file__).parent.parent / "app" / "public" / "data"
INPUT_PATH = DATA_DIR / "districts.geojson"


def round_coords(coords, precision):
    """Recursively round all coordinates in a nested list."""
    if isinstance(coords[0], (int, float)):
        return [round(c, precision) for c in coords]
    return [round_coords(c, precision) for c in coords]


def simplify_geojson():
    """Simplify districts geometry and generate metadata."""
    print(f"Reading {INPUT_PATH}...")
    with open(INPUT_PATH) as f:
        data = json.load(f)

    original_size = INPUT_PATH.stat().st_size
    total_coords_before = 0
    total_coords_after = 0

    districts_meta = {}
    state_bounds = {}

    for feat in data["features"]:
        geom = shape(feat["geometry"])

        # Count coordinates before
        coords_before = len(list(geom.exterior.coords)) if geom.geom_type == "Polygon" else sum(
            len(list(p.exterior.coords)) for p in geom.geoms
        )
        total_coords_before += coords_before

        # Simplify
        simplified = geom.simplify(TOLERANCE, preserve_topology=True)

        # Count coordinates after
        coords_after = len(list(simplified.exterior.coords)) if simplified.geom_type == "Polygon" else sum(
            len(list(p.exterior.coords)) for p in simplified.geoms
        )
        total_coords_after += coords_after

        # Round coordinates
        geojson_geom = mapping(simplified)
        geojson_geom["coordinates"] = round_coords(
            list(geojson_geom["coordinates"]), COORD_PRECISION
        )
        feat["geometry"] = geojson_geom

        # Build metadata entry
        props = feat["properties"]
        cd_code = props["cd_code"]
        state = props["state"]
        bbox = [round(b, 4) for b in simplified.bounds]  # (minx, miny, maxx, maxy)

        districts_meta[cd_code] = {
            "state": state,
            "state_fips": props.get("state_fips", ""),
            "district_number": props.get("district_number", ""),
            "name": props.get("name", ""),
            "cook_pvi": props.get("cook_pvi", ""),
            "member": props.get("member", ""),
            "party": props.get("party", ""),
            "bbox": bbox,
        }

        # Aggregate state bounds
        if state not in state_bounds:
            state_bounds[state] = list(bbox)
        else:
            sb = state_bounds[state]
            sb[0] = min(sb[0], bbox[0])
            sb[1] = min(sb[1], bbox[1])
            sb[2] = max(sb[2], bbox[2])
            sb[3] = max(sb[3], bbox[3])

    # Write simplified GeoJSON
    output_geojson = INPUT_PATH
    with open(output_geojson, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    new_size = output_geojson.stat().st_size

    print(f"Geometry simplified:")
    print(f"  Coordinates: {total_coords_before:,} -> {total_coords_after:,} ({100 - total_coords_after / total_coords_before * 100:.1f}% reduction)")
    print(f"  File size: {original_size / 1024 / 1024:.1f} MB -> {new_size / 1024 / 1024:.1f} MB ({100 - new_size / original_size * 100:.1f}% reduction)")

    # Write districts-meta.json
    meta = {
        "districts": districts_meta,
        "stateBounds": {k: [round(b, 4) for b in v] for k, v in state_bounds.items()},
    }
    meta_path = DATA_DIR / "districts-meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    meta_size = meta_path.stat().st_size

    print(f"\nMetadata generated:")
    print(f"  Districts: {len(districts_meta)}")
    print(f"  States: {len(state_bounds)}")
    print(f"  File size: {meta_size / 1024:.1f} KB")


if __name__ == "__main__":
    simplify_geojson()
