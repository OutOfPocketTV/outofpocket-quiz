// GET /api/social-feed
// Public. Feeds the "As Seen On Social Media" strip on the home page with
// the channel's own clips, read straight from YouTube's RSS feed.
//
// Keyless on purpose -- the same reasoning as the YouTube check in
// live-status.js. youtube.com/feeds/videos.xml needs no API key, no quota
// and no OAuth, so there is no secret to rotate, nothing to expire, and
// nothing for anyone to set up before this works. It returns the 15 most
// recent uploads with title, link, thumbnail and a real view count.
//
// Every failure is silent by contract: an unreachable feed, a reshaped XML,
// a channel with no Shorts -- all return { available: false } and the strip
// simply never renders. The follow buttons beside it are static markup, so
// a completely dead feed costs the section its clips, never its point.

// Public identifier, not a secret: it is the same channel the site footer
// has linked to since launch. Kept as a constant so the strip works on
// preview deployments and local runs with nothing configured at all. The
// env var still wins where one is set (it already is, for /live).
const DEFAULT_CHANNEL_ID = "UC66r5O-3v6IEhmC-kzLR8gw";

const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const MAX_CLIPS = 6;

// Warm invocations reuse this instead of hitting YouTube again. The edge
// cache below does most of the work; this covers the rest.
const CACHE_MS = 30 * 60 * 1000;
let cache = null;
let cacheExpiry = 0;

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
        // The 16:9 thumbnails YouTube generates for a Short are blur-filled
        // rather than black-barred, and the real vertical frame sits dead
        // centre -- so a 9:16 object-fit:cover tile crops back to exactly
        // the original video. Two widths so the crop stays sharp on a
        // retina screen without shipping the 230 KB full-size vertical.
        thumb: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
        thumbLarge: "https://i.ytimg.com/vi/" + id + "/hq720.jpg",
      };
    })
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const channelId = process.env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;

  if (cache && Date.now() < cacheExpiry) {
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json(cache);
  }

  try {
    const feed = await fetch(FEED_URL + encodeURIComponent(channelId), {
      headers: { Accept: "application/atom+xml" },
    });
    if (!feed.ok) throw new Error("YouTube feed request failed: " + feed.status);

    const entries = parseFeed(await feed.text());

    // Shorts only, and that is the whole point of the section: the vertical
    // street clips ARE the social media presence, they out-perform the
    // long-form episodes by two orders of magnitude, and being uniformly
    // 9:16 means the strip has one tile shape instead of two. A feed with
    // no Shorts in it yields nothing here, which the page already handles.
    const clips = entries
      .filter((e) => e.url.indexOf("/shorts/") !== -1)
      // Best-performing first. This is a proof section, not a news feed --
      // and it still refreshes on its own as newer clips out-perform older
      // ones, with no list for anyone to maintain by hand.
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, MAX_CLIPS);

    if (!clips.length) {
      // Deliberately not cached: a feed that happens to hold no Shorts today
      // will hold one tomorrow, and there is nothing to save by remembering
      // the empty answer.
      return res.status(200).json({ available: false });
    }

    const payload = { available: true, clips };
    cache = payload;
    cacheExpiry = Date.now() + CACHE_MS;

    // Cached at the edge: uploads are daily at most, and every visitor who
    // scrolls to the bottom would otherwise be a round trip to YouTube.
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json(payload);
  } catch (err) {
    // Never visible to a visitor: the strip stays hidden and the follow
    // buttons carry the section on their own.
    console.error("Failed to load the social feed:", err);
    return res.status(200).json({ available: false });
  }
};
