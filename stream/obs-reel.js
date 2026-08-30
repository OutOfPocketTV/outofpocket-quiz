//
// Out Of Pocket -- the relay's link to OBS.
//
// It started life as nothing but the tier-5 payoff reel, and that is still
// the bulk of it, but it is now the one place anything in the relay talks to
// OBS: the reel, and the Starting Soon countdown's cut into the intro video.
// Keeping it to one module means one connection, one reconnect loop and one
// place where "OBS isn't running" is handled.
//
// Why the reel isn't just a <video> in alert.html any more:
// playing one inside an OBS browser source kills the video output of the
// WHOLE page. The alert keeps running and keeps making noise, but the
// source stops handing OBS a new texture -- so the picture sticks on
// whatever frame it happened to be on. That is CEF's off-screen renderer
// refusing to composite a promoted video layer, not a codec or a file-size
// problem, so no amount of re-encoding fixes it. The video therefore lives
// in an OBS *media source*, which OBS decodes on its own pipeline, and
// this module is what tells OBS to roll it.
//
// obs-websocket v5 is a plain WebSocket protocol and node has shipped a
// global WebSocket since v22, so this keeps the relay's zero-dependency
// promise -- there is nothing here to npm install.
//
// If OBS isn't running, or its websocket server is off, every function in
// here degrades to a no-op. An alert must never fail because the reel
// couldn't roll.
//
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

// obs-websocket keeps its port and password in its own plugin config, and
// this relay runs on the same machine as OBS -- so read them from there
// rather than asking anyone to copy the password into an .env file or a
// shortcut. Nothing secret is stored anywhere new, nothing lands in git,
// and rerolling the password in OBS needs no change here: the file is
// re-read on every connection attempt.
const OBS_CONFIG = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "obs-studio",
  "plugin_config",
  "obs-websocket",
  "config.json"
);

let cfg = {};
function loadObsConfig() {
  try {
    cfg = JSON.parse(fs.readFileSync(OBS_CONFIG, "utf8")) || {};
  } catch (err) {
    cfg = {}; // no OBS on this machine, or it has never opened the plugin
  }
}

function obsUrl() {
  return process.env.OOP_OBS_URL || `ws://127.0.0.1:${cfg.server_port || 4455}`;
}
function obsPassword() {
  return process.env.OOP_OBS_PASSWORD || cfg.server_password || "";
}

const REEL_SOURCE = process.env.OOP_REEL_SOURCE || "Matrix Reel";

// Matches MEME_MIN in alert.html. The tier that earns the reel is also the
// tier whose chime is suppressed, so if you move one you must move both.
const REEL_MIN_SCORE = Number(process.env.OOP_REEL_MIN || 5);

let ws = null;
let identified = false;
let nextRequestId = 1;
const pending = new Map();
let reconnectTimer = null;
let reconnectDelay = 1000;
let announcedDown = false;
let log = () => {};
// Anyone who wants to know when a media source played itself out. Only the
// countdown uses it (to hand the show back to a live scene when the intro
// video finishes), but it is kept generic so the reel could too.
const endedHandlers = new Set();

function send(frame) {
  try {
    ws.send(JSON.stringify(frame));
  } catch (err) {
    /* socket died between the check and the write; the close handler reconnects */
  }
}

function connect() {
  if (ws || reconnectTimer) return;
  if (typeof WebSocket === "undefined") {
    if (!announcedDown) log("reel: this node has no global WebSocket (needs 22+); reel disabled");
    announcedDown = true;
    return;
  }
  loadObsConfig();
  try {
    ws = new WebSocket(obsUrl());
  } catch (err) {
    ws = null;
    scheduleReconnect();
    return;
  }

  ws.onmessage = (ev) => {
    let msg = null;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
    } catch (err) {
      return;
    }
    handle(msg);
  };

  ws.onclose = () => {
    const wasUp = identified;
    ws = null;
    identified = false;
    pending.forEach((p) => p.reject(new Error("obs connection closed")));
    pending.clear();
    if (wasUp) log("reel: lost the OBS connection, will retry");
    scheduleReconnect();
  };

  // Without a handler node treats a socket error as an unhandled 'error'
  // event and takes the whole relay down with it.
  ws.onerror = () => {};
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  if (reconnectTimer.unref) reconnectTimer.unref();
  // Capped low on purpose. OBS is usually started after the relay, so the
  // first few attempts failing is the normal case -- but backing off towards
  // a minute meant that by the time OBS appeared we were 25s from noticing,
  // and the stop above landed long after the clip had played out in full.
  // Polling a local websocket every few seconds costs nothing next to that.
  reconnectDelay = Math.min(3000, Math.round(reconnectDelay * 1.7));
}

