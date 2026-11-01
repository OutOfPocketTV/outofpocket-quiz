// The one password check for the site's admin routes: the analytics
// dashboard, the analytics export, and Edit Mode (which rides inside the
// dashboard function and can commit to master -- a live deploy).
//
// Two things a plain `provided !== password` did not do:
//   1. Limit guessing. Both URLs are public, so without a limit anyone can
//      script guesses forever. After MAX_FAILURES wrong passwords from one
//      address inside WINDOW_MINUTES, that address is refused outright --
//      even with the right password -- until the window passes.
//   2. Compare in constant time, so response timing says nothing about how
//      much of a guess was right.
//
// Failures are counted in Postgres, not in memory: serverless instances come
// and go, so an in-memory counter would reset every cold start. If the
// database is unreachable the limit is skipped rather than enforced -- a
// database outage must never lock Tom out of his own dashboard.
//
// Lives in lib/ because api/ is at Vercel's 12-function cap.

const crypto = require("crypto");
const { sql } = require("@vercel/postgres");

const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;

// The per-address limit alone lets a guesser with many addresses make ten
// tries from each. Once wrong guesses across ALL addresses pass this many
// in the window, any address that has already guessed wrong is refused
// until things calm down. An address with no wrong guesses (Tom on his
// own connection) is never refused by this rule, so an attack can slow
// the attacker to one guess per address but cannot lock Tom out.
const MAX_GLOBAL_FAILURES = 50;

// The limits above only buy time: a password a person could guess, or one
// that appears in leaked-password lists, falls to patient guessing anyway.
// This never refuses or locks anything. It only lets the dashboard and Edit
// Mode tell Tom, after he has signed in, that the password should change.
const MIN_STRONG_LENGTH = 16;
const COMMON_PARTS = ["password", "passw0rd", "outofpocket", "dashboard", "admin", "letmein", "qwerty", "123456", "abc123", "iloveyou"];

function isWeakPassword(password) {
  const pw = String(password || "");
  if (pw.length < MIN_STRONG_LENGTH) return true;
  if (new Set(pw).size < 8) return true; // "aaaaaaaaaaaaaaaa1"
  const lower = pw.toLowerCase();
  return COMMON_PARTS.some((part) => lower.includes(part));
}

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await sql`CREATE TABLE IF NOT EXISTS admin_auth_failures (ip TEXT NOT NULL, failed_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_auth_failures_ip ON admin_auth_failures (ip, failed_at)`;
  tableReady = true;
}

// Vercel puts the real client first in x-forwarded-for.
function clientIp(req) {
  const fwd = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim();
  return fwd || String((req.headers && req.headers["x-real-ip"]) || "unknown");
}

// Hashing first makes both sides the same length, which timingSafeEqual
// requires, without revealing the real password's length.
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function recentFailures(ip) {
  try {
    await ensureTable();
    const result = await sql`
      SELECT COUNT(*)::int AS n FROM admin_auth_failures
      WHERE ip = ${ip} AND failed_at > now() - (${WINDOW_MINUTES} * interval '1 minute')
    `;
    return (result.rows[0] && result.rows[0].n) || 0;
  } catch (err) {
    console.error("admin-auth: could not read failures, skipping the limit:", err.message);
    return 0;
  }
}

async function recentGlobalFailures() {
  try {
    await ensureTable();
    const result = await sql`
      SELECT COUNT(*)::int AS n FROM admin_auth_failures
      WHERE failed_at > now() - (${WINDOW_MINUTES} * interval '1 minute')
    `;
    return (result.rows[0] && result.rows[0].n) || 0;
  } catch (err) {
    console.error("admin-auth: could not read global failures, skipping that limit:", err.message);
    return 0;
  }
}

async function recordFailure(ip) {
  try {
    await ensureTable();
    await sql`INSERT INTO admin_auth_failures (ip) VALUES (${ip})`;
    // Keeps the table from growing forever; nothing older than a day matters.
    await sql`DELETE FROM admin_auth_failures WHERE failed_at < now() - interval '1 day'`;
  } catch (err) {
    console.error("admin-auth: could not record a failure:", err.message);
  }
}

// -> { ok: true, weakPassword } or { ok: false, status, error }. Callers
// send `res.status(status).json({ error })` on failure.
async function checkAdminPassword(req) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return { ok: false, status: 401, error: "Unauthorized" };

  const ip = clientIp(req);
  const ipFailures = await recentFailures(ip);
  if (ipFailures >= MAX_FAILURES) {
    return { ok: false, status: 429, error: "too_many_attempts" };
  }
  if (ipFailures > 0 && (await recentGlobalFailures()) >= MAX_GLOBAL_FAILURES) {
    return { ok: false, status: 429, error: "too_many_attempts" };
  }

  const auth = String((req.headers && req.headers.authorization) || "");
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (provided && safeEqual(provided, password)) return { ok: true, weakPassword: isWeakPassword(password) };

  await recordFailure(ip);
  return { ok: false, status: 401, error: "Unauthorized" };
}

module.exports = { checkAdminPassword, isWeakPassword, MAX_FAILURES, MAX_GLOBAL_FAILURES, WINDOW_MINUTES };
