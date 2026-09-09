#!/usr/bin/env node
// Writes the opening post into each channel that needs one, and pins it.
//
// A new server is not empty because it lacks channels, it is empty because
// nobody has said anything. Every channel here gets one message explaining
// what it is for, so the first real member lands somewhere that reads as
// intentional rather than unfinished.
//
//   node discord/seed-content.js          # show what would be posted
//   node discord/seed-content.js --apply
//
// Idempotent: a channel that already holds a pinned message from the bot is
// left alone, so this can be re-run after adding a new channel.

const { QuizGlobalStats, oddsFor, baseFilters } = require('./engine.js');

const GUILD = process.env.DISCORD_GUILD_ID || '1396936449730810010';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLY = process.argv.includes('--apply');
const API = 'https://discord.com/api/v10';
const SITE = 'https://outofpocket.tv';

// The tier ladder, worded for people rather than for the meter. Kept in the
// same order the quiz shows it: commonest first, rarest last.
const TIERS = [
  ['🏠', 'Local Neighborhood', '60% and up',    'Most people match you.'],
  ['🚗', 'Next Town Over',     '30 - 60%',      'Common, but not the default.'],
  ['✈️', 'Across the Country', '10 - 30%',      'You are asking for something specific.'],
  ['🚀', 'On the Moon',        '2.5 - 10%',     'Rare. You will be looking a while.'],
  ['💊', 'Lost in the Matrix', '2.5% and under','Statistically, you are describing almost nobody.'],
];

const tierTable = TIERS
  .map(([emoji, name, band, note]) => `${emoji}  **${name}** — ${band}\n> ${note}`)
  .join('\n');

