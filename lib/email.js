// Thin wrapper around Resend's HTTP API (no SDK dependency -- Vercel's
// Node runtime has global fetch). Shared by the webhook (send-on-purchase)
// and the "resend my access link" endpoint so both paths send the exact
// same email.

const SITE_URL = "https://outofpocket.tv";

function accessLinkEmailHtml(sessionId) {
  const link = `${SITE_URL}/?status=success&session_id=${encodeURIComponent(sessionId)}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#111;">Your Global Dream Partner Report</h2>
      <p>Thanks for your purchase! Use the link below any time to reopen your report — no account or password needed.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background:#111;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Open My Report</a>
      </p>
      <p style="color:#666;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:<br>${link}</p>
    </div>
  `;
}

// Best-effort: access is already granted in the database before this is
// ever called, so a failure here should never block or undo a purchase --
// callers are expected to catch and log, not surface this to the buyer.
async function sendAccessLinkEmail(toEmail, sessionId) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !toEmail) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: toEmail,
      subject: "Your Global Dream Partner Report is ready",
      html: accessLinkEmailHtml(sessionId),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
}

module.exports = { sendAccessLinkEmail };
