#!/usr/bin/env node
/*
 * PreToolUse hook: refuse to launch OBS when OBS is already running.
 *
 * Two OBS processes sharing one config directory is the bug behind "all my
 * scenes get deleted when I exit OBS" -- both write basic/scenes/Untitled.json,
 * aitum.json and user.ini on the way out, and the last one to exit wins, so an
 * instance that has been sitting on a stale copy since it launched silently
 * rolls back everything done since. The OBS logs for 2026-08-26 show three
 * overlapping lifetimes; two of them got past the already-running dialog and
 * fully loaded the scene collection before dying.
 *
 * Telling an assistant to "check first" does not hold across sessions, so the
 * check lives here instead. Written in node because this machine has no jq,
 * and node is already required for the relay.
 *
 * Deliberately narrow. It blocks LAUNCHES only -- Get-Process, tasklist,
 * Stop-Process, grep and friends are how you diagnose OBS and must keep
 * working. It also stays out of the way of the two scripts that already
 * handle this properly themselves.
 */

"use strict";

const { execSync } = require("child_process");

// The sanctioned launchers. start-obs.ps1 refuses a second instance on its
// own; restart-obs.ps1 legitimately relaunches, but only after waiting for
// every obs64 to actually exit. Blocking these would break the fix.
const SANCTIONED = /(start|restart)-obs\.(ps1|cmd)/i;

// Something that actually starts a process, as opposed to inspecting one.
const LAUNCH = [
  /Start-Process/i,
  /\bstart\s+["']/i, //  cmd's  start "" "...obs64.exe"
  /\bstart\s+[^|;&\n]*obs64/i,
  /&\s*["'][^"']*obs64\.exe/i, //  PowerShell call operator
  /\bInvoke-Item\b/i,
  /^\s*["']?[A-Za-z]:[\\/][^"'\n]*obs64\.exe/im, //  bare path invocation
];

function readStdin() {
  try {
    return require("fs").readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function obsIsRunning() {
  try {
    // Plain tasklist, not tasklist /FI -- the quoted filter gets mangled
    // when this runs under Git Bash and returns a false negative, which
    // would silently disable the whole hook.
    return /^obs64\.exe/im.test(execSync("tasklist", { encoding: "utf8" }));
  } catch {
    // If we cannot tell, do not block. A hook that fails closed here would
    // make OBS unlaunchable, which is worse than the bug it prevents.
    return false;
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(readStdin());
} catch {
  process.exit(0); // Malformed input is not a reason to block anything.
}

const tool = String(payload.tool_name || "");
const input = payload.tool_input || {};
const text =
  tool === "Bash" || tool === "PowerShell"
    ? String(input.command || "")
    : JSON.stringify(input);

if (!/obs/i.test(text)) process.exit(0);
if (SANCTIONED.test(text)) process.exit(0);

// Note this tests the whole command for a launch verb rather than requiring
// the literal string "obs64" next to it. A script that does
// `Start-Process -FilePath $obsExe` never mentions obs64 at all, and that is
// the shape an ad-hoc relaunch actually takes. We already know the command
// mentions "obs" somewhere, so the occasional false positive -- opening a log
// file out of the obs-studio folder, say -- is worth it: the cost of one is a
// message telling you which script to run instead, and the cost of a miss is
// an evening of scene work.
const isOpenApp = /open_application/i.test(tool);
const wantsLaunch = isOpenApp || LAUNCH.some((re) => re.test(text));

if (!wantsLaunch) process.exit(0);
if (!obsIsRunning()) process.exit(0);

deny(
  "OBS (obs64.exe) is ALREADY RUNNING -- do not start a second instance.\n" +
    "\n" +
    "Two OBS processes share one config directory and both rewrite the scene\n" +
    "collection on exit. The last one out wins, so the stale instance silently\n" +
    "overwrites the good one. This is the cause of Tom's scenes disappearing.\n" +
    "\n" +
    "Instead:\n" +
    "  - to bring the existing window forward, run stream/start-obs.cmd\n" +
    "    (it detects the running instance and focuses it)\n" +
    "  - to genuinely restart it, run stream/restart-obs.cmd\n" +
    "    (it waits for every obs64 to exit first)\n" +
    "  - never call computer-use open_application on OBS."
);
