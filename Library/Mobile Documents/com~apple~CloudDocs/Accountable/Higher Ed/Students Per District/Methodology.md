# Methodology: Community College District Intersections

This document explains how the `cc_district_intersections.xlsx` workbook is produced — from raw data sources through final output.

## Data Sources

| Source | Description | Provider |
|--------|-------------|----------|
| **HD2023** | Institutional characteristics (name, location, sector, highest level of offering) | IPEDS / NCES |
| **EFFY2023** | 12-month unduplicated headcount enrollment | IPEDS / NCES |
| **CB 2023 CD118 500k** | 118th Congress congressional district boundaries (cartographic, coast-clipped) | U.S. Census Bureau |
| **NPSAS:20** | 75th-percentile student-to-campus distance by NCES locale code (retrieval code: swopse) | NCES PowerStats |

## Step 1: Identify Community Colleges

Campuses are selected from HD2023 using three inclusion groups:

| Group | Filter | Count | Description |
|-------|--------|-------|-------------|
| 1 | `SECTOR = 4` | ~880 | Traditional public two-year colleges |
| 2 | `SECTOR = 5` | ~135 | Private not-for-profit two-year colleges |
| 3 | `SECTOR = 1` and `HLOFFER = 5` | ~245 | Public institutions whose highest offering is a bachelor's degree — these are community colleges that were reclassified after their states authorized them to grant bachelor's degrees (e.g., Florida, Colorado, Arizona, Washington) |

Campuses with missing or zero coordinates are dropped. A post-processing step removes 37 additional institutions that were reclassified between HD2023 and HD2024 or whose IPEDS IDs became defunct due to mergers (primarily 11 Connecticut community colleges that consolidated into CT State Community College).

**Final campus count: 1,219.**

## Step 2: Join Enrollment Data

Total 12-month unduplicated headcount enrollment is joined from EFFY2023, filtered to `EFFYLEV = 1` (all students) and `LSTUDY = 999` (total across all levels of study). This is a left join — campuses without enrollment data retain null values rather than being dropped.

## Step 3: Classify Campus by Locale and Assign Commute Radius

Each campus is assigned a commute-shed radius based on its NCES locale code (the `LOCALE` field in HD2023). Radii come from the 75th-percentile (P75) student-to-campus crow-flies distance computed from the 2020 National Postsecondary Student Aid Study (NPSAS:20) via NCES PowerStats (retrieval code: swopse). The P75 was chosen over the median because it captures the commuting range of ~75% of students, reflecting the broader service area relevant to legislative outreach.

### Per-Locale Radius Lookup

| Locale Code | Description | P75 Radius |
|-------------|-------------|------------|
| 11 | City Large | 15 mi |
| 12 | City Midsize | 19 mi |
| 13 | City Small | 25 mi |
| 21 | Suburb Large | 15 mi |
| 22 | Suburb Midsize | 22 mi |
| 23 | Suburb Small | 22 mi |
| 31 | Town Fringe | 39 mi |
| 32 | Town Distant | 44 mi |
| 33 | Town Remote | 58 mi |
| 41 | Rural Fringe | 27 mi |
| 42 | Rural Distant | 37 mi |
| 43 | Rural Remote | 55 mi |

Note: City Small (locale 13) uses a conservative 25-mile radius; the raw P75 of 35 miles was unstable due to small sample size.

### Display Groupings

For the map legend and Excel labels, the 12 locale codes are grouped into 6 display categories:

| Label | Locale Codes | Radius Range |
|-------|-------------|-------------|
| Large City | 11, 21 | 15 mi |
| Midsize City | 12 | 19 mi |
| Suburban | 22, 23 | 22 mi |
| Small City | 13 | 25 mi |
| Rural | 41, 42 | 27–37 mi |
| Town / Remote | 31, 32, 33, 43 | 39–58 mi |

**Fallback rule:** Campuses with a missing or invalid locale code (null or -3) are assigned a 22-mile radius and the "Suburban" label. This affects approximately 3 campuses, primarily in U.S. territories.

## Step 4: Build Commute-Shed Circles

A circular buffer is drawn around each campus point using its assigned radius. To ensure accurate area calculations, campuses are grouped by region and projected into an appropriate equal-area coordinate reference system before buffering:

| Region | CRS | EPSG |
|--------|-----|------|
| Continental U.S. | Albers Equal-Area Conic | 5070 |
| Alaska | Alaska Albers | 3338 |
| Hawaii | Hawaii Albers Equal-Area Conic | 102007 |

