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
const { spawn } = require("child_process");
// Rolls the tier-5 video out of an OBS media source. Self-contained and
// fail-quiet: if OBS isn't up, alerts still go out, just without the reel.
const reel = require("./obs-reel.js");

const PORT = Number(process.env.OOP_STREAM_PORT || 4700);
const HOST = process.env.OOP_STREAM_HOST || "127.0.0.1";
const OVERLAY_DIR = path.join(__dirname, "overlays");
const SOUND_DIR = path.join(__dirname, "sounds");
const ASSET_DIR = path.join(__dirname, "assets");
// The soundboard. Deliberately outside the repo -- it is Tom's own library of
// clips, it will grow, and it has no business being versioned alongside code.
// Read fresh on every request rather than cached at boot, so dropping a new
// mp3 in the folder puts it on the panel with nothing to restart.
const SFX_DIR = process.env.OOP_SFX_DIR || "E:\\Outta Pocket\\Live Stream Sounds";
const SFX_TYPES = /\.(mp3|ogg|wav|m4a|flac)$/i;
// The quiz console scores a guest with the site's real code rather than a
// copy of it, so it needs these served. countries.js is here because a lot
// of guests on ome.tv and monkey aren't American, and scoring them against
// the U.S. is just the wrong question. Named one by one instead of mounting
// the repo root, which also holds .env and the rest of the site.
const SITE_DIR = path.join(__dirname, "..");
const SITE_FILES = new Set(["stats.js", "quiz-core.js", "countries.js"]);
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

// Read aloud at this much and up; below it the alert is silent text only.
// Changed from the control panel mid-show, so it lives in a settings file
// rather than only an env var -- the point of the threshold is that you move
// it when the night turns out louder or quieter than you expected, and
// restarting the relay to do that costs you every overlay's connection.
// Deliberately NOT in session.json: "Reset session" wipes that, and a
// setting that silently reverts to 10 every time you clear the counter is
// worse than no setting at all.
const SETTINGS_FILE = path.join(__dirname, "settings.json");

// Which scene the Starting Soon countdown cuts to at zero, which media
// source in it is the intro clip, and where to go when that clip ends.
// Names rather than ids because that is what OBS's own dialogs show, so a
// mismatch is something you can see at a glance instead of decoding.
// afterScene empty means "stay on the intro scene" -- the safe default,
// since guessing at what should follow somebody's intro is worse than
// leaving them the cut.
function settingsDefaults() {
  return {
    ttsMin: Number(process.env.OOP_TTS_MIN || 10),
    introScene: process.env.OOP_INTRO_SCENE || "Intro Video",
    introSource: process.env.OOP_INTRO_SOURCE || "Intro Clip",
    afterScene: process.env.OOP_AFTER_INTRO_SCENE || "",
    // What the box is pre-filled with next time. Remembered rather than
    // fixed, because whatever you counted down from last night is a far
    // better guess than any number chosen here.
    countdownSeconds: 600,
    countdownLabel: "STARTING IN",
  };
}

function loadSettings() {
  const base = settingsDefaults();
  let s = {};
  try {
    s = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) || {};
  } catch (err) {
    /* no file yet, or someone hand-edited it into nonsense; defaults it is */
  }
  // Merged field by field so a settings file written before any of these
  // existed keeps working, and so one junk value cannot take the rest down.
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const str = (v, d) => (typeof v === "string" ? v.slice(0, 120) : d);
  return {
    ttsMin: num(s.ttsMin, base.ttsMin),
    introScene: str(s.introScene, base.introScene),
    introSource: str(s.introSource, base.introSource),
    afterScene: str(s.afterScene, base.afterScene),
    countdownSeconds: Math.max(0, Math.min(12 * 3600, num(s.countdownSeconds, base.countdownSeconds))),
    countdownLabel: str(s.countdownLabel, base.countdownLabel),
  };
}

let settings = loadSettings();

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    log("could not save settings: " + err.message);
  }
}

// Platform currencies, converted to something comparable so one donor can
// be ranked against another across four sites. These are what the units
// cost to buy, not what they pay out, and they move -- override with
// OOP_RATE_COINS etc. rather than editing them here.
const RATES = {
  usd: 1,
  bits: Number(process.env.OOP_RATE_BITS || 0.01), // Twitch: 100 bits ≈ $1
  coins: Number(process.env.OOP_RATE_COINS || 0.0105), // TikTok coin buy price
  diamonds: Number(process.env.OOP_RATE_DIAMONDS || 0.005), // TikTok payout side
};

// Turns "$20", "1,000 coins" or "500 bits" into a number worth comparing.
// The caller can skip all of this by sending an explicit `usd`, which any
// adapter that already knows the real value should do.
function parseAmount(amount, usd) {
  const text = String(amount || "").trim();
  if (Number.isFinite(Number(usd)) && Number(usd) > 0) return { text, usd: Number(usd) };
  const num = Number((text.match(/([0-9]+(?:[., ][0-9]{3})*(?:\.[0-9]+)?)/) || [])[1]?.replace(/[, ]/g, "") || 0);
  if (!num) return { text, usd: 0 };
  const lower = text.toLowerCase();
  let unit = "usd";
  if (/coin/.test(lower)) unit = "coins";
  else if (/diamond/.test(lower)) unit = "diamonds";
  else if (/bit/.test(lower)) unit = "bits";
  return { text, usd: num * (RATES[unit] || 1) };
}

// A reset clears the night, not the record. The answer count is the running
// joke of the whole channel and it is meant to climb forever -- across shows,
// across months -- so "Reset session" must not touch it. What genuinely is
// per-show is the chat, the tips and whatever question was half-finished when
// the stream ended; carrying those into the next night would be wrong.
//
// Kept as one list rather than a separate lifetime counter on purpose: the
// aggregates are derived from the array on every read, which is what stops a
// counter drifting out of step with the thing it claims to summarise, and
// what keeps "undo the last one" a one-line pop.
function clearedForNewShow(prev) {
  const fresh = emptyState();
  fresh.entries = prev.entries || [];
  return fresh;
}

function emptyState() {
  return {
    startedAt: Date.now(),
    entries: [],
    chat: [],
    chatters: {},
    donations: [],
    donors: {}, // name -> running total, so top donor spans every source
    hype: { viewers: 0 },
    // What the on-air quiz card is showing right now. Null between guests.
    quiz: null,
    // The Starting Soon clock. Null when there isn't one, which is also what
    // tells the overlay to draw nothing at all.
    countdown: null,
  };
}

