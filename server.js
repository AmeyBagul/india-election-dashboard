const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const SAMPLE_FILE = path.join(__dirname, "data", "sample-results.json");
const ECI_SOURCE_URL = process.env.ECI_SOURCE_URL || "";
const ECI_HOME_URL = process.env.ECI_HOME_URL || "https://results.eci.gov.in/";
const TARGET_STATES = (process.env.TARGET_STATES || "West Bengal,Tamil Nadu")
  .split(",")
  .map((state) => normalizeSpace(state))
  .filter(Boolean);
const FETCH_INTERVAL_MS = Math.max(Number(process.env.FETCH_INTERVAL_MS || 120000), 30000);

let cachedPayload = null;
let cachedAt = 0;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store"
  });
  res.end(body);
}

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return normalizeSpace(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, "\"")
  );
}

function toNumber(value) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stateMatches(value) {
  if (!TARGET_STATES.length) return true;
  const normalized = normalizeSpace(value).toLowerCase();
  return TARGET_STATES.some((state) => normalized.includes(state.toLowerCase()));
}

function filterTargetStates(payload) {
  if (!TARGET_STATES.length) return payload;
  const filteredSeats = payload.seats.filter((seat) =>
    stateMatches(seat.state || seat.name || seat.district || "")
  );
  if (!filteredSeats.length && payload.seats.length) return payload;
  return {
    ...payload,
    states: TARGET_STATES,
    seats: filteredSeats,
    parties: filteredSeats.length ? [] : payload.parties
  };
}

function discoverElectionUrl(html, baseUrl) {
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1], baseUrl).toString());
  return links.find((link) => /(?:Result|AcResult).*May.*2026.*index\.htm/i.test(link))
    || links.find((link) => /(?:Result|AcResult).*index\.htm/i.test(link))
    || "";
}

function upcomingPayload(homeHtml) {
  const startText = stripTags((homeHtml.match(/Results trends will start[\s\S]*?(?:<\/h\d>|<\/div>|$)/i) || [])[0])
    || "Live ECI result feed is not available yet";
  return {
    source: ECI_HOME_URL,
    sourceName: "Election Commission of India",
    updatedAt: new Date().toISOString(),
    mode: "upcoming",
    electionName: `West Bengal + Tamil Nadu Election Results`,
    message: startText,
    states: TARGET_STATES,
    seats: [],
    parties: []
  };
}

function extractCells(rowHtml) {
  const cells = [];
  const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = cellPattern.exec(rowHtml))) {
    cells.push(stripTags(match[1]));
  }
  return cells;
}

