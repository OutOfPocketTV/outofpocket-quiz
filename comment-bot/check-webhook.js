// Is Instagram still telling the site about new comments?
//
//   node comment-bot/check-webhook.js         say what the subscription is
//   node comment-bot/check-webhook.js --fix   put `comments` back
//
// The instant bot (lib/instagram-webhook.js) only ever hears about a comment
// because the account is subscribed to the `comments` field. That
// subscription is a piece of live state at Meta, not something in this repo,
// and it can vanish without anything here changing -- which is exactly what
// happened:
//
//   2026-09-14 08:50:43  "What app is this?"
//   2026-09-14 08:50:51  "In your DMs now" -- eight seconds, so the webhook
//                        was alive that day
//   2026-09-17           subscribed_fields is ["messages"] only, so no
//                        comment has reached the site since
//
// Nothing in the logs says this. The webhook answers Meta's handshake, the
// 15-minute run keeps succeeding, and the only symptom is an inbox that
// stopped filling up. So: check it before a push, and after any change to
// the Meta app.
//
// Why `messages` matters too: re-subscribing REPLACES the whole field list,
// so it is always sent with both. Dropping `messages` would break replying
// inside DMs.

const fs = require('fs');
const path = require('path');

const API = 'https://graph.instagram.com';
const WANT = ['comments', 'messages'];

function loadLocalEnv(file = path.join(__dirname, '.env.local')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function call(token, method, p, params = {}) {
  const query = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(method === 'GET' ? `${API}/${p}?${query}` : `${API}/${p}`, {
    method,
    ...(method === 'GET' ? {} : {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: query,
    }),
  });
  const data = await res.json().catch(() => ({}));
  // Never the URL in the message: it carries the token.
  if (!res.ok || data.error) throw new Error(`Instagram ${method} /${p} ${res.status}: ${(data.error || {}).message || res.statusText}`);
  return data;
}

async function main() {
  loadLocalEnv();
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.error('No INSTAGRAM_ACCESS_TOKEN. Run the Instagram connect step first.');
    process.exit(1);
  }
  const fix = process.argv.includes('--fix');

  const me = await call(token, 'GET', 'me', { fields: 'user_id,username' });
  const id = String(me.user_id || me.id);
  console.log(`Instagram: @${me.username} (${id})`);

  const before = await call(token, 'GET', `${id}/subscribed_apps`);
  const fields = (before.data || []).flatMap((a) => a.subscribed_fields || []);
  console.log(`Subscribed fields: ${fields.length ? fields.join(', ') : '(none)'}`);

  const missing = WANT.filter((f) => !fields.includes(f));
  if (!missing.length) {
    console.log('\nOK — comments reach the site instantly.');
    return;
  }

  console.log(`\nMISSING: ${missing.join(', ')}`);
  if (missing.includes('comments')) {
    console.log('While `comments` is missing, NOTHING reaches the instant bot:');
    console.log('  - nobody who comments a keyword gets a DM');
    console.log('  - "what app is this" is only answered by the 15-minute run');
  }

  if (!fix) {
    console.log('\nRun it again with --fix to subscribe. That is a live change:');
    console.log('the bot starts DMing people again the moment it goes through.');
    return;
  }

  // Sent with the full list, because this replaces whatever is there.
  await call(token, 'POST', `${id}/subscribed_apps`, { subscribed_fields: WANT.join(',') });
  const after = await call(token, 'GET', `${id}/subscribed_apps`);
  const now = (after.data || []).flatMap((a) => a.subscribed_fields || []);
  console.log(`\nNow subscribed to: ${now.join(', ')}`);
  const still = WANT.filter((f) => !now.includes(f));
  if (still.length) {
    console.log(`\nSTILL MISSING ${still.join(', ')} — Instagram accepted the call but did not keep it.`);
    console.log('That means the app itself is not subscribed to the field. In the Meta app');
    console.log('dashboard: Webhooks -> Instagram -> subscribe to `comments`, then run this again.');
    process.exit(1);
  }
  console.log('Comments reach the site instantly again.');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
