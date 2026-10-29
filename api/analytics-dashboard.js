// GET /api/analytics-dashboard?days=7|30|90
// Pulls funnel + traffic data from the GA4 Data API for the private
// dashboard at /dashboard.html. Requires a password (sent as an
// Authorization: Bearer header) since this is real business data --
// dashboard.html itself is just a static shell with no data baked in.

const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const Stripe = require("stripe");
const { PAYWALL_ROUNDS, roundEvents, saleRound } = require("../lib/paywall-test.js");
const { checkAdminPassword } = require("../lib/admin-auth.js");

const FUNNEL_EVENTS = ["find_out_click", "paywall_view", "begin_checkout", "purchase"];

// Not funnel stages -- data-quality counters. quiz_response fires once per
// person (plus once more for a genuine re-take months later), so comparing
// it against find_out_click is what shows how much of the raw press volume
// is one visitor tweaking sliders. quiz_replay is the post-checkout
// recalculation, which no human triggered.
const RESPONSE_EVENTS = ["quiz_response", "quiz_replay"];
const QUERIED_EVENTS = FUNNEL_EVENTS.concat(RESPONSE_EVENTS);
const ALLOWED_DAYS = new Set([7, 30, 90]);

// The paywall test's own event names, every round's (pw_full_view,
// pw2_free_buy, ...) -- see trackPaywall() in script.js. Plain event names
// rather than a custom dimension, so counting them needs no GA4 admin setup.
const PAYWALL_TEST_EVENTS = PAYWALL_ROUNDS.flatMap(roundEvents);
// Nothing before this can carry a paywall event or a stamped sale.
const PAYWALL_TEST_START = PAYWALL_ROUNDS[0].start;

// Read-only money view: what was earned, what Stripe is still holding, and
// where it has been paid out to. Deliberately READ-ONLY -- this endpoint never
// creates a payout or touches bank details. Stripe pays out on its own
// schedule, and its dashboard is the correct (2FA-protected) place to change
// where the money lands.
async function readStripe(days) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { configured: false };

  const stripe = new Stripe(key);
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  // Succeeded payments only, from search, so abandoned checkouts cannot
  // fill the 100 slots (see readPaywallSales); the plain list if search is
  // unavailable.
  const expand = ["data.latest_charge.balance_transaction"];
  const readIntents = () => stripe.paymentIntents
    .search({ query: `status:'succeeded' AND created>=${since}`, limit: 100, expand })
    .catch(() => stripe.paymentIntents.list({ created: { gte: since }, limit: 100, expand }));

  const [intents, balance, payouts] = await Promise.all([
    readIntents(),
    stripe.balance.retrieve(),
    stripe.payouts.list({ limit: 5, expand: ["data.destination"] }),
  ]);

  const paid = (intents.data || []).filter((pi) => pi.status === "succeeded");
  const currency = balance.available?.[0]?.currency || "usd";

  // A sale can be charged in the buyer's own currency (lib/local-price.js),
  // so adding up amount_received would add pounds to dollars. Each sale's
  // balance transaction says what it became in the account's own currency.
  // In the seconds before that exists, only a same-currency sale can be
  // counted as-is; a foreign one appears on the next refresh.
  const settled = (pi) => {
    const bt = pi.latest_charge && pi.latest_charge.balance_transaction;
    if (bt && typeof bt === "object" && bt.currency === currency) return bt.amount || 0;
    return pi.currency === currency ? pi.amount_received || 0 : 0;
  };
  const gross = paid.reduce((sum, pi) => sum + settled(pi), 0);

  const sumBalance = (list) =>
    (list || []).reduce((sum, b) => sum + (b.amount || 0), 0);

  return {
    configured: true,
    livemode: balance.livemode,
    currency,
    gross,                       // minor units (cents)
    orders: paid.length,
    // A period with >100 payments would be truncated by the list cap above.
    truncated: Boolean(intents.has_more),
    available: sumBalance(balance.available),
    pending: sumBalance(balance.pending),
    payouts: (payouts.data || []).map((p) => {
      const dest = p.destination && typeof p.destination === "object" ? p.destination : null;
      return {
        amount: p.amount,
        currency: p.currency,
        status: p.status,        // paid | pending | in_transit | canceled | failed
        arrival: p.arrival_date, // unix seconds
        // Last four only -- enough to recognise the account, never the full number.
        bank: dest ? [dest.bank_name, dest.last4 && "••" + dest.last4].filter(Boolean).join(" ") : null,
      };
    }),
  };
}

