// The Unknown Pleasures plot. In 1970 the radio astronomer Harold Craft stacked
// 80 successive pulses of the pulsar CP 1919, each a short trace with the
// signal peaking in the middle, every line drawn in front of the ones before it
// so the nearer peaks hide the lines behind. Peter Saville turned the plot white
// on black for the sleeve and printed it on textured card, with no words.
//
// Here the plot is the graph of your agents. It has 64 lines, back to front.
// Each agent owns one band of lines, and its card stands beside that band like
// a label on the axis of the graph:
//   work: the agent's lines peak, taller the longer the task has run, and the
//         pulses roll back through the band once every 1.337 s, the period of
//         the pulsar. Each band peaks in its own zone across the plot, with its
//         own shape (needles, twin shoulders or a comb), and its lines carry the
//         agent's colour; a few quiet lines part it from the band behind;
//   done: its lines go flat and settle, like a string coming to rest;
//   call: an agent waits: one of its lines rises into a single tall burst in
//         its colour that breaks out of the stack, and every other line dims;
//   idle: no tasks: the whole stack is quiet and breathes slowly, a wave that
//         passes through it every nine seconds.
// The calm lines above and below the bands keep the shape of the sleeve.
//
// Each line is filled with the black of the card under it before it is drawn,
// so it hides the lines behind it: the hidden lines are removed the way Craft's
// program removed them. The heights are worked out on the GPU in a vertex
// shader from a few numbers per line, so a frame costs one draw call and no
// geometry upload. It runs at 24 frames a second (option fps) through the runtime's
// frame clock and stops when the screen
// saver stops. The slow sway against burn-in is part of the same draw, not a CSS
// animation, so nothing else on the page has to be composited every frame. With reduced motion it is drawn once per change and stands still.
(function () {
  var ROWS = 64;
  var SAMPLES = 300;
  var MAX_BANDS = 5;
  var GAP = 3; // quiet lines at the back of each band, between it and the band behind
  // Each agent's pulse has its own shape, so a band reads as that agent from across a room.
  var SIGNATURE = { claude: 0, codex: 1, cursor: 2 }; // 0 needles, 1 twin shoulders, 2 a comb of teeth

  function signatureOf(source) {
    if (Object.prototype.hasOwnProperty.call(SIGNATURE, source)) return SIGNATURE[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return Math.abs(hash) % 3;
  }
  var PERIOD_S = 1.337; // CP 1919
  var MARGIN = 3; // vmin of slack around the plot for the drift
  var DRIFT_S = 240; // one slow sway of the plot against burn-in; the words stand still

  // Where the plot stands in its sway, in css px. It is a few pixels at most, so
  // each card of the board, which does not sway, still stands beside its band.
  function driftAt(nowMs, vmin) {
    if (reduce.matches) return { x: 0, y: 0 };
    var t = (nowMs / 1000 / DRIFT_S) * Math.PI;
    return { x: 1.2 * vmin * Math.sin(t), y: 0.5 * vmin * Math.sin(0.73 * t + 1) };
  }
  var BG = [0.043, 0.043, 0.039];
  var INK = [0.925, 0.92, 0.9];
  var OWN = { claude: "#ff5b3d", codex: "#57c7ff", cursor: "#ffb52e" };
  var SPARE = ["#ff6fae", "#5fe0b4", "#b9a4ff", "#ffd36a", "#7fa8ff", "#ff8a4c"];
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

  // ---- where the plot and the bands stand (the board, the clock and the rings use the same numbers) ----

  function plotLayout(w, h, count) {
    var p = { w: w, h: h, vmin: Math.min(w, h) / 100, left: 0.05 * w, right: 0.655 * w, top: 0.2 * h, bottom: 0.93 * h,
      colLeft: 0.705 * w, colRight: 0.955 * w };
    p.step = (p.bottom - p.top) / (ROWS - 1);
    var shown = Math.min(count, MAX_BANDS), first = 14, room = 60 - first;
    p.band = shown ? Math.min(15, Math.floor(room / shown)) : 0;
    p.start = first + Math.floor((room - p.band * shown) / 2);
    p.bands = [];
    for (var i = 0; i < shown; i++) {
      var from = p.start + i * p.band;
      // Each band peaks in its own zone across the plot, so no two agents share a column.
      var cx = shown === 1 ? 0.5 : 0.3 + (0.4 * i) / (shown - 1);
      p.bands.push({ from: from, to: from + p.band, y: p.top + from * p.step, cx: cx,
        lead: p.top + (from + GAP + (p.band - GAP) / 2) * p.step });
    }
    return p;
  }

  function waitingOf(cards) {
    return cards.filter(function (card) { return card.kind === "approval"; }).sort(function (a, b) {
      return (a.approval_since_ms || Infinity) - (b.approval_since_ms || Infinity);
    });
  }

  // ---- the shader ------------------------------------------------------------

  var VERTEX = [
    "#version 300 es",
    "precision highp float;",
    "in vec3 aV; // row, position along the line 0..1, kind: 0 fill top, 1 fill foot, 2 and 3 the two edges of the line",
    "uniform vec2 uView, uOrigin, uShift;  // size and top left corner of the canvas, in css px of the screen",
    "uniform float uScale, uTime, uBreath, uLine;",
    "uniform vec4 uPlot;  // left, width, top baseline, step (css px)",
    "uniform vec4 uRow[" + ROWS + "];  // amplitude in steps, phase, alpha, breathing",
    "uniform vec4 uRowB[" + ROWS + "]; // hue index, band colour, line width, whole line colour",
    "uniform vec4 uRowC[" + ROWS + "]; // centre of the pulse along the line, its signature",
    "uniform vec4 uBurst; // row, height in px, centre, amount",
    "out float vKind, vD, vHalf, vAlpha, vTail;",
    "flat out int vHue;",
    "float h1(float n) { return fract(sin(n * 127.1 + 0.37) * 43758.5453); }",
    "float vn(float x) { float i = floor(x), f = fract(x); float s = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), s) * 2.0 - 1.0; }",
    // one pulse: a few peaks of different widths around the middle of the trace
    "float pulse(float u, float s, float c0, float sig) {",
    "  float y = 0.0;",
    "  for (int k = 0; k < 7; k++) {",
    "    float fk = float(k);",
    "    float r1 = h1(s * 3.71 + fk * 1.93), r2 = h1(s * 5.37 + fk * 2.31), r3 = h1(s * 13.13 + fk * 7.77);",
    "    float c, w, a;",
    "    if (sig < 0.5) { c = c0 + (r1 - 0.5) * 0.11; w = 0.004 + 0.009 * r2; a = 0.3 + 0.7 * r3 * r3; }", // needles
    "    else if (sig < 1.5) { if (k >= 2) break; c = c0 + (fk - 0.5) * 0.07 + (r1 - 0.5) * 0.015; w = 0.02 + 0.01 * r2; a = 0.7 + 0.3 * r3; }", // twin shoulders
    "    else if (sig < 2.5) { c = c0 + (fk - 3.0) * 0.027 + (r1 - 0.5) * 0.005; w = 0.0055 + 0.003 * r2; a = 0.4 + 0.5 * r3; }", // a comb
    "    else { if (k >= 6) break; c = c0 + (r1 - 0.5) * 0.25; w = 0.007 + 0.026 * r2; a = 0.15 + 0.85 * r3 * r3; }", // the sleeve's own pulse
    "    float d = (u - c) / w; y += a * exp(-d * d);",
    "  }",
    "  return y;",
    "}",
    // a pulse between two seeds, so a rolling band morphs from one pulse to the next
    "float shape(float u, float s, float c0, float sig) { float i = floor(s), f = fract(s); f = f * f * (3.0 - 2.0 * f); return mix(pulse(u, i, c0, sig), pulse(u, i + 1.0, c0, sig), f); }",
    "float spike(float u, float m) {",
    "  float a = abs(u - m) / 0.02, b = abs(u - m + 0.018) / 0.005, c = abs(u - m - 0.02) / 0.007;",
    "  return exp(-a) * (0.93 + 0.07 * vn(u * 260.0)) + 0.32 * exp(-b) + 0.24 * exp(-c);",
    "}",
    "float heightAt(int r, float row, float u) {",
    "  vec4 R = uRow[r];",
    "  float seed = row * 1.618 + R.y;",
    "  vec4 C = uRowC[r];",
    "  float env = exp(-pow((u - C.x) / (C.y > 2.5 ? 0.2 : 0.12), 2.0));",
    "  float breath = 1.0 + uBreath * R.w * sin(uTime * 0.698 - row * 0.33);",
    "  float steps = R.x * breath * (0.6 * shape(u, seed, C.x, C.y) + 0.1 * env * vn(u * 48.0 + seed * 3.1));",
    // the noise floor every trace has, a little stronger near the pulse
    "  steps += (0.045 + 0.2 * env) * vn(u * 150.0 + seed * 7.1) + 0.025 * vn(u * 340.0 + seed * 2.3);",
    "  float px = steps * uPlot.w;",
    "  if (abs(row - uBurst.x) < 0.5) px += uBurst.y * uBurst.w * spike(u, uBurst.z);",
    "  return px;",
    "}",
    "void main() {",
    "  float row = aV.x, u = aV.y, kind = aV.z;",
    "  int r = int(row + 0.5);",
    "  float base = uPlot.z + row * uPlot.w, x = uPlot.x + u * uPlot.y;",
    "  vec2 P; vD = 0.0; vHalf = 0.0;",
    "  if (kind < 0.5) P = vec2(x, base - heightAt(r, row, u));",
    "  else if (kind < 1.5) P = vec2(x, base + 0.5 * uPlot.w);",
    "  else {",
    "    float du = 0.6 / " + SAMPLES + ".0;",
    "    float hp = heightAt(r, row, u + du), hm = heightAt(r, row, u - du), h0 = heightAt(r, row, u);",
    "    vec2 T = normalize(vec2(uPlot.y * 2.0 * du, -(hp - hm)));",
    "    vec2 N = vec2(-T.y, T.x);",
    "    float side = kind < 2.5 ? 1.0 : -1.0;",
    "    float hw = 0.5 * uLine * uRowB[r].z, ext = hw + 1.0 / uScale;",
    "    P = vec2(x, base - h0) + N * side * ext;",
    "    vD = side * ext * uScale; vHalf = hw * uScale;",
    "  }",
    "  vKind = kind < 1.5 ? 0.0 : 1.0;",
    "  vAlpha = uRow[r].z;",
    "  vHue = int(uRowB[r].x + 0.5);",
    // the band carries its agent's colour: strongest over its own peaks, lighter along the flat ends
    "  vTail = max(uRowB[r].y * (0.3 + 0.42 * exp(-pow((u - uRowC[r].x) / 0.16, 2.0))), uRowB[r].w);",
    "  vec2 c = (P + uShift - uOrigin) / uView;",
    "  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);",
    "}",
  ].join("\n");

  var FRAGMENT = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec3 uBg, uInk;",
    "uniform vec3 uHue[8];",
    "in float vKind, vD, vHalf, vAlpha, vTail;",
    "flat in int vHue;",
    "out vec4 outColor;",
    "float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "void main() {",
    "  if (vKind < 0.5) { outColor = vec4(uBg, 1.0); return; }",
    "  float a = clamp(vHalf + 0.5 - abs(vD), 0.0, 1.0) * vAlpha;",
    // white ink on textured card: the paper shows through the line a little
    "  float grain = 0.9 + 0.1 * h2(floor(gl_FragCoord.xy));",
    "  vec3 col = mix(uInk, uHue[vHue], vTail) * grain;",
    "  outColor = vec4(col, a);",
    "}",
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader failed");
    return shader;
  }

  // The geometry never changes: for every line, a fill strip and a line strip.
  function buildGeometry() {
    var verts = new Float32Array(ROWS * SAMPLES * 4 * 3);
    var idx = new Uint32Array(ROWS * (SAMPLES - 1) * 12);
    var v = 0, k = 0;
    for (var r = 0; r < ROWS; r++) {
      for (var j = 0; j < SAMPLES; j++) {
        var u = j / (SAMPLES - 1);
        for (var kind = 0; kind < 4; kind++) { verts[v++] = r; verts[v++] = u; verts[v++] = kind; }
      }
      var b = r * SAMPLES * 4;
      for (j = 0; j < SAMPLES - 1; j++) { // the black under the line first
        var a0 = b + j * 4, a1 = a0 + 4;
        idx[k++] = a0; idx[k++] = a0 + 1; idx[k++] = a1; idx[k++] = a0 + 1; idx[k++] = a1 + 1; idx[k++] = a1;
      }
      for (j = 0; j < SAMPLES - 1; j++) { // then the line over it
        var c0 = b + j * 4 + 2, c1 = c0 + 4;
        idx[k++] = c0; idx[k++] = c0 + 1; idx[k++] = c1; idx[k++] = c0 + 1; idx[k++] = c1 + 1; idx[k++] = c1;
      }
    }
    return { verts: verts, idx: idx };
  }

  // A tile of paper grain, made once and laid over the whole screen.
  function paperTile() {
    var size = 160, c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    if (!g) return "";
    var img = g.createImageData(size, size), d = img.data;
    for (var i = 0; i < size * size; i++) {
      var n = Math.random();
      var light = n > 0.5;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = light ? 255 : 0;
      d[i * 4 + 3] = Math.round(Math.abs(n - 0.5) * 2 * (light ? 18 : 40));
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  var STYLE = [
    ".upg { position: absolute; inset: 0; overflow: hidden; background: #0b0b0a; }",
    ".upg .drift { position: absolute; inset: 0; }",
    ".upg canvas { position: absolute; display: block; }",
    ".upg .paper { position: absolute; inset: 0; background-size: 160px 160px; pointer-events: none; }",
  ].join("\n");

  window.agentScreensaver.register(function () {
    var box, drift, surface, style, lastState, lay, mood = "";
    var gl, program, uniforms = {}, cancelFrame, lastMs, seconds = 0;
    var fps = 24, scale = 0.5, ratio = 1, dirty = true, area = { x: 0, y: 0, w: 1, h: 1 };
    var rows = [];
    var hues = [INK.slice()]; // index 0 is the ink
    var burst = { row: -1, h: 0, v: 0, goal: 0, px: 0, cx: 0.5 };
    var breath = { now: 1, goal: 1 };
    var rowData = new Float32Array(ROWS * 4), rowDataB = new Float32Array(ROWS * 4), rowDataC = new Float32Array(ROWS * 4), hueData = new Float32Array(8 * 3);
    var bandPhase = new Map(); // card key -> its rolling phase

    for (var r = 0; r < ROWS; r++) {
      rows.push({ amp: 4, vel: 0, goal: 4, alpha: 1, alphaGoal: 1, rate: 0, rateGoal: 0, phase: 0, key: "",
        hue: 0, tail: 0, tailGoal: 0, width: 1, widthGoal: 1, whole: 0, wholeGoal: 0, breath: 1, cx: 0.5, sig: 3 });
    }

    function size() {
      return { w: box.clientWidth || window.innerWidth, h: box.clientHeight || window.innerHeight };
    }

    function moodOf(state) {
      if (state.cards.length === 0) return "idle";
      if (state.display === "main" && waitingOf(state.cards).length > 0) return "call";
      if (state.display !== "main") return "away";
      return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "rest";
    }

    function hueIndex(hex) {
      var rgb = rgbOf(hex);
      for (var i = 1; i < hues.length; i++) {
        if (hues[i][0] === rgb[0] && hues[i][1] === rgb[1] && hues[i][2] === rgb[2]) return i;
      }
      if (hues.length >= 8) hues.length = 1;
      hues.push(rgb);
      return hues.length - 1;
    }

    // A task's peaks grow with the time it has run: from a rise to a full pulse in 40 minutes.
    function busyAmp(card, nowMs) {
      var ran = Math.max(0, nowMs - card.started_at_ms);
      return 4.4 + 7.6 * Math.sqrt(Math.min(1, ran / (40 * 60000)));
    }

    function draw(state) {
      if (!box) return;
      var s = size();
      var next = moodOf(state);
      var cards = state.cards;
      lay = plotLayout(s.w, s.h, cards.length);
      // While agents work the stack around their bands goes quieter, so the bands stand out.
      var calm = next === "idle" ? 4.6 : next === "rest" ? 1.7 : 1.7;
      var first = next === "call" ? waitingOf(cards)[0] : undefined;
      var burstRow = -1;
      rows.forEach(function (row) {
        row.goal = calm; row.alphaGoal = next === "idle" ? 0.82 : next === "rest" ? 0.86 : 1; row.rateGoal = 0;
        row.tailGoal = 0; row.widthGoal = 1; row.wholeGoal = 0; row.breath = 1; row.key = ""; row.cx = 0.5; row.sig = 3;
      });
      lay.bands.forEach(function (band, i) {
        var card = cards[i];
        var key = card.source + "\u0000" + card.session;
        var done = card.kind === "finished";
        var hue = hueIndex(hueOf(card.source));
        if (!bandPhase.has(key)) bandPhase.set(key, 1000 + 97 * bandPhase.size);
        var amp = done ? 0.35 : busyAmp(card, state.nowMs);
        var sig = signatureOf(card.source);
        for (var k = band.from; k < band.to; k++) {
          var row = rows[k];
          if (k < band.from + GAP) { row.goal = 0.5; continue; } // the quiet lines that part it from the band behind
          // The band is strongest in its middle lines, so each band reads as one group.
          var t = (k - band.from - GAP + 0.5) / (band.to - band.from - GAP);
          row.goal = done ? amp : amp * (0.45 + 0.55 * Math.pow(Math.sin(Math.PI * t), 0.7));
          row.rateGoal = done ? 0 : 1;
          row.key = key;
          row.hue = hue;
          row.cx = band.cx;
          row.sig = sig;
          row.tailGoal = done ? 0 : 1;
          row.breath = done ? 0.3 : 0;
        }
        if (first && card === first) { burstRow = band.from + GAP + Math.floor((band.to - band.from - GAP) * 0.55); burst.cx = band.cx; }
      });
      if (next === "call") {
        rows.forEach(function (row, k) {
          row.alphaGoal = k === burstRow ? 1 : 0.26;
          row.rateGoal *= 0.25;
          row.tailGoal = 0;
        });
        if (burstRow >= 0) {
          var hit = rows[burstRow];
          hit.widthGoal = 1.9;
          hit.wholeGoal = 1;
          hit.tailGoal = 1;
          if (burst.row !== burstRow) { burst.h = 0; burst.v = 0; }
          burst.row = burstRow;
          // From its line up to just under the top of the screen.
          burst.px = lay.top + burstRow * lay.step - 0.12 * s.h;
          burst.goal = 1;
        }
      } else {
        burst.goal = 0;
      }
      breath.goal = reduce.matches ? 0 : next === "idle" ? 0.14 : 0.08;
      if (mood === "" || reduce.matches) settle();
      mood = next;
      dirty = true;
    }

    function settle() {
      rows.forEach(function (row) {
        row.amp = row.goal; row.vel = 0; row.alpha = row.alphaGoal; row.rate = row.rateGoal;
        row.tail = row.tailGoal; row.width = row.widthGoal; row.whole = row.wholeGoal;
      });
      burst.h = burst.goal; burst.v = 0;
      breath.now = breath.goal;
    }

    function ease(now, goal, ms, tau) {
      return goal + (now - goal) * Math.exp(-Math.max(0, ms) / tau);
    }

    // Returns true while something still moves.
    function step(ms) {
      var dt = Math.min(0.1, ms / 1000), moving = false;
      rows.forEach(function (row) {
        // A spring, a little under critical damping: a line that goes flat overshoots a hair and settles.
        var acc = 38 * (row.goal - row.amp) - 8.2 * row.vel;
        row.vel += acc * dt;
        row.amp += row.vel * dt;
        if (row.amp < -0.3) { row.amp = -0.3; row.vel = 0; }
        row.alpha = ease(row.alpha, row.alphaGoal, ms, row.alphaGoal < row.alpha ? 320 : 500);
        row.rate = ease(row.rate, row.rateGoal, ms, 700);
        row.tail = ease(row.tail, row.tailGoal, ms, 400);
        row.width = ease(row.width, row.widthGoal, ms, 300);
        row.whole = ease(row.whole, row.wholeGoal, ms, 260);
        if (Math.abs(row.amp - row.goal) > 0.005 || Math.abs(row.vel) > 0.01 || Math.abs(row.alpha - row.alphaGoal) > 0.003 || row.rate > 0.002) moving = true;
      });
      bandPhase.forEach(function (phase, key) {
        var row = rows.find(function (r) { return r.key === key; });
        if (row && row.rate > 0.0005) bandPhase.set(key, phase + (dt / PERIOD_S) * row.rate);
      });
      var acc = 95 * (burst.goal - burst.h) - 10.5 * burst.v;
      burst.v += acc * dt;
      burst.h += burst.v * dt;
      if (burst.goal === 0 && burst.h < 0.002 && Math.abs(burst.v) < 0.01) { burst.h = 0; burst.v = 0; }
      if (Math.abs(burst.h - burst.goal) > 0.002 || Math.abs(burst.v) > 0.01) moving = true;
      breath.now = ease(breath.now, breath.goal, ms, 1500);
      return moving;
    }

    function render() {
      if (!gl || !surface || !lay) return;
      for (var r = 0; r < ROWS; r++) {
        var row = rows[r], at = r * 4;
        rowData[at] = row.amp;
        rowData[at + 1] = row.key ? bandPhase.get(row.key) || 0 : 0;
        rowData[at + 2] = row.alpha;
        rowData[at + 3] = row.breath;
        rowDataB[at] = row.key || row.whole > 0.001 ? row.hue : 0;
        rowDataB[at + 1] = row.tail;
        rowDataB[at + 2] = row.width;
        rowDataB[at + 3] = row.whole;
        rowDataC[at] = row.cx;
        rowDataC[at + 1] = row.sig;
      }
      for (var i = 0; i < 8; i++) {
        var c = hues[i] || INK;
        hueData[i * 3] = c[0]; hueData[i * 3 + 1] = c[1]; hueData[i * 3 + 2] = c[2];
      }
      gl.viewport(0, 0, surface.width, surface.height);
      gl.clearColor(BG[0], BG[1], BG[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uView, area.w, area.h);
      gl.uniform2f(uniforms.uOrigin, area.x, area.y);
      var shift = driftAt(Date.now(), lay.vmin);
      gl.uniform2f(uniforms.uShift, shift.x, shift.y);
      gl.uniform1f(uniforms.uScale, ratio);
      gl.uniform1f(uniforms.uTime, seconds);
      gl.uniform1f(uniforms.uBreath, breath.now);
      gl.uniform1f(uniforms.uLine, Math.max(1.1, 0.17 * lay.vmin));
      gl.uniform4f(uniforms.uPlot, lay.left, lay.right - lay.left, lay.top, lay.step);
      gl.uniform4fv(uniforms.uRow, rowData);
      gl.uniform4fv(uniforms.uRowB, rowDataB);
      gl.uniform4fv(uniforms.uRowC, rowDataC);
      gl.uniform4f(uniforms.uBurst, burst.row, burst.px, burst.cx, Math.max(0, burst.h));
      gl.uniform3f(uniforms.uBg, BG[0], BG[1], BG[2]);
      gl.uniform3f(uniforms.uInk, INK[0], INK[1], INK[2]);
      gl.uniform3fv(uniforms.uHue, hueData);
      gl.drawElements(gl.TRIANGLES, ROWS * (SAMPLES - 1) * 12, gl.UNSIGNED_INT, 0);
    }

    function frame(nowMs) {
      var ms = Math.min(100, nowMs - (lastMs === undefined ? nowMs - 1000 / fps : lastMs));
      lastMs = nowMs;
      if (reduce.matches) {
        // One still frame per change.
        if (!dirty) return;
        dirty = false;
        settle();
        render();
        return;
      }
      // Every frame at the full rate, the calm breathing too: at half the rate the
      // slow wave moved in visible steps on a 1x screen.
      dirty = false;
      seconds += ms / 1000;
      step(ms);
      render();
    }

    // The canvas covers only the plot and the black above it, where a burst can rise:
    // the right half of the screen is plain card and costs nothing to draw.
    function fit() {
      if (!surface) return;
      var s = size(), p = plotLayout(s.w, s.h, 0), pad = MARGIN * p.vmin;
      area = { x: Math.round(p.left - 2 * pad), y: Math.round(-pad), w: 0, h: 0 };
      area.w = Math.round(p.right + 2 * pad) - area.x;
      area.h = Math.round(p.bottom + 2 * pad) - area.y;
      surface.style.left = area.x + "px";
      surface.style.top = area.y + "px";
      surface.style.width = area.w + "px";
      surface.style.height = area.h + "px";
      // At least one canvas pixel per css pixel, so the lines stay sharp.
      ratio = Math.max(1, (window.devicePixelRatio || 1) * scale);
      surface.width = Math.round(area.w * ratio);
      surface.height = Math.round(area.h * ratio);
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
      ["uView", "uOrigin", "uShift", "uScale", "uTime", "uBreath", "uLine", "uPlot", "uRow", "uRowB", "uRowC", "uBurst", "uBg", "uInk", "uHue"].forEach(function (name) {
        uniforms[name] = gl.getUniformLocation(program, name);
      });
      var geo = buildGeometry();
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, geo.verts, gl.STATIC_DRAW);
      var where = gl.getAttribLocation(program, "aV");
      gl.enableVertexAttribArray(where);
      gl.vertexAttribPointer(where, 3, gl.FLOAT, false, 0, 0);
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
        box.className = "upg";
        drift = document.createElement("div");
        drift.className = "drift";
        var wantFps = Number(ctx.options.fps), wantScale = Number(ctx.options.scale);
        if (Number.isFinite(wantFps)) fps = Math.min(60, Math.max(10, wantFps));
        if (Number.isFinite(wantScale)) scale = Math.min(1, Math.max(0.25, wantScale));
        var paper = document.createElement("div");
        paper.className = "paper";
        var tile = paperTile();
        if (tile) paper.style.backgroundImage = "url(" + tile + ")";
        box.append(drift, paper);
        root.append(style, box);
        try {
          setUpGl();
        } catch (err) {
          console.error("[stavgayer.pleasures-ground] WebGL setup failed", err);
          if (surface) surface.remove();
          surface = gl = undefined;
        }
        fit();
        window.addEventListener("resize", onResize);
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
        box = drift = surface = style = lastState = gl = program = lay = undefined;
        mood = "";
        lastMs = undefined;
        seconds = 0;
        bandPhase.clear();
      },
    };
  });
})();