function handle(msg) {
  if (msg.op === 0) {
    // MediaInputs (1 << 8) and nothing else. The one event worth hearing is
    // MediaInputPlaybackEnded -- it is how the countdown knows the intro
    // video has finished -- and subscribing to the rest would have OBS
    // streaming us every scene, filter and scene-item change on the machine
    // for no reader.
    const identify = { op: 1, d: { rpcVersion: 1, eventSubscriptions: 1 << 8 } };
    const auth = msg.d && msg.d.authentication;
    if (auth) {
      const password = obsPassword();
      if (!password) {
        log("reel: OBS wants a websocket password and none was found in its config -- reel disabled");
        announcedDown = true;
        try {
          ws.close();
        } catch (err) {}
        return;
      }
      const secret = crypto.createHash("sha256").update(password + auth.salt).digest("base64");
      identify.d.authentication = crypto
        .createHash("sha256")
        .update(secret + auth.challenge)
        .digest("base64");
    }
    send(identify);
    return;
  }

  if (msg.op === 2) {
    identified = true;
    reconnectDelay = 1000;
    announcedDown = false;
    log(`reel: connected to OBS -- "${REEL_SOURCE}" armed for tier ${REEL_MIN_SCORE}`);
    // A media source plays itself the moment it loads, and with the reel left
    // visible on every canvas that means the Matrix clip going off on its own
    // every time OBS launches. So: stop it the instant we are connected.
    //
    // Deliberately NOT ensureLoaded() here. A source that has played and
    // cleared itself reports a null duration, and so does one that has never
    // played at all -- which is every fresh OBS start. ensureLoaded() read
    // that as "stale", re-set local_file to reopen the file, and re-setting
    // local_file is itself what starts playback. The reel therefore played
    // TWICE on every launch: once when OBS loaded the source, and again when
    // the relay "healed" a source that was never broken. The genuine stale
    // case (clip replaced on disk) is still caught reactively in fire(),
    // which is the only place the difference is actually observable.
    media("STOP").catch(() => {});
    return;
  }

  if (msg.op === 5) {
    const d = msg.d || {};
    if (d.eventType !== "MediaInputPlaybackEnded") return;
    const name = (d.eventData && d.eventData.inputName) || "";
    for (const fn of endedHandlers) {
      try {
        fn(name);
      } catch (err) {
        /* a listener throwing must not take the OBS link down */
      }
    }
    return;
  }

  if (msg.op === 7) {
    const d = msg.d || {};
    const p = pending.get(d.requestId);
    if (!p) return;
    pending.delete(d.requestId);
    if (d.requestStatus && d.requestStatus.result) p.resolve(d.responseData || {});
    else p.reject(new Error((d.requestStatus && d.requestStatus.comment) || d.requestType + " failed"));
    return;
  }
}

function request(type, data) {
  return new Promise((resolve, reject) => {
    if (!identified) {
      reject(new Error("OBS not connected"));
      return;
    }
    const id = "oop-" + nextRequestId++;
    pending.set(id, { resolve, reject });
    send({ op: 6, d: { requestType: type, requestId: id, requestData: data || {} } });
    const t = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(type + " timed out"));
    }, 3000);
    if (t.unref) t.unref();
  });
}

function media(action, input) {
  return request("TriggerMediaInputAction", {
    inputName: input || REEL_SOURCE,
    mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_" + action,
  });
}

// Replacing the clip on disk while OBS has the source open leaves it dead:
// it reports state ENDED with a *null duration* and silently ignores every
// restart you send it -- no error, no log, just a tier-5 alert with nothing
// behind it. A null duration is the tell, and re-setting the file path is
// what makes ffmpeg_source re-open the file. Worth healing automatically:
// this failure is invisible until it happens on air.
async function ensureLoaded(input) {
  const name = input || REEL_SOURCE;
  const st = await request("GetMediaInputStatus", { inputName: name });
  if (st.mediaDuration) return true;

  const cur = await request("GetInputSettings", { inputName: name });
  const file = (cur.inputSettings && cur.inputSettings.local_file) || "";
  if (!file) {
    log(`reel: "${name}" has no file set`);
    return false;
  }
  await request("SetInputSettings", { inputName: name, inputSettings: { local_file: "" }, overlay: true });
  await request("SetInputSettings", { inputName: name, inputSettings: { local_file: file }, overlay: true });
  log(`reel: "${name}" had gone stale (clip replaced on disk?) -- reloaded it`);
  return true;
}

