// Small helpers shared by the YouTube and Instagram halves of the bot.

// Same comment always gets the same wording, but the account as a whole
// rotates through the list.
function pickReply(commentId, replies) {
  let h = 0;
  for (const ch of String(commentId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return replies[h % replies.length];
}

function snippet(text, max = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { pickReply, snippet, sleep };
