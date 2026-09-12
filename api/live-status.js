// GET /api/live-status
// Public. Answers the only question /live exists to answer: is the stream
// on right now, and if so, where.
//
// Every platform is optional. With nothing configured this returns
// { available: false } and the page falls back to its schedule-less copy,
// so deploying this before the env vars exist can never break /live --
// same contract as /api/report-price.
//
// Env vars (all optional):
//   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_LOGIN
//   KICK_SLUG
//   YOUTUBE_CHANNEL_ID, and YOUTUBE_API_KEY only if you want the official
//   API rather than the keyless page check below.

// App access tokens last ~60 days, so a module-scoped cache survives most
// warm invocations and keeps us off the token endpoint entirely.
let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchToken(clientId, clientSecret) {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch("https://id.twitch.tv/oauth2/token?" + params, { method: "POST" });
  if (!res.ok) throw new Error("Twitch token request failed: " + res.status);

  const body = await res.json();
  twitchToken = body.access_token;
  // Retire it a minute early rather than discover expiry mid-request.
  twitchTokenExpiry = Date.now() + Math.max(0, (body.expires_in || 0) - 60) * 1000;
  return twitchToken;
}

async function checkTwitch() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const login = process.env.TWITCH_LOGIN;
  if (!clientId || !clientSecret || !login) return null;

  const token = await getTwitchToken(clientId, clientSecret);
  const res = await fetch("https://api.twitch.tv/helix/streams?user_login=" + encodeURIComponent(login), {
    headers: { "Client-ID": clientId, Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("Twitch streams request failed: " + res.status);

  const body = await res.json();
  // Helix returns an empty data array when the channel is offline -- there
  // is no "offline" record to read a type off.
  return Array.isArray(body.data) && body.data.length > 0;
}

async function checkKick() {
  const slug = process.env.KICK_SLUG;
  if (!slug) return null;

  // Kick has no documented public API. This endpoint is what their own
  // site uses and it sits behind Cloudflare, so it will sometimes answer
  // 403 to a datacentre IP. That is why every check here is allowed to
  // fail independently rather than taking the whole response down.
  const res = await fetch("https://kick.com/api/v2/channels/" + encodeURIComponent(slug), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Kick channel request failed: " + res.status);

  const body = await res.json();
  return Boolean(body && body.livestream && body.livestream.is_live !== false);
}

// Keyless YouTube check. The channel's own /live page carries two
// independent markers while a stream is running and neither of them when
// it is not -- verified both ways against a live channel and this one
// while offline. Both must be present to call it live: if YouTube changes
// its page shape this degrades to "offline", never to a false "live" that
// would send viewers from a Short to a dead stream.
// Must be the @handle URL, not /channel/<id>: the channel-ID form of the
// same page carries "isLive" but drops liveBroadcastDetails, so the
// two-marker test below silently never fires there. Measured, not assumed.
async function checkYouTubeKeyless(handle) {
  const path = handle.startsWith("@") ? handle : "@" + handle;
  const res = await fetch("https://www.youtube.com/" + encodeURIComponent(path) + "/live", {
    headers: {
      // Without a browser UA YouTube serves a consent interstitial that
      // carries neither marker, which would read as a confident offline.
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error("YouTube live page request failed: " + res.status);

  const html = await res.text();
  return html.includes('"isLive":true') && html.includes("liveBroadcastDetails");
}

async function checkYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const handle = process.env.YOUTUBE_HANDLE;

  // The keyless path is the default, not the fallback: it needs no
  // credential and burns no quota. The API is only better in that it is
  // contractual, so it wins whenever a key happens to be configured.
  if (key && channelId) {
    // fall through to the API path below
  } else if (handle) {
    return checkYouTubeKeyless(handle);
  } else {
    return null;
  }

  // search.list costs 100 quota units against a 10,000/day default, i.e.
  // about 100 calls a day. The edge cache below is doing the real work of
  // keeping this affordable -- do not lower it without checking quota.
  const params = new URLSearchParams({
    part: "id",
    channelId,
    eventType: "live",
    type: "video",
    maxResults: "1",
    key,
  });
  const res = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
  if (!res.ok) throw new Error("YouTube search request failed: " + res.status);

  const body = await res.json();
  return Array.isArray(body.items) && body.items.length > 0;
}

// --- Recent clips (?clips=1) ------------------------------------------
// Feeds the "As Seen On Social Media" strip on the home page.
//
// This lives here rather than in its own api/social-feed.js for one blunt
// reason: the Vercel plan caps a deployment at 12 Serverless Functions and
// api/ is already at 12. A 13th file fails the BUILD outright -- nothing
// deploys, not just the new route. It is a reasonable lodger anyway: this
// is already the keyless-YouTube file, and the clips branch returns before
// any live check runs, so /live's own call path is untouched.
//
// Keyless like its neighbours: youtube.com/feeds/videos.xml needs no API
// key, no quota and no OAuth, and carries a real view count per upload.

// Public identifier, not a secret -- the same channel the footer has linked
// to since launch. Kept as a constant so the strip works on preview
// deployments and local runs with nothing configured; the env var wins.
const DEFAULT_CHANNEL_ID = "UC66r5O-3v6IEhmC-kzLR8gw";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const MAX_CLIPS = 9;

// What counts as a quiz clip, by title. Tom names them to a pattern -- the
// "will they find" hook, the delusional verdict, the eye-watering number --
// and the RSS feed carries nothing else that could tell a quiz clip from an
// ordinary street question. Anything that does not match is left out, which
// is the safe direction: a missing clip is invisible, a wrong one is a
// street interview sitting on the front page pretending to be the product.
const QUIZ_TITLE_PATTERNS = [
  /will\s+(?:he|she|they)\s+find/i,
  /delusional/i,
  /wants?\s*\$/i,
  /dream\s+partner/i,
  /\bstandards?\b/i,
  /\bodds\b/i,
];

function isQuizClip(title) {
  return QUIZ_TITLE_PATTERNS.some((re) => re.test(String(title || "")));
}

// Tom's own pick of his best-performing quiz clips, in the order they are
// shown. Hand-listed because they cannot be discovered: the RSS feed only
// reaches the last fifteen uploads and every one of these is older, the
// Shorts tab loads lazily so it cannot be scraped, and TikTok has no
// keyless feed at all.
//
// `views` are real figures read from each video's own page on 2026-09-12,
// not estimates. They are a snapshot, not a live number -- refresh them
// when they drift far enough to matter. Never invent one: a clip with no
// count simply shows no badge, which is better than a wrong badge.
const PINNED = [
  { yt: "hy-cIEYEzkU", views: 29965946, title: "She wants a millionaire boyfriend" },
  { yt: "Fb5BBTfELhg", views: 25833736, title: "Are her standards too LOW?" },
  { yt: "38Q-6KuQK2U", views: 9268632, title: "Is she reasonable?" },
  { yt: "7PqRIQgv7OI", views: 9091267, title: "Will she find him?" },
  { yt: "CwOkZbJMiaY", views: 7240266, title: "Indian girl DELUSIONAL?!" },
  { yt: "0fbHpgACCUQ", views: 6443255, title: "Is she DELUSIONAL?" },
  { yt: "tnKct9sAQ20", views: 3000426, title: "Is she DELUSIONAL?" },
  // TikTok's oEmbed gives a title and a thumbnail but never a view count,
  // so unlike the YouTube figures above this one cannot be read from
  // anywhere -- it is Tom's own number, supplied 2026-09-12. It will not
  // update itself; ask him for a fresh one when it looks stale.
  {
    tiktok: "https://www.tiktok.com/@outtapockettv/video/7682460342827470093",
    title: "Will she find him?",
    views: 1100000,
  },
  { yt: "bIVCdNADZsk", views: 485280, title: "Will she find him?" },
];

function pinnedToClip(p) {
  if (p.yt) {
    return {
      id: p.yt,
      url: "https://www.youtube.com/shorts/" + p.yt,
      title: p.title || "",
      views: typeof p.views === "number" ? p.views : null,
      // 480px wide at 1x, 640px at 2x. Deliberately NOT hq720: the tile
      // crops to the middle ~42% of a 4:3 thumbnail, and nine of those at
      // 1280px would be most of a megabyte for cards 160px wide.
      thumb: "https://i.ytimg.com/vi/" + p.yt + "/hqdefault.jpg",
      thumbLarge: "https://i.ytimg.com/vi/" + p.yt + "/sddefault.jpg",
    };
  }
  return null;
}

// TikTok's thumbnail URL is signed and expires, so it cannot be stored --
// it has to be fetched fresh. oEmbed is keyless and gives a title and a
// 720x1280 image, but never a view count.
async function resolveTikTok(p) {
  try {
    const res = await fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(p.tiktok), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body || !body.thumbnail_url) return null;
    return {
      id: p.tiktok,
      url: p.tiktok,
      title: p.title || body.title || "",
      views: typeof p.views === "number" ? p.views : null,
      thumb: body.thumbnail_url,
      thumbLarge: null, // already 720x1280, and vertical -- no crop needed
    };
  } catch (err) {
    // One unreachable clip must not take the whole wall down with it.
    console.error("live-status: TikTok oEmbed failed:", err.message);
    return null;
  }
}

// Warm invocations reuse this instead of hitting YouTube again. The edge
// cache does most of the work; this covers the rest.
const CLIPS_CACHE_MS = 30 * 60 * 1000;
let clipsCache = null;
let clipsCacheExpiry = 0;

function decodeEntities(str) {
  return String(str)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    // Ampersand last, or "&amp;lt;" would decode twice.
    .replace(/&amp;/g, "&")
    .trim();
}

// Hand-parsed rather than pulling in an XML dependency: this feed is one
// fixed shape from one publisher, and a regex that stops matching simply
// yields no clips, which is already a handled outcome.
function parseFeed(xml) {
  return xml
    .split("<entry>")
    .slice(1)
    .map((chunk) => {
      const body = chunk.split("</entry>")[0];
      const pick = (re) => {
        const m = body.match(re);
        return m ? m[1] : null;
      };

      const id = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const url = pick(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
      const title = pick(/<title>([\s\S]*?)<\/title>/);
      const published = pick(/<published>([^<]+)<\/published>/);
      const views = pick(/<media:statistics[^>]*views="(\d+)"/);

      if (!id || !url) return null;

      return {
        id,
        url,
        title: title ? decodeEntities(title) : "",
        published: published || null,
        // Absent on a brand new upload; the client omits the badge rather
        // than printing a zero that would read as "nobody watched this".
        views: views ? Number(views) : null,
        // The 16:9 thumbnail YouTube generates for a Short is blur-filled
        // rather than black-barred, with the real vertical frame dead
        // centre -- so a 9:16 object-fit:cover tile crops back to exactly
        // the original video. Two widths so the crop stays sharp on a
        // retina screen without shipping the 230 KB full-size vertical.
        thumb: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
        thumbLarge: "https://i.ytimg.com/vi/" + id + "/hq720.jpg",
      };
    })
    .filter(Boolean);
}

async function respondWithClips(res) {
  const channelId = process.env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;

  if (clipsCache && Date.now() < clipsCacheExpiry) {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json(clipsCache);
  }

  try {
    // Tom's own picks come first and in his order -- no sorting. They are
    // hand-chosen best-performers, so a rule that reshuffled them would
    // only ever be second-guessing the person who picked them.
    const clips = (
      await Promise.all(PINNED.map((p) => (p.tiktok ? resolveTikTok(p) : pinnedToClip(p))))
    ).filter(Boolean);

    // The feed is only consulted when the pinned list does not fill the
    // wall, which today it does. This keeps the common path to zero
    // YouTube requests and means an RSS outage cannot empty the wall.
    if (clips.length < MAX_CLIPS) {
      const feed = await fetch(FEED_URL + encodeURIComponent(channelId), {
        headers: { Accept: "application/atom+xml" },
      });
      if (!feed.ok) throw new Error("YouTube feed request failed: " + feed.status);

      // Shorts, and only the ones that are actually QUIZ clips.
      //
      // Sorting every Short by views was wrong: it put "Does height
      // matter?" -- a street question, not a quiz clip -- on the front page
      // purely because it performed. The feed carries no marker for what a
      // video is about, so the titles are the only signal, and Tom names
      // quiz clips to a consistent pattern. A video that does not match is
      // left out rather than guessed at.
      const seen = new Set(clips.map((c) => c.id));
      parseFeed(await feed.text())
        .filter((e) => e.url.indexOf("/shorts/") !== -1 && isQuizClip(e.title) && !seen.has(e.id))
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .forEach((e) => clips.push(e));
    }

    clips.length = Math.min(clips.length, MAX_CLIPS);

    if (!clips.length) {
      // Deliberately not cached: a feed holding no Shorts today will hold
      // one tomorrow, and there is nothing to save by remembering that.
      return res.status(200).json({ available: false });
    }

    const payload = { available: true, clips };
    clipsCache = payload;
    clipsCacheExpiry = Date.now() + CLIPS_CACHE_MS;

    // Uploads are daily at most, and every visitor to the home page would
    // otherwise be a round trip to YouTube.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json(payload);
  } catch (err) {
    // Never visible to a visitor: the strip collapses and the follow
    // buttons carry the section on their own.
    console.error("live-status: clip feed failed:", err.message);
    return res.status(200).json({ available: false });
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Answered before any live check runs, so /live's behaviour is exactly
  // what it was. req.query is populated by Vercel's Node runtime; the URL
  // is read directly as a fallback so this cannot depend on that.
  const wantsClips =
    (req.query && req.query.clips) || String(req.url || "").indexOf("clips=") !== -1;
  if (wantsClips) return respondWithClips(res);

  // Order matters: the first platform found live becomes the one the page
  // sends people to. YouTube leads because it is the channel that already
  // has an audience, so it is where an undecided viewer is worth most.
  const checks = [
    ["youtube", checkYouTube],
    ["twitch", checkTwitch],
    ["kick", checkKick],
  ];

  const settled = await Promise.all(
    checks.map(async ([platform, fn]) => {
      try {
        return { platform, live: await fn() };
      } catch (err) {
        console.error("live-status: " + platform + " check failed:", err.message);
        return { platform, live: null, errored: true };
      }
    })
  );

  const configured = settled.filter((r) => r.live !== null);
  if (configured.length === 0) {
    // Nothing configured, or every configured platform errored. Say so
    // rather than reporting a confident "offline" we have not earned.
    return res.status(200).json({ available: false });
  }

  const onAir = configured.find((r) => r.live === true);

  // Short cache: long enough to absorb a clip going viral, short enough
  // that going live shows up on the page inside a minute.
  res.setHeader("Cache-Control", "public, s-maxage=45, stale-while-revalidate=120");

  return res.status(200).json({
    available: true,
    live: Boolean(onAir),
    platform: onAir ? onAir.platform : null,
    checked: configured.map((r) => r.platform),
  });
};
