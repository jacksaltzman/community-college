export default function Methodology({ subView, sources }) {
  return (
    <div className="page-scroll">
      <div className="methodology-content">
        {subView === 'states' && <StateMethodology sources={sources} />}
        {subView === 'districts' && <DistrictMethodology sources={sources} />}
        {subView === 'campuses' && <CampusMethodology sources={sources} />}
      </div>
    </div>
  )
}

function StateMethodology() {
  return (
    <>
      <h1>Methodology: State-Level Data</h1>
      <p>This page describes the data sources and derivations behind the state-level fields used throughout the application.</p>

      <h2>Derived Campus Metrics</h2>
      <p>Four fields are aggregated from the campus-level dataset (see Campus methodology for how campuses are identified and intersected with districts):</p>
      <table>
        <thead>
          <tr><th>Field</th><th>Computation</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>CC Enrollment</strong></td><td>Sum of 12-month unduplicated headcount enrollment (EFFY2023) across all community college campuses in the state</td></tr>
          <tr><td><strong>Campus Count</strong></td><td>Count of community college campuses in the state</td></tr>
          <tr><td><strong>District Count</strong></td><td>Count of unique congressional districts reached by at least one campus{'\u2019'}s commute shed in the state</td></tr>
          <tr><td><strong>Avg Districts Reached</strong></td><td>Average number of districts reached per campus (total districts reached / campus count)</td></tr>
        </tbody>
      </table>

      <h2>Cook Partisan Voter Index (PVI)</h2>
      <p>State-level Cook PVI scores are sourced from the Cook Political Report{'\u2019'}s 2024 Partisan Voter Index. The PVI compares a state{'\u2019'}s average Democratic and Republican vote share in the two most recent presidential elections to the national average. A score of D+5 means the state voted 5 points more Democratic than the nation; R+3 means 3 points more Republican. EVEN indicates the state matched the national average.</p>
      <table>
        <thead>
          <tr><th>Category</th><th>PVI Range</th></tr>
        </thead>
        <tbody>
          <tr><td>D-lean</td><td>D+6 or more</td></tr>
          <tr><td>Swing</td><td>D+5 to R+5</td></tr>
          <tr><td>R-lean</td><td>R+6 or more</td></tr>
        </tbody>
      </table>

      <h2>Midterm Turnout (2022)</h2>
      <p>The 2022 midterm voter turnout percentage represents the share of the voting-eligible population (VEP) that cast ballots in the 2022 general election. This data is sourced from the United States Elections Project.</p>

      <h2>U.S. Senators</h2>
      <p>Senator data is sourced from official Senate records and the Accountable 50-State Analysis v43.6, updated as of the 119th Congress (January 2025). Five fields are tracked for each of a state{'\u2019'}s two senators:</p>
      <table>
        <thead>
          <tr><th>Field</th><th>Description</th><th>Source</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Name</strong></td><td>Senator{'\u2019'}s full name</td><td>U.S. Senate</td></tr>
          <tr><td><strong>Party</strong></td><td>Party affiliation (D, R, or I)</td><td>U.S. Senate</td></tr>
          <tr><td><strong>Next Election</strong></td><td>Year of the senator{'\u2019'}s next election (2026, 2028, or 2030)</td><td>U.S. Senate</td></tr>
          <tr><td><strong>Last Margin</strong></td><td>Victory margin (%) in the senator{'\u2019'}s most recent election</td><td>Accountable 50-State Analysis v43.6</td></tr>
          <tr><td><strong>Tax Committees</strong></td><td>Count of tax- and finance-relevant Senate committee assignments (Finance, Budget, Banking, Small Business)</td><td>senate.gov committee listings</td></tr>
        </tbody>
      </table>

      <h2>Federal Tax &amp; EITC Data</h2>
      <p>Tax and EITC fields are compiled from IRS Statistics of Income via the Accountable 50-State Analysis v43.6 (2022 tax year):</p>
      <table>
        <thead>
          <tr><th>Field</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Adult Pop (18+)</strong></td><td>Adult population age 18 and over (U.S. Census Bureau)</td></tr>
          <tr><td><strong>Total Filers</strong></td><td>Total individual income tax returns filed in the state</td></tr>
          <tr><td><strong>Fed Tax Paid ($B)</strong></td><td>Total federal income tax paid, in billions</td></tr>
          <tr><td><strong>EITC Claims (K)</strong></td><td>Number of EITC claims in thousands</td></tr>
          <tr><td><strong>EITC Participation Rate</strong></td><td>Estimated share of eligible filers who claimed the EITC</td></tr>
          <tr><td><strong>EITC Unclaimed Rate</strong></td><td>Estimated share of eligible filers who did not claim the EITC. Higher rates indicate populations that may benefit from tax assistance outreach.</td></tr>
        </tbody>
      </table>

      <h2>Young Professionals (18{'\u2013'}34)</h2>
      <p>State-level young professional population is pulled from the U.S. Census Bureau{'\u2019'}s American Community Survey (ACS) 5-Year Estimates, 2023 vintage. It sums male and female population ages 18{'\u2013'}34 from the B01001 (Sex by Age) table: ages 18{'\u2013'}19, 20, 21, 22{'\u2013'}24, 25{'\u2013'}29, and 30{'\u2013'}34 for both sexes.</p>

      <h2>College Enrollment</h2>
      <p>Total state-level college/university enrollment is pulled from ACS 2023 5-Year table B14001 (School Enrollment by Level of School). It sums <code>B14001_008E</code> (enrolled in college, undergraduate) and <code>B14001_009E</code> (enrolled in graduate or professional school). This represents all college enrollment in the state, not just community colleges.</p>

      <h2>Urban Population %</h2>
      <p>The percentage of the state{'\u2019'}s population living in urban areas, sourced from the U.S. Census Bureau{'\u2019'}s 2020 Census urbanized area delineations via the Accountable 50-State Analysis v43.6.</p>
    </>
  )
}

