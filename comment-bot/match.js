// Decides whether a comment is somebody asking what the app / website in the
// video is.
//
// Rules, not AI, on purpose: it costs nothing, needs no key, and every
// decision can be explained by pointing at a line below. The table in
// test.js is the real spec -- when a comment fools it, add that comment to
// the table first, then change a pattern until the table passes again.
//
// A comment is a match when at least one ASK pattern hits and no SKIP
// pattern does. SKIP exists because the channel is about dating: "what app
// is she on" is a question about Hinge, not about the quiz, and answering it
// with the site reads as spam.

// Words people use for the thing in the video. "tool" and "page" are left
// out deliberately -- "what a tool" is an insult, not a question.
const THING = '(?:app|apps|application|website|websites|web ?site|site|webpage|quiz|test|calculator|calc|program|link)';

// The narrower set, for patterns loose enough that "did she pass the test?"
// or "the quiz?" would otherwise count as asking for the site.
const STRICT = '(?:app|apps|website|web ?site|site|link|calculator)';

const ASK = [
  // "what app is this", "what's the website called", "which site is that",
  // "what is the name of the app". Up to 30 characters may sit between the
  // question word and the noun.
  new RegExp(`\\b(?:what|which|wat|wht|wut|whats|what'?s|wats)\\b[^.!?\\n]{0,30}?\\b${THING}\\b`),

  // "app name?", "link pls", "quiz called?"
  new RegExp(`\\b${STRICT}\\s*(?:name|called|pls|plz|please)`),
  // "App?", "website??" -- only in a short comment. In a long one a question
  // mark after "app" is usually an argument: "Instagram is a dating app???
  // If that's what you think..."
  new RegExp(`^(?=(?:\\S+\\s*){1,6}$).*\\b${STRICT}\\s*\\?`),
  new RegExp(`\\b${THING} (?:name|called)\\b`),

  // "name of the app", "name of that website"
  new RegExp(`\\bname of (?:the|that|this|ur|your) ${THING}\\b`),

  // A comment that is nothing but the noun: "link", "App?", "the website 🙏"
  new RegExp(`^\\W*(?:the |ur |your )?${STRICT}\\W*$`),

  // "where can I take this quiz", "where do I find this", "where can u get it".
  // The object has to end the thought, so "where can I get that hoodie"
  // stays out.
  new RegExp(
    `\\bwhere (?:can|do|could|would|should) (?:i|we|you|u|ya|one) (?:take|do|find|get|try|use|download|play|access|go)\\b[^.!?\\n]{0,12}?` +
    `\\b(?:this|that|it|the ${THING})(?: ${THING})?(?=\\s*$|\\s*[^\\w\\s']|\\s+(?:lol|lmao|pls|plz|please|bro|at|online|from)\\b)`
  ),

  // "how do I take this quiz", "how can I try that test"
  new RegExp(`\\bhow (?:do|can|could|would) (?:i|we|you|u) (?:take|do|try|use|get|find|access|download|play)\\b[^.!?\\n]{0,15}\\b(?:this|that|the|it)\\b[^.!?\\n]{0,15}\\b${THING}\\b`),

  // "is this an app?", "is there a website for this", "is that a real site"
  new RegExp(`\\bis (?:this|that|there|it) (?:a|an)\\b[^.!?\\n]{0,12}\\b${THING}\\b`),

  // "where's the link", "where is that app"
  new RegExp(`\\bwhere(?:'?s| is) (?:the|that|this|ur|your) ${THING}\\b`),

  // "drop the link", "send me the website", "need that app"
  new RegExp(`\\b(?:drop|send|share|post|give|need)(?: me| us)? (?:the|a|that|this|ur|your) ${THING}\\b`),

  // "I want to take this quiz", "i wanna try that test"
  /\b(?:want to|wanna|need to|gonna) (?:take|try|do) (?:this|that|the) (?:quiz|test|calculator|app)\b/,
];

const SKIP = [
  // Dating apps by name, and questions about which one someone is on.
  /\b(?:hinge|tinder|bumble|raya|grindr|feeld|okcupid|plenty of fish|pof|match\.com|coffee meets bagel|facebook dating)\b/,
  /\b(?:met|meet|meeting) (?:on|her|him|them|each other|people|someone|girls|guys|women|men|ladies|a girl|a guy|singles)\b/,
  /\bhook ?up\b/,
  // "what app is she on", "what site are you on". NOT "using": in these
  // clips "what app is he using" means the phone in Tom's hand.
  /\b(?:she|he|they|you|u|y'?all|yall|girls|guys|women|men)(?:'?s|'?re| is| are| was| were)? on\b(?! (?:in the video|here|screen|the phone))/,
  /\b(?:best|better|worst|good|recommend|recommended) (?:dating )?(?:app|apps|site|sites|website|websites)\b/,
  /\b(?:app|apps|site|sites|website|websites) (?:is|are) (?:the )?(?:best|better|worst|good)\b/,

  // Questions about making the video rather than the thing in it.
  /\b(?:to|for|you|u) (?:edit|editing|record|recording|film|filming|caption|captions|subtitle|subtitles)\b/,
  /\b(?:editing|editor|camera|video|photo|recording|caption|captions|subtitle|subtitles|music|filter|teleprompter|mic) (?:app|apps|site|website|software|program)\b/,

  // Not a question: "what a stupid app", "what a test", "what an awesome website".
  new RegExp(`\\bwhat an? (?:\\w+ ){0,2}${THING}\\b`),

  // Someone already answering. A domain in the comment means they are
  // pointing at a site, not asking for one.
  /\b[a-z0-9-]+\.(?:com|tv|app|io|net|org|co|me|ai|gg|ly)\b/,
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'") // curly and look-alike apostrophes
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns which ASK pattern fired (its index), or -1. The index only exists
// so a dry run can say WHY a comment matched.
function whyMatch(text) {
  const t = normalize(text);
  if (!t || t.length > 300) return -1; // essays are not "what app is this"
  if (SKIP.some((re) => re.test(t))) return -1;
  return ASK.findIndex((re) => re.test(t));
}

function isAskingForSite(text) {
  return whyMatch(text) !== -1;
}

// "Comment QUIZ and I'll DM you the link." Tom's call (2026-09-14): a keyword
// ANYWHERE in the comment counts -- "QUIZ", "where's the quiz", "this app is
// crazy" -- plurals included (apps, quizzes, websites), but only as a whole
// word, so "happy" or "whatsapp" never trigger it. "web site" counts as
// "website".
function isKeywordComment(text, keywords) {
  const t = normalize(text).replace(/\bweb site/g, 'website');
  if (!t || !keywords.length) return false;
  const escape = (s) => String(s).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^a-z0-9])(?:${keywords.map((k) => `${escape(k)}(?:s|es|zes)?`).join('|')})(?![a-z0-9])`);
  return re.test(t);
}

module.exports = { isAskingForSite, whyMatch, normalize, isKeywordComment };
