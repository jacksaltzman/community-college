"""
Pipeline: Estimate young-professional (YP) density by congressional district
using American Community Survey (ACS) 5-year data.

Persona filters (applied as stepwise proportional estimation):
  - Age 25-34
  - Bachelor's degree or higher
  - Employed, civilian labor force
  - Household income $40K-$200K
  - Not currently enrolled in college/graduate school
"""

import logging
import time
from pathlib import Path

import pandas as pd
import requests

# -- Logging ---------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# -- Paths ------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # Young Professional/
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
CODE_DIR = BASE_DIR / "code"

# Census API key -- read from the Higher Ed project's Environment.txt
_env_path = BASE_DIR.parent / "Higher Ed" / "Students Per District" / "Environment.txt"
CENSUS_API_KEY = ""
if _env_path.exists():
    for line in _env_path.read_text().strip().splitlines():
        if line.startswith("CENSUS_API_KEY="):
            CENSUS_API_KEY = line.split("=", 1)[1].strip()

if not CENSUS_API_KEY:
    log.warning("No Census API key found -- requests will be unauthenticated (lower rate limits)")

ACS_BASE_URL = "https://api.census.gov/data/2022/acs/acs5"

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

SWING_STATES = {"AZ", "GA", "MI", "NC", "NV", "PA", "WI"}

# -- ACS Variable Definitions -----------------------------------------------
# B01001: Sex by Age -- total population 25-34
AGE_VARS = {
    "B01001_011E": "male_25_29",
    "B01001_012E": "male_30_34",
    "B01001_035E": "female_25_29",
    "B01001_036E": "female_30_34",
    "B01001_001E": "total_pop",
}

# B15001: Sex by Age by Educational Attainment -- bachelor's+ among 25-34
EDU_VARS = {
    "B15001_011E": "edu_male_25_34_total",
    "B15001_017E": "edu_male_25_34_bachelors",
    "B15001_018E": "edu_male_25_34_graduate",
    "B15001_052E": "edu_female_25_34_total",
    "B15001_058E": "edu_female_25_34_bachelors",
    "B15001_059E": "edu_female_25_34_graduate",
}

# B23001: Sex by Age by Employment Status -- civilian employed among 25-34
EMP_VARS = {
    "B23001_024E": "emp_male_25_29_total",
    "B23001_028E": "emp_male_25_29_civilian_employed",
    "B23001_031E": "emp_male_30_34_total",
    "B23001_035E": "emp_male_30_34_civilian_employed",
    "B23001_110E": "emp_female_25_29_total",
    "B23001_114E": "emp_female_25_29_civilian_employed",
    "B23001_117E": "emp_female_30_34_total",
    "B23001_121E": "emp_female_30_34_civilian_employed",
}

# B19037: Age of Householder by Household Income -- $40K-$200K for 25-44
INCOME_VARS = {
    "B19037_019E": "inc_25_44_total",
    "B19037_027E": "inc_25_44_40k_45k",
    "B19037_028E": "inc_25_44_45k_50k",
    "B19037_029E": "inc_25_44_50k_60k",
    "B19037_030E": "inc_25_44_60k_75k",
    "B19037_031E": "inc_25_44_75k_100k",
    "B19037_032E": "inc_25_44_100k_125k",
    "B19037_033E": "inc_25_44_125k_150k",
    "B19037_034E": "inc_25_44_150k_200k",
}

# B14004: Enrollment by Sex, Type, Age -- not enrolled 25-34
ENROLL_VARS = {
    "B14004_006E": "enr_male_public_25_34",
    "B14004_011E": "enr_male_private_25_34",
    "B14004_016E": "enr_male_not_enrolled_25_34",
    "B14004_022E": "enr_female_public_25_34",
    "B14004_027E": "enr_female_private_25_34",
    "B14004_032E": "enr_female_not_enrolled_25_34",
}


# =========================================================================
# ACS API Client
# =========================================================================

