// The side-by-side paywall test: every visitor is dealt one version, kept on
// it, and each sale is stamped with the version that made it. script.js does
// the dealing; this is the server's half, shared by both checkout routes and
// the dashboard so the three can never disagree about the names.
//
//   full  -- the paywall exactly as it was before the test
//   short -- verdict, price and wallets first; the rest behind a toggle

const PAYWALL_VARIANTS = ["full", "short"];

// Nothing before this can carry a variant, so both the GA4 and the Stripe
// tallies start here rather than at whatever range the dashboard is showing.
const PAYWALL_TEST_START = "2026-09-12";

// The variant arrives from the browser, so it is only ever stored if it is
// one of the two known names -- never whatever string was posted.
function cleanVariant(value) {
  return PAYWALL_VARIANTS.indexOf(value) !== -1 ? value : null;
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

module.exports = { PAYWALL_VARIANTS, PAYWALL_TEST_START, cleanVariant, readJsonBody };
