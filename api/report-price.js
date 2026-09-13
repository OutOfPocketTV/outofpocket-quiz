// GET /api/report-price
// Public. Returns the Global Report's price straight from Stripe so the
// paywall can show it before the visitor commits to a checkout redirect.
//
// The price deliberately isn't hardcoded anywhere in this repo -- Stripe is
// the single source of truth, so changing it there can never leave a stale
// number on the site. Read-only: this reads a Price object and nothing else.
//
// The answer is in the visitor's own currency whenever the Price carries one
// for their country -- see lib/local-price.js. That makes the response
// different per visitor, which is why it is no longer cached at the edge.

const Stripe = require("stripe");
const { localPrice, retrievePrice, visitorCountry } = require("../lib/local-price.js");

// The edge cache used to spare Stripe one call per visitor. It cannot cache
// a per-country answer, so a warm instance keeps the Price for a few minutes
// instead -- short enough that a price changed in Stripe shows up quickly.
const PRICE_TTL_MS = 5 * 60 * 1000;
let cachedPrice = null;
let cachedAt = 0;

async function readPrice(secretKey, priceId) {
  if (cachedPrice && Date.now() - cachedAt < PRICE_TTL_MS) return cachedPrice;
  const stripe = new Stripe(secretKey);
  cachedPrice = await retrievePrice(stripe, priceId);
  cachedAt = Date.now();
  return cachedPrice;
}

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
    const price = await readPrice(secretKey, priceId);
    const local = localPrice(price, { country: visitorCountry(req) });

    if (!local) {
      return res.status(200).json({ available: false });
    }

    // Private: a shared cache would hand one country's price to the next
    // visitor from somewhere else.
    res.setHeader("Cache-Control", "private, max-age=300");

    return res.status(200).json({
      available: true,
      amount: local.amount,               // minor units
      currency: local.currency,
      recurring: Boolean(price.recurring), // one-time vs subscription
      // Publishable by design -- it ships inside the page either way. Served
      // here so the paywall can build Stripe Elements from a call it already
      // makes, instead of creating a PaymentIntent just to obtain a key.
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    });
  } catch (err) {
    console.error("Failed to fetch report price from Stripe:", err);
    return res.status(200).json({ available: false });
  }
};