def fetch_acs_table(variables: dict[str, str]) -> pd.DataFrame:
    """Pull ACS variables for all congressional districts.

    Parameters
    ----------
    variables : dict
        Mapping of ACS variable codes (e.g. "B01001_011E") to friendly names.

    Returns
    -------
    pd.DataFrame
        One row per district with columns: state_fips, cd_fips, plus all
        friendly-named variable columns (as int, with 0 for missing/negative).
    """
    var_codes = list(variables.keys())
    var_str = ",".join(var_codes)

    params = {
        "get": f"NAME,{var_str}",
        "for": "congressional district:*",
        "in": "state:*",
    }
    if CENSUS_API_KEY:
        params["key"] = CENSUS_API_KEY

    log.info(f"Fetching ACS variables: {var_codes[0]}..{var_codes[-1]} ({len(var_codes)} vars)")
    for attempt in range(3):
        try:
            resp = requests.get(ACS_BASE_URL, params=params, timeout=120)
            resp.raise_for_status()
            break
        except requests.RequestException:
            if attempt == 2:
                raise
            log.warning(f"  Attempt {attempt + 1} failed, retrying in {5 * (attempt + 1)}s...")
            time.sleep(5 * (attempt + 1))

    data = resp.json()
    headers = data[0]
    rows = data[1:]

    df = pd.DataFrame(rows, columns=headers)

    # Rename variable columns to friendly names
    df = df.rename(columns=variables)

    # Rename geography columns
    df = df.rename(columns={"state": "state_fips", "congressional district": "cd_fips"})

    # Convert numeric columns to int (ACS returns strings; negatives/missing → 0)
    for col in variables.values():
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).clip(lower=0).astype(int)

    log.info(f"  Fetched {len(df)} districts")
    return df


def build_district_codes(df: pd.DataFrame) -> pd.DataFrame:
    """Add district_code, state, and district_number columns from FIPS codes.

    Filters out rows where cd_fips is non-numeric (e.g. "ZZ" for
    "not defined" redistricting placeholders).
    """
    # Drop rows with non-numeric cd_fips (e.g. "ZZ" = not defined)
    before = len(df)
    df = df[df["cd_fips"].str.isdigit()].copy()
    dropped = before - len(df)
    if dropped:
        log.info(f"  Dropped {dropped} rows with non-numeric cd_fips (e.g. ZZ)")

    df["state"] = df["state_fips"].map(FIPS_TO_STATE)
    df["district_number"] = df["cd_fips"].astype(int)
    df["district_code"] = df.apply(
        lambda r: f"{r['state']}-AL" if r["district_number"] == 0
        else f"{r['state']}-{r['district_number']}",
        axis=1,
    )
    df["swing_state"] = df["state"].isin(SWING_STATES)
    return df


# =========================================================================
# Data Pull & YP Estimation
# =========================================================================

