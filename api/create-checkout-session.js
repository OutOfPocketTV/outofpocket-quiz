// POST /api/create-checkout-session
// Creates a Stripe Checkout Session server-side for the single_report
// price. The secret key never leaves this function -- the client only
// ever receives a client secret (embedded) or a redirect URL (hosted).
//
// Two modes, because one of them has to keep working when the other cannot:
//
//   embedded (default) -- returns a client secret the page mounts inline, so
//     the visitor pays without ever leaving the site. For a one-dollar
//     impulse purchase the round trip to Stripe's own page and back was
//     costing sales at every hop, and none of that loss was visible.
//   hosted (fallback)  -- the original full-page redirect. Still reachable
//     because js.stripe.com is a common ad-blocker target: if the embedded
//     script cannot load, the sale must not become impossible.
//
// Either way Stripe renders the card fields itself and no card data ever
// reaches this code.

const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_GLOBAL_REPORT_PRICE_ID;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  // Fail loudly to the client with a clean error, but never crash --
  // the calculator must keep working even if Stripe isn't configured
  // yet (e.g. local/dev environments).
  if (!secretKey || !priceId) {
    console.error("Stripe is not configured: missing STRIPE_SECRET_KEY or STRIPE_GLOBAL_REPORT_PRICE_ID.");
    return res.status(500).json({ error: "Checkout is not configured yet." });
  }

  const stripe = new Stripe(secretKey);
  const origin = req.headers.origin || `https://${req.headers.host}`;

  // Body parsing is defensive: this route is also called with no body at all
  // by the hosted fallback path.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (err) { body = {}; }
  }
  const wantsHosted = Boolean(body && body.hosted);

  // Embedded needs a publishable key on the page to mount at all, so without
  // one configured the only honest answer is the hosted redirect.
  const useEmbedded = !wantsHosted && Boolean(publishableKey);

  try {
    if (useEmbedded) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_creation: "if_required",
        // "never" is the whole point: Stripe completes the payment in place
        // and hands control back to our onComplete handler, so the page is
        // never torn down and the visitor's filters survive the purchase.
        redirect_on_completion: "never",
      });

      return res.status(200).json({
        mode: "embedded",
        clientSecret: session.client_secret,
        // Returned so the page can verify the purchase against our own
        // database afterwards, exactly as the redirect flow does.
        sessionId: session.id,
        publishableKey,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Guest checkout: Stripe collects the email itself, no account
      // required on our side.
      customer_creation: "if_required",
      success_url: `${origin}/?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?status=cancelled`,
    });
    return res.status(200).json({ mode: "hosted", url: session.url });
  } catch (err) {
    console.error("Failed to create Stripe checkout session:", err);
    return res.status(500).json({ error: "Could not start checkout." });
  }
};
