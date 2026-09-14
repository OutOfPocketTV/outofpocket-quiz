// node --test comment-bot/test-facebook.js
//
// Facebook against a fake Graph API. The shared run logic (backlog, caps,
// rate limits) is covered by test-instagram.js; this checks the Facebook
// calls, the shape they are turned into, and one full pass end to end.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const config = require('./config');
const { runFacebook } = require('./facebook-run');

const PAGE = { id: '1234567890', name: 'Outofpockettv' };
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const quiet = () => {};

function fbComment(id, message, { hours = 0.5, from = 'u-fan', replies = [], hidden = false } = {}) {
  return {
    id, message, is_hidden: hidden, created_time: hoursAgo(hours),
    from: { id: from, name: from },
    comments: { data: replies.map((r) => ({ from: { id: r } })) },
  };
}

// posts: [{ id, comments }]; pages: { postId: [[comments], ...] }
function fakeFacebook({ posts = [], pages = {}, gone = [] } = {}) {
  const replies = [];
  const calls = [];
  const all = () => Object.values(pages).flat(2);
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const params = init.body ? new URLSearchParams(String(init.body)) : u.searchParams;
    const method = init.method || 'GET';
    const p = u.pathname.replace(/^\//, '');
    calls.push({ method, path: p, params: Object.fromEntries(params) });
    const json = (status, body) => ({ ok: status < 400, status, statusText: '', json: async () => body });

    if (params.get('access_token') !== 'page-token') return json(401, { error: { code: 190, message: 'Invalid OAuth access token' } });
    if (p === 'me') return json(200, PAGE);
    if (p === `${PAGE.id}/published_posts`) {
      return json(200, { data: posts.map((x) => ({ id: x.id, permalink_url: `https://facebook.com/${x.id}`, comments: { data: [], summary: { total_count: x.comments } } })) });
    }
    const [id, edge] = p.split('/');
    if (edge === 'comments' && method === 'GET' && pages[id]) {
      const n = Number(params.get('after') || 0);
      const list = pages[id];
      return json(200, { data: list[n] || [], ...(n + 1 < list.length ? { paging: { cursors: { after: String(n + 1) }, next: 'more' } } : {}) });
    }
    if (edge === 'comments' && method === 'GET') {
      const c = all().find((x) => x.id === id);
      const mine = replies.some((r) => r.id === id) ? [{ from: { id: PAGE.id } }] : [];
      return json(200, { data: [...(c?.comments.data || []), ...mine] });
    }
    if (edge === 'comments' && method === 'POST') {
      replies.push({ id, message: params.get('message') });
      return json(200, { id: `r-${id}` });
    }
    if (!edge) {
      const c = all().find((x) => x.id === id);
      if (!c || gone.includes(id)) return json(400, { error: { code: 100, message: 'Unsupported get request' } });
      return json(200, c);
    }
    throw new Error('unexpected call ' + p);
  };
  return { fetch, replies, calls };
}

function withEnv(fn) {
  return async () => {
    const saved = { ...process.env };
    const savedFetch = global.fetch;
    process.env.FACEBOOK_PAGE_TOKEN = 'page-token';
    const stateFile = path.join(os.tmpdir(), `oop-fb-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
    try { await fn(stateFile); } finally {
      process.env = saved;
      global.fetch = savedFetch;
      fs.rmSync(stateFile, { force: true });
    }
  };
}

test('facebook: not connected yet skips quietly and calls nothing', async () => {
  const saved = { ...process.env };
  const savedFetch = global.fetch;
  delete process.env.FACEBOOK_PAGE_TOKEN;
  let called = false;
  global.fetch = async () => { called = true; };
  try {
    const r = await runFacebook({ log: quiet });
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(called, false);
  } finally {
    process.env = saved;
    global.fetch = savedFetch;
  }
});

test('facebook: every reply carries the site and never says free or claims the video', () => {
  for (const r of [...config.facebook.replies, ...config.facebook.backfill.replies]) {
    assert.match(r, /www\.outofpocket\.tv/);
    assert.doesNotMatch(r, /\bfree\b/i);
    assert.doesNotMatch(r, /in the video|from the video|same app/i);
  }
});

test('facebook: new questions on a post whose count went up get one reply each; the Page\'s own and hidden ones are left', withEnv(async (stateFile) => {
  const posts = [{ id: `${PAGE.id}_1`, comments: 2 }, { id: `${PAGE.id}_2`, comments: 1 }];
  const pages = {
    [`${PAGE.id}_1`]: [[
      fbComment('c-new', 'What app is this?'),
      fbComment('c-page', 'link?', { from: PAGE.id }),
      fbComment('c-hidden', 'website?', { hidden: true }),
      fbComment('c-answered', 'what website is this', { replies: [PAGE.id] }),
      fbComment('c-old', 'what app is this', { hours: 30 }),
    ]],
  };
  const fake = fakeFacebook({ posts, pages });
  global.fetch = fake.fetch;
  const run = () => runFacebook({ stateFile, log: quiet, withBackfill: false, pauseMs: 0 });

  await run(); // first run only notes counts
  assert.deepStrictEqual(fake.replies, []);

  posts[0].comments = 4;
  const r = await run();
  assert.deepStrictEqual(fake.replies.map((x) => x.id), ['c-new']);
  assert.ok(config.facebook.replies.includes(fake.replies[0].message));
  assert.strictEqual(r.alreadyAnswered, 1);

  const read = fake.calls.find((c) => c.path === `${PAGE.id}_1/comments` && c.method === 'GET');
  assert.strictEqual(read.params.filter, 'toplevel');
  assert.strictEqual(read.params.order, 'reverse_chronological');
  assert.ok(!fake.calls.some((c) => c.path === `${PAGE.id}_2/comments`), 'unchanged post is not read');

  await run();
  assert.deepStrictEqual(fake.replies.map((x) => x.id), ['c-new'], 'never twice');
}));

test('facebook: the backlog finds old questions and answers one per run with late wording', withEnv(async (stateFile) => {
  const posts = [{ id: `${PAGE.id}_big`, comments: 3 }];
  const pages = { [`${PAGE.id}_big`]: [[fbComment('b1', 'App name?', { hours: 900 }), fbComment('b2', 'website??', { hours: 800 }), fbComment('b3', 'lol')]] };
  const fake = fakeFacebook({ posts, pages });
  global.fetch = fake.fetch;
  const run = () => runFacebook({ stateFile, log: quiet, backfillGapMs: 0, pauseMs: 0 });

  await run();
  assert.strictEqual(fake.replies.length, 1);
  assert.ok(config.facebook.backfill.replies.includes(fake.replies[0].message));
  await run();
  await run();
  assert.deepStrictEqual(fake.replies.map((x) => x.id).sort(), ['b1', 'b2']);
}));

test('facebook: a dead Page token fails loudly with how to reconnect', withEnv(async (stateFile) => {
  process.env.FACEBOOK_PAGE_TOKEN = 'expired';
  global.fetch = fakeFacebook().fetch;
  await assert.rejects(runFacebook({ stateFile, log: quiet }), /FACEBOOK_PAGE_TOKEN/);
}));
