(function () {
const { STATS, computeProbability } = window.QuizStats;

let targetSex = "men"; // population being searched

function inchesToFeetInches(totalInches) {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function formatIncome(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  return value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`;
}

// Native range thumbs are inset by half their own width at the track
// edges, so a plain percentage position doesn't line up with the real
// thumb center. This converts a slider value into the actual pixel
// offset the browser renders the thumb at.
const THUMB_SIZE = 22;
function thumbPixelPosition(inputEl, value) {
  const min = Number(inputEl.min);
  const max = Number(inputEl.max);
  const percent = (value - min) / (max - min);
  const trackWidth = inputEl.clientWidth;
  return THUMB_SIZE / 2 + percent * (trackWidth - THUMB_SIZE);
}

// --- Ambient landing background (always on, purely decorative) ---
// A "wallpaper" layer behind the whole page: a soft top glow, faint
// pulsing dots along the edges, a bit of bottom bokeh, and tiny stick
// figures that wander in from the margins, "meet," and resolve into a
// heart or a deny mark before fading -- all driven by CSS keyframes with
// per-instance custom properties, re-randomized each loop via the
// animationiteration event rather than spawning/destroying DOM nodes.
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function buildAmbientEdgeDots() {
  const container = document.getElementById("ambientEdgeDots");
  for (let i = 0; i < 26; i++) {
    const dot = document.createElement("div");
    dot.className = "ambient-edge-dot";
    const onLeft = i % 2 === 0;
    const x = onLeft ? Math.random() * 12 : 88 + Math.random() * 12;
    const size = (Math.random() * 2 + 1.5).toFixed(1);
    dot.style.left = `${x}%`;
    dot.style.top = `${(Math.random() * 100).toFixed(1)}%`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.animationDelay = `${(Math.random() * 4.5).toFixed(2)}s`;
    container.appendChild(dot);
  }
}

function buildAmbientBokeh() {
  const container = document.getElementById("ambientBokeh");
  const colors = ["rgba(255, 200, 140, 0.22)", "rgba(140, 180, 255, 0.20)", "rgba(200, 150, 255, 0.18)"];
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement("div");
    dot.className = "ambient-bokeh-dot";
    const size = Math.round(20 + Math.random() * 40);
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${(Math.random() * 100).toFixed(1)}%`;
    dot.style.bottom = `${(Math.random() * 55).toFixed(1)}%`;
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(dot);
  }
}

const STICK_FIGURE_SVG =
  '<svg viewBox="0 0 20 32" width="16" height="26">' +
  '<circle cx="10" cy="5" r="4" fill="currentColor"/>' +
  '<line x1="10" y1="9" x2="10" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<line x1="10" y1="13" x2="3" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<line x1="10" y1="13" x2="17" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<line x1="10" y1="21" x2="4" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  '<line x1="10" y1="21" x2="16" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
  "</svg>";

const AMBIENT_DENY_MARKS = ["❌", "😖"];
// Fixed rows (not re-randomized) so the handful of pairs each stay in one
// quiet spot instead of jumping to a new screen position every cycle --
// that constant repositioning was what read as a chaotic "glitch."
const AMBIENT_ROWS = [14, 50, 82];

function randomizeAmbientResult(pairEl) {
  const isMatch = Math.random() < 0.5;
  pairEl.querySelector(".ambient-result").textContent = isMatch
    ? "❤️"
    : AMBIENT_DENY_MARKS[Math.floor(Math.random() * AMBIENT_DENY_MARKS.length)];
}

function buildAmbientPairs() {
  const container = document.getElementById("ambientPairs");
  AMBIENT_ROWS.forEach((row, i) => {
    const pair = document.createElement("div");
    pair.className = "ambient-pair";
    pair.innerHTML =
      `<div class="ambient-figure ambient-figure-a">${STICK_FIGURE_SVG}</div>` +
      `<div class="ambient-figure ambient-figure-b">${STICK_FIGURE_SVG}</div>` +
      `<div class="ambient-result"></div>`;
    container.appendChild(pair);

    // Position and timing are set once and never touched again -- only
    // the match/deny result varies from cycle to cycle.
    pair.style.setProperty("--row", `${row}%`);
    pair.style.setProperty("--start-a", `${(4 + Math.random() * 4).toFixed(1)}%`);
    pair.style.setProperty("--start-b", `${(4 + Math.random() * 4).toFixed(1)}%`);
    const meet = (16 + Math.random() * 8).toFixed(1);
    pair.style.setProperty("--meet-a", `${meet}%`);
    pair.style.setProperty("--meet-b", `${meet}%`);
    pair.style.setProperty("--dur", `${(8 + Math.random() * 2).toFixed(2)}s`);
    pair.style.setProperty("--delay", `${(i * 3).toFixed(2)}s`);

    randomizeAmbientResult(pair);
    pair.querySelector(".ambient-figure-a").addEventListener("animationiteration", () => {
      randomizeAmbientResult(pair);
    });
  });
}

buildAmbientEdgeDots();
buildAmbientBokeh();
if (!prefersReducedMotion) buildAmbientPairs();

// --- Matrix rain background (only shown at 5/5 "Lost in the Matrix") ---
const matrixCanvas = document.getElementById("matrixRain");
const matrixCtx = matrixCanvas.getContext("2d");
const MATRIX_FONT_SIZE = 16;
let matrixColumns = [];
let matrixAnimationId = null;

function resizeMatrixCanvas() {
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  const columnCount = Math.ceil(matrixCanvas.width / MATRIX_FONT_SIZE);
  matrixColumns = new Array(columnCount).fill(0).map(() => Math.floor(Math.random() * -50));
  matrixCtx.fillStyle = "#000";
  matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
}

function drawMatrixFrame() {
  matrixCtx.fillStyle = "rgba(0, 0, 0, 0.06)";
  matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
  matrixCtx.font = `${MATRIX_FONT_SIZE}px monospace`;
  matrixColumns.forEach((row, i) => {
    const char = Math.random() < 0.5 ? "0" : "1";
    const x = i * MATRIX_FONT_SIZE;
    const y = row * MATRIX_FONT_SIZE;
    matrixCtx.fillStyle = Math.random() < 0.03 ? "#d6ffe6" : "#00ff6a";
    matrixCtx.fillText(char, x, y);
    matrixColumns[i] = y > matrixCanvas.height && Math.random() > 0.975 ? 0 : row + 1;
  });
  matrixAnimationId = requestAnimationFrame(drawMatrixFrame);
}

function startMatrixRain() {
  if (matrixAnimationId) return;
  resizeMatrixCanvas();
  matrixCanvas.classList.add("active");
  drawMatrixFrame();
}

function stopMatrixRain() {
  matrixCanvas.classList.remove("active");
  if (matrixAnimationId) {
    cancelAnimationFrame(matrixAnimationId);
    matrixAnimationId = null;
  }
}

window.addEventListener("resize", () => {
  if (matrixAnimationId) resizeMatrixCanvas();
});

// --- Moon scene (only shown at 4/5 "On the Moon") ---
// The starfield + Earth are an ambient full-page background; the
// ship/woman/astronaut stage sits inline right under the score so it's
// visible the instant results appear, no scrolling required.
const moonScene = document.getElementById("moonScene");
const moonStarsContainer = document.getElementById("moonStars");
const moonStage = document.getElementById("moonStage");
let moonStarsBuilt = false;

function buildMoonStars() {
  if (moonStarsBuilt) return;
  const colors = ["#ffffff", "#ffffff", "#ffffff", "#ffd9f0", "#d9e8ff", "#fff6c9"];
  for (let i = 0; i < 70; i++) {
    const star = document.createElement("div");
    star.className = "moon-star";
    const size = (Math.random() * 2 + 1).toFixed(1);
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 70}%`;
    star.style.background = colors[Math.floor(Math.random() * colors.length)];
    star.style.animationDelay = `${(Math.random() * 2.6).toFixed(2)}s`;
    moonStarsContainer.appendChild(star);
  }
  moonStarsBuilt = true;
}

function startMoonScene() {
  buildMoonStars();
  moonScene.classList.add("active");

  moonStage.classList.remove("hidden");
  // Force the landing/walk/handshake animations to restart from frame
  // zero every time, so the full story plays out from the beginning
  // whenever a fresh 4/5 result appears.
  moonStage.classList.remove("stage-active");
  const actors = moonStage.querySelectorAll(".moon-ship, .moon-woman, .moon-handshake");
  actors.forEach((el) => {
    el.style.animation = "none";
  });
  void moonStage.offsetWidth; // force reflow so the reset actually takes
  actors.forEach((el) => {
    el.style.animation = "";
  });
  moonStage.classList.add("stage-active");
}

function stopMoonScene() {
  moonScene.classList.remove("active");
  moonStage.classList.add("hidden");
  moonStage.classList.remove("stage-active");
}

// --- 1/5-3/5 scenes: Local Neighborhood, Next Town Over, Across the Country ---
// Each is a plain-JS equivalent of a "component with a gender prop": one
// hidden stage per rarity level lives in the DOM, and a build*Scene()
// function sets which emoji plays the traveler vs. the one already at the
// destination based on partnerGender, before activateStage() (a
// generalized version of the restart trick startMoonScene() already uses)
// resets the CSS animations to play from frame zero.
const neighborhoodStage = document.getElementById("neighborhoodStage");
const townStage = document.getElementById("townStage");
const countryStage = document.getElementById("countryStage");
const NEW_RARITY_STAGES = [neighborhoodStage, townStage, countryStage];

const WALKING_MAN = "🚶";
const WALKING_WOMAN = "🚶‍♀️";
const WAVING_WOMAN = "🙋‍♀️";
const STANDING_MAN = "🧍‍♂️";
const STANDING_WOMAN = "🧍‍♀️";

function hideNewRarityStages() {
  NEW_RARITY_STAGES.forEach((stage) => {
    stage.classList.add("hidden");
    stage.classList.remove("stage-active");
  });
}

function activateStage(stage, actorSelector) {
  stage.classList.remove("hidden");
  stage.classList.remove("stage-active");
  const actors = stage.querySelectorAll(actorSelector);
  actors.forEach((el) => {
    el.style.animation = "none";
  });
  void stage.offsetWidth; // force reflow so the reset actually takes
  actors.forEach((el) => {
    el.style.animation = "";
  });
  stage.classList.add("stage-active");
}

function buildNeighborhoodScene(partnerGender) {
  const leftEmoji = partnerGender === "man" ? WALKING_MAN : WALKING_WOMAN;
  const rightEmoji = partnerGender === "man" ? WALKING_WOMAN : WALKING_MAN;
  document.getElementById("hoodActorLeft").textContent = leftEmoji;
  document.getElementById("hoodActorRight").textContent = rightEmoji;
  neighborhoodStage.classList.toggle("with-extra", partnerGender === "woman");
}

function buildTownScene(partnerGender) {
  const waiterEl = document.getElementById("townWaiter");
  waiterEl.textContent = partnerGender === "man" ? WAVING_WOMAN : STANDING_MAN;
}

function buildCountryScene(partnerGender) {
  const waiterEl = document.getElementById("countryWaiter");
  waiterEl.textContent = partnerGender === "man" ? STANDING_WOMAN : STANDING_MAN;
  countryStage.classList.toggle("with-extra", partnerGender === "woman");
}

function updateRarityScene(score, partnerGender) {
  hideNewRarityStages();
  if (score === 1) {
    buildNeighborhoodScene(partnerGender);
    activateStage(neighborhoodStage, ".hood-actor-left, .hood-actor-right, .hood-heart, .hood-sparkle");
  } else if (score === 2) {
    buildTownScene(partnerGender);
    activateStage(townStage, ".town-car, .town-waiter, .town-heart");
  } else if (score === 3) {
    buildCountryScene(partnerGender);
    activateStage(countryStage, ".country-plane, .country-waiter, .country-heart, .country-confetti");
  }
}

// --- Target sex toggle ---
const segButtons = document.querySelectorAll(".seg-btn");
const heroTargetWord = document.getElementById("targetWord");
segButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    segButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    targetSex = btn.dataset.sex;
    heroTargetWord.textContent = targetSex === "men" ? "man" : "woman";
  });
});

// --- Age dual slider ---
const ageMin = document.getElementById("ageMin");
const ageMax = document.getElementById("ageMax");
const ageMinBubble = document.getElementById("ageMinBubble");
const ageMaxBubble = document.getElementById("ageMaxBubble");
const dualRange = document.querySelector(".dual-slider-range");

function updateAgeSlider() {
  let minVal = parseInt(ageMin.value, 10);
  let maxVal = parseInt(ageMax.value, 10);
  if (minVal > maxVal - 1) {
    minVal = maxVal - 1;
    ageMin.value = minVal;
  }
  const minPx = thumbPixelPosition(ageMin, minVal);
  const maxPx = thumbPixelPosition(ageMax, maxVal);
  dualRange.style.left = `${minPx}px`;
  dualRange.style.width = `${maxPx - minPx}px`;
  ageMinBubble.style.left = `${minPx}px`;
  ageMaxBubble.style.left = `${maxPx}px`;
  ageMinBubble.textContent = minVal;
  ageMaxBubble.textContent = maxVal;
}
ageMin.addEventListener("input", updateAgeSlider);
ageMax.addEventListener("input", updateAgeSlider);
window.addEventListener("resize", updateAgeSlider);
updateAgeSlider();

// --- Height slider ---
const heightSlider = document.getElementById("heightSlider");
const heightBubble = document.getElementById("heightBubble");
function updateHeightBubble() {
  const val = parseInt(heightSlider.value, 10);
  heightBubble.style.left = `${thumbPixelPosition(heightSlider, val)}px`;
  heightBubble.textContent = inchesToFeetInches(val);
}
heightSlider.addEventListener("input", updateHeightBubble);
window.addEventListener("resize", updateHeightBubble);
updateHeightBubble();

// --- Income slider ---
const incomeSlider = document.getElementById("incomeSlider");
const incomeBubble = document.getElementById("incomeBubble");
function updateIncomeBubble() {
  const val = parseInt(incomeSlider.value, 10);
  incomeBubble.style.left = `${thumbPixelPosition(incomeSlider, val)}px`;
  incomeBubble.textContent = formatIncome(val);
}
incomeSlider.addEventListener("input", updateIncomeBubble);
window.addEventListener("resize", updateIncomeBubble);
updateIncomeBubble();

// --- Race multi-select ---
// "Any color or shade" is exclusive with the specific races; picking one
// or more specific races (e.g. White + Black) clears "any", and clearing
// every specific race falls back to "any" so a selection always exists.
const raceChecks = Array.from(document.querySelectorAll(".race-check"));
const anyRaceCheck = raceChecks.find((c) => c.value === "any");

raceChecks.forEach((check) => {
  check.addEventListener("change", () => {
    if (check === anyRaceCheck) {
      if (check.checked) {
        raceChecks.forEach((c) => { if (c !== anyRaceCheck) c.checked = false; });
      } else {
        check.checked = true; // never allow zero selections
      }
      return;
    }
    if (check.checked) {
      anyRaceCheck.checked = false;
    } else if (!raceChecks.some((c) => c !== anyRaceCheck && c.checked)) {
      anyRaceCheck.checked = true;
    }
  });
});

function getSelectedRaces() {
  return raceChecks.filter((c) => c.checked && c.value !== "any").map((c) => c.value);
}

// --- Filter persistence ---
// The Global Dream Partner Report is unlocked after a full-page redirect
// to Stripe Checkout and back, which reloads the page and would
// otherwise reset every slider/checkbox back to its default. Persisting
// the last-submitted filters lets the report reuse exactly what the
// visitor asked for on the free calculator.
const LAST_FILTERS_KEY = "oop_last_filters";

function saveLastFilters(filters) {
  try {
    sessionStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(filters));
  } catch (err) {
    // sessionStorage can be unavailable (private browsing, storage full);
    // the report falls back to default filters in that case.
  }
}

function loadLastFilters() {
  try {
    const raw = sessionStorage.getItem(LAST_FILTERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// --- Premium teaser: biggest limiting filter ---
// Reuses the per-filter probabilities already computed for the free
// result -- no separate calculation engine, no fabricated numbers. The
// "biggest limiting filter" is whichever active preference kept the
// smallest share of the population; age range is excluded since it
// defines the base population rather than acting as a preference.
const FILTER_LABELS = {
  race: "race/ethnicity preference",
  height: "minimum height preference",
  income: "minimum income preference",
  obese: "body-type preference",
  married: "marital-status preference",
  kids: "parental-status preference",
};

function findBiggestLimitingFilter(factors) {
  const active = Object.entries(factors).filter(([, p]) => p < 0.999);
  if (active.length === 0) return null;
  active.sort((a, b) => a[1] - b[1]);
  const [key, p] = active[0];
  return { key, label: FILTER_LABELS[key], removedPct: (1 - p) * 100 };
}

// --- Compute + render results ---
const findOutBtn = document.getElementById("findOutBtn");
const resultCard = document.getElementById("resultCard");

findOutBtn.addEventListener("click", () => {
  const ageLo = parseInt(ageMin.value, 10);
  const ageHi = parseInt(ageMax.value, 10);
  const selectedRaces = getSelectedRaces();
  const minHeight = parseInt(heightSlider.value, 10);
  const minIncome = parseInt(incomeSlider.value, 10);
  const excludeObese = document.getElementById("excludeObese").checked;
  const excludeMarried = document.getElementById("excludeMarried").checked;
  const excludeKids = document.getElementById("excludeKids").checked;

  const filters = {
    targetSex, ageLo, ageHi, selectedRaces, minHeight, minIncome,
    excludeObese, excludeMarried, excludeKids,
  };
  const { pct, matchingCount, pRace, pHeight, pIncome, pNotObese, pNotMarried, pNoKids } =
    computeProbability(STATS, filters);

  // Persisted so the Global Dream Partner Report can reuse the exact
  // same filters after the Stripe checkout redirect round-trip, which
  // reloads the page and would otherwise reset every slider/checkbox.
  saveLastFilters(filters);

  const partnerGender = targetSex === "men" ? "man" : "woman";
  const criteria = buildCriteriaList({ ageLo, ageHi, selectedRaces, minHeight, minIncome, excludeObese, excludeMarried, excludeKids });
  renderDotGrid(pct);
  renderPercentage(pct);
  renderCount(matchingCount);
  const { score, label } = renderDelusionScore(pct, partnerGender);

  document.getElementById("resultAgeMin").textContent = ageLo;
  document.getElementById("resultAgeMax").textContent = ageHi;
  document.getElementById("resultSexWord").textContent =
    targetSex === "men" ? "guy" : "woman";

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth" });

  updateShareCard({
    pctText: formatPercentage(pct),
    dreamWord: partnerGender,
    criteria,
    score,
    rarityLabel: label,
  });

  const biggestLimitingFilter = findBiggestLimitingFilter({
    race: selectedRaces.length > 0 ? pRace : 1,
    height: pHeight,
    income: minIncome > 0 ? pIncome : 1,
    obese: excludeObese ? pNotObese : 1,
    married: excludeMarried ? pNotMarried : 1,
    kids: excludeKids ? pNoKids : 1,
  });
  renderPremiumTeaser(biggestLimitingFilter);
});

// --- Premium teaser section (Global Dream Partner Report upsell) ---
const premiumTeaser = document.getElementById("premiumTeaser");
const premiumInsight = document.getElementById("premiumInsight");
const premiumLockedGrid = document.getElementById("premiumLockedGrid");
const premiumPreviewBtn = document.getElementById("premiumPreviewBtn");
const premiumUnlockBtn = document.getElementById("premiumUnlockBtn");
const premiumStatus = document.getElementById("premiumStatus");

function renderPremiumTeaser(biggestLimitingFilter) {
  premiumInsight.textContent = biggestLimitingFilter
    ? `Your ${biggestLimitingFilter.label} appears to be one of your most restrictive preferences — it narrows your pool by roughly ${Math.round(biggestLimitingFilter.removedPct)}%.`
    : "Your current preferences are fairly broad — see how the picture changes across the globe.";
  premiumTeaser.classList.remove("hidden");
}

premiumPreviewBtn.addEventListener("click", () => {
  const isExpanded = premiumPreviewBtn.getAttribute("aria-expanded") === "true";
  premiumPreviewBtn.setAttribute("aria-expanded", String(!isExpanded));
  premiumLockedGrid.classList.toggle("hidden", isExpanded);
  premiumPreviewBtn.textContent = isExpanded ? "Preview What's Included" : "Hide Preview";
});

function showPremiumStatus(kind, message) {
  premiumStatus.className = `premium-status status-${kind}`;
  premiumStatus.textContent = message;
  premiumStatus.classList.remove("hidden");
}

premiumUnlockBtn.addEventListener("click", async () => {
  premiumUnlockBtn.disabled = true;
  premiumUnlockBtn.textContent = "Redirecting to checkout…";
  try {
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    if (!res.ok) throw new Error("Checkout session request failed");
    const { url } = await res.json();
    if (!url) throw new Error("No checkout URL returned");
    window.location.href = url;
  } catch (err) {
    showPremiumStatus("error", "Something went wrong starting checkout. Please try again in a moment.");
    premiumUnlockBtn.disabled = false;
    premiumUnlockBtn.textContent = "Unlock My Global Report";
  }
});

// --- Global Dream Partner Report: country selector + comparison table ---
// Renders only after report-access confirms a webhook-verified purchase.
// All figures reuse the exact same computeProbability() math as the free
// U.S. calculator, run against each country's real (or region-estimated)
// data from countries.js -- no separate/fabricated calculation path.
const globalReport = document.getElementById("globalReport");
const reportCountrySelect = document.getElementById("reportCountrySelect");
const reportTableBody = document.getElementById("reportTableBody");
const reportShowAllBtn = document.getElementById("reportShowAllBtn");

const TIER_LABELS = {
  full: "Full country data",
  regional: "Regional estimate",
};

function populateCountrySelect() {
  const { listCountriesByContinent } = window.QuizGlobalStats;
  const groups = listCountriesByContinent();
  reportCountrySelect.innerHTML = "";
  Object.keys(groups)
    .sort()
    .forEach((continent) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = continent;
      groups[continent].forEach(({ code, name }) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = name;
        optgroup.appendChild(option);
      });
      reportCountrySelect.appendChild(optgroup);
    });
  reportCountrySelect.value = "US";
}

function computeCountryResult(code, filters) {
  const { getCountryStats, getCountryMeta } = window.QuizGlobalStats;
  const stats = getCountryStats(code);
  const meta = getCountryMeta(code);
  if (!stats || !meta) return null;
  return { ...computeProbability(stats, filters), meta };
}

function renderSelectedCountryResult(filters) {
  const code = reportCountrySelect.value;
  const result = computeCountryResult(code, filters);
  if (!result) return;

  const sexWord = filters.targetSex === "men" ? "men" : "women";
  document.getElementById("reportResultCountry").textContent = result.meta.name;
  document.getElementById("reportPercentage").textContent = formatPercentage(result.pct);
  document.getElementById("reportResultText").textContent =
    `That's roughly ${result.matchingCount.toLocaleString("en-US")} ${sexWord} in ${result.meta.name} who fit your standards.`;
  const badge = document.getElementById("reportTierBadge");
  badge.textContent = TIER_LABELS[result.meta.tier];
  badge.className = `tier-badge tier-${result.meta.tier}`;
  document.getElementById("reportSourceNote").textContent = result.meta.sourceNote;
}

// Ranks the visitor's exact filters against every country in
// countries.js so "maximum reach" means every country is actually
// comparable, not just a curated handful -- collapsed behind a "Show
// all" toggle (same progressive-disclosure pattern as the locked
// preview grid) so the page doesn't open with a ~195-row table.
const REPORT_PREVIEW_ROWS = 12;
let reportShowingAll = false;

function renderComparisonTable(filters) {
  const { COUNTRIES } = window.QuizGlobalStats;
  const results = Object.keys(COUNTRIES)
    .map((code) => computeCountryResult(code, filters))
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);

  const rows = reportShowingAll ? results : results.slice(0, REPORT_PREVIEW_ROWS);
  reportTableBody.innerHTML = "";
  rows.forEach((result) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${result.meta.name}</td>
      <td>${formatPercentage(result.pct)}</td>
      <td><span class="tier-badge tier-${result.meta.tier}">${TIER_LABELS[result.meta.tier]}</span></td>
    `;
    reportTableBody.appendChild(tr);
  });

  reportShowAllBtn.textContent = reportShowingAll
    ? "Show top 12 only"
    : `Show all ${results.length} countries`;
}

function renderGlobalReport(filters) {
  const resolvedFilters = filters || {
    targetSex: "men", ageLo: 20, ageHi: 40, selectedRaces: [], minHeight: 68,
    minIncome: 0, excludeObese: false, excludeMarried: false, excludeKids: false,
  };
  populateCountrySelect();
  renderSelectedCountryResult(resolvedFilters);
  renderComparisonTable(resolvedFilters);

  reportCountrySelect.onchange = () => renderSelectedCountryResult(resolvedFilters);
  reportShowAllBtn.onclick = () => {
    reportShowingAll = !reportShowingAll;
    renderComparisonTable(resolvedFilters);
  };

  globalReport.classList.remove("hidden");
}

// Handle the return trip from Stripe Checkout (?session_id=...&status=success|cancelled).
// Access is never granted from this redirect alone -- report-access verifies
// against our own server-side record of the webhook-confirmed payment.
(function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const sessionId = params.get("session_id");
  if (!status) return;

  premiumTeaser.classList.remove("hidden");

  if (status === "cancelled") {
    showPremiumStatus("cancelled", "Checkout was cancelled — no charge was made. You can try again anytime.");
    return;
  }

  if (status === "success" && sessionId) {
    showPremiumStatus("verifying", "Verifying your purchase…");
    fetch(`/api/report-access?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.access === "granted") {
          showPremiumStatus("unlocked", "Purchase verified! Your Global Dream Partner Report is ready below.");
          premiumUnlockBtn.classList.add("hidden");
          premiumPreviewBtn.classList.add("hidden");
          premiumLockedGrid.classList.add("hidden");
          renderGlobalReport(loadLastFilters());
        } else {
          showPremiumStatus("error", "We couldn't verify this purchase yet. If you were just charged, refresh in a few seconds — the confirmation can take a moment to arrive.");
        }
      })
      .catch(() => {
        showPremiumStatus("error", "We couldn't verify this purchase right now. Please refresh, or contact us if the charge went through.");
      });
  }
})();

