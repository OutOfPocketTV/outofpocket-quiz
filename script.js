(function () {
const { STATS, heightSurvival, incomeSurvival, ageRangeShare } = window.QuizStats;

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

  const pAge = ageRangeShare(targetSex, ageLo, ageHi);
  // Race/ethnicity categories are mutually exclusive in the census data,
  // so combining choices (e.g. White + Black) sums their shares.
  const pRace =
    selectedRaces.length === 0
      ? STATS.raceShare.any
      : Math.min(1, selectedRaces.reduce((sum, r) => sum + STATS.raceShare[r], 0));
  const pHeight = heightSurvival(targetSex, minHeight);
  const pIncome = incomeSurvival(targetSex, minIncome);
  const pNotObese = excludeObese ? STATS.notObeseShare[targetSex] : 1;
  const pNotMarried = excludeMarried ? 1 - STATS.marriedShare[targetSex] : 1;

  // Probability is expressed as a share of the chosen age range, i.e.
  // P(race) * P(height) * P(income) * P(not obese) * P(not married),
  // assumed independent.
  const probability = pRace * pHeight * pIncome * pNotObese * pNotMarried;
  const pct = probability * 100;

  // Absolute head count: population of the chosen sex within the age
  // range, scaled down by the same probability used for the percentage.
  const peopleInAgeRange = STATS.totalAdultPopulation[targetSex] * pAge;
  const matchingCount = Math.round(peopleInAgeRange * probability);

  const partnerGender = targetSex === "men" ? "man" : "woman";
  const criteria = renderSummary({ ageLo, ageHi, selectedRaces, minHeight, minIncome, excludeObese, excludeMarried });
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
});

const RACE_NAMES = { white: "White", black: "Black", asian: "Asian" };

function raceLabel(selectedRaces) {
  if (selectedRaces.length === 0) return "any race";
  const names = selectedRaces.map((r) => RACE_NAMES[r]);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function renderSummary({ ageLo, ageHi, selectedRaces, minHeight, minIncome, excludeObese, excludeMarried }) {
  const list = document.getElementById("summaryList");
  list.innerHTML = "";
  const items = [
    `ages ${ageLo}–${ageHi}`,
    excludeMarried ? "not married" : "any marital status",
    raceLabel(selectedRaces),
    `at least ${inchesToFeetInches(minHeight)} tall`,
    excludeObese ? "not obese" : "any body type",
    minIncome > 0 ? `earning at least ${formatIncome(minIncome)} per year` : "any income",
  ];
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });
  return items;
}

function renderDotGrid(pct) {
  const grid = document.getElementById("dotGrid");
  grid.innerHTML = "";
  const totalDots = 200;
  const matchDots = Math.max(0, Math.min(totalDots, Math.round((pct / 100) * totalDots)));
  const matchIndexes = new Set();
  while (matchIndexes.size < matchDots) {
    matchIndexes.add(Math.floor(Math.random() * totalDots));
  }
  for (let i = 0; i < totalDots; i++) {
    const dot = document.createElement("div");
    dot.className = "dot" + (matchIndexes.has(i) ? " match" : "");
    grid.appendChild(dot);
  }
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
  document.getElementById("delusionLabel").textContent = label;
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
