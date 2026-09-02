(function () {
const { STATS, computeProbability, ageRangeShare, normalizeBodyTypes, bodyTypeFilterActive } = window.QuizStats;

// Fires a GA4 event via the gtag() loaded in index.html's <head>. Guarded
// because ad blockers commonly block Google Analytics -- gtag being
// missing must never break the actual calculator for a visitor running one.
function trackEvent(name, params) {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params || {});
  }
}

let targetSex = "men"; // population being searched



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
  // Reset every descendant, not just the top-level actors: leg/arm swing
  // keyframes are phase-locked to the parent walk keyframe's percentages, so a
  // limb left mid-cycle from a previous run would drift out of sync otherwise.
  const actors = moonStage.querySelectorAll("*");
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

// --- 1/5-3/5 scenes: Local Neighborhood, Next Town Over, Across the Globe ---
// Each is a plain-JS equivalent of a "component with a gender prop": one
// hidden SVG stage per rarity level lives in the DOM, and a build*Scene()
// function sets which figure variant plays the traveler vs. the one
// already at the destination based on partnerGender, before activateStage() (a
// generalized version of the restart trick startMoonScene() already uses)
// resets the CSS animations to play from frame zero.
const neighborhoodStage = document.getElementById("neighborhoodStage");
const townStage = document.getElementById("townStage");
const countryStage = document.getElementById("countryStage");
const NEW_RARITY_STAGES = [neighborhoodStage, townStage, countryStage];

const matrixStage = document.getElementById("matrixStage");

// The SVG figures carry both hair and hairless variants in the markup;
// this class decides which one is drawn, replacing the old approach of
// swapping a gendered emoji into the element's text.
function setFigureVariant(el, feminine) {
  if (el) el.classList.toggle("fig-fem", feminine);
}

function hideNewRarityStages() {
  NEW_RARITY_STAGES.forEach((stage) => {
    stage.classList.add("hidden");
    stage.classList.remove("stage-active");
  });
}

function hideMatrixStage() {
  matrixStage.classList.add("hidden");
  matrixStage.classList.remove("stage-active");
}

function activateStage(stage) {
  stage.classList.remove("hidden");
  stage.classList.remove("stage-active");
  // Reset every descendant's animation, not just the top-level actors: leg/arm
  // swing keyframes are phase-locked to the parent walk keyframe's percentages,
  // so if only the parent restarted at frame 0 while a limb's animation kept
  // whatever offset it was paused at from a previous run, they'd drift out of sync.
  const actors = stage.querySelectorAll("*");
  actors.forEach((el) => {
    el.style.animation = "none";
  });
  void stage.offsetWidth; // force reflow so the reset actually takes
  actors.forEach((el) => {
    el.style.animation = "";
  });
  stage.classList.add("stage-active");
}

// Which figure gets the long-hair variant mirrors what the old emoji
// pairs did: the left/arriving figure is the partner being searched for,
// the other is its counterpart.
function buildNeighborhoodScene(partnerGender) {
  setFigureVariant(document.getElementById("hoodActorLeft"), partnerGender !== "man");
  setFigureVariant(document.getElementById("hoodActorRight"), partnerGender === "man");
  neighborhoodStage.classList.toggle("with-extra", partnerGender === "woman");
}

function buildTownScene(partnerGender) {
  setFigureVariant(document.getElementById("townWaiter"), partnerGender === "man");
}

function buildCountryScene(partnerGender) {
  setFigureVariant(document.getElementById("countryWaiter"), partnerGender === "man");
}

// The moon scene reads as: the searcher flew here, and the partner they were
// looking for walks over to meet them. So the walking figure is the partner
// (male when you're searching for men), and the astronaut is the searcher --
// whose suit patch shows the complementary sex. This scene was the only one
// still hardcoded to a woman regardless of what was being searched for.
function buildMoonScene(partnerGender) {
  const lookingForMan = partnerGender === "man";
  setFigureVariant(document.getElementById("moonPartner"), !lookingForMan);
  const astronaut = document.getElementById("moonAstronaut");
  if (astronaut) {
    astronaut.classList.toggle("astro-fem", lookingForMan);
    astronaut.classList.toggle("astro-masc", !lookingForMan);
  }
}

function updateRarityScene(score, partnerGender) {
  hideNewRarityStages();
  hideMatrixStage();
  if (score === 1) {
    buildNeighborhoodScene(partnerGender);
    activateStage(neighborhoodStage);
  } else if (score === 2) {
    buildTownScene(partnerGender);
    activateStage(townStage);
  } else if (score === 3) {
    buildCountryScene(partnerGender);
    activateStage(countryStage);
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
    updateGamblesVisibility();
  });
});

// "Exclude gamblers" is only offered when searching for men -- a product
// scoping decision (see stats.js's notGamblesShare comment), not a data
// gap. Hidden (and force-unchecked, so a stale checked state can't sneak
// into a women's search) whenever the target sex isn't men.
const excludeGamblesWrap = document.getElementById("excludeGamblesWrap");
const excludeGamblesCheck = document.getElementById("excludeGambles");
function updateGamblesVisibility() {
  const showGambling = targetSex === "men";
  excludeGamblesWrap.classList.toggle("hidden", !showGambling);
  if (!showGambling) excludeGamblesCheck.checked = false;
}
updateGamblesVisibility();

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
// Race, orientation and religion are all "any + specific categories"
// checkbox groups with identical behaviour: ticking "any" clears the
// specifics, ticking a specific clears "any", and unticking the last
// specific falls back to "any" so the group is never empty.
function wireAnyCheckboxGroup(selector, onChange) {
  const checks = Array.from(document.querySelectorAll(selector));
  const anyCheck = checks.find((c) => c.value === "any");
  if (!anyCheck) return { checks, getSelected: () => [], setSelected: () => {} };

  checks.forEach((check) => {
    check.addEventListener("change", () => {
      if (check === anyCheck) {
        if (check.checked) {
          checks.forEach((c) => { if (c !== anyCheck) c.checked = false; });
        } else {
          check.checked = true; // never allow zero selections
        }
      } else if (check.checked) {
        anyCheck.checked = false;
      } else if (!checks.some((c) => c !== anyCheck && c.checked)) {
        anyCheck.checked = true;
      }
      if (onChange) onChange();
    });
  });

  return {
    checks,
    getSelected: () => checks.filter((c) => c.checked && c.value !== "any").map((c) => c.value),
    // The inverse, used only by applyFiltersToControls(): checkout is a
    // full-page redirect, so a buyer comes back to a form that has reset
    // itself, and their results have to be rebuilt from saved filters.
    setSelected: (values) => {
      const wanted = new Set(values || []);
      checks.forEach((c) => { if (c !== anyCheck) c.checked = wanted.has(c.value); });
      anyCheck.checked = wanted.size === 0;
    },
  };
}

const raceGroup = wireAnyCheckboxGroup(".race-check", () => updateBackgroundModeToggleVisibility());
const orientationGroup = wireAnyCheckboxGroup(".orientation-check");
const religionGroup = wireAnyCheckboxGroup(".religion-check");
// Body type used to be one "Exclude obese" checkbox. It is now the same
// any-plus-specifics group as race and religion, because a build is not a
// yes/no: "athletic" and "normal/balanced" are different asks, and the
// person who wants either should be able to say so. Leaving Obese unticked
// still lands on exactly the old number -- see bodyTypeShares() in stats.js.
const bodyTypeGroup = wireAnyCheckboxGroup(".bodytype-check");

function getSelectedRaces() { return raceGroup.getSelected(); }
function getSelectedOrientations() { return orientationGroup.getSelected(); }
function getSelectedReligions() { return religionGroup.getSelected(); }
function getSelectedBodyTypes() { return bodyTypeGroup.getSelected(); }

// --- Filter persistence ---
// Results are unlocked after a full-page redirect to Stripe Checkout and
// back, which reloads the page and would otherwise reset every
// slider/checkbox to its default. Persisting the last-submitted filters
// lets the report -- and applyFiltersToControls() -- reuse exactly what
// the visitor asked for before they were sent to checkout.
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


// Rounding a share to whole percent can print a figure that flatly
// contradicts the sentence next to it. A filter removing 99.95% became
// "−100%" sitting beside "without it: 0.01%", which reads as a broken
// calculator -- and one visible contradiction is enough for a reader to
// distrust every other number on the page, however carefully it was
// computed. The extremes therefore get more precision instead of being
// rounded into a contradiction:
//   - above 99% it FLOORS to one decimal, so it can never claim a filter
//     removed everyone while a remainder is shown beside it. Only a share
//     that genuinely reaches 1 prints "100%".
//   - below 1% it keeps two decimals, so a filter listed as removing
//     something never prints "0%".
// The display floor of 0.01% is at most 0.01 percentage points off, far
// tighter than the whole-percent rounding used across the normal range.
function formatRemovedShare(share) {
  const pct = Math.max(0, Math.min(1, Number(share) || 0)) * 100;
  if (pct >= 100) return "100%";
  if (pct > 99) return (Math.floor(pct * 10) / 10).toFixed(1) + "%";
  if (pct >= 1) return Math.round(pct) + "%";
  if (pct >= 0.01) return pct.toFixed(2) + "%";
  return pct > 0 ? "0.01%" : "0%";
}


// --- Compute + render results ---
const findOutBtn = document.getElementById("findOutBtn");
const resultCard = document.getElementById("resultCard");

// Named rather than inline so the post-purchase flow can replay it: after
// the Stripe redirect the page has reloaded, and a visitor who just paid
// should land on their finished results instead of having to hunt down
// "Find Out" and press it again for something they already bought.
function runFindOut() {
  const ageLo = parseInt(ageMin.value, 10);
  const ageHi = parseInt(ageMax.value, 10);
  const selectedRaces = getSelectedRaces();
  const selectedOrientations = getSelectedOrientations();
  const selectedReligions = getSelectedReligions();
  const minHeight = parseInt(heightSlider.value, 10);
  const minIncome = parseInt(incomeSlider.value, 10);
  const selectedBodyTypes = getSelectedBodyTypes();
  const excludeMarried = document.getElementById("excludeMarried").checked;
  const excludeKids = document.getElementById("excludeKids").checked;
  const excludeGambles = targetSex === "men" && excludeGamblesCheck.checked;

  // Bundled onto one event (rather than firing per-checkbox) so this
  // reflects what filters people actually search with, not every idle
  // click -- includes the paid report's country/background state too,
  // when unlocked, since that's a real part of "which filters get used."
  trackEvent("find_out_click", {
    target_sex: targetSex,
    age_lo: ageLo,
    age_hi: ageHi,
    selected_races: selectedRaces.length ? selectedRaces.join("+") : "any",
    selected_orientations: selectedOrientations.length ? selectedOrientations.join("+") : "any",
    selected_religions: selectedReligions.length ? selectedReligions.join("+") : "any",
    min_height: minHeight,
    min_income: minIncome,
    body_types: selectedBodyTypes.length ? selectedBodyTypes.join("+") : "any",
    exclude_married: excludeMarried,
    exclude_kids: excludeKids,
    exclude_gambles: excludeGambles,
    report_unlocked: reportUnlocked,
    country_mode: reportUnlocked ? countryMode : undefined,
    country_code: reportUnlocked && countryMode === "single" ? reportCountrySelect.value : undefined,
    background_categories: reportUnlocked && selectedBackgroundIds.length ? selectedBackgroundIds.join("+") : undefined,
    background_combine_mode: reportUnlocked && selectedBackgroundIds.length ? backgroundCombineMode : undefined,
  });

  const filters = {
    targetSex, ageLo, ageHi, selectedRaces, minHeight, minIncome,
    selectedBodyTypes, excludeMarried, excludeKids, excludeGambles,
    selectedOrientations, selectedReligions,
  };
  // The U.S. figures still drive the pre-purchase teaser's "your most
  // restrictive filter" insight, which is inherently about the free
  // U.S. result -- the headline card below uses the visitor's actual
  // selected scope instead (see getActiveScopeResult).
  const { pRace, pHeight, pIncome, pBody, pNotMarried, pNoKids, pNotGambles, pOrientation, pReligion } =
    computeProbability(STATS, filters);

  // Persisted so the Global Dream Partner Report can reuse the exact
  // same filters after the Stripe checkout redirect round-trip, which
  // reloads the page and would otherwise reset every slider/checkbox.
  saveLastFilters(filters);

  // If the report is already unlocked (visitor bought it earlier, then
  // came back and changed a filter), keep it in sync with what the form
  // now says instead of silently describing whatever filters happened to
  // be active at the moment of purchase.
  refreshGlobalReportIfVisible(filters);

  // The paywall is hard: there is no free result any more. Everything
  // below this line reveals the answer, so an unpurchased visitor gets
  // the modal instead -- built from these same real figures, blurred,
  // rather than from a mock-up that could contradict what they unlock.
  if (!reportUnlocked) {
    openPaywall(filters, {
      race: selectedRaces.length > 0 ? pRace : 1,
      height: pHeight,
      // Passed through rather than guarded: each is already exactly 1 when
      // nothing is being asked for -- $0 clears every earner, and ticking
      // every build is the whole population -- so a guard would only be
      // restating the arithmetic, and findBiggestLimitingFilter() drops
      // anything that cut nobody anyway.
      income: pIncome,
      body: pBody,
      married: excludeMarried ? pNotMarried : 1,
      kids: excludeKids ? pNoKids : 1,
      gambles: excludeGambles ? pNotGambles : 1,
      orientation: selectedOrientations.length > 0 ? pOrientation : 1,
      religion: selectedReligions.length > 0 ? pReligion : 1,
    });
    return;
  }

  const scope = getActiveScopeResult(filters);
  if (!scope) {
    // Nothing honest to headline yet (e.g. Compare mode with no
    // countries picked). The report's own sections explain why.
    stopGlobe();
    resultCard.classList.add("hidden");
    return;
  }
  const { pct, matchingCount } = scope;

  const partnerGender = targetSex === "men" ? "man" : "woman";
  const criteria = buildCriteriaList(filters);
  renderProbabilityVisual(pct);
  renderPercentage(pct);
  renderOddsLine(pct);
  renderCount(matchingCount, scope.countLabel);
  const raceIgnoredNote = document.getElementById("raceIgnoredNote");
  raceIgnoredNote.textContent = scope.raceIgnored
    ? `${scope.scopeLabel.replace(/'s population$/, "")} doesn't publish a race/ethnicity breakdown, so this result counts people of any race/ethnicity instead — every other filter you set is still applied.`
    : "";
  raceIgnoredNote.classList.toggle("hidden", !scope.raceIgnored);
  const { score, label } = renderDelusionScore(pct, partnerGender);

  document.getElementById("resultAgeMin").textContent = ageLo;
  document.getElementById("resultAgeMax").textContent = ageHi;
  document.getElementById("resultSexWord").textContent =
    targetSex === "men" ? "guy" : "woman";
  document.getElementById("resultScopeLabel").textContent = scope.scopeLabel;

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth" });

  updateShareCard({
    pctText: formatPercentage(pct),
    dreamWord: partnerGender,
    criteria,
    score,
    rarityLabel: label,
    // Both only used by the shareable link preview, which has to explain
    // to a stranger what test was taken and on what terms.
    scopeLabel: scope.scopeLabel,
    oddsText: oddsPhrase(pct, targetSex),
  });

  const biggestLimitingFilter = findBiggestLimitingFilter({
    race: selectedRaces.length > 0 ? pRace : 1,
    height: pHeight,
    income: pIncome,
    body: pBody,
    married: excludeMarried ? pNotMarried : 1,
    kids: excludeKids ? pNoKids : 1,
    gambles: excludeGambles ? pNotGambles : 1,
    orientation: selectedOrientations.length > 0 ? pOrientation : 1,
    religion: selectedReligions.length > 0 ? pReligion : 1,
  });

  // Live-stream hook. The overlay kit in stream/ listens for this and
  // fires the on-air alert and running tally. Only reached once results
  // are unlocked, since before that there is no result to announce -- so
  // the browser running the stream has to be an unlocked one. Dispatched
  // even when nothing is listening, because an event nobody subscribed to
  // costs nothing, and because the alternative -- having the bridge
  // scrape these numbers back out of the DOM -- would break every time
  // this card's markup changes.
  document.dispatchEvent(new CustomEvent("quiz:result", {
    detail: {
      pct,
      pctText: formatPercentage(pct),
      oddsText: oddsPhrase(pct, targetSex),
      score,
      label,
      matchingCount,
      countLabel: scope.countLabel,
      scopeLabel: scope.scopeLabel,
      criteria,
      targetSex,
      partnerGender,
      biggestLimitingFilter: biggestLimitingFilter ? biggestLimitingFilter.label : "",
      limitingCriterion: limitingCriterionText(biggestLimitingFilter, criteria, selectedOrientations, selectedReligions),
    },
  }));
}

