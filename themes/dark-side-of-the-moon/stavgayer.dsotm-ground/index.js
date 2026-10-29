// The prism. A thin white beam comes in from the left, enters an equilateral
// glass prism and leaves its right face as a spectrum of six flat bands: red,
// orange, yellow, green, blue and violet (there is no indigo). The prism is not
// drawn with a stroke: its edges are light caught in the glass, a grainy glow
// that is brightest at the rim and fades inward, and a white fan of light
// widens inside from where the beam enters to where the colours leave.
//
// The light carries the state of your agents:
//   rest (nothing runs, and the second display): the picture as it is, six
//         bands running off the right edge. Now and then a heartbeat passes
//         slowly along the bands and is gone;
//   work: each task owns one band in its agent's colour (Claude red, Codex
//         blue, Cursor yellow-green, others the colours left). The bands fan out
//         from the prism to the cards, which stand at their ends like a legend,
//         and a busier task has a wider band. The white beam shimmers a little;
//   done: a finished task's band thins and turns back toward white light;
//         when all are done the fan is faint and quiet;
//   call: an agent waits: the spectrum folds into one beam in that agent's
//         colour that runs across the screen, and the prism glows with it.
//
// It is one WebGL draw of one triangle over the screen: every pixel works out
// what light falls on it from a few numbers per band. It draws every frame,
// 30 a second (option fps), while something changes or moves, and a third of
// them while the light stands still, at half the screen's pixels (option scale)
// but never less than one pixel per point, so the edges stay crisp, and not at
// all while the page is hidden. The slow sway of the prism against burn-in is
// part of the same draw, so it glides instead of stepping once a second; the
// far ends of the bands stay at the cards, which do not sway. With reduced
// motion it is drawn once per change: no heartbeat, no shimmer, no sway.
(function () {
  // ---- shared with the board and the rings: keep these in step ----
  var MAX_CARDS = 7;
  // The six bands, top to bottom, in their print colours. Text gets a lighter tint so it reads on black.
  var BANDS = [
    { band: "#d2242e", text: "#ff6a5c" },
    { band: "#e17c26", text: "#f39a4c" },
    { band: "#f9dd00", text: "#f9dd00" },
    { band: "#57a243", text: "#82c86b" },
    { band: "#009ad1", text: "#3cb8ee" },
    { band: "#6e5f96", text: "#a99ad8" },
  ];
  var OWN = {
    claude: { rank: 0, band: "#d2242e", text: "#ff6a5c" },
    cursor: { rank: 2.5, band: "#b4c61c", text: "#cddc3c" },
    codex: { rank: 4, band: "#009ad1", text: "#3cb8ee" },
  };
  var SPARE = [1, 2, 3, 5]; // orange, yellow, green, violet

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function hueOf(source) {
    if (has(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    var at = SPARE[Math.abs(hash) % SPARE.length];
    return { rank: at, band: BANDS[at].band, text: BANDS[at].text };
  }

  // The cards in the order of the spectrum, red at the top; ties keep their order.
  function ordered(cards) {
    return cards
      .map(function (card, index) { return { card: card, index: index, hue: hueOf(card.source) }; })
      .sort(function (a, b) { return a.hue.rank - b.hue.rank || a.index - b.index; });
  }

  // The picture in screen px. The prism, the beam and the bands keep the
  // proportions of the 1973 sleeve on a square as tall as the screen, set a
  // little left of the middle; the beam and the bands run on to the edges.
  function geometry(w, h, n) {
    var k = h / 900, ox = 0.38 * w - 450 * k;
    var g = { w: w, h: h, k: k, vmin: Math.min(w, h) / 100, side: 280 * k };
    function at(x, y) { return [ox + x * k, y * k]; }
    g.A = at(450, 223);
    g.L = at(312, 467);
    g.R = at(592, 467);
    g.E = at(388, 335); // where the beam enters the left face
    g.beamSlope = -98 / 388;
    g.face = function (u) { return [g.R[0] + (g.A[0] - g.R[0]) * u, g.R[1] + (g.A[1] - g.R[1]) * u]; };
    g.uTop = 0.642; // the top of the red, on the right face, from its foot (0) to the apex (1)
    g.uBot = 0.406; // the foot of the violet
    g.slope = function (f) { return 0.153 + 0.095 * f; }; // the bands fan a little as they fall
    var mid = g.face(0.524);
    g.mid = mid;
    g.lineAt = function (x) { return mid[1] + (x - mid[0]) * 0.2; }; // the middle of the spectrum
    g.colL = 0.64 * w;
    g.colR = 0.955 * w;
    g.callL = 0.56 * w;
    var shown = Math.min(n, MAX_CARDS), top = 0.14 * h, bottom = 0.95 * h, gap = 1.2 * g.vmin;
    var slot = shown ? Math.min(0.16 * h, (bottom - top - (shown - 1) * gap) / shown) : 0;
    var total = shown * slot + Math.max(0, shown - 1) * gap;
    var centre = Math.min(bottom - total / 2, Math.max(top + total / 2, g.lineAt(g.colL)));
    g.slots = [];
    for (var i = 0; i < shown; i++) {
      var y = centre - total / 2 + i * (slot + gap);
      g.slots.push({ top: y, height: slot, mid: y + slot / 2 });
    }
    return g;
  }
  // ---- end of the shared part ----

  var DRIFT_S = 240;
  var MAX_BANDS = 8;
  var FIELD = [0.035, 0.051, 0.047]; // #090d0c, the black of the sleeve
  var PALE = [0.86, 0.89, 0.9];
  var BEAT_PERIOD = 26; // seconds between heartbeats at rest
  var BEAT_RUN = 10; // seconds one heartbeat takes to cross
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function mix3(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function driftAt(nowMs, vmin) {
    if (reduce.matches) return { x: 0, y: 0 };
    var t = (nowMs / 1000 / DRIFT_S) * Math.PI;
    return { x: 1.0 * vmin * Math.sin(t), y: 0.45 * vmin * Math.sin(0.73 * t + 1) };
  }

  function waitingOf(cards) {
    return cards.filter(function (card) { return card.kind === "approval"; }).sort(function (a, b) {
      return (a.approval_since_ms || Infinity) - (b.approval_since_ms || Infinity);
    });
  }

  // How busy a task is, 0 to 1: it grows with the time it has run, full after 40 minutes.
  function busyOf(card, nowMs) {
    if (card.kind === "finished") return 0;
    if (card.kind !== "running") return 0.35;
    var ran = Math.max(0, nowMs - card.started_at_ms);
    return Math.sqrt(Math.min(1, ran / (40 * 60000)));
  }

  var VERTEX = [
    "#version 300 es",
    "in vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }",
  ].join("\n");

  var FRAGMENT = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uSize;", // canvas size in device px
    "uniform float uRatio, uMargin, uTime, uVmin, uSide, uBeamW;",
    "uniform vec2 uL, uR, uA, uE, uB0, uFanA, uFanB, uShift;", // uShift: the sway against burn-in, css px
    "uniform vec4 uLight;", // incoming beam, rim, call glow, shimmer
    "uniform vec3 uHot, uField;",
    "uniform vec4 uBeat;", // amount, position x, height px, half width px
    "uniform int uCount;",
    "uniform vec4 uBA[" + MAX_BANDS + "];", // exit top xy, exit foot xy (on the right face)
    "uniform vec4 uBB[" + MAX_BANDS + "];", // far x, far top y, far foot y, reach 0..1
    "uniform vec4 uBC[" + MAX_BANDS + "];", // colour, alpha
    "uniform vec4 uBD[" + MAX_BANDS + "];", // glow, white core
    "out vec4 outColor;",
    "float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }",
    // signed distance to the line a->b, positive on its left when y points down
    "float side(vec2 p, vec2 a, vec2 b) { vec2 d = normalize(b - a); return (p.x - a.x) * d.y - (p.y - a.y) * d.x; }",
    "float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * t); }",
    // coverage of the side where d > 0, one device pixel wide at any size or slope
    "float cover(float d) { return clamp(d / max(fwidth(d), 1e-4) + 0.5, 0.0, 1.0); }",
    // one beat of a heart monitor, in half widths around the spike
    "float ecg(float u) {",
    "  return 0.10 * exp(-pow((u + 0.6) / 0.11, 2.0)) - 0.14 * exp(-pow((u + 0.1) / 0.04, 2.0)) + exp(-pow(u / 0.045, 2.0))",
    "    - 0.32 * exp(-pow((u - 0.1) / 0.05, 2.0)) + 0.2 * exp(-pow((u - 0.5) / 0.13, 2.0));",
    "}",
    "void main() {",
    "  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uRatio - uMargin - uShift;",
    "  vec3 col = uField;",
    "  float e1 = side(p, uL, uR), e2 = side(p, uR, uA), e3 = side(p, uA, uL);",
    "  float de = min(e1, min(e2, e3));",
    "  float inside = cover(de);",
    // the spectrum: flat, hard-edged bands that start on the right face
    "  float beat = uBeat.x * uBeat.z * ecg((p.x - uBeat.y) / uBeat.w);",
    "  vec2 q = vec2(p.x, p.y + beat);",
    "  float out2 = cover(-e2);",
    "  for (int i = 0; i < " + MAX_BANDS + "; i++) {",
    "    if (i >= uCount) break;",
    "    vec4 A = uBA[i], B = uBB[i], C = uBC[i], D = uBD[i];",
    "    float yt = A.y + (B.y - A.y) * (q.x - A.x) / max(1.0, B.x - A.x);",
    "    float yb = A.w + (B.z - A.w) * (q.x - A.z) / max(1.0, B.x - A.z);",
    "    float dIn = min(q.y - yt, yb - q.y);",
    "    float xEnd = mix(min(A.x, A.z), B.x, B.w);",
    "    float run = cover(xEnd - q.x) * out2;",
    "    float c = cover(dIn) * run * C.a;",
    "    col = mix(col, C.rgb, c);",
    "    float hw = max(0.5, 0.5 * (yb - yt));",
    "    float yc = 0.5 * (yt + yb);",
    "    col = mix(col, vec3(1.0), D.y * c * exp(-pow((q.y - yc) / (hw * 0.55), 2.0)));",
    "    col += C.rgb * D.x * C.a * run * 0.5 * exp(-max(-dIn, 0.0) / (1.6 * uVmin)) * (1.0 - cover(dIn));",
    "  }",
    // the prism: light caught at its rim, grainy, fading inward; no stroke
    "  float grain = hash(floor(gl_FragCoord.xy));",
    "  float di = max(de, 0.0);", // outside the glass the glow is not drawn; keep exp() finite there
    "  vec3 rim = vec3(0.7 * exp(-di / (0.025 * uSide)), 0.73 * exp(-di / (0.034 * uSide)), 0.77 * exp(-di / (0.039 * uSide)));",
    // the red leaves first, so the glow turns teal as it fades inward, as on the sleeve
    "  vec3 hotRim = (uHot * 0.8 + 0.2) * 0.8 * exp(-di / (0.04 * uSide));",
    "  vec3 rimCol = mix(rim, hotRim, 0.75 * uLight.z) * (1.0 + 0.3 * uLight.z);",
    "  float v = (0.6 + 0.8 * grain) * uLight.y;",
"  col += rimCol * v * inside;",
    // the white fan inside, from where the beam enters to where the colours leave
    "  float ft = uE.y + (uFanA.y - uE.y) * (p.x - uE.x) / max(1.0, uFanA.x - uE.x);",
    "  float fb = uE.y + (uFanB.y - uE.y) * (p.x - uE.x) / max(1.0, uFanB.x - uE.x);",
    "  float fan = cover(min(p.y - ft, fb - p.y)) * cover(e2) * cover(p.x - uE.x);",
    "  float t = clamp((p.x - uE.x) / max(1.0, 0.5 * (uFanA.x + uFanB.x) - uE.x), 0.0, 1.0);",
    "  float g2 = hash(floor(gl_FragCoord.xy) + 17.31);",
    "  float lit = mix(0.92, 0.3, pow(t, 0.7)) * (1.0 + uLight.w * 0.07 * sin(t * 12.0 - uTime * 1.6));",
    "  lit *= mix(1.0, 0.55 + 0.9 * g2, smoothstep(0.08, 0.8, t));",
    "  vec3 fanCol = mix(vec3(0.97, 0.98, 0.98), uHot * 0.7 + 0.3, 0.55 * uLight.z);",
    "  col += fanCol * lit * fan;",
    // the glow of a call around the glass
    "  col += uHot * uLight.z * 0.2 * exp(-max(-de, 0.0) / (2.2 * uVmin)) * (1.0 - inside);",
    // the incoming beam: a crisp white line, no glow
    "  float d = seg(p, uB0, uE);",
    "  vec2 dir = normalize(uE - uB0);",
    "  float shimmer = 1.0 - uLight.w * 0.07 * (0.5 + 0.5 * sin(dot(p - uE, dir) * 0.025 + uTime * 2.2));",
    "  float line = cover(0.5 * uBeamW - d) * (1.0 - inside);",
    "  col = mix(col, vec3(0.98) * shimmer, line * uLight.x);",
    "  col += vec3(0.8) * uLight.z * 0.1 * exp(-d / (0.9 * uVmin)) * (1.0 - line);",
    "  col += (hash(gl_FragCoord.xy * 1.37 + 3.1) - 0.5) / 255.0;",
    "  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);",
    "}",
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader failed");
    return shader;
  }

  var STYLE = [
    ".dsg { position: absolute; inset: 0; overflow: hidden; background: #090d0c; }",
    ".dsg canvas { position: absolute; display: block; }",
  ].join("\n");

  var GEO = ["ax", "ay", "bx", "by", "fx", "ft", "fb"];
  var LOOK = ["r", "g", "b", "a", "glow", "core"];

  window.agentScreensaver.register(function () {
    var box, surface, style, lastState, geo, mood = "", ctxRef;
    var gl, program, uniforms = {}, cancelFrame, lastMs, seconds = 0, tick = 0;
    var fps = 30, scale = 0.5, ratio = 1, margin = 0, dirty = true, moving = true;
    var bands = new Map(); // key -> { cur, goal, reach, vel, goalReach, order }
    var light = { cur: { beam: 1, rim: 1, glow: 0, shimmer: 0 }, goal: { beam: 1, rim: 1, glow: 0, shimmer: 0 } };
    var hot = { cur: [1, 1, 1], goal: [1, 1, 1] };
    var fan = { cur: [0, 0, 0, 0], goal: [0, 0, 0, 0] };
    var beatOn = false;
    var dataA = new Float32Array(MAX_BANDS * 4), dataB = new Float32Array(MAX_BANDS * 4);
    var dataC = new Float32Array(MAX_BANDS * 4), dataD = new Float32Array(MAX_BANDS * 4);

    function size() {
      return { w: box.clientWidth || window.innerWidth, h: box.clientHeight || window.innerHeight };
    }

    function moodOf(state) {
      if (state.display !== "main" || state.cards.length === 0) return "rest";
      if (waitingOf(state.cards).length > 0) return "call";
      return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "done";
    }

    function want(key, goal, order) {
      var band = bands.get(key);
      if (!band) {
        band = { cur: {}, goal: {}, reach: 0, vel: 0, goalReach: 1, order: order };
        // A new band starts at the prism with its own shape and grows out to its end.
        Object.keys(goal).forEach(function (name) { band.cur[name] = goal[name]; });
        bands.set(key, band);
      }
      band.goal = goal;
      band.goalReach = 1;
      band.order = order;
      band.kept = true;
      return band;
    }

    function coverBands(g, alpha) {
      for (var j = 0; j < 6; j++) {
        var f0 = j / 6, f1 = (j + 1) / 6;
        var a = g.face(g.uTop + (g.uBot - g.uTop) * f0), b = g.face(g.uTop + (g.uBot - g.uTop) * f1);
        var fx = g.w * 1.06;
        var c = rgbOf(BANDS[j].band);
        want("sleeve" + j, { ax: a[0], ay: a[1], bx: b[0], by: b[1], fx: fx, ft: a[1] + g.slope(f0) * (fx - a[0]),
          fb: b[1] + g.slope(f1) * (fx - b[0]), r: c[0], g: c[1], b: c[2], a: alpha, glow: 0, core: 0 }, j);
      }
    }

    function draw(state) {
      if (!box) return;
      var s = size();
      var next = moodOf(state);
      bands.forEach(function (band) { band.kept = false; });
      geo = geometry(s.w, s.h, next === "rest" ? 0 : state.cards.length);
      var g = geo;
      var span = [g.face(g.uTop), g.face(g.uBot)];
      fan.goal = [span[0][0], span[0][1], span[1][0], span[1][1]];
      light.goal = { beam: 1, rim: 1, glow: 0, shimmer: 0 };
      if (next === "rest") {
        coverBands(g, 1);
      } else {
        var list = ordered(state.cards).slice(0, MAX_CARDS);
        var waiting = next === "call" ? waitingOf(state.cards)[0] : undefined;
        var weights = list.map(function (entry) {
          var busy = busyOf(entry.card, state.nowMs);
          return entry.card.kind === "finished" ? 0.28 : 0.5 + busy;
        });
        var sum = weights.reduce(function (x, y) { return x + y; }, 0) || 1, at = 0;
        list.forEach(function (entry, i) {
          var card = entry.card, slot = g.slots[i];
          var f0 = at / sum, f1 = (at + weights[i]) / sum;
          at += weights[i];
          var a = g.face(g.uTop + (g.uBot - g.uTop) * f0), b = g.face(g.uTop + (g.uBot - g.uTop) * f1);
          var busy = busyOf(card, state.nowMs), done = card.kind === "finished";
          var thick = (done ? 0.006 : 0.012 + 0.032 * busy) * g.h;
          var c = rgbOf(entry.hue.band), alpha = 1;
          if (done) {
            c = mix3(c, PALE, 0.72);
            alpha = next === "done" ? 0.42 : 0.7;
          }
          want(card.source + "\u0000" + card.session, { ax: a[0], ay: a[1], bx: b[0], by: b[1], fx: g.colL,
            ft: slot.mid - thick / 2, fb: slot.mid + thick / 2, r: c[0], g: c[1], b: c[2], a: alpha, glow: 0, core: 0 }, i);
        });
        if (next === "work") light.goal.shimmer = reduce.matches ? 0 : 1;
        if (waiting) {
          // The spectrum folds into one beam in the waiting agent's colour.
          var hue = rgbOf(hueOf(waiting.source).band);
          var top = g.face(0.562), foot = g.face(0.486), fx = g.w * 1.06, th = 2.4 * g.vmin;
          var beam = { ax: top[0], ay: top[1], bx: foot[0], by: foot[1], fx: fx, ft: g.lineAt(fx) - th / 2, fb: g.lineAt(fx) + th / 2 };
          var key = waiting.source + "\u0000" + waiting.session;
          bands.forEach(function (band, k) {
            if (!band.kept) return;
            var goal = {};
            GEO.forEach(function (name) { goal[name] = beam[name]; });
            goal.r = band.goal.r; goal.g = band.goal.g; goal.b = band.goal.b; goal.a = 0; goal.glow = 0; goal.core = 0;
            if (k === key) { goal.r = hue[0]; goal.g = hue[1]; goal.b = hue[2]; goal.a = 1; goal.glow = 1; goal.core = 0.3; }
            band.goal = goal;
          });
          if (!bands.has(key)) {
            var made = want(key, Object.assign({}, beam, { r: hue[0], g: hue[1], b: hue[2], a: 1, glow: 1, core: 0.3 }), 0);
            made.reach = 0;
          }
          bands.get(key).order = -1;
          fan.goal = [top[0], top[1], foot[0], foot[1]];
          hot.goal = hue;
          light.goal.glow = 1;
          light.goal.rim = 1.15;
        }
      }
      // Bands no longer wanted fade where they are.
      bands.forEach(function (band) {
        if (!band.kept) { band.goal = Object.assign({}, band.goal, { a: 0, glow: 0, core: 0 }); band.goalReach = band.reach; }
      });
      beatOn = next === "rest" && !reduce.matches;
      if (mood === "" || reduce.matches) settle();
      mood = next;
      dirty = true;
    }

    function settle() {
      bands.forEach(function (band) {
        Object.keys(band.goal).forEach(function (name) { band.cur[name] = band.goal[name]; });
        band.reach = band.goalReach;
        band.vel = 0;
      });
      light.cur = Object.assign({}, light.goal);
      hot.cur = hot.goal.slice();
      fan.cur = fan.goal.slice();
      prune();
    }

    function prune() {
      bands.forEach(function (band, key) {
        if (!band.kept && band.cur.a < 0.004) bands.delete(key);
      });
    }

    function ease(now, goal, ms, tau) {
      return goal + (now - goal) * Math.exp(-Math.max(0, ms) / tau);
    }

    // Returns true while something still moves.
    function step(ms) {
      var dt = Math.min(0.1, ms / 1000), still = true;
      bands.forEach(function (band) {
        GEO.forEach(function (name) {
          var was = band.cur[name];
          band.cur[name] = ease(was, band.goal[name], ms, 260);
          if (Math.abs(band.cur[name] - band.goal[name]) > 0.15) still = false;
        });
        LOOK.forEach(function (name) {
          band.cur[name] = ease(band.cur[name], band.goal[name], ms, band.goal.a < band.cur.a ? 240 : 420);
          if (Math.abs(band.cur[name] - band.goal[name]) > 0.003) still = false;
        });
        // A band shoots out from the prism on a spring, with a hair of overshoot.
        var acc = 110 * (band.goalReach - band.reach) - 17 * band.vel;
        band.vel += acc * dt;
        band.reach += band.vel * dt;
        if (Math.abs(band.reach - band.goalReach) > 0.002 || Math.abs(band.vel) > 0.01) still = false;
      });
      Object.keys(light.goal).forEach(function (name) {
        light.cur[name] = ease(light.cur[name], light.goal[name], ms, 380);
        if (Math.abs(light.cur[name] - light.goal[name]) > 0.003) still = false;
      });
      for (var i = 0; i < 4; i++) {
        fan.cur[i] = ease(fan.cur[i], fan.goal[i], ms, 260);
        if (Math.abs(fan.cur[i] - fan.goal[i]) > 0.15) still = false;
        if (i < 3) hot.cur[i] = ease(hot.cur[i], hot.goal[i], ms, 300);
      }
      prune();
      return !still;
    }

    function beatNow() {
      if (!beatOn || !geo) return { amount: 0, x: 0, active: false };
      var phase = (seconds + BEAT_PERIOD - 12) % BEAT_PERIOD; // the first one comes 12 s after the start
      if (phase > BEAT_RUN) return { amount: 0, x: 0, active: false };
      var from = geo.mid[0] - 12 * geo.vmin, to = geo.w * 1.06 + 12 * geo.vmin;
      var amount = Math.min(1, phase / 0.6, (BEAT_RUN - phase) / 0.6);
      return { amount: amount, x: from + (to - from) * (phase / BEAT_RUN), active: true };
    }

    function render() {
      if (!gl || !surface || !geo) return;
      var g = geo;
      var list = Array.from(bands.values()).sort(function (a, b) { return a.order - b.order; }).slice(0, MAX_BANDS);
      // the beam of a call is drawn last, over the bands folding into it
      list.sort(function (a, b) { return (a.goal.glow > 0.5 ? 1 : 0) - (b.goal.glow > 0.5 ? 1 : 0); });
      // The prism sways; the far ends of the bands stay where the cards stand,
      // since the words do not sway.
      var shift = driftAt(Date.now(), g.vmin);
      for (var i = 0; i < MAX_BANDS; i++) {
        var band = list[i], at = i * 4;
        if (!band) { dataC[at + 3] = 0; continue; }
        var c = band.cur;
        dataA[at] = c.ax; dataA[at + 1] = c.ay; dataA[at + 2] = c.bx; dataA[at + 3] = c.by;
        dataB[at] = c.fx - shift.x; dataB[at + 1] = c.ft - shift.y; dataB[at + 2] = c.fb - shift.y; dataB[at + 3] = Math.max(0, band.reach);
        dataC[at] = c.r; dataC[at + 1] = c.g; dataC[at + 2] = c.b; dataC[at + 3] = Math.max(0, Math.min(1, c.a));
        dataD[at] = c.glow; dataD[at + 1] = c.core;
      }
      var beat = beatNow();
      gl.viewport(0, 0, surface.width, surface.height);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uSize, surface.width, surface.height);
      gl.uniform1f(uniforms.uRatio, ratio);
      gl.uniform1f(uniforms.uMargin, margin);
      gl.uniform2f(uniforms.uShift, shift.x, shift.y);
      gl.uniform1f(uniforms.uTime, seconds);
      gl.uniform1f(uniforms.uVmin, g.vmin);
      gl.uniform1f(uniforms.uSide, g.side);
      gl.uniform1f(uniforms.uBeamW, Math.max(1.6, 3.3 * g.k));
      gl.uniform2f(uniforms.uL, g.L[0], g.L[1]);
      gl.uniform2f(uniforms.uR, g.R[0], g.R[1]);
      gl.uniform2f(uniforms.uA, g.A[0], g.A[1]);
      gl.uniform2f(uniforms.uE, g.E[0], g.E[1]);
      var x0 = -margin - 8;
      gl.uniform2f(uniforms.uB0, x0, g.E[1] + (x0 - g.E[0]) * g.beamSlope);
      gl.uniform2f(uniforms.uFanA, fan.cur[0], fan.cur[1]);
      gl.uniform2f(uniforms.uFanB, fan.cur[2], fan.cur[3]);
      gl.uniform4f(uniforms.uLight, light.cur.beam, light.cur.rim, light.cur.glow, light.cur.shimmer);
      gl.uniform3f(uniforms.uHot, hot.cur[0], hot.cur[1], hot.cur[2]);
      gl.uniform3f(uniforms.uField, FIELD[0], FIELD[1], FIELD[2]);
      gl.uniform4f(uniforms.uBeat, beat.amount, beat.x, 3.4 * g.vmin, 15 * g.vmin);
      gl.uniform1i(uniforms.uCount, Math.min(list.length, MAX_BANDS));
      gl.uniform4fv(uniforms.uBA, dataA);
      gl.uniform4fv(uniforms.uBB, dataB);
      gl.uniform4fv(uniforms.uBC, dataC);
      gl.uniform4fv(uniforms.uBD, dataD);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(nowMs) {
      var ms = Math.min(100, nowMs - (lastMs === undefined ? nowMs - 1000 / fps : lastMs));
      lastMs = nowMs;
      if (document.hidden) return;
      if (reduce.matches) {
        if (!dirty) return;
        dirty = false;
        settle();
        render();
        return;
      }
      tick++;
      seconds += ms / 1000;
      var beat = beatNow();
      // Every frame while something moves, the shimmer of work too: drawn on fewer
      // frames it moved in visible steps. Still light is drawn a third of the
      // frames, for the sway alone: at most 0.03 px a step, so it glides.
      var shimmer = light.cur.shimmer > 0.01;
      if (!dirty && !moving && !beat.active && !shimmer && !wasBeat && tick % 3 !== 0) return;
      wasBeat = beat.active;
      dirty = false;
      moving = step(ms);
      render();
    }
    var wasBeat = false;

    function fit() {
      if (!surface) return;
      var s = size();
      margin = Math.ceil(2 * Math.min(s.w, s.h) / 100);
      ratio = Math.max(1, (window.devicePixelRatio || 1) * scale);
      surface.style.left = -margin + "px";
      surface.style.top = -margin + "px";
      surface.style.width = s.w + 2 * margin + "px";
      surface.style.height = s.h + 2 * margin + "px";
      surface.width = Math.round((s.w + 2 * margin) * ratio);
      surface.height = Math.round((s.h + 2 * margin) * ratio);
      dirty = true;
    }

    function setUpGl() {
      surface = document.createElement("canvas");
      box.appendChild(surface);
      var context = surface.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: true });
      if (!context) throw new Error("no webgl2");
      gl = context;
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
      ["uSize", "uRatio", "uMargin", "uTime", "uVmin", "uSide", "uBeamW", "uL", "uR", "uA", "uE", "uB0", "uFanA", "uFanB",
        "uShift", "uLight", "uHot", "uField", "uBeat", "uCount", "uBA", "uBB", "uBC", "uBD"].forEach(function (name) {
        uniforms[name] = gl.getUniformLocation(program, name);
      });
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var where = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(where);
      gl.vertexAttribPointer(where, 2, gl.FLOAT, false, 0, 0);
    }

    var onResize = function () {
      fit();
      if (lastState) draw(lastState);
    };
    var onVisible = function () {
      dirty = true;
    };

    return {
      start: function (root, ctx) {
        ctxRef = ctx;
        style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "dsg";
        var wantFps = Number(ctx.options.fps), wantScale = Number(ctx.options.scale);
        if (Number.isFinite(wantFps)) fps = Math.min(60, Math.max(10, wantFps));
        if (Number.isFinite(wantScale)) scale = Math.min(1, Math.max(0.25, wantScale));
        root.append(style, box);
        try {
          setUpGl();
        } catch (err) {
          console.error("[stavgayer.dsotm-ground] WebGL setup failed", err);
          if (surface) surface.remove();
          surface = gl = undefined;
        }
        fit();
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisible);
        draw({ display: ctx.display, cards: [], nowMs: ctx.now() });
        if (gl) {
          cancelFrame = ctx.requestFrame(frame, fps);
        }
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      stop: function () {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisible);
        if (cancelFrame) cancelFrame();
        cancelFrame = undefined;
        if (gl) {
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
        }
        if (box) box.remove();
        if (style) style.remove();
        box = surface = style = lastState = gl = program = geo = ctxRef = undefined;
        mood = "";
        lastMs = undefined;
        seconds = 0;
        bands.clear();
      },
    };
  });
})();
