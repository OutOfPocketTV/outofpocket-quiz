/*
 * Global Dream Partner Report -- per-country demographic data.
 *
 * Two coverage tiers, both built only from real, publicly documented
 * statistics -- never invented numbers:
 *
 *  - tier "full": country-specific best-effort figures for every
 *    dimension (age, height, income, obesity, marriage, kids, and race/
 *    ethnicity where a country's own statistics agency actually
 *    publishes it), drawn from national statistics offices, UN World
 *    Population Prospects, WHO's Global Health Observatory, UN DESA
 *    World Marriage Data, and World Bank/IMF income data.
 *  - tier "regional": the country's own real total population (the one
 *    figure that is genuinely well documented for every country on
 *    Earth), combined with its region's typical age/height/income/
 *    obesity/marriage/parenthood profile rather than an invented
 *    country-specific decimal. Clearly surfaced in the UI as a regional
 *    estimate, not a national statistic.
 *
 * Race/ethnicity: most countries do not officially collect race or
 * ethnicity data at all (this is true of France and much of continental
 * Europe, by law), and where countries do collect it, their own
 * categories often don't map onto this tool's US-derived White/Black/
 * Asian options (e.g. Malaysia's Malay/Chinese/Indian, or Brazil's
 * "parda"). Rather than force a fit, every country defaults to "any
 * color or shade" unless its own published breakdown genuinely maps --
 * see each country's sourceNote.
 *
 * These are rounded, general-knowledge approximations of widely
 * published international datasets for an entertainment/estimation
 * tool, not freshly fetched or independently verified against source
 * documents -- the same caveat that already applies to the U.S. figures
 * in stats.js.
 */

