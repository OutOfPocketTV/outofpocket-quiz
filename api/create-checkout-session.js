// POST /api/create-checkout-session
// Creates a Stripe Checkout Session server-side for the single_report
// price. The secret key never leaves this function -- the client only
// ever receives the resulting redirect URL.

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_GLOBAL_REPORT_PRICE_ID;

  // Fail loudly to the client with a clean error, but never crash --
  // the free calculator must keep working even if Stripe isn't
  // configured yet (e.g. local/dev environments).
  if (!secretKey || !priceId) {
    console.error("Stripe is not configured: missing STRIPE_SECRET_KEY or STRIPE_GLOBAL_REPORT_PRICE_ID.");
    return res.status(500).json({ error: "Checkout is not configured yet." });
  }

  const stripe = new Stripe(secretKey);
  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Guest checkout: Stripe collects the email itself, no account
      // required on our side.
      customer_creation: "if_required",
      success_url: `${origin}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?status=cancelled`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Failed to create Stripe checkout session:", err);
    return res.status(500).json({ error: "Could not start checkout." });
  }
};
