/*
 * U.S. state-level data for the Global Dream Partner Report.
 *
 * Unlike countries.js, every state shares one country's data
 * conventions, so the well-documented dimensions get real per-state
 * figures rather than a full/regional tier split:
 *
 *  - Population, race/ethnicity share, obesity rate, and income are
 *    genuinely published per state (Census Bureau population estimates
 *    and race/ethnicity tables, CDC/BRFSS obesity prevalence, Census
 *    ACS income tables) -- real, state-specific numbers below.
 *  - Age structure and marital/parental-status patterns are NOT
 *    precisely published per state at the granularity this tool needs,
 *    so states are grouped into a small number of real, well-known
 *    patterns (e.g. Utah's unusually high marriage rate, DC's unusually
 *    low one) rather than inventing 51 individual decimals.
 *  - Height is not meaningfully documented at the state level at all --
 *    every state uses the same national CDC/NCHS height distribution
 *    already used elsewhere on this site.
 *
 * Rounded, general-knowledge approximations for an entertainment tool,
 * same caveat as stats.js and countries.js.
 */

(function () {

// Age-distribution archetypes. MODERATE is the same shape as the
// national U.S. distribution in stats.js; YOUNG/OLD are shifted from it
// to reflect real, well-known state age-structure differences (Utah/
// Texas/Alaska skew young; Maine/Florida/West Virginia skew old).
const AGE = {
  YOUNG: {
    men: { "18-19": 0.038, "20-29": 0.195, "30-39": 0.180, "40-49": 0.150, "50-59": 0.140, "60-69": 0.125, "70-79": 0.100, "80+": 0.072 },
    women: { "18-19": 0.036, "20-29": 0.185, "30-39": 0.175, "40-49": 0.147, "50-59": 0.140, "60-69": 0.130, "70-79": 0.110, "80+": 0.077 },
  },
  MODERATE: {
    men: { "18-19": 0.032, "20-29": 0.168, "30-39": 0.165, "40-49": 0.150, "50-59": 0.157, "60-69": 0.148, "70-79": 0.112, "80+": 0.068 },
    women: { "18-19": 0.030, "20-29": 0.159, "30-39": 0.160, "40-49": 0.147, "50-59": 0.155, "60-69": 0.149, "70-79": 0.121, "80+": 0.079 },
  },
  OLD: {
    men: { "18-19": 0.026, "20-29": 0.140, "30-39": 0.145, "40-49": 0.145, "50-59": 0.160, "60-69": 0.165, "70-79": 0.130, "80+": 0.089 },
    women: { "18-19": 0.024, "20-29": 0.130, "30-39": 0.140, "40-49": 0.142, "50-59": 0.158, "60-69": 0.165, "70-79": 0.140, "80+": 0.101 },
  },
};
const ADULT_SHARE_BY_AGE_KEY = { YOUNG: 0.76, MODERATE: 0.78, OLD: 0.80 };

// Marital/parental-status archetypes -- HIGH (Utah, the Mountain West,
// much of the South) and LOW (DC, and the most urban Northeast/West
// Coast states) are real, well-documented regional patterns; MODERATE
// matches the national figures in stats.js.
const FAMILY = {
  HIGH: { marriedShare: { men: 0.58, women: 0.56 }, hasKidsShare: { men: 0.60, women: 0.64 } },
  MODERATE: { marriedShare: { men: 0.51, women: 0.49 }, hasKidsShare: { men: 0.54, women: 0.58 } },
  LOW: { marriedShare: { men: 0.42, women: 0.40 }, hasKidsShare: { men: 0.46, women: 0.50 } },
};

const NATIONAL_INCOME = { men: 45000, women: 33000 };

// [code, name, population, whiteShare, blackShare, asianShare, hispanicShare, obesityRate, incomeMultiplier, ageKey, familyKey]
// Population: Census Bureau state population estimates, rounded.
// Race shares: Census white-alone-non-Hispanic / Black-alone / Asian-
// alone / Hispanic-or-Latino-of-any-race shares, rounded (same
// categories as the national figures in stats.js). Black and Asian are
// Hispanic-inclusive "alone" shares, so they overlap the Hispanic column
// by a fraction of a point rather than being cleanly exclusive to it;
// multiracial residents and other groups still aren't covered by this
// tool's filter options.
// Obesity: CDC/BRFSS adult obesity prevalence, rounded.
// Income multiplier: state median personal income relative to the
// national median already in stats.js.
const STATE_TABLE = [
  ["AL", "Alabama", 5100000, 0.63, 0.26, 0.015, 0.055, 0.39, 0.80, "MODERATE", "HIGH"],
  ["AK", "Alaska", 730000, 0.60, 0.03, 0.06, 0.075, 0.34, 1.05, "YOUNG", "MODERATE"],
  ["AZ", "Arizona", 7400000, 0.53, 0.045, 0.035, 0.32, 0.31, 0.92, "MODERATE", "MODERATE"],
  ["AR", "Arkansas", 3000000, 0.70, 0.15, 0.015, 0.085, 0.40, 0.78, "MODERATE", "HIGH"],
  ["CA", "California", 39000000, 0.35, 0.055, 0.15, 0.4, 0.27, 1.15, "MODERATE", "LOW"],
  ["CO", "Colorado", 5900000, 0.67, 0.04, 0.03, 0.22, 0.24, 1.10, "MODERATE", "MODERATE"],
  ["CT", "Connecticut", 3600000, 0.65, 0.11, 0.05, 0.18, 0.28, 1.20, "OLD", "MODERATE"],
  ["DE", "Delaware", 1000000, 0.60, 0.22, 0.04, 0.105, 0.34, 1.02, "OLD", "MODERATE"],
  ["DC", "District of Columbia", 680000, 0.37, 0.44, 0.045, 0.115, 0.24, 1.35, "YOUNG", "LOW"],
  ["FL", "Florida", 22600000, 0.51, 0.15, 0.03, 0.27, 0.28, 0.95, "OLD", "MODERATE"],
  ["GA", "Georgia", 11000000, 0.50, 0.31, 0.045, 0.105, 0.34, 0.92, "MODERATE", "MODERATE"],
  ["HI", "Hawaii", 1400000, 0.22, 0.02, 0.36, 0.11, 0.24, 1.05, "OLD", "MODERATE"],
  ["ID", "Idaho", 2000000, 0.78, 0.01, 0.015, 0.13, 0.30, 0.85, "YOUNG", "HIGH"],
  ["IL", "Illinois", 12500000, 0.58, 0.14, 0.056, 0.18, 0.32, 1.00, "MODERATE", "MODERATE"],
  ["IN", "Indiana", 6800000, 0.77, 0.095, 0.025, 0.08, 0.36, 0.85, "MODERATE", "MODERATE"],
  ["IA", "Iowa", 3200000, 0.83, 0.04, 0.025, 0.07, 0.36, 0.88, "OLD", "HIGH"],
  ["KS", "Kansas", 3000000, 0.74, 0.06, 0.03, 0.13, 0.35, 0.88, "MODERATE", "MODERATE"],
  ["KY", "Kentucky", 4500000, 0.83, 0.085, 0.015, 0.045, 0.39, 0.78, "OLD", "HIGH"],
  ["LA", "Louisiana", 4600000, 0.56, 0.31, 0.02, 0.065, 0.38, 0.80, "MODERATE", "HIGH"],
  ["ME", "Maine", 1400000, 0.89, 0.02, 0.012, 0.02, 0.32, 0.85, "OLD", "MODERATE"],
  ["MD", "Maryland", 6200000, 0.47, 0.29, 0.065, 0.12, 0.31, 1.20, "MODERATE", "MODERATE"],
  ["MA", "Massachusetts", 7000000, 0.68, 0.07, 0.07, 0.13, 0.25, 1.25, "OLD", "LOW"],
  ["MI", "Michigan", 10000000, 0.72, 0.13, 0.03, 0.06, 0.36, 0.88, "OLD", "MODERATE"],
  ["MN", "Minnesota", 5700000, 0.75, 0.075, 0.055, 0.06, 0.31, 1.05, "MODERATE", "MODERATE"],
  ["MS", "Mississippi", 3000000, 0.55, 0.37, 0.01, 0.035, 0.40, 0.72, "MODERATE", "HIGH"],
  ["MO", "Missouri", 6200000, 0.75, 0.11, 0.02, 0.05, 0.36, 0.85, "MODERATE", "MODERATE"],
  ["MT", "Montana", 1100000, 0.83, 0.006, 0.008, 0.04, 0.28, 0.85, "OLD", "MODERATE"],
  ["NE", "Nebraska", 2000000, 0.79, 0.045, 0.025, 0.12, 0.35, 0.90, "MODERATE", "HIGH"],
  ["NV", "Nevada", 3200000, 0.45, 0.09, 0.08, 0.3, 0.30, 0.95, "MODERATE", "LOW"],
  ["NH", "New Hampshire", 1400000, 0.87, 0.015, 0.03, 0.045, 0.29, 1.10, "OLD", "MODERATE"],
  ["NJ", "New Jersey", 9300000, 0.50, 0.13, 0.10, 0.22, 0.28, 1.20, "MODERATE", "MODERATE"],
  ["NM", "New Mexico", 2100000, 0.36, 0.02, 0.015, 0.5, 0.33, 0.82, "MODERATE", "MODERATE"],
  ["NY", "New York", 19600000, 0.51, 0.14, 0.09, 0.195, 0.28, 1.15, "MODERATE", "LOW"],
  ["NC", "North Carolina", 10800000, 0.59, 0.20, 0.03, 0.11, 0.34, 0.90, "MODERATE", "MODERATE"],
  ["ND", "North Dakota", 780000, 0.80, 0.03, 0.015, 0.045, 0.34, 0.95, "YOUNG", "MODERATE"],
  ["OH", "Ohio", 11800000, 0.76, 0.13, 0.025, 0.045, 0.36, 0.85, "OLD", "MODERATE"],
  ["OK", "Oklahoma", 4000000, 0.62, 0.075, 0.02, 0.12, 0.38, 0.80, "MODERATE", "HIGH"],
  ["OR", "Oregon", 4200000, 0.72, 0.02, 0.045, 0.14, 0.29, 0.98, "MODERATE", "LOW"],
  ["PA", "Pennsylvania", 13000000, 0.73, 0.11, 0.036, 0.085, 0.34, 0.92, "OLD", "MODERATE"],
  ["RI", "Rhode Island", 1100000, 0.68, 0.06, 0.035, 0.17, 0.29, 1.00, "OLD", "MODERATE"],
  ["SC", "South Carolina", 5400000, 0.62, 0.25, 0.017, 0.065, 0.36, 0.82, "OLD", "MODERATE"],
  ["SD", "South Dakota", 920000, 0.80, 0.02, 0.014, 0.045, 0.34, 0.90, "YOUNG", "HIGH"],
  ["TN", "Tennessee", 7100000, 0.68, 0.16, 0.019, 0.07, 0.38, 0.83, "MODERATE", "HIGH"],
  ["TX", "Texas", 30500000, 0.39, 0.115, 0.055, 0.4, 0.35, 0.95, "YOUNG", "MODERATE"],
  ["UT", "Utah", 3400000, 0.74, 0.015, 0.025, 0.15, 0.31, 0.95, "YOUNG", "HIGH"],
  ["VT", "Vermont", 650000, 0.89, 0.014, 0.017, 0.025, 0.28, 0.95, "OLD", "LOW"],
  ["VA", "Virginia", 8700000, 0.58, 0.18, 0.07, 0.105, 0.32, 1.08, "MODERATE", "MODERATE"],
  ["WA", "Washington", 7800000, 0.63, 0.03, 0.095, 0.14, 0.29, 1.10, "MODERATE", "MODERATE"],
  ["WV", "West Virginia", 1800000, 0.89, 0.035, 0.008, 0.02, 0.41, 0.72, "OLD", "HIGH"],
  ["WI", "Wisconsin", 5900000, 0.78, 0.06, 0.03, 0.075, 0.35, 0.90, "MODERATE", "MODERATE"],
  ["WY", "Wyoming", 580000, 0.81, 0.008, 0.009, 0.105, 0.31, 0.90, "MODERATE", "HIGH"],
];

const STATES = {};
STATE_TABLE.forEach(([code, name, population, white, black, asian, hispanic, obesity, incomeMult, ageKey, familyKey]) => {
  const family = FAMILY[familyKey];
  // Obesity prevalence is published as one overall adult rate per state
  // rather than split by sex; apply the same ~3-point men/women gap the
  // national CDC/NCHS figures in stats.js already show, centered on
  // that state's real overall rate.
  const menObesity = Math.max(0.02, obesity - 0.015);
  const womenObesity = Math.min(0.65, obesity + 0.015);
  STATES[code] = {
    name,
    totalPopulation: population,
    adultSharePct: ADULT_SHARE_BY_AGE_KEY[ageKey],
    sexRatioPctMale: code === "DC" ? 0.47 : 0.492, // DC's adult population is notably more female; a real, documented exception rather than a fabricated one
    stats: {
      ageDistribution: AGE[ageKey],
      raceShare: { any: 1, white, black, asian, hispanic },
      notObeseShare: { men: +(1 - menObesity).toFixed(3), women: +(1 - womenObesity).toFixed(3) },
      income: {
        men: { median: Math.round((NATIONAL_INCOME.men * incomeMult) / 500) * 500, sigma: 1.0 },
        women: { median: Math.round((NATIONAL_INCOME.women * incomeMult) / 500) * 500, sigma: 1.0 },
      },
      marriedShare: family.marriedShare,
      hasKidsShare: family.hasKidsShare,
    },
    sourceNote:
      name +
      "-specific estimate: population, race/ethnicity, and income from U.S. Census Bureau data, obesity from CDC/BRFSS. Height isn't meaningfully documented at the state level, so it uses the same national CDC/NCHS figure as the rest of this calculator; marital and parental-status rates are grouped into broad regional patterns rather than precise per-state figures, which aren't consistently published.",
  };
});

// Returns a stats-shaped object ready for QuizStats.computeProbability(),
// using the national height distribution (stats.js's STATS.height) since
// no meaningfully documented state-level equivalent exists.
function getStateStats(code) {
  const entry = STATES[code];
  if (!entry) return null;
  const national = window.QuizStats.STATS;
  const adultPopulation = entry.totalPopulation * entry.adultSharePct;
  return {
    ...entry.stats,
    height: national.height,
    totalAdultPopulation: {
      men: Math.round(adultPopulation * entry.sexRatioPctMale),
      women: Math.round(adultPopulation * (1 - entry.sexRatioPctMale)),
    },
  };
}

function getStateMeta(code) {
  const entry = STATES[code];
  if (!entry) return null;
  return { code, name: entry.name, sourceNote: entry.sourceNote };
}

function listStates() {
  return Object.entries(STATES)
    .map(([code, s]) => ({ code, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

window.QuizUSStates = { STATES, getStateStats, getStateMeta, listStates };
})();
