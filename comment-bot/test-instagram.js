// node --test comment-bot/test-instagram.js
//
// Instagram against a fake Graph API: no login, nothing posted anywhere.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const config = require('./config');
const { runInstagram, loadState, saveState, freshState, seal, open } = require('./instagram-run');

const ME = { id: '1784000000000000', username: 'outofpocket_tv' };
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const quiet = () => {};
const tempState = () => path.join(os.tmpdir(), `oop-ig-${process.pid}-${Math.random().toString(36).slice(2)}.json`);

function comment(id, text, { hours = 0.5, from = 'fan', replies = [], hidden = false } = {}) {
  return {
    id, text, hidden, timestamp: hoursAgo(hours),
    from: { id: from === ME.username ? ME.id : `u-${from}`, username: from },
    username: from,
    replies: { data: replies.map((u) => ({ from: { id: u === ME.username ? ME.id : `u-${u}`, username: u }, username: u })) },
  };
}

// media: [{ id, comments }]; pages: { mediaId: [[comments...], ...] }
function fakeInstagram({ media = [], pages = {}, gone = [], validTokens = ['secret-token'], refreshTo = 'renewed-token', refreshError, postError } = {}) {
  const posts = [];
  const calls = [];
  const all = () => Object.values(pages).flat(2);
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const params = init.body ? new URLSearchParams(String(init.body)) : u.searchParams;
    const token = params.get('access_token');
    const method = init.method || 'GET';
    const p = u.pathname.replace(/^\//, '');
    calls.push({ method, path: p, token, after: params.get('after') });
    const json = (status, body) => ({ ok: status < 400, status, statusText: '', json: async () => body });
    const fail = (status, code, message) => json(status, { error: { code, message } });

    if (!validTokens.includes(token)) return fail(401, 190, 'Invalid OAuth access token');
    if (p === 'me') return json(200, { user_id: ME.id, username: ME.username });
    if (p === 'refresh_access_token') {
      if (refreshError) return fail(400, 10, refreshError);
      validTokens.push(refreshTo);
      return json(200, { access_token: refreshTo, token_type: 'bearer', expires_in: 5184000 });
    }
    if (p === 'me/media') return json(200, { data: media.map((m) => ({ id: m.id, comments_count: m.comments, permalink: `https://instagram.com/p/${m.id}` })) });

    const [id, edge] = p.split('/');
    if (edge === 'comments') {
      const list = pages[id] || [[]];
      const n = Number(params.get('after') || 0);
      return json(200, { data: list[n] || [], ...(n + 1 < list.length ? { paging: { cursors: { after: String(n + 1) }, next: 'more' } } : {}) });
    }
    if (edge === 'replies' && method === 'GET') {
      const c = all().find((x) => x.id === id);
      const mine = posts.some((x) => x.id === id) ? [{ from: { id: ME.id, username: ME.username } }] : [];
      return json(200, { data: [...(c?.replies.data || []), ...mine] });
    }
    if (edge === 'replies' && method === 'POST') {
      if (postError) return fail(400, postError.code, postError.message);
      posts.push({ id, message: params.get('message') });
      return json(200, { id: `reply-${id}` });
    }
    if (!edge) {
      const c = all().find((x) => x.id === id);
      if (!c || gone.includes(id)) return fail(400, 100, 'Unsupported get request');
      return json(200, { id: c.id, text: c.text, timestamp: c.timestamp, hidden: c.hidden });
    }
    throw new Error('unexpected call ' + p);
  };
  return { fetch, posts, calls };
}

function withEnv(fn) {
  return async () => {
    const saved = { ...process.env };
    const savedFetch = global.fetch;
    process.env.INSTAGRAM_ACCESS_TOKEN = 'secret-token';
    const stateFile = tempState();
    try { await fn(stateFile); } finally {
      process.env = saved;
      global.fetch = savedFetch;
      fs.rmSync(stateFile, { force: true });
    }
  };
}

const repliedTo = (fake) => fake.posts.map((p) => p.id);
// Most tests are about comments, not the login: pretend it was renewed recently.
const seedRecentLogin = (stateFile, extra = {}) => {
  const s = Object.assign(freshState(), { nextRefreshAt: Date.now() + 3600e3 }, extra);
  saveState(s, stateFile);
};

test('instagram: not connected yet skips quietly and calls nothing', async () => {
  const saved = { ...process.env };
  const savedFetch = global.fetch;
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  let called = false;
  global.fetch = async () => { called = true; };
  try {
    const r = await runInstagram({ log: quiet });
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(called, false);
  } finally {
    process.env = saved;
    global.fetch = savedFetch;
  }
});

