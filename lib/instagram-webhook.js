// Instagram comment webhook: Meta calls this the moment someone comments on
// @outofpocket_tv, and the bot answers within a second or two instead of
// waiting for the 15-minute run.
//
//   Comment is basically "QUIZ"      -> DM with the link + public "sent it to your DMs"
//   Comment asks "what app is this"  -> public reply with the site
//
// The rules, wording and API calls are the SAME ones the 15-minute bot uses
// (comment-bot/), which stays on as the safety net for anything this misses.
//
// Reached at https://www.outofpocket.tv/api/instagram-webhook through a
// rewrite in vercel.json to /api/live-status?ig=1 -- api/ is at Vercel's
// 12-function cap, so this rides inside an existing function rather than
// adding a 13th file (which fails the whole build).
//
// Env vars (Vercel):
//   INSTAGRAM_APP_SECRET    proves each call really comes from Meta (required)
//   INSTAGRAM_ACCESS_TOKEN  the bot's Instagram login (required)
//
// The login lasts 60 days unless renewed. This renews it at most weekly and
// keeps the renewed one in Postgres (comment_bot_tokens), encrypted with a key
// from the app secret. Postgres also remembers which comments were handled
// (comment_bot_handled), so Meta's retries never double-post.

const crypto = require('crypto');
const config = require('../comment-bot/config');
const ig = require('../comment-bot/instagram');
const { whyMatch } = require('../comment-bot/match');
const { pickReply } = require('../comment-bot/util');
const { answerKeyword, wantsKeywordDm } = require('../comment-bot/graph-run');

const cfg = config.instagram;

// Not a secret: it only has to match what is typed into the Meta dashboard.
// Every event is authenticated by the app-secret signature instead.
const VERIFY_TOKEN = 'outofpocket-comment-bot';

const WEEK = 7 * 24 * 3600 * 1000;

function readRawBody(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

function validSignature(rawBody, header, appSecret) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from('sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex'));
  const given = Buffer.from(header);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const sealKey = (appSecret) => crypto.createHash('sha256').update('comment-bot/vercel/instagram/' + appSecret).digest();

function seal(token, appSecret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', sealKey(appSecret), iv);
  const data = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function unseal(sealed, appSecret) {
  try {
    const [iv, tag, data] = sealed.split('.').map((s) => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', sealKey(appSecret), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// The Postgres bits, behind a small interface so tests can use memory.
function postgresStore() {
  const { sql } = require('@vercel/postgres');
  let ready = null;
  const setup = () => ready || (ready = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS comment_bot_tokens (platform TEXT PRIMARY KEY, sealed TEXT NOT NULL, renewed_at TIMESTAMPTZ NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS comment_bot_handled (comment_id TEXT PRIMARY KEY, handled_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  })());
  return {
    async getToken() {
      await setup();
      const r = await sql`SELECT sealed, renewed_at FROM comment_bot_tokens WHERE platform = 'instagram'`;
      return r.rows[0] ? { sealed: r.rows[0].sealed, renewedAt: new Date(r.rows[0].renewed_at).getTime() } : null;
    },
    async saveToken(sealed) {
      await setup();
      await sql`INSERT INTO comment_bot_tokens (platform, sealed, renewed_at) VALUES ('instagram', ${sealed}, now())
        ON CONFLICT (platform) DO UPDATE SET sealed = EXCLUDED.sealed, renewed_at = EXCLUDED.renewed_at`;
    },
    // true the first time a comment is claimed, false ever after
    async claim(commentId) {
      await setup();
      const r = await sql`INSERT INTO comment_bot_handled (comment_id) VALUES (${commentId}) ON CONFLICT (comment_id) DO NOTHING RETURNING comment_id`;
      return r.rowCount > 0;
    },
    async release(commentId) {
      await setup();
      await sql`DELETE FROM comment_bot_handled WHERE comment_id = ${commentId}`;
    },
  };
}

// The newest working login. Renews weekly; a failed renewal just keeps using
// what it has (renewal is refused for a token under a day old).
async function currentToken(store, envToken, appSecret, log) {
  const row = await store.getToken();
  const saved = row && unseal(row.sealed, appSecret);
  const token = saved || envToken;
  if (!row || Date.now() - row.renewedAt > WEEK) {
    try {
      const renewed = await ig.refreshToken(token);
      if (renewed.token) {
        await store.saveToken(seal(renewed.token, appSecret));
        return renewed.token;
      }
    } catch (err) {
      log(`instagram-webhook: renewal skipped (${err.message})`);
    }
  }
  return token;
}

async function handleComment({ value, accountId, store, token, log }) {
  const comment = {
    id: value.id,
    text: value.text || '',
    timestamp: new Date().toISOString(),
    from: value.from ? { id: String(value.from.id), username: value.from.username } : undefined,
  };
  if (!comment.id || value.parent_id) return 'ignored: reply or no id';
  // Our own replies fire this webhook too -- never answer ourselves.
  if (comment.from && (comment.from.id === String(accountId))) return 'ignored: our own comment';

  const keyword = wantsKeywordDm(ig, cfg, comment);
  if (!keyword && whyMatch(comment.text) === -1) return 'ignored: not a question';

  if (!(await store.claim(comment.id))) return 'ignored: already handled';
  try {
    if (keyword) {
      const done = await answerKeyword({ api: ig, token, comment, cfg });
      log(`instagram-webhook: ${done.action} "${comment.text.slice(0, 60)}" -> "${done.reply}"`);
      return done.action;
    }
    const reply = pickReply(comment.id, cfg.replies);
    await ig.postReply(token, comment.id, reply);
    log(`instagram-webhook: replied "${comment.text.slice(0, 60)}" -> "${reply}"`);
    return 'replied';
  } catch (err) {
    // Let the next retry (or the 15-minute run) have another go.
    await store.release(comment.id).catch(() => {});
    throw err;
  }
}

function createHandler({ store = null, log = console.log } = {}) {
  return async function instagramWebhook(req, res) {
    const url = new URL(req.url, 'https://www.outofpocket.tv');

    // Meta's one-time check when the callback URL is saved in the dashboard.
    if (req.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(url.searchParams.get('hub.challenge') || '');
      }
      return res.status(403).send('Forbidden');
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).send('Method not allowed');
    }

    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!appSecret || !envToken) {
      log('instagram-webhook: not configured (INSTAGRAM_APP_SECRET / INSTAGRAM_ACCESS_TOKEN missing)');
      return res.status(503).send('Not configured');
    }

    const raw = await readRawBody(req);
    if (!validSignature(raw, req.headers['x-hub-signature-256'], appSecret)) {
      return res.status(401).send('Bad signature');
    }

    let payload;
    try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).send('Bad JSON'); }

    const changes = (payload.entry || []).flatMap((e) => (e.changes || []).map((c) => ({ ...c, accountId: e.id })))
      .filter((c) => c.field === 'comments' && c.value);
    if (!changes.length) return res.status(200).json({ received: true, handled: [] });

    const db = store || postgresStore();
    const handled = [];
    try {
      const token = await currentToken(db, envToken, appSecret, log);
      for (const c of changes) {
        handled.push(await handleComment({ value: c.value, accountId: c.accountId, store: db, token, log }));
      }
      return res.status(200).json({ received: true, handled });
    } catch (err) {
      log(`instagram-webhook: failed -- ${err.message}`);
      // A 500 makes Meta retry later; the claim was released above.
      return res.status(500).json({ received: false });
    }
  };
}

module.exports = { createHandler, validSignature, seal, unseal, VERIFY_TOKEN };
