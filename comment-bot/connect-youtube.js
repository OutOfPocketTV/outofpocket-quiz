// One-time: lets the bot post replies as the Out Of Pocket YouTube channel.
//
//   node comment-bot/connect-youtube.js
//
// Google Cloud is ALREADY set up (2026-09-14): project "Out Of Pocket bot"
// (out-of-pocket-bot) on outofpocketinterviews@gmail.com, YouTube API on,
// app published "In production", Desktop client "Comment bot". Its key was
// downloaded to Downloads as client_secret_*.json, which this script reads
// by itself. The steps below are only for redoing it from scratch:
//   1. APIs & Services -> Library -> "YouTube Data API v3" -> Enable.
//   2. Google Auth Platform (the old "OAuth consent screen") -> Get started
//      -> app name "Out Of Pocket comment bot", your email, Audience:
//      External -> Create.
//   3. Audience -> Publish app, so it says "In production". IMPORTANT: left
//      in "Testing", Google cancels the bot's login every 7 days and it
//      silently stops replying.
//   4. Clients -> Create client -> Application type "Desktop app" -> Create
//      -> Download JSON (Google never shows the secret again after that).
//
// Then run this. It finds the downloaded key; failing that it asks for the
// Client ID and secret. A browser opens: sign in
// with the Google account that owns the channel and pick Out Of Pocket TV.
// Google will warn "Google hasn't verified this app" -- expected for a
// private tool nobody else uses. Advanced -> Go to Out Of Pocket comment bot.
//
// It saves the login to comment-bot/.env.local (gitignored), does a practice
// run (which comments from the last 3 days it would answer, and how many old
// questions turn up in the first 2,500 comments of the busiest video --
// nothing is posted), then walks through adding the three GitHub secrets
// one clipboard paste at a time.

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');
const yt = require('./youtube');
const { runYouTube, loadLocalEnv } = require('./run');

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const ENV_FILE = path.join(__dirname, '.env.local');
const SECRETS_PAGE = 'https://github.com/OutOfPocketTV/outofpocket-quiz/settings/secrets/actions';

// The key Google Cloud offers as "Download JSON" when the client is
// created. Taken from the path given on the command line, or else the newest
// client_secret_*.json in Downloads, so nobody has to copy the secret by hand.
function readClientFile(given) {
  const downloads = path.join(os.homedir(), 'Downloads');
  let files = [];
  if (given) files = [path.resolve(given)];
  else if (fs.existsSync(downloads)) {
    files = fs.readdirSync(downloads)
      .filter((n) => /^client_secret_.*\.json$/i.test(n))
      .map((n) => path.join(downloads, n))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }
  for (const file of files) {
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      const c = json.installed || json.web;
      if (c?.client_id && c?.client_secret) return { clientId: c.client_id, clientSecret: c.client_secret, file };
    } catch {}
  }
  return null;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

function openBrowser(url) {
  // rundll32 takes the URL as a plain argument, so the &s in it survive --
  // "start" would read them as command separators.
  const [cmd, args] = process.platform === 'win32'
    ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

// A one-shot server on a random local port. Google sends the browser back
// to it with ?code=..., which `code` resolves to.
async function startCallbackServer(state) {
  let settle;
  const code = new Promise((resolve, reject) => { settle = { resolve, reject }; });

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/') { res.writeHead(404).end(); return; }
    const error = u.searchParams.get('error');
    const ok = !error && u.searchParams.get('state') === state && u.searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ok
      ? '<h2 style="font-family:sans-serif">Connected. You can close this tab and go back to the terminal.</h2>'
      : `<h2 style="font-family:sans-serif">Not connected (${error || 'unexpected response'}). Run the script again.</h2>`);
    clearTimeout(timer);
    server.close();
    ok ? settle.resolve(u.searchParams.get('code')) : settle.reject(new Error(`Not connected: ${error || 'unexpected response'}`));
  });
  const timer = setTimeout(() => {
    server.close();
    settle.reject(new Error('Timed out after 5 minutes waiting for the browser.'));
  }, 5 * 60 * 1000);

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { redirectUri: `http://127.0.0.1:${server.address().port}`, code };
}

