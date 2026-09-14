// The Facebook Page API calls the bot needs (graph.facebook.com). No
// packages, just fetch.
//
// Needs a Page access token for the Outofpockettv Page with
// pages_read_engagement, pages_read_user_content and pages_manage_engagement.
// A Page token made from a long-lived user login does not expire, so unlike
// Instagram there is nothing to renew. It does die if Tom changes his
// Facebook password or removes the app.
//
// Everything is normalised to the comment shape graph-run.js expects:
//   { id, text, timestamp, hidden, from: { id }, replies: { data } }

const API = 'https://graph.facebook.com';

const usage = { calls: 0 };

class RateLimited extends Error {}
class TokenInvalid extends Error {}

// Graph API error codes that mean "slow down".
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001]);

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
    const message = `Facebook ${method} /${path} ${res.status}: ${e.message || res.statusText}`;
    const Kind = RATE_LIMIT_CODES.has(e.code) ? RateLimited : e.code === 190 ? TokenInvalid : Error;
    throw Object.assign(new Kind(message), { status: res.status, code: e.code, subcode: e.error_subcode });
  }
  return data;
}

// With a Page token, "me" is the Page.
async function getPage(token) {
  const data = await call(token, 'GET', 'me', { fields: 'id,name' });
  return { id: String(data.id), name: data.name };
}

// Every post on the Page (reels and videos included), with its comment count.
async function listMedia(token, page) {
  const media = [];
  let after;
  for (let n = 0; n < 50; n++) {
    const data = await call(token, 'GET', `${page.id}/published_posts`, {
      fields: 'id,created_time,permalink_url,comments.limit(0).summary(true)',
      limit: '100',
      ...(after ? { after } : {}),
    });
    for (const p of data.data || []) {
      media.push({ id: p.id, comments: Number(p.comments?.summary?.total_count || 0), timestamp: p.created_time, permalink: p.permalink_url });
    }
    after = data.paging?.next ? data.paging.cursors?.after : null;
    if (!after) break;
  }
  return media;
}

function normalise(c) {
  return {
    id: c.id,
    text: c.message || '',
    timestamp: c.created_time,
    hidden: Boolean(c.is_hidden),
    from: c.from ? { id: String(c.from.id), name: c.from.name } : undefined,
    replies: { data: (c.comments?.data || []).map((r) => ({ from: r.from ? { id: String(r.from.id) } : undefined })) },
  };
}

// One page of a post's top-level comments, newest first.
async function commentsPage(token, postId, after) {
  const data = await call(token, 'GET', `${postId}/comments`, {
    fields: 'id,message,created_time,is_hidden,from{id,name},comments.limit(25){from{id}}',
    filter: 'toplevel',
    order: 'reverse_chronological',
    limit: '100',
    ...(after ? { after } : {}),
  });
  return {
    items: (data.data || []).map(normalise),
    next: data.paging?.next ? data.paging.cursors?.after || null : null,
  };
}

// Replies from the Page show up as coming from the Page's own id.
function isMine(comment, page) {
  return comment.from?.id === page.id;
}

function repliedInline(comment, page) {
  return (comment.replies?.data || []).some((r) => isMine(r, page));
}

async function alreadyReplied(token, commentId, page) {
  let after;
  for (let n = 0; n < 10; n++) {
    const data = await call(token, 'GET', `${commentId}/comments`, {
      fields: 'from{id}',
      limit: '100',
      ...(after ? { after } : {}),
    });
    if ((data.data || []).some((r) => String(r.from?.id) === page.id)) return true;
    after = data.paging?.next ? data.paging.cursors?.after : null;
    if (!after) return false;
  }
  return true; // 1,000+ replies and still looking: treat as answered rather than risk a duplicate
}

// The comment as it is now, or null if it was deleted.
async function getComment(token, commentId) {
  try {
    return normalise(await call(token, 'GET', commentId, { fields: 'id,message,created_time,is_hidden' }));
  } catch (err) {
    if (err.code === 100) return null;
    throw err;
  }
}

async function postReply(token, commentId, message) {
  return call(token, 'POST', `${commentId}/comments`, { message });
}

module.exports = {
  usage,
  RateLimited,
  TokenInvalid,
  getPage,
  listMedia,
  commentsPage,
  isMine,
  repliedInline,
  alreadyReplied,
  getComment,
  postReply,
};