// A session file written before these fields existed is still perfectly
// good for the tally, so fill the gaps rather than discarding it.
function withChatDefaults(s) {
  const base = emptyState();
  s.chat = Array.isArray(s.chat) ? s.chat : base.chat;
  s.chatters = s.chatters && typeof s.chatters === "object" ? s.chatters : base.chatters;
  s.donations = Array.isArray(s.donations) ? s.donations : base.donations;
  s.donors = s.donors && typeof s.donors === "object" ? s.donors : base.donors;
  s.hype = s.hype && typeof s.hype === "object" ? Object.assign({}, base.hype, s.hype) : base.hype;
  return s;
}

// --- speech ------------------------------------------------------------
// OBS's Chromium ships the speechSynthesis API with zero voices installed,
// so speak() there returns without error and produces silence -- the worst
// possible failure for an alert. Windows' own SAPI has voices, so the
// speaking happens here and reaches the stream through Desktop Audio.
//
// The donor's name and note are attacker-controlled text going to a shell,
// so they are written to stdin and never interpolated into the command.
// A sting before the voice, so a read-out tip announces itself instead of
// the synthesiser just starting mid-stream. Only read-out tips get it, and
// that falls out for free: speak() is only ever called for donations over
// the spoken threshold, so anything routed through here has already earned it.
//
// Same shell as the voice on purpose. Two spawns would race -- PowerShell
// start-up is not instant and the voice could beat the sting to the speakers.
// One process, sting first, voice second, ordering guaranteed.
//
// The path goes in through the environment, never interpolated into the
// command, for the same reason the donor's text goes in through stdin.
const STING_FILE =
  process.env.OOP_TIP_STING ||
  "E:\\Outta Pocket\\Sound Effects - Music\\home-run-bat-sound-clip.mp3";

// How loud the sting is, as MediaPlayer's linear 0-1 volume. Asked for at
// -2 dB on 2026-08-30: the clip is a bat crack, and at full scale it landed
// harder than the voice that follows it.
//
// Carried as decibels rather than as a raw multiplier because that is the
// unit the request arrives in -- "it's a little loud, take 2 off it" -- and
// because -2 dB is a number you can reason about where 0.794 is not.
//
// OBS's fader cannot do this job: the sting is played by this process
// through PowerShell, so it is not a source OBS has ever heard of.
const STING_GAIN_DB = Number(process.env.OOP_TIP_STING_DB || -2);
const STING_VOLUME = Math.max(0, Math.min(1, Math.pow(10, STING_GAIN_DB / 20)));

// Wrapped in try/catch and skipped when the file is gone: the voice is the
// part that matters, and a missing sound effect must never swallow a tip.
const STING_SCRIPT =
  "$sting = $env:OOP_TIP_STING; " +
  "if ($sting -and (Test-Path -LiteralPath $sting)) { try { " +
  "Add-Type -AssemblyName presentationCore; " +
  "$p = New-Object System.Windows.Media.MediaPlayer; " +
  "$p.Open([uri]$sting); " +
  // Volume is linear 0-1; the decibel conversion happens in node, so the
  // shell only ever sees a number it can apply straight to the player.
  "$v = [double]($env:OOP_TIP_STING_VOLUME); " +
  "if ($v -gt 0) { $p.Volume = [Math]::Min(1.0, $v) }; " +
  // Open() is asynchronous -- the duration is not known the instant it returns,
  // and playing before it lands gives you silence. Measured at ~150ms for the
  // current clip; 2s of headroom, then play anyway rather than give up.
  "$n = 0; while (-not $p.NaturalDuration.HasTimeSpan -and $n -lt 40) " +
  "{ Start-Sleep -Milliseconds 50; $n++ }; " +
  "$p.Play(); " +
  "if ($p.NaturalDuration.HasTimeSpan) " +
  "{ Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds) } " +
  "else { Start-Sleep -Milliseconds 900 }; " +
  "$p.Close() } catch { } }; ";

// The voices a tipper can pick from. Two, deliberately: Windows only ships
// two that sound like people, and the pitch-and-rate variants built on top of
// them (deep, giant, chipmunk and so on) were tried on air and cut -- they
// sound cheap, which is worse than having fewer options. If real character
// voices are wanted, that is an engine swap (TTS Monster or similar), not
// more entries here. The tag mechanism below does not change either way.
//
// Keys are what the tipper types. Keep them short, obvious and unambiguous
// out loud, because people will be typing them from memory on a phone.
const DAVID = "Microsoft David Desktop";
const ZIRA = "Microsoft Zira Desktop";

const VOICES = {
  guy: { label: "Guy", voice: DAVID, pitch: "default", rate: "default" },
  girl: { label: "Girl", voice: ZIRA, pitch: "default", rate: "default" },
};
const DEFAULT_VOICE = "guy";

// Tippers pick by putting a tag at the front of their message --
// "!deep she is NOT finding a 6ft2 doctor". Every TTS service on Twitch uses
// this convention, so it is already what people expect and there is nothing
// to teach. An unknown or missing tag reads in the default voice rather than
// dropping the tip: someone fumbling the spelling still gets heard.
function pickVoice(note) {
  const raw = String(note || "");
  const m = raw.match(/^\s*!([a-z0-9]{1,16})\b[ \t]*/i);
  if (!m) return { key: DEFAULT_VOICE, note: raw };
  const key = m[1].toLowerCase();
  if (!VOICES[key]) return { key: DEFAULT_VOICE, note: raw };
  // Only strip the tag once we know it is real, so a message that just
  // happens to start with "!" keeps its text.
  return { key, note: raw.slice(m[0].length) };
}

// Pitch and rate need SSML, and SSML is XML -- so the tipper's text has to be
// escaped before it goes anywhere near the markup, or a stray "&" kills the
// whole line and a deliberate "<prosody>" would let a stranger drive the
// voice. Escaping happens in PowerShell, on the text that arrived through
// stdin, so the raw message is still never part of the command string.
// The voice, pitch and rate come from the table above, not from anyone.
const SPEAK_SCRIPT =
  STING_SCRIPT +
  "$t = [Console]::In.ReadToEnd(); " +
  "$esc = [System.Security.SecurityElement]::Escape($t); " +
  "Add-Type -AssemblyName System.Speech; " +
  "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; " +
  "if ($env:OOP_TTS_VOICE) { try { $s.SelectVoice($env:OOP_TTS_VOICE) } catch { } }; " +
  "$p = $env:OOP_TTS_PITCH; if (-not $p) { $p = 'default' }; " +
  "$r = $env:OOP_TTS_RATE; if (-not $r) { $r = 'default' }; " +
  "$ssml = \"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\" + " +
  "\"<prosody pitch='$p' rate='$r'>$esc</prosody></speak>\"; " +
  // Fall back to plain speech if the SSML is rejected for any reason. A tip
  // read in the wrong voice is far better than a tip read in no voice.
  "try { $s.SpeakSsml($ssml) } catch { $s.Speak($t) }; " +
  "$s.Dispose()";

let speaking = false;
const speechQueue = [];

