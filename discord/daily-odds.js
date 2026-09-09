#!/usr/bin/env node
// #daily-odds: one dating-odds question a day, as a native Discord poll.
//
// Every question is computed from the same engine outofpocket.tv runs, so
// there is no answer key to maintain and no way for a question to disagree
// with the site. Change the data, the questions change with it.
//
//   node discord/daily-odds.js --list 7     # preview the next week
//   node discord/daily-odds.js --post       # post today's poll
//   node discord/daily-odds.js --reveal     # post the answer to the last one
//
// Posting is idempotent per day: a second --post on the same date does
// nothing, so this is safe to hang off a scheduler that might fire twice.

const fs = require('fs');
const path = require('path');
const { QuizGlobalStats, oddsFor, baseFilters } = require('./engine.js');

const GUILD = process.env.DISCORD_GUILD_ID || '1396936449730810010';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const API = 'https://discord.com/api/v10';
const CHANNEL_SLUG = 'daily-odds';
const STATE = path.join(__dirname, 'daily-odds-state.json');
const QUIZ_URL = 'https://outofpocket.tv';

// ---------------------------------------------------------------- questions

// Countries people can picture without being told where they are. Questions
// stay recognisable: "women in Japan" lands, "women in Kiribati" does not,
// even though the engine has both.
const PLACES = [
  ['US', 'the U.S.'], ['GB', 'the UK'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['DE', 'Germany'], ['FR', 'France'], ['JP', 'Japan'], ['BR', 'Brazil'],
  ['MX', 'Mexico'], ['IN', 'India'], ['NG', 'Nigeria'], ['IT', 'Italy'],
  ['ES', 'Spain'], ['KR', 'South Korea'], ['PL', 'Poland'], ['NL', 'the Netherlands'],
];

// Height thresholds are per sex, and not only for realism. A shared ladder
// pushed every women's height question under the 0.1% floor -- 6'0" women
// are rare enough to be rejected and redrawn -- so the redraw quietly turned
// #daily-odds into a men-only channel: 11 of every 14 questions.
const HEIGHTS = {
  men:   [70, 72, 74],  // 5'10", 6'0", 6'2"
  women: [64, 66, 68],  // 5'4",  5'6",  5'8"
};
// Income ladders are per sex for the same reason as height: a shared one
// leaves the top rungs below the floor for women, they get redrawn, and the
// channel drifts male again. These are set so both ladders land inside the
// usable band across the countries in PLACES.
const INCOMES = {
  men:   [50000, 75000, 100000, 150000],
  women: [40000, 60000, 80000, 120000],
};

const inches = n => `${Math.floor(n / 12)}'${n % 12}"`;
const money = n => '$' + (n >= 1000 ? (n / 1000) + 'k' : n);
const sexWord = s => (s === 'men' ? 'men' : 'women');

// Each builder returns { text, filters } -- never an answer. The answer is
// whatever the engine says when the question is asked, which is the point.
const BUILDERS = [
  function height(place, sex, rng) {
    const ladder = HEIGHTS[sex];
    const h = ladder[rng(ladder.length)];
    const f = baseFilters(sex);
    f.minHeight = h;
    return { text: `What share of ${sexWord(sex)} in ${place[1]} are ${inches(h)} or taller?`, filters: f };
  },

  function income(place, sex, rng) {
    const rungs = INCOMES[sex];
    const amount = rungs[rng(rungs.length)];
    const f = baseFilters(sex);
    f.minIncome = amount;
    return { text: `What share of ${sexWord(sex)} in ${place[1]} earn ${money(amount)} a year or more?`, filters: f };
  },

  function combo(place, sex, rng) {
    const ladder = HEIGHTS[sex];
    const h = ladder[rng(ladder.length)];
    const rungs = INCOMES[sex];
    const amount = rungs[rng(rungs.length)];
    const f = baseFilters(sex);
    f.minHeight = h;
    f.minIncome = amount;
    return {
      text: `What share of ${sexWord(sex)} in ${place[1]} are ${inches(h)}+ AND earn ${money(amount)}+?`,
      filters: f,
    };
  },

  function single(place, sex) {
    const f = baseFilters(sex);
    f.excludeMarried = true;
    f.excludeKids = true;
    return {
      text: `What share of adult ${sexWord(sex)} in ${place[1]} are unmarried with no kids?`,
      filters: f,
    };
  },

  function age(place, sex, rng) {
    const lo = [25, 30, 35][rng(3)];
    const f = baseFilters(sex);
    f.ageLo = lo; f.ageHi = lo + 9;
    f.excludeMarried = true;
    return {
      text: `What share of ${sexWord(sex)} in ${place[1]} aged ${lo}-${lo + 9} are unmarried?`,
      filters: f,
    };
  },
];

// A small deterministic PRNG so a given date always yields the same question
// on any machine. Math.random() would make --list a lie: the preview would
// not match what --post actually sends the next morning.
function seeded(seedText) {
  let h = 2166136261;
  for (const ch of seedText) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return max => {
    // xorshift alone leaves the low bits poorly mixed, and every draw here
    // is a small modulo -- which is exactly the low bits. Without the
    // avalanche step the same builder kept coming up days in a row.
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;  h >>>= 0;
    let x = Math.imul(h ^ (h >>> 15), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    return ((x ^ (x >>> 16)) >>> 0) % max;
  };
}

// Outside this band a question stops working as a poll. Below 0.1% every
// option rounds to a smear of zeroes nobody can choose between; above 70%
// there is no room left above the answer for a believable distractor.
const FLOOR = 0.1, CEILING = 70;

function questionFor(dateKey) {
  // The question *type* rotates by day rather than being drawn, because
  // uniform randomness still clumps: a fair 1-in-5 draw put the same builder
  // up six times in twelve days. Rotation guarantees the variety a reader
  // actually notices. Only the parameters are random.
  const dayIndex = Math.floor(Date.parse(dateKey + 'T00:00:00Z') / 86400000);
  const build = BUILDERS[((dayIndex % BUILDERS.length) + BUILDERS.length) % BUILDERS.length];

  // Some parameter combinations land outside the usable band -- 6'2" women
  // in Australia is 0.02%, four options of near-zero. Re-draw with a salted
  // seed until one fits, and fall back to the last attempt rather than
  // looping forever if a builder simply cannot land in range today.
  let last;
  for (let attempt = 0; attempt < 24; attempt++) {
    const rng = seeded(dateKey + (attempt ? `#${attempt}` : ''));
    const place = PLACES[rng(PLACES.length)];
    const sex = rng(2) ? 'men' : 'women';
    const q = build(place, sex, rng);
    const result = oddsFor(place[0], q.filters);
    last = { ...q, pct: result.pct, matchingCount: result.matchingCount, country: result.country };
    if (last.pct >= FLOOR && last.pct <= CEILING) return last;
  }
  return last;
}

// Round the way a person would say it, so the true option does not stand out
// by being the only one with two decimal places.
function say(pct) {
  if (pct >= 10) return Math.round(pct) + '%';
  if (pct >= 1) return pct.toFixed(1) + '%';
  return pct.toFixed(2) + '%';
}

// Distractors sit at fixed ratios either side of the truth, so the gap
// between right and wrong is never a rounding argument. Ratios are wide
// enough (>=2.2x) that "closest" is unambiguous even after rounding.
function options(pct) {
  // Above roughly a third, a 2.4x distractor would have to sit near 99% --
  // which nobody believes, so it stops being a distractor and starts being
  // a hint. Big answers get a tighter ladder that still clears the rounding.
  const ratios = pct > 33 ? [0.3, 0.55, 1, 1.25] : [0.18, 0.45, 1, 2.4];
  const candidates = ratios.map(r => Math.min(pct * r, 95));

  // Rounding can collapse two neighbours into the same label. Push the lower
  // one further down until they read apart, rather than posting a poll with
  // the same answer twice.
  for (let i = 1; i < candidates.length; i++) {
    let guard = 0;
    while (say(candidates[i]) === say(candidates[i - 1]) && guard++ < 12) {
      candidates[i - 1] *= 0.6;
    }
  }

  const truth = say(pct);
  // Sort on the number, not the label: "7.2%" sorts before "18%" as a string
  // and the poll came out in nonsense order.
  const list = candidates.slice().sort((a, b) => a - b).map(say);
  return { list, truth };
}

// ---------------------------------------------------------------- discord

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

async function channelId() {
  const chans = await api('GET', `/guilds/${GUILD}/channels`);
  // Type 0 only: slug() strips "// " off category names, so a category
  // sharing a channel's name would otherwise match first.
  const ch = chans.find(c => slug(c.name) === CHANNEL_SLUG && c.type === 0);
  if (!ch) throw new Error(`no #${CHANNEL_SLUG} channel -- run build-server.js first`);
  return ch.id;
}

const readState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {});
const writeState = s => fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n');

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- commands

async function post() {
  const state = readState();
  const date = today();
  if (state.date === date) {
    console.log(`already posted for ${date} (message ${state.messageId}) -- nothing to do`);
    return;
  }

  const q = questionFor(date);
  const { list, truth } = options(q.pct);

  const msg = await api('POST', `/channels/${await channelId()}/messages`, {
    poll: {
      question: { text: q.text },
      answers: list.map(text => ({ poll_media: { text } })),
      duration: 24,
      allow_multiselect: false,
    },
  });

  writeState({ date, messageId: msg.id, question: q.text, truth, pct: q.pct,
               matchingCount: q.matchingCount, revealed: false });
  console.log(`posted ${date}: ${q.text}`);
  console.log(`  options: ${list.join('  ')}`);
  console.log(`  answer:  ${truth}`);
}

async function reveal() {
  const state = readState();
  if (!state.date) { console.log('nothing has been posted yet'); return; }
  if (state.revealed) { console.log(`${state.date} already revealed`); return; }

  const people = state.matchingCount.toLocaleString('en-US');
  await api('POST', `/channels/${await channelId()}/messages`, {
    content:
      `**Answer: ${state.truth}**\n` +
      `> ${state.question}\n` +
      `That is about **${people}** people.\n\n` +
      `Run your own numbers: ${QUIZ_URL}`,
    message_reference: { message_id: state.messageId, fail_if_not_exists: false },
  });

  writeState({ ...state, revealed: true });
  console.log(`revealed ${state.date}: ${state.truth}`);
}

function list(n) {
  const start = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    const q = questionFor(d);
    const { list: opts, truth } = options(q.pct);
    console.log(`${d}  ${q.text}`);
    console.log(`            ${opts.map(o => (o === truth ? `[${o}]` : ` ${o} `)).join(' ')}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    const n = parseInt(args[args.indexOf('--list') + 1], 10) || 7;
    return list(n);
  }
  if (!TOKEN) { console.error('DISCORD_BOT_TOKEN is not set.'); process.exit(1); }
  if (args.includes('--post')) return post();
  if (args.includes('--reveal')) return reveal();
  console.log('usage: --list [n] | --post | --reveal');
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
