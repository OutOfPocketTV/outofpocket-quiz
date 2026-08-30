// StreamElements -> Out Of Pocket relay
//
// Paste this into a StreamElements **Custom Widget** (Overlay editor ->
// add widget -> Custom -> Widget tab -> JS), then add that overlay to OBS
// as a browser source. It needs no HTML and draws nothing: it exists only
// to forward tips into the relay so they reach the donation alert and the
// bottom-bar marquee alongside the native platform gifts.
//
// Why a widget rather than the relay connecting to StreamElements itself:
// relay.js is deliberately zero-dependency (see the comment at the top of
// it), and StreamElements' event feed is socket.io, which would mean
// adding one. A custom widget already sits inside that feed, and a browser
// source can reach 127.0.0.1 perfectly well, so the socket stays on
// StreamElements' side of the fence and the relay stays dependency-free.
//
// The overlay must be running in OBS for this to fire. If StreamElements
// is only open in a normal browser tab, tips still arrive there -- they
// just won't reach the relay.

const RELAY = "http://127.0.0.1:4700";

function forward(donation) {
  fetch(RELAY + "/hype", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ donation }),
    keepalive: true,
  }).catch(function () {
    // Relay not running -- the tip still shows in StreamElements' own
    // alert, so this failing is not worth interrupting the show over.
  });
}

window.addEventListener("onEventReceived", function (obj) {
  if (!obj || !obj.detail) return;
  const listener = obj.detail.listener;
  const event = obj.detail.event || {};

  // 'tip-latest' is the cash tip. The platform-native gifts (bits,
  // Superchats, TikTok coins) come in through Social Stream Ninja on
  // /ssn instead, so they are deliberately ignored here -- forwarding
  // both would double-count them against the top-donor total.
  if (listener !== "tip-latest") return;

  const amount = Number(event.amount) || 0;
  const currency = String(event.currency || "USD").toUpperCase();

  forward({
    from: event.name || "Someone",
    // Display string keeps the viewer's own currency. `usd` is what the
    // relay ranks and thresholds on: sent only when the tip really is in
    // dollars. For any other currency it is left off, and the relay falls
    // back to reading the number out of the display string and treating it
    // 1:1 -- so a EUR 50 tip still counts as big and still gets read out,
    // it just isn't converted. Hard-coding an exchange rate here would go
    // stale silently, which is worse than being openly approximate.
    amount: (currency === "USD" ? "$" : currency + " ") + amount.toFixed(2),
    usd: currency === "USD" ? amount : 0,
    note: event.message || "",
    platform: "streamelements",
  });
});