function drainSpeech() {
  if (speaking || !speechQueue.length) return;
  speaking = true;
  const item = speechQueue.shift();
  const text = item.text;
  const v = VOICES[item.voice] || VOICES[DEFAULT_VOICE];
  let child;
  try {
    child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", SPEAK_SCRIPT], {
      stdio: ["pipe", "ignore", "ignore"],
      env: Object.assign({}, process.env, {
        OOP_TIP_STING: STING_FILE,
        OOP_TIP_STING_VOLUME: String(STING_VOLUME),
        OOP_TTS_VOICE: v.voice,
        OOP_TTS_PITCH: v.pitch,
        OOP_TTS_RATE: v.rate,
      }),
    });
  } catch (err) {
    log("could not start speech: " + err.message);
    speaking = false;
    return;
  }
  child.on("error", (err) => {
    log("speech failed: " + err.message);
    speaking = false;
    drainSpeech();
  });
  child.on("close", () => {
    speaking = false;
    drainSpeech(); // one at a time, or two donations talk over each other
  });
  try {
    child.stdin.end(text);
  } catch (err) {
    /* the close handler will move the queue along */
  }
}

function speak(text, voice) {
  // Donation notes can carry emote markup, and spoken aloud that becomes a CDN
  // URL read out character by character on air. Emotes are said as their alt
  // text ("Kappa"), any other tag is dropped, and the gaps left behind close up.
  const said = String(text || "")
    .replace(/<img\b[^>]*?\balt\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi,
             (_m, _q, dq, sq) => " " + (dq !== undefined ? dq : sq) + " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/<[^>]*$/, " "); // a cap upstream can leave a tag unterminated
  const clean = said.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!clean) return;
  if (speechQueue.length > 8) return; // a gift-spam burst shouldn't queue for minutes
  speechQueue.push({ text: clean, voice: VOICES[voice] ? voice : DEFAULT_VOICE });
  drainSpeech();
}

function loadState() {
  let text = null;
  try {
    text = fs.readFileSync(STATE_FILE, "utf8");
  } catch (err) {
    return emptyState(); // no file yet; first run
  }
  try {
    const raw = JSON.parse(text);
    if (raw && Array.isArray(raw.entries)) return withChatDefaults(raw);
    throw new Error("no entries array");
  } catch (err) {
    // The file is there but unusable. Starting empty is still right -- the
    // show matters more than the tally -- but the very next save would
    // overwrite it, and with it the only copy of the all-time board. Set it
    // aside first so there is still something to recover from.
    try {
      const aside = STATE_FILE + ".unreadable-" + Date.now();
      fs.renameSync(STATE_FILE, aside);
      log("session.json is unreadable (" + err.message + ") -- kept it as " + path.basename(aside) +
          " and started empty. Restore from stats-backups/ before running a show.");
    } catch (moveErr) {
      log("session.json is unreadable and could not be set aside: " + moveErr.message);
    }
    return emptyState();
  }
}

let state = loadState();
let saveTimer = null;
let lastDiag = null; // deliberately not persisted: it describes this run's browser

// Written through a temp file because the alternative is a truncated
// session.json if the process is killed (or the machine reboots) between
// the open and the write -- which is exactly when you'd want the counts back.
// Backups of the all-time board. Every one is a straight copy of
// session.json, so restoring is "stop the relay, copy the file back" -- no
// tooling, no format to parse. See restore-stats.js, which does exactly that.
const BACKUP_DIR = path.join(__dirname, "stats-backups");
const BACKUP_KEEP = 60;
let lastSavedCount = (state.entries || []).length;

function rotateBackups() {
  try {
    const all = fs.readdirSync(BACKUP_DIR)
      .filter((n) => n.indexOf("stats-") === 0 && n.slice(-5) === ".json")
      .sort();
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch (err) {
    // Housekeeping only -- never fail a save because tidying up failed.
  }
}

function copyBoardTo(name) {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const file = path.join(BACKUP_DIR, name);
    const tmp = file + ".tmp";
    fs.copyFileSync(STATE_FILE, tmp);
    fs.renameSync(tmp, file);
    rotateBackups();
    return file;
  } catch (err) {
    log("stats backup failed: " + err.message);
    return null;
  }
}

// One file per day, rewritten as the day goes on: enough to walk back to any
// previous night without a file per answer crowding out the older ones.
function dailyBackup() {
  if (!(state.entries || []).length) return null;
  return copyBoardTo("stats-" + new Date().toISOString().slice(0, 10) + ".json");
}

// ---------------------------------------------------------------- archive
// The permanent record of who was actually interviewed. Separate from the
// board on purpose: the board is a tally that a reset is allowed to clear,
// this is the research data and nothing here clears it. Two files, same
// rows -- the .jsonl is the source of truth and keeps every field, the .csv
// is regenerated from it so it can be opened in a spreadsheet.
//
// Hand-added entries (the +/- controls) never land here. They are a tally
// correction, not a person who answered questions.
const ARCHIVE_DIR = path.join(__dirname, "quiz-archive");
const ARCHIVE_JSONL = path.join(ARCHIVE_DIR, "answers.jsonl");
const ARCHIVE_CSV = path.join(ARCHIVE_DIR, "answers.csv");
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

const ARCHIVE_COLUMNS = [
  "id", "ts", "date", "time", "answered_by", "looking_for", "bracket", "tier",
  "tier_label", "odds_pct", "odds_text", "odds_phrase", "matching_count",
  "scope", "scope_code", "scope_name", "dropped_filters",
  "biggest_limiting_filter", "limiting_criterion", "criteria",
];

function archiveRowOf(e) {
  const d = new Date(e.ts || Date.now());
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  return {
    id: e.id,
    ts: e.ts || 0,
    date: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
    time: pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()),
    answered_by: e.gender || "",
    looking_for: e.partnerGender || "",
    bracket: e.bracket || "",
    tier: e.score || "",
    tier_label: e.label || "",
    odds_pct: e.pct || 0,
    odds_text: e.pctText || "",
    odds_phrase: e.oddsText || "",
    matching_count: e.matchingCount || 0,
    scope: e.scopeLabel || "",
    // Added when the console learned to score other countries. Rows written
    // before that have neither, and an empty cell there means the U.S. --
    // the only scope that existed at the time.
    scope_code: e.scope || "",
    scope_name: e.scopeName || "",
    dropped_filters: e.droppedText || "",
    biggest_limiting_filter: e.biggestLimitingFilter || "",
    limiting_criterion: e.limitingCriterion || "",
    // Flattened with a pipe so the answers stay in one cell and survive a
    // format whose whole job is splitting on commas.
    criteria: (e.criteria || []).join(" | "),
  };
}

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  const flat = s.split(CR).join(" ").split(NL).join(" ");
  return '"' + flat.split('"').join('""') + '"';
}