const RACE_NAMES = { white: "White", black: "Black", asian: "Asian" };

function raceLabel(selectedRaces) {
  if (selectedRaces.length === 0) return "any race";
  const names = selectedRaces.map((r) => RACE_NAMES[r]);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// "My Ideal Match" no longer renders on the page itself (results now
// jump straight to the Probability map + animation), but the criteria
// list is still used by the downloadable/shareable result card image.
function buildCriteriaList({ ageLo, ageHi, selectedRaces, minHeight, minIncome, excludeObese, excludeMarried, excludeKids }) {
  return [
    `ages ${ageLo}–${ageHi}`,
    excludeMarried ? "not married" : "any marital status",
    excludeKids ? "no kids" : "any parental status",
    raceLabel(selectedRaces),
    `at least ${inchesToFeetInches(minHeight)} tall`,
    excludeObese ? "not obese" : "any body type",
    minIncome > 0 ? `earning at least ${formatIncome(minIncome)} per year` : "any income",
  ];
}

// A simplified (not survey-accurate) outline of the continental U.S., as
// percentages of the .dot-grid box. Built from real coastal/border
// reference points (Cape Flattery, Florida tip, Cape Cod, Brownsville,
// the 49th-parallel border, etc.) rather than freehand guessing, so key
// landmarks -- Florida, Texas, Cape Cod, the Great Lakes notch -- read
// recognizably instead of a rough blob.
const US_OUTLINE = [
  [0.5, 2.4], [1.6, 8.2], [1.7, 11.2], [1.9, 14.3], [1.0, 23.3], [1.0, 35.1],
  [2.1, 41.2], [4.3, 45.7], [5.3, 50.6], [7.6, 59.4], [9.1, 59.6], [11.4, 62.2],
  [12.8, 64.5], [13.5, 67.2], [17.8, 67.3], [24.1, 71.8], [29.0, 71.9],
  [31.9, 70.2], [34.7, 79.2], [44.0, 91.4], [48.0, 93.3], [48.3, 85.7],
  [51.2, 81.2], [53.8, 78.0], [57.8, 80.0], [61.4, 80.0], [61.9, 75.9],
  [63.8, 75.5], [65.2, 75.1], [69.0, 78.0], [72.4, 80.4], [73.1, 85.3],
  [74.5, 92.7], [76.7, 96.3], [77.3, 93.5], [77.5, 89.0], [76.6, 83.3],
  [75.2, 76.3], [75.7, 73.5], [76.4, 69.0], [79.5, 61.6], [81.2, 60.4],
  [85.3, 56.1], [84.7, 53.1], [84.7, 48.2], [85.9, 44.9], [86.4, 41.0],
  [87.9, 34.7], [88.0, 34.3], [91.6, 31.4], [93.3, 30.2], [94.8, 28.4],
  [93.4, 26.1], [94.6, 22.0], [96.6, 19.2], [97.9, 18.8], [100.0, 17.1],
  [96.6, 6.9], [92.2, 16.3], [86.2, 16.3], [79.5, 22.0], [72.4, 27.3],
  [71.6, 20.4], [69.5, 13.1], [63.8, 10.2], [60.3, 9.4], [56.9, 9.4],
  [52.1, 0.3], [51.5, 0.3], [47.9, 0.3], [36.1, 0.3], [15.4, 0.3],
];

function isPointInOutline(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// Computed once: every grid cell whose center falls inside the outline,
// kept on a perfectly straight grid (no jitter -- a handful of single
// -cell pinholes from the point-in-polygon test at the shape's concave
// spots were the actual "gaps," not the grid alignment itself, so this
// fills those isolated holes directly instead of scattering the dots).
let usMapPoints = null;
function getUsMapPoints() {
  if (usMapPoints) return usMapPoints;
  const cols = 58;
  const rows = 32;
  const inside = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * 100;
      const y = ((r + 0.5) / rows) * 100;
      row.push(isPointInOutline(x, y, US_OUTLINE));
    }
    inside.push(row);
  }
  // Fill single-cell pinholes: a cell outside the outline but with at
  // least 3 of its 4 orthogonal neighbors inside is almost certainly a
  // sampling artifact at a concave edge, not a real gap in the shape.
  const filled = inside.map((row) => row.slice());
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (inside[r][c]) continue;
      let neighborsInside = 0;
      if (r > 0 && inside[r - 1][c]) neighborsInside++;
      if (r < rows - 1 && inside[r + 1][c]) neighborsInside++;
      if (c > 0 && inside[r][c - 1]) neighborsInside++;
      if (c < cols - 1 && inside[r][c + 1]) neighborsInside++;
      if (neighborsInside >= 3) filled[r][c] = true;
    }
  }

  const points = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (filled[r][c]) {
        points.push({ x: ((c + 0.5) / cols) * 100, y: ((r + 0.5) / rows) * 100 });
      }
    }
  }
  usMapPoints = points;
  return points;
}

