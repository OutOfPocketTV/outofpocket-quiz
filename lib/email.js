// Thin wrapper around Resend's HTTP API (no SDK dependency -- Vercel's
// Node runtime has global fetch). Shared by the webhook (send-on-purchase)
// and the "resend my access link" endpoint so both paths send the exact
// same email.

const SITE_URL = "https://outofpocket.tv";

// Inline-styled, table-based layout (not CSS gradients/flexbox) so this
// renders consistently across Gmail, Apple Mail, and Outlook alike --
// matches the site's dark card look without relying on styles that
// older email clients silently drop.
function accessLinkEmailHtml(sessionId) {
  const link = `${SITE_URL}/?status=success&session_id=${encodeURIComponent(sessionId)}`;
  return `
    <div style="background:#060606; padding:32px 16px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; border-collapse:collapse;">
        <tr>
          <td style="text-align:center; padding-bottom:24px;">
            <img src="${SITE_URL}/logo-mark.png" width="48" height="48" alt="Out Of Pocket TV" style="display:inline-block; border-radius:8px;" />
            <div style="color:#f3f3f3; font-weight:900; letter-spacing:0.5px; font-size:18px; margin-top:10px; font-family: Arial Black, Arial, sans-serif;">OUT OF POCKET TV</div>
          </td>
        </tr>
        <tr>
          <td style="background:#1d1d1d; border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:32px 28px; text-align:center;">
            <h1 style="color:#f3f3f3; font-size:20px; font-weight:700; margin:0 0 12px;">Your Global Dream Partner Report</h1>
            <p style="color:#969696; font-size:15px; line-height:1.5; margin:0 0 24px;">Thanks for your purchase! Use the button below any time to reopen your report — no account or password needed.</p>
            <a href="${link}" style="display:inline-block; background:#ffffff; color:#0a0a0a; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:15px;">Open My Report</a>
            <p style="color:#6b6b6b; font-size:12px; line-height:1.5; margin:28px 0 0;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${link}" style="color:#969696; word-break:break-all;">${link}</a></p>
          </td>
        </tr>
        <tr>
          <td style="text-align:center; padding-top:20px; color:#6b6b6b; font-size:12px;">outofpocket.tv</td>
        </tr>
      </table>
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