findOutBtn.addEventListener("click", runFindOut);

// --- The paywall (Global Dream Partner Report) ---
// This is the whole product now: "Find Out" opens this modal rather than
// revealing anything, so it is the only thing standing between a visitor
// and their result, and every number inside it is real.
const paywallOverlay = document.getElementById("paywallOverlay");
const premiumTeaser = document.getElementById("premiumTeaser");
const premiumInsight = document.getElementById("premiumInsight");
const premiumLockedGrid = document.getElementById("premiumLockedGrid");
// Two of them: one under the blurred result, one at the foot of the
// pitch. They are interchangeable, so everything below treats them as a
// set rather than singling one out.
const unlockButtons = Array.from(document.querySelectorAll(".paywall-unlock"));
const premiumUnlockBtn = document.getElementById("premiumUnlockBtn");
const premiumStatus = document.getElementById("premiumStatus");
const paywallStatus = document.getElementById("paywallStatus");
const blurPreviewRows = document.getElementById("blurPreviewRows");

// Real numbers from the same computeProbability() engine as everywhere
// else on the site -- just visually blurred -- rather than a fabricated
// teaser, so nothing here could ever contradict the report a visitor
// actually unlocks. Uses window.QuizGlobalStats directly since the
// report itself isn't unlocked/populated yet at this point.
const BLUR_PREVIEW_COUNTRIES = ["US", "DE", "JP"];

function renderBlurPreview(filters) {
  const { getCountryStats, getCountryMeta } = window.QuizGlobalStats;
  blurPreviewRows.innerHTML = BLUR_PREVIEW_COUNTRIES.map((code) => {
    const stats = getCountryStats(code);
    const meta = getCountryMeta(code);
    const { pct } = computeProbability(stats, filters);
    return `
      <div class="blur-preview-row">
        <span>${meta.name}</span>
        <span class="blur-pct">${formatPercentage(pct)}</span>
      </div>
    `;
  }).join("");
}

