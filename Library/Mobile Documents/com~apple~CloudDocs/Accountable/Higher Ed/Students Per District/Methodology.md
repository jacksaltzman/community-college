# Methodology: Community College District Intersections

This document explains how the `cc_district_intersections.xlsx` workbook is produced — from raw data sources through final output.

## Data Sources

| Source | Description | Provider |
|--------|-------------|----------|
| **HD2023** | Institutional characteristics (name, location, sector, highest level of offering) | IPEDS / NCES |
| **EFFY2023** | 12-month unduplicated headcount enrollment | IPEDS / NCES |
| **CB 2023 CD118 500k** | 118th Congress congressional district boundaries (cartographic, coast-clipped) | U.S. Census Bureau |
| **TIGER 2022 Tract shapefiles** | Census tract polygon boundaries for all 50 states, DC, and territories | U.S. Census Bureau |
| **ACS 5-Year (2022)** | Tract-level total population (table B01003) | U.S. Census Bureau API |

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

## Step 3: Classify Campus Density

Each campus is placed into a density category that determines its commute-shed radius. The classification works by spatial-joining each campus point to its containing Census tract, then computing tract population density:

```
density = tract population / (tract land area in sq mi)
```

| Category | Density Threshold | Commute Radius | Typical Setting |
|----------|------------------|----------------|-----------------|
| Compact | ≥ 15,000 pop/sq mi | 10 miles | Dense urban core |
| Mid-Size | 3,000 – 14,999 | 13 miles | City or inner suburb |
| Large Metro | 1,000 – 2,999 | 17 miles | Outer suburb or exurb |
| Sprawl-Fragmented | < 1,000 | 22 miles | Rural or small town |

**Fallback rule:** When tract density is zero or null (uninhabited tracts, water, data gaps), the IPEDS locale code is used instead:
- Locale 11–13 (City) → Mid-Size (13 mi)
- Locale 21–23 (Suburb) → Large Metro (17 mi)
- Locale 31–43 (Town/Rural) → Sprawl-Fragmented (22 mi)

This fallback affects approximately 13 campuses, including several in U.S. territories where Census tract data is sparse.

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
| Tract Density (pop/sq mi) | Population density of the campus's Census tract |
| Campus Type | Density classification (Compact / Mid-Size / Large Metro / Sprawl-Fragmented) |
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
| Tract Density (pop/sq mi) | Census tract density |
| Campus Type | Density classification |
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
| `missing_density` | Tract density was zero; campus was classified using the IPEDS locale code fallback |
| `removed` | Institution was removed during data quality cleanup — either wrong sector per HD2024 or closed/merged |

## Key Assumptions

1. **Commute sheds are circular.** In practice, commuting patterns follow road networks and natural geography. Circles are a simplification that works well for nationwide analysis but overestimates reach in areas with barriers (mountains, rivers, limited road access).

2. **Density determines radius.** Urban campuses get smaller circles because students commute shorter distances in dense areas. The four-tier system (10/13/17/22 miles) is based on observed commuting patterns for community college students.

3. **Fractional overlap is the right metric.** A campus's influence on a district is measured by what fraction of the district's land area falls within the commute shed. This means a campus in a small urban district may "cover" 30% of it, while the same campus covers only 0.5% of an adjacent rural district — reflecting the reality that community college students represent a larger share of the electorate in compact districts.

4. **Coast-clipped boundaries are correct.** The cartographic boundary files exclude water, so a campus on the coast will have a commute circle that partially covers ocean. This water area produces no district overlap, which is the correct behavior — students don't commute across water.