test('instagram: every reply spells out the site and never says free or claims the video', () => {
  for (const r of [...config.instagram.replies, ...config.instagram.backfill.replies]) {
    assert.match(r, /www\.outofpocket\.tv/);
    assert.doesNotMatch(r, /\bfree\b/i);
    assert.doesNotMatch(r, /in the video|from the video|same app/i);
    assert.ok(r.length <= 300);
  }
});

test('instagram: first run only notes counts; the next run answers new questions on posts whose count went up', withEnv(async (stateFile) => {
  seedRecentLogin(stateFile);
  const media = [{ id: 'm1', comments: 3 }, { id: 'm2', comments: 1 }];
  const pages = {
    m1: [[
      comment('c-new', 'what app is this??'),
      comment('c-mine', 'link?', { from: ME.username }),
      comment('c-hidden', 'app name?', { hidden: true }),
      comment('c-answered', 'what website is this', { replies: [ME.username] }),
      comment('c-old', 'what app is this', { hours: 30 }),
      comment('c-never-read', 'website?', { hours: 40 }),
    ]],
    m2: [[comment('m2-q', 'what app is this')]],
  };
  const fake = fakeInstagram({ media, pages });
  global.fetch = fake.fetch;

  await runInstagram({ stateFile, log: quiet, withBackfill: false, pauseMs: 0 });
  assert.deepStrictEqual(repliedTo(fake), [], 'first run posts nothing');
  assert.deepStrictEqual(loadState(stateFile).counts, { m1: 3, m2: 1 });

  media[0].comments = 5; // m1 got new comments; m2 did not
  const r = await runInstagram({ stateFile, log: quiet, withBackfill: false, pauseMs: 0 });
  assert.deepStrictEqual(repliedTo(fake), ['c-new']);
  assert.ok(config.instagram.replies.includes(fake.posts[0].message));
  assert.strictEqual(r.alreadyAnswered, 1);
  assert.ok(!fake.calls.some((c) => c.path === 'm2/comments'), 'unchanged post is not read');
  assert.strictEqual(loadState(stateFile).counts.m1, 6, 'our own reply is counted in');

  await runInstagram({ stateFile, log: quiet, withBackfill: false, pauseMs: 0 });
  assert.deepStrictEqual(repliedTo(fake), ['c-new'], 'nothing changed, nothing posted twice');
}));

test('instagram: dry run posts nothing and leaves counts for the live run', withEnv(async (stateFile) => {
  seedRecentLogin(stateFile, { counts: { m1: 1 } });
  const fake = fakeInstagram({ media: [{ id: 'm1', comments: 2 }], pages: { m1: [[comment('c1', 'what app is this')]] } });
  global.fetch = fake.fetch;

  const r = await runInstagram({ stateFile, log: quiet, dryRun: true, withBackfill: false });
  assert.deepStrictEqual(repliedTo(fake), []);
  assert.deepStrictEqual(r.wouldReply.map((w) => w.id), ['c1']);
  assert.strictEqual(loadState(stateFile).counts.m1, 1);
}));

test('instagram: backlog goes busiest post first, one reply per run, each once, then stops', withEnv(async (stateFile) => {
  seedRecentLogin(stateFile, { counts: { big: 120, small: 4, none: 0 } });
  const media = [{ id: 'small', comments: 4 }, { id: 'none', comments: 0 }, { id: 'big', comments: 120 }];
  const pages = {
    big: [
      [comment('b1', 'what app is this', { hours: 900 }), comment('b-chat', 'she is delusional'), comment('b2', 'link?')],
      [comment('b3', 'app name?', { replies: [ME.username] }), comment('b4', 'what website is this')],
    ],
    small: [[comment('s1', 'App?')]],
  };
  const fake = fakeInstagram({ media, pages, gone: ['b4'] });
  global.fetch = fake.fetch;
  const run = () => runInstagram({ stateFile, log: quiet, pauseMs: 0, backfillGapMs: 0 });

  await run();
  assert.deepStrictEqual(fake.calls.filter((c) => c.path.endsWith('/comments')).map((c) => c.path), ['big/comments', 'big/comments', 'small/comments']);
  assert.deepStrictEqual(repliedTo(fake), ['b1']);
  assert.ok(config.instagram.backfill.replies.includes(fake.posts[0].message), 'late-reply wording');

  await run();
  await run(); // b4 was deleted: skipped, s1 goes out
  assert.deepStrictEqual(repliedTo(fake), ['b1', 'b2', 's1']);

  await run();
  const s = loadState(stateFile);
  assert.ok(s.finishedAt);
  assert.strictEqual(s.totals.gone, 1);
  assert.strictEqual(s.totals.replied, 3);
}));

