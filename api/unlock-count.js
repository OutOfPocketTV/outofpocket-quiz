// GET /api/unlock-count
// Public. How many people have actually unlocked the report -- counted from
// our own entitlements table, which only the Stripe webhook writes.
//
// Read from the database rather than by paginating Stripe: it is one indexed
// query instead of walking every payment intent ever made, and it counts the
// thing we actually mean (granted access) rather than the thing Stripe knows
// (charges, including any that were later refunded away).
//
// The number is never invented and never rounded up. If it is too small to
// be worth showing, this says so and the paywall stays quiet rather than
// announcing that hardly anyone has bought -- which is worse than saying
// nothing at all.

const { sql } = require("@vercel/postgres");

// Below this, social proof works against us. Chosen so the line only ever
// appears once it is genuinely reassuring.
const MIN_TO_SHOW = 100;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await sql`
      SELECT COUNT(*)::int AS count
      FROM premium_entitlements
      WHERE access_status = 'active'
    `;
    const count = (result.rows[0] && result.rows[0].count) || 0;

    // Cached at the edge: this changes slowly, and every paywall view would
    // otherwise be a database round trip.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

    return res.status(200).json({
      show: count >= MIN_TO_SHOW,
      count,
    });
  } catch (err) {
    // A failure here must never be visible: the paywall simply omits the line.
    console.error("Failed to count unlocks:", err);
    return res.status(200).json({ show: false });
  }
};