// The price lives only in Stripe, so it's fetched rather than hardcoded and
// can never fall out of sync with what's actually charged. Fetched once and
// reused; any failure leaves the button's original price-less label alone.
let reportPricePromise = null;
function loadReportPrice() {
  if (!reportPricePromise) {
    reportPricePromise = fetch("/api/report-price")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return reportPricePromise;
}

function formatMoney(minorUnits, currency) {
  const value = minorUnits / 100;
  try {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      // Whole amounts read better bare: "$3", not "$3.00".
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  } catch (err) {
    return `${String(currency || "").toUpperCase()} ${value.toFixed(2)}`;
  }
}

// Showing the price before the redirect is the point: previously a visitor
// only discovered the cost on Stripe's page, after leaving the site.
function applyPriceToUnlockButton() {
  loadReportPrice().then((price) => {
    if (!price || !price.available) return;
    unlockButtons.forEach((btn) => {
      if (btn.disabled) return;
      btn.textContent = `Unlock My Results — ${formatMoney(price.amount, price.currency)}`;
    });
  });
}

// Country names come from our own countries.js, but some lines are built
// with innerHTML for the <strong> emphasis, so escape rather than trust.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Fills the modal with this visitor's own figures and shows it. Called
// straight from runFindOut(), which has already done all the arithmetic.
function openPaywall(filters, impactInputs) {
  const biggest = findBiggestLimitingFilter(impactInputs);
  premiumInsight.textContent = biggest
    ? `Your ${biggest.label} appears to be one of your most restrictive preferences — it narrows your pool by roughly ${formatRemovedShare(biggest.removedPct / 100)}.`
    : "Your current preferences are fairly broad — see how the picture changes across the globe.";

  // The blurred headline is the visitor's genuine worldwide answer, run
  // through the very same aggregate the unlocked report uses in Global
  // mode -- so what un-blurs after checkout is the number that was
  // already sitting there, not a teaser that has to be walked back.
  const { aggregatePct } = computeMultiCountryAggregate(
    Object.keys(window.QuizGlobalStats.COUNTRIES), filters
  );
  document.getElementById("paywallLockedPct").textContent = formatPercentage(aggregatePct);
  document.getElementById("paywallLockedRarity").textContent =
    rarityFor(aggregatePct, { globalScope: true }).label;

  renderBlurPreview(filters);
  applyPriceToUnlockButton();

  // Revealed behind the modal, so dismissing it doesn't strand someone on
  // a page with no way back to the results they just calculated.
  premiumTeaser.classList.remove("hidden");

  paywallOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  premiumUnlockBtn.focus();

  trackEvent("paywall_view", { biggest_limiting_filter: biggest ? biggest.label : undefined });
}

function closePaywall() {
  paywallOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("paywallClose").addEventListener("click", closePaywall);
// Backdrop clicks only -- a click inside the modal must not dismiss it.
paywallOverlay.addEventListener("click", (e) => {
  if (e.target === paywallOverlay) closePaywall();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !paywallOverlay.classList.contains("hidden")) closePaywall();
});

// Recomputes rather than merely re-showing: the visitor may well have
// changed a filter after dismissing the modal, and the numbers inside it
// have to describe what the form currently says.
document.getElementById("paywallReopenBtn").addEventListener("click", runFindOut);

// Hands off to the header's existing restore panel instead of putting a
// second copy of the email form inside the modal.
document.getElementById("paywallRestoreBtn").addEventListener("click", () => {
  closePaywall();
  if (restoreAccessLink.getAttribute("aria-expanded") !== "true") restoreAccessLink.click();
  restoreAccessPanel.scrollIntoView({ behavior: "smooth", block: "center" });
});

function showPremiumStatus(kind, message) {
  premiumStatus.className = `premium-status status-${kind}`;
  premiumStatus.textContent = message;
  premiumStatus.classList.remove("hidden");
}

// The modal keeps its own status line: a checkout that fails to start has
// to report itself where the visitor is actually looking.
function showPaywallStatus(kind, message) {
  paywallStatus.className = `premium-status status-${kind}`;
  paywallStatus.textContent = message;
  paywallStatus.classList.remove("hidden");
}

async function startCheckout() {
  trackEvent("begin_checkout");
  // Both buttons lock: they do the same thing, and a second press while
  // the first is in flight would open two checkout sessions.
  unlockButtons.forEach((btn) => {
    btn.disabled = true;
    btn.textContent = "Redirecting to checkout…";
  });
  try {
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    if (!res.ok) throw new Error("Checkout session request failed");
    const { url } = await res.json();
    if (!url) throw new Error("No checkout URL returned");
    window.location.href = url;
  } catch (err) {
    showPaywallStatus("error", "Something went wrong starting checkout. Please try again in a moment.");
    unlockButtons.forEach((btn) => {
      btn.disabled = false;
      btn.textContent = "Unlock My Results";
    });
    // Restore the price too -- the plain reset above would otherwise strip it.
    applyPriceToUnlockButton();
  }
}

unlockButtons.forEach((btn) => btn.addEventListener("click", startCheckout));

// --- Global Dream Partner Report: country selector + comparison table ---
// Renders only after report-access confirms a webhook-verified purchase.
// All figures reuse the exact same computeProbability() math as the free
// U.S. calculator, run against each country's real (or region-estimated)
// data from countries.js -- no separate/fabricated calculation path.
const globalReport = document.getElementById("globalReport");
const globalInputsWrap = document.getElementById("globalInputsWrap");
const reportCountrySelect = document.getElementById("reportCountrySelect");
const reportTableBody = document.getElementById("reportTableBody");
const reportShowAllBtn = document.getElementById("reportShowAllBtn");
const stateSelectorWrap = document.getElementById("stateSelectorWrap");
const reportStateSelect = document.getElementById("reportStateSelect");
const stateCompareSection = document.getElementById("stateCompareSection");
const stateTableBody = document.getElementById("stateTableBody");
const stateShowAllBtn = document.getElementById("stateShowAllBtn");
const stateCompareEmpty = document.getElementById("stateCompareEmpty");
const stateCompareTableWrap = document.getElementById("stateCompareTableWrap");
const backgroundSelectorWrap = document.getElementById("backgroundSelectorWrap");
const backgroundCombineToggle = document.getElementById("backgroundCombineToggle");
const backgroundCombineHint = document.getElementById("backgroundCombineHint");
const backgroundModeToggle = document.getElementById("backgroundModeToggle");
const backgroundTierBadge = document.getElementById("backgroundTierBadge");
const backgroundOptions = document.getElementById("backgroundOptions");
const backgroundLimitations = document.getElementById("backgroundLimitations");
const backgroundEmpty = document.getElementById("backgroundEmpty");
const backgroundChips = document.getElementById("backgroundChips");
const countryModeToggle = document.getElementById("countryModeToggle");
const singleCountryWrap = document.getElementById("singleCountryWrap");
const multiCountryWrap = document.getElementById("multiCountryWrap");
const globalModeWrap = document.getElementById("globalModeWrap");
const multiCountrySearch = document.getElementById("multiCountrySearch");
const multiCountryOptions = document.getElementById("multiCountryOptions");
const singleCountryResult = document.getElementById("singleCountryResult");
const multiCountryResult = document.getElementById("multiCountryResult");
const multiResultLabel = document.getElementById("multiResultLabel");
const multiResultText = document.getElementById("multiResultText");
const multiCountryBreakdownWrap = document.getElementById("multiCountryBreakdownWrap");
const multiCountryBreakdownBody = document.getElementById("multiCountryBreakdownBody");

const TIER_LABELS = {
  full: "Full country data",
  regional: "Regional estimate",
  state: "U.S. state data",
  metro: "Metro area data",
};

const US_NATIONAL_OPTION = "__US_NATIONAL__";
let stateSelectPopulated = false;

function populateStateSelectOnce() {
  if (stateSelectPopulated) return;
  const national = document.createElement("option");
  national.value = US_NATIONAL_OPTION;
  national.textContent = "United States (national)";
  reportStateSelect.appendChild(national);

  const metroGroup = document.createElement("optgroup");
  metroGroup.label = "Major Metro Areas";
  window.QuizUSMetros.listMetros().forEach(({ code, name }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    metroGroup.appendChild(option);
  });
  reportStateSelect.appendChild(metroGroup);

  const stateGroup = document.createElement("optgroup");
  stateGroup.label = "States";
  window.QuizUSStates.listStates().forEach(({ code, name }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    stateGroup.appendChild(option);
  });
  reportStateSelect.appendChild(stateGroup);

  reportStateSelect.value = US_NATIONAL_OPTION;
  stateSelectPopulated = true;
}

// Resolves what the result card, filter-impact, age-distribution, and
// leverage sections should actually describe: the drilled-into U.S.
// state or metro area if one is selected, otherwise the selected
// country as-is. The country-vs-country comparison table and Wrapped's
// "rank out of 198 countries" slide deliberately do NOT use this --
// they always compare whole countries so the ranking stays apples-to-
// apples.
function getActiveStats(countryCode) {
  const sel = reportStateSelect.value;
  if (countryCode === "US" && sel && sel !== US_NATIONAL_OPTION) {
    if (window.QuizUSStates.STATES[sel]) return window.QuizUSStates.getStateStats(sel);
    if (window.QuizUSMetros.METROS[sel]) return window.QuizUSMetros.getMetroStats(sel);
  }
  return window.QuizGlobalStats.getCountryStats(countryCode);
}

function getActiveMeta(countryCode) {
  const sel = reportStateSelect.value;
  if (countryCode === "US" && sel && sel !== US_NATIONAL_OPTION) {
    if (window.QuizUSStates.STATES[sel]) {
      return { ...window.QuizUSStates.getStateMeta(sel), tier: "state" };
    }
    if (window.QuizUSMetros.METROS[sel]) {
      return { ...window.QuizUSMetros.getMetroMeta(sel), tier: "metro" };
    }
  }
  return window.QuizGlobalStats.getCountryMeta(countryCode);
}

// The filter set the unlocked report is currently describing. Dream
// Partner Wrapped reads this so its slides always match the report the
// visitor is looking at.
let currentReportFilters = null;

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

// Feeds the ranked "How Your Odds Compare" table and Wrapped's
// country-vs-country slides. Like the single-country result, a country
// with no race/ethnicity breakdown (most of the 198 -- see
// missingRaceData) has that one filter dropped for its own row rather
// than silently landing on 0%, which would read as "genuinely nobody
// matches here" instead of the truth ("we don't have this one
// dimension for this country").
function computeCountryResult(code, filters) {
  const { getCountryStats, getCountryMeta } = window.QuizGlobalStats;
  const stats = getCountryStats(code);
  const meta = getCountryMeta(code);
  if (!stats || !meta) return null;
  const raceIgnored = missingRaceData(stats, filters);
  const religionIgnored = missingReligionData(stats, filters);
  const orientationIgnored = missingOrientationData(stats, filters);
  return {
    ...computeProbability(stats, effectiveFiltersFor(stats, filters)),
    meta, raceIgnored, religionIgnored, orientationIgnored,
  };
}

// --- Compare multiple countries at once ---
// A second mode alongside the single-country picker. Ethnic/Ancestral/
// Background filtering is intentionally not part of this mode yet --
// countries' real categories don't share a common set (Hispanic/Latino
// in the US isn't Coloured in South Africa), so forcing one flat
// checkbox list across every selected country would either misapply a
// category or need a whole second UI; disclosed plainly above the
// picker rather than silently ignored.
let countryMode = "single";
let selectedMultiCountries = [];
let multiCountryPopulated = false;

function populateMultiCountryOptions() {
  const { listCountriesByContinent } = window.QuizGlobalStats;
  const groups = listCountriesByContinent();
  multiCountryOptions.innerHTML = "";
  Object.keys(groups)
    .sort()
    .forEach((continent) => {
      const heading = document.createElement("div");
      heading.className = "multi-country-continent";
      heading.textContent = continent;
      multiCountryOptions.appendChild(heading);
      groups[continent].forEach(({ code, name }) => {
        const label = document.createElement("label");
        label.className = "checkbox-option multi-country-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "multi-country-check";
        input.value = code;
        input.checked = selectedMultiCountries.includes(code);
        input.onchange = () => {
          selectedMultiCountries = Array.from(multiCountryOptions.querySelectorAll(".multi-country-check:checked")).map((c) => c.value);
        };
        const box = document.createElement("span");
        box.className = "checkbox-box";
        label.appendChild(input);
        label.appendChild(box);
        label.appendChild(document.createTextNode(` ${name}`));
        multiCountryOptions.appendChild(label);
      });
    });
}

// Same live-filter-without-losing-focus technique as the Background
// picker's search box.
function applyMultiCountrySearchFilter() {
  const q = multiCountrySearch.value.trim().toLowerCase();
  multiCountryOptions.querySelectorAll(".multi-country-option").forEach((label) => {
    label.classList.toggle("bg-hidden", q.length > 0 && !label.textContent.toLowerCase().includes(q));
  });
  multiCountryOptions.querySelectorAll(".multi-country-continent").forEach((heading) => {
    let node = heading.nextElementSibling;
    let anyVisible = false;
    while (node && node.classList.contains("multi-country-option")) {
      if (!node.classList.contains("bg-hidden")) anyVisible = true;
      node = node.nextElementSibling;
    }
    heading.classList.toggle("bg-hidden", q.length > 0 && !anyVisible);
  });
}

// computeMultiCountryAggregate() now lives in quiz-core.js, shared with
// the live stream console. Same function, same rule: sum the populations
// and divide once, never average the percentages together.

function renderMultiCountryResult(filters) {
  const isGlobal = countryMode === "global";
  const codes = isGlobal ? Object.keys(window.QuizGlobalStats.COUNTRIES) : selectedMultiCountries;
  const { rows } = computeMultiCountryAggregate(codes, filters);
  const raceIgnoredCount = rows.filter((r) => r.raceIgnored).length;

  // As with the single-country section, the headline number lives in the
  // result card at the top of the page now -- this line explains the
  // method behind it (or why there's nothing to show yet). Every row
  // that had its race filter dropped (see computeMultiCountryAggregate)
  // still contributes using its own real population for every other
  // filter, so this is a footnote on the method, not a warning that
  // something's missing from the total.
  multiResultLabel.textContent = isGlobal ? "Your Global Odds" : "Your Combined Odds";
  const methodSentence = isGlobal
    ? `Combined across all ${rows.length} countries in our database — each country's own real matching population added up and divided by their combined eligible population, not an average of percentages.`
    : `Combined across the ${rows.length} ${rows.length === 1 ? "country" : "countries"} you picked — each country's own real matching population added up and divided by their combined eligible population, not an average of percentages.`;
  const raceNote = raceIgnoredCount > 0
    ? ` ${raceIgnoredCount} of ${rows.length} don't publish a race/ethnicity breakdown, so those are counted using their full population instead — every other filter you set still applies to them.`
    : "";
  multiResultText.textContent = rows.length === 0
    ? "Pick at least one country above, then click Find Out."
    : methodSentence + raceNote;

  // Global mode's per-country breakdown would just be a 198-row repeat of
  // the ranked comparison table already shown below, so it's skipped
  // there -- Compare mode keeps it since the visitor hand-picked a small,
  // specific set of countries and wants to see how each one contributed.
  multiCountryBreakdownWrap.classList.toggle("hidden", isGlobal);
  if (!isGlobal) {
    multiCountryBreakdownBody.innerHTML = rows.map((r) => {
      const name = r.raceIgnored ? `${r.name} <span class="report-source-note">(any race)</span>` : r.name;
      return `<tr><td>${name}</td><td>${formatPercentage(r.pct)}</td><td>${r.matchingCount.toLocaleString("en-US")}</td></tr>`;
    }).join("");
  }
}

// Resolves which population the headline result card should describe.
// Locked visitors always get the U.S. -- that genuinely is all their free
// result covers. Once the report is unlocked, the card follows whatever
// scope the visitor actually picked (a country, a drilled-into U.S.
// state/metro, a hand-picked set, or the whole world), so the page shows
// ONE result instead of a U.S. figure competing with theirs further down.
// The locked branch below is a fallback only: runFindOut() shows the
// paywall before it ever gets this far.
//
// Returns null when there's no honest number to show yet (nothing picked
// in Compare mode, or a race filter the selected country can't honor).
// The report's own sections already explain those cases in detail, so the
// card stays hidden rather than displaying a misleading 0%.
function getActiveScopeResult(filters) {
  if (!reportUnlocked) {
    const r = computeProbability(STATS, filters);
    return {
      pct: r.pct,
      matchingCount: r.matchingCount,
      scopeLabel: "the U.S. population",
      countLabel: "in the U.S.",
    };
  }

  if (countryMode === "multi" || countryMode === "global") {
    const isGlobal = countryMode === "global";
    const codes = isGlobal ? Object.keys(window.QuizGlobalStats.COUNTRIES) : selectedMultiCountries;
    const { aggregatePct, totalMatching, rows } = computeMultiCountryAggregate(codes, filters);
    if (!rows.length) return null;
    const countryWord = rows.length === 1 ? "country" : "countries";
    return {
      pct: aggregatePct,
      matchingCount: totalMatching,
      scopeLabel: isGlobal ? "the world's population" : `the ${rows.length} ${countryWord} you picked`,
      countLabel: isGlobal ? "worldwide" : `across the ${rows.length} ${countryWord} you picked`,
    };
  }

  const code = reportCountrySelect.value;
  const stats = getActiveStats(code);
  const meta = getActiveMeta(code);
  if (!stats || !meta) return null;
  // Mirrors renderSelectedCountryResult()'s math exactly (including the
  // Background combination) so the headline and the report never disagree.
  const raceIgnored = missingRaceData(stats, filters);
  const effectiveFilters = effectiveFiltersFor(stats, filters);
  const r = computeProbability(stats, effectiveFilters);
  const combined = computeRaceBackgroundResult(activeBackgroundCountryCode(), effectiveFilters.selectedRaces, r);
  return {
    pct: combined.pct,
    matchingCount: Math.round(stats.totalAdultPopulation[filters.targetSex] * r.pAge * combined.probability),
    scopeLabel: `${meta.name}'s population`,
    countLabel: `in ${meta.name}`,
    raceIgnored,
    orUnavailable: combined.orUnavailable,
  };
}

// The four missing*Data guards and effectiveFiltersFor() now live in
// quiz-core.js, so the live stream console scores a foreign guest by
// exactly the rules this page uses. Same names, called the same way.
//
// Worth remembering at their call sites below: they do more than keep
// computeProbability() honest. The Filter Impact and Leverage sections
// use them to decide which filters to list at all -- without them those
// lists advertise a gambling or religion preference that did nothing for
// this country and show it as a flat 0% effect, which is noise dressed
// up as a finding.

// --- Ethnic, Ancestral & Cultural Background (paid-only) ---
// A richer, country-specific companion to the free calculator's simple
// Race filter (see ethnicity.js for the real, sourced category data).
// Selection resets whenever the effective country/mode changes so a
// stale Brazil-only category id can never silently apply to Japan.
let backgroundMode = "broad";
let selectedBackgroundIds = [];
let lastBackgroundKey = null;
// How the Race filter combines with the Background filter when both have
// a selection: "and" (default, narrows to people matching both) or "or"
// (unions them -- only offered when ethnicity.js has a real per-race
// overlap figure for the current selection; see computeRaceBackgroundResult).
let backgroundCombineMode = "and";

// U.S. states/metros don't have their own published Hispanic/AIAN/etc.
// breakdown in this codebase (only national-level US figures do), so
// drilling into one disables the filter with an honest note rather
// than silently applying the national share to that state's population.
function activeBackgroundCountryCode() {
  const code = reportCountrySelect.value;
  const sel = reportStateSelect.value;
  if (code === "US" && sel && sel !== US_NATIONAL_OPTION) return null;
  return code;
}

function currentBackgroundCategories(code) {
  const gg = window.QuizEthnicity;
  if (backgroundMode === "detailed") {
    const { supported, categories } = gg.getBackgroundOptions(code);
    return { supported, options: categories.map((c) => ({ id: c.id, displayName: c.displayName, share: c.share, classificationType: c.classificationType, raceOverlap: c.raceOverlap })) };
  }
  const { supported, groups } = gg.getHarmonizedOptions(code);
  return { supported, options: groups.map((g) => ({ id: g.id, displayName: g.displayName, share: g.share, raceOverlap: g.raceOverlap })) };
}

// Combines the Race filter with the Background filter's current
// selection and folds the result into a computeProbability() result `r`.
// AND (default) narrows to people matching both filters; OR unions them
// instead. Real per-race overlap data (ethnicity.js's raceOverlap) is
// required for OR -- and also upgrades AND from an independence-assumption
// product (pRace * pBackground, which can be wrong -- see ethnicity.js's
// us_hispanic_latino.raceOverlap.white comment) to the real measured
// intersection when available. Only usable when exactly one background
// category is selected and every currently-selected race has overlap data
// for it; combinations of multiple background categories aren't known to
// be disjoint from each other the way Census race "alone" categories are,
// so there's no single real overlap number to use in that case.
function computeRaceBackgroundResult(code, selectedRaces, r) {
  if (!code || selectedBackgroundIds.length === 0) {
    return { pct: r.pct, probability: r.probability, orUnavailable: false };
  }
  const { options } = currentBackgroundCategories(code);
  const selectedOptions = options.filter((o) => selectedBackgroundIds.includes(o.id));
  const pBackground = Math.min(1, selectedOptions.reduce((total, o) => total + o.share, 0));

  const singleOption = selectedOptions.length === 1 ? selectedOptions[0] : null;
  const overlapAvailable = !!singleOption && !!singleOption.raceOverlap &&
    selectedRaces.length > 0 &&
    selectedRaces.every((race) => singleOption.raceOverlap[race] !== undefined);

  const wantsOr = backgroundCombineMode === "or";

  if (overlapAvailable) {
    const pOverlap = selectedRaces.reduce((sum, race) => sum + singleOption.raceOverlap[race], 0);
    const otherFactors = r.pHeight * r.pIncome * r.pBody * r.pNotMarried * r.pNoKids;
    const probability = wantsOr
      ? otherFactors * Math.min(1, r.pRace + pBackground - pOverlap)
      : otherFactors * pOverlap;
    return { pct: probability * 100, probability, orUnavailable: false };
  }

  // No real overlap data for this combination: AND falls back to the
  // original independence-assumption product (unchanged from before this
  // feature existed); OR isn't offered, disclosed via orUnavailable so the
  // UI never silently shows an AND result labeled as "Either."
  return { pct: r.pct * pBackground, probability: r.probability * pBackground, orUnavailable: wantsOr };
}

// Shows the AND/OR combine toggle only when it's actually meaningful: a
// specific race checked (not "any" -- with "any" selected pRace=1, so AND
// and OR are numerically identical and showing the toggle would just be
// noise) and exactly one background category checked. If OR data isn't
// available for the current selection (or stops being available, e.g. a
// second background category gets checked while OR is active), disables
// the OR option, silently falls back to AND, and shows a disclosure note
// -- never lets an AND result stay labeled "Either."
function updateBackgroundModeToggleVisibility() {
  const code = activeBackgroundCountryCode();
  const selectedRaces = getSelectedRaces();
  const andRadio = backgroundCombineToggle.querySelector('input[value="and"]');
  const orRadio = backgroundCombineToggle.querySelector('input[value="or"]');

  // Nothing to combine at all (no specific race, or no background category
  // checked yet) -- hide both the toggle and any disclosure, there's
  // nothing to disclose about a choice that isn't active.
  if (!code || selectedRaces.length === 0 || selectedBackgroundIds.length === 0) {
    backgroundCombineToggle.classList.add("hidden");
    backgroundCombineHint.classList.add("hidden");
    return;
  }

  // More than one background category checked: OR isn't offered (no real
  // overlap data exists for combinations of background categories, only
  // single ones) -- hide the toggle itself, but still force back to AND
  // and disclose it if OR was active, so a stale "Either" choice never
  // silently keeps computing as AND without the visitor knowing.
  if (selectedBackgroundIds.length > 1) {
    backgroundCombineToggle.classList.add("hidden");
    if (backgroundCombineMode === "or") {
      backgroundCombineMode = "and";
      andRadio.checked = true;
      backgroundCombineHint.classList.remove("hidden");
      backgroundCombineHint.textContent = "Showing \"Both\" — \"Either\" isn't available with more than one background category checked at once.";
    } else {
      backgroundCombineHint.classList.add("hidden");
    }
    return;
  }

  // Exactly one race-bearing selection and one background category: the
  // one case OR can actually apply. Show the toggle; only disclose if the
  // specific race+category pairing has no real overlap data.
  backgroundCombineToggle.classList.remove("hidden");
  const { options } = currentBackgroundCategories(code);
  const selectedOption = options.find((o) => selectedBackgroundIds.includes(o.id));
  const overlapAvailable = !!selectedOption && !!selectedOption.raceOverlap &&
    selectedRaces.every((race) => selectedOption.raceOverlap[race] !== undefined);

  orRadio.disabled = !overlapAvailable;
  if (!overlapAvailable && backgroundCombineMode === "or") {
    backgroundCombineMode = "and";
    andRadio.checked = true;
  }

  backgroundCombineHint.classList.toggle("hidden", overlapAvailable);
  if (!overlapAvailable) {
    backgroundCombineHint.textContent = "\"Either\" isn't available for this combination — there's no published data on how many people are both, so only \"Both\" is shown.";
  }
}

// Reads the country list straight from ethnicity.js's own data rather
// than a hand-maintained copy, so adding a country there is the only
// place this message ever needs updating.
function listSupportedBackgroundCountries() {
  const codes = Object.keys(window.QuizEthnicity.COUNTRY_BACKGROUNDS);
  const names = codes.map((c) => window.QuizGlobalStats.getCountryMeta(c).name);
  return names.slice(0, -1).join(", ") + ", or " + names[names.length - 1];
}

const CLASSIFICATION_GROUP_LABELS = {
  race: "Race",
  ethnicity: "Ethnicity",
  ancestry: "Ancestry",
  indigenous_identity: "Indigenous identity",
  mixed_background: "Mixed background",
};

function buildBackgroundCheckbox(opt, currentOptions) {
  const label = document.createElement("label");
  label.className = "checkbox-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "background-check";
  input.value = opt.id;
  input.checked = selectedBackgroundIds.includes(opt.id);
  input.onchange = () => {
    // Just remembers the selection -- like every other filter on this
    // site, nothing recomputes until "Find Out" is pressed.
    selectedBackgroundIds = Array.from(backgroundOptions.querySelectorAll(".background-check:checked")).map((c) => c.value);
    renderBackgroundChips(currentOptions);
    updateBackgroundModeToggleVisibility();
  };
  const box = document.createElement("span");
  box.className = "checkbox-box";
  label.appendChild(input);
  label.appendChild(box);
  label.appendChild(document.createTextNode(` ${opt.displayName} (${formatPercentage(opt.share * 100)})`));
  return label;
}

// Detailed mode groups a country's real categories under native
// <details> disclosures by classificationType (Race/Ethnicity/Indigenous
// identity/etc.) so a longer list (more countries, more categories) stays
// scannable -- no JS accordion library, keyboard/screen-reader support
// for free. Broad mode's harmonized list is short by design and stays flat.
function renderBackgroundOptionsList(options) {
  backgroundOptions.innerHTML = "";
  if (backgroundMode !== "detailed") {
    options.forEach((opt) => backgroundOptions.appendChild(buildBackgroundCheckbox(opt, options)));
    return;
  }
  const groups = {};
  const order = [];
  options.forEach((opt) => {
    const key = opt.classificationType || "other";
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(opt);
  });
  order.forEach((key) => {
    const details = document.createElement("details");
    details.className = "background-group";
    details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = `${CLASSIFICATION_GROUP_LABELS[key] || "Other"} (${groups[key].length})`;
    details.appendChild(summary);
    groups[key].forEach((opt) => details.appendChild(buildBackgroundCheckbox(opt, options)));
    backgroundOptions.appendChild(details);
  });
}

// Selected categories shown as removable chips so a visitor with several
// boxes checked doesn't have to scroll the (now grouped) list to see or
// clear their picks.
function renderBackgroundChips(options) {
  backgroundChips.innerHTML = "";
  selectedBackgroundIds.forEach((id) => {
    const opt = options.find((o) => o.id === id);
    if (!opt) return;
    const chip = document.createElement("span");
    chip.className = "background-chip";
    chip.textContent = opt.displayName;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "background-chip-remove";
    removeBtn.setAttribute("aria-label", `Remove ${opt.displayName}`);
    removeBtn.textContent = "×";
    removeBtn.onclick = () => {
      selectedBackgroundIds = selectedBackgroundIds.filter((sid) => sid !== id);
      const checkbox = backgroundOptions.querySelector(`.background-check[value="${CSS.escape(id)}"]`);
      if (checkbox) checkbox.checked = false;
      renderBackgroundChips(options);
      updateBackgroundModeToggleVisibility();
    };
    chip.appendChild(removeBtn);
    backgroundChips.appendChild(chip);
  });
}

function renderBackgroundSection() {
  const code = activeBackgroundCountryCode();
  const key = `${code}:${backgroundMode}`;
  if (key !== lastBackgroundKey) {
    selectedBackgroundIds = [];
    lastBackgroundKey = key;
  }

  if (!code) {
    backgroundOptions.innerHTML = "";
    backgroundChips.innerHTML = "";
    backgroundLimitations.textContent = "";
    backgroundTierBadge.textContent = "";
    backgroundEmpty.textContent = "Not available at the state/metro level — this filter only applies to the national United States result right now. Switch back to \"United States (national)\" above to use it.";
    backgroundEmpty.classList.remove("hidden");
    updateBackgroundModeToggleVisibility();
    return;
  }

  const { supported, options } = currentBackgroundCategories(code);
  const meta = getActiveMeta(code);

  if (!supported) {
    backgroundOptions.innerHTML = "";
    backgroundChips.innerHTML = "";
    backgroundLimitations.textContent = "";
    backgroundTierBadge.textContent = "";
    backgroundEmpty.textContent = `${meta ? meta.name : "This country"} doesn't have a detailed ethnic/ancestral background breakdown from official sources yet — try ${listSupportedBackgroundCountries()}.`;
    backgroundEmpty.classList.remove("hidden");
    updateBackgroundModeToggleVisibility();
    return;
  }

  backgroundEmpty.classList.add("hidden");
  backgroundTierBadge.textContent = "Official source data";
  backgroundTierBadge.className = "tier-badge tier-full";

  const { limitations } = window.QuizEthnicity.getBackgroundOptions(code);
  backgroundLimitations.textContent = limitations && limitations.length ? limitations.join(" ") : "";

  renderBackgroundOptionsList(options);
  renderBackgroundChips(options);
  updateBackgroundModeToggleVisibility();
}

// Keeps the input-side pickers (U.S. state/metro sub-select, background
// category list) in sync with whatever country is currently chosen.
// Runs live on every country/state change -- unlike the actual result,
// nothing here computes or displays odds, so it's fine for it to react
// immediately instead of waiting for "Find Out."
function syncGlobalInputsForCountry() {
  const code = reportCountrySelect.value;
  const isUS = code === "US";
  stateSelectorWrap.classList.toggle("hidden", !isUS);
  if (isUS) populateStateSelectOnce();
  renderBackgroundSection();
}

function renderSelectedCountryResult(filters) {
  syncGlobalInputsForCountry();
  const code = reportCountrySelect.value;
  const isUS = code === "US";
  stateCompareSection.classList.toggle("hidden", !isUS);

  const stats = getActiveStats(code);
  const meta = getActiveMeta(code);
  if (!stats || !meta) return;
  const raceDataMissing = missingRaceData(stats, filters);
  const effectiveFilters = effectiveFiltersFor(stats, filters);
  const result = { ...computeProbability(stats, effectiveFilters), meta };

  // The headline percentage/count now live in the result card at the top
  // of the page (see getActiveScopeResult), so this section only carries
  // what that card can't: which place it describes, the data-quality
  // tier, and the source note. When the race filter can't be honored
  // here, that's disclosed at the top instead (see raceIgnoredNote in
  // the Find Out handler) -- this section no longer blocks on it, since
  // every OTHER filter (height, income, body type, marital/parental,
  // age) is still real data for this country and shouldn't be thrown
  // away just because one dimension isn't available.
  document.getElementById("reportResultCountry").textContent = result.meta.name;
  document.getElementById("reportResultText").textContent = "";
  const badge = document.getElementById("reportTierBadge");
  badge.textContent = TIER_LABELS[result.meta.tier];
  badge.className = `tier-badge tier-${result.meta.tier}`;
  document.getElementById("reportSourceNote").textContent = result.meta.sourceNote;

  // The analysis sections are all relative to the selected country (or
  // drilled-into state), so they re-run whenever that selection changes
  // rather than staying pinned to whatever was picked first.
  renderFilterImpacts(stats, effectiveFilters);
  renderAgeDistribution(stats, effectiveFilters, result.meta.name);
  renderStrategy(stats, effectiveFilters, result.meta.name);
  if (raceDataMissing) {
    const note = document.createElement("p");
    note.className = "report-empty";
    note.textContent = `${result.meta.name} doesn't publish a race/ethnicity breakdown, so the analysis below counts people of any race/ethnicity.`;
    document.getElementById("filterImpactList").prepend(note);
  }

  if (isUS) renderStateComparisonTable(filters);
}

const STATE_PREVIEW_ROWS = 12;
let stateShowingAll = false;

function allUsGeographyCodes() {
  return [US_NATIONAL_OPTION, ...Object.keys(window.QuizUSStates.STATES), ...Object.keys(window.QuizUSMetros.METROS)];
}

function computeStateResult(code, filters) {
  let stats, meta;
  if (code === US_NATIONAL_OPTION) {
    stats = window.QuizStats.STATS;
    meta = { name: "United States (national)", tier: "full", sourceNote: "Same U.S. Census Bureau / CDC-NCHS data used throughout this site." };
  } else if (window.QuizUSStates.STATES[code]) {
    stats = window.QuizUSStates.getStateStats(code);
    meta = { ...window.QuizUSStates.getStateMeta(code), tier: "state" };
  } else if (window.QuizUSMetros.METROS[code]) {
    stats = window.QuizUSMetros.getMetroStats(code);
    meta = { ...window.QuizUSMetros.getMetroMeta(code), tier: "metro" };
  } else {
    return null;
  }
  return { ...computeProbability(stats, filters), meta };
}

// Height isn't meaningfully documented at the state level (every state
// shares the national CDC/NCHS distribution), and age range doesn't
// affect the percentage at all -- only headcount. So unless one of
// these filters is active, every state/metro is mathematically
// guaranteed to tie: nothing in the model varies between them. Showing
// a "ranked" table of 92 identical numbers in that case reads as
// broken, so it's replaced with an honest explanation instead.
function hasStateVaryingFilter(filters) {
  return (
    filters.selectedRaces.length > 0 ||
    filters.minIncome > 0 ||
    // Every build is derived from the state's own obesity figure, so this
    // varies -- unless all three are ticked, which comes to 1 everywhere.
    bodyTypeFilterActive(filters) ||
    filters.excludeMarried ||
    filters.excludeKids
    // excludeGambles deliberately excluded: states.js has no per-state
    // notGamblesShare yet, so every state falls back to the same "no
    // effect" multiplier and genuinely doesn't vary on this filter --
    // adding it here would show a fake "states differ" comparison table.
  );
}

function renderStateComparisonTable(filters) {
  if (!hasStateVaryingFilter(filters)) {
    stateCompareTableWrap.classList.add("hidden");
    stateShowAllBtn.classList.add("hidden");
    stateCompareEmpty.textContent =
      "Every state and metro shows the identical odds right now — height isn't documented at the state level (it uses the same national figure everywhere) and age range doesn't affect this percentage. Add a race, income, body-type, or marital/parental preference above to see how states and metros actually differ.";
    stateCompareEmpty.classList.remove("hidden");
    return;
  }
  stateCompareEmpty.classList.add("hidden");
  stateCompareTableWrap.classList.remove("hidden");
  stateShowAllBtn.classList.remove("hidden");

  const results = allUsGeographyCodes().map((code) => computeStateResult(code, filters)).filter(Boolean).sort((a, b) => b.pct - a.pct);

  const rows = stateShowingAll ? results : results.slice(0, STATE_PREVIEW_ROWS);
  stateTableBody.innerHTML = "";
  rows.forEach((result) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="place-cell">${result.meta.name}</td>
      <td>${formatPercentage(result.pct)}</td>
      <td><span class="tier-badge tier-${result.meta.tier}">${TIER_LABELS[result.meta.tier]}</span></td>
    `;
    stateTableBody.appendChild(tr);
  });

  stateShowAllBtn.textContent = stateShowingAll ? "Show top 12 only" : `Show all ${results.length} states & metros`;
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
  // Orientation data exists for the U.S. only (Gallup), and the U.S. row here
  // inherits it via useUsStats. Applying it to that one country would push the
  // U.S. DOWN against 197 countries that were never filtered -- the mirror of
  // the distortion religion had. So the ranking ignores orientation for every
  // country, keeping the comparison like-for-like, and the note below says so.
  const orientationActive = Boolean(filters.selectedOrientations && filters.selectedOrientations.length > 0);
  const rankingFilters = orientationActive ? { ...filters, selectedOrientations: [] } : filters;

  const all = Object.keys(COUNTRIES)
    .map((code) => computeCountryResult(code, rankingFilters))
    .filter(Boolean);

  // A country we can't apply an active filter to is dropped from the ranking
  // rather than ranked with the filter quietly skipped. Keeping it would leave
  // it at its full population and float it above every country the filter DID
  // reduce -- which isn't a rounding error, it inverts the list. Filtering to
  // Hindu once put Vatican City at #1 (no religion data), and filtering to
  // White left all 21 countries that publish a race breakdown at ranks #108
  // and below, beneath 107 countries that were never filtered at all.
  const raceActive = filters.selectedRaces.length > 0;
  const religionActive = Boolean(filters.selectedReligions && filters.selectedReligions.length > 0);
  const droppedRace = raceActive ? all.filter((r) => r.raceIgnored) : [];
  const droppedReligion = religionActive ? all.filter((r) => r.religionIgnored) : [];
  const results = all
    .filter((r) => !(raceActive && r.raceIgnored) && !(religionActive && r.religionIgnored))
    .sort((a, b) => b.pct - a.pct);

  const notes = [];
  if (droppedRace.length > 0) {
    // Too many names to list, unlike the religion case -- give the count and
    // the reason. Race categories are nationally defined and mostly not
    // comparable across borders, so this gap can't be closed with better data.
    notes.push(`Only ${results.length} countries publish a race/ethnicity breakdown that maps onto this filter, so the other ${droppedRace.length} are left out of this ranking while a race filter is on — ranking them would put countries that were never filtered above every country that was.`);
  }
  if (droppedReligion.length > 0) {
    notes.push(`${droppedReligion.length} countries are left out of this ranking because Pew publishes no religion data for them (each has under 100,000 people): ${droppedReligion.map((r) => r.meta.name).sort().join(", ")}.`);
  }
  if (orientationActive) {
    notes.push("Your sexual-orientation filter isn't applied to these country rankings — Gallup publishes those figures for the U.S. only, so applying them here would penalise the U.S. against 197 countries that have no equivalent data. It is still applied to your U.S. result above, and every other filter you set does apply here.");
  }
  document.getElementById("comparisonRaceNote").textContent = notes.join(" ");

  const rows = reportShowingAll ? results : results.slice(0, REPORT_PREVIEW_ROWS);
  reportTableBody.innerHTML = "";
  if (rows.length === 0) {
    // Can only happen if the active filters leave no country that publishes
    // the data for all of them -- say so rather than render an empty table.
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3">No country publishes the data needed for every filter you've set, so there's nothing to rank. Removing the race or religion filter will bring the comparison back.</td>`;
    reportTableBody.appendChild(tr);
  }
  rows.forEach((result) => {
    // No "(any race)" marker needed any more: a country that can't honour an
    // active race filter is now excluded from the ranking outright.
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

// --- Report analysis: filter impact, age distribution, leverage ---
// Every figure in these three sections is a real re-run of
// computeProbability() with exactly one input changed -- never a
// heuristic, a rule of thumb, or generic dating advice. If a number
// shows up here, the same engine that produced the free result
// produced it.
const HEIGHT_MIN_INCHES = 58; // matches the height slider's own min

// What each filter's inputs look like when the visitor isn't
// filtering on that dimension at all.
const FILTER_NEUTRAL = {
  race: { selectedRaces: [] },
  orientation: { selectedOrientations: [] },
  religion: { selectedReligions: [] },
  height: { minHeight: HEIGHT_MIN_INCHES },
  income: { minIncome: 0 },
  body: { selectedBodyTypes: [] },
  married: { excludeMarried: false },
  kids: { excludeKids: false },
  gambles: { excludeGambles: false },
};

function isFilterActive(key, filters) {
  switch (key) {
    case "race": return filters.selectedRaces.length > 0;
    case "orientation": return Boolean(filters.selectedOrientations && filters.selectedOrientations.length > 0);
    case "religion": return Boolean(filters.selectedReligions && filters.selectedReligions.length > 0);
    case "height": return filters.minHeight > HEIGHT_MIN_INCHES;
    case "income": return filters.minIncome > 0;
    case "body": return bodyTypeFilterActive(filters);
    case "married": return filters.excludeMarried;
    case "kids": return filters.excludeKids;
    case "gambles": return filters.excludeGambles;
    default: return false;
  }
}

// Each active preference, with the share of the pool it removes when
// every other preference is held exactly where the visitor set it.
// Shared by the report's impact section and Dream Partner Wrapped so
// both quote the same numbers.
function computeImpacts(stats, filters) {
  const base = computeProbability(stats, filters);
  return Object.keys(FILTER_NEUTRAL)
    .filter((key) => isFilterActive(key, filters))
    .map((key) => {
      const without = computeProbability(stats, Object.assign({}, filters, FILTER_NEUTRAL[key]));
      return {
        key,
        label: FILTER_LABELS[key],
        withoutPct: without.pct,
        removedShare: without.pct > 0 ? 1 - base.pct / without.pct : 0,
      };
    })
    .sort((a, b) => b.removedShare - a.removedShare);
}

// Concrete one-change relaxations, ranked by how many more people they
// actually put in the pool. Also shared with Wrapped.
function computeLeverageOptions(stats, filters) {
  const base = computeProbability(stats, filters);
  const candidates = [];
  // `meta` lets a candidate carry machine-readable detail alongside its
  // sentence, so Wrapped can illustrate the suggestion rather than
  // re-parsing the label text to find out what it was about.
  function consider(label, changed, meta) {
    const result = computeProbability(stats, Object.assign({}, filters, changed));
    if (result.matchingCount > base.matchingCount) {
      candidates.push(Object.assign({
        label,
        pct: result.pct,
        count: result.matchingCount,
        multiplier: base.matchingCount > 0 ? result.matchingCount / base.matchingCount : 0,
      }, meta || {}));
    }
  }

  if (filters.minHeight > HEIGHT_MIN_INCHES + 1) {
    consider(
      "Drop your height floor to " + inchesToFeetInches(filters.minHeight - 2),
      { minHeight: filters.minHeight - 2 },
      { kind: "height", fromInches: filters.minHeight, toInches: filters.minHeight - 2 }
    );
  }
  if (filters.minIncome > 0) {
    const relaxed = Math.round((filters.minIncome * 0.75) / 5000) * 5000;
    consider("Lower your income floor to " + formatIncome(relaxed), { minIncome: relaxed });
  }
  const widerLo = Math.max(18, filters.ageLo - 5);
  const widerHi = Math.min(80, filters.ageHi + 5);
  if (widerLo !== filters.ageLo || widerHi !== filters.ageHi) {
    consider("Widen your age range to " + widerLo + "–" + widerHi, { ageLo: widerLo, ageHi: widerHi });
  }
  if (filters.selectedRaces.length > 0) consider("Drop your race/ethnicity filter", { selectedRaces: [] });
  if (filters.selectedOrientations && filters.selectedOrientations.length > 0) {
    consider("Drop your sexual-orientation filter", { selectedOrientations: [] });
  }
  if (filters.selectedReligions && filters.selectedReligions.length > 0) {
    consider("Drop your religion filter", { selectedReligions: [] });
  }
  if (bodyTypeFilterActive(filters)) consider("Allow any body type", { selectedBodyTypes: [] });
  if (filters.excludeMarried) consider("Allow any marital status", { excludeMarried: false });
  if (filters.excludeKids) consider("Allow partners who have kids", { excludeKids: false });
  if (filters.excludeGambles) consider("Allow gamblers", { excludeGambles: false });

  return candidates.sort((a, b) => b.count - a.count);
}

function renderFilterImpacts(stats, filters) {
  const list = document.getElementById("filterImpactList");
  list.innerHTML = "";
  const impacts = computeImpacts(stats, filters);

  if (impacts.length === 0) {
    list.innerHTML =
      '<p class="report-empty">You haven’t set any preferences to analyze — everyone in your age range counts as a match.</p>';
    return;
  }

  impacts.forEach((impact) => {
    const pctRemoved = formatRemovedShare(impact.removedShare);
    const barPct = Math.max(0, Math.min(100, impact.removedShare * 100));
    const row = document.createElement("div");
    row.className = "impact-row";
    row.innerHTML =
      '<div class="impact-head">' +
        '<span class="impact-label">Your ' + impact.label + "</span>" +
        '<span class="impact-pct">−' + pctRemoved + "</span>" +
      "</div>" +
      '<div class="impact-bar"><div class="impact-bar-fill" style="width:' + Math.max(barPct, 1) + '%"></div></div>' +
      '<div class="impact-note">Without it, your odds would be ' + formatPercentage(impact.withoutPct) + "</div>";
    list.appendChild(row);
  });
}

const AGE_BUCKETS = [[18, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 100]];

function renderAgeDistribution(stats, filters, countryName) {
  const chart = document.getElementById("ageDistChart");
  const hint = document.getElementById("ageDistHint");
  chart.innerHTML = "";

  const { probability } = computeProbability(stats, filters);
  const totalAdults = stats.totalAdultPopulation[filters.targetSex];

  const bands = AGE_BUCKETS.map(([lo, hi]) => {
    const overlapLo = Math.max(lo, filters.ageLo);
    const overlapHi = Math.min(hi, filters.ageHi);
    if (overlapHi < overlapLo) return null;
    const share = ageRangeShare(stats, filters.targetSex, overlapLo, overlapHi);
    // A range can clip a bucket down to a single year (e.g. an upper
    // bound of 40 leaves just "40" of the 40-49 bucket) -- render that
    // as one number rather than a "40–40" range.
    const label = overlapLo === overlapHi ? String(overlapLo) : overlapLo + "–" + overlapHi;
    return { label, count: Math.round(totalAdults * share * probability) };
  }).filter(Boolean);

  if (bands.length === 0) return;

  const max = Math.max.apply(null, bands.map((b) => b.count).concat([1]));
  const peak = bands.reduce((a, b) => (b.count > a.count ? b : a), bands[0]);
  const sexWord = filters.targetSex === "men" ? "men" : "women";
  hint.textContent =
    "Across your " + filters.ageLo + "–" + filters.ageHi + " range in " + countryName +
    ", matching " + sexWord + " are most concentrated in the " + peak.label + " band.";

  bands.forEach((band) => {
    const row = document.createElement("div");
    row.className = "age-row";
    row.innerHTML =
      '<span class="age-label">' + band.label + "</span>" +
      '<div class="age-bar"><div class="age-bar-fill" style="width:' + Math.round((band.count / max) * 100) + '%"></div></div>' +
      '<span class="age-count">' + band.count.toLocaleString("en-US") + "</span>";
    chart.appendChild(row);
  });
}

function renderStrategy(stats, filters, countryName) {
  const list = document.getElementById("strategyList");
  list.innerHTML = "";
  const top = computeLeverageOptions(stats, filters).slice(0, 4);

  if (top.length === 0) {
    list.innerHTML =
      '<p class="report-empty">Your preferences are already about as broad as this tool can model — there’s nothing left to relax.</p>';
    return;
  }

  top.forEach((candidate) => {
    const multiplier = candidate.multiplier;
    const row = document.createElement("div");
    row.className = "strategy-row";
    row.innerHTML =
      '<div class="strategy-label">' + candidate.label + "</div>" +
      '<div class="strategy-figures">' +
        '<span class="strategy-pct">' + formatPercentage(candidate.pct) + "</span>" +
        (multiplier >= 1.05
          ? '<span class="strategy-mult">' + multiplier.toFixed(1) + "× your pool in " + countryName + "</span>"
          : "") +
      "</div>";
    list.appendChild(row);
  });
}

// True once the report has been unlocked -- i.e. the inputs (country,
// state/metro, background) are visible and the visitor can start
// choosing them. Distinct from whether #globalReport (the *results*)
// has been revealed yet, which only happens on the first "Find Out."
let reportUnlocked = false;

// Re-runs the already-unlocked report against fresh filters, without
// touching the country/state selects (so the visitor's current
// selection -- e.g. "Japan," or a drilled-into state -- is preserved
// rather than snapping back to United States on every "Find Out"
// press). This is the ONE place global results get computed/shown --
// both the very first reveal and every subsequent recalculation --
// matching how every other filter on this site only takes effect on
// "Find Out," never live on `change`.
function refreshGlobalReportIfVisible(filters) {
  if (!reportUnlocked) return;
  currentReportFilters = filters;
  globalReport.classList.remove("hidden");

  const isAggregate = countryMode === "multi" || countryMode === "global";
  singleCountryResult.classList.toggle("hidden", isAggregate);
  multiCountryResult.classList.toggle("hidden", !isAggregate);
  wrappedBtn.classList.toggle("hidden", isAggregate);

  if (isAggregate) {
    stateSelectorWrap.classList.add("hidden");
    stateCompareSection.classList.add("hidden");
    const multiModeMsg = '<p class="report-empty">Not available in Compare/Global mode — switch to Single country to see this breakdown.</p>';
    document.getElementById("filterImpactList").innerHTML = multiModeMsg;
    document.getElementById("ageDistChart").innerHTML = multiModeMsg;
    document.getElementById("ageDistHint").textContent = "";
    document.getElementById("strategyList").innerHTML = multiModeMsg;
    renderMultiCountryResult(filters);
  } else {
    renderSelectedCountryResult(filters);
  }
  renderComparisonTable(filters);
}

// Sets up the unlocked report's inputs (country, U.S. state/metro,
// background) so the visitor can choose everything in one pass before
// ever pressing Find Out. Deliberately does NOT compute or reveal any
// results here -- see refreshGlobalReportIfVisible(), which is what
// "Find Out" calls once the visitor is ready.
function renderGlobalReport(filters) {
  currentReportFilters = filters || {
    targetSex: "men", ageLo: 20, ageHi: 40, selectedRaces: [], minHeight: 68,
    minIncome: 0, selectedBodyTypes: [], excludeMarried: false, excludeKids: false,
    excludeGambles: false,
  };
  reportUnlocked = true;
  populateCountrySelect();
  syncGlobalInputsForCountry();

  reportCountrySelect.onchange = () => syncGlobalInputsForCountry();
  reportStateSelect.onchange = () => syncGlobalInputsForCountry();
  reportShowAllBtn.onclick = () => {
    reportShowingAll = !reportShowingAll;
    renderComparisonTable(currentReportFilters);
  };
  stateShowAllBtn.onclick = () => {
    stateShowingAll = !stateShowingAll;
    renderStateComparisonTable(currentReportFilters);
  };
  backgroundModeToggle.querySelectorAll('input[name="backgroundMode"]').forEach((input) => {
    input.onchange = () => {
      backgroundMode = input.value;
      syncGlobalInputsForCountry();
    };
  });
  backgroundCombineToggle.querySelectorAll('input[name="backgroundCombine"]').forEach((input) => {
    input.onchange = () => {
      backgroundCombineMode = input.value;
    };
  });
  countryModeToggle.querySelectorAll('input[name="countryMode"]').forEach((input) => {
    input.onchange = () => {
      countryMode = input.value;
      singleCountryWrap.classList.toggle("hidden", countryMode !== "single");
      multiCountryWrap.classList.toggle("hidden", countryMode !== "multi");
      globalModeWrap.classList.toggle("hidden", countryMode !== "global");
      backgroundSelectorWrap.classList.toggle("hidden", countryMode !== "single");
      if (countryMode === "multi" && !multiCountryPopulated) {
        populateMultiCountryOptions();
        multiCountryPopulated = true;
      }
      if (countryMode === "single") syncGlobalInputsForCountry();
    };
  });
  multiCountrySearch.oninput = applyMultiCountrySearchFilter;

  globalInputsWrap.classList.remove("hidden");
}

// --- Dream Partner Wrapped ---
// A tappable, Wrapped-style recap of the report. Every slide quotes a
// figure that came out of the same shared helpers the report sections
// use (computeProbability / computeImpacts / computeLeverageOptions),
// so the story and the tables can never disagree.
const wrappedOverlay = document.getElementById("wrappedOverlay");
const wrappedStage = document.getElementById("wrappedStage");
const wrappedBars = document.getElementById("wrappedBars");
const wrappedBtn = document.getElementById("wrappedBtn");

let wrappedSlides = [];
let wrappedIndex = 0;
let wrappedSummary = null;

function buildWrappedSlides(filters) {
  const code = reportCountrySelect.value || "US";
  const gg = window.QuizGlobalStats;
  // Reflects the drilled-into U.S. state if one is selected, so Wrapped
  // never contradicts what the report is currently showing.
  const meta = getActiveMeta(code);
  const stats = getActiveStats(code);
  // Same fix as the main report's result card: a country with no race
  // breakdown gets that one filter dropped for its own numbers rather
  // than a dishonest 0%, disclosed via raceIgnored below.
  const raceIgnored = missingRaceData(stats, filters);
  const effectiveFilters = effectiveFiltersFor(stats, filters);
  const home = computeProbability(stats, effectiveFilters);
  // Matches the main report's result card: the Background filter (if
  // any) only narrows/unions the single "your odds" headline, not the
  // country-vs-country ranking below, since other countries don't share
  // the same categories -- see activeBackgroundCountryCode()'s docs.
  const combinedHome = computeRaceBackgroundResult(activeBackgroundCountryCode(), effectiveFilters.selectedRaces, home);
  const homePct = combinedHome.pct;
  const homeMatchingCount = Math.round(stats.totalAdultPopulation[filters.targetSex] * home.pAge * combinedHome.probability);
  // Kept separate from `meta`: the country-level comparison and rank
  // always describe the whole country, even when a state is drilled
  // into, since a state isn't one of the 198 ranked entries.
  const countryMeta = gg.getCountryMeta(code);

  const ranked = Object.keys(gg.COUNTRIES)
    .map((c) => computeCountryResult(c, filters))
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);
  const best = ranked[0];
  const homeRank = ranked.findIndex((r) => r.meta.code === code) + 1;

  const impacts = computeImpacts(stats, effectiveFilters);
  const leverage = computeLeverageOptions(stats, effectiveFilters);

  const partnerWord = filters.targetSex === "men" ? "man" : "woman";
  const sexWord = filters.targetSex === "men" ? "men" : "women";

  let score;
  if (homePct >= 25) score = 1;
  else if (homePct >= 10) score = 2;
  else if (homePct >= 3) score = 3;
  else if (homePct >= 1) score = 4;
  else score = 5;
  const rarity = RARITY_LEVELS[score - 1];

  wrappedSummary = {
    countryName: meta.name,
    countryOnlyName: countryMeta.name,
    pctText: formatPercentage(homePct),
    matchingCount: homeMatchingCount,
    partnerWord,
    score,
    rarityLabel: rarity.label,
    topImpact: impacts[0] || null,
    best: best || null,
    bestMultiplier: best && homePct > 0 ? best.pct / homePct : 0,
    homeRank,
    totalCountries: ranked.length,
    topLeverage: leverage[0] || null,
  };

  const slides = [
    {
      theme: "intro",
      kicker: "Out Of Pocket TV",
      big: "Your Dream Partner Wrapped",
      sub: "Everything your answers actually add up to.",
    },
    {
      theme: "odds",
      icon: "globe",
      kicker: "Your odds in " + meta.name,
      big: formatPercentage(homePct),
      sub: "chance the " + partnerWord + " of your dreams exists — roughly " +
        homeMatchingCount.toLocaleString("en-US") + " " + sexWord + "." +
        (raceIgnored ? " (" + meta.name + " doesn't publish a race breakdown, so this counts any race.)" : ""),
    },
    {
      // The rarity slide takes its whole look from the score -- a 5/5
      // "Lost in the Matrix" reads very differently from a 1/5.
      theme: "rarity-" + score,
      icon: RARITY_ICONS[score - 1],
      kicker: "Dream Partner Rarity",
      big: score + "/5",
      sub: rarity.label,
    },
  ];

  if (impacts.length) {
    slides.push({
      theme: "constraint",
      icon: "link",
      kicker: "Your most restrictive preference",
      big: "−" + formatRemovedShare(impacts[0].removedShare),
      sub: "Your " + impacts[0].label + " alone removes that much of your pool. Without it: " +
        formatPercentage(impacts[0].withoutPct) + ".",
    });
  }
  if (best) {
    slides.push({
      theme: "country",
      icon: "compass",
      kicker: "Your best odds on Earth",
      big: best.meta.name,
      sub: formatPercentage(best.pct) +
        (wrappedSummary.bestMultiplier >= 1.05
          ? " — " + wrappedSummary.bestMultiplier.toFixed(1) + "× your odds in " + meta.name + "."
          : "."),
    });
  }
  if (homeRank > 0) {
    slides.push({
      theme: "rank",
      icon: "medal",
      kicker: countryMeta.name + " ranks",
      big: "#" + homeRank,
      sub: "out of " + ranked.length + " countries, for your exact filters.",
    });
  }
  if (code === "US") {
    const stateResults = allUsGeographyCodes()
      .map((c) => computeStateResult(c, filters))
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct);
    const bestState = stateResults[0];
    if (bestState && bestState.meta.name !== meta.name) {
      wrappedSummary.bestState = bestState;
      slides.push({
        theme: "state",
        icon: "pin",
        kicker: "Your best odds in the U.S.",
        big: bestState.meta.name,
        sub: formatPercentage(bestState.pct) + " — recalculated for its own population.",
      });
    }
  }
  if (leverage.length) {
    const topLift = leverage[0];
    slides.push({
      theme: "unlock",
      icon: "key",
      // The biggest unlock is whichever change adds the most people, and
      // that is often income or age rather than height. The height
      // illustration is therefore only shown when it actually matches the
      // suggestion beside it -- otherwise the slide keeps the key icon.
      scene: topLift.kind === "height"
        ? { kind: "height", from: inchesToFeetInches(topLift.fromInches), to: inchesToFeetInches(topLift.toInches) }
        : null,
      kicker: "Your single biggest unlock",
      big: formatPercentage(topLift.pct),
      sub: topLift.label + " — " + topLift.multiplier.toFixed(1) + "× your current pool.",
    });
  }
  slides.push({ theme: "outro", icon: "sparkle", kicker: "outofpocket.tv", big: "Share your Wrapped", sub: "See how your odds stack up against the whole planet.", isOutro: true });

  return slides;
}


// Wrapped's artwork, as inline SVG rather than emoji. Three reasons this
// isn't emoji any more:
//   1. Flag emoji DON'T EXIST on Windows -- Chrome falls back to drawing
//      the two regional-indicator letters, so those slides read "US" and
//      "NL" in plain text on every Windows desktop.
//   2. iOS renders colour emoji as bitmap glyphs whose alpha is the whole
//      character box, so `filter: drop-shadow()` paints a visible
//      RECTANGLE around them instead of hugging the shape.
//   3. Each platform ships its own emoji art, so the cards looked like a
//      different designer made them depending on the device.
// One stroked set, drawn in currentColor, fixes all three: it renders
// identically everywhere, takes the slide's own colour, and has real
// alpha so a glow follows its outline.
const WRAPPED_ICON_PATHS = {
  globe:
    '<circle cx="32" cy="32" r="21"/><ellipse cx="32" cy="32" rx="9.5" ry="21"/>' +
    '<path d="M11 32h42"/><path d="M16.6 18.4c8.6 4.8 22.2 4.8 30.8 0"/>' +
    '<path d="M16.6 45.6c8.6-4.8 22.2-4.8 30.8 0"/>',
  home:
    '<path d="M12.5 30.5 32 14l19.5 16.5"/><path d="M17.5 28.5V49h29V28.5"/>' +
    '<path d="M26.5 49V37.5h11V49"/>',
  car:
    '<path d="M13 41v-8l5-12h28l5 12v8"/><path d="M18 33h28"/><path d="M13 41h38"/>' +
    '<circle cx="21.5" cy="43.5" r="4.5"/><circle cx="42.5" cy="43.5" r="4.5"/>',
  plane:
    '<path d="M32 9c2 0 3.4 2.6 3.4 6.4v8.2l16.6 10v4.6l-16.6-4.4v9.6l5.4 4.4v3.8L32 49.4' +
    'l-8.8 2.2v-3.8l5.4-4.4v-9.6L12 38.2v-4.6l16.6-10v-8.2C28.6 11.6 30 9 32 9z"/>',
  rocket:
    '<path d="M32 8.5c5.8 5.6 9 13.6 9 21.8v9.4l-3.6 5.4H26.6L23 39.7v-9.4c0-8.2 3.2-16.2 9-21.8z"/>' +
    '<circle cx="32" cy="26" r="4.2"/><path d="M23 33.5 16.5 40v8.5l6.5-4.4"/>' +
    '<path d="M41 33.5 47.5 40v8.5L41 44.1"/>' +
    '<path d="M28.6 50.5c.9 3 2 5.2 3.4 6.5 1.4-1.3 2.5-3.5 3.4-6.5"/>',
  link:
    '<path d="M27.5 36.5a9.5 9.5 0 0 1 0-13.4l5.6-5.6a9.5 9.5 0 0 1 13.4 13.4l-2.8 2.8"/>' +
    '<path d="M36.5 27.5a9.5 9.5 0 0 1 0 13.4l-5.6 5.6a9.5 9.5 0 0 1-13.4-13.4l2.8-2.8"/>',
  compass:
    '<circle cx="32" cy="32" r="21"/><path d="M40.5 23.5 35 35 23.5 40.5 29 29z"/>',
  medal:
    '<path d="M23 27 17 11h30l-6 16"/><circle cx="32" cy="39.5" r="13"/>' +
    '<path d="m32 33 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>',
  pin:
    '<path d="M32 55.5s15.5-15.4 15.5-25.5a15.5 15.5 0 1 0-31 0C16.5 40.1 32 55.5 32 55.5z"/>' +
    '<circle cx="32" cy="29" r="6"/>',
  key:
    '<circle cx="23" cy="41" r="10.5"/><path d="M30.4 33.6 51 13"/>' +
    '<path d="m43 21.5 6 6"/><path d="m37 27.5 5 5"/>',
  sparkle:
    '<path d="M30 12 34.6 25.4 48 30l-13.4 4.6L30 48l-4.6-13.4L12 30l13.4-4.6z"/>' +
    '<path d="M47 40.5 49 46l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z"/>',
};

// Some slides carry an actual illustration rather than an icon. The
// artwork is a supplied transparent PNG of two figures; everything around
// it -- the ring, ruler, measurement lines and glow -- is CSS, so the
// LABELS stay live HTML text and show the visitor's own height values.
// Line offsets come from the artwork's measured ink bounds: the man's
// head starts at 0.1% of the image height and the woman's at 11.3%, so
// the two rules land on the actual heads at any rendered size.
function buildWrappedScene(scene) {
  if (!scene || scene.kind !== "height") return "";
  return '<div class="height-scene" aria-hidden="true">' +
      '<span class="height-scene-glow"></span>' +
      '<span class="height-ruler"></span>' +
      '<div class="height-figure">' +
        // If the artwork is ever missing the card must still read, so the
        // scene collapses to its lines rather than showing a broken image.
        '<img class="height-couple-image" src="height-couple-people-only.png" alt="" ' +
          'onerror="this.closest(&quot;.height-scene&quot;).classList.add(&quot;height-scene-noart&quot;)">' +
        '<span class="height-line height-line-current">' +
          '<span class="height-line-label">' + escapeHtml(scene.from) + '</span></span>' +
        '<span class="height-line height-line-suggested">' +
          '<span class="height-line-label">' + escapeHtml(scene.to) + '</span></span>' +
      '</div>' +
    '</div>';
}

function wrappedIcon(name) {
  const paths = WRAPPED_ICON_PATHS[name];
  if (!paths) return "";
  return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    paths + "</svg>";
}

// 5/5 keeps its glowing "01" digits rather than an icon -- it is the one
// tier whose artwork is the Matrix rain motif itself.
const RARITY_ICONS = ["home", "car", "plane", "rocket", "matrix"];

// Counts a number up to its final value instead of just popping it in --
// e.g. a percentage climbing to "2.6%", a rank climbing to "#23", a
// rarity score climbing to "5/5". Works on any already-formatted string
// with exactly one leading/trailing number in it (prefix and suffix,
// like "%" or "#" or "/5" or "−", pass through unanimated); a string
// with no number in it (a country name) is just set directly.
function animateCountUpText(el, finalText, duration) {
  // requestAnimationFrame is paused while a tab is hidden, so animating there
  // would leave the old number on screen -- visibly disagreeing with the
  // lines beneath it -- until the tab is looked at again. Skip straight to
  // the value in that case, same as for reduced motion.
  if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = finalText;
    return;
  }
  const match = finalText.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) {
    el.textContent = finalText;
    return;
  }
  const [, prefix, numStr, suffix] = match;
  const target = parseFloat(numStr);
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / (duration || 800));
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = finalText;
  };
  requestAnimationFrame(step);
}

