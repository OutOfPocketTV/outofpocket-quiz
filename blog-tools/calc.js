// Loads the site's own probability engine into Node, exactly as the browser
// loads it, so every number in a blog post is the number the calculator
// would show. Nothing here re-implements any math.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
// Same order as the <script> tags in index.html.
for (const f of ["stats.js", "countries.js", "states.js", "metros.js", "quiz-core.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
}
vm.runInContext("window.computeScopeResult = computeScopeResult;", ctx);
const W = ctx.window;

// The calculator's untouched form: everyone aged 18 to 80, no standards.
const BASE = {
  targetSex: "men", ageLo: 18, ageHi: 80, selectedRaces: [], minHeight: 0, minIncome: 0,
  excludeMarried: false, excludeKids: false, excludeGambles: false,
  selectedOrientations: [], selectedReligions: [], selectedBodyTypes: [],
};

// run(filters) -> U.S.; run(filters, "NL") -> a country. Returns
// { pct, matchingCount, ... } as the site does.
function run(filters, scope = "US") {
  return W.computeScopeResult(scope, { ...BASE, ...filters });
}

// A U.S. state ("TX") or metro (see metros.js for codes), the same way the
// report's state table works it out (script.js computeStateResult).
function runPlace(code, filters) {
  const S = W.QuizUSStates, M = W.QuizUSMetros;
  const stats = S.STATES[code] ? S.getStateStats(code) : M.METROS[code] ? M.getMetroStats(code) : null;
  if (!stats) throw new Error("Unknown state or metro: " + code);
  return W.QuizStats.computeProbability(stats, { ...BASE, ...filters });
}

module.exports = { W, run, runPlace, BASE };