def pull_all_acs_data() -> pd.DataFrame:
    """Pull all five ACS tables and merge into a single district-level DataFrame."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Pull each table
    age_df = fetch_acs_table(AGE_VARS)
    edu_df = fetch_acs_table(EDU_VARS)
    emp_df = fetch_acs_table(EMP_VARS)
    inc_df = fetch_acs_table(INCOME_VARS)
    enr_df = fetch_acs_table(ENROLL_VARS)

    # Merge all on state_fips + cd_fips
    merge_keys = ["state_fips", "cd_fips"]
    # Start with age_df which has NAME and all age variables
    df = age_df[merge_keys + ["NAME"] + list(AGE_VARS.values())]

    for other in [edu_df, emp_df, inc_df, enr_df]:
        # Drop NAME if present to avoid duplication
        other_cols = [c for c in other.columns if c not in ["NAME"]]
        df = df.merge(other[other_cols], on=merge_keys, how="left")

    # Add district codes
    df = build_district_codes(df)

    # Save intermediate data for auditing
    intermediate_path = DATA_DIR / "acs_raw_merged.csv"
    df.to_csv(intermediate_path, index=False)
    log.info(f"Saved intermediate merged data to {intermediate_path}")

    return df


def compute_yp_estimates(df: pd.DataFrame) -> pd.DataFrame:
    """Compute per-district YP proportions and final estimate.

    Applies stepwise proportional estimation:
      yp_estimate = pop_25_34 x pct_bachelors x pct_employed x pct_income x pct_not_enrolled
    """
    df = df.copy()

    # -- Step 1: Total 25-34 population ------------------------------------
    df["pop_25_34"] = (
        df["male_25_29"] + df["male_30_34"]
        + df["female_25_29"] + df["female_30_34"]
    )

    # -- Step 2: Education -- % with bachelor's+ among 25-34 ---------------
    edu_bachelors_plus = (
        df["edu_male_25_34_bachelors"] + df["edu_male_25_34_graduate"]
        + df["edu_female_25_34_bachelors"] + df["edu_female_25_34_graduate"]
    )
    edu_total = df["edu_male_25_34_total"] + df["edu_female_25_34_total"]
    df["pct_bachelors"] = (edu_bachelors_plus / edu_total).clip(0, 1).fillna(0)

    # -- Step 3: Employment -- % civilian employed among 25-34 -------------
    emp_employed = (
        df["emp_male_25_29_civilian_employed"] + df["emp_male_30_34_civilian_employed"]
        + df["emp_female_25_29_civilian_employed"] + df["emp_female_30_34_civilian_employed"]
    )
    emp_total = (
        df["emp_male_25_29_total"] + df["emp_male_30_34_total"]
        + df["emp_female_25_29_total"] + df["emp_female_30_34_total"]
    )
    df["pct_employed"] = (emp_employed / emp_total).clip(0, 1).fillna(0)

    # -- Step 4: Income -- % in $40K-$200K among 25-44 householders --------
    inc_in_range = (
        df["inc_25_44_40k_45k"] + df["inc_25_44_45k_50k"]
        + df["inc_25_44_50k_60k"] + df["inc_25_44_60k_75k"]
        + df["inc_25_44_75k_100k"] + df["inc_25_44_100k_125k"]
        + df["inc_25_44_125k_150k"] + df["inc_25_44_150k_200k"]
    )
    df["pct_income_40k_200k"] = (inc_in_range / df["inc_25_44_total"]).clip(0, 1).fillna(0)

    # -- Step 5: Enrollment -- % NOT enrolled among 25-34 ------------------
    enr_not_enrolled = (
        df["enr_male_not_enrolled_25_34"] + df["enr_female_not_enrolled_25_34"]
    )
    enr_total = (
        df["enr_male_public_25_34"] + df["enr_male_private_25_34"]
        + df["enr_male_not_enrolled_25_34"]
        + df["enr_female_public_25_34"] + df["enr_female_private_25_34"]
        + df["enr_female_not_enrolled_25_34"]
    )
    df["pct_not_enrolled"] = (enr_not_enrolled / enr_total).clip(0, 1).fillna(0)

    # -- Step 6: Final YP estimate -----------------------------------------
    df["yp_estimate"] = (
        df["pop_25_34"]
        * df["pct_bachelors"]
        * df["pct_employed"]
        * df["pct_income_40k_200k"]
        * df["pct_not_enrolled"]
    ).round(0).astype(int)

    # -- Step 7: Density metrics -------------------------------------------
    df["yp_density_pct"] = (
        (df["yp_estimate"] / df["total_pop"]) * 100
    ).round(2)
    df["yp_share_of_cohort_pct"] = (
        (df["yp_estimate"] / df["pop_25_34"]) * 100
    ).round(2)

    # Handle districts where total_pop or pop_25_34 is 0 or missing
    df.loc[df["total_pop"] <= 0, "yp_density_pct"] = 0
    df.loc[df["pop_25_34"] <= 0, "yp_share_of_cohort_pct"] = 0

    log.info(f"YP estimates computed for {len(df)} districts")
    log.info(f"  National YP total: {df['yp_estimate'].sum():,}")
    log.info(f"  Median per district: {df['yp_estimate'].median():,.0f}")
    log.info(f"  Max density: {df['yp_density_pct'].max():.2f}%")

    return df


# =========================================================================
# Output Table & File Export
# =========================================================================

def build_output_table(df: pd.DataFrame) -> pd.DataFrame:
    """Select and rename columns for the final output table.

    Produces a clean, analysis-ready table sorted by YP density descending.

    Parameters
    ----------
    df : pd.DataFrame
        Full pipeline DataFrame with all computed columns.

    Returns
    -------
    pd.DataFrame
        Output table with standardized column names, sorted by yp_density_pct.
    """
    output_cols = {
        "district_code": "district_code",
        "state": "state",
        "district_number": "district_number",
        "total_pop": "total_population",
        "pop_25_34": "pop_25_34",
        "yp_estimate": "yp_estimate",
        "yp_density_pct": "yp_density_pct",
        "yp_share_of_cohort_pct": "yp_share_of_cohort_pct",
        "swing_state": "swing_state",
        "pct_bachelors": "pct_bachelors",
        "pct_employed": "pct_employed",
        "pct_income_40k_200k": "pct_income_40k_200k",
        "pct_not_enrolled": "pct_not_enrolled",
    }
    out = df[list(output_cols.keys())].rename(columns=output_cols).copy()
    out = out.sort_values("yp_density_pct", ascending=False).reset_index(drop=True)

    log.info(f"Output table built: {len(out)} rows, {len(out.columns)} columns")
    return out


def write_outputs(out_df: pd.DataFrame) -> None:
    """Write CSV and XLSX output files to OUTPUT_DIR.

    Creates the output directory if it does not exist. Writes both a CSV
    and an XLSX workbook with a named sheet.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = OUTPUT_DIR / "yp_density_by_district.csv"
    xlsx_path = OUTPUT_DIR / "yp_density_by_district.xlsx"

    out_df.to_csv(csv_path, index=False)
    log.info(f"CSV written: {csv_path} ({len(out_df)} rows)")

    out_df.to_excel(xlsx_path, index=False, sheet_name="YP Density by District")
    log.info(f"XLSX written: {xlsx_path} ({len(out_df)} rows)")