function renderWrappedSlide() {
  const slide = wrappedSlides[wrappedIndex];
  if (!slide) return;

  // Each slide drives the whole overlay's palette/background through a
  // data-theme hook, so the story reads as a designed sequence rather
  // than one purple screen with swapped text.
  wrappedOverlay.dataset.theme = slide.theme || "intro";

  const isMatrix = slide.icon === "matrix";
  const art = slide.scene
    ? buildWrappedScene(slide.scene)
    : slide.icon
    ? `<div class="wrapped-art${isMatrix ? " wrapped-art-matrix" : ""}" aria-hidden="true">${
        isMatrix ? "01" : wrappedIcon(slide.icon)
      }</div>`
    : "";

  wrappedStage.innerHTML =
    '<div class="wrapped-slide">' +
      art +
      '<div class="wrapped-kicker">' + slide.kicker + "</div>" +
      '<div class="wrapped-big"></div>' +
      '<div class="wrapped-sub">' + slide.sub + "</div>" +
      (slide.isOutro
        ? '<div class="wrapped-actions">' +
            '<button class="wrapped-action-primary" id="wrappedShareBtn" type="button">Share / Save Image</button>' +
          "</div>"
        : "") +
    "</div>";
  animateCountUpText(wrappedStage.querySelector(".wrapped-big"), slide.big, 900);

  Array.from(wrappedBars.children).forEach((bar, i) => {
    bar.classList.toggle("filled", i <= wrappedIndex);
  });

  if (slide.isOutro) {
    document.getElementById("wrappedShareBtn").addEventListener("click", shareWrapped);
  }
}

