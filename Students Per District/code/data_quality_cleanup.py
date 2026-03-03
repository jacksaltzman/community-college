"""
Data quality cleanup for cc_district_intersections.xlsx.

Removes 37 institutions:
  - 17 wrong-sector (reclassified in HD2024 to sector/HLOFFER outside inclusion rules)
  - 20 not found in HD2024 (closed/merged since HD2023)

Updates the Validation tab with removal records.
"""

import pandas as pd
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
XLSX_PATH = OUTPUT_DIR / "cc_district_intersections.xlsx"

# ── Category A: Wrong sector per HD2024 (17 institutions) ──
# These pass the HD2023 filter but were reclassified in HD2024
WRONG_SECTOR = {
    136491: ("Pinellas Technical College-Clearwater", "sector=7"),
    137087: ("Pinellas Technical College-St. Petersburg", "sector=7"),
    170639: ("Lake Superior State University", "sector=1, hloffer=7"),
    233897: ("University of Virginia's College at Wise", "sector=1, hloffer=7"),
    214625: ("Penn State New Kensington", "sector=1, hloffer=7"),
    214634: ("Penn State Shenango", "sector=1, hloffer=7"),
    214643: ("Penn State Wilkes-Barre", "sector=1, hloffer=7"),
    214670: ("Penn State Lehigh Valley", "sector=1, hloffer=7"),
    214689: ("Penn State Altoona", "sector=1, hloffer=7"),
    214698: ("Penn State Beaver", "sector=1, hloffer=7"),
    214731: ("Penn State Brandywine", "sector=1, hloffer=7"),
    214740: ("Penn State DuBois", "sector=1, hloffer=7"),
    214759: ("Penn State Fayette-Eberly", "sector=1, hloffer=7"),
    214768: ("Penn State Hazleton", "sector=1, hloffer=7"),
    214786: ("Penn State Greater Allegheny", "sector=1, hloffer=7"),
    214795: ("Penn State Mont Alto", "sector=1, hloffer=7"),
    214810: ("Penn State Schuylkill", "sector=1, hloffer=7"),
}

# ── Category B: Not in HD2024 (20 institutions) ──
# Closed, merged, or defunct since HD2023
NOT_IN_HD2024 = {
    128577: "Asnuntuck Community College",
    129543: "Connecticut State Community College Housatonic",
    129695: "Manchester Community College",
    129729: "Naugatuck Valley Community College",
    129756: "Middlesex Community College",
    129808: "Three Rivers Community College",
    130004: "Connecticut State Community College Norwalk",
    130040: "Northwestern Connecticut Community College",
    130217: "Quinebaug Valley Community College",
    130396: "Connecticut State Community College Gateway",
    130606: "Connecticut State Community College Tunxis",
    201751: "Chatfield College",
    219170: "Avera McKennan Hospital School of Radiologic Technology",
    219921: "Tennessee College of Applied Technology-Covington",
    221388: "Tennessee College of Applied Technology-Ripley",
    417248: "CT Aerotech",
    417275: "Stratford School for Aviation Maintenance Technicians",
    443748: "Altierus Career College-Norcross",
    445461: "Altierus Career College-Bissonnet",
    460385: "Geisinger-Lewistown Hospital School of Nursing",
}


def run_cleanup():
    # Load the Excel file
    detail = pd.read_excel(XLSX_PATH, sheet_name="Detail")
    summary = pd.read_excel(XLSX_PATH, sheet_name="Summary")
    validation = pd.read_excel(XLSX_PATH, sheet_name="Validation")

    print(f"Before cleanup:")
    print(f"  Detail rows:     {len(detail):,}")
    print(f"  Summary rows:    {len(summary):,}")
    print(f"  Validation rows: {len(validation):,}")

    # Build removal records
    all_removals = []
    ids_to_remove = set()

    # Category A
    for ipeds_id, (name, sector_info) in WRONG_SECTOR.items():
        if ipeds_id in summary["IPEDS ID"].values:
            all_removals.append({
                "IPEDS ID": ipeds_id,
                "Institution": name,
                "Flag Type": "removed",
                "Details": f"Wrong sector: {sector_info}",
            })
            ids_to_remove.add(ipeds_id)
        else:
            print(f"  WARNING: {name} ({ipeds_id}) not found in file")

    # Category B
    for ipeds_id, name in NOT_IN_HD2024.items():
        if ipeds_id in summary["IPEDS ID"].values:
            all_removals.append({
                "IPEDS ID": ipeds_id,
                "Institution": name,
                "Flag Type": "removed",
                "Details": "Not found in HD2024 (closed/merged)",
            })
            ids_to_remove.add(ipeds_id)
        else:
            print(f"  WARNING: {name} ({ipeds_id}) not found in file")

    print(f"\nRemovals:")
    print(f"  Wrong sector:      {sum(1 for r in all_removals if 'Wrong sector' in r['Details'])}")
    print(f"  Not in HD2024:     {sum(1 for r in all_removals if 'closed/merged' in r['Details'])}")
    print(f"  Total:             {len(all_removals)}")

    # Remove from Detail and Summary
    detail_clean = detail[~detail["IPEDS ID"].isin(ids_to_remove)].copy()
    summary_clean = summary[~summary["IPEDS ID"].isin(ids_to_remove)].copy()

    # Update Validation tab
    # Keep existing flags for non-removed campuses
    validation_clean = validation[~validation["IPEDS ID"].isin(ids_to_remove)].copy()

    # Update missing_locale Details text
    mask = validation_clean["Flag Type"] == "missing_locale"
    validation_clean.loc[mask, "Details"] = (
        "Locale code missing or -3; used fallback radius of 22 mi"
    )

    # Add removal records
    removal_df = pd.DataFrame(all_removals)
    validation_final = pd.concat([validation_clean, removal_df], ignore_index=True)

    print(f"\nAfter cleanup:")
    print(f"  Detail rows:     {len(detail_clean):,}")
    print(f"  Summary rows:    {len(summary_clean):,}")
    print(f"  Validation rows: {len(validation_final):,}")

    # Write output
    with pd.ExcelWriter(XLSX_PATH, engine="openpyxl") as writer:
        detail_clean.to_excel(writer, sheet_name="Detail", index=False)
        summary_clean.to_excel(writer, sheet_name="Summary", index=False)
        validation_final.to_excel(writer, sheet_name="Validation", index=False)

    print(f"\nSaved to {XLSX_PATH}")


if __name__ == "__main__":
    run_cleanup()
