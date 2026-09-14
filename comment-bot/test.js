// node --test comment-bot/test.js
//
// The matcher table is the spec for what counts as "asking for the site".
// The flow tests fake YouTube's API, so they run with no login and post
// nothing anywhere.

const test = require('node:test');
const assert = require('node:assert');
const { isAskingForSite } = require('./match');
const { runYouTube, pickReply } = require('./run');
const config = require('./config');

const ASKING = [
  'What app is this?',
  'what app is this',
  'WHAT APP IS THIS 😭😭',
  'bro what app',
  "what's the app called",
  'whats the website',
  'What website is this?',
  'which site is that',
  'what is the name of the app',
  'What’s the name of this website?',
  'what app is he using',
  'what app does he use',
  'what kind of app is this lol',
  'wat app is dis',
  'app name?',
  'App?',
  'link?',
  'Link',
  'website??',
  'the website 🙏',
  'link pls',
  'name of the app',
  'where can I take this quiz',
  'Where can I take this quiz?',
  'where do i find this',
  'where can u get it',
  'where do I go to take this',
  'how do I take this quiz',
  'how can i try that test',
  'is this an app?',
  'is there a website for this',
  "where's the link",
  'where is that app',
  'drop the link',
  'send me the website',
  'I want to take this quiz',
  'i wanna try that test fr',
  'what test is this',
  'what calculator is that',
  'Is that a real website??',
  'what dating odds app is this',
  'what app is this, i need to see if i meet the standards',
  'Whats the website i need to humble my sister',
  'what app are they using',
  'what website are they on in the video',
];

const NOT_ASKING = [
  '',
  'lol she failed',
  'this app is trash',
  'What a stupid app',
  'what a tool',
  'what a test of patience',
  'did she pass the test?',
  'the quiz?',
  'what dating app is she on',
  'what app are you on',
  'what app did they meet on',
  'what app do you use to edit',
  'what editing app is this',
  'what camera app',
  'what app you use to film',
  "what's the song",
  'which dating app is the best',
  'best dating apps?',
  'Hinge is better than this',
  "what's her name",
  'what is wrong with her',
  "what's this called", // could be about anything in the shot
  'where can I get that hoodie',
  'where do i find a girl like that',
  "it's outofpocket.tv",
  'the website is igotstandardsbro.com',
  'he is a tool',
  'standards are too high',
  '6 feet is not tall',
];

for (const c of ASKING) {
  test(`asks: ${JSON.stringify(c)}`, () => assert.strictEqual(isAskingForSite(c), true));
}
for (const c of NOT_ASKING) {
  test(`does not ask: ${JSON.stringify(c)}`, () => assert.strictEqual(isAskingForSite(c), false));
}

test('every reply carries the site and never says free', () => {
  for (const r of config.replies) {
    assert.match(r, /www\.outofpocket\.tv/);
    assert.doesNotMatch(r, /\bfree\b/i);
    assert.ok(r.length <= 200);
  }
  assert.strictEqual(pickReply('abc'), pickReply('abc'));
});

// ---- Fake YouTube -----------------------------------------------------

const ME = 'UCoutofpocket';
const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

function thread(id, text, { author = 'UCsomeone', mins = 10, replies = [], total } = {}) {
  return {
    id,
    snippet: {
      totalReplyCount: total ?? replies.length,
      topLevelComment: {
        snippet: { textDisplay: text, authorChannelId: { value: author }, videoId: 'vid1', publishedAt: minsAgo(mins) },
      },
    },
    replies: { comments: replies.map((a) => ({ snippet: { authorChannelId: { value: a } } })) },
  };
}

// What comments.list returns for the two threads too busy to show every reply.
const FULL_REPLIES = { 't-busy': ['x', ME], 't-busy-unanswered': ['x', 'y'] };

function fakeYouTube({ threads, pages = [threads], fullReplies = FULL_REPLIES, postError } = {}) {
  const posts = [];
  const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push(`${init.method || 'GET'} ${u.pathname}`);
    const json = (status, body) => ({ ok: status < 400, status, statusText: '', json: async () => body });

    if (u.host === 'oauth2.googleapis.com') return json(200, { access_token: 'tok' });
    if (u.pathname.endsWith('/channels')) return json(200, { items: [{ id: ME, snippet: { title: 'Out Of Pocket TV' } }] });
    if (u.pathname.endsWith('/commentThreads')) {
      const n = Number(u.searchParams.get('pageToken') || 0);
      return json(200, { items: pages[n], ...(n + 1 < pages.length ? { nextPageToken: String(n + 1) } : {}) });
    }
    if (u.pathname.endsWith('/comments') && (init.method || 'GET') === 'GET') {
      const authors = fullReplies[u.searchParams.get('parentId')] || [];
      return json(200, { items: authors.map((a) => ({ snippet: { authorChannelId: { value: a } } })) });
    }
    if (u.pathname.endsWith('/comments') && init.method === 'POST') {
      if (postError) return json(403, { error: { message: postError, errors: [{ reason: postError }] } });
      posts.push(JSON.parse(init.body).snippet);
      return json(200, {});
    }
    throw new Error('unexpected call ' + url);
  };
  return { fetch, posts, calls };
}