function parseTables(html) {
  const tables = [];
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tablePattern.exec(html))) {
    const rows = [];
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(tableMatch[1]))) {
      const cells = extractCells(rowMatch[1]);
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function parseEciHtml(html, sourceUrl) {
  const tables = parseTables(html);
  const payload = {
    source: sourceUrl,
    sourceName: "Election Commission of India",
    updatedAt: new Date().toISOString(),
    mode: "live",
    electionName: stripTags((html.match(/<h\d[^>]*>([\s\S]*?(ELECTION|RESULT)[\s\S]*?)<\/h\d>/i) || [])[1]) || "Election Results",
    seats: [],
    parties: []
  };

  for (const rows of tables) {
    const headerIndex = rows.findIndex((row) => row.some((cell) => /constituency|candidate|party|won|leading|votes/i.test(cell)));
    if (headerIndex === -1) continue;
    const headers = rows[headerIndex].map((cell) => cell.toLowerCase());
    const partyIndex = headers.findIndex((cell) => /party/.test(cell));
    const constituencyIndex = headers.findIndex((cell) => /constituency|ac name|pc name/.test(cell));
    const candidateIndex = headers.findIndex((cell) => /candidate/.test(cell));
    const votesIndex = headers.findIndex((cell) => /vote/.test(cell));
    const marginIndex = headers.findIndex((cell) => /margin/.test(cell));
    const roundIndex = headers.findIndex((cell) => /round/.test(cell));
    const trailingCandidateIndex = headers.findIndex((cell) => /trailing candidate/.test(cell));
    const trailingPartyIndex = headers.findIndex((cell) => /trailing party/.test(cell));
    const statusIndex = headers.findIndex((cell) => /status|result|leading|won/.test(cell));
    const leadingIndex = headers.findIndex((cell) => /leading/.test(cell));
    const wonIndex = headers.findIndex((cell) => /\bwon\b|result/.test(cell));

    for (const row of rows.slice(headerIndex + 1)) {
      if (row.length < 2) continue;
      if (partyIndex >= 0 && (leadingIndex >= 0 || wonIndex >= 0) && constituencyIndex === -1 && candidateIndex === -1) {
        const party = row[partyIndex];
        if (!party || /total/i.test(party)) continue;
        payload.parties.push({
          party,
          leading: leadingIndex >= 0 ? toNumber(row[leadingIndex]) : 0,
          won: wonIndex >= 0 ? toNumber(row[wonIndex]) : 0
        });
        continue;
      }
      if (constituencyIndex >= 0 && partyIndex >= 0) {
        const constituency = row[constituencyIndex];
        const party = row[partyIndex];
        if (!constituency || !party || /total/i.test(constituency)) continue;
        payload.seats.push({
          id: constituency.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          name: constituency,
          party,
          candidate: candidateIndex >= 0 ? row[candidateIndex] : "",
          trailingCandidate: trailingCandidateIndex >= 0 ? row[trailingCandidateIndex] : "",
          trailingParty: trailingPartyIndex >= 0 ? row[trailingPartyIndex] : "",
          votes: votesIndex >= 0 ? toNumber(row[votesIndex]) : 0,
          margin: marginIndex >= 0 ? toNumber(row[marginIndex]) : 0,
          round: roundIndex >= 0 ? row[roundIndex] : "",
          status: statusIndex >= 0 ? row[statusIndex] : "Updating"
        });
      }
    }
  }

  if (!payload.seats.length && !payload.parties.length) {
    throw new Error("Could not find recognizable result tables in the ECI page.");
  }

  return payload;
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, {
      headers: {
        "user-agent": "IndiaElectionLiveSVG/1.0 (+local dashboard)",
        "accept": "text/html,application/json;q=0.9,*/*;q=0.8"
      },
      timeout: 15000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolve(requestText(new URL(response.headers.location, url).toString()));
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`ECI returned HTTP ${response.statusCode}`));
        response.resume();
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error("ECI request timed out")));
    req.on("error", reject);
  });
}

async function loadResults({ force = false } = {}) {
  if (!force && cachedPayload && Date.now() - cachedAt < FETCH_INTERVAL_MS) return cachedPayload;
  if (ECI_SOURCE_URL) {
    const body = await requestText(ECI_SOURCE_URL);
    cachedPayload = ECI_SOURCE_URL.endsWith(".json")
      ? JSON.parse(body)
      : parseEciHtml(body, ECI_SOURCE_URL);
    cachedPayload = filterTargetStates(cachedPayload);
  } else {
    try {
      const homeBody = await requestText(ECI_HOME_URL);
      const electionUrl = discoverElectionUrl(homeBody, ECI_HOME_URL);
      if (electionUrl) {
        const body = await requestText(electionUrl);
        cachedPayload = filterTargetStates(parseEciHtml(body, electionUrl));
      } else {
        cachedPayload = upcomingPayload(homeBody);
      }
    } catch (error) {
      cachedPayload = upcomingPayload("");
      cachedPayload.message = `${cachedPayload.message}. Live ECI fetch will retry automatically.`;
    }
  }
  cachedAt = Date.now();
  return cachedPayload;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, data, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === "/api/results") {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host}`);
      const data = await loadResults({ force: requestUrl.searchParams.get("refresh") === "1" });
      send(res, 200, JSON.stringify(data));
    } catch (error) {
      send(res, 502, JSON.stringify({
        error: error.message,
        source: ECI_SOURCE_URL,
        updatedAt: new Date().toISOString()
      }));
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Election dashboard running at http://localhost:${PORT}`);
  console.log(ECI_SOURCE_URL ? `Using ECI source: ${ECI_SOURCE_URL}` : "Using bundled sample data. Set ECI_SOURCE_URL for live ECI data.");
});
