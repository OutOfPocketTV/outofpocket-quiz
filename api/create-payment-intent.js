// POST /api/create-payment-intent
// Creates a PaymentIntent for the single_report price, so the paywall can
// render Stripe Elements -- including the Express Checkout Element, which is
// what puts Apple Pay / Google Pay / Link buttons directly on the pitch
// instead of one tap deeper inside a checkout iframe.
//
// This exists ALONGSIDE create-checkout-session.js rather than replacing it.
// That file is still the fallback for a browser where js.stripe.com is
// blocked, and the webhook grants access from either path, so a failure here
// can never mean a lost sale.
//
// The secret key never leaves this function: the client receives only a
// client secret, which authorises confirming this one payment and nothing
// else.

const Stripe = require("stripe");
const { localPrice, retrievePrice, visitorCountry } = require("../lib/local-price.js");
const { cleanVariant, readJsonBody } = require("../lib/paywall-test.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_GLOBAL_REPORT_PRICE_ID;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey || !priceId || !publishableKey) {
    // Not fatal: the client falls back to the hosted redirect, which needs
    // none of the publishable key or Elements.
    console.error("Elements checkout unavailable: missing STRIPE_SECRET_KEY, STRIPE_GLOBAL_REPORT_PRICE_ID or STRIPE_PUBLISHABLE_KEY.");
    return res.status(503).json({ error: "elements_unavailable" });
  }

  const stripe = new Stripe(secretKey);
  const body = readJsonBody(req);

  try {
    // The amount is read from the Price rather than hardcoded, for the same
    // reason report-price.js does it: Stripe is the single source of truth,
    // so changing the price there can never leave this endpoint charging a
    // stale figure.
    const price = await retrievePrice(stripe, priceId);
    // The page says which currency it built the payment form in. It is
    // honoured only if the Price really carries that currency, and the
    // AMOUNT always comes from Stripe -- the browser chooses between the
    // prices set in Stripe, never the number.
    const local = localPrice(price, { currency: body.currency, country: visitorCountry(req) });
    if (!local) {
      console.error("Price has no unit_amount; cannot build a PaymentIntent.");
      return res.status(503).json({ error: "elements_unavailable" });
    }

    const variant = cleanVariant(body.paywallVariant);
    const intent = await stripe.paymentIntents.create({
      amount: local.amount,
      currency: local.currency,
      // Lets the wallets and card methods enabled in the Stripe dashboard
      // decide what appears, exactly as Checkout did -- rather than pinning
      // a list here that would silently drift from the dashboard.
      automatic_payment_methods: { enabled: true },
      description: "Global Dream Partner Report — outofpocket.tv",
      metadata: Object.assign(
        {
          product: "single_report",
          source: "elements",
        },
        // Which paywall made the sale -- see lib/paywall-test.js.
        variant ? { paywall_variant: variant } : {}
      ),
    });

    return res.status(200).json({
      clientSecret: intent.client_secret,
      // Used to verify access afterwards and stored as the entitlement key,
      // exactly where a Checkout Session id would have gone.
      paymentIntentId: intent.id,
      publishableKey,
      amount: local.amount,
      currency: local.currency,
    });
  } catch (err) {
    console.error("Failed to create PaymentIntent:", err);
    return res.status(500).json({ error: "Could not start checkout." });
  }
};