function openWrapped() {
  const filters = loadLastFilters() || currentReportFilters;
  if (!filters) return;
  wrappedSlides = buildWrappedSlides(filters);
  wrappedIndex = 0;

  wrappedBars.innerHTML = "";
  wrappedSlides.forEach(() => {
    const bar = document.createElement("div");
    bar.className = "wrapped-bar";
    wrappedBars.appendChild(bar);
  });

  wrappedOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderWrappedSlide();
}

function closeWrapped() {
  wrappedOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function stepWrapped(delta) {
  const next = wrappedIndex + delta;
  if (next < 0) return;
  if (next >= wrappedSlides.length) {
    closeWrapped();
    return;
  }
  wrappedIndex = next;
  renderWrappedSlide();
}

if (wrappedBtn) wrappedBtn.addEventListener("click", openWrapped);
document.getElementById("wrappedClose").addEventListener("click", closeWrapped);
document.getElementById("wrappedNext").addEventListener("click", () => stepWrapped(1));
document.getElementById("wrappedPrev").addEventListener("click", () => stepWrapped(-1));
document.addEventListener("keydown", (e) => {
  if (wrappedOverlay.classList.contains("hidden")) return;
  if (e.key === "Escape") closeWrapped();
  if (e.key === "ArrowRight") stepWrapped(1);
  if (e.key === "ArrowLeft") stepWrapped(-1);
});

// Wrapped share image -- same 1080x1920 story format as the free result
// card, but carrying the global figures the report unlocked.
function drawWrappedCard() {
  const s = wrappedSummary;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  const accent = RARITY_ACCENTS[s.score - 1];
  const cx = canvas.width / 2;

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#241c3d");
  bg.addColorStop(1, "#07061a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (shareLogoImg.complete && shareLogoImg.naturalWidth > 0) {
    ctx.drawImage(shareLogoImg, cx - 70, 100, 140, 140);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 46px Arial";
  ctx.fillText("OUT OF POCKET TV", cx, 300);
  ctx.fillStyle = "#b7b7b7";
  ctx.font = "700 40px Arial";
  ctx.fillText("DREAM PARTNER WRAPPED", cx, 356);

  const grad = ctx.createLinearGradient(0, 470, 0, 640);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, accent);
  ctx.fillStyle = grad;
  ctx.font = "800 190px Arial";
  ctx.fillText(s.pctText, cx, 640);

  ctx.fillStyle = "#b7b7b7";
  ctx.font = "40px Arial";
  wrapLines(ctx, "chance the " + s.partnerWord + " of my dreams exists in " + s.countryName, 900)
    .forEach((line, i) => ctx.fillText(line, cx, 720 + i * 52));

  let y = 880;
  ctx.fillStyle = "#9a9a9a";
  ctx.font = "34px Arial";
  ctx.fillText("Rarity Score", cx, y);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Arial";
  ctx.fillText(s.score + "/5 · " + s.rarityLabel, cx, y + 52);

  y += 150;
  const rows = [];
  if (s.best) rows.push(["Best country on Earth", s.best.meta.name + " · " + formatPercentage(s.best.pct)]);
  if (s.bestState) rows.push(["Best U.S. state", s.bestState.meta.name + " · " + formatPercentage(s.bestState.pct)]);
  if (s.homeRank > 0) rows.push([s.countryOnlyName + " ranks", "#" + s.homeRank + " of " + s.totalCountries]);
  if (s.topImpact) rows.push(["Biggest constraint", "Your " + s.topImpact.label]);
  if (s.topLeverage) rows.push(["Biggest unlock", s.topLeverage.label]);

  rows.forEach(([label, value]) => {
    ctx.fillStyle = "#9a9a9a";
    ctx.font = "34px Arial";
    ctx.fillText(label, cx, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 40px Arial";
    wrapLines(ctx, value, 940).forEach((line, i) => ctx.fillText(line, cx, y + 52 + i * 48));
    y += 150;
  });

  ctx.fillStyle = "#9a9a9a";
  ctx.font = "34px Arial";
  ctx.fillText("Get your own Global Dream Partner Report", cx, 1800);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Arial";
  ctx.fillText("outofpocket.tv", cx, 1860);

  return canvas;
}

async function shareWrapped() {
  const canvas = drawWrappedCard();
  const caption =
    "My Dream Partner Wrapped: " + wrappedSummary.pctText + " chance the " + wrappedSummary.partnerWord +
    " of my dreams exists in " + wrappedSummary.countryName +
    (wrappedSummary.best ? " — best odds on Earth: " + wrappedSummary.best.meta.name : "") +
    ". Check yours at " + SITE_URL;
  try {
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], "dream-partner-wrapped.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: caption });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // user dismissed the share sheet
  }
  const link = document.createElement("a");
  link.download = "dream-partner-wrapped.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

const restoreAccessLink = document.getElementById("restoreAccessLink");
const restoreAccessPanel = document.getElementById("restoreAccessPanel");
const restoreAccessEmail = document.getElementById("restoreAccessEmail");
const restoreAccessSubmit = document.getElementById("restoreAccessSubmit");
const restoreAccessMsg = document.getElementById("restoreAccessMsg");

// --- Persisted access: remember an unlocked report across visits ---
// Access is never GRANTED from anything stored client-side -- verifyAccess()
// always re-checks the remembered session_id against our own server-side
// record. localStorage only saves us from having to keep the original
// Stripe-redirect URL around; without it, closing the tab meant losing
// access entirely even though the purchase was still valid.
const ACCESS_STORAGE_KEY = "oop_access_session_id";

function saveAccessSessionId(sessionId) {
  try {
    localStorage.setItem(ACCESS_STORAGE_KEY, sessionId);
  } catch (err) {
    // localStorage can be unavailable (private browsing, storage full);
    // the emailed access link still works as a fallback.
  }
}

function loadAccessSessionId() {
  try {
    return localStorage.getItem(ACCESS_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

// Puts a saved filter set back onto the form controls. Needed only after
// the Stripe redirect, which reloads the page and resets every slider and
// checkbox to its default -- without this a buyer would be reading a
// report about filters the form on screen no longer shows.
function applyFiltersToControls(f) {
  if (!f) return;

  if (f.targetSex && f.targetSex !== targetSex) {
    const btn = document.querySelector(`#targetSexGroup .seg-btn[data-sex="${f.targetSex}"]`);
    // Clicked rather than set, so the toggle's own side effects (hero
    // wording, the gambling filter's visibility) run exactly as they do
    // for a real press. It also clears the gambling box, which is why
    // that checkbox is restored further down instead of here.
    if (btn) btn.click();
  }

  if (Number.isFinite(f.ageLo)) ageMin.value = f.ageLo;
  if (Number.isFinite(f.ageHi)) ageMax.value = f.ageHi;
  updateAgeSlider();

  if (Number.isFinite(f.minHeight)) { heightSlider.value = f.minHeight; updateHeightBubble(); }
  if (Number.isFinite(f.minIncome)) { incomeSlider.value = f.minIncome; updateIncomeBubble(); }

  raceGroup.setSelected(f.selectedRaces);
  orientationGroup.setSelected(f.selectedOrientations);
  religionGroup.setSelected(f.selectedReligions);
  // Normalised, not read straight off: a filter set saved before body type
  // became a multi-select carries excludeObese and no selectedBodyTypes,
  // and a buyer coming back from checkout has to see the boxes that match
  // the report they just paid for.
  bodyTypeGroup.setSelected(normalizeBodyTypes(f));
  updateBackgroundModeToggleVisibility();

  document.getElementById("excludeMarried").checked = Boolean(f.excludeMarried);
  document.getElementById("excludeKids").checked = Boolean(f.excludeKids);
  excludeGamblesCheck.checked = Boolean(f.excludeGambles);
  updateGamblesVisibility();
}

// Selects a country-scope mode programmatically. Dispatches the change
// rather than only ticking the radio, so the mode's own panels show and
// hide instead of leaving the UI describing a different scope than the
// one being calculated.
function setCountryMode(mode) {
  const input = countryModeToggle.querySelector(`input[name="countryMode"][value="${mode}"]`);
  if (!input) return;
  input.checked = true;
  input.dispatchEvent(new Event("change"));
}

function unlockReport() {
  closePaywall();
  unlockButtons.forEach((btn) => btn.classList.add("hidden"));
  premiumLockedGrid.classList.add("hidden");
  restoreAccessLink.classList.add("hidden");
  restoreAccessPanel.classList.add("hidden");
  // The pitch lives in the modal now, so all that's left here is the
  // "you have access" badge -- shown on every reload, not just at the
  // moment of purchase, so it never sits above the report as clutter.
  premiumTeaser.classList.add("unlocked");
  showPremiumStatus("unlocked", "✓ Purchase verified — your results are unlocked.");

  const saved = loadLastFilters();
  renderGlobalReport(saved);

  // Worldwide is the default scope for anyone who has paid, on every
  // visit -- not just the one where they bought. What was sold is the
  // global answer, so a returning visitor pressing Find Out must not get
  // a United States figure just because that is the country select's
  // first entry. They can still narrow to one country themselves.
  setCountryMode("global");

  // "Unlock My Results" has to mean exactly that. Checkout is a full-page
  // redirect, so a buyer lands back here on a blank, reset page; restore
  // what they asked for and run it, rather than making someone press
  // "Find Out" a second time for something they have already bought.
  // Absent on a fresh session (sessionStorage is per-tab), and then there
  // is nothing to replay -- they simply set their filters and press it.
  if (saved) {
    applyFiltersToControls(saved);
    runFindOut();
  }
}

// Verifies a session_id against our own DB record and, on success,
// remembers it so a later visit on this browser restores access without
// needing the checkout-redirect URL again. `silent` suppresses the
// verifying/error banners for the on-load auto-restore check, since that
// isn't a user-initiated action and a denial there (e.g. a transient
// network hiccup) shouldn't read as an error message to someone who
// hasn't done anything yet.
function verifyAccess(sessionId, { silent } = {}) {
  if (!silent) showPremiumStatus("verifying", "Verifying your purchase…");
  return fetch(`/api/report-access?session_id=${encodeURIComponent(sessionId)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.access === "granted") {
        saveAccessSessionId(sessionId);
        premiumTeaser.classList.remove("hidden");
        unlockReport();
        // Only a fresh Stripe-redirect verification is a genuine new
        // purchase -- verifyAccess is also called silently on every
        // returning visit to restore access from localStorage, which must
        // never be counted as a new sale (no dollar value included since
        // this project doesn't hardcode the report's price anywhere; add
        // `value`/`currency` here if that's wanted for GA4 revenue reports).
        if (!silent) {
          trackEvent("purchase", { transaction_id: sessionId });
        }
        return true;
      }
      if (!silent) {
        showPremiumStatus("error", "We couldn't verify this purchase yet. If you were just charged, refresh in a few seconds — the confirmation can take a moment to arrive.");
      }
      return false;
    })
    .catch(() => {
      if (!silent) {
        showPremiumStatus("error", "We couldn't verify this purchase right now. Please refresh, or contact us if the charge went through.");
      }
      return false;
    });
}

// Handle the return trip from Stripe Checkout (?session_id=...&status=success|cancelled),
// or a returning visit on a browser that already unlocked the report
// earlier this session or a prior one.
(function handleAccessOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const sessionId = params.get("session_id");

  // Strips ?status=...&session_id=... from the visible URL right away so
  // refreshing this page later doesn't keep re-running the Stripe-return
  // flow (and re-showing "Verifying your purchase…") forever -- a later
  // reload instead takes the normal silent restore-from-localStorage path.
  if (status || sessionId) {
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (status === "cancelled") {
    premiumTeaser.classList.remove("hidden");
    showPremiumStatus("cancelled", "Checkout was cancelled — no charge was made. You can try again anytime.");
    return;
  }

  if (status === "success" && sessionId) {
    premiumTeaser.classList.remove("hidden");
    verifyAccess(sessionId);
    return;
  }

  const savedSessionId = loadAccessSessionId();
  if (savedSessionId) verifyAccess(savedSessionId, { silent: true });
})();

// --- Restore access: re-email the access link for a new device or
// cleared storage, without needing an account or password. ---
restoreAccessLink.addEventListener("click", () => {
  const isExpanded = restoreAccessLink.getAttribute("aria-expanded") === "true";
  restoreAccessLink.setAttribute("aria-expanded", String(!isExpanded));
  restoreAccessPanel.classList.toggle("hidden", isExpanded);
});

function showRestoreAccessMsg(message, isError) {
  restoreAccessMsg.textContent = message;
  restoreAccessMsg.classList.toggle("status-error", Boolean(isError));
  restoreAccessMsg.classList.remove("hidden");
}

restoreAccessSubmit.addEventListener("click", async () => {
  const email = restoreAccessEmail.value.trim();
  if (!email) {
    showRestoreAccessMsg("Enter the email you used at checkout.", true);
    return;
  }
  restoreAccessSubmit.disabled = true;
  restoreAccessSubmit.textContent = "Sending…";
  try {
    const res = await fetch("/api/resend-access-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    showRestoreAccessMsg(data.message || "If that email made a purchase, we've sent your access link — check your inbox.", !res.ok);
  } catch (err) {
    showRestoreAccessMsg("Something went wrong. Please try again in a moment.", true);
  } finally {
    restoreAccessSubmit.disabled = false;
    restoreAccessSubmit.textContent = "Send my link";
  }
});









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

// --- Rotating dot-globe (unlocked report only) ---
// Land coverage as longitude spans per 5-degree latitude band, north
// pole (band 0) down to south pole (band 35). Deliberately coarse and
// simplified, exactly the same "recognizable, not survey-accurate"
// standard as US_OUTLINE above: continents read correctly at a glance,
// but this carries no political borders and isn't a country map. Ranges
// are inclusive longitudes in degrees (-180..180).
const WORLD_LAND_BANDS = [
  [],                                                          // 90-85 N
  [[-100, -70], [-60, -20]],                                   // 85-80
  [[-120, -70], [-65, -20], [10, 30], [55, 110]],              // 80-75
  [[-130, -65], [-55, -20], [15, 180]],                        // 75-70
  [[-165, -65], [-50, -20], [5, 180]],                         // 70-65
  [[-165, -60], [-50, -40], [-25, -13], [5, 180]],             // 65-60
  [[-165, -140], [-135, -55], [-8, -1], [4, 180]],             // 60-55
  [[-130, -55], [-8, 2], [3, 180]],                            // 55-50
  [[-125, -60], [-2, 180]],                                    // 50-45
  [[-125, -70], [-9, 146]],                                    // 45-40
  [[-122, -75], [-9, -1], [8, 145]],                           // 40-35
  [[-118, -79], [-10, 135]],                                   // 35-30
  [[-115, -80], [-15, 122]],                                   // 30-25
  [[-110, -88], [-85, -75], [-17, 120]],                       // 25-20
  [[-105, -88], [-75, -61], [-17, 40], [42, 55], [72, 92], [94, 110], [120, 126]],   // 20-15
  [[-90, -83], [-73, -60], [-16, 45], [43, 52], [74, 81], [97, 109], [121, 126]],    // 15-10
  [[-83, -60], [-13, 48], [76, 81], [98, 107], [122, 126]],    // 10-5
  [[-79, -50], [8, 46], [100, 119]],                           // 5-0
  [[-80, -45], [9, 43], [100, 131]],                           // 0-5 S
  [[-79, -35], [11, 41], [105, 136], [132, 151]],              // 5-10
  [[-77, -35], [12, 41], [118, 151], [126, 145]],              // 10-15
  [[-73, -38], [11, 41], [114, 148]],                          // 15-20
  [[-71, -40], [13, 36], [113, 152]],                          // 20-25
  [[-73, -48], [15, 33], [113, 153]],                          // 25-30
  [[-73, -53], [17, 30], [115, 152]],                          // 30-35
  [[-74, -57], [136, 150], [172, 178]],                        // 35-40
  [[-75, -63], [144, 149], [170, 176]],                        // 40-45
  [[-76, -65]],                                                // 45-50
  [[-75, -67]],                                                // 50-55
  [],                                                          // 55-60
  [[-65, -57]],                                                // 60-65
  [[-180, -58], [-45, 180]],                                   // 65-70
  [[-180, 180]],                                               // 70-75
  [[-180, 180]],                                               // 75-80
  [[-180, 180]],                                               // 80-85
  [[-180, 180]],                                               // 85-90 S
];

const GLOBE_TILT_DEG = 20;      // slight northern tilt reads better than edge-on
const GLOBE_SPIN_MS = 40000;    // one full revolution

function isLandAt(lon, lat) {
  const band = Math.floor((90 - lat) / 5);
  const spans = WORLD_LAND_BANDS[Math.max(0, Math.min(WORLD_LAND_BANDS.length - 1, band))];
  return !!spans && spans.some(([a, b]) => lon >= a && lon <= b);
}

// Sampled once. The per-ring count scales with cos(latitude) so dots stay
// evenly spaced across the sphere's surface instead of bunching together
// at the poles the way a naive lat/lon grid would.
let globePoints = null;
function getGlobePoints() {
  if (globePoints) return globePoints;
  const points = [];
  for (let lat = -88; lat <= 88; lat += 4) {
    const ring = Math.max(1, Math.round(96 * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < ring; i++) {
      const lon = -180 + (i / ring) * 360;
      if (isLandAt(lon, lat)) points.push({ lon, lat });
    }
  }
  globePoints = points;
  return points;
}

const globeCanvas = document.getElementById("globeCanvas");
let globeMatchSet = null;
let globeRaf = null;
let globeSpin = 0;

function drawGlobe() {
  const size = globeCanvas.clientWidth;
  if (!size) return;
  const dpr = window.devicePixelRatio || 1;
  if (globeCanvas.width !== Math.round(size * dpr)) {
    globeCanvas.width = Math.round(size * dpr);
    globeCanvas.height = Math.round(size * dpr);
  }
  const ctx = globeCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;
  const lam0 = globeSpin * 360;
  const tilt = (GLOBE_TILT_DEG * Math.PI) / 180;
  const sinTilt = Math.sin(tilt);
  const cosTilt = Math.cos(tilt);
  const dotR = Math.max(1.1, size * 0.0062);

  // Orthographic projection: a point is drawn only while it's on the
  // hemisphere facing the viewer (cosc > 0), which is what makes the
  // flat dot field read as a rotating sphere.
  getGlobePoints().forEach((pt, i) => {
    const lam = ((pt.lon - lam0) * Math.PI) / 180;
    const phi = (pt.lat * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const cosLam = Math.cos(lam);
    const cosc = sinTilt * sinPhi + cosTilt * cosPhi * cosLam;
    if (cosc <= 0.02) return;

    const x = cx + radius * cosPhi * Math.sin(lam);
    const y = cy - radius * (cosTilt * sinPhi - sinTilt * cosPhi * cosLam);
    const isMatch = globeMatchSet && globeMatchSet.has(i);

    ctx.beginPath();
    ctx.arc(x, y, isMatch ? dotR * 1.3 : dotR, 0, Math.PI * 2);
    if (isMatch) {
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
      ctx.shadowBlur = dotR * 4;
    } else {
      // Dots fade toward the limb, which gives the sphere its depth.
      ctx.fillStyle = `rgba(150, 155, 170, ${(0.22 + 0.5 * cosc).toFixed(3)})`;
      ctx.shadowBlur = 0;
    }
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function stopGlobe() {
  if (globeRaf !== null) {
    cancelAnimationFrame(globeRaf);
    globeRaf = null;
  }
}

function startGlobe(pct) {
  const points = getGlobePoints();
  const total = points.length;
  const matchDots = Math.max(0, Math.min(total, Math.round((pct / 100) * total)));
  // Chosen once per render, not per frame, so the glowing dots travel
  // with the globe instead of flickering around it.
  const matchIndexes = new Set();
  while (matchIndexes.size < matchDots) {
    matchIndexes.add(Math.floor(Math.random() * total));
  }
  globeMatchSet = matchIndexes;

  stopGlobe();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawGlobe();
    return;
  }
  let last = performance.now();
  const loop = (now) => {
    globeSpin = (globeSpin + (now - last) / GLOBE_SPIN_MS) % 1;
    last = now;
    drawGlobe();
    globeRaf = requestAnimationFrame(loop);
  };
  globeRaf = requestAnimationFrame(loop);
}

// Every result the site now shows is an unlocked one, which can describe
// any country -- or the whole planet -- so the globe is what renders. The
// U.S. dot map is kept as the fallback for the locked case, which
// runFindOut() no longer reaches but which nothing else guarantees.
function renderProbabilityVisual(pct) {
  const grid = document.getElementById("dotGrid");
  if (!reportUnlocked) {
    stopGlobe();
    globeCanvas.classList.add("hidden");
    grid.classList.remove("hidden");
    renderDotGrid(pct);
    return;
  }
  grid.classList.add("hidden");
  globeCanvas.classList.remove("hidden");
  startGlobe(pct);
}

window.addEventListener("resize", () => {
  if (!globeCanvas.classList.contains("hidden")) drawGlobe();
});


function renderPercentage(pct) {
  animateCountUpText(document.getElementById("percentageResult"), formatPercentage(pct), 900);
}

function renderCount(matchingCount, countLabel) {
  const el = document.getElementById("countText");
  const sexWord = targetSex === "men" ? "men" : "women";
  el.textContent = `That's roughly ${matchingCount.toLocaleString("en-US")} ${sexWord} ${countLabel || "in the U.S."} who fit your standards.`;
}


function renderOddsLine(pct) {
  const el = document.getElementById("oddsLine");
  const phrase = oddsPhrase(pct, targetSex);
  if (!phrase) {
    el.textContent = "";
    el.classList.add("hidden");
    return;
  }
  el.textContent = `${phrase}.`;
  el.classList.remove("hidden");
}


function renderDelusionScore(pct, partnerGender) {
  // Bands and wording live in quiz-core.js so the stream console scores a
  // guest on air exactly the way this page does.
  const { score, label, icon, glow, hue } =
    rarityFor(pct, { globalScope: reportUnlocked && countryMode === "global" });

  if (score === 5) {
    startMatrixRain();
    stopMoonScene();
    hideNewRarityStages();
    activateStage(matrixStage);
  } else if (score === 4) {
    stopMatrixRain();
    buildMoonScene(partnerGender);
    startMoonScene();
    hideNewRarityStages();
    hideMatrixStage();
  } else {
    stopMatrixRain();
    stopMoonScene();
    updateRarityScene(score, partnerGender);
  }

  const row = document.getElementById("litterRow");
  row.innerHTML = "";
  row.style.setProperty("--rarity-glow", glow);
  // Only the Matrix tier sets a hue shift; everything else renders as-is.
  row.style.setProperty("--pip-hue", (hue || 0) + "deg");
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement("span");
    span.textContent = icon;
    // Each pip starts its float a beat after the one before it, so the row
    // ripples rather than bobbing in unison.
    span.style.setProperty("--pip-delay", `${(i - 1) * 0.16}s`);
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

// Encodes the result into the share link so the preview a friend sees in
// their feed shows THEIR criteria and THEIR number, not the generic site
// image. Positional array -- the field order must stay in step with
// decodeShare() in lib/share-card.js, which reads it back server-side.
// [pctText, score, dreamWord, oddsText, scopeLabel, ...criteria]
function encodeShareResult(data) {
  const arr = [
    String(data.pctText || ""),
    Number(data.score) || 1,
    String(data.dreamWord || ""),
    String(data.oddsText || ""),
    String(data.scopeLabel || ""),
  ].concat((data.criteria || []).map(String));
  const bytes = new TextEncoder().encode(JSON.stringify(arr));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Falls back to the plain homepage if anything about the encoding fails
// -- a share that loses its custom preview still beats a broken link.
function shareUrl() {
  if (!lastShareData) return SITE_URL;
  try {
    return `${SITE_URL}/s/${encodeShareResult(lastShareData)}`;
  } catch (err) {
    return SITE_URL;
  }
}

function shareCaption() {
  if (!lastShareData) return "";
  return `I have a ${lastShareData.pctText} chance the ${lastShareData.dreamWord} of my dreams exists (Dream Partner Rarity: ${lastShareData.score}/5 — ${lastShareData.rarityLabel}). Check your odds at ${shareUrl()}`;
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
      await navigator.share({ text: shareCaption(), url: shareUrl() });
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
  // Facebook accepts no pre-filled text at all (they removed `quote`), so
  // for that button the URL is the ONLY thing carrying the result -- which
  // is why it has to be the per-result link rather than the bare site.
  const url = encodeURIComponent(shareUrl());
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

// --- Scroll reveal: cards fade/rise in as they enter view ---
// Observes every .card up front, including ones still behind a
// "hidden" class (resultCard, premiumTeaser, globalReport, etc.) --
// display:none elements simply never intersect until unhidden, so no
// re-observation is needed when this script's own logic reveals them
// later. Skipped entirely (never adds the trigger class, CSS stays
// inert) under reduced-motion.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  document.body.classList.add("reveal-ready");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".card").forEach((card) => revealObserver.observe(card));
}
})();
