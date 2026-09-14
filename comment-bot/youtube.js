// The handful of YouTube Data API calls the bot needs. No packages, just
// fetch, so the GitHub Action has nothing to install.
//
// Quota (10,000 units a day on a new Google Cloud project):
//   channels.list        1   -- once per run, to learn which channel we are
//   commentThreads.list  1   -- per page of 100 comments, or one thread by id
//   comments.list        1   -- only for a matched comment with many replies
//   playlistItems.list   1   -- per 50 uploads, once, to list every video
//   videos.list          1   -- per 50 videos, once, for comment counts
//   comments.insert     50   -- per reply posted
//
// `usage.units` adds these up as calls are made, so the backfill can stop
// before it eats the units new questions need.

const API = 'https://www.googleapis.com/youtube/v3';

const usage = { units: 0 };

class QuotaExceeded extends Error {}

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant = the refresh token was revoked or expired. The usual
    // cause is the Google Cloud consent screen being left in "Testing",
    // which kills refresh tokens after 7 days.
    throw new Error(`Google token refresh failed (${res.status} ${body.error || ''}). ` +
      'If this says invalid_grant, run  node comment-bot/connect-youtube.js  again.');
  }
  return body.access_token;
}

async function call(token, method, path, params, body) {
  const url = `${API}/${path}?${new URLSearchParams(params)}`;
  usage.units += method === 'POST' ? 50 : 1;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason || '';
    const message = data.error?.message || res.statusText;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new QuotaExceeded(message);
    }
    const err = new Error(`YouTube ${method} ${path} ${res.status} ${reason}: ${message}`);
    err.status = res.status;
    err.reason = reason;
    throw err;
  }
  return data;
}

async function getMyChannel(token) {
  const data = await call(token, 'GET', 'channels', { part: 'snippet,contentDetails', mine: 'true' });
  const ch = data.items?.[0];
  if (!ch) throw new Error('This Google login has no YouTube channel. Reconnect and pick the Out Of Pocket channel.');
  return { id: ch.id, title: ch.snippet?.title || ch.id, uploads: ch.contentDetails?.relatedPlaylists?.uploads };
}

// Every video on the channel with at least one comment, most comments
// first -- the busiest videos hold most of the unanswered questions, and
// they are the ones people still watch.
async function listVideosByComments(token, uploadsPlaylistId) {
  const ids = [];
  let pageToken;
  do {
    const data = await call(token, 'GET', 'playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of data.items || []) ids.push(item.contentDetails.videoId);
    pageToken = data.nextPageToken;
  } while (pageToken);

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await call(token, 'GET', 'videos', { part: 'statistics', id: ids.slice(i, i + 50).join(',') });
    for (const v of data.items || []) {
      const comments = Number(v.statistics?.commentCount || 0);
      if (comments > 0) videos.push({ id: v.id, comments });
    }
  }
  return videos.sort((a, b) => b.comments - a.comments);
}

// One page of a single video's comment threads.
async function listVideoThreadsPage(token, videoId, pageToken) {
  const data = await call(token, 'GET', 'commentThreads', {
    part: 'snippet,replies',
    videoId,
    order: 'time',
    maxResults: '100',
    textFormat: 'plainText',
    ...(pageToken ? { pageToken } : {}),
  });
  return { items: data.items || [], nextPageToken: data.nextPageToken || null };
}

// A thread as it is right now, or null if it has been deleted.
async function getThread(token, threadId) {
  const data = await call(token, 'GET', 'commentThreads', { part: 'snippet,replies', id: threadId, textFormat: 'plainText' });
  return data.items?.[0] || null;
}

// Last time anything happened in a thread: the question, an edit, or a reply.
function lastActivity(thread) {
  const top = thread.snippet.topLevelComment.snippet;
  const times = [top.publishedAt, top.updatedAt, ...(thread.replies?.comments || []).map((c) => c.snippet.publishedAt)];
  return Math.max(...times.filter(Boolean).map((t) => Date.parse(t)));
}

// Threads whose question was posted after `since`, across every video on the
// channel (Shorts included). YouTube's "time" order is newest first, but it
// does not say whether a fresh reply bumps an old thread up -- so paging
// stops at the first page where NOTHING happened after `since`, which is
// right under either reading.
async function listRecentThreads(token, channelId, since, maxPages) {
  const threads = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const data = await call(token, 'GET', 'commentThreads', {
      part: 'snippet,replies',
      allThreadsRelatedToChannelId: channelId,
      order: 'time',
      maxResults: '100',
      textFormat: 'plainText',
      ...(pageToken ? { pageToken } : {}),
    });
    const items = data.items || [];
    for (const item of items) {
      if (Date.parse(item.snippet.topLevelComment.snippet.publishedAt) >= since) threads.push(item);
    }
    pageToken = data.nextPageToken;
    if (!pageToken || !items.some((item) => lastActivity(item) >= since)) break;
  }
  return threads;
}

// True if the channel already replied in this thread. The thread listing
// only carries a few replies, so a busy thread is checked in full.
async function channelAlreadyReplied(token, thread, channelId) {
  const shown = thread.replies?.comments || [];
  if (shown.some((c) => c.snippet.authorChannelId?.value === channelId)) return true;
  if ((thread.snippet.totalReplyCount || 0) <= shown.length) return false;

  let pageToken;
  for (let page = 0; page < 5; page++) {
    const data = await call(token, 'GET', 'comments', {
      part: 'snippet',
      parentId: thread.id,
      maxResults: '100',
      textFormat: 'plainText',
      ...(pageToken ? { pageToken } : {}),
    });
    if ((data.items || []).some((c) => c.snippet.authorChannelId?.value === channelId)) return true;
    pageToken = data.nextPageToken;
    if (!pageToken) return false;
  }
  return true; // 500+ replies and still looking: treat as answered rather than risk a duplicate
}

async function postReply(token, parentId, text) {
  return call(token, 'POST', 'comments', { part: 'snippet' }, {
    snippet: { parentId, textOriginal: text },
  });
}

module.exports = {
  usage,
  QuotaExceeded,
  getAccessToken,
  getMyChannel,
  listVideosByComments,
  listVideoThreadsPage,
  getThread,
  listRecentThreads,
  channelAlreadyReplied,
  postReply,
};
