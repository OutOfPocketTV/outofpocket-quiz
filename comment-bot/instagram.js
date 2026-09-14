// The Instagram API calls the bot needs ("Instagram API with Instagram
// Login", graph.instagram.com). No packages, just fetch.
//
// Needs a long-lived Instagram User token with instagram_business_basic and
// instagram_business_manage_comments, for a Creator or Business account.
// Such a token lasts 60 days and can be renewed once it is a day old --
// instagram-run.js renews it and keeps the new one.
//
// What Instagram does and does not offer, which shapes instagram-run.js:
// - No "every new comment on the account" feed like YouTube's. Instead each
//   post reports comments_count, so a post whose count went up is the one
//   to look at.
// - A post's comments come newest first, 50 at a time, top-level only; the
//   replies under each are a separate call.

const API = 'https://graph.instagram.com';

const usage = { calls: 0 };

class RateLimited extends Error {}
class TokenInvalid extends Error {}

// Graph API error codes that mean "slow down".
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002]);

async function call(token, method, path, params = {}) {
  usage.calls++;
  const query = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(method === 'GET' ? `${API}/${path}?${query}` : `${API}/${path}`, {
    method,
    ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: query }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    // Never put the URL in the message: it carries the token.
    const message = `Instagram ${method} /${path} ${res.status}: ${e.message || res.statusText}`;
    const Kind = RATE_LIMIT_CODES.has(e.code) ? RateLimited : e.code === 190 ? TokenInvalid : Error;
    throw Object.assign(new Kind(message), { status: res.status, code: e.code, subcode: e.error_subcode });
  }
  return data;
}

async function getMe(token) {
  const data = await call(token, 'GET', 'me', { fields: 'user_id,username' });
  return { id: String(data.user_id || data.id), username: data.username };
}

// "at least 24 hours old but not expired" or Instagram refuses.
async function refreshToken(token) {
  const data = await call(token, 'GET', 'refresh_access_token', { grant_type: 'ig_refresh_token' });
  return { token: data.access_token, expiresIn: data.expires_in };
}

// Every post on the account, with its comment count.
async function listMedia(token) {
  const media = [];
  let after;
  for (let page = 0; page < 50; page++) {
    const data = await call(token, 'GET', 'me/media', {
      fields: 'id,comments_count,timestamp,permalink',
      limit: '100',
      ...(after ? { after } : {}),
    });
    for (const m of data.data || []) {
      media.push({ id: m.id, comments: Number(m.comments_count || 0), timestamp: m.timestamp, permalink: m.permalink });
    }
    after = data.paging?.next ? data.paging.cursors?.after : null;
    if (!after) break;
  }
  return media;
}

// One page of a post's top-level comments, newest first.
async function commentsPage(token, mediaId, after) {
  const data = await call(token, 'GET', `${mediaId}/comments`, {
    fields: 'id,text,timestamp,hidden,from,username,replies{id,text,from,username}',
    limit: '50',
    ...(after ? { after } : {}),
  });
  return { items: data.data || [], next: data.paging?.next ? data.paging.cursors?.after || null : null };
}

function isMine(comment, me) {
  return comment.from?.id === me.id || comment.from?.username === me.username || comment.username === me.username;
}

// INSTAGRAM NEVER SAYS WHO WROTE A REPLY. Asked for from/username, the replies
// edge returns only id and text -- for the bot's own replies AND everyone
// else's (checked 2026-09-14: 12 of 12 replies had no author). Judging "did
// we already answer?" by author therefore always said no, and the 15-minute
// run re-posted "It's www.outofpocket.tv" under a comment every time its post
// got new comments. So a reply counts as an answer by WHAT IT SAYS: any of
// the bot's own lines, or anything that already hands over the site.
const config = require('./config');
const OUR_LINES = new Set([
  ...config.instagram.replies,
  ...config.instagram.backfill.replies,
  ...(config.instagram.keywordDm?.publicReplies || []),
].map((s) => s.trim()));

function isAnswer(reply, me) {
  const text = String(reply.text || '').trim();
  return isMine(reply, me) || OUR_LINES.has(text) || /outofpocket\.tv/i.test(text);
}

// Replies that came back with the comment itself. Good enough to skip the
// obvious ones for free; alreadyReplied() is the real check.
function repliedInline(comment, me) {
  return (comment.replies?.data || []).some((r) => isAnswer(r, me));
}

async function alreadyReplied(token, commentId, me) {
  let after;
  for (let page = 0; page < 10; page++) {
    const data = await call(token, 'GET', `${commentId}/replies`, {
      fields: 'id,text,from,username',
      limit: '50',
      ...(after ? { after } : {}),
    });
    if ((data.data || []).some((r) => isAnswer(r, me))) return true;
    after = data.paging?.next ? data.paging.cursors?.after : null;
    if (!after) return false;
  }
  return true; // 500+ replies and still looking: treat as answered rather than risk a duplicate
}

// The comment as it is now, or null if it was deleted.
async function getComment(token, commentId) {
  try {
    return await call(token, 'GET', commentId, { fields: 'id,text,timestamp,hidden' });
  } catch (err) {
    if (err.code === 100) return null;
    throw err;
  }
}

async function postReply(token, commentId, message) {
  return call(token, 'POST', `${commentId}/replies`, { message });
}

class AlreadyMessaged extends Error {}

// "Private reply": one DM to the person who wrote a comment, allowed once per
// comment and within 7 days of it. Instagram attaches the comment to the DM
// itself. Needs instagram_business_manage_messages.
async function sendPrivateReply(token, commentId, text) {
  try {
    return await call(token, 'POST', 'me/messages', {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify({ text }),
    });
  } catch (err) {
    // Meta allows exactly one private reply per comment.
    if (err.subcode === 2534014) throw Object.assign(new AlreadyMessaged(err.message), { code: err.code, subcode: err.subcode });
    throw err;
  }
}

module.exports = {
  usage,
  RateLimited,
  TokenInvalid,
  getMe,
  refreshToken,
  listMedia,
  commentsPage,
  isMine,
  isAnswer,
  repliedInline,
  alreadyReplied,
  getComment,
  postReply,
  AlreadyMessaged,
  sendPrivateReply,
};
