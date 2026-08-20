// The page a shared link points at: /s/<code>.
//
// It has to return 200 HTML rather than a redirect, because Facebook, X
// and friends read the <meta> tags off the response body -- a 3xx would
// send them to the homepage and they'd scrape the generic preview again,
// which is the exact bug this whole route exists to fix. Humans are moved
// on by a script tag instead, which scrapers don't run.

const { decodeShare, placeFromScope, stripEmoji } = require("../lib/share-card.js");

const SITE_URL = "https://outofpocket.tv";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = async function handler(req, res) {
  const rawCode = String((req.query && req.query.c) || "");
  // Anything that isn't base64url can't be one of our codes. Rejecting on
  // the character class (rather than escaping later) means nothing
  // attacker-shaped ever reaches the markup or the image URL.
  const code = /^[A-Za-z0-9_-]{1,2000}$/.test(rawCode) ? rawCode : "";
  const data = code ? decodeShare(code) : null;

  if (!data) {
    // A mangled link should still land the visitor on the site rather
    // than showing them an error page.
    res.setHeader("Location", SITE_URL + "/");
    res.status(302).end();
    return;
  }

  const place = placeFromScope(data.scopeLabel);
  const title = `I have a ${data.pctText} chance the ${data.dreamWord} of my dreams exists`;
  const criteriaText = data.criteria.slice(0, 5).map(stripEmoji).join(", ");
  const description =
    `Out Of Pocket TV dating odds test — looking for a ${data.dreamWord} in ${place}` +
    (criteriaText ? `: ${criteriaText}.` : ".") +
    ` ${data.score}/5 rarity — ${stripEmoji(data.rarityLabel)}. See your own odds.`;
  const imageUrl = `${SITE_URL}/api/og?c=${code}`;
  const pageUrl = `${SITE_URL}/s/${code}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Out Of Pocket TV" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
<link rel="canonical" href="${SITE_URL}/" />
</head>
<body style="margin:0;background:#060606;color:#f3f3f3;font-family:system-ui,sans-serif">
<p style="padding:24px">Taking you to the test… <a href="${SITE_URL}/" style="color:#9d8cff">outofpocket.tv</a></p>
<script>location.replace(${JSON.stringify(SITE_URL + "/?from=share")});</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.status(200).send(html);
};
