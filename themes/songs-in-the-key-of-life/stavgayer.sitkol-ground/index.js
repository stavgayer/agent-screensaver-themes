// The ring field. Concentric discs with wavy, torn edges, painted in soft
// airbrush gradients: deep red and burnt orange at the edge of the screen,
// orange and amber nearer the middle, a pale glow at the centre. Each ring is
// dark on its inner side and light on its outer side, where its edge meets the
// shadow of the next ring, as on the 1976 sleeve.
//
// The field carries the state of your agents:
//   rest (nothing runs, and the second display): the sleeve as it is, the
//         centre left empty for the clock. The rings breathe outward, slowly;
//   work: the field moves left and each task owns one ring, tinted toward its
//         agent's colour, with a light that runs outward through it while the
//         task works. The board draws a leader from the ring to the task's card;
//   done: a finished task's ring settles and fades back into the palette;
//   call: an agent waits: the centre opens wide in a glow of that agent's
//         colour, a wave bursts outward through the rings, and the field warms
//         toward the agent's colour. The board sets the request in the centre.
//
// It is one WebGL draw of one triangle over the screen. It draws only when
// something moves, at most 30 frames a second (option fps), at half the
// screen's pixels (option scale) but never less than one pixel per point, and
// not at all while the page is hidden. The slow breathing, the sway and the
// light in a working ring are drawn at half that rate, continuously. With reduced motion it is drawn once per change: no breathing, no
// pulse, no wave, no sway.
(function () {
  // ---- shared by the ground, the board and the bar: keep these in step ----
  var MAX_CARDS = 7;
  var MAX_DISCS = 14;
  // Each agent owns a warm colour of the sleeve: the ring tint, and a deep ink of
  // the same colour that reads on the cream labels.
  var OWN = {
    claude: { ring: "#e4472c", ink: "#9a2814" },
    codex: { ring: "#f3b33a", ink: "#7a4600" },
    cursor: { ring: "#cc3a64", ink: "#931e45" },
  };
  var SPARE = [
    { ring: "#d4566e", ink: "#8e2340" },
    { ring: "#ef7d2c", ink: "#8a3b07" },
    { ring: "#b9472d", ink: "#84301a" },
  ];

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function hueOf(source) {
    if (has(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  // Newest task first: a new task is a new ring at the centre and the older
  // rings move outward, like ripples. Ties keep their order.
  function ordered(cards) {
    return cards
      .map(function (card, index) { return { card: card, index: index, hue: hueOf(card.source) }; })
      .sort(function (a, b) { return (b.card.started_at_ms || 0) - (a.card.started_at_ms || 0) || a.index - b.index; });
  }

  function waitingOf(cards) {
    return cards
      .map(function (card, index) { return { card: card, index: index }; })
      .filter(function (entry) { return entry.card.kind === "approval"; })
      .sort(function (a, b) {
        var x = a.card.approval_since_ms, y = b.card.approval_since_ms;
        if (x === y) return a.index - b.index;
        if (x === undefined) return 1;
        if (y === undefined) return -1;
        return x - y;
      })
      .map(function (entry) { return entry.card; });
  }

  // rest: nothing runs (and the second display); work: tasks run; done: all
  // finished; call: an agent waits for you.
  function moodOf(state) {
    if (state.display !== "main" || state.cards.length === 0) return "rest";
    if (waitingOf(state.cards).length > 0) return "call";
    return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "done";
  }

  // The ring field in screen px. At rest it keeps the proportions of the 1976
  // sleeve on a square as tall as the screen: a small glowing centre a little
  // above the middle, then rings that widen by about 1.4 each step. While tasks
  // run the field moves left, its centre holds the count, and each task owns
  // one ring between the centre and the cards. When an agent waits the centre
  // opens wide and holds the request. r[k] is the outer radius of disc k
  // (disc 0 is the centre); the last disc always reaches past the corners.
  function geometry(w, h, mood, n) {
    var v = Math.min(w, h) / 100;
    var g = { w: w, h: h, vmin: v, mood: mood, r: [] };
    var shown = Math.min(n, MAX_CARDS), i;
    var cover = [0.16, 0.205, 0.295, 0.41];
    if (mood === "work" || mood === "done") {
      g.cx = 0.29 * w;
      g.cy = 0.53 * h;
      g.r.push(0.15 * h);
      g.colL = 0.585 * w;
      g.colR = 0.962 * w;
      var reach = Math.max(0.3 * h, Math.min(g.colL - g.cx - 5 * v, 0.47 * h));
      var count = Math.max(1, shown), unit = 0, grow = 1.1, sum = 0;
      for (i = 0; i < count; i++) sum += Math.pow(grow, i);
      unit = (reach - g.r[0]) / sum;
      var at = g.r[0];
      for (i = 0; i < count; i++) { at += unit * Math.pow(grow, i); g.r.push(at); }
      g.agentRings = shown;
    } else if (mood === "call") {
      g.cx = 0.5 * w;
      g.cy = 0.535 * h;
      g.r.push(0.405 * h);
      g.r.push(0.47 * h);
      g.agentRings = 0;
    } else {
      g.cx = 0.5 * w;
      g.cy = 0.4 * h;
      for (i = 0; i < 4; i++) g.r.push(cover[i] * h);
      g.agentRings = 0;
    }
    // The outer rings widen as on the sleeve until they pass the farthest corner.
    var far = Math.hypot(Math.max(g.cx, w - g.cx), Math.max(g.cy, h - g.cy)) * 1.12;
    var steps = [1.37, 1.36, 1.34, 1.32, 1.32, 1.32, 1.32, 1.32, 1.32, 1.32];
    var s = 0;
    while (g.r[g.r.length - 1] < far && g.r.length < MAX_DISCS) g.r.push(g.r[g.r.length - 1] * steps[s++]);
    if (g.r[g.r.length - 1] < far) g.r[g.r.length - 1] = far;
    // Each disc is lower and a little to the left the larger it is, as on the
    // sleeve, where the rings are thin above the centre and wide below it.
    var drop = mood === "rest" ? 0.33 : mood === "call" ? 0.16 : 0.1;
    g.centreOf = function (k) {
      var r = k < g.r.length ? g.r[k] : g.r[g.r.length - 1];
      return [g.cx - 0.02 * r, g.cy + drop * (r - g.r[0])];
    };
    g.drop = drop;
    // the cards, one per agent ring, in the column right of the field
    var top = 0.15 * h, bottom = 0.95 * h, gap = 1.6 * v;
    var slot = shown ? Math.min(0.165 * h, (bottom - top - (shown - 1) * gap) / shown) : 0;
    var total = shown * slot + Math.max(0, shown - 1) * gap;
    var middle = Math.min(bottom - total / 2, Math.max(top + total / 2, g.cy));
    g.slots = [];
    for (i = 0; i < shown; i++) {
      var y = middle - total / 2 + i * (slot + gap);
      g.slots.push({ top: y, height: slot, mid: y + slot / 2 });
    }
    return g;
  }

  // The slow wobble of each ring's edge: four low harmonics, partly shared by
  // all rings so neighbours never cross. The ground draws with these numbers and
  // the board uses them to find where a leader meets its ring.
  function wobbleOf(k) {
    function rnd(seed) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    var amps = [0.026, 0.021, 0.014, 0.009], a = [], p = [];
    for (var j = 0; j < 4; j++) {
      var shared = rnd(j + 1), own = rnd(k * 9 + j + 20);
      var mixA = k === 0 ? 0.6 : 0.68 * (0.7 + 0.6 * shared) + 0.32 * (0.5 + own);
      a.push(amps[j] * mixA * (k === 0 ? 1.4 : 1));
      p.push(6.2832 * (0.72 * shared + 0.28 * own));
    }
    return { a: a, p: p };
  }

  function edgeAt(r, wob, theta) {
    var harm = [2, 3, 4, 6], sum = 0;
    for (var j = 0; j < 4; j++) sum += wob.a[j] * Math.sin(harm[j] * theta + wob.p[j]);
    return r * (1 + sum);
  }
  // ---- end of the shared part ----

  var DRIFT_S = 240;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function driftAt(nowMs, vmin) {
    if (reduce.matches) return { x: 0, y: 0 };
    var t = (nowMs / 1000 / DRIFT_S) * Math.PI;
    return { x: 0.6 * vmin * Math.sin(t), y: 0.3 * vmin * Math.sin(0.73 * t + 1) };
  }

  // Where a ring sits on the sleeve's palette, from its size, as measured on
  // the sleeve: the ring round the centre runs from orange to cream, the next
  // from red to amber, and the large ones from maroon to a deep red-orange.
  var RANGES = [[0.21, 0.55, 1.0], [0.3, 0.33, 0.95], [0.42, 0.06, 0.66], [0.57, 0.04, 0.54], [0.8, 0.04, 0.54], [2, 0.04, 0.6]];
  function rangeOf(r, h) {
    var rho = r / h;
    if (rho <= RANGES[0][0]) return { lo: RANGES[0][1], hi: RANGES[0][2] };
    for (var i = 1; i < RANGES.length; i++) {
      if (rho <= RANGES[i][0]) {
        var a = RANGES[i - 1], b = RANGES[i], f = (rho - a[0]) / (b[0] - a[0]);
        return { lo: a[1] + (b[1] - a[1]) * f, hi: a[2] + (b[2] - a[2]) * f };
      }
    }
    return { lo: 0.02, hi: 0.4 };
  }

  var VERTEX = [
    "#version 300 es",
    "in vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }",
  ].join("\n");

  // The palette, sampled from the sleeve along one ring from its dark inner side
  // to its pale outer side.
  var STOPS = ["#5e2324", "#7c2a2b", "#a42f32", "#cf3836", "#eb4839", "#f15e3b",
    "#f47b39", "#f89a3a", "#fbb544", "#fdcd62", "#fee59c", "#fff8e6"];

  function fragment() {
    var stops = STOPS.map(function (hex) {
      var c = rgbOf(hex);
      return "vec3(" + c.map(function (x) { return x.toFixed(4); }).join(", ") + ")";
    }).join(", ");
    return [
      "#version 300 es",
      "precision highp float;",
      "uniform vec2 uSize;",
      "uniform float uRatio, uMargin, uTime, uVmin, uH, uBreath;",
      "uniform vec2 uDrift;",
      "uniform vec4 uDA[" + MAX_DISCS + "];", // centre xy, radius, palette low
      "uniform vec4 uDB[" + MAX_DISCS + "];", // palette high, tint, pulse, pulse phase
      "uniform vec4 uDC[" + MAX_DISCS + "];", // tint rgb, dim
      "uniform vec4 uDW[" + MAX_DISCS + "];", // wobble amplitudes, harmonics 2 3 4 6
      "uniform vec4 uDP[" + MAX_DISCS + "];", // wobble phases
      "uniform vec4 uCall;", // amount, wave radius, wave amount, wave width
      "uniform vec3 uHot;",
      "uniform float uTeeth[" + MAX_DISCS + "];", // teeth around each disc
      "out vec4 outColor;",
      "const vec3 STOPS[12] = vec3[12](" + stops + ");",
      "float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }",
      "float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
      "vec3 ramp(float s) { float x = clamp(s, 0.0, 1.0) * 11.0; int i = int(min(floor(x), 10.0)); return mix(STOPS[i], STOPS[i + 1], x - float(i)); }",
      // signed distance in px from the edge of disc k, positive inside. The edge
      // is torn like paper: a slow wobble, a row of small sharp teeth that point
      // outward, and a little ragged noise. The teeth fade out on the large outer
      // rings, whose edges are soft, as the airbrush left them.
      "float edge(int k, vec2 p, out float calm) {",
      "  vec4 A = uDA[k]; vec2 q = p - A.xy; float d = length(q);",
      "  float th = atan(q.y, q.x);",
      "  vec4 W = uDW[k], P = uDP[k];",
      "  float wob = W.x * sin(2.0 * th + P.x) + W.y * sin(3.0 * th + P.y) + W.z * sin(4.0 * th + P.z) + W.w * sin(6.0 * th + P.w);",
      "  float breath = 1.0 + uBreath * sin(uTime * 0.157 - A.z / uH * 6.0);",
      "  float base = A.z * (1.0 + wob) * breath;",
      "  calm = base - d;", // the edge without its teeth: the shading follows this one, so no streaks run across a ring
      // far from the edge the teeth cannot reach: skip the noise
      "  float reach = 1.3 * uVmin + 0.012 * A.z + 2.0 * uVmin;",
      "  if (abs(calm) > reach) return calm;",
      "  vec2 dir = q / max(d, 1e-3);",
      "  vec2 np = dir * (A.z / (1.5 * uVmin)) + float(k) * 7.31;",
      "  float jag = (vnoise(np) - 0.5) + 0.55 * (vnoise(np * 2.7 + 3.1) - 0.5);",
      "  float n = uTeeth[k];",
      "  float u = (th / 6.2832 + 0.5) * n + (vnoise(dir * 4.0 + float(k)) - 0.5) * 5.0;",
      "  float cell = floor(u), f = fract(u);",
      "  float hv = hash(vec2(mod(cell, n), float(k) * 3.7)), hw = hash(vec2(mod(cell, n) + 0.5, float(k) * 1.3));",
      "  float crest = 0.25 + 0.5 * hw;", // each tooth leans its own way
      "  float tri = f < crest ? f / crest : (1.0 - f) / (1.0 - crest);",
      "  float tooth = pow(tri, 1.6) * (0.25 + 1.1 * hv * hv);",
      "  float sharp = 1.0 - smoothstep(0.34 * uH, 0.62 * uH, A.z);",
      "  float R = base + (tooth - 0.4) * (0.42 * uVmin + 0.0025 * A.z) * sharp + jag * (0.3 * uVmin + 0.005 * A.z);",
      "  return R - d;",
      "}",
      // how soft the edge of disc k is, in px: a pixel on the inner rings, a soft airbrush on the outer ones
      "float softOf(int k) { return 1.0 / uRatio + 1.5 * uVmin * smoothstep(0.32 * uH, 0.8 * uH, uDA[k].z); }",
      // the colour of ring k: t runs from its inner edge (0) to its outer edge (1)
      "vec3 ringColour(int k, float t, float ein, float grain, float mott, vec2 p) {",
      "  vec4 A = uDA[k], B = uDB[k], C = uDC[k];",
      // the light falls a little stronger from the lower right, as on the sleeve
      "  vec2 q = normalize(p - uDA[0].xy + 1e-3);",
      "  float lit = 1.0 + 0.22 * dot(q, vec2(0.7, 0.7));",
      "  float s = A.w + (B.x - A.w) * t * lit + 0.08 * pow(t, 7.0);", // a bright rim just inside the torn edge
      "  s -= 0.1 * exp(-ein / (0.9 * uVmin));", // the airbrushed shadow of the next ring in
      "  float ph = fract(uTime / 3.6 + B.w) * 1.5 - 0.25;",
      "  s += B.z * 0.17 * exp(-pow((t - ph) / 0.15, 2.0));", // a light runs outward while the task works
      "  s += (grain - 0.5) * 0.04 + (mott - 0.5) * 0.1;",
      "  vec3 c = ramp(s);",
      "  vec3 hue = C.rgb;",
      "  vec3 tinted = s < 0.55 ? mix(hue * 0.32, hue, s / 0.55) : mix(hue, vec3(1.0, 0.96, 0.86), (s - 0.55) / 0.45 * 0.8);",
      "  c = mix(c, tinted, B.y);",
      "  return c * (1.0 - C.w);",
      "}",
      "vec3 centreColour(float t, float grain) {",
      "  vec3 c = mix(vec3(1.0, 0.988, 0.955), vec3(1.0, 0.94, 0.74), smoothstep(0.5, 1.0, t));",
      "  c = mix(c, vec3(0.99, 0.80, 0.42), smoothstep(0.88, 1.0, t) * 0.55);",
      "  c = mix(c, mix(uHot, vec3(1.0, 0.97, 0.9), 0.4), uCall.x * smoothstep(0.78, 1.0, t) * 0.75);",
      "  return c + (grain - 0.5) * 0.02;",
      "}",
      "void main() {",
      "  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uRatio - uMargin - uDrift;",
      "  float grain = hash(floor(gl_FragCoord.xy));",
      "  float mott = vnoise(p / (11.0 * uVmin)) * 0.55 + vnoise(p / (3.5 * uVmin) + 5.0) * 0.3 + vnoise(p / (1.1 * uVmin) + 9.0) * 0.15;",
      "  float prev = 1e4, e = 0.0, calm = 0.0, calmPrev = 1e4; int k = 0;",
      "  for (int i = 0; i < " + MAX_DISCS + "; i++) { e = edge(i, p, calm); k = i; if (e > -0.5 * softOf(i)) break; prev = e; calmPrev = calm; }",
      "  vec3 col;",
      "  if (k == 0) {",
      "    col = centreColour(1.0 - calm / max(1.0, uDA[0].z), grain);",
      "  } else {",
      "    float ein = max(0.0, -prev), cin = max(0.0, -calmPrev);",
      "    col = ringColour(k, clamp(cin / max(1.0, cin + max(calm, 0.0)), 0.0, 1.0), ein, grain, mott, p);",
      "  }",
      // smooth the torn edge into the next ring out, one pixel wide
      "  float cov = clamp(e / softOf(k) + 0.5, 0.0, 1.0);",
      "  if (cov < 1.0 && k < " + (MAX_DISCS - 1) + ") col = mix(ringColour(k + 1, 0.0, 0.0, grain, mott, p), col, cov);",
      // the wave of a call, bursting outward from the centre
      "  if (uCall.z > 0.001 && k > 0) {",
      "    float r = length(p - uDA[0].xy);",
      "    float w = uCall.z * exp(-pow((r - uCall.y) / uCall.w, 2.0));",
      "    col = mix(col, mix(uHot, vec3(1.0, 0.96, 0.86), 0.5), clamp(w, 0.0, 1.0) * 0.9);",
      "  }",
      "  col += (hash(gl_FragCoord.xy * 1.37 + 3.1) - 0.5) / 255.0;",
      "  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);",
      "}",
    ].join("\n");
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader failed");
    return shader;
  }

  var STYLE = [
    ".skg { position: absolute; inset: 0; overflow: hidden; background: #a42f32; }",
    ".skg canvas { position: absolute; display: block; will-change: transform; }",
  ].join("\n");

  var GEO = ["cx", "cy", "r"];
  var LOOK = ["lo", "hi", "tint", "tr", "tg", "tb", "pulse", "dim"];
  var WOBBLE = [];
  for (var wk = 0; wk < MAX_DISCS; wk++) WOBBLE.push(wobbleOf(wk));
  // A fixed count of teeth for each disc, about one every 1.7% of the screen
  // height at its size at rest, so the teeth never jump while a ring moves.
  var TEETH = new Float32Array(MAX_DISCS);
  var REST = geometry(1600, 1000, "rest", 0);
  for (var tk = 0; tk < MAX_DISCS; tk++) {
    var restR = tk < REST.r.length ? REST.r[tk] : REST.r[REST.r.length - 1] * Math.pow(1.32, tk - REST.r.length + 1);
    TEETH[tk] = Math.max(24, Math.round((2 * Math.PI * restR) / 13));
  }

  window.agentScreensaver.register(function () {
    var box, surface, style, lastState, geo, mood = "", waitKey = "", goalKey = "";
    var gl, program, uniforms = {}, cancelFrame, lastMs, seconds = 0, tick = 0;
    var fps = 30, scale = 0.5, ratio = 1, margin = 0, dirty = true, moving = true;
    var discs = [];
    var call = { cur: 0, goal: 0 }, hot = { cur: [1, 0.6, 0.3], goal: [1, 0.6, 0.3] };
    var wave = { start: -1 };
    var dataA = new Float32Array(MAX_DISCS * 4), dataB = new Float32Array(MAX_DISCS * 4), dataC = new Float32Array(MAX_DISCS * 4);
    var dataW = new Float32Array(MAX_DISCS * 4), dataP = new Float32Array(MAX_DISCS * 4);

    for (var k = 0; k < MAX_DISCS; k++) {
      discs.push({ cur: null, goal: null, vel: { cx: 0, cy: 0, r: 0 } });
      for (var j = 0; j < 4; j++) { dataW[k * 4 + j] = WOBBLE[k].a[j]; dataP[k * 4 + j] = WOBBLE[k].p[j]; }
    }

    function size() {
      return { w: box.clientWidth || window.innerWidth, h: box.clientHeight || window.innerHeight };
    }

    function draw(state) {
      if (!box) return;
      var s = size();
      var next = moodOf(state);
      var list = next === "work" || next === "done" ? ordered(state.cards).slice(0, MAX_CARDS) : [];
      geo = geometry(s.w, s.h, next, list.length);
      var g = geo, last = g.r[g.r.length - 1];
      var waiting = next === "call" ? waitingOf(state.cards)[0] : undefined;
      var hue = waiting ? rgbOf(hueOf(waiting.source).ring) : null;
      for (var k = 0; k < MAX_DISCS; k++) {
        var r = k < g.r.length ? g.r[k] : last * Math.pow(1.32, k - g.r.length + 1);
        var c = k === 0 ? [g.cx, g.cy] : [g.cx - 0.02 * r, g.cy + g.drop * (r - g.r[0])];
        var goal = { cx: c[0], cy: c[1], r: r, tint: 0, tr: 1, tg: 0.6, tb: 0.3, pulse: 0, dim: 0 };
        var entry = k >= 1 && k <= list.length ? list[k - 1] : null;
        if (entry) {
          var col = rgbOf(entry.hue.ring), kind = entry.card.kind;
          goal.tr = col[0]; goal.tg = col[1]; goal.tb = col[2];
          goal.tint = kind === "finished" ? 0 : kind === "running" ? 0.62 : 0.4;
          goal.pulse = kind === "running" && !reduce.matches ? 1 : 0;
        } else if (next === "work" || next === "done") {
          goal.dim = k > list.length ? 0.1 : 0;
        }
        if (hue) { goal.tr = hue[0]; goal.tg = hue[1]; goal.tb = hue[2]; goal.tint = k === 0 ? 0 : k === 1 ? 0.8 : 0.3; }
        var d = discs[k];
        if (!d.cur) {
          d.cur = Object.assign({}, goal);
          d.cur.tr = goal.tr; d.cur.tg = goal.tg; d.cur.tb = goal.tb;
        }
        // keep the hue of a ring that fades back, so it does not flash another colour
        if (goal.tint === 0 && d.cur.tint > 0.01 && !hue) { goal.tr = d.cur.tr; goal.tg = d.cur.tg; goal.tb = d.cur.tb; }
        d.goal = goal;
      }
      call.goal = hue ? 1 : 0;
      if (hue) {
        hot.goal = hue;
        var key = waiting.source + "\u0000" + waiting.session;
        if (key !== waitKey) wave.start = seconds;
        waitKey = key;
      } else {
        waitKey = "";
        wave.start = -1;
      }
      if (mood === "" || reduce.matches) settle();
      mood = next;
      // The state is written often with nothing new for the rings; draw only when a goal moved.
      var key = JSON.stringify([discs.map(function (d) { return d.goal; }), call.goal, waitKey, g.w, g.h]);
      if (key !== goalKey) dirty = true;
      goalKey = key;
    }

    function settle() {
      discs.forEach(function (d) {
        d.cur = Object.assign({}, d.goal);
        d.vel = { cx: 0, cy: 0, r: 0 };
      });
      call.cur = call.goal;
      hot.cur = hot.goal.slice();
    }

    function ease(now, goal, ms, tau) {
      return goal + (now - goal) * Math.exp(-Math.max(0, ms) / tau);
    }

    // Returns true while something still moves.
    function step(ms) {
      var dt = Math.min(0.05, ms / 1000), still = true;
      var stiff = mood === "call" ? 95 : 62, damp = mood === "call" ? 13 : 13.5;
      discs.forEach(function (d) {
        GEO.forEach(function (name) {
          // the rings move on a spring with a hair of overshoot, like a ripple settling
          var acc = stiff * (d.goal[name] - d.cur[name]) - damp * d.vel[name];
          d.vel[name] += acc * dt;
          d.cur[name] += d.vel[name] * dt;
          if (Math.abs(d.goal[name] - d.cur[name]) > 0.2 || Math.abs(d.vel[name]) > 0.5) still = false;
        });
        LOOK.forEach(function (name) {
          if (name === "lo" || name === "hi") return;
          var tau = name === "tint" && d.goal.tint < d.cur.tint ? 1100 : 450;
          d.cur[name] = ease(d.cur[name], d.goal[name], ms, tau);
          if (Math.abs(d.cur[name] - d.goal[name]) > 0.003) still = false;
        });
      });
      call.cur = ease(call.cur, call.goal, ms, 300);
      if (Math.abs(call.cur - call.goal) > 0.003) still = false;
      for (var i = 0; i < 3; i++) hot.cur[i] = ease(hot.cur[i], hot.goal[i], ms, 250);
      return !still;
    }

    function waveNow() {
      if (wave.start < 0 || reduce.matches || !geo) return { r: 0, amount: 0, active: false };
      var since = seconds - wave.start;
      // One strong wave when the call comes, then a softer one every 9 seconds while it waits.
      var phase = since % 9;
      var first = since < 9;
      var amount = (first ? 1 : 0.6) * Math.min(1, phase / 0.12) * Math.exp(-phase / (first ? 1.3 : 1.0));
      return { r: discs[0].cur.r + phase * 0.5 * geo.h, amount: amount, active: amount > 0.02 };
    }

    function render() {
      if (!gl || !surface || !geo) return;
      var g = geo;
      for (var k = 0; k < MAX_DISCS; k++) {
        var c = discs[k].cur, at = k * 4, range = rangeOf(c.r, g.h);
        dataA[at] = c.cx; dataA[at + 1] = c.cy; dataA[at + 2] = Math.max(1, c.r); dataA[at + 3] = range.lo;
        dataB[at] = range.hi; dataB[at + 1] = c.tint; dataB[at + 2] = c.pulse; dataB[at + 3] = k * 0.29;
        dataC[at] = c.tr; dataC[at + 1] = c.tg; dataC[at + 2] = c.tb; dataC[at + 3] = c.dim;
      }
      var w = waveNow();
      gl.viewport(0, 0, surface.width, surface.height);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uSize, surface.width, surface.height);
      gl.uniform1f(uniforms.uRatio, ratio);
      gl.uniform1f(uniforms.uMargin, margin);
      gl.uniform1f(uniforms.uTime, reduce.matches ? 0 : seconds);
      gl.uniform1f(uniforms.uVmin, g.vmin);
      gl.uniform1f(uniforms.uH, g.h);
      gl.uniform1f(uniforms.uBreath, reduce.matches ? 0 : 0.006);
      // The sway against burn-in is drawn here, at the render rate, so it glides at
      // any size: moving the canvas itself would resample it and make every edge shimmer.
      var drift = driftAt(Date.now(), g.vmin);
      gl.uniform2f(uniforms.uDrift, drift.x, drift.y);
      gl.uniform4fv(uniforms.uDA, dataA);
      gl.uniform4fv(uniforms.uDB, dataB);
      gl.uniform4fv(uniforms.uDC, dataC);
      gl.uniform4fv(uniforms.uDW, dataW);
      gl.uniform4fv(uniforms.uDP, dataP);
      gl.uniform4f(uniforms.uCall, call.cur, w.r, w.amount, 6 * g.vmin);
      gl.uniform3f(uniforms.uHot, hot.cur[0], hot.cur[1], hot.cur[2]);
      gl.uniform1fv(uniforms.uTeeth, TEETH);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var wasWave = false;
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
      var w = waveNow();
      // The breathing, the sway and the light in a working ring move slowly and
      // continuously: every second frame carries them, so nothing moves in steps.
      var slow = tick % 2 === 0;
      // a wave takes two frames in three
      var waving = (w.active || wasWave) && tick % 3 !== 0;
      if (!dirty && !moving && !waving && !slow) return;
      wasWave = w.active;
      dirty = false;
      moving = step(ms);
      render();
    }

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
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment()));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
      ["uSize", "uRatio", "uMargin", "uTime", "uVmin", "uH", "uBreath", "uDA", "uDB", "uDC", "uDW", "uDP",
        "uCall", "uHot", "uTeeth", "uDrift"].forEach(function (name) {
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
        style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "skg";
        var wantFps = Number(ctx.options.fps), wantScale = Number(ctx.options.scale);
        if (Number.isFinite(wantFps)) fps = Math.min(60, Math.max(10, wantFps));
        if (Number.isFinite(wantScale)) scale = Math.min(1, Math.max(0.25, wantScale));
        root.append(style, box);
        try {
          setUpGl();
        } catch (err) {
          console.error("[stavgayer.sitkol-ground] WebGL setup failed", err);
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
        box = surface = style = lastState = gl = program = geo = undefined;
        mood = waitKey = goalKey = "";
        lastMs = undefined;
        seconds = 0;
        discs.forEach(function (d) { d.cur = d.goal = null; });
      },
    };
  });
})();
