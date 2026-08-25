// Out Of Pocket -- shared quiz core.
//
// Everything in here is pure: given the same filters it returns the same
// numbers and the same wording, with no reference to the page around it.
// That is the whole point. The live stream console in stream/overlays/
// scores a guest on air using these exact functions, so the show and the
// site can never quietly disagree about what a result was called or how
// rare it was. Change a threshold here and both move together.
//
// Loaded before script.js as a plain script, so these stay globals and
// every existing call site in script.js keeps working untouched.
// computeProbability() itself already lives in stats.js on the same
// principle -- this file is that idea extended to the wording.

function inchesToFeetInches(totalInches) {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function formatIncome(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
}

// --- Premium teaser: biggest limiting filter ---
// Reuses the per-filter probabilities already computed for the free
// result -- no separate calculation engine, no fabricated numbers. The
// "biggest limiting filter" is whichever active preference kept the
// smallest share of the population; age range is excluded since it
// defines the base population rather than acting as a preference.
const FILTER_LABELS = {
  race: "race/ethnicity preference",
  orientation: "sexual-orientation preference",
  religion: "religion preference",
  height: "minimum height preference",
  income: "minimum income preference",
  obese: "body-type preference",
  married: "marital-status preference",
  kids: "parental-status preference",
  gambles: "gambling preference",
};

function findBiggestLimitingFilter(factors) {
  const active = Object.entries(factors).filter(([, p]) => p < 0.999);
  if (active.length === 0) return null;
  active.sort((a, b) => a[1] - b[1]);
  const [key, p] = active[0];
  return { key, label: FILTER_LABELS[key], removedPct: (1 - p) * 100 };
}

const RACE_NAMES = { white: "White", black: "Black", asian: "Asian" };

const ORIENTATION_NAMES = { straight: "straight", gayLesbian: "gay or lesbian", bisexual: "bisexual" };

const RELIGION_NAMES = {
  christian: "Christian", jewish: "Jewish", muslim: "Muslim",
  hindu: "Hindu", buddhist: "Buddhist", none: "not religious",
};

// "White, Black and Asian" rather than "White, Black, Asian".
function joinNames(names) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function raceLabel(selectedRaces) {
  if (selectedRaces.length === 0) return "any race";
  return joinNames(selectedRaces.map((r) => RACE_NAMES[r]));
}

function orientationLabel(selected) {
  if (!selected || selected.length === 0) return "any orientation";
  return joinNames(selected.map((o) => ORIENTATION_NAMES[o]));
}

function religionLabel(selected) {
  if (!selected || selected.length === 0) return "any religion";
  return joinNames(selected.map((r) => RELIGION_NAMES[r]));
}

// "My Ideal Match" no longer renders on the page itself (results now
// jump straight to the Probability map + animation), but the criteria
// list is still used by the downloadable/shareable result card image.
function buildCriteriaList({ ageLo, ageHi, selectedRaces, minHeight, minIncome, excludeObese, excludeMarried, excludeKids, excludeGambles, selectedOrientations, selectedReligions }) {
  const criteria = [
    `ages ${ageLo}–${ageHi}`,
    excludeMarried ? "not married" : "any marital status",
    excludeKids ? "no kids" : "any parental status",
    raceLabel(selectedRaces),
    `at least ${inchesToFeetInches(minHeight)} tall`,
    excludeObese ? "not obese" : "any body type",
    minIncome > 0 ? `earning at least ${formatIncome(minIncome)} per year` : "any income",
  ];
  // Only listed when actually filtered on -- the card already runs long,
  // and "any orientation"/"any religion" tells the reader nothing.
  if (selectedOrientations && selectedOrientations.length > 0) criteria.push(orientationLabel(selectedOrientations));
  if (selectedReligions && selectedReligions.length > 0) criteria.push(religionLabel(selectedReligions));
  if (excludeGambles) criteria.push("doesn't gamble");
  return criteria;
}

// Which entry in the list above corresponds to a given filter key. Lives
// beside buildCriteriaList() because the two have to be edited together:
// reorder that array and these indices are wrong. Only used by the live
// stream overlay, which highlights the single filter doing the most
// damage rather than making viewers guess.
const CRITERION_INDEX = { married: 1, kids: 2, race: 3, height: 4, obese: 5, income: 6 };

function limitingCriterionText(biggest, criteria, selectedOrientations, selectedReligions) {
  if (!biggest) return "";
  const idx = CRITERION_INDEX[biggest.key];
  if (idx !== undefined) return criteria[idx] || "";
  // The remaining three are appended conditionally, so they're matched by
  // value rather than position.
  if (biggest.key === "gambles") return "doesn't gamble";
  if (biggest.key === "orientation") return orientationLabel(selectedOrientations);
  if (biggest.key === "religion") return religionLabel(selectedReligions);
  return "";
}

function formatPercentage(pct) {
  if (pct <= 0) return "0%";
  // Extreme results (e.g. Matrix-tier criteria) can round to "0.00%" at
  // two decimals, or even "0.000%" at three, even though real people
  // still match -- add a third decimal for the small tail, and fall
  // back to "<0.001%" for the very extreme tail so it never claims 0%.
  if (pct < 0.0005) return "<0.001%";
  if (pct < 0.01) return `${pct.toFixed(3)}%`;
  if (pct < 0.1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

// The same probability said the way people actually picture it: "1 in 38" is
// a room you can imagine, "2.6%" isn't. Pure restatement of pct -- no second
// calculation, so it can never disagree with the headline number.
// Shared by the report's odds line and the share-card image, so the two
// can never round the same percentage to different odds. Returns "" when
// "1 in N" would say nothing useful (N running to millions reads as
// noise) -- the percentage carries it alone in that case.
function oddsPhrase(pct, targetSex) {
  const sexWord = targetSex === "men" ? "men" : "women";
  if (!Number.isFinite(pct) || pct <= 0) return "";
  const oneIn = 100 / pct;
  // Round to something a person would actually say out loud.
  const rounded = oneIn < 10 ? Math.round(oneIn * 10) / 10
    : oneIn < 1000 ? Math.round(oneIn)
    : Math.round(oneIn / 100) * 100;
  return `That's about 1 in ${rounded.toLocaleString("en-US")} ${sexWord}`;
}

// The five pips under the score all show the level's own icon, so the icon
// has to carry the level's meaning on its own. They read as an escalating
// "how far would you have to go to find this person" ladder -- your street,
// a drive, a flight, a launch -- with the last rung leaving reality entirely.
// Colours follow the loot-rarity convention (green -> blue -> purple -> gold)
// so the meter reads as increasingly rare at a glance, ending on the neon
// green the Matrix level already uses everywhere else.
const RARITY_LEVELS = [
  { label: "Local Neighborhood 🌎", icon: "🏠", glow: "#7fe3a3" },
  { label: "Next Town Over 🚗", icon: "🚗", glow: "#6bc8ff" },
  { label: "Across the Country ✈️", icon: "✈️", glow: "#b98cff" },
  { label: "On the Moon 🌙", icon: "🚀", glow: "#ffb443" },
  // The 💊 glyph ships red, and in the film the RED pill is the one you take
  // to leave the simulation. This tier is the opposite -- you're still in it --
  // so the glyph is hue-rotated to the blue pill: the choice to stay. The glow
  // stays matrix green, which reads as a blue pill sitting inside the Matrix.
  { label: "Lost in the Matrix", icon: "💊", glow: "#00ff6a", hue: 205 },
];

// Rarity bands, from most common to rarest:
//   1/5 Local Neighborhood   60% and up
//   2/5 Next Town Over       30% - 60%
//   3/5 Across the Country   10% - 30%
//   4/5 On the Moon         2.5% - 10%
//   5/5 Lost in the Matrix  2.5% and under
//
// Split out of renderDelusionScore() so the score can be worked out
// without a page to draw it on. That function keeps every pip, glow and
// animation; this decides only what the result *is*.
function rarityFor(pct, opts) {
  let score;
  if (pct >= 60) score = 1;
  else if (pct >= 30) score = 2;
  else if (pct >= 10) score = 3;
  else if (pct > 2.5) score = 4;
  else score = 5;

  const level = RARITY_LEVELS[score - 1];
  // "Across the Country" doesn't fit once the scope actually is the whole
  // planet -- swap wording only, same icon/scene/animation as every other
  // scope (single country, U.S. free calculator, Compare).
  const label = (score === 3 && opts && opts.globalScope)
    ? "Across the Globe ✈️"
    : level.label;
  return { score, label, icon: level.icon, glow: level.glow, hue: level.hue };
}
