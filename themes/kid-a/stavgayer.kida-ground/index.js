// The Kid A range. The sleeve was made by painting thick putty, soot and red
// stain onto canvas, scraping it with knives and sticks, photographing it, and
// letting software turn the brightness of the picture into mountains: bright
// became peak, dark became valley. Here the data of the agents does the same:
// each agent raises one ridge of cracked, ice-white shards over its card.
//   work: the ridge grows with the time the task has run; its colour runs down
//         the face in thin stains, a small pixel fire burns over the summit, and
//         the colour travels along the conduits below;
//   done: the stains stop and the ridge freezes white; soot marks stay in the
//         snow, like prints;
//   rest: all done: the whole range freezes and the light drops;
//   call: an agent waits: its ridge stands tall on the right, a great fire
//         burns over it, the sky turns its colour, and the conduits fill;
//   idle: no tasks: a low, quiet range under a wide dot sky;
//   away: a second display: the ridges stand right of the time, with no cards.
// Over the range hangs a band of white dots (snow or stars) that drifts and
// twinkles. Under it, nested conduit lines run along and turn down at the sides.
// The computer's hand shows as bars dragged down at the foot of the range and a
// few thin bands dragged sideways, which come and go.
//
// It is one WebGL fragment shader. It renders at half size, at most 30 frames a
// second, through the runtime's frame clock, so it stops when the screen saver
// stops. With reduced motion it is drawn once and stands still.
(function () {
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  var OWN = { claude: "#ff4b33", codex: "#4fc8ff", cursor: "#ffb21f" };
  var SPARE = ["#ff6fae", "#5fe0b4", "#b9a4ff", "#ffd36a", "#7fa8ff", "#ff8a4c"];
  var MAX_PEAKS = 8;
  var MARGIN = 3; // vmin of slack on every side for the drift
  var HORIZON = 0.64, LOW = 0.97; // the foot of the range, as a share of the screen height from the top: with tasks, and without
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // ---- where the peaks stand (the board uses the same numbers for its cards) ----

  function metrics(w, h) {
    return { w: w, h: h, vmin: Math.min(w, h) / 100, vw: w / 100, vh: h / 100 };
  }

  function cardSlots(count, m) {
    var gap = 4.6 * m.vmin, side = 6.5 * m.vmin;
    var width = Math.min(30 * m.vw, (m.w - 2 * side - (count - 1) * gap) / count);
    var out = [];
    for (var i = 0; i < count; i++) out.push({ x: side + width / 2 + i * (width + gap), w: width });
    return out;
  }

  function waitingOf(state) {
    return state.cards.filter(function (card) { return card.kind === "approval"; }).sort(function (a, b) {
      return (a.approval_since_ms || Infinity) - (b.approval_since_ms || Infinity);
    });
  }

  // Each peak in screen px: where it stands, half its width, its height, how
  // much it melts, its hue and whether it stands for a task.
  function peaksFor(mood, state, m) {
    // Without cards the range comes down to the foot of the screen and fills it: low
    // ridges on the left under the time, the high ones on the right.
    var calmRange = [
      { key: "calm:a", x: 9 * m.vw, half: 13 * m.vw, height: 30 * m.vh },
      { key: "calm:b", x: 29 * m.vw, half: 14 * m.vw, height: 34 * m.vh },
      { key: "calm:c", x: 51 * m.vw, half: 13 * m.vw, height: 40 * m.vh },
      { key: "calm:d", x: 72 * m.vw, half: 15 * m.vw, height: 50 * m.vh },
      { key: "calm:e", x: 92 * m.vw, half: 12 * m.vw, height: 42 * m.vh },
    ].map(function (p) { p.melt = 0; p.task = 0; p.hue = null; return p; });
    if (mood === "idle") return calmRange;
    if (mood === "away") {
      // A second display has no cards: the task ridges stand on the right, the calm ones under the time.
      var busy = state.cards.slice(0, MAX_PEAKS - 2);
      var step = 46 / Math.max(1, busy.length);
      return calmRange.slice(0, 2).concat(busy.map(function (card, i) {
        var done = card.kind === "finished";
        return { key: card.source + "\u0000" + card.session, x: (52 + step * (i + 0.5)) * m.vw, half: Math.min(15, step * 0.7) * m.vw,
          height: (40 + 8 * ((i + 1) % 2)) * m.vh, melt: done ? 0 : 1, task: 1, hue: hueOf(card.source) };
      }));
    }
    if (mood === "call") {
      var first = waitingOf(state)[0];
      return [{ key: "call:" + first.source + "\u0000" + first.session, x: 77 * m.vw, half: 17 * m.vw, height: 34 * m.vh,
        melt: 1.5, task: 1, hue: hueOf(first.source) }];
    }
    var slots = cardSlots(state.cards.length, m);
    return state.cards.map(function (card, i) {
      var done = card.kind === "finished";
      // A peak grows with the time its task has run, from a hill to a summit in 40 minutes.
      var ran = Math.max(0, (done ? card.updated_at_ms : state.nowMs) - card.started_at_ms);
      var grown = Math.min(1, ran / (40 * 60000));
      return { key: card.source + "\u0000" + card.session, x: slots[i].x, half: slots[i].w * 0.46,
        height: (22 + 11 * Math.sqrt(grown)) * m.vh, melt: done ? 0 : 1, task: 1, hue: hueOf(card.source) };
    });
  }

  // ---- the shader ---------------------------------------------------------------

  var VERTEX = "#version 300 es\nin vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }";

  var FRAGMENT = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform float uHorizon;",
    "uniform int uCount;",
    "uniform vec4 uPeak[" + MAX_PEAKS + "]; // x, half width, height, melt",
    "uniform vec4 uHue[" + MAX_PEAKS + "];  // hue, 1 for a task peak",
    "uniform float uFlood;",
    "uniform vec3 uFloodHue;",
    "uniform float uFloodX;",
    "uniform float uDim;",
    "uniform float uCalm;",
    "uniform vec4 uKeep; // where the big words stand: fewer dots there",
    "out vec4 outColor;",
    "float h1(float n) { return fract(sin(n * 127.1 + 0.37) * 43758.5453); }",
    "float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float n1(float x) { float i = floor(x), f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), u) * 2.0 - 1.0; }",
    "float n2(vec2 p) {",
    "  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y) * 2.0 - 1.0;",
    "}",
    "float ridged(float x) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * (1.0 - abs(n1(x))); x = x * 2.07 + 1.3; a *= 0.5; } return s; }",
    "float spike(float x) { float r = ridged(x); return r * r * 1.25; }",
    "float smax(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(a, b, h) + k * h * (1.0 - h); }",
    // The range is made from data, as the sleeve's was made from the brightness of a
    // painting: a low base range, and one ridge raised by each agent.
    "float peakT(vec4 p, float fi, float x) {",
    "  float lean = 0.18 * (h1(fi * 3.3 + 1.0) - 0.5);",
    "  float u = (x - p.x) / max(p.y, 1e-4) - lean;",
    "  return 1.0 - (u < 0.0 ? -u * (0.85 + 0.3 * h1(fi + 4.0)) : u * (1.15 - 0.3 * h1(fi + 4.0)));",
    "}",
    "float ridge(float x) {",
    "  float r = 0.04 + (0.11 * spike(x * 2.6 + 2.0) + 0.02 * ridged(x * 9.0 + 7.0)) * (1.0 - 0.3 * uCalm);",
    "  for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "    if (i >= uCount) break;",
    "    vec4 p = uPeak[i]; float fi = float(i);",
    "    float t = peakT(p, fi, x);",
    "    if (t > 0.0) r = smax(r, p.z * pow(t, 1.45) * (0.78 + 0.3 * ridged((x - p.x) / max(p.y, 1e-4) * 2.4 + fi * 3.7)), 0.008);",
    "    float u = (x - p.x) / max(p.y, 1e-4), side = h1(fi * 7.1) > 0.5 ? 1.0 : -1.0;",
    "    float t2 = 1.0 - abs(u - side * 0.62) / 0.42;",
    "    if (t2 > 0.0) r = smax(r, p.z * 0.58 * pow(t2, 1.3) * (0.8 + 0.3 * ridged(u * 5.0 + fi)), 0.008);",
    "  }",
    // the knife leaves the edge broken: small teeth, and bites taken out of it
    "  r += 0.0045 * ridged(x * 55.0) + 0.0018 * n1(x * 260.0);",
    "  r -= 0.007 * smoothstep(0.78, 0.97, h1(floor(x * 70.0))) * (0.5 + 0.5 * n1(x * 400.0));",
    "  return r;",
    "}",
    // a smoother copy of the crest line: the big flat planes take their light from it
    "float plane(float x) {",
    "  float r = 0.04 + 0.11 * spike(x * 2.6 + 2.0) * (1.0 - 0.3 * uCalm);",
    "  for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "    if (i >= uCount) break;",
    "    float t = peakT(uPeak[i], float(i), x);",
    "    if (t > 0.0) r = max(r, uPeak[i].z * pow(t, 1.45));",
    "  }",
    "  return r;",
    "}",
    "float far(float x) { return 0.08 + 0.15 * spike(x * 1.7 + 11.0) * (1.0 - 0.4 * uCalm); }",
    // one layer of the dot sky: round flakes on a drifting grid
    "vec4 flakes(vec2 uv, float cs, float dens, float t, float seed) {",
    "  vec2 g = (uv + vec2(t * 0.0022, t * 0.0004)) / cs; vec2 id = floor(g), f = fract(g) - 0.5;",
    "  float k = h2(id + seed);",
    "  if (k >= dens) return vec4(0.0);",
    "  vec2 off = (vec2(h2(id + seed + 3.1), h2(id + seed + 5.7)) - 0.5) * 0.4;",
    "  float r = (0.13 + 0.22 * h2(id + seed + 7.3)) * (0.86 + 0.14 * sin(t * 0.7 + k * 60.0));",
    "  float e = (1.0 / uRes.y) / cs;",
    "  float a = 1.0 - smoothstep(-e, e, length(f - off) - r);",
    "  return vec4(id, h2(id + seed + 9.9), a);",
    "}",
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / uRes.y;",
    "  float A = uRes.x / uRes.y, x = uv.x, y = uv.y, H = uHorizon, t = uTime;",
    "  float px = 1.0 / uRes.y;",
    // the computer's hand: the foot of the range dragged down into bars, and a few bands dragged sideways
    "  float col1 = floor(x * 260.0);",
    "  float foot = step(0.55, h1(col1 * 1.3 + floor(t / 31.0))) * (1.0 - smoothstep(H, H + 0.045, y));",
    "  float yy = mix(y, H + 0.045 + 0.01 * h1(col1), foot);",
    "  float band = floor((y + t * 0.0025) * 110.0);",
    "  float cyc = t / 23.0 + h1(band * 1.7) * 5.0, sid = floor(cyc), ph = fract(cyc);",
    "  float on = step(0.955, h1(band * 3.1 + sid * 7.3)) * smoothstep(0.0, 0.2, ph) * smoothstep(1.0, 0.8, ph);",
    "  float x0 = h1(band + sid * 1.31) * A, len = 0.02 + 0.08 * h1(band * 5.0 + sid);",
    "  float drag = on * step(x0, x) * step(x, x0 + len) * step(H, y) * step(y, H + 0.42);",
    "  float xs = mix(x, x0 + (x - x0) * 0.03, drag);",
    "  vec3 col;",
    "  if (y >= H) {",
    // the sky: soot black, a red band low over the range drawn in scan lines, red all over when an agent waits
    "    col = vec3(0.022, 0.024, 0.032) * (1.0 + 0.5 * n2(uv * 6.0));",
    "    float blot = smoothstep(-0.35, 0.45, n2(vec2(x * 3.0, y * 6.0)) + 0.5 * n2(vec2(x * 11.0, y * 19.0)));",
    "    float redBand = exp(-pow((y - (H + 0.16 + 0.24 * uCalm)) / 0.085, 2.0)) * blot * (0.5 - 0.2 * uCalm);",
    "    float redSky = clamp(1.25 - (y - H) * 1.6 + 0.4 * n2(vec2(x * 2.0, y * 4.0)), 0.0, 1.0);",
    "    float red = mix(redBand, redSky * (0.55 + 0.45 * blot), uFlood);",
    "    float scan = 0.78 + 0.22 * step(0.5, fract(gl_FragCoord.y / 3.0));",
    "    vec3 redCol = mix(vec3(0.34, 0.1, 0.075), uFloodHue * 0.62, uFlood) * scan;",
    "    col = mix(col, redCol, red);",
    // the dot sky: snow or stars, densest in a band above the range, thin where the big words stand
    "    vec2 kq = smoothstep(uKeep.xy - 0.04, uKeep.xy, uv) * (1.0 - smoothstep(uKeep.zw, uKeep.zw + 0.04, uv));",
    "    float dens = (0.014 + 0.72 * exp(-pow((y - (H + 0.3 + 0.32 * uCalm)) / 0.13, 2.0)) * (0.5 + 0.5 * smoothstep(-0.6, 0.4, n2(vec2(x * 2.2, y * 3.0))))) * (1.0 - kq.x * kq.y) * (1.0 - 0.5 * uCalm);",
    "    vec4 fa = flakes(uv, 0.017, dens, t, 0.0);",
    "    vec4 fb = flakes(uv * 1.0 + 0.37, 0.0095, dens * 0.8, t * 1.4, 17.0);",
    "    for (int L = 0; L < 2; L++) {",
    "      vec4 fl = L == 0 ? fa : fb;",
    "      if (fl.a <= 0.0) continue;",
    "      vec3 dc = vec3(0.93, 0.94, 0.96) * (L == 0 ? 1.0 : 0.72);",
    // flakes near a working ridge take its colour, like blossoms
    "      for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "        if (i >= uCount) break;",
    "        vec4 p = uPeak[i];",
    "        float nearP = 1.0 - smoothstep(0.4, 1.2, abs(x - p.x) / max(p.y, 1e-4));",
    "        if (fl.z < 0.2 * min(p.w, 1.0) * nearP) dc = mix(uHue[i].rgb, vec3(1.0), 0.15);",
    "      }",
    "      if (fl.z < 0.55 * uFlood) dc = mix(uFloodHue, vec3(1.0), 0.25);",
    "      col = mix(col, dc, fl.a);",
    "    }",
    // the far range: lower, bluer shards, half lost in the dark, with snow on the crests and a grain of paint
    "    float fr = far(x) + 0.004 * ridged(x * 40.0), fd = H + fr - y;",
    "    if (fd > -2.0 * px) {",
    "      float fs = (far(x + 0.005) - far(x - 0.005)) / 0.01 + 0.35 * n2(vec2(x * 6.0, y * 4.0));",
    "      float fl = smoothstep(-0.12, 0.12, fs);",
    "      vec3 fc = mix(vec3(0.12, 0.15, 0.21), vec3(0.32, 0.38, 0.48), fl);",
    "      float cap = 1.0 - smoothstep(0.18 * fr, 0.26 * fr, fd + 0.01 * n2(vec2(x * 30.0, y * 9.0)));",
    "      fc = mix(fc, vec3(0.56, 0.61, 0.7), cap * (0.35 + 0.55 * fl));",
    "      fc *= 0.88 + 0.24 * (0.5 + 0.5 * n2(uv * 210.0));",
    "      fc *= (1.0 + 0.12 * n2(vec2(x * 120.0 + y * 20.0, y * 7.0))) * mix(0.62, 1.0, smoothstep(0.0, 0.7, (y - H) / max(fr, 1e-3)));",
    "      fc = mix(fc, col, 0.22) * (1.0 - 0.35 * uDim);",
    "      col = mix(col, fc, clamp(fd / px + 0.5, 0.0, 1.0));",
    "    }",
    // fire: a small pixel blot of the agent's colour over each working summit; a great one when it waits
    "    vec2 qp = floor(uv / 0.0052) * 0.0052;",
    "    for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "      if (i >= uCount) break;",
    "      vec4 p = uPeak[i]; float m = min(p.w, 1.0);",
    "      if (m <= 0.01) continue;",
    "      float big = 1.0 + 2.6 * uFlood * step(abs(p.x - uFloodX), 0.001);",
    "      vec2 c = vec2(p.x - p.y * 0.22, H + p.z * 0.86 + 0.02 * big);",
    "      vec2 dq = (qp - c) / (vec2(0.06, 0.028) * big);",
    "      float shape = 1.0 - length(dq) + 0.5 * n2(qp * 30.0 + float(i) * 9.0 + vec2(0.0, t * 0.04)) + 0.3 * n2(qp * 90.0 + float(i));",
    "      float fire = step(0.42, shape) * m;",
    "      vec3 fc = mix(uHue[i].rgb * 0.62, uHue[i].rgb, step(0.55, shape));",
    "      fc = mix(fc, mix(uHue[i].rgb, vec3(1.0, 0.85, 0.6), 0.45), step(0.8, shape));",
    "      col = mix(col, fc, fire);",
    "    }",
    // the near range: flat shards of ice and putty, cracked
    "    float r = ridge(xs), d = H + r - yy;",
    "    if (d > -2.0 * px) {",
    "      float e = 0.006;",
    "      float xf = xs + d * (0.9 * n2(vec2(xs * 5.0, yy * 3.0)) + 0.35 * n2(vec2(xs * 17.0, yy * 9.0)));",
    "      float sl = (plane(xf + e) - plane(xf - e)) / (2.0 * e) + 0.25 * n2(vec2(xs * 3.0, yy * 2.0)) - 0.05;",
    "      float lit = smoothstep(-0.04, 0.04, sl);",
    "      float edge = (plane(xf + e) - plane(xf - e)) / (2.0 * e);",
    "      vec2 kdir = lit > 0.5 ? vec2(0.62, 0.78) : vec2(-0.62, 0.78);",
    "      vec2 kp = vec2(dot(vec2(xs, yy), vec2(kdir.y, -kdir.x)), dot(vec2(xs, yy), kdir));",
    "      float shard = n2(vec2(kp.x * 10.0, kp.y * 2.2)) + 0.25 * n2(vec2(xs * 4.0, yy * 3.0));",
    "      float stroke = 0.6 * n2(vec2(kp.x * 140.0, kp.y * 7.0)) + 0.4 * n2(vec2(kp.x * 320.0, kp.y * 16.0));",
    "      vec3 white = vec3(0.92, 0.935, 0.95), pale = vec3(0.66, 0.72, 0.8), blue = vec3(0.24, 0.37, 0.64);",
    "      float frost = 0.0, task = 0.0;",
    "      for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "        if (i >= uCount) break;",
    "        vec4 p = uPeak[i]; float near = 1.0 - smoothstep(0.5, 1.1, abs(xs - p.x) / max(p.y, 1e-4));",
    "        frost = max(frost, uHue[i].a * (1.0 - min(p.w, 1.0)) * near);",
    "      }",
    "      vec3 mc = mix(pale, white, lit);",
    "      float bluePatch = smoothstep(0.25, 0.55, shard + 0.3 * n2(vec2(xs * 22.0, yy * 15.0))) * (1.0 - lit) * (1.0 - 0.7 * frost);",
    "      mc = mix(mc, blue, bluePatch);",
    "      mc = mix(mc, mc * vec3(0.78, 0.8, 0.86), smoothstep(0.1, 0.0, yy - H) * 0.6);",
    "      mc *= 1.0 + 0.07 * stroke;",
    // the paint itself: whites and blues that drift warm and cold, an oil-yellowed patch,
    // the raking light on the putty, and a fine grain
    "      float tint = n2(vec2(xs * 2.5, yy * 2.0));",
    "      mc *= vec3(1.0 + 0.035 * tint, 1.0, 1.0 - 0.04 * tint);",
    "      mc = mix(mc, mc * vec3(1.0, 0.95, 0.8), smoothstep(0.35, 0.75, n2(vec2(xs * 3.0 + 5.0, yy * 2.5))) * 0.4 * lit);",
    "      float bump = n2(uv * vec2(150.0, 110.0)) + 0.5 * n2(uv * vec2(380.0, 300.0));",
    "      float bump2 = n2((uv + 0.0016) * vec2(150.0, 110.0)) + 0.5 * n2((uv + 0.0016) * vec2(380.0, 300.0));",
    "      mc *= 1.0 + 0.17 * (bump - bump2) + 0.05 * bump;",
    "      mc *= 0.955 + 0.09 * h2(floor(gl_FragCoord.xy));",
    // soot rubbed into the valleys, and a few stains of red oil
    "      float valley = smoothstep(0.025, 0.14, d) * (1.0 - 0.6 * lit);",
    "      float sootN = smoothstep(0.0, 0.7, n2(vec2(xs * 5.0, yy * 3.5)) + 0.5 * n2(vec2(kp.x * 30.0, kp.y * 4.0)));",
    "      mc = mix(mc, vec3(0.12, 0.12, 0.14), valley * sootN * 0.6 * (1.0 - 0.6 * frost));",
    "      float stain = smoothstep(0.72, 0.86, n2(vec2(xs * 8.0 + 13.0, yy * 6.0)) + 0.3 * n2(uv * 60.0));",
    "      mc = mix(mc, vec3(0.52, 0.16, 0.11), stain * 0.55);",
    // cracks along the edges of the planes, and the knife's scratches
    "      float crackA = 1.0 - smoothstep(0.0, 1.6 * fwidth(edge) + 1e-4, abs(edge));",
    "      float crackB = (1.0 - smoothstep(0.0, 1.3 * fwidth(shard) + 1e-4, abs(shard - 0.25))) * 0.85;",
    "      float scratch = smoothstep(0.965, 0.995, 1.0 - abs(n2(vec2(kp.x * 60.0, kp.y * 2.0)))) * 0.7;",
    "      float crack = max(max(crackA, crackB), scratch) * smoothstep(0.004, 0.012, d) * (1.0 - 0.5 * frost);",
    "      mc = mix(mc, vec3(0.05, 0.06, 0.09), crack);",
    // hairline scratches from a stick, dark or white, each in its own direction
    "      vec2 sc = uv / 0.034; vec2 cid = floor(sc), cf = fract(sc) - 0.5;",
    "      float ang = h2(cid + 1.7) * 6.2832; vec2 dir = vec2(cos(ang), sin(ang));",
    "      float hl = (1.0 - smoothstep(0.0, 0.9 * px / 0.034, abs(dot(cf, vec2(-dir.y, dir.x)))))",
    "        * step(abs(dot(cf, dir)), 0.2 + 0.3 * h2(cid + 2.3)) * step(0.5, h2(cid + 5.1)) * smoothstep(0.006, 0.02, d);",
    "      mc = mix(mc, h2(cid + 8.9) > 0.35 ? vec3(0.07, 0.075, 0.09) : vec3(1.0), hl * 0.65);",
    // soot flecks and white splatter in the putty; a ridge that is done keeps its marks, like footprints in snow
    "      vec2 sg = uv / 0.0045; vec2 sid2 = floor(sg); float sk = h2(sid2 + 41.0);",
    "      float speck = 1.0 - smoothstep(0.18, 0.32, length(fract(sg) - 0.5));",
    "      mc = mix(mc, vec3(0.06, 0.06, 0.08), speck * step(sk, 0.035 + 0.05 * frost));",
    "      mc = mix(mc, vec3(1.0), speck * step(0.985, sk) * (1.0 - lit));",
    // each working agent's colour runs down its ridge in thin stains; a waiting one stains it all
    "      for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "        if (i >= uCount) break;",
    "        vec4 p = uPeak[i]; float m = p.w;",
    "        if (m <= 0.001) continue;",
    "        float u = (xs - p.x) / max(p.y, 1e-4);",
    "        if (abs(u) >= 1.0) continue;",
    "        float near = 1.0 - smoothstep(0.3, 0.95, abs(u));",
    "        float lane = u * 13.0 + 0.5 * n2(vec2(yy * 16.0, float(i) * 4.0));",
    "        float line = smoothstep(0.78, 0.92, 1.0 - abs(n1(lane * 1.6 + float(i) * 5.0)));",
    "        float flow = 0.65 + 0.35 * sin(yy * 110.0 + t * 2.4 + lane * 3.0);",
    "        float down = smoothstep(0.01, 0.06, d);",
    "        vec3 hue = uHue[i].rgb;",
    "        mc = mix(mc, hue * (0.7 + 0.3 * flow), clamp(line * down * near * min(m, 1.0), 0.0, 1.0) * 0.95);",
    "        float wash = smoothstep(0.1, 0.6, n2(vec2(xs * 7.0, yy * 5.0)) + 0.6 * (1.0 - (yy - H) / max(p.z, 1e-3)));",
    "        mc = mix(mc, hue * mix(0.55, 0.85, lit), wash * near * max(m - 1.0, 0.0) * 1.4);",
    "      }",
    "      mc *= 1.0 - 0.3 * uDim;",
    "      col = mix(col, mc, clamp(d / px + 0.5, 0.0, 1.0));",
    "    }",
    "    col *= 1.0 + 0.08 * drag;",
    "  } else {",
    // the ground: black, crossed by nested conduits that run along under the range and turn down at both sides
    "    col = vec3(0.018, 0.02, 0.026);",
    "    float sp = 0.0105, top = H - 0.008, R0 = 0.1, e0 = 0.012;",
    "    vec2 cl = vec2(e0 + R0, top - R0), cr = vec2(A - e0 - R0, top - R0);",
    "    for (int k = 0; k < 7; k++) {",
    "      float fk = float(k), Rk = R0 - fk * sp;",
    "      float dist;",
    "      if (x < cl.x && y > cl.y) dist = abs(length(vec2(x, y) - cl) - Rk);",
    "      else if (x > cr.x && y > cr.y) dist = abs(length(vec2(x, y) - cr) - Rk);",
    "      else if (x < cl.x) dist = abs(x - (cl.x - Rk));",
    "      else if (x > cr.x) dist = abs(x - (cr.x + Rk));",
    "      else dist = abs(y - (cl.y + Rk));",
    "      float w = 0.0019;",
    "      float a = 1.0 - smoothstep(w - px, w + px, dist);",
    "      if (a <= 0.0) continue;",
    "      vec3 lc = k == 0 || k == 3 ? vec3(0.9, 0.92, 0.95) : k == 1 || k == 4 ? vec3(0.7, 0.68, 0.9) : k == 5 ? vec3(0.66, 0.77, 0.9) : vec3(0.47, 0.57, 0.85);",
    "      lc *= 0.82;",
    // under each working ridge its colour travels along the top conduits
    "      for (int i = 0; i < " + MAX_PEAKS + "; i++) {",
    "        if (i >= uCount || k > 2) break;",
    "        vec4 p = uPeak[i]; float m = min(p.w, 1.0);",
    "        if (m <= 0.001) continue;",
    "        float u = (x - p.x) / max(p.y, 1e-4);",
    "        float span = 1.0 - smoothstep(0.7, 1.05, abs(u));",
    "        float dash = step(0.45, fract(abs(u) * 6.0 - t * 0.35 + fk * 0.33));",
    "        lc = mix(lc, uHue[i].rgb, span * dash * m);",
    "      }",
    "      lc = mix(lc, mix(uFloodHue, vec3(1.0), fk == 0.0 || fk == 3.0 ? 0.35 : 0.0), uFlood);",
    "      col = mix(col, lc, a);",
    "    }",
    "  }",
    "  col *= 1.0 - 0.38 * uDim;",
    "  col += (h2(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;",
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

  var STYLE = [
    ".kag { position: absolute; inset: 0; overflow: hidden; background: #0b0d10; }",
    ".kag .drift { position: absolute; inset: 0; will-change: transform; animation: kag-drift var(--kag-drift, 240s) ease-in-out infinite alternate; }",
    "@keyframes kag-drift { from { transform: translate(-1.4vmin, -0.6vmin); } to { transform: translate(1.4vmin, 0.6vmin); } }",
    ".kag canvas { position: absolute; left: -" + MARGIN + "vmin; top: -" + MARGIN + "vmin; width: calc(100% + " + 2 * MARGIN + "vmin);",
    "  height: calc(100% + " + 2 * MARGIN + "vmin); display: block; }",
    ".kag .fallback { position: absolute; inset: -" + MARGIN + "vmin; background: #14181d; }",
    "@media (prefers-reduced-motion: reduce) { .kag .drift { animation: none; } }",
  ].join("\n");

  window.agentScreensaver.register(function () {
    var box, drift, surface, style, lastState, m, mood = "";
    var gl, program, uniforms = {}, cancelFrame, lastMs, seconds = 0;
    var fps = 30, scale = 0.5, dirty = true;
    var peaks = []; // what the shader shows, easing toward the peaks of the mood
    var flood = { now: 0, goal: 0, hue: [1, 0.3, 0.2], x: 1 }, dim = { now: 0.5, goal: 0.5 }, calm = { now: 1, goal: 1 }, foot = { now: LOW, goal: LOW };
    var peakData = new Float32Array(MAX_PEAKS * 4), hueData = new Float32Array(MAX_PEAKS * 4);

    function measure() {
      m = metrics(box.clientWidth || window.innerWidth, box.clientHeight || window.innerHeight);
    }

    function moodOf(state) {
      if (state.cards.length === 0) return "idle";
      if (state.display !== "main") return "away";
      if (state.display === "main" && waitingOf(state).length > 0) return "call";
      return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "rest";
    }

    // From screen px to the shader's units: y up from the bottom of the canvas, one unit per canvas height.
    function unitOf() {
      return 1 / (m.h + 2 * MARGIN * m.vmin);
    }

    function toX(x) {
      return (x + MARGIN * m.vmin) * unitOf();
    }

    function setPeaks(list) {
      var keep = new Set(list.map(function (p) { return p.key; }));
      peaks.forEach(function (item) { if (!keep.has(item.key)) { item.goal = { height: 0, melt: 0, task: 0 }; } });
      var u = unitOf();
      list.forEach(function (peak) {
        var goal = { height: peak.height * u, melt: peak.melt, task: peak.task };
        var item = peaks.find(function (p) { return p.key === peak.key; });
        if (!item) {
          item = { key: peak.key, height: 0, melt: 0, task: 0, wait: 120 + peaks.length * 70 };
          if (mood === "" || reduce.matches) { item.height = goal.height; item.melt = goal.melt; item.task = goal.task; item.wait = 0; }
          peaks.push(item);
        }
        item.x = toX(peak.x);
        item.half = peak.half * u;
        item.goal = goal;
        item.hue = peak.hue ? rgbOf(peak.hue) : [0.8, 0.84, 0.88];
      });
      dirty = true;
    }

    function ease(now, goal, frameMs, tauMs) {
      return goal + (now - goal) * Math.exp(-Math.max(0, frameMs) / tauMs);
    }

    function step(frameMs) {
      var still = reduce.matches;
      peaks.forEach(function (item) {
        if (item.wait > 0 && !still) { item.wait -= frameMs; return; }
        item.height = still ? item.goal.height : ease(item.height, item.goal.height, frameMs, 260);
        item.melt = still ? item.goal.melt : ease(item.melt, item.goal.melt, frameMs, 600);
        item.task = still ? item.goal.task : ease(item.task, item.goal.task, frameMs, 700);
      });
      peaks = peaks.filter(function (item) { return item.goal.height > 0 || item.height > 1e-4; });
      flood.now = still ? flood.goal : ease(flood.now, flood.goal, frameMs, flood.goal > flood.now ? 420 : 260);
      dim.now = still ? dim.goal : ease(dim.now, dim.goal, frameMs, 900);
      calm.now = still ? calm.goal : ease(calm.now, calm.goal, frameMs, 500);
      foot.now = still ? foot.goal : ease(foot.now, foot.goal, frameMs, 380);
    }

    function render() {
      if (!gl || !surface) return;
      var count = Math.min(MAX_PEAKS, peaks.length);
      for (var i = 0; i < MAX_PEAKS; i++) {
        var item = i < count ? peaks[i] : undefined, at = i * 4;
        peakData[at] = item ? item.x : 0;
        peakData[at + 1] = item ? item.half : 0;
        peakData[at + 2] = item ? item.height : 0;
        peakData[at + 3] = item ? item.melt : 0;
        hueData[at] = item ? item.hue[0] : 0;
        hueData[at + 1] = item ? item.hue[1] : 0;
        hueData[at + 2] = item ? item.hue[2] : 0;
        hueData[at + 3] = item ? item.task : 0;
      }
      gl.viewport(0, 0, surface.width, surface.height);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uRes, surface.width, surface.height);
      gl.uniform1f(uniforms.uTime, seconds + 30);
      gl.uniform1f(uniforms.uHorizon, 1 - (foot.now * m.h + MARGIN * m.vmin) * unitOf());
      gl.uniform1i(uniforms.uCount, count);
      gl.uniform4fv(uniforms.uPeak, peakData);
      gl.uniform4fv(uniforms.uHue, hueData);
      gl.uniform1f(uniforms.uFlood, flood.now);
      gl.uniform3f(uniforms.uFloodHue, flood.hue[0], flood.hue[1], flood.hue[2]);
      gl.uniform1f(uniforms.uFloodX, flood.x);
      gl.uniform1f(uniforms.uDim, dim.now);
      gl.uniform1f(uniforms.uCalm, calm.now);
      var u = unitOf(), pad = MARGIN * m.vmin, ch = m.h + 2 * pad;
      var keepBottom = (calm.goal > 0.5 ? 0.58 : 0.38) * m.h;
      gl.uniform4f(uniforms.uKeep, 0, (ch - (keepBottom + pad)) * u, toX(0.6 * m.w), (ch - (0.1 * m.h + pad)) * u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(nowMs) {
      var frameMs = Math.min(100, nowMs - (lastMs === undefined ? nowMs - 1000 / fps : lastMs));
      lastMs = nowMs;
      // Under reduced motion the range is drawn only when something changed.
      if (reduce.matches && !dirty) return;
      dirty = false;
      if (!reduce.matches) seconds += frameMs / 1000;
      step(frameMs);
      render();
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
      drift.appendChild(surface);
      var context = surface.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
      if (!context) throw new Error("no webgl2");
      gl = context;
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
      ["uRes", "uTime", "uHorizon", "uCount", "uPeak", "uHue", "uFlood", "uFloodHue", "uFloodX", "uDim", "uCalm", "uKeep"].forEach(function (name) {
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
      drift.appendChild(plain);
    }

    function draw(state) {
      if (!box) return;
      measure();
      var next = moodOf(state);
      var list = peaksFor(next, state, m);
      if (next === "call") {
        flood.hue = rgbOf(list[0].hue);
        flood.x = toX(list[0].x);
        flood.goal = 1;
      } else {
        flood.goal = 0;
      }
      dim.goal = next === "rest" ? 0.3 : next === "idle" ? 0.45 : 0;
      calm.goal = next === "idle" || next === "away" ? 1 : 0;
      foot.goal = next === "idle" || next === "away" ? LOW : HORIZON;
      if (mood === "") { calm.now = calm.goal; foot.now = foot.goal; }
      setPeaks(list);
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
        box.className = "kag";
        drift = document.createElement("div");
        drift.className = "drift";
        var minutes = Number(ctx.options.drift);
        if (Number.isFinite(minutes) && minutes > 0) drift.style.setProperty("--kag-drift", Math.round(minutes * 60) + "s");
        var wantFps = Number(ctx.options.fps), wantScale = Number(ctx.options.scale);
        if (Number.isFinite(wantFps)) fps = Math.min(60, Math.max(10, wantFps));
        if (Number.isFinite(wantScale)) scale = Math.min(1, Math.max(0.25, wantScale));
        box.appendChild(drift);
        root.append(style, box);
        try {
          setUpGl();
        } catch (err) {
          console.error("[stavgayer.kida-ground] WebGL setup failed", err);
          fallBack();
        }
        measure();
        fit();
        window.addEventListener("resize", onResize);
        // Before the first state arrives: the calm range.
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
        box = drift = surface = style = lastState = gl = program = undefined;
        peaks = [];
        mood = "";
        lastMs = undefined;
        seconds = 0;
      },
    };
  });
})();
