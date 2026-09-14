// One-time: lets the bot reply as the Outofpockettv Facebook Page.
//
//   node comment-bot/connect-facebook.js
//
// Before running it, copy a LONG-LIVED Facebook user token to the clipboard
// (Graph API Explorer -> app "Out Of Pocket comment bot" -> permissions
// pages_show_list, pages_read_engagement, pages_read_user_content,
// pages_manage_engagement -> Generate Access Token -> the (i) next to it ->
// Open in Access Token Tool -> Extend Access Token -> copy the new token).
//
// The script turns that into the Outofpockettv Page token -- which, made
// from a long-lived user token, never expires -- checks it really works and
// does not expire, saves it to comment-bot/.env.local, does a practice run
// (nothing is posted), then walks through adding it to GitHub. The token is
// never printed.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync, spawn } = require('child_process');
const { loadLocalEnv } = require('./run');

const PAGE_NAME = /out\s*of\s*pocket/i;
const ENV_FILE = path.join(__dirname, '.env.local');
const SECRET_PAGE = 'https://github.com/OutOfPocketTV/outofpocket-quiz/settings/secrets/actions/new';

function readClipboard() {
  const r = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' })
    : spawnSync('pbpaste', { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

function copyToClipboard(text) {
  const cmd = process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : null;
  return cmd ? spawnSync(cmd, { input: text }).status === 0 : false;
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32'
    ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

async function graph(path, params) {
  const res = await fetch(`https://graph.facebook.com/${path}?${new URLSearchParams(params)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Facebook said: ${data.error?.message || res.statusText}`);
  return data;
}

function saveEnv(name, value) {
  const lines = fs.existsSync(ENV_FILE)
    ? fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith(`${name}=`))
    : [];
  lines.push(`${name}=${value}`);
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n');
}

async function main() {
  loadLocalEnv();
  const userToken = readClipboard();
  if (!/^EAA[\w-]{40,}$/.test(userToken)) {
    throw new Error('The clipboard does not hold a Facebook token (they start with "EAA"). Copy the extended token and run this again.');
  }

  const me = await graph('me', { fields: 'id,name', access_token: userToken });
  console.log(`Facebook login: ${me.name}`);

  const userInfo = (await graph('debug_token', { input_token: userToken, access_token: userToken })).data || {};
  if (userInfo.expires_at && userInfo.expires_at * 1000 - Date.now() < 7 * 24 * 3600 * 1000) {
    console.log('Warning: this is a SHORT-lived token, so the Page token made from it will expire too.');
    console.log('Use "Extend Access Token" in the Access Token Tool and copy that one instead.');
    process.exit(1);
  }

  const pages = (await graph('me/accounts', { fields: 'id,name,access_token,tasks', limit: '100', access_token: userToken })).data || [];
  const page = pages.find((p) => PAGE_NAME.test(p.name));
  if (!page) throw new Error(`No Outofpockettv Page among: ${pages.map((p) => p.name).join(', ') || 'none'}. Re-generate the token and tick the Page.`);

  const pageInfo = (await graph('debug_token', { input_token: page.access_token, access_token: userToken })).data || {};
  const scopes = new Set(pageInfo.scopes || []);
  const missing = ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement'].filter((s) => !scopes.has(s));
  console.log(`Page: ${page.name} (${page.id}) — ${pageInfo.expires_at === 0 ? 'token never expires' : 'token EXPIRES'}`);
  if (missing.length) throw new Error(`The token is missing ${missing.join(', ')}. Add them in Graph API Explorer and generate again.`);
  if (pageInfo.expires_at !== 0) throw new Error('That Page token expires. Extend the user token first, then run this again.');

  saveEnv('FACEBOOK_PAGE_TOKEN', page.access_token);
  process.env.FACEBOOK_PAGE_TOKEN = page.access_token;
  copyToClipboard(''); // the user token is not needed any more
  console.log(`Saved to ${path.relative(process.cwd(), ENV_FILE)} (never committed).\n`);

  console.log('Practice run -- nothing is posted:\n');
  await require('./facebook-run').runFacebook({ dryRun: true, hours: 72 });

  if (!process.stdin.isTTY) {
    console.log(`\nLast step: add FACEBOOK_PAGE_TOKEN at ${SECRET_PAGE} (the value is in ${path.relative(process.cwd(), ENV_FILE)}).`);
    return;
  }
  copyToClipboard(page.access_token);
  openBrowser(SECRET_PAGE);
  await ask(
    '\nLast step: a GitHub "New secret" page just opened, and the Page token is already copied.\n' +
    '   1. In the Name box, type:  FACEBOOK_PAGE_TOKEN\n' +
    '   2. Click in the Secret box and press Ctrl+V\n' +
    '   3. Click "Add secret"\n' +
    '   Then come back here and press Enter. '
  );
  copyToClipboard('');
  console.log('\nDone. Tell Claude to merge, and the Facebook bot starts.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('\n' + err.message);
  process.exit(1);
});
