// GET /api/report-access?session_id=...
// Verifies premium access against OUR OWN database row -- written only
// by the webhook -- never by trusting the success-page redirect alone.

const { sql } = require("@vercel/postgres");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionId = req.query.session_id;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ access: "denied", error: "Missing session_id" });
  }

  try {
    const result = await sql`
      SELECT access_status FROM premium_entitlements
      WHERE stripe_session_id = ${sessionId}
      LIMIT 1
    `;
    const row = result.rows[0];
    if (row && row.access_status === "active") {
      return res.status(200).json({ access: "granted" });
    }
    // Not found likely means the webhook hasn't landed yet (Stripe can
    // take a few seconds) rather than a genuinely denied purchase.
    return res.status(200).json({ access: "denied" });
  } catch (err) {
    console.error("Error checking report access:", err);
    return res.status(500).json({ access: "denied", error: "Lookup failed." });
  }
};
