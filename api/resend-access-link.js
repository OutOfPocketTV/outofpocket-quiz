// POST /api/resend-access-link
// Lets a returning visitor without persisted access (new device, cleared
// storage) get their report-access link re-emailed by entering the same
// email they purchased with. Always returns the same generic response
// regardless of whether a match was found, so this can't be used to
// probe which emails have purchased.

const { sql } = require("@vercel/postgres");
const { sendAccessLinkEmail } = require("../lib/email");

const GENERIC_RESPONSE = {
  ok: true,
  message: "If that email made a purchase, we've sent your access link. Check your inbox.",
};

// Anyone can post any address here, so without a ceiling one script could
// send a real buyer hundreds of "your report is ready" emails and burn the
// sending quota. A few tries an hour per address and per caller is plenty
// for a person who mistyped once. Counted in Postgres (serverless memory
// does not survive between calls), same approach as lib/admin-auth.js, and
// skipped rather than enforced if the table cannot be read: a database
// hiccup must not stop a real buyer getting their link.
const MAX_PER_HOUR = 3;
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await sql`CREATE TABLE IF NOT EXISTS access_link_requests (ip TEXT NOT NULL, email TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS idx_access_link_requests_at ON access_link_requests (requested_at)`;
  tableReady = true;
}

function clientIp(req) {
  const fwd = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim();
  return fwd || String((req.headers && req.headers["x-real-ip"]) || "unknown");
}

// -> true when this caller or this address has already had its share this hour.
async function overLimit(ip, email) {
  try {
    await ensureTable();
    const result = await sql`
      SELECT COUNT(*)::int AS n FROM access_link_requests
      WHERE (ip = ${ip} OR email = ${email}) AND requested_at > now() - interval '1 hour'
    `;
    if (((result.rows[0] && result.rows[0].n) || 0) >= MAX_PER_HOUR) return true;
    await sql`INSERT INTO access_link_requests (ip, email) VALUES (${ip}, ${email})`;
    await sql`DELETE FROM access_link_requests WHERE requested_at < now() - interval '1 day'`;
    return false;
  } catch (err) {
    console.error("resend-access-link: could not check the rate limit, skipping it:", err.message);
    return false;
  }
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.body && req.body.email;
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  // Same generic answer as a miss, so the limit itself says nothing about
  // whether the address has ever bought.
  if (await overLimit(clientIp(req), email.trim().toLowerCase())) {
    return res.status(200).json(GENERIC_RESPONSE);
  }

  try {
    // Case-insensitive: the stored email is however it was typed at checkout
    // (or capitalised by a wallet), and "Jake@Gmail.com" at checkout must
    // still match "jake@gmail.com" typed here.
    const result = await sql`
      SELECT stripe_session_id FROM premium_entitlements
      WHERE lower(email) = lower(${email.trim()}) AND access_status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const row = result.rows[0];
    if (row) {
      await sendAccessLinkEmail(email, row.stripe_session_id).catch((err) => {
        console.error("Failed to send resend-access-link email:", err);
      });
    }
  } catch (err) {
    console.error("Error looking up entitlement for resend-access-link:", err);
    // Still fall through to the generic response below -- never leak
    // whether the lookup failed vs. simply found no match.
  }

  return res.status(200).json(GENERIC_RESPONSE);
};