// Sales per round and paywall version since the test began, from the
// metadata the checkout routes stamp on each payment (lib/paywall-test.js
// says which round a sale belongs to), with what each sale actually earned.
// Paged in full rather than capped at 100 like the money panel: a truncated
// tally would not just be short, it could name the wrong winner, so a cap
// that is ever reached is reported.
//
// Earnings decide the test, not the number of sales: the price is local
// (lib/local-price.js) and part of Stripe's fee is fixed, so one sale can
// net twice what another does, and a version that sold more in cheaper
// countries could win on sales and lose money. Each sale's balance
// transaction says what it became after fees, in the account's currency.
// A refunded or disputed sale is not counted at all.
//
// Only succeeded payments can count, and Stripe's search is asked for exactly
// those. Listing every PaymentIntent instead would let abandoned ones --
// which anyone can create by starting a checkout -- crowd real sales out of
// the cap. Search lags a minute or so behind; if it is unavailable, the full
// list is read instead.
const MAX_TEST_PAYMENTS = 5000;

async function readPaywallSales(stripe) {
  const since = Math.floor(Date.parse(PAYWALL_TEST_START + "T00:00:00Z") / 1000);
  const balance = await stripe.balance.retrieve();
  const currency = (balance.available && balance.available[0] && balance.available[0].currency) || "usd";
  const expand = ["data.latest_charge.balance_transaction"];

  const tallyFrom = async (pages) => {
    const tally = Object.fromEntries(PAYWALL_ROUNDS.map((r) => [
      r.round,
      Object.fromEntries(r.variants.map((v) => [v, { sales: 0, net: 0, netSq: 0, unsettled: 0 }])),
    ]));
    let seen = 0;
    await pages.autoPagingEach((pi) => {
      seen += 1;
      const r = pi.status === "succeeded" ? saleRound(pi.metadata) : null;
      const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
      const undone = charge && (charge.refunded || charge.amount_refunded > 0 || charge.disputed);
      if (r && !undone) {
        const arm = tally[r.round][pi.metadata.paywall_variant];
        arm.sales += 1;
        // In the seconds before the balance transaction exists, the sale is
        // counted and its earnings join on a later refresh.
        const bt = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
        if (bt && bt.currency === currency) {
          arm.net += bt.net || 0;
          arm.netSq += (bt.net || 0) * (bt.net || 0);
        } else {
          arm.unsettled += 1;
        }
      }
      return seen < MAX_TEST_PAYMENTS; // false stops paging
    });
    return { tally, currency, truncated: seen >= MAX_TEST_PAYMENTS };
  };

  try {
    return await tallyFrom(stripe.paymentIntents.search({
      query: `status:'succeeded' AND created>=${since}`, limit: 100, expand,
    }));
  } catch (err) {
    console.error("Stripe search unavailable for the paywall test, reading the full list:", err.message);
    return tallyFrom(stripe.paymentIntents.list({ created: { gte: since }, limit: 100, expand }));
  }
}

// The first day each round's events actually appear, as YYYYMMDD. A round's
// `start` is only the earliest it could have begun; this is when it was
// really deployed, which is what "two weeks in" has to count from.
async function readRoundFirstDays(client, property) {
  const [report] = await client.runReport({
    property,
    dateRanges: [{ startDate: PAYWALL_TEST_START, endDate: "today" }],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: { fieldName: "eventName", inListFilter: { values: PAYWALL_TEST_EVENTS } },
    },
    limit: 10000,
  });
  const roundOf = {};
  PAYWALL_ROUNDS.forEach((r) => roundEvents(r).forEach((name) => { roundOf[name] = r.round; }));
  const first = {};
  for (const row of report.rows || []) {
    const date = row.dimensionValues[0].value;
    const round = roundOf[row.dimensionValues[1].value];
    if (round && (!first[round] || date < first[round])) first[round] = date;
  }
  return first;
}

