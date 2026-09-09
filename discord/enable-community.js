#!/usr/bin/env node
// Turns on Community for the guild.
//
// Stage and Forum channels (#hot-takes, The Oracle) simply do not exist
// outside a Community server -- creating one returns 50024 -- so this has to
// run before build-server.js can finish the tree.
//
// Discord will not flip the flag unless the server also meets the bar it sets
// for community servers, so the four settings below are not decoration:
// they are the preconditions, and the PATCH fails without them.
//
//   node discord/enable-community.js          # show what would change
//   node discord/enable-community.js --apply

const GUILD = process.env.DISCORD_GUILD_ID || '1396936449730810010';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLY = process.argv.includes('--apply');
const API = 'https://discord.com/api/v10';

// Rules goes to the channel that already explains the place. Community
// updates is where Discord itself writes to the server owner -- it wants a
// text channel, and #broadcast is the one Tom will actually look at.
const RULES = 'the-construct';
const UPDATES = 'broadcast';

if (!TOKEN) { console.error('DISCORD_BOT_TOKEN is not set.'); process.exit(1); }

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const guild = await api('GET', `/guilds/${GUILD}`);
  if (guild.features.includes('COMMUNITY')) {
    console.log(`${guild.name}: Community already on, nothing to do.`);
    return;
  }

  const channels = await api('GET', `/guilds/${GUILD}/channels`);
  const byName = n => {
    const c = channels.find(x => x.name === n && x.type === 0);
    if (!c) throw new Error(`no text channel named "${n}" -- run build-server.js first`);
    return c.id;
  };

  const patch = {
    features: [...guild.features, 'COMMUNITY'],
    rules_channel_id: byName(RULES),
    public_updates_channel_id: byName(UPDATES),
    // Community minimums, all three are enforced by Discord:
    verification_level: 1,           // LOW -- verified email required
    explicit_content_filter: 2,      // scan every member's attachments
    default_message_notifications: 1, // mentions only, or a busy server spams
  };

  console.log(`${guild.name}`);
  console.log(`  rules channel   -> #${RULES}`);
  console.log(`  updates channel -> #${UPDATES}`);
  console.log('  verification    -> Low (verified email)');
  console.log('  content filter  -> scan all members');
  console.log('  notifications   -> mentions only');

  if (!APPLY) { console.log('\nplan only -- re-run with --apply.'); return; }

  await api('PATCH', `/guilds/${GUILD}`, patch);
  console.log('\nCommunity enabled. Stage and Forum channels can be created now.');
}

main().catch(e => { console.error('\nfailed:', e.message); process.exit(1); });