function withEnv(fn) {
  return async () => {
    const saved = { ...process.env };
    const savedFetch = global.fetch;
    Object.assign(process.env, { YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 'secret', YOUTUBE_REFRESH_TOKEN: 'refresh' });
    try { await fn(); } finally { process.env = saved; global.fetch = savedFetch; }
  };
}

const quiet = () => {};

const THREADS = [
  thread('t-new', 'What app is this??'),
  thread('t-answered', 'what website is this', { replies: ['UCfan', ME] }),
  thread('t-chatter', 'lol she failed'),
  thread('t-mine', 'app name?', { author: ME }),
  thread('t-busy', 'link?', { replies: ['a', 'b', 'c', 'd', 'e'], total: 12 }),
  thread('t-busy-unanswered', 'where can I take this quiz', { replies: ['a', 'b'], total: 30 }),
  thread('t-old', 'what app is this', { mins: 60 * 24 }),
];

test('replies once to each new question and leaves everything else alone', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet });

  assert.deepStrictEqual(yt.posts.map((p) => p.parentId).sort(), ['t-busy-unanswered', 't-new']);
  for (const p of yt.posts) assert.match(p.textOriginal, /www\.outofpocket\.tv/);
  assert.strictEqual(r.scanned, 6); // t-old is outside the window
  assert.strictEqual(r.alreadyAnswered, 2); // t-answered, t-busy
  assert.strictEqual(r.replied, 2);
}));

test('keeps paging past an old thread bumped by a new reply, and stops at the first quiet page', withEnv(async () => {
  const bumped = thread('t-bumped', 'what app is this', { mins: 60 * 24 });
  bumped.replies.comments.push({ snippet: { authorChannelId: { value: 'UCfan' }, publishedAt: minsAgo(5) } });
  const yt = fakeYouTube({
    pages: [
      [bumped, thread('p1-new', 'website??')],
      [thread('p2-new', 'what website is this', { mins: 30 })],
      [thread('p3-old', 'what app is this', { mins: 60 * 24 })],
      [thread('p4-never-read', 'link?')],
    ],
  });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet });

  assert.deepStrictEqual(yt.posts.map((p) => p.parentId).sort(), ['p1-new', 'p2-new']);
  assert.strictEqual(yt.calls.filter((c) => c.endsWith('/commentThreads')).length, 3);
  assert.strictEqual(r.scanned, 2);
}));

test('dry run posts nothing', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS });
  global.fetch = yt.fetch;

  const r = await runYouTube({ dryRun: true, hours: 3, pauseMs: 0, log: quiet });

  assert.strictEqual(yt.posts.length, 0);
  assert.ok(!yt.calls.some((c) => c.startsWith('POST /youtube')));
  assert.deepStrictEqual(r.wouldReply.map((w) => w.threadId).sort(), ['t-busy-unanswered', 't-new']);
}));

test('a used-up quota stops the run without throwing', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS, postError: 'quotaExceeded' });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet });

  assert.strictEqual(r.quotaHit, true);
  assert.strictEqual(r.replied, 0);
}));

test('a comment that cannot be replied to is skipped, the rest still go out', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS, postError: 'commentsDisabled' });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet });

  assert.strictEqual(r.failed, 2);
  assert.strictEqual(r.quotaHit, false);
}));

test('connect script: the local callback hands back Google\'s code, and rejects a forged one', async () => {
  const { startCallbackServer } = require('./connect-youtube');
  const http = require('node:http');
  const get = (url) => new Promise((resolve) => http.get(url, (res) => { res.resume(); res.on('end', resolve); }));

  const good = await startCallbackServer('s3cret-state');
  await get(`${good.redirectUri}/?state=s3cret-state&code=the-code`);
  assert.strictEqual(await good.code, 'the-code');

  const forged = await startCallbackServer('s3cret-state');
  const rejected = assert.rejects(forged.code, /Not connected/);
  await get(`${forged.redirectUri}/?state=wrong&code=stolen`);
  await rejected;
});

test('not connected yet: skips quietly and calls nothing', async () => {
  const saved = { ...process.env };
  const savedFetch = global.fetch;
  delete process.env.YOUTUBE_REFRESH_TOKEN;
  let called = false;
  global.fetch = async () => { called = true; };
  try {
    const r = await runYouTube({ log: quiet });
    assert.strictEqual(r.skipped, true);
    assert.strictEqual(called, false);
  } finally {
    process.env = saved;
    global.fetch = savedFetch;
  }
});