The resulting circles represent the estimated geographic area from which a campus draws commuting students.

## Step 5: Intersect Circles with Congressional Districts

Each commute-shed circle is intersected with the 118th Congress congressional district boundaries. For every circle-district pair that overlaps:

1. The **exact geometric intersection** is computed (not a bounding-box approximation)
2. The **overlap area** is measured in square miles
3. The **fractional overlap** is calculated as: `overlap area / total district area`

Pairs with fractional overlap below 1% are dropped, except that every campus retains at least its single best-overlapping district (this handles campuses in large at-large districts like Alaska, Montana, and Wyoming).

The district boundary files are cartographic (coast-clipped), so circles over water produce no overlap — this is expected and correct for coastal campuses.

## Step 6: Identify the Primary District

For each campus, the district with the highest fractional overlap is flagged as the **primary district**. This is the district whose geographic area is most covered by the campus's commute shed — not necessarily the district where the campus is physically located (though it usually is).

## Output: Excel Workbook

### Detail Sheet

One row per campus-district pair. Each row describes a single overlap between one campus's commute circle and one congressional district.

| Column | Description |
|--------|-------------|
| IPEDS ID | Unique institution identifier from IPEDS |
| Institution | Campus name |
| City, State | Campus location |
| Latitude, Longitude | Campus coordinates |
| Enrollment | 12-month unduplicated headcount (EFFY2023) |
| Locale Code | NCES locale code (11–43) from HD2023 |
| Campus Type | Locale-based classification (Large City / Midsize City / Suburban / Small City / Rural / Town \/ Remote) |
| Commute Radius (mi) | Radius of the commute-shed circle |
| District | Congressional district code (e.g., "CA-12", "TX-AL") |
| District State | State abbreviation of the district |
| District Number | Numeric district number (0 = at-large) |
| District Area (sq mi) | Total area of the congressional district |
| Overlap Area (sq mi) | Area where the commute circle overlaps this district |
| % of District Covered | Overlap area as a fraction of total district area |
| Primary District? | TRUE if this is the campus's highest-overlap district |

### Summary Sheet

One row per campus. Aggregates the detail rows into a single record per institution.

| Column | Description |
|--------|-------------|
| IPEDS ID | Unique institution identifier |
| Institution | Campus name |
| City, State, Latitude, Longitude | Campus location |
| Enrollment | 12-month unduplicated headcount |
| Locale Code | NCES locale code (11–43) |
| Campus Type | Locale-based classification |
| Commute Radius (mi) | Assigned commute radius |
| Districts Reached | Count of congressional districts the commute circle overlaps |
| Primary District | District code with the highest fractional overlap |
| Primary District Coverage | Fractional overlap of the primary district |
| All Districts | Pipe-delimited list of all overlapping districts, ordered by overlap descending |

### Validation Sheet

Flags for data quality issues and records of removed institutions.

| Flag Type | Meaning |
|-----------|---------|
| `zero_districts` | Campus has no overlapping congressional districts (Pacific island territories) |
| `missing_locale` | Locale code is missing or -3; campus was classified using the fallback radius (22 mi) |
| `removed` | Institution was removed during data quality cleanup — either wrong sector per HD2024 or closed/merged |

## Key Assumptions

1. **Commute sheds are circular.** In practice, commuting patterns follow road networks and natural geography. Circles are a simplification that works well for nationwide analysis but overestimates reach in areas with barriers (mountains, rivers, limited road access).

2. **NPSAS:20 P75 distance determines radius.** Each campus's commute radius is set to the 75th-percentile student-to-campus distance for its NCES locale code, as computed from NPSAS:20. Urban campuses get smaller circles because students commute shorter distances in dense areas. The 12 locale-specific radii range from 15 miles (large cities) to 58 miles (remote towns).

3. **Fractional overlap is the right metric.** A campus's influence on a district is measured by what fraction of the district's land area falls within the commute shed. This means a campus in a small urban district may "cover" 30% of it, while the same campus covers only 0.5% of an adjacent rural district — reflecting the reality that community college students represent a larger share of the electorate in compact districts.

4. **Coast-clipped boundaries are correct.** The cartographic boundary files exclude water, so a campus on the coast will have a commute circle that partially covers ocean. This water area produces no district overlap, which is the correct behavior — students don't commute across water.