# =========================================================================
# Summary Markdown Generation
# =========================================================================

def write_summary(df: pd.DataFrame, out_df: pd.DataFrame) -> None:
    """Write yp_analysis_summary.md with methodology, rankings, and findings.

    Parameters
    ----------
    df : pd.DataFrame
        Full pipeline DataFrame (used for any additional detail lookups).
    out_df : pd.DataFrame
        Clean output table produced by build_output_table().
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    summary_path = OUTPUT_DIR / "yp_analysis_summary.md"

    lines = []
    lines.append("# Young Professional Density Analysis -- Summary\n")
    lines.append(f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d')}\n")

    # -- Methodology -------------------------------------------------------
    lines.append("## Methodology\n")
    lines.append("### Data Source\n")
    lines.append("American Community Survey (ACS) 5-year estimates, 2022 vintage (2018-2022),")
    lines.append("pulled via Census Bureau API at the congressional district level (CD118, 118th Congress).\n")

    lines.append("### Persona Definition\n")
    lines.append("| Filter | Definition | ACS Table | Age Bracket |")
    lines.append("|--------|-----------|-----------|-------------|")
    lines.append("| Age | 25-34 | B01001 | 25-29, 30-34 |")
    lines.append("| Education | Bachelor's degree or higher | B15001 | 25-34 |")
    lines.append("| Employment | Civilian employed | B23001 | 25-29, 30-34 |")
    lines.append("| Income | $40K-$200K household income | B19037 | 25-44 (householder) |")
    lines.append("| Enrollment | Not enrolled in college/grad school | B14004 | 25-34 |\n")

    lines.append("### Estimation Method\n")
    lines.append("Stepwise proportional estimation applied per-district:\n")
    lines.append("```")
    lines.append("yp_estimate = pop_25_34 x pct_bachelors x pct_employed x pct_income_40k_200k x pct_not_enrolled")
    lines.append("```\n")
    lines.append("Each proportion is district-specific. This assumes approximate independence between filters.\n")

    # -- Caveats -----------------------------------------------------------
    lines.append("### Caveats\n")
    lines.append("1. **Age approximation**: ACS brackets give 25-34; spec requested 22-35.")
    lines.append("2. **Independence assumption**: Filters are applied multiplicatively, assuming independence. Education and employment are positively correlated, so this may slightly overcount.")
    lines.append("3. **Income table age bracket**: B19037 uses householder age 25-44, not 25-34. This includes older householders (35-44) in the income proportion.")
    lines.append("4. **Householder vs individual**: B19037 measures household income by householder age. YPs in shared housing where someone else is the householder may be undercounted.")
    lines.append("5. **ACS margins of error**: Small districts may have significant sampling error. Estimates should be treated as approximations.\n")

    # -- National summary --------------------------------------------------
    lines.append("## National Summary\n")
    total_yp = out_df["yp_estimate"].sum()
    median_yp = out_df["yp_estimate"].median()
    mean_yp = out_df["yp_estimate"].mean()
    total_pop = out_df["total_population"].sum()
    total_25_34 = out_df["pop_25_34"].sum()

    lines.append(f"- **Total estimated YPs nationally**: {total_yp:,.0f}")
    lines.append(f"- **Total population (all districts)**: {total_pop:,}")
    lines.append(f"- **Total 25-34 population**: {total_25_34:,}")
    lines.append(f"- **National YP density**: {total_yp / total_pop * 100:.2f}%")
    lines.append(f"- **YPs as share of 25-34 cohort**: {total_yp / total_25_34 * 100:.2f}%")
    lines.append(f"- **Median YP count per district**: {median_yp:,.0f}")
    lines.append(f"- **Mean YP count per district**: {mean_yp:,.0f}")
    lines.append(f"- **Districts analyzed**: {len(out_df)}\n")

    # -- Distribution percentiles ------------------------------------------
    lines.append("### Distribution (YP count per district)\n")
    lines.append("| Percentile | YP Count |")
    lines.append("|-----------|----------|")
    for p in [10, 25, 50, 75, 90, 95, 99]:
        val = out_df["yp_estimate"].quantile(p / 100)
        lines.append(f"| {p}th | {val:,.0f} |")
    lines.append("")

    # -- Top 50 by density -------------------------------------------------
    lines.append("## Top 50 Districts by YP Density (%)\n")
    lines.append("| Rank | District | State | YP Estimate | YP Density (%) | Pop 25-34 |")
    lines.append("|------|----------|-------|-------------|----------------|-----------|")
    top_density = out_df.nlargest(50, "yp_density_pct")
    for i, (_, row) in enumerate(top_density.iterrows(), 1):
        lines.append(
            f"| {i} | {row['district_code']} | {row['state']} | "
            f"{row['yp_estimate']:,.0f} | {row['yp_density_pct']:.2f} | "
            f"{row['pop_25_34']:,} |"
        )
    lines.append("")

    # -- Top 50 by absolute count ------------------------------------------
    lines.append("## Top 50 Districts by Absolute YP Count\n")
    lines.append("| Rank | District | State | YP Estimate | YP Density (%) | Total Pop |")
    lines.append("|------|----------|-------|-------------|----------------|-----------|")
    top_count = out_df.nlargest(50, "yp_estimate")
    for i, (_, row) in enumerate(top_count.iterrows(), 1):
        lines.append(
            f"| {i} | {row['district_code']} | {row['state']} | "
            f"{row['yp_estimate']:,.0f} | {row['yp_density_pct']:.2f} | "
            f"{row['total_population']:,} |"
        )
    lines.append("")

    # -- State-level rollup ------------------------------------------------
    lines.append("## State-Level Rollup\n")
    state_agg = out_df.groupby("state").agg(
        total_yp=("yp_estimate", "sum"),
        total_pop=("total_population", "sum"),
        districts=("district_code", "count"),
    ).reset_index()
    state_agg["yp_density_pct"] = (state_agg["total_yp"] / state_agg["total_pop"] * 100).round(2)
    state_agg = state_agg.sort_values("total_yp", ascending=False)

    lines.append("| State | Districts | Total YP | Total Pop | YP Density (%) |")
    lines.append("|-------|-----------|----------|-----------|----------------|")
    for _, row in state_agg.iterrows():
        lines.append(
            f"| {row['state']} | {row['districts']} | {row['total_yp']:,.0f} | "
            f"{row['total_pop']:,} | {row['yp_density_pct']:.2f} |"
        )
    lines.append("")

    # -- Swing state breakout ----------------------------------------------
    lines.append("## Swing State Analysis (AZ, GA, MI, NC, NV, PA, WI)\n")
    swing_df = out_df[out_df["swing_state"]].copy()
    swing_total_yp = swing_df["yp_estimate"].sum()
    swing_total_pop = swing_df["total_population"].sum()

    lines.append(f"- **Total swing-state YPs**: {swing_total_yp:,.0f}")
    lines.append(f"- **Swing-state YP density**: {swing_total_yp / swing_total_pop * 100:.2f}%")
    lines.append(f"- **Districts in swing states**: {len(swing_df)}\n")

    lines.append("| District | State | YP Estimate | YP Density (%) | Pop 25-34 |")
    lines.append("|----------|-------|-------------|----------------|-----------|")
    swing_ranked = swing_df.sort_values("yp_density_pct", ascending=False)
    for _, row in swing_ranked.iterrows():
        lines.append(
            f"| {row['district_code']} | {row['state']} | "
            f"{row['yp_estimate']:,.0f} | {row['yp_density_pct']:.2f} | "
            f"{row['pop_25_34']:,} |"
        )
    lines.append("")

    summary_path.write_text("\n".join(lines))
    log.info(f"Summary written: {summary_path} ({len(lines)} lines)")


# =========================================================================
# Main Pipeline
# =========================================================================

def main() -> None:
    """Execute the full YP density pipeline.

    Steps:
      1. Pull all ACS data (5 tables, merged)
      2. Compute YP estimates per district
      3. Build clean output table
      4. Write CSV and XLSX exports
      5. Write summary markdown report
    """
    log.info("=== YP Pipeline START ===")

    # Step 1: Pull all ACS data
    df = pull_all_acs_data()

    # Step 2: Compute YP estimates
    df = compute_yp_estimates(df)

    # Step 3: Build output table
    out_df = build_output_table(df)

    # Step 4: Write CSV and XLSX
    write_outputs(out_df)

    # Step 5: Write summary markdown
    write_summary(df, out_df)

    log.info("=== YP Pipeline END ===")


if __name__ == "__main__":
    main()