// Called for every alert. Anything below the reel tier returns immediately,
// which is what keeps tiers 1-4 on the chime alone.
//
// This restarts the *input* rather than showing and hiding a scene item, and
// that is the whole trick to getting the reel onto more than one canvas.
// obs-websocket can only see the Main canvas -- ask it for anything on Guest
// or Vertical and it answers "no source ... within the canvas `Main`" -- so a
// scene-item toggle could never reach the guest's feed. Playback state, on
// the other hand, belongs to the source, so one RESTART plays the clip on
// every canvas the source is placed on at once.
//
// The items are therefore left permanently visible everywhere and the source
// is set to clear_on_media_end, which draws literally nothing once the clip
// finishes -- verified on a live scene, not assumed. Nothing has to be put
// away afterwards, which also means nothing can be left on screen if a
// message goes missing.
async function fire(score) {
  if (!(Number(score) >= REEL_MIN_SCORE)) return;
  if (!identified) {
    connect();
    if (!announcedDown) log("reel: OBS isn't connected, so this one goes out without the reel");
    return;
  }
  try {
    await media("RESTART");
    // Confirm it actually took. This costs one round trip *after* the clip is
    // already rolling, so it never delays the reveal -- but it turns "the reel
    // silently didn't play" into something that fixes itself by the next alert.
    const st = await request("GetMediaInputStatus", { inputName: REEL_SOURCE });
    if (!st.mediaDuration) {
      await ensureLoaded();
      await media("RESTART");
    }
    log(`reel: rolling "${REEL_SOURCE}"`);
  } catch (err) {
    log(`reel: didn't roll (${err.message})`);
  }
}

// ------------------------------------------------------------- the cut
//
// Everything below is for the Starting Soon countdown. The switch it has to
// make happens at a moment when nobody is at the keyboard -- that is the
// whole point of a countdown -- so it has to be right the first time and it
// has to say clearly when it wasn't.

function isUp() {
  return identified;
}

// Cut the program to a scene, whatever transition OBS currently has set.
// Deliberately not forcing one here: the Matrix stinger is the house
// transition and this cut should look like every other one.
async function cutTo(sceneName) {
  if (!sceneName) throw new Error("no scene to cut to");
  if (!identified) {
    connect();
    throw new Error("OBS is not connected");
  }
  await request("SetCurrentProgramScene", { sceneName });
  log(`cut to "${sceneName}"`);
}

// Confirm a media source is actually rolling, and heal it if it isn't.
//
// The intro clip is set to restart on activate, so cutting to its scene is
// already enough to play it -- OBS does that itself, with no round trip to
// go missing. This is the check afterwards, not the mechanism: it costs one
// message *after* the video is already on screen, and it turns "the intro
// silently didn't play" into something that fixes itself within a second
// rather than into dead air on a live stream.
async function confirmRolling(inputName) {
  if (!inputName || !identified) return false;
  const st = await request("GetMediaInputStatus", { inputName });
  const playing = st.mediaState === "OBS_MEDIA_STATE_PLAYING" && st.mediaDuration;
  if (playing) return true;
  if (!st.mediaDuration) await ensureLoaded(inputName);
  await media("RESTART", inputName);
  log(`"${inputName}" wasn't rolling after the cut -- restarted it`);
  return true;
}

// Fires with the input's name every time a media source plays itself out.
function onMediaEnded(fn) {
  if (typeof fn === "function") endedHandlers.add(fn);
}

// Scene names, in OBS's own order, for the control panel's dropdowns.
async function listScenes() {
  if (!identified) {
    connect();
    throw new Error("OBS is not connected");
  }
  const d = await request("GetSceneList", {});
  // GetSceneList comes back top-first, which is the reverse of how the
  // scene list reads in the OBS window.
  return (d.scenes || []).map((s) => s.sceneName).reverse();
}

function start(logger) {
  if (typeof logger === "function") log = logger;
  connect();
}

module.exports = {
  start,
  fire,
  cutTo,
  confirmRolling,
  onMediaEnded,
  listScenes,
  isUp,
  REEL_MIN_SCORE,
  REEL_SOURCE,
};
