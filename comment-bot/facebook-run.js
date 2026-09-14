// Replies www.outofpocket.tv to "what app is this?" comments on the
// Outofpockettv Facebook Page. The run itself is shared with Instagram
// (graph-run.js); this file is the Facebook login and wiring.
//
// The login is a Page token that does not expire, so there is no renewal
// here -- only a clear message if it stops working.

const config = require('./config');
const fb = require('./facebook');
const { createPlatform } = require('./graph-run');

const facebook = createPlatform({
  label: 'Facebook',
  stateName: 'facebook.json',
  envVar: 'FACEBOOK_PAGE_TOKEN',
  cfg: config.facebook,
  api: fb,
  login: async (state, secret) => ({ token: secret, me: await fb.getPage(secret) }),
  who: (page) => page.name,
  reconnect: 'Facebook Page login has expired or was revoked (a Facebook password change does this). ' +
    'Reconnect: make a new Page token for Outofpockettv and replace the FACEBOOK_PAGE_TOKEN GitHub secret.',
});

module.exports = { runFacebook: facebook.run };
