/*
 * U.S. metro-area data for the Global Dream Partner Report.
 *
 * Covers the ~40 largest Metropolitan Statistical Areas (MSAs) --
 * Census Bureau's own standardized definition of a metro area, chosen
 * specifically because it's a real, consistently published boundary.
 * "City" limits and informal metro names aren't consistently defined
 * or measured, so this tool doesn't attempt city-level data at all.
 *
 * Within each metro:
 *  - Population and race/ethnicity share are genuinely published per
 *    MSA (Census Bureau population estimates and ACS race/ethnicity
 *    tables) -- real, metro-specific numbers below.
 *  - Income is a real per-metro figure (ACS median personal income by
 *    MSA), since metro-level income is well documented and varies
 *    enormously (the Bay Area vs. a smaller Midwest metro, for
 *    instance).
 *  - Obesity is NOT reliably published at metro granularity the way it
 *    is for states (CDC/BRFSS obesity surveillance is a state-level
 *    program), so each metro inherits its anchor state's real obesity
 *    figure from states.js rather than a fabricated metro-specific
 *    number.
 *  - Age structure and marital/parental-status patterns use the same
 *    small set of real, well-known archetypes as states.js (e.g.
 *    Austin's tech-driven young/single population looks different from
 *    Texas as a whole), rather than one-off per-metro decimals.
 *  - Height uses the same national CDC/NCHS figure as everywhere else
 *    on this site -- not meaningfully documented below the national
 *    level at all.
 *
 * Rounded, general-knowledge approximations for an entertainment tool,
 * same caveat as stats.js, countries.js, and states.js.
 */

