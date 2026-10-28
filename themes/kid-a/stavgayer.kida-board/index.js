// The Kid A board: the statement, the task cards and the approval card in one
// component, because they answer the same mood as the range behind them.
//
// The statement stands in the black sky above the range in tall, cut capitals.
// Each task card stands in the conduits right under its agent's ridge, framed by
// nested lines that follow its corners, the inner one in the agent's colour. Its
// state word is a pixel stamp in a box. A finished card turns to snow as its
// ridge freezes. When an agent waits, the sky turns its colour (the ground does
// that), a pixel stamp says NEEDS YOU, and one wide card says what it wants to run.
//
// Only the fields the state gives are shown, so privacy mode keeps working.
// Motion is transform and opacity only, with CSS animations and the Web
// Animations API; the stamps step in at 12 frames a second through the
// runtime's frame clock, then stop. With reduced motion nothing travels or
// steps: cards and words fade in place.
(function () {
  var MINUTE = 60000;
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");

  var OWN = { claude: "#ff4b33", codex: "#4fc8ff", cursor: "#ffb21f" };
  var SPARE = ["#ff6fae", "#5fe0b4", "#b9a4ff", "#ffd36a", "#7fa8ff", "#ff8a4c"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var STYLE = [
    "@font-face { font-family: 'KA Type'; src: url('" + base + "fonts/Archivo.ttf') format('truetype'); font-weight: 100 900; font-stretch: 62% 125%; }",
    "@font-face { font-family: 'KA Mono'; src: url('" + base + "fonts/MartianMono.ttf') format('truetype'); font-weight: 100 800; font-stretch: 75% 112.5%; }",
    ".kab { --plate: #0c0f13; --snow: #e9edef; --ink: #0b0e12; --text: #eef1f3; --muted: #a3adb8; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);",
    "  position: absolute; inset: 0; overflow: hidden; color: var(--text); font-family: 'KA Type', 'Helvetica Neue', sans-serif;",
    "  font-weight: 600; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }",
    // the same slow drift as the range, so each card stays under its peak
    ".kab .stage { position: absolute; inset: 0; will-change: transform; animation: kab-drift 240s ease-in-out infinite alternate; }",
    "@keyframes kab-drift { from { transform: translate(-1.4vmin, -0.6vmin); } to { transform: translate(1.4vmin, 0.6vmin); } }",
    // the display voice: Archivo at its narrowest and heaviest, in capitals
    ".kab .cut { font-stretch: 62%; font-weight: 860; text-transform: uppercase; }",
    ".kab .hero { position: absolute; left: 5vmin; top: 14vh; white-space: nowrap; }",
    ".kab .hero canvas.print { display: block; margin-top: 1.2vmin; }",
    ".kab .sub { position: absolute; left: 5.4vmin; top: calc(14vh + 18.6vmin); white-space: nowrap; font-size: 3.4vmin; font-weight: 520;",
    "  font-stretch: 88%; color: #c9d1d9; letter-spacing: 0; }",
    ".kab .sub[hidden] { display: none; }",
    ".kab .hero .bigstamp { display: block; height: 17vmin; margin-top: 0.6vmin; }",
    ".kab .hero .bigstamp[hidden], .kab .hero canvas.print[hidden] { display: none; }",
    ".kab.time .hero { top: 19vh; }",
    ".kab.time .hero canvas.print { margin-top: 2.4vmin; }",
    ".kab.time .sub { top: calc(19vh + 33vmin); font-size: 4.6vmin; }",
    // task cards, one under each peak
    ".kab .cards { position: absolute; left: 6.5vmin; right: 6.5vmin; bottom: 6vmin; display: flex; align-items: flex-end; gap: 4.6vmin;",
    "  transition: opacity 260ms var(--ease-out), transform 260ms var(--ease-out); }",
    ".kab.call .cards { opacity: 0; transform: translateY(4vmin); }",
    ".kab .card { flex: none; width: min(30vw, calc((100vw - 13vmin - (var(--n) - 1) * 4.6vmin) / var(--n))); min-width: 0; box-sizing: border-box;",
    "  background: var(--plate); color: var(--text); border-radius: 1.6vmin; padding: 2.4vmin 2.8vmin 2.8vmin;",
    // the conduit frame: nested lines that follow the card's rounded corners, the inner one in the agent's colour
    "  --c1: var(--hue); --c2: #b2aee2; --c3: #7f92d4;",
    "  box-shadow: 0 0 0 0.32vmin var(--plate), 0 0 0 0.58vmin var(--c1), 0 0 0 0.92vmin var(--plate), 0 0 0 1.16vmin var(--c2),",
    "    0 0 0 1.5vmin var(--plate), 0 0 0 1.74vmin var(--c3), 0 0 0 2.1vmin rgba(4, 5, 7, 0.85);",
    "  transition: background-color 700ms var(--ease-out), color 700ms var(--ease-out); }",
    ".kab .head { display: flex; justify-content: space-between; align-items: baseline; gap: 1.6vmin; font-size: 2.5vmin; line-height: 1.15; white-space: nowrap; }",
    ".kab .head .agent { color: var(--hue); overflow: hidden; text-overflow: ellipsis; font-weight: 650; }",
    ".kab .head .since { flex: none; color: var(--muted); font-weight: 500; }",
    // the state word is a pixel stamp in a box, drawn into a tiny canvas and shown with its pixels hard
    ".kab .card .state { display: block; margin-top: 1.6vmin; height: 7.4vmin; overflow: hidden; }",
    ".kab canvas.stamp { display: block; height: 100%; width: auto; image-rendering: pixelated; image-rendering: crisp-edges; }",
    ".kab .card .what { margin-top: 1.6vmin; font-size: 2.9vmin; font-weight: 600; line-height: 1.18; font-stretch: 92%;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }",
    ".kab .card .where { margin-top: 1vmin; font-size: 2.2vmin; font-weight: 500; line-height: 1.2; color: var(--muted); white-space: nowrap;",
    "  overflow: hidden; text-overflow: ellipsis; }",
    ".kab .card .what[hidden], .kab .card .where[hidden] { display: none; }",
    // a finished card turns to snow, as its peak freezes
    ".kab .card.done { background: var(--snow); color: var(--ink); --c1: var(--snow); --c2: #dfe5ee; --c3: #aebad0; }",
    ".kab .card.done .head .agent { color: var(--ink); }",
    ".kab .card.done .head .since, .kab .card.done .where { color: #46505b; }",
    // the approval card
    ".kab .call { position: absolute; left: 6.5vmin; right: 6.5vmin; bottom: 6vmin; box-sizing: border-box; background: var(--plate); color: var(--text);",
    "  border-radius: 2.2vmin; padding: 3.6vmin 5vmin 4.4vmin 5vmin; opacity: 0; visibility: hidden;",
    "  box-shadow: 0 0 0 0.4vmin var(--plate), 0 0 0 0.8vmin var(--hue), 0 0 0 1.25vmin var(--plate), 0 0 0 1.6vmin var(--hue),",
    "    0 0 0 2.05vmin var(--plate), 0 0 0 2.35vmin #eef1f3, 0 0 0 2.8vmin rgba(4, 5, 7, 0.85); }",
    ".kab.call .call { opacity: 1; visibility: visible; }",
    ".kab .call .top { display: flex; align-items: baseline; gap: 3vmin; font-size: 4.4vmin; line-height: 1.1; white-space: nowrap; }",
    ".kab .call .top .agent { color: var(--hue); font-weight: 720; overflow: hidden; text-overflow: ellipsis; }",
    ".kab .call .top .since { color: var(--text); font-weight: 500; flex: none; }",
    ".kab .call .top .more { margin-left: auto; flex: none; color: var(--muted); font-weight: 500; font-size: 3vmin; }",
    ".kab .call .body { margin-top: 3.4vmin; display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 3.4vmin; row-gap: 2.6vmin; align-items: baseline; }",
    ".kab .call .label { font-size: 2.5vmin; font-weight: 500; color: var(--muted); }",
    // The command keeps one line: it steps down in size to fit the card. Only a
    // command too long even at the smallest step breaks, at spaces, into up to four lines.
    ".kab .call .command { font-family: 'KA Mono', ui-monospace, Menlo, monospace; font-stretch: 75%; font-size: 5.2vmin; font-weight: 640; line-height: 1.2;",
    "  letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; min-width: 0; }",
    ".kab .call .command.long { white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }",
    ".kab .call .note { font-size: 4.2vmin; font-weight: 640; line-height: 1.15; }",
    ".kab .call .project { font-size: 3.4vmin; font-weight: 620; line-height: 1.15; overflow-wrap: anywhere; }",
    "@media (prefers-reduced-motion: reduce) { .kab .stage { animation: none; } .kab .cards { transition-property: opacity; } .kab.call .cards { transform: none; } }",
  ].join("\n");

    var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

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
    return { easing: ok ? curve : "cubic-bezier(0.23, 1, 0.32, 1)", duration: Math.round(t * 1000) };
  }
  var SETTLE = spring(210, 20); // overshoots a hair, then settles
  var LAND = spring(420, 36); // lands firmly, almost no bounce
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function duration(ms) {
    var minutes = Math.floor(ms / MINUTE);
    if (minutes < 1) return "under 1 min";
    if (minutes < 60) return minutes + " min";
    var rest = minutes % 60;
    return Math.floor(minutes / 60) + " hr" + (rest === 0 ? "" : " " + rest + " min");
  }

  function agentName(source, agents) {
    var agent = Object.prototype.hasOwnProperty.call(agents, source) ? agents[source] : undefined;
    return (agent && agent.name) || source.charAt(0).toUpperCase() + source.slice(1);
  }

  function taskState(card, nowMs) {
    switch (card.kind) {
      case "running":
        return { tone: "working", word: "Working", since: duration(nowMs - card.started_at_ms) };
      case "finished":
        var ago = nowMs - card.updated_at_ms;
        return { tone: "done", word: "Done", since: ago < MINUTE ? "just now" : duration(ago) + " ago" };
      case "no_activity":
        return { tone: "working", word: "Quiet", since: "for " + duration(nowMs - card.updated_at_ms) };
      case "approval":
        return { tone: "working", word: "Waiting", since: duration(nowMs - (card.approval_since_ms !== undefined ? card.approval_since_ms : card.updated_at_ms)) };
      default:
        return { tone: "working", word: "Check", since: "" };
    }
  }

  // Oldest approval first; one without a start time sorts last, ties keep their order.
  function approvals(cards) {
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

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  // A word set in the display face at a few pixels high, in a one-pixel box: shown
  // large with no smoothing, it reads as a bitmap label. Each pixel is on when the
  // letter covers at least half of it, measured on a copy drawn eight times larger,
  // so strokes stay even. Steps below the full height are the glitch on the way in.
  var SUPER = 8;
  var scratch = document.createElement("canvas");

  function stampFont(px) {
    return "ultra-condensed 760 " + px + "px 'KA Type', sans-serif";
  }

  function paintStamp(canvas, text, colour, rows) {
    var paint = canvas.getContext("2d"), big = scratch.getContext("2d");
    if (!paint || !big) return;
    var pad = Math.max(2, Math.round(rows * 0.22));
    big.font = stampFont(rows * SUPER);
    if ("fontStretch" in big) big.fontStretch = "ultra-condensed";
    var width = Math.ceil(big.measureText(text).width / SUPER) + 2 * pad + 2;
    var height = Math.round(rows * 0.76) + 2 * pad + 2;
    scratch.width = width * SUPER;
    scratch.height = height * SUPER;
    big.font = stampFont(rows * SUPER);
    if ("fontStretch" in big) big.fontStretch = "ultra-condensed";
    big.fillStyle = "#fff";
    big.fillText(text, (pad + 1) * SUPER, (height - pad - 1) * SUPER);
    var src = big.getImageData(0, 0, scratch.width, scratch.height).data;
    canvas.width = width;
    canvas.height = height;
    var image = paint.createImageData(width, height), out = image.data;
    var rgb = [parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16)];
    var row = scratch.width * 4, area = SUPER * SUPER * 255;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var sum = 0;
        for (var j = 0; j < SUPER; j++) {
          var at = (y * SUPER + j) * row + x * SUPER * 4 + 3;
          for (var i = 0; i < SUPER; i++) sum += src[at + i * 4];
        }
        var box = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        var k = (y * width + x) * 4;
        out[k] = rgb[0]; out[k + 1] = rgb[1]; out[k + 2] = rgb[2];
        out[k + 3] = box || sum / area >= 0.5 ? 255 : 0;
      }
    }
    paint.putImageData(image, 0, 0);
  }

  // The big words, printed and scanned: the display face drawn at full resolution,
  // then its edges eaten by putty-sized blotches, small pits knocked out of the
  // strokes, a soot tone rubbed across, and two thin rows dragged sideways like a
  // scan. The noise is seeded by the words, so the same words always look the same.
  function hashOf(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function noiseOf(seed) {
    function cell(x, y) {
      var h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    return function (x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var a = cell(ix, iy), b = cell(ix + 1, iy), c = cell(ix, iy + 1), d = cell(ix + 1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  function paintPrint(canvas, text, sizeVmin) {
    var paint = canvas.getContext("2d");
    if (!paint) return;
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    var vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
    var px = Math.max(8, Math.round(sizeVmin * vmin * ratio));
    var font = "ultra-condensed 860 " + px + "px 'KA Type', sans-serif";
    paint.font = font;
    if ("fontStretch" in paint) paint.fontStretch = "ultra-condensed";
    var metrics = paint.measureText(text);
    var pad = Math.round(px * 0.04);
    var ascent = Math.ceil(metrics.actualBoundingBoxAscent || px * 0.74), descent = Math.ceil(metrics.actualBoundingBoxDescent || 0);
    var width = Math.ceil(metrics.width) + 2 * pad, height = ascent + descent + 2 * pad;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width / ratio + "px";
    canvas.style.height = height / ratio + "px";
    paint.font = font;
    if ("fontStretch" in paint) paint.fontStretch = "ultra-condensed";
    paint.fillStyle = "#fff";
    paint.fillText(text, pad, pad + ascent);
    var image = paint.getImageData(0, 0, width, height), data = image.data;
    var copy = new Uint8ClampedArray(data.length);
    copy.set(data);
    var seed = hashOf(text), noise = noiseOf(seed), grit = noiseOf(seed + 97), tone = noiseOf(seed + 211);
    var blotch = 5.5 * ratio, fine = 1.5 * ratio, pit = 2.1 * ratio, soot = 34 * ratio;
    // two scan rows, a few pixels tall, dragged sideways
    var rows = [0, 1].map(function (i) {
      var r = noiseOf(seed + 401 + i);
      return { from: Math.floor(r(0.5, 0.5) * height * 0.8 + height * 0.1), size: Math.round((2 + 3 * r(3.5, 1.5)) * ratio),
        shift: Math.round((4 + 10 * r(7.5, 2.5)) * ratio) * (i ? -1 : 1) };
    });
    for (var y = 0; y < height; y++) {
      var shift = 0;
      rows.forEach(function (r) { if (y >= r.from && y < r.from + r.size) shift = r.shift; });
      for (var x = 0; x < width; x++) {
        var sx = Math.min(width - 1, Math.max(0, x - shift));
        var a = copy[(y * width + sx) * 4 + 3] / 255;
        var k = (y * width + x) * 4;
        if (a <= 0) { data[k + 3] = 0; continue; }
        var v = a + (noise(x / blotch, y / blotch) - 0.5) * 0.5 + (grit(x / fine, y / fine) - 0.5) * 0.22;
        var on = Math.min(1, Math.max(0, (v - 0.42) / 0.16));
        if (a > 0.95 && grit(x / pit + 31, y / pit + 17) > 0.9) on *= 0.12;
        var lum = 0.82 + 0.18 * tone(x / soot, y / soot);
        data[k] = 238 * lum; data[k + 1] = 241 * lum; data[k + 2] = 244 * lum; data[k + 3] = 255 * on;
      }
    }
    paint.putImageData(image, 0, 0);
  }

  window.agentScreensaver.register(function () {
    var box, stage, hero, heroWord, heroStamp, sub, cardsBox, call, lastState, frameCtx;
    var stamps = new Set(); // every live stamp, painted again once the face has loaded
    var show = "agents", mood = "", heroKey = "", callKey = "";
    var cards = new Map();

    // ---- the statement --------------------------------------------------

    function statement(state, waiting, tasks) {
      var moment = new Date(state.nowMs);
      var time = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
      var date = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      if (show === "time" || (tasks.length === 0 && waiting.length === 0)) return { time: true, word: time, sub: date };
      if (waiting.length > 0) return { time: false, word: "Needs you", sub: "", stamp: hueOf(waiting[0].source) };
      var working = tasks.filter(function (card) { return card.kind !== "finished"; }).length;
      if (working === 0) return { time: false, word: "All done", sub: tasks.length === 1 ? "The task is finished" : tasks.length + " tasks finished" };
      return { time: false, word: working + " working", sub: "" };
    }

    function drawHero(said) {
      var key = said.word + "|" + said.sub + "|" + (said.stamp || "");
      if (key === heroKey) return;
      var first = heroKey === "";
      var wordChanged = heroWord.printText !== said.word;
      heroKey = key;
      box.classList.toggle("time", said.time);
      printHero(said.word, said.time);
      setText(sub, said.sub);
      heroWord.hidden = !!said.stamp;
      heroStamp.hidden = !said.stamp;
      if (said.stamp) {
        heroStamp.stampText = said.word.toUpperCase();
        heroStamp.stampColour = said.stamp;
        paintStamp(heroStamp, heroStamp.stampText, said.stamp, 16);
        if (!first) glitch(heroStamp, heroStamp.stampText, said.stamp, 16);
      }
      sub.hidden = said.sub === "";
      // A new word rises into place; the clock's minute change is not news.
      if (!first && wordChanged && !said.time && !said.stamp) rise(heroWord, 0);
      if (!first && !sub.hidden && wordChanged) rise(sub, 80);
    }

    function printHero(word, isTime) {
      var size = isTime ? 36 : 19;
      if (heroWord.printText === word && heroWord.printSize === size) return;
      heroWord.printText = word;
      heroWord.printSize = size;
      paintPrint(heroWord, word.toUpperCase(), size);
    }

    function reprint() {
      if (!heroWord || !heroWord.printText) return;
      var word = heroWord.printText;
      heroWord.printText = "";
      printHero(word, heroWord.printSize === 36);
    }

    function onResize() {
      fitCommand();
      reprint();
    }

    function rise(node, delay) {
      var from = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateY(28%)" };
      var to = reduce.matches ? { opacity: 1 } : { opacity: 1, transform: "translateY(0)" };
      node.animate([from, to], { duration: 420, delay: delay, easing: EASE_OUT, fill: "backwards" });
    }

    // ---- task cards -----------------------------------------------------

    function buildCard(card) {
      var node = el("div", "card");
      var head = el("div", "head");
      var parts = { agent: el("span", "agent"), since: el("span", "since"), state: el("div", "state"),
        what: el("div", "what"), where: el("div", "where") };
      head.append(parts.agent, parts.since);
      parts.stamp = el("canvas", "stamp");
      parts.state.appendChild(parts.stamp);
      parts.what.dir = "auto";
      parts.where.dir = "auto";
      node.append(head, parts.state, parts.what, parts.where);
      node.style.setProperty("--hue", hueOf(card.source));
      stamps.add(parts.stamp);
      return { node: node, parts: parts, tone: "", word: "" };
    }

    function fillCard(entry, card, state) {
      var said = taskState(card, state.nowMs);
      var parts = entry.parts;
      setText(parts.agent, agentName(card.source, state.agents));
      setText(parts.since, said.since);
      var heading = card.name || card.title || "";
      setText(parts.what, heading);
      parts.what.hidden = heading === "";
      var where = card.project && card.project !== heading ? card.project : "";
      if (where !== "" && card.branch) where += " on " + card.branch;
      setText(parts.where, where);
      parts.where.hidden = where === "";
      var changed = entry.word !== "" && (entry.word !== said.word || entry.tone !== said.tone);
      if (entry.tone !== said.tone) entry.node.classList.toggle("done", said.tone === "done");
      if (entry.word !== said.word || entry.tone !== said.tone) {
        entry.stampText = said.word.toUpperCase();
        entry.stampColour = said.tone === "done" ? "#0b0e12" : hueOf(card.source);
        parts.stamp.stampText = entry.stampText;
        parts.stamp.stampColour = entry.stampColour;
        paintStamp(parts.stamp, entry.stampText, entry.stampColour, 13);
        if (changed) glitch(parts.stamp, entry.stampText, entry.stampColour, 13);
      }
      entry.tone = said.tone;
      entry.word = said.word;
      if (changed) stamp(entry);
    }

    // The change happens on the card: it takes a small press and the new word rises in.
    function stamp(entry) {
      if (reduce.matches) return;
      entry.node.animate([{ transform: "scale(1.035)" }, { transform: "scale(1)" }], { duration: SETTLE.duration, easing: SETTLE.easing });
    }

    function enter(entry, order) {
      if (reduce.matches) {
        entry.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: order * 60, easing: "ease-out", fill: "backwards" });
        return;
      }
      entry.node.animate(
        [{ opacity: 0, transform: "translateY(9vmin) scale(0.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: SETTLE.duration, delay: order * 70, easing: SETTLE.easing, fill: "backwards" },
      );
    }

    function leave(entry) {
      var to = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateY(4vmin) scale(0.97)" };
      entry.node.classList.add("leaving");
      var motion = entry.node.animate([{}, to], { duration: 200, easing: EASE_OUT, fill: "forwards" });
      motion.onfinish = function () { entry.node.remove(); };
      stamps.delete(entry.parts.stamp);
    }

    // A stamp arrives the way a bitmap loads on a slow screen: coarse, then finer, in a
    // few hard steps at 12 frames a second, with a small sideways jolt. Then it holds still.
    function glitch(canvas, text, colour, rows) {
      if (reduce.matches || !frameCtx) return;
      var steps = [Math.max(4, Math.round(rows * 0.32)), Math.round(rows * 0.55), Math.round(rows * 0.8), rows];
      var shifts = ["translateX(-1.2vmin)", "translateX(0.8vmin)", "translateX(-0.3vmin)", "none"];
      var at = 0;
      if (canvas.cancelGlitch) canvas.cancelGlitch();
      var cancel = frameCtx.requestFrame(function () {
        if (at >= steps.length) { cancel(); canvas.cancelGlitch = undefined; return; }
        paintStamp(canvas, text, colour, steps[at]);
        canvas.style.transform = shifts[at];
        at++;
      }, 12);
      canvas.cancelGlitch = cancel;
    }

    function drawCards(tasks, state) {
      var wanted = new Set();
      var fresh = 0;
      cardsBox.style.setProperty("--n", String(Math.max(1, tasks.length)));
      tasks.forEach(function (card, index) {
        var key = card.source + "\u0000" + card.session;
        wanted.add(key);
        var entry = cards.get(key);
        var isNew = entry === undefined;
        if (isNew) {
          entry = buildCard(card);
          cards.set(key, entry);
        }
        fillCard(entry, card, state);
        var live = Array.prototype.filter.call(cardsBox.children, function (node) { return !node.classList.contains("leaving"); });
        var at = live[index];
        if (at !== entry.node) cardsBox.insertBefore(entry.node, at || null);
        if (isNew) enter(entry, fresh++);
      });
      cards.forEach(function (entry, key) {
        if (wanted.has(key)) return;
        cards.delete(key);
        leave(entry);
      });
    }

    // ---- the approval card ----------------------------------------------

    function drawCall(first, more, state) {
      var since = first.approval_since_ms !== undefined ? first.approval_since_ms : first.updated_at_ms;
      var waited = state.nowMs - since;
      var key = JSON.stringify([first.source, first.session, Math.floor(waited / MINUTE), more, first.request || "", first.project || ""]);
      if (key === callKey) return;
      callKey = key;
      call.style.setProperty("--hue", hueOf(first.source));
      var top = el("div", "top");
      top.append(el("span", "agent", agentName(first.source, state.agents)), el("span", "since", "waiting " + duration(waited)));
      if (more > 0) top.appendChild(el("span", "more", "+" + more + " more waiting"));
      var body = el("div", "body");
      if (first.request) {
        var command = el("div", "command", first.request);
        command.dir = "auto";
        body.append(el("div", "label", "Wants to run"), command);
      } else {
        body.append(el("div", "label", "Wants"), el("div", "note", "Look at the terminal"));
      }
      if (first.project) {
        var project = el("div", "project", first.project);
        project.dir = "auto";
        body.append(el("div", "label", "Project"), project);
      }
      call.replaceChildren(top, body);
      fitCommand();
    }

    var STEPS = [5.2, 4.6, 4.1, 3.6, 3.2, 2.9];
    var monoAsked = false;
    function fitCommand() {
      var command = call && call.querySelector(".command");
      if (!command) return;
      // Measure in the real face: wait for it once if it is not loaded yet.
      if (!monoAsked && document.fonts && !document.fonts.check("640 40px 'KA Mono'")) {
        monoAsked = true;
        document.fonts.load("640 40px 'KA Mono'").then(fitCommand, function () {});
      }
      command.classList.remove("long");
      for (var i = 0; i < STEPS.length; i++) {
        command.style.fontSize = STEPS[i] + "vmin";
        if (command.scrollWidth <= command.clientWidth + 1) return;
      }
      command.classList.add("long");
    }

    function land() {
      if (reduce.matches) {
        call.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
        return;
      }
      // The card rises into the conduits a beat after the sky starts to turn.
      call.animate(
        [{ opacity: 0, transform: "translateY(12vmin)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: LAND.duration, delay: 200, easing: LAND.easing, fill: "backwards" },
      );
    }

    // ---- the whole board ------------------------------------------------

    function draw(state) {
      if (!box) return;
      var waiting = show === "time" || state.display !== "main" ? [] : approvals(state.cards);
      // The row keeps every card, the waiting one too, so nothing jumps when the call ends.
      var tasks = show === "time" ? [] : state.cards;
      var busy = state.cards.some(function (card) { return card.kind !== "finished"; });
      var next = waiting.length > 0 ? "call" : busy ? "work" : "rest";
      if (next !== mood) {
        box.classList.remove("work", "call", "rest");
        box.classList.add(next);
      }
      if (waiting.length > 0) drawCall(waiting[0], waiting.length - 1, state);
      else callKey = "";
      if (next === "call" && mood !== "call" && mood !== "") land();
      mood = next;
      drawHero(statement(state, waiting, tasks));
      drawCards(tasks, state);
    }

    function setShow(options) {
      show = options.show === "time" ? "time" : "agents";
    }

    return {
      mount: function (root, ctx) {
        // Fill the region (the whole screen), not the fade-in wrapper the runtime puts around us.
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = el("style");
        style.textContent = STYLE;
        box = el("div", "kab");
        stage = el("div", "stage");
        hero = el("div", "hero cut");
        heroWord = el("canvas", "print");
        heroStamp = el("canvas", "stamp bigstamp");
        heroStamp.hidden = true;
        stamps.add(heroStamp);
        hero.append(heroWord, heroStamp);
        frameCtx = ctx;
        // The stamps are drawn with the display face: paint them again once it has loaded.
        if (document.fonts && document.fonts.load) {
          document.fonts.load("820 20px 'KA Type'").then(function () {
            reprint();
            stamps.forEach(function (canvas) {
              if (canvas.stampText) paintStamp(canvas, canvas.stampText, canvas.stampColour, canvas === heroStamp ? 16 : 13);
            });
          }, function () {});
        }
        sub = el("div", "sub");
        sub.hidden = true;
        cardsBox = el("div", "cards");
        call = el("div", "call");
        stage.append(hero, sub, cardsBox, call);
        box.appendChild(stage);
        root.append(style, box);
        setShow(ctx.options);
        window.addEventListener("resize", onResize);
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      setOptions: function (options) {
        setShow(options);
        heroKey = "";
        if (lastState) draw(lastState);
      },
      unmount: function () {
        window.removeEventListener("resize", onResize);
        if (box && box.parentElement) box.parentElement.replaceChildren();
        stamps.forEach(function (canvas) { if (canvas.cancelGlitch) canvas.cancelGlitch(); });
        stamps.clear();
        box = stage = hero = heroWord = heroStamp = sub = cardsBox = call = lastState = frameCtx = undefined;
        cards.clear();
        mood = heroKey = callKey = "";
      },
    };
  });
})();
