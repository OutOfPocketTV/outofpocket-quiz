// GET /api/analytics-dashboard?days=7|30|90
// Pulls funnel + traffic data from the GA4 Data API for the private
// dashboard at /dashboard.html. Requires a password (sent as an
// Authorization: Bearer header) since this is real business data --
// dashboard.html itself is just a static shell with no data baked in.

const { BetaAnalyticsDataClient } = require("@google-analytics/data");

const FUNNEL_EVENTS = ["find_out_click", "paywall_view", "begin_checkout", "purchase"];
const ALLOWED_DAYS = new Set([7, 30, 90]);

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
  const clientEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY;
  if (!propertyId || !clientEmail || !privateKey) {
    console.error("Analytics dashboard is not configured: missing GOOGLE_ANALYTICS_* env vars.");
    return res.status(500).json({ error: "not_configured" });
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

  const funnelQuery = (ranges) => ({
    property,
    dateRanges: ranges,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: { fieldName: "eventName", inListFilter: { values: FUNNEL_EVENTS } },
    },
  });

  try {
    const [seriesReport, funnelReport, countryReport, prevTotalsReport, prevFunnelReport] = await Promise.all([
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
      client.runReport({
        property,
        dateRanges: prevRanges,
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      }),
      client.runReport(funnelQuery(prevRanges)),
    ]);

    const series = (seriesReport[0].rows || []).map((row) => ({
      date: row.dimensionValues[0].value, // YYYYMMDD
      sessions: Number(row.metricValues[0].value),
      users: Number(row.metricValues[1].value),
    }));

    const funnel = Object.fromEntries(FUNNEL_EVENTS.map((name) => [name, 0]));
    for (const row of funnelReport[0].rows || []) {
      const name = row.dimensionValues[0].value;
      if (name in funnel) funnel[name] = Number(row.metricValues[0].value);
    }

    const countries = (countryReport[0].rows || []).map((row) => ({
      country: row.dimensionValues[0].value,
      sessions: Number(row.metricValues[0].value),
    }));

    const totals = series.reduce(
      (acc, day) => ({ sessions: acc.sessions + day.sessions, users: acc.users + day.users }),
      { sessions: 0, users: 0 }
    );

    const prevRow = (prevTotalsReport[0].rows || [])[0];
    const prevTotals = {
      sessions: prevRow ? Number(prevRow.metricValues[0].value) : 0,
      users: prevRow ? Number(prevRow.metricValues[1].value) : 0,
    };

    const prevFunnel = Object.fromEntries(FUNNEL_EVENTS.map((name) => [name, 0]));
    for (const row of prevFunnelReport[0].rows || []) {
      const name = row.dimensionValues[0].value;
      if (name in prevFunnel) prevFunnel[name] = Number(row.metricValues[0].value);
    }

    return res.status(200).json({ days, totals, series, funnel, countries, prevTotals, prevFunnel });
  } catch (err) {
    console.error("Failed to fetch GA4 report:", err);
    return res.status(500).json({ error: "fetch_failed" });
  }
};
