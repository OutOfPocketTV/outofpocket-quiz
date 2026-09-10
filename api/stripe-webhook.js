// POST /api/stripe-webhook
// The ONLY place premium access is ever granted. Verifies the Stripe
// signature against the raw body, then records the entitlement.
// Idempotent: every processed event ID is stored, so Stripe's automatic
// retries/replays never double-grant access.
//
// TWO purchase paths land here, and both must keep working:
//   checkout.session.completed  -- the hosted Checkout redirect, still the
//     fallback whenever js.stripe.com is blocked or Elements cannot start.
//   payment_intent.succeeded    -- Stripe Elements on the paywall itself,
//     which is what allows Apple Pay / Google Pay / Link buttons to sit
//     directly on the pitch rather than inside a checkout iframe.
//
// Access is keyed on `stripe_session_id` in both cases. Nothing downstream
// requires that column to hold a Checkout Session id -- report-access.js
// looks it up as an opaque string, and the emailed link just carries it --
// so an Elements purchase stores its PaymentIntent id there and every
// existing flow (access restore, resend link) works untouched.

const Stripe = require("stripe");
const { sql } = require("@vercel/postgres");
const { sendAccessLinkEmail } = require("../lib/email");

// Where the buyer's email comes from depends on how they paid: a wallet
// supplies it in the charge's billing details, while the card path collects
// it through the Link authentication field. receipt_email covers anything
// set explicitly. The charge is fetched rather than assumed because
// `latest_charge` arrives as an id, not an object.
async function emailForIntent(stripe, intent) {
  if (intent.receipt_email) return intent.receipt_email;
  if (intent.metadata && intent.metadata.buyer_email) return intent.metadata.buyer_email;
  try {
    if (intent.latest_charge) {
      const charge = await stripe.charges.retrieve(
        typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge.id
      );
      return (charge.billing_details && charge.billing_details.email) || null;
    }
  } catch (err) {
    // An email we cannot find is not a reason to withhold access -- the
    // buyer's own browser is the primary way back into the report.
    console.error("Could not read billing email from charge:", err.message);
  }
  return null;
}

// One writer for both paths, so a purchase can never be recorded two
// different ways depending on how it was made.
async function grantAccess({ accessKey, paymentIntentId, email, amount, currency }) {
  await sql`
    INSERT INTO premium_purchases
      (purchaser_email, stripe_session_id, stripe_payment_intent_id, entitlement_type, status, amount, currency)
    VALUES
      (${email}, ${accessKey}, ${paymentIntentId}, 'single_report', 'completed', ${amount}, ${currency})
    ON CONFLICT (stripe_session_id) DO UPDATE
      SET status = 'completed', updated_at = now()
  `;

  await sql`
    INSERT INTO premium_entitlements (email, stripe_session_id, entitlement_type, access_status)
    VALUES (${email}, ${accessKey}, 'single_report', 'active')
    ON CONFLICT (stripe_session_id) DO NOTHING
  `;

  // Best-effort: access is already granted above regardless of whether this
  // send succeeds, since a returning visitor's own browser (localStorage) is
  // the primary way back in -- this email just covers a new device or
  // cleared storage.
  if (email) {
    try {
      await sendAccessLinkEmail(email, accessKey);
    } catch (err) {
      console.error("Failed to send purchase confirmation email:", err);
    }
  }
}

async function markProcessed(eventId) {
  await sql`
    INSERT INTO processed_stripe_events (stripe_event_id) VALUES (${eventId})
    ON CONFLICT (stripe_event_id) DO NOTHING
  `;
}

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
      await grantAccess({
        accessKey: session.id,
        paymentIntentId: session.payment_intent,
        email,
        amount: session.amount_total,
        currency: session.currency,
      });
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;

      // Only intents this site created for the report. Without this guard a
      // PaymentIntent made for anything else on the account (now or later)
      // would silently mint a free entitlement.
      if (!intent.metadata || intent.metadata.product !== "single_report") {
        await markProcessed(event.id);
        return res.status(200).json({ received: true, ignored: "not_a_report_purchase" });
      }

      // The hosted Checkout flow ALSO produces a payment_intent.succeeded.
      // Letting it through here would grant a second entitlement for the same
      // purchase under a different key, so only Elements-created intents are
      // handled on this branch -- the session branch above owns the other.
      if (intent.metadata.source !== "elements") {
        await markProcessed(event.id);
        return res.status(200).json({ received: true, ignored: "handled_via_checkout_session" });
      }

      await grantAccess({
        accessKey: intent.id,
        paymentIntentId: intent.id,
        email: await emailForIntent(stripe, intent),
        amount: intent.amount_received || intent.amount,
        currency: intent.currency,
      });
    }

    // Record last, only after successful handling above -- if anything
    // throws before this point, the event is NOT marked processed, so a
    // Stripe retry safely re-attempts the same (idempotent) inserts.
    await markProcessed(event.id);

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
