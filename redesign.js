/* Presentation only, for the cinematic redesign (redesign.css).
   Nothing in here computes a result, gates the paywall or touches payment:
   script.js still owns all of that. This file adds motion and a few
   conveniences around it, and every part of it fails quietly -- if any
   piece cannot run, the page underneath works exactly as before. */
(function () {
  "use strict";

  var body = document.body;
  if (!body || !body.classList.contains("rd")) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isEditMode = new URLSearchParams(window.location.search).get("edit") === "1";
  body.classList.add("rd-js");

  function byId(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------------
  // Navigation: solid once scrolled, and a menu on small screens.
  // ---------------------------------------------------------------------
  var nav = byId("rdNav");
  if (nav) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        nav.classList.toggle("is-scrolled", window.scrollY > 12);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var menuBtn = byId("rdMenuBtn");
    var menu = byId("rdMenu");
    if (menuBtn && menu) {
      var setMenu = function (open) {
        menu.hidden = !open;
        menuBtn.setAttribute("aria-expanded", String(open));
        menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };
      menuBtn.addEventListener("click", function () { setMenu(menu.hidden); });
      menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
      document.addEventListener("click", function (e) {
        if (!menu.hidden && !nav.contains(e.target)) setMenu(false);
      });
    }
  }

  // ---------------------------------------------------------------------
  // The calculator's heading, placed in front of whichever quiz card is
  // first -- so it follows any order Tom sets in Edit Mode. Skipped in
  // Edit Mode itself, where the editor expects the file's own layout.
  // ---------------------------------------------------------------------
  var main = document.querySelector("main.quiz");
  var quizHead = null;
  if (main && !isEditMode) {
    var firstCard = main.querySelector(':scope > .card[id^="card-"]');
    if (firstCard) {
      quizHead = document.createElement("div");
      quizHead.className = "rd-section-head rd-quiz-head";
      quizHead.id = "rdQuiz";
      quizHead.innerHTML =
        '<p class="rd-kicker">The calculator</p>' +
        '<h2 class="rd-h2">Set your <em>standards.</em></h2>' +
        '<p class="rd-lede">Eight quick questions. Be honest &mdash; the answer is only as real as your standards.</p>';
      main.insertBefore(quizHead, firstCard);
    }
  }

  // Every "Find my odds" link lands on that heading, just under the nav.
  document.querySelectorAll("[data-rd-quiz-link]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var target = quizHead || document.querySelector('main.quiz > .card[id^="card-"]');
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  // ---------------------------------------------------------------------
  // Hero proof: total views on the quiz clips, from the same feed the clip
  // wall uses. Rounded DOWN ("90M+"), and hidden entirely if the feed
  // does not answer -- never a made-up figure.
  // ---------------------------------------------------------------------
  function formatFloor(n) {
    if (n >= 1e9) return (Math.floor(n / 1e8) / 10) + "B+";
    if (n >= 1e7) return (Math.floor(n / 1e7) * 10) + "M+";
    if (n >= 1e6) return Math.floor(n / 1e6) + "M+";
    if (n >= 1e4) return Math.floor(n / 1e3) + "K+";
    return null;
  }
  var viewsItem = byId("rdViewsItem");
  var viewsEl = byId("rdViews");
  if (viewsItem && viewsEl && window.fetch) {
    fetch("/api/live-status?clips=1")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.clips)) return;
        var total = data.clips.reduce(function (sum, c) {
          return sum + (typeof c.views === "number" && c.views > 0 ? c.views : 0);
        }, 0);
        var text = formatFloor(total);
        if (!text) return;
        viewsEl.textContent = text;
        viewsItem.hidden = false;
      })
      .catch(function () { /* stays hidden */ });
  }

  // ---------------------------------------------------------------------
  // Slider fill up to the thumb's centre. Follows the value bubble, which
  // script.js rewrites on every change -- including the programmatic ones
  // after a purchase restores saved filters.
  // ---------------------------------------------------------------------
  var THUMB = 22; // must match THUMB_SIZE in script.js
  function wireFill(sliderId, bubbleId) {
    var slider = byId(sliderId);
    var bubble = byId(bubbleId);
    if (!slider) return;
    var paint = function () {
      var min = Number(slider.min), max = Number(slider.max);
      var pct = (Number(slider.value) - min) / ((max - min) || 1);
      var px = THUMB / 2 + pct * (slider.clientWidth - THUMB);
      slider.style.setProperty("--rd-fill", Math.max(0, px).toFixed(1) + "px");
    };
    slider.addEventListener("input", paint);
    window.addEventListener("resize", paint);
    if (bubble && window.MutationObserver) {
      new MutationObserver(paint).observe(bubble, { childList: true, characterData: true, subtree: true });
    }
    paint();
  }
  wireFill("heightSlider", "heightBubble");
  wireFill("incomeSlider", "incomeBubble");

  // ---------------------------------------------------------------------
  // Paywall: colour the result "ticket" by the visitor's rarity tier. Read
  // from the verdict script.js writes, so it can never disagree with it.
  // ---------------------------------------------------------------------
  var rarityEl = byId("paywallLockedRarity");
  var modal = document.querySelector(".paywall-modal");
  if (rarityEl && modal && window.MutationObserver) {
    var TIERS = [
      [/^local/i, "1"],
      [/^next/i, "2"],
      [/^across/i, "3"],
      [/^on the moon/i, "4"],
      [/^lost/i, "5"],
    ];
    var applyTier = function () {
      var text = (rarityEl.textContent || "").trim();
      var tier = "";
      for (var i = 0; i < TIERS.length; i++) {
        if (TIERS[i][0].test(text)) { tier = TIERS[i][1]; break; }
      }
      if (tier) modal.setAttribute("data-rd-tier", tier);
      else modal.removeAttribute("data-rd-tier");
    };
    new MutationObserver(applyTier).observe(rarityEl, { childList: true, characterData: true, subtree: true });
    applyTier();
  }

  // ---------------------------------------------------------------------
  // Scroll reveal for the new sections below the quiz.
  // ---------------------------------------------------------------------
  function setupReveal() {
    var targets = [];
    document.querySelectorAll(
      ".rd-quiz-head, .rd-section .rd-section-head, .rd-step, .rd-demo, .rd-sources, .rd-tier, main.quiz > .home-about, .rd-final"
    ).forEach(function (el) { targets.push(el); });
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    document.querySelectorAll(".rd-steps, .rd-tier-row").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty("--rd-delay", (i * 0.08).toFixed(2) + "s");
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    targets.forEach(function (el) {
      el.classList.add("rd-reveal");
      io.observe(el);
    });
  }
  setupReveal();

  // ---------------------------------------------------------------------
  // The hero field: an aurora over an endless floor of dots -- one dot per
  // person, walking slowly towards you, the odd rare one glowing. One
  // full-screen fragment shader; paused whenever it is off-screen or the
  // tab is hidden, drawn once and frozen under reduced motion, and simply
  // absent (the CSS gradient shows instead) where WebGL is unavailable or
  // would fall back to software rendering.
  // ---------------------------------------------------------------------
  var FIELD_FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform vec2 uPointer;",
    "uniform float uHorizon;",
    "uniform float uHzX;",
    "float hash21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }",
    "float vnoise(vec2 p){",
    "  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0));",
    "  float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));",
    "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
    "}",
    "float fbm(vec2 p){",
    "  float v = 0.0; float a = 0.5; mat2 r = mat2(0.8, -0.6, 0.6, 0.8);",
    "  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = r * p * 2.03 + 7.1; a *= 0.5; }",
    "  return v;",
    "}",
    "void main(){",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec2 uv = frag / uRes;",
    "  float aspect = uRes.x / uRes.y;",
    "  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);",
    "  float t = uTime;",
    "  vec3 violet = vec3(0.616, 0.549, 1.0);",
    "  vec3 deep = vec3(0.19, 0.12, 0.52);",
    "  vec3 orchid = vec3(0.82, 0.45, 1.0);",
    "  vec3 ice = vec3(0.42, 0.78, 1.0);",
    "  vec3 col = vec3(0.028, 0.024, 0.045);",
    // aurora
    "  vec2 sp = p * 1.25 + uPointer * 0.04;",
    "  vec2 q = vec2(fbm(sp + vec2(0.0, t * 0.03)), fbm(sp + vec2(5.2, -t * 0.026)));",
    "  float n = fbm(sp * 1.35 + 1.7 * q + vec2(t * 0.016, -t * 0.01));",
    "  float sky = smoothstep(uHorizon - 0.02, uHorizon + 0.42, uv.y);",
    "  float curtain = smoothstep(0.35, 0.95, n);",
    "  vec3 aur = mix(deep, violet, smoothstep(0.4, 0.9, n));",
    "  aur = mix(aur, orchid, smoothstep(0.5, 0.95, q.x) * 0.5);",
    "  aur = mix(aur, ice, smoothstep(0.62, 1.0, q.y) * 0.22);",
    "  col += aur * pow(curtain, 1.6) * sky * 1.05;",
    "  col += violet * 0.1 * exp(-2.2 * length(p - vec2(0.21 * aspect, 0.3)));",
    // horizon
    "  float dH = uv.y - uHorizon;",
    "  float hzMask = 1.0 - smoothstep(0.05, 0.8, abs(uv.x - uHzX) * 2.0);",
    "  col += violet * 0.55 * exp(-abs(dH) * 130.0) * hzMask;",
    "  col += violet * 0.12 * exp(-abs(dH) * 11.0) * (0.35 + 0.65 * hzMask);",
    // floor of people
    "  if (dH < 0.0) {",
    "    float d = -dH;",
    "    float z = 0.2 / (d + 0.003);",
    "    float x = (uv.x - 0.5) * aspect * z * 1.25 + uPointer.x * 0.2;",
    "    vec2 g = vec2(x * 26.0, (z + t * 0.03) * 30.0);",
    "    vec2 cell = floor(g);",
    "    vec2 f = fract(g) - 0.5;",
    "    float h = hash21(cell);",
    "    f -= (vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.45;",
    "    float r = length(f);",
    "#ifdef HAS_DERIV",
    "    float w = fwidth(r);",
    "#else",
    "    float w = 0.012 * z;",
    "#endif",
    "    float dotA = 1.0 - smoothstep(0.085 - w, 0.085 + w, r);",
    "    float lod = 1.0 - smoothstep(0.07, 0.3, w);",
    "    float fog = smoothstep(0.0, 0.12, d) * (1.0 - smoothstep(0.75, 1.0, d / uHorizon));",
    "    float isMatch = step(0.986, h);",
    "    float pulse = 0.55 + 0.45 * sin(t * 1.7 + h * 50.0);",
    "    vec3 people = vec3(0.74, 0.72, 0.9) * 0.5;",
    "    vec3 match = mix(violet, vec3(1.0), 0.3) * (1.3 + pulse);",
    "    col += mix(people, match, isMatch) * dotA * lod * fog;",
    "    col += violet * isMatch * exp(-r * 7.0) * 0.6 * pulse * lod * fog;",
    "    col += deep * 0.14 * (1.0 - smoothstep(0.0, 0.2, d));",
    "  }",
    // vignette + grain
    "  float vig = smoothstep(1.3, 0.2, length(p * vec2(0.8, 1.2)));",
    "  col *= mix(0.55, 1.0, vig);",
    "  col += (hash21(frag + fract(t * 0.73) * 97.0) - 0.5) * 0.03;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  function startField() {
    var wrap = document.querySelector(".rd-field");
    var canvas = byId("rdField");
    if (!wrap || !canvas) return;

    var gl = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false,
        powerPreference: "low-power", failIfMajorPerformanceCaveat: true,
      });
    } catch (err) { gl = null; }
    if (!gl) return;

    var deriv = gl.getExtension("OES_standard_derivatives");
    var fragSrc = (deriv ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n" : "") + FIELD_FRAG;
    var vertSrc = "attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.console) console.warn("rd field shader:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var vs = compile(gl.VERTEX_SHADER, vertSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "uRes");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var uPointer = gl.getUniformLocation(prog, "uPointer");
    var uHorizon = gl.getUniformLocation(prog, "uHorizon");
    var uHzX = gl.getUniformLocation(prog, "uHzX");

    // Resolution is in CSS pixels times a quality factor that drops if the
    // device struggles. The picture is soft by nature, so even the lowest
    // setting still looks right.
    var quality = Math.min(window.devicePixelRatio || 1, 1.5);
    if (window.innerWidth < 700) quality = Math.min(quality, 1);
    function resize() {
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      var cw = Math.max(1, Math.round(w * quality));
      var ch = Math.max(1, Math.round(h * quality));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        gl.viewport(0, 0, cw, ch);
      }
      gl.uniform2f(uRes, cw, ch);
      // Where the floor meets the sky, measured up from the canvas bottom,
      // and where along it the bright line is centred. On a wide screen the
      // line comes out from behind the clip wall, clear of the headline and
      // subtitle; on a phone it sits low, behind the wall's cards.
      var wide = window.innerWidth >= 1100;
      gl.uniform1f(uHorizon, wide ? 0.33 : 0.24);
      gl.uniform1f(uHzX, wide ? 0.74 : 0.5);
    }
    resize();
    window.addEventListener("resize", resize);

    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible = e.isIntersecting; });
      }).observe(wrap);
    }

    function draw(seconds) {
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      gl.uniform1f(uTime, seconds);
      gl.uniform2f(uPointer, pointer.x, -pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (reduceMotion) {
      draw(24);
      wrap.classList.add("is-live");
      return;
    }

    var start = performance.now();
    var slow = 0;
    var frames = 0;
    var last = start;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = now - last;
      last = now;
      // Adapt once, early: if the first couple of seconds run slow, drop
      // the resolution rather than stutter.
      if (frames < 150) {
        frames++;
        if (dt > 26) slow++;
        if (frames === 150 && slow > 60 && quality > 0.5) {
          quality = Math.max(0.5, quality * 0.6);
          resize();
        }
      }
      draw((now - start) / 1000 + 8);
    }
    draw(8);
    wrap.classList.add("is-live");
    requestAnimationFrame(frame);
  }
  try { startField(); } catch (err) { /* the CSS backdrop stays */ }

  // ---------------------------------------------------------------------
  // The live example: the calculator's own engine, run on fixed example
  // standards (U.S. men aged 25-35), so every number shown is real and
  // matches the worked example on how-it-works.html. A thousand dots, and
  // each standard switches off everyone it rules out.
  // ---------------------------------------------------------------------
  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(Math.round(n));
  }
  function pctText(share) {
    var p = share * 100;
    if (p >= 99.95) return "100%";
    if (p >= 10) return p.toFixed(1).replace(/\.0$/, "") + "%";
    if (p >= 1) return p.toFixed(2).replace(/0$/, "") + "%";
    return p.toFixed(2) + "%";
  }

  function startDemo() {
    var fig = byId("rdDemo");
    var canvas = byId("rdDemoCanvas");
    var Q = window.QuizStats;
    if (!fig || !canvas || !Q || typeof Q.computeProbability !== "function" || !Q.STATS) return;

    var base = {
      targetSex: "men", ageLo: 25, ageHi: 35, selectedRaces: [],
      minHeight: 58, minIncome: 0, excludeMarried: false, excludeKids: false,
      excludeGambles: false, selectedOrientations: [], selectedReligions: [],
    };
    var defs = [
      { label: "6′0″ or taller", set: { minHeight: 72 } },
      { label: "Earns $100k+", set: { minIncome: 100000 } },
      { label: "Not married", set: { excludeMarried: true } },
      { label: "No kids", set: { excludeKids: true } },
    ];

    var first = Q.computeProbability(Q.STATS, base);
    var pool = Q.STATS.totalAdultPopulation && Q.STATS.totalAdultPopulation.men
      ? Q.STATS.totalAdultPopulation.men * first.pAge
      : first.matchingCount;
    if (!(pool > 0)) return;

    var f = Object.assign({}, base);
    var steps = [{ share: 1, count: pool }];
    defs.forEach(function (d) {
      Object.assign(f, d.set);
      var r = Q.computeProbability(Q.STATS, f);
      steps.push({ label: d.label, share: r.probability, count: r.matchingCount });
    });
    if (steps.some(function (s) { return !(s.share >= 0) || !(s.count >= 0); })) return;

    var N = 1000;
    var perDot = pool / N;
    var final = steps[steps.length - 1];
    var oneIn = Math.max(2, Math.round(1 / final.share));

    // Chips under the stage: one per standard, lit as it is applied.
    var list = byId("rdDemoSteps");
    var chips = steps.slice(1).map(function (s, i) {
      var li = document.createElement("li");
      li.innerHTML = "<span></span><b></b>";
      li.firstChild.textContent = s.label;
      li.lastChild.textContent = pctText(s.share);
      if (i === steps.length - 2) li.setAttribute("data-final", "");
      list.appendChild(li);
      return li;
    });
    byId("rdDemoPer").textContent = Math.round(perDot / 1000) + ",000";

    var countEl = byId("rdDemoCount");
    var pctEl = byId("rdDemoPct");

    // Dots on a jittered 40 x 25 grid. rank[i] is a shuffled 0..N-1, so at a
    // share s exactly the dots with rank < s*N survive -- the picture is the
    // real proportion, not a random approximation of it.
    var COLS = 40, ROWS = 25;
    var dots = [];
    var ranks = [];
    for (var k = 0; k < N; k++) ranks.push(k);
    for (var j = N - 1; j > 0; j--) {
      var m = Math.floor(Math.random() * (j + 1));
      var tmp = ranks[j]; ranks[j] = ranks[m]; ranks[m] = tmp;
    }
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var idx = r * COLS + c;
        dots.push({
          gx: (c + 0.5 + (Math.random() - 0.5) * 0.5) / COLS,
          gy: (r + 0.5 + (Math.random() - 0.5) * 0.5) / ROWS,
          rank: ranks[idx],
          a: 0.85, s: 1, g: 0,      // current alpha, size, glow
          ta: 0.85, ts: 1, tg: 0,   // targets
          delay: 0,
        });
      }
    }

    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    var stepIndex = 0;
    var shownCount = pool;
    var countFrom = pool, countTo = pool, countT0 = 0;

    function setStep(i, now) {
      stepIndex = i;
      var s = steps[i];
      var isFinal = i === steps.length - 1;
      dots.forEach(function (d) {
        var alive = d.rank < s.share * N;
        d.delay = now + d.gx * 420;              // a sweep from left to right
        d.ta = alive ? (isFinal ? 1 : 0.85) : 0.13;
        d.ts = alive ? (isFinal ? 1.9 : 1) : 0.6;
        d.tg = alive && isFinal ? 1 : 0;
      });
      chips.forEach(function (li, n) {
        li.classList.toggle("is-on", n < i);
        li.classList.toggle("is-final", isFinal && n === i - 1);
      });
      countFrom = shownCount;
      countTo = s.count;
      countT0 = now;
      if (i === 0) {
        pctEl.textContent = "U.S. men aged 25–35";
      } else if (isFinal) {
        pctEl.textContent = pctText(s.share) + " · about 1 in " + oneIn.toLocaleString();
      } else {
        pctEl.textContent = pctText(s.share) + " still qualify";
      }
    }

    function drawFrame(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var padX = W * 0.05, padY = H * 0.08;
      var cellW = (W - padX * 2) / COLS;
      var dotR = Math.max(1.3, Math.min(cellW * 0.2, 3.2));
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        if (now >= d.delay) {
          d.a += (d.ta - d.a) * 0.08;
          d.s += (d.ts - d.s) * 0.08;
          d.g += (d.tg - d.g) * 0.06;
        }
        var x = padX + d.gx * (W - padX * 2);
        var y = padY + d.gy * (H - padY * 2 - H * 0.26);
        var rad = dotR * d.s;
        if (d.g > 0.02) {
          var halo = ctx.createRadialGradient(x, y, 0, x, y, rad * 6);
          halo.addColorStop(0, "rgba(0,255,106," + (0.45 * d.g).toFixed(3) + ")");
          halo.addColorStop(1, "rgba(0,255,106,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(x, y, rad * 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, d.a));
        ctx.fillStyle = d.g > 0.5 ? "#b6ffd4" : "#d9d4f2";
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Count eases to its new value.
      var k = Math.min(1, (now - countT0) / 900);
      var e = 1 - Math.pow(1 - k, 3);
      shownCount = countFrom + (countTo - countFrom) * e;
      countEl.textContent = compact(shownCount) + " men";
    }

    size();
    window.addEventListener("resize", size);
    fig.hidden = false;
    size();

    if (reduceMotion) {
      var t = performance.now();
      setStep(steps.length - 1, t - 5000);
      dots.forEach(function (d) { d.a = d.ta; d.s = d.ts; d.g = d.tg; d.delay = 0; });
      countFrom = countTo; shownCount = countTo;
      drawFrame(t);
      return;
    }

    var visible = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible = e.isIntersecting; });
      }, { rootMargin: "60px 0px" }).observe(fig);
    } else {
      visible = true;
    }

    // Timeline: one standard every 1.9s, hold the answer, then start over.
    var STEP_MS = 1900, HOLD_MS = 4200, RESET_MS = 1400;
    var cycle = STEP_MS * (steps.length - 1) + HOLD_MS + RESET_MS;
    var t0 = performance.now();
    var paused = 0;
    var lastNow = t0;
    setStep(0, t0);
    function loop(now) {
      requestAnimationFrame(loop);
      if (!visible || document.hidden) { paused += now - lastNow; lastNow = now; return; }
      lastNow = now;
      var local = (now - t0 - paused) % cycle;
      var want = local < STEP_MS * (steps.length - 1) + HOLD_MS
        ? Math.min(steps.length - 1, Math.floor(local / STEP_MS))
        : 0;
      if (want !== stepIndex) setStep(want, now);
      drawFrame(now);
    }
    requestAnimationFrame(loop);
  }
  try { startDemo(); } catch (err) { /* the figure stays hidden */ }

  // Web fonts change nothing about the grid, but they can land after
  // script.js measured the sliders; a resize makes it re-place the bubbles.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      window.dispatchEvent(new Event("resize"));
    });
  }
})();
