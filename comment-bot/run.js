// Replies www.outofpocket.tv to anyone asking "what app is this?" in the
// comments on the Out Of Pocket YouTube channel.
//
//   node comment-bot/run.js                 reply for real
//   node comment-bot/run.js --dry-run       only print what it WOULD reply to
//   node comment-bot/run.js --dry-run --hours 72
//   node comment-bot/run.js --no-backfill   new comments only, leave old ones
//
// Runs every 15 minutes from .github/workflows/comment-bot.yml. Locally it
// reads comment-bot/.env.local, which connect-youtube.js writes.
//
// Each run does two things, in this order:
//   1. New questions from the last few hours, all answered straight away.
//   2. Old questions under old videos, a few at a time (backfill.js).
//
// Only top-level comments are considered, never replies inside a thread, and
// a thread the channel has already replied in is left alone -- so running it
// twice, or two runs overlapping the same window, never double-posts.
//
// Exit codes: a broken login exits 1 so GitHub emails Tom that the bot needs
// him. A used-up daily quota, one comment that cannot be replied to, or a
// platform's server erroring for a run or two is not his problem to fix, so
// those are logged and the run still exits 0 (see runAll).

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { whyMatch } = require('./match');
const yt = require('./youtube');
const backfill = require('./backfill');

function loadLocalEnv(file = path.join(__dirname, '.env.local')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const util = require('./util');
const { snippet, sleep } = util;
const pickReply = (commentId, replies = config.replies) => util.pickReply(commentId, replies);

async function runYouTube({
  dryRun = false,
  hours = config.lookbackHours,
  pauseMs = config.secondsBetweenReplies * 1000,
  log = console.log,
  withBackfill = config.backfill.enabled,
  watchNewestVideos = config.watchNewestVideos,
  stateFile = process.env.BOT_STATE_FILE || backfill.DEFAULT_STATE_FILE,
  backfillGapMs, // tests only: replaces the random 30-90s pause
} = {}) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    log('YouTube: not connected yet (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN missing). Skipping.');
    return { skipped: true };
  }

  const startUnits = yt.usage.units;
  const spentThisRun = () => yt.usage.units - startUnits;
  const token = await yt.getAccessToken({ clientId, clientSecret, refreshToken });
  const me = await yt.getMyChannel(token);

  const state = withBackfill ? backfill.loadState(stateFile) : null;
  if (state) backfill.rollDay(state);
  const result = { scanned: 0, matched: 0, alreadyAnswered: 0, replied: 0, failed: 0, quotaHit: false, wouldReply: [] };
  try {
    try {
      await answerNew({ token, me, dryRun, hours, pauseMs, log, result, watchNewestVideos });
    } catch (err) {
      if (!(err instanceof yt.QuotaExceeded)) throw err;
      result.quotaHit = true;
      log(`  YouTube's daily API quota is used up (${err.message}). Stopping; it resets at midnight Pacific.`);
    }

    if (state && !result.quotaHit) {
      try {
        result.backfill = await backfill.runBackfill({
          token, me, state, dryRun, log, spentThisRun, pickReply,
          postedThisRun: !dryRun && result.replied > 0,
          ...(backfillGapMs !== undefined ? { gapMs: () => backfillGapMs } : {}),
        });
      } catch (err) {
        if (err instanceof yt.QuotaExceeded) {
          result.quotaHit = true;
          log(`  YouTube's daily API quota is used up (${err.message}). Old comments carry on after midnight Pacific.`);
        } else {
          // New questions were already handled; an old-comment hiccup is not
          // worth a failure email. The next run picks up where this one was.
          log(`Old comments: stopped this run -- ${err.message}`);
        }
      }
    }
  } finally {
    if (state) {
      state.unitsToday += spentThisRun();
      if (result.quotaHit) state.unitsToday = Math.max(state.unitsToday, config.backfill.dailyUnitBudget);
      backfill.saveState(state, stateFile);
    }
  }
  return result;
}

