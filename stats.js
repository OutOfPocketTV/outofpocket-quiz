/*
 * Approximate U.S. population statistics used to estimate match probabilities.
 * Sourced conceptually from U.S. Census Bureau (ACS / population estimates)
 * and CDC/NCHS (NHANES anthropometric + obesity data). These are rounded,
 * public-data approximations for an entertainment/estimation tool, not
 * precise joint distributions — swap in exact tables here as you get them.
 */

(function () {
const STATS = {
  // Total U.S. adult (18+) population by sex (Census population estimates,
  // rounded). Used to turn a percentage into an actual head count.
  totalAdultPopulation: {
    men: 127000000,
    women: 131000000,
  },

  // Share of adults who are currently married, spouse present (ACS).
  // Used for the "Exclude married" filter.
  marriedShare: {
    men: 0.51,
    women: 0.49,
  },

  // Share of adults who are parents (any age children, Census/CDC family
  // formation data). Used for the "Exclude kids" filter.
  hasKidsShare: {
    men: 0.54,
    women: 0.58,
  },

  // Adult (18+) age distribution as a share of each sex's adult population,
  // by 10-year bucket. Used to find what fraction of a sex falls in a given
  // age range.
  ageDistribution: {
    men: {
      "18-19": 0.032, "20-29": 0.168, "30-39": 0.165, "40-49": 0.150,
      "50-59": 0.157, "60-69": 0.148, "70-79": 0.112, "80+": 0.068,
    },
    women: {
      "18-19": 0.030, "20-29": 0.159, "30-39": 0.160, "40-49": 0.147,
      "50-59": 0.155, "60-69": 0.149, "70-79": 0.121, "80+": 0.079,
    },
  },

  // Race / ethnicity share of the U.S. adult population (ACS, rounded).
  // "any" = 1 (no filter applied).
  raceShare: {
    any: 1,
    white: 0.58,
    black: 0.125,
    asian: 0.065,
  },

  // Height ~ Normal(mean, sd) in inches (NHANES).
  height: {
    men: { mean: 69.0, sd: 3.0 },
    women: { mean: 63.6, sd: 2.8 },
  },

  // Share of adults who are NOT obese (BMI < 30), CDC/NCHS.
  notObeseShare: {
    men: 0.585,
    women: 0.560,
  },

  // Personal income ~ approximated as lognormal, fit to Census ACS medians
  // and calibrated so the upper tail lands near real top-earner rates
  // (roughly 0.1-0.2% of individual earners report $1M+ personal income),
  // since the income slider now runs up to $1,000,000.
  income: {
    men: { median: 45000, sigma: 1.00 },
    women: { median: 33000, sigma: 1.00 },
  },

  // Share of adults who did NOT gamble/bet in the past 12 months. Source:
  // The Harris Poll on behalf of NerdWallet, Dec 14-18 2023, n=2,061 U.S.
  // adults 18+, +/-2.7pp margin of error at 95% confidence -- 66% of men
  // and 58% of women reported gambling in the past year, so notGamblesShare
  // is the complement (34% / 42%). Used for the "Exclude gamblers" filter,
  // which is currently offered only when searching for men (a product
  // scoping decision, not a data gap -- the women's figure is real and
  // stored here so it's ready if that changes).
  notGamblesShare: {
    men: 0.34,
    women: 0.42,
  },
};

// Standard normal CDF via Abramowitz-Stegun approximation.
function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  let p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

// P(X >= minHeightInches) for a Normal(mean, sd) height distribution.
// Takes a stats-shaped object (e.g. STATS, or a per-country equivalent
// from countries.js) as the first argument so the same math can run
// against any population, not just the hardcoded U.S. one.
function heightSurvival(stats, sex, minInches) {
  const { mean, sd } = stats.height[sex];
  const z = (minInches - mean) / sd;
  return 1 - normalCdf(z);
}

// P(income >= minIncome) for a Lognormal fit to the sex's median income.
function incomeSurvival(stats, sex, minIncome) {
  if (minIncome <= 0) return 1;
  const { median, sigma } = stats.income[sex];
  const mu = Math.log(median);
  const z = (Math.log(minIncome) - mu) / sigma;
  return 1 - normalCdf(z);
}

// P(age is within [minAge, maxAge]) using the bucketed distribution,
// linearly interpolating within buckets.
function ageRangeShare(stats, sex, minAge, maxAge) {
  const buckets = [
    [18, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 100],
  ];
  const keys = ["18-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+"];
  const dist = stats.ageDistribution[sex];

  let total = 0;
  buckets.forEach(([lo, hi], i) => {
    const bucketShare = dist[keys[i]];
    const bucketSize = hi - lo + 1;
    const overlapLo = Math.max(lo, minAge);
    const overlapHi = Math.min(hi, maxAge);
    if (overlapHi >= overlapLo) {
      const overlapSize = overlapHi - overlapLo + 1;
      total += bucketShare * (overlapSize / bucketSize);
    }
  });
  return total;
}

// Runs the full independent-filters probability model (used by both the
// free U.S. calculator and the Global Dream Partner Report) against any
// stats-shaped object: { ageDistribution, raceShare, height, income,
// notObeseShare, marriedShare, hasKidsShare, totalAdultPopulation }.
function computeProbability(stats, filters) {
  const {
    targetSex, ageLo, ageHi, selectedRaces, minHeight, minIncome,
    excludeObese, excludeMarried, excludeKids, excludeGambles,
  } = filters;

  const pAge = ageRangeShare(stats, targetSex, ageLo, ageHi);
  // Race/ethnicity categories are mutually exclusive in the source data,
  // so combining choices (e.g. White + Black) sums their shares.
  const pRace =
    selectedRaces.length === 0
      ? stats.raceShare.any
      : Math.min(1, selectedRaces.reduce((sum, r) => sum + (stats.raceShare[r] || 0), 0));
  const pHeight = heightSurvival(stats, targetSex, minHeight);
  const pIncome = incomeSurvival(stats, targetSex, minIncome);
  const pNotObese = excludeObese ? stats.notObeseShare[targetSex] : 1;
  const pNotMarried = excludeMarried ? 1 - stats.marriedShare[targetSex] : 1;
  const pNoKids = excludeKids ? 1 - stats.hasKidsShare[targetSex] : 1;
  // Only the free U.S. calculator's stats have notGamblesShare so far (the
  // Global Report's per-country data doesn't yet) -- fall back to "no
  // effect" rather than crashing or dropping the whole result when it's
  // missing, same pattern as every other partially-available dimension.
  const pNotGambles =
    excludeGambles && stats.notGamblesShare && stats.notGamblesShare[targetSex] != null
      ? stats.notGamblesShare[targetSex]
      : 1;

  const probability = pRace * pHeight * pIncome * pNotObese * pNotMarried * pNoKids * pNotGambles;
  const pct = probability * 100;

  const peopleInAgeRange = stats.totalAdultPopulation[targetSex] * pAge;
  const matchingCount = Math.round(peopleInAgeRange * probability);

  return { probability, pct, matchingCount, pAge, pRace, pHeight, pIncome, pNotObese, pNotMarried, pNoKids, pNotGambles };
}

window.QuizStats = { STATS, heightSurvival, incomeSurvival, ageRangeShare, computeProbability };
})();
