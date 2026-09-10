// Out Of Pocket -- response quality / de-duplication.
//
// The problem this solves: "Find Out" fires on every press, and a single
// visitor -- especially a buyer, who can keep re-running the report for as
// long as they like -- can press it dozens of times in one sitting. Left
// alone that makes the analytics useless for the only question worth
// asking of them ("what are people actually looking for?"), because the
// heaviest fiddler outvotes fifty ordinary visitors.
//
// So a submission is classified before it is reported, and only a
// CANONICAL one is recorded as a preference:
//
//   primary  -- the first submission this respondent has ever made. The
//               purest statement of what they wanted: it happens before
//               they have been shown a single number, so nothing on the
//               page has had a chance to nudge it.
//   retake   -- the first submission of a later epoch, i.e. they came back
//               REFRESH_WINDOW_DAYS or more after the last epoch began.
//               Also real data: a person's circumstances and standards
//               genuinely move over half a year, so this UPDATES their
//               record rather than polluting it.
//   repeat   -- every further press inside the same epoch. Real behaviour,
//               useful for "which filters do people fiddle with", but never
//               a preference record.
//   replay   -- machine-generated. The post-Stripe-redirect page reload
//               re-runs the calculation on the buyer's behalf; no human
//               pressed anything, so it is not an answer to anything.
//
// Identity is a random ID we mint ourselves in localStorage. It carries no
// personal information, is not derived from anything about the device, and
// exists only to tell "this person again" from "someone new".
(function () {

// Half a year. Long enough that a returning visitor plausibly has a
// different life -- new job, new city, new standards -- rather than being
// the same person on the same afternoon; short enough to catch someone who
// treats the quiz as a yearly check-in. Both epochs are kept, so their
// first answer is never overwritten by their later one.
const REFRESH_WINDOW_DAYS = 180;
const REFRESH_WINDOW_MS = REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY = "oop_respondent";

// Where the identity actually came from. Reported alongside every response
// so a stricter cut is always available later: "local" is a respondent we
// can recognise across visits, and only that tier supports the retake
// logic at all.
//   local   -- localStorage. Recognised across visits and epochs.
//   session -- sessionStorage only (localStorage blocked). Recognised for
//              this tab, so repeat presses in one sitting still collapse;
//              a later visit looks like a new person.
//   memory  -- neither store is writable. Recognised for this page load
//              only. Still enough to stop one sitting flooding the data.
let scope = "local";

// sessionStorage is deliberately NOT treated as equivalent: if localStorage
// is blocked, every visit starts a fresh per-tab record, so calling that
// "local" would let each visit claim to be a first-ever answer.
function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { scope = "local"; return JSON.parse(raw); }
  } catch (err) {
    // localStorage unavailable (private browsing, storage full, blocked).
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) { scope = "session"; return JSON.parse(raw); }
  } catch (err) {
    // Neither store readable; the in-memory record below is all we get.
  }
  return null;
}

function writeStore(record) {
  const raw = JSON.stringify(record);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
    scope = "local";
    return;
  } catch (err) {
    // Fall through to the per-tab store.
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, raw);
    scope = "session";
    return;
  } catch (err) {
    scope = "memory";
  }
}

// Random, not derived from anything about the device. Math.random is a last
// resort so a hardened browser without crypto still gets de-duplicated
// rather than dropped from the data entirely.
function mintId() {
  const bytes = new Uint8Array(8);
  try {
    crypto.getRandomValues(bytes);
  } catch (err) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function freshRecord(now) {
  return {
    id: mintId(),
    firstSeenAt: now,   // first submission ever, never rewritten
    epoch: 1,           // 1 = their original answer; 2+ = a later re-take
    epochStartedAt: now,
    attempts: 0,        // presses ever, across every epoch
    epochAttempts: 0,   // presses inside the current epoch
  };
}

// Survives a wiped or unwritable store for the life of the page, so a
// visitor with no storage at least does not log ten first-ever answers from
// one sitting.
let memoryRecord = null;

function loadRecord(now) {
  const stored = readStore();
  if (stored && typeof stored.id === "string" && Number(stored.firstSeenAt) > 0) {
    return {
      id: stored.id,
      firstSeenAt: Number(stored.firstSeenAt),
      epoch: Number(stored.epoch) > 0 ? Number(stored.epoch) : 1,
      epochStartedAt: Number(stored.epochStartedAt) || Number(stored.firstSeenAt),
      attempts: Number(stored.attempts) || 0,
      epochAttempts: Number(stored.epochAttempts) || 0,
    };
  }
  if (memoryRecord) return memoryRecord;
  return freshRecord(now);
}

// Called once per submission. Advances the respondent's record and returns
// what that submission is worth as data.
function classify(options) {
  const now = Date.now();

  // A replayed calculation must not touch the record at all -- not the
  // attempt count, not the epoch. Otherwise buying the report would
  // silently spend a buyer's real first answer on a page reload.
  if (options && options.synthetic) {
    const peek = loadRecord(now);
    return {
      quality: "replay",
      canonical: false,
      respondentId: peek.id,
      identityScope: scope,
      epoch: peek.epoch,
      attemptNumber: peek.attempts,
      epochAttemptNumber: peek.epochAttempts,
      daysSinceFirst: Math.floor((now - peek.firstSeenAt) / DAY_MS),
      daysSinceEpochStart: Math.floor((now - peek.epochStartedAt) / DAY_MS),
    };
  }

  const record = loadRecord(now);
  const brandNew = record.attempts === 0;
  const windowElapsed = now - record.epochStartedAt >= REFRESH_WINDOW_MS;

  // Only a respondent we can actually recognise across visits can be shown
  // to have come back months later. Without that, "the window elapsed"
  // is indistinguishable from a stale record, so a session- or
  // memory-scoped visitor never produces a retake.
  const isRetake = !brandNew && windowElapsed && scope === "local";

  if (isRetake) {
    record.epoch += 1;
    record.epochStartedAt = now;
    record.epochAttempts = 0;
  }

  record.attempts += 1;
  record.epochAttempts += 1;

  memoryRecord = record;
  writeStore(record);

  const quality = brandNew ? "primary" : (isRetake ? "retake" : "repeat");

  return {
    quality,
    // The one flag every caller should branch on. Both primary and retake
    // are genuine statements of what someone wanted; nothing else is.
    canonical: quality === "primary" || quality === "retake",
    respondentId: record.id,
    identityScope: scope,
    epoch: record.epoch,
    attemptNumber: record.attempts,
    epochAttemptNumber: record.epochAttempts,
    daysSinceFirst: Math.floor((now - record.firstSeenAt) / DAY_MS),
    daysSinceEpochStart: Math.floor((now - record.epochStartedAt) / DAY_MS),
  };
}

// Read-only view for anything that wants to describe the respondent without
// counting a submission against them.
function inspect() {
  const record = loadRecord(Date.now());
  return {
    respondentId: record.id,
    identityScope: scope,
    epoch: record.epoch,
    attempts: record.attempts,
    firstSeenAt: record.firstSeenAt,
    refreshWindowDays: REFRESH_WINDOW_DAYS,
  };
}

// Wipes the respondent record. Exposed so "forget me" is something this
// site can honestly offer for the analytics identity, not only for the
// purchase record -- and so testing the classifier does not mean
// hand-editing storage in devtools.
function forget() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {}
  memoryRecord = null;
  scope = "local";
}

window.QuizResponseQuality = { classify, inspect, forget, REFRESH_WINDOW_DAYS };

})();
