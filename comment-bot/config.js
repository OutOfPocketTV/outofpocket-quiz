// Everything Tom might want to change about the bot, in one place.

module.exports = {
  // The replies. One is picked per comment, fixed by the comment's id, so
  // the channel is not posting the identical sentence hundreds of times --
  // YouTube's spam filter looks for exactly that. Keep "www." on the front:
  // YouTube turns it into a tappable link.
  //
  // Nothing here may say "free": Find Out is behind the paywall.
  replies: [
    "It's www.outofpocket.tv 👀 Take the quiz and see your odds",
    'www.outofpocket.tv — that’s the one from the video',
    "It's my own site: www.outofpocket.tv",
    'www.outofpocket.tv 🔥 put your own standards through it',
  ],

  // How far back each run looks. The workflow runs every 15 minutes, but
  // GitHub sometimes starts scheduled jobs late, so a 3-hour window means a
  // delayed or skipped run is caught by the next one. Comments already
  // answered are recognised and never answered twice. Kept short on purpose
  // so switching the bot on does not flood years of old comments.
  lookbackHours: 3,

  // Safety caps. A reply costs 50 of the 10,000 daily YouTube API units, so
  // 25 a run is plenty and still leaves room for the reads.
  maxRepliesPerRun: 25,
  maxPagesPerRun: 20, // 100 comments a page; 1 unit each

  // Pause between posts so a burst does not look like a spam wave.
  secondsBetweenReplies: 2,
};
