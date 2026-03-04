export default function Methodology() {
  return (
    <div className="page-scroll">
      <div className="methodology-content">

        <h1>Methodology: Community College District Intersections</h1>
        <p>This document explains how the <code>cc_district_intersections.xlsx</code> workbook is produced {'\u2014'} from raw data sources through final output.</p>

        <h2>Data Sources</h2>
        <table>
          <thead>
            <tr><th>Source</th><th>Description</th><th>Provider</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>HD2023</strong></td><td>Institutional characteristics (name, location, sector, highest level of offering)</td><td>IPEDS / NCES</td></tr>
            <tr><td><strong>EFFY2023</strong></td><td>12-month unduplicated headcount enrollment</td><td>IPEDS / NCES</td></tr>
            <tr><td><strong>CB 2023 CD118 500k</strong></td><td>118th Congress congressional district boundaries (cartographic, coast-clipped)</td><td>U.S. Census Bureau</td></tr>
            <tr><td><strong>NPSAS:20</strong></td><td>75th-percentile student-to-campus distance by NCES locale code (retrieval code: swopse)</td><td>NCES PowerStats</td></tr>
          </tbody>
        </table>

        <h2>Step 1: Identify Community Colleges</h2>
        <p>Campuses are selected from HD2023 using three inclusion groups:</p>
        <table>
          <thead>
            <tr><th>Group</th><th>Filter</th><th>Count</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td><code>SECTOR = 4</code></td><td>~880</td><td>Traditional public two-year colleges</td></tr>
            <tr><td>2</td><td><code>SECTOR = 5</code></td><td>~135</td><td>Private not-for-profit two-year colleges</td></tr>
            <tr><td>3</td><td><code>SECTOR = 1</code> and <code>HLOFFER = 5</code></td><td>~245</td><td>Public institutions whose highest offering is a bachelor{'\u2019'}s degree {'\u2014'} these are community colleges that were reclassified after their states authorized them to grant bachelor{'\u2019'}s degrees (e.g., Florida, Colorado, Arizona, Washington)</td></tr>
          </tbody>
        </table>
        <p>Campuses with missing or zero coordinates are dropped. A post-processing step removes 37 additional institutions that were reclassified between HD2023 and HD2024 or whose IPEDS IDs became defunct due to mergers (primarily 11 Connecticut community colleges that consolidated into CT State Community College).</p>
        <p><strong>Final campus count: 1,219.</strong></p>

        <h2>Step 2: Join Enrollment Data</h2>
        <p>Total 12-month unduplicated headcount enrollment is joined from EFFY2023, filtered to <code>EFFYLEV = 1</code> (all students) and <code>LSTUDY = 999</code> (total across all levels of study). This is a left join {'\u2014'} campuses without enrollment data retain null values rather than being dropped.</p>

        <h2>Step 3: Classify Campus by Locale and Assign Commute Radius</h2>
        <p>Each campus is assigned a commute-shed radius based on its NCES locale code (the <code>LOCALE</code> field in HD2023). Radii come from the 75th-percentile (P75) student-to-campus crow-flies distance computed from the 2020 National Postsecondary Student Aid Study (NPSAS:20) via NCES PowerStats (retrieval code: swopse). The P75 was chosen over the median because it captures the commuting range of ~75% of students, reflecting the broader service area relevant to legislative outreach.</p>

        <h3>Per-Locale Radius Lookup</h3>
        <table>
          <thead>
            <tr><th>Locale Code</th><th>Description</th><th>P75 Radius</th></tr>
          </thead>
          <tbody>
            <tr><td>11</td><td>City Large</td><td>15 mi</td></tr>
            <tr><td>12</td><td>City Midsize</td><td>19 mi</td></tr>
            <tr><td>13</td><td>City Small</td><td>25 mi</td></tr>
            <tr><td>21</td><td>Suburb Large</td><td>15 mi</td></tr>
            <tr><td>22</td><td>Suburb Midsize</td><td>22 mi</td></tr>
            <tr><td>23</td><td>Suburb Small</td><td>22 mi</td></tr>
            <tr><td>31</td><td>Town Fringe</td><td>39 mi</td></tr>
            <tr><td>32</td><td>Town Distant</td><td>44 mi</td></tr>
            <tr><td>33</td><td>Town Remote</td><td>58 mi</td></tr>
            <tr><td>41</td><td>Rural Fringe</td><td>27 mi</td></tr>
            <tr><td>42</td><td>Rural Distant</td><td>37 mi</td></tr>
            <tr><td>43</td><td>Rural Remote</td><td>55 mi</td></tr>
          </tbody>
        </table>
        <p>Note: City Small (locale 13) uses a conservative 25-mile radius; the raw P75 of 35 miles was unstable due to small sample size.</p>

        <h3>Display Groupings</h3>
        <p>For the map legend and Excel labels, the 12 locale codes are grouped into 6 display categories:</p>
        <table>
          <thead>
            <tr><th>Label</th><th>Locale Codes</th><th>Radius Range</th></tr>
          </thead>
          <tbody>
            <tr><td>Large City</td><td>11, 21</td><td>15 mi</td></tr>
            <tr><td>Midsize City</td><td>12</td><td>19 mi</td></tr>
            <tr><td>Suburban</td><td>22, 23</td><td>22 mi</td></tr>
            <tr><td>Small City</td><td>13</td><td>25 mi</td></tr>
            <tr><td>Rural</td><td>41, 42</td><td>27{'\u2013'}37 mi</td></tr>
            <tr><td>Town / Remote</td><td>31, 32, 33, 43</td><td>39{'\u2013'}58 mi</td></tr>
          </tbody>
        </table>
        <p><strong>Fallback rule:</strong> Campuses with a missing or invalid locale code (null or -3) are assigned a 22-mile radius and the {'\u201C'}Suburban{'\u201D'} label. This affects approximately 3 campuses, primarily in U.S. territories.</p>

        <h2>Step 4: Build Commute-Shed Circles</h2>
        <p>A circular buffer is drawn around each campus point using its assigned radius. To ensure accurate area calculations, campuses are grouped by region and projected into an appropriate equal-area coordinate reference system before buffering:</p>
        <table>
          <thead>
            <tr><th>Region</th><th>CRS</th><th>EPSG</th></tr>
          </thead>
          <tbody>
            <tr><td>Continental U.S.</td><td>Albers Equal-Area Conic</td><td>5070</td></tr>
            <tr><td>Alaska</td><td>Alaska Albers</td><td>3338</td></tr>
            <tr><td>Hawaii</td><td>Hawaii Albers Equal-Area Conic</td><td>102007</td></tr>
          </tbody>
        </table>
        <p>The resulting circles represent the estimated geographic area from which a campus draws commuting students.</p>

        <h2>Step 5: Intersect Circles with Congressional Districts</h2>
        <p>Each commute-shed circle is intersected with the 118th Congress congressional district boundaries. For every circle-district pair that overlaps:</p>
        <ol>
          <li>The <strong>exact geometric intersection</strong> is computed (not a bounding-box approximation)</li>
          <li>The <strong>overlap area</strong> is measured in square miles</li>
          <li>The <strong>fractional overlap</strong> is calculated as: <code>overlap area / total district area</code></li>
        </ol>
        <p>Pairs with fractional overlap below 1% are dropped, except that every campus retains at least its single best-overlapping district (this handles campuses in large at-large districts like Alaska, Montana, and Wyoming).</p>
        <p>The district boundary files are cartographic (coast-clipped), so circles over water produce no overlap {'\u2014'} this is expected and correct for coastal campuses.</p>

        <h2>Step 6: Identify the Primary District</h2>
        <p>For each campus, the district with the highest fractional overlap is flagged as the <strong>primary district</strong>. This is the district whose geographic area is most covered by the campus{'\u2019'}s commute shed {'\u2014'} not necessarily the district where the campus is physically located (though it usually is).</p>

        <h2>Output: Excel Workbook</h2>

        <h3>Detail Sheet</h3>
        <p>One row per campus-district pair. Each row describes a single overlap between one campus{'\u2019'}s commute circle and one congressional district.</p>
        <table>
          <thead>
            <tr><th>Column</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>IPEDS ID</td><td>Unique institution identifier from IPEDS</td></tr>
            <tr><td>Institution</td><td>Campus name</td></tr>
            <tr><td>City, State</td><td>Campus location</td></tr>
            <tr><td>Latitude, Longitude</td><td>Campus coordinates</td></tr>
            <tr><td>Enrollment</td><td>12-month unduplicated headcount (EFFY2023)</td></tr>
            <tr><td>Locale Code</td><td>NCES locale code (11{'\u2013'}43) from HD2023</td></tr>
            <tr><td>Campus Type</td><td>Locale-based classification (Large City / Midsize City / Suburban / Small City / Rural / Town / Remote)</td></tr>
            <tr><td>Commute Radius (mi)</td><td>Radius of the commute-shed circle</td></tr>
            <tr><td>District</td><td>Congressional district code (e.g., {'\u201C'}CA-12{'\u201D'}, {'\u201C'}TX-AL{'\u201D'})</td></tr>
            <tr><td>District State</td><td>State abbreviation of the district</td></tr>
            <tr><td>District Number</td><td>Numeric district number (0 = at-large)</td></tr>
            <tr><td>District Area (sq mi)</td><td>Total area of the congressional district</td></tr>
            <tr><td>Overlap Area (sq mi)</td><td>Area where the commute circle overlaps this district</td></tr>
            <tr><td>% of District Covered</td><td>Overlap area as a fraction of total district area</td></tr>
            <tr><td>Primary District?</td><td>TRUE if this is the campus{'\u2019'}s highest-overlap district</td></tr>
          </tbody>
        </table>

        <h3>Summary Sheet</h3>
        <p>One row per campus. Aggregates the detail rows into a single record per institution.</p>
        <table>
          <thead>
            <tr><th>Column</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>IPEDS ID</td><td>Unique institution identifier</td></tr>
            <tr><td>Institution</td><td>Campus name</td></tr>
            <tr><td>City, State, Latitude, Longitude</td><td>Campus location</td></tr>
            <tr><td>Enrollment</td><td>12-month unduplicated headcount</td></tr>
            <tr><td>Locale Code</td><td>NCES locale code (11{'\u2013'}43)</td></tr>
            <tr><td>Campus Type</td><td>Locale-based classification</td></tr>
            <tr><td>Commute Radius (mi)</td><td>Assigned commute radius</td></tr>
            <tr><td>Districts Reached</td><td>Count of congressional districts the commute circle overlaps</td></tr>
            <tr><td>Primary District</td><td>District code with the highest fractional overlap</td></tr>
            <tr><td>Primary District Coverage</td><td>Fractional overlap of the primary district</td></tr>
            <tr><td>All Districts</td><td>Pipe-delimited list of all overlapping districts, ordered by overlap descending</td></tr>
          </tbody>
        </table>

        <h3>Validation Sheet</h3>
        <p>Flags for data quality issues and records of removed institutions.</p>
        <table>
          <thead>
            <tr><th>Flag Type</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>zero_districts</code></td><td>Campus has no overlapping congressional districts (Pacific island territories)</td></tr>
            <tr><td><code>missing_locale</code></td><td>Locale code is missing or -3; campus was classified using the fallback radius (22 mi)</td></tr>
            <tr><td><code>removed</code></td><td>Institution was removed during data quality cleanup {'\u2014'} either wrong sector per HD2024 or closed/merged</td></tr>
          </tbody>
        </table>

        <h2>Key Assumptions</h2>
        <ol>
          <li><strong>Commute sheds are circular.</strong> In practice, commuting patterns follow road networks and natural geography. Circles are a simplification that works well for nationwide analysis but overestimates reach in areas with barriers (mountains, rivers, limited road access).</li>
          <li><strong>NPSAS:20 P75 distance determines radius.</strong> Each campus{'\u2019'}s commute radius is set to the 75th-percentile student-to-campus distance for its NCES locale code, as computed from NPSAS:20. Urban campuses get smaller circles because students commute shorter distances in dense areas. The 12 locale-specific radii range from 15 miles (large cities) to 58 miles (remote towns).</li>
          <li><strong>Fractional overlap is the right metric.</strong> A campus{'\u2019'}s influence on a district is measured by what fraction of the district{'\u2019'}s land area falls within the commute shed. This means a campus in a small urban district may {'\u201C'}cover{'\u201D'} 30% of it, while the same campus covers only 0.5% of an adjacent rural district {'\u2014'} reflecting the reality that community college students represent a larger share of the electorate in compact districts.</li>
          <li><strong>Coast-clipped boundaries are correct.</strong> The cartographic boundary files exclude water, so a campus on the coast will have a commute circle that partially covers ocean. This water area produces no district overlap, which is the correct behavior {'\u2014'} students don{'\u2019'}t commute across water.</li>
        </ol>

      </div>
    </div>
  )
}