function readArchive() {
  try {
    return fs.readFileSync(ARCHIVE_JSONL, "utf8")
      .split(NL).map((l) => l.trim()).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch (err) { return null; } })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

function writeArchive(rows) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const jsonl = rows.map((r) => JSON.stringify(r)).join(NL) + (rows.length ? NL : "");
  const csv = [ARCHIVE_COLUMNS.join(",")]
    .concat(rows.map((r) => ARCHIVE_COLUMNS.map((c) => csvCell(r[c])).join(",")))
    .join(NL) + NL;
  // Same temp-then-rename as the session file: a half-written archive is
  // worse than no archive, because it looks fine until you open it.
  fs.writeFileSync(ARCHIVE_JSONL + ".tmp", jsonl);
  fs.renameSync(ARCHIVE_JSONL + ".tmp", ARCHIVE_JSONL);
  fs.writeFileSync(ARCHIVE_CSV + ".tmp", csv);
  fs.renameSync(ARCHIVE_CSV + ".tmp", ARCHIVE_CSV);
}

function archiveEntry(entry) {
  if (!entry || entry.manual) return;
  try {
    const rows = readArchive();
    if (rows.some((r) => r.id === entry.id)) return;
    rows.push(archiveRowOf(entry));
    writeArchive(rows);
  } catch (err) {
    log("could not write to the answer archive: " + err.message);
  }
}

// Undo, and a downward adjustment that reached a real result, both mean the
// answer should never have been counted -- usually a test run. It comes out
// of the archive too, or the research data quietly disagrees with the board.
function unarchiveEntries(ids) {
  const wanted = ids.filter(Boolean);
  if (!wanted.length) return 0;
  try {
    const rows = readArchive();
    const kept = rows.filter((r) => wanted.indexOf(r.id) === -1);
    const dropped = rows.length - kept.length;
    if (dropped) { writeArchive(kept); log("removed " + dropped + " answer(s) from the archive"); }
    return dropped;
  } catch (err) {
    log("could not update the answer archive: " + err.message);
    return 0;
  }
}

// Anything already on the board but not yet in the archive -- entries from
// before this existed, or from a restored backup -- gets picked up on boot.
function backfillArchive() {
  try {
    const rows = readArchive();
    const have = new Set(rows.map((r) => r.id));
    const missing = (state.entries || []).filter((e) => e && !e.manual && !have.has(e.id));
    if (!missing.length) return 0;
    writeArchive(rows.concat(missing.map(archiveRowOf)).sort((a, b) => (a.ts || 0) - (b.ts || 0)));
    log("archive: added " + missing.length + " answer(s) already on the board");
    return missing.length;
  } catch (err) {
    log("could not backfill the answer archive: " + err.message);
    return 0;
  }
}

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + ".tmp";
    const count = (state.entries || []).length;
    try {
      // Anything that shrinks the board -- an undo, a downward adjustment, a
      // full reset -- is about to replace the only copy of it. Keep what is
      // being replaced, under its own timestamp so the daily file cannot
      // overwrite it later the same day.
      if (count < lastSavedCount) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const kept = copyBoardTo("stats-" + stamp + "-before-" + lastSavedCount + "-became-" + count + ".json");
        if (kept) log("board shrank " + lastSavedCount + " -> " + count + "; kept " + path.basename(kept));
      }
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, STATE_FILE);
      const changed = count !== lastSavedCount;
      lastSavedCount = count;
      if (changed) dailyBackup();
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
  let real = 0; // entries that were actually scored, for the average

  for (const e of state.entries) {
    const bracket = BRACKET_OF[e.score] || "borderline";
    tiers[e.score] = (tiers[e.score] || 0) + 1;
    brackets[bracket]++;
    const g = byGender[e.gender] ? e.gender : "unknown";
    byGender[g][bracket]++;
    byGender[g].total++;
    // Hand-added entries count towards the totals -- that is the whole point
    // of them -- but they are not results anybody actually got, so they are
    // kept out of "rarest ever" and the average. Otherwise correcting the
    // count by three would quietly put a made-up percentage on air as the
    // rarest thing that ever happened.
    if (e.manual) continue;
    pctSum += Number(e.pct) || 0;
    real++;
    if (!rarest || Number(e.pct) < Number(rarest.pct)) rarest = e;
  }

  return {
    startedAt: state.startedAt,
    total: state.entries.length,
    tiers,
    brackets,
    byGender,
    rarest,
    averagePct: real ? pctSum / real : 0,
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

// Every route that puts an alert on screen goes through here, so the reel
// can never end up wired to some of them and not others -- a test alert and
// a replay have to look exactly like the real thing or they're useless for
// checking the reel before a show.
function emitAlert(entry) {
  broadcast("alert", entry);
  // Deliberately not awaited: the overlays already have the alert, and a
  // slow or missing OBS must not hold up the HTTP response to the quiz page.
  reel.fire(entry && entry.score);
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
  // Top donor is a running total across every source, not the single
  // biggest tip: four $5 gifts should outrank one $15.
  let topDonor = null;
  for (const [user, usd] of Object.entries(state.donors)) {
    if (!topDonor || usd > topDonor.usd) topDonor = { user, usd };
  }
  return {
    donations: state.donations.slice(-DONATIONS_KEEP).reverse(),
    topDonor,
    viewers: Number(state.hype.viewers) || 0,
    topChatter,
    chatCount: state.chat.length,
  };
}

function pushHype() {
  broadcast("hype", hypeSummary());
}
function pushQuiz() {
  broadcast("quiz", state.quiz || null);
}

// ------------------------------------------------------------- countdown
//
// The clock on the Starting Soon screen, and the cut into the intro video at
// the end of it.
//
// The relay owns the deadline, not the overlay. A browser source is the
// wrong thing to trust with it: it can be reloaded, it can be added to the
// scene half way through, and it is not even running when OBS is sitting on
// a different scene. So the overlay is told an *end time* and draws whatever
// the difference is -- every source lands on the same number no matter when
// it connected -- and the relay alone decides that zero has happened.
//
// Relay and OBS are the same machine, so the overlay ticking on its own
// clock between pushes cannot drift away from the one that fires the cut.

let countdownTimer = null;
// Set the moment we cut to the intro scene, cleared when the clip reports
// itself finished. Without it, the Matrix Reel ending -- or the Starting
// Soon loop rolling over -- would look exactly like the intro finishing.
let introRolling = false;

function countdownSummary() {
  const c = state.countdown;
  if (!c) return null;
  return {
    running: !!c.running,
    total: c.total || 0,
    // Both are sent. A running clock is described by its end time, which is
    // what lets a source that just connected tick on its own. A paused one
    // has no end time, only what was left on it.
    endsAt: c.running ? c.endsAt : null,
    remaining: c.running ? Math.max(0, c.endsAt - Date.now()) : Math.max(0, c.remaining || 0),
    scene: settings.introScene,
    label: settings.countdownLabel,
  };
}

function pushCountdown() {
  broadcast("countdown", countdownSummary());
}

// A 200ms poll of the wall clock, rather than one long setTimeout aimed at
// the deadline. A timer set half an hour out is at the mercy of the machine
// sleeping, of the clock being corrected under it, and of every way node has
// of firing late; re-reading the time ten times a second is immune to all of
// that and costs nothing next to encoding video.
function armCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  if (!state.countdown || !state.countdown.running) return;
  countdownTimer = setInterval(() => {
    const c = state.countdown;
    if (!c || !c.running) {
      armCountdown();
      return;
    }
    if (Date.now() >= c.endsAt) fireCountdown(false);
  }, 200);
  if (countdownTimer.unref) countdownTimer.unref();
}

