# Target Tab — Airtable-Quality Filter Pills with Numeric Range Filters

**Date:** 2026-03-05

## Goal

Replace the off-the-shelf filter bar on the Target tab with an Airtable-quality pill-based design, and add 4 numeric range filters (CC Enrollment, Districts, Composite SVS, Young Professionals).

## Current State

- 4 categorical filters rendered as native `<select>` elements (Election Cycle, Senator Party, Tier, Quadrant)
- Flat layout with no visual grouping or active-state indication
- "FILTERS" label + "50 states" count on the left, dropdowns + Export on the right
- Component: `TargetFiltersBar.jsx`, styles in `target.css`

## Design

### Filter Pills

Every filter (categorical and numeric) renders as a **pill-shaped element** with two visual states:

- **Default:** White background, `1px solid var(--border-light)`, muted label text (`var(--gray-muted)`), `border-radius: 20px`, `padding: 4px 12px`
- **Active:** Background `rgba(76, 105, 113, 0.08)`, border `1px solid var(--teal)`, label stays muted, value text uses `var(--black)` with `font-weight: 600`

### Categorical Pills (existing 4 filters)

Each categorical filter becomes a pill wrapping a **styled native `<select>`**. The native `<select>` is visually stripped (no border, no background, transparent) so the pill itself provides all the chrome. The label appears as a small prefix inside the pill (e.g., "Cycle" then the select value). When the select is at its default/empty value, the pill is in default state. When a non-default value is selected, the pill shifts to active state.

### Numeric Pills (new 4 filters)

Each numeric filter is a pill containing:
- A small label (e.g., "Enrollment")
- Two compact `<input type="number">` fields (min and max), separated by a dash "–"
- Inputs are visually minimal: no border, transparent background, small width (~60px), right-aligned text
- Placeholder text shows the actual data range from the current dataset
- When either min or max has a value, the pill shifts to active state

**The 4 numeric fields:**
- CC Enrollment — `ccEnrollment` from rankedStates, `aggregate: sum`
- Districts — `districtCount` from rankedStates
- Composite SVS — `composite` from rankedStates (0-100 scale)
- Young Professionals — `youngProfessionalPop` from rankedStates

### Layout

```
[FILTERS label] [Cycle pill] [Party pill] [Tier pill] [Quadrant pill] | [Enrollment pill] [Districts pill] [SVS pill] [YP pill]  [x clear] [50 states] [Export]
```

- "FILTERS" label stays at far left as section anchor
- Categorical pills grouped left of a subtle 1px vertical divider
- Numeric pills grouped right of the divider
- "Clear all" becomes a small circle-x icon, only visible when any filter is active
- Result count ("50 states" or "23 of 50 states") as muted text near the right
- Export button at far right

### Bar Styling

- Background stays `white` (already changed from beige)
- `border-bottom: 1px solid var(--border-light)`
- `padding: 10px 24px`
- `flex-wrap: wrap` for mobile graceful degradation
- Pills use `gap: 6px` between them

### Filtering Logic

Numeric filters apply as inclusive bounds on `filteredStates` in `TargetView.jsx`:
- If `min` is set: `state[field] >= min`
- If `max` is set: `state[field] <= max`
- Both can be set independently
- Filter state stored in existing `filters` object with keys like `ccEnrollmentMin`, `ccEnrollmentMax`, etc.

### Mobile

On screens < 768px, pills wrap naturally via `flex-wrap`. No special mobile treatment needed beyond what wrapping provides.
