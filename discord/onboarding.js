#!/usr/bin/env node
// Sets up Discord's native onboarding: the questions a new member answers on
// the way in, which hand out the tier roles.
//
// This is deliberately not a reaction-role bot. A reaction-role setup needs a
// process running somewhere forever to watch for reactions -- the moment it
// stops, roles silently stop working. Onboarding is stored on Discord's side
// and keeps working with nothing of ours running at all.
//
// It also solves changing your mind: members can reopen these questions any
// time from "Channels & Roles" at the top of the channel list, so re-running
// the quiz and moving tier needs no moderator and no bot.
//
//   node discord/onboarding.js          # show the prompts
//   node discord/onboarding.js --apply

const GUILD = process.env.DISCORD_GUILD_ID || '1396936449730810010';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLY = process.argv.includes('--apply');
const API = 'https://discord.com/api/v10';

// Rarest first, matching how the roles are ordered in the server.
const TIERS = [
  ['Lost in the Matrix', '💊', '2.5% and under. Unlocks a hidden channel.'],
  ['On the Moon',        '🚀', '2.5 - 10%. Rare.'],
  ['Across the Country', '✈️', '10 - 30%. Specific.'],
  ['Next Town Over',     '🚗', '30 - 60%. Common, but not the default.'],
  ['Local Neighborhood', '🏠', '60% and up. Most people match you.'],
];

// Interests grant a pingable role and NOTHING else. They deliberately do not
// gate channels: everybody can read every public channel from the moment they
// arrive, whatever they answer here.
//
// The earlier version listed channel_ids on these options. It happened to
// hide nothing -- those channels carry no @everyone deny, so the opt-in had
// no effect -- but it was still wrong twice over. It told new members they
// were choosing their access, and editing the prompt through Discord's own UI
// would have offered to make those channels opt-in for real, quietly walling
// off most of the server from anyone who skipped a question.
//
// Someone who joins for the quiz should trip over the stream later. That does
// not happen if the stream channels were never in their sidebar.
const INTERESTS = [
  ['Stream alerts', '🔴', 'Get pinged when a stream starts.'],
  ['Trivia',        '🧠', 'Get pinged for trivia nights.'],
  ['Debate',        '🔥', 'Get pinged when a good argument kicks off.'],
];

if (!TOKEN) { console.error('DISCORD_BOT_TOKEN is not set.'); process.exit(1); }

async function api(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const slug = n => n.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();

async function main() {
  const roles = await api('GET', `/guilds/${GUILD}/roles`);
  const chans = await api('GET', `/guilds/${GUILD}/channels`);

  const roleId = name => {
    const r = roles.find(x => x.name === name);
    if (!r) throw new Error(`no role "${name}" -- run build-server.js first`);
    return r.id;
  };
  const chanId = s => {
    const c = chans.find(x => slug(x.name) === s);
    return c ? c.id : null;
  };

  // Discord counts ids, not names: an option pointing at a channel that has
  // been renamed away is a 400, so drop anything missing rather than send it.
  const pick = slugs => slugs.map(chanId).filter(Boolean);

  // Interest roles are created here rather than in build-server.js because
  // they exist only to serve these prompts. No colour and no hoist, so they
  // never override the tier colour a member earned; mentionable, because
  // being pingable is the entire reason they exist.
  const interest = {};
  for (const [title] of INTERESTS) {
    const existing = roles.find(x => x.name === title);
    if (existing) { interest[title] = existing.id; console.log(`role exists : ${title}`); continue; }
    if (!APPLY) { interest[title] = `dry-${title}`; console.log(`would create role: ${title}`); continue; }
    const made = await api('POST', `/guilds/${GUILD}/roles`, {
      name: title, mentionable: true, hoist: false, color: 0, permissions: '0',
    });
    interest[title] = made.id;
    console.log(`created role: ${title}`);
  }
  const interestRoleId = title => interest[title];

  let optionId = 100;
  const next = () => String(optionId++);

  const prompts = [
    {
      id: '1',
      type: 0,                 // MULTIPLE_CHOICE
      title: 'What did the calculator say?',
      single_select: true,
      required: false,         // nobody is blocked from joining over a quiz
      in_onboarding: true,
      options: [
        ...TIERS.map(([name, emoji, description]) => ({
          id: next(),
          title: name,
          description,
          emoji: { name: emoji },
          role_ids: [roleId(name)],
          channel_ids: [],
        })),
        {
          id: next(),
          title: 'Not run it yet',
          description: 'Takes a minute. Come back and change this after.',
          emoji: { name: '❓' },
          role_ids: [],
          // Discord rejects an option that grants nothing at all
          // (ROLE_OR_CHANNEL_REQUIRED), so this one points at #run-your-odds
          // -- which is safe only because that channel is in the default list
          // below. A default channel cannot be hidden by an option, so this
          // highlights the channel without gating it.
          channel_ids: pick(['run-your-odds']),
        },
      ],
    },
    {
      id: '2',
      type: 0,
      title: 'Want a ping for any of these?',
      single_select: false,    // pick as many as apply
      required: false,
      in_onboarding: true,
      options: INTERESTS.map(([title, emoji, description]) => ({
        id: next(),
        title,
        description,
        emoji: { name: emoji },
        role_ids: [interestRoleId(title)],
        channel_ids: [],       // never gate a channel behind this
      })),
    },
  ];

  // Every public channel, listed explicitly. The tier-5 channel is the only
  // omission, and it is omitted because its own permissions hide it.
  //
  // Listing all of them is not redundant even though they are already public:
  // it is what makes "everyone sees everything" the recorded intent rather
  // than an accident, so a later edit in Discord's UI has to argue with it.
  const defaults = chans
    .filter(c => c.type !== 4 && slug(c.name) !== 'lost-in-the-matrix')
    .map(c => c.id);

  console.log('prompts:');
  for (const p of prompts) {
    console.log(`  ${p.title}${p.single_select ? '  (pick one)' : '  (pick any)'}`);
    for (const o of p.options) {
      const gives = o.role_ids.length ? 'role' : (o.channel_ids.length ? `${o.channel_ids.length} channels` : 'nothing');
      console.log(`    ${o.emoji.name}  ${o.title}  -> ${gives}`);
    }
  }
  console.log(`\ndefault channels: ${defaults.length}`);

  if (!APPLY) { console.log('\nplan only -- re-run with --apply.'); return; }

  await api('PUT', `/guilds/${GUILD}/onboarding`, {
    prompts,
    default_channel_ids: defaults,
    enabled: true,
    // DEFAULT mode: the default channel list alone has to satisfy Discord's
    // requirements, which it does -- and it means the questions are not load
    // bearing for access. They hand out pings, nothing more.
    mode: 0,
  });
  console.log('\nonboarding enabled.');
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
