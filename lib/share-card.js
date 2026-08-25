// Shared by /api/share (the link preview page) and /api/og (the image it
// points at). Kept out of api/ so Vercel doesn't turn it into an endpoint.
//
// A shared result is carried ENTIRELY in the URL -- no database row per
// share. Shares are cheap and numerous, they never need to be listed or
// revoked, and a stateless link keeps working if the DB is ever swapped
// out. The cost is a long URL, which nobody types by hand.

// Mirrors RARITY_LEVELS in quiz-core.js. Only the label and accent are
// needed here, and both are keyed off the score the client already sends,
// so the image can never disagree with the page about which tier it is.
const RARITY = [
  { label: "Local Neighborhood", accent: "#7fe3a3" },
  { label: "Next Town Over", accent: "#6bc8ff" },
  { label: "Across the Country", accent: "#b98cff" },
  { label: "On the Moon", accent: "#ffb443" },
  { label: "Lost in the Matrix", accent: "#00ff6a" },
];

const MAX_CRITERIA = 7; // more than this and the column runs off the card

function toBase64Url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(code) {
  const padded = code.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

// Positional array rather than an object: the keys would be a third of
// the payload, and this is never hand-edited.
// [pctText, score, dreamWord, oddsText, scopeLabel, ...criteria]
function encodeShare(data) {
  const arr = [
    String(data.pctText || ""),
    Number(data.score) || 1,
    String(data.dreamWord || ""),
    String(data.oddsText || ""),
    String(data.scopeLabel || ""),
  ].concat((data.criteria || []).map(String));
  return toBase64Url(JSON.stringify(arr));
}

function decodeShare(code) {
  if (!code || typeof code !== "string" || code.length > 2000) return null;
  let arr;
  try {
    arr = JSON.parse(fromBase64Url(code));
  } catch (err) {
    return null; // a truncated or hand-mangled link, not a crash
  }
  if (!Array.isArray(arr) || arr.length < 5) return null;
  const score = Math.min(5, Math.max(1, Math.round(Number(arr[1]) || 1)));
  return {
    pctText: sanitize(arr[0], 12),
    score,
    dreamWord: sanitize(arr[2], 20),
    oddsText: sanitize(arr[3], 40),
    scopeLabel: sanitize(arr[4], 60),
    criteria: arr.slice(5).map((c) => sanitize(c, 60)).filter(Boolean),
    rarityLabel: RARITY[score - 1].label,
    accent: RARITY[score - 1].accent,
  };
}

// The payload is attacker-controllable -- anyone can craft a /s/ link.
// Nothing here is ever interpolated into HTML unescaped, but bounding the
// length keeps a hostile link from blowing up the image layout, and
// stripping control characters keeps it out of the response headers.
function sanitize(value, maxLen) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, maxLen)
    .trim();
}

// Satori has no emoji font loaded, and the tier labels carry them
// ("On the Moon 🌙"). Unrendered glyphs come out as blank boxes, so the
// image uses text only -- the accent colour carries the tier instead.
function stripEmoji(str) {
  return String(str).replace(/[^\x20-\x7E\u00A0-\u024F\u2010-\u2027]/g, "").replace(/\s+/g, " ").trim();
}

// scopeLabel is phrased for the sentence on the page ("the probability a
// guy of the U.S. population ages 20 to 40..."), which reads wrong after
// "looking for a man in ___". Turn the population phrase back into a
// plain place. Mirrors the same trim already done in script.js.
//   "the U.S. population"          -> "the U.S."
//   "Japan's population"           -> "Japan"
//   "the world's population"       -> "the world"
//   "the 5 countries you picked"   -> unchanged
function placeFromScope(scopeLabel) {
  return String(scopeLabel || "")
    .replace(/'s population$/, "")
    .replace(/\s+population$/, "")
    .trim();
}

module.exports = { encodeShare, decodeShare, stripEmoji, placeFromScope, RARITY, MAX_CRITERIA };
