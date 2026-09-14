// Replies www.outofpocket.tv to anyone asking "what app is this?" in the
// comments on the Out Of Pocket YouTube channel.
//
//   node comment-bot/run.js                 reply for real
//   node comment-bot/run.js --dry-run       only print what it WOULD reply to
//   node comment-bot/run.js --dry-run --hours 72
//
// Runs every 15 minutes from .github/workflows/comment-bot.yml. Locally it
// reads comment-bot/.env.local, which connect-youtube.js writes.
//
// Only top-level comments are considered, never replies inside a thread, and
// a thread the channel has already replied in is left alone -- so running it
// twice, or two runs overlapping the same window, never double-posts.
//
// Exit codes: a broken login exits 1 so GitHub emails Tom that the bot needs
// him. A used-up daily quota or one comment that cannot be replied to is not
// his problem to fix, so those are logged and the run still exits 0.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { whyMatch } = require('./match');
const yt = require('./youtube');

function loadLocalEnv(file = path.join(__dirname, '.env.local')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Same comment always gets the same wording, but the channel as a whole
// rotates through config.replies.
function pickReply(commentId, replies = config.replies) {
  let h = 0;
  for (const ch of String(commentId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return replies[h % replies.length];
}

function snippet(text, max = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runYouTube({
  dryRun = false,
  hours = config.lookbackHours,
  pauseMs = config.secondsBetweenReplies * 1000,
  log = console.log,
} = {}) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    log('YouTube: not connected yet (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN missing). Skipping.');
    return { skipped: true };
  }

  const token = await yt.getAccessToken({ clientId, clientSecret, refreshToken });
  const me = await yt.getMyChannel(token);
  const since = new Date(Date.now() - hours * 3600 * 1000);
  log(`YouTube: ${me.title} — checking comments from the last ${hours}h${dryRun ? ' (DRY RUN, nothing will be posted)' : ''}`);

  const threads = await yt.listRecentThreads(token, me.id, since, config.maxPagesPerRun);
  const result = { scanned: threads.length, matched: 0, alreadyAnswered: 0, replied: 0, failed: 0, quotaHit: false, wouldReply: [] };

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

  log(`YouTube: scanned ${result.scanned}, asking for the site ${result.matched}, already answered ${result.alreadyAnswered}, ` +
    `${dryRun ? 'would reply' : 'replied'} ${result.replied}${result.failed ? `, failed ${result.failed}` : ''}.`);
  return result;
}

function parseArgs(argv) {
  const opts = {
    dryRun: /^(1|true|yes)$/i.test(process.env.DRY_RUN || ''),
    hours: Number(process.env.LOOKBACK_HOURS) || config.lookbackHours,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--hours') opts.hours = Number(argv[++i]) || opts.hours;
  }
  return opts;
}

if (require.main === module) {
  loadLocalEnv();
  runYouTube(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { runYouTube, pickReply, loadLocalEnv };
