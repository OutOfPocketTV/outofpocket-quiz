// Shared by the scene theme and the donation card, because chat text and
// donation notes are the same thing wearing different clothes -- both are
// typed by strangers and both go out live.
//
// None of it is ever handed to innerHTML. Platform emotes are the one thing
// worth reading out of it: Social Stream Ninja delivers them as <img>
// markup. So the text is walked rather than assigned -- only <img> is
// recognised, only from a known emote CDN over https, and every other byte
// becomes a text node. An emote from anywhere else degrades to its alt text,
// never to live markup. Attacker-supplied attributes never survive: only
// src, alt and class are set, and they are set as DOM properties.
const EMOTE_HOSTS = [
  "static-cdn.jtvnw.net",      // Twitch
  "cdn.7tv.app",               // 7TV
  "cdn.betterttv.net",         // BetterTTV
  "cdn.frankerfacez.com",      // FrankerFaceZ
  "yt3.ggpht.com",             // YouTube
  "lh3.googleusercontent.com", // YouTube
  "files.kick.com",            // Kick
  "cdn.discordapp.com",        // Discord
];
const IMG_TAG = /<img\b[^>]*>/gi;

function tagAttr(tag, name) {
  const hit = tag.match(new RegExp(name + "\s*=\s*(\"([^\"]*)\"|'([^']*)')", "i"));
  if (!hit) return "";
  return hit[2] !== undefined ? hit[2] : hit[3];
}

// Parsed with the URL API rather than a string prefix test, so a lookalike
// host like static-cdn.jtvnw.net.evil.com cannot pass.
function emoteAllowed(src) {
  try {
    const u = new URL(src, location.href);
    return u.protocol === "https:" && EMOTE_HOSTS.indexOf(u.hostname) !== -1;
  } catch (err) {
    return false;
  }
}

function renderChatText(target, raw) {
  let last = 0;
  let hit;
  IMG_TAG.lastIndex = 0;
  while ((hit = IMG_TAG.exec(String(raw))) !== null) {
    if (hit.index > last) {
      target.appendChild(document.createTextNode(String(raw).slice(last, hit.index)));
    }
    const src = tagAttr(hit[0], "src");
    const alt = tagAttr(hit[0], "alt");
    if (emoteAllowed(src)) {
      const img = document.createElement("img");
      img.className = "emote";
      img.src = src;
      img.alt = alt;
      target.appendChild(img);
    } else if (alt) {
      target.appendChild(document.createTextNode(alt));
    }
    last = hit.index + hit[0].length;
  }
  const s = String(raw);
  if (last < s.length) {
    // A length cap upstream can slice a tag in half; never show the stump.
    const tail = s.slice(last).replace(/<img\b[^>]*$/i, "");
    if (tail) target.appendChild(document.createTextNode(tail));
  }
}
