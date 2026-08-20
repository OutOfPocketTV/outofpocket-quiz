// Renders the 1200x630 link-preview image for a shared result.
// Same conventions as the other api/*.js files: CommonJS, fail loudly in
// the response but never crash the function.
//
// @vercel/og is ESM-only, so it's pulled in with a dynamic import rather
// than a top-level require.

const { decodeShare } = require("../lib/share-card.js");
const { buildShareImageTree } = require("../lib/share-image.js");

module.exports = async function handler(req, res) {
  try {
    const code = String((req.query && req.query.c) || "");
    const data = decodeShare(code);
    if (!data) {
      res.status(400).json({ error: "Unreadable share code." });
      return;
    }

    const { ImageResponse } = await import("@vercel/og");
    const image = new ImageResponse(buildShareImageTree(data), {
      width: 1200,
      height: 630,
    });
    const buf = Buffer.from(await image.arrayBuffer());

    res.setHeader("Content-Type", "image/png");
    // The image is a pure function of the code, so it can never go stale.
    // Scrapers re-fetch these constantly; caching keeps that free.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(buf);
  } catch (err) {
    console.error("og image render failed", err);
    res.status(500).json({ error: "Could not render that preview image." });
  }
};
