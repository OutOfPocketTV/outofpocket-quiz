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

  renderSummary({ ageLo, ageHi, selectedRaces, minHeight, minIncome, excludeObese, excludeMarried });
  renderDotGrid(pct);
  renderPercentage(pct);
  renderCount(matchingCount);
  renderDelusionScore(pct);

  document.getElementById("resultAgeMin").textContent = ageLo;
  document.getElementById("resultAgeMax").textContent = ageHi;
  document.getElementById("resultSexWord").textContent =
    targetSex === "men" ? "guy" : "woman";

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth" });
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

function renderPercentage(pct) {
  const el = document.getElementById("percentageResult");
  el.textContent = `${pct < 0.1 && pct > 0 ? pct.toFixed(2) : pct.toFixed(1)}%`;
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

function renderDelusionScore(pct) {
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
  } else if (score === 4) {
    stopMatrixRain();
    startMoonScene();
  } else {
    stopMatrixRain();
    stopMoonScene();
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
}
})();
