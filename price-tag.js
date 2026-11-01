// Puts the Global Report's real price into reading pages (About, FAQ), from
// the same /api/report-price the paywall uses. The price lives only in
// Stripe, so a page that typed it in would go stale the day it changed.
//
// Each element marked data-price-template keeps the price-free sentence the
// page was written with, and only swaps to the template, with {price}
// filled in, once Stripe has answered. No JavaScript, no Stripe, or a
// subscription price: the original sentence stays, and it is still true.
(function () {
  "use strict";
  var targets = document.querySelectorAll("[data-price-template]");
  if (!targets.length || !window.fetch) return;

  // Stripe counts these in whole units: a ¥150 price arrives as 150, not
  // 15000. The same list as formatMoney() in script.js.
  var ZERO_DECIMAL = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"];

  function formatMoney(minorUnits, currency) {
    var code = String(currency || "usd").toLowerCase();
    var value = ZERO_DECIMAL.indexOf(code) !== -1 ? minorUnits : minorUnits / 100;
    try {
      return value.toLocaleString(undefined, {
        style: "currency",
        currency: code.toUpperCase(),
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
      });
    } catch (err) {
      return code.toUpperCase() + " " + value.toFixed(2);
    }
  }

  fetch("/api/report-price")
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (price) {
      if (!price || !price.available || price.recurring || typeof price.amount !== "number") return;
      var text = formatMoney(price.amount, price.currency);
      Array.prototype.forEach.call(targets, function (el) {
        el.textContent = el.getAttribute("data-price-template").replace("{price}", text);
      });
    })
    .catch(function () { /* the page's own wording stays */ });
})();
