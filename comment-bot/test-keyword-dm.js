// node --test comment-bot/test-keyword-dm.js
//
// "Comment QUIZ to get the link in your DMs": the keyword rule, the
// 15-minute run's handling, and the site's instant webhook
// (lib/instagram-webhook.js) -- all against fakes, nothing sent anywhere.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const config = require('./config');
const { isKeywordComment } = require('./match');
const { runInstagram, saveState, freshState } = require('./instagram-run');
const { createHandler, VERIFY_TOKEN, seal, unseal } = require('../lib/instagram-webhook');

const KW = config.instagram.keywordDm;
const ME = { id: '1784000000000000', username: 'outofpocket_tv' };
const quiet = () => {};

test('keyword: quiz, app or website anywhere in a comment counts, as a whole word', () => {
  assert.deepStrictEqual(KW.keywords, ['quiz', 'app', 'website']);
  for (const c of [
    'QUIZ', 'quiz', 'Quiz 🔥', 'QUIZ pls', '#quiz', 'quiz!!',
    'this quiz is rigged', 'I took the quiz and got 2%', 'quizzes',
    'what app is this', 'APP?', 'best apps', 'this app is trash',
    'what website is that', 'websites like this', 'what web site is it', 'link to the website pls',
  ]) {
    assert.strictEqual(isKeywordComment(c, KW.keywords), true, c);
  }
  for (const c of ['', '🔥🔥', 'she is delusional', 'so happy for her', 'send it on whatsapp', 'application form', 'appetite', 'link?', 'quizzical look']) {
    assert.strictEqual(isKeywordComment(c, KW.keywords), false, c);
  }
});

test('keyword: the DM carries a tappable link, never says free; public replies point at the DMs', () => {
  assert.match(KW.message, /https:\/\/www\.outofpocket\.tv/);
  assert.doesNotMatch(KW.message, /\bfree\b/i);
  for (const r of KW.publicReplies) assert.match(r, /DM/);
});

// ---- A fake Instagram that also accepts DMs ------------------------------

function fakeInstagram({ media = [], pages = {}, dmError } = {}) {
  const posts = [];
  const dms = [];
  const all = () => Object.values(pages).flat(2);
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const params = init.body ? new URLSearchParams(String(init.body)) : u.searchParams;
    const method = init.method || 'GET';
    const p = u.pathname.replace(/^\//, '');
    const json = (status, body) => ({ ok: status < 400, status, statusText: '', json: async () => body });
    if (p === 'me') return json(200, { user_id: ME.id, username: ME.username });
    if (p === 'refresh_access_token') return json(400, { error: { code: 10, message: 'too new' } });
    if (p === 'me/media') return json(200, { data: media.map((m) => ({ id: m.id, comments_count: m.comments })) });
    if (p === 'me/messages' && method === 'POST') {
      if (dmError) return json(400, { error: dmError });
      dms.push({ recipient: JSON.parse(params.get('recipient')), message: JSON.parse(params.get('message')) });
      return json(200, { recipient_id: 'x', message_id: 'm' });
    }
    const [id, edge] = p.split('/');
    if (edge === 'comments') return json(200, { data: (pages[id] || [[]])[0] });
    if (edge === 'replies' && method === 'GET') {
      const mine = posts.some((x) => x.id === id) ? [{ from: { id: ME.id, username: ME.username } }] : [];
      return json(200, { data: mine });
    }
    if (edge === 'replies' && method === 'POST') {
      posts.push({ id, message: params.get('message') });
      return json(200, { id: 'r' });
    }
    throw new Error('unexpected call ' + p);
  };
  return { fetch, posts, dms };
}

const comment = (id, text, mins = 5) => ({ id, text, timestamp: new Date(Date.now() - mins * 60000).toISOString(), from: { id: 'u-fan', username: 'fan' }, replies: { data: [] } });