// New questions from the last `hours`, all answered this run.
async function answerNew({ token, me, dryRun, hours, pauseMs, log, result, watchNewestVideos }) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  log(`YouTube: ${me.title} — checking comments from the last ${hours}h${dryRun ? ' (DRY RUN, nothing will be posted)' : ''}`);

  const threads = await yt.listRecentThreads(token, me.id, since, config.maxPagesPerRun);
  // The channel-wide listing lags, so the newest uploads are read directly too.
  if (me.uploads && watchNewestVideos) {
    const seen = new Set(threads.map((t) => t.id));
    for (const videoId of await yt.listNewestUploads(token, me.uploads, watchNewestVideos)) {
      try {
        for (const t of await yt.listVideoRecentThreads(token, videoId, since)) {
          if (!seen.has(t.id)) { threads.push(t); seen.add(t.id); }
        }
      } catch (err) {
        if (err instanceof yt.QuotaExceeded) throw err;
        log(`  Skipping video ${videoId}: ${err.message}`); // comments turned off
      }
    }
  }
  result.scanned = threads.length;

  for (const thread of threads) {
    const top = thread.snippet.topLevelComment.snippet;
    if (top.authorChannelId?.value === me.id) continue; // our own comment

    const text = top.textDisplay || top.textOriginal || '';
    const why = whyMatch(text);
    if (why === -1) continue;
    result.matched++;

    try {
      if (await yt.channelAlreadyReplied(token, thread, me.id)) {
        result.alreadyAnswered++;
        continue;
      }
      if (result.replied >= config.maxRepliesPerRun) {
        log(`  Reached ${config.maxRepliesPerRun} replies for this run; the rest wait for the next one.`);
        break;
      }

      const reply = pickReply(thread.id);
      const where = `youtube.com/watch?v=${top.videoId}&lc=${thread.id}`;
      log(`  ${dryRun ? 'WOULD REPLY' : 'REPLY'}  "${snippet(text)}"  →  "${reply}"  (${where}, rule ${why})`);

      if (dryRun) {
        result.wouldReply.push({ threadId: thread.id, text, reply });
      } else {
        await yt.postReply(token, thread.id, reply);
        if (pauseMs) await sleep(pauseMs);
      }
      result.replied++;
    } catch (err) {
      if (err instanceof yt.QuotaExceeded) {
        result.quotaHit = true;
        log(`  YouTube's daily API quota is used up (${err.message}). Stopping; it resets at midnight Pacific.`);
        break;
      }
      // Deleted comment, comments turned off on that video, etc. Skip it.
      result.failed++;
      log(`  Could not reply to ${thread.id}: ${err.message}`);
    }
  }

  log(`YouTube: new comments scanned ${result.scanned}, asking for the site ${result.matched}, already answered ${result.alreadyAnswered}, ` +
    `${dryRun ? 'would reply' : 'replied'} ${result.replied}${result.failed ? `, failed ${result.failed}` : ''}.`);
}

function parseArgs(argv) {
  const opts = {
    dryRun: /^(1|true|yes)$/i.test(process.env.DRY_RUN || ''),
    hours: Number(process.env.LOOKBACK_HOURS) || config.lookbackHours,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--no-backfill') opts.withBackfill = false;
    else if (argv[i] === '--hours') opts.hours = Number(argv[++i]) || opts.hours;
  }
  return opts;
}

// A 5xx from the platform ("An unknown error occurred"), or a request that
// never got an answer, is their server having a moment. It clears by itself,
// usually by the next run, so one of them is not worth a failure email.
function isHiccup(err) {
  return err.status >= 500 || (err instanceof TypeError && /fetch failed/i.test(err.message));
}

// Only a platform failing like that this many runs in a row (two hours at
// one run every 15 minutes) emails Tom: by then it is not clearing up.
const HICCUP_RUNS_BEFORE_EMAIL = 8;

function hiccupFile(stateFile = process.env.BOT_STATE_FILE || backfill.DEFAULT_STATE_FILE) {
  return path.join(path.dirname(stateFile), 'hiccups.json');
}

// Every platform every run. One failing never stops the others. Returns true
// when the run should exit 1 so GitHub emails Tom: a broken login or a bug
// at once, a server hiccup only once it has lasted HICCUP_RUNS_BEFORE_EMAIL.
async function runAll(platforms, opts = {}, { file = hiccupFile(), log = console.log, logError = console.error } = {}) {
  let hiccups = {};
  try { hiccups = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  let failed = false;
  for (const [name, run] of platforms) {
    try {
      await run(opts);
      hiccups[name] = 0;
    } catch (err) {
      if (!isHiccup(err)) {
        logError(`${name}: ${err.message}`);
        hiccups[name] = 0;
        failed = true;
        continue;
      }
      hiccups[name] = (hiccups[name] || 0) + 1;
      if (hiccups[name] >= HICCUP_RUNS_BEFORE_EMAIL) {
        logError(`${name}: ${err.message} (their server has failed ${hiccups[name]} runs in a row)`);
        failed = true;
      } else {
        log(`${name}: their server had a hiccup (${err.message}). Not a problem on our side; trying again next run.`);
      }
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(hiccups));
  return failed;
}

async function main(opts) {
  const { runInstagram } = require('./instagram-run');
  const { runFacebook } = require('./facebook-run');
  const failed = await runAll([['YouTube', runYouTube], ['Instagram', runInstagram], ['Facebook', runFacebook]], opts);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  loadLocalEnv();
  const opts = parseArgs(process.argv.slice(2));
  main(opts);
}

module.exports = { runYouTube, runAll, pickReply, loadLocalEnv, HICCUP_RUNS_BEFORE_EMAIL };