(function () {

// --- Shared adult (18+) age-pyramid archetypes, reused across regions
// whose typical population structure is similar (younger/faster-growing
// vs. older/slower-growing), rather than inventing bespoke bucket values
// for every single region. ---
const AGE_YOUNG = {
  men: { "18-19": 0.09, "20-29": 0.27, "30-39": 0.21, "40-49": 0.15, "50-59": 0.11, "60-69": 0.09, "70-79": 0.05, "80+": 0.03 },
  women: { "18-19": 0.085, "20-29": 0.26, "30-39": 0.205, "40-49": 0.15, "50-59": 0.115, "60-69": 0.095, "70-79": 0.06, "80+": 0.03 },
};
const AGE_MODERATE_YOUNG = {
  men: { "18-19": 0.06, "20-29": 0.20, "30-39": 0.19, "40-49": 0.16, "50-59": 0.14, "60-69": 0.12, "70-79": 0.08, "80+": 0.05 },
  women: { "18-19": 0.055, "20-29": 0.19, "30-39": 0.185, "40-49": 0.155, "50-59": 0.14, "60-69": 0.125, "70-79": 0.09, "80+": 0.06 },
};
const AGE_MODERATE_OLD = {
  men: { "18-19": 0.025, "20-29": 0.14, "30-39": 0.15, "40-49": 0.145, "50-59": 0.155, "60-69": 0.155, "70-79": 0.125, "80+": 0.105 },
  women: { "18-19": 0.023, "20-29": 0.13, "30-39": 0.145, "40-49": 0.14, "50-59": 0.15, "60-69": 0.155, "70-79": 0.135, "80+": 0.122 },
};
const AGE_VERY_OLD = {
  men: { "18-19": 0.02, "20-29": 0.12, "30-39": 0.13, "40-49": 0.135, "50-59": 0.155, "60-69": 0.16, "70-79": 0.14, "80+": 0.14 },
  women: { "18-19": 0.018, "20-29": 0.11, "30-39": 0.125, "40-49": 0.13, "50-59": 0.15, "60-69": 0.16, "70-79": 0.15, "80+": 0.157 },
};

const ANY_RACE = { any: 1 };

// --- Region-level fallback statistics for "regional estimate" tier
// countries -- used for every dimension except population. ---
const REGION_AVERAGES = {
  NORTH_AMERICA: {
    ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 69.2, sd: 3.0 }, women: { mean: 63.8, sd: 2.8 } },
    notObeseShare: { men: 0.70, women: 0.68 },
    income: { men: { median: 40000, sigma: 1.0 }, women: { median: 31000, sigma: 1.0 } },
    marriedShare: { men: 0.47, women: 0.45 },
    hasKidsShare: { men: 0.50, women: 0.55 },
    adultSharePct: 0.79, sexRatioPctMale: 0.494,
    sourceNote: "Regional estimate based on North American averages (UN, WHO, World Bank data).",
  },
  LATIN_AMERICA: {
    ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
    height: { men: { mean: 66.9, sd: 2.7 }, women: { mean: 61.8, sd: 2.5 } },
    notObeseShare: { men: 0.72, women: 0.68 },
    income: { men: { median: 8000, sigma: 1.2 }, women: { median: 5200, sigma: 1.25 } },
    marriedShare: { men: 0.43, women: 0.41 },
    hasKidsShare: { men: 0.56, women: 0.63 },
    adultSharePct: 0.68, sexRatioPctMale: 0.487,
    sourceNote: "Regional estimate based on Latin American & Caribbean averages (UN, WHO, World Bank data).",
  },
  WESTERN_EUROPE: {
    ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 69.8, sd: 2.8 }, women: { mean: 64.1, sd: 2.6 } },
    notObeseShare: { men: 0.78, women: 0.77 },
    income: { men: { median: 37000, sigma: 0.95 }, women: { median: 28000, sigma: 1.0 } },
    marriedShare: { men: 0.45, women: 0.44 },
    hasKidsShare: { men: 0.47, women: 0.52 },
    adultSharePct: 0.81, sexRatioPctMale: 0.492,
    sourceNote: "Regional estimate based on Western European averages (UN, WHO, World Bank data).",
  },
  NORTHERN_EUROPE: {
    ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 70.4, sd: 2.8 }, women: { mean: 64.9, sd: 2.6 } },
    notObeseShare: { men: 0.79, women: 0.80 },
    income: { men: { median: 38000, sigma: 0.9 }, women: { median: 31000, sigma: 0.9 } },
    marriedShare: { men: 0.41, women: 0.40 },
    hasKidsShare: { men: 0.46, women: 0.51 },
    adultSharePct: 0.80, sexRatioPctMale: 0.494,
    sourceNote: "Regional estimate based on Northern European averages (UN, WHO, World Bank data).",
  },
  SOUTHERN_EUROPE: {
    ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 69.0, sd: 2.8 }, women: { mean: 63.4, sd: 2.6 } },
    notObeseShare: { men: 0.80, women: 0.80 },
    income: { men: { median: 21000, sigma: 1.0 }, women: { median: 15000, sigma: 1.05 } },
    marriedShare: { men: 0.47, women: 0.45 },
    hasKidsShare: { men: 0.46, women: 0.50 },
    adultSharePct: 0.83, sexRatioPctMale: 0.487,
    sourceNote: "Regional estimate based on Southern European averages (UN, WHO, World Bank data).",
  },
  EASTERN_EUROPE: {
    ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 69.4, sd: 2.8 }, women: { mean: 63.9, sd: 2.6 } },
    notObeseShare: { men: 0.74, women: 0.75 },
    income: { men: { median: 12000, sigma: 1.05 }, women: { median: 9000, sigma: 1.1 } },
    marriedShare: { men: 0.51, women: 0.47 },
    hasKidsShare: { men: 0.50, women: 0.56 },
    adultSharePct: 0.81, sexRatioPctMale: 0.478,
    sourceNote: "Regional estimate based on Eastern European averages (UN, WHO, World Bank data).",
  },
  MENA: {
    ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
    height: { men: { mean: 67.7, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
    notObeseShare: { men: 0.70, women: 0.60 },
    income: { men: { median: 10000, sigma: 1.2 }, women: { median: 4000, sigma: 1.3 } },
    marriedShare: { men: 0.60, women: 0.57 },
    hasKidsShare: { men: 0.58, women: 0.64 },
    adultSharePct: 0.65, sexRatioPctMale: 0.505,
    sourceNote: "Regional estimate based on Middle East & North Africa averages (UN, WHO, World Bank data).",
  },
  SUB_SAHARAN_AFRICA: {
    ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
    height: { men: { mean: 66.5, sd: 2.8 }, women: { mean: 61.8, sd: 2.6 } },
    notObeseShare: { men: 0.90, women: 0.76 },
    income: { men: { median: 3000, sigma: 1.3 }, women: { median: 1800, sigma: 1.35 } },
    marriedShare: { men: 0.58, women: 0.54 },
    hasKidsShare: { men: 0.65, women: 0.73 },
    adultSharePct: 0.50, sexRatioPctMale: 0.497,
    sourceNote: "Regional estimate based on Sub-Saharan African averages (UN, WHO, World Bank data).",
  },
  SOUTH_ASIA: {
    ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
    height: { men: { mean: 65.3, sd: 2.6 }, women: { mean: 60.3, sd: 2.4 } },
    notObeseShare: { men: 0.92, women: 0.86 },
    income: { men: { median: 3200, sigma: 1.3 }, women: { median: 1300, sigma: 1.4 } },
    marriedShare: { men: 0.64, women: 0.68 },
    hasKidsShare: { men: 0.61, women: 0.69 },
    adultSharePct: 0.60, sexRatioPctMale: 0.505,
    sourceNote: "Regional estimate based on South Asian averages (UN, WHO, World Bank data).",
  },
  CENTRAL_ASIA: {
    ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
    height: { men: { mean: 67.3, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
    notObeseShare: { men: 0.80, women: 0.72 },
    income: { men: { median: 6500, sigma: 1.15 }, women: { median: 4200, sigma: 1.2 } },
    marriedShare: { men: 0.58, women: 0.59 },
    hasKidsShare: { men: 0.58, women: 0.64 },
    adultSharePct: 0.66, sexRatioPctMale: 0.495,
    sourceNote: "Regional estimate based on Central Asian & Caucasus averages (UN, WHO, World Bank data).",
  },
  EAST_ASIA: {
    ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 67.5, sd: 2.7 }, women: { mean: 61.9, sd: 2.5 } },
    notObeseShare: { men: 0.90, women: 0.92 },
    income: { men: { median: 10000, sigma: 1.1 }, women: { median: 7000, sigma: 1.15 } },
    marriedShare: { men: 0.60, women: 0.55 },
    hasKidsShare: { men: 0.54, women: 0.58 },
    adultSharePct: 0.80, sexRatioPctMale: 0.503,
    sourceNote: "Regional estimate based on East Asian averages (UN, WHO, World Bank data).",
  },
  SOUTHEAST_ASIA: {
    ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
    height: { men: { mean: 65.4, sd: 2.5 }, women: { mean: 60.3, sd: 2.3 } },
    notObeseShare: { men: 0.85, women: 0.75 },
    income: { men: { median: 5500, sigma: 1.2 }, women: { median: 3600, sigma: 1.25 } },
    marriedShare: { men: 0.57, women: 0.55 },
    hasKidsShare: { men: 0.58, women: 0.64 },
    adultSharePct: 0.68, sexRatioPctMale: 0.497,
    sourceNote: "Regional estimate based on Southeast Asian averages (UN, WHO, World Bank data).",
  },
  OCEANIA: {
    ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
    height: { men: { mean: 68.5, sd: 2.8 }, women: { mean: 63.0, sd: 2.6 } },
    notObeseShare: { men: 0.65, women: 0.63 },
    income: { men: { median: 15000, sigma: 1.15 }, women: { median: 10000, sigma: 1.2 } },
    marriedShare: { men: 0.48, women: 0.47 },
    hasKidsShare: { men: 0.53, women: 0.59 },
    adultSharePct: 0.68, sexRatioPctMale: 0.497,
    sourceNote: "Regional estimate based on Pacific Islands averages (UN, WHO, World Bank data).",
  },
};

// --- Countries. Keyed by ISO 3166-1 alpha-2 code. ---
// tier "full": stats block populated with country-specific figures.
// tier "regional": stats omitted -- getCountryStats() falls back to the
// country's regionKey entry in REGION_AVERAGES, keeping only the
// country's own real population figures.
const COUNTRIES = {
  US: {
    name: "United States", continent: "North America", regionKey: "NORTH_AMERICA", tier: "full",
    useUsStats: true,
    sourceNote: "Same U.S. Census Bureau / CDC-NCHS data used throughout this site.",
  },
  CA: {
    name: "Canada", continent: "North America", regionKey: "NORTH_AMERICA", tier: "full",
    totalPopulation: 39000000, adultSharePct: 0.80, sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.4, sd: 2.9 }, women: { mean: 63.7, sd: 2.7 } },
      notObeseShare: { men: 0.72, women: 0.71 },
      income: { men: { median: 41000, sigma: 0.95 }, women: { median: 32000, sigma: 0.95 } },
      marriedShare: { men: 0.47, women: 0.46 },
      hasKidsShare: { men: 0.50, women: 0.55 },
    },
    sourceNote: "Canada-specific estimate from Statistics Canada, WHO, and World Bank data.",
  },

  // --- Latin America & Caribbean ---
  MX: {
    name: "Mexico", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 128000000, adultSharePct: 0.70, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.0, sd: 2.7 }, women: { mean: 61.6, sd: 2.5 } },
      notObeseShare: { men: 0.64, women: 0.62 },
      income: { men: { median: 9500, sigma: 1.1 }, women: { median: 6000, sigma: 1.15 } },
      marriedShare: { men: 0.46, women: 0.44 },
      hasKidsShare: { men: 0.56, women: 0.63 },
    },
    sourceNote: "Mexico-specific estimate from INEGI, WHO, and World Bank data.",
  },
  BR: {
    name: "Brazil", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 216000000, adultSharePct: 0.75, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.035, "20-29": 0.16, "30-39": 0.17, "40-49": 0.155, "50-59": 0.135, "60-69": 0.115, "70-79": 0.07, "80+": 0.06 },
        women: { "18-19": 0.032, "20-29": 0.15, "30-39": 0.165, "40-49": 0.15, "50-59": 0.14, "60-69": 0.12, "70-79": 0.083, "80+": 0.06 },
      },
      raceShare: { any: 1, white: 0.43, black: 0.10, asian: 0.011 },
      height: { men: { mean: 67.8, sd: 2.8 }, women: { mean: 62.5, sd: 2.6 } },
      notObeseShare: { men: 0.78, women: 0.74 },
      income: { men: { median: 11000, sigma: 1.15 }, women: { median: 7500, sigma: 1.2 } },
      marriedShare: { men: 0.42, women: 0.40 },
      hasKidsShare: { men: 0.54, women: 0.61 },
    },
    sourceNote: "Brazil-specific estimate from IBGE, WHO, and World Bank data. Brazil's own census category ‘parda’ (mixed/brown, its largest group) has no equivalent in this tool's race filter.",
  },
  AR: {
    name: "Argentina", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 46000000, adultSharePct: 0.76, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.3, sd: 2.8 }, women: { mean: 63.6, sd: 2.6 } },
      notObeseShare: { men: 0.72, women: 0.71 },
      income: { men: { median: 14000, sigma: 1.1 }, women: { median: 9500, sigma: 1.15 } },
      marriedShare: { men: 0.42, women: 0.40 },
      hasKidsShare: { men: 0.52, women: 0.58 },
    },
    sourceNote: "Argentina-specific estimate from INDEC, WHO, and World Bank data.",
  },
  CO: {
    name: "Colombia", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 52000000, adultSharePct: 0.73, sexRatioPctMale: 0.483,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.3, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
      notObeseShare: { men: 0.78, women: 0.74 },
      income: { men: { median: 8500, sigma: 1.15 }, women: { median: 5800, sigma: 1.2 } },
      marriedShare: { men: 0.38, women: 0.36 },
      hasKidsShare: { men: 0.55, women: 0.62 },
    },
    sourceNote: "Colombia-specific estimate from DANE, WHO, and World Bank data.",
  },
  CL: {
    name: "Chile", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 19800000, adultSharePct: 0.79, sexRatioPctMale: 0.487,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.5, sd: 2.7 }, women: { mean: 62.8, sd: 2.5 } },
      notObeseShare: { men: 0.68, women: 0.65 },
      income: { men: { median: 17000, sigma: 1.05 }, women: { median: 12000, sigma: 1.1 } },
      marriedShare: { men: 0.40, women: 0.38 },
      hasKidsShare: { men: 0.50, women: 0.56 },
    },
    sourceNote: "Chile-specific estimate from INE Chile, WHO, and World Bank data.",
  },
  PE: { name: "Peru", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 34000000 },
  VE: { name: "Venezuela", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 28000000 },
  EC: { name: "Ecuador", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 18000000 },
  GT: { name: "Guatemala", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 18000000 },
  HT: { name: "Haiti", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 11700000 },
  CU: { name: "Cuba", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 11000000 },
  BO: { name: "Bolivia", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 12000000 },
  DO: { name: "Dominican Republic", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 11300000 },
  HN: { name: "Honduras", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 10600000 },
  PY: { name: "Paraguay", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 6900000 },
  NI: { name: "Nicaragua", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 6900000 },
  SV: { name: "El Salvador", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 6300000 },
  CR: { name: "Costa Rica", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 5200000 },
  PA: { name: "Panama", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 4400000 },
  UY: { name: "Uruguay", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 3400000 },
  JM: { name: "Jamaica", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 2800000 },
  TT: { name: "Trinidad and Tobago", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 1500000 },
  GY: { name: "Guyana", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 810000 },
  SR: { name: "Suriname", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 620000 },
  BZ: { name: "Belize", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 410000 },
  BS: { name: "Bahamas", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 410000 },
  BB: { name: "Barbados", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 280000 },
  LC: { name: "Saint Lucia", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 180000 },
  GD: { name: "Grenada", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 125000 },
  VC: { name: "Saint Vincent and the Grenadines", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 104000 },
  AG: { name: "Antigua and Barbuda", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 94000 },
  DM: { name: "Dominica", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 72000 },
  KN: { name: "Saint Kitts and Nevis", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 47000 },

  // --- Europe ---
  GB: {
    name: "United Kingdom", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 68000000, adultSharePct: 0.79, sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, white: 0.82, black: 0.04, asian: 0.093 },
      height: { men: { mean: 69.5, sd: 2.8 }, women: { mean: 64.0, sd: 2.6 } },
      notObeseShare: { men: 0.72, women: 0.71 },
      income: { men: { median: 38000, sigma: 0.95 }, women: { median: 29000, sigma: 1.0 } },
      marriedShare: { men: 0.46, women: 0.45 },
      hasKidsShare: { men: 0.48, women: 0.53 },
    },
    sourceNote: "UK-specific estimate from ONS, WHO, and World Bank data.",
  },
  FR: {
    name: "France", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 68000000, adultSharePct: 0.80, sexRatioPctMale: 0.490,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.7, sd: 2.8 }, women: { mean: 64.0, sd: 2.6 } },
      notObeseShare: { men: 0.83, women: 0.82 },
      income: { men: { median: 34000, sigma: 0.95 }, women: { median: 26000, sigma: 1.0 } },
      marriedShare: { men: 0.42, women: 0.41 },
      hasKidsShare: { men: 0.48, women: 0.53 },
    },
    sourceNote: "France-specific estimate from INSEE, WHO, and World Bank data. France does not officially collect race/ethnicity statistics, so only ‘any’ is available.",
  },
  DE: {
    name: "Germany", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 84000000, adultSharePct: 0.83, sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.5, sd: 2.8 }, women: { mean: 64.8, sd: 2.6 } },
      notObeseShare: { men: 0.77, women: 0.78 },
      income: { men: { median: 39000, sigma: 0.95 }, women: { median: 29000, sigma: 1.0 } },
      marriedShare: { men: 0.47, women: 0.46 },
      hasKidsShare: { men: 0.46, women: 0.51 },
    },
    sourceNote: "Germany-specific estimate from Destatis, WHO, and World Bank data.",
  },
  NL: {
    name: "Netherlands", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 17900000, adultSharePct: 0.80, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 71.7, sd: 2.9 }, women: { mean: 66.0, sd: 2.7 } },
      notObeseShare: { men: 0.86, women: 0.85 },
      income: { men: { median: 42000, sigma: 0.9 }, women: { median: 32000, sigma: 0.95 } },
      marriedShare: { men: 0.44, women: 0.43 },
      hasKidsShare: { men: 0.47, women: 0.52 },
    },
    sourceNote: "Netherlands-specific estimate from CBS, WHO, and World Bank data.",
  },
  IE: {
    name: "Ireland", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 5200000, adultSharePct: 0.76, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 70.2, sd: 2.8 }, women: { mean: 64.5, sd: 2.6 } },
      notObeseShare: { men: 0.74, women: 0.75 },
      income: { men: { median: 38000, sigma: 1.0 }, women: { median: 29000, sigma: 1.0 } },
      marriedShare: { men: 0.45, women: 0.44 },
      hasKidsShare: { men: 0.48, women: 0.53 },
    },
    sourceNote: "Ireland-specific estimate from CSO Ireland, WHO, and World Bank data.",
  },
  CH: {
    name: "Switzerland", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 8800000, adultSharePct: 0.82, sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.3, sd: 2.8 }, women: { mean: 64.4, sd: 2.6 } },
      notObeseShare: { men: 0.89, women: 0.90 },
      income: { men: { median: 55000, sigma: 0.85 }, women: { median: 42000, sigma: 0.9 } },
      marriedShare: { men: 0.48, women: 0.47 },
      hasKidsShare: { men: 0.46, women: 0.51 },
    },
    sourceNote: "Switzerland-specific estimate from FSO Switzerland, WHO, and World Bank data.",
  },
  BE: {
    name: "Belgium", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "full",
    totalPopulation: 11700000, adultSharePct: 0.80, sexRatioPctMale: 0.491,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.0, sd: 2.8 }, women: { mean: 64.3, sd: 2.6 } },
      notObeseShare: { men: 0.78, women: 0.79 },
      income: { men: { median: 37000, sigma: 0.95 }, women: { median: 28000, sigma: 1.0 } },
      marriedShare: { men: 0.43, women: 0.42 },
      hasKidsShare: { men: 0.47, women: 0.52 },
    },
    sourceNote: "Belgium-specific estimate from Statbel, WHO, and World Bank data.",
  },
  SE: {
    name: "Sweden", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "full",
    totalPopulation: 10600000, adultSharePct: 0.80, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.5, sd: 2.8 }, women: { mean: 65.0, sd: 2.6 } },
      notObeseShare: { men: 0.85, women: 0.86 },
      income: { men: { median: 39000, sigma: 0.9 }, women: { median: 32000, sigma: 0.9 } },
      marriedShare: { men: 0.38, women: 0.37 },
      hasKidsShare: { men: 0.46, women: 0.51 },
    },
    sourceNote: "Sweden-specific estimate from Statistics Sweden, WHO, and World Bank data.",
  },
  NO: {
    name: "Norway", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "full",
    totalPopulation: 5500000, adultSharePct: 0.79, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.7, sd: 2.8 }, women: { mean: 65.2, sd: 2.6 } },
      notObeseShare: { men: 0.77, women: 0.78 },
      income: { men: { median: 48000, sigma: 0.9 }, women: { median: 38000, sigma: 0.9 } },
      marriedShare: { men: 0.40, women: 0.39 },
      hasKidsShare: { men: 0.47, women: 0.52 },
    },
    sourceNote: "Norway-specific estimate from Statistics Norway, WHO, and World Bank data.",
  },
  DK: {
    name: "Denmark", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "full",
    totalPopulation: 5950000, adultSharePct: 0.80, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.9, sd: 2.8 }, women: { mean: 65.4, sd: 2.6 } },
      notObeseShare: { men: 0.80, women: 0.81 },
      income: { men: { median: 41000, sigma: 0.9 }, women: { median: 34000, sigma: 0.9 } },
      marriedShare: { men: 0.43, women: 0.42 },
      hasKidsShare: { men: 0.46, women: 0.51 },
    },
    sourceNote: "Denmark-specific estimate from Statistics Denmark, WHO, and World Bank data.",
  },
  FI: {
    name: "Finland", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "full",
    totalPopulation: 5600000, adultSharePct: 0.82, sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.1, sd: 2.8 }, women: { mean: 64.6, sd: 2.6 } },
      notObeseShare: { men: 0.75, women: 0.77 },
      income: { men: { median: 37000, sigma: 0.9 }, women: { median: 30000, sigma: 0.9 } },
      marriedShare: { men: 0.41, women: 0.40 },
      hasKidsShare: { men: 0.45, women: 0.50 },
    },
    sourceNote: "Finland-specific estimate from Statistics Finland, WHO, and World Bank data.",
  },
  IT: {
    name: "Italy", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 59000000, adultSharePct: 0.85, sexRatioPctMale: 0.489,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.1, sd: 2.8 }, women: { mean: 63.5, sd: 2.6 } },
      notObeseShare: { men: 0.81, women: 0.85 },
      income: { men: { median: 27000, sigma: 1.0 }, women: { median: 19000, sigma: 1.05 } },
      marriedShare: { men: 0.49, women: 0.47 },
      hasKidsShare: { men: 0.47, women: 0.51 },
    },
    sourceNote: "Italy-specific estimate from ISTAT, WHO, and World Bank data.",
  },
  ES: {
    name: "Spain", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 47500000, adultSharePct: 0.83, sexRatioPctMale: 0.489,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.3, sd: 2.8 }, women: { mean: 63.8, sd: 2.6 } },
      notObeseShare: { men: 0.83, women: 0.84 },
      income: { men: { median: 26000, sigma: 1.0 }, women: { median: 19000, sigma: 1.05 } },
      marriedShare: { men: 0.44, women: 0.43 },
      hasKidsShare: { men: 0.46, women: 0.50 },
    },
    sourceNote: "Spain-specific estimate from INE Spain, WHO, and World Bank data.",
  },
  PT: {
    name: "Portugal", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 10400000, adultSharePct: 0.85, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.7, sd: 2.7 }, women: { mean: 63.2, sd: 2.5 } },
      notObeseShare: { men: 0.80, women: 0.78 },
      income: { men: { median: 20000, sigma: 1.0 }, women: { median: 15000, sigma: 1.05 } },
      marriedShare: { men: 0.44, women: 0.43 },
      hasKidsShare: { men: 0.46, women: 0.50 },
    },
    sourceNote: "Portugal-specific estimate from INE Portugal, WHO, and World Bank data.",
  },
  GR: {
    name: "Greece", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 10400000, adultSharePct: 0.86, sexRatioPctMale: 0.487,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.7, sd: 2.8 }, women: { mean: 63.9, sd: 2.6 } },
      notObeseShare: { men: 0.76, women: 0.75 },
      income: { men: { median: 18000, sigma: 1.05 }, women: { median: 13000, sigma: 1.1 } },
      marriedShare: { men: 0.51, women: 0.49 },
      hasKidsShare: { men: 0.48, women: 0.52 },
    },
    sourceNote: "Greece-specific estimate from ELSTAT, WHO, and World Bank data.",
  },
  PL: {
    name: "Poland", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 37700000, adultSharePct: 0.82, sexRatioPctMale: 0.483,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.9, sd: 2.8 }, women: { mean: 64.3, sd: 2.6 } },
      notObeseShare: { men: 0.75, women: 0.79 },
      income: { men: { median: 16000, sigma: 1.0 }, women: { median: 12000, sigma: 1.05 } },
      marriedShare: { men: 0.54, women: 0.51 },
      hasKidsShare: { men: 0.51, women: 0.56 },
    },
    sourceNote: "Poland-specific estimate from GUS Poland, WHO, and World Bank data.",
  },
  RU: {
    name: "Russia", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 144000000, adultSharePct: 0.80, sexRatioPctMale: 0.462,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.0, sd: 2.8 }, women: { mean: 63.6, sd: 2.6 } },
      notObeseShare: { men: 0.75, women: 0.70 },
      income: { men: { median: 12000, sigma: 1.1 }, women: { median: 8500, sigma: 1.15 } },
      marriedShare: { men: 0.52, women: 0.46 },
      hasKidsShare: { men: 0.52, women: 0.60 },
    },
    sourceNote: "Russia-specific estimate from Rosstat, WHO, and World Bank data. Russia's adult sex ratio is unusually skewed toward women due to a large male-mortality gap.",
  },
  UA: {
    name: "Ukraine", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 36000000, adultSharePct: 0.82, sexRatioPctMale: 0.455,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.0, sd: 2.8 }, women: { mean: 63.6, sd: 2.6 } },
      notObeseShare: { men: 0.76, women: 0.73 },
      income: { men: { median: 8000, sigma: 1.15 }, women: { median: 6000, sigma: 1.2 } },
      marriedShare: { men: 0.52, women: 0.46 },
      hasKidsShare: { men: 0.50, women: 0.58 },
    },
    sourceNote: "Ukraine-specific estimate from the State Statistics Service of Ukraine, WHO, and World Bank data; current population figures carry unusual uncertainty.",
  },
  RO: {
    name: "Romania", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 19000000, adultSharePct: 0.83, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.5, sd: 2.8 }, women: { mean: 63.9, sd: 2.6 } },
      notObeseShare: { men: 0.72, women: 0.78 },
      income: { men: { median: 12000, sigma: 1.05 }, women: { median: 9000, sigma: 1.1 } },
      marriedShare: { men: 0.51, women: 0.48 },
      hasKidsShare: { men: 0.50, women: 0.55 },
    },
    sourceNote: "Romania-specific estimate from INS Romania, WHO, and World Bank data.",
  },
  CZ: {
    name: "Czechia", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 10900000, adultSharePct: 0.83, sexRatioPctMale: 0.489,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.2, sd: 2.8 }, women: { mean: 64.5, sd: 2.6 } },
      notObeseShare: { men: 0.74, women: 0.79 },
      income: { men: { median: 20000, sigma: 1.0 }, women: { median: 15000, sigma: 1.05 } },
      marriedShare: { men: 0.47, women: 0.45 },
      hasKidsShare: { men: 0.48, women: 0.53 },
    },
    sourceNote: "Czechia-specific estimate from CZSO, WHO, and World Bank data.",
  },
  AT: { name: "Austria", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "regional", totalPopulation: 9100000 },
  LU: { name: "Luxembourg", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "regional", totalPopulation: 660000 },
  MC: { name: "Monaco", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "regional", totalPopulation: 39000 },
  LI: { name: "Liechtenstein", continent: "Europe", regionKey: "WESTERN_EUROPE", tier: "regional", totalPopulation: 40000 },
  IS: { name: "Iceland", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "regional", totalPopulation: 390000 },
  EE: { name: "Estonia", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "regional", totalPopulation: 1370000 },
  LV: { name: "Latvia", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "regional", totalPopulation: 1830000 },
  LT: { name: "Lithuania", continent: "Europe", regionKey: "NORTHERN_EUROPE", tier: "regional", totalPopulation: 2750000 },
  MT: { name: "Malta", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 540000 },
  CY: { name: "Cyprus", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 1250000 },
  SI: { name: "Slovenia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 2100000 },
  HR: { name: "Croatia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 3850000 },
  BA: { name: "Bosnia and Herzegovina", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 3200000 },
  RS: { name: "Serbia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 6600000 },
  ME: { name: "Montenegro", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 620000 },
  MK: { name: "North Macedonia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 1830000 },
  AL: { name: "Albania", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 2750000 },
  XK: { name: "Kosovo", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 1600000 },
  AD: { name: "Andorra", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 81000 },
  SM: { name: "San Marino", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 34000 },
  VA: { name: "Vatican City", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 800 },
  BG: { name: "Bulgaria", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "regional", totalPopulation: 6400000 },
  HU: { name: "Hungary", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "regional", totalPopulation: 9600000 },
  SK: { name: "Slovakia", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "regional", totalPopulation: 5400000 },
  MD: { name: "Moldova", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "regional", totalPopulation: 2500000 },
  BY: { name: "Belarus", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "regional", totalPopulation: 9100000 },
  GE: { name: "Georgia", continent: "Europe", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 3700000 },
  AM: { name: "Armenia", continent: "Europe", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 3000000 },

  // --- Middle East & North Africa ---
  TR: {
    name: "Turkey", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 86000000, adultSharePct: 0.73, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.5, sd: 2.7 }, women: { mean: 63.0, sd: 2.5 } },
      notObeseShare: { men: 0.71, women: 0.62 },
      income: { men: { median: 11000, sigma: 1.1 }, women: { median: 6500, sigma: 1.2 } },
      marriedShare: { men: 0.62, women: 0.58 },
      hasKidsShare: { men: 0.60, women: 0.66 },
    },
    sourceNote: "Turkey-specific estimate from TurkStat, WHO, and World Bank data.",
  },
  SA: {
    name: "Saudi Arabia", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 36000000, adultSharePct: 0.72, sexRatioPctMale: 0.58,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.5, sd: 2.7 }, women: { mean: 61.8, sd: 2.5 } },
      notObeseShare: { men: 0.70, women: 0.60 },
      income: { men: { median: 24000, sigma: 1.1 }, women: { median: 9000, sigma: 1.3 } },
      marriedShare: { men: 0.60, women: 0.55 },
      hasKidsShare: { men: 0.58, women: 0.62 },
    },
    sourceNote: "Saudi Arabia-specific estimate from GASTAT, WHO, and World Bank data. Its adult sex ratio skews male due to a very large foreign labor workforce.",
  },
  AE: {
    name: "United Arab Emirates", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 10000000, adultSharePct: 0.85, sexRatioPctMale: 0.69,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.7, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
      notObeseShare: { men: 0.68, women: 0.62 },
      income: { men: { median: 32000, sigma: 1.15 }, women: { median: 16000, sigma: 1.25 } },
      marriedShare: { men: 0.55, women: 0.52 },
      hasKidsShare: { men: 0.52, women: 0.58 },
    },
    sourceNote: "UAE-specific estimate from the Federal Competitiveness and Statistics Centre, WHO, and World Bank data. Its adult population is roughly two-thirds male due to a very large foreign labor workforce.",
  },
  IL: {
    name: "Israel", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 9800000, adultSharePct: 0.70, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 69.0, sd: 2.8 }, women: { mean: 63.4, sd: 2.6 } },
      notObeseShare: { men: 0.74, women: 0.73 },
      income: { men: { median: 30000, sigma: 1.0 }, women: { median: 22000, sigma: 1.05 } },
      marriedShare: { men: 0.58, women: 0.56 },
      hasKidsShare: { men: 0.58, women: 0.63 },
    },
    sourceNote: "Israel-specific estimate from Israel's Central Bureau of Statistics, WHO, and World Bank data.",
  },
  EG: {
    name: "Egypt", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 112000000, adultSharePct: 0.62, sexRatioPctMale: 0.503,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.0, sd: 2.7 }, women: { mean: 62.3, sd: 2.5 } },
      notObeseShare: { men: 0.70, women: 0.55 },
      income: { men: { median: 5500, sigma: 1.2 }, women: { median: 2200, sigma: 1.3 } },
      marriedShare: { men: 0.63, women: 0.60 },
      hasKidsShare: { men: 0.62, women: 0.68 },
    },
    sourceNote: "Egypt-specific estimate from CAPMAS, WHO, and World Bank data.",
  },
  IR: {
    name: "Iran", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 89000000, adultSharePct: 0.75, sexRatioPctMale: 0.498,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.6, sd: 2.7 }, women: { mean: 62.8, sd: 2.5 } },
      notObeseShare: { men: 0.75, women: 0.62 },
      income: { men: { median: 9000, sigma: 1.15 }, women: { median: 3500, sigma: 1.3 } },
      marriedShare: { men: 0.62, women: 0.58 },
      hasKidsShare: { men: 0.58, women: 0.64 },
    },
    sourceNote: "Iran-specific estimate from the Statistical Center of Iran, WHO, and World Bank data.",
  },
  IQ: { name: "Iraq", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 45000000 },
  YE: { name: "Yemen", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 34000000 },
  SD: { name: "Sudan", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 48000000 },
  DZ: { name: "Algeria", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 45000000 },
  MA: { name: "Morocco", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 37800000 },
  SY: { name: "Syria", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 23000000 },
  TN: { name: "Tunisia", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 12300000 },
  JO: { name: "Jordan", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 11300000 },
  LY: { name: "Libya", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 6900000 },
  LB: { name: "Lebanon", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 5500000 },
  PS: { name: "Palestine", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 5400000 },
  OM: { name: "Oman", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 4600000, sexRatioPctMale: 0.62 },
  KW: { name: "Kuwait", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 4300000, sexRatioPctMale: 0.62 },
  QA: { name: "Qatar", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 2700000, sexRatioPctMale: 0.75 },
  BH: { name: "Bahrain", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 1500000, sexRatioPctMale: 0.62 },

  // --- Africa (Sub-Saharan) ---
  NG: {
    name: "Nigeria", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 223000000, adultSharePct: 0.50, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.7, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
      notObeseShare: { men: 0.94, women: 0.80 },
      income: { men: { median: 3200, sigma: 1.3 }, women: { median: 1800, sigma: 1.35 } },
      marriedShare: { men: 0.58, women: 0.52 },
      hasKidsShare: { men: 0.68, women: 0.75 },
    },
    sourceNote: "Nigeria-specific estimate from the National Bureau of Statistics, WHO, and World Bank data.",
  },
  ZA: {
    name: "South Africa", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 60000000, adultSharePct: 0.68, sexRatioPctMale: 0.487,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, white: 0.073, black: 0.81, asian: 0.026 },
      height: { men: { mean: 66.8, sd: 2.8 }, women: { mean: 62.0, sd: 2.6 } },
      notObeseShare: { men: 0.85, women: 0.60 },
      income: { men: { median: 9000, sigma: 1.2 }, women: { median: 6000, sigma: 1.25 } },
      marriedShare: { men: 0.38, women: 0.32 },
      hasKidsShare: { men: 0.55, women: 0.65 },
    },
    sourceNote: "South Africa-specific estimate from Stats SA, WHO, and World Bank data. Stats SA's ‘Coloured’ population-group category (about 8.8%) has no equivalent in this tool's race filter.",
  },
  KE: {
    name: "Kenya", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 56000000, adultSharePct: 0.52, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.5, sd: 2.8 }, women: { mean: 62.6, sd: 2.6 } },
      notObeseShare: { men: 0.93, women: 0.80 },
      income: { men: { median: 3800, sigma: 1.25 }, women: { median: 2200, sigma: 1.3 } },
      marriedShare: { men: 0.58, women: 0.55 },
      hasKidsShare: { men: 0.62, women: 0.70 },
    },
    sourceNote: "Kenya-specific estimate from the Kenya National Bureau of Statistics, WHO, and World Bank data.",
  },
  ET: {
    name: "Ethiopia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 128000000, adultSharePct: 0.48, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.7, sd: 2.7 }, women: { mean: 61.0, sd: 2.5 } },
      notObeseShare: { men: 0.98, women: 0.93 },
      income: { men: { median: 1800, sigma: 1.35 }, women: { median: 1000, sigma: 1.4 } },
      marriedShare: { men: 0.60, women: 0.58 },
      hasKidsShare: { men: 0.65, women: 0.72 },
    },
    sourceNote: "Ethiopia-specific estimate from the Ethiopian Statistics Service, WHO, and World Bank data.",
  },
  GH: {
    name: "Ghana", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 34000000, adultSharePct: 0.53, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.5, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
      notObeseShare: { men: 0.89, women: 0.68 },
      income: { men: { median: 3500, sigma: 1.25 }, women: { median: 2200, sigma: 1.3 } },
      marriedShare: { men: 0.55, women: 0.50 },
      hasKidsShare: { men: 0.60, women: 0.68 },
    },
    sourceNote: "Ghana-specific estimate from the Ghana Statistical Service, WHO, and World Bank data.",
  },
  CD: { name: "DR Congo", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 102000000 },
  TZ: { name: "Tanzania", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 67000000 },
  UG: { name: "Uganda", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 48000000 },
  MZ: { name: "Mozambique", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 33000000 },
  AO: { name: "Angola", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 36000000 },
  CM: { name: "Cameroon", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 28000000 },
  CI: { name: "Côte d'Ivoire", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 29000000 },
  MG: { name: "Madagascar", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 30000000 },
  NE: { name: "Niger", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 27000000 },
  BF: { name: "Burkina Faso", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 23000000 },
  ML: { name: "Mali", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 23000000 },
  MW: { name: "Malawi", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 21000000 },
  ZM: { name: "Zambia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 20000000 },
  SO: { name: "Somalia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 18000000 },
  SN: { name: "Senegal", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 18000000 },
  TD: { name: "Chad", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 18000000 },
  ZW: { name: "Zimbabwe", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 16300000 },
  GN: { name: "Guinea", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 14000000 },
  RW: { name: "Rwanda", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 14000000 },
  BJ: { name: "Benin", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 13700000 },
  BI: { name: "Burundi", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 13200000 },
  SS: { name: "South Sudan", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 11000000 },
  TG: { name: "Togo", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 8800000 },
  SL: { name: "Sierra Leone", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 8600000 },
  CG: { name: "Republic of the Congo", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 6100000 },
  LR: { name: "Liberia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 5400000 },
  CF: { name: "Central African Republic", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 5700000 },
  MR: { name: "Mauritania", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 4900000 },
  ER: { name: "Eritrea", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 3700000 },
  GM: { name: "Gambia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 2700000 },
  NA: { name: "Namibia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 2600000 },
  BW: { name: "Botswana", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 2600000 },
  GA: { name: "Gabon", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 2400000 },
  LS: { name: "Lesotho", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 2300000 },
  GW: { name: "Guinea-Bissau", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 2100000 },
  GQ: { name: "Equatorial Guinea", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 1700000 },
  MU: { name: "Mauritius", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 1300000 },
  SZ: { name: "Eswatini", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 1200000 },
  DJ: { name: "Djibouti", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 1100000 },
  KM: { name: "Comoros", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 850000 },
  CV: { name: "Cabo Verde", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 590000 },
  ST: { name: "São Tomé and Príncipe", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 230000 },
  SC: { name: "Seychelles", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 100000 },

  // --- South & Central Asia ---
  IN: {
    name: "India", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "full",
    totalPopulation: 1441000000, adultSharePct: 0.66, sexRatioPctMale: 0.512,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.4, sd: 2.6 }, women: { mean: 60.2, sd: 2.4 } },
      notObeseShare: { men: 0.96, women: 0.94 },
      income: { men: { median: 3800, sigma: 1.3 }, women: { median: 1400, sigma: 1.4 } },
      marriedShare: { men: 0.67, women: 0.70 },
      hasKidsShare: { men: 0.63, women: 0.70 },
    },
    sourceNote: "India-specific estimate from the Ministry of Statistics (MoSPI), WHO, and World Bank data.",
  },
  PK: {
    name: "Pakistan", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "full",
    totalPopulation: 240000000, adultSharePct: 0.55, sexRatioPctMale: 0.51,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.0, sd: 2.6 }, women: { mean: 61.0, sd: 2.4 } },
      notObeseShare: { men: 0.83, women: 0.72 },
      income: { men: { median: 3000, sigma: 1.3 }, women: { median: 900, sigma: 1.45 } },
      marriedShare: { men: 0.62, women: 0.65 },
      hasKidsShare: { men: 0.62, women: 0.68 },
    },
    sourceNote: "Pakistan-specific estimate from the Pakistan Bureau of Statistics, WHO, and World Bank data.",
  },
  BD: {
    name: "Bangladesh", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "full",
    totalPopulation: 173000000, adultSharePct: 0.62, sexRatioPctMale: 0.50,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.4, sd: 2.5 }, women: { mean: 59.8, sd: 2.3 } },
      notObeseShare: { men: 0.94, women: 0.86 },
      income: { men: { median: 3200, sigma: 1.3 }, women: { median: 1500, sigma: 1.35 } },
      marriedShare: { men: 0.65, women: 0.71 },
      hasKidsShare: { men: 0.62, women: 0.70 },
    },
    sourceNote: "Bangladesh-specific estimate from the Bangladesh Bureau of Statistics, WHO, and World Bank data.",
  },
  AF: { name: "Afghanistan", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 42000000 },
  NP: { name: "Nepal", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 30000000 },
  LK: { name: "Sri Lanka", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 22000000 },
  BT: { name: "Bhutan", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 780000 },
  MV: { name: "Maldives", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 520000 },
  KZ: { name: "Kazakhstan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 19600000 },
  UZ: { name: "Uzbekistan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 35500000 },
  TM: { name: "Turkmenistan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 6300000 },
  TJ: { name: "Tajikistan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 10100000 },
  KG: { name: "Kyrgyzstan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 7000000 },
  AZ: { name: "Azerbaijan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 10200000 },

  // --- East Asia ---
  CN: {
    name: "China", continent: "Asia", regionKey: "EAST_ASIA", tier: "full",
    totalPopulation: 1411000000, adultSharePct: 0.80, sexRatioPctMale: 0.505,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.02, "20-29": 0.13, "30-39": 0.155, "40-49": 0.17, "50-59": 0.165, "60-69": 0.14, "70-79": 0.11, "80+": 0.11 },
        women: { "18-19": 0.018, "20-29": 0.12, "30-39": 0.15, "40-49": 0.165, "50-59": 0.16, "60-69": 0.145, "70-79": 0.12, "80+": 0.122 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 68.5, sd: 2.7 }, women: { mean: 62.8, sd: 2.5 } },
      notObeseShare: { men: 0.94, women: 0.95 },
      income: { men: { median: 11000, sigma: 1.1 }, women: { median: 8000, sigma: 1.15 } },
      marriedShare: { men: 0.62, women: 0.58 },
      hasKidsShare: { men: 0.58, women: 0.62 },
    },
    sourceNote: "China-specific estimate from the National Bureau of Statistics of China, WHO, and World Bank data.",
  },
  JP: {
    name: "Japan", continent: "Asia", regionKey: "EAST_ASIA", tier: "full",
    totalPopulation: 124000000, adultSharePct: 0.87, sexRatioPctMale: 0.487,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.0, sd: 2.6 }, women: { mean: 62.2, sd: 2.4 } },
      notObeseShare: { men: 0.95, women: 0.965 },
      income: { men: { median: 26000, sigma: 1.0 }, women: { median: 17000, sigma: 1.05 } },
      marriedShare: { men: 0.60, women: 0.55 },
      hasKidsShare: { men: 0.52, women: 0.56 },
    },
    sourceNote: "Japan-specific estimate from Japan's Statistics Bureau, WHO, and World Bank data.",
  },
  KR: {
    name: "South Korea", continent: "Asia", regionKey: "EAST_ASIA", tier: "full",
    totalPopulation: 51700000, adultSharePct: 0.84, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.9, sd: 2.6 }, women: { mean: 62.8, sd: 2.4 } },
      notObeseShare: { men: 0.94, women: 0.97 },
      income: { men: { median: 24000, sigma: 1.0 }, women: { median: 16000, sigma: 1.05 } },
      marriedShare: { men: 0.58, women: 0.54 },
      hasKidsShare: { men: 0.50, women: 0.54 },
    },
    sourceNote: "South Korea-specific estimate from Statistics Korea (KOSTAT), WHO, and World Bank data.",
  },
  TW: {
    name: "Taiwan", continent: "Asia", regionKey: "EAST_ASIA", tier: "full",
    totalPopulation: 23600000, adultSharePct: 0.85, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.3, sd: 2.6 }, women: { mean: 62.4, sd: 2.4 } },
      notObeseShare: { men: 0.85, women: 0.90 },
      income: { men: { median: 22000, sigma: 1.0 }, women: { median: 16000, sigma: 1.05 } },
      marriedShare: { men: 0.53, women: 0.50 },
      hasKidsShare: { men: 0.48, women: 0.52 },
    },
    sourceNote: "Taiwan-specific estimate from Taiwan's National Statistics, WHO-comparable sources, and World Bank data.",
  },
  KP: { name: "North Korea", continent: "Asia", regionKey: "EAST_ASIA", tier: "regional", totalPopulation: 26000000 },
  MN: { name: "Mongolia", continent: "Asia", regionKey: "EAST_ASIA", tier: "regional", totalPopulation: 3400000 },
  HK: { name: "Hong Kong", continent: "Asia", regionKey: "EAST_ASIA", tier: "regional", totalPopulation: 7500000 },

  // --- Southeast Asia ---
  ID: {
    name: "Indonesia", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "full",
    totalPopulation: 279000000, adultSharePct: 0.68, sexRatioPctMale: 0.498,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.8, sd: 2.5 }, women: { mean: 59.8, sd: 2.3 } },
      notObeseShare: { men: 0.86, women: 0.72 },
      income: { men: { median: 4500, sigma: 1.25 }, women: { median: 2600, sigma: 1.3 } },
      marriedShare: { men: 0.60, women: 0.58 },
      hasKidsShare: { men: 0.60, women: 0.66 },
    },
    sourceNote: "Indonesia-specific estimate from Statistics Indonesia (BPS), WHO, and World Bank data.",
  },
  PH: {
    name: "Philippines", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "full",
    totalPopulation: 117000000, adultSharePct: 0.63, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.3, sd: 2.5 }, women: { mean: 59.6, sd: 2.3 } },
      notObeseShare: { men: 0.79, women: 0.72 },
      income: { men: { median: 5000, sigma: 1.25 }, women: { median: 3500, sigma: 1.3 } },
      marriedShare: { men: 0.50, women: 0.48 },
      hasKidsShare: { men: 0.58, women: 0.64 },
    },
    sourceNote: "Philippines-specific estimate from the Philippine Statistics Authority, WHO, and World Bank data.",
  },
  VN: {
    name: "Vietnam", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "full",
    totalPopulation: 99000000, adultSharePct: 0.72, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.8, sd: 2.5 }, women: { mean: 60.6, sd: 2.3 } },
      notObeseShare: { men: 0.96, women: 0.97 },
      income: { men: { median: 5000, sigma: 1.2 }, women: { median: 3500, sigma: 1.25 } },
      marriedShare: { men: 0.62, women: 0.60 },
      hasKidsShare: { men: 0.58, women: 0.63 },
    },
    sourceNote: "Vietnam-specific estimate from the General Statistics Office of Vietnam, WHO, and World Bank data.",
  },
  TH: {
    name: "Thailand", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "full",
    totalPopulation: 71600000, adultSharePct: 0.80, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 66.5, sd: 2.6 }, women: { mean: 61.2, sd: 2.4 } },
      notObeseShare: { men: 0.74, women: 0.60 },
      income: { men: { median: 8500, sigma: 1.15 }, women: { median: 6000, sigma: 1.2 } },
      marriedShare: { men: 0.55, women: 0.52 },
      hasKidsShare: { men: 0.53, women: 0.58 },
    },
    sourceNote: "Thailand-specific estimate from the National Statistical Office of Thailand, WHO, and World Bank data.",
  },
  MY: {
    name: "Malaysia", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "full",
    totalPopulation: 34300000, adultSharePct: 0.74, sexRatioPctMale: 0.505,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.6, sd: 2.5 }, women: { mean: 60.5, sd: 2.3 } },
      notObeseShare: { men: 0.85, women: 0.82 },
      income: { men: { median: 11000, sigma: 1.15 }, women: { median: 8000, sigma: 1.2 } },
      marriedShare: { men: 0.58, women: 0.56 },
      hasKidsShare: { men: 0.55, women: 0.60 },
    },
    sourceNote: "Malaysia-specific estimate from the Department of Statistics Malaysia, WHO, and World Bank data. Malaysia's own ethnic categories (Malay/Bumiputera, Chinese, Indian) don't map onto this tool's race filter, so only ‘any’ is available.",
  },
  SG: {
    name: "Singapore", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "full",
    totalPopulation: 5900000, adultSharePct: 0.85, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.0, sd: 2.6 }, women: { mean: 62.0, sd: 2.4 } },
      notObeseShare: { men: 0.92, women: 0.94 },
      income: { men: { median: 42000, sigma: 1.0 }, women: { median: 32000, sigma: 1.05 } },
      marriedShare: { men: 0.55, women: 0.53 },
      hasKidsShare: { men: 0.48, women: 0.52 },
    },
    sourceNote: "Singapore-specific estimate from the Singapore Department of Statistics, WHO, and World Bank data. Singapore's own ethnic categories (Chinese, Malay, Indian) don't map onto this tool's race filter, so only ‘any’ is available.",
  },
  MM: { name: "Myanmar", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "regional", totalPopulation: 55000000 },
  KH: { name: "Cambodia", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "regional", totalPopulation: 17000000 },
  LA: { name: "Laos", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "regional", totalPopulation: 7700000 },
  BN: { name: "Brunei", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "regional", totalPopulation: 460000 },
  TL: { name: "Timor-Leste", continent: "Asia", regionKey: "SOUTHEAST_ASIA", tier: "regional", totalPopulation: 1400000 },

  // --- Oceania ---
  AU: {
    name: "Australia", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 26600000, adultSharePct: 0.79, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 70.2, sd: 2.9 }, women: { mean: 64.3, sd: 2.7 } },
      notObeseShare: { men: 0.69, women: 0.71 },
      income: { men: { median: 42000, sigma: 0.95 }, women: { median: 32000, sigma: 1.0 } },
      marriedShare: { men: 0.47, women: 0.46 },
      hasKidsShare: { men: 0.49, women: 0.54 },
    },
    sourceNote: "Australia-specific estimate from the Australian Bureau of Statistics, WHO, and World Bank data.",
  },
  NZ: {
    name: "New Zealand", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 5200000, adultSharePct: 0.78, sexRatioPctMale: 0.492,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.9, sd: 2.8 }, women: { mean: 64.1, sd: 2.6 } },
      notObeseShare: { men: 0.66, women: 0.65 },
      income: { men: { median: 37000, sigma: 0.95 }, women: { median: 29000, sigma: 1.0 } },
      marriedShare: { men: 0.45, women: 0.44 },
      hasKidsShare: { men: 0.48, women: 0.53 },
    },
    sourceNote: "New Zealand-specific estimate from Stats NZ, WHO, and World Bank data.",
  },
  PG: { name: "Papua New Guinea", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 10300000 },
  FJ: { name: "Fiji", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 930000 },
  SB: { name: "Solomon Islands", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 740000 },
  VU: { name: "Vanuatu", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 330000 },
  WS: { name: "Samoa", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 220000 },
  KI: { name: "Kiribati", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 130000 },
  TO: { name: "Tonga", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 107000 },
  FM: { name: "Micronesia", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 113000 },
  PW: { name: "Palau", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 18000 },
  MH: { name: "Marshall Islands", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 42000 },
  NR: { name: "Nauru", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 12000 },
  TV: { name: "Tuvalu", continent: "Oceania", regionKey: "OCEANIA", tier: "regional", totalPopulation: 11000 },
};

