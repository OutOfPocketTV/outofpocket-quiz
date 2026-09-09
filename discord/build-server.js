#!/usr/bin/env node
// Builds the Out Of Pocket Discord: the five rarity roles, the category tree,
// and the tier-5 gate on #lost-in-the-matrix.
//
// Additive only -- it creates what is missing and leaves everything else
// alone. The server predates this script (July 2025), so nothing here
// renames, reorders or deletes what is already in there.
//
//   node discord/build-server.js            # plan only, touches nothing
//   node discord/build-server.js --apply    # actually create
//
// Needs DISCORD_BOT_TOKEN in the environment. Guild id is baked in below
// because there is only ever one.

const GUILD = process.env.DISCORD_GUILD_ID || '1396936449730810010';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLY = process.argv.includes('--apply');
const API = 'https://discord.com/api/v10';

// Channel type ids, from the Discord docs. Named so the tree below reads.
const TEXT = 0, VOICE = 2, CATEGORY = 4, STAGE = 13, FORUM = 15;

const VIEW_CHANNEL = 1 << 10; // permission bit used for the tier-5 gate

// The rarity ladder, lifted from RARITY_LEVELS in quiz-core.js so the role
// colours are the same greens and golds the meter already draws. Ordered
// rarest first: Discord lists roles top-down, and the colour a member shows
// is their highest one, so Matrix has to sit above Local Neighborhood.
const ROLES = [
  { name: 'Lost in the Matrix',  color: '00ff6a', band: '2.5% and under' },
  { name: 'On the Moon',         color: 'ffb443', band: '2.5% - 10%' },
  { name: 'Across the Country',  color: 'b98cff', band: '10% - 30%' },
  { name: 'Next Town Over',      color: '6bc8ff', band: '30% - 60%' },
  { name: 'Local Neighborhood',  color: '7fe3a3', band: '60% and up' },
];

const MATRIX_ROLE = 'Lost in the Matrix';

// Channel names carry a leading emoji and a katakana middle dot, the
// convention every large server uses -- the icon is part of the name, Discord
// has no separate field for it. Everything is matched on `slug()` below
// rather than the full string, so the decoration can change without the
// script losing track of a channel and creating a second one.
//
// `gated` marks the channel only tier 5 can see.
const TREE = [
  // Zion leads so the voice rooms sit near the top of the rail rather than
  // buried under four categories of text. Discord always draws a category's
  // text channels above its voice ones, so the three text channels here are
  // the floor the voice rooms stand on -- that is as high as they go without
  // a voice-only category.
  ['// ZION', [
    { name: '💬・general',            type: TEXT,  topic: 'Everything else.' },
    { name: '👋・introductions',      type: TEXT,  topic: 'Say hello.' },
    { name: '🔥・hot-takes',          type: FORUM, topic: 'One thread per take. Argue properly.' },
    { name: '🔊 General',             type: VOICE },
    { name: '🥋 The Construct',       type: VOICE },
    { name: '🎮 Game Night',          type: VOICE },
    { name: '🍿 Watch Party',         type: VOICE },
  ]],
  // The stream is the reason the server exists, so Live sits directly under
  // Zion -- above the quiz and the trivia, both of which are things people
  // go and do elsewhere and come back to talk about.
  ['// LIVE', [
    { name: '🔌・jacked-in',          type: TEXT,  topic: 'Chat while the stream is running.' },
    { name: '🎬・clips',              type: TEXT,  topic: 'Best moments. Post timestamps or clips.' },
    { name: '🔮・ask-the-oracle',     type: TEXT,  topic: 'Questions for upcoming guests.' },
    { name: '🎙️ The Oracle',          type: STAGE, topic: 'Live Q&A and AMAs.' },
  ]],
  ['// SYSTEM', [
    { name: '🚪・the-construct',      type: TEXT,  topic: 'Rules, and how this place works. Start here.' },
    { name: '📡・broadcast',          type: TEXT,  topic: 'New videos and go-live alerts.' },
    { name: '💊・choose-your-pill',   type: TEXT,  topic: 'Grab your rarity tier and your ping roles.' },
  ]],
  ['// THE SIMULATION', [
    { name: '🎲・run-your-odds',      type: TEXT,  topic: 'Post your result from outofpocket.tv. Screenshots welcome.' },
    { name: '🕶️・lost-in-the-matrix', type: TEXT,  topic: 'The 2.5% club.', gated: true },
    { name: '🐛・glitch-reports',     type: TEXT,  topic: 'Something broken or wrong? In here.' },
  ]],
  ['// TRIVIA', [
    { name: '📊・daily-odds',         type: TEXT,  topic: 'One question a day, straight from the real numbers. Answer drops the next day.' },
    { name: '🧠・trivia',             type: TEXT,  topic: 'Open trivia. Bot lives here.' },
    { name: '⚖️・would-you-rather',   type: TEXT,  topic: 'Pick one. Defend it.' },
  ]],
];

// A channel's identity is its name with the decoration stripped: leading
// emoji, the middle dot, and any spacing. Renaming 🚪・the-construct to
// 📜・the-construct has to read as the same channel, not a new one.
const slug = name => name
  .replace(/^[^\p{L}\p{N}]+/u, '')   // leading emoji + separator
  .trim()
  .toLowerCase();

