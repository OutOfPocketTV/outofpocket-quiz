// Saves the StreamElements token so tips come straight to the relay.
//
//   1. Copy the JWT from streamelements.com (Account -> Channels ->
//      Show secrets -> JWT Token)
//   2. node stream/connect-streamelements.js
//
// It reads the token off the clipboard, proves it works by connecting to
// StreamElements with it, and writes it to stream/.env.local -- which
// .gitignore already covers. The token is never printed, never logged, and
// never passed on a command line where it would land in shell history.
//
// Same shape as comment-bot/connect-youtube.js and connect-facebook.js, on
// purpose: one way of doing this, not three.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const se = require('./streamelements.js');

const ENV_FILE = path.join(__dirname, '.env.local');
const KEY = 'OOP_SE_JWT';

function readClipboard() {
  const r = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' })
    : spawnSync('pbpaste', { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

// A JWT is three dot-separated base64url chunks. Checked before anything is
// sent anywhere, so a stray copy (a password, a URL, the word "JWT Token")
// is caught here rather than by a confusing network error.
function looksLikeJwt(text) {
  const parts = text.split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
}

// Connect for real and wait for StreamElements to accept or refuse it.
// Saving a token that does not work, and finding out mid-show, is the one
// outcome worth spending fifteen seconds to avoid.
function verify(token) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok, why) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { client && client.stop(); } catch { /* already closed */ }
      resolve({ ok, why });
    };
    const timer = setTimeout(() => finish(false, 'no answer from StreamElements after 15 seconds'), 15000);
    const client = se.start({
      token,
      onTip() { /* not listening for tips here */ },
      log: (line) => {
        if (/connected/.test(line)) finish(true, '');
        if (/refused/.test(line)) finish(false, 'StreamElements refused that token');
      },
    });
    if (!client) finish(false, 'this Node build has no WebSocket');
    else {
      const poll = setInterval(() => {
        if (client.isLive()) { clearInterval(poll); finish(true, ''); }
      }, 200);
      setTimeout(() => clearInterval(poll), 15500);
    }
  });
}

// Replace the key if it is already there, otherwise append it. Comments and
// any other settings in the file are left exactly as they are.
function saveToken(token) {
  let lines = [];
  if (fs.existsSync(ENV_FILE)) lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  let replaced = false;
  lines = lines.map((line) => {
    if (new RegExp('^\\s*' + KEY + '\\s*=').test(line)) {
      replaced = true;
      return KEY + '=' + token;
    }
    return line;
  });
  if (!replaced) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push(KEY + '=' + token, '');
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n'));
  return replaced;
}

async function main() {
  const token = readClipboard();
  if (!token) {
    console.error('\nThe clipboard is empty.');
    console.error('Copy the JWT Token from streamelements.com -> Account -> Channels -> Show secrets,');
    console.error('then run this again.\n');
    process.exit(1);
  }
  if (!looksLikeJwt(token)) {
    console.error('\nThat does not look like a StreamElements JWT.');
    console.error('It is one long string with two dots in it, and no spaces.');
    console.error('Make sure you copied the JWT Token itself, not the label next to it.\n');
    process.exit(1);
  }

  console.log('\nChecking the token with StreamElements...');
  const { ok, why } = await verify(token);
  if (!ok) {
    console.error(`\nThat token did not work -- ${why}.`);
    console.error('Nothing was saved. Copy the JWT again and re-run.\n');
    // Not process.exit(): the socket is still closing, and killing the
    // process mid-close trips a libuv assertion that prints a page of C
    // after a message that had already said everything.
    process.exitCode = 1;
    return;
  }

  const replaced = saveToken(token);
  console.log('Token accepted.');
  console.log(`${replaced ? 'Updated' : 'Saved'} it in stream/.env.local (gitignored, never printed).`);
  console.log('\nRestart the relay. It should say:');
  console.log('  streamelements: connected -- tips now arrive directly, no OBS needed\n');
}

main().catch((err) => {
  console.error(`\nSomething went wrong: ${err.message}\n`);
  process.exit(1);
});
