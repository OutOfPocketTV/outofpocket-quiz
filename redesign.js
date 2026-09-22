/* Presentation only, for the redesign (redesign.css).
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
  // "Decoding" text: short mono labels flicker through random characters
  // and settle left to right, like a terminal resolving a line. Only used
  // on monospaced labels, where every character is the same width, so the
  // effect can never shift the layout around it.
  // ---------------------------------------------------------------------
  var DECODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$<>/_=+*";
  function decode(el, duration) {
    if (!el || reduceMotion || el.getAttribute("data-rd-decoding") === "1") return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    if (!nodes.length) return;
    var finals = nodes.map(function (n) { return n.nodeValue; });
    var total = finals.reduce(function (sum, s) { return sum + s.length; }, 0);
    var start = performance.now();
    var dur = duration || 700;
    el.setAttribute("data-rd-decoding", "1");
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var index = 0;
      nodes.forEach(function (node, k) {
        var target = finals[k];
        var out = "";
        for (var i = 0; i < target.length; i++, index++) {
          var ch = target.charAt(i);
          var settleAt = 0.2 + 0.8 * (index / total);
          out += (p >= settleAt || ch === " ") ? ch : DECODE_CHARS.charAt((Math.random() * DECODE_CHARS.length) | 0);
        }
        node.nodeValue = out;
      });
      if (p < 1) requestAnimationFrame(frame);
      else {
        nodes.forEach(function (node, k) { node.nodeValue = finals[k]; });
        el.removeAttribute("data-rd-decoding");
      }
    }
    requestAnimationFrame(frame);
  }

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
        '<h2 class="rd-h2">Set your <em>standards</em></h2>' +
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

  // The hero's label resolves itself once on arrival.
  var eyebrow = document.querySelector(".rd-eyebrow");
  if (eyebrow) setTimeout(function () { decode(eyebrow, 900); }, 150);

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
  // Paywall: colour the result panel by the visitor's rarity tier. Read
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
  // Scroll reveal for the new sections below the quiz; each section's mono
  // label decodes as it arrives.
  // ---------------------------------------------------------------------
  function setupReveal() {
    var targets = [];
    document.querySelectorAll(
      ".rd-quiz-head, .rd-section .rd-section-head, .rd-step, .rd-globe, .rd-sources, .rd-tier, main.quiz > .home-about, .rd-final"
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
        var kicker = entry.target.querySelector(".rd-kicker");
        if (kicker) decode(kicker, 800);
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
  // The hero backdrop: Matrix code rain in two layers of depth, falling
  // onto a neon grid floor that runs to a glowing horizon. The glyphs are
  // real characters (mirrored katakana and digits, as in the film), drawn
  // once into a texture; one full-screen shader does the rest. Dimmed
  // behind the headline so it never fights the text. Paused whenever it is
  // off-screen or the tab is hidden, drawn once and frozen under reduced
  // motion, and simply absent -- the CSS glow shows instead -- where WebGL
  // is unavailable or would fall back to software rendering.
  // ---------------------------------------------------------------------
  var RAIN_FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform float uHorizon;",
    "uniform float uHzX;",
    "uniform float uWide;",
    "uniform float uPx;",
    "uniform sampler2D uGlyphs;",
    "float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }",
    "float hash21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }",
    "vec3 rain(vec2 frag, float cell, float speedMul, float seed, float density, float bias){",
    "  vec2 p = vec2(frag.x, uRes.y - frag.y) / cell;",
    "  float col = floor(p.x);",
    "  float r1 = hash11(col * 3.17 + seed);",
    "  float r2 = hash11(col * 7.31 + seed * 1.7);",
    "  if (r2 > density) return vec3(0.0);",
    "  float speed = (0.55 + r1 * 1.1) * speedMul;",
    "  float len = 14.0 + floor(hash11(col * 1.91 + seed * 3.3) * 24.0);",
    "  float trail = len * 0.62;",
    "  float head = mod(uTime * speed + r1 * 97.0, len);",
    "  float row = floor(p.y);",
    "  float d = mod(head - row, len);",
    "  if (d > trail) return vec3(0.0);",
    "  float fade = 1.0 - d / trail;",
    "  fade *= fade;",
    "  float change = floor(uTime * (1.2 + r1 * 4.0) + hash21(vec2(col, row)) * 40.0);",
    "  float gi = floor(hash21(vec2(col * 1.3 + row * 0.7, change)) * 64.0);",
    "  vec2 uv = (vec2(mod(gi, 8.0), floor(gi / 8.0)) + fract(p)) / 8.0;",
    "  float a = texture2D(uGlyphs, uv, bias).a;",
    "  float halo = texture2D(uGlyphs, uv, bias + 2.5).a;",
    "  float isHead = 1.0 - smoothstep(0.0, 1.1, d);",
    "  vec3 green = vec3(0.0, 1.0, 0.42);",
    "  vec3 headCol = vec3(0.8, 1.0, 0.9);",
    "  vec3 c = mix(green * fade, headCol, isHead) * a;",
    "  c += green * halo * (0.35 * fade + 0.9 * isHead);",
    "  return c;",
    "}",
    "void main(){",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec2 uv = frag / uRes;",
    "  float aspect = uRes.x / uRes.y;",
    "  vec3 green = vec3(0.0, 1.0, 0.42);",
    "  vec3 col = vec3(0.008, 0.028, 0.018);",
    // code rain, only above the horizon, dimmed where the text sits
    "  float sky = smoothstep(uHorizon - 0.01, uHorizon + 0.06, uv.y);",
    "  float keep = uWide > 0.5",
    "    ? mix(0.26, 1.0, smoothstep(0.3, 0.64, uv.x))",
    "    : mix(0.34, 0.8, smoothstep(0.18, 0.46, abs(uv.x - 0.5)));",
    "  vec3 r = rain(frag, 11.0 * uPx, 0.75, 1.0, 0.62, 0.8) * 0.34;",
    "  r += rain(frag + vec2(5.0 * uPx, 0.0), 20.0 * uPx, 1.15, 7.0, 0.3, 0.0) * 0.95;",
    "  col += r * sky * keep;",
    // horizon
    "  float dH = uv.y - uHorizon;",
    "  float hzMask = 1.0 - smoothstep(0.05, 0.85, abs(uv.x - uHzX) * 2.0);",
    "  col += green * 0.6 * exp(-abs(dH) * 150.0) * hzMask;",
    "  col += green * 0.09 * exp(-abs(dH) * 11.0) * (0.4 + 0.6 * hzMask);",
    // neon grid floor
    "  if (dH < 0.0) {",
    "    float d = -dH;",
    "    float z = 0.16 / (d + 0.002);",
    "    vec2 g = vec2((uv.x - 0.5) * aspect * z * 1.1, z + uTime * 0.22) * 3.0;",
    "#ifdef HAS_DERIV",
    "    vec2 w = max(fwidth(g), vec2(1e-4));",
    "#else",
    "    vec2 w = vec2(0.02 * z);",
    "#endif",
    "    vec2 ln = abs(fract(g - 0.5) - 0.5) / w;",
    "    float l = 1.0 - clamp(min(ln.x, ln.y), 0.0, 1.0);",
    "    float lod = 1.0 - smoothstep(0.3, 0.95, max(w.x, w.y));",
    "    float fog = smoothstep(0.0, 0.16, d);",
    "    col += green * l * lod * fog * 0.5 * (uWide > 0.5 ? mix(0.3, 1.0, smoothstep(0.25, 0.6, uv.x)) : 0.75);",
    "    col += green * 0.05 * (1.0 - smoothstep(0.0, 0.22, d));",
    "  }",
    // vignette + a whisper of noise
    "  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);",
    "  float vig = smoothstep(1.35, 0.25, length(q * vec2(0.75, 1.2)));",
    "  col *= mix(0.55, 1.0, vig);",
    "  col += (hash21(frag + fract(uTime * 0.71) * 91.0) - 0.5) * 0.02;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  // Mirrored half-width katakana and digits, the film's own alphabet.
  var GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾜ0123456789Z:=*+<>¦";

  function buildGlyphAtlas() {
    var N = 8, S = 64;
    var c = document.createElement("canvas");
    c.width = c.height = N * S;
    var g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 46px 'MS Gothic', 'Yu Gothic', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Noto Sans CJK JP', 'JetBrains Mono', monospace";
    for (var i = 0; i < N * N; i++) {
      var ch = GLYPHS.charAt(i % GLYPHS.length);
      g.save();
      g.translate((i % N) * S + S / 2, Math.floor(i / N) * S + S / 2 + 2);
      g.scale(-1, 1);
      g.fillText(ch, 0, 0);
      g.restore();
    }
    return c;
  }

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
    var fragSrc = (deriv ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n" : "") + RAIN_FRAG;
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

    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildGlyphAtlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, "uGlyphs"), 0);

    var uRes = gl.getUniformLocation(prog, "uRes");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var uHorizon = gl.getUniformLocation(prog, "uHorizon");
    var uHzX = gl.getUniformLocation(prog, "uHzX");
    var uWide = gl.getUniformLocation(prog, "uWide");
    var uPx = gl.getUniformLocation(prog, "uPx");

    // Resolution is CSS pixels times a quality factor that drops if the
    // device struggles.
    var quality = Math.min(window.devicePixelRatio || 1, 1.5);
    if (window.innerWidth < 700) quality = Math.min(quality, 1.25);
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
      gl.uniform1f(uPx, quality);
      // Where the floor meets the sky, measured up from the canvas bottom,
      // and where along it the bright line is centred. On a wide screen the
      // line comes out from behind the clip wall, clear of the headline; on
      // a phone it sits low, behind the wall's cards.
      var wide = window.innerWidth >= 1100;
      gl.uniform1f(uWide, wide ? 1 : 0);
      gl.uniform1f(uHorizon, wide ? 0.3 : 0.22);
      gl.uniform1f(uHzX, wide ? 0.74 : 0.5);
    }
    resize();
    window.addEventListener("resize", resize);

    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible = e.isIntersecting; });
      }).observe(wrap);
    }

    function draw(seconds) {
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (reduceMotion) {
      // One still frame -- redrawn after any resize, because resizing a
      // canvas wipes it.
      draw(40);
      window.addEventListener("resize", function () { draw(40); });
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
        if (frames === 150 && slow > 60 && quality > 0.6) {
          quality = Math.max(0.6, quality * 0.6);
          resize();
        }
      }
      draw((now - start) / 1000 + 20);
    }
    draw(20);
    wrap.classList.add("is-live");
    requestAnimationFrame(frame);
  }
  try { startField(); } catch (err) { /* the CSS backdrop stays */ }

  // ---------------------------------------------------------------------
  // The globe. A spinning dot-map of the world built from the same land
  // outline as the paid report's globe (5-degree bands, blurred and
  // re-thresholded here so the coastlines come out rounded instead of
  // stepped), with a holographic grid, two orbit rings, a scan line, and
  // arcs flying between real cities, each one landing with a ping and a
  // coordinate read-out. Drag it to spin it. The read-out's figures are
  // the calculator's own: 198 countries and the adults in them.
  // ---------------------------------------------------------------------
  var WORLD_LAND_BANDS = [
    [],
    [[-100, -70], [-60, -20]],
    [[-120, -70], [-65, -20], [10, 30], [55, 110]],
    [[-130, -65], [-55, -20], [15, 180]],
    [[-165, -65], [-50, -20], [5, 180]],
    [[-165, -60], [-50, -40], [-25, -13], [5, 180]],
    [[-165, -140], [-135, -55], [-8, -1], [4, 180]],
    [[-130, -55], [-8, 2], [3, 180]],
    [[-125, -60], [-2, 180]],
    [[-125, -70], [-9, 146]],
    [[-122, -75], [-9, -1], [8, 145]],
    [[-118, -79], [-10, 135]],
    [[-115, -80], [-15, 122]],
    [[-110, -88], [-85, -75], [-17, 120]],
    [[-105, -88], [-75, -61], [-17, 40], [42, 55], [72, 92], [94, 110], [120, 126]],
    [[-90, -83], [-73, -60], [-16, 45], [43, 52], [74, 81], [97, 109], [121, 126]],
    [[-83, -60], [-13, 48], [76, 81], [98, 107], [122, 126]],
    [[-79, -50], [8, 46], [100, 119]],
    [[-80, -45], [9, 43], [100, 131]],
    [[-79, -35], [11, 41], [105, 136], [132, 151]],
    [[-77, -35], [12, 41], [118, 151], [126, 145]],
    [[-73, -38], [11, 41], [114, 148]],
    [[-71, -40], [13, 36], [113, 152]],
    [[-73, -48], [15, 33], [113, 153]],
    [[-73, -53], [17, 30], [115, 152]],
    [[-74, -57], [136, 150], [172, 178]],
    [[-75, -63], [144, 149], [170, 176]],
    [[-76, -65]],
    [[-75, -67]],
    [],
    [[-65, -57]],
    [[-180, -58], [-45, 180]],
    [[-180, 180]],
    [[-180, 180]],
    [[-180, 180]],
    [[-180, 180]],
  ];

  var CITIES = [
    [40.71, -74.01, "New York"], [34.05, -118.24, "Los Angeles"], [41.88, -87.63, "Chicago"],
    [29.76, -95.37, "Houston"], [25.76, -80.19, "Miami"], [33.75, -84.39, "Atlanta"],
    [43.65, -79.38, "Toronto"], [19.43, -99.13, "Mexico City"], [4.71, -74.07, "Bogota"],
    [-12.05, -77.04, "Lima"], [-23.55, -46.63, "Sao Paulo"], [-22.91, -43.17, "Rio de Janeiro"],
    [-34.6, -58.38, "Buenos Aires"], [-33.45, -70.67, "Santiago"], [51.51, -0.13, "London"],
    [48.86, 2.35, "Paris"], [40.42, -3.7, "Madrid"], [52.52, 13.4, "Berlin"], [41.9, 12.5, "Rome"],
    [52.37, 4.9, "Amsterdam"], [59.33, 18.07, "Stockholm"], [52.23, 21.01, "Warsaw"],
    [41.01, 28.98, "Istanbul"], [55.76, 37.62, "Moscow"], [30.04, 31.24, "Cairo"],
    [6.52, 3.38, "Lagos"], [5.6, -0.19, "Accra"], [-1.29, 36.82, "Nairobi"],
    [-26.2, 28.05, "Johannesburg"], [25.2, 55.27, "Dubai"], [24.71, 46.68, "Riyadh"],
    [19.08, 72.88, "Mumbai"], [28.61, 77.21, "Delhi"], [13.76, 100.5, "Bangkok"],
    [1.35, 103.82, "Singapore"], [-6.21, 106.85, "Jakarta"], [14.6, 120.98, "Manila"],
    [37.57, 126.98, "Seoul"], [35.68, 139.69, "Tokyo"], [31.23, 121.47, "Shanghai"],
    [-33.87, 151.21, "Sydney"], [-36.85, 174.76, "Auckland"],
  ];

  function unitVec(lat, lon) {
    var la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }

  // 1-degree land mask: the bands laid onto a 360 x 180 grid, box-blurred
  // (wider north-south, where the bands are coarse) and re-thresholded.
  function buildLandMask() {
    var W = 360, H = 180;
    var raw = new Float32Array(W * H);
    for (var y = 0; y < H; y++) {
      var lat = 89.5 - y;
      var spans = WORLD_LAND_BANDS[Math.max(0, Math.min(WORLD_LAND_BANDS.length - 1, Math.floor((90 - lat) / 5)))];
      for (var x = 0; x < W; x++) {
        var lon = -179.5 + x;
        for (var s = 0; s < spans.length; s++) {
          if (lon >= spans[s][0] && lon <= spans[s][1]) { raw[y * W + x] = 1; break; }
        }
      }
    }
    function blur(src, rx, ry) {
      var tmp = new Float32Array(W * H), out = new Float32Array(W * H);
      for (var yy = 0; yy < H; yy++) {
        for (var xx = 0; xx < W; xx++) {
          var sum = 0;
          for (var k = -rx; k <= rx; k++) sum += src[yy * W + ((xx + k + W) % W)];
          tmp[yy * W + xx] = sum / (2 * rx + 1);
        }
      }
      for (var yy2 = 0; yy2 < H; yy2++) {
        for (var xx2 = 0; xx2 < W; xx2++) {
          var sum2 = 0, n = 0;
          for (var k2 = -ry; k2 <= ry; k2++) {
            var y3 = yy2 + k2;
            if (y3 < 0 || y3 >= H) continue;
            sum2 += tmp[y3 * W + xx2];
            n++;
          }
          out[yy2 * W + xx2] = sum2 / n;
        }
      }
      return out;
    }
    var soft = blur(raw, 2, 3);
    return function (lat, lon) {
      var yy = Math.max(0, Math.min(H - 1, Math.floor(90 - lat)));
      var xx = ((Math.floor(lon + 180) % W) + W) % W;
      return soft[yy * W + xx] >= 0.5;
    };
  }

  function startGlobe() {
    var fig = byId("rdGlobe");
    var canvas = byId("rdGlobeCanvas");
    if (!fig || !canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var landAt = buildLandMask();
    var land = [];
    for (var lat = -62; lat <= 84; lat += 2) {
      var ring = Math.max(1, Math.round(180 * Math.cos(lat * Math.PI / 180)));
      for (var i = 0; i < ring; i++) {
        var lon = -180 + (i + 0.5) * 360 / ring;
        if (landAt(lat, lon)) {
          var v = unitVec(lat, lon);
          land.push({ x: v[0], y: v[1], z: v[2], tw: Math.random() * 6.28 });
        }
      }
    }
    var cities = CITIES.map(function (c) {
      return { v: unitVec(c[0], c[1]), lat: c[0], lon: c[1], name: c[2].toUpperCase() };
    });
    // Grid lines, sampled once: meridians every 20 degrees, parallels at
    // +/-60, 40, 20 and the equator.
    var GRID = [];
    var gla, glo, gline;
    for (glo = -180; glo < 180; glo += 20) {
      gline = [];
      for (gla = -90; gla <= 90; gla += 4) gline.push(unitVec(gla, glo));
      GRID.push(gline);
    }
    for (gla = -60; gla <= 60; gla += 20) {
      gline = [];
      for (glo = -180; glo <= 180; glo += 4) gline.push(unitVec(gla, glo));
      GRID.push(gline);
    }

    // The read-out's real figures.
    var adultsItem = byId("rdGlobeAdultsItem");
    var adultsEl = byId("rdGlobeAdults");
    var G = window.QuizGlobalStats;
    if (G && G.COUNTRIES && typeof G.getCountryStats === "function" && adultsEl && adultsItem) {
      var adults = 0;
      Object.keys(G.COUNTRIES).forEach(function (code) {
        var st = G.getCountryStats(code);
        if (st && st.totalAdultPopulation) adults += (st.totalAdultPopulation.men || 0) + (st.totalAdultPopulation.women || 0);
      });
      if (adults > 1e9) {
        adultsEl.textContent = (Math.floor(adults / 1e7) / 100).toFixed(2) + "B";
        adultsItem.hidden = false;
      }
    }
    var coordsEl = byId("rdGlobeCoords");
    var statusEl = byId("rdGlobeStatus");
    // Kept to nine letters or fewer: the read-out box is a third of a
    // phone's width.
    var STATUSES = ["Scanning", "Checking", "Computing", "Matching"];

    var W = 0, dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(W * dpr);
    }

    var TILT = 20 * Math.PI / 180;
    var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    var spin = -1.2;                 // radians
    var spinVel = 0;                 // extra velocity from dragging
    var AUTO = (2 * Math.PI) / 70;   // one turn every 70 s

    // world -> view: spin about the pole, then tilt the north pole towards us
    function view(v, out) {
      var cs = Math.cos(spin), sn = Math.sin(spin);
      var x = v[0] * cs + v[2] * sn;
      var z = -v[0] * sn + v[2] * cs;
      var y = v[1];
      out[0] = x;
      out[1] = y * cosT - z * sinT;
      out[2] = y * sinT + z * cosT;
      return out;
    }

    function slerp(a, b, t) {
      var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      var om = Math.acos(dot);
      if (om < 1e-4) return a.slice();
      var s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
      return [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2];
    }

    var arcs = [];
    var pings = [];
    var nextArc = 0;
    // Arcs land on the face turned towards the viewer, so their pings and
    // read-outs are actually seen rather than spent on the far side.
    function spawnArc(now) {
      var facing = cities.filter(function (c) { return view(c.v, [0, 0, 0])[2] > 0.3; });
      var pool = facing.length >= 2 ? facing : cities;
      var b = pool[(Math.random() * pool.length) | 0];
      var a = b;
      var tries = 0;
      while ((a === b || angleBetween(a.v, b.v) < 0.5 || angleBetween(a.v, b.v) > 2.0) && tries++ < 30) {
        a = cities[(Math.random() * cities.length) | 0];
      }
      if (a === b) return;
      var ang = angleBetween(a.v, b.v);
      arcs.push({
        a: a, b: b, t0: now, dur: 1400 + ang * 700,
        h: 0.12 + ang * 0.12,
        cyan: Math.random() < 0.28,
        pts: null,
      });
    }
    function angleBetween(p, q) {
      return Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
    }

    function orbitPoints(tiltX, yaw, radius) {
      var pts = [];
      for (var k = 0; k <= 120; k++) {
        var th = (k / 120) * Math.PI * 2;
        var x = Math.cos(th), y = 0, z = Math.sin(th);
        var y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
        var z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
        var x2 = x * Math.cos(yaw) + z1 * Math.sin(yaw);
        var z2 = -x * Math.sin(yaw) + z1 * Math.cos(yaw);
        pts.push([x2 * radius, y1 * radius, z2 * radius]);
      }
      return pts;
    }
    var ORBITS = [
      { pts: orbitPoints(1.22, 0.35, 1.16), speed: 0.35, sat: 0 },
      { pts: orbitPoints(1.9, -0.6, 1.3), speed: -0.22, sat: 2.1 },
    ];

    var tmp = [0, 0, 0];
    var lastCall = 0;

    function drawFrame(now, dt) {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);
      var cx = W / 2, cy = W / 2;
      var R = W * 0.335;
      var t = now / 1000;

      // HUD tick ring, slowly turning.
      var ringR = R * 1.43;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.05);
      for (var k = 0; k < 72; k++) {
        var ang = (k / 72) * Math.PI * 2;
        var long = k % 6 === 0;
        var r0 = ringR - (long ? 7 : 3);
        ctx.strokeStyle = long ? "rgba(0,255,106,0.55)" : "rgba(0,255,106,0.22)";
        ctx.lineWidth = long ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
        ctx.lineTo(Math.cos(ang) * ringR, Math.sin(ang) * ringR);
        ctx.stroke();
      }
      ctx.restore();
      // A brighter arc sweeping the other way round the ring.
      ctx.strokeStyle = "rgba(0,255,106,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      var sw = -t * 0.6;
      ctx.arc(cx, cy, ringR + 5, sw, sw + 0.7);
      ctx.stroke();
      ctx.strokeStyle = "rgba(61,242,255,0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, ringR + 5, sw + Math.PI, sw + Math.PI + 0.35);
      ctx.stroke();

      // Atmosphere.
      var atm = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
      atm.addColorStop(0, "rgba(0,255,106,0.26)");
      atm.addColorStop(0.35, "rgba(0,255,106,0.08)");
      atm.addColorStop(1, "rgba(0,255,106,0)");
      ctx.fillStyle = atm;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.28, 0, Math.PI * 2);
      ctx.fill();

      // Orbits: the far half first, the globe covers it, the near half last.
      function drawOrbit(o, front) {
        var rot = t * o.speed;
        ctx.lineWidth = 1;
        for (var k = 0; k < o.pts.length - 1; k++) {
          var p = rotY(o.pts[k], rot), q = rotY(o.pts[k + 1], rot);
          var pv = tiltV(p), qv = tiltV(q);
          var isFront = (pv[2] + qv[2]) / 2 > 0;
          if (isFront !== front) continue;
          ctx.strokeStyle = front ? "rgba(0,255,106,0.35)" : "rgba(0,255,106,0.12)";
          ctx.beginPath();
          ctx.moveTo(cx + pv[0] * R, cy - pv[1] * R);
          ctx.lineTo(cx + qv[0] * R, cy - qv[1] * R);
          ctx.stroke();
        }
        // satellite
        var idx = Math.floor(((o.sat + t * 0.08 * (o.speed > 0 ? 1 : -1)) % 1 + 1) % 1 * (o.pts.length - 1));
        var sp = tiltV(rotY(o.pts[idx], rot));
        if ((sp[2] > 0) === front) {
          ctx.fillStyle = front ? "#b8ffd8" : "rgba(0,255,106,0.35)";
          ctx.shadowColor = "#00ff6a";
          ctx.shadowBlur = front ? 12 : 0;
          ctx.fillRect(cx + sp[0] * R - 2, cy - sp[1] * R - 2, 4, 4);
          ctx.shadowBlur = 0;
        }
      }
      function rotY(p, a) {
        var cs = Math.cos(a), sn = Math.sin(a);
        return [p[0] * cs + p[2] * sn, p[1], -p[0] * sn + p[2] * cs];
      }
      function tiltV(p) {
        return [p[0], p[1] * cosT - p[2] * sinT, p[1] * sinT + p[2] * cosT];
      }
      ORBITS.forEach(function (o) { drawOrbit(o, false); });

      // The globe body: dark, with a lit rim.
      var body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      body.addColorStop(0, "rgba(0,40,22,0.96)");
      body.addColorStop(0.75, "rgba(1,14,8,0.97)");
      body.addColorStop(1, "rgba(0,60,30,0.95)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Holographic grid: meridians and parallels every 20 degrees.
      ctx.strokeStyle = "rgba(0,255,106,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      GRID.forEach(function (line) {
        var pen = false;
        for (var gi2 = 0; gi2 < line.length; gi2++) {
          view(line[gi2], tmp);
          if (tmp[2] > 0) {
            if (pen) ctx.lineTo(cx + tmp[0] * R, cy - tmp[1] * R);
            else ctx.moveTo(cx + tmp[0] * R, cy - tmp[1] * R);
            pen = true;
          } else pen = false;
        }
      });
      ctx.stroke();

      // Scan line sweeping down the face.
      var scanPhase = (t % 4.2) / 4.2;
      var scanY = cy - R + scanPhase * 2 * R;

      // Land dots, bucketed by brightness so the canvas state changes a
      // dozen times a frame instead of thousands.
      var buckets = [];
      for (var bk = 0; bk < 12; bk++) buckets.push([]);
      var ds = Math.max(1.3, R * 0.0125);
      var cs = Math.cos(spin), sn = Math.sin(spin);
      for (var n = 0; n < land.length; n++) {
        var pt = land[n];
        // view() inlined: this runs for every land dot, every frame.
        var vx = pt.x * cs + pt.z * sn;
        var z0 = -pt.x * sn + pt.z * cs;
        var vy = pt.y * cosT - z0 * sinT;
        var vz = pt.y * sinT + z0 * cosT;
        if (vz <= 0.02) continue;
        var sx = cx + vx * R, sy = cy - vy * R;
        var bright = 0.2 + 0.8 * Math.pow(vz, 0.7);
        bright *= 0.82 + 0.18 * Math.sin(t * 2.2 + pt.tw);
        bright += 0.6 * Math.exp(-Math.abs(sy - scanY) / (R * 0.035));
        var b = Math.max(0, Math.min(11, Math.floor(bright * 11)));
        buckets[b].push(sx, sy);
      }
      for (var bi = 0; bi < 12; bi++) {
        var arr = buckets[bi];
        if (!arr.length) continue;
        var al = (bi + 1) / 12;
        ctx.fillStyle = bi >= 10 ? "rgba(190,255,215," + al.toFixed(2) + ")" : "rgba(0,255,106," + al.toFixed(2) + ")";
        ctx.beginPath();
        for (var ai = 0; ai < arr.length; ai += 2) ctx.rect(arr[ai] - ds / 2, arr[ai + 1] - ds / 2, ds, ds);
        ctx.fill();
      }

      // The scan line itself, a chord across the disc.
      var half = Math.sqrt(Math.max(0, R * R - (scanY - cy) * (scanY - cy)));
      if (half > 2) {
        var sg = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
        sg.addColorStop(0, "rgba(0,255,106,0)");
        sg.addColorStop(0.5, "rgba(0,255,106,0.55)");
        sg.addColorStop(1, "rgba(0,255,106,0)");
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - half, scanY);
        ctx.lineTo(cx + half, scanY);
        ctx.stroke();
      }

      // Rim.
      ctx.strokeStyle = "rgba(0,255,106,0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Arcs between cities.
      if (!reduceMotion && now >= nextArc) {
        if (arcs.length < 9) spawnArc(now);
        nextArc = now + 520 + Math.random() * 520;
      }
      var SEG = 44;
      for (var ar = arcs.length - 1; ar >= 0; ar--) {
        var A = arcs[ar];
        if (!A.pts) {
          A.pts = [];
          for (var s2 = 0; s2 <= SEG; s2++) {
            var u = s2 / SEG;
            var g2 = slerp(A.a.v, A.b.v, u);
            var lift = 1 + A.h * Math.sin(Math.PI * u);
            A.pts.push([g2[0] * lift, g2[1] * lift, g2[2] * lift]);
          }
        }
        var prog = (now - A.t0) / A.dur;
        var headU = Math.min(1, prog);
        var tailU = Math.max(0, Math.min(1, prog - 0.45));
        var fadeOut = prog > 1.45 ? Math.max(0, 1 - (prog - 1.45) / 0.4) : 1;
        if (fadeOut <= 0) { arcs.splice(ar, 1); continue; }
        var headI = Math.floor(headU * SEG), tailI = Math.floor(tailU * SEG);
        var color = A.cyan ? "61,242,255" : "0,255,106";
        ctx.lineWidth = 1.6;
        for (var sI = tailI; sI < headI; sI++) {
          var P = view(A.pts[sI], [0, 0, 0]), Q = view(A.pts[sI + 1], [0, 0, 0]);
          if (!arcVisible(P) || !arcVisible(Q)) continue;
          var along = (sI - tailI) / Math.max(1, headI - tailI);
          ctx.strokeStyle = "rgba(" + color + "," + (0.1 + 0.85 * along) * fadeOut + ")";
          ctx.beginPath();
          ctx.moveTo(cx + P[0] * R, cy - P[1] * R);
          ctx.lineTo(cx + Q[0] * R, cy - Q[1] * R);
          ctx.stroke();
        }
        // the travelling head
        if (prog < 1) {
          var H = view(A.pts[headI], [0, 0, 0]);
          if (arcVisible(H)) {
            ctx.fillStyle = "#eafff2";
            ctx.shadowColor = A.cyan ? "#3df2ff" : "#00ff6a";
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(cx + H[0] * R, cy - H[1] * R, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        } else if (!A.landed) {
          A.landed = true;
          pings.push({ c: A.b, t0: now, cyan: A.cyan, label: now - lastCall > 1500 });
          if (now - lastCall > 1500) lastCall = now;
          if (coordsEl) coordsEl.textContent = fmtCoord(A.b.lat, "N", "S") + " " + fmtCoord(A.b.lon, "E", "W");
        }
      }

      // Pings and their read-outs.
      for (var pi = pings.length - 1; pi >= 0; pi--) {
        var pg = pings[pi];
        var age = (now - pg.t0) / 1000;
        if (age > 2.6) { pings.splice(pi, 1); continue; }
        var pv = view(pg.c.v, [0, 0, 0]);
        if (pv[2] <= 0.05) continue;
        var px = cx + pv[0] * R, py = cy - pv[1] * R;
        var col2 = pg.cyan ? "61,242,255" : "0,255,106";
        for (var rr = 0; rr < 2; rr++) {
          var ra = ((age - rr * 0.35) / 1.2);
          if (ra < 0 || ra > 1) continue;
          ctx.strokeStyle = "rgba(" + col2 + "," + (1 - ra) * 0.9 + ")";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(px, py, 3 + ra * R * 0.1, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(" + col2 + ",1)";
        ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
        if (pg.label && age < 2.4) {
          var la2 = age < 0.25 ? age / 0.25 : age > 2.0 ? (2.4 - age) / 0.4 : 1;
          var lx = px + 18, ly = py - 22;
          ctx.strokeStyle = "rgba(0,255,106," + 0.7 * la2 + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 3, py - 3);
          ctx.lineTo(lx, ly);
          ctx.lineTo(lx + 10, ly);
          ctx.stroke();
          ctx.font = "600 " + Math.max(10, Math.round(W * 0.021)) + "px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(234,255,242," + la2 + ")";
          ctx.fillText(pg.c.name, lx + 14, ly + 4);
          ctx.font = "500 " + Math.max(9, Math.round(W * 0.017)) + "px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(0,255,106," + 0.85 * la2 + ")";
          ctx.fillText(fmtCoord(pg.c.lat, "N", "S") + " " + fmtCoord(pg.c.lon, "E", "W"), lx + 14, ly + 4 + Math.max(12, W * 0.026));
        }
      }

      ORBITS.forEach(function (o) { drawOrbit(o, true); });

      // Spin: steady, plus whatever a drag added, easing back.
      spin += (AUTO + spinVel) * dt;
      spinVel *= Math.pow(0.05, dt);
    }

    function arcVisible(p) {
      return p[2] > -0.02 || (p[0] * p[0] + p[1] * p[1]) > 1.0;
    }
    function fmtCoord(v, pos, neg) {
      var a = Math.abs(v).toFixed(2);
      if (Math.abs(v) < 10) a = "0" + a;
      return a + "°" + (v >= 0 ? pos : neg);
    }

    size();
    fig.hidden = false;
    size();
    window.addEventListener("resize", size);

    // Drag to spin. touch-action: pan-y on the stage keeps page scrolling
    // working on phones; only a sideways drag turns the globe.
    var stage = canvas.parentNode;
    var dragging = false, lastX = 0, lastT = 0;
    stage.addEventListener("pointerdown", function (e) {
      dragging = true;
      lastX = e.clientX;
      lastT = performance.now();
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var nowT = performance.now();
      var dx = e.clientX - lastX;
      var dtt = Math.max(8, nowT - lastT) / 1000;
      var turn = dx / Math.max(120, W * 0.7);
      spin += turn;
      spinVel = turn / dtt * 0.6;
      lastX = e.clientX;
      lastT = nowT;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      stage.addEventListener(ev, function () { dragging = false; });
    });

    var statusIndex = 0;
    if (statusEl && !reduceMotion) {
      setInterval(function () {
        if (document.hidden) return;
        statusIndex = (statusIndex + 1) % STATUSES.length;
        statusEl.textContent = STATUSES[statusIndex];
      }, 2600);
    }

    if (reduceMotion) {
      // A still frame with a few arcs caught mid-flight, redrawn after any
      // resize, because resizing a canvas wipes it.
      var t0 = performance.now();
      for (var q2 = 0; q2 < 5; q2++) {
        spawnArc(t0);
        if (arcs.length) arcs[arcs.length - 1].t0 = t0 - arcs[arcs.length - 1].dur * 0.99;
      }
      drawFrame(t0, 0);
      window.addEventListener("resize", function () { drawFrame(t0, 0); });
      return;
    }

    var visible = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible = e.isIntersecting; });
      }, { rootMargin: "80px 0px" }).observe(fig);
    } else {
      visible = true;
    }
    var prev = performance.now();
    function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!visible || document.hidden) return;
      drawFrame(now, dt);
    }
    requestAnimationFrame(loop);
  }
  try { startGlobe(); } catch (err) { /* the figure stays hidden */ }

  // Web fonts change nothing about the grid, but they can land after
  // script.js measured the sliders; a resize makes it re-place the bubbles.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      window.dispatchEvent(new Event("resize"));
    });
  }
})();