test('instagram: the backlog respects the daily cap', withEnv(async (stateFile) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  seedRecentLogin(stateFile, {
    counts: { big: 1 }, day: today, repliesToday: config.instagram.backfill.repliesPerDay,
    media: [{ id: 'big', comments: 1 }], mediaIndex: 1,
    queue: [{ id: 'b1', mediaId: 'big', text: 'what app is this' }],
  });
  const fake = fakeInstagram({ media: [{ id: 'big', comments: 1 }], pages: { big: [[comment('b1', 'what app is this', { hours: 900 })]] } });
  global.fetch = fake.fetch;

  await runInstagram({ stateFile, log: quiet, backfillGapMs: 0 });
  assert.deepStrictEqual(repliedTo(fake), []);
}));

test('instagram: being told to slow down stops the run cleanly and keeps the question queued', withEnv(async (stateFile) => {
  seedRecentLogin(stateFile, { counts: { big: 1 } });
  const fake = fakeInstagram({
    media: [{ id: 'big', comments: 1 }],
    pages: { big: [[comment('b1', 'what app is this', { hours: 900 })]] },
    postError: { code: 4, message: 'Application request limit reached' },
  });
  global.fetch = fake.fetch;

  const r = await runInstagram({ stateFile, log: quiet, backfillGapMs: 0 });
  assert.strictEqual(r.rateLimited, true);
  assert.deepStrictEqual(loadState(stateFile).queue.map((q) => q.id), ['b1']);
}));

test('instagram login: renews once due, keeps the new token sealed, and uses it next run', withEnv(async (stateFile) => {
  saveState(Object.assign(freshState(), { counts: { m1: 0 } }), stateFile); // nextRefreshAt 0: due now
  const fake = fakeInstagram({ media: [{ id: 'm1', comments: 0 }] });
  global.fetch = fake.fetch;

  await runInstagram({ stateFile, log: quiet, withBackfill: false });
  const s = loadState(stateFile);
  assert.strictEqual(open(s.tokenBox, 'secret-token'), 'renewed-token');
  assert.ok(!JSON.stringify(s).includes('renewed-token'), 'never stored in the clear');
  assert.ok(s.nextRefreshAt > Date.now() + 19 * 3600e3);

  fake.calls.length = 0;
  await runInstagram({ stateFile, log: quiet, withBackfill: false });
  assert.ok(fake.calls.length > 0 && fake.calls.every((c) => c.token === 'renewed-token'));
  assert.ok(!fake.calls.some((c) => c.path === 'refresh_access_token'), 'not renewed again within the day');
}));

test('instagram login: a refused renewal (token under a day old) retries in 6 hours and the run carries on', withEnv(async (stateFile) => {
  saveState(Object.assign(freshState(), { counts: { m1: 0 } }), stateFile);
  const fake = fakeInstagram({ media: [{ id: 'm1', comments: 0 }], refreshError: 'token too new' });
  global.fetch = fake.fetch;

  await runInstagram({ stateFile, log: quiet, withBackfill: false });
  const s = loadState(stateFile);
  assert.strictEqual(s.tokenBox, null);
  const sixHours = s.nextRefreshAt - Date.now();
  assert.ok(sixHours > 5.9 * 3600e3 && sixHours < 6.1 * 3600e3);
}));

test('instagram login: a dead renewed copy falls back to the secret; a reconnect retires the old copy', withEnv(async (stateFile) => {
  // Renewed copy that Instagram no longer accepts.
  seedRecentLogin(stateFile, { counts: { m1: 0 }, tokenBox: seal('revoked-token', 'secret-token') });
  let fake = fakeInstagram({ media: [{ id: 'm1', comments: 0 }] });
  global.fetch = fake.fetch;
  await runInstagram({ stateFile, log: quiet, withBackfill: false });
  assert.strictEqual(loadState(stateFile).tokenBox, null);
  assert.ok(fake.calls.slice(1).every((c) => c.token === 'secret-token'));

  // Copy sealed under an older secret: unreadable, so the current secret is used.
  seedRecentLogin(stateFile, { counts: { m1: 0 }, tokenBox: seal('renewed-under-old-secret', 'old-secret') });
  fake = fakeInstagram({ media: [{ id: 'm1', comments: 0 }] });
  global.fetch = fake.fetch;
  await runInstagram({ stateFile, log: quiet, withBackfill: false });
  assert.ok(fake.calls.every((c) => c.token === 'secret-token'));
}));

test('instagram login: an expired secret fails loudly with how to reconnect', withEnv(async (stateFile) => {
  seedRecentLogin(stateFile);
  global.fetch = fakeInstagram({ validTokens: ['something-else'] }).fetch;
  await assert.rejects(runInstagram({ stateFile, log: quiet }), /connect-instagram\.js/);
}));
