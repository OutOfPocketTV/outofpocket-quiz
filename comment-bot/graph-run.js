// The reply bot for Meta platforms -- Instagram and Facebook work the same
// way, so both run on this. instagram-run.js and facebook-run.js only supply
// their own API calls, login and wording.
//
// Each run: new questions straight away, then the backlog under old posts
// one at a time. Same rules for what counts as asking (match.js).
//
// Memory between runs lives in one JSON file per platform (the Actions cache
// on GitHub, comment-bot/.state/<platform>.json locally):
//   counts     every post's comment count last run, to spot new comments
//   media...   the backlog scan: which post, how far, what is still waiting
//
// Meta has no "every new comment on the account" feed, but each post reports
// its comment count, so a post whose count went up is the one to look at.
//
// What a platform's `api` must provide (comments normalised to
// { id, text, timestamp, hidden, from: { id }, replies: { data: [...] } }):
//   listMedia(token)                  -> [{ id, comments, permalink }]
//   commentsPage(token, id, after)    -> { items, next }   newest first
//   isMine(comment, me), repliedInline(comment, me)
//   alreadyReplied(token, commentId, me), getComment(token, id) -> comment | null
//   postReply(token, commentId, text)
//   RateLimited, TokenInvalid         error classes

const fs = require('fs');
const path = require('path');
const { whyMatch } = require('./match');
const { pickReply, snippet, sleep } = require('./util');

const HOUR = 3600 * 1000;

function pacificDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(date);
}

function freshState() {
  return {
    version: 1,
    counts: {},
    media: null, // [{ id, comments, permalink }], most comments first
    mediaIndex: 0,
    cursor: null,
    queue: [], // [{ id, mediaId, permalink, text }]
    totals: { scannedComments: 0, found: 0, replied: 0, alreadyAnswered: 0, gone: 0, failed: 0 },
    day: null,
    repliesToday: 0,
    finishedAt: null,
    // Instagram's renewed login lives here too; see instagram-run.js.
    tokenBox: null,
    nextRefreshAt: 0,
    lastRenewedAt: null,
  };
}

function loadState(file) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (state.version === 1) return state;
  } catch {}
  return freshState();
}

function saveState(state, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}

