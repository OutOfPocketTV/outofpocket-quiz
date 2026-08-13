// GET /api/report-price
// Public. Returns the Global Report's price straight from Stripe so the
// paywall can show it before the visitor commits to a checkout redirect.
//
// The price deliberately isn't hardcoded anywhere in this repo -- Stripe is
// the single source of truth, so changing it there can never leave a stale
// number on the site. Read-only: this reads a Price object and nothing else.

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_GLOBAL_REPORT_PRICE_ID;
  if (!secretKey || !priceId) {
    // The paywall falls back to its price-less copy, so this is never fatal.
    return res.status(200).json({ available: false });
  }

  try {
    const stripe = new Stripe(secretKey);
    const price = await stripe.prices.retrieve(priceId);

    if (price.unit_amount == null) {
      return res.status(200).json({ available: false });
    }

    // Cached at the edge: the price changes rarely, and every visitor who
    // reaches the paywall would otherwise cost a Stripe API call.
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

    return res.status(200).json({
      available: true,
      amount: price.unit_amount,          // minor units
      currency: price.currency,
      recurring: Boolean(price.recurring), // one-time vs subscription
    });
  } catch (err) {
    console.error("Failed to fetch report price from Stripe:", err);
    return res.status(200).json({ available: false });
  }
};
