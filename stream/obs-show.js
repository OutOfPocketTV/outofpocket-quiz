//
// Out Of Pocket -- which show is the open OBS on?
//
// OBS on this PC holds more than one show: the quiz stream lives in the
// "Untitled" scene collection + "Untitled" profile, and the Hunger stream in
// "Hunger" + "Hello Universe". OBS opens on whichever was used last, and when
// it is already running the launchers used to just bring its window forward.
// So after a Hunger session START SHOW fronted OBS still sitting on Hunger,
// which looks exactly like "making Hunger deleted my quiz stream".
//
// start-obs.ps1 runs this when it finds OBS already open. If OBS is on the
// other show and nothing is on air, the launcher closes it and reopens it
// with --collection/--profile, the same way a cold start does.
//
// It does NOT switch the show inside the running OBS. That was tried first
// (2026-11-02): SetCurrentProfile froze OBS 32.2.2 solid mid "video settings
// reset", with Aitum's extra canvases loaded, and it had to be killed.
// Loading a collection at startup is the path this rig has always used.
//
// Before handing back "close it", it stops any virtual camera or replay
// buffer on the other show: a running virtual camera stalls OBS's shutdown
// for many minutes. A stream or recording is never touched -- that is
// someone's live show, and the answer is to refuse.
//
//   node obs-show.js                       -> for Untitled / Untitled
//   node obs-show.js --collection X --profile Y
//   node obs-show.js --check               -> report only, stop nothing
//
// Exit codes: 0 already on this show, 4 on another show and clear to close,
// 3 on another show and live (stream/recording), 2 OBS not reachable,
// 1 something else went wrong.
//
// Zero dependencies, same as the relay: node has a global WebSocket since v22.
//
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const WANT_COLLECTION = arg("--collection", "Untitled");
const WANT_PROFILE = arg("--profile", "Untitled");
const CHECK_ONLY = process.argv.includes("--check");

// Same source of truth as obs-reel.js: obs-websocket's own config, so no
// password is copied anywhere.
let cfg = {};
try {
  cfg = JSON.parse(
    fs.readFileSync(
      path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        "obs-studio",
        "plugin_config",
        "obs-websocket",
        "config.json"
      ),
      "utf8"
    )
  );
} catch (err) {}

function done(code, msg) {
  console.log(msg);
  process.exit(code);
}

setTimeout(() => done(1, "OBS did not answer within 20s."), 20000);

const ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port || 4455}`);
const pending = new Map();
let nextId = 1;

function request(requestType, requestData) {
  const requestId = String(nextId++);
  ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

ws.onerror = () => done(2, "Could not reach OBS's websocket server.");

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.op === 0) {
    const identify = { op: 1, d: { rpcVersion: 1, eventSubscriptions: 0 } };
    const auth = msg.d.authentication;
    if (auth) {
      const secret = crypto
        .createHash("sha256")
        .update((cfg.server_password || "") + auth.salt)
        .digest("base64");
      identify.d.authentication = crypto
        .createHash("sha256")
        .update(secret + auth.challenge)
        .digest("base64");
    }
    ws.send(JSON.stringify(identify));
    return;
  }

  if (msg.op === 7) {
    const p = pending.get(msg.d.requestId);
    if (!p) return;
    pending.delete(msg.d.requestId);
    if (msg.d.requestStatus.result) p.resolve(msg.d.responseData || {});
    else p.reject(new Error(msg.d.requestStatus.comment || `code ${msg.d.requestStatus.code}`));
    return;
  }

  if (msg.op !== 2) return;

  try {
    const onCollection = (await request("GetSceneCollectionList")).currentSceneCollectionName;
    const onProfile = (await request("GetProfileList")).currentProfileName;
    const here = `'${onCollection}' / '${onProfile}'`;

    if (onCollection === WANT_COLLECTION && onProfile === WANT_PROFILE) {
      done(0, `OBS is already on ${here}.`);
    }

    const onAir = [];
    if ((await request("GetStreamStatus")).outputActive) onAir.push("streaming");
    if ((await request("GetRecordStatus")).outputActive) onAir.push("recording");

    // Aitum's outputs only show up here. The list can be slow while Aitum is
    // busy, so it is best-effort: the built-in checks above always run.
    let stoppable = [];
    try {
      const outputs = (await withTimeout(request("GetOutputList"), 5000)).outputs || [];
      for (const o of outputs.filter((o) => o.outputActive)) {
        if (/virtualcam|replay/i.test(o.outputKind)) stoppable.push(o.outputName);
        else onAir.push(o.outputName);
      }
    } catch (err) {}
    if (onAir.length) {
      done(3, `OBS is on ${here} and live (${onAir.join(", ")}). Not closing it.`);
    }

    if (CHECK_ONLY) {
      const extra = stoppable.length ? ` Would stop: ${stoppable.join(", ")}.` : "";
      done(4, `OBS is on ${here}, nothing on air.${extra}`);
    }

    if ((await request("GetVirtualCamStatus")).outputActive) {
      await request("StopVirtualCam");
      stoppable = stoppable.filter((n) => !/^virtualcam_output$/.test(n));
    }
    for (const name of stoppable) {
      try {
        await request("StopOutput", { outputName: name });
      } catch (err) {}
    }
    done(4, `OBS is on ${here}, nothing on air. Its virtual camera is stopped so it can close.`);
  } catch (err) {
    done(1, `Could not read OBS's state: ${err.message}`);
  }
};
