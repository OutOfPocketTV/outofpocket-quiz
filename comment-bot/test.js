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
  // Real Instagram comments, 2026-09-14
  "What's the name of this app",
  'Website?',
  'What the app called',
  "Where's the test I want to look it up",
  'App name or web name',
  'Site name?',
  'What’s that app called that he used?',
  'Yo drop the link? I need to try this on my boyfriend',
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
  '@outofpocket_tv Instagram is a dating app??? If that’s what you think, you’re definitely insecure',
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

test('every reply carries the site, never says free, never claims to be the app in the video', () => {
  for (const r of [...config.replies, ...config.backfill.replies]) {
    assert.match(r, /www\.outofpocket\.tv/);
    assert.doesNotMatch(r, /\bfree\b/i);
    assert.doesNotMatch(r, /in the video|from the video|same app/i);
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

// `pages`: the channel-wide newest-first listing (new comments).
// `videos` + `videoPages`: every upload and its comment pages (old comments).
// `gone`: thread ids deleted since they were scanned.
function fakeYouTube({ threads = [], pages = [threads], fullReplies = FULL_REPLIES, postError, videos = [], videoPages = {}, gone = [] } = {}) {
  const posts = [];
  const calls = [];
  const paged = (list, u) => {
    const n = Number(u.searchParams.get('pageToken') || 0);
    return { items: list[n] || [], ...(n + 1 < list.length ? { nextPageToken: String(n + 1) } : {}) };
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const p = u.searchParams;
    calls.push(`${init.method || 'GET'} ${u.pathname}${p.get('videoId') ? ' video=' + p.get('videoId') : ''}${p.get('id') && u.pathname.endsWith('/commentThreads') ? ' id=' + p.get('id') : ''}`);
    const json = (status, body) => ({ ok: status < 400, status, statusText: '', json: async () => body });

    if (u.host === 'oauth2.googleapis.com') return json(200, { access_token: 'tok' });
    if (u.pathname.endsWith('/channels')) {
      return json(200, { items: [{ id: ME, snippet: { title: 'Out Of Pocket TV' }, contentDetails: { relatedPlaylists: { uploads: 'UUuploads' } } }] });
    }
    if (u.pathname.endsWith('/playlistItems')) {
      return json(200, { items: videos.map((v) => ({ contentDetails: { videoId: v.id } })) });
    }
    if (u.pathname.endsWith('/videos')) {
      const ids = p.get('id').split(',');
      return json(200, { items: videos.filter((v) => ids.includes(v.id)).map((v) => ({ id: v.id, statistics: { commentCount: String(v.comments) } })) });
    }
    if (u.pathname.endsWith('/commentThreads') && p.get('id')) {
      const id = p.get('id');
      const found = Object.values(videoPages).flat(2).find((t) => t.id === id);
      if (!found || gone.includes(id)) return json(200, { items: [] });
      const copy = structuredClone(found);
      if (posts.some((x) => x.parentId === id)) copy.replies.comments.push({ snippet: { authorChannelId: { value: ME } } });
      return json(200, { items: [copy] });
    }
    if (u.pathname.endsWith('/commentThreads') && p.get('videoId')) {
      return json(200, paged(videoPages[p.get('videoId')] || [[]], u));
    }
    if (u.pathname.endsWith('/commentThreads')) return json(200, paged(pages, u));
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

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet, withBackfill: false });

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

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet, withBackfill: false });

  assert.deepStrictEqual(yt.posts.map((p) => p.parentId).sort(), ['p1-new', 'p2-new']);
  assert.strictEqual(yt.calls.filter((c) => c.endsWith('/commentThreads')).length, 3);
  assert.strictEqual(r.scanned, 2);
}));

test('a question missing from the lagging channel-wide feed is still found on the newest video', withEnv(async () => {
  // What happened 2026-09-14: "what app is this" at 07:16 on the newest Short
  // never showed up in the channel-wide listing, but the video itself had it.
  // The pinned "Take the quiz here" comment comes first despite being old.
  const pinned = thread('v-pinned', 'Take the quiz here: www.outofpocket.tv', { author: ME, mins: 60 * 5 });
  const friend = thread('v-friend', 'what app is this', { mins: 2 });
  const inBoth = thread('v-both', 'website?', { mins: 20 });
  const yt = fakeYouTube({
    threads: [inBoth],
    videos: [{ id: 'newest', comments: 3 }],
    videoPages: { newest: [[pinned, friend, inBoth, thread('v-old', 'link?', { mins: 60 * 10 })]] },
  });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet, withBackfill: false });

  assert.deepStrictEqual(yt.posts.map((p) => p.parentId).sort(), ['v-both', 'v-friend'], 'friend answered, shared thread once, old one left');
  assert.strictEqual(r.scanned, 2);
}));