// Zero. The clock is cleared *before* OBS is touched: if the cut fails --
// OBS closed, scene renamed -- the countdown must not sit at 00:00 retrying
// every 200ms for the rest of the night.
async function fireCountdown(manual) {
  state.countdown = null;
  armCountdown();
  saveState();
  pushCountdown();

  const scene = settings.introScene;
  if (!scene) {
    log("countdown finished, but no intro scene is set -- nothing switched");
    return;
  }
  try {
    await reel.cutTo(scene);
    introRolling = true;
    log(manual ? `countdown skipped -- rolling "${scene}" now` : `countdown hit zero -- rolling "${scene}"`);
    // The clip is set to restart on activate, so it is already playing; this
    // is the check afterwards, not the mechanism. Left until the stinger has
    // finished, because asking mid-transition would read a source that is
    // legitimately not playing yet and "heal" it into restarting on air.
    const t = setTimeout(() => {
      reel.confirmRolling(settings.introSource).catch((err) => log(`intro: ${err.message}`));
    }, 2500);
    if (t.unref) t.unref();
  } catch (err) {
    introRolling = false;
    // Deliberately loud. This is the one failure where the show is still
    // sitting on a countdown that has already vanished from the screen.
    log(`COUNTDOWN HIT ZERO BUT THE CUT FAILED (${err.message}) -- still on the Starting Soon scene`);
  }
}

// The intro plays itself out and then what? Left alone OBS sits on a cleared
// media source, which is a black screen on a live stream. Where it goes next
// is a setting, and empty means "stay put" -- guessing at what should follow
// somebody's intro is worse than leaving them the cut.
function introFinished(inputName) {
  if (!introRolling || inputName !== settings.introSource) return;
  introRolling = false;
  const next = settings.afterScene;
  if (!next) {
    log(`"${inputName}" finished -- staying put (no follow-on scene set)`);
    return;
  }
  reel.cutTo(next).catch((err) => log(`"${inputName}" finished but the cut to "${next}" failed (${err.message})`));
}

// Shared by /chat, /hype and /ssn so the three inlets can never drift into
// counting or capping things differently.
function addChat(msg) {
  if (!msg) return false;
  state.chat.push(msg);
  if (state.chat.length > CHAT_KEEP) state.chat = state.chat.slice(-CHAT_KEEP);
  state.chatters[msg.user] = (state.chatters[msg.user] || 0) + 1;
  saveState();
  broadcast("chat", msg);
  pushHype();
  return true;
}

