# Election Data Source Strategy

Research date: 2026-05-03 IST.

## Recommended Source Priority

1. **ECI Results (`results.eci.gov.in`)**
   - Use as the live source of truth.
   - The site states that trends are filled by Returning Officers from counting centres, with final AC/PC data later shared in Form-20.
   - Current homepage shows May 2026 Assembly trends scheduled to start at 8:00 AM on 2026-05-04.
   - Good for live party totals, constituency-wise leading/winning party, candidate details, vote totals, margins, round status, and last-updated timestamp.

2. **ECI Main Site (`eci.gov.in`)**
   - Use for official schedules, press notes, post-election statistical reports, and final datasets.
   - The React pages require JavaScript, so automated collection should prefer their public backend/download APIs or linked files once discovered.
   - Best for final archival import after live counting is over.

3. **IndiaVotes (`indiavotes.com`)**
   - Use only as a reference source for historical election exploration if licensing permits.
   - It exposes historical PC and AC election navigation, summaries, alliances, search, party pages, state summaries, and election maps.
   - Its disclaimer says material is derived partly from ECI and restricts copying/reproducing/republishing unless authorized. Do not bulk-copy into our product without permission.

4. **Indiastat Elections (`indiastatelections.com`)**
   - Treat as a commercial/reference visualization source, not a primary data feed.
   - The homepage describes coverage for 543 Parliament constituencies, 4,123 Assembly constituencies, districts, sub-districts, towns, villages, and polling stations.
   - It advertises live update modules, maps, infographics, publications, and services for web/mobile/TV. This looks like a packaged data product, so do not scrape or reuse wholesale without permission.

## ECI Result Page Patterns

Observed past result pattern:

```text
https://results.eci.gov.in/ResultAcGenNov2025/index.htm
https://results.eci.gov.in/ResultAcGenNov2025/statewiseS041.htm
https://results.eci.gov.in/ResultAcGenNov2025/ConstituencywiseS041.htm
https://results.eci.gov.in/ResultAcGenNov2025/partywisewinresult-369S04.htm
```

Useful page types:

- `index.htm`: election summary, state block, party-wise won/leading/total, constituency dropdown, last updated time.
- `statewise...htm`: all constituencies at a glance, sorted alphabetically by constituency in observed Bihar 2025 output.
- `Constituencywise...htm`: one constituency candidate table with EVM votes, postal votes, total votes, vote percentage, round status, and last updated time.
- `partywisewinresult...htm`: seats won by a party, with constituency, winning candidate, total votes, margin, and status.

The exact path prefix changes by election month/year, so the collector should discover links from the homepage or configured election root instead of hard-coding only one election.

## Sorting Behavior To Mirror

- Party summary: sort by `won + leading` descending, then `won` descending, then party name.
- Constituency table/map: keep official constituency order when possible. For ECI `statewise` pages this is often alphabetical by constituency; for map rendering use constituency id to join data to SVG.
- Candidate table: preserve ECI order. In active counting this normally means vote-rank order; final pages show candidate rows in ECI table order.
- Close contests: optional app sort by absolute margin ascending.
- Recently updated: optional app sort by `updated_at` descending when we collect per-constituency pages.

## Data Model

Store raw source snapshots and normalized records separately.

Raw snapshot:

```json
{
  "source": "eci_results",
  "url": "https://results.eci.gov.in/...",
  "fetched_at": "2026-05-04T03:00:00.000Z",
  "content_hash": "sha256...",
  "body_path": "snapshots/..."
}
```

Election:

```json
{
  "id": "assembly-2026-may",
  "type": "assembly",
  "name": "General Election to Assembly Constituencies: Trends & Results May 2026",
  "states": ["Assam", "Kerala", "Puducherry", "Tamil Nadu", "West Bengal"],
  "source_root": "https://results.eci.gov.in/...",
  "status": "scheduled|counting|final"
}
```

Constituency result:

```json
{
  "election_id": "assembly-2026-may",
  "state": "Bihar",
  "constituency_no": 1,
  "constituency_name": "VALMIKI NAGAR",
  "normalized_id": "bihar-valmiki-nagar-1",
  "leading_candidate": "SURENDRA PRASAD",
  "leading_party": "Indian National Congress",
  "trailing_candidate": "DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH",
  "trailing_party": "Janata Dal (United)",
  "margin": 1675,
  "round_status": "32/32",
  "result_status": "Result Declared",
  "updated_at_source": "2025-11-14T23:51:00+05:30"
}
```

Candidate result:

```json
{
  "election_id": "assembly-2026-may",
  "constituency_id": "bihar-valmiki-nagar-1",
  "candidate": "SURENDRA PRASAD",
  "party": "Indian National Congress",
  "evm_votes": 107374,
  "postal_votes": 356,
  "total_votes": 107730,
  "vote_percent": 46.11,
  "rank": 1
}
```

Party summary:

```json
{
  "election_id": "assembly-2026-may",
  "state": "Bihar",
  "party": "Bharatiya Janata Party",
  "party_code": "BJP",
  "won": 89,
  "leading": 0,
  "total": 89
}
```

## Collection Plan

1. **Before counting day**
   - Poll `https://results.eci.gov.in/` every 5-15 minutes.
   - Detect election tiles and root links when they become active.
   - Prepare SVG maps and constituency id mappings for each state.

2. **During counting**
   - Poll active ECI election root every 30-60 seconds.
   - Parse party summary and `statewise` pages for map/table updates.
   - Queue per-constituency pages at a slower cadence, for example every 2-5 minutes, to avoid hammering ECI.
   - Store raw snapshots only when content hash changes.

3. **After result declaration**
   - Mark election `final` when all constituencies are declared.
   - Import official Form-20/statistical reports from ECI when published.
   - Keep IndiaVotes/Indiastat as cross-check/reference only, subject to permission.

## Practical Cautions

- Respect rate limits and cache aggressively.
- Show source and timestamp on every result screen.
- Do not present third-party commercial/reference data as official live data.
- Do not scrape IndiaVotes or Indiastat at scale without checking permission, because their pages indicate proprietary/restricted content or commercial data products.