module.exports = async function handler(req, res) {
  // Edit Mode rides along in this function rather than getting its own
  // api/ file: every file under api/ is a Serverless Function and the plan
  // caps a deployment at 12, which this directory is already at. A 13th
  // file fails the BUILD, so nothing deploys at all. This is the least
  // strange host available -- it is already the password-protected admin
  // function, and Edit Mode uses that same password.
  const mode = (req.query && req.query.mode) || "";

  if (req.method !== "GET" && mode.indexOf("edit-") !== 0) {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate-limited and constant-time -- see lib/admin-auth.js. This password
  // can publish to master through Edit Mode, so guessing must not be free.
  const authCheck = await checkAdminPassword(req);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ error: authCheck.error });
  }

  // Everything below this line has proven it holds the dashboard password.
  // So it may be told the password is weak (see lib/admin-auth.js); every
  // answer from here on carries that, errors included, so the warning still
  // shows on a dashboard whose analytics are broken.
  const weakPassword = Boolean(authCheck.weakPassword);

  // Does this password work? The editor asks before showing any control.
  if (mode === "edit-ping") {
    return res.status(200).json({ ok: true, weakPassword });
  }

  // Apply the edits and commit them. lib/site-editor.js decides what is
  // actually allowed to change -- not the browser that sent this.
  if (mode === "edit-publish") {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("Edit Mode: GITHUB_TOKEN is not set.");
      return res.status(500).json({ error: "not_configured" });
    }
    try {
      const { publish } = require("../lib/site-editor.js");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const result = await publish(body, token);
      if (!result.saved) return res.status(200).json(result);
      return res.status(200).json(result);
    } catch (err) {
      console.error("Edit Mode publish failed:", err.message);
      // A 409 means someone (or something) changed index.html between the
      // read and the write. Say so plainly rather than retrying blindly
      // over the top of whatever that change was.
      const clash = err.status === 409 || /sha/i.test(err.message || "");
      return res.status(200).json({
        saved: false,
        error: clash
          ? "the page changed while you were editing, so reload and redo it"
          : "could not save to GitHub",
      });
    }
  }

  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  const clientEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY;
  if (!propertyId || !clientEmail || !privateKey) {
    console.error("Analytics dashboard is not configured: missing GOOGLE_ANALYTICS_* env vars.");
    return res.status(500).json({ error: "not_configured", weakPassword });
  }

  const days = ALLOWED_DAYS.has(Number(req.query.days)) ? Number(req.query.days) : 30;
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  // The equal-length window immediately before this one, so the dashboard's
  // deltas are a real period-over-period comparison rather than decoration.
  const prevRanges = [{ startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` }];

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      // Vercel env vars store the key with literal "\n" sequences, not
      // real newlines -- the PEM parser needs them converted back.
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
  });

  // The funnel counts PEOPLE (totalUsers), not raw eventCount. find_out_click
  // fires on every press, so a single visitor tweaking filters can log it a
  // dozen times -- comparing that to a session/user count produced stages well
  // over 100%. eventCount is still fetched alongside so the Purchases tile can
  // report actual transactions rather than distinct buyers.
  const funnelQuery = (ranges) => ({
    property,
    dateRanges: ranges,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "totalUsers" }, { name: "eventCount" }],
    dimensionFilter: {
      filter: { fieldName: "eventName", inListFilter: { values: QUERIED_EVENTS } },
    },
  });

  // Period totals must come from their own report -- summing the daily series
  // works for sessions but over-counts users, since one person visiting on
  // three days is three daily rows but a single unique user for the period.
  const totalsQuery = (ranges) => ({
    property,
    dateRanges: ranges,
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
  });

  try {
    const [seriesReport, funnelReport, countryReport, totalsReport, prevTotalsReport, prevFunnelReport] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      client.runReport(funnelQuery(dateRanges)),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      client.runReport(totalsQuery(dateRanges)),
      client.runReport(totalsQuery(prevRanges)),
      client.runReport(funnelQuery(prevRanges)),
    ]);

    const series = (seriesReport[0].rows || []).map((row) => ({
      date: row.dimensionValues[0].value, // YYYYMMDD
      sessions: Number(row.metricValues[0].value),
      users: Number(row.metricValues[1].value),
    }));

    // funnel[event] = distinct users; funnelEvents[event] = raw event count.
    const readFunnel = (report) => {
      const users = Object.fromEntries(QUERIED_EVENTS.map((name) => [name, 0]));
      const events = Object.fromEntries(QUERIED_EVENTS.map((name) => [name, 0]));
      for (const row of report[0].rows || []) {
        const name = row.dimensionValues[0].value;
        if (!(name in users)) continue;
        users[name] = Number(row.metricValues[0].value);
        events[name] = Number(row.metricValues[1].value);
      }
      return { users, events };
    };

    const readTotals = (report) => {
      const row = (report[0].rows || [])[0];
      return {
        sessions: row ? Number(row.metricValues[0].value) : 0,
        users: row ? Number(row.metricValues[1].value) : 0,
      };
    };

    const countries = (countryReport[0].rows || []).map((row) => ({
      country: row.dimensionValues[0].value,
      sessions: Number(row.metricValues[0].value),
    }));

    const curr = readFunnel(funnelReport);
    const prev = readFunnel(prevFunnelReport);

    // The primary/re-take split needs response_quality registered as a custom
    // dimension in GA4 Admin -> Custom definitions. Until someone does that,
    // GA4 rejects the dimension outright -- so this runs on its own rather
    // than inside the Promise.all above, where one 400 would take the whole
    // dashboard down over an optional breakdown. Absent means "not set up
    // yet", and the card says so instead of showing a silent zero.
    let responseSplit = null;
    try {
      const [splitReport] = await client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: "customEvent:response_quality" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: { fieldName: "eventName", stringFilter: { value: "quiz_response" } },
        },
      });
      responseSplit = {};
      for (const row of splitReport.rows || []) {
        responseSplit[row.dimensionValues[0].value] = Number(row.metricValues[0].value);
      }
    } catch (err) {
      console.error("response_quality breakdown unavailable (register the custom dimension in GA4):", err.message);
    }

    // The paywall test is scored from its own start date, not the range the
    // dashboard is showing -- a 7-day view of a test that began a month ago
    // would throw most of the evidence away. Optional like the split above:
    // a failure here leaves the card saying so, not the dashboard down.
    let paywallTest = null;
    try {
      const [testReport] = await client.runReport({
        property,
        dateRanges: [{ startDate: PAYWALL_TEST_START, endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: {
          filter: { fieldName: "eventName", inListFilter: { values: PAYWALL_TEST_EVENTS } },
        },
      });
      const users = Object.fromEntries(PAYWALL_TEST_EVENTS.map((name) => [name, 0]));
      for (const row of testReport.rows || []) {
        const name = row.dimensionValues[0].value;
        if (name in users) users[name] = Number(row.metricValues[0].value);
      }
      let firstDays = {};
      try {
        firstDays = await readRoundFirstDays(client, property);
      } catch (err) {
        console.error("Paywall test start days unavailable:", err.message);
      }
      // Real sales are the score; GA4's buy events are only the fallback,
      // since ad blockers hide some buyers from GA4 but never from Stripe.
      let stripeSales = null;
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          stripeSales = await readPaywallSales(new Stripe(process.env.STRIPE_SECRET_KEY));
        } catch (err) {
          console.error("Paywall test sales unavailable from Stripe:", err);
        }
      }
      // Newest round first: it is the one being decided.
      paywallTest = {
        rounds: PAYWALL_ROUNDS.slice().reverse().map((r) => {
          const arms = stripeSales ? stripeSales.tally[r.round] : null;
          return {
            round: r.round,
            since: r.start,
            firstDay: firstDays[r.round] || null,
            variants: r.variants,
            users: Object.fromEntries(roundEvents(r).map((name) => [name.slice(r.eventPrefix.length + 1), users[name]])),
            sales: arms ? Object.fromEntries(r.variants.map((v) => [v, arms[v].sales])) : null,
            earnings: arms ? Object.fromEntries(r.variants.map((v) => [v, { net: arms[v].net, netSq: arms[v].netSq, unsettled: arms[v].unsettled }])) : null,
          };
        }),
        currency: stripeSales ? stripeSales.currency : null,
        salesTruncated: Boolean(stripeSales && stripeSales.truncated),
      };
    } catch (err) {
      console.error("Paywall test report unavailable:", err);
    }

    // Stripe is a bonus panel, not a dependency -- if it fails, the analytics
    // still render and the card explains itself.
    let stripe = { configured: false, error: true };
    try {
      stripe = await readStripe(days);
    } catch (err) {
      console.error("Failed to fetch Stripe summary:", err);
    }

    return res.status(200).json({
      weakPassword,
      stripe,
      days,
      totals: readTotals(totalsReport),
      prevTotals: readTotals(prevTotalsReport),
      series,
      funnel: curr.users,
      funnelEvents: curr.events,
      responseSplit,
      paywallTest,
      prevFunnel: prev.users,
      prevFunnelEvents: prev.events,
      countries,
    });
  } catch (err) {
    console.error("Failed to fetch GA4 report:", err);
    return res.status(500).json({ error: "fetch_failed", weakPassword });
  }
};
