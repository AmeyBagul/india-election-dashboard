const POLL_MS = 60000;

const state = {
  data: null,
  states: [],
  electionDetails: {},
  selectedId: null,
  selectedState: "west-bengal",
  selectedRegion: null,
  selectedRegionName: "",
  mapZoom: 1,
  mapSvgState: "",
  mapSvgCache: new Map(),
  filter: "",
  party: "all",
  status: "all",
  margin: "all",
  sort: "official"
};

const partyColors = {
  BJP: "var(--bjp)",
  "Bharatiya Janata Party": "var(--bjp)",
  INC: "var(--inc)",
  "Indian National Congress": "var(--inc)",
  AAP: "var(--aap)",
  "Aam Aadmi Party": "var(--aap)",
  AITC: "var(--aitc)",
  "All India Trinamool Congress": "var(--aitc)",
  TMC: "var(--aitc)",
  Others: "var(--others)"
};

const mapPalette = [
  "#21d4a3",
  "#f4c542",
  "#ff7a59",
  "#5ea1ff",
  "#d66bff",
  "#5ee36f",
  "#ff5fa2",
  "#64d8ff",
  "#ffb15e",
  "#a8e85f"
];

const elements = {
  electionName: document.querySelector("#electionName"),
  sourceName: document.querySelector("#sourceName"),
  feedStatus: document.querySelector("#feedStatus"),
  lastUpdated: document.querySelector("#lastUpdated"),
  knownAreas: document.querySelector("#knownAreas"),
  declaredAreas: document.querySelector("#declaredAreas"),
  closeAreas: document.querySelector("#closeAreas"),
  partyCount: document.querySelector("#partyCount"),
  partyList: document.querySelector("#partyList"),
  resultsBody: document.querySelector("#resultsBody"),
  selectedArea: document.querySelector("#selectedArea"),
  seatDetails: document.querySelector("#seatDetails"),
  detailStatus: document.querySelector("#detailStatus"),
  seatCount: document.querySelector("#seatCount"),
  mapCoverage: document.querySelector("#mapCoverage"),
  mapLegend: document.querySelector("#mapLegend"),
  mapStateButtons: document.querySelector("#mapStateButtons"),
  mapTooltip: document.querySelector("#mapTooltip"),
  svgMapViewport: document.querySelector("#svgMapViewport"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
  zoomLevel: document.querySelector("#zoomLevel"),
  closeList: document.querySelector("#closeList"),
  stateSourceList: document.querySelector("#stateSourceList"),
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  stateSelect: document.querySelector("#stateSelect"),
  partyFilter: document.querySelector("#partyFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  marginFilter: document.querySelector("#marginFilter"),
  sortSelect: document.querySelector("#sortSelect")
};

function seatId(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function colorForParty(party = "") {
  return partyColors[party] || partyColors[Object.keys(partyColors).find((key) => party.includes(key))] || "var(--others)";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

function isDeclared(seat) {
  return /won|declared|result/i.test(seat.status || "");
}

function marginValue(seat) {
  return Number(seat.margin ?? seat.marginVotes ?? seat.margin_votes ?? 0);
}

function roundValue(seat) {
  return seat.round || seat.roundStatus || seat.round_status || "";
}

function selectedStateMeta() {
  return state.states.find((item) => item.id === state.selectedState) || state.states[0] || null;
}

function readableRegionName(region, index) {
  const explicit = region.querySelector("title")?.textContent
    || region.getAttribute("aria-label")
    || region.getAttribute("data-name")
    || region.getAttribute("inkscape:label")
    || region.id;
  if (explicit) {
    return explicit
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return `Constituency ${index + 1}`;
}

function regionColor(index, total) {
  return mapPalette[index % mapPalette.length];
}

function matchingSeatByName(name) {
  const id = seatId(name);
  return allSeats().find((seat) => seatId(seat.id || seat.name) === id || seatId(seat.name).includes(id));
}

function candidateRows() {
  return state.electionDetails[state.selectedState]?.candidatePreview || [];
}

function stateIdForSeat(seat) {
  if (seat?.state) return seatId(seat.state);
  const name = seat?.name || seat?.id || "";
  return Object.entries(state.electionDetails).find(([, details]) =>
    details?.candidatePreview?.some((row) => seatId(row.constituency) === seatId(name))
  )?.[0] || "";
}

function candidateInfoByNo(no) {
  return candidateRows().find((row) => Number(row.no) === Number(no)) || null;
}

function candidateInfoByName(name) {
  const details = state.electionDetails[state.selectedState];
  const id = seatId(name);
  if (!details?.candidatePreview) return null;
  const preview = details.candidatePreview.find((row) => seatId(row.constituency) === id || seatId(row.constituency).includes(id));
  if (preview) return preview;
  const bjp = details.bjpCandidates?.find((row) => seatId(row.constituency) === id || seatId(row.constituency).includes(id) || id.includes(seatId(row.constituency)));
  if (!bjp) return null;
  return {
    no: bjp.no,
    constituency: bjp.constituency,
    district: "Tamil Nadu",
    candidates: [{ alliance: "AIADMK+", party: "BJP", candidate: bjp.candidate }]
  };
}

function seatForCandidateInfo(info) {
  if (!info) return null;
  const id = seatId(info.constituency);
  return allSeats().find((seat) => {
    const seatName = seatId(seat.id || seat.name);
    return seatName === id || seatId(seat.name).includes(id) || id.includes(seatName);
  }) || null;
}

function regionCandidateInfo(region) {
  if (!region) return null;
  return candidateInfoByNo(region.dataset.constituencyNo) || candidateInfoByName(region.dataset.regionName);
}

function raceBars(seat) {
  const leadingVotes = Number(seat.votes || 0);
  const trailingVotes = Number(seat.trailingVotes || seat.trailing_votes || (leadingVotes && marginValue(seat) ? leadingVotes - marginValue(seat) : 0));
  const maxVotes = Math.max(leadingVotes, trailingVotes, 1);
  const leadWidth = Math.max((leadingVotes / maxVotes) * 100, 8);
  const trailWidth = Math.max((trailingVotes / maxVotes) * 100, 8);
  return `
    <div class="race-bars">
      <div>
        <span>Leading: ${escapeHtml(seat.party || "Updating")}</span>
        <i style="width: ${leadWidth}%; background: ${colorForParty(seat.party)}"></i>
        <em>${leadingVotes ? formatNumber(leadingVotes) : "votes pending"}</em>
      </div>
      <div>
        <span>Second: ${escapeHtml(seat.trailingParty || seat.runnerUpParty || "Updating")}</span>
        <i style="width: ${trailWidth}%; background: var(--warning)"></i>
        <em>${trailingVotes > 0 ? formatNumber(trailingVotes) : "votes pending"}</em>
      </div>
    </div>
  `;
}

function partyMatches(left = "", right = "") {
  const aliases = {
    "all-india-anna-dravida-munnetra-kazhagam": "aiadmk",
    "anna-dravida-munnetra-kazhagam": "aiadmk",
    "dravida-munnetra-kazhagam": "dmk",
    "bharatiya-janata-party": "bjp",
    "indian-national-congress": "inc",
    "all-india-trinamool-congress": "aitc",
    "trinamool-congress": "aitc",
    "communist-party-of-india-marxist": "cpi-m",
    "communist-party-of-india": "cpi",
    "all-india-forward-bloc": "aifb"
  };
  const normalizeParty = (value) => aliases[seatId(value)] || seatId(value);
  const a = normalizeParty(left);
  const b = normalizeParty(right);
  return Boolean(a && b && a === b);
}

function candidateMatches(left = "", right = "") {
  return seatId(left) && seatId(left) === seatId(right);
}

function rankedCandidates(info, seat) {
  if (!info) return [];
  const leadingVotes = Number(seat?.votes || 0);
  const trailingVotes = Number(seat?.trailingVotes || seat?.trailing_votes || (leadingVotes && marginValue(seat) ? leadingVotes - marginValue(seat) : 0));
  const rows = info.candidates.map((entry, index) => {
    const isLeader = candidateMatches(entry.candidate, seat?.candidate) || partyMatches(entry.party, seat?.party);
    const isTrailing = candidateMatches(entry.candidate, seat?.trailingCandidate || seat?.trailing) || partyMatches(entry.party, seat?.trailingParty || seat?.runnerUpParty);
    return {
      ...entry,
      rank: isLeader ? 1 : isTrailing ? 2 : null,
      votes: isLeader ? leadingVotes : isTrailing ? trailingVotes : 0,
      sourceOrder: index
    };
  });
  return rows.sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1;
    if (b.rank) return 1;
    return a.sourceOrder - b.sourceOrder;
  });
}

function candidateRankMarkup(info, seat, compact = false) {
  const rows = rankedCandidates(info, seat);
  if (!rows.length) return "";
  const hasVotes = rows.some((entry) => entry.votes > 0);
  return `
    <div class="candidate-rank-list ${compact ? "compact" : ""}">
      ${rows.map((entry, index) => {
        const rank = entry.rank || (hasVotes ? index + 1 : "");
        const isLeader = entry.rank === 1;
        return `
          <div class="candidate-rank-row ${isLeader ? "leading" : ""}">
            <span class="rank-badge">${rank ? `#${rank}` : "-"}</span>
            <div>
              <strong>${escapeHtml(entry.candidate || "Candidate pending")}</strong>
              <span>${escapeHtml(entry.party || "Party pending")} / ${escapeHtml(entry.alliance || "Alliance")}</span>
            </div>
            <em>${entry.votes ? formatNumber(entry.votes) : "votes pending"}</em>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildPartySummary(seats) {
  const summary = new Map();
  for (const seat of seats) {
    const current = summary.get(seat.party) || { party: seat.party || "Others", leading: 0, won: 0 };
    if (isDeclared(seat)) current.won += 1;
    else current.leading += 1;
    summary.set(current.party, current);
  }
  return [...summary.values()].sort((a, b) => {
    const totalDelta = (b.leading + b.won) - (a.leading + a.won);
    if (totalDelta) return totalDelta;
    const wonDelta = b.won - a.won;
    if (wonDelta) return wonDelta;
    return a.party.localeCompare(b.party);
  });
}

function partySummary() {
  const seats = state.data?.seats || [];
  const selectedSeats = allSeats();
  const parties = selectedSeats.length ? buildPartySummary(selectedSeats) : state.data?.parties?.length ? state.data.parties : buildPartySummary(seats);
  return parties.map((party) => ({
    party: party.party || "Others",
    leading: Number(party.leading || 0),
    won: Number(party.won || 0)
  })).sort((a, b) => (b.leading + b.won) - (a.leading + a.won));
}

function allSeats() {
  const seats = state.data?.seats || [];
  if (state.selectedState === "all") return seats;
  return seats.filter((seat) => stateIdForSeat(seat) === state.selectedState || seatId(seat.state || seat.name) === state.selectedState);
}

function selectedSeat() {
  return allSeats().find((seat) => seatId(seat.id || seat.name) === state.selectedId);
}

function closeSeats() {
  return allSeats()
    .filter((seat) => marginValue(seat) > 0 && marginValue(seat) < 5000)
    .sort((a, b) => marginValue(a) - marginValue(b));
}

function renderSummary() {
  const seats = allSeats();
  const parties = partySummary();
  const details = state.electionDetails[state.selectedState];
  elements.electionName.textContent = state.data?.electionName || "West Bengal + Tamil Nadu Election Results";
  elements.sourceName.textContent = state.data?.sourceName || "Election feed";
  elements.lastUpdated.textContent = state.data?.updatedAt ? `Updated ${formatTime(state.data.updatedAt)}` : "Waiting for first update";
  elements.knownAreas.textContent = formatNumber(seats.length || details?.candidateCount || details?.seats || 0);
  elements.declaredAreas.textContent = formatNumber(seats.filter(isDeclared).length);
  elements.closeAreas.textContent = formatNumber(closeSeats().length);
  elements.partyCount.textContent = formatNumber(parties.length);
}

function renderMap() {
  renderMapStateButtons();
  loadSelectedMap();
}

function renderMapStateButtons() {
  elements.mapStateButtons.innerHTML = state.states.map((item) => `
    <button class="map-state-button ${item.id === state.selectedState ? "active" : ""}" type="button" data-map-state="${escapeHtml(item.id)}">
      ${escapeHtml(item.name)}
    </button>
  `).join("");
}

function updateZoom() {
  const inner = elements.svgMapViewport.querySelector(".svg-map-inner");
  if (inner) inner.style.transform = `scale(${state.mapZoom})`;
  elements.zoomLevel.textContent = `${Math.round(state.mapZoom * 100)}%`;
}

async function loadSelectedMap() {
  const item = selectedStateMeta();
  if (!item?.localSvg) return;
  if (state.mapSvgState === item.id) {
    updateMapRegions();
    updateZoom();
    return;
  }

  elements.svgMapViewport.innerHTML = `<div class="details-empty">Loading ${escapeHtml(item.name)} map...</div>`;
  const svgText = state.mapSvgCache.get(item.id) || await fetch(item.localSvg, { cache: "no-store" }).then((response) => response.text());
  state.mapSvgCache.set(item.id, svgText);
  state.mapSvgState = item.id;
  elements.svgMapViewport.innerHTML = `<div class="svg-map-inner">${svgText.replace(/<script[\s\S]*?<\/script>/gi, "")}</div>`;

  const svg = elements.svgMapViewport.querySelector("svg");
  if (svg) {
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
  prepareMapRegions();
  updateZoom();
}

function prepareMapRegions() {
  const rows = candidateRows();
  const regions = [...elements.svgMapViewport.querySelectorAll("path, polygon")].filter((region) => {
    const fill = String(region.getAttribute("fill") || region.style.fill || "").toLowerCase();
    const box = typeof region.getBBox === "function" ? region.getBBox() : { width: 1, height: 1 };
    return fill !== "none" && box.width > 2 && box.height > 2;
  });
  const mappedRegions = rows.length ? regions.slice(0, rows.length) : regions;

  regions.forEach((region) => {
    region.classList.remove("svg-map-region", "active");
    region.style.pointerEvents = "none";
  });

  mappedRegions.forEach((region, index) => {
    const row = rows[index] || null;
    const name = row?.constituency || readableRegionName(region, index);
    const seat = matchingSeatByName(name);
    const info = row || candidateInfoByName(name);
    region.classList.add("svg-map-region");
    region.style.pointerEvents = "auto";
    region.dataset.regionName = name;
    region.dataset.regionId = seatId(name);
    if (info) {
      region.dataset.constituencyNo = info.no;
      region.dataset.district = info.district || "";
      const title = region.querySelector("title") || document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${info.no}. ${info.constituency}`;
      if (!title.parentNode) region.prepend(title);
    }
    region.style.fill = seat ? colorForParty(seat.party) : regionColor(index, regions.length);
    region.style.stroke = "#07111f";
    region.style.strokeWidth = "1.45";
    region.style.opacity = "0.94";
    region.setAttribute("tabindex", "0");
    region.setAttribute("role", "button");
    region.setAttribute("aria-label", seat ? `${seat.name}, ${seat.party}, ${seat.status}` : `${name}, ${info?.district || selectedStateMeta()?.name || "state map"}`);
  });

  updateMapRegions();
  elements.mapCoverage.textContent = rows.length ? `${formatNumber(mappedRegions.length)} candidates` : `${formatNumber(mappedRegions.length)} areas`;
}

function updateMapRegions() {
  const regions = [...elements.svgMapViewport.querySelectorAll(".svg-map-region")];
  regions.forEach((region) => {
    region.classList.toggle("active", region.dataset.regionId === state.selectedRegion);
  });
  elements.mapCoverage.textContent = regions.length ? `${formatNumber(regions.length)} candidates` : "0 areas";
}

function showMapTooltip(event, region) {
  const name = region.dataset.regionName || "Constituency";
  const info = regionCandidateInfo(region);
  const seat = seatForCandidateInfo(info) || matchingSeatByName(name);
  elements.mapTooltip.innerHTML = seat ? `
    <strong>${escapeHtml(info?.constituency || seat.name)}</strong>
    <span class="tooltip-line">${escapeHtml(info?.district || seat.district || selectedStateMeta()?.name || "")}</span>
    <span class="tooltip-line">Leading: ${escapeHtml(seat.candidate || "Candidate pending")} (${escapeHtml(seat.party || "Updating")})</span>
    <span class="tooltip-line">Margin: ${marginValue(seat) ? formatNumber(marginValue(seat)) : "Not available"} / ${escapeHtml(roundValue(seat) || seat.status || "Updating")}</span>
    ${info ? candidateRankMarkup(info, seat, true) : ""}
    ${raceBars(seat)}
  ` : info ? `
    <strong>${escapeHtml(info.no)}. ${escapeHtml(info.constituency)}</strong>
    <span class="tooltip-line">${escapeHtml(info.district)} / ${escapeHtml(selectedStateMeta()?.name || "Selected state")}</span>
    ${candidateRankMarkup(info, null, true)}
  ` : `
    <strong>${escapeHtml(name)}</strong>
    <span class="tooltip-line">${escapeHtml(selectedStateMeta()?.name || "Selected state")}</span>
    <span class="tooltip-line">Constituency data pending.</span>
  `;
  const bounds = elements.svgMapViewport.getBoundingClientRect();
  elements.mapTooltip.style.left = `${Math.min(event.clientX - bounds.left + 14, bounds.width - 280)}px`;
  elements.mapTooltip.style.top = `${Math.max(event.clientY - bounds.top + 14, 8)}px`;
  elements.mapTooltip.hidden = false;
}

function renderLegend() {
  const parties = partySummary().slice(0, 8);
  elements.mapLegend.innerHTML = parties.map((party) => `
    <span class="legend-item">
      <span class="legend-dot" style="background: ${colorForParty(party.party)}"></span>
      ${escapeHtml(party.party)}
    </span>
  `).join("");
}

function renderParties() {
  const parties = partySummary();
  elements.partyList.innerHTML = parties.map((party) => {
    const total = party.leading + party.won;
    return `
      <div class="party-row">
        <span class="swatch" style="background: ${colorForParty(party.party)}"></span>
        <div>
          <strong>${escapeHtml(party.party)}</strong>
          <div class="party-meta">${party.won} won | ${party.leading} leading</div>
        </div>
        <span class="party-score">${total}</span>
      </div>
    `;
  }).join("") || `<p class="details-empty">Party summary will appear after the first result update.</p>`;
}

function renderDetails() {
  const seat = selectedSeat();
  const selectedState = state.states.find((item) => item.id === state.selectedState);
  const details = state.electionDetails[state.selectedState];
  const selectedInfo = state.selectedRegion ? candidateInfoByNo(state.selectedRegion) || candidateInfoByName(state.selectedRegionName) : null;
  elements.selectedArea.textContent = seat ? seat.name : selectedInfo ? selectedInfo.constituency : selectedState ? selectedState.name : "Select an area";
  elements.detailStatus.textContent = seat ? (seat.status || "Updating") : "Waiting";
  if (!seat) {
    if (state.selectedRegion) {
      const info = selectedInfo;
      elements.seatDetails.innerHTML = `
        <div class="details-card">
          <div class="detail-title">
            <div>
              <strong>${escapeHtml(info?.constituency || state.selectedRegionName || state.selectedRegion.replace(/-/g, " "))}</strong>
              <span class="muted">${escapeHtml(info?.district || selectedState?.name || "Selected state")}</span>
            </div>
            <span class="tag">Awaiting ECI result</span>
          </div>
          ${info ? candidateRankMarkup(info, null) : `<p class="details-empty">Candidate data is not matched to this area yet.</p>`}
        </div>
      `;
      return;
    }
    if (details) {
      elements.seatDetails.innerHTML = `
        <div class="details-card">
          <div class="detail-grid">
            <div class="detail-item"><span>Seats</span><strong>${formatNumber(details.seats)}</strong></div>
            <div class="detail-item"><span>Majority</span><strong>${formatNumber(details.majority)}</strong></div>
            <div class="detail-item"><span>Polling</span><strong>${escapeHtml(details.polling)}</strong></div>
            <div class="detail-item"><span>Counting</span><strong>${escapeHtml(details.counting)}</strong></div>
            <div class="detail-item"><span>Candidate rows</span><strong>${formatNumber(details.candidateCount || details.candidatePreview.length)}</strong></div>
            <div class="detail-item"><span>Source note</span><strong>${escapeHtml(details.sourceNote || "Candidate table loaded from the linked source.")}</strong></div>
          </div>
          <p class="details-empty">Hover or click a constituency on the map to see candidates, rank, votes, and leading status.</p>
        </div>
      `;
      return;
    }
    elements.seatDetails.textContent = state.data?.message || "Move over or click a colored area on the SVG map.";
    return;
  }

  elements.seatDetails.innerHTML = `
    <div class="details-card">
      <div class="detail-title">
        <div>
          <strong>${escapeHtml(seat.name)}</strong>
          <span class="muted">${escapeHtml(seat.district || seat.state || "Election area")}</span>
        </div>
        <span class="tag" style="color: ${colorForParty(seat.party)}; border-color: ${colorForParty(seat.party)}">${escapeHtml(seat.party || "Updating")}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><span>Candidate</span><strong>${escapeHtml(seat.candidate || "Not available")}</strong></div>
        <div class="detail-item"><span>Status</span><strong>${escapeHtml(seat.status || "Updating")}</strong></div>
        <div class="detail-item"><span>Votes</span><strong>${formatNumber(seat.votes)}</strong></div>
        <div class="detail-item"><span>Margin</span><strong>${marginValue(seat) ? formatNumber(marginValue(seat)) : "Not available"}</strong></div>
        <div class="detail-item"><span>Trailing</span><strong>${escapeHtml(seat.trailingCandidate || seat.trailing || "Not available")}</strong></div>
        <div class="detail-item"><span>Round</span><strong>${escapeHtml(roundValue(seat) || "Not available")}</strong></div>
      </div>
      ${candidateRankMarkup(candidateInfoByName(seat.name), seat)}
      ${raceBars(seat)}
    </div>
  `;
}

function syncStateSelect() {
  const options = state.states.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  elements.stateSelect.innerHTML = options;
  if (!state.states.some((item) => item.id === state.selectedState) && state.states[0]) {
    state.selectedState = state.states[0].id;
  }
  elements.stateSelect.value = state.selectedState;
}

function syncPartyFilter() {
  const selected = elements.partyFilter.value || "all";
  const parties = [...new Set(allSeats().map((seat) => seat.party).filter(Boolean))].sort();
  elements.partyFilter.innerHTML = `<option value="all">All parties</option>${parties.map((party) => `<option value="${escapeHtml(party)}">${escapeHtml(party)}</option>`).join("")}`;
  elements.partyFilter.value = parties.includes(selected) ? selected : "all";
  state.party = elements.partyFilter.value;
}

function filteredSeats() {
  const query = state.filter.trim().toLowerCase();
  let seats = [...allSeats()];

  if (query) {
    seats = seats.filter((seat) => [seat.name, seat.district, seat.state, seat.party, seat.candidate, seat.status]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }

  if (state.party !== "all") {
    seats = seats.filter((seat) => seat.party === state.party);
  }

  if (state.status === "declared") {
    seats = seats.filter(isDeclared);
  } else if (state.status === "counting") {
    seats = seats.filter((seat) => !isDeclared(seat));
  }

  if (state.margin !== "all") {
    const limit = Number(state.margin);
    seats = seats.filter((seat) => marginValue(seat) > 0 && marginValue(seat) < limit);
  }

  seats.sort((a, b) => {
    if (state.sort === "close") return (marginValue(a) || Number.MAX_SAFE_INTEGER) - (marginValue(b) || Number.MAX_SAFE_INTEGER);
    if (state.sort === "votes") return Number(b.votes || 0) - Number(a.votes || 0);
    if (state.sort === "party") return String(a.party || "").localeCompare(String(b.party || "")) || String(a.name || "").localeCompare(String(b.name || ""));
    return 0;
  });

  return seats;
}

function renderStateSources() {
  elements.stateSourceList.innerHTML = state.states.map((item) => `
    <a class="source-card" href="${escapeHtml(item.mapUrl)}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(item.name)} - ${formatNumber(item.seats)} seats</strong>
      <span>${escapeHtml(item.status)}. Live data: ECI. Map: ${escapeHtml(item.mapSource)}.</span>
    </a>
  `).join("") || `<p class="details-empty">State source metadata is loading.</p>`;
}

function renderCloseList() {
  const seats = closeSeats().slice(0, 8);
  elements.closeList.innerHTML = seats.length ? seats.map((seat) => `
    <button class="close-card" type="button" data-row-seat="${seatId(seat.id || seat.name)}">
      <span class="tag">${formatNumber(marginValue(seat))} margin</span>
      <strong>${escapeHtml(seat.name)}</strong>
      <span class="muted">${escapeHtml(seat.party || "Updating")} - ${escapeHtml(seat.candidate || "Candidate pending")}</span>
    </button>
  `).join("") : `<p class="details-empty">Close races will appear when margin data is available.</p>`;
}

function renderTable() {
  const seats = filteredSeats();
  elements.seatCount.textContent = `${seats.length} of ${allSeats().length} areas`;
  elements.resultsBody.innerHTML = seats.map((seat) => {
    const id = seatId(seat.id || seat.name);
    return `
      <tr data-row-seat="${id}" class="${id === state.selectedId ? "active-row" : ""}">
        <td>
          <strong>${escapeHtml(seat.name)}</strong>
          <div class="muted">${escapeHtml(seat.district || seat.state || "")}</div>
        </td>
        <td><span class="party-pill" style="color: ${colorForParty(seat.party)}">${escapeHtml(seat.party || "Updating")}</span></td>
        <td>${escapeHtml(seat.candidate || "Not available")}</td>
        <td>${escapeHtml(seat.status || "Updating")}</td>
        <td>${marginValue(seat) ? formatNumber(marginValue(seat)) : "-"}</td>
        <td>${formatNumber(seat.votes)}</td>
        <td>${escapeHtml(roundValue(seat) || "-")}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="7" class="muted">No live result rows match these filters. Candidate lists are available from the map.</td></tr>`;
}

function render() {
  renderSummary();
  renderMap();
  renderLegend();
  renderParties();
  renderDetails();
  syncStateSelect();
  syncPartyFilter();
  renderStateSources();
  renderCloseList();
  renderTable();
}

async function fetchStateMetadata() {
  try {
    const response = await fetch("/data/upcoming-states.json", { cache: "no-store" });
    const data = await response.json();
    state.states = data.states || [];
    if (!state.states.some((item) => item.id === state.selectedState) && state.states[0]) {
      state.selectedState = state.states[0].id;
    }
    render();
  } catch (error) {
    elements.stateSourceList.textContent = "State metadata could not be loaded.";
  }
}

async function fetchElectionDetails() {
  try {
    const response = await fetch("/data/election-details.json", { cache: "no-store" });
    const data = await response.json();
    state.electionDetails = data.states || {};
    state.mapSvgState = "";
    render();
  } catch (error) {
    state.electionDetails = {};
  }
}

async function fetchResults({ force = false } = {}) {
  elements.refreshButton.disabled = true;
  elements.feedStatus.textContent = "Updating";
  elements.feedStatus.className = "status-pill";
  try {
    const response = await fetch(`/api/results${force ? "?refresh=1" : ""}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load results");
    state.data = data;
    const labels = { sample: "Sample data", upcoming: "Upcoming", live: "Live" };
    elements.feedStatus.textContent = labels[data.mode] || "Live";
    elements.feedStatus.className = `status-pill ${data.mode === "sample" ? "sample" : data.mode === "upcoming" ? "upcoming" : "live"}`;
    if (!state.selectedId && data.seats?.length) state.selectedId = seatId(data.seats[0].id || data.seats[0].name);
    render();
  } catch (error) {
    elements.feedStatus.textContent = "Feed error";
    elements.feedStatus.className = "status-pill error";
    elements.seatDetails.textContent = error.message;
  } finally {
    elements.refreshButton.disabled = false;
  }
}

elements.refreshButton.addEventListener("click", () => fetchResults({ force: true }));
elements.searchInput.addEventListener("input", (event) => {
  state.filter = event.target.value;
  renderTable();
});
elements.stateSelect.addEventListener("change", (event) => {
  state.selectedState = event.target.value;
  state.selectedId = null;
  state.selectedRegion = null;
  state.selectedRegionName = "";
  state.mapZoom = 1;
  render();
});
elements.partyFilter.addEventListener("change", (event) => {
  state.party = event.target.value;
  renderTable();
});
elements.statusFilter.addEventListener("change", (event) => {
  state.status = event.target.value;
  renderTable();
});
elements.marginFilter.addEventListener("change", (event) => {
  state.margin = event.target.value;
  renderTable();
});
elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderTable();
});

elements.mapStateButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-state]");
  if (!button) return;
  state.selectedState = button.dataset.mapState;
  state.selectedId = null;
  state.selectedRegion = null;
  state.selectedRegionName = "";
  state.mapZoom = 1;
  render();
});

elements.zoomInButton.addEventListener("click", () => {
  state.mapZoom = Math.min(state.mapZoom + 0.25, 3);
  updateZoom();
});

elements.zoomOutButton.addEventListener("click", () => {
  state.mapZoom = Math.max(state.mapZoom - 0.25, 0.6);
  updateZoom();
});

elements.zoomResetButton.addEventListener("click", () => {
  state.mapZoom = 1;
  elements.svgMapViewport.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  updateZoom();
});

elements.svgMapViewport.addEventListener("mousemove", (event) => {
  const region = event.target.closest(".svg-map-region");
  if (!region) {
    elements.mapTooltip.hidden = true;
    return;
  }
  showMapTooltip(event, region);
});

elements.svgMapViewport.addEventListener("mouseleave", () => {
  elements.mapTooltip.hidden = true;
});

elements.svgMapViewport.addEventListener("click", (event) => {
  const region = event.target.closest(".svg-map-region");
  if (!region) return;
  state.selectedRegion = region.dataset.regionId;
  state.selectedRegionName = region.dataset.regionName || "";
  const info = regionCandidateInfo(region);
  const seat = seatForCandidateInfo(info) || matchingSeatByName(region.dataset.regionName);
  state.selectedId = seat ? seatId(seat.id || seat.name) : null;
  updateMapRegions();
  renderDetails();
});

document.addEventListener("click", (event) => {
  const row = event.target.closest("[data-row-seat]");
  if (!row) return;
  state.selectedId = row.dataset.rowSeat;
  render();
});

fetchStateMetadata();
fetchElectionDetails();
fetchResults();
setInterval(fetchResults, POLL_MS);
