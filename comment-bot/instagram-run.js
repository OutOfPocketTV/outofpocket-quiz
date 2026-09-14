// Replies www.outofpocket.tv to "what app is this?" comments on Instagram.
// The run itself is shared with Facebook (graph-run.js); this file is the
// Instagram login and wiring.
//
// THE LOGIN. Instagram tokens die after 60 days unless renewed, and renewing
// hands back a NEW token -- which cannot be written back into a GitHub
// secret. So the renewed one is kept in the memory file, encrypted with a key
// derived from the original INSTAGRAM_ACCESS_TOKEN secret. The cache of a
// public repo can be read by other people's pull-request workflows, but
// those never see secrets, so the encrypted copy is useless to them. And
// reconnecting with a fresh token changes the key, which quietly retires the
// old copy -- exactly what should happen.

const crypto = require('crypto');
const config = require('./config');
const ig = require('./instagram');
const { createPlatform, loadState, saveState, freshState, HOUR } = require('./graph-run');

const boxKey = (secret) => crypto.createHash('sha256').update('comment-bot/instagram/' + secret).digest();

function seal(token, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', boxKey(secret), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function open(box, secret) {
  if (!box) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', boxKey(secret), Buffer.from(box.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null; // sealed with a different secret: a reconnect happened
  }
}

// The newest working login, renewed at most once a day. A renewal refused
// because the token is under 24 hours old is normal right after connecting,
// so failures just retry in 6 hours.
async function login(state, secret, log, now = Date.now()) {
  let token = open(state.tokenBox, secret) || secret;
  let me;
  try {
    me = await ig.getMe(token);
  } catch (err) {
    if (!(err instanceof ig.TokenInvalid) || token === secret) throw err;
    state.tokenBox = null; // the renewed copy stopped working; fall back to the original
    token = secret;
    me = await ig.getMe(token);
  }

  if (now >= (state.nextRefreshAt || 0)) {
    try {
      const renewed = await ig.refreshToken(token);
      if (renewed.token) {
        token = renewed.token;
        state.tokenBox = seal(token, secret);
        state.lastRenewedAt = new Date(now).toISOString();
        state.nextRefreshAt = now + 20 * HOUR;
        log('Instagram: login renewed for another 60 days.');
      }
    } catch (err) {
      if (err instanceof ig.RateLimited) throw err;
      state.nextRefreshAt = now + 6 * HOUR;
      log(`Instagram: could not renew the login yet (${err.message}). Normal on the first day.`);
    }
  }
  return { token, me };
}

const instagram = createPlatform({
  label: 'Instagram',
  stateName: 'instagram.json',
  envVar: 'INSTAGRAM_ACCESS_TOKEN',
  cfg: config.instagram,
  api: ig,
  login,
  who: (me) => `@${me.username}`,
  reconnect: 'Instagram login has expired or was revoked. Reconnect: Meta app "Out Of Pocket comment bot" -> ' +
    'Instagram API -> API setup with Instagram login -> Generate access tokens, then replace the ' +
    'INSTAGRAM_ACCESS_TOKEN GitHub secret.',
});

module.exports = { runInstagram: instagram.run, loadState, saveState, freshState, seal, open };
