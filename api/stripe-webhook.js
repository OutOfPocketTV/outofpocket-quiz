// POST /api/stripe-webhook
// The ONLY place premium access is ever granted. Verifies the Stripe
// signature against the raw body, then records the entitlement.
// Idempotent: every processed event ID is stored, so Stripe's automatic
// retries/replays never double-grant access.

const Stripe = require("stripe");
const { sql } = require("@vercel/postgres");

function readRawBody(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed");
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error("Stripe webhook is not configured: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.");
    return res.status(500).end("Webhook not configured.");
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const already = await sql`
      SELECT 1 FROM processed_stripe_events WHERE stripe_event_id = ${event.id}
    `;
    if (already.rowCount > 0) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = (session.customer_details && session.customer_details.email) || null;

      await sql`
        INSERT INTO premium_purchases
          (purchaser_email, stripe_session_id, stripe_payment_intent_id, entitlement_type, status, amount, currency)
        VALUES
          (${email}, ${session.id}, ${session.payment_intent}, 'single_report', 'completed', ${session.amount_total}, ${session.currency})
        ON CONFLICT (stripe_session_id) DO UPDATE
          SET status = 'completed', updated_at = now()
      `;

      await sql`
        INSERT INTO premium_entitlements (email, stripe_session_id, entitlement_type, access_status)
        VALUES (${email}, ${session.id}, 'single_report', 'active')
        ON CONFLICT (stripe_session_id) DO NOTHING
      `;
    }

    // Record last, only after successful handling above -- if anything
    // throws before this point, the event is NOT marked processed, so a
    // Stripe retry safely re-attempts the same (idempotent) inserts.
    await sql`
      INSERT INTO processed_stripe_events (stripe_event_id) VALUES (${event.id})
    `;

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error handling Stripe webhook event", event.id, err);
    return res.status(500).json({ error: "Webhook handling failed." });
  }
};

// Vercel's Node runtime: disable automatic JSON body parsing so we can
// verify Stripe's signature against the exact raw request bytes.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
