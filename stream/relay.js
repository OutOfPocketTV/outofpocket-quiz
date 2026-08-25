#!/usr/bin/env node
//
// Out Of Pocket -- live stream relay.
//
// A stream overlay can't reach the quiz page directly: OBS/Streamlabs run
// browser sources inside their own Chromium process, which shares nothing
// with the Chrome window the calculator is open in. This process is the
// bridge between them. The quiz page POSTs a result here the moment
// "Find Out" is clicked; every overlay holds an open Server-Sent Events
// connection and hears about it a few milliseconds later.
//
// Deliberately zero-dependency (plain node:http, no ws/express) so it can
// never break mid-stream because of an npm install, and so it starts in
// well under a second on a machine that's already busy encoding video.
//
//   node stream/relay.js            -> http://127.0.0.1:4700
//   OOP_STREAM_PORT=5000 node ...   -> different port
//   OOP_STREAM_HOST=0.0.0.0 node .. -> also reachable from your phone on the LAN
//
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.OOP_STREAM_PORT || 4700);
const HOST = process.env.OOP_STREAM_HOST || "127.0.0.1";
const OVERLAY_DIR = path.join(__dirname, "overlays");
const SOUND_DIR = path.join(__dirname, "sounds");
const ASSET_DIR = path.join(__dirname, "assets");
const STATE_FILE = path.join(__dirname, "session.json");

// Where the "realistic vs delusional" line sits on the site's five rarity
// bands. Tiers come from renderDelusionScore() in script.js -- 1 is
// "Local Neighborhood" (60%+ of the population matches) and 5 is "Lost in
// the Matrix" (2.5% and under). Change these three lines to re-cut the
// brackets; every overlay reads the answer off the server rather than
// deciding for itself, so the scoreboard can never disagree with an alert.
const BRACKET_OF = {
  1: "realistic",
  2: "realistic",
  3: "borderline",
  4: "delusional",
  5: "delusional",
};

// ---------------------------------------------------------------- state

// Chat is capped because it is a display buffer, not a log: the overlay
// only ever shows the last handful, and an unbounded array would grow for
// the whole broadcast and get written to disk on every single message.
const CHAT_KEEP = 60;
const DONATIONS_KEEP = 20;

function emptyState() {
  return {
    startedAt: Date.now(),
    entries: [],
    chat: [],
    chatters: {},
    donations: [],
    hype: { topFan: "", viewers: 0 },
  };
}

// A session file written before these fields existed is still perfectly
// good for the tally, so fill the gaps rather than discarding it.
function withChatDefaults(s) {
  const base = emptyState();
  s.chat = Array.isArray(s.chat) ? s.chat : base.chat;
  s.chatters = s.chatters && typeof s.chatters === "object" ? s.chatters : base.chatters;
  s.donations = Array.isArray(s.donations) ? s.donations : base.donations;
  s.hype = s.hype && typeof s.hype === "object" ? Object.assign({}, base.hype, s.hype) : base.hype;
  return s;
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (raw && Array.isArray(raw.entries)) return withChatDefaults(raw);
  } catch (err) {
    // A missing or half-written session file is not worth refusing to
    // start over -- the show matters more than the tally.
  }
  return emptyState();
}

let state = loadState();
let saveTimer = null;

// Written through a temp file because the alternative is a truncated
// session.json if the process is killed (or the machine reboots) between
// the open and the write -- which is exactly when you'd want the counts back.
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, STATE_FILE);
    } catch (err) {
      log("could not save session: " + err.message);
    }
  }, 250);
}

// Aggregates are derived on every read rather than incremented in place,
// so "undo the last one" is just popping the array -- no counter can
// drift out of sync with the list of entries it claims to summarise.
function summarize() {
  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const brackets = { realistic: 0, borderline: 0, delusional: 0 };
  const blank = () => ({ realistic: 0, borderline: 0, delusional: 0, total: 0 });
  const byGender = { woman: blank(), man: blank(), unknown: blank() };
  let rarest = null;
  let pctSum = 0;

  for (const e of state.entries) {
    const bracket = BRACKET_OF[e.score] || "borderline";
    tiers[e.score] = (tiers[e.score] || 0) + 1;
    brackets[bracket]++;
    const g = byGender[e.gender] ? e.gender : "unknown";
    byGender[g][bracket]++;
    byGender[g].total++;
    pctSum += Number(e.pct) || 0;
    if (!rarest || Number(e.pct) < Number(rarest.pct)) rarest = e;
  }

  return {
    startedAt: state.startedAt,
    total: state.entries.length,
    tiers,
    brackets,
    byGender,
    rarest,
    averagePct: state.entries.length ? pctSum / state.entries.length : 0,
    last: state.entries[state.entries.length - 1] || null,
    bracketOf: BRACKET_OF,
  };
}

