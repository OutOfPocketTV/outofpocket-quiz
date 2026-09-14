// Everything Tom might want to change about the bot, in one place.

module.exports = {
  // Replies to NEW questions. One is picked per comment, fixed by the
  // comment's id, so the channel is not posting the identical sentence over
  // and over -- YouTube's spam filter looks for exactly that. Keep "www." on
  // the front: YouTube turns it into a tappable link.
  //
  // Rules for adding one:
  // - Never say "free": Find Out is behind the paywall.
  // - Never say "that's the app in the video". Older videos show a different
  //   site (igotstandardsbro), and new questions still land on those.
  replies: [
    'Take the quiz at www.outofpocket.tv 👀',
    'www.outofpocket.tv — see your own odds',
    "It's my own site: www.outofpocket.tv",
    'www.outofpocket.tv 🔥 put your own standards through it',
    'Try it yourself at www.outofpocket.tv',
    'Here you go: www.outofpocket.tv',
  ],

  // How far back the new-comment check looks. The workflow runs every 15
  // minutes, but GitHub sometimes starts scheduled jobs late, so a 3-hour
  // window means a delayed or skipped run is caught by the next one. Old
  // comments are the backfill's job, below, not this.
  lookbackHours: 3,

  // Safety caps for new comments. A reply costs 50 of the 10,000 daily
  // YouTube API units.
  maxRepliesPerRun: 25,
  maxPagesPerRun: 20, // 100 comments a page; 1 unit each
  secondsBetweenReplies: 2,

  // Answering the questions already sitting under old videos.
  //
  // It works in two stages, one small step every run:
  //   1. Scan: read every comment on every video, most-commented video
  //      first, and write down each unanswered "what app is this".
  //   2. Drip: answer that list slowly, oldest-found first.
  //
  // The drip is the anti-spam part. One reply per run means one every ~15
  // minutes around the clock, about 90 a day, never a burst. Raising
  // repliesPerRun speeds it up and makes it look more like a bot.
  backfill: {
    enabled: true,
    repliesPerRun: 1,
    repliesPerDay: 100,
    // Only if a run posts more than one reply (a new question and an old
    // one): a random pause of this many seconds between them.
    gapSeconds: [30, 90],
    // 2,500 comments read per run while scanning.
    pagesPerRun: 25,
    // The backfill stops for the day once this many API units are spent,
    // so the remaining ~3,000 are always there for NEW questions.
    dailyUnitBudget: 7000,

    // Worded as a late answer, because it is one -- some of these questions
    // are months old.
    replies: [
      'Late reply, but I made my own version: www.outofpocket.tv 👀',
      'For anyone still wondering, I built my own: www.outofpocket.tv',
      'Sorry for the late reply! My own site is www.outofpocket.tv',
      'Late to this, but you can take the quiz at www.outofpocket.tv',
      'Still wondering? www.outofpocket.tv — see your own odds',
      'Late answer: www.outofpocket.tv 🔥',
    ],
  },
};
