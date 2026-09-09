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

// What each interest opts you into. Keyed by channel slug so it does not
// break when the emoji on a channel changes.
const INTERESTS = [
  ['The streams',    '🔴', 'Live chat, clips, and questions for guests.',
    ['jacked-in', 'clips', 'ask-the-oracle']],
  ['The trivia',     '🧠', 'Daily odds questions and open trivia.',
    ['daily-odds', 'trivia', 'would-you-rather']],
  ['Arguing about it', '🔥', 'Hot takes and would-you-rather.',
    ['hot-takes', 'would-you-rather']],
  ['The numbers',    '🎲', 'The calculator itself, results and data.',
    ['run-your-odds', 'glitch-reports']],
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
          channel_ids: pick(['run-your-odds']),
        },
      ],
    },
    {
      id: '2',
      type: 0,
      title: 'What are you here for?',
      single_select: false,    // pick as many as apply
      required: false,
      in_onboarding: true,
      options: INTERESTS.map(([title, emoji, description, slugs]) => ({
        id: next(),
        title,
        description,
        emoji: { name: emoji },
        role_ids: [],
        channel_ids: pick(slugs),
      })),
    },
  ];

  // Everyone sees these on arrival regardless of what they answer -- the
  // gated tier-5 channel is deliberately absent.
  const defaults = pick([
    'the-construct', 'broadcast', 'choose-your-pill',
    'general', 'introductions', 'run-your-odds',
    'daily-odds', 'jacked-in', 'clips',
  ]);

  console.log('prompts:');
  for (const p of prompts) {
    console.log(`  ${p.title}${p.single_select ? '  (pick one)' : '  (pick any)'}`);
    for (const o of p.options) {
      const gives = o.role_ids.length ? 'role' : `${o.channel_ids.length} channels`;
      console.log(`    ${o.emoji.name}  ${o.title}  -> ${gives}`);
    }
  }
  console.log(`\ndefault channels: ${defaults.length}`);

  if (!APPLY) { console.log('\nplan only -- re-run with --apply.'); return; }

  await api('PUT', `/guilds/${GUILD}/onboarding`, {
    prompts,
    default_channel_ids: defaults,
    enabled: true,
    mode: 1,   // ADVANCED: answers count toward Discord's channel requirements
  });
  console.log('\nonboarding enabled.');
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
