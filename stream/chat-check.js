// Prove every platform's chat reaches the overlay -- before you go live.
//
//   node stream/chat-check.js              watch the real show (read-only)
//   node stream/chat-check.js --self-test  prove the relay end, on a throwaway copy
//
// There are two halves to "is chat working", and they break for different
// reasons, so they are tested separately:
//
//   Social Stream Ninja  ->  relay /ssn  ->  overlay
//   \_____ capture _____/    \______ delivery ______/
//
// Delivery is code in this repo and --self-test proves it in ten seconds
// without a stream. Capture is SSN holding a logged-in chat page open per
// platform, and NOTHING here can prove that except a real message from a
// real chat -- which is what the watch mode is for.
//
// The history in session.json says delivery has only ever carried youtube,
// twitch and kick. Facebook has never arrived once, which is a capture
// problem: the relay takes whatever `type` SSN sends and has no list of
// allowed platforms to be missing from.
//
// --- WATCH MODE (the one to use on stream day) -----------------------
//
// Start it, then type a message in each platform's own chat -- phone is
// easiest -- and watch the row go green. A platform that stays red is one
// SSN is not capturing, and you have found it before the show instead of
// during it.
//
// It only ever GETs /state, so it is safe to run against the live relay
// mid-show: no SSE connection is used up (those are the ones that run out
// at six per origin) and nothing is posted.
//
// --- SELF-TEST MODE --------------------------------------------------
//
// Spins up a SECOND relay on port 4701 with its own throwaway session file,
// feeds it one fake message per platform in SSN's exact shape, and checks
// each one came back out of /state. The live relay on 4700 is never
// touched: overlays pointed at it are real clients on a real broadcast.

const http = require("http");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawn } = require("child_process");

// The platforms the show goes out on. A row appears for anything else that
// turns up too, so adding a platform to the stream needs no edit here --
// but keeping the list current is what makes a MISSING one visible.
const EXPECTED = ["youtube", "twitch", "kick", "facebook", "tiktok"];

const LIVE_PORT = Number(process.env.OOP_STREAM_PORT || 4700);
const TEST_PORT = 4701;

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test") || args.includes("--inject");

// -------------------------------------------------------------- http

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": payload.length }
          : {},
        timeout: 4000,
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* not json; status is enough */ }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const ago = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

