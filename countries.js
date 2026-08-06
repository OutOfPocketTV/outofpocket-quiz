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
      raceShare: { any: 1, white: 0.43, black: 0.10, asian: 0.011, parda: 0.45, indigenous: 0.006 },
      height: { men: { mean: 67.8, sd: 2.8 }, women: { mean: 62.5, sd: 2.6 } },
      notObeseShare: { men: 0.78, women: 0.74 },
      income: { men: { median: 11000, sigma: 1.15 }, women: { median: 7500, sigma: 1.2 } },
      marriedShare: { men: 0.42, women: 0.40 },
      hasKidsShare: { men: 0.54, women: 0.61 },
    },
    sourceNote: "Brazil-specific estimate from IBGE, WHO, and World Bank data. IBGE's official color/race categories (including ‘parda’, Brazil's largest group) are available in the paid report's Ethnic, Ancestral or Cultural Background filter.",
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
  PE: {
    name: "Peru", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 34200000, adultSharePct: 0.71, sexRatioPctMale: 0.493,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.049, "20-29": 0.232, "30-39": 0.219, "40-49": 0.182, "50-59": 0.143, "60-69": 0.095, "70-79": 0.055, "80+": 0.025 },
        women: { "18-19": 0.046, "20-29": 0.226, "30-39": 0.219, "40-49": 0.179, "50-59": 0.138, "60-69": 0.097, "70-79": 0.061, "80+": 0.034 },
      },
      raceShare: { any: 1, white: 0.059, black: 0.036 },
      height: { men: { mean: 65.65, sd: 2.6 }, women: { mean: 60.78, sd: 2.4 } },
      notObeseShare: { men: 0.751, women: 0.667 },
      income: { men: { median: 7500, sigma: 1.25 }, women: { median: 4800, sigma: 1.3 } },
    },
    sourceNote: "Peru-specific estimate from INEI Censo 2017 (ethnic self-identification, population 12+), UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. Parenthood rate and married share fall back to the regional average.",
  },
  VE: {
    name: "Venezuela", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 28400000, adultSharePct: 0.69, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.059, "20-29": 0.226, "30-39": 0.187, "40-49": 0.181, "50-59": 0.158, "60-69": 0.116, "70-79": 0.056, "80+": 0.017 },
        women: { "18-19": 0.053, "20-29": 0.200, "30-39": 0.179, "40-49": 0.182, "50-59": 0.161, "60-69": 0.126, "70-79": 0.071, "80+": 0.028 },
      },
      raceShare: { any: 1, white: 0.436, black: 0.035 },
      height: { men: { mean: 68.32, sd: 2.7 }, women: { mean: 63.01, sd: 2.5 } },
      notObeseShare: { men: 0.798, women: 0.746 },
    },
    sourceNote: "Venezuela-specific estimate from INE Censo 2011 (condición étnica), UN World Population Prospects, NCD-RisC height, and WHO obesity data. Income is deliberately omitted: hyperinflation and multiple-exchange-rate distortion make published GNI figures unreliable, and independent estimates vary too widely (roughly $1,800-3,000) to calibrate confidently. Parenthood rate and married share fall back to the regional average.",
  },
  EC: {
    name: "Ecuador", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 18100000, adultSharePct: 0.70, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.051, "20-29": 0.250, "30-39": 0.225, "40-49": 0.181, "50-59": 0.135, "60-69": 0.090, "70-79": 0.051, "80+": 0.017 },
        women: { "18-19": 0.048, "20-29": 0.237, "30-39": 0.218, "40-49": 0.179, "50-59": 0.137, "60-69": 0.096, "70-79": 0.059, "80+": 0.026 },
      },
      raceShare: { any: 1, white: 0.022, black: 0.048 },
      height: { men: { mean: 65.87, sd: 2.6 }, women: { mean: 61.12, sd: 2.4 } },
      notObeseShare: { men: 0.763, women: 0.661 },
      income: { men: { median: 6800, sigma: 1.3 }, women: { median: 4400, sigma: 1.35 } },
    },
    sourceNote: "Ecuador-specific estimate from INEC Censo 2022 (self-identification, freshly updated from 2010), UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. Parenthood rate and married share fall back to the regional average.",
  },
  GT: {
    name: "Guatemala", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 18400000, adultSharePct: 0.62, sexRatioPctMale: 0.489,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: { any: 1, black: 0.003 },
      height: { men: { mean: 64.71, sd: 2.6 }, women: { mean: 59.41, sd: 2.4 } },
      notObeseShare: { men: 0.767, women: 0.678 },
      income: { men: { median: 5700, sigma: 1.3 }, women: { median: 3600, sigma: 1.35 } },
    },
    sourceNote: "Guatemala-specific estimate from INE Censo 2018 (pertenencia étnica), UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. raceShare.black (Afrodescendiente + Garífuna) is a genuine census category but very small (0.3%). 'Ladino,' the 56% majority category, is a linguistic/cultural label, not a race self-identification, so it was not mapped to White. Parenthood rate and married share fall back to the regional average.",
  },
  HT: {
    name: "Haiti", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 11800000, adultSharePct: 0.63, sexRatioPctMale: 0.490,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.81, sd: 2.7 }, women: { mean: 63.22, sd: 2.5 } },
      notObeseShare: { men: 0.945, women: 0.835 },
    },
    sourceNote: "Haiti-specific estimate from UN World Population Prospects, NCD-RisC height, and WHO obesity data. IHSI's census has never included a race/ethnicity question; the commonly cited '95% Black' figure is an outside estimate, not an IHSI statistic. Income, marriage, and parenthood rate are not independently sourced -- Haiti's poverty data is too thin and dated to calibrate confidently -- and fall back to the regional average.",
  },
  CU: {
    name: "Cuba", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 11000000, adultSharePct: 0.82, sexRatioPctMale: 0.488,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.027, "20-29": 0.156, "30-39": 0.178, "40-49": 0.153, "50-59": 0.212, "60-69": 0.147, "70-79": 0.085, "80+": 0.042 },
        women: { "18-19": 0.025, "20-29": 0.142, "30-39": 0.160, "40-49": 0.145, "50-59": 0.215, "60-69": 0.157, "70-79": 0.099, "80+": 0.057 },
      },
      raceShare: { any: 1, white: 0.641, black: 0.093 },
      height: { men: { mean: 68.33, sd: 2.7 }, women: { mean: 63.04, sd: 2.5 } },
      notObeseShare: { men: 0.803, women: 0.738 },
    },
    sourceNote: "Cuba-specific estimate from ONEI Censo 2012 ('color de la piel,' a long-running Cuban census category), UN World Population Prospects, NCD-RisC height, and WHO obesity data. Cuba's age structure is notably older than other Latin American countries in this dataset, from its 1960s-70s baby boom now aging (median age 42). Income is omitted: Cuba's dual-currency, non-market economy has no comparable World Bank Gini or GNI figure. Parenthood rate and married share fall back to the regional average.",
  },
  BO: {
    name: "Bolivia", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 12400000, adultSharePct: 0.65, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: { any: 1, black: 0.002 },
      height: { men: { mean: 66.18, sd: 2.6 }, women: { mean: 61.26, sd: 2.4 } },
      notObeseShare: { men: 0.766, women: 0.641 },
      income: { men: { median: 4400, sigma: 1.25 }, women: { median: 2900, sigma: 1.3 } },
    },
    sourceNote: "Bolivia-specific estimate from INE Censo 2012 (indígena-originario-campesino/afroboliviano self-identification), UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. raceShare.black (Afroboliviano) is a genuine census category but extremely small (0.16%); the 2012 census dropped the earlier blanco/mestizo categories entirely, so White has no usable figure at all. Parenthood rate and married share fall back to the regional average.",
  },
  DO: {
    name: "Dominican Republic", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 11400000, adultSharePct: 0.68, sexRatioPctMale: 0.491,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, white: 0.187, black: 0.0745 },
      height: { men: { mean: 68.75, sd: 2.7 }, women: { mean: 63.47, sd: 2.5 } },
      notObeseShare: { men: 0.758, women: 0.628 },
      income: { men: { median: 10000, sigma: 1.2 }, women: { median: 6500, sigma: 1.25 } },
    },
    sourceNote: "Dominican Republic-specific estimate from ONE Censo 2022 (population 12+, the first race question in 60 years), UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. Parenthood rate and married share fall back to the regional average.",
  },
  HN: {
    name: "Honduras", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 10800000, adultSharePct: 0.64, sexRatioPctMale: 0.499,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.77, sd: 2.6 }, women: { mean: 61.09, sd: 2.4 } },
      notObeseShare: { men: 0.761, women: 0.607 },
      income: { men: { median: 3000, sigma: 1.32 }, women: { median: 1900, sigma: 1.37 } },
    },
    sourceNote: "Honduras-specific estimate from UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. INE's 2013 census reportedly includes an ethnic self-identification question (white/mestizo/indigenous/Black), but it could only be sourced through a secondary compilation rather than INE's own primary table this round, so raceShare is left as 'any' pending direct verification rather than used unconfirmed. Parenthood rate and married share fall back to the regional average.",
  },
  PY: {
    name: "Paraguay", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 6900000, adultSharePct: 0.66, sexRatioPctMale: 0.496,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.43, sd: 2.7 }, women: { mean: 62.90, sd: 2.5 } },
      notObeseShare: { men: 0.707, women: 0.602 },
      income: { men: { median: 6400, sigma: 1.28 }, women: { median: 4100, sigma: 1.33 } },
    },
    sourceNote: "Paraguay-specific estimate from UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. INE's 2022 census controversially dropped its Afrodescendiente self-identification question entirely, leaving only an indigenous self-ID (2.29%) that doesn't map to White/Black/Asian. Parenthood rate and married share fall back to the regional average.",
  },
  NI: {
    name: "Nicaragua", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 6900000, adultSharePct: 0.66, sexRatioPctMale: 0.484,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.89, sd: 2.6 }, women: { mean: 61.27, sd: 2.4 } },
      notObeseShare: { men: 0.713, women: 0.597 },
      income: { men: { median: 2500, sigma: 1.3 }, women: { median: 1550, sigma: 1.35 } },
    },
    sourceNote: "Nicaragua-specific estimate from UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. The widely-repeated '69% mestizo/17% white/9% black' figures trace to the CIA World Factbook, not to INIDE's own 2005 census, which only breaks out ethnic self-identification within the Caribbean Coast autonomous regions rather than nationally, so no national mapping is used. Parenthood rate and married share fall back to the regional average.",
  },
  SV: {
    name: "El Salvador", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 6300000, adultSharePct: 0.70, sexRatioPctMale: 0.458,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.19, sd: 2.6 }, women: { mean: 61.57, sd: 2.4 } },
      notObeseShare: { men: 0.762, women: 0.612 },
      income: { men: { median: 5100, sigma: 1.22 }, women: { median: 3300, sigma: 1.27 } },
    },
    sourceNote: "El Salvador-specific estimate from UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. DIGESTYC's 2007 census asked only about indigenous self-identification (roughly 0.02-0.23%); the commonly cited '90% mestizo/9% white' figures aren't a confirmed DIGESTYC output, so no mapping is used. The notably low adult male share reflects real, UN-sourced heavy male labor emigration to the US. Parenthood rate and married share fall back to the regional average.",
  },
  CR: {
    name: "Costa Rica", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 5100000, adultSharePct: 0.77, sexRatioPctMale: 0.489,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.0103, asian: 0.0021 },
      height: { men: { mean: 68.52, sd: 2.7 }, women: { mean: 63.14, sd: 2.5 } },
      notObeseShare: { men: 0.744, women: 0.606 },
      income: { men: { median: 14500, sigma: 1.3 }, women: { median: 9500, sigma: 1.35 } },
    },
    sourceNote: "Costa Rica-specific estimate from INEC Censo 2011 (self-identification: negro/mulato/chino/indígena/blanco-o-mestizo), UN World Population Prospects, NCD-RisC height, WHO obesity data, and World Bank Gini/GNI. raceShare.black uses only 'Negro' (1.03%), not 'Mulato' (6.72%, a mixed category); raceShare.asian uses 'Chino' (0.21%), a rare directly-usable Asian census category for this region. White has no usable figure: INEC's question combines blanco and mestizo into one inseparable category. Parenthood rate and married share fall back to the regional average.",
  },
  PA: {
    name: "Panama", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 4500000, adultSharePct: 0.70, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, white: 0.067, black: 0.092 },
      height: { men: { mean: 67.00, sd: 2.6 }, women: { mean: 62.28, sd: 2.4 } },
      notObeseShare: { men: 0.697, women: 0.550 },
      income: { men: { median: 18000, sigma: 1.38 }, women: { median: 11500, sigma: 1.42 } },
    },
    sourceNote: "Panama-specific estimate from INEC Censo 2010 (self-identification: white/black/mulatto/indigenous/mestizo), UN World Population Prospects, NCD-RisC height, WHO obesity data (highest in this batch), and World Bank Gini/GNI. Panama's 2023 census revised Black self-identification sharply upward (30.6%, using a broadened question), but no matching updated White/mestizo breakdown was found, so this uses the internally-consistent 2010 pairing rather than mixing figures across census years. Parenthood rate and married share fall back to the regional average.",
  },
  UY: {
    name: "Uruguay", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 3382537, adultSharePct: 0.78, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: { any: 1, white: 0.88, black: 0.106, asian: 0.007 },
      height: { men: { mean: 66.9, sd: 2.7 }, women: { mean: 62.2, sd: 2.5 } },
      notObeseShare: { men: 0.676, women: 0.601 },
    },
    sourceNote: "Uruguay-specific estimate from INE's 2023 census ethnic-racial ancestry question (self-affirmed, non-exclusive categories, so shares don't sum to 100%), WHO obesity data, and UN population data. This is a genuine, rare case where a Latin American census uses 'Asian' as its own aggregate label (like the UK's), rather than a specific-nationality label that shouldn't be mapped. Uruguay is notably older than the rest of the region (median age 37.7), hence a different age archetype. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  JM: {
    name: "Jamaica", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 2833403, adultSharePct: 0.78, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.921, white: 0.002 },
      height: { men: { mean: 67.6, sd: 2.7 }, women: { mean: 63.3, sd: 2.5 } },
      notObeseShare: { men: 0.802, women: 0.490 },
    },
    sourceNote: "Jamaica-specific estimate from STATIN's 2011 census (a literal 'Black' category, 92.1%), WHO obesity data, and UN population data. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  TT: {
    name: "Trinidad and Tobago", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 1513268, adultSharePct: 0.79, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.342 },
      height: { men: { mean: 68.2, sd: 2.7 }, women: { mean: 63.2, sd: 2.5 } },
      notObeseShare: { men: 0.746, women: 0.618 },
    },
    sourceNote: "Trinidad and Tobago-specific estimate from the Central Statistical Office's 2011 census (African descent), WHO obesity data, and UN population data. The census's other large category, 'East Indian' (35.4%), is a specific-nationality label rather than an aggregate 'Asian' category the CSO itself uses -- following the same reasoning this site already applies to Singapore's Chinese/Malay/Indian breakdown, it isn't mapped. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  GY: {
    name: "Guyana", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 840890, adultSharePct: 0.66, sexRatioPctMale: 0.4865,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, black: 0.292 },
      notObeseShare: { men: 0.815, women: 0.600 },
    },
    sourceNote: "Guyana-specific estimate from the Bureau of Statistics 2012 census (African descent), WHO obesity data, and UN population data. 'East Indian' (39.9%), the census's largest category, is a specific-nationality label, not mapped, for the same reason as Trinidad's. Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  SR: {
    name: "Suriname", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 645256, adultSharePct: 0.70, sexRatioPctMale: 0.4992,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, black: 0.374 },
      notObeseShare: { men: 0.796, women: 0.591 },
    },
    sourceNote: "Suriname-specific estimate from the General Bureau of Statistics 2012 census, WHO obesity data, and UN population data. raceShare.black sums the census's Maroon (21.7%, descendants of self-liberated enslaved Africans) and Creole (15.7%, urban Afro-Surinamese) categories -- the underlying percentages are exact, but grouping them together is this site's own interpretive call, not a literal single census category. Hindustani and Javanese (~41% combined) are specific-nationality labels and are intentionally not mapped to Asian. Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  BZ: { name: "Belize", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 410000 },
  BS: {
    name: "Bahamas", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 404628, adultSharePct: 0.79, sexRatioPctMale: 0.4768,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.906, white: 0.047 },
      notObeseShare: { men: 0.607, women: 0.436 },
    },
    sourceNote: "Bahamas-specific estimate from the Department of Statistics 2010 census (corroborated via a contemporaneous press report quoting the census directly, not independently re-verified against the primary release), WHO obesity data (the highest in this batch), and UN population data. Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  BB: {
    name: "Barbados", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 282724, adultSharePct: 0.79, sexRatioPctMale: 0.4796,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: { any: 1, black: 0.924, white: 0.027 },
      notObeseShare: { men: 0.720, women: 0.500 },
    },
    sourceNote: "Barbados-specific estimate from the Barbados Statistical Service 2010 census, WHO obesity data, and UN population data. Barbados has the oldest population structure in this batch (median age 40.7). Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  LC: {
    name: "Saint Lucia", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 180488, adultSharePct: 0.79, sexRatioPctMale: 0.4928,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.853, white: 0.006 },
      notObeseShare: { men: 0.784, women: 0.514 },
    },
    sourceNote: "Saint Lucia-specific estimate from the Statistics Department 2010 census, WHO obesity data, and UN population data. Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  GD: {
    name: "Grenada", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 117362, adultSharePct: 0.77, sexRatioPctMale: 0.5007,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.824 },
      notObeseShare: { men: 0.804, women: 0.559 },
    },
    sourceNote: "Grenada-specific estimate from the CSO's 2011 census (African descent, corroborated across multiple independent secondary sources citing the same report), WHO obesity data, and UN population data. No confirmed White share was found. Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  VC: { name: "Saint Vincent and the Grenadines", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 104000 },
  AG: { name: "Antigua and Barbuda", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 94626 },
  DM: { name: "Dominica", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "regional", totalPopulation: 65511 },
  KN: {
    name: "Saint Kitts and Nevis", continent: "Latin America & Caribbean", regionKey: "LATIN_AMERICA", tier: "full",
    totalPopulation: 46992, adultSharePct: 0.78, sexRatioPctMale: 0.4775,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: { any: 1, black: 0.880, white: 0.031 },
      notObeseShare: { men: 0.619, women: 0.433 },
    },
    sourceNote: "Saint Kitts and Nevis-specific estimate from the Department of Statistics' 2021-2022 census (via CARICOM Statistics, the freshest census in this batch), WHO obesity data, and UN population data. Height, income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },

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
  MT: {
    name: "Malta", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 545000, adultSharePct: 0.825, sexRatioPctMale: 0.501,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.7, sd: 2.7 }, women: { mean: 65.1, sd: 2.5 } },
      notObeseShare: { men: 0.667, women: 0.667 },
      income: { men: { median: 34750, sigma: 0.95 }, women: { median: 34750, sigma: 0.95 } },
    },
    sourceNote: "Malta-specific estimate from NSO Malta/Eurostat population data, WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes (no sex-disaggregated source found), disclosed as a placeholder rather than a true split. Malta's own census doesn't collect race/ethnicity. Marriage and parenthood rate fall back to the regional average.",
  },
  CY: {
    name: "Cyprus", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 1370000, adultSharePct: 0.806, sexRatioPctMale: 0.509,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.0, sd: 2.7 }, women: { mean: 63.0, sd: 2.5 } },
      notObeseShare: { men: 0.763, women: 0.763 },
      income: { men: { median: 33070, sigma: 0.95 }, women: { median: 33070, sigma: 0.95 } },
    },
    sourceNote: "Cyprus-specific estimate from UN population data, WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes (no sex-disaggregated source found). Cystat's own census (which counts only the government-controlled area) doesn't collect race/ethnicity -- the Greek/Turkish Cypriot division is territorial-political, not a census variable. Marriage and parenthood rate fall back to the regional average.",
  },
  SI: {
    name: "Slovenia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 2117000, adultSharePct: 0.825, sexRatioPctMale: 0.496,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 71.3, sd: 2.8 }, women: { mean: 65.7, sd: 2.6 } },
      notObeseShare: { men: 0.772, women: 0.772 },
      income: { men: { median: 30860, sigma: 0.90 }, women: { median: 30860, sigma: 0.90 } },
    },
    sourceNote: "Slovenia-specific estimate from SURS Slovenia/Eurostat population data, WHO obesity data, and World Bank GNI per capita (income spread set tight, reflecting Slovenia's status as one of the EU's most equal economies). Obesity and income are population-wide figures applied to both sexes. SURS doesn't collect race/ethnicity data. Marriage and parenthood rate fall back to the regional average.",
  },
  HR: {
    name: "Croatia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 3848000, adultSharePct: 0.826, sexRatioPctMale: 0.475,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 71.2, sd: 2.8 }, women: { mean: 65.7, sd: 2.6 } },
      notObeseShare: { men: 0.635, women: 0.635 },
      income: { men: { median: 20590, sigma: 1.0 }, women: { median: 20590, sigma: 1.0 } },
      marriedShare: { men: 0.493, women: 0.493 },
    },
    sourceNote: "Croatia-specific estimate from DZS Croatia's 2021 census, WHO obesity data, and World Bank GNI per capita. Obesity, income, and marriage rate (49.3% of population 15+ 'in a marriage', DZS 2021) are population-wide figures applied to both sexes rather than a true split. DZS doesn't collect race/ethnicity. Parenthood rate falls back to the regional average.",
  },
  BA: {
    name: "Bosnia and Herzegovina", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 3164000, adultSharePct: 0.836, sexRatioPctMale: 0.481,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 71.9, sd: 2.8 }, women: { mean: 65.7, sd: 2.6 } },
      notObeseShare: { men: 0.739, women: 0.739 },
      income: { men: { median: 8280, sigma: 1.15 }, women: { median: 8280, sigma: 1.15 } },
    },
    sourceNote: "Bosnia and Herzegovina-specific estimate from a current World Bank/BHAS population figure (meaningfully lower than older 2013-census-based figures, reflecting ongoing emigration), WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes. Bosnia is genuinely one of the tallest measured populations in the world (Dinaric-region effect). BHAS's real ethnic-group data (Bosniak/Serb/Croat) is nationality, not race, so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  RS: {
    name: "Serbia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 6647000, adultSharePct: 0.823, sexRatioPctMale: 0.482,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 71.1, sd: 2.8 }, women: { mean: 66.1, sd: 2.6 } },
      notObeseShare: { men: 0.744, women: 0.744 },
      income: { men: { median: 9500, sigma: 1.1 }, women: { median: 9500, sigma: 1.1 } },
    },
    sourceNote: "Serbia-specific estimate from RZS (Statistical Office of the Republic of Serbia) 2022 census population data, WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes. RZS's real ethnic-group data is nationality, not race, so raceShare stays 'any'. Marriage rate isn't independently sourced by sex (RZS's published breakdown didn't separate married-by-sex cleanly enough to use without guessing) and falls back to the regional average, along with parenthood rate.",
  },
  ME: {
    name: "Montenegro", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 633000, adultSharePct: 0.780, sexRatioPctMale: 0.486,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 72.2, sd: 2.8 }, women: { mean: 66.9, sd: 2.6 } },
      notObeseShare: { men: 0.794, women: 0.794 },
      income: { men: { median: 11590, sigma: 1.15 }, women: { median: 11590, sigma: 1.15 } },
    },
    sourceNote: "Montenegro-specific estimate from Monstat/Eurostat population data, WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes. Montenegro has the tallest measured population found across this whole research project, consistent with the Dinaric-Alps tall-stature region. Monstat doesn't collect race/ethnicity. Marriage and parenthood rate fall back to the regional average.",
  },
  MK: {
    name: "North Macedonia", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 1814000, adultSharePct: 0.797, sexRatioPctMale: 0.493,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 69.4, sd: 2.7 }, women: { mean: 63.3, sd: 2.5 } },
      notObeseShare: { men: 0.688, women: 0.688 },
      income: { men: { median: 9439, sigma: 1.15 }, women: { median: 9439, sigma: 1.15 } },
    },
    sourceNote: "North Macedonia-specific estimate from the State Statistical Office's population data, WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes. The State Statistical Office publishes Macedonian/Albanian/Turkish/Roma/Serb ethnicity, not race. Marriage and parenthood rate fall back to the regional average.",
  },
  AL: {
    name: "Albania", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "full",
    totalPopulation: 2402000, adultSharePct: 0.778, sexRatioPctMale: 0.486,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.5, sd: 2.7 }, women: { mean: 63.7, sd: 2.5 } },
      notObeseShare: { men: 0.727, women: 0.727 },
      income: { men: { median: 7680, sigma: 1.15 }, women: { median: 7680, sigma: 1.15 } },
    },
    sourceNote: "Albania-specific estimate from INSTAT's 2023 census (a ~15% decline from the 2011 census due to heavy emigration -- used the current figure), WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes. INSTAT doesn't publish race/ethnicity. Marriage and parenthood rate fall back to the regional average.",
  },
  XK: { name: "Kosovo", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 1586000, adultSharePct: 0.740, sexRatioPctMale: 0.492 },
  AD: { name: "Andorra", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 81000 },
  SM: { name: "San Marino", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 34000 },
  VA: { name: "Vatican City", continent: "Europe", regionKey: "SOUTHERN_EUROPE", tier: "regional", totalPopulation: 800 },
  BG: {
    name: "Bulgaria", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 6520000, adultSharePct: 0.827, sexRatioPctMale: 0.482,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 68.6, sd: 2.7 }, women: { mean: 64.6, sd: 2.5 } },
      notObeseShare: { men: 0.760, women: 0.760 },
      income: { men: { median: 14280, sigma: 1.28 }, women: { median: 14280, sigma: 1.28 } },
    },
    sourceNote: "Bulgaria-specific estimate from NSI Bulgaria's 2021 census, WHO obesity data, and World Bank GNI per capita (wide income spread reflects Bulgaria's Gini of 38.4, the highest in the EU). Obesity and income are population-wide figures applied to both sexes. NSI doesn't collect race/ethnicity. Marriage and parenthood rate fall back to the regional average.",
  },
  HU: {
    name: "Hungary", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 9632000, adultSharePct: 0.823, sexRatioPctMale: 0.469,
    stats: {
      ageDistribution: AGE_VERY_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.5, sd: 2.8 }, women: { mean: 63.8, sd: 2.6 } },
      notObeseShare: { men: 0.631, women: 0.631 },
      income: { men: { median: 20690, sigma: 1.0 }, women: { median: 20690, sigma: 1.0 } },
    },
    sourceNote: "Hungary-specific estimate from HCSO Hungary's population data, WHO obesity data, and World Bank GNI per capita. Hungary's adult population is notably female-skewed due to a large male-female life-expectancy gap. Obesity and income are population-wide figures applied to both sexes. HCSO doesn't collect race/ethnicity. Marriage and parenthood rate fall back to the regional average.",
  },
  SK: {
    name: "Slovakia", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 5475000, adultSharePct: 0.819, sexRatioPctMale: 0.479,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 71.3, sd: 2.8 }, women: { mean: 65.7, sd: 2.6 } },
      notObeseShare: { men: 0.697, women: 0.697 },
      income: { men: { median: 22790, sigma: 0.90 }, women: { median: 22790, sigma: 0.90 } },
    },
    sourceNote: "Slovakia-specific estimate from the Statistical Office of the Slovak Republic's population data, WHO obesity data, and World Bank GNI per capita (income spread set tight, reflecting Slovakia's Gini of 23.8, on par with Nordic norms). Obesity and income are population-wide figures applied to both sexes. The Statistical Office doesn't collect race/ethnicity. Marriage and parenthood rate fall back to the regional average.",
  },
  MD: {
    name: "Moldova", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 2401000, adultSharePct: 0.783, sexRatioPctMale: 0.475,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.1, sd: 2.7 }, women: { mean: 63.7, sd: 2.5 } },
      notObeseShare: { men: 0.730, women: 0.730 },
      income: { men: { median: 6200, sigma: 1.15 }, women: { median: 6200, sigma: 1.15 } },
    },
    sourceNote: "Moldova-specific estimate from the National Bureau of Statistics' 2024 census (resident population excluding Transnistria, a ~14% decline from 2014 reflecting major emigration), WHO obesity data, and World Bank GNI per capita. Obesity and income are population-wide figures applied to both sexes. NBS publishes ethnicity (Moldovan/Romanian, Ukrainian, Russian, Gagauz), not race. Marriage and parenthood rate fall back to the regional average.",
  },
  BY: {
    name: "Belarus", continent: "Europe", regionKey: "EASTERN_EUROPE", tier: "full",
    totalPopulation: 9100000, adultSharePct: 0.810, sexRatioPctMale: 0.454,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 69.3, sd: 2.8 }, women: { mean: 64.8, sd: 2.6 } },
      notObeseShare: { men: 0.739, women: 0.739 },
      income: { men: { median: 8460, sigma: 1.0 }, women: { median: 8460, sigma: 1.0 } },
    },
    sourceNote: "Belarus-specific estimate from Belstat population data, a 2016-17 national measured survey (height), WHO obesity data, and an approximate World Bank GNI per capita figure (no reliable recent Gini found, so this is the weakest-sourced income figure in this batch). Belarus has the most female-skewed adult population found in this research, from an unusually large male-female life-expectancy gap. Obesity and income are population-wide figures applied to both sexes. Belstat publishes ethnicity, not race. Marriage and parenthood rate fall back to the regional average.",
  },
  GE: {
    name: "Georgia", continent: "Europe", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 3700000, adultSharePct: 0.82, sexRatioPctMale: 0.46,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 67.7, sd: 2.7 }, women: { mean: 63.0, sd: 2.5 } },
      notObeseShare: { men: 0.85, women: 0.72 },
      income: { men: { median: 27000, sigma: 1.15 }, women: { median: 17500, sigma: 1.2 } },
      marriedShare: { men: 0.52, women: 0.50 },
    },
    sourceNote: "Georgia-specific estimate from Geostat population data, a national obesity report, and World Bank GNI per capita PPP. Height and Gini-based income spread are regional-range estimates rather than independently re-verified figures; parenthood rate falls back to the Central Asia & Caucasus regional average.",
  },
  AM: {
    name: "Armenia", continent: "Europe", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 2960000, adultSharePct: 0.80, sexRatioPctMale: 0.465,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 66.9, sd: 2.6 }, women: { mean: 63.0, sd: 2.4 } },
      notObeseShare: { men: 0.86, women: 0.75 },
      income: { men: { median: 26000, sigma: 1.15 }, women: { median: 16500, sigma: 1.2 } },
      marriedShare: { men: 0.56, women: 0.54 },
    },
    sourceNote: "Armenia-specific estimate from the 2022 census, a national obesity survey, and World Bank GNI per capita PPP. Height and Gini-based income spread are regional-range estimates; parenthood rate falls back to the Central Asia & Caucasus regional average.",
  },

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
  IQ: {
    name: "Iraq", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 47000000, adultSharePct: 0.572, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.075, "20-29": 0.317, "30-39": 0.239, "40-49": 0.171, "50-59": 0.115, "60-69": 0.052, "70-79": 0.024, "80+": 0.006 },
        women: { "18-19": 0.070, "20-29": 0.298, "30-39": 0.230, "40-49": 0.170, "50-59": 0.122, "60-69": 0.065, "70-79": 0.034, "80+": 0.010 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 67.4, sd: 2.7 }, women: { mean: 62.0, sd: 2.5 } },
      notObeseShare: { men: 0.693, women: 0.533 },
      income: { men: { median: 4750, sigma: 0.54 }, women: { median: 4750, sigma: 0.54 } },
    },
    sourceNote: "Iraq-specific estimate from UN World Population Prospects, WHO STEPS (height) and obesity data, and World Bank GNI/Gini (converted to a lognormal income model -- no sex-disaggregated income survey was found, so men's and women's figures are identical placeholders). Iraq's first census in nearly 40 years (2024) deliberately excluded ethnicity as the political compromise that let it happen at all, so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  YE: {
    name: "Yemen", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 41800000, adultSharePct: 0.527, sexRatioPctMale: 0.502,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.080, "20-29": 0.328, "30-39": 0.265, "40-49": 0.167, "50-59": 0.092, "60-69": 0.045, "70-79": 0.019, "80+": 0.005 },
        women: { "18-19": 0.077, "20-29": 0.320, "30-39": 0.261, "40-49": 0.164, "50-59": 0.094, "60-69": 0.051, "70-79": 0.025, "80+": 0.008 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 64.7, sd: 2.7 }, women: { mean: 60.9, sd: 2.5 } },
      notObeseShare: { men: 0.904, women: 0.845 },
    },
    sourceNote: "Yemen-specific estimate from UN World Population Prospects, NCD-RisC height, and WHO obesity data. Income is deliberately omitted: the last published World Bank Gini and GNI figures predate the 2015 war and a decade of currency collapse across two competing currency zones, making any current figure fictional. No race/ethnicity variable exists in Yemen's statistics. Marriage and parenthood rate fall back to the regional average.",
  },
  SD: {
    name: "Sudan", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 51700000, adultSharePct: 0.531, sexRatioPctMale: 0.487,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.084, "20-29": 0.345, "30-39": 0.230, "40-49": 0.141, "50-59": 0.098, "60-69": 0.066, "70-79": 0.030, "80+": 0.007 },
        women: { "18-19": 0.078, "20-29": 0.326, "30-39": 0.232, "40-49": 0.158, "50-59": 0.109, "60-69": 0.066, "70-79": 0.025, "80+": 0.007 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 67.4, sd: 2.7 }, women: { mean: 63.1, sd: 2.5 } },
      notObeseShare: { men: 0.893, women: 0.782 },
    },
    sourceNote: "Sudan-specific estimate from UN World Population Prospects (a modeled projection -- Sudan has had no field census update since the civil war began in April 2023, and the war's mass displacement may not be fully captured), WHO STEPS height, and WHO obesity data (both pre-dating the current war). Income omitted: last Gini and GNI figures are from 2014, not representative of current conditions. Sudan's 2008 census considered and then explicitly dropped an ethnicity/tribe question as politically destabilizing -- the Arab/African distinction central to outside reporting on Sudan's conflicts is not a category its Central Bureau of Statistics itself publishes with percentages, so raceShare stays 'any' rather than import an outside NGO/journalistic framing. Marriage and parenthood rate fall back to the regional average.",
  },
  DZ: {
    name: "Algeria", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 47400000, adultSharePct: 0.650, sexRatioPctMale: 0.510,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.048, "20-29": 0.196, "30-39": 0.239, "40-49": 0.217, "50-59": 0.151, "60-69": 0.093, "70-79": 0.043, "80+": 0.013 },
        women: { "18-19": 0.048, "20-29": 0.195, "30-39": 0.235, "40-49": 0.213, "50-59": 0.150, "60-69": 0.094, "70-79": 0.048, "80+": 0.018 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 66.8, sd: 2.7 }, women: { mean: 62.4, sd: 2.5 } },
      notObeseShare: { men: 0.851, women: 0.689 },
      income: { men: { median: 4370, sigma: 0.50 }, women: { median: 4370, sigma: 0.50 } },
    },
    sourceNote: "Algeria-specific estimate from UN World Population Prospects, WHO STEPS (height, 2005, dated) and obesity data, and World Bank GNI/Gini converted to a lognormal income model (no sex-disaggregated income data found). Algeria's census collects nationality and, in some rounds, Amazigh/Berber language use -- a linguistic variable, not race, so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  MA: {
    name: "Morocco", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 38400000, adultSharePct: 0.693, sexRatioPctMale: 0.501,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.049, "20-29": 0.224, "30-39": 0.222, "40-49": 0.189, "50-59": 0.145, "60-69": 0.108, "70-79": 0.050, "80+": 0.012 },
        women: { "18-19": 0.047, "20-29": 0.214, "30-39": 0.215, "40-49": 0.190, "50-59": 0.148, "60-69": 0.111, "70-79": 0.056, "80+": 0.019 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 67.6, sd: 2.7 }, women: { mean: 62.7, sd: 2.5 } },
      notObeseShare: { men: 0.872, women: 0.712 },
      income: { men: { median: 2880, sigma: 0.73 }, women: { median: 2880, sigma: 0.73 } },
    },
    sourceNote: "Morocco-specific estimate from UN World Population Prospects, WHO STEPS (height) and obesity data, and World Bank GNI/Gini converted to a lognormal income model (no sex-disaggregated income data found). Morocco's HCP census asks about Amazigh/Berber language use, a linguistic-cultural variable, not race, so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  SY: {
    name: "Syria", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 25600000, adultSharePct: 0.637, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.077, "20-29": 0.340, "30-39": 0.202, "40-49": 0.161, "50-59": 0.115, "60-69": 0.068, "70-79": 0.031, "80+": 0.008 },
        women: { "18-19": 0.072, "20-29": 0.323, "30-39": 0.192, "40-49": 0.164, "50-59": 0.123, "60-69": 0.077, "70-79": 0.037, "80+": 0.012 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 67.6, sd: 2.7 }, women: { mean: 62.8, sd: 2.5 } },
      notObeseShare: { men: 0.753, women: 0.604 },
    },
    sourceNote: "Syria-specific estimate from UN World Population Prospects (a modeled projection across 13+ years of civil war, mass refugee outflow, and a December 2024 change of government -- treat with real skepticism), NCD-RisC height, and WHO obesity data. Income omitted: the last Gini predates the war entirely and GNI figures long predate the government's fall -- no current figure is defensible. No race/ethnicity variable exists in Syria's statistics. Marriage and parenthood rate fall back to the regional average.",
  },
  TN: {
    name: "Tunisia", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 12400000, adultSharePct: 0.716, sexRatioPctMale: 0.486,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.043, "20-29": 0.195, "30-39": 0.216, "40-49": 0.196, "50-59": 0.159, "60-69": 0.122, "70-79": 0.055, "80+": 0.015 },
        women: { "18-19": 0.038, "20-29": 0.179, "30-39": 0.214, "40-49": 0.200, "50-59": 0.159, "60-69": 0.123, "70-79": 0.063, "80+": 0.024 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 69.6, sd: 2.7 }, women: { mean: 63.7, sd: 2.5 } },
      notObeseShare: { men: 0.819, women: 0.676 },
      income: { men: { median: 3210, sigma: 0.60 }, women: { median: 3210, sigma: 0.60 } },
    },
    sourceNote: "Tunisia-specific estimate from UN World Population Prospects, NCD-RisC height (no WHO STEPS height survey found; Tunisian men rank unusually tall in this dataset, worth a future sanity-check against a national anthropometric study), WHO obesity data, and World Bank GNI/Gini converted to a lognormal income model. Tunisia's census collects nationality only, so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  JO: {
    name: "Jordan", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 11500000, adultSharePct: 0.634, sexRatioPctMale: 0.520,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.060, "20-29": 0.265, "30-39": 0.245, "40-49": 0.182, "50-59": 0.138, "60-69": 0.073, "70-79": 0.030, "80+": 0.008 },
        women: { "18-19": 0.065, "20-29": 0.275, "30-39": 0.232, "40-49": 0.178, "50-59": 0.131, "60-69": 0.075, "70-79": 0.033, "80+": 0.013 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 68.1, sd: 2.7 }, women: { mean: 62.6, sd: 2.5 } },
      notObeseShare: { men: 0.704, women: 0.577 },
      income: { men: { median: 3650, sigma: 0.62 }, women: { median: 3650, sigma: 0.62 } },
    },
    sourceNote: "Jordan-specific estimate from UN World Population Prospects, WHO STEPS (height) and obesity data, and World Bank GNI/Gini converted to a lognormal income model (no sex-disaggregated income data found). Jordan's census collects nationality and refugee/origin status, not race, so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  LY: {
    name: "Libya", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 7500000, adultSharePct: 0.671, sexRatioPctMale: 0.506,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.056, "20-29": 0.236, "30-39": 0.216, "40-49": 0.223, "50-59": 0.157, "60-69": 0.073, "70-79": 0.030, "80+": 0.011 },
        women: { "18-19": 0.054, "20-29": 0.230, "30-39": 0.210, "40-49": 0.217, "50-59": 0.159, "60-69": 0.078, "70-79": 0.038, "80+": 0.014 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 69.4, sd: 2.7 }, women: { mean: 64.0, sd: 2.5 } },
      notObeseShare: { men: 0.749, women: 0.582 },
    },
    sourceNote: "Libya-specific estimate from UN World Population Prospects (Libya has had no real census since 2006, treat as a rough model), NCD-RisC height, and WHO obesity data. Income omitted: no World Bank Gini exists for Libya, and GNI figures swing wildly with oil-export disruption under two competing governments. No race/ethnicity variable exists in Libya's statistics. Marriage and parenthood rate fall back to the regional average.",
  },
  LB: {
    name: "Lebanon", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 5900000, adultSharePct: 0.684, sexRatioPctMale: 0.474,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.058, "20-29": 0.244, "30-39": 0.172, "40-49": 0.167, "50-59": 0.158, "60-69": 0.117, "70-79": 0.066, "80+": 0.020 },
        women: { "18-19": 0.048, "20-29": 0.208, "30-39": 0.184, "40-49": 0.172, "50-59": 0.162, "60-69": 0.123, "70-79": 0.068, "80+": 0.034 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 68.5, sd: 2.7 }, women: { mean: 63.9, sd: 2.5 } },
      notObeseShare: { men: 0.711, women: 0.689 },
    },
    sourceNote: "Lebanon-specific estimate from UN World Population Prospects (its population figure includes a very large Syrian refugee presence), WHO STEPS height, and WHO obesity data. Income omitted: Lebanon's currency lost over 95% of its value in the 2019-2023 financial collapse, making any pre-crisis Gini or GNI figure unrepresentative of the current multi-currency, largely informal economy. Lebanon hasn't held an official census since 1932 -- precisely because that census enumerated religious sect and the results are frozen into its constitutional power-sharing formula -- so raceShare stays 'any'. Marriage and parenthood rate fall back to the regional average.",
  },
  PS: { name: "Palestine", continent: "Middle East & North Africa", regionKey: "MENA", tier: "regional", totalPopulation: 5600000, adultSharePct: 0.558, sexRatioPctMale: 0.487 },
  OM: {
    name: "Oman", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 5500000, adultSharePct: 0.719, sexRatioPctMale: 0.666,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.024, "20-29": 0.259, "30-39": 0.363, "40-49": 0.221, "50-59": 0.087, "60-69": 0.030, "70-79": 0.012, "80+": 0.004 },
        women: { "18-19": 0.046, "20-29": 0.254, "30-39": 0.313, "40-49": 0.211, "50-59": 0.090, "60-69": 0.051, "70-79": 0.025, "80+": 0.011 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 65.9, sd: 2.7 }, women: { mean: 61.5, sd: 2.5 } },
      notObeseShare: { men: 0.750, women: 0.615 },
    },
    sourceNote: "Oman-specific estimate from UN World Population Prospects, WHO STEPS height, and WHO obesity data. The migrant-labor population skew is real and large -- adult male share is 66.6%, with the 30-39 age bracket alone making up 36% of adult men. Income is deliberately omitted: Oman's GNI per capita conflates a comparatively well-off citizen population with a much larger lower-wage South/Southeast Asian migrant-labor population, and no data exists to split them credibly. No race/ethnicity variable exists in Oman's statistics. Marriage and parenthood rate fall back to the regional average.",
  },
  KW: {
    name: "Kuwait", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 5000000, adultSharePct: 0.783, sexRatioPctMale: 0.639,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.024, "20-29": 0.165, "30-39": 0.304, "40-49": 0.284, "50-59": 0.155, "60-69": 0.052, "70-79": 0.013, "80+": 0.003 },
        women: { "18-19": 0.040, "20-29": 0.187, "30-39": 0.284, "40-49": 0.258, "50-59": 0.144, "60-69": 0.059, "70-79": 0.022, "80+": 0.007 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 67.7, sd: 2.7 }, women: { mean: 62.4, sd: 2.5 } },
      notObeseShare: { men: 0.635, women: 0.530 },
    },
    sourceNote: "Kuwait-specific estimate from UN World Population Prospects, WHO STEPS height, and WHO obesity data (Kuwait has among the highest obesity rates in the world). The migrant-labor population skew is large -- adult male share 63.9%, driven by the 30-49 bracket. Income is deliberately omitted: no World Bank Gini exists for Kuwait, and its oil-revenue-dominated GNI per capita isn't a usable proxy for either citizen or expatriate individual income. No race/ethnicity variable exists in Kuwait's statistics. Marriage and parenthood rate fall back to the regional average.",
  },
  QA: {
    name: "Qatar", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 3100000, adultSharePct: 0.826, sexRatioPctMale: 0.755,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.014, "20-29": 0.203, "30-39": 0.392, "40-49": 0.253, "50-59": 0.103, "60-69": 0.030, "70-79": 0.006, "80+": 0.001 },
        women: { "18-19": 0.036, "20-29": 0.203, "30-39": 0.369, "40-49": 0.235, "50-59": 0.099, "60-69": 0.041, "70-79": 0.014, "80+": 0.004 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 67.4, sd: 2.7 }, women: { mean: 62.1, sd: 2.5 } },
      notObeseShare: { men: 0.618, women: 0.507 },
    },
    sourceNote: "Qatar-specific estimate from UN World Population Prospects, WHO STEPS height (2012, dated), and WHO obesity data (among the highest in the world). Qatar is the most extreme migrant-labor skew in this dataset -- adult male share 75.5%, with the 30-39 bracket alone making up 39% of adult men, consistent with Qatar's well-documented roughly 3-to-1 male sex ratio. Income is deliberately omitted: Qatar's GNI per capita ($79,430) is almost entirely a hydrocarbon-revenue artifact divided across a population that's 85%+ non-citizen labor migrants plus a small wealthy citizen population -- using it as a personal-income median would be actively misleading. No race/ethnicity variable exists in Qatar's statistics. Marriage and parenthood rate fall back to the regional average.",
  },
  BH: {
    name: "Bahrain", continent: "Middle East & North Africa", regionKey: "MENA", tier: "full",
    totalPopulation: 1600000, adultSharePct: 0.780, sexRatioPctMale: 0.651,
    stats: {
      ageDistribution: {
        men:   { "18-19": 0.022, "20-29": 0.193, "30-39": 0.345, "40-49": 0.249, "50-59": 0.120, "60-69": 0.050, "70-79": 0.015, "80+": 0.006 },
        women: { "18-19": 0.039, "20-29": 0.217, "30-39": 0.286, "40-49": 0.217, "50-59": 0.129, "60-69": 0.076, "70-79": 0.025, "80+": 0.011 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 65.0, sd: 2.7 }, women: { mean: 60.7, sd: 2.5 } },
      notObeseShare: { men: 0.695, women: 0.586 },
    },
    sourceNote: "Bahrain-specific estimate from UN World Population Prospects, WHO STEPS height (2002, very dated), and WHO obesity data. The migrant-labor population skew follows the same Gulf pattern, less extreme than Qatar/Kuwait -- adult male share 65.1%. Income is deliberately omitted: no Gini is published, and GNI per capita again blends citizen and large expatriate-labor populations with very different income profiles. No race/ethnicity variable exists in Bahrain's statistics. Marriage and parenthood rate fall back to the regional average.",
  },

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
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, white: 0.073, black: 0.81, asian: 0.026, coloured: 0.088 },
      height: { men: { mean: 66.8, sd: 2.8 }, women: { mean: 62.0, sd: 2.6 } },
      notObeseShare: { men: 0.85, women: 0.60 },
      income: { men: { median: 9000, sigma: 1.2 }, women: { median: 6000, sigma: 1.25 } },
      marriedShare: { men: 0.38, women: 0.32 },
      hasKidsShare: { men: 0.55, women: 0.65 },
    },
    sourceNote: "South Africa-specific estimate from Stats SA, WHO, and World Bank data. Stats SA's official 4-group population classification (including ‘Coloured’) is available in the paid report's Ethnic, Ancestral or Cultural Background filter.",
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
  CD: {
    name: "DR Congo", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 113000000, adultSharePct: 0.48, sexRatioPctMale: 0.496,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.7, sd: 2.7 }, women: { mean: 61.1, sd: 2.5 } },
      notObeseShare: { men: 0.96, women: 0.92 },
      income: { men: { median: 1200, sigma: 1.35 }, women: { median: 700, sigma: 1.4 } },
      marriedShare: { men: 0.67, women: 0.66 },
    },
    sourceNote: "DR Congo-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. Age structure and adult sex ratio are derived from CIA World Factbook age-band percentages, since no census has been conducted since 1984. DRC's own statistics institute does not publish a race/ethnicity variable, only ethnic-group/tribe data. Parenthood rate isn't independently sourced (DHS collects this for women only, not men) and falls back to the regional average.",
  },
  TZ: {
    name: "Tanzania", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 70500000, adultSharePct: 0.51, sexRatioPctMale: 0.496,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.9, sd: 2.7 }, women: { mean: 61.4, sd: 2.5 } },
      notObeseShare: { men: 0.94, women: 0.85 },
      income: { men: { median: 2000, sigma: 1.25 }, women: { median: 1100, sigma: 1.3 } },
      marriedShare: { men: 0.62, women: 0.67 },
    },
    sourceNote: "Tanzania-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. Tanzania's NBS does not publish an official ethnicity or race variable (deliberately, for nation-building reasons since independence). Parenthood rate falls back to the regional average.",
  },
  UG: {
    name: "Uganda", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 51400000, adultSharePct: 0.46, sexRatioPctMale: 0.496,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.2, sd: 2.7 }, women: { mean: 61.7, sd: 2.5 } },
      notObeseShare: { men: 0.96, women: 0.87 },
      income: { men: { median: 1800, sigma: 1.3 }, women: { median: 950, sigma: 1.35 } },
      marriedShare: { men: 0.67, women: 0.63 },
    },
    sourceNote: "Uganda-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. UBOS publishes population by tribe, not race. Parenthood rate falls back to the regional average.",
  },
  MZ: {
    name: "Mozambique", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 35600000, adultSharePct: 0.48, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: { any: 1, black: 0.990, white: 0.001, mestico: 0.008, other: 0.001 },
      height: { men: { mean: 64.9, sd: 2.7 }, women: { mean: 60.6, sd: 2.5 } },
      notObeseShare: { men: 0.95, women: 0.87 },
      income: { men: { median: 950, sigma: 1.35 }, women: { median: 550, sigma: 1.4 } },
      marriedShare: { men: 0.75, women: 0.64 },
    },
    sourceNote: "Mozambique-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data (2017 census). INE Mozambique's 2017 census is one of the few in Sub-Saharan Africa to publish an actual official race/population-group question (African 99.0%, Mestiço 0.8%, White 0.1%, Other 0.1%), continuing a series dating to the Portuguese colonial period. Parenthood rate falls back to the regional average.",
  },
  AO: {
    name: "Angola", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 39000000, adultSharePct: 0.47, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.9, sd: 2.7 }, women: { mean: 61.9, sd: 2.5 } },
      notObeseShare: { men: 0.94, women: 0.83 },
      income: { men: { median: 4300, sigma: 1.4 }, women: { median: 2000, sigma: 1.45 } },
      marriedShare: { men: 0.64, women: 0.59 },
    },
    sourceNote: "Angola-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. Angola's 2014 census did not collect ethnicity or race at all, only home language, so no mapping is available. Angola's wide income spread reflects its Gini coefficient, one of the world's highest, driven by its oil-export economy. Parenthood rate falls back to the regional average.",
  },
  CM: {
    name: "Cameroon", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 29900000, adultSharePct: 0.52, sexRatioPctMale: 0.498,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.1, sd: 2.7 }, women: { mean: 62.5, sd: 2.5 } },
      notObeseShare: { men: 0.91, women: 0.79 },
      income: { men: { median: 3000, sigma: 1.3 }, women: { median: 1600, sigma: 1.35 } },
      marriedShare: { men: 0.55, women: 0.63 },
    },
    sourceNote: "Cameroon-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. INS Cameroon's census publishes 250+ ethnic groups, not a race variable. Parenthood rate falls back to the regional average.",
  },
  CI: {
    name: "Côte d'Ivoire", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 32700000, adultSharePct: 0.54, sexRatioPctMale: 0.509,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.6, sd: 2.7 }, women: { mean: 62.2, sd: 2.5 } },
      notObeseShare: { men: 0.92, women: 0.84 },
      income: { men: { median: 4300, sigma: 1.15 }, women: { median: 2400, sigma: 1.2 } },
      marriedShare: { men: 0.49, women: 0.65 },
    },
    sourceNote: "Côte d'Ivoire-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. Its adult sex ratio skews male, consistent with RGPH 2021's finding that 22% of the resident population is foreign-born labor migrants (mostly working-age men) from neighboring Sahel countries. INS/ANSTAT's census publishes major ethnic groups and nationality, not race. Parenthood rate falls back to the regional average.",
  },
  MG: {
    name: "Madagascar", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 32700000, adultSharePct: 0.55, sexRatioPctMale: 0.502,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 63.6, sd: 2.7 }, women: { mean: 59.5, sd: 2.5 } },
      notObeseShare: { men: 0.96, women: 0.96 },
      income: { men: { median: 950, sigma: 1.2 }, women: { median: 550, sigma: 1.25 } },
      marriedShare: { men: 0.73, women: 0.69 },
    },
    sourceNote: "Madagascar-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. INSTAT's census recognizes 18 official ethnic groups (Merina largest), not a race variable. Parenthood rate falls back to the regional average.",
  },
  NE: {
    name: "Niger", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 27900000, adultSharePct: 0.43, sexRatioPctMale: 0.508,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.0, sd: 2.7 }, women: { mean: 62.3, sd: 2.5 } },
      notObeseShare: { men: 0.96, women: 0.92 },
      income: { men: { median: 1300, sigma: 1.1 }, women: { median: 550, sigma: 1.15 } },
      marriedShare: { men: 0.70, women: 0.88 },
    },
    sourceNote: "Niger-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. Niger has one of the world's youngest population structures, consistent with the UN's highest recorded total fertility rate. INS Niger's census publishes ethnic groups, not race. Parenthood rate falls back to the regional average.",
  },
  BF: {
    name: "Burkina Faso", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 24100000, adultSharePct: 0.50, sexRatioPctMale: 0.498,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.7, sd: 2.7 }, women: { mean: 63.1, sd: 2.5 } },
      notObeseShare: { men: 0.96, women: 0.91 },
      income: { men: { median: 1600, sigma: 1.2 }, women: { median: 850, sigma: 1.25 } },
      marriedShare: { men: 0.72, women: 0.79 },
    },
    sourceNote: "Burkina Faso-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. INSD's census publishes ethnic groups, not race. Parenthood rate falls back to the regional average.",
  },
  ML: {
    name: "Mali", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 25200000, adultSharePct: 0.47, sexRatioPctMale: 0.505,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.4, sd: 2.7 }, women: { mean: 63.2, sd: 2.5 } },
      notObeseShare: { men: 0.92, women: 0.84 },
      income: { men: { median: 1800, sigma: 1.15 }, women: { median: 900, sigma: 1.2 } },
      marriedShare: { men: 0.69, women: 0.83 },
    },
    sourceNote: "Mali-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. INSTAT Mali's census does not publish a race variable; published ethnic-group data isn't a race classification. Parenthood rate falls back to the regional average.",
  },
  MW: {
    name: "Malawi", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 22200000, adultSharePct: 0.48, sexRatioPctMale: 0.488,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 63.9, sd: 2.7 }, women: { mean: 60.8, sd: 2.5 } },
      notObeseShare: { men: 0.97, women: 0.89 },
      income: { men: { median: 950, sigma: 1.25 }, women: { median: 550, sigma: 1.3 } },
      marriedShare: { men: 0.74, women: 0.67 },
    },
    sourceNote: "Malawi-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data (2018 census). NSO Malawi's 2018 census classifies population by tribe (Chewa largest), not race -- despite a small historic European/Asian minority, the census asks no race question. Parenthood rate falls back to the regional average.",
  },
  ZM: {
    name: "Zambia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 21900000, adultSharePct: 0.48, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.6, sd: 2.7 }, women: { mean: 61.3, sd: 2.5 } },
      notObeseShare: { men: 0.95, women: 0.84 },
      income: { men: { median: 1900, sigma: 1.4 }, women: { median: 1000, sigma: 1.45 } },
      marriedShare: { men: 0.67, women: 0.63 },
    },
    sourceNote: "Zambia-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. ZamStats' 2022 census published a dedicated ethnicity/tribe tabulation, not a race variable -- despite a small historic White-Zambian minority, the census doesn't classify by race. Zambia's wide income spread reflects a Gini coefficient among the world's highest. Parenthood rate falls back to the regional average.",
  },
  SO: {
    name: "Somalia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 19700000, adultSharePct: 0.52, sexRatioPctMale: 0.501,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.6, sd: 2.7 }, women: { mean: 61.4, sd: 2.5 } },
      notObeseShare: { men: 0.95, women: 0.78 },
      income: { men: { median: 1000, sigma: 1.3 }, women: { median: 450, sigma: 1.35 } },
    },
    sourceNote: "Somalia-specific estimate from World Bank population/GNI data, and NCD-RisC height and obesity data -- all carry unusual uncertainty since no full census has been completed since 1975. Somalia is about 98% ethnically Somali with no census race variable (clan, not race, is the relevant local category). No reliable current marriage source covering both sexes was found (the available data covers women only), so marriedShare and parenthood rate both fall back to the regional average rather than being asymmetrically populated.",
  },
  SN: {
    name: "Senegal", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 18900000, adultSharePct: 0.54, sexRatioPctMale: 0.509,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.2, sd: 2.7 }, women: { mean: 64.0, sd: 2.5 } },
      notObeseShare: { men: 0.96, women: 0.83 },
      income: { men: { median: 2800, sigma: 1.2 }, women: { median: 1500, sigma: 1.25 } },
      marriedShare: { men: 0.54, women: 0.71 },
    },
    sourceNote: "Senegal-specific estimate from World Bank population/GNI/Gini data, NCD-RisC height and obesity data, and UN DESA World Marriage Data. ANSD's RGPH-5 (2023) publishes population by nationality but does not appear to publish an ethnicity or race breakdown at all. Parenthood rate falls back to the regional average.",
  },
  TD: {
    name: "Chad", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 21003705, adultSharePct: 0.51, sexRatioPctMale: 0.502,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.3, sd: 2.7 }, women: { mean: 63.8, sd: 2.5 } },
      notObeseShare: { men: 0.941, women: 0.943 },
      income: { men: { median: 1600, sigma: 1.10 }, women: { median: 950, sigma: 1.15 } },
      marriedShare: { men: 0.531, women: 0.681 },
    },
    sourceNote: "Chad-specific estimate from World Bank/UN population data, WHO obesity prevalence, World Bank GNI per capita and Gini, and DHS Chad. Parenthood rate falls back to the Sub-Saharan Africa regional average.",
  },
  ZW: {
    name: "Zimbabwe", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 16950795, adultSharePct: 0.56, sexRatioPctMale: 0.477,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.9, sd: 2.7 }, women: { mean: 63.0, sd: 2.5 } },
      notObeseShare: { men: 0.955, women: 0.812 },
      income: { men: { median: 4200, sigma: 1.40 }, women: { median: 2500, sigma: 1.45 } },
      marriedShare: { men: 0.491, women: 0.587 },
    },
    sourceNote: "Zimbabwe-specific estimate from World Bank/UN population data, WHO obesity prevalence, World Bank GNI per capita and Gini (one of the highest in the region), and DHS Zimbabwe. Parenthood rate falls back to the Sub-Saharan Africa regional average.",
  },
  GN: {
    name: "Guinea", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 15099727, adultSharePct: 0.56, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.954, women: 0.881 },
      income: { men: { median: 2800, sigma: 0.95 }, women: { median: 1700, sigma: 1.00 } },
      marriedShare: { men: 0.479, women: 0.688 },
    },
    sourceNote: "Guinea-specific estimate from World Bank/UN population data, WHO obesity prevalence, World Bank GNI per capita and Gini, and DHS Guinea. No reliable current dual-sex height source was found, so that dimension and parenthood rate fall back to the Sub-Saharan Africa regional average.",
  },
  RW: {
    name: "Rwanda", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 14569341, adultSharePct: 0.59, sexRatioPctMale: 0.488,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.5, sd: 2.7 }, women: { mean: 61.3, sd: 2.5 } },
      notObeseShare: { men: 0.986, women: 0.925 },
      income: { men: { median: 1800, sigma: 1.15 }, women: { median: 1100, sigma: 1.20 } },
      marriedShare: { men: 0.306, women: 0.321 },
    },
    sourceNote: "Rwanda-specific estimate from World Bank/UN population data, WHO obesity prevalence, World Bank GNI per capita and Gini, height from a national NCD risk-factor survey, and DHS/MIS Rwanda. NISR does not publish a race/ethnicity breakdown mapping to this site's filter (Hutu/Tutsi/Twa categorization was discontinued from official statistics after the 1990s conflict).",
  },
  BJ: {
    name: "Benin", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 14814460, adultSharePct: 0.55, sexRatioPctMale: 0.502,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.0, sd: 2.7 }, women: { mean: 63.1, sd: 2.5 } },
      notObeseShare: { men: 0.940, women: 0.859 },
      income: { men: { median: 2600, sigma: 1.05 }, women: { median: 1550, sigma: 1.10 } },
      marriedShare: { men: 0.445, women: 0.551 },
    },
    sourceNote: "Benin-specific estimate from World Bank/UN population data, WHO STEPS Benin (obesity), World Bank GNI per capita and Gini, and DHS Benin. Parenthood rate falls back to the Sub-Saharan Africa regional average.",
  },
  BI: {
    name: "Burundi", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 14390003, adultSharePct: 0.53, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.7, sd: 2.7 }, women: { mean: 61.0, sd: 2.5 } },
      notObeseShare: { men: 0.952, women: 0.963 },
      income: { men: { median: 400, sigma: 1.10 }, women: { median: 250, sigma: 1.15 } },
      marriedShare: { men: 0.416, women: 0.418 },
    },
    sourceNote: "Burundi-specific estimate from World Bank/UN population data, WHO obesity prevalence, World Bank GNI per capita (among the lowest in the world) and Gini, and DHS Burundi. Burundi's ISTEEBU does not publish a race/ethnicity breakdown (Hutu/Tutsi/Twa categorization was discontinued from official statistics, and wouldn't map to White/Black/Asian regardless). Parenthood rate falls back to the regional average.",
  },
  TG: {
    name: "Togo", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 8591626, adultSharePct: 0.56, sexRatioPctMale: 0.489,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.6, sd: 2.7 }, women: { mean: 62.7, sd: 2.5 } },
      notObeseShare: { men: 0.950, women: 0.837 },
      income: { men: { median: 2200, sigma: 1.10 }, women: { median: 1300, sigma: 1.15 } },
      marriedShare: { men: 0.407, women: 0.514 },
    },
    sourceNote: "Togo-specific estimate from World Bank/UN population data, WHO STEPS Togo (obesity), World Bank GNI per capita and Gini, and DHS Togo. Parenthood rate falls back to the Sub-Saharan Africa regional average.",
  },
  SL: {
    name: "Sierra Leone", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 8819794, adultSharePct: 0.59, sexRatioPctMale: 0.499,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.4, sd: 2.7 }, women: { mean: 62.2, sd: 2.5 } },
      notObeseShare: { men: 0.975, women: 0.889 },
      income: { men: { median: 1300, sigma: 1.05 }, women: { median: 800, sigma: 1.10 } },
      marriedShare: { men: 0.465, women: 0.585 },
    },
    sourceNote: "Sierra Leone-specific estimate from World Bank/UN population data, a national NCD risk-factor survey (obesity), World Bank GNI per capita and Gini, and DHS Sierra Leone. Statistics Sierra Leone does not publish a race/ethnicity breakdown mapping to this site's filter ('Krio' is an ethnic/heritage category, not race). Parenthood rate falls back to the regional average.",
  },
  CG: {
    name: "Republic of the Congo", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 6484437, adultSharePct: 0.57, sexRatioPctMale: 0.500,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.949, women: 0.837 },
      income: { men: { median: 3600, sigma: 1.35 }, women: { median: 2200, sigma: 1.40 } },
      marriedShare: { men: 0.084, women: 0.107 },
    },
    sourceNote: "Congo-specific estimate from World Bank/UN population data, WHO obesity prevalence, World Bank GNI per capita (oil-driven) and Gini, and DHS Congo. The low marriedShare reflects DHS's narrow legal-marriage definition -- informal cohabitation ('union libre'), the norm in Congo, isn't counted by that measure. No reliable current dual-sex height source was found, so that dimension and parenthood rate fall back to the regional average.",
  },
  LR: {
    name: "Liberia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 5731206, adultSharePct: 0.57, sexRatioPctMale: 0.499,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 63.4, sd: 2.7 }, women: { mean: 60.7, sd: 2.5 } },
      notObeseShare: { men: 0.891, women: 0.817 },
      income: { men: { median: 1300, sigma: 1.05 }, women: { median: 800, sigma: 1.10 } },
      marriedShare: { men: 0.217, women: 0.256 },
    },
    sourceNote: "Liberia-specific estimate from World Bank/UN population data, a national chronic-disease risk-factor survey (obesity), World Bank GNI per capita and Gini, and DHS/MIS Liberia. Liberia Institute of Statistics does not publish a race/ethnicity breakdown mapping to this site's filter ('Americo-Liberian' is an ethnic/heritage category, not race). Parenthood rate falls back to the regional average.",
  },
  CF: { name: "Central African Republic", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 5513282 },
  MR: {
    name: "Mauritania", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 5315065, adultSharePct: 0.54, sexRatioPctMale: 0.491,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.1, sd: 2.7 }, women: { mean: 63.1, sd: 2.5 } },
      notObeseShare: { men: 0.927, women: 0.667 },
      income: { men: { median: 3500, sigma: 1.00 }, women: { median: 2100, sigma: 1.05 } },
      marriedShare: { men: 0.450, women: 0.625 },
    },
    sourceNote: "Mauritania-specific estimate from World Bank/UN population data, WHO STEPS Mauritania (obesity), World Bank GNI per capita and Gini, and DHS Mauritania. Mauritania's own statistics agency (ANSADE) does not publish its well-known Beidane/Haratine/Afro-Mauritanian population split as an official census variable -- including in the most recent 2023 census -- so despite that split being widely discussed by outside observers, it isn't a citable government statistic and raceShare stays 'any' per this site's standing rule against using outside proxies. Parenthood rate falls back to the regional average.",
  },
  ER: { name: "Eritrea", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 3607003 },
  SS: { name: "South Sudan", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "regional", totalPopulation: 12188788 },
  GM: {
    name: "Gambia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 2422712, adultSharePct: 0.56, sexRatioPctMale: 0.49,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.929, women: 0.826 },
      income: { men: { median: 1300, sigma: 1.1 }, women: { median: 830, sigma: 1.15 } },
    },
    sourceNote: "Gambia-specific estimate from the 2024 census (Gambia Bureau of Statistics), WHO obesity data, and World Bank data. The census publishes a real, current ethnic-group table (Mandinka, Fula, Wolof, etc.), but that's tribe, not race, and doesn't differentiate this site's White/Black/Asian filter. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  NA: {
    name: "Namibia", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 3022401, adultSharePct: 0.58, sexRatioPctMale: 0.488,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG,
      raceShare: { any: 1, black: 0.961, white: 0.018, coloured: 0.021 },
      notObeseShare: { men: 0.905, women: 0.711 },
      income: { men: { median: 6400, sigma: 1.35 }, women: { median: 4300, sigma: 1.4 } },
    },
    sourceNote: "Namibia-specific estimate from the Namibia Statistics Agency's 2023 census, WHO obesity data, and World Bank data. NSA's 2023 census is one of the few in Sub-Saharan Africa to publish an official population-group table (African 96.1%, Mixed 2.1%, White 1.8%), a legacy of the same classification system as South Africa's Stats SA -- NSA has publicly acknowledged the White category was applied too coarsely. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  BW: {
    name: "Botswana", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 2359609, adultSharePct: 0.64, sexRatioPctMale: 0.488,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.903, women: 0.679 },
      income: { men: { median: 12500, sigma: 1.3 }, women: { median: 8400, sigma: 1.35 } },
    },
    sourceNote: "Botswana-specific estimate from Statistics Botswana's 2022 census, WHO obesity data, and World Bank data. Statistics Botswana's census deliberately does not collect ethnicity or race, as a matter of nation-building policy. Botswana's unusually high Gini coefficient for its income level is reflected in the elevated income spread. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  GA: {
    name: "Gabon", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 2538952, adultSharePct: 0.61, sexRatioPctMale: 0.507,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.886, women: 0.773 },
      income: { men: { median: 11900, sigma: 1.1 }, women: { median: 7900, sigma: 1.15 } },
    },
    sourceNote: "Gabon-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank data. Gabon's statistics office has not published a full ethnic or race breakdown from its most recent census. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  LS: {
    name: "Lesotho", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 2189000, adultSharePct: 0.63, sexRatioPctMale: 0.49,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.941, women: 0.699 },
      income: { men: { median: 2100, sigma: 1.2 }, women: { median: 1250, sigma: 1.25 } },
    },
    sourceNote: "Lesotho-specific estimate from the Bureau of Statistics census, WHO obesity data, and World Bank data. Lesotho is one of the most ethnically homogeneous countries on Earth (Basotho ~99.7%), so there's no meaningful race/ethnicity variable to publish. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  GW: {
    name: "Guinea-Bissau", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 2201352, adultSharePct: 0.54, sexRatioPctMale: 0.49,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.936, women: 0.837 },
      income: { men: { median: 1600, sigma: 1.3 }, women: { median: 900, sigma: 1.35 } },
    },
    sourceNote: "Guinea-Bissau-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank data. No indication its statistics institute publishes a race or ethnicity census variable. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  GQ: {
    name: "Equatorial Guinea", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 1720000, adultSharePct: 0.59, sexRatioPctMale: 0.527,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.954, women: 0.853 },
      income: { men: { median: 7300, sigma: 1.3 }, women: { median: 4800, sigma: 1.35 } },
    },
    sourceNote: "Equatorial Guinea-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank GNI data. No current official race or ethnicity breakdown is published. The World Bank has no Gini figure on record for Equatorial Guinea at all despite the country's oil-wealth concentration, so income spread uses the regional default rather than an invented figure. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  MU: {
    name: "Mauritius", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 1235260, adultSharePct: 0.76, sexRatioPctMale: 0.499,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      notObeseShare: { men: 0.701, women: 0.584 },
      income: { men: { median: 13800, sigma: 1.05 }, women: { median: 9400, sigma: 1.1 } },
    },
    sourceNote: "Mauritius-specific estimate from the 2022 census (Statistics Mauritius), the 2021 Mauritius Non-Communicable Diseases Survey, and World Bank data. Mauritius hasn't asked a census ethnicity question since 1972; the 'Indo-Mauritian/Creole/Sino-Mauritian/Franco-Mauritian' figures often cited are a frozen 1972 snapshot used only for a constitutional electoral seat-allocation mechanism (itself sorting by religion/community, not race), not a current official breakdown. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  SZ: {
    name: "Eswatini", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 1222075, adultSharePct: 0.63, sexRatioPctMale: 0.491,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.934, women: 0.708 },
      income: { men: { median: 5400, sigma: 1.3 }, women: { median: 3200, sigma: 1.35 } },
    },
    sourceNote: "Eswatini-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank data. Eswatini's population is overwhelmingly one ethnic group (Swazi, ~97%), so there's no meaningful race/ethnicity variable to publish. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  DJ: {
    name: "Djibouti", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 1168722, adultSharePct: 0.67, sexRatioPctMale: 0.454,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.90, women: 0.797 },
      income: { men: { median: 4800, sigma: 1.15 }, women: { median: 2400, sigma: 1.25 } },
    },
    sourceNote: "Djibouti-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank data. No indication Djibouti's statistics office publishes a race/ethnicity census variable. Djibouti's adult sex ratio skews notably toward more women across cited sources, likely reflecting labor-migration and expatriate/military population dynamics -- treat as indicative rather than precise. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  KM: {
    name: "Comoros", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 822000, adultSharePct: 0.59, sexRatioPctMale: 0.503,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.96, women: 0.857 },
      income: { men: { median: 2600, sigma: 1.3 }, women: { median: 1600, sigma: 1.35 } },
    },
    sourceNote: "Comoros-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank GNI data. No official ethnicity/race census variable found. No World Bank Gini figure was found either, so income spread uses the regional default. Height and marriage rate weren't reliably found this pass and fall back to the regional average -- this is one of the thinner upgrades in the batch.",
  },
  CV: {
    name: "Cabo Verde", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 611014, adultSharePct: 0.70, sexRatioPctMale: 0.486,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.915, women: 0.811 },
      income: { men: { median: 5900, sigma: 1.25 }, women: { median: 3900, sigma: 1.3 } },
    },
    sourceNote: "Cabo Verde-specific estimate from UN World Population Prospects, a 2020 WHO STEPS survey, and World Bank data. Cabo Verde's statistics institute last counted race in 1950; the 'Creole/Mulatto/African' figures still cited elsewhere are not current census output. Cabo Verde has a notably high Gini coefficient for its income level, reflected in the elevated income spread. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },
  ST: {
    name: "São Tomé and Príncipe", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 235536, adultSharePct: 0.60, sexRatioPctMale: 0.50,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      notObeseShare: { men: 0.911, women: 0.803 },
      income: { men: { median: 3600, sigma: 1.3 }, women: { median: 2200, sigma: 1.35 } },
    },
    sourceNote: "São Tomé and Príncipe-specific estimate from UN World Population Prospects, WHO obesity data, and World Bank GNI data. No official ethnicity/race census variable found; historical social categories from its colonial labor history aren't a current statistical breakdown. No World Bank Gini figure was found, so income spread uses the regional default. Height and marriage rate weren't reliably found this pass and fall back to the regional average -- this is one of the thinner upgrades in the batch.",
  },
  SC: {
    name: "Seychelles", continent: "Africa", regionKey: "SUB_SAHARAN_AFRICA", tier: "full",
    totalPopulation: 106000, adultSharePct: 0.78, sexRatioPctMale: 0.519,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      notObeseShare: { men: 0.798, women: 0.604 },
      income: { men: { median: 18000, sigma: 0.95 }, women: { median: 12300, sigma: 1.0 } },
    },
    sourceNote: "Seychelles-specific estimate from National Bureau of Statistics Seychelles population data, the Seychelles Heart Study IV national health survey, and World Bank data. NBS Seychelles doesn't publish a numeric ethnic/ancestry census breakdown, only qualitative description, so no race mapping applies. Height and marriage rate weren't reliably found this pass and fall back to the regional average.",
  },

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
  AF: {
    name: "Afghanistan", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "full",
    totalPopulation: 42600000, adultSharePct: 0.49, sexRatioPctMale: 0.505,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 65.2, sd: 2.6 }, women: { mean: 60.0, sd: 2.4 } },
      notObeseShare: { men: 0.881, women: 0.765 },
      income: { men: { median: 1600, sigma: 1.45 }, women: { median: 450, sigma: 1.6 } },
      marriedShare: { men: 0.65, women: 0.72 },
    },
    sourceNote: "Afghanistan-specific estimate from UN World Population Prospects, the 2018 WHO STEPS survey (obesity), and World Bank data. No reliable post-2021 parenthood-rate source was found, so that dimension falls back to the South Asia regional average; income and marriage splits are modeled from aggregate figures, not independently published by sex.",
  },
  NP: {
    name: "Nepal", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "full",
    totalPopulation: 29200000, adultSharePct: 0.63, sexRatioPctMale: 0.475,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.2, sd: 2.5 }, women: { mean: 59.4, sd: 2.3 } },
      notObeseShare: { men: 0.966, women: 0.933 },
      income: { men: { median: 5600, sigma: 1.3 }, women: { median: 2700, sigma: 1.35 } },
      marriedShare: { men: 0.68, women: 0.74 },
    },
    sourceNote: "Nepal-specific estimate from the 2021 census (Central Bureau of Statistics), the 2022 Nepal Demographic and Health Survey, and World Bank data. Adult sex ratio skews female due to large male labor emigration. Parenthood rate isn't independently sourced and falls back to the South Asia regional average.",
  },
  LK: {
    name: "Sri Lanka", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "full",
    totalPopulation: 21800000, adultSharePct: 0.72, sexRatioPctMale: 0.475,
    stats: {
      ageDistribution: AGE_MODERATE_OLD, raceShare: ANY_RACE,
      height: { men: { mean: 65.4, sd: 2.6 }, women: { mean: 60.2, sd: 2.4 } },
      notObeseShare: { men: 0.833, women: 0.732 },
      income: { men: { median: 17500, sigma: 1.35 }, women: { median: 9500, sigma: 1.4 } },
      marriedShare: { men: 0.56, women: 0.58 },
    },
    sourceNote: "Sri Lanka-specific estimate from the Department of Census and Statistics, a national obesity survey, and World Bank data (income median from GNI per capita PPP; Gini elevated post-2022 economic crisis). Parenthood rate falls back to the South Asia regional average.",
  },
  BT: { name: "Bhutan", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 780000 },
  MV: { name: "Maldives", continent: "Asia", regionKey: "SOUTH_ASIA", tier: "regional", totalPopulation: 520000 },
  KZ: {
    name: "Kazakhstan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 20000000, adultSharePct: 0.72, sexRatioPctMale: 0.47,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.9, sd: 2.7 }, women: { mean: 64.2, sd: 2.5 } },
      income: { men: { median: 39000, sigma: 1.05 }, women: { median: 26000, sigma: 1.1 } },
      marriedShare: { men: 0.63, women: 0.60 },
    },
    sourceNote: "Kazakhstan-specific estimate from the 2021 census and World Bank data (Kazakhstan has the lowest Gini coefficient in this region, reflected in the tighter income spread). No confidently sourced sex-disaggregated obesity figure was found, so that dimension and parenthood rate fall back to the Central Asia & Caucasus regional average.",
  },
  UZ: {
    name: "Uzbekistan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 36000000, adultSharePct: 0.63, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.7, sd: 2.6 }, women: { mean: 63.0, sd: 2.4 } },
      notObeseShare: { men: 0.839, women: 0.782 },
      income: { men: { median: 14000, sigma: 1.2 }, women: { median: 9000, sigma: 1.25 } },
      marriedShare: { men: 0.70, women: 0.72 },
    },
    sourceNote: "Uzbekistan-specific estimate from national statistics population data, a national nutrition survey, and World Bank data. Parenthood rate falls back to the Central Asia & Caucasus regional average.",
  },
  TM: { name: "Turkmenistan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "regional", totalPopulation: 6300000 },
  TJ: {
    name: "Tajikistan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 10800000, adultSharePct: 0.55, sexRatioPctMale: 0.495,
    stats: {
      ageDistribution: AGE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 67.1, sd: 2.6 }, women: { mean: 62.2, sd: 2.4 } },
      income: { men: { median: 6500, sigma: 1.2 }, women: { median: 4000, sigma: 1.25 } },
      marriedShare: { men: 0.63, women: 0.68 },
    },
    sourceNote: "Tajikistan-specific estimate from national population data and World Bank data. No reliable sex-disaggregated obesity figure was found, so that dimension and parenthood rate fall back to the Central Asia & Caucasus regional average.",
  },
  KG: {
    name: "Kyrgyzstan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 7100000, adultSharePct: 0.65, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 68.1, sd: 2.6 }, women: { mean: 63.0, sd: 2.4 } },
      notObeseShare: { men: 0.891, women: 0.802 },
      income: { men: { median: 8500, sigma: 1.0 }, women: { median: 6000, sigma: 1.05 } },
      marriedShare: { men: 0.60, women: 0.62 },
    },
    sourceNote: "Kyrgyzstan-specific estimate from national population data, a WHO intercountry obesity survey, and World Bank data (Kyrgyzstan's lower Gini coefficient drives its tighter income spread). Parenthood rate falls back to the Central Asia & Caucasus regional average.",
  },
  AZ: {
    name: "Azerbaijan", continent: "Asia", regionKey: "CENTRAL_ASIA", tier: "full",
    totalPopulation: 10200000, adultSharePct: 0.77, sexRatioPctMale: 0.485,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.9, sd: 2.6 }, women: { mean: 63.0, sd: 2.4 } },
      notObeseShare: { men: 0.853, women: 0.735 },
      income: { men: { median: 27000, sigma: 1.15 }, women: { median: 17000, sigma: 1.2 } },
      marriedShare: { men: 0.60, women: 0.63 },
    },
    sourceNote: "Azerbaijan-specific estimate from national population data, a national obesity survey, and World Bank GNI per capita PPP. Currently-married share for women is independently corroborated by a national survey; parenthood rate falls back to the Central Asia & Caucasus regional average.",
  },

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
    sourceNote: "Malaysia-specific estimate from the Department of Statistics Malaysia, WHO, and World Bank data. Malaysia's own ethnic categories (Bumiputera, Chinese, Indian) don't map onto this tool's basic race filter, but are available in the paid report's Ethnic, Ancestral or Cultural Background filter.",
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
    sourceNote: "Singapore-specific estimate from the Singapore Department of Statistics, WHO, and World Bank data. Singapore's own ethnic categories (Chinese, Malay, Indian) don't map onto this tool's basic race filter, but are available in the paid report's Ethnic, Ancestral or Cultural Background filter.",
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
  PG: {
    name: "Papua New Guinea", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 10576490, adultSharePct: 0.606, sexRatioPctMale: 0.511,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0671, "20-29": 0.2975, "30-39": 0.2398, "40-49": 0.1742, "50-59": 0.1217, "60-69": 0.0698, "70-79": 0.0246, "80+": 0.0052 },
        women: { "18-19": 0.0634, "20-29": 0.2844, "30-39": 0.2449, "40-49": 0.1870, "50-59": 0.1243, "60-69": 0.0650, "70-79": 0.0249, "80+": 0.0061 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 64.4, sd: 2.5 }, women: { mean: 61.0, sd: 2.3 } },
      notObeseShare: { men: 0.768, women: 0.699 },
    },
    sourceNote: "Papua New Guinea-specific estimate from UN World Population Prospects, WHO obesity data, and NCD-RisC height data. PNG's own statistics office enumerates by language/province, not race, so no mapping is available. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  FJ: {
    name: "Fiji", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 928776, adultSharePct: 0.676, sexRatioPctMale: 0.491,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0526, "20-29": 0.2382, "30-39": 0.2292, "40-49": 0.1966, "50-59": 0.1421, "60-69": 0.0975, "70-79": 0.0363, "80+": 0.0076 },
        women: { "18-19": 0.0516, "20-29": 0.2319, "30-39": 0.2206, "40-49": 0.1890, "50-59": 0.1388, "60-69": 0.1045, "70-79": 0.0486, "80+": 0.0148 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 68.5, sd: 2.7 }, women: { mean: 63.7, sd: 2.5 } },
      notObeseShare: { men: 0.724, women: 0.529 },
    },
    sourceNote: "Fiji-specific estimate from UN World Population Prospects, WHO obesity data, and NCD-RisC height data. The Fiji Bureau of Statistics' 2017 census category 'Fijian of Indian descent' (37.5%, in this site's ethnicity.js) names a specific national-origin group rather than an aggregate 'Asian' race category -- the same distinction that kept Trinidad's and Guyana's 'East Indian' census labels unmapped elsewhere in this project -- so no race mapping is used here either. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  SB: {
    name: "Solomon Islands", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 819187, adultSharePct: 0.569, sexRatioPctMale: 0.508,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0730, "20-29": 0.3008, "30-39": 0.2253, "40-49": 0.1814, "50-59": 0.1205, "60-69": 0.0624, "70-79": 0.0275, "80+": 0.0090 },
        women: { "18-19": 0.0701, "20-29": 0.3027, "30-39": 0.2298, "40-49": 0.1782, "50-59": 0.1170, "60-69": 0.0616, "70-79": 0.0306, "80+": 0.0100 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 64.6, sd: 2.5 }, women: { mean: 60.8, sd: 2.3 } },
      notObeseShare: { men: 0.852, women: 0.743 },
    },
    sourceNote: "Solomon Islands-specific estimate from UN World Population Prospects, WHO obesity data, and NCD-RisC height data. The 2019 census (Melanesian 95.6%/Polynesian 2.8%/Micronesian 1.2%) doesn't publish a percentage breakdown for its small Chinese/European residual, so no race mapping is used. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  VU: {
    name: "Vanuatu", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 327767, adultSharePct: 0.559, sexRatioPctMale: 0.497,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0716, "20-29": 0.2733, "30-39": 0.2432, "40-49": 0.1649, "50-59": 0.1288, "60-69": 0.0724, "70-79": 0.0346, "80+": 0.0112 },
        women: { "18-19": 0.0670, "20-29": 0.2807, "30-39": 0.2598, "40-49": 0.1571, "50-59": 0.1131, "60-69": 0.0801, "70-79": 0.0339, "80+": 0.0083 },
      },
      raceShare: { any: 1, white: 0.003, asian: 0.002 },
      height: { men: { mean: 66.2, sd: 2.6 }, women: { mean: 62.3, sd: 2.4 } },
      notObeseShare: { men: 0.841, women: 0.744 },
    },
    sourceNote: "Vanuatu-specific estimate from UN World Population Prospects, WHO obesity data, and NCD-RisC height data. Race mapping from the Vanuatu Bureau of Statistics' 2020 census ethnicity table (Ni-Vanuatu 99.0%, European 0.3%, Asian 0.2%). Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  WS: {
    name: "Samoa", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 205557, adultSharePct: 0.554, sexRatioPctMale: 0.494,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0761, "20-29": 0.2559, "30-39": 0.1846, "40-49": 0.1658, "50-59": 0.1592, "60-69": 0.1040, "70-79": 0.0428, "80+": 0.0116 },
        women: { "18-19": 0.0704, "20-29": 0.2467, "30-39": 0.2028, "40-49": 0.1639, "50-59": 0.1441, "60-69": 0.1028, "70-79": 0.0496, "80+": 0.0198 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 68.6, sd: 2.7 }, women: { mean: 63.8, sd: 2.5 } },
      notObeseShare: { men: 0.503, women: 0.258 },
      marriedShare: { men: 0.472, women: 0.515 },
    },
    sourceNote: "Samoa-specific estimate from the Samoa Bureau of Statistics 2021 census (marital status among population 15+, used as an 18+ proxy), UN World Population Prospects, and WHO obesity data (Samoa has among the world's highest female obesity rates). Samoa's census doesn't publish a race/ethnicity variable. Parenthood rate wasn't reliably found this pass and falls back to the regional average.",
  },
  KI: {
    name: "Kiribati", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 134508, adultSharePct: 0.598, sexRatioPctMale: 0.472,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0643, "20-29": 0.2948, "30-39": 0.2464, "40-49": 0.1688, "50-59": 0.1210, "60-69": 0.0738, "70-79": 0.0251, "80+": 0.0059 },
        women: { "18-19": 0.0591, "20-29": 0.2657, "30-39": 0.2418, "40-49": 0.1682, "50-59": 0.1304, "60-69": 0.0863, "70-79": 0.0371, "80+": 0.0114 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 66.6, sd: 2.6 }, women: { mean: 61.8, sd: 2.4 } },
      notObeseShare: { men: 0.639, women: 0.477 },
    },
    sourceNote: "Kiribati-specific estimate from UN World Population Prospects, WHO obesity data, and NCD-RisC height data. The census's 95.7% Gilbertese / 4.3% 'other' breakdown doesn't separate its residual into race categories, so no mapping is used. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  TO: {
    name: "Tonga", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 104168, adultSharePct: 0.579, sexRatioPctMale: 0.442,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0865, "20-29": 0.2625, "30-39": 0.1584, "40-49": 0.1632, "50-59": 0.1630, "60-69": 0.0977, "70-79": 0.0509, "80+": 0.0178 },
        women: { "18-19": 0.0687, "20-29": 0.2599, "30-39": 0.1905, "40-49": 0.1688, "50-59": 0.1430, "60-69": 0.0892, "70-79": 0.0545, "80+": 0.0254 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 69.6, sd: 2.8 }, women: { mean: 65.2, sd: 2.6 } },
      notObeseShare: { men: 0.392, women: 0.210 },
    },
    sourceNote: "Tonga-specific estimate from UN World Population Prospects (population skews notably female among adults, reflecting male labor emigration), WHO obesity data (Tonga has one of the world's highest obesity rates -- 79% of women), and NCD-RisC height data (Tongans are among the tallest Pacific populations). The Statistics Department's 'Other' residual (3.5%) bundles multiple nationalities without a race breakdown, so no mapping is used. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  FM: {
    name: "Micronesia", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 113150, adultSharePct: 0.620, sexRatioPctMale: 0.487,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0683, "20-29": 0.3122, "30-39": 0.2225, "40-49": 0.1462, "50-59": 0.1179, "60-69": 0.0909, "70-79": 0.0368, "80+": 0.0052 },
        women: { "18-19": 0.0648, "20-29": 0.2895, "30-39": 0.1990, "40-49": 0.1459, "50-59": 0.1333, "60-69": 0.1066, "70-79": 0.0483, "80+": 0.0125 },
      },
      raceShare: { any: 1, asian: 0.014 },
      height: { men: { mean: 66.3, sd: 2.6 }, women: { mean: 61.5, sd: 2.4 } },
      notObeseShare: { men: 0.630, women: 0.459 },
    },
    sourceNote: "Micronesia (FSM)-specific estimate from UN World Population Prospects, WHO obesity data, and NCD-RisC height data. Race mapping from FSM's 2010 census ethnic-group breakdown, which includes a distinct 'Asian' category (1.4%) alongside its state-based groups -- the most recent figure findable, may be dated. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  PW: {
    name: "Palau", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 17614, adultSharePct: 0.79, sexRatioPctMale: 0.555,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: { any: 1, asian: 0.316, white: 0.010 },
      height: { men: { mean: 66.0, sd: 2.6 }, women: { mean: 61.5, sd: 2.4 } },
      notObeseShare: { men: 0.620, women: 0.534 },
    },
    sourceNote: "Palau-specific estimate from the 2020 Census of Population and Housing (Office of Planning, Budget & Statistics), WHO obesity data, and NCD-RisC height data. Race mapping from the same census's ethnicity table (Palauan 65.2%, Asian 31.6% -- Filipino ~20.1%, Chinese ~4.2% -- European 1.0%): Palau has an unusually large resident Asian population from Filipino/Chinese contract labor. adultSharePct and sexRatioPctMale are approximated from broad CIA World Factbook age bands rather than a precise census breakdown; age distribution falls back to the regional archetype for the same reason. Income, marriage, and parenthood rate weren't reliably found this pass and fall back to the regional average.",
  },
  MH: {
    name: "Marshall Islands", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 42418, adultSharePct: 0.58, sexRatioPctMale: 0.512,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 64.1, sd: 2.5 }, women: { mean: 59.6, sd: 2.3 } },
      notObeseShare: { men: 0.681, women: 0.490 },
    },
    sourceNote: "Marshall Islands-specific estimate from the Economic Policy, Planning and Statistics Office's 2021 census (population, sex ratio), WHO obesity data, and NCD-RisC height data. adultSharePct is a rough approximation and age distribution falls back to the regional archetype, since a precise single-year age breakdown wasn't accessible this pass. No current census race/ethnicity percentage table was found. Income, marriage, and parenthood rate fall back to the regional average.",
  },
  NR: {
    name: "Nauru", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 11680, adultSharePct: 0.57, sexRatioPctMale: 0.50,
    stats: {
      ageDistribution: AGE_MODERATE_YOUNG, raceShare: ANY_RACE,
      height: { men: { mean: 66.1, sd: 2.6 }, women: { mean: 60.6, sd: 2.4 } },
      notObeseShare: { men: 0.289, women: 0.295 },
    },
    sourceNote: "Nauru-specific estimate from the Nauru Bureau of Statistics 2021 census (population, broad age structure), WHO obesity data (Nauru has one of the world's highest obesity rates for both sexes), and NCD-RisC height data. An older, widely-repeated ethnic breakdown (58% Nauruan/26% Pacific Islander/8% Chinese/8% European) doesn't match the current census's nationality-based categories and wasn't used. Income, marriage, and parenthood rate fall back to the regional average.",
  },
  TV: {
    name: "Tuvalu", continent: "Oceania", regionKey: "OCEANIA", tier: "full",
    totalPopulation: 10507, adultSharePct: 0.625, sexRatioPctMale: 0.505,
    stats: {
      ageDistribution: {
        men: { "18-19": 0.0597, "20-29": 0.2906, "30-39": 0.2063, "40-49": 0.1439, "50-59": 0.1684, "60-69": 0.0931, "70-79": 0.0316, "80+": 0.0063 },
        women: { "18-19": 0.0560, "20-29": 0.2654, "30-39": 0.1937, "40-49": 0.1335, "50-59": 0.1796, "60-69": 0.1141, "70-79": 0.0400, "80+": 0.0178 },
      },
      raceShare: ANY_RACE,
      height: { men: { mean: 66.8, sd: 2.6 }, women: { mean: 62.2, sd: 2.4 } },
      notObeseShare: { men: 0.433, women: 0.295 },
      marriedShare: { men: 0.551, women: 0.593 },
    },
    sourceNote: "Tuvalu-specific estimate built directly from the Central Statistics Division's 2017 Population & Housing Mini-Census (population, full age-sex pyramid, marital status among residents 15+ used as an 18+ proxy), WHO obesity data, and NCD-RisC height data. The census's ethnicity categories (Tuvaluan 97.0%, Tuvaluan/I-Kiribati 1.6%, etc.) are mixed-descent/nationality labels, not race, so no mapping is used. Parenthood rate wasn't reliably found this pass and falls back to the regional average.",
  },
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
  // A "full" tier country's own stats block wins field-by-field, but any
  // dimension it doesn't specify (e.g. a country with a sourced height and
  // obesity figure but no reliable marriage-rate source) falls back to the
  // region average rather than being left undefined -- computeProbability()
  // reads several of these fields unconditionally (e.g. heightSurvival()
  // always touches stats.height), so a missing key would throw, not just
  // silently under-report. Country-level sourceNote text is expected to
  // disclose which specific fields are country-sourced vs. regional.
  const base = entry.tier === "full" ? { ...region, ...entry.stats } : region;
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