test('dry run posts nothing', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS });
  global.fetch = yt.fetch;

  const r = await runYouTube({ dryRun: true, hours: 3, pauseMs: 0, log: quiet, withBackfill: false });

  assert.strictEqual(yt.posts.length, 0);
  assert.ok(!yt.calls.some((c) => c.startsWith('POST /youtube')));
  assert.deepStrictEqual(r.wouldReply.map((w) => w.threadId).sort(), ['t-busy-unanswered', 't-new']);
}));

test('a used-up quota stops the run without throwing', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS, postError: 'quotaExceeded' });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet, withBackfill: false });

  assert.strictEqual(r.quotaHit, true);
  assert.strictEqual(r.replied, 0);
}));

test('a comment that cannot be replied to is skipped, the rest still go out', withEnv(async () => {
  const yt = fakeYouTube({ threads: THREADS, postError: 'commentsDisabled' });
  global.fetch = yt.fetch;

  const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet, withBackfill: false });

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

// ---- Old comments (backfill) ------------------------------------------

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const backfill = require('./backfill');

const tempState = () => path.join(os.tmpdir(), `oop-comment-bot-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
const readState = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const oldPosts = (yt) => yt.posts.map((p) => p.parentId);

const OLD_VIDEOS = [
  { id: 'v-small', comments: 3 },
  { id: 'v-none', comments: 0 },
  { id: 'v-big', comments: 250 },
];
const OLD_PAGES = () => ({
  'v-big': [
    [thread('b1', 'what app is this', { mins: 90 * 24 * 60 }), thread('b-chatter', 'she is delusional'), thread('b2', 'link?')],
    [thread('b3', 'app name?', { replies: [ME] }), thread('b4', 'what website is this')],
  ],
  'v-small': [[thread('s1', 'App?')]],
});

test('old comments: busiest video first, one reply per run, each answered once, then it stops for good', withEnv(async () => {
  const stateFile = tempState();
  const yt = fakeYouTube({ videos: OLD_VIDEOS, videoPages: OLD_PAGES(), gone: ['b4'] });
  global.fetch = yt.fetch;
  const run = () => runYouTube({ hours: 3, pauseMs: 0, log: quiet, stateFile, watchNewestVideos: 0, backfillGapMs: 0 });

  try {
    await run();
    // Whole backlog scanned in one run (3 pages < 25), biggest video first,
    // the zero-comment video never read, and exactly one reply sent.
    const scans = yt.calls.filter((c) => c.includes('video='));
    assert.deepStrictEqual(scans, [
      'GET /youtube/v3/commentThreads video=v-big',
      'GET /youtube/v3/commentThreads video=v-big',
      'GET /youtube/v3/commentThreads video=v-small',
    ]);
    assert.deepStrictEqual(oldPosts(yt), ['b1']);
    assert.ok(config.backfill.replies.includes(yt.posts[0].textOriginal), 'old questions get the late-reply wording');
    assert.deepStrictEqual(readState(stateFile).queue.map((q) => q.id), ['b2', 'b4', 's1']); // b3 was already answered

    await run();
    assert.deepStrictEqual(oldPosts(yt), ['b1', 'b2']);

    await run(); // b4 was deleted: skipped, and s1 goes out instead
    assert.deepStrictEqual(oldPosts(yt), ['b1', 'b2', 's1']);

    await run(); // nothing left
    const done = readState(stateFile);
    assert.ok(done.finishedAt);
    assert.strictEqual(done.totals.replied, 3);
    assert.strictEqual(done.totals.gone, 1);

    const before = yt.calls.length;
    await run(); // finished: only the new-comment check runs
    assert.deepStrictEqual(yt.calls.slice(before).filter((c) => c.includes('video=') || c.includes('id=') || c.includes('playlistItems')), []);
    assert.strictEqual(yt.calls.filter((c) => c.includes('playlistItems')).length, 1, 'video list is built once');
    assert.deepStrictEqual(oldPosts(yt), ['b1', 'b2', 's1']);
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}));

test('old comments: a lost memory file starts over without answering anything twice', withEnv(async () => {
  const stateFile = tempState();
  const yt = fakeYouTube({ videos: OLD_VIDEOS, videoPages: OLD_PAGES() });
  global.fetch = yt.fetch;
  const run = () => runYouTube({ hours: 3, pauseMs: 0, log: quiet, stateFile, watchNewestVideos: 0, backfillGapMs: 0 });

  try {
    await run();
    await run();
    fs.rmSync(stateFile); // the Actions cache was evicted
    for (let i = 0; i < 6; i++) await run();
    assert.deepStrictEqual(oldPosts(yt).sort(), ['b1', 'b2', 'b4', 's1']);
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}));

test('old comments: daily reply cap and unit budget pause it until the next Pacific day', withEnv(async () => {
  const stateFile = tempState();
  const yt = fakeYouTube({ videos: OLD_VIDEOS, videoPages: OLD_PAGES() });
  global.fetch = yt.fetch;
  const run = () => runYouTube({ hours: 3, pauseMs: 0, log: quiet, stateFile, watchNewestVideos: 0, backfillGapMs: 0 });
  const seed = (changes) => {
    const s = backfill.freshState();
    Object.assign(s, { day: backfill.pacificDay(), videos: OLD_VIDEOS.filter((v) => v.comments), videoIndex: 2 }, changes);
    s.queue = [{ id: 'b1', videoId: 'v-big', text: 'what app is this' }];
    backfill.saveState(s, stateFile);
  };

  try {
    seed({ repliesToday: config.backfill.repliesPerDay });
    await run();
    assert.deepStrictEqual(oldPosts(yt), [], 'reply cap reached');

    seed({ unitsToday: config.backfill.dailyUnitBudget });
    await run();
    assert.deepStrictEqual(oldPosts(yt), [], 'unit budget reached');

    seed({ unitsToday: config.backfill.dailyUnitBudget, repliesToday: config.backfill.repliesPerDay, day: '2000-01-01' });
    await run();
    assert.deepStrictEqual(oldPosts(yt), ['b1'], 'a new day resets both');
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}));

test('old comments: dry run scans but posts nothing', withEnv(async () => {
  const stateFile = tempState();
  const yt = fakeYouTube({ videos: OLD_VIDEOS, videoPages: OLD_PAGES() });
  global.fetch = yt.fetch;

  try {
    await runYouTube({ dryRun: true, hours: 3, pauseMs: 0, log: quiet, stateFile, watchNewestVideos: 0 });
    assert.deepStrictEqual(oldPosts(yt), []);
    assert.strictEqual(readState(stateFile).queue.length, 4);
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}));

test('old comments: a used-up quota keeps the question queued and pauses for the day', withEnv(async () => {
  const stateFile = tempState();
  const yt = fakeYouTube({ videos: OLD_VIDEOS, videoPages: OLD_PAGES(), postError: 'quotaExceeded' });
  global.fetch = yt.fetch;

  try {
    const r = await runYouTube({ hours: 3, pauseMs: 0, log: quiet, stateFile, watchNewestVideos: 0, backfillGapMs: 0 });
    const s = readState(stateFile);
    assert.strictEqual(r.quotaHit, true);
    assert.strictEqual(s.queue[0].id, 'b1');
    assert.ok(s.unitsToday >= config.backfill.dailyUnitBudget);
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}));

test('old comments: a new reply and an old reply in the same run are spaced apart', withEnv(async () => {
  const stateFile = tempState();
  const yt = fakeYouTube({ threads: [thread('t-new', 'what app is this')], videos: OLD_VIDEOS, videoPages: OLD_PAGES() });
  global.fetch = yt.fetch;

  try {
    const started = Date.now();
    await runYouTube({ hours: 3, pauseMs: 0, log: quiet, stateFile, watchNewestVideos: 0, backfillGapMs: 120 });
    assert.deepStrictEqual(oldPosts(yt), ['t-new', 'b1']);
    assert.ok(Date.now() - started >= 110);
  } finally {
    fs.rmSync(stateFile, { force: true });
  }
}));

test('connect script: reads the key Google Cloud downloads', () => {
  const { readClientFile } = require('./connect-youtube');
  const file = path.join(os.tmpdir(), `client_secret_test-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({ installed: { client_id: 'abc.apps.googleusercontent.com', client_secret: 'shh' } }));
  try {
    assert.deepStrictEqual(readClientFile(file), { clientId: 'abc.apps.googleusercontent.com', clientSecret: 'shh', file });
    fs.writeFileSync(file, '{ not json');
    assert.strictEqual(readClientFile(file), null);
  } finally {
    fs.rmSync(file, { force: true });
  }
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
