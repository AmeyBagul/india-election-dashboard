const fs = require("fs");

function seatId(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function marginValue(seat) {
  return Number(seat.margin ?? seat.marginVotes ?? seat.margin_votes ?? 0);
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
  const leadingVotes = Number(seat?.votes || 0);
  const trailingVotes = Number(seat?.trailingVotes || (leadingVotes && marginValue(seat) ? leadingVotes - marginValue(seat) : 0));
  return info.candidates.map((entry, index) => {
    const isLeader = candidateMatches(entry.candidate, seat?.candidate) || partyMatches(entry.party, seat?.party);
    const isTrailing = candidateMatches(entry.candidate, seat?.trailingCandidate) || partyMatches(entry.party, seat?.trailingParty);
    return {
      ...entry,
      rank: isLeader ? 1 : isTrailing ? 2 : null,
      votes: isLeader ? leadingVotes : isTrailing ? trailingVotes : 0,
      sourceOrder: index
    };
  }).sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1;
    if (b.rank) return 1;
    return a.sourceOrder - b.sourceOrder;
  });
}

const details = JSON.parse(fs.readFileSync("data/election-details.json", "utf8")).states;
const wb1 = details["west-bengal"].candidatePreview[0];
const wb2 = details["west-bengal"].candidatePreview[1];
const tn1 = details["tamil-nadu"].candidatePreview[0];
const tn2 = details["tamil-nadu"].candidatePreview[1];

const demoSeats = [
  {
    id: seatId(wb1.constituency),
    name: wb1.constituency,
    state: "West Bengal",
    district: wb1.district,
    party: wb1.candidates[0].party,
    candidate: wb1.candidates[0].candidate,
    trailingParty: wb1.candidates[1].party,
    trailingCandidate: wb1.candidates[1].candidate,
    votes: 89240,
    margin: 4132,
    round: "12/18",
    status: "Leading"
  },
  {
    id: seatId(wb2.constituency),
    name: wb2.constituency,
    state: "West Bengal",
    district: wb2.district,
    party: wb2.candidates[1].party,
    candidate: wb2.candidates[1].candidate,
    trailingParty: wb2.candidates[0].party,
    trailingCandidate: wb2.candidates[0].candidate,
    votes: 77150,
    margin: 640,
    round: "15/18",
    status: "Leading"
  },
  {
    id: seatId(tn1.constituency),
    name: tn1.constituency,
    state: "Tamil Nadu",
    district: tn1.district,
    party: tn1.candidates[0].party,
    candidate: tn1.candidates[0].candidate,
    trailingParty: tn1.candidates[1].party,
    trailingCandidate: tn1.candidates[1].candidate,
    votes: 103522,
    margin: 10890,
    round: "22/22",
    status: "Won"
  },
  {
    id: seatId(tn2.constituency),
    name: tn2.constituency,
    state: "Tamil Nadu",
    district: tn2.district,
    party: tn2.candidates[1].party,
    candidate: tn2.candidates[1].candidate,
    trailingParty: tn2.candidates[0].party,
    trailingCandidate: tn2.candidates[0].candidate,
    votes: 68211,
    margin: 289,
    round: "18/22",
    status: "Leading"
  }
];

for (const seat of demoSeats) {
  const stateId = seat.state === "West Bengal" ? "west-bengal" : "tamil-nadu";
  const info = details[stateId].candidatePreview.find((row) => seatId(row.constituency) === seatId(seat.name));
  const ranked = rankedCandidates(info, seat);
  console.log(`${seat.state} / ${seat.name}`);
  console.log(`  leading: #${ranked[0].rank} ${ranked[0].candidate} (${ranked[0].party}) votes=${ranked[0].votes}`);
  console.log(`  second:  #${ranked[1].rank} ${ranked[1].candidate} (${ranked[1].party}) votes=${ranked[1].votes}`);
  console.log(`  margin=${seat.margin}, status=${seat.status}, round=${seat.round}`);
}

const close = demoSeats.filter((seat) => marginValue(seat) > 0 && marginValue(seat) < 5000);
console.log(`close contests under 5,000: ${close.length}`);
console.log(`demo rows tested: ${demoSeats.length}`);
