// Answers the "what app is this?" questions already sitting under old
// videos, slowly enough not to look like a spam wave. Settings and the
// reasoning for the numbers are in config.js under `backfill`.
//
// Needs memory between runs -- which videos are scanned, and the list of
// questions still waiting. That lives in one small JSON file. On GitHub the
// workflow carries it from run to run with the Actions cache. If it is ever
// lost, the scan simply starts over: nothing is answered twice, because
// every thread is re-checked live right before replying.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { whyMatch } = require('./match');
const yt = require('./youtube');

const DEFAULT_STATE_FILE = path.join(__dirname, '.state', 'backfill.json');

// YouTube's quota resets at midnight Pacific, so that is when a "day" ends.
function pacificDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(date);
}

function freshState() {
  return {
    version: 1,
    videos: null, // [{ id, comments }], most comments first; built on the first run
    videoIndex: 0, // next video to scan
    pageToken: null, // where the scan stopped inside that video
    queue: [], // [{ id, videoId, text }] unanswered questions, in the order found
    totals: { scannedComments: 0, found: 0, replied: 0, alreadyAnswered: 0, gone: 0, failed: 0 },
    day: null,
    unitsToday: 0,
    repliesToday: 0,
    finishedAt: null,
  };
}

function loadState(file = DEFAULT_STATE_FILE) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (state.version === 1) return state;
  } catch {}
  return freshState();
}

function saveState(state, file = DEFAULT_STATE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}

function rollDay(state, now = new Date()) {
  const today = pacificDay(now);
  if (state.day !== today) {
    state.day = today;
    state.unitsToday = 0;
    state.repliesToday = 0;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120);

// `spentThisRun()` is the units the whole run has used so far, the
// new-comment check included. `postedThisRun` says whether that check
// already posted something, in which case the backfill waits before its own.
async function runBackfill({
  token,
  me,
  state,
  dryRun = false,
  log = console.log,
  spentThisRun = () => 0,
  postedThisRun = false,
  gapMs = () => {
    const [lo, hi] = config.backfill.gapSeconds;
    return (lo + Math.random() * (hi - lo)) * 1000;
  },
  pickReply,
}) {
  const cfg = config.backfill;
  const unitsLeft = () => cfg.dailyUnitBudget - state.unitsToday - spentThisRun();

  if (state.finishedAt) return { finished: true };
  if (unitsLeft() <= 0) {
    log(`Old comments: today's share of the API quota is used up; carrying on after midnight Pacific.`);
    return { paused: true };
  }

  if (!state.videos) {
    if (!me.uploads) throw new Error('Could not find the channel\'s uploads list.');
    state.videos = await yt.listVideosByComments(token, me.uploads);
    const total = state.videos.reduce((n, v) => n + v.comments, 0);
    log(`Old comments: ${state.videos.length} videos have comments (${total.toLocaleString('en-US')} in all). Scanning the busiest first.`);
  }

  // 1. Scan a little further.
  const queued = new Set(state.queue.map((q) => q.id));
  const examples = [];
  let pages = 0;
  while (pages < cfg.pagesPerRun && state.videoIndex < state.videos.length && unitsLeft() > 0) {
    const video = state.videos[state.videoIndex];
    pages++;
    let page;
    try {
      page = await yt.listVideoThreadsPage(token, video.id, state.pageToken);
    } catch (err) {
      if (err instanceof yt.QuotaExceeded) throw err;
      if (state.pageToken && err.status === 400) {
        state.pageToken = null; // a stale page marker: rescan this video from the top
      } else {
        log(`  Skipping video ${video.id}: ${err.message}`); // comments turned off, video deleted
        state.videoIndex++;
        state.pageToken = null;
      }
      continue;
    }

    for (const thread of page.items) {
      state.totals.scannedComments++;
      const top = thread.snippet.topLevelComment.snippet;
      if (top.authorChannelId?.value === me.id || queued.has(thread.id)) continue;
      const text = top.textDisplay || top.textOriginal || '';
      if (whyMatch(text) === -1) continue;
      // Replies shown with the thread are enough to skip the obvious ones for
      // free; the full check happens right before replying.
      if ((thread.replies?.comments || []).some((c) => c.snippet.authorChannelId?.value === me.id)) continue;
      state.queue.push({ id: thread.id, videoId: video.id, text: short(text) });
      queued.add(thread.id);
      state.totals.found++;
      if (examples.length < 5) examples.push(short(text));
    }

    state.pageToken = page.nextPageToken;
    if (!state.pageToken) state.videoIndex++;
  }
  if (dryRun && examples.length) {
    log(`  Old questions found this run, for example: ${examples.map((e) => `"${e}"`).join(', ')}`);
  }

  // 2. Drip out replies.
  let sent = 0;
  let posted = postedThisRun;
  while (
    !dryRun &&
    sent < cfg.repliesPerRun &&
    state.repliesToday < cfg.repliesPerDay &&
    state.queue.length &&
    unitsLeft() >= 52 // a lookup and a reply
  ) {
    const next = state.queue.shift();
    try {
      const thread = await yt.getThread(token, next.id);
      if (!thread) { state.totals.gone++; continue; }
      if (await yt.channelAlreadyReplied(token, thread, me.id)) { state.totals.alreadyAnswered++; continue; }

      if (posted) await sleep(gapMs());
      const reply = pickReply(next.id, cfg.replies);
      log(`  OLD REPLY  "${next.text}"  →  "${reply}"  (youtube.com/watch?v=${next.videoId}&lc=${next.id})`);
      await yt.postReply(token, next.id, reply);
      state.totals.replied++;
      state.repliesToday++;
      sent++;
      posted = true;
    } catch (err) {
      if (err instanceof yt.QuotaExceeded) {
        state.queue.unshift(next);
        throw err;
      }
      state.totals.failed++;
      log(`  Could not reply to old comment ${next.id}: ${err.message}`);
    }
  }

  const scanDone = state.videoIndex >= state.videos.length;
  if (scanDone && state.queue.length === 0) {
    state.finishedAt = new Date().toISOString();
    log(`Old comments: FINISHED. Answered ${state.totals.replied} old questions across ${state.videos.length} videos.`);
    return { finished: true, sent };
  }

  const t = state.totals;
  const perDay = Math.min(cfg.repliesPerDay, cfg.repliesPerRun * 96);
  const scan = scanDone
    ? 'every video scanned'
    : `${state.videoIndex} of ${state.videos.length} videos scanned (${t.scannedComments.toLocaleString('en-US')} comments)`;
  log(`Old comments: ${scan}; ${t.found} questions found, ${t.replied} answered, ${state.queue.length} waiting` +
    (state.queue.length ? ` (~${Math.ceil(state.queue.length / perDay)} day(s) at up to ${perDay}/day)` : '') + '.');
  return { sent, waiting: state.queue.length };
}

module.exports = { runBackfill, loadState, saveState, rollDay, freshState, pacificDay, DEFAULT_STATE_FILE };
