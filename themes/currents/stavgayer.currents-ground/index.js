// The Currents surface: hundreds of thin lilac lines on a dark liquid surface
// that recedes toward the top right. Each agent is a dark chrome ball sitting
// in the surface. Upstream of a ball the lines run straight on a slant; around
// it they part; behind it they break into a churning, marbled wake (vortex
// shedding, the idea behind the record sleeve). One thread in the agent's hue
// runs into each ball, pools around it and leaves as a ribbon torn by the wake.
//   work: one ball and one coloured thread per task, over its card;
//   done: the ball shrinks, its thread fades and its wake calms;
//   rest: all done: the surface dims;
//   call: an agent waits: one large ball, and its colour floods the surface;
//   idle: no tasks: one ball in a calm, dim surface, no thread.
//
// The surface is a WebGL fragment shader: the lines are stripes of a stream
// function (a slanted flow, potential flow around each ball, and a moving,
// domain-warped noise added only in each wake). It renders at half size, at
// most 30 frames a second, through the runtime's frame clock, so it stops when
// the screen saver stops. The balls are canvases rendered once per change.
// With reduced motion the surface is drawn once and stands still.
(function () {
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  var OWN = { claude: ["#ff4a2a", "#ffa12e"], codex: ["#8f7bff", "#5fb6ff"], cursor: ["#ffc94a", "#ff8a3d"] };
  var SPARE = [["#ff5fa2", "#ffa36b"], ["#5fd3c4", "#8fe36b"], ["#c7a6ff", "#ff8fd0"], ["#7fb2ff", "#b28cff"]];
  var MAX_BALLS = 8;
  // Shared with the shader below.
  var SLANT = 27, PERSP = 0.24, MARGIN = 3; // degrees, perspective strength, vmin of slack for the drift
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function huesOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // A spring sampled into a CSS linear() curve, so WAAPI plays it with no per-frame script.
  function spring(stiffness, damping) {
    var x = 0, v = 0, dt = 1 / 240, t = 0, points = [0], next = 1 / 60;
    while (t < 3) {
      v += (-stiffness * (x - 1) - damping * v) * dt;
      x += v * dt;
      t += dt;
      if (t >= next) {
        points.push(Number(x.toFixed(4)));
        next += 1 / 60;
        if (Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.01) break;
      }
    }
    points[points.length - 1] = 1;
    var curve = "linear(" + points.join(", ") + ")";
    var ok = window.CSS && CSS.supports && CSS.supports("animation-timing-function", curve);
    return { easing: ok ? curve : EASE_OUT, duration: Math.round(t * 1000) };
  }
  var SETTLE = spring(210, 20);
  var LAND = spring(340, 30);

  // ---- where things sit (the board uses the same numbers for its cards) ----

  function metrics(w, h) {
    return { w: w, h: h, vmin: Math.min(w, h) / 100, vw: w / 100, vh: h / 100 };
  }

  function cardCentres(count, m) {
    var gap = 2.6 * m.vmin, side = 5 * m.vmin;
    var width = Math.min(30 * m.vw, (m.w - 2 * side - (count - 1) * gap) / count);
    var out = [];
    for (var i = 0; i < count; i++) out.push(side + width / 2 + i * (width + gap));
    return out;
  }

  function waitingOf(state) {
    return state.cards.filter(function (card) { return card.kind === "approval"; }).sort(function (a, b) {
      return (a.approval_since_ms || Infinity) - (b.approval_since_ms || Infinity);
    });
  }

  // Each ball: where it sits (screen px), its size, its thread's two hues, how
  // strong its thread and its wake are.
  function ballsFor(mood, state, m) {
    if (mood === "idle" || mood === "away") {
      return [{ key: "still", x: 74 * m.vw, y: 56 * m.vh, r: 12 * m.vmin, hues: null, thread: 0, wake: 0.6 }];
    }
    if (mood === "call") {
      var first = waitingOf(state)[0];
      return [{ key: "call:" + first.source + "\u0000" + first.session, x: 76 * m.vw, y: 30 * m.vh, r: 15 * m.vmin,
        hues: huesOf(first.source), thread: 1, wake: 1.25 }];
    }
    var xs = cardCentres(state.cards.length, m);
    // With many cards the balls shrink with them, so they never touch.
    var room = xs.length > 1 ? (xs[1] - xs[0]) * 0.36 : Infinity;
    return state.cards.map(function (card, i) {
      var done = card.kind === "finished";
      return { key: card.source + "\u0000" + card.session, x: xs[i], y: 55 * m.vh,
        r: Math.min((done ? 4.4 : 6.2) * m.vmin, room * (done ? 0.7 : 1)),
        hues: huesOf(card.source), thread: done ? 0.22 : 1, wake: done ? 0.35 : 1 };
    });
  }

  // ---- the surface shader ------------------------------------------------------

  var VERTEX = "#version 300 es\nin vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }";

  var FRAGMENT = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform int uCount;",
    "uniform vec4 uBall[" + MAX_BALLS + "];  // surface x, y, radius, wake strength",
    "uniform vec4 uHue[" + MAX_BALLS + "];   // thread colour where it enters, thread strength",
    "uniform vec4 uHue2[" + MAX_BALLS + "];  // thread colour downstream",
    "uniform float uFlood;",
    "uniform vec3 uFloodHue;",
    "uniform float uDim;",
    "out vec4 outColor;",
    "const float SLANT = " + ((SLANT * Math.PI) / 180).toFixed(6) + ";",
    "const vec2 FLOW = vec2(cos(SLANT), -sin(SLANT));",
    "const vec2 NORM = vec2(sin(SLANT), cos(SLANT));",
    "const vec2 FAR = vec2(0.70710678, 0.70710678);",
    "const float PERSP = " + PERSP.toFixed(3) + ";",
    "const float DENSITY = 128.0;",
    "float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float noise(vec2 p) {",
    "  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y) * 2.0 - 1.0;",
    "}",
    "float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.45; } return s; }",
    "void main() {",
    "  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;",
    "  vec2 q = p / (1.0 - PERSP * dot(p, FAR));",
    // where the wakes are, and how large their eddies are
    "  float env = 0.0, inv = 0.0;",
    "  for (int i = 0; i < " + MAX_BALLS + "; i++) {",
    "    if (i >= uCount) break;",
    "    vec4 b = uBall[i]; float a = max(b.z, 1e-4); vec2 d = q - b.xy;",
    "    float lx = dot(d, FLOW), ly = dot(d, NORM);",
    "    float down = smoothstep(0.2 * a, 2.6 * a, lx) * exp(-max(lx, 0.0) / (24.0 * a));",
    "    float width = a * (1.0 + 0.2 * max(lx, 0.0) / a);",
    "    float e = b.w * down * exp(-(ly * ly) / (width * width));",
    "    env += e; inv += e / a;",
    "  }",
    "  vec2 w = vec2(0.0);",
    "  if (env > 0.002) {",
    "    float k = 0.4 * inv / env;",
    // the noise drifts downstream and churns as it goes
    "    vec2 s = q * k, adv = FLOW * uTime * 0.14;",
    "    vec2 n1 = vec2(fbm(s - adv + vec2(0.0, uTime * 0.05)), fbm(s - adv + vec2(5.2, 1.3 - uTime * 0.045)));",
    "    vec2 n2 = vec2(fbm(s + 1.6 * n1 - adv * 0.7), fbm(s + 1.6 * n1 + vec2(8.3, 2.8) - adv * 0.7));",
    "    w = n2 * min(env, 1.3) * 0.8 / k;",
    "  }",
    "  vec2 qw = q + w;",
    // the stream function: a slanted flow parted by every ball
    "  float psi = dot(qw, NORM);",
    "  float shadow = 1.0;",
    "  for (int i = 0; i < " + MAX_BALLS + "; i++) {",
    "    if (i >= uCount) break;",
    // the waterline wobbles, and the lines right at it lap in small ripples
    "    vec4 b = uBall[i]; vec2 d = qw - b.xy; float ang = atan(d.y, d.x), fi = float(i);",
    "    float wob = 1.0 + 0.05 * sin(3.0 * ang + uTime * 0.8 + fi * 1.7) + 0.03 * sin(5.0 * ang - uTime * 1.25 + fi);",
    "    float a = b.z * 1.06 * wob, a2 = a * a;",
    "    float r2 = max(dot(d, d), a2 * 0.6);",
    "    psi -= a2 * dot(d, NORM) / r2;",
    "    float rd = sqrt(r2);",
    "    psi += b.z * 0.012 * sin(rd / b.z * 14.0 - uTime * 2.2) * exp(-max(rd - a, 0.0) / (0.4 * b.z));",
    "    float r = length(q - b.xy);",
    "    shadow *= mix(0.45, 1.0, smoothstep(b.z * 0.98, b.z * 1.3, r));",
    "  }",
    "  float x = psi * DENSITY + uTime / 45.0;",
    "  float fw = fwidth(x);",
    // each line a soft-edged band, antialiased by its own pixel width; where lines
    // get close to a pixel apart they fade to their average instead of shimmering
    "  float dl = abs(fract(x + 0.5) - 0.5), half_ = 0.24;",
    "  float edge = max(fw, 0.02);",
    "  float ridge = 1.0 - smoothstep(half_ - edge, half_ + edge, dl);",
    "  ridge *= mix(0.7, 1.0, 1.0 - dl / half_ * 0.5);",
    "  ridge = mix(ridge, 2.0 * half_ * 0.85, smoothstep(0.22, 0.5, fw));",
    "  vec3 ground = mix(vec3(0.055, 0.035, 0.075), uFloodHue * 0.14, uFlood);",
    "  vec3 lilac = mix(vec3(0.68, 0.55, 0.78), mix(uFloodHue, vec3(0.5, 0.42, 0.55), 0.5) * 0.85, uFlood);",
    "  vec3 col = mix(ground, lilac, ridge) + vec3(1.0, 0.94, 1.0) * pow(ridge, 7.0) * 0.22;",
    "  col *= shadow;",
    // the far edge of the surface sinks into the dark; the threads sink less
    "  float far = dot(p, FAR);",
    "  float vig = (1.0 - 0.7 * smoothstep(-0.1, 0.9, far)) * (1.0 - 0.25 * smoothstep(0.55, 1.0, length(p * vec2(0.75, 1.0))));",
    "  col *= vig;",
    // one thread per ball: the stream line through its centre
    "  for (int i = 0; i < " + MAX_BALLS + "; i++) {",
    "    if (i >= uCount) break;",
    "    vec4 b = uBall[i]; float a = max(b.z, 1e-4);",
    "    if (uHue[i].a <= 0.001) continue;",
    "    float lx = dot(qw - b.xy, FLOW);",
    "    float own = psi - dot(b.xy, NORM);",
    "    float tw = a * (0.07 + 0.12 * smoothstep(0.0, 6.0 * a, lx)) * (1.0 + 0.5 * uFlood);",
    "    float fp = fwidth(psi) + 1e-5;",
    "    float m = 1.0 - smoothstep(tw - fp, tw + fp, abs(own));",
    "    vec3 tc = mix(uHue[i].rgb, uHue2[i].rgb, smoothstep(0.0, 9.0 * a, lx));",
    "    float near = 1.0 - smoothstep(a, a * 1.5, length(q - b.xy));",
    "    tc = mix(tc, mix(uHue[i].rgb, vec3(1.0, 0.62, 0.78), 0.45), near * 0.7);",
    "    tc = mix(tc, min(tc * 1.2 + vec3(0.06), vec3(1.0)), uFlood);",
    "    col = mix(col, tc * mix(0.82, 1.0, near) * mix(1.0, vig, 0.35), m * uHue[i].a);",
    // the pool the ball sits in: a wobbling disc of the thread's colour at its waterline
    "    vec2 pd = q - b.xy - FLOW * a * 0.12; float pa = atan(pd.y, pd.x);",
    "    float pr = length(pd) / (a * (1.0 + 0.06 * sin(4.0 * pa + uTime * 0.9 + float(i) * 2.3) + 0.04 * sin(7.0 * pa - uTime * 1.4)));",
    "    float pool = (1.0 - smoothstep(1.1, 1.1 + 2.0 * fwidth(pr) + 0.02, pr)) * uHue[i].a;",
    "    vec3 pc = mix(uHue[i].rgb, vec3(1.0, 0.6, 0.72), 0.4) * mix(0.95, 0.7, smoothstep(0.6, 1.1, pr));",
    "    col = mix(col, pc, pool);",
    "  }",
    "  col *= mix(1.0, 0.5, uDim);",
    "  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;",
    "  outColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader failed");
    return shader;
  }

  // ---- the chrome balls -------------------------------------------------------

  // A dark gunmetal mirror, rendered once into a canvas when the ball appears or
  // changes, never per frame. Each pixel follows the eye's ray off the mirror into
  // a soft room: near black above, a dim grey around the middle, and below, a
  // faint blurred memory of the lilac lines and the coloured pool at the ball's
  // foot, all blending with no hard horizon. One hard white window highlight
  // upper left, a softer second one, a light Fresnel rim and a thin dark edge.
  function smooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function unit(v) {
    var n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  }

  var L1 = unit([-0.42, -0.5, 0.76]), L2 = unit([0.2, -0.5, 0.84]);

  function seen(px, py, pool) {
    var r2 = px * px + py * py, nz = Math.sqrt(Math.max(0, 1 - r2));
    var rx = 2 * nz * px, ry = 2 * nz * py, rz = 2 * nz * nz - 1;
    // the room: dark above, dim grey in the middle, faint lines and the pool below
    var mid = smooth(-0.95, 0.35, ry);
    var c = [14 + 52 * mid, 12 + 48 * mid, 18 + 56 * mid];
    var low = smooth(0.15, 0.85, ry);
    var lines = 0.5 + 0.5 * Math.cos(((px * 0.9 + py * 0.45) / 0.11) * Math.PI * 2);
    var faint = [80 + 12 * lines, 70 + 10 * lines, 94 + 14 * lines];
    c = [c[0] + (faint[0] - c[0]) * low * 0.6, c[1] + (faint[1] - c[1]) * low * 0.6, c[2] + (faint[2] - c[2]) * low * 0.6];
    if (pool) {
      var foot = smooth(0.45, 0.95, ry) * 0.75;
      c = [c[0] + (pool[0] - c[0]) * foot, c[1] + (pool[1] - c[1]) * foot, c[2] + (pool[2] - c[2]) * foot];
    }
    var f = Math.pow(1 - nz, 3) * 0.42; // a light Fresnel rim
    c = [c[0] + (150 - c[0]) * f, c[1] + (142 - c[1]) * f, c[2] + (166 - c[2]) * f];
    var s1 = rx * L1[0] + ry * L1[1] + rz * L1[2];
    var s2 = rx * L2[0] + ry * L2[1] + rz * L2[2];
    var light = Math.min(1, smooth(0.83, 0.875, s1) + smooth(0.6, 0.86, s1) * 0.12 + smooth(0.95, 0.98, s2) * 0.62);
    return [c[0] + (255 - c[0]) * light, c[1] + (255 - c[1]) * light, c[2] + (255 - c[2]) * light];
  }

  function mirror(diameter, pool) {
    var scale = Math.min(2, window.devicePixelRatio || 1);
    var size = Math.max(8, Math.ceil(diameter * scale));
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    var paint = canvas.getContext("2d");
    if (!paint) return canvas;
    var image = paint.createImageData(size, size), data = image.data;
    var edge = 1.5 / (size / 2), half = 0.5 / size;
    for (var j = 0; j < size; j++) {
      for (var i = 0; i < size; i++) {
        var px = ((i + 0.5) / size) * 2 - 1, py = ((j + 0.5) / size) * 2 - 1;
        var r = Math.sqrt(px * px + py * py), k = (j * size + i) * 4;
        if (r > 1) { data[k + 3] = 0; continue; }
        var sum = [0, 0, 0];
        for (var s = 0; s < 4; s++) { // four samples per pixel keep the squeezed lines clean
          var c = seen(Math.max(-1, Math.min(1, px + (s & 1 ? half : -half))), Math.max(-1, Math.min(1, py + (s & 2 ? half : -half))), pool);
          sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
        }
        var dark = smooth(0.965, 1, r) * 0.7;
        data[k] = (sum[0] / 4) * (1 - dark) + 4 * dark;
        data[k + 1] = (sum[1] / 4) * (1 - dark) + 3 * dark;
        data[k + 2] = (sum[2] / 4) * (1 - dark) + 6 * dark;
        data[k + 3] = 255 * Math.min(1, (1 - r) / edge);
      }
    }
    paint.putImageData(image, 0, 0);
    return canvas;
  }

  // The pool at the ball's foot, as the mirror sees it: the thread's hue, a little pinker.
  function poolOf(ball) {
    if (!ball.hues || ball.thread < 0.5) return null;
    var h = rgbOf(ball.hues[0]);
    return [h[0] * 0.6 + 40, h[1] * 0.6 + 22, h[2] * 0.6 + 30];
  }

  var STYLE = [
    ".csg { position: absolute; inset: 0; overflow: hidden; background: #0e0913; }",
    ".csg .drift { position: absolute; inset: 0; will-change: transform; animation: csg-drift var(--csg-drift, 240s) ease-in-out infinite alternate; }",
    "@keyframes csg-drift { from { transform: translate(-1.4vmin, -0.9vmin); } to { transform: translate(1.4vmin, 0.9vmin); } }",
    ".csg canvas.surface { position: absolute; left: -" + MARGIN + "vmin; top: -" + MARGIN + "vmin; width: calc(100% + " + 2 * MARGIN + "vmin);",
    "  height: calc(100% + " + 2 * MARGIN + "vmin); display: block; }",
    ".csg .fallback { position: absolute; inset: -" + MARGIN + "vmin; background: #0e0913 repeating-linear-gradient(-27deg, #0e0913 0 0.5vmin, #6f5a7e 0.5vmin 0.8vmin); }",
    ".csg .balls { position: absolute; inset: 0; transition: opacity 320ms " + EASE_OUT + "; }",
    ".csg .ball { position: absolute; border-radius: 50%; }",
    ".csg .ball .swim { width: 100%; height: 100%; border-radius: 50%; will-change: transform; }",
    // the ball sits sunk in its pool: its foot fades into the surface
    ".csg .ball canvas { display: block; width: 100%; height: 100%; border-radius: 50%;",
    "  -webkit-mask-image: linear-gradient(to bottom, #000 80%, rgba(0,0,0,0.15) 97%); mask-image: linear-gradient(to bottom, #000 80%, rgba(0,0,0,0.15) 97%); }",
    "@media (prefers-reduced-motion: reduce) { .csg .drift { animation: none; } }",
  ].join("\n");

  window.agentScreensaver.register(function () {
    var box, drift, surface, tasksBox, callBox, style, lastState, m, mood = "";
    var gl, program, uniforms = {}, cancelFrame, lastMs, seconds = 0;
    var fps = 30, scale = 0.5, dirty = true;
    var balls = new Map(); // DOM balls by key
    var flow = []; // what the shader shows, easing toward the balls of the mood
    var flood = { now: 0, goal: 0, hue: [1, 0.3, 0.2] }, dim = { now: 0.55, goal: 0.55 };
    var ballData = new Float32Array(MAX_BALLS * 4), hueData = new Float32Array(MAX_BALLS * 4), hue2Data = new Float32Array(MAX_BALLS * 4);

    function measure() {
      m = metrics(box.clientWidth || window.innerWidth, box.clientHeight || window.innerHeight);
    }

    function moodOf(state) {
      var busy = state.cards.some(function (card) { return card.kind !== "finished"; });
      if (state.display !== "main") return busy ? "away" : "idle";
      if (waitingOf(state).length > 0) return "call";
      if (state.cards.length === 0) return "idle";
      return busy ? "work" : "rest";
    }

    // ---- the shader's view of the balls ----

    // From screen px to the surface coordinates the shader works in.
    function toSurface(x, y) {
      var pad = MARGIN * m.vmin, w = m.w + 2 * pad, h = m.h + 2 * pad;
      var px = (x + pad - w / 2) / h, py = (h / 2 - (y + pad)) / h;
      var f = 1 / (1 - PERSP * (px + py) * Math.SQRT1_2);
      return { x: px * f, y: py * f, f: f / h };
    }

    function setFlow(list) {
      var keep = new Set(list.map(function (b) { return b.key; }));
      flow.forEach(function (item) { if (!keep.has(item.key)) item.goal = { r: 0, thread: 0, wake: 0 }; });
      list.forEach(function (ball) {
        var at = toSurface(ball.x, ball.y);
        var goal = { r: ball.r * at.f, thread: ball.thread, wake: ball.wake };
        var item = flow.find(function (f) { return f.key === ball.key; });
        var h1 = ball.hues ? rgbOf(ball.hues[0]) : [200, 170, 220], h2 = ball.hues ? rgbOf(ball.hues[1]) : h1;
        if (!item) {
          item = { key: ball.key, x: at.x, y: at.y, r: 0, thread: 0, wake: 0, wait: 140 };
          if (mood === "" || reduce.matches) { item.r = goal.r; item.thread = goal.thread; item.wake = goal.wake; }
          flow.push(item);
        }
        item.x = at.x; item.y = at.y; item.goal = goal; item.f = at.f; item.size = 2 * ball.r; item.phase = phaseOf(ball.key);
        item.h1 = h1.map(function (c) { return c / 255; });
        item.h2 = h2.map(function (c) { return c / 255; });
      });
      dirty = true;
    }

    function ease(now, goal, frameMs, tauMs) {
      return goal + (now - goal) * Math.exp(-Math.max(0, frameMs) / tauMs);
    }

    function step(frameMs) {
      var still = reduce.matches;
      flow.forEach(function (item) {
        if (item.wait > 0 && !still) { item.wait -= frameMs; return; }
        item.r = still ? item.goal.r : ease(item.r, item.goal.r, frameMs, 110);
        item.thread = still ? item.goal.thread : ease(item.thread, item.goal.thread, frameMs, 500);
        item.wake = still ? item.goal.wake : ease(item.wake, item.goal.wake, frameMs, 900);
      });
      flow = flow.filter(function (item) { return item.goal.r > 0 || item.r > 1e-4; });
      flood.now = still ? flood.goal : ease(flood.now, flood.goal, frameMs, 380);
      dim.now = still ? dim.goal : ease(dim.now, dim.goal, frameMs, 700);
    }

    function render() {
      if (!gl || !surface) return;
      var count = Math.min(MAX_BALLS, flow.length);
      for (var i = 0; i < MAX_BALLS; i++) {
        var item = i < count ? flow[i] : undefined, at = i * 4;
        var sw = item && !reduce.matches ? swimOf(item.phase, seconds, item.size) : { x: 0, y: 0 };
        // screen px to surface units (y flips)
        ballData[at] = item ? item.x + sw.x * item.f : 0; ballData[at + 1] = item ? item.y - sw.y * item.f : 0;
        ballData[at + 2] = item ? item.r : 0; ballData[at + 3] = item ? item.wake : 0;
        hueData[at] = item ? item.h1[0] : 0; hueData[at + 1] = item ? item.h1[1] : 0; hueData[at + 2] = item ? item.h1[2] : 0;
        hueData[at + 3] = item ? item.thread : 0;
        hue2Data[at] = item ? item.h2[0] : 0; hue2Data[at + 1] = item ? item.h2[1] : 0; hue2Data[at + 2] = item ? item.h2[2] : 0;
      }
      gl.viewport(0, 0, surface.width, surface.height);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uRes, surface.width, surface.height);
      gl.uniform1f(uniforms.uTime, seconds + 40);
      gl.uniform1i(uniforms.uCount, count);
      gl.uniform4fv(uniforms.uBall, ballData);
      gl.uniform4fv(uniforms.uHue, hueData);
      gl.uniform4fv(uniforms.uHue2, hue2Data);
      gl.uniform1f(uniforms.uFlood, flood.now);
      gl.uniform3f(uniforms.uFloodHue, flood.hue[0], flood.hue[1], flood.hue[2]);
      gl.uniform1f(uniforms.uDim, dim.now);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(nowMs) {
      var frameMs = Math.min(100, nowMs - (lastMs === undefined ? nowMs - 1000 / fps : lastMs));
      lastMs = nowMs;
      // Under reduced motion the surface is drawn only when something changed.
      if (reduce.matches && !dirty) return;
      dirty = false;
      if (!reduce.matches) seconds += frameMs / 1000;
      step(frameMs);
      render();
      if (!reduce.matches) {
        balls.forEach(function (entry) {
          var sw = swimOf(entry.phase, seconds, 2 * entry.r);
          entry.swim.style.transform = "translate(" + sw.x.toFixed(2) + "px," + sw.y.toFixed(2) + "px) rotate(" + sw.turn.toFixed(2) + "deg)";
        });
      }
    }

    function fit() {
      if (!surface) return;
      var rect = surface.getBoundingClientRect();
      var w = Math.max(1, rect.width || box.clientWidth), h = Math.max(1, rect.height || box.clientHeight);
      surface.width = Math.max(320, Math.round(w * scale));
      surface.height = Math.max(1, Math.round((surface.width * h) / w));
      dirty = true;
    }

    function setUpGl() {
      surface = document.createElement("canvas");
      surface.className = "surface";
      drift.insertBefore(surface, drift.firstChild);
      var context = surface.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
      if (!context) throw new Error("no webgl2");
      gl = context;
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
      ["uRes", "uTime", "uCount", "uBall", "uHue", "uHue2", "uFlood", "uFloodHue", "uDim"].forEach(function (name) {
        uniforms[name] = gl.getUniformLocation(program, name);
      });
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var where = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(where);
      gl.vertexAttribPointer(where, 2, gl.FLOAT, false, 0, 0);
    }

    function fallBack() {
      if (surface) surface.remove();
      surface = undefined;
      gl = undefined;
      var plain = document.createElement("div");
      plain.className = "fallback";
      drift.insertBefore(plain, drift.firstChild);
    }

    // ---- the DOM balls ----

    // Each ball floats: a slow drift and bob of about 1.5% of its size and a tiny
    // rock, from a few sines with periods 4 to 9 s, its own phases per ball.
    function phaseOf(key) {
      var hash = 0;
      for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
      return [0, 1, 2, 3, 4].map(function (k) { return (((hash >>> (k * 5)) & 31) / 31) * Math.PI * 2; });
    }

    function swimOf(phase, t, size) {
      var A = 0.015 * size, T = Math.PI * 2;
      return {
        x: A * (0.6 * Math.sin((T * t) / 6.1 + phase[0]) + 0.4 * Math.sin((T * t) / 8.7 + phase[1])),
        y: A * (0.6 * Math.sin((T * t) / 5.3 + phase[2]) + 0.4 * Math.sin((T * t) / 4.1 + phase[3])),
        turn: 0.9 * Math.sin((T * t) / 6.7 + phase[4]),
      };
    }

    function placeBall(node, ball) {
      node.style.width = node.style.height = (2 * ball.r).toFixed(1) + "px";
      node.style.left = (ball.x - ball.r).toFixed(1) + "px";
      node.style.top = (ball.y - ball.r).toFixed(1) + "px";
    }

    function looksOf(ball) {
      return [Math.round(ball.r), (poolOf(ball) || []).map(Math.round).join(",")].join("|");
    }

    function arrive(node, order, motion) {
      if (reduce.matches) {
        node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: order * 70, easing: "ease-out", fill: "backwards" });
        return;
      }
      node.animate([{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: motion.duration, delay: 120 + order * 70, easing: motion.easing, fill: "backwards" });
    }

    function leave(node) {
      var motion = node.animate([{}, { opacity: 0, transform: reduce.matches ? "none" : "scale(0.85)" }], { duration: 220, easing: EASE_OUT, fill: "forwards" });
      motion.onfinish = function () { node.remove(); };
    }

    function drawBalls(list, holder, motion) {
      var wanted = new Set(), fresh = 0;
      list.forEach(function (ball) {
        wanted.add(ball.key);
        var entry = balls.get(ball.key);
        if (!entry) {
          entry = { node: document.createElement("div"), swim: document.createElement("div"), holder: holder, x: ball.x, y: ball.y, r: ball.r,
            looks: looksOf(ball), phase: phaseOf(ball.key) };
          entry.node.className = "ball";
          entry.swim.className = "swim";
          entry.node.appendChild(entry.swim);
          balls.set(ball.key, entry);
          holder.appendChild(entry.node);
          placeBall(entry.node, ball);
          entry.swim.replaceChildren(mirror(2 * ball.r, poolOf(ball)));
          if (mood !== "") arrive(entry.node, fresh++, motion);
          return;
        }
        var moved = Math.abs(entry.x - ball.x) > 1 || Math.abs(entry.r - ball.r) > 1;
        if (moved && !reduce.matches) {
          // FLIP: the ball glides to its new place and size instead of jumping.
          var dx = entry.x - ball.x, dy = entry.y - ball.y, s = entry.r / ball.r;
          entry.node.animate([{ transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")" }, { transform: "none" }],
            { duration: SETTLE.duration, easing: SETTLE.easing });
        }
        placeBall(entry.node, ball);
        var looks = looksOf(ball);
        if (looks !== entry.looks) {
          entry.swim.replaceChildren(mirror(2 * ball.r, poolOf(ball)));
          entry.looks = looks;
        }
        entry.x = ball.x; entry.y = ball.y; entry.r = ball.r;
      });
      balls.forEach(function (entry, key) {
        if (entry.holder !== holder || wanted.has(key)) return;
        balls.delete(key);
        leave(entry.node);
      });
    }

    function draw(state) {
      if (!box) return;
      measure();
      var next = moodOf(state);
      var list = ballsFor(next, state, m);
      if (next === "call") {
        drawBalls([], tasksBox, SETTLE);
        drawBalls(list, callBox, LAND);
        var h = rgbOf(list[0].hues[0]);
        flood.hue = [h[0] / 255, h[1] / 255, h[2] / 255];
        flood.goal = 1;
      } else {
        drawBalls([], callBox, LAND);
        drawBalls(list, tasksBox, SETTLE);
        flood.goal = 0;
      }
      dim.goal = next === "rest" ? 0.5 : next === "idle" ? 0.55 : 0;
      setFlow(list);
      box.classList.remove("work", "rest", "call", "idle", "away");
      box.classList.add(next);
      mood = next;
    }

    var onResize = function () {
      fit();
      if (lastState) draw(lastState);
    };

    return {
      start: function (root, ctx) {
        style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "csg";
        drift = document.createElement("div");
        drift.className = "drift";
        var minutes = Number(ctx.options.drift);
        if (Number.isFinite(minutes) && minutes > 0) drift.style.setProperty("--csg-drift", Math.round(minutes * 60) + "s");
        var wantFps = Number(ctx.options.fps), wantScale = Number(ctx.options.scale);
        if (Number.isFinite(wantFps)) fps = Math.min(60, Math.max(10, wantFps));
        if (Number.isFinite(wantScale)) scale = Math.min(1, Math.max(0.25, wantScale));
        tasksBox = document.createElement("div");
        tasksBox.className = "balls tasks";
        callBox = document.createElement("div");
        callBox.className = "balls";
        drift.append(tasksBox, callBox);
        box.appendChild(drift);
        root.append(style, box);
        try {
          setUpGl();
        } catch (err) {
          console.error("[stavgayer.currents-ground] WebGL setup failed", err);
          fallBack();
        }
        measure();
        fit();
        window.addEventListener("resize", onResize);
        // Before the first state arrives: the calm surface with its one ball.
        draw({ display: ctx.display, cards: [], nowMs: ctx.now() });
        if (gl) cancelFrame = ctx.requestFrame(frame, fps);
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      stop: function () {
        window.removeEventListener("resize", onResize);
        if (cancelFrame) cancelFrame();
        cancelFrame = undefined;
        if (gl) {
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
        }
        if (box) box.remove();
        if (style) style.remove();
        box = drift = surface = tasksBox = callBox = style = lastState = gl = program = undefined;
        balls.clear();
        flow = [];
        mood = "";
        lastMs = undefined;
        seconds = 0;
      },
    };
  });
})();
