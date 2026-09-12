// Server half of Edit Mode. Applies a set of edits to index.html and
// commits the result to GitHub, which Vercel then deploys like any other
// push -- so every change Tom makes through the editor lands in git with
// its own commit and can be reverted the same way any other commit can.
//
// It lives in lib/ rather than api/ on purpose: every file under api/ is
// a Serverless Function and that directory is at the plan's cap of 12.
// See the note in api/analytics-dashboard.js, which is where this is
// called from.
//
// This file is the real security boundary, not the browser. The editor UI
// restricts what can be clicked; this decides what can actually be
// written. It re-checks both allow-lists from scratch and ignores anything
// it was not expecting, so a tampered-with request can do no more than an
// honest one.

const OWNER = "OutOfPocketTV";
const REPO = "outofpocket-quiz";
const BRANCH = "master";
const FILE = "index.html";

// The only sections Edit Mode may reorder or hide. Must match MOVABLE in
// edit/editor.js. Everything from the Find Out button down -- the result,
// the report, the paywall -- is absent deliberately: nothing typed into
// the editor can move or remove the parts that take payment.
const MOVABLE = [
  "socialProof",
  "card-looking-for",
  "card-sexual-orientation",
  "card-age",
  "card-race",
  "card-religion",
  "card-min-height",
  "card-body-type",
  "card-min-income",
];

// Formatting a person can reasonably want in a sentence, and nothing else.
// No links, no images, no scripts, no styles, no class attributes -- a tag
// that is not on this list is dropped and its text kept.
const ALLOWED_TAGS = new Set(["strong", "em", "b", "i", "br"]);
const MAX_TEXT_LEN = 2000;

function escapeText(s) {
  return String(s)
    // Leave existing entities (&amp; &mdash; &#39;) alone -- escaping the
    // ampersand blindly would turn them into visible gibberish.
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Rebuilds the submitted fragment from scratch rather than trying to spot
// what is dangerous in it. Anything not explicitly re-emitted is gone.
function sanitizeRich(input) {
  const s = String(input == null ? "" : input).slice(0, MAX_TEXT_LEN);
  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += escapeText(s.slice(i));
      break;
    }
    out += escapeText(s.slice(i, lt));
    const gt = s.indexOf(">", lt);
    if (gt === -1) {
      // A stray "<" with no closing bracket: treat it as literal text.
      out += escapeText(s.slice(lt));
      break;
    }
    const raw = s.slice(lt, gt + 1);
    const m = /^<(\/?)([a-zA-Z0-9]+)[^>]*>$/.exec(raw);
    if (m && ALLOWED_TAGS.has(m[2].toLowerCase())) {
      const name = m[2].toLowerCase();
      if (m[1]) out += "</" + name + ">";
      else out += name === "br" ? "<br />" : "<" + name + ">";
    }
    i = gt + 1;
  }
  return out.trim();
}

// Locates the inner content of the element carrying data-edit="key".
// Returns null -- meaning "skip this edit" -- rather than guessing, if the
// element is missing or turns out to contain a nested copy of its own tag.
function findEditable(src, key) {
  const attr = 'data-edit="' + key + '"';
  const at = src.indexOf(attr);
  if (at === -1) return null;
  const open = src.lastIndexOf("<", at);
  if (open === -1) return null;
  const tagM = /^<([a-zA-Z0-9]+)/.exec(src.slice(open, at));
  if (!tagM) return null;
  const tag = tagM[1];
  const openEnd = src.indexOf(">", at);
  if (openEnd === -1) return null;
  const close = src.indexOf("</" + tag, openEnd);
  if (close === -1) return null;
  const inner = src.slice(openEnd + 1, close);
  if (new RegExp("<" + tag + "[\\s/>]", "i").test(inner)) return null;
  return { start: openEnd + 1, end: close };
}

function sectionRange(src, id) {
  const at = src.indexOf('id="' + id + '"');
  if (at === -1) return null;
  const open = src.lastIndexOf("<section", at);
  if (open === -1) return null;
  const close = src.indexOf("</section>", open);
  if (close === -1) return null;
  const body = src.slice(open + 8, close);
  // These cards hold no nested <section>. If that ever changes, the naive
  // "next closing tag" search below would cut the block in half, so refuse.
  if (/<section[\s>]/i.test(body)) return null;
  return { start: open, end: close + "</section>".length };
}