const CONTENT = {
  'the-construct': [
    '# Welcome to Out Of Pocket',
    '',
    'This server runs on one idea: **everybody thinks their standards are reasonable, and the numbers usually disagree.**',
    `The calculator at ${SITE} takes what you are looking for — height, income, age, whether they are single — and tells you what share of real people actually match.`,
    '',
    '## How this place works',
    '',
    'Run the quiz, get a tier, wear it. Your tier is a role here, in the same colour the site gives it:',
    '',
    tierTable,
    '',
    'Hit the rarest tier and a channel opens that nobody else can see. There is no other way in — you cannot be given it, you have to earn it.',
    '',
    '## Rules',
    '',
    '**1. Argue with the number, not the person.** Telling someone their standards are unrealistic is the entire point of this server. Telling someone *they* are worthless is not.',
    '**2. No harassment, slurs, or sexual content.** Instant removal, no discussion.',
    '**3. Keep it to the channel it belongs in.** Odds in the odds channel, takes in the takes channel.',
    '**4. No self-promo or DM advertising** without asking first.',
    '**5. Screenshots of real people are not content.** Do not post someone to be judged. Ever.',
    '',
    '## Getting started',
    '',
    '→ Pick your tier in **Channels & Roles**, top of the channel list',
    '→ Say hello in **introductions**',
    '→ Post your result in **run-your-odds**',
  ].join('\n'),

  'choose-your-pill': [
    '# Pick your tier',
    '',
    `Run the calculator at **${SITE}**, see what percentage comes back, then claim the matching role.`,
    '',
    '**To pick:** click **Channels & Roles** at the very top of the channel list, above the categories. Choose your tier. You can change it any time you run the quiz again.',
    '',
    tierTable,
    '',
    '💊 unlocks a hidden channel. The bar is 2.5% — roughly one person in forty.',
    '',
    '*Nobody checks. But the whole point of the server is the honest number, so a tier you did not earn is a strange thing to want.*',
  ].join('\n'),

  'introductions': [
    '# Say hello',
    '',
    'No format, but these usually get a reply:',
    '',
    '**Where you are** — country or city, since the odds move enormously by place',
    '**What brought you here** — the channel, the quiz, or someone sent you',
    '**Your tier** — and whether the number surprised you',
    '',
    'That last one is the real conversation starter. Most people are wrong about where they land, and wrong in the same direction.',
  ].join('\n'),

  'run-your-odds': [
    '# Post your result',
    '',
    `Run it at ${SITE}, screenshot the number, drop it here.`,
    '',
    `Worth saying **what you filtered on**, not just the percentage — "0.8%" means nothing on its own, but "0.8% because I wanted 6'2" and six figures" is a conversation.`,
    '',
    'Two things people always want to know, so get ahead of them:',
    '→ Which filter cost you the most (the site tells you)',
    '→ What the same filters give in a different country',
  ].join('\n'),

  'daily-odds': [
    '# One question a day',
    '',
    'A poll every morning, answered the next day. Every question is computed from the same data the calculator runs on, so there is no trivia bank and no wrong answers — the site *is* the answer key.',
    '',
    'Vote before you scroll. The point is finding out your instinct is off.',
  ].join('\n'),

  'jacked-in': [
    '# Live chat',
    '',
    'This is the room while the stream is running. Quiet the rest of the time.',
    '',
    'Questions for whoever is on are better in **ask-the-oracle** — they get seen there, they scroll away in here.',
  ].join('\n'),

  'ask-the-oracle': [
    '# Questions for guests',
    '',
    'Drop questions for upcoming guests here and they get asked on stream.',
    '',
    'Specific beats clever. "What is the lowest income you would date?" gets a real answer. "Thoughts on modern dating?" gets nothing.',
  ].join('\n'),

  'clips': [
    '# Best moments',
    '',
    'Clips, timestamps, or a link with a time in it. A line of context helps — "the part where he realises" travels further than a bare link.',
  ].join('\n'),

  'glitch-reports': [
    '# Something wrong?',
    '',
    'Broken page, number that looks wrong, or data that does not match your country — post it here.',
    '',
    'For a wrong number, include **what you filtered on** and **what it returned**. Without both it cannot be checked.',
  ].join('\n'),

  'would-you-rather': [
    '# Pick one, defend it',
    '',
    'Two options, no fence-sitting. Use the poll button (**+** next to the message box) so people can vote.',
    '',
    'The good ones are close. If everybody picks the same side, it was a bad question.',
  ].join('\n'),

  'lost-in-the-matrix': [
    '# 2.5% and under',
    '',
    'If you can read this, your standards match roughly one person in forty or fewer.',
    '',
    'Nobody outside this channel can see it. Post the filter set that got you here — the interesting part is never the percentage, it is which combination did it.',
  ].join('\n'),
};

if (!TOKEN) { console.error('DISCORD_BOT_TOKEN is not set.'); process.exit(1); }

async function api(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    const wait = ((await res.json()).retry_after ?? 1) * 1000;
    await new Promise(r => setTimeout(r, wait));
    return api(method, p, body);
  }
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const slug = n => n.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();

async function main() {
  const chans = await api('GET', `/guilds/${GUILD}/channels`);
  const me = await api('GET', '/users/@me');

  for (const [name, body] of Object.entries(CONTENT)) {
    const ch = chans.find(c => slug(c.name) === name);
    if (!ch) { console.log(`skip    #${name} (no such channel)`); continue; }

    // A pin from the bot means this channel has already been seeded. Checking
    // pins rather than recent messages means member chatter cannot push the
    // marker out of view and cause a duplicate post.
    const pins = await api('GET', `/channels/${ch.id}/pins`);
    const items = Array.isArray(pins) ? pins : (pins.items || []);
    if (items.some(m => (m.message || m).author.id === me.id)) {
      console.log(`exists  #${name}`);
      continue;
    }

    if (!APPLY) {
      console.log(`would post to #${name}  (${body.split('\n')[0]})`);
      continue;
    }

    const msg = await api('POST', `/channels/${ch.id}/messages`, { content: body });
    await api('PUT', `/channels/${ch.id}/pins/${msg.id}`);
    console.log(`posted  #${name}  and pinned`);
  }

  console.log(APPLY ? '\ndone.' : '\nplan only -- re-run with --apply.');
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
