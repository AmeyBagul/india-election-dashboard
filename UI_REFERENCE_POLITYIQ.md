# PolityIQ UX Reference Notes

Research date: 2026-05-03 IST.
Reference: `https://polityiq.com/constituencies`

## What The Site Is Doing Well

PolityIQ feels polished because it is not just a table of constituencies. It behaves like an election intelligence workspace:

- Clear product framing: "West Bengal 2026", "Mother of All Elections", "294 seats", candidate tracker, swing simulator, interactive map.
- Strong dark dashboard theme with high contrast and premium political-intelligence tone.
- Uses **Inter** for readable UI text and **Oswald** for condensed uppercase display headings.
- Uses glass panels, low-opacity borders, subtle shadows, and light background texture.
- Keeps important information scannable through small badges, compact cards, party colors, and margin/status labels.
- Gives multiple ways into the same data: constituency pages, district pages, category/battleground groups, search, map, and table/list views.

## Data/Feature Patterns Observed

From the public HTML/CSS/JS bundle:

- React single-page app with bundled data and map geometry.
- West Bengal focused.
- Embedded district geometry appears in the JavaScript bundle.
- Constituency records include fields like:
  - `constituency`
  - `district`
  - `seat_no`
  - `winner_party`
  - `winner_candidate`
  - `runner_up_party`
  - `runner_up_candidate`
  - `margin_votes`
  - `seat_rating_margin_only`
- Navigation patterns include:
  - `/constituency/{slug}`
  - `/district/{slug}`
- Feature labels/logic include:
  - battleground categories
  - party tallies
  - candidate tracker
  - swing analysis/simulator
  - margin buckets
  - close-seat filtering
  - declared/pending candidate status

## Visual System Details To Borrow

Use the spirit, not the exact code:

- Dark base background: near-black navy.
- Cards: translucent dark panels with 1px low-opacity borders.
- Accent colors: blue for primary UI, amber/gold for highlights, green for declared/success, orange/amber for pending/warning.
- Typography:
  - Body: Inter or system sans.
  - Headings: narrow/condensed display face, uppercase.
- Motion:
  - Smooth hover lift on cards.
  - Soft shimmer skeletons while data is loading.
  - Smooth scroll.
- Micro UI:
  - Trust/source badges.
  - Status chips: declared, pending, live, sample, updated.
  - Slim custom scrollbars.
  - Focus-visible outlines for accessibility.

## What We Should Adapt For Our Election Results App

Our app should become a live ECI result cockpit:

1. **Top Summary**
   - Election name.
   - Live/sample/final status.
   - Last updated timestamp.
   - Total constituencies known.
   - Party tally cards.

2. **Main Map**
   - Accurate SVG or GeoJSON-derived constituency map.
   - Color by leading/winning party.
   - Hover tooltip: constituency, party, candidate, margin, round.
   - Click opens a side detail panel.

3. **Result Explorer**
   - Search by constituency, district, candidate, party.
   - Filters:
     - state
     - district
     - party
     - status: leading/won/declared
     - margin bucket: under 500, under 1,000, under 5,000, safe
   - Sorts:
     - official order
     - closest contest
     - largest margin
     - party
     - last updated

4. **Constituency Detail**
   - Leading and trailing candidate.
   - Candidate table with EVM/postal/total votes.
   - Margin and round status.
   - Result status.
   - Source URL and source timestamp.

5. **District/State Hubs**
   - Constituencies grouped by district.
   - Party tally within district.
   - Close contests in district.
   - Link back to map selection.

6. **Live Data Trust**
   - Prominent "Source: Election Commission of India" label.
   - Last fetched time and source page time.
   - Clear warning when using sample/stale data.

## Cautions

- Do not copy PolityIQ's source code, embedded map data, naming, or distinctive branded composition.
- Their data appears bundled and West Bengal specific. Use ECI as our data source and either official/open map geometry or our own SVGs.
- Keep our UI cleaner and more official-result oriented. PolityIQ is an intelligence/product site; ours is a live public result dashboard.
