// The Favourite sky: a wide, hot pink heart, low and centred in a blue sky,
// after the cover of the single. Everything is drawn in code by one WebGL 1
// fragment shader on a canvas at half the screen's pixels.
//   rest, work, done: the resting sky and the heart, airbrushed with soft light;
//   call: an agent waits: lime floods the heart's highlights and the sky goes
//   to its deepest blue;
//   second display: the sky and the heart.
// Each task is a polished steel dagger stuck in the heart's top edge, its
// wrapped grip in the agent's colour. It stabs in, sinks slowly over the first
// hour, glints once when the task is finished, turns lime while its agent waits
// (the others dim), and slides out and falls when the task leaves. Where the
// blade goes in, the liquid climbs it a little, ripples and takes its shadow.
// Each usage limit is a steel thorn coming out of the heart's bottom, longer the
// more of the limit is used, with the agent's colour as a thin tint at its root.
// The song that plays is the heart's own liquid running from its bottom point,
// one smooth surface with the heart: a drop forms as the song plays and breaks
// off and falls at its end.
//
// The heart is liquid: its outline and its surface flow like an inflated balloon
// (a two-layer warp of waves of 6 to 14 s, 5 to 8% of its size), the light flowing with it,
// and the daggers, the spikes and the drip stay on its moving edge: the thorns
// sway with it and the drip swings and stretches. It also
// breathes (about 1.5% every 8 s), and the whole picture drifts a few pixels over
// minutes against burn-in. JavaScript works out every moving value and the
// shader paints them; both read the wobble from the same numbers (WOBBLE).
// With "Reduce motion" it stands still (no sway, no ripple), draws only when the
// state changes, the lime cross-fades, and the drip is drawn again only when its
// length changed and fades at the song's end. The page elements on top use the same frame (below).
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
    spikeSpread: 0.26, // of the heart's size: how far from its centre the outer spikes hang
    maxSpikes: 12, // a limit past the twelfth has a label but no spike
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
  // limits and no cards, and only the limits that can be read count.
  function frameOf(state, width, height) {
    var main = state.display === "main";
    return favouriteFrame(width, height, main ? limitsInOrder(state).length : 0, main ? state.cards.length : 0);
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

  // The limits that can be read, from left to right: by state.agentOrder, then each
  // agent's windows in the order the app sends them (the sort keeps that order).
  // A limit whose used_percent is not a number is left out: no spike, no label.
  function limitsInOrder(state) {
    var order = state.agentOrder || [];
    function rank(limit) {
      var known = order.indexOf(limit.source);
      return known < 0 ? order.length : known;
    }
    return (state.limits || [])
      .filter(function (limit) { return Number.isFinite(limit.used_percent); })
      .sort(function (a, b) { return rank(a) - rank(b); });
  }

  // How much of a limit from limitsInOrder is used, 0 to 100: 0 once it has reset.
  function usedPercent(limit, nowMs) {
    if (limit.resets_at > 0 && nowMs >= limit.resets_at * 1000) return 0;
    return Math.min(100, Math.max(0, limit.used_percent));
  }

  // Where spike `index` of `count` hangs, as a share of the heart's size from its
  // centre (x = heart.cx + offset * heart.size): one under the tip, more spread
  // evenly along the bottom of the heart. Only the first maxSpikes count.
  function spikeOffset(index, count) {
    count = Math.min(count, FRAME.maxSpikes);
    return count < 2 ? 0 : FRAME.spikeSpread * ((2 * index) / (count - 1) - 1);
  }
  // end geometry

  // The sky from top to bottom, as measured on the cover; an approval deepens its top.
  var SKY = ["#034d87", "#096faa", "#52a4c7", "#87c2c4"];
  var DEEP_SKY = "#021f3a";
  // The heart's pinks, measured on the two covers (the Favourite cover and the
  // Romance heart), from its shadow to its brightest highlight.
  var SKIN = {
    shade: "#b72342", // the darkest 5% of the Favourite heart
    deep: "#d34663", // its darker quarter
    body: "#f96c87", // the hot pink in the middle of the Romance heart
    light: "#feb2d7", // the brightest 5% of the Romance heart
    pearl: "#ffe1ee", // the airbrushed highlights, a little paler still
    rim: "#e878bc", // the magenta at the Romance heart's edge
  };
  // The heart's distance field (after Inigo Quilez), in its own units: the shader
  // draws it and the daggers, spikes and drip find its edges with the same field
  // (heartField below). Plump rounding, a soft wide dip and a squashed height make
  // the Favourite cover's heart: wide round lobes over sides that taper to a soft point.
  var HEART = {
    round: 0.08, // plump lobes and a soft point, not a sharp card heart
    soft: 0.004, // a wide, shallow dip between the lobes
    mid: 0.552, // the heart's vertical middle, before the squash
    lobe: [0.25, 0.75], // the centre of the right lobe's circle
    lobeRadius: 0.35355339, // its radius, before the rounding
    aspect: 1.38, // width : height, between the two covers (1.32 and 1.47)
  };
  HEART.units = 1.207 + 2 * HEART.round; // heart units per box side: its width fills the box
  // How much the height is squashed: the plain shape is 1.207 + 2 * round wide and
  // lobe + lobeRadius + 2 * round tall, in heart units.
  HEART.squash = (HEART.aspect * (HEART.lobe[1] + HEART.lobeRadius + 2 * HEART.round)) / HEART.units;
  // The liquid wobble: the heart's outline and surface flow like an inflated
  // balloon or a liquid blob. A point p of heart space shows the heart at
  // p - wobble(p, t). The wobble is a domain warp in two layers, so bulges travel
  // across the surface instead of the outline only shifting:
  //   waves: slow waves, each [x amount, y amount, x wave number, y wave number,
  //     radians per second, phase];
  //   flow: more waves of the same form, read at p moved by the first layer
  //     (waves feeding into waves);
  //   swells: grow or shrink the heart around its centre, also read at the moved
  //     point ([amount, x wave number, y wave number, radians per second, phase]).
  // Amounts in heart-box sides: together about 5 to 8% of the heart's size. The
  // waves take 6 to 14 s, so a few seconds of watching show the heart flow.
  var WOBBLE = {
    waves: [
      [0.012, 0.03, 2.4, 0.9, 0.62, 0],
      [0.026, 0.008, 0.8, 2.7, -0.53, 1.9],
    ],
    flow: [
      [0, 0.022, -3.4, 1.6, 0.81, 0.7],
      [0.018, 0, 1.3, 3.2, 0.71, 2.6],
      [0.01, 0.01, 4.1, -2.2, -0.95, 4.2],
    ],
    swells: [
      [0.06, 2.3, -1.8, 0.47, 0.7],
    ],
    call: 0.5, // the share of the outline's wobble left while an agent waits, so the heart never swells into a bun
    calm: [0.25, -0.34, 0.05], // near the point the wobble shrinks to this share, from y = -0.34 up to 0.05, so the point stays a point
    // The moment shown with "Reduce motion": the calmest one, found once by
    // searching t from 0 to 600 s in steps of 0.5 s for the smallest sum of the
    // squared wobble over a grid on the heart (x every 0.1, y every 0.08). Search
    // again if the waves change.
    still: 518,
  };
  var BREATH_S = 8, BREATH = 0.015; // one breath every 8 s, ±1.5% of the size
  var DRIFT_VMIN = 0.6; // how far the picture drifts, about 5 px on a laptop
  var LOOK_MS = 250, SKY_MS = 1200, FADE_MS = 400;

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
  var LIME = "#9bf95e";
  var SINK_MS = 60 * 60000, STAB_MS = 400, GLINT_MS = 600, FALL_MS = 800;
  var PULL = 0.35; // the share of the fall spent sliding out of the heart
  var GRAVITY = 12; // heart sides per second squared

  // The spikes: one steel thorn per usage limit, coming out of the bottom edge of
  // the heart, square to its surface (a little less, so they do not splay) and
  // swaying as the surface turns. Sizes in heart space. Every spike has the same
  // full length, so their lengths compare, and an unused limit still shows 15% of it.
  var SPIKE_SLOTS = FRAME.maxSpikes;
  var SPIKE = {
    full: 0.18, // the length out of the heart at 100% (the centre one reaches the label gap)
    least: 0.15, // the share of it shown at 0%
    width: 0.04, // half the width at the root, narrower when many spikes crowd
    inset: 0.03, // how far the root reaches up into the heart, hidden behind it
    tint: 0.02, // how far the agent's colour reaches down from where the thorn comes out
    splay: 0.45, // the share of the surface's slope a thorn follows at rest
    sway: 1.8, // how much more it follows the slope's changes as the liquid moves
  };
  // The drip: the heart's own liquid running from its bottom point, a thread that
  // grows with the song and a drop at its end that swells as it plays, joined to
  // the heart in one smooth surface. It swings and stretches as the point moves,
  // a moment behind it. The drop breaks off and falls once when the song passes 99%.
  var DRIP = {
    full: 0.13, // the thread's length at the song's end: about as long as a full spike
    drop: 0.03, // the drop's radius at the song's end
    bud: 0.4, // the share of it at the song's start, a swelling of the point
    fallAt: 0.99,
    lag: 1.4, // seconds the drop's swing lags the point
    swing: 3, // how far it swings, against how far the point moved in that time
    stretch: 1.2, // how much it stretches, against how far the point rose in 0.9 s
  };
  var DRIP_FALL_MS = 600;

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // A number as a GLSL float.
  function glsl(value) { return value.toFixed(4); }

  // One wave of WOBBLE as a GLSL line, read at the point named `at`.
  function glslWave(w, at) {
    return "  o += vec2(" + glsl(w[0]) + ", " + glsl(w[1]) + ") * sin(" + glsl(w[2]) + " * " + at + ".x + " + glsl(w[3]) + " * " + at + ".y + " + glsl(w[4]) + " * uWobble + " + glsl(w[5]) + ");";
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

  // The still heart's distance at (x, y) in heart space, below 0 inside: the
  // same sums as heart() in the shader.
  function heartField(x, y) {
    var qx = Math.sqrt(Math.pow(x * HEART.units, 2) + HEART.soft);
    var qy = y * HEART.squash * HEART.units + HEART.mid, d;
    if (qy + qx > 1) d = Math.hypot(qx - HEART.lobe[0], qy - HEART.lobe[1]) - HEART.lobeRadius;
    else {
      var m = 0.5 * Math.max(qx + qy, 0);
      d = Math.sqrt(Math.min(qx * qx + (qy - 1) * (qy - 1), (qx - m) * (qx - m) + (qy - m) * (qy - m))) * Math.sign(qx - qy);
    }
    return (d - HEART.round) / HEART.units;
  }

  // One layer of waves at (x, y) at moment t, added to `o` ([x, y]).
  function wavesAt(waves, x, y, t, o) {
    waves.forEach(function (w) {
      var s = Math.sin(w[2] * x + w[3] * y + w[4] * t + w[5]);
      o[0] += w[0] * s;
      o[1] += w[1] * s;
    });
    return o;
  }

  // How far the wobble moves the heart at (x, y) at moment t (seconds), as [x, y],
  // scaled by `amount` (1 unless given; less while an agent waits): the same sums
  // as wobble() in the shader.
  function wobbleAt(x, y, t, amount) {
    var o = wavesAt(WOBBLE.waves, x, y, t, [0, 0]);
    var mx = x + o[0], my = y + o[1]; // where the second layer is read
    wavesAt(WOBBLE.flow, mx, my, t, o);
    WOBBLE.swells.forEach(function (w) {
      var s = w[0] * Math.sin(w[1] * mx + w[2] * my + w[3] * t + w[4]);
      o[0] += x * s;
      o[1] += y * s;
    });
    var c = WOBBLE.calm, k = Math.min(1, Math.max(0, (y - c[1]) / (c[2] - c[1])));
    var calm = c[0] + (1 - c[0]) * k * k * (3 - 2 * k); // a smoothstep, as in the shader
    calm *= amount === undefined ? 1 : amount;
    return [o[0] * calm, o[1] * calm];
  }

  // The moving heart's distance at (x, y), as the shader draws it at moment t.
  function fieldAt(x, y, t, amount) {
    var o = wobbleAt(x, y, t, amount);
    return heartField(x - o[0], y - o[1]);
  }

  // Where the moving heart's edge crosses the line at x, between y = 0 (inside)
  // and y = `to` (outside), found by halving: the daggers, the spikes and the drip
  // stand on exactly the edge the shader draws.
  function crossing(x, to, t, amount) {
    var inside = 0, outside = to;
    for (var i = 0; i < 22; i++) {
      var y = 0.5 * (inside + outside);
      if (fieldAt(x, y, t, amount) < 0) inside = y; else outside = y;
    }
    return 0.5 * (inside + outside);
  }
  function edgeAt(x, t, amount) { return crossing(x, 0.6, t, amount); } // the top edge above x
  function bottomAt(x, t, amount) { return crossing(x, -0.6, t, amount); } // the bottom edge under x

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
  // layer drawn on the heart (daggers, spikes, the drip) works in heart space,
  // so it breathes and drifts with the heart for free.

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
    "uniform float uLime;    // 0 to 1: the lime light that floods the heart's reflections while an agent waits",
    "uniform float uWobble;  // the wobble's clock, seconds (stands still with Reduce motion)",
    "uniform float uWobbleAmount; // the share of the outline's wobble: 1, less while an agent waits",
    "uniform vec4 uDagPose[" + DAGGER_SLOTS + "];   // the tip, and the way the blade points up",
    "uniform vec4 uDagLook[" + DAGGER_SLOTS + "];   // opacity (0: no dagger), glint (below 0: none), lime, dim",
    "uniform vec4 uDagHandle[" + DAGGER_SLOTS + "]; // the handle's agent colour, and 1 while it is stuck in the heart",
    "uniform float uMotion;  // 1, or 0 with Reduce motion: no ripple",
    "uniform vec4 uSpike[" + SPIKE_SLOTS + "];     // the root's x and y, the length (0: no spike), half the width",
    "uniform vec2 uSpikeDir[" + SPIKE_SLOTS + "];  // the way the thorn points, from its root",
    "uniform vec3 uSpikeTint[" + SPIKE_SLOTS + "]; // the agent's colour at the root",
    "uniform vec4 uDrip;     // the thread's length, how deep the drop's centre hangs, opacity (0: no drip), the drop's radius",
    "uniform vec3 uDripAt;   // where the thread leaves the heart (just inside its moving bottom point), and how far the drop swings to the side",
    "const vec3 SKY1 = vec3(" + rgbOf(SKY[1]).join(", ") + ");",
    "const vec3 SKY2 = vec3(" + rgbOf(SKY[2]).join(", ") + ");",
    "const vec3 SKY3 = vec3(" + rgbOf(SKY[3]).join(", ") + ");",
    "const vec3 SHADE = vec3(" + rgbOf(SKIN.shade).join(", ") + ");",
    "const vec3 DEEP = vec3(" + rgbOf(SKIN.deep).join(", ") + ");",
    "const vec3 BODY = vec3(" + rgbOf(SKIN.body).join(", ") + ");",
    "const vec3 LIGHT = vec3(" + rgbOf(SKIN.light).join(", ") + ");",
    "const vec3 PEARL = vec3(" + rgbOf(SKIN.pearl).join(", ") + ");",
    "const vec3 RIM = vec3(" + rgbOf(SKIN.rim).join(", ") + ");",
    "const vec3 LIME = vec3(" + rgbOf(LIME).join(", ") + ");",
    "const float HR = " + HEART.round.toFixed(4) + ";",
    "const float HK = " + HEART.units.toFixed(4) + ";",
    "const float HMID = " + HEART.mid.toFixed(4) + ";",
    "const float HSQ = " + HEART.squash.toFixed(4) + ";",
    "const vec2 LOBE = vec2(" + HEART.lobe.map(function (v) { return v.toFixed(4); }).join(", ") + ");",
    "const float LOBE_R = " + HEART.lobeRadius.toFixed(8) + ";",
    "float dot2(vec2 v) { return dot(v, v); }",
    "float heartUnits(vec2 q) {",
    "  q.x = sqrt(q.x * q.x + " + HEART.soft.toFixed(4) + ");",
    "  if (q.y + q.x > 1.0) return sqrt(dot2(q - LOBE)) - LOBE_R;",
    "  return sqrt(min(dot2(q - vec2(0.0, 1.0)), dot2(q - 0.5 * max(q.x + q.y, 0.0)))) * sign(q.x - q.y);",
    "}",
    "float heart(vec2 p) { return (heartUnits(vec2(p.x, p.y * HSQ) * HK + vec2(0.0, HMID)) - HR) / HK; }",
    "float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "vec3 sky(float y) {",
    "  vec3 c = mix(uSkyTop, SKY1, smoothstep(0.0, 0.36, y));",
    "  c = mix(c, SKY2, smoothstep(0.3, 0.72, y));",
    "  return mix(c, SKY3, smoothstep(0.66, 1.0, y));",
    "}",
    // The wobble and the moving heart, from the same numbers as wobbleAt and fieldAt.
    "vec2 wobble(vec2 p) {",
    "  vec2 o = vec2(0.0);",
  ].concat(WOBBLE.waves.map(function (w) { return glslWave(w, "p"); }), [
    "  vec2 m = p + o; // where the second layer is read",
  ], WOBBLE.flow.map(function (w) { return glslWave(w, "m"); }), WOBBLE.swells.map(function (w) {
    return "  o += p * " + glsl(w[0]) + " * sin(" + glsl(w[1]) + " * m.x + " + glsl(w[2]) + " * m.y + " + glsl(w[3]) + " * uWobble + " + glsl(w[4]) + ");";
  }), [
    "  return o * uWobbleAmount * mix(" + glsl(WOBBLE.calm[0]) + ", 1.0, smoothstep(" + glsl(WOBBLE.calm[1]) + ", " + glsl(WOBBLE.calm[2]) + ", p.y));",
    "}",
    "float body(vec2 p) { return heart(p - wobble(p)); }",
    // The liquid's surface flow: cheap value noise in two octaves, warped by
    // itself (noise into noise), tilting the surface only. The outline keeps the
    // wave warp above, which the daggers can follow exactly; this moves only the
    // light, so the highlights flow and swirl like thick liquid.
    "float vnoise(vec2 p) {",
    "  vec2 i = floor(p), f = fract(p);",
    "  f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);",
    "}",
    "float fbm2(vec2 p) { return 0.65 * vnoise(p) + 0.35 * vnoise(p * 2.03 + vec2(3.1, 1.7)); }",
    "vec2 flow(vec2 q) {",
    "  vec2 s = q * 2.4 + 20.0;",
    "  vec2 a = vec2(fbm2(s + vec2(0.0, 0.11 * uWobble)), fbm2(s + vec2(5.2, 1.3) - 0.09 * uWobble));",
    "  return vec2(fbm2(s + 2.2 * a + vec2(1.7, 9.2)), fbm2(s + 2.2 * a + vec2(8.3, 2.8))) - 0.5;",
    "}",
    // The heart's skin, thick glossy pink liquid: hot pink lit softly from the
    // upper left, deep pink to dark red away from the light, a touch of magenta
    // at the edge, and in the darker parts a soft reflection of the blue sky, like
    // liquid chrome. While an agent waits, a lime light comes on: the lit side,
    // the rim, the reflections and the highlights take lime.
    "const vec3 LAMP = vec3(" + [-0.4, 0.55, 0.75].map(function (v) { return glsl(v / Math.hypot(0.4, 0.55, 0.75)); }).join(", ") + ");",
    "vec3 surface(vec3 n, float rim) {",
    "  float lit = clamp(dot(n, LAMP), 0.0, 1.0);",
    "  vec3 c = mix(SHADE, DEEP, smoothstep(0.05, 0.42, lit));",
    "  c = mix(c, BODY, smoothstep(0.36, 0.72, lit));",
    "  c = mix(c, LIGHT, 0.7 * smoothstep(0.8, 1.0, lit));",
    "  c = mix(c, RIM, 0.4 * rim * smoothstep(0.3, 0.7, lit));",
    "  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);",
    "  vec3 mirrored = mix(mix(SKY3, SKY1, smoothstep(-0.3, 0.7, r.y)), LIME, uLime); // the sky the liquid mirrors",
    "  float fres = pow(1.0 - n.z, 2.5);",
    "  c = mix(c, mirrored, 0.24 * (1.0 - smoothstep(0.25, 0.7, lit)) + 0.3 * fres * smoothstep(0.1, -0.6, n.y));",
    "  return mix(c, LIME * (0.55 + 0.5 * lit), 0.22 * uLime * smoothstep(0.5, 0.95, lit));",
    "}",
    "vec3 hotLight() { return mix(PEARL, LIME + 0.15, uLime); }",
    // Sharp glints like liquid chrome: two small lights, upper left and upper right.
    "const vec3 GLINT1 = vec3(" + [-0.5, 0.6, 0.62].map(function (v) { return glsl(v / Math.hypot(0.5, 0.6, 0.62)); }).join(", ") + ");",
    "const vec3 GLINT2 = vec3(" + [0.55, 0.45, 0.7].map(function (v) { return glsl(v / Math.hypot(0.55, 0.45, 0.7)); }).join(", ") + ");",
    "vec3 gloss(vec3 n) {",
    "  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);",
    "  float s = pow(max(dot(r, GLINT1), 0.0), 70.0) + 0.6 * pow(max(dot(r, GLINT2), 0.0), 120.0);",
    "  return hotLight() * min(s, 1.2);",
    "}",
    // The drip is the heart's own liquid: a thread from just inside its bottom
    // point and a drop at its end, joined to the heart by a smooth union, so the
    // two are one surface and the skin below paints both. Its lower end swings
    // to the side by uDripAt.z, the drop the most.
    "const float DRIP_K = 0.03; // how wide the neck flares where the drip leaves the heart",
    "float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }",
    "bool nearDrip(vec2 p) {",
    "  vec2 r = p - uDripAt.xy;",
    "  return uDrip.z > 0.0 && abs(r.x - 0.5 * uDripAt.z) < 0.07 + abs(uDripAt.z) && r.y < 0.06 && r.y > -uDrip.y - 1.3 * uDrip.w - 0.05;",
    "}",
    "float dripField(vec2 p) {",
    "  vec2 r = p - uDripAt.xy;",
    "  float len = uDrip.x;",
    "  float s = clamp(-r.y / max(len, 1e-4), 0.0, 1.0);",
    "  float w = mix(0.02, 0.0055, sqrt(s)); // thick where it leaves the heart, stretched thin above the drop",
    "  float thread = max(abs(r.x - uDripAt.z * s * s) - w, max(r.y, -r.y - len));",
    "  float ball = length((r - vec2(uDripAt.z, -uDrip.y)) * vec2(1.0, 0.86)) - uDrip.w; // a drop that hangs heavy, longer than wide",
    "  return smin(thread, ball, 0.014);",
    "}",
    // The heart and the drip as one liquid.
    "float liquid(vec2 p) { float d = body(p); return nearDrip(p) ? smin(d, dripField(p), DRIP_K) : d; }",
    // The surface: one soft dome over the whole heart and a rim that bends away,
    // both carried along by the wobble, and tilted by the wobble itself, so the
    // bulges catch the light like a metaball and the light flows over the skin.
    // On it, soft broad highlights on the lobes, sharp glints, and one thin, soft
    // band that follows the top edge a little inside it.
    "vec3 skin(vec2 p, float d) {",
    "  vec2 w = wobble(p);",
    "  vec2 q = p - w; // the same spot of skin while the heart moves",
    "  float e = 0.004;",
    "  vec2 g = vec2(liquid(p + vec2(e, 0.0)) - liquid(p - vec2(e, 0.0)), liquid(p + vec2(0.0, e)) - liquid(p - vec2(0.0, e)));",
    "  g = g / max(length(g), 1e-5);",
    "  float rim = 1.0 - clamp(-d / 0.16, 0.0, 1.0);",
    "  vec2 dome = (q - vec2(-0.04, 0.06)) * vec2(1.5, 2.3);",
    "  vec3 n = normalize(vec3(dome + g * 2.0 * rim * rim + w * 7.0 + 0.45 * flow(q) * (1.0 - rim), 1.0));",
    "  vec3 c = surface(n, rim * rim);",
    "  float glow = 0.85 * exp(-dot2((q - vec2(-0.22, 0.2)) / vec2(0.17, 0.075)))",
    "    + 0.6 * exp(-dot2((q - vec2(0.24, 0.19)) / vec2(0.12, 0.06)))",
    "    + 0.3 * exp(-dot2((q - vec2(-0.14, 0.0)) / vec2(0.2, 0.1)));",
    "  float band = exp(-pow((d + 0.045) / 0.009, 2.0)) * smoothstep(0.08, 0.18, q.y) * smoothstep(0.02, 0.09, abs(q.x));",
    "  band *= 1.0 - 0.45 * smoothstep(-0.1, 0.35, q.x); // brighter on the lit lobe",
    "  vec3 soft = mix(PEARL, LIME + 0.1, 0.7 * uLime); // the broad highlights keep some pink under the lime",
    "  c = mix(c, soft, clamp(glow * (1.0 - 0.2 * uLime), 0.0, 0.9));",
    "  c = mix(c, hotLight(), clamp(0.8 * band, 0.0, 0.9));",
    "  return c + gloss(n) * (1.0 - 0.6 * rim);",
    "}",
    // Polished steel, after the cover's daggers and spikes: a mirror that holds
    // the sky above its horizon (darker at the top while an agent waits), a
    // bright line at the horizon, the heart's pink below it (lime while an agent
    // waits), sharp highlights from the heart's two lights, and darker where it
    // turns away, so it reads on the sky without an outline.
    "const vec3 STEEL_DARK = vec3(0.2, 0.22, 0.27);",
    "vec3 chrome(vec3 n) {",
    "  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);",
    "  vec3 above = mix(vec3(0.8, 0.84, 0.9), mix(SKY2, uSkyTop, 0.55), smoothstep(0.12, 0.85, r.y));",
    "  vec3 pink = mix(mix(BODY, LIGHT, 0.35), LIME * 0.8, 0.55 * uLime);",
    "  vec3 below = mix(mix(pink, STEEL_DARK, 0.35), STEEL_DARK, smoothstep(-0.04, -0.45, r.y));",
    "  vec3 c = mix(below, above, smoothstep(-0.03, 0.03, r.y));",
    "  c += 0.8 * exp(-pow((r.y - 0.035) / 0.045, 2.0));",
    "  c = mix(vec3(0.5, 0.53, 0.58), c, 0.75) * (1.0 - 0.5 * smoothstep(0.5, 0.95, length(n.xy)));",
    "  float s = pow(max(dot(r, GLINT1), 0.0), 80.0) + 0.7 * pow(max(dot(r, GLINT2), 0.0), 140.0);",
    "  return c + mix(vec3(1.0), LIME + 0.2, 0.6 * uLime) * min(s, 1.5);",
    "}",
    // A normal given across (x) and along (y) a part that points the way `up`, turned to the screen.
    "vec3 turned(vec2 n, float z, vec2 up) { return normalize(vec3(n.x * vec2(up.y, -up.x) + n.y * up, z)); }",
    // A steel dagger standing on its tip, in its own space: x across, y up the
    // blade from the tip. A bevelled blade (two faces that meet in a ridge, and a
    // steeper edge bevel), a round-ended crossguard and a round pommel, all
    // polished steel, and a grip of wrapped wire in the agent's colour. The lower
    // blade, near the heart, mirrors its pink; the upper blade and the hilt the sky.
    "const float BLADE = " + DAGGER.blade.toFixed(4) + ";",
    "const float BLADE_W = 0.02;               // half the blade's width at the guard",
    "const vec2 GUARD = vec2(0.042, 0.008);    // half the crossguard: 7 daggers just clear each other",
    "const float GRIP = 0.075, GRIP_W = 0.013, POMMEL = 0.016;",
    "const float GRIP_Y = BLADE + 2.0 * GUARD.y; // where the grip starts",
    "const float REACH = GRIP_Y + GRIP + 2.0 * POMMEL; // tip to the top of the pommel",
    "float box(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }",
    "vec3 dagger(vec2 u, vec2 up, vec3 c, vec4 look, vec4 handle, float d, float px) {",
    "  float t = clamp(u.y / (BLADE * 0.45), 0.0, 1.0);",
    "  float w = BLADE_W * t * (2.0 - t); // a sharp point that swells into a straight blade",
    "  float blade = max(abs(u.x) - w, max(-u.y, u.y - BLADE));",
    "  float guard = box(u, vec2(0.0, BLADE + GUARD.y), GUARD, GUARD.y);",
    "  float grip = box(u, vec2(0.0, GRIP_Y + 0.5 * GRIP), vec2(GRIP_W, 0.5 * GRIP), 0.004);",
    "  vec2 knob = (u - vec2(0.0, GRIP_Y + GRIP + 0.7 * POMMEL)) / POMMEL;",
    "  float pommel = (length(knob) - 1.0) * POMMEL;",
    "  float metal = min(blade, min(guard, pommel));",
    "  float whole = min(metal, grip);",
    // Each part's normal, then one mirror for all of them.
    "  float a = u.x / max(w, 1e-4);",
    "  float face = sign(a) * mix(0.45 * smoothstep(0.0, 0.14, abs(a)), 0.9, smoothstep(0.74, 0.9, abs(a)));",
    "  vec3 n = turned(vec2(face, mix(-0.28, 0.28, u.y / BLADE) + 0.04 * sin(u.y * 70.0)), 0.8, up);",
    "  vec2 g = (u - vec2(0.0, BLADE + GUARD.y)) / GUARD;",
    "  float onGuard = smoothstep(-px, px, blade - guard);",
    "  n = mix(n, turned(vec2(sign(g.x) * 0.8 * smoothstep(0.7, 1.0, abs(g.x)), 0.6 * g.y + 0.15), 0.8, up), onGuard);",
    "  vec2 k = knob * 0.95;",
    "  float onPommel = smoothstep(-px, px, min(blade, guard) - pommel);",
    "  n = mix(n, turned(k, sqrt(max(0.05, 1.0 - dot(k, k))), up), onPommel);",
    "  float turn = fract((u.y - GRIP_Y) / 0.015); // the grip's rings",
    "  vec2 wire = vec2(0.92 * clamp(u.x / GRIP_W, -1.0, 1.0), 0.12);",
    "  float onGrip = 1.0 - smoothstep(-px, px, grip - metal);",
    "  n = normalize(mix(n, turned(wire, sqrt(max(0.05, 1.0 - dot(wire, wire))), up), onGrip));",
    "  vec3 part = chrome(n);",
    "  if (look.y >= 0.0) { // the glint runs down the blade once",
    "    part += (1.0 - max(onGuard, max(onPommel, onGrip))) * exp(-pow((u.y - mix(BLADE, 0.0, look.y)) / 0.018, 2.0)) * sin(3.14159265 * look.y);",
    "  }",
    "  vec3 tint = mix(handle.rgb, LIME, look.z);",
    "  vec3 wrapped = part * (1.2 * tint + 0.15) * (0.72 + 0.28 * smoothstep(0.0, 0.2, min(turn, 1.0 - turn))) + 0.2 * LIME * look.z;",
    "  part = mix(part, wrapped, onGrip);",
    "  float shown = (1.0 - smoothstep(-px, px, whole)) * look.x * mix(1.0, 0.4, look.w);",
    "  if (handle.w > 0.5) {",
    // Stuck in the heart: hidden inside it. The liquid climbs the blade a little
    // and ripples out from it, and the blade's soft shadow falls on the skin below
    // and to the right of it, away from the light.
    "    float side = max(abs(u.x) - w, 0.0);",
    "    float ring = length(vec2(u.x, 2.6 * d));",
    "    float wave = uMotion * sin(ring * 260.0 - uWobble * 6.0) * exp(-ring / 0.028) * smoothstep(0.0, 0.008, side);",
    "    float lip = 0.008 * exp(-pow(side / 0.012, 2.0)) * (1.0 + 0.3 * wave);",
    "    float wet = 1.0 - smoothstep(-px, px, d - lip);",
    "    float onSkin = 1.0 - smoothstep(-px, px, d);",
    "    vec2 caster = u - vec2(dot(vec2(0.012, -0.01), vec2(up.y, -up.x)), dot(vec2(0.012, -0.01), up));",
    "    float shade = (1.0 - smoothstep(-0.004, 0.012, max(abs(caster.x) - BLADE_W, -caster.y))) * smoothstep(-0.045, -0.004, d);",
    "    c *= 1.0 - look.x * onSkin * (0.2 * shade - 0.12 * wave * smoothstep(-0.04, 0.0, d));",
    "    vec3 rise = turned(vec2(sign(u.x) * 0.55, 0.5), 0.65, up);",
    "    c = mix(c, surface(rise, 1.0) + gloss(rise), look.x * max(wet - onSkin, 0.0));",
    "    shown *= 1.0 - wet;",
    "  }",
    "  return mix(c, part, shown);",
    "}",
    // A steel thorn from its root, in its own space: x across, y out along it.
    // Round, so it mirrors the heart's pink near the root and the sky towards the
    // tip; the agent's colour tints the steel where it comes out of the heart.
    "const float SPIKE_IN = " + SPIKE.inset.toFixed(4) + ", SPIKE_TINT = " + SPIKE.tint.toFixed(4) + ";",
    "vec3 spike(vec2 u, vec4 s, vec2 dir, vec3 tint, vec3 c, float px) {",
    "  float t = clamp(u.y / s.z, 0.0, 1.0);",
    "  float w = s.w * pow(1.0 - t, 1.3); // wide at the root, curving in to a point",
    "  float d = max(abs(u.x) - w, max(-u.y, u.y - s.z));",
    "  float a = clamp(u.x / max(w, 1e-4), -1.0, 1.0);",
    "  vec3 n = normalize(vec3(0.9 * a * vec2(-dir.y, dir.x) - mix(-0.3, 0.45, t) * dir, sqrt(max(0.06, 1.0 - a * a))));",
    "  vec3 tone = chrome(n) * mix(0.8 * tint + 0.35, vec3(1.0), smoothstep(SPIKE_IN, SPIKE_IN + SPIKE_TINT, u.y));",
    "  tone *= 0.7 + 0.3 * smoothstep(SPIKE_IN, SPIKE_IN + 0.012, u.y); // in the heart's shade where it comes out",
    "  return mix(c, tone, 1.0 - smoothstep(-px, px, d));",
    "}",
    "void main() {",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec3 col = sky(1.0 - frag.y / uRes.y);",
    "  vec2 p = (frag - uHeart.xy) / uHeart.z;",
    "  float px = 1.0 / uHeart.z;",
    "  float d = body(p);",
    "  float dl = nearDrip(p) ? smin(d, dripField(p), DRIP_K) : d; // the heart with its drip",
    "  col *= 1.0 - 0.1 * exp(-max(d, 0.0) * 22.0); // a faint shadow around the heart",
    "  for (int i = 0; i < " + SPIKE_SLOTS + "; i++) { // behind the heart, which hides their roots",
    "    vec4 s = uSpike[i];",
    "    if (s.z <= 0.0) continue;",
    "    vec2 dir = uSpikeDir[i], v = p - s.xy;",
    "    vec2 u = vec2(dot(v, vec2(-dir.y, dir.x)), dot(v, dir));",
    "    if (abs(u.x) > s.w + 0.01 || u.y < -0.01 || u.y > s.z + 0.01) continue;",
    "    col = spike(u, s, dir, uSpikeTint[i], col, px);",
    "  }",
    // The drip fades out (Reduce motion) by fading from the heart with it to the heart alone.
    "  if (dl < px) col = mix(col, skin(p, dl), mix(1.0 - smoothstep(-px, px, d), 1.0 - smoothstep(-px, px, dl), uDrip.z));",
    "  for (int i = 0; i < " + DAGGER_SLOTS + "; i++) {",
    "    vec4 look = uDagLook[i];",
    "    if (look.x <= 0.0) continue;",
    "    vec4 pose = uDagPose[i];",
    "    vec2 v = p - pose.xy;",
    "    vec2 u = vec2(dot(v, vec2(pose.w, -pose.z)), dot(v, pose.zw));",
    "    if (abs(u.x) > GUARD.x + 0.01 || u.y < -0.03 || u.y > REACH + 0.01) continue;",
    "    col = dagger(u, pose.zw, col, look, uDagHandle[i], d, px);",
    "  }",
    "  col += (hash(frag) - 0.5) / 255.0; // no banding in the long gradients",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ]).join("\n");

  var UNIFORMS = ["uRes", "uHeart", "uSkyTop", "uLime", "uWobble", "uWobbleAmount", "uDagPose", "uDagLook", "uDagHandle", "uMotion", "uSpike", "uSpikeDir", "uSpikeTint", "uDrip", "uDripAt"];

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
    var fps = 12, scale = 0.5, driftMs = 4 * 60000, dirty = true, startMs = 0;
    var frame, display = "main";
    var skyTop = tween(0); // 0 resting, 1 while an agent waits: the deep sky and the lime light
    var REST_TOP = rgbOf(SKY[0]), CALL_TOP = rgbOf(DEEP_SKY);
    // The daggers in drawing order: the tasks' daggers in card order, then the ones falling out.
    var daggers = [], firstState = true;
    var dagPose = new Float32Array(DAGGER_SLOTS * 4);
    var dagLook = new Float32Array(DAGGER_SLOTS * 4);
    var dagHandle = new Float32Array(DAGGER_SLOTS * 4);
    var spikeShape = new Float32Array(SPIKE_SLOTS * 4), spikeTint = new Float32Array(SPIKE_SLOTS * 3);
    var spikeDir = new Float32Array(SPIKE_SLOTS * 2), spikeX = new Float32Array(SPIKE_SLOTS); // where each thorn hangs
    // The song the drip follows (none on the second display or while an agent
    // waits), when the drop began to fall, and the drip as last drawn.
    var song = null, fellMs = null, drawnDrip = "";

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
      var lookMs = still ? FADE_MS : LOOK_MS, slideMs = still ? 1 : STAB_MS;
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
    function placeDagger(dagger, nowMs, slot, t, amount) {
      var still = reduce.matches, x = dagger.x.at(nowMs), lean = x * DAGGER.lean;
      var depth = depthOf((dagger.endMs === null ? nowMs : dagger.endMs) - dagger.startedMs);
      var under = DAGGER.stuck + depth * (DAGGER.blade / 3 - DAGGER.stuck); // the blade inside the heart: a third at full depth
      var stab = Math.min(1, Math.max(0, nowMs - dagger.bornMs) / (still ? FADE_MS : STAB_MS));
      var alpha = still ? stab : Math.min(1, stab / 0.4), rise = still ? 0 : DAGGER.lift * (1 - easeOut(stab));
      var drift = 0, drop = 0, tumble = 0, stuck = 1;
      if (dagger.leftMs !== null) {
        var leave = Math.min(1, (nowMs - dagger.leftMs) / leaveMs());
        if (still) alpha *= 1 - leave;
        else if (leave < PULL) rise = (under + 0.01) * easeOut(leave / PULL);
        else {
          // Out of the heart: it tumbles outwards and falls past it.
          var fall = (leave - PULL) / (1 - PULL), s = (fall * FALL_MS * (1 - PULL)) / 1000, side = x < 0 ? -1 : 1;
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
      var mx = x + Math.sin(lean) * reach + drift, my = edgeAt(x, t, amount) + Math.cos(lean) * reach - drop;
      var o = slot * 4, upX = Math.sin(lean + tumble), upY = Math.cos(lean + tumble);
      var glint = (nowMs - dagger.glintMs) / GLINT_MS;
      dagPose.set([mx - upX * DAGGER.middle, my - upY * DAGGER.middle, upX, upY], o);
      dagLook.set([alpha, still || glint < 0 || glint >= 1 ? -1 : glint, dagger.lime.at(nowMs), dagger.dim.at(nowMs)], o);
      dagHandle.set([dagger.colour[0], dagger.colour[1], dagger.colour[2], stuck], o);
    }

    function placeDaggers(nowMs, t, amount) {
      var wait = leaveMs();
      daggers = daggers.filter(function (dagger) { return dagger.leftMs === null || nowMs - dagger.leftMs < wait; });
      dagLook.fill(0);
      daggers.slice(0, DAGGER_SLOTS).forEach(function (dagger, slot) { placeDagger(dagger, nowMs, slot, t, amount); });
    }

    function daggersMoving(nowMs) {
      return daggers.some(function (dagger) {
        return nowMs - dagger.bornMs < FADE_MS || dagger.leftMs !== null ||
          dagger.x.moving(nowMs) || dagger.lime.moving(nowMs) || dagger.dim.moving(nowMs);
      });
    }

    // One spike per limit, in label order, longer the more of the limit is used.
    // Its root's height is found each frame on the moving edge (placeSpikes).
    function syncSpikes(state) {
      var limits = state.display === "main" ? limitsInOrder(state).slice(0, SPIKE_SLOTS) : [];
      var count = limits.length, spacing = count < 2 ? 1 : (2 * FRAME.spikeSpread) / (count - 1);
      var width = Math.min(SPIKE.width, 0.36 * spacing);
      spikeShape.fill(0);
      limits.forEach(function (limit, index) {
        var x = spikeOffset(index, count), used = usedPercent(limit, state.nowMs) / 100;
        var length = SPIKE.full * (SPIKE.least + (1 - SPIKE.least) * used);
        spikeX[index] = x;
        spikeShape.set([x, 0, SPIKE.inset + length, width], index * 4);
        spikeTint.set(rgbOf(agentColour(limit.source)), index * 3);
      });
    }

    // The way the heart's surface faces at (x, y), as an angle from straight
    // down (positive: to the right), on the heart at moment t, or the still heart
    // when amount is 0.
    function slopeAt(x, y, t, amount) {
      var e = 0.004;
      return Math.atan2(fieldAt(x + e, y, t, amount) - fieldAt(x - e, y, t, amount),
        fieldAt(x, y - e, t, amount) - fieldAt(x, y + e, t, amount));
    }

    // Each thorn comes out where the moving bottom edge crosses its x, a little
    // less splayed than the still surface and swaying more than the moving one,
    // with its root hidden inside the heart.
    function placeSpikes(t, amount) {
      for (var i = 0; i < SPIKE_SLOTS; i++) {
        var o = i * 4, x = spikeX[i];
        if (spikeShape[o + 2] <= 0) continue;
        var y = bottomAt(x, t, amount), rest = slopeAt(x, bottomAt(x, t, 0), t, 0);
        var angle = SPIKE.splay * rest + SPIKE.sway * (slopeAt(x, y, t, amount) - rest);
        var dx = Math.sin(angle), dy = -Math.cos(angle);
        spikeDir.set([dx, dy], i * 2);
        spikeShape[o] = x - dx * SPIKE.inset;
        spikeShape[o + 1] = y - dy * SPIKE.inset;
      }
    }

    // Where the drip leaves the heart: just inside its bottom point, which the
    // wobble moves a little to the side.
    function dripRoot(t, amount) {
      var x = wobbleAt(0, bottomAt(0, t, amount), t, amount)[0];
      return [x, bottomAt(x, t, amount) + 0.015];
    }

    // The wobble's clock in seconds: frozen at one calm moment with "Reduce motion".
    // It counts from the start, not from 1970: the shader's 32-bit floats would
    // lose the seconds of a clock that large, and its edge would part from the
    // edge the daggers find here.
    function wobbleClock(nowMs) { return reduce.matches ? WOBBLE.still : (nowMs - startMs) / 1000; }

    // The drip this moment, from the song alone: the thread's length, how deep
    // the drop's centre hangs under the root, the drop's radius and its opacity,
    // or null for no drip. The drop swells from a bud as the song plays. A song
    // with no length hangs it at half length; past 99% the drop breaks off and
    // falls once while the thread snaps back into the heart (with Reduce motion
    // it fades), then it is gone.
    function dripAt(nowMs) {
      if (!song) return null;
      var progress = window.agentScreensaver.helpers.songProgress(song, nowMs);
      if (progress === null) progress = 0.5;
      else if (progress >= DRIP.fallAt) return fallingDrip(nowMs);
      else fellMs = null;
      var length = progress * DRIP.full, k = Math.min(1, progress / 0.7);
      var radius = DRIP.drop * (DRIP.bud + (1 - DRIP.bud) * k * k * (3 - 2 * k));
      return { length: length, depth: length + 0.8 * radius, radius: radius, alpha: 1 };
    }

    function fallingDrip(nowMs) {
      if (fellMs === null) fellMs = nowMs;
      var still = reduce.matches, t = (nowMs - fellMs) / (still ? FADE_MS : DRIP_FALL_MS);
      if (t >= 1) return null;
      var hang = DRIP.full + 0.8 * DRIP.drop;
      if (still) return { length: DRIP.full, depth: hang, radius: DRIP.drop, alpha: 1 - t };
      var s = (t * DRIP_FALL_MS) / 1000;
      return {
        length: DRIP.full * (1 - easeOut(Math.min(1, t / PULL))), // the thread snaps back into the heart
        depth: hang + 0.5 * GRAVITY * s * s,
        radius: DRIP.drop,
        alpha: 1 - Math.max(0, (t - 0.6) / 0.4),
      };
    }

    // How the drip swings and stretches: it follows the point a moment late, so
    // it swings to where the point was and stretches when the point rises.
    // [the drop's swing to the side, how much longer the thread is].
    function dripSwing(drip, t, amount) {
      if (reduce.matches) return [0, 0];
      var y = bottomAt(0, t, amount), now = wobbleAt(0, y, t, amount);
      var then = wobbleAt(0, y, t - DRIP.lag, amount), before = wobbleAt(0, y, t - 0.9, amount);
      var reach = Math.min(1, drip.depth / (DRIP.full + 0.8 * DRIP.drop));
      return [DRIP.swing * (then[0] - now[0]) * reach, DRIP.stretch * Math.max(-0.5 * drip.length, now[1] - before[1]) * reach];
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

    function render(nowMs, drip) {
      var at = pose(nowMs), deep = skyTop.at(nowMs), t = wobbleClock(nowMs);
      // While an agent waits the outline calms with the same ease as the sky and
      // the lime; the surface light keeps flowing.
      // With "Reduce motion" the outline keeps its one frozen shape: only the lime cross-fades.
      var amount = reduce.matches ? 1 : 1 - (1 - WOBBLE.call) * deep;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform3f(uniforms.uHeart, at.x, at.y, at.side);
      gl.uniform3f(uniforms.uSkyTop,
        REST_TOP[0] + (CALL_TOP[0] - REST_TOP[0]) * deep,
        REST_TOP[1] + (CALL_TOP[1] - REST_TOP[1]) * deep,
        REST_TOP[2] + (CALL_TOP[2] - REST_TOP[2]) * deep);
      gl.uniform1f(uniforms.uLime, deep);
      gl.uniform1f(uniforms.uWobble, t);
      gl.uniform1f(uniforms.uWobbleAmount, amount);
      placeDaggers(nowMs, t, amount);
      placeSpikes(t, amount);
      gl.uniform4fv(uniforms.uDagPose, dagPose);
      gl.uniform4fv(uniforms.uDagLook, dagLook);
      gl.uniform4fv(uniforms.uDagHandle, dagHandle);
      gl.uniform1f(uniforms.uMotion, reduce.matches ? 0 : 1);
      gl.uniform4fv(uniforms.uSpike, spikeShape);
      gl.uniform2fv(uniforms.uSpikeDir, spikeDir);
      gl.uniform3fv(uniforms.uSpikeTint, spikeTint);
      if (drip) {
        var root = dripRoot(t, amount), swing = dripSwing(drip, t, amount);
        gl.uniform4f(uniforms.uDrip, drip.length + swing[1], drip.depth + swing[1], drip.alpha, drip.radius);
        gl.uniform3f(uniforms.uDripAt, root[0], root[1], swing[0]);
      } else gl.uniform4f(uniforms.uDrip, 0, 0, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function draw(nowMs) {
      if (!gl) return;
      // The drip counts as changed once its length moved by a thousandth of the
      // heart, about every second and a half for a usual song.
      var drip = dripAt(nowMs);
      var seen = drip ? Math.round(drip.depth * 1000) + "/" + drip.alpha.toFixed(2) : "";
      if (seen !== drawnDrip) { drawnDrip = seen; dirty = true; }
      // With "Reduce motion" the sky is drawn only when something changed, and while a fade runs.
      if (reduce.matches && !dirty && !skyTop.moving(nowMs) && !daggersMoving(nowMs)) return;
      dirty = false;
      render(nowMs, drip);
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
        // Kept when the graphics card resets and the background starts again,
        // so the heart does not jump back to its first shape.
        if (!startMs) startMs = ctx.now();
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
        // With "Reduce motion" the sky and the lime cross-fade, quicker.
        skyTop.set(call ? 1 : 0, nowMs, reduce.matches ? FADE_MS : SKY_MS);
        syncDaggers(state, nowMs);
        syncSpikes(state);
        song = state.display === "main" && !call && state.nowPlaying ? state.nowPlaying : null;
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
        skyTop = tween(0);
        daggers = [];
        firstState = true;
        spikeShape.fill(0);
        song = fellMs = null;
        drawnDrip = "";
      },
    };
    return window.agentScreensaver.helpers.recoverWebGL(api, function () { return canvas; });
  });
})();