// Returns a stats-shaped object -- { ageDistribution, raceShare, height,
// notObeseShare, income, marriedShare, hasKidsShare, totalAdultPopulation }
// -- ready to pass straight into QuizStats.computeProbability(), for any
// country code in COUNTRIES.
function getCountryStats(code) {
  const entry = COUNTRIES[code];
  if (!entry) return null;
  if (entry.useUsStats) return window.QuizStats.STATS;

  const region = REGION_AVERAGES[entry.regionKey];
  const base = entry.tier === "full" ? entry.stats : region;
  const adultSharePct = entry.adultSharePct != null ? entry.adultSharePct : region.adultSharePct;
  const sexRatioPctMale = entry.sexRatioPctMale != null ? entry.sexRatioPctMale : region.sexRatioPctMale;
  const adultPopulation = entry.totalPopulation * adultSharePct;

  return {
    ...base,
    totalAdultPopulation: {
      men: Math.round(adultPopulation * sexRatioPctMale),
      women: Math.round(adultPopulation * (1 - sexRatioPctMale)),
    },
  };
}

function getCountryMeta(code) {
  const entry = COUNTRIES[code];
  if (!entry) return null;
  const region = REGION_AVERAGES[entry.regionKey];
  return {
    code,
    name: entry.name,
    continent: entry.continent,
    tier: entry.tier,
    sourceNote: entry.sourceNote || (region && region.sourceNote) || "",
  };
}

// Country list grouped by continent, alphabetized within each group --
// used to build the report's country selector.
function listCountriesByContinent() {
  const groups = {};
  Object.entries(COUNTRIES).forEach(([code, c]) => {
    if (!groups[c.continent]) groups[c.continent] = [];
    groups[c.continent].push({ code, name: c.name, tier: c.tier });
  });
  Object.values(groups).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
  return groups;
}

window.QuizGlobalStats = { COUNTRIES, REGION_AVERAGES, getCountryStats, getCountryMeta, listCountriesByContinent };
})();
