// Restore the Delusion Meter's all-time board from a backup.
//
//   node restore-stats.js            list every backup, newest first
//   node restore-stats.js <file>     put that one back
//
// Every backup is a plain copy of session.json, so this only ever copies a
// file over another file. The relay writes the backups itself: one per day,
// plus a timestamped one immediately before anything that shrinks the board
// (an undo, a downward adjustment, an all-time reset).

const fs = require("fs");
const path = require("path");
const net = require("net");

const DIR = path.join(__dirname, "stats-backups");
const STATE_FILE = path.join(__dirname, "session.json");
const PORT = 4700;

function summarise(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    const by = { woman: 0, man: 0 };
    for (const e of entries) if (by[e.gender] !== undefined) by[e.gender]++;
    return { count: entries.length, girls: by.woman, guys: by.man };
  } catch (err) {
    return { count: null, error: err.message };
  }
}

function list() {
  let names = [];
  try {
    names = fs.readdirSync(DIR).filter((n) => n.slice(-5) === ".json").sort().reverse();
  } catch (err) {
    console.log("No backups yet (" + DIR + " does not exist).");
    return [];
  }
  if (!names.length) { console.log("No backups in " + DIR); return []; }

  console.log("Backups in " + DIR + " (newest first):");
  console.log("");
  const now = summarise(STATE_FILE);
  console.log("  session.json right now".padEnd(58) +
    (now.count === null ? "unreadable" : now.count + " answers (" + now.girls + " girls, " + now.guys + " guys)"));
  console.log("");
  for (const n of names) {
    const s = summarise(path.join(DIR, n));
    console.log("  " + n.padEnd(56) +
      (s.count === null ? "unreadable: " + s.error
                        : s.count + " answers (" + s.girls + " girls, " + s.guys + " guys)"));
  }
  console.log("");
  console.log("To restore:  node restore-stats.js <filename>");
  return names;
}

function relayRunning(done) {
  const sock = net.connect({ host: "127.0.0.1", port: PORT });
  const finish = (up) => { sock.destroy(); done(up); };
  sock.setTimeout(700);
  sock.on("connect", () => finish(true));
  sock.on("error", () => finish(false));
  sock.on("timeout", () => finish(false));
}

function restore(name) {
  const from = path.join(DIR, name);
  if (!fs.existsSync(from)) { console.error("No such backup: " + from); process.exit(1); }
  const s = summarise(from);
  if (s.count === null) { console.error("That backup is unreadable: " + s.error); process.exit(1); }

  relayRunning((up) => {
    if (up) {
      console.error("The relay is running on port " + PORT + ".");
      console.error("Stop it first, or it will overwrite session.json from memory and undo this.");
      process.exit(1);
    }
    // The board being replaced is itself worth keeping -- restoring the
    // wrong file should not be the thing that loses the data.
    if (fs.existsSync(STATE_FILE)) {
      const aside = path.join(DIR, "stats-" + new Date().toISOString().replace(/[:.]/g, "-") + "-before-restore.json");
      fs.copyFileSync(STATE_FILE, aside);
      console.log("Kept the current board as " + path.basename(aside));
    }
    fs.copyFileSync(from, STATE_FILE);
    console.log("Restored " + name + " -- " + s.count + " answers (" + s.girls + " girls, " + s.guys + " guys).");
    console.log("Start the relay and the meter will show it.");
  });
}

const arg = process.argv[2];
if (!arg) list();
else restore(arg);