function renderDotGrid(pct) {
  const grid = document.getElementById("dotGrid");
  grid.innerHTML = "";
  const points = getUsMapPoints();
  const totalDots = points.length;
  const matchDots = Math.max(0, Math.min(totalDots, Math.round((pct / 100) * totalDots)));
  const matchIndexes = new Set();
  while (matchIndexes.size < matchDots) {
    matchIndexes.add(Math.floor(Math.random() * totalDots));
  }
  points.forEach((point, i) => {
    const dot = document.createElement("div");
    dot.className = "dot" + (matchIndexes.has(i) ? " match" : "");
    dot.style.left = `${point.x}%`;
    dot.style.top = `${point.y}%`;
    grid.appendChild(dot);
  });
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

function renderPercentage(pct) {
  document.getElementById("percentageResult").textContent = formatPercentage(pct);
}

function renderCount(matchingCount) {
  const el = document.getElementById("countText");
  const sexWord = targetSex === "men" ? "men" : "women";
  el.textContent = `That's roughly ${matchingCount.toLocaleString("en-US")} ${sexWord} in the U.S. who fit your standards.`;
}

const RARITY_LEVELS = [
  { label: "Local Neighborhood 🌎", icon: "📍" },
  { label: "Next Town Over 🚗", icon: "📍" },
  { label: "Across the Country ✈️", icon: "📍" },
  { label: "On the Moon 🌙", icon: "📍" },
  { label: "Lost in the Matrix", icon: "📍" },
];

function renderDelusionScore(pct, partnerGender) {
  let score;
  if (pct >= 25) score = 1;
  else if (pct >= 10) score = 2;
  else if (pct >= 3) score = 3;
  else if (pct >= 1) score = 4;
  else score = 5;

  const { label, icon } = RARITY_LEVELS[score - 1];

  if (score === 5) {
    startMatrixRain();
    stopMoonScene();
    hideNewRarityStages();
  } else if (score === 4) {
    stopMatrixRain();
    startMoonScene();
    hideNewRarityStages();
  } else {
    stopMatrixRain();
    stopMoonScene();
    updateRarityScene(score, partnerGender);
  }

  const row = document.getElementById("litterRow");
  row.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement("span");
    span.textContent = icon;
    if (i > score) span.classList.add("dim");
    row.appendChild(span);
  }
  document.getElementById("delusionScore").textContent = `${score}/5`;
  const labelEl = document.getElementById("delusionLabel");
  labelEl.textContent = label;
  labelEl.classList.toggle("matrix-label", score === 5);
  document.getElementById("resultCard").classList.toggle("matrix-see-through", score === 5);
  return { score, label };
}

