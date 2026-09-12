// Edit Mode -- lets Tom change the site's words and section order himself,
// on the real page, without touching code or waiting for anyone.
//
// Reached by adding ?edit=1 to the URL. index.html only fetches this file
// when that flag is present, so an ordinary visitor never downloads a byte
// of it. Nothing here runs, and no edit control exists, until the password
// has been checked by the server.
//
// The safety model, in one line: this file can only ever change things
// that were explicitly marked as safe to change.
//   - Text: only elements carrying data-edit="key" in index.html.
//   - Layout: only the cards listed in MOVABLE below.
// The quiz inputs, the Find Out button, the results, the report and the
// whole paywall are not in either list, so no amount of clicking in here
// can alter what the calculator computes or how the site takes payment.
// The server enforces the same two lists again when publishing, so even a
// tampered-with browser cannot widen them.
(function () {
  "use strict";

  var API = "/api/analytics-dashboard";
  var KEY = "oopEditPassword";

  // The cards Edit Mode may reorder or hide. They are siblings in the DOM
  // and must stay contiguous -- the publisher refuses the edit if they are
  // not. Everything from the Find Out button down is deliberately absent.
  var MOVABLE = [
    "socialProof",
    "card-looking-for",
    "card-sexual-orientation",
    "card-age",
    "card-race",
    "card-religion",
    "card-min-height",
    "card-body-type",
    "card-min-income"
  ];

  // Sections that carry no heading of their own and would otherwise show
  // up in the panel as a raw element id.
  var NAMES = { socialProof: "Video wall" };

  // Friendly names for the section list, so it doesn't read like code.
  function labelFor(id) {
    if (NAMES[id]) return NAMES[id];
    var el = document.getElementById(id);
    var h2 = el && el.querySelector("h2");
    return (h2 && h2.textContent.trim()) || id;
  }

  var password = "";
  var changes = { text: {}, order: null, hidden: {} };
  var originalText = {};
  var bar, statusEl, sectionList;

  // ---- Password ------------------------------------------------------
  function askPassword() {
    var stored = "";
    try { stored = sessionStorage.getItem(KEY) || ""; } catch (e) {}
    if (stored) return check(stored);

    var wrap = el("div", "oop-edit-gate");
    wrap.innerHTML =
      '<div class="oop-edit-gate-box">' +
      '<h2>Edit Mode</h2>' +
      '<p>Enter your dashboard password to edit this page.</p>' +
      '<input type="password" autocomplete="current-password" />' +
      '<button type="button">Unlock</button>' +
      '<p class="oop-edit-gate-msg"></p>' +
      "</div>";
    document.body.appendChild(wrap);

    var input = wrap.querySelector("input");
    var btn = wrap.querySelector("button");
    var msg = wrap.querySelector(".oop-edit-gate-msg");
    input.focus();

    function go() {
      msg.textContent = "Checking…";
      check(input.value, function (ok) {
        if (ok) { wrap.remove(); return; }
        msg.textContent = "That password didn't work.";
        input.select();
      });
    }
    btn.addEventListener("click", go);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  }

  function check(candidate, done) {
    fetch(API + "?mode=edit-ping", { headers: { Authorization: "Bearer " + candidate } })
      .then(function (r) { return r.ok; })
      .then(function (ok) {
        if (ok) {
          password = candidate;
          try { sessionStorage.setItem(KEY, candidate); } catch (e) {}
          start();
        } else {
          try { sessionStorage.removeItem(KEY); } catch (e) {}
        }
        if (done) done(ok);
        else if (!ok) askPassword();
      })
      .catch(function () { if (done) done(false); });
  }

  // ---- Start ---------------------------------------------------------
  function start() {
    document.body.classList.add("oop-editing");
    buildBar();
    wireText();
    renderSections();
    say("Click any highlighted text to change it.");
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- Editable text -------------------------------------------------
  function wireText() {
    var nodes = document.querySelectorAll("[data-edit]");
    for (var i = 0; i < nodes.length; i++) {
      (function (node) {
        var key = node.getAttribute("data-edit");
        originalText[key] = node.innerHTML;
        node.classList.add("oop-editable");
        node.setAttribute("contenteditable", "true");
        node.setAttribute("spellcheck", "true");

        // Enter would otherwise insert a <div>, which is not on the
        // allowed-tag list and would be stripped on publish. Line breaks
        // are useful though, so it becomes a <br>.
        node.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            document.execCommand("insertLineBreak");
          }
        });
        // Paste as plain text: pasting from a web page or Word otherwise
        // drags in fonts, colours and spans that would all be stripped.
        node.addEventListener("paste", function (e) {
          e.preventDefault();
          var t = (e.clipboardData || window.clipboardData).getData("text/plain");
          document.execCommand("insertText", false, t);
        });
        node.addEventListener("input", function () {
          var now = node.innerHTML.trim();
          if (now === originalText[key].trim()) delete changes.text[key];
          else changes.text[key] = now;
          refresh();
        });
        // Clicking a link or a button in edit mode should not navigate or
        // fire the site's own handler -- it should just place the cursor.
        node.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); }, true);
      })(nodes[i]);
    }
  }

  // ---- Section order and visibility ----------------------------------
  function currentOrder() {
    if (changes.order) return changes.order.slice();
    var seen = [];
    var kids = document.querySelectorAll("main.quiz > section");
    for (var i = 0; i < kids.length; i++) {
      if (MOVABLE.indexOf(kids[i].id) !== -1) seen.push(kids[i].id);
    }
    return seen;
  }

  function applyOrder(order) {
    // Re-insert each card, in order, before the first one's old position.
    var first = document.getElementById(order[0]);
    var anchor = document.createComment("oop-anchor");
    first.parentNode.insertBefore(anchor, first);
    order.forEach(function (id) {
      anchor.parentNode.insertBefore(document.getElementById(id), anchor);
    });
    anchor.remove();
  }

  function isHidden(id) {
    if (Object.prototype.hasOwnProperty.call(changes.hidden, id)) return changes.hidden[id];
    return document.getElementById(id).getAttribute("data-hidden") === "true";
  }

  function renderSections() {
    sectionList.textContent = "";
    var order = currentOrder();
    order.forEach(function (id, i) {
      var row = el("div", "oop-sec");
      row.appendChild(el("span", "oop-sec-name", labelFor(id)));

      var up = el("button", "oop-mini", "▲");
      up.title = "Move up";
      up.disabled = i === 0;
      up.addEventListener("click", function () { move(id, -1); });

      var down = el("button", "oop-mini", "▼");
      down.title = "Move down";
      down.disabled = i === order.length - 1;
      down.addEventListener("click", function () { move(id, 1); });

      var hidden = isHidden(id);
      var eye = el("button", "oop-mini" + (hidden ? " oop-off" : ""), hidden ? "Hidden" : "Shown");
      eye.title = hidden ? "Show this section" : "Hide this section";
      eye.addEventListener("click", function () { toggle(id); });

      row.appendChild(up); row.appendChild(down); row.appendChild(eye);
      sectionList.appendChild(row);
    });
  }

  function move(id, delta) {
    var order = currentOrder();
    var i = order.indexOf(id);
    var j = i + delta;
    if (j < 0 || j >= order.length) return;
    order.splice(j, 0, order.splice(i, 1)[0]);
    changes.order = order;
    applyOrder(order);
    renderSections();
    refresh();
    document.getElementById(id).scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function toggle(id) {
    var next = !isHidden(id);
    changes.hidden[id] = next;
    // Shown in the editor at half opacity rather than removed, so he can
    // still find it to switch back on. It is genuinely display:none live.
    document.getElementById(id).setAttribute("data-hidden", next ? "true" : "false");
    renderSections();
    refresh();
  }

  // ---- Toolbar -------------------------------------------------------
  function buildBar() {
    bar = el("div", "oop-edit-bar");

    var head = el("div", "oop-edit-head");
    head.appendChild(el("strong", null, "Edit Mode"));
    var close = el("button", "oop-mini", "Exit");
    close.addEventListener("click", function () {
      if (countChanges() && !confirm("You have unpublished changes. Leave anyway?")) return;
      location.search = location.search.replace(/[?&]edit=1/, "") || "";
    });
    head.appendChild(close);
    bar.appendChild(head);

    statusEl = el("p", "oop-edit-status");
    bar.appendChild(statusEl);

    sectionList = el("div", "oop-edit-sections");
    bar.appendChild(el("p", "oop-edit-label", "Sections — reorder or hide"));
    bar.appendChild(sectionList);

    var actions = el("div", "oop-edit-actions");
    var publish = el("button", "oop-publish", "Publish");
    publish.addEventListener("click", doPublish);
    var discard = el("button", "oop-mini", "Discard");
    discard.addEventListener("click", function () {
      if (!countChanges()) return;
      if (confirm("Throw away every change you've made since opening this page?")) location.reload();
    });
    actions.appendChild(publish);
    actions.appendChild(discard);
    bar.appendChild(actions);

    document.body.appendChild(bar);
    bar.querySelector(".oop-publish").disabled = true;
  }

  function countChanges() {
    var n = Object.keys(changes.text).length;
    if (changes.order) n += 1;
    n += Object.keys(changes.hidden).length;
    return n;
  }

  function refresh() {
    var n = countChanges();
    bar.querySelector(".oop-publish").disabled = n === 0;
    say(n === 0 ? "No changes yet." : n + (n === 1 ? " change" : " changes") + " ready to publish.");
  }

  function say(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "oop-edit-status" + (kind ? " oop-" + kind : "");
  }

  // ---- Publish -------------------------------------------------------
  function doPublish() {
    var n = countChanges();
    if (!n) return;
    if (!confirm("Publish " + n + (n === 1 ? " change" : " changes") + " to the live site?")) return;

    var btn = bar.querySelector(".oop-publish");
    btn.disabled = true;
    say("Publishing…");

    fetch(API + "?mode=edit-publish", {
      method: "POST",
      headers: { Authorization: "Bearer " + password, "Content-Type": "application/json" },
      body: JSON.stringify(changes)
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.saved) {
          say(res.body && res.body.error ? "Couldn't publish: " + res.body.error : "Couldn't publish.", "bad");
          btn.disabled = false;
          return;
        }
        changes = { text: {}, order: null, hidden: {} };
        say("Published. The live site updates in about a minute.", "good");
        // Re-read the page from the server once the deploy has had time to
        // land, so what is on screen is what is actually published.
        setTimeout(function () {
          say("Reloading to show the published page…", "good");
          location.reload();
        }, 75000);
      })
      .catch(function () {
        say("Couldn't reach the server.", "bad");
        btn.disabled = false;
      });
  }

  askPassword();
})();
