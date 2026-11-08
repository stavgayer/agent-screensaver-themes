// The Favourite sky: a glossy pink heart-shaped face with shut eyes, low and
// centred in a blue sky, after the cover of the single. Everything is drawn in
// code by one WebGL 1 fragment shader on a canvas at half the screen's pixels.
//   rest, work, done: the resting sky, the eyes shut;
//   call: an agent waits: the eyes open and the sky goes to its deepest blue;
//   second display: the sky and the heart, eyes shut.
// Each task is a silver dagger stuck in the heart's top edge, its handle in the
// agent's colour. It stabs in, sinks slowly over the first hour, glints once
// when the task is finished, turns lime while its agent waits (the others dim),
// and slides out and falls when the task leaves.
//
// The heart breathes (about 1.5% every 8 s), a sheen slides across its gloss
// every 30 s, and the whole picture drifts a few pixels over minutes against
// burn-in. JavaScript works out every moving value; the shader only paints them.
// With "Reduce motion" it stands still, draws only when the state changes, and
// the eyes cross-fade. The page elements on top use the same frame (below).
(function () {
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // geometry: keep identical in ground and board
  // Where everything sits, from the screen size alone, so the shader and the page
  // elements agree. From the top: the clock and the date, room for the daggers,
  // the heart, its spikes, the limit labels and, on narrow screens, one row of
  // task cards. The heart takes the height that is left, and any spare height
  // opens above it, so it sits low like on the cover. The side columns beside the
  // heart end above the spikes, so the labels and the card row get the full width.
  // Sizes in vmin unless noted.
  var FRAME = {
    margin: 4, // above the clock
    clock: 14, // the time and the date
    gap: 2, // between blocks
    rise: 0.24, // of the heart's size: the daggers stand above its top edge (always kept, so the heart never jumps)
    spikes: 0.12, // of the heart's size: the spikes hang under it (only with limits)
    labelRow: 6.5, // one row of limit labels
    labelWidth: 150, // CSS px per limit label
    cards: 15, // the row of cards on narrow screens
    bottom: 3, // under everything
    maxHeart: 0.62, // of the smaller side
    narrow: 1.45, // width / height under which the cards go in a row
    gutter: 0.03, // of the width, at both screen edges and beside the heart
  };

  function favouriteFrame(width, height, limitCount, cardCount) {
    var vmin = Math.min(width, height) / 100, gutter = FRAME.gutter * width;
    var cardsRow = width / height < FRAME.narrow && cardCount > 0;
    var labelRows = limitCount * FRAME.labelWidth > width - 2 * gutter ? 2 : 1;
    var spikes = limitCount > 0 ? FRAME.spikes : 0;
    // Under the heart, in vmin: the labels with their gap, then the card row with its gap.
    var labels = limitCount > 0 ? FRAME.gap + labelRows * FRAME.labelRow : 0;
    var cards = cardsRow ? FRAME.gap + FRAME.cards : 0;
    var fixed = (FRAME.margin + FRAME.clock + FRAME.gap + labels + cards + FRAME.bottom) * vmin;
    var size = Math.max(0, Math.min(FRAME.maxHeart * 100 * vmin, (height - fixed) / (1 + FRAME.rise + spikes)));
    // Placed from the bottom up.
    var labelsTop = height - (FRAME.bottom + cards + (limitCount > 0 ? labelRows * FRAME.labelRow : 0)) * vmin;
    var spikesTop = labelsTop - (limitCount > 0 ? FRAME.gap * vmin : 0) - spikes * size;
    var heart = { cx: width / 2, cy: spikesTop - size / 2, size: size };
    var side = Math.max(0, heart.cx - size / 2 - 2 * gutter), top = FRAME.margin * vmin;
    return {
      heart: heart,
      clockTop: top,
      clockHeight: FRAME.clock * vmin,
      spikesTop: spikesTop,
      labelsTop: labelsTop,
      labelRows: labelRows,
      cardsRow: cardsRow,
      sideColumns: cardsRow ? null : {
        left: { x: gutter, w: side, top: top, bottom: spikesTop },
        right: { x: width - gutter - side, w: side, top: top, bottom: spikesTop },
      },
    };
  }

  // The same frame for the same state in every part: the second display shows no
  // limits and no cards.
  function frameOf(state, width, height) {
    var main = state.display === "main";
    return favouriteFrame(width, height, main && state.limits ? state.limits.length : 0, main ? state.cards.length : 0);
  }

  // Each agent owns one colour of the cover; an agent we do not know gets one by its name.
  var OWN_COLOURS = { claude: "#d34d68", codex: "#87c2c4", cursor: "#eba6b3" };
  var SPARE_COLOURS = ["#d34d68", "#87c2c4", "#eba6b3", "#c9d3dc"];

  function agentColour(source) {
    if (Object.prototype.hasOwnProperty.call(OWN_COLOURS, source)) return OWN_COLOURS[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE_COLOURS[Math.abs(hash) % SPARE_COLOURS.length];
  }

  // The five states of the design, from the view state.
  function moodOf(state) {
    if (state.display !== "main" || state.cards.length === 0) return "rest";
    if (state.cards.some(function (card) { return card.kind === "approval"; })) return "call";
    return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "done";
  }
  // end geometry

  // The sky from top to bottom, as measured on the cover; an approval deepens its top.
  var SKY = ["#034d87", "#096faa", "#52a4c7", "#87c2c4"];
  var DEEP_SKY = "#021f3a";
  // The face, deep at the rim and pale in the middle, as measured on the cover.
  var FACE = ["#d34d68", "#eba6b3"];
  // The middle of the lips, in heart space (below). Task 4's drip hangs from here.
  var LIP = [0, -0.165];
  // The heart's distance field (after Inigo Quilez), in its own units: the shader
  // draws it and the daggers find its top edge with it.
  var HEART = {
    round: 0.07, // a plump face, not a sharp card heart
    soft: 0.0012, // a soft middle, so the shading has no fold there
    mid: 0.552, // the heart's vertical middle
    lobe: [0.25, 0.75], // the centre of the right lobe's circle
    lobeRadius: 0.35355339, // its radius, before the rounding
  };
  HEART.units = 1.207 + 2 * HEART.round; // heart units per box side: its width fills the box
  var BREATH_S = 8, BREATH = 0.015; // one breath every 8 s, ±1.5% of the size
  var SHEEN_S = 30, SHEEN_SLIDE_S = 5; // a sheen crosses the gloss in 5 s, every 30 s
  var DRIFT_VMIN = 0.6; // how far the picture drifts, about 5 px on a laptop
  var EYES_MS = 250, SKY_MS = 1200, FADE_MS = 400;

  // The daggers: one per task, in card order, at most 7, stuck in the heart's top
  // edge. Sizes in heart space (below). Three more slots let daggers fall out
  // while new ones stab in.
  var DAGGERS = 7, DAGGER_SLOTS = DAGGERS + 3;
  var DAGGER = {
    spread: 0.3, // the cover's left and right spots; the centre is 0
    lean: 0.5, // radians per unit from the centre: the outer daggers lean out a little
    blade: 0.15, // the blade's length; over the first hour it sinks until a third of it is in
    stuck: 0.03, // how deep a new dagger sits
    lift: 0.06, // how high a new dagger stabs from
    middle: 0.13, // from the tip to the balance point it tumbles around
  };
  var LIME = "#9bf95e", NAVY = "#022a4a";
  var SINK_MS = 60 * 60000, STAB_MS = 400, GLINT_MS = 600, FALL_MS = 800;
  var PULL = 0.35; // the share of the fall spent sliding out of the heart
  var GRAVITY = 12; // heart sides per second squared

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // How far a task's dagger has sunk, 0 to 1: fast at first, full after an hour.
  function depthOf(runMs) {
    var t = 1 - Math.min(1, Math.max(0, runMs) / SINK_MS);
    return 1 - t * t;
  }

  // Where dagger `index` of `count` stands: one in the centre, two at the cover's
  // spots, three at both and the centre, more spread evenly between the spots.
  function slotX(index, count) {
    return count < 2 ? 0 : DAGGER.spread * ((2 * index) / (count - 1) - 1);
  }

  // The height of the heart's top edge above x, in heart space: on top the
  // distance field is the rounded circle of a lobe.
  function edgeAt(x) {
    var q = Math.sqrt(Math.pow(x * HEART.units, 2) + HEART.soft) - HEART.lobe[0], r = HEART.lobeRadius + HEART.round;
    return (HEART.lobe[1] + Math.sqrt(Math.max(0, r * r - q * q)) - HEART.mid) / HEART.units;
  }

  // A value that eases to a new goal over a given time, read at any moment.
  function tween(value) {
    var from = value, to = value, at = 0, ms = 1;
    return {
      at: function (nowMs) {
        var t = Math.min(1, Math.max(0, (nowMs - at) / ms));
        return from + (to - from) * easeOut(t);
      },
      set: function (goal, nowMs, duration) {
        if (goal === to) return;
        from = this.at(nowMs);
        to = goal;
        at = nowMs;
        ms = duration;
      },
      moving: function (nowMs) { return nowMs - at < ms; },
    };
  }

  // ---- the shader ---------------------------------------------------------------
  //
  // Heart space: the heart's square box has side 1, its centre at 0, y up. Every
  // layer drawn on the heart (eyes, daggers; spikes and the drip later) works
  // in heart space, so it breathes and drifts with the face for free.

  var VERTEX = "attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }";

  var FRAGMENT = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 uRes;      // canvas pixels",
    "uniform vec3 uHeart;    // centre (canvas px, y up), canvas px per heart-box side",
    "uniform vec3 uSkyTop;   // the top colour of the sky",
    "uniform float uEyes;    // 0 shut, 1 open",
    "uniform float uFadeOnly; // 1: the eyes cross-fade instead of opening (Reduce motion)",
    "uniform float uSheen;   // 0 to 1 while the sheen crosses, below 0 when it rests",
    "uniform vec4 uDagPose[" + DAGGER_SLOTS + "];   // the tip, and the way the blade points up",
    "uniform vec4 uDagLook[" + DAGGER_SLOTS + "];   // opacity (0: no dagger), glint (below 0: none), lime, dim",
    "uniform vec4 uDagHandle[" + DAGGER_SLOTS + "]; // the handle's agent colour, and 1 while it is stuck in the heart",
    "uniform float uLine;    // the navy outline, in heart units",
    "const vec3 SKY1 = vec3(" + rgbOf(SKY[1]).join(", ") + ");",
    "const vec3 SKY2 = vec3(" + rgbOf(SKY[2]).join(", ") + ");",
    "const vec3 SKY3 = vec3(" + rgbOf(SKY[3]).join(", ") + ");",
    "const vec3 DEEP = vec3(" + rgbOf(FACE[0]).join(", ") + ");",
    "const vec3 LIGHT = vec3(" + rgbOf(FACE[1]).join(", ") + ");",
    "const vec2 LIP = vec2(" + LIP.map(function (v) { return v.toFixed(4); }).join(", ") + ");",
    "const vec3 LID = vec3(0.36, 0.07, 0.16);",
    "const vec3 NAVY = vec3(" + rgbOf(NAVY).join(", ") + ");",
    "const vec3 LIME = vec3(" + rgbOf(LIME).join(", ") + ");",
    "const float HR = " + HEART.round.toFixed(4) + ";",
    "const float HK = " + HEART.units.toFixed(4) + ";",
    "const float HMID = " + HEART.mid.toFixed(4) + ";",
    "const vec2 LOBE = vec2(" + HEART.lobe.map(function (v) { return v.toFixed(4); }).join(", ") + ");",
    "const float LOBE_R = " + HEART.lobeRadius.toFixed(8) + ";",
    "float dot2(vec2 v) { return dot(v, v); }",
    "float heartUnits(vec2 q) {",
    "  q.x = sqrt(q.x * q.x + " + HEART.soft.toFixed(4) + ");",
    "  if (q.y + q.x > 1.0) return sqrt(dot2(q - LOBE)) - LOBE_R;",
    "  return sqrt(min(dot2(q - vec2(0.0, 1.0)), dot2(q - 0.5 * max(q.x + q.y, 0.0)))) * sign(q.x - q.y);",
    "}",
    "float heart(vec2 p) { return (heartUnits(p * HK + vec2(0.0, HMID)) - HR) / HK; }",
    "float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "vec3 sky(float y) {",
    "  vec3 c = mix(uSkyTop, SKY1, smoothstep(0.0, 0.36, y));",
    "  c = mix(c, SKY2, smoothstep(0.3, 0.72, y));",
    "  return mix(c, SKY3, smoothstep(0.66, 1.0, y));",
    "}",
    // The airbrushed skin: a soft pillow lit from the upper left, deep pink at the
    // rim, pale in the middle, one glossy highlight and the sliding sheen.
    "vec3 skin(vec2 p, float d) {",
    "  float e = 0.004;",
    "  vec2 g = vec2(heart(p + vec2(e, 0.0)) - heart(p - vec2(e, 0.0)), heart(p + vec2(0.0, e)) - heart(p - vec2(0.0, e)));",
    "  g = g / max(length(g), 1e-5);",
    "  float h = sqrt(clamp(-d / 0.16, 0.0, 1.0));",
    "  vec3 n = normalize(vec3(g * 1.9 * pow(1.0 - h, 1.4), 1.0));",
    "  vec3 l = normalize(vec3(-0.45, 0.55, 0.7));",
    "  float lit = clamp(dot(n, l), 0.0, 1.0);",
    "  vec3 c = mix(DEEP * 0.82, DEEP, smoothstep(0.0, 0.4, lit));",
    "  c = mix(c, LIGHT, 0.85 * smoothstep(0.42, 0.95, lit) * smoothstep(-0.45, 0.25, p.y));",
    "  float spec = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 70.0);",
    "  c += vec3(1.0) * (spec * 0.85 + pow(lit, 12.0) * 0.12);",
    "  if (uSheen >= 0.0) {",
    "    vec3 s = normalize(vec3(mix(-0.9, 0.9, uSheen), 0.25, 0.6));",
    "    float sh = pow(max(dot(n, normalize(s + vec3(0.0, 0.0, 1.0))), 0.0), 40.0);",
    "    c += vec3(1.0, 0.96, 0.97) * sh * 0.55 * sin(3.14159265 * uSheen);",
    "  }",
    "  return c;",
    "}",
    // Distance to an arc of a circle: centre c, radius r, around the angle a, half-width w.
    "float arc(vec2 p, vec2 c, float r, float a, float w) {",
    "  vec2 v = p - c;",
    "  float t = atan(v.y, v.x) - a;",
    "  t = mod(t + 3.14159265, 6.28318531) - 3.14159265;",
    "  if (abs(t) < w) return abs(length(v) - r);",
    "  float s = sign(t) * w + a;",
    "  return length(v - r * vec2(cos(s), sin(s)));",
    "}",
    // One eye at e: a shut lid curving down, or an open eye looking straight out.
    "vec3 eye(vec2 p, vec2 e, vec3 c, float px) {",
    "  float open = mix(uEyes, 1.0, uFadeOnly);",
    "  float shut = 1.0 - uEyes;",
    "  float lid = arc(p, e + vec2(0.0, 0.055), 0.085, -1.5708, 0.95);",
    "  float thick = 0.012 * (1.0 - 0.55 * smoothstep(0.03, 0.085, abs(p.x - e.x)));",
    "  c = mix(c, LID, shut * (1.0 - smoothstep(thick - px, thick + px, lid)));",
    "  vec2 q = (p - e) / vec2(0.07, 0.05 * max(open, 0.02));",
    "  float white = length(q);",
    "  float shown = uEyes * (1.0 - smoothstep(1.0 - px * 20.0, 1.0, white));",
    "  vec3 ec = mix(vec3(0.99, 0.95, 0.96), LID * 0.7, smoothstep(0.88, 1.0, white));",
    "  float iris = length(p - e) / (0.034 * min(1.0, open * 1.6 + 0.01));",
    "  ec = mix(ec, vec3(0.12, 0.03, 0.08), 1.0 - smoothstep(0.92, 1.0, iris));",
    "  ec = mix(ec, vec3(1.0), 1.0 - smoothstep(0.8, 1.0, length(p - e - vec2(-0.011, 0.012)) / 0.009));",
    "  return mix(c, ec, shown);",
    "}",
    // A small closed pout: a full lower lip, an upper lip with a soft bow, a dark
    // line between them and a wet gloss on the lower lip, like the cover's lip.
    "float blob(vec2 p, vec2 c, vec2 r) { return (length((p - c) / r) - 1.0) * min(r.x, r.y); }",
    "const float LIP_SIZE = 1.35; // the lips' own scale, so their shape reads from across a room",
    "vec3 lips(vec2 p, vec3 c, float px) {",
    "  vec2 m = (p - LIP) / LIP_SIZE; px /= LIP_SIZE;",
    "  vec2 q = vec2(abs(m.x), m.y);",
    "  float upper = blob(q, vec2(0.0, 0.011), vec2(0.052, 0.016));",
    "  upper = max(upper, -blob(q, vec2(0.0, 0.03), vec2(0.011, 0.009))); // the bow",
    "  float lower = blob(q, vec2(0.0, -0.013), vec2(0.044, 0.021));",
    "  float d = min(upper, lower);",
    "  vec3 lc = mix(DEEP * 0.62, DEEP * 0.84, smoothstep(0.016, -0.006, abs(m.y + 0.012)));",
    "  lc = mix(lc, LID, 0.3 * smoothstep(-0.03, 0.02, m.y));",
    "  lc += vec3(1.0) * 0.55 * (1.0 - smoothstep(0.0, 1.0, length((m - vec2(-0.012, -0.015)) / vec2(0.014, 0.006))));",
    "  float seam = 1.0 - smoothstep(0.0025, 0.0025 + 1.5 * px, abs(m.y - 0.0015));",
    "  lc = mix(lc, LID, seam * (1.0 - smoothstep(0.036, 0.05, q.x)));",
    "  return mix(c, lc, 1.0 - smoothstep(-px, px, d));",
    "}",
    // A silver dagger standing on its tip, in its own space: x across, y up the
    // blade from the tip. A glossy blade with a bright ridge, a crossguard, a
    // wrapped grip in the agent's colour and a round pommel, all outlined in navy.
    "const float BLADE = " + DAGGER.blade.toFixed(4) + ";",
    "const float BLADE_W = 0.02;               // half the blade's width at the guard",
    "const vec2 GUARD = vec2(0.042, 0.008);    // half the crossguard: 7 daggers just clear each other",
    "const float GRIP = 0.075, GRIP_W = 0.013, POMMEL = 0.016;",
    "const float GRIP_Y = BLADE + 2.0 * GUARD.y; // where the grip starts",
    "const float REACH = GRIP_Y + GRIP + 2.0 * POMMEL; // tip to the top of the pommel",
    "const vec3 STEEL = vec3(0.6, 0.65, 0.72), SHINE = vec3(0.97, 0.98, 1.0);",
    "float box(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }",
    "vec3 dagger(vec2 u, vec3 c, vec4 look, vec4 handle, float d, float px) {",
    "  float t = clamp(u.y / (BLADE * 0.45), 0.0, 1.0);",
    "  float w = BLADE_W * t * (2.0 - t); // a sharp point that swells into a straight blade",
    "  float blade = max(abs(u.x) - w, max(-u.y, u.y - BLADE));",
    "  float guard = box(u, vec2(0.0, BLADE + GUARD.y), GUARD, GUARD.y);",
    "  float grip = box(u, vec2(0.0, GRIP_Y + 0.5 * GRIP), vec2(GRIP_W, 0.5 * GRIP), 0.004);",
    "  vec2 knob = u - vec2(0.0, GRIP_Y + GRIP + 0.7 * POMMEL);",
    "  float pommel = length(knob) - POMMEL;",
    "  float metal = min(blade, min(guard, pommel));",
    "  float whole = min(metal, grip);",
    // Chrome lit from the upper left, like the face. The blade's two faces meet
    // in a ridge: the lit one with a glossy stripe, the other one holding the sky.
    "  float across = u.x / max(w, 1e-4);",
    "  vec3 edge = mix(SHINE, STEEL, smoothstep(-1.0, 0.1, across));",
    "  edge = mix(edge, mix(STEEL * 0.7, SKY1, 0.35), smoothstep(-0.05, 0.05, across));",
    "  edge += vec3(0.6) * (1.0 - smoothstep(0.0, 0.18, abs(across + 0.45)));",
    "  edge += vec3(0.35) * smoothstep(0.7, 1.0, across);",
    "  if (look.y >= 0.0) { // the glint runs down the blade once",
    "    edge += vec3(1.0) * exp(-pow((u.y - mix(BLADE, 0.0, look.y)) / 0.018, 2.0)) * sin(3.14159265 * look.y);",
    "  }",
    "  vec2 g = (u - vec2(0.0, BLADE + GUARD.y)) / GUARD;",
    "  vec3 hilt = mix(SHINE, STEEL * 0.6, smoothstep(-0.6, 1.0, 0.3 * g.x - 0.8 * g.y));",
    "  vec3 ball = mix(STEEL * 0.6, SHINE, 1.0 - smoothstep(0.0, 1.2, length(knob / POMMEL - vec2(-0.35, 0.35))));",
    "  vec3 steel = mix(edge, hilt, smoothstep(-px, px, blade - guard));",
    "  steel = mix(steel, ball, smoothstep(-px, px, min(blade, guard) - pommel));",
    "  vec3 grain = mix(handle.rgb, LIME, look.z);",
    "  float curve = 1.0 - abs(u.x / GRIP_W + 0.3) / 1.3;",
    "  grain *= 0.62 + 0.5 * curve;",
    "  grain *= 0.86 + 0.14 * smoothstep(0.15, 0.5, abs(fract((u.y - GRIP_Y) / 0.0125) - 0.5));",
    "  grain += vec3(0.35) * (1.0 - smoothstep(0.0, 0.25, abs(u.x / GRIP_W + 0.45)));",
    "  vec3 part = mix(grain, steel, smoothstep(-px, px, grip - metal));",
    "  part = mix(NAVY, part, 1.0 - smoothstep(-px, px, whole));",
    "  float shown = (1.0 - smoothstep(-px, px, whole - uLine)) * look.x * mix(1.0, 0.4, look.w);",
    "  if (handle.w > 0.5) {",
    // Stuck in the heart: hidden inside it, with a soft crease where the blade goes in.
    "    float inside = 1.0 - smoothstep(-px, px, d);",
    "    c *= 1.0 - 0.3 * look.x * inside * smoothstep(-0.03, 0.0, d) * (1.0 - smoothstep(0.0, 0.02, blade));",
    "    shown *= 1.0 - inside;",
    "  }",
    "  return mix(c, part, shown);",
    "}",
    "void main() {",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec3 col = sky(1.0 - frag.y / uRes.y);",
    "  vec2 p = (frag - uHeart.xy) / uHeart.z;",
    "  float px = 1.0 / uHeart.z;",
    "  float d = heart(p);",
    "  col *= 1.0 - 0.1 * exp(-max(d, 0.0) * 22.0); // a faint airbrushed shadow around the face",
    "  if (d < px) {",
    "    vec3 face = skin(p, d);",
    "    face = eye(p, vec2(-0.185, 0.035), face, px);",
    "    face = eye(p, vec2(0.185, 0.035), face, px);",
    "    face = lips(p, face, px);",
    "    col = mix(col, face, 1.0 - smoothstep(-px, px, d));",
    "  }",
    "  for (int i = 0; i < " + DAGGER_SLOTS + "; i++) {",
    "    vec4 look = uDagLook[i];",
    "    if (look.x <= 0.0) continue;",
    "    vec4 pose = uDagPose[i];",
    "    vec2 v = p - pose.xy;",
    "    vec2 u = vec2(dot(v, vec2(pose.w, -pose.z)), dot(v, pose.zw));",
    "    if (abs(u.x) > GUARD.x + 0.01 || u.y < -0.03 || u.y > REACH + 0.01) continue;",
    "    col = dagger(u, col, look, uDagHandle[i], d, px);",
    "  }",
    "  col += (hash(frag) - 0.5) / 255.0; // no banding in the long gradients",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  var UNIFORMS = ["uRes", "uHeart", "uSkyTop", "uEyes", "uFadeOnly", "uSheen", "uDagPose", "uDagLook", "uDagHandle", "uLine"];

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader failed");
    return shader;
  }

  // Without WebGL the sky is still there, as a CSS gradient behind the canvas.
  var STYLE = [
    ".fvg { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(" + SKY.join(", ") + "); }",
    ".fvg canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }",
  ].join("\n");

  window.agentScreensaver.register(function () {
    var box, style, canvas, gl, uniforms = {}, cancelFrame, ctx, lastState;
    var fps = 12, scale = 0.5, driftMs = 4 * 60000, dirty = true;
    var frame, display = "main";
    var eyes = tween(0), skyTop = tween(0);
    var REST_TOP = rgbOf(SKY[0]), CALL_TOP = rgbOf(DEEP_SKY);
    // The daggers in drawing order: the tasks' daggers in card order, then the ones falling out.
    var daggers = [], firstState = true;
    var dagPose = new Float32Array(DAGGER_SLOTS * 4);
    var dagLook = new Float32Array(DAGGER_SLOTS * 4);
    var dagHandle = new Float32Array(DAGGER_SLOTS * 4);

    function newDagger(card, key, x, nowMs) {
      return {
        key: key,
        colour: rgbOf(agentColour(card.source)),
        startedMs: card.started_at_ms,
        endMs: card.kind === "finished" ? card.updated_at_ms : null, // finished: the depth stops here
        // The daggers already there when the screen saver starts do not stab in.
        bornMs: firstState ? -Infinity : nowMs,
        glintMs: -Infinity,
        leftMs: null,
        x: tween(x), lime: tween(0), dim: tween(0),
      };
    }

    // Matches the daggers to the cards: new cards stab in, finished ones glint,
    // waiting ones turn lime, and the daggers of cards that left fall out.
    function syncDaggers(state, nowMs) {
      var cards = state.display === "main" ? state.cards.slice(0, DAGGERS) : [];
      var call = moodOf(state) === "call", still = reduce.matches;
      var lookMs = still ? FADE_MS : EYES_MS, slideMs = still ? 1 : STAB_MS;
      var byKey = {};
      daggers.forEach(function (dagger) { if (dagger.leftMs === null) byKey[dagger.key] = dagger; });
      var stay = cards.map(function (card) { return card.source + "\u0000" + card.session; });
      var leaving = Object.keys(byKey).some(function (key) { return stay.indexOf(key) < 0; });
      // The rest move up only once a leaving dagger is out of the heart, so they never cross it.
      var moveAt = leaving && !still ? nowMs + PULL * FALL_MS : nowMs;
      var kept = cards.map(function (card, index) {
        var key = stay[index], x = slotX(index, cards.length);
        var dagger = byKey[key] || newDagger(card, key, x, moveAt);
        delete byKey[key];
        var finished = card.kind === "finished";
        if (finished && dagger.endMs === null) { dagger.endMs = state.nowMs; dagger.glintMs = nowMs; }
        if (!finished) dagger.endMs = null;
        dagger.startedMs = card.started_at_ms;
        dagger.x.set(x, moveAt, slideMs);
        dagger.lime.set(card.kind === "approval" ? 1 : 0, nowMs, lookMs);
        dagger.dim.set(call && card.kind !== "approval" ? 1 : 0, nowMs, lookMs);
        return dagger;
      });
      Object.keys(byKey).forEach(function (key) { byKey[key].leftMs = nowMs; });
      daggers = kept.concat(daggers.filter(function (dagger) { return dagger.leftMs !== null; }));
      firstState = false;
    }

    function leaveMs() { return reduce.matches ? FADE_MS : FALL_MS; }

    // One dagger this moment: its tip and direction, how it looks, and whether it is stuck.
    function placeDagger(dagger, nowMs, slot) {
      var still = reduce.matches, x = dagger.x.at(nowMs), lean = x * DAGGER.lean;
      var depth = depthOf((dagger.endMs === null ? nowMs : dagger.endMs) - dagger.startedMs);
      var under = DAGGER.stuck + depth * (DAGGER.blade / 3 - DAGGER.stuck); // the blade inside the heart: a third at full depth
      var stab = Math.min(1, Math.max(0, nowMs - dagger.bornMs) / (still ? FADE_MS : STAB_MS));
      var alpha = still ? stab : Math.min(1, stab / 0.4), rise = still ? 0 : DAGGER.lift * (1 - easeOut(stab));
      var drift = 0, drop = 0, tumble = 0, stuck = 1;
      if (dagger.leftMs !== null) {
        var t = Math.min(1, (nowMs - dagger.leftMs) / leaveMs());
        if (still) alpha *= 1 - t;
        else if (t < PULL) rise = (under + 0.01) * easeOut(t / PULL);
        else {
          // Out of the heart: it tumbles outwards and falls past the face.
          var fall = (t - PULL) / (1 - PULL), s = (fall * FALL_MS * (1 - PULL)) / 1000, side = x < 0 ? -1 : 1;
          rise = under + 0.01;
          drift = side * 0.12 * fall;
          drop = 0.5 * GRAVITY * s * s;
          tumble = side * 1.6 * fall * fall;
          alpha *= 1 - Math.max(0, (fall - 0.6) / 0.4);
          stuck = 0;
        }
      }
      // The blade goes in at the edge above its slot; it tumbles around its balance point.
      var reach = rise - under + DAGGER.middle;
      var mx = x + Math.sin(lean) * reach + drift, my = edgeAt(x) + Math.cos(lean) * reach - drop;
      var o = slot * 4, upX = Math.sin(lean + tumble), upY = Math.cos(lean + tumble);
      var glint = (nowMs - dagger.glintMs) / GLINT_MS;
      dagPose.set([mx - upX * DAGGER.middle, my - upY * DAGGER.middle, upX, upY], o);
      dagLook.set([alpha, still || glint < 0 || glint >= 1 ? -1 : glint, dagger.lime.at(nowMs), dagger.dim.at(nowMs)], o);
      dagHandle.set([dagger.colour[0], dagger.colour[1], dagger.colour[2], stuck], o);
    }

    function placeDaggers(nowMs) {
      var wait = leaveMs();
      daggers = daggers.filter(function (dagger) { return dagger.leftMs === null || nowMs - dagger.leftMs < wait; });
      dagLook.fill(0);
      daggers.slice(0, DAGGER_SLOTS).forEach(function (dagger, slot) { placeDagger(dagger, nowMs, slot); });
    }

    function daggersMoving(nowMs) {
      return daggers.some(function (dagger) {
        return nowMs - dagger.bornMs < FADE_MS || dagger.leftMs !== null ||
          dagger.x.moving(nowMs) || dagger.lime.moving(nowMs) || dagger.dim.moving(nowMs);
      });
    }

    function size() {
      return { w: box.clientWidth || window.innerWidth, h: box.clientHeight || window.innerHeight };
    }

    function fit() {
      if (!canvas) return;
      var s = size(), w = Math.max(1, Math.round(s.w * scale)), h = Math.max(1, Math.round(s.h * scale));
      // Setting a canvas's size clears it, so only when the size changed.
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      frame = frameOf(lastState || { display: display, cards: [] }, s.w, s.h);
      dirty = true;
    }

    // The heart as it is this moment: breathing and drifting, unless motion is reduced.
    function pose(nowMs) {
      var s = size(), k = canvas.width / s.w, heart = frame.heart;
      var still = reduce.matches, t = nowMs / 1000, turn = Math.PI * 2;
      var breath = still ? 1 : 1 + BREATH * Math.sin((turn * t) / BREATH_S);
      var reach = DRIFT_VMIN * Math.min(s.w, s.h) / 100, dt = (nowMs % driftMs) / driftMs;
      var dx = still ? 0 : reach * Math.sin(turn * dt), dy = still ? 0 : reach * 0.6 * Math.sin(turn * dt * 2 + 1);
      return { x: (heart.cx + dx) * k, y: canvas.height - (heart.cy + dy) * k, side: heart.size * breath * k };
    }

    function sheenAt(nowMs) {
      if (reduce.matches) return -1;
      var t = (nowMs / 1000) % SHEEN_S;
      return t < SHEEN_SLIDE_S ? t / SHEEN_SLIDE_S : -1;
    }

    function render(nowMs) {
      var at = pose(nowMs), deep = skyTop.at(nowMs);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform3f(uniforms.uHeart, at.x, at.y, at.side);
      gl.uniform3f(uniforms.uSkyTop,
        REST_TOP[0] + (CALL_TOP[0] - REST_TOP[0]) * deep,
        REST_TOP[1] + (CALL_TOP[1] - REST_TOP[1]) * deep,
        REST_TOP[2] + (CALL_TOP[2] - REST_TOP[2]) * deep);
      gl.uniform1f(uniforms.uEyes, eyes.at(nowMs));
      gl.uniform1f(uniforms.uFadeOnly, reduce.matches ? 1 : 0);
      gl.uniform1f(uniforms.uSheen, sheenAt(nowMs));
      placeDaggers(nowMs);
      gl.uniform4fv(uniforms.uDagPose, dagPose);
      gl.uniform4fv(uniforms.uDagLook, dagLook);
      gl.uniform4fv(uniforms.uDagHandle, dagHandle);
      gl.uniform1f(uniforms.uLine, (2 * canvas.width) / size().w / at.side); // 2 CSS px
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function draw(nowMs) {
      if (!gl) return;
      // With "Reduce motion" the sky is drawn only when something changed, and while a fade runs.
      if (reduce.matches && !dirty && !eyes.moving(nowMs) && !skyTop.moving(nowMs) && !daggersMoving(nowMs)) return;
      dirty = false;
      render(nowMs);
    }

    function setUpGl() {
      canvas = document.createElement("canvas");
      box.appendChild(canvas);
      gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
      if (!gl) throw new Error("no webgl");
      var program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
      gl.useProgram(program);
      UNIFORMS.forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var where = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(where);
      gl.vertexAttribPointer(where, 2, gl.FLOAT, false, 0, 0);
    }

    function onResize() {
      fit();
      draw(ctx.now());
    }

    var api = {
      start: function (root, context) {
        ctx = context;
        display = ctx.display || "main";
        var options = ctx.options || {};
        var wantFps = Number(options.fps), wantScale = Number(options.scale), wantDrift = Number(options.drift);
        if (Number.isFinite(wantFps)) fps = Math.min(30, Math.max(1, wantFps));
        if (Number.isFinite(wantScale)) scale = Math.min(1, Math.max(0.25, wantScale));
        if (Number.isFinite(wantDrift) && wantDrift > 0) driftMs = wantDrift * 60000;
        style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "fvg";
        root.append(style, box);
        try {
          setUpGl();
        } catch (err) {
          console.error("[stavgayer.favourite-ground] WebGL setup failed", err);
          if (canvas) canvas.remove();
          canvas = gl = undefined;
          return;
        }
        fit();
        window.addEventListener("resize", onResize);
        draw(ctx.now());
        // The callback's argument is the frame clock; the drawing reads ctx.now().
        cancelFrame = ctx.requestFrame(function () { draw(ctx.now()); }, fps);
      },
      update: function (state) {
        lastState = state;
        if (!ctx) return;
        var nowMs = ctx.now(), call = moodOf(state) === "call";
        // With "Reduce motion" the eyes cross-fade (uFadeOnly) instead of opening.
        eyes.set(call ? 1 : 0, nowMs, reduce.matches ? FADE_MS : EYES_MS);
        skyTop.set(call ? 1 : 0, nowMs, reduce.matches ? FADE_MS : SKY_MS);
        syncDaggers(state, nowMs);
        fit();
        draw(nowMs);
      },
      stop: function () {
        window.removeEventListener("resize", onResize);
        if (cancelFrame) cancelFrame();
        if (gl) {
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
        }
        if (box) box.remove();
        if (style) style.remove();
        box = style = canvas = gl = cancelFrame = ctx = lastState = frame = undefined;
        uniforms = {};
        eyes = tween(0);
        skyTop = tween(0);
        daggers = [];
        firstState = true;
      },
    };
    return window.agentScreensaver.helpers.recoverWebGL(api, function () { return canvas; });
  });
})();
