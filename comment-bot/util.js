// Small helpers shared by the YouTube, Instagram and Facebook halves of the
// bot, and the site's instant webhook.

// Same comment always gets the same wording, but the account as a whole
// rotates through the list.
function pickReply(commentId, replies) {
  let h = 0;
  for (const ch of String(commentId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return replies[h % replies.length];
}

function snippet(text, max = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Hiccups at the API's end ---------------------------------------------
//
// Now and then an API falls over on its own: a 500 or 503 from Meta,
// YouTube's "processingFailure", a connection that drops or never answers.
// Nothing about the request is wrong, and nothing about it is Tom's to fix --
// the same call works seconds later. In the week to 2026-10-08 each one
// still produced a failure email (five of them, at all hours), while the
// run 15 minutes later was fine every time.
//
// So each API client marks such an error `transient: true`. A GET is then
// tried again after a short pause; a POST never is, because a reply that got
// a 500 back may well have been posted anyway (Instagram did exactly that on
// 2026-09-14). What still fails reaches run.js, which counts it as weather
// rather than a broken bot -- see runAll there.

// Pauses before the second and third try. The tests set these to 0.
const retry = { pauses: [2000, 5000] };

async function withRetry(attempt, { retriable = true } = {}) {
  for (let n = 0; ; n++) {
    try {
      return await attempt();
    } catch (err) {
      if (!retriable || !err.transient || n >= retry.pauses.length) throw err;
      await sleep(retry.pauses[n]);
    }
  }
}

// A request that never answers is cut off here, so it fails like any other
// hiccup instead of hanging until GitHub cancels the job at ten minutes --
// which emails Tom too.
const ANSWER_WITHIN_MS = 30000;

// fetch() that reports a dropped or stalled connection the same way the
// clients report an error from the API: a transient error naming the call,
// never the URL (Meta's carry the login token).
async function fetchOrFail(url, init, what) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ANSWER_WITHIN_MS) });
  } catch (err) {
    // fetch() rejects with a TypeError when the connection fails and a
    // TimeoutError when the signal above fires. Anything else is a bug.
    if (err.name !== 'TypeError' && err.name !== 'TimeoutError') throw err;
    const why = err.name === 'TimeoutError' ? `no answer in ${ANSWER_WITHIN_MS / 1000}s` : (err.cause?.message || err.message);
    throw Object.assign(new Error(`${what}: ${why}`), { transient: true });
  }
}

module.exports = { pickReply, snippet, sleep, retry, withRetry, fetchOrFail };