function addDonation(raw) {
  if (!raw || !raw.from) return null;
  const from = String(raw.from).slice(0, 40);
  const { text, usd } = parseAmount(raw.amount, raw.usd);
  // The voice tag is an instruction to us, not part of what they wrote. Strip
  // it once, here, so the card, the ticker and the voice all agree -- otherwise
  // "!giant" is read out loud and sits on screen under their name.
  const picked = pickVoice(raw.note);
  const entry = {
    from,
    amount: text,
    usd,
    // 160 was sized for plain text; a single emote is ~90 characters of markup
    // on its own, so a note carrying two used to get cut off mid-tag.
    note: picked.note.slice(0, 600),
    platform: String(raw.platform || "").toLowerCase().slice(0, 20),
    ts: Date.now(),
  };
  state.donations.push(entry);
  if (state.donations.length > DONATIONS_KEEP) {
    state.donations = state.donations.slice(-DONATIONS_KEEP);
  }
  // Rounded on the way in: coin conversions are fractional and a running
  // total of them drifts into $15.750000000000002 within a few gifts.
  state.donors[from] = Math.round(((state.donors[from] || 0) + usd) * 100) / 100;
  saveState();

  // Everything gets an on-screen alert; only the big ones get a voice.
  const loud = usd >= settings.ttsMin;
  broadcast("donation", Object.assign({ loud }, entry));
  pushHype();
  if (loud) {
    speak(`${from} donated ${text || "a tip"}.${entry.note ? " " + entry.note : ""}`, picked.key);
  }
  log(`donation ${text || "?"} (~$${usd.toFixed(2)}) from ${from}${loud ? " [spoken]" : ""}`);
  return entry;
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

// Milliseconds as mm:ss, or h:mm:ss once there is an hour on it. Rounded up
// rather than down so a clock reading 00:01 still has a whole second on it --
// the same convention the overlay draws with, which is what stops the log
// disagreeing with the screen by one.
function fmtClock(ms) {
  const total = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
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
  // Chromium refuses to decode a <video> served as octet-stream, so the
  // reel that rides the Matrix reveal needs a real type here.
  ".mp4": "video/mp4",
  ".webm": "video/webm",
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
    platform: String(input.platform || "").trim().toLowerCase().slice(0, 20),
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
    // Which population this was scored against. scopeLabel is the phrase
    // that goes on air; these two are what the archive can be filtered on
    // in two years without parsing English.
    scope: String(input.scope || "US").slice(0, 24),
    scopeName: String(input.scopeName || "").slice(0, 60),
    globalScope: Boolean(input.globalScope),
    // Which filters this scope had no data for. Without it a row looks
    // like a race preference that simply did nothing, rather than one the
    // country never published in the first place.
    droppedText: String(input.droppedText || "").slice(0, 120),
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

const handle = async (req, res) => {
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
    // Same reasoning for the clock, and it matters more: a countdown overlay
    // that came up mid-count would otherwise draw nothing until the operator
    // happened to touch a button, which on a Starting Soon screen could be
    // the whole wait.
    res.write(`event: countdown\ndata: ${JSON.stringify(countdownSummary())}\n\n`);
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
      if (entry) emitAlert(entry);
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
    archiveEntry(entry);
    emitAlert(entry);
    pushState();
    log(`${entry.score}/5 ${entry.label || ""} ${entry.pctText} (${entry.gender}, ${entry.bracket})`);
    json(res, 200, { ok: true, total: state.entries.length });
    return;
  }

  // --- operator controls -------------------------------------------
  if (route === "/state") {
    // hype and chat ride along so an overlay opening mid-show comes up
    // populated instead of blank until the next message arrives.
    json(res, 200, Object.assign(summarize(), {
      hype: hypeSummary(),
      chat: state.chat.slice(-20),
      quiz: state.quiz || null,
      ttsMin: settings.ttsMin,
      countdown: countdownSummary(),
      // The control panel needs the configured names to show them, and the
      // live scene list to offer them -- which only OBS can answer, so it is
      // absent rather than wrong when OBS is closed.
      countdownSetup: {
        introScene: settings.introScene,
        introSource: settings.introSource,
        afterScene: settings.afterScene,
        seconds: settings.countdownSeconds,
        label: settings.countdownLabel,
        obs: reel.isUp(),
      },
      voices: Object.keys(VOICES).map((k) => ({ key: k, label: VOICES[k].label })),
    }));
    return;
  }

  // --- the Starting Soon clock -------------------------------------
  // One route for the lot. Every action lands on the same state and the
  // same push, so the panel, a hotkey script and curl cannot end up with
  // three slightly different ideas of what "pause" does.
  if (route === "/countdown" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    const action = String(body.action || "").toLowerCase();
    const c = state.countdown;

    // Twelve hours is not really a limit on countdowns; it is a limit on
    // what a slipped keypress in the minutes box can do to the intro video.
    const clamp = (v) => Math.max(0, Math.min(12 * 3600, Math.round(Number(v) || 0)));

    if (action === "start") {
      const s = clamp(body.seconds !== undefined ? body.seconds : settings.countdownSeconds);
      if (!s) {
        json(res, 400, { error: "start needs a duration" });
        return;
      }
      settings.countdownSeconds = s;
      saveSettings();
      state.countdown = { running: true, endsAt: Date.now() + s * 1000, remaining: null, total: s * 1000 };
      log(`countdown started at ${fmtClock(s * 1000)}`);
    } else if (action === "pause") {
      if (!c || !c.running) {
        json(res, 400, { error: "nothing is running" });
        return;
      }
      state.countdown = {
        running: false,
        endsAt: null,
        remaining: Math.max(0, c.endsAt - Date.now()),
        total: c.total,
      };
      log(`countdown paused at ${fmtClock(state.countdown.remaining)}`);
    } else if (action === "resume") {
      if (!c || c.running) {
        json(res, 400, { error: "nothing is paused" });
        return;
      }
      state.countdown = {
        running: true,
        endsAt: Date.now() + Math.max(0, c.remaining || 0),
        remaining: null,
        total: c.total,
      };
      log(`countdown resumed at ${fmtClock(Math.max(0, c.remaining || 0))}`);
    } else if (action === "add") {
      // Works on a running and a paused clock alike, and takes negatives, so
      // one button pair covers "give them another minute" and "that's long
      // enough" without either needing to know which state it is in.
      if (!c) {
        json(res, 400, { error: "no countdown to adjust" });
        return;
      }
      const delta = Math.round(Number(body.seconds) || 0) * 1000;
      if (!delta) {
        json(res, 400, { error: "add needs a non-zero number of seconds" });
        return;
      }
      if (c.running) c.endsAt = Math.max(Date.now(), c.endsAt + delta);
      else c.remaining = Math.max(0, (c.remaining || 0) + delta);
      // Keep the total at or above where the clock now stands, so a ring or
      // bar drawn from it can never read as more than full.
      const left = c.running ? c.endsAt - Date.now() : c.remaining;
      c.total = Math.max(c.total || 0, left);
      log(`countdown ${delta > 0 ? "+" : "-"}${fmtClock(Math.abs(delta))} -- ${fmtClock(left)} left`);
    } else if (action === "stop" || action === "clear") {
      state.countdown = null;
      log("countdown cleared");
    } else if (action === "fire") {
      // Skip the wait. Same path as a real zero, so what you rehearse with
      // this button is exactly what goes out on its own later.
      await fireCountdown(true);
      json(res, 200, { ok: true, countdown: countdownSummary(), fired: true });
      return;
    } else {
      json(res, 400, { error: "action must be start, pause, resume, add, stop or fire" });
      return;
    }

    armCountdown();
    saveState();
    pushCountdown();
    json(res, 200, { ok: true, countdown: countdownSummary() });
    return;
  }

  // Change the spoken-tip threshold without restarting anything.
  if (route === "/settings" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    const changed = [];

    if (body.ttsMin !== undefined) {
      const v = Number(body.ttsMin);
      // Clamped rather than rejected: a fat-fingered 1000 that silently means
      // "nothing is ever spoken" is a worse outcome than a visible ceiling.
      if (!Number.isFinite(v) || v < 0) {
        json(res, 400, { error: "ttsMin must be a number" });
        return;
      }
      settings.ttsMin = Math.min(1000, Math.round(v * 100) / 100);
      changed.push(`tips are now spoken at ${settings.ttsMin} and up`);
    }

    // The countdown's wiring. Each is optional and applied on its own, so
    // the panel can save one dropdown without having to send the rest back
    // -- and so an older client that only knows about ttsMin still works.
    // Not validated against OBS's scene list on purpose: OBS may well be
    // closed while this is being set up, and refusing a name because the
    // machine happens not to be running OBS right now would be worse than
    // taking a name that turns out to be wrong, which the cut reports
    // loudly the first time it is tried.
    for (const [key, what] of [
      ["introScene", "the countdown cuts to"],
      ["introSource", "the intro clip source is"],
      ["afterScene", "after the intro it goes to"],
      ["countdownLabel", "the countdown reads"],
    ]) {
      if (body[key] === undefined) continue;
      settings[key] = String(body[key]).slice(0, 120).trim();
      changed.push(`${what} "${settings[key]}"` + (settings[key] ? "" : " (nothing -- it stays put)"));
    }

    if (!changed.length) {
      json(res, 400, { error: "nothing to change" });
      return;
    }
    saveSettings();
    pushState();
    pushCountdown(); // the scene name and label ride along on this one
    for (const line of changed) log(line);
    json(res, 200, { ok: true, settings });
    return;
  }

  // The scene names OBS actually has, for the panel's dropdowns. Asked of
  // OBS every time rather than cached: scenes get renamed between shows and
  // a stale list here would offer a name the cut can no longer find.
  if (route === "/obs/scenes") {
    try {
      json(res, 200, { ok: true, scenes: await reel.listScenes() });
    } catch (err) {
      json(res, 200, { ok: false, error: err.message, scenes: [] });
    }
    return;
  }

  if (route === "/undo" && req.method === "POST") {
    const removed = state.entries.pop() || null;
    if (removed) unarchiveEntries([removed.id]);
    saveState();
    pushState();
    log(removed ? `undid ${removed.score}/5 ${removed.pctText}` : "undo: nothing to remove");
    json(res, 200, { ok: true, removed });
    return;
  }

  // Nudge the running totals by hand. The board is permanent now, so there
  // has to be a way to correct it long after "Undo last" is useless -- and a
  // way to seed it with the quizzes that happened before it existed.
  //
  // Adds and removes real list entries rather than editing a counter, so
  // every other number (the percentages, the girls/guys split) stays derived
  // from one source and cannot drift.
  if (route === "/adjust" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    const bracket = String(body.bracket || "");
    const gender = ["woman", "man", "unknown"].includes(body.gender) ? body.gender : "unknown";
    const delta = Math.trunc(Number(body.delta));
    if (!["realistic", "borderline", "delusional"].includes(bracket)) {
      json(res, 400, { error: "bracket must be realistic, borderline or delusional" });
      return;
    }
    // Capped so a slipped keypress cannot add ten thousand entries to a
    // record that is meant to last.
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 500) {
      json(res, 400, { error: "delta must be a non-zero whole number, at most 500" });
      return;
    }

    // Read the score off BRACKET_OF rather than hardcoding one, so this still
    // lands in the right column if the tier-to-bracket split is ever retuned.
    const score = Number(Object.keys(BRACKET_OF).find((s) => BRACKET_OF[s] === bracket));

    let changed = 0;
    const removedReal = [];
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        state.entries.push({
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          ts: Date.now(),
          manual: true,
          score,
          label: "",
          pct: 0,
          pctText: "",
          criteria: [],
          gender,
          bracket,
        });
        changed++;
      }
    } else {
      // Take the most recent matches first, and prefer hand-added ones: an
      // adjustment being undone should eat its own entries before it starts
      // deleting somebody's real result.
      for (const wantManual of [true, false]) {
        for (let i = state.entries.length - 1; i >= 0 && changed < -delta; i--) {
          const e = state.entries[i];
          if (Boolean(e.manual) !== wantManual) continue;
          if ((BRACKET_OF[e.score] || "borderline") !== bracket) continue;
          if ((["woman", "man", "unknown"].includes(e.gender) ? e.gender : "unknown") !== gender) continue;
          if (!e.manual) removedReal.push(e.id);
          state.entries.splice(i, 1);
          changed++;
        }
      }
    }

    unarchiveEntries(removedReal);
    saveState();
    pushState();
    log(`adjusted ${bracket}/${gender} by ${delta > 0 ? "+" : "-"}${changed} -- total now ${state.entries.length}`);
    json(res, 200, { ok: true, changed, total: state.entries.length });
    return;
  }

  if (route === "/reset" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    // Wiping the all-time board has to be asked for explicitly. It is the one
    // number here that cannot be rebuilt from anywhere, so it does not get to
    // ride along on the button used between shows -- but it stays reachable,
    // because a board with a mistake baked into it forever is its own problem.
    const kept = state.entries.length;
    state = body.all ? emptyState() : clearedForNewShow(state);
    saveState();
    pushState();
    pushHype(); // clears the marquee too -- a reset is a fresh show, not just a fresh tally
    pushQuiz(); // and takes any half-finished question off the air
    // And stops the clock. A reset that left a countdown running would cut
    // the stream to the intro video some minutes later with nothing on
    // screen having warned that it was still armed.
    armCountdown();
    pushCountdown();
    log(body.all ? `ALL-TIME RESET -- ${kept} answer(s) erased` : `session reset (${kept} answer(s) kept)`);
    json(res, 200, { ok: true, all: !!body.all, kept: state.entries.length });
    return;
  }

  // Re-fires the last result's alert -- for when it fired while you were
  // on the wrong scene, or the guest disconnected before the reveal.
  if (route === "/replay" && req.method === "POST") {
    const last = state.entries[state.entries.length - 1];
    if (last) emitAlert(last);
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

  // What OBS's Chromium reported about itself, so a capability question can
  // be answered from the terminal instead of by squinting at a source.
  if (route === "/diag") {
    if (req.method === "POST") {
      lastDiag = Object.assign({ at: Date.now() }, await readBody(req));
      log(`diag: speech=${lastDiag.speechSynthesis} voices=${lastDiag.voiceCount}`);
      json(res, 200, { ok: true });
    } else {
      json(res, 200, lastDiag || { error: "nothing reported yet — point a browser source at /diag.html" });
    }
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
    addChat(msg);
    json(res, 200, { ok: true });
    return;
  }

  // Social Stream Ninja posts one object per message, and the same object
  // carries TikTok gifts, YouTube Superchats and Twitch bits in
  // `hasDonation`. Taking its shape directly means no adapter process to
  // babysit -- SSN points its webhook straight here.
  if (route === "/ssn" && req.method === "POST") {
    const input = (await readBody(req)) || {};
    const user = String(input.chatname || "").trim();
    const body = String(input.chatmessage || "").trim();
    const platform = String(input.type || "").trim();
    if (!user) {
      json(res, 400, { error: "no chatname" });
      return;
    }

    // A gift usually arrives as a message that happens to have a value on
    // it, so it becomes both a donation and a chat line -- dropping the
    // text would lose whatever they typed with it.
    const gift = String(input.hasDonation || "").trim();
    if (gift) {
      addDonation({ from: user, amount: gift, note: body, platform });
    }
    if (body) {
      addChat(normalizeChat({ user, text: body, platform, colour: input.nameColor }));
    }
    json(res, 200, { ok: true, donation: !!gift, chat: !!body });
    return;
  }

  if (route === "/quiz" && req.method === "POST") {
    const input = await readBody(req);
    if (!input) {
      json(res, 400, { error: "bad payload" });
      return;
    }
    // Not persisted to disk: a half-answered question is worth nothing
    // after a restart, and writing on every keystroke would thrash it.
    state.quiz = input.active === false ? null : {
      step: Number(input.step) || 0,
      total: Number(input.total) || 0,
      question: String(input.question || "").slice(0, 120),
      // Overrides the "Question 3 of 11" line. The intro slide is not a
      // question and must not be numbered like one.
      kicker: String(input.kicker || "").slice(0, 40),
      // The last thing a guest sees is their own number, not a pitch. The
      // console pushes this once on Find Out and it stays up until reset.
      result: input.result ? {
        pctText: String(input.result.pctText || "").slice(0, 24),
        oddsText: String(input.result.oddsText || "").slice(0, 120),
        label: String(input.result.label || "").slice(0, 40),
        score: Math.min(5, Math.max(1, Number(input.result.score) || 3)),
        // The paid-plan line under a non-U.S. verdict. Worded by the
        // console, which is the only side that knows the country.
        note: String(input.result.note || "").slice(0, 90),
      } : null,
      kind: input.kind === "value" ? "value" : "choice",
      value: String(input.value || "").slice(0, 60),
      options: Array.isArray(input.options)
        ? input.options.slice(0, 8).map((o) => ({
            label: String(o && o.label || "").slice(0, 40),
            selected: Boolean(o && o.selected),
          }))
        : [],
    };
    pushQuiz();
    json(res, 200, { ok: true });
    return;
  }

  if (route === "/hype" && req.method === "POST") {
    const input = await readBody(req);
    if (!input) {
      json(res, 400, { error: "bad payload" });
      return;
    }
    // A test tip shows the alert and nothing else. Donations are stored --
    // unlike rarity alerts, which carry their own test flag -- so without
    // this a single rehearsal leaves a fake top donor sitting in the ticker
    // for the rest of the night. Same bargain the tier test buttons make.
    if (input.donation && input.donation.test) {
      const d = input.donation;
      const { text, usd } = parseAmount(d.amount, d.usd);
      // Same strip as a real tip, so what you rehearse is what goes out.
      const picked = pickVoice(d.note);
      broadcast("donation", {
        loud: usd >= settings.ttsMin,
        from: String(d.from || "").slice(0, 40),
        amount: text,
        usd,
        note: picked.note.slice(0, 600),
        platform: String(d.platform || "").toLowerCase().slice(0, 20),
        ts: Date.now(),
      });
      // Speak it too, when it clears the bar. The whole reason to rehearse a
      // tip is to hear where the threshold sits -- a test that shows the gold
      // card in silence tells you nothing about the thing you were checking.
      const note = picked.note.slice(0, 600);
      if (usd >= settings.ttsMin) {
        speak(`${d.from} donated ${text || "a tip"}.${note ? " " + note : ""}`, picked.key);
      }
      log(`test tip ${text || "?"} from ${d.from}${usd >= settings.ttsMin ? " [spoken]" : ""}`);
      json(res, 200, { ok: true, test: true, spoken: usd >= settings.ttsMin });
      return;
    }
    if (input.donation) addDonation(input.donation);
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

  // The soundboard's index. Names are sent through exactly as they are on
  // disk, because the whole point is that the buttons read the way Tom named
  // the files -- no slugging, no prettifying.
  if (route === "/sfx") {
    let files = [];
    try {
      files = fs.readdirSync(SFX_DIR).filter((f) => SFX_TYPES.test(f)).sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" })
      );
    } catch (err) {
      json(res, 200, { dir: SFX_DIR, error: "cannot read the sounds folder", sounds: [] });
      return;
    }
    json(res, 200, {
      dir: SFX_DIR,
      sounds: files.map((f) => ({ file: f, name: f.replace(SFX_TYPES, "") })),
    });
    return;
  }
  if (route.startsWith("/sfx/")) {
    // decodeURIComponent because the names have spaces in them; serveStatic
    // is what refuses to walk out of the directory.
    let rel = route.slice("/sfx/".length);
    try { rel = decodeURIComponent(rel); } catch (err) { /* leave it as-is */ }
    serveStatic(res, SFX_DIR, rel);
    return;
  }
  // Brand art lives beside the overlays rather than inside them, and
  // serveStatic refuses to walk out of the directory it was handed, so
  // assets need their own mount the same way sounds do.
  if (route.startsWith("/assets/")) {
    serveStatic(res, ASSET_DIR, route.slice("/assets/".length));
    return;
  }
  if (route.startsWith("/site/")) {
    const name = route.slice("/site/".length);
    if (!SITE_FILES.has(name)) {
      json(res, 404, { error: "not served" });
      return;
    }
    serveStatic(res, SITE_DIR, name);
    return;
  }
  if (route === "/" || route === "") {
    serveStatic(res, OVERLAY_DIR, "control.html");
    return;
  }
  serveStatic(res, OVERLAY_DIR, route.slice(1));
};