// label        'Instagram' | 'Facebook', used in every log line
// stateName    file name inside the state directory
// envVar       the GitHub secret holding the login
// cfg          config.instagram / config.facebook
// api          see the top of this file
// login        (state, secret, log, now) -> { token, me }
// who          (me) -> how the account reads in the log
// reconnect    what to tell Tom when the login is dead
function createPlatform({ label, stateName, envVar, cfg, api, login, who, reconnect }) {
  function defaultStateFile() {
    const dir = process.env.BOT_STATE_FILE ? path.dirname(process.env.BOT_STATE_FILE) : path.join(__dirname, '.state');
    return path.join(dir, stateName);
  }

  async function answerNew({ token, me, media, state, dryRun, hours, pauseMs, log, result }) {
    const since = Date.now() - hours * HOUR;
    const firstLook = Object.keys(state.counts).length === 0;
    log(`${label}: ${who(me)} — checking comments from the last ${hours}h${dryRun ? ' (DRY RUN, nothing will be posted)' : ''}`);

    if (firstLook) {
      // Nothing to compare against yet. Remember the counts; anything already
      // there is the backfill's job.
      for (const m of media) state.counts[m.id] = m.comments;
      log(`${label}: first run — noted every post's comment count; new comments are picked up from the next run.`);
      return;
    }

    const changed = media
      .filter((m) => m.comments > (state.counts[m.id] ?? 0))
      .sort((a, b) => (b.comments - (state.counts[b.id] ?? 0)) - (a.comments - (state.counts[a.id] ?? 0)))
      .slice(0, cfg.maxPostsCheckedPerRun);

    let capped = false;
    for (const m of changed) {
      let after = null;
      let postedHere = 0;
      let reachedOld = false;
      for (let page = 0; page < 5 && !reachedOld && !capped; page++) {
        let items, next;
        try {
          ({ items, next } = await api.commentsPage(token, m.id, after));
        } catch (err) {
          if (err instanceof api.RateLimited || err instanceof api.TokenInvalid) throw err;
          log(`  Skipping post ${m.id}: ${err.message}`); // deleted, or comments off
          break;
        }
        for (const c of items) {
          if (Date.parse(c.timestamp) < since) { reachedOld = true; break; }
          result.scanned++;
          if (api.isMine(c, me) || c.hidden) continue;
          const why = whyMatch(c.text);
          if (why === -1) continue;
          result.matched++;

          try {
            if (api.repliedInline(c, me) || await api.alreadyReplied(token, c.id, me)) {
              result.alreadyAnswered++;
              continue;
            }
            if (result.replied >= cfg.maxRepliesPerRun) {
              log(`  Reached ${cfg.maxRepliesPerRun} replies for this run; the rest wait for the next one.`);
              capped = true;
              break;
            }
            const reply = pickReply(c.id, cfg.replies);
            log(`  ${dryRun ? 'WOULD REPLY' : 'REPLY'}  "${snippet(c.text)}"  →  "${reply}"  (${m.permalink || m.id}, rule ${why})`);
            if (dryRun) {
              result.wouldReply.push({ id: c.id, text: c.text, reply });
            } else {
              await api.postReply(token, c.id, reply);
              postedHere++;
              if (pauseMs) await sleep(pauseMs);
            }
            result.replied++;
          } catch (err) {
            if (err instanceof api.RateLimited) throw err;
            result.failed++;
            log(`  Could not reply to ${c.id}: ${err.message}`);
          }
        }
        after = next;
        if (!after) break;
      }
      // Only mark a post as checked once it really was, and count our own
      // replies in so they do not make it look changed next run. A dry run
      // marks nothing, so a live run still sees what it only looked at.
      if (!capped && !dryRun) state.counts[m.id] = m.comments + postedHere;
    }
    for (const m of media) if (!(m.id in state.counts)) state.counts[m.id] = m.comments; // brand-new post, no comments yet

    log(`${label}: new comments scanned ${result.scanned}, asking for the site ${result.matched}, already answered ${result.alreadyAnswered}, ` +
      `${dryRun ? 'would reply' : 'replied'} ${result.replied}${result.failed ? `, failed ${result.failed}` : ''}.`);
  }

  async function backfill({ token, me, media, state, dryRun, log, postedThisRun, gapMs }) {
    const b = cfg.backfill;
    if (state.finishedAt) return { finished: true };

    if (!state.media) {
      state.media = media.filter((m) => m.comments > 0)
        .sort((a, b2) => b2.comments - a.comments)
        .map(({ id, comments, permalink }) => ({ id, comments, permalink }));
      const total = state.media.reduce((n, m) => n + m.comments, 0);
      log(`${label} old comments: ${state.media.length} posts have comments (${total.toLocaleString('en-US')} in all). Scanning the busiest first.`);
    }

    const queued = new Set(state.queue.map((q) => q.id));
    const examples = [];
    for (let pages = 0; pages < b.pagesPerRun && state.mediaIndex < state.media.length; pages++) {
      const post = state.media[state.mediaIndex];
      let page;
      try {
        page = await api.commentsPage(token, post.id, state.cursor);
      } catch (err) {
        if (err instanceof api.RateLimited || err instanceof api.TokenInvalid) throw err;
        if (state.cursor && err.code !== 100) {
          state.cursor = null; // a stale cursor: rescan this post from the top
        } else {
          log(`  Skipping post ${post.id}: ${err.message}`); // deleted, or comments off
          state.mediaIndex++;
          state.cursor = null;
        }
        continue;
      }
      for (const c of page.items) {
        state.totals.scannedComments++;
        if (api.isMine(c, me) || c.hidden || queued.has(c.id)) continue;
        if (whyMatch(c.text) === -1 || api.repliedInline(c, me)) continue;
        state.queue.push({ id: c.id, mediaId: post.id, permalink: post.permalink, text: snippet(c.text, 120) });
        queued.add(c.id);
        state.totals.found++;
        if (examples.length < 5) examples.push(snippet(c.text, 120));
      }
      state.cursor = page.next;
      if (!state.cursor) state.mediaIndex++;
    }
    if (dryRun && examples.length) {
      log(`  Old questions found this run, for example: ${examples.map((e) => `"${e}"`).join(', ')}`);
    }

    let sent = 0;
    let posted = postedThisRun;
    while (!dryRun && sent < b.repliesPerRun && state.repliesToday < b.repliesPerDay && state.queue.length) {
      const next = state.queue.shift();
      try {
        const c = await api.getComment(token, next.id);
        if (!c) { state.totals.gone++; continue; }
        if (c.hidden || await api.alreadyReplied(token, next.id, me)) { state.totals.alreadyAnswered++; continue; }

        if (posted) await sleep(gapMs());
        const reply = pickReply(next.id, b.replies);
        log(`  OLD REPLY  "${next.text}"  →  "${reply}"  (${next.permalink || next.mediaId})`);
        await api.postReply(token, next.id, reply);
        state.totals.replied++;
        state.repliesToday++;
        sent++;
        posted = true;
      } catch (err) {
        if (err instanceof api.RateLimited || err instanceof api.TokenInvalid) {
          state.queue.unshift(next);
          throw err;
        }
        state.totals.failed++;
        log(`  Could not reply to old comment ${next.id}: ${err.message}`);
      }
    }

    const scanDone = state.mediaIndex >= state.media.length;
    if (scanDone && state.queue.length === 0) {
      state.finishedAt = new Date().toISOString();
      log(`${label} old comments: FINISHED. Answered ${state.totals.replied} old questions across ${state.media.length} posts.`);
      return { finished: true, sent };
    }
    const t = state.totals;
    log(`${label} old comments: ${scanDone ? 'every post scanned' : `${state.mediaIndex} of ${state.media.length} posts scanned (${t.scannedComments.toLocaleString('en-US')} comments)`}; ` +
      `${t.found} questions found, ${t.replied} answered, ${state.queue.length} waiting` +
      (scanDone && state.queue.length ? ` (~${Math.ceil(state.queue.length / b.repliesPerDay)} day(s) at up to ${b.repliesPerDay}/day)` : '') + '.');
    return { sent, waiting: state.queue.length };
  }

  async function run({
    dryRun = false,
    hours = cfg.lookbackHours,
    pauseMs = cfg.secondsBetweenReplies * 1000,
    log = console.log,
    withBackfill = cfg.backfill.enabled,
    stateFile = defaultStateFile(),
    backfillGapMs, // tests only
    now = Date.now(), // tests only: when a login renewal thinks it is
  } = {}) {
    const secret = process.env[envVar];
    if (!secret) {
      log(`${label}: not connected yet (${envVar} missing). Skipping.`);
      return { skipped: true };
    }

    const state = loadState(stateFile);
    const today = pacificDay();
    if (state.day !== today) Object.assign(state, { day: today, repliesToday: 0 });

    const result = { scanned: 0, matched: 0, alreadyAnswered: 0, replied: 0, failed: 0, rateLimited: false, wouldReply: [] };
    try {
      let token, me;
      try {
        ({ token, me } = await login(state, secret, log, now));
      } catch (err) {
        if (err instanceof api.TokenInvalid) throw new Error(`${reconnect} (${err.message})`);
        throw err;
      }

      try {
        const media = await api.listMedia(token, me);
        await answerNew({ token, me, media, state, dryRun, hours, pauseMs, log, result });
        if (withBackfill) {
          const [lo, hi] = cfg.backfill.gapSeconds;
          result.backfill = await backfill({
            token, me, media, state, dryRun, log,
            postedThisRun: !dryRun && result.replied > 0,
            gapMs: backfillGapMs !== undefined ? () => backfillGapMs : () => (lo + Math.random() * (hi - lo)) * 1000,
          });
        }
      } catch (err) {
        if (!(err instanceof api.RateLimited)) throw err;
        result.rateLimited = true;
        log(`${label} asked the bot to slow down (${err.message}). Carrying on next run.`);
      }
    } finally {
      saveState(state, stateFile);
    }
    return result;
  }

  return { run, defaultStateFile };
}

module.exports = { createPlatform, loadState, saveState, freshState, HOUR };
