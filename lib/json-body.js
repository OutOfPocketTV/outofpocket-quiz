// Vercel parses JSON bodies for most routes, but not when the body arrives
// as text, and the hosted fallback has historically posted nothing at all.
// Shared by both checkout routes so they read a body the same way.
function readJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (err) { body = null; }
  }
  return body && typeof body === "object" ? body : {};
}

module.exports = { readJsonBody };