// ------------------------------------------------------------------ SSE

const clients = new Set();

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(frame);
    } catch (err) {
      clients.delete(res);
    }
  }
}

function pushState() {
  broadcast("state", summarize());
}

// What the bottom-bar marquee reads. Top chatter is counted here rather
// than asked of any platform, because it is the one number every platform
// would answer differently -- and we already see every message.
function hypeSummary() {
  let topChatter = null;
  for (const [user, count] of Object.entries(state.chatters)) {
    if (!topChatter || count > topChatter.count) topChatter = { user, count };
  }
  return {
    donations: state.donations.slice(-DONATIONS_KEEP).reverse(),
    topFan: state.hype.topFan || "",
    viewers: Number(state.hype.viewers) || 0,
    topChatter,
    chatCount: state.chat.length,
  };
}

function pushHype() {
  broadcast("hype", hypeSummary());
}

// OBS's embedded Chromium will quietly drop an SSE connection that goes
// silent, and a browser source that reconnects mid-alert is a visible
// glitch on stream. A comment line every 15s keeps the socket warm.
setInterval(() => {
  for (const res of clients) {
    try {
      res.write(": ping\n\n");
    } catch (err) {
      clients.delete(res);
    }
  }
}, 15000).unref();

// -------------------------------------------------------------- helpers

function log(msg) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(`[${t}] ${msg}`);
}

// The quiz page lives on https://outofpocket.tv while this server is
// plain http on loopback. That combination is allowed (127.0.0.1 counts
// as a trustworthy origin) but Chrome sends a Private Network Access
// preflight first, which fails unless we opt in explicitly.
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      // Nothing legitimate is anywhere near this large; the cap just
      // stops a stuck client from eating memory during a long stream.
      if (raw.length > 512 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (err) {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

function serveStatic(res, baseDir, relPath) {
  // Resolve first, then confirm the result is still inside the directory
  // we meant to serve, so "..%2f.." style paths can't walk the disk.
  const full = path.resolve(baseDir, "." + path.sep + relPath);
  if (!full.startsWith(path.resolve(baseDir))) {
    json(res, 403, { error: "forbidden" });
    return;
  }
  fs.readFile(full, (err, buf) => {
    if (err) {
      json(res, 404, { error: "not found", path: relPath });
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
      "content-length": buf.length,
      // Overlays get edited between takes; a cached copy in OBS would
      // mean "refresh cache of current page" every single time.
      "cache-control": "no-store",
    });
    res.end(buf);
  });
}

// A result is worth showing on stream only if it actually carries a
// rarity tier. Everything else is normalised to a shape the overlays can
// render without defensive checks in five different files.
// Chat arrives from whatever is bridging it, so nothing here trusts the
// shape. Platform is kept as a free string rather than an enum: adding a
// fifth site should not mean editing the relay.
function normalizeChat(input) {
  if (!input) return null;
  const user = String(input.user || input.username || "").trim().slice(0, 40);
  const text = String(input.text || input.message || "").trim().slice(0, 240);
  if (!user || !text) return null;
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    platform: String(input.platform || "").trim().toLowerCase().slice(0, 12),
    user,
    text,
    // A colour the source already assigned (Twitch hands one out per user);
    // the overlay falls back to hashing the name when it's absent.
    colour: /^#[0-9a-fA-F]{6}$/.test(input.colour || input.color || "") ? (input.colour || input.color) : "",
  };
}