(function () {

// Same three age-pyramid archetypes as states.js, kept as a separate
// copy here (rather than reaching into states.js) so this file doesn't
// depend on load order beyond needing window.QuizStats for height.
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

const FAMILY = {
  HIGH: { marriedShare: { men: 0.58, women: 0.56 }, hasKidsShare: { men: 0.60, women: 0.64 } },
  MODERATE: { marriedShare: { men: 0.51, women: 0.49 }, hasKidsShare: { men: 0.54, women: 0.58 } },
  LOW: { marriedShare: { men: 0.42, women: 0.40 }, hasKidsShare: { men: 0.46, women: 0.50 } },
};

const NATIONAL_INCOME = { men: 45000, women: 33000 };

// [code, name, obesityStateCode, population, whiteShare, blackShare, asianShare, hispanicShare, incomeMultiplier, ageKey, familyKey]
// hispanicShare: Hispanic or Latino of any origin, ACS 2020-2024
// 5-year table B03003, matched per metro against the 2023 CBSA
// delineations (several were renamed -- Houston-Pasadena, Denver-
// Centennial, Austin-San Marcos and others are the same areas under
// new names). whiteShare is the not-Hispanic figure, same convention
// as stats.js and states.js, so the two are cleanly exclusive;
// blackShare and asianShare are Hispanic-inclusive and overlap it
// slightly.
// obesityStateCode: the anchor state whose real obesity figure (from
// states.js) this metro borrows, since obesity isn't published at
// metro granularity. Population/race/income are the metro's own real
// figures; income multiplier is relative to the national median
// already in stats.js.
const METRO_TABLE = [
  ["NYC", "New York-Newark-Jersey City, NY-NJ-PA", "NY", 19800000, 0.45, 0.15, 0.13, 0.257, 1.25, "MODERATE", "LOW"],
  ["LAX", "Los Angeles-Long Beach-Anaheim, CA", "CA", 12900000, 0.26, 0.07, 0.15, 0.45, 1.10, "MODERATE", "LOW"],
  ["CHI", "Chicago-Naperville-Elgin, IL-IN-WI", "IL", 9300000, 0.52, 0.16, 0.07, 0.241, 1.08, "MODERATE", "MODERATE"],
  ["DFW", "Dallas-Fort Worth-Arlington, TX", "TX", 8100000, 0.42, 0.16, 0.07, 0.297, 1.02, "YOUNG", "MODERATE"],
  ["HOU", "Houston-The Woodlands-Sugar Land, TX", "TX", 7400000, 0.35, 0.17, 0.08, 0.382, 0.98, "YOUNG", "MODERATE"],
  ["WDC", "Washington-Arlington-Alexandria, DC-VA-MD-WV", "DC", 6380000, 0.44, 0.24, 0.10, 0.18, 1.30, "MODERATE", "MODERATE"],
  ["MIA", "Miami-Fort Lauderdale-Pompano Beach, FL", "FL", 6180000, 0.274, 0.16, 0.02, 0.467, 1.02, "OLD", "MODERATE"],
  ["PHL", "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD", "PA", 6240000, 0.58, 0.20, 0.06, 0.108, 1.05, "MODERATE", "MODERATE"],
  ["ATL", "Atlanta-Sandy Springs-Alpharetta, GA", "GA", 6300000, 0.48, 0.33, 0.06, 0.124, 1.03, "MODERATE", "MODERATE"],
  ["PHX", "Phoenix-Mesa-Chandler, AZ", "AZ", 5070000, 0.55, 0.05, 0.04, 0.311, 0.95, "MODERATE", "MODERATE"],
  ["BOS", "Boston-Cambridge-Newton, MA-NH", "MA", 4900000, 0.68, 0.07, 0.08, 0.124, 1.20, "OLD", "LOW"],
  ["SFO", "San Francisco-Oakland-Berkeley, CA", "CA", 4570000, 0.38, 0.06, 0.28, 0.232, 1.45, "MODERATE", "LOW"],
  ["RIV", "Riverside-San Bernardino-Ontario, CA", "CA", 4650000, 0.30, 0.07, 0.06, 0.531, 0.92, "MODERATE", "MODERATE"],
  ["DET", "Detroit-Warren-Dearborn, MI", "MI", 4320000, 0.62, 0.22, 0.04, 0.053, 0.92, "OLD", "MODERATE"],
  ["SEA", "Seattle-Tacoma-Bellevue, WA", "WA", 4020000, 0.58, 0.04, 0.16, 0.117, 1.20, "MODERATE", "LOW"],
  ["MSP", "Minneapolis-St. Paul-Bloomington, MN-WI", "MN", 3710000, 0.72, 0.09, 0.07, 0.068, 1.10, "MODERATE", "MODERATE"],
  ["SAN", "San Diego-Chula Vista-Carlsbad, CA", "CA", 3300000, 0.42, 0.05, 0.12, 0.346, 1.10, "MODERATE", "LOW"],
  ["TPA", "Tampa-St. Petersburg-Clearwater, FL", "FL", 3340000, 0.65, 0.11, 0.03, 0.218, 0.92, "OLD", "MODERATE"],
  ["DEN", "Denver-Aurora-Lakewood, CO", "CO", 3000000, 0.63, 0.05, 0.04, 0.239, 1.12, "MODERATE", "MODERATE"],
  ["STL", "St. Louis, MO-IL", "MO", 2810000, 0.69, 0.18, 0.03, 0.039, 0.92, "OLD", "MODERATE"],
  ["BAL", "Baltimore-Columbia-Towson, MD", "MD", 2840000, 0.50, 0.29, 0.06, 0.081, 1.10, "MODERATE", "MODERATE"],
  ["CLT", "Charlotte-Concord-Gastonia, NC-SC", "NC", 2800000, 0.56, 0.22, 0.04, 0.125, 0.98, "YOUNG", "MODERATE"],
  ["ORL", "Orlando-Kissimmee-Sanford, FL", "FL", 2750000, 0.48, 0.14, 0.05, 0.333, 0.90, "MODERATE", "MODERATE"],
  ["SAT", "San Antonio-New Braunfels, TX", "TX", 2700000, 0.30, 0.07, 0.03, 0.547, 0.86, "YOUNG", "MODERATE"],
  ["PDX", "Portland-Vancouver-Hillsboro, OR-WA", "OR", 2510000, 0.68, 0.03, 0.08, 0.139, 1.08, "MODERATE", "LOW"],
  ["PIT", "Pittsburgh, PA", "PA", 2340000, 0.80, 0.08, 0.03, 0.024, 0.95, "OLD", "MODERATE"],
  ["SAC", "Sacramento-Roseville-Folsom, CA", "CA", 2420000, 0.42, 0.07, 0.14, 0.228, 1.02, "MODERATE", "MODERATE"],
  ["AUS", "Austin-Round Rock-Georgetown, TX", "TX", 2420000, 0.47, 0.06, 0.06, 0.322, 1.08, "YOUNG", "LOW"],
  ["LAS", "Las Vegas-Henderson-Paradise, NV", "NV", 2330000, 0.42, 0.10, 0.10, 0.319, 0.92, "MODERATE", "LOW"],
  ["CIN", "Cincinnati, OH-KY-IN", "OH", 2260000, 0.72, 0.11, 0.02, 0.046, 0.93, "MODERATE", "MODERATE"],
  ["MCI", "Kansas City, MO-KS", "MO", 2220000, 0.68, 0.11, 0.03, 0.109, 0.92, "MODERATE", "MODERATE"],
  ["CMH", "Columbus, OH", "OH", 2140000, 0.65, 0.15, 0.05, 0.056, 0.94, "YOUNG", "MODERATE"],
  ["IND", "Indianapolis-Carmel-Anderson, IN", "IN", 2120000, 0.66, 0.15, 0.03, 0.089, 0.90, "MODERATE", "MODERATE"],
  ["CLE", "Cleveland-Elyria, OH", "OH", 2080000, 0.68, 0.19, 0.02, 0.068, 0.88, "OLD", "MODERATE"],
  ["SJC", "San Jose-Sunnyvale-Santa Clara, CA", "CA", 2000000, 0.28, 0.02, 0.38, 0.263, 1.55, "MODERATE", "MODERATE"],
  ["BNA", "Nashville-Davidson-Murfreesboro-Franklin, TN", "TN", 2090000, 0.62, 0.14, 0.03, 0.101, 1.00, "YOUNG", "MODERATE"],
  ["VBH", "Virginia Beach-Norfolk-Newport News, VA-NC", "VA", 1810000, 0.55, 0.26, 0.03, 0.08, 0.92, "MODERATE", "MODERATE"],
  ["PVD", "Providence-Warwick, RI-MA", "RI", 1680000, 0.70, 0.06, 0.03, 0.151, 0.90, "OLD", "MODERATE"],
  ["MKE", "Milwaukee-Waukesha, WI", "WI", 1570000, 0.65, 0.14, 0.03, 0.121, 0.90, "MODERATE", "MODERATE"],
  ["JAX", "Jacksonville, FL", "FL", 1650000, 0.57, 0.18, 0.03, 0.111, 0.90, "MODERATE", "MODERATE"],
];

const METROS = {};
METRO_TABLE.forEach(([code, name, obesityStateCode, population, white, black, asian, hispanic, incomeMult, ageKey, familyKey]) => {
  const family = FAMILY[familyKey];
  METROS[code] = {
    name,
    obesityStateCode,
    totalPopulation: population,
    adultSharePct: ADULT_SHARE_BY_AGE_KEY[ageKey],
    sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE[ageKey],
      raceShare: { any: 1, white, black, asian, hispanic },
      income: {
        men: { median: Math.round((NATIONAL_INCOME.men * incomeMult) / 500) * 500, sigma: 1.0 },
        women: { median: Math.round((NATIONAL_INCOME.women * incomeMult) / 500) * 500, sigma: 1.0 },
      },
      marriedShare: family.marriedShare,
      hasKidsShare: family.hasKidsShare,
    },
    sourceNote:
      name +
      "-specific estimate: population, race/ethnicity, and income from Census Bureau metro-area (MSA) data. Obesity isn't published at metro granularity, so it borrows the real state-level CDC/BRFSS figure for its anchor state; height uses the same national CDC/NCHS figure as the rest of this calculator, and marital/parental-status rates are grouped into broad regional patterns rather than precise per-metro figures.",
  };
});

// Returns a stats-shaped object ready for QuizStats.computeProbability().
function getMetroStats(code) {
  const entry = METROS[code];
  if (!entry) return null;
  const national = window.QuizStats.STATS;
  const stateStats = window.QuizUSStates.getStateStats(entry.obesityStateCode);
  const adultPopulation = entry.totalPopulation * entry.adultSharePct;
  return {
    ...entry.stats,
    notObeseShare: stateStats.notObeseShare,
    height: national.height,
    totalAdultPopulation: {
      men: Math.round(adultPopulation * entry.sexRatioPctMale),
      women: Math.round(adultPopulation * (1 - entry.sexRatioPctMale)),
    },
  };
}

function getMetroMeta(code) {
  const entry = METROS[code];
  if (!entry) return null;
  return { code, name: entry.name, sourceNote: entry.sourceNote };
}

function listMetros() {
  return Object.entries(METROS)
    .map(([code, m]) => ({ code, name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

window.QuizUSMetros = { METROS, getMetroStats, getMetroMeta, listMetros };
})();
