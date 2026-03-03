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

import json
import logging
import math
from pathlib import Path

import pandas as pd
import requests
from openpyxl import Workbook

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