// --- Shareable result card ---
const SITE_URL = "https://outofpocket.tv";
const RARITY_ACCENTS = ["#ffffff", "#ffffff", "#ffffff", "#cbb8e8", "#00ff6a"];

const shareLogoImg = new Image();
shareLogoImg.src = "logo-mark.png";

let lastShareData = null;
let lastShareCanvas = null;

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawShareCard(data) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  const accent = RARITY_ACCENTS[data.score - 1];
  const cx = canvas.width / 2;

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (data.score === 5) {
    bg.addColorStop(0, "#0d0d0d");
    bg.addColorStop(1, "#000000");
  } else if (data.score === 4) {
    bg.addColorStop(0, "#3a2166");
    bg.addColorStop(1, "#07061a");
  } else {
    bg.addColorStop(0, "#1d1d1d");
    bg.addColorStop(1, "#0a0a0a");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (shareLogoImg.complete && shareLogoImg.naturalWidth > 0) {
    const logoSize = 150;
    ctx.drawImage(shareLogoImg, cx - logoSize / 2, 110, logoSize, logoSize);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 56px Arial";
  ctx.fillText("OUT OF POCKET TV", cx, 340);

  const pctGradient = ctx.createLinearGradient(0, 560, 0, 780);
  pctGradient.addColorStop(0, "#ffffff");
  pctGradient.addColorStop(1, accent);
  ctx.fillStyle = pctGradient;
  ctx.font = "800 220px Arial";
  ctx.fillText(data.pctText, cx, 780);

  ctx.fillStyle = "#b7b7b7";
  ctx.font = "44px Arial";
  const subtitleLines = wrapLines(
    ctx,
    `chance the ${data.dreamWord} of my dreams exists`,
    900
  );
  subtitleLines.forEach((line, i) => {
    ctx.fillText(line, cx, 860 + i * 56);
  });

  let y = 1060 + (subtitleLines.length - 1) * 56;
  ctx.font = "38px Arial";
  ctx.fillStyle = "#d6d6d6";
  data.criteria.forEach((line) => {
    ctx.fillText(line, cx, y);
    y += 58;
  });

  y += 30;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  const badgeText = `${data.score}/5  ·  ${data.rarityLabel}`;
  ctx.font = "700 42px Arial";
  const badgeWidth = ctx.measureText(badgeText).width + 80;
  const badgeHeight = 84;
  const radius = badgeHeight / 2;
  const bx = cx - badgeWidth / 2;
  const by = y;
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.arcTo(bx + badgeWidth, by, bx + badgeWidth, by + badgeHeight, radius);
  ctx.arcTo(bx + badgeWidth, by + badgeHeight, bx, by + badgeHeight, radius);
  ctx.arcTo(bx, by + badgeHeight, bx, by, radius);
  ctx.arcTo(bx, by, bx + badgeWidth, by, radius);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(badgeText, cx, by + badgeHeight / 2 + 15);

  ctx.fillStyle = "#9a9a9a";
  ctx.font = "36px Arial";
  ctx.fillText("Take the quiz yourself", cx, 1800);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Arial";
  ctx.fillText("outofpocket.tv", cx, 1860);

  return canvas;
}

function updateShareCard(data) {
  lastShareData = data;
  const render = () => {
    lastShareCanvas = drawShareCard(data);
    document.getElementById("shareCardImg").src = lastShareCanvas.toDataURL("image/png");
  };
  if (shareLogoImg.complete) {
    render();
  } else {
    shareLogoImg.addEventListener("load", render, { once: true });
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function shareCaption() {
  if (!lastShareData) return "";
  return `I have a ${lastShareData.pctText} chance the ${lastShareData.dreamWord} of my dreams exists (Dream Partner Rarity: ${lastShareData.score}/5 — ${lastShareData.rarityLabel}). Check your odds at ${SITE_URL}`;
}

function downloadShareCard() {
  if (!lastShareCanvas) return;
  const link = document.createElement("a");
  link.download = "out-of-pocket-result.png";
  link.href = lastShareCanvas.toDataURL("image/png");
  link.click();
}

async function shareToDeviceSheet() {
  const shareHint = document.getElementById("shareHint");
  if (!lastShareCanvas) return;
  try {
    const blob = await canvasToBlob(lastShareCanvas);
    const file = new File([blob], "out-of-pocket-result.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: shareCaption() });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text: shareCaption(), url: SITE_URL });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // user cancelled the share sheet
  }
  downloadShareCard();
  shareHint.textContent = "Your device doesn't support direct sharing, so the image downloaded instead — upload it manually.";
}

function openShareIntent(platform) {
  const text = encodeURIComponent(shareCaption());
  const url = encodeURIComponent(SITE_URL);
  const intents = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?text=${text}`,
    whatsapp: `https://wa.me/?text=${text}`,
    reddit: `https://www.reddit.com/submit?url=${url}&title=${encodeURIComponent(shareCaption())}`,
  };
  window.open(intents[platform], "_blank", "noopener");
}

document.querySelectorAll(".share-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const platform = btn.dataset.share;
    if (platform === "download") {
      downloadShareCard();
    } else if (platform === "instagram" || platform === "tiktok" || platform === "snapchat") {
      shareToDeviceSheet();
    } else {
      openShareIntent(platform);
    }
  });
});
})();
