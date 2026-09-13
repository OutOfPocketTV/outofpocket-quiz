// Which price a visitor is shown and charged, in their own currency.
//
// The amounts are NOT here. They live on the Stripe Price as
// currency_options (Product catalog -> the report's price -> add a
// currency), so Stripe stays the single source of truth exactly as it was
// when the site only charged dollars. This file only decides WHICH of the
// Price's currencies a visitor gets:
//
//   1. the currency the page already showed them, if the Price carries it
//      -- so the card form can never be built for one amount and charged
//      another if their IP country flips mid-visit (a VPN, a train);
//   2. otherwise the currency of the country Vercel says they are in, if
//      the Price carries it;
//   3. otherwise the Price's own currency. A visitor from a country with no
//      local option sees exactly what everyone saw before this existed.
//
// With no currency_options set in Stripe, every visitor lands on 3, so
// shipping this changes nothing until a local price is actually added.
//
// Why not Stripe's Adaptive Pricing: it only works with Checkout Sessions,
// and the paywall pays through PaymentIntents. It would also charge odd
// converted amounts (e.g. 0.87) instead of prices someone chose.

// Country -> the currency people there pay in. Deliberately broad: it is
// only consulted for currencies the Price actually has, so a currency added
// in Stripe later starts working here with no code change.
const EUR = ["AD", "AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT",
  "LT", "LU", "LV", "MC", "ME", "MT", "NL", "PT", "SI", "SK", "SM", "VA", "XK"];

const COUNTRY_CURRENCY = Object.assign(
  Object.fromEntries(EUR.map((cc) => [cc, "eur"])),
  {
    GB: "gbp", GG: "gbp", JE: "gbp", IM: "gbp", GI: "gbp",
    CA: "cad", AU: "aud", NZ: "nzd",
    CH: "chf", LI: "chf",
    SE: "sek", NO: "nok", DK: "dkk", FO: "dkk", GL: "dkk",
    PL: "pln", CZ: "czk", HU: "huf", RO: "ron",
    IN: "inr", BR: "brl", MX: "mxn",
    JP: "jpy", KR: "krw", SG: "sgd", HK: "hkd", PH: "php", MY: "myr", TH: "thb", ID: "idr",
    ZA: "zar", AE: "aed", SA: "sar", IL: "ils", TR: "try",
  }
);

function visitorCountry(req) {
  const raw = req && req.headers && req.headers["x-vercel-ip-country"];
  const cc = String(raw || "").toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : "";
}

// currency_options is only returned when asked for, and every caller needs
// it, so the Price is always read through here.
function retrievePrice(stripe, priceId) {
  return stripe.prices.retrieve(priceId, { expand: ["currency_options"] });
}

// -> { amount, currency } in Stripe minor units, or null if the Price has
// no fixed amount at all.
function localPrice(price, { currency, country } = {}) {
  if (!price || price.unit_amount == null) return null;
  const base = { amount: price.unit_amount, currency: price.currency };
  const options = price.currency_options || {};

  const pick = (cur) => {
    if (!cur) return null;
    const code = String(cur).toLowerCase();
    if (code === price.currency) return base;
    const opt = options[code];
    // Tiered or pay-what-you-want options have no single amount to charge.
    if (!opt || opt.unit_amount == null) return null;
    return { amount: opt.unit_amount, currency: code };
  };

  return pick(currency) || pick(COUNTRY_CURRENCY[String(country || "").toUpperCase()]) || base;
}

module.exports = { localPrice, retrievePrice, visitorCountry, COUNTRY_CURRENCY };