function DistrictMethodology({ sources }) {
  return (
    <>
      <h1>Methodology: District-Level Data</h1>
      <p>This page describes the data sources and derivations behind the congressional district-level fields.</p>

      {(() => {
        const districtFieldKeys = ['cook_pvi', 'member', 'party', 'enrollment', 'median_income', 'poverty_rate', 'pct_associates_plus', 'pct_18_24', 'house_committees', 'total_votes_2022', 'total_votes_2024', 'turnout_rate_2022', 'turnout_rate_2024', 'winner_margin_2022', 'winner_margin_2024', 'coalition_threshold']
        const districtSources = []
        const seen = new Set()
        if (sources?.fieldMap && sources?.sources) {
          for (const fk of districtFieldKeys) {
            const sk = sources.fieldMap[fk]
            if (sk && sources.sources[sk] && !seen.has(sk)) {
              seen.add(sk)
              districtSources.push(sources.sources[sk])
            }
          }
        }
        if (districtSources.length === 0) return null
        return (
          <>
            <h2>Data Sources</h2>
            <table>
              <thead>
                <tr><th>Source</th><th>Provider</th><th>Vintage</th><th>Retrieved</th></tr>
              </thead>
              <tbody>
                {districtSources.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}</strong></td>
                    <td>{s.provider}</td>
                    <td>{s.vintage}</td>
                    <td>{s.retrieved || '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      })()}

      <h2>Congressional District Boundaries</h2>
      <p>District boundaries are sourced from the U.S. Census Bureau{'\u2019'}s 118th Congress cartographic boundary files (CB 2023 CD118 500k). These are coast-clipped shapefiles at 1:500,000 resolution, suitable for nationwide thematic mapping. The boundaries cover all 435 House districts plus 6 non-voting delegates (DC, PR, GU, AS, VI, MP).</p>

      <h2>Cook Partisan Voter Index (PVI)</h2>
      <p>District-level Cook PVI scores are sourced from the Cook Political Report{'\u2019'}s 2024 Partisan Voter Index. The methodology is the same as the state-level PVI{' \u2014 '}comparing each district{'\u2019'}s average two-party presidential vote share in the two most recent elections to the national average.</p>
      <p>The same three-category classification applies:</p>
      <table>
        <thead>
          <tr><th>Category</th><th>PVI Range</th></tr>
        </thead>
        <tbody>
          <tr><td>D-lean</td><td>D+6 or more</td></tr>
          <tr><td>Swing</td><td>D+5 to R+5</td></tr>
          <tr><td>R-lean</td><td>R+6 or more</td></tr>
        </tbody>
      </table>

      <h2>Representative &amp; Party</h2>
      <p>The current U.S. House Representative and their party affiliation are sourced from official House records and updated as of the 119th Congress (January 2025). Vacant seats are shown without a representative name.</p>

      <h2>District Enrollment &amp; Campus Count</h2>
      <p>District-level enrollment and campus count are derived from the campus-district intersection analysis (see Campus methodology). A campus is counted toward a district if its commute-shed circle overlaps the district by at least 1% of the district{'\u2019'}s area. Enrollment figures represent the sum of all campuses whose commute sheds reach the district.</p>
      <p>Because a single campus can reach multiple districts, the same campus{'\u2019'}s enrollment may be counted in more than one district. This is intentional{' \u2014 '}it reflects the reality that a campus{'\u2019'}s students may live and vote in multiple congressional districts.</p>

      <h2>Census ACS Demographic Fields</h2>
      <p>Four demographic fields are sourced from the U.S. Census Bureau{'\u2019'}s American Community Survey (ACS) 5-Year Estimates, 2023 vintage (covering the 2019{'\u2013'}2023 period). All values are pulled at the congressional district level (118th Congress boundaries) via the Census API.</p>

      <table>
        <thead>
          <tr><th>Field</th><th>ACS Table</th><th>Computation</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Median Income</strong></td>
            <td>B19013</td>
            <td>Direct value from <code>B19013_001E</code> (median household income, inflation-adjusted)</td>
          </tr>
          <tr>
            <td><strong>Poverty Rate</strong></td>
            <td>B17001</td>
            <td><code>B17001_002E</code> (below poverty) / <code>B17001_001E</code> (total) &times; 100</td>
          </tr>
          <tr>
            <td><strong>% Associate{'\u2019'}s+</strong></td>
            <td>B15003</td>
            <td>Sum of <code>B15003_021E</code> through <code>B15003_025E</code> (associate{'\u2019'}s through doctorate) / <code>B15003_001E</code> (total 25+) &times; 100</td>
          </tr>
          <tr>
            <td><strong>% Age 18-24</strong></td>
            <td>B01001</td>
            <td>Sum of <code>B01001_007E</code>{'\u2013'}<code>010E</code> + <code>B01001_031E</code>{'\u2013'}<code>034E</code> (male + female 18{'\u2013'}24) / <code>B01001_001E</code> (total) &times; 100</td>
          </tr>
        </tbody>
      </table>
      <p>Census API values that are negative (sentinel codes for suppressed or unavailable data) are treated as null and displayed as {'\u201C'}{'\u2014'}{'\u201D'} in the table.</p>

      <h2>House Committee Assignments</h2>
      <p>Standing committee assignments for each House member are sourced from the Office of the Clerk{'\u2019'}s MemberData XML feed, updated for the 119th Congress (2025{'\u2013'}2027). Committees are displayed as a comma-separated list (e.g., {'\u201C'}Appropriations, Ways and Means{'\u201D'}).</p>

      <h2>Election Results (2022 &amp; 2024)</h2>
      <p>District-level election data is derived from the MIT Election Data + Science Lab (MEDSL) U.S. House Returns dataset, which covers general election results from 1976{'\u2013'}2024. Only general elections are included (no specials or runoffs), and write-in candidates are excluded.</p>

      <table>
        <thead>
          <tr><th>Field</th><th>Computation</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Votes 2022 / 2024</strong></td>
            <td>Total votes cast in the district{'\u2019'}s U.S. House general election, sourced directly from the MEDSL <code>totalvotes</code> field</td>
          </tr>
          <tr>
            <td><strong>Turnout 2022 / 2024</strong></td>
            <td>Total votes cast / citizen voting-age population (CVAP). CVAP is from ACS 2023 5-Year table B29001 (<code>B29001_001E</code>), pulled at the congressional district level via the Census API</td>
          </tr>
          <tr>
            <td><strong>Margin 2022 / 2024</strong></td>
            <td>Vote difference between 1st and 2nd place finishers. For uncontested races, margin equals total winner votes</td>
          </tr>
          <tr>
            <td><strong>Margin % 2022 / 2024</strong></td>
            <td>Winner margin as a percentage of total votes cast: <code>margin_votes / total_votes &times; 100</code></td>
          </tr>
        </tbody>
      </table>

      <h2>Coalition Threshold</h2>
      <p>An estimated number of organized users needed to influence the district{'\u2019'}s representative. This is a derived metric computed from MEDSL election returns:</p>
      <p><code>threshold = winner_margin &times; coefficient</code></p>
      <p>The coefficient scales with competitiveness:</p>
      <table>
        <thead>
          <tr><th>Margin %</th><th>Coefficient</th><th>Interpretation</th></tr>
        </thead>
        <tbody>
          <tr><td>&lt; 5%</td><td>0.05</td><td>Very competitive {'\u2014'} a small bloc matters</td></tr>
          <tr><td>5{'\u2013'}15%</td><td>0.10</td><td>Competitive</td></tr>
          <tr><td>15{'\u2013'}30%</td><td>0.15</td><td>Leaning safe</td></tr>
          <tr><td>&gt; 30%</td><td>0.20</td><td>Safe {'\u2014'} need a larger bloc</td></tr>
        </tbody>
      </table>
      <p>The result is rounded to the nearest 100 with a floor of 500 users (the minimum to be taken seriously by a representative{'\u2019'}s office). The 2024 election is used as the primary data source, with 2022 as a fallback for districts missing 2024 results.</p>

      <h2>Map Coloring</h2>
      <p>On the map, districts are colored along a blue-to-red gradient based on their Cook PVI score. Strongly Democratic districts appear blue, strongly Republican districts appear red, and swing districts appear in neutral tones. This coloring uses a continuous interpolation rather than discrete buckets, so the color intensity reflects the magnitude of the partisan lean.</p>
    </>
  )
}

function CampusMethodology() {
  return (
    <>
      <h1>Methodology: Campus-Level Data</h1>
      <p>This page explains how the campus dataset and commute-shed intersection analysis are produced{' \u2014 '}from raw data sources through final output.</p>

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
    </>
  )
}