function normalizeEntry(input) {
  const score = Math.min(5, Math.max(1, Math.round(Number(input.score) || 0)));
  if (!score) return null;
  const pct = Number(input.pct);
  // "Who is being searched for" implies who is answering: someone
  // describing their ideal man is, by default, one of the girls. The
  // control panel can override this per entry when that's wrong.
  const inferred = input.targetSex === "men" ? "woman" : input.targetSex === "women" ? "man" : "unknown";
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    score,
    label: String(input.label || "").slice(0, 80),
    pct: Number.isFinite(pct) ? pct : 0,
    pctText: String(input.pctText || "").slice(0, 24),
    oddsText: String(input.oddsText || "").slice(0, 120),
    matchingCount: Number(input.matchingCount) || 0,
    countLabel: String(input.countLabel || "").slice(0, 80),
    scopeLabel: String(input.scopeLabel || "").slice(0, 120),
    criteria: Array.isArray(input.criteria) ? input.criteria.slice(0, 12).map((c) => String(c).slice(0, 60)) : [],
    partnerGender: String(input.partnerGender || "").slice(0, 16),
    targetSex: String(input.targetSex || "").slice(0, 16),
    biggestLimitingFilter: String(input.biggestLimitingFilter || "").slice(0, 60),
    limitingCriterion: String(input.limitingCriterion || "").slice(0, 60),
    gender: ["woman", "man", "unknown"].includes(input.gender) ? input.gender : inferred,
    bracket: BRACKET_OF[score] || "borderline",
  };
}