async function main() {
  loadLocalEnv();
  const fromFile = readClientFile(process.argv[2]);
  if (fromFile) console.log(`Using the Google key in ${fromFile.file}`);
  const clientId = fromFile?.clientId || process.env.YOUTUBE_CLIENT_ID || await ask('Client ID: ');
  const clientSecret = fromFile?.clientSecret || process.env.YOUTUBE_CLIENT_SECRET || await ask('Client secret: ');
  if (!clientId || !clientSecret) throw new Error('Both the Client ID and the Client secret are needed.');

  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  const callback = await startCallbackServer(state);
  const { redirectUri } = callback;

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // forces Google to hand over a refresh token every time
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  console.log(
    '\nOpening your browser. In it:\n' +
    '   1. Pick outofpocketinterviews@gmail.com, then the Out Of Pocket TV channel.\n' +
    '   2. Google warns "Google hasn\'t verified this app". That is expected -- it is your own bot.\n' +
    '      Click "Advanced", then "Go to Out Of Pocket comment bot".\n' +
    '   3. Tick the box to let it manage your YouTube comments, then Continue.\n' +
    '\nIf nothing opens, paste this into your browser:\n\n' + authUrl + '\n'
  );
  openBrowser(authUrl);

  const code = await callback.code;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error(`Google refused the login: ${tokens.error} ${tokens.error_description || ''}`);
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Run the script again.');

  const channel = await yt.getMyChannel(tokens.access_token);
  console.log(`Connected as the YouTube channel: ${channel.title}  (${channel.id})`);
  console.log('If that is not Out Of Pocket TV, run this again and pick the right channel.\n');

  fs.writeFileSync(ENV_FILE, [
    `YOUTUBE_CLIENT_ID=${clientId}`,
    `YOUTUBE_CLIENT_SECRET=${clientSecret}`,
    `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`,
    '',
  ].join('\n'));
  Object.assign(process.env, {
    YOUTUBE_CLIENT_ID: clientId,
    YOUTUBE_CLIENT_SECRET: clientSecret,
    YOUTUBE_REFRESH_TOKEN: tokens.refresh_token,
  });

  console.log(`Saved to ${path.relative(process.cwd(), ENV_FILE)} (never committed).`);
  if (fromFile) console.log(`The downloaded ${path.basename(fromFile.file)} is no longer needed; you can delete it.`);

  console.log('\nPractice run -- nothing is posted. New comments from the last 3 days, then a first look at old ones:\n');
  await runYouTube({ dryRun: true, hours: 72 });

  await guideGitHubSecrets([
    ['YOUTUBE_CLIENT_ID', clientId],
    ['YOUTUBE_CLIENT_SECRET', clientSecret],
    ['YOUTUBE_REFRESH_TOKEN', tokens.refresh_token],
  ]);
}

function copyToClipboard(text) {
  const cmd = process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : null;
  if (!cmd) return false;
  return spawnSync(cmd, { input: text }).status === 0;
}

// GitHub needs the three values so the bot runs without this PC. Rather than
// printing secrets for Tom to copy, each one goes on the clipboard in turn
// with GitHub's "New secret" page already open. Never shown on screen.
async function guideGitHubSecrets(secrets) {
  const newSecretPage = `${SECRETS_PAGE}/new`;
  if (!process.stdin.isTTY || !copyToClipboard('')) {
    console.log(`\nLast step: add ${secrets.map(([n]) => n).join(', ')} at ${newSecretPage}` +
      `\n(the values are in ${path.relative(process.cwd(), ENV_FILE)}).`);
    return;
  }

  console.log('\nLast step: give GitHub the three values, so the bot runs even with this PC off.');
  for (const [i, [name, value]] of secrets.entries()) {
    copyToClipboard(value);
    openBrowser(newSecretPage);
    await ask(
      `\n(${i + 1} of 3) A GitHub "New secret" page just opened, and the value is already copied.\n` +
      `   1. In the Name box, type:  ${name}\n` +
      '   2. Click in the Secret box and press Ctrl+V\n' +
      '   3. Click "Add secret"\n' +
      '   Then come back here and press Enter. '
    );
  }
  copyToClipboard(''); // don't leave the login token sitting on the clipboard
  console.log('\nDone. Tell Claude to merge, and the bot starts replying.');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((err) => {
    console.error('\n' + err.message);
    process.exit(1);
  });
}

module.exports = { startCallbackServer, readClientFile };
