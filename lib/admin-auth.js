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

// -> { ok: true } or { ok: false, status, error }. Callers send
// `res.status(status).json({ error })` on failure.
async function checkAdminPassword(req) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return { ok: false, status: 401, error: "Unauthorized" };

  const ip = clientIp(req);
  if ((await recentFailures(ip)) >= MAX_FAILURES) {
    return { ok: false, status: 429, error: "too_many_attempts" };
  }

  const auth = String((req.headers && req.headers.authorization) || "");
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (provided && safeEqual(provided, password)) return { ok: true };

  await recordFailure(ip);
  return { ok: false, status: 401, error: "Unauthorized" };
}

module.exports = { checkAdminPassword, MAX_FAILURES, WINDOW_MINUTES };