// ------------------------------------------------------------------ app

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;

  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- overlays subscribe here -------------------------------------
  if (route === "/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write("retry: 2000\n\n");
    clients.add(res);
    // A freshly-added browser source needs the running totals right
    // away, otherwise the ticker sits on zeroes until the next guest.
    res.write(`event: state\ndata: ${JSON.stringify(summarize())}\n\n`);
    log(`overlay connected (${clients.size} live)`);
    req.on("close", () => {
      clients.delete(res);
      log(`overlay disconnected (${clients.size} live)`);
    });
    return;
  }

  // --- the quiz page reports a result ------------------------------
  if (route === "/emit") {
    let input = null;
    if (req.method === "POST") {
      input = await readBody(req);
    } else {
      // GET fallback. If a browser ever refuses the cross-origin POST to
      // loopback, the page can still fire a one-way image ping, which no
      // CORS rule applies to.
      try {
        input = JSON.parse(Buffer.from(url.searchParams.get("d") || "", "base64url").toString("utf8"));
      } catch (err) {
        input = null;
      }
    }
    if (!input) {
      json(res, 400, { error: "bad payload" });
      return;
    }

    // A test alert shows the animation without polluting the tally.
    if (input.test) {
      const entry = normalizeEntry(input);
      if (entry) broadcast("alert", entry);
      json(res, 200, { ok: true, test: true });
      return;
    }

    const entry = normalizeEntry(input);
    if (!entry) {
      json(res, 400, { error: "no rarity score in payload" });
      return;
    }
    state.entries.push(entry);
    saveState();
    broadcast("alert", entry);
    pushState();
    log(`${entry.score}/5 ${entry.label || ""} ${entry.pctText} (${entry.gender}, ${entry.bracket})`);
    json(res, 200, { ok: true, total: state.entries.length });
    return;
  }

  // --- operator controls -------------------------------------------
  if (route === "/state") {
    // hype and chat ride along so an overlay opening mid-show comes up
    // populated instead of blank until the next message arrives.
    json(res, 200, Object.assign(summarize(), { hype: hypeSummary(), chat: state.chat.slice(-20) }));
    return;
  }

  if (route === "/undo" && req.method === "POST") {
    const removed = state.entries.pop() || null;
    saveState();
    pushState();
    log(removed ? `undid ${removed.score}/5 ${removed.pctText}` : "undo: nothing to remove");
    json(res, 200, { ok: true, removed });
    return;
  }

  if (route === "/reset" && req.method === "POST") {
    state = emptyState();
    saveState();
    pushState();
    pushHype(); // clears the marquee too -- a reset is a fresh show, not just a fresh tally
    log("session reset");
    json(res, 200, { ok: true });
    return;
  }

  // Re-fires the last result's alert -- for when it fired while you were
  // on the wrong scene, or the guest disconnected before the reveal.
  if (route === "/replay" && req.method === "POST") {
    const last = state.entries[state.entries.length - 1];
    if (last) broadcast("alert", last);
    json(res, 200, { ok: true, replayed: Boolean(last) });
    return;
  }

  // Re-tags who was actually answering, when the inference got it wrong
  // (a guy asking about his ideal girlfriend reads as "man" already, but
  // same-sex answers and joke entries need a manual fix).
  if (route === "/retag" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    const target = body.id
      ? state.entries.find((e) => e.id === body.id)
      : state.entries[state.entries.length - 1];
    if (target && ["woman", "man", "unknown"].includes(body.gender)) {
      target.gender = body.gender;
      saveState();
      pushState();
      json(res, 200, { ok: true, entry: target });
      return;
    }
    json(res, 400, { error: "need an existing entry and a valid gender" });
    return;
  }

  // --- chat + hype -------------------------------------------------
  // Deliberately source-agnostic. Anything that can POST JSON can feed
  // these, which keeps the per-platform mess out of the relay: a Twitch
  // reader, a YouTube poller and a manual button all look identical here.
  if (route === "/chat" && req.method === "POST") {
    const msg = normalizeChat(await readBody(req));
    if (!msg) {
      json(res, 400, { error: "need user and text" });
      return;
    }
    state.chat.push(msg);
    if (state.chat.length > CHAT_KEEP) state.chat = state.chat.slice(-CHAT_KEEP);
    state.chatters[msg.user] = (state.chatters[msg.user] || 0) + 1;
    saveState();
    broadcast("chat", msg);
    pushHype();
    json(res, 200, { ok: true });
    return;
  }

  if (route === "/hype" && req.method === "POST") {
    const input = await readBody(req);
    if (!input) {
      json(res, 400, { error: "bad payload" });
      return;
    }
    if (input.donation && input.donation.from) {
      state.donations.push({
        from: String(input.donation.from).slice(0, 40),
        amount: String(input.donation.amount || "").slice(0, 16),
        note: String(input.donation.note || "").slice(0, 80),
        ts: Date.now(),
      });
      if (state.donations.length > DONATIONS_KEEP) {
        state.donations = state.donations.slice(-DONATIONS_KEEP);
      }
    }
    if (typeof input.topFan === "string") state.hype.topFan = input.topFan.slice(0, 40);
    if (input.viewers !== undefined) state.hype.viewers = Number(input.viewers) || 0;
    saveState();
    pushHype();
    json(res, 200, { ok: true, hype: hypeSummary() });
    return;
  }

  // --- static overlays ---------------------------------------------
  if (route.startsWith("/sounds/")) {
    serveStatic(res, SOUND_DIR, route.slice("/sounds/".length));
    return;
  }
  // Brand art lives beside the overlays rather than inside them, and
  // serveStatic refuses to walk out of the directory it was handed, so
  // assets need their own mount the same way sounds do.
  if (route.startsWith("/assets/")) {
    serveStatic(res, ASSET_DIR, route.slice("/assets/".length));
    return;
  }
  if (route === "/" || route === "") {
    serveStatic(res, OVERLAY_DIR, "control.html");
    return;
  }
  serveStatic(res, OVERLAY_DIR, route.slice(1));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  The relay is probably already running -- open http://${HOST}:${PORT}/ to check.`);
    console.error(`  To run a second copy: OOP_STREAM_PORT=4701 node stream/relay.js\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  const base = `http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`;
  console.log("");
  console.log("  OUT OF POCKET -- stream relay is live");
  console.log("  ------------------------------------------------------------");
  console.log(`  Control panel   ${base}/            (open in a normal browser)`);
  console.log(`  Alert overlay   ${base}/alert.html  (browser source, 1920x1080)`);
  console.log(`  Alert vertical  ${base}/alert.html?o=v      (1080x1920)`);
  console.log(`  Ticker overlay  ${base}/ticker.html         (1000x260)`);
  console.log(`  Ticker vertical ${base}/ticker.html?o=v     (1000x520)`);
  console.log("  ------------------------------------------------------------");
  console.log(`  Quiz page: add ?stream=1 to the URL to arm the Find Out hook.`);
  console.log(`  Session carries ${state.entries.length} result(s) from earlier.`);
  console.log("");
});