function applyText(src, text) {
  let out = src;
  const applied = [];
  Object.keys(text || {}).forEach((key) => {
    // Keys are attribute values; anything exotic cannot match a real
    // element, but refuse early so nothing odd reaches indexOf.
    if (!/^[a-z0-9-]+$/i.test(key)) return;
    const at = findEditable(out, key);
    if (!at) return;
    const value = sanitizeRich(text[key]);
    if (!value) return; // never let the editor blank an element entirely
    out = out.slice(0, at.start) + value + out.slice(at.end);
    applied.push(key);
  });
  return { html: out, applied };
}

function applyHidden(src, hidden) {
  let out = src;
  const applied = [];
  Object.keys(hidden || {}).forEach((id) => {
    if (MOVABLE.indexOf(id) === -1) return;
    const at = sectionRange(out, id);
    if (!at) return;
    const openEnd = out.indexOf(">", at.start);
    let tag = out.slice(at.start, openEnd + 1);
    tag = tag.replace(/\s*data-hidden="(?:true|false)"/g, "");
    if (hidden[id]) tag = tag.slice(0, -1) + ' data-hidden="true">';
    out = out.slice(0, at.start) + tag + out.slice(openEnd + 1);
    applied.push(id);
  });
  return { html: out, applied };
}

function applyOrder(src, order) {
  if (!Array.isArray(order) || !order.length) return { html: src, applied: false };

  // Must be exactly the known set, reshuffled -- no additions, no drops.
  const present = MOVABLE.filter((id) => src.indexOf('id="' + id + '"') !== -1);
  const sorted = order.slice().sort();
  if (order.length !== present.length) return { html: src, applied: false };
  if (sorted.join(",") !== present.slice().sort().join(",")) return { html: src, applied: false };

  const ranges = {};
  for (const id of present) {
    const r = sectionRange(src, id);
    if (!r) return { html: src, applied: false };
    ranges[id] = r;
  }

  const ordered = present.slice().sort((a, b) => ranges[a].start - ranges[b].start);
  const first = ranges[ordered[0]];
  const last = ranges[ordered[ordered.length - 1]];

  // Everything between the first and last card must be the cards
  // themselves plus whitespace. If anything else lives in that span,
  // rewriting it would move that too, so refuse instead.
  let cursor = first.start;
  let separator = "\n\n  ";
  for (let i = 0; i < ordered.length; i++) {
    const r = ranges[ordered[i]];
    const gap = src.slice(cursor, r.start);
    if (gap.trim() !== "") return { html: src, applied: false };
    if (i === 1) separator = gap;
    cursor = r.end;
  }

  const blocks = order.map((id) => src.slice(ranges[id].start, ranges[id].end));
  return {
    html: src.slice(0, first.start) + blocks.join(separator) + src.slice(last.end),
    applied: true,
  };
}

async function github(path, token, options) {
  const res = await fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "outofpocket-quiz-editor",
      ...(options && options.headers),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error("GitHub " + res.status + ": " + (body.message || "request failed"));
    err.status = res.status;
    throw err;
  }
  return body;
}

// Applies the edits and commits. Returns a summary of what was actually
// written, which is what the editor reports back -- it is deliberately the
// server's account of the change, not the browser's.
async function publish(changes, token) {
  const current = await github("/contents/" + FILE + "?ref=" + BRANCH, token);
  const src = Buffer.from(current.content, "base64").toString("utf8");

  const t = applyText(src, changes && changes.text);
  const h = applyHidden(t.html, changes && changes.hidden);
  const o = applyOrder(h.html, changes && changes.order);

  if (o.html === src) {
    return { saved: false, reason: "nothing_changed" };
  }

  const parts = [];
  if (t.applied.length) parts.push(t.applied.length + " text change" + (t.applied.length === 1 ? "" : "s"));
  if (o.applied) parts.push("section order");
  if (h.applied.length) parts.push(h.applied.length + " section" + (h.applied.length === 1 ? "" : "s") + " shown/hidden");

  const message =
    "Edit Mode: " + (parts.join(", ") || "page edit") + "\n\n" +
    "Published by Tom from the site's own editor (?edit=1), which can only\n" +
    "change text marked data-edit and the order/visibility of the cards\n" +
    "above the Find Out button. Revert this commit to undo it.";

  await github("/contents/" + FILE, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(o.html, "utf8").toString("base64"),
      sha: current.sha,
      branch: BRANCH,
    }),
  });

  return {
    saved: true,
    text: t.applied,
    order: o.applied,
    hidden: h.applied,
    summary: parts.join(", "),
  };
}

module.exports = { publish, sanitizeRich, applyText, applyHidden, applyOrder, MOVABLE };
