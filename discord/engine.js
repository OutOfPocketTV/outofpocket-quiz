// Loads the live quiz engine into Node.
//
// stats.js, countries.js and quiz-core.js are browser scripts: each ends by
// hanging its exports off `window`, and they assume the others are already
// there. None of them touch the DOM, so the only thing standing between them
// and Node is the global itself -- give them a `window` and they run.
//
// The point of loading the real files rather than copying numbers out of them
// is that #daily-odds then cannot drift from the calculator. A question is
// wrong the moment the site disagrees with it, and the site is the source.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// Load order is the same one index.html uses: stats first, because
// countries.js reaches for window.QuizStats.STATS while it is still loading.
const FILES = ['stats.js', 'countries.js', 'quiz-core.js'];

const sandbox = { console, Math, Date, JSON, Object, Array, Number, String, Set, Map };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const file of FILES) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(src, sandbox, { filename: file });
}

const { QuizStats, QuizGlobalStats } = sandbox;
if (!QuizStats || !QuizGlobalStats) throw new Error('engine failed to load');

// Percentage of `scope`'s population matching `filters`. Scope is a country
// code ("US", "GB", ...); filters are the same shape the site builds.
function oddsFor(scope, filters) {
  const stats = QuizGlobalStats.getCountryStats(scope);
  const meta = QuizGlobalStats.getCountryMeta(scope);
  if (!stats || !meta) throw new Error(`no data for scope "${scope}"`);
  const r = QuizStats.computeProbability(stats, filters);
  return { pct: r.pct, matchingCount: r.matchingCount, country: meta.name, factors: r };
}

// The defaults every question starts from: no filter applied anywhere. A
// question then sets only the one or two dimensions it is actually asking
// about, so nothing else is silently narrowing the answer.
function baseFilters(targetSex) {
  return {
    targetSex,
    ageLo: 18, ageHi: 99,
    selectedRaces: [],
    minHeight: 0,
    minIncome: 0,
    excludeMarried: false,
    excludeKids: false,
    excludeGambles: false,
    selectedOrientations: [],
    selectedReligions: [],
    bodyTypes: [],
  };
}

module.exports = { QuizStats, QuizGlobalStats, oddsFor, baseFilters, sandbox };
