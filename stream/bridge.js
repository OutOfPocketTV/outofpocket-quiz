// Stream bridge -- runs on the quiz page, talks to stream/relay.js.
//
// Loaded only when the operator arms stream mode (see the loader at the
// bottom of index.html), so a normal visitor never downloads it, never
// runs it, and never has their browser reach out to a local port.
//
//   https://outofpocket.tv/?stream=1     arm it (sticks until you disarm)
//   https://outofpocket.tv/?stream=0     disarm it
//   ...&relay=http://127.0.0.1:4701      point at a relay on another port
//   ...&badge=0                          hide the little status dot
//
(function () {
  "use strict";

  var qs = new URLSearchParams(location.search);

  function remember(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (err) {
      /* private browsing -- stream mode just won't persist across reloads */
    }
  }
  function recall(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  if (qs.get("stream") === "0") {
    remember("oopStreamMode", null);
    remember("oopStreamRelay", null);
    return;
  }
  remember("oopStreamMode", "1");

  var RELAY = qs.get("relay") || recall("oopStreamRelay") || "http://127.0.0.1:4700";
  RELAY = RELAY.replace(/\/+$/, "");
  remember("oopStreamRelay", RELAY);

  // --- status badge ----------------------------------------------------
  // Small on purpose: if you window-capture the calculator for the stream,
  // this ends up on screen, so it shrinks to a dot once you've seen it.
  var badge = null;
  if (qs.get("badge") !== "0") {
    badge = document.createElement("div");
    badge.style.cssText = [
      "position:fixed",
      "left:10px",
      "bottom:10px",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "gap:7px",
      "padding:6px 11px",
      "border-radius:999px",
      "background:rgba(10,8,16,.86)",
      "border:1px solid rgba(157,140,255,.35)",
      "font:600 12px/1 'Space Grotesk',system-ui,sans-serif",
      "letter-spacing:.12em",
      "color:#cfc9db",
      "pointer-events:none",
      "transition:opacity .4s,transform .4s",
    ].join(";");
    badge.innerHTML =
      '<span id="oopStreamDot" style="width:8px;height:8px;border-radius:50%;background:#55505f"></span>' +
      '<span id="oopStreamText">STREAM MODE</span>';
    var attach = function () {
      document.body.appendChild(badge);
      setTimeout(function () {
        // Collapse to just the dot -- still readable as a health light,
        // no longer a caption sitting on your broadcast.
        var t = document.getElementById("oopStreamText");
        if (t) t.style.display = "none";
        badge.style.padding = "6px";
      }, 6000);
    };
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
  }

  var lastOk = null;
  function setHealth(ok, note) {
    if (lastOk === ok) return;
    lastOk = ok;
    var dot = document.getElementById("oopStreamDot");
    if (dot) {
      dot.style.background = ok ? "#7fe3a3" : "#ff4d6d";
      dot.style.boxShadow = ok ? "0 0 10px #7fe3a3" : "0 0 10px #ff4d6d";
    }
    if (!ok) {
      console.warn("[stream] relay unreachable at " + RELAY + (note ? " (" + note + ")" : "") +
        " -- start it with:  node stream/relay.js");
    } else {
      console.info("[stream] relay connected at " + RELAY);
    }
  }

  // --- sending ---------------------------------------------------------
  // The page is https and the relay is plain http on loopback, which
  // browsers allow (127.0.0.1 counts as a trustworthy origin) but guard
  // with a Private Network Access preflight. The relay answers that
  // preflight; if a future browser version tightens the rule anyway, the
  // image ping below still gets through, because a fire-and-forget image
  // load isn't subject to CORS at all.
  function send(payload) {
    fetch(RELAY + "/emit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(function (res) {
        setHealth(res.ok, "HTTP " + res.status);
      })
      .catch(function (err) {
        setHealth(false, err.message);
        imagePing(payload);
      });
  }

  function imagePing(payload) {
    try {
      var json = JSON.stringify(payload);
      var b64 = btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      // Query strings have practical length limits; the criteria list is
      // the only unbounded field, so it's what gets dropped if we're long.
      if (b64.length > 1800) {
        var trimmed = Object.assign({}, payload, { criteria: (payload.criteria || []).slice(0, 4) });
        return imagePing(trimmed);
      }
      new Image().src = RELAY + "/emit?d=" + b64 + "&t=" + Date.now();
    } catch (err) {
      /* nothing further to try -- the alert simply doesn't fire */
    }
  }

  // --- the hook --------------------------------------------------------
  // script.js dispatches this at the end of the Find Out handler, where
  // every number the overlay needs is already computed. Listening beats
  // scraping the DOM: no dependency on markup, and no race with the
  // count-up animations.
  document.addEventListener("quiz:result", function (e) {
    if (!e.detail) return;
    send(e.detail);
  });

  // Health check on load so the dot is honest before the first guest,
  // rather than going red at the worst possible moment.
  fetch(RELAY + "/state")
    .then(function (res) {
      setHealth(res.ok);
    })
    .catch(function (err) {
      setHealth(false, err.message);
    });
})();
