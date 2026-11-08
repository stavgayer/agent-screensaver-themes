// The Favourite sky: a glossy pink heart-shaped face with shut eyes, low and
// centred in a blue sky, after the cover of the single. Everything is drawn in
// code by one WebGL 1 fragment shader on a canvas at half the screen's pixels.
//   rest, work, done: the resting sky, the eyes shut;
//   call: an agent waits: the eyes open and the sky goes to its deepest blue;
//   second display: the sky and the heart, eyes shut.
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
  // opens above it, so it sits low like on the cover. Sizes in vmin unless noted.
  var FRAME = {
    margin: 4, // above the clock
    clock: 14, // the time and the date
    gap: 2, // between blocks
    rise: 0.24, // of the heart's size: the daggers stand above its top edge
    spikes: 0.12, // of the heart's size: the spikes hang under it
    labelRow: 6.5, // one row of limit labels
    labelWidth: 150, // CSS px per limit label
    cards: 15, // the row of cards on narrow screens
    bottom: 3, // under everything
    maxHeart: 0.62, // of the smaller side
    narrow: 1.45, // width / height under which the cards go in a row
    gutter: 0.03, // of the width, around the side columns
  };

  function favouriteFrame(width, height, limitCount, cardCount) {
    var vmin = Math.min(width, height) / 100;
    var cardsRow = width / height < FRAME.narrow && cardCount > 0;
    var cardsBlock = cardsRow ? FRAME.gap + FRAME.cards : 0;
    var labelsBlock = function (rows) { return limitCount > 0 ? FRAME.gap + rows * FRAME.labelRow : 0; };
    var heartFor = function (rows) {
      var fixed = (FRAME.margin + FRAME.clock + FRAME.gap + labelsBlock(rows) + cardsBlock + FRAME.bottom) * vmin;
      return Math.max(0, Math.min(FRAME.maxHeart * 100 * vmin, (height - fixed) / (1 + FRAME.rise + FRAME.spikes)));
    };
    var labelRows = 1, size = heartFor(1);
    if (limitCount * FRAME.labelWidth > size) { labelRows = 2; size = heartFor(2); }
    // Placed from the bottom up.
    var labelsHeight = limitCount > 0 ? labelRows * FRAME.labelRow : 0;
    var labelsTop = height - (FRAME.bottom + cardsBlock + labelsHeight) * vmin;
    var spikesTop = labelsTop - (limitCount > 0 ? FRAME.gap * vmin : 0) - FRAME.spikes * size;
    var heart = { cx: width / 2, cy: spikesTop - size / 2, size: size };
    var gutter = FRAME.gutter * width, side = Math.max(0, heart.cx - size / 2 - 2 * gutter);
    return {
      heart: heart,
      clockTop: FRAME.margin * vmin,
      clockHeight: FRAME.clock * vmin,
      spikesTop: spikesTop,
      labelsTop: labelsTop,
      labelRows: labelRows,
      cardsRow: cardsRow,
      sideColumns: cardsRow ? null : { left: { x: gutter, w: side }, right: { x: width - gutter - side, w: side } },
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
  var BREATH_S = 8, BREATH = 0.015; // one breath every 8 s, ±1.5% of the size
  var SHEEN_S = 30, SHEEN_SLIDE_S = 5; // a sheen crosses the gloss in 5 s, every 30 s
  var DRIFT_VMIN = 0.6; // how far the picture drifts, about 5 px on a laptop
  var EYES_MS = 250, SKY_MS = 1200, FADE_MS = 400;

  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

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
  // layer drawn on the heart (eyes now; daggers, spikes and the drip later) works
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
    "const vec3 SKY1 = vec3(" + rgbOf(SKY[1]).join(", ") + ");",
    "const vec3 SKY2 = vec3(" + rgbOf(SKY[2]).join(", ") + ");",
    "const vec3 SKY3 = vec3(" + rgbOf(SKY[3]).join(", ") + ");",
    "const vec3 DEEP = vec3(" + rgbOf("#d34d68").join(", ") + ");",
    "const vec3 LIGHT = vec3(" + rgbOf("#eba6b3").join(", ") + ");",
    "const vec3 LID = vec3(0.36, 0.07, 0.16);",
    // The heart's distance field (after Inigo Quilez), scaled so its width fills the box.
    "const float HR = 0.07;              // rounding: a plump face, not a sharp card heart",
    "const float HK = 1.207 + 2.0 * HR;  // heart units per box side",
    "const float HMID = 0.552;           // the heart's vertical middle, in heart units",
    "float dot2(vec2 v) { return dot(v, v); }",
    "float heartUnits(vec2 q) {",
    "  q.x = sqrt(q.x * q.x + 0.0012); // a soft middle, so the shading has no fold there",
    "  if (q.y + q.x > 1.0) return sqrt(dot2(q - vec2(0.25, 0.75))) - 0.35355339;",
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
    "    col = mix(col, face, 1.0 - smoothstep(-px, px, d));",
    "  }",
    "  col += (hash(frag) - 0.5) / 255.0; // no banding in the long gradients",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  var UNIFORMS = ["uRes", "uHeart", "uSkyTop", "uEyes", "uFadeOnly", "uSheen"];

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
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function draw(nowMs) {
      if (!gl) return;
      // With "Reduce motion" the sky is drawn only when something changed, and while a fade runs.
      if (reduce.matches && !dirty && !eyes.moving(nowMs) && !skyTop.moving(nowMs)) return;
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
      },
    };
    return window.agentScreensaver.helpers.recoverWebGL(api, function () { return canvas; });
  });
})();
