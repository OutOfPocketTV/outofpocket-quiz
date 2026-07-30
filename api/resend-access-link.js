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
  message: "If that email made a purchase, we've sent your access link — check your inbox.",
};

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

  try {
    const result = await sql`
      SELECT stripe_session_id FROM premium_entitlements
      WHERE email = ${email} AND access_status = 'active'
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
