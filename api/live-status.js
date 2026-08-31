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

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

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
