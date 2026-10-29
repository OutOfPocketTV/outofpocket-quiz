// The side-by-side paywall test: every visitor is dealt one version, kept on
// it, and each sale is stamped with the version that made it. script.js does
// the dealing; this is the server's half, shared by both checkout routes and
// the dashboard so the three can never disagree about the names.
//
//   full  -- the paywall exactly as it was before the test
//   short -- verdict, price and wallets first; the rest behind a toggle
//   free  -- Find Out shows the U.S. result for nothing, and the card under
//            it sells the Global Report (round 2 only)
//
// The test runs in rounds. A new round re-deals every visitor, and its
// events and sales are named so that nothing from an earlier round can be
// counted in it, whatever day the new round is actually deployed:
//   round 1 -- full vs short. GA4 events pw_full_view, pw_short_buy, ...;
//              sales carry paywall_variant only.
//   round 2 -- full vs short vs free. GA4 events pw2_full_view, ...; sales
//              carry paywall_round "2" as well.
// `start` is the earliest day a round's events could exist. The dashboard
// only uses it to bound its queries.

const PAYWALL_ROUNDS = [
  { round: 1, variants: ["full", "short"], start: "2026-09-12", eventPrefix: "pw" },
  { round: 2, variants: ["full", "short", "free"], start: "2026-10-29", eventPrefix: "pw2" },
];
const CURRENT_ROUND = PAYWALL_ROUNDS[PAYWALL_ROUNDS.length - 1];

// The steps each round's events record. "open" is the free version's own:
// its paywall is the card under the free result, so its "view" happens at
// Find Out and "open" is a visitor asking for the full pitch.
const PAYWALL_STEPS = ["view", "open", "unlock", "buy"];

function roundEvents(r) {
  return r.variants.flatMap((v) => PAYWALL_STEPS.map((step) => `${r.eventPrefix}_${v}_${step}`));
}

// The metadata a sale is stamped with, from what the page posted. The
// variant arrives from the browser, so it is only ever stored if it is one
// the round really deals -- never whatever string was posted. A page still
// running round 1's script posts no round, and its sale is counted with
// round 1, which is the paywall that page showed.
function saleMetadata(body) {
  const current = Number(body && body.paywallRound) === CURRENT_ROUND.round;
  const r = current ? CURRENT_ROUND : PAYWALL_ROUNDS[0];
  const variant = body && body.paywallVariant;
  if (r.variants.indexOf(variant) === -1) return {};
  return r.round === 1
    ? { paywall_variant: variant }
    : { paywall_variant: variant, paywall_round: String(r.round) };
}

// Which round a sale belongs to, from its metadata (see saleMetadata).
function saleRound(metadata) {
  const variant = metadata && metadata.paywall_variant;
  if (!variant) return null;
  const n = metadata.paywall_round ? Number(metadata.paywall_round) : 1;
  const r = PAYWALL_ROUNDS.find((x) => x.round === n);
  return r && r.variants.indexOf(variant) !== -1 ? r : null;
}

// Vercel parses JSON bodies for most routes, but not when the body arrives
// as text, and the hosted fallback has historically posted nothing at all.
function readJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (err) { body = null; }
  }
  return body && typeof body === "object" ? body : {};
}

module.exports = {
  PAYWALL_ROUNDS,
  CURRENT_ROUND,
  PAYWALL_STEPS,
  roundEvents,
  saleMetadata,
  saleRound,
  readJsonBody,
};