function withInstagramEnv(fn) {
  return async () => {
    const saved = { ...process.env };
    const savedFetch = global.fetch;
    process.env.INSTAGRAM_ACCESS_TOKEN = 'secret-token';
    const stateFile = path.join(os.tmpdir(), `oop-kw-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
    try { await fn(stateFile); } finally {
      process.env = saved;
      global.fetch = savedFetch;
      fs.rmSync(stateFile, { force: true });
    }
  };
}

test('15-minute run: "QUIZ" gets one DM and a public "check your DMs"; a question without a keyword still gets the site', withInstagramEnv(async (stateFile) => {
  saveState(Object.assign(freshState(), { counts: { m1: 0 }, nextRefreshAt: Date.now() + 3600e3 }), stateFile);
  const fake = fakeInstagram({
    media: [{ id: 'm1', comments: 3 }],
    pages: { m1: [[comment('c-kw', 'QUIZ 🔥'), comment('c-q', 'link?'), comment('c-old-kw', 'quiz', 60 * 24 * 8)]] },
  });
  global.fetch = fake.fetch;

  await runInstagram({ stateFile, log: quiet, withBackfill: false, pauseMs: 0, hours: 24 * 9 });

  assert.deepStrictEqual(fake.dms, [{ recipient: { comment_id: 'c-kw' }, message: { text: KW.message } }], 'only the fresh keyword comment is DM\'d (Meta allows 7 days)');
  const byId = Object.fromEntries(fake.posts.map((p) => [p.id, p.message]));
  assert.ok(KW.publicReplies.includes(byId['c-kw']));
  assert.ok(config.instagram.replies.includes(byId['c-q']));
  assert.ok(!('c-old-kw' in byId));
}));

test('15-minute run: if the DM cannot be delivered, the person gets the site publicly instead', withInstagramEnv(async (stateFile) => {
  saveState(Object.assign(freshState(), { counts: { m1: 0 }, nextRefreshAt: Date.now() + 3600e3 }), stateFile);
  const fake = fakeInstagram({
    media: [{ id: 'm1', comments: 1 }],
    pages: { m1: [[comment('c-kw', 'quiz')]] },
    dmError: { code: 10, error_subcode: 2534022, message: 'outside of allowed window' },
  });
  global.fetch = fake.fetch;

  await runInstagram({ stateFile, log: quiet, withBackfill: false, pauseMs: 0 });

  assert.strictEqual(fake.dms.length, 0);
  assert.ok(config.instagram.replies.includes(fake.posts[0].message), 'no "check your DMs" when nothing was sent');
}));

// ---- The instant webhook --------------------------------------------------

const APP_SECRET = 'app-secret-for-tests';

function memoryStore() {
  const handled = new Set();
  let token = null;
  return {
    handled,
    get token() { return token; },
    async getToken() { return token; },
    async saveToken(sealed) { token = { sealed, renewedAt: Date.now() }; },
    async claim(id) { if (handled.has(id)) return false; handled.add(id); return true; },
    async release(id) { handled.delete(id); },
  };
}

function request({ method = 'POST', url = '/api/live-status?ig=1', body, signature } = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.url = url;
  req.headers = { 'x-hub-signature-256': signature ?? 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex') };
  return req;
}

function response() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.send = (b) => { res.body = b; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = (b) => { res.body = b; return res; };
  return res;
}

const event = (value) => ({ object: 'instagram', entry: [{ id: ME.id, time: 1, changes: [{ field: 'comments', value }] }] });

function withWebhookEnv(fn) {
  return async () => {
    const saved = { ...process.env };
    const savedFetch = global.fetch;
    Object.assign(process.env, { INSTAGRAM_APP_SECRET: APP_SECRET, INSTAGRAM_ACCESS_TOKEN: 'secret-token' });
    try { await fn(); } finally { process.env = saved; global.fetch = savedFetch; }
  };
}

test('webhook: answers Meta\'s verification only with the right verify token', withWebhookEnv(async () => {
  const handler = createHandler({ store: memoryStore(), log: quiet });
  let res = response();
  await handler(request({ method: 'GET', url: `/api/live-status?ig=1&hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345` }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body, '12345');

  res = response();
  await handler(request({ method: 'GET', url: '/api/live-status?ig=1&hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1' }), res);
  assert.strictEqual(res.statusCode, 403);
}));

test('webhook: rejects anything not signed with the app secret, and sends nothing', withWebhookEnv(async () => {
  const fake = fakeInstagram();
  global.fetch = fake.fetch;
  const res = response();
  await createHandler({ store: memoryStore(), log: quiet })(request({ body: event({ id: 'c1', text: 'QUIZ', from: { id: 'u1' }, media: { id: 'm1' } }), signature: 'sha256=00' }), res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(fake.dms.length + fake.posts.length, 0);
}));

test('webhook: "QUIZ" is DM\'d instantly, once, even when Meta sends the event twice', withWebhookEnv(async () => {
  const fake = fakeInstagram();
  global.fetch = fake.fetch;
  const store = memoryStore();
  const handler = createHandler({ store, log: quiet });
  const body = event({ id: 'c1', text: 'QUIZ', from: { id: 'u-fan', username: 'fan' }, media: { id: 'm1' } });

  let res = response();
  await handler(request({ body }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body.handled, ['dm']);
  res = response();
  await handler(request({ body }), res);
  assert.deepStrictEqual(res.body.handled, ['ignored: already handled']);

  assert.deepStrictEqual(fake.dms.map((d) => d.recipient.comment_id), ['c1']);
  assert.strictEqual(fake.posts.length, 1);
  assert.ok(KW.publicReplies.includes(fake.posts[0].message));
}));

test('webhook: a keyword in a sentence gets the DM; a question without one gets the site; our own replies, replies-to-comments and chatter are ignored', withWebhookEnv(async () => {
  const fake = fakeInstagram();
  global.fetch = fake.fetch;
  const handler = createHandler({ store: memoryStore(), log: quiet });
  const res = response();
  const body = {
    object: 'instagram',
    entry: [{
      id: ME.id,
      changes: [
        { field: 'comments', value: { id: 'kw1', text: 'what app is this??', from: { id: 'u0' }, media: { id: 'm1' } } },
        { field: 'comments', value: { id: 'q1', text: 'link?', from: { id: 'u1' }, media: { id: 'm1' } } },
        { field: 'comments', value: { id: 'own', text: 'Sent it to your DMs 📩', from: { id: ME.id }, media: { id: 'm1' } } },
        { field: 'comments', value: { id: 'sub', text: 'QUIZ', parent_id: 'q1', from: { id: 'u2' }, media: { id: 'm1' } } },
        { field: 'comments', value: { id: 'chat', text: 'she is delusional', from: { id: 'u3' }, media: { id: 'm1' } } },
      ],
    }],
  };
  await handler(request({ body }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body.handled, ['dm', 'replied', 'ignored: our own comment', 'ignored: reply or no id', 'ignored: not a question']);
  assert.deepStrictEqual(fake.posts.map((p) => p.id), ['kw1', 'q1']);
  assert.deepStrictEqual(fake.dms.map((d) => d.recipient.comment_id), ['kw1']);
}));

test('webhook: the renewed login is stored sealed and reused', async () => {
  const sealed = seal('renewed-token', APP_SECRET);
  assert.ok(!sealed.includes('renewed-token'));
  assert.strictEqual(unseal(sealed, APP_SECRET), 'renewed-token');
  assert.strictEqual(unseal(sealed, 'another-secret'), null);
});

test('webhook: says so plainly when it is not configured yet', async () => {
  const saved = { ...process.env };
  delete process.env.INSTAGRAM_APP_SECRET;
  try {
    const res = response();
    await createHandler({ store: memoryStore(), log: quiet })(request({ body: event({ id: 'c1', text: 'QUIZ' }) }), res);
    assert.strictEqual(res.statusCode, 503);
  } finally {
    process.env = saved;
  }
});