if (!TOKEN) {
  console.error('DISCORD_BOT_TOKEN is not set in this shell.\n' +
                'Set it, then open a NEW terminal -- an existing one keeps the old environment.');
  process.exit(1);
}

// Discord hands back a retry_after on 429 rather than a Retry-After header,
// and channel creation is one of the tighter buckets. Sleep and repeat
// rather than dropping a channel out of the middle of the tree.
async function api(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bot ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      const wait = ((await res.json()).retry_after ?? 1) * 1000;
      console.log(`    rate limited, waiting ${Math.ceil(wait / 1000)}s`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${method} ${path} -> ${res.status} ${detail}`);
    }
    return res.status === 204 ? null : res.json();
  }
}

// A no-op in plan mode, so a dry run makes no writes at all.
async function write(label, method, path, body) {
  const verb = method === 'POST' ? 'create' : 'rename';
  if (!APPLY) { console.log(`  would ${verb}  ${label}`); return { id: `dry-${label}` }; }
  const made = await api(method, path, body);
  console.log(`  ${verb === 'create' ? 'created ' : 'renamed '}      ${label}`);
  return made;
}

async function main() {
  const me = await api('GET', '/users/@me');
  const guild = await api('GET', `/guilds/${GUILD}`);
  console.log(`bot   : ${me.username}`);
  console.log(`guild : ${guild.name}`);
  console.log(APPLY ? 'mode  : APPLY\n' : 'mode  : plan only, nothing will be written\n');

  // Existing state first. Everything below is keyed off these two lists so a
  // second run is a no-op rather than a pile of duplicates.
  const existingRoles = await api('GET', `/guilds/${GUILD}/roles`);
  const existingChans = await api('GET', `/guilds/${GUILD}/channels`);

  if (existingChans.length) {
    console.log(`server already holds ${existingChans.length} channel(s):`);
    for (const c of existingChans) console.log(`  - ${c.name}`);
    console.log('  (left untouched)\n');
  }

  console.log('roles');
  const roleId = {};
  for (const role of ROLES) {
    const has = existingRoles.find(r => r.name === role.name);
    if (has) { console.log(`  exists        ${role.name}`); roleId[role.name] = has.id; continue; }
    const made = await write(`${role.name}  #${role.color}  (${role.band})`,
      'POST', `/guilds/${GUILD}/roles`, {
        name: role.name,
        color: parseInt(role.color, 16),
        hoist: true,       // group holders separately in the member list
        mentionable: false,
      });
    roleId[role.name] = made.id;
  }

  console.log('\nchannels');
  const categoryIds = [];
  for (const [categoryName, children] of TREE) {
    let parent = existingChans.find(c => c.name === categoryName && c.type === CATEGORY);
    if (parent) console.log(`  exists        ${categoryName}`);
    else parent = await write(categoryName, 'POST', `/guilds/${GUILD}/channels`,
      { name: categoryName, type: CATEGORY });
    categoryIds.push(parent.id);

    for (const ch of children) {
      // Same slug and same type is the same channel, whatever it is called
      // now. Type matters because #general and the General voice channel
      // share a slug and must not collapse into one another.
      const already = existingChans.find(
        c => slug(c.name) === slug(ch.name) && c.type === ch.type);

      if (already) {
        if (already.name === ch.name) {
          console.log(`    exists      ${ch.name}`);
        } else {
          await write(`  ${already.name}  ->  ${ch.name}`,
            'PATCH', `/channels/${already.id}`, { name: ch.name });
        }
        continue;
      }
      const body = { name: ch.name, type: ch.type, parent_id: parent.id };
      // Voice and stage channels reject `topic`; forums and text accept it.
      if (ch.topic && ch.type !== VOICE && ch.type !== STAGE) body.topic = ch.topic;

      // The gate: hide from @everyone (whose role id is the guild id), then
      // hand view back to Matrix holders only. This is the whole point of the
      // ladder -- the quiz is the only way in.
      if (ch.gated) {
        body.permission_overwrites = [
          { id: GUILD, type: 0, deny: String(VIEW_CHANNEL) },
          { id: roleId[MATRIX_ROLE], type: 0, allow: String(VIEW_CHANNEL) },
        ];
      }
      await write(`  ${ch.name}${ch.gated ? '   [tier 5 only]' : ''}`,
        'POST', `/guilds/${GUILD}/channels`, body);
    }
  }

  // Categories otherwise sit in whatever order they happened to be created
  // in, which is not the order TREE reads in -- and deleting a category
  // renumbers everything after it. Restate the intended order every run.
  const current = await api('GET', `/guilds/${GUILD}/channels`);
  const wanted = categoryIds.map((id, position) => ({ id, position }));
  const wrong = wanted.filter(w => {
    const now = current.find(c => c.id === w.id);
    return now && now.position !== w.position;
  });

  if (!wrong.length) {
    console.log('\ncategory order already correct');
  } else if (!APPLY) {
    console.log(`\nwould reorder ${wrong.length} categor${wrong.length === 1 ? 'y' : 'ies'}`);
  } else {
    await api('PATCH', `/guilds/${GUILD}/channels`, wanted);
    console.log(`\nreordered categories: ${TREE.map(t => t[0]).join(' -> ')}`);
  }

  console.log(APPLY
    ? '\ndone.'
    : '\nplan only -- nothing was written. Re-run with --apply to build it.');
}

main().catch(err => { console.error('\nfailed:', err.message); process.exit(1); });
