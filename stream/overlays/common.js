// Shared by every overlay: the tier vocabulary, the relay connection, and
// the sound engine. Kept in one file so an alert and the ticker can never
// disagree about what colour "On the Moon" is.

// --- tiers -------------------------------------------------------------
// Labels and glows mirror RARITY_LEVELS in script.js. The icons are drawn
// rather than emoji: at 1080p an emoji renders as whatever font the
// streaming app happened to load, which is not a look you can art-direct.
const TIERS = {
  1: {
    key: "neighborhood",
    label: "Local Neighborhood",
    short: "NEIGHBOURHOOD",
    glow: "#7fe3a3",
    ink: "#04160c",
    blurb: "They could meet them on this block",
  },
  2: {
    key: "town",
    label: "Next Town Over",
    short: "NEXT TOWN",
    glow: "#6bc8ff",
    ink: "#04121c",
    blurb: "Short drive away",
  },
  3: {
    key: "country",
    label: "Across the Country",
    short: "CROSS-COUNTRY",
    glow: "#b98cff",
    ink: "#100a1c",
    blurb: "Getting picky now",
  },
  4: {
    key: "moon",
    label: "On the Moon",
    short: "ON THE MOON",
    glow: "#ffb443",
    ink: "#1a0f02",
    blurb: "Requires a rocket",
  },
  5: {
    key: "matrix",
    label: "Lost in the Matrix",
    short: "THE MATRIX",
    glow: "#00ff6a",
    ink: "#001a0a",
    blurb: "This person does not exist",
  },
};

const BRACKETS = {
  realistic: { label: "REALISTIC", colour: "#7fe3a3" },
  borderline: { label: "BORDERLINE", colour: "#ffb443" },
  delusional: { label: "DELUSIONAL", colour: "#ff4d6d" },
};

// Simple line art, sized to a 100x100 box, stroked in currentColor so each
// icon picks up its tier glow automatically.
const ICONS = {
  neighborhood: '<path d="M12 52 50 20l38 32"/><path d="M22 48v34h56V48"/><path d="M42 82V62h16v20"/>',
  town: '<path d="M10 62h80"/><path d="M22 62V48h20l10-12h18l8 26"/><circle cx="32" cy="70" r="8"/><circle cx="70" cy="70" r="8"/><path d="M14 82h16M54 82h32"/>',
  country: '<path d="M8 78c22-14 40-22 54-40"/><path d="M20 44l58-18-16 54-12-18-12 8z"/><circle cx="24" cy="80" r="3"/><circle cx="44" cy="72" r="3"/>',
  moon:
    '<circle cx="75" cy="25" r="14"/><circle cx="71" cy="20" r="2.5"/><circle cx="80" cy="30" r="2"/>' +
    '<path d="M34 80c-7-12-7-30 0-40 7 10 7 28 0 40z"/><circle cx="34" cy="54" r="4.5"/>' +
    '<path d="M27 68l-9 13 10-3M41 68l9 13-10-3"/><path d="M34 84v10M28 84l-3 7M40 84l3 7"/>',
  matrix: '<rect x="18" y="34" width="64" height="32" rx="16"/><path d="M50 34v32"/><path d="M28 22v-8M50 18v-8M72 22v-8M28 86v-8M50 90v-8M72 86v-8"/>',
};

function iconSvg(key) {
  return (
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[key] || "") +
    "</svg>"
  );
}

// --- relay connection --------------------------------------------------
// Overlays are served by the relay itself, so the stream is same-origin and
// EventSource reconnects on its own if the relay restarts between takes.
function connectRelay({ onAlert, onState, onStatus }) {
  let source = null;

  function open() {
    source = new EventSource("/events");
    source.addEventListener("open", () => onStatus && onStatus(true));
    source.addEventListener("error", () => onStatus && onStatus(false));
    source.addEventListener("alert", (e) => {
      try {
        onAlert && onAlert(JSON.parse(e.data));
      } catch (err) {
        /* a malformed frame should never take the overlay down mid-stream */
      }
    });
    source.addEventListener("state", (e) => {
      try {
        onState && onState(JSON.parse(e.data));
      } catch (err) {
        /* ditto */
      }
    });
  }

  open();
  return {
    close() {
      if (source) source.close();
    },
  };
}

