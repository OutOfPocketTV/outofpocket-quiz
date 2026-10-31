// POST /api/contact
// Takes the contact form on /contact.html and forwards it, through Resend,
// to the channel's inbox with the sender set as reply-to, so answering is
// a normal email reply. Nothing is stored. If Resend isn't configured the
// form reports that plainly and the page offers the direct email instead.

const { sendContactEmail } = require("../lib/email");

const TOPICS = {
  question: "A question",
  correction: "A number I think is wrong",
  purchase: "My report or a purchase",
  business: "Business, press or a collaboration",
  other: "Something else",
};

const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;

// Best-effort rate limit: per-IP timestamps kept in this function instance.
// Serverless instances come and go, so this only slows a burst from one
// source; the honeypot and the length limits do the rest.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

function tooMany(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 1000) {
    for (const [key, times] of recent) {
      if (!times.some((t) => now - t < WINDOW_MS)) recent.delete(key);
    }
  }
  return hits.length > MAX_PER_WINDOW;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" && fwd.split(",")[0].trim()) || req.socket?.remoteAddress || "unknown";
}

function isValidEmail(email) {
  return typeof email === "string" && email.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const name = str(body.name).slice(0, MAX_NAME);
  const email = str(body.email);
  const message = str(body.message);
  const topic = TOPICS[body.topic] ? body.topic : "other";

  // Honeypot filled in: a bot. Pretend it worked so it doesn't retry.
  if (str(body.website)) {
    return res.status(200).json({ ok: true, message: "Sent. Thanks, you'll hear back by email." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address so we can reply." });
  }
  if (message.length < MIN_MESSAGE) {
    return res.status(400).json({ error: "Write a little more so we know what you're asking." });
  }
  if (message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: `Keep the message under ${MAX_MESSAGE} characters.` });
  }
  if (tooMany(clientIp(req))) {
    return res.status(429).json({ error: "That's a lot of messages at once. Wait a few minutes and try again." });
  }

  try {
    const sent = await sendContactEmail({ name, email, topic: TOPICS[topic], message });
    if (!sent) {
      return res.status(503).json({ error: "The contact form isn't switched on yet." });
    }
  } catch (err) {
    console.error("Failed to send contact email:", err);
    return res.status(502).json({ error: "The message didn't send." });
  }

  return res.status(200).json({ ok: true, message: "Sent. Thanks, you'll hear back by email." });
};
