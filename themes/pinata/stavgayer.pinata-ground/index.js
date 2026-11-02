// The Piñata background: a zebra-fur frame around a square window, after the
// 2014 cover, drawn in a WebGL shader. Measured from the cover: the frame is
// 20% of the side on every edge, the window 60%; the stripes run mostly up and
// down, about one light and one dark stripe per fifth of the side, 47% light;
// light fur #f0ece5, dark fur #161614. The window holds no photo: only the
// soft light of a park out of focus, in the photo's colours (canopy #3e4035,
// shade #252519, path #6f6353, leaves #99b79f, sky #90a2b0, sun #f2dab6).
// On screen the frame is 15vmin on every edge, the same number the board uses.
// Half the pixels, 15 frames a second, a low-power context, a slow drift of the
// fur against burn-in, a still picture with "Reduce motion" on, and a fresh
// canvas after a lost context.
(function () {
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  // Each agent owns one colour, the same as on the board.
  var OWN = { claude: "#d9895b", codex: "#93b89c", cursor: "#9fb2c4" };
  var SPARE = ["#e3c58d", "#c7a17d", "#b7a9c9"];
  var BORDER = 15; // vmin, the frame on every edge

  var VERTEX = "#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
  var FRAGMENT = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uDrift; uniform float uDim; uniform float uCall; uniform vec3 uHue; uniform float uCalm; uniform float uBorder;",
    "out vec4 outColor;",
    "float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    "float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }",
    "void main() {",
    "  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);",
    "  float vmin = min(uRes.x, uRes.y) / 100.0;",
    "  vec2 u = px / vmin;",
    "  vec2 size = uRes / vmin;",
    "  vec2 lo = vec2(uBorder), hi = size - vec2(uBorder);",
    "  vec2 c = (lo + hi) * 0.5, e = (hi - lo) * 0.5;",
    "  vec2 q = abs(u - c) - e;",
    "  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);",
    "  vec3 col;",
    "  if (sd > 0.0) {",
    // Fur: stripes that run up and down, bent by slow noise, with ragged hairy edges.
    "    vec2 z = u + uDrift;",
    "    float warp = fbm(z * vec2(0.04, 0.025)) * 7.5 + sin(z.y * 0.07 + fbm(z * 0.05) * 3.0) * 1.8;",
    "    float s = sin(z.x * 0.349 + z.y * 0.03 + warp);",
    "    float fur = (noise(z * vec2(3.0, 0.8)) - 0.5) * 0.35 + (noise(z * 9.0) - 0.5) * 0.15;",
    "    float light = smoothstep(-0.14, 0.1, s + fur - 0.05);",
    "    vec3 lc = mix(vec3(0.941, 0.925, 0.898), uHue, uCall * 0.6);",
    "    vec3 dc = vec3(0.086, 0.086, 0.078);",
    "    float grain = (noise(z * vec2(14.0, 4.0)) - 0.5) * 0.08;",
    "    col = mix(dc, lc, light) + grain * mix(0.35, 1.0, light);",
    "    col *= 1.0 - 0.45 * exp(-sd * 1.4);", // a soft shadow where the fur meets the window
    "  } else {",
    // The window: a park out of focus.
    "    vec2 w = (u - lo) / (hi - lo);",
    "    col = mix(vec3(0.243, 0.251, 0.208), vec3(0.145, 0.145, 0.098), smoothstep(0.0, 0.55, w.y));",
    "    col = mix(col, vec3(0.435, 0.388, 0.325), smoothstep(0.55, 1.0, w.y));",
    "    for (int i = 0; i < 12; i++) {",
    "      float fi = float(i);",
    "      vec2 at = lo + vec2(hash(vec2(fi, 1.0)), hash(vec2(fi, 7.0)) * 0.8) * (hi - lo);",
    "      at += vec2(sin(uTime * 0.021 + fi * 1.7), cos(uTime * 0.017 + fi)) * 3.0;",
    "      float r = 3.0 + hash(vec2(fi, 3.0)) * 7.0;",
    "      float d = length(u - at);",
    "      float glow = smoothstep(r, r * 0.8, d) * 0.45 + smoothstep(r * 1.5, r * 0.2, d) * 0.2;",
    "      int k = i - (i / 3) * 3;",
    "      vec3 bc = k == 0 ? vec3(0.6, 0.718, 0.624) : (k == 1 ? vec3(0.565, 0.635, 0.69) : vec3(0.949, 0.855, 0.714));",
    "      col += bc * glow * 0.3;",
    "    }",
    "    float grey = dot(col, vec3(0.333));",
    "    col = mix(col, vec3(grey * 1.03, grey, grey * 0.95), uCalm * 0.7);",
    "    col *= (1.0 - uDim) * (1.0 - 0.25 * length(w - 0.5));",
    "    col = mix(col, vec3(0.025), uCall * 0.9);",
    "  }",
    "  outColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  function rgb(hex) {
    var v = parseInt(hex.slice(1), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  // What the picture should be in each state: how dark the window is, how far
  // the call has taken over, how calm the colours are.
  function targetOf(state) {
    var cards = state.display === "main" ? state.cards : [];
    var waiting = cards.filter(function (card) { return card.kind === "approval"; })[0];
    if (waiting) return { dim: 0.6, call: 1, calm: 0, hue: rgb(hueOf(waiting.source)) };
    if (cards.length === 0) return { dim: 0.3, call: 0, calm: 0, hue: null };
    var busy = cards.some(function (card) { return card.kind !== "finished"; });
    return busy ? { dim: 0.45, call: 0, calm: 0, hue: null } : { dim: 0.4, call: 0, calm: 1, hue: null };
  }

  // Rebuilds the background on a fresh canvas after a lost WebGL context, with
  // the last state; the listener comes off before every stop.
  function recovering(api, surfaceOf) {
    var root, ctx, state, canvas, timer;
    function attach() { canvas = surfaceOf(); if (canvas) canvas.addEventListener("webglcontextlost", lost); }
    function detach() { if (canvas) canvas.removeEventListener("webglcontextlost", lost); canvas = undefined; }
    function lost(event) {
      event.preventDefault();
      if (timer !== undefined) return;
      timer = setTimeout(function () {
        timer = undefined;
        var last = state;
        detach(); api.stop(); api.start(root, ctx); attach();
        if (last) api.update(last);
      }, 400);
    }
    return {
      start: function (r, c) { root = r; ctx = c; api.start(r, c); attach(); },
      update: function (s) { state = s; api.update(s); },
      stop: function () { clearTimeout(timer); timer = undefined; detach(); api.stop(); root = ctx = state = undefined; },
    };
  }

  window.agentScreensaver.register(function () {
    var canvas, gl, program, where = {}, cancelFrame, now, scale = 0.5;
    var shown = { dim: 0.3, call: 0, calm: 0, hue: [0.94, 0.93, 0.9] };
    var target = { dim: 0.3, call: 0, calm: 0, hue: null };
    var last = 0;

    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader did not compile");
      return shader;
    }

    function fit() {
      if (!canvas) return;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
      if (reduce.matches) draw();
    }

    // Eases the shown values toward the state's, about a second for each change.
    function ease(nowMs) {
      var step = last ? Math.min(1, Math.max(0, (nowMs - last) / 900)) : 1;
      last = nowMs;
      if (reduce.matches) step = 1;
      shown.dim += (target.dim - shown.dim) * step;
      shown.call += (target.call - shown.call) * step;
      shown.calm += (target.calm - shown.calm) * step;
      if (target.hue) shown.hue = shown.hue.map(function (v, i) { return v + (target.hue[i] - v) * (target.call ? 1 : step); });
    }

    // The frame callback's argument is the animation-frame clock, not ctx.now()'s
    // wall clock, so every draw reads ctx.now() itself and the two never mix.
    function draw() {
      if (!gl || gl.isContextLost()) return;
      var nowMs = now();
      ease(nowMs);
      var t = reduce.matches ? 0 : nowMs / 1000;
      // The fur drifts about 3vmin on a 12-minute loop, so no pixel stays lit in one place.
      var drift = reduce.matches ? [0, 0] : [Math.sin(nowMs / 720000 * 2 * Math.PI) * 3, Math.cos(nowMs / 900000 * 2 * Math.PI) * 2];
      gl.useProgram(program);
      gl.uniform2f(where.uRes, canvas.width, canvas.height);
      gl.uniform1f(where.uTime, t);
      gl.uniform2f(where.uDrift, drift[0], drift[1]);
      gl.uniform1f(where.uDim, shown.dim);
      gl.uniform1f(where.uCall, shown.call);
      gl.uniform1f(where.uCalm, shown.calm);
      gl.uniform1f(where.uBorder, BORDER);
      gl.uniform3f(where.uHue, shown.hue[0], shown.hue[1], shown.hue[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var api = {
      start: function (root, ctx) {
        now = function () { return ctx.now(); };
        var wanted = Number(ctx.options.scale);
        scale = Number.isFinite(wanted) ? Math.min(1, Math.max(0.25, wanted)) : 0.5;
        canvas = document.createElement("canvas");
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;background:#161614";
        root.appendChild(canvas);
        gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
        if (!gl) return; // no WebGL: the dark fur colour of the canvas stays
        program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
        gl.bindAttribLocation(program, 0, "p");
        gl.linkProgram(program);
        ["uRes", "uTime", "uDrift", "uDim", "uCall", "uHue", "uCalm", "uBorder"].forEach(function (name) { where[name] = gl.getUniformLocation(program, name); });
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle over the screen
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        last = 0;
        fit();
        window.addEventListener("resize", fit);
        draw();
        var fps = Number(ctx.options.fps);
        if (!reduce.matches) cancelFrame = ctx.requestFrame(draw, Number.isFinite(fps) ? Math.min(30, Math.max(1, fps)) : 15);
      },
      update: function (state) {
        target = targetOf(state);
        if (reduce.matches) draw();
      },
      stop: function () {
        if (cancelFrame) cancelFrame();
        window.removeEventListener("resize", fit);
        if (gl && !gl.isContextLost()) {
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext(); // free the GPU now, not at the next collection
        }
        if (canvas) canvas.remove();
        canvas = gl = program = cancelFrame = undefined;
        where = {};
      },
    };

    return recovering(api, function () { return canvas; });
  });
})();