// --- sound -------------------------------------------------------------
// Every cue is synthesised in the browser rather than shipped as audio
// files: nothing to license, nothing to lose track of, and no silent
// overlay because a path broke. Drop stream/sounds/tier5.mp3 (etc.) in and
// it takes over for that tier automatically.
const SoundKit = (() => {
  let ctx = null;
  let master = null;
  const overrides = {};
  let enabled = true;

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    // Browser sources start unsuspended (OBS launches Chromium with the
    // autoplay gate off) but a normal browser tab needs a nudge.
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Look for a file override once, at load, so the first alert of the
  // night isn't waiting on a network round-trip.
  function probeOverrides() {
    Object.keys(TIERS).forEach((score) => {
      ["mp3", "ogg", "wav"].forEach((ext) => {
        const url = `/sounds/tier${score}.${ext}`;
        fetch(url, { method: "HEAD" })
          .then((r) => {
            if (r.ok && !overrides[score]) {
              const el = new Audio(url);
              el.preload = "auto";
              overrides[score] = el;
            }
          })
          .catch(() => {});
      });
    });
  }

  function tone({ freq, type = "sine", start = 0, dur = 0.3, gain = 0.3, sweepTo = null }) {
    const c = audio();
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    // Ramps rather than instant gain changes -- a square wave switched on
    // at full volume clicks, and a click is what a cheap overlay sounds like.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise({ start = 0, dur = 0.6, gain = 0.25, from = 1200, to = 200, q = 1 }) {
    const c = audio();
    const t = c.currentTime + start;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  // One cue per tier, written so they escalate: bright and short at the
  // common end, alarming and long at the Matrix end.
  const CUES = {
    1: () => {
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone({ freq: f, type: "triangle", start: i * 0.08, dur: 0.28, gain: 0.28 })
      );
      tone({ freq: 1046.5, type: "sine", start: 0.24, dur: 0.5, gain: 0.2 });
    },
    2: () => {
      [440, 587.33].forEach((f, i) =>
        tone({ freq: f, type: "triangle", start: i * 0.11, dur: 0.32, gain: 0.28 })
      );
      noise({ start: 0.05, dur: 0.5, gain: 0.08, from: 900, to: 300 });
    },
    3: () => {
      tone({ freq: 220, type: "sawtooth", dur: 0.7, gain: 0.16, sweepTo: 880 });
      [659.25, 830.61, 987.77].forEach((f, i) =>
        tone({ freq: f, type: "sine", start: 0.3 + i * 0.07, dur: 0.4, gain: 0.22 })
      );
      noise({ start: 0, dur: 0.9, gain: 0.06, from: 400, to: 2400, q: 0.6 });
    },
    4: () => {
      // Launch: a rising rumble, then the report.
      noise({ start: 0, dur: 1.1, gain: 0.3, from: 180, to: 1800, q: 0.5 });
      tone({ freq: 55, type: "sine", start: 0, dur: 1.2, gain: 0.4, sweepTo: 180 });
      tone({ freq: 880, type: "triangle", start: 0.85, dur: 0.5, gain: 0.25 });
      tone({ freq: 1318.5, type: "triangle", start: 0.95, dur: 0.6, gain: 0.2 });
    },
    5: () => {
      // Alarm. Detuned pair so it beats against itself, plus a stack of
      // glitch blips and a long sub drone underneath.
      tone({ freq: 110, type: "sawtooth", dur: 2.4, gain: 0.22 });
      tone({ freq: 110.9, type: "sawtooth", dur: 2.4, gain: 0.22 });
      tone({ freq: 41, type: "sine", dur: 2.6, gain: 0.4 });
      for (let i = 0; i < 6; i++) {
        tone({
          freq: 1400 - i * 120,
          type: "square",
          start: 0.12 + i * 0.13,
          dur: 0.09,
          gain: 0.14,
        });
      }
      noise({ start: 0.1, dur: 1.6, gain: 0.12, from: 3000, to: 120, q: 2 });
      tone({ freq: 1760, type: "sine", start: 1.5, dur: 0.9, gain: 0.18, sweepTo: 220 });
    },
  };

  probeOverrides();

  return {
    play(score) {
      if (!enabled) return;
      const file = overrides[score];
      if (file) {
        // cloneNode so back-to-back guests don't cut each other off
        const el = file.cloneNode();
        el.volume = 0.9;
        el.play().catch(() => (CUES[score] || CUES[3])());
        return;
      }
      try {
        (CUES[score] || CUES[3])();
      } catch (err) {
        /* audio is a nice-to-have; never let it break the visual */
      }
    },
    setEnabled(v) {
      enabled = Boolean(v);
    },
    setVolume(v) {
      audio();
      master.gain.value = Math.max(0, Math.min(1, v));
    },
  };
})();

// --- misc --------------------------------------------------------------
function params() {
  return new URLSearchParams(location.search);
}

// A representative result per tier, used by the test buttons and by the
// overlays' ?demo= preview. Deliberately verbose -- a long criteria list
// and a wide percentage are what break a layout, so that's what you want
// on screen while you're sizing the source in OBS.
const SAMPLE_CRITERIA = [
  "ages 24–32",
  "not married",
  "no kids",
  "White",
  "at least 6'2\" tall",
  "not obese",
  "earning at least $150k per year",
];

function sampleEntry(score) {
  const byScore = {
    1: { pct: 71.4, pctText: "71.4%" },
    2: { pct: 42.8, pctText: "42.8%" },
    3: { pct: 18.2, pctText: "18.2%" },
    4: { pct: 4.6, pctText: "4.6%" },
    5: { pct: 0.004, pctText: "0.004%" },
  };
  const s = byScore[score] || byScore[3];
  const bracket = score <= 2 ? "realistic" : score === 3 ? "borderline" : "delusional";
  return {
    id: "demo",
    ts: Date.now(),
    score,
    label: TIERS[score].label,
    pct: s.pct,
    pctText: s.pctText,
    criteria: SAMPLE_CRITERIA,
    targetSex: "men",
    biggestLimitingFilter: "minimum height preference",
    limitingCriterion: "at least 6'2\" tall",
    scopeLabel: "United States",
    gender: "woman",
    bracket,
  };
}

function oneInText(pct) {
  if (!Number.isFinite(pct) || pct <= 0) return "";
  const oneIn = 100 / pct;
  const rounded =
    oneIn < 10 ? Math.round(oneIn * 10) / 10 : oneIn < 1000 ? Math.round(oneIn) : Math.round(oneIn / 100) * 100;
  return rounded.toLocaleString("en-US");
}

// Counters that snap to a new value look like a page reload; counters that
// roll look like a broadcast graphic.
function countUp(el, to, duration = 500) {
  const from = Number(el.dataset.value || 0);
  if (from === to) return;
  el.dataset.value = String(to);
  const started = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // rAF stops entirely when the page isn't compositing, which for a
  // browser source means a scoreboard frozen on last night's numbers.
  // The animation is the nice-to-have; landing on the right number is
  // not, so a timer guarantees the value regardless.
  clearTimeout(el._settle);
  el._settle = setTimeout(() => {
    if (Number(el.dataset.value) === to) el.textContent = String(to);
  }, duration + 60);
}