const C = {
  dim: (s) => `\x1b[90m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  no: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  head: (s) => `\x1b[36m${s}\x1b[0m`,
};

// ------------------------------------------------------------ watch

async function watch() {
  const base = `http://127.0.0.1:${LIVE_PORT}`;
  // What each platform has said, since this started. Keyed by the exact
  // `type` SSN sent, lowercased -- "Facebook" and "facebook" are one row.
  const seen = new Map();
  // Chat lines carry no id in /state, so a line is "new" when its arrival
  // stamp is newer than the newest one already counted.
  let highWater = 0;
  let started = Date.now();
  let polls = 0;
  let lastError = "";

  async function poll() {
    let state;
    try {
      const res = await request("GET", `${base}/state`);
      if (res.status !== 200 || !res.json) throw new Error(`HTTP ${res.status}`);
      state = res.json;
      lastError = "";
    } catch (err) {
      lastError = err.message;
      return;
    }
    polls++;
    for (const m of state.chat || []) {
      const at = Number(m.at || m.ts || 0);
      if (!at || at <= highWater) continue;
      const key = String(m.platform || "(none)").toLowerCase();
      seen.set(key, { at, user: m.user, text: m.text, count: (seen.get(key)?.count || 0) + 1 });
    }
    // Moved after the loop so every line in one response is counted.
    for (const m of state.chat || []) highWater = Math.max(highWater, Number(m.at || m.ts || 0));
  }

  function draw() {
    const rows = [...new Set([...EXPECTED, ...seen.keys()])];
    const lines = [];
    lines.push("");
    lines.push(C.head("  CHAT SOURCE CHECK") + C.dim(`   relay :${LIVE_PORT}   watching ${ago(Date.now() - started)}`.replace(" ago", "")));
    lines.push("");
    if (lastError) {
      lines.push(C.no(`  Cannot reach the relay on ${base} -- ${lastError}`));
      lines.push(C.dim("  Start it with stream/START SHOW.cmd, or stream/start-stream-kit.cmd."));
      lines.push("");
    }
    lines.push(C.dim("  platform     status   last message"));
    for (const key of rows) {
      const hit = seen.get(key);
      const name = key.padEnd(12);
      if (hit) {
        const said = `${hit.user}: ${String(hit.text).replace(/\s+/g, " ").slice(0, 46)}`;
        lines.push(`  ${name} ${C.ok("SEEN  ")}   ${C.dim(ago(Date.now() - hit.at).padEnd(10))} ${said}`);
      } else {
        lines.push(`  ${name} ${C.no("waiting")}  ${C.dim("-- say something in this chat --")}`);
      }
    }
    lines.push("");
    const missing = EXPECTED.filter((p) => !seen.has(p));
    if (!missing.length && polls) {
      lines.push(C.ok("  Every platform has come through. Chat is wired up.") );
    } else if (polls) {
      lines.push(C.warn(`  Still waiting on: ${missing.join(", ")}`));
      lines.push(C.dim("  A platform stuck here is one Social Stream Ninja is not capturing:"));
      lines.push(C.dim("  open that platform's chat in the SSN browser tab and leave it open."));
    }
    lines.push("");
    lines.push(C.dim("  Ctrl+C to stop.  Only reads /state -- safe during a live show."));
    lines.push("");
    // Redraw in place rather than scrolling: this runs for a whole show.
    process.stdout.write("\x1b[2J\x1b[H" + lines.join("\n") + "\n");
  }

  draw();
  for (;;) {
    await poll();
    draw();
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// -------------------------------------------------------- self-test

// SSN's own field names, exactly as it posts them. Taking its shape rather
// than a translated one is the point: if SSN renames a field, this test
// starts failing in the same way the real thing does.
const ssnMessage = (platform, i) => ({
  chatname: `check_${platform}`,
  chatmessage: `chat-check probe ${i + 1} (${platform})`,
  type: platform,
  nameColor: "#9d8cff",
});

async function selfTestRun() {
  const stateFile = path.join(
    process.env.TEMP || os.tmpdir(),
    `oop-chat-check-${process.pid}.json`
  );
  const relay = path.join(__dirname, "relay.js");

  console.log("");
  console.log(C.head("  SELF-TEST") + C.dim("   relay + overlay delivery, on a throwaway copy"));
  console.log("");
  console.log(C.dim(`  starting a second relay on :${TEST_PORT}`));
  console.log(C.dim(`  session file  ${stateFile}`));
  console.log(C.dim(`  the live relay on :${LIVE_PORT} is not touched`));
  console.log("");

  const child = spawn(process.execPath, [relay], {
    env: {
      ...process.env,
      OOP_STREAM_PORT: String(TEST_PORT),
      OOP_STREAM_STATE: stateFile,
      // Somewhere nothing is listening: the test relay must not join the
      // real OBS and start driving scenes.
      OOP_OBS_URL: "ws://127.0.0.1:1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let childLog = "";
  child.stdout.on("data", (d) => (childLog += d));
  child.stderr.on("data", (d) => (childLog += d));

  const base = `http://127.0.0.1:${TEST_PORT}`;
  let failures = 0;

  // Kill this child and nothing else. Killing node by name once took down the
  // live relay mid-show.
  //
  // Ctrl+C has to be caught: without it the test relay is orphaned, keeps
  // port 4701, and every later --self-test fails with "port in use" pointing
  // at a process nobody remembers starting.
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { child.kill(); } catch { /* already gone */ }
    try { fs.unlinkSync(stateFile); } catch { /* never written, or already gone */ }
  };
  const onSignal = () => { stop(); process.exit(130); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    // Wait for it to answer, rather than sleeping a guessed amount.
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (child.exitCode !== null) break;
      try {
        const res = await request("GET", `${base}/state`);
        up = res.status === 200;
      } catch { /* not listening yet */ }
    }
    if (!up) {
      console.log(C.no("  The test relay did not come up."));
      if (/EADDRINUSE|already in use/i.test(childLog)) {
        console.log(C.dim(`  Port ${TEST_PORT} is in use -- another test copy is still running.`));
      }
      console.log(C.dim(childLog.split("\n").slice(0, 12).map((l) => "    " + l).join("\n")));
      return 1;
    }

    const platforms = EXPECTED;
    console.log(C.dim("  posting one message per platform to /ssn ..."));
    for (let i = 0; i < platforms.length; i++) {
      const res = await request("POST", `${base}/ssn`, ssnMessage(platforms[i], i));
      if (res.status !== 200) {
        console.log(`  ${platforms[i].padEnd(12)} ${C.no("POST FAILED")} HTTP ${res.status}`);
        failures++;
      }
    }

    // A gift arrives as a message carrying a value: it must become BOTH a
    // donation and a chat line. That double path is easy to break.
    const gift = {
      ...ssnMessage("tiktok", 99),
      chatname: "check_gift",
      chatmessage: "chat-check gift probe",
      hasDonation: "500 coins",
    };
    await request("POST", `${base}/ssn`, gift);

    await new Promise((r) => setTimeout(r, 400));
    const res = await request("GET", `${base}/state`);
    const chat = (res.json && res.json.chat) || [];
    // Donations ride under `hype`, not at the top level -- /state carries the
    // scoreboard summary, and the tip list belongs to the hype panel.
    const donations = (res.json && res.json.hype && res.json.hype.donations) || [];

    console.log("");
    for (const p of platforms) {
      const hit = chat.find((m) => String(m.platform).toLowerCase() === p && /chat-check probe/.test(m.text || ""));
      if (hit) {
        console.log(`  ${p.padEnd(12)} ${C.ok("delivered")}  ${C.dim(`as "${hit.user}" -> overlay`)}`);
      } else {
        console.log(`  ${p.padEnd(12)} ${C.no("LOST")}       ${C.dim("posted to /ssn but never reached /state")}`);
        failures++;
      }
    }

    const giftChat = chat.find((m) => /gift probe/.test(m.text || ""));
    const giftDon = donations.find((d) => String(d.from) === "check_gift");
    console.log("");
    console.log(`  ${"gift".padEnd(12)} ${giftChat ? C.ok("chat line ok") : C.no("no chat line")}   ` +
                `${giftDon ? C.ok("donation ok") : C.no("no donation")}` +
                C.dim("   (a gift must become both)"));
    if (!giftChat || !giftDon) failures++;

    console.log("");
    if (failures) {
      console.log(C.no(`  ${failures} problem(s) in the relay itself.`));
    } else {
      console.log(C.ok("  Delivery is sound: every platform the relay is given reaches the overlay."));
      console.log(C.dim("  So a platform missing on stream is Social Stream Ninja not capturing it,"));
      console.log(C.dim("  not the relay dropping it. Use the watch mode to find which:"));
      console.log(C.dim("      node stream/chat-check.js"));
    }
    console.log("");
    return failures ? 1 : 0;
  } finally {
    stop();
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}

// -------------------------------------------------------------- main

(async () => {
  if (selfTest) process.exit(await selfTestRun());
  await watch();
})().catch((err) => {
  console.error("\n  chat-check failed:", err.message, "\n");
  process.exit(1);
});
