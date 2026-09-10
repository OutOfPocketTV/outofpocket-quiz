// GET /api/analytics-export?days=N[&probe=1]
//
// Pulls the raw analytics history out of GA4 so it can be kept somewhere that
// is actually ours. GA4 is a reporting tool, not an archive: event-level data
// ages out on the property's retention setting (the default is 2 months, and
// 14 is the maximum), and once it has aged out it is gone -- there is no
// "restore" and no support ticket that brings it back.
//
// This matters most for everything recorded BEFORE the de-duplication landed
// on 2026-09-10. That history cannot be cleaned up after the fact -- it has no
// respondent identity in it, so there is no way to tell one person's twelfth
// press from twelve people's first. It is still real evidence of what the site
// was asked for; it just answers a narrower question, and it is worth keeping
// rather than letting a retention window quietly delete it.
//
// Same Bearer password as the dashboard. Read-only: it runs reports, and
// writes nothing back to GA4.

const { BetaAnalyticsDataClient } = require("@google-analytics/data");

// The filter values script.js has always attached to find_out_click. GA4
// collects event parameters whether or not anyone registered them, but it will
// only REPORT one that has been registered as a custom dimension -- an
// unregistered parameter is quietly unqueryable, which is a bad thing to
// discover years later when the data you wanted is also past retention.
// So each of these is probed rather than assumed (see probeDimensions).
const FILTER_PARAMS = [
  "target_sex", "age_lo", "age_hi", "selected_races", "selected_orientations",
  "selected_religions", "min_height", "min_income", "body_types",
  "exclude_married", "exclude_kids", "exclude_gambles", "report_unlocked",
  "country_mode", "country_code", "background_categories",
  // Only present from 2026-09-10 onward; harmless to probe for earlier ranges.
  "response_quality", "identity_scope", "epoch", "attempt_number",
];

const EVENTS = [
  "find_out_click", "paywall_view", "begin_checkout", "purchase",
  "quiz_response", "quiz_replay",
];

// The day the de-duplication went live. Anything before this is press-weighted
// and must never be added to a quiz_response count.
const DEDUPE_LIVE_FROM = "2026-09-10";

function makeClient() {
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL,
      // Vercel stores the key with literal "\n" sequences, not real newlines.
      private_key: (process.env.GOOGLE_ANALYTICS_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
  });
}

// Asks GA4 for one row against each parameter and records whether it answered.
// A rejection here is the actual finding: it means that parameter has been
// collected but never registered, so none of its history is reportable.
async function probeDimensions(client, property, dateRanges) {
  const queryable = [];
  const unregistered = [];

  for (const name of FILTER_PARAMS) {
    try {
      await client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: `customEvent:${name}` }],
        metrics: [{ name: "eventCount" }],
        limit: 1,
      });
      queryable.push(name);
    } catch (err) {
      unregistered.push(name);
    }
  }

  return { queryable, unregistered };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const password = process.env.DASHBOARD_PASSWORD;
  const auth = req.headers.authorization || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!password || provided !== password) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  if (!propertyId || !process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL || !process.env.GOOGLE_ANALYTICS_PRIVATE_KEY) {
    return res.status(500).json({ error: "not_configured" });
  }

  // Deliberately unbounded, unlike the dashboard's 7/30/90: the point of an
  // export is to reach as far back as the property still holds. Capped at
  // ~5 years so a typo cannot ask GA4 for something absurd.
  const days = Math.min(Math.max(Number(req.query.days) || 400, 1), 1825);
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const client = makeClient();

  try {
    // Which of the filter parameters are actually reportable. Worth knowing
    // before trusting any answer about "what people searched for".
    const probe = await probeDimensions(client, property, dateRanges);

    // Daily event counts per event name. Always available -- event NAMES are
    // never subject to the custom-dimension problem above.
    const [daily] = await client.runReport({
      property,
      dateRanges,
      dimensions: [{ name: "date" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
      dimensionFilter: {
        filter: { fieldName: "eventName", inListFilter: { values: EVENTS } },
      },
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 100000,
    });

    const series = (daily.rows || []).map((row) => ({
      date: row.dimensionValues[0].value,
      event: row.dimensionValues[1].value,
      events: Number(row.metricValues[0].value),
      users: Number(row.metricValues[1].value),
    }));

    // Every filter breakdown we can actually get. Each is returned with the
    // era it belongs to, so a consumer cannot silently blend the two.
    const breakdowns = {};
    for (const name of probe.queryable) {
      try {
        const [report] = await client.runReport({
          property,
          dateRanges,
          dimensions: [{ name: "date" }, { name: `customEvent:${name}` }],
          metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
          dimensionFilter: {
            filter: { fieldName: "eventName", inListFilter: { values: ["find_out_click", "quiz_response"] } },
          },
          limit: 100000,
        });
        breakdowns[name] = (report.rows || []).map((row) => ({
          date: row.dimensionValues[0].value,
          value: row.dimensionValues[1].value,
          events: Number(row.metricValues[0].value),
          users: Number(row.metricValues[1].value),
        }));
      } catch (err) {
        breakdowns[name] = { error: err.message };
      }
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      propertyId,
      requestedDays: days,
      dedupeLiveFrom: DEDUPE_LIVE_FROM,
      // Said plainly in the file itself, because an export outlives the
      // conversation that produced it and will be read by someone who does
      // not remember any of this.
      readMe: {
        beforeDedupe:
          "Rows dated before " + DEDUPE_LIVE_FROM + " count BUTTON PRESSES, not people. " +
          "One visitor could press Find Out a dozen times and each press is a separate row. " +
          "Valid for: traffic shape over time, funnel conversion (which is user-counted at " +
          "the source), which filters got touched at all, and relative popularity WITHIN a " +
          "single day. Not valid for: 'how many people want X', or any comparison against " +
          "quiz_response counts.",
        fromDedupe:
          "quiz_response rows are one per person, plus one more if they returned 180+ days " +
          "later. These are the rows to use for 'what are people looking for'. " +
          "find_out_click continues to count every press and stays press-weighted.",
        neverDoThis:
          "Do not add pre-" + DEDUPE_LIVE_FROM + " find_out_click counts to post-" +
          DEDUPE_LIVE_FROM + " quiz_response counts. They measure different things and the " +
          "sum is meaningless.",
      },
      dimensions: {
        queryable: probe.queryable,
        unregistered: probe.unregistered,
        note:
          probe.unregistered.length
            ? "These parameters are being COLLECTED but were never registered as custom " +
              "dimensions in GA4, so their history is not reportable and is not in this file. " +
              "Registering one now (Admin -> Custom definitions) does not backfill it."
            : "All known filter parameters are reportable.",
      },
      series,
      breakdowns,
    };

    if (req.query.format === "csv") {
      const rows = [["date", "event", "events", "users"]].concat(
        series.map((r) => [r.date, r.event, r.events, r.users])
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="oop-analytics-${Date.now()}.csv"`);
      return res.status(200).send(rows.map((r) => r.join(",")).join("\n"));
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="oop-analytics-${Date.now()}.json"`);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Analytics export failed:", err);
    return res.status(500).json({ error: "export_failed", detail: err.message });
  }
};