// Chromium allows only SIX simultaneous connections to one origin, and every
// OBS browser source shares a single network stack. Each overlay holds its
// /events stream open forever, so with more than six of them the extras sit
// in CONNECTING for the rest of the night -- no error, no retry, just a page
// that never receives an alert. Which ones lose is a startup race, which is
// why the symptom appeared to wander between the alert, the meter and the
// quiz card. The limit is per ORIGIN, so extra loopback addresses multiply
// the budget: spread the sources across them and nothing has to
// queue. Same server, same handler, still loopback-only -- nothing is
// exposed. Each address is worth another six overlays, so add one here
// rather than crowding an origin up to its ceiling.
const ALT_HOSTS = (process.env.OOP_STREAM_ALT_HOSTS ||
                   process.env.OOP_STREAM_ALT_HOST ||
                   "127.0.0.2,127.0.0.3")
  .split(",").map((h) => h.trim()).filter((h) => h && h !== HOST);
const server = http.createServer(handle);
const altServers = ALT_HOSTS.map(() => http.createServer(handle));

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
  // Taken before the night touches anything, so there is always a copy of
  // the board as it stood when the relay came up.
  dailyBackup();
  backfillArchive();
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
  // Started after listen() so a missing OBS can't stop the relay coming up.
  // It retries on its own, which is the normal path -- OBS is usually still
  // loading when this line runs.
  // Worth one line at startup: a sting that stopped playing because the file
  // moved is otherwise completely silent about it, and you would only notice
  // on air.
  if (STING_FILE && !fs.existsSync(STING_FILE)) {
    log(`tip sting not found at ${STING_FILE} -- read-out tips will play the voice alone`);
  }

  reel.onMediaEnded(introFinished);
  reel.start(log);

  // A countdown that was running when the relay went down.
  //
  // If its deadline has already passed, it is NOT fired: coming back up
  // three hours later and immediately cutting a live stream to the intro
  // video, because of a clock that expired while nothing was running, is
  // about the worst thing this could do. A future deadline is simply picked
  // back up, which is the case that actually happens -- the relay gets
  // restarted mid-show far more often than it dies for hours.
  if (state.countdown) {
    const c = state.countdown;
    const left = c.running ? c.endsAt - Date.now() : c.remaining || 0;
    if (c.running && left <= 0) {
      state.countdown = null;
      saveState();
      log("a countdown expired while the relay was down -- cleared it rather than cutting now");
    } else {
      log(`countdown carried over: ${fmtClock(left)} ${c.running ? "left" : "left, paused"}`);
      armCountdown();
    }
  }

  // Best effort: if one of the extra addresses will not bind, the relay still
  // works, it just loses that address's slice of the overlay budget.
  altServers.forEach((srv, i) => {
    const altHost = ALT_HOSTS[i];
    srv.on("error", (err) => {
      log(`extra address ${altHost}:${PORT} unavailable (${err.code}) -- ` +
          "that origin's six overlay slots are not available");
    });
    srv.listen(PORT, altHost, () => {
      console.log(`  Extra origin    http://${altHost}:${PORT}/  ` +
                  "(spread the browser sources across these)");
    });
  });
  if (altServers.length) console.log("");
});
