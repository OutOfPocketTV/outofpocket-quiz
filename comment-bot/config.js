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

  // YouTube's "every comment on the channel" listing runs minutes-to-hours
  // behind, so this many newest uploads are ALSO read directly each run.
  // ~11 units a run, ~1,000 a day.
  watchNewestVideos: 10,

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
    // so the remaining ~3,500 are always there for NEW questions (reading
    // alone costs ~1,250 a day since the newest videos are watched directly).
    dailyUnitBudget: 6500,

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

  // Instagram. Same rules for what counts as asking (match.js), its own
  // wording and pace.
  //
  // Links in Instagram comments are NOT tappable, so the replies spell the
  // address out plainly. Same bans as YouTube: never "free", never "the app
  // in the video".
  instagram: {
    replies: [
      "It's www.outofpocket.tv 👀",
      'Take the quiz at www.outofpocket.tv',
      'My own site: www.outofpocket.tv',
      'www.outofpocket.tv 🔥 see your own odds',
      'Type in www.outofpocket.tv and try it yourself',
    ],
    lookbackHours: 3,
    maxRepliesPerRun: 15,
    secondsBetweenReplies: 3,
    // Posts whose comment count went up since the last run get checked for
    // new questions; this caps how many in one run.
    maxPostsCheckedPerRun: 60,

    // The 15-minute run leaves a question alone until it is this old, because
    // the instant webhook answers within seconds and two bots answering the
    // same comment is how "What is this site called?" got the same reply
    // twice (2026-09-19): it was posted at 05:45:15, the webhook replied at
    // 05:45:19, and run #505 was mid-flight from 05:45:03 to 05:45:29 -- it
    // read the comment before Instagram showed the webhook's reply, and
    // answered it too. After 15 minutes the webhook's reply is long since
    // visible, so the run only ever acts as the safety net it is meant to be.
    // The lookback is 3 hours, so a question the webhook missed is still
    // picked up by one of the next runs. Facebook has no webhook and does not
    // wait.
    webhookGraceMinutes: 15,

    // "Comment QUIZ and I'll DM you the link." Anyone whose comment contains
    // a keyword ANYWHERE, as a whole word (see isKeywordComment in match.js),
    // gets ONE DM -- Instagram allows one per comment, within 7 days -- plus a
    // public reply so everyone else watching sees it works. Links in DMs ARE
    // tappable, unlike comments.
    //
    // "app" is a broad word: "this app is trash" gets the DM too. That was
    // Tom's choice. If Instagram ever limits the account's messaging, take
    // 'app' out of this list first.
    //
    // Sent ONLY by the site's instant webhook (lib/instagram-webhook.js), the
    // moment the comment lands, at most once per comment. The 15-minute run
    // never sends DMs -- when it did, one person got three (2026-09-14; see
    // answerKeyword in graph-run.js). Same bans as every reply: never "free".
    keywordDm: {
      enabled: true,
      keywords: ['quiz', 'app', 'website'],
      message: "Here's the quiz 👉 https://www.outofpocket.tv\n\nPut in your standards and see your odds.",
      publicReplies: [
        'Sent it to your DMs 📩',
        'Check your DMs 👀',
        'Just sent the link to your DMs 📩',
        'In your DMs now 📩',
      ],
    },

    // Instagram is quicker than YouTube to restrict accounts that post
    // repetitive comments, so the backlog drips out slower: at most one
    // per run and 60 a day.
    backfill: {
      enabled: true,
      repliesPerRun: 1,
      repliesPerDay: 60,
      gapSeconds: [30, 90],
      pagesPerRun: 20, // 50 comments a page
      replies: [
        'Late reply, but I made my own version: www.outofpocket.tv 👀',
        'For anyone still wondering: www.outofpocket.tv',
        'Sorry for the late reply! My own site is www.outofpocket.tv',
        'Late to this, but the quiz is at www.outofpocket.tv',
        'Late answer: www.outofpocket.tv 🔥',
      ],
    },
  },

  // Facebook Page (Outofpockettv). Same rules for what counts as asking.
  // Facebook DOES turn "www.outofpocket.tv" into a tappable link. Same bans:
  // never "free", never "the app in the video".
  facebook: {
    replies: [
      'Take the quiz at www.outofpocket.tv 👀',
      "It's my own site: www.outofpocket.tv",
      'www.outofpocket.tv 🔥 see your own odds',
      'Try it yourself at www.outofpocket.tv',
      'Here you go: www.outofpocket.tv',
    ],
    lookbackHours: 3,
    maxRepliesPerRun: 15,
    secondsBetweenReplies: 3,
    maxPostsCheckedPerRun: 60,
    backfill: {
      enabled: true,
      repliesPerRun: 1,
      repliesPerDay: 60,
      gapSeconds: [30, 90],
      pagesPerRun: 20, // 100 comments a page
      replies: [
        'Late reply, but I made my own version: www.outofpocket.tv 👀',
        'For anyone still wondering: www.outofpocket.tv',
        'Sorry for the late reply! My own site is www.outofpocket.tv',
        'Late answer: www.outofpocket.tv 🔥',
      ],
    },
  },
};
