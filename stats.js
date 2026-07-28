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
function heightSurvival(sex, minInches) {
  const { mean, sd } = STATS.height[sex];
  const z = (minInches - mean) / sd;
  return 1 - normalCdf(z);
}

// P(income >= minIncome) for a Lognormal fit to the sex's median income.
function incomeSurvival(sex, minIncome) {
  if (minIncome <= 0) return 1;
  const { median, sigma } = STATS.income[sex];
  const mu = Math.log(median);
  const z = (Math.log(minIncome) - mu) / sigma;
  return 1 - normalCdf(z);
}

// P(age is within [minAge, maxAge]) using the bucketed distribution,
// linearly interpolating within buckets.
function ageRangeShare(sex, minAge, maxAge) {
  const buckets = [
    [18, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 100],
  ];
  const keys = ["18-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+"];
  const dist = STATS.ageDistribution[sex];

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

window.QuizStats = { STATS, heightSurvival, incomeSurvival, ageRangeShare };
})();
