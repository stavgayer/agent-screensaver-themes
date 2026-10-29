// The ring board: the words on the field. The sleeve keeps its words in its
// pale centre and on the warm rings around it, so here the big words stand in
// the glowing centre and everything else sits on cream labels:
//   rest: the time, large, in the centre where the sleeve has its small
//         portrait, the date under it;
//   work: the count in the centre; one cream card for each task in the column
//         right of the field, joined by a leader to that task's ring: the agent
//         in its colour, the time, the task and the project;
//   done: "All done" in the centre, the cards say done;
//   call: the centre has opened wide. NEEDS YOU in it, then the agent, how
//         long it has waited, the exact command and the project.
//
// Every text is measured against the disc it stands in, not the screen. Only
// the fields the state gives are shown, so privacy mode keeps working. Motion
// is transform and opacity only, through the Web Animations API, with springs
// sampled into CSS linear() curves. With reduced motion things fade in place.
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

  var MINUTE = 60000;
  var DRIFT_S = 240;
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var DISPLAY = "'Key Display', 'Cooper Black', Georgia, serif";
  var TEXT = "'Key Sans', 'Gill Sans', 'Helvetica Neue', sans-serif";
  var MONO = "'Key Mono', 'Courier New', monospace";

  var STYLE = [
    "@font-face { font-family: 'Key Display'; src: url('" + base + "fonts/Caprasimo.ttf') format('truetype'); font-weight: 400; }",
    "@font-face { font-family: 'Key Sans'; src: url('" + base + "fonts/AlegreyaSans-Medium.ttf') format('truetype'); font-weight: 500; }",
    "@font-face { font-family: 'Key Sans'; src: url('" + base + "fonts/AlegreyaSans-Bold.ttf') format('truetype'); font-weight: 700; }",
    "@font-face { font-family: 'Key Mono'; src: url('" + base + "fonts/CourierPrime-Bold.ttf') format('truetype'); font-weight: 700; }",
    ".skb { --ink: #3c190e; --muted: #74412b; --cream: #fcefd4; position: absolute; inset: 0; overflow: hidden; color: var(--ink);",
    "  font-family: " + TEXT + "; font-weight: 500; font-variant-numeric: tabular-nums lining-nums; -webkit-font-smoothing: antialiased; }",
    ".skb .stage { position: absolute; inset: 0; }",
    ".skb [hidden] { display: none !important; }",
    // the words in the centre disc; each mood has its own layer
    ".skb .centre { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }",
    ".skb .layer { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; visibility: hidden; }",
    ".skb .layer.on { visibility: visible; }",
    ".skb .display { font-family: " + DISPLAY + "; font-weight: 400; line-height: 1; white-space: nowrap; letter-spacing: -0.01em; }",
    ".skb .rest .time { font-size: 12vmin; line-height: 1.02; }",
    ".td { display: inline-block; width: 0.66em; text-align: center; }",
    ".tc { display: inline-block; width: 0.32em; text-align: center; }",
    ".skb .rest .date { margin-top: 1.2vmin; font-size: 2.7vmin; font-weight: 700; line-height: 1.25; color: var(--muted); white-space: nowrap; }",
    ".skb .work .count { font-size: 15vmin; line-height: 0.95; }",
    ".skb .work .word { margin-top: 0.2vmin; font-size: 4.4vmin; line-height: 1.1; }",
    ".skb .work .sub { margin-top: 1vmin; font-size: 2.5vmin; font-weight: 700; line-height: 1.25; color: var(--muted); white-space: nowrap; }",
    // the call, in the open centre
    ".skb .call .big { font-size: 12vmin; line-height: 1; }",
    ".skb .call .who { margin-top: 2.6vmin; display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; column-gap: 2vmin; row-gap: 0.2vmin;",
    "  font-size: 4.2vmin; font-weight: 700; line-height: 1.2; }",
    ".skb .call .who .agent { color: var(--hue); white-space: nowrap; }",
    ".skb .call .who .since { white-space: nowrap; }",
    ".skb .call .label { margin-top: 2.4vmin; font-size: 2.5vmin; font-weight: 700; line-height: 1.25; color: var(--muted); }",
    // The command keeps one line and steps down in size to fit the disc. Only a
    // command too long even at the smallest step breaks at spaces, up to three lines.
    ".skb .call .command { max-width: 100%; margin-top: 0.6vmin; font-family: " + MONO + "; font-weight: 700; font-size: 4.4vmin; line-height: 1.24; letter-spacing: -0.01em;",
    "  white-space: nowrap; overflow: hidden; }",
    ".skb .call .command.long { white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }",
    ".skb .call .command .w { white-space: nowrap; }",
    ".skb .call .note { margin-top: 0.6vmin; font-size: 4.6vmin; font-weight: 700; line-height: 1.2; }",
    ".skb .call .project { max-width: 100%; margin-top: 2.2vmin; font-size: 3.2vmin; font-weight: 700; line-height: 1.22; overflow-wrap: anywhere; }",
    ".skb .call .project .in { color: var(--muted); font-weight: 500; }",
    ".skb .call .more { margin-top: 1.6vmin; font-size: 2.4vmin; font-weight: 700; line-height: 1.25; color: var(--muted); }",
    // a card is a cream label at the end of its ring's leader
    ".skb .cards { position: absolute; inset: 0; }",
    ".skb .card { position: absolute; box-sizing: border-box; display: flex; align-items: center; gap: 2vmin; padding: 0 3vmin 0 1.8vmin;",
    "  background: var(--cream); border-radius: 999px; box-shadow: 0 0.5vmin 2.2vmin rgba(58, 16, 6, 0.32); }",
    ".skb .card .mark { flex: none; display: block; }",
    ".skb .card .words { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.35vmin; container-type: inline-size; }",
    ".skb .card .head { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1.6vmin; row-gap: 0; font-size: min(2.5vmin, 6.6cqi); font-weight: 700; line-height: 1.25; }",
    // the name keeps its whole width; when the time does not fit beside it, the time goes under it
    ".skb .card .agent { color: var(--hue); white-space: nowrap; }",
    ".skb .card .since { color: var(--muted); white-space: nowrap; }",
    ".skb .card .what { font-size: min(3.2vmin, 8.4cqi); font-weight: 700; line-height: 1.22; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".skb .card.roomy .what { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }",
    ".skb .card .where { font-size: min(2.2vmin, 5.8cqi); line-height: 1.25; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".skb .card.roomy.snug .what { font-size: min(2.8vmin, 7.4cqi); }",
    ".skb .card.tight .words { gap: 0.2vmin; }",
    ".skb .card.tight .what { font-size: min(2.7vmin, 7.2cqi); }",
    ".skb .card.tighter .where { display: none; }",
    ".skb .card.done .agent { color: var(--muted); }",
    ".skb .card.done .what { color: #5e3524; }",
    ".skb .card.done .mark { filter: saturate(0.25); opacity: 0.75; }",
    ".skb .more { position: absolute; padding: 0.4vmin 1.8vmin; border-radius: 999px; background: var(--cream); font-size: 2.2vmin; font-weight: 700; line-height: 1.25; color: var(--muted); }",
  ].join("\n");

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
  var SETTLE = spring(200, 21);
  var LAND = spring(150, 15);
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

  // The same sway as the field, from the same clock, so each card stays at the end of its leader.
  function driftAt(nowMs, vmin) {
    if (reduce.matches) return { x: 0, y: 0 };
    var t = (nowMs / 1000 / DRIFT_S) * Math.PI;
    return { x: 1.0 * vmin * Math.sin(t), y: 0.45 * vmin * Math.sin(0.73 * t + 1) };
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

  function compact(ms) {
    var minutes = Math.floor(ms / MINUTE);
    if (minutes < 1) return "now";
    if (minutes < 60) return minutes + " min";
    return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
  }

  function agentName(source, agents) {
    var agent = agents && has(agents, source) ? agents[source] : undefined;
    return (agent && agent.name) || source.charAt(0).toUpperCase() + source.slice(1);
  }

  function since(card, nowMs) {
    switch (card.kind) {
      case "running":
        var ran = nowMs - card.started_at_ms;
        return { done: false, text: ran < MINUTE ? "under 1 min" : compact(ran) };
      case "finished":
        var ago = compact(nowMs - card.updated_at_ms);
        return { done: true, text: ago === "now" ? "done now" : "done " + ago + " ago" };
      case "no_activity":
        return { done: false, text: "quiet " + compact(nowMs - card.updated_at_ms) };
      case "approval":
        var waited = compact(nowMs - (card.approval_since_ms !== undefined ? card.approval_since_ms : card.updated_at_ms));
        return { done: false, text: waited === "now" ? "waiting" : "waiting " + waited };
      default:
        return { done: false, text: "" };
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The display face has digits of different widths, so the time is set one
  // character per fixed cell: changing digits never shift the others.
  function setClock(node, text) {
    if (node.getAttribute("data-t") === text) return;
    node.setAttribute("data-t", text);
    node.textContent = "";
    for (var i = 0; i < text.length; i++) {
      var cell = document.createElement("span");
      cell.className = text[i] === ":" ? "tc" : "td";
      cell.textContent = text[i];
      node.appendChild(cell);
    }
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  var SVG = "http://www.w3.org/2000/svg";
  // The agent's mark on its card: three rings of its colour, a small sleeve of its own.
  function markOf(hue) {
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 40 40");
    svg.setAttribute("aria-hidden", "true");
    [[19, hue.ink], [14, hue.ring], [8.5, "#fde7a8"], [4.5, "#fff8e8"]].forEach(function (ring) {
      var circle = document.createElementNS(SVG, "circle");
      circle.setAttribute("cx", "20");
      circle.setAttribute("cy", "20");
      circle.setAttribute("r", String(ring[0]));
      circle.setAttribute("fill", ring[1]);
      svg.appendChild(circle);
    });
    return svg;
  }

  window.agentScreensaver.register(function () {
    var cancelDrift, box, stage, centre, layers = {}, parts = {}, cardsBox, more, lastState;
    var show = "agents", mood = "", sayKey = "", callKey = "", restKey = "";
    var cards = new Map();

    function vmin() {
      return Math.min(window.innerWidth, window.innerHeight) / 100;
    }

    function rise(node, delay, distance) {
      if (reduce.matches) {
        node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: delay, easing: "ease-out", fill: "backwards" });
        return;
      }
      node.animate([{ opacity: 0, transform: "translateY(" + (distance || 3) + "vmin) scale(0.97)" }, { opacity: 1, transform: "none" }],
        { duration: SETTLE.duration, delay: delay, easing: SETTLE.easing, fill: "backwards" });
    }

    function fade(node, shown, delay) {
      node.animate([{ opacity: shown ? 0 : 1 }, { opacity: shown ? 1 : 0 }], { duration: shown ? 320 : 180, delay: delay || 0, easing: EASE_OUT, fill: shown ? "backwards" : "forwards" });
    }

    // Shrinks a line of display type until it fits the width it has.
    function fitWidth(node, maxVmin, width) {
      node.style.fontSize = maxVmin + "vmin";
      var have = node.scrollWidth;
      if (have > width && have > 0) node.style.fontSize = (maxVmin * width / have * 0.98).toFixed(3) + "vmin";
    }

    // ---- the centre ----------------------------------------------------

    function placeCentre(next, n) {
      var g = geometry(window.innerWidth, window.innerHeight, next, n);
      var r = g.r[0];
      // The words stand in a square that fits the disc, a hair above its middle so they look centred.
      var side = next === "call" ? 1.56 * r : 1.62 * r;
      centre.style.left = g.cx - side / 2 + "px";
      centre.style.top = g.cy - side / 2 - (next === "call" ? 0.02 * r : 0.03 * r) + "px";
      centre.style.width = centre.style.height = side + "px";
      return { side: side, r: r };
    }

    function fitCentre() {
      if (!lastState) return;
      var next = show === "time" ? "rest" : moodOf(lastState);
      var n = next === "work" || next === "done" ? Math.min(lastState.cards.length, MAX_CARDS) : 0;
      var at = placeCentre(next, n);
      if (next === "rest") {
        fitWidth(parts.time, 12.5, at.side * 0.94);
        fitWidth(parts.date, 2.8, at.side * 0.86);
      } else if (next === "call") {
        fitWidth(parts.big, 12, at.side * 0.96);
        fitCommand(at.side);
      } else {
        fitWidth(parts.count, 15, at.side * 0.8);
        fitWidth(parts.word, parts.word.classList.contains("whole") ? 8.5 : 4.4, at.side * 0.9);
        fitWidth(parts.sub, 2.5, at.side * 0.8);
      }
    }

    function drawRest(nowMs) {
      var moment = new Date(nowMs);
      var key = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes()) + "|" + WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      if (key === restKey) return false;
      restKey = key;
      setClock(parts.time, key.split("|")[0]);
      setText(parts.date, key.split("|")[1]);
      return true;
    }

    function drawSay(tasks) {
      var working = tasks.filter(function (card) { return card.kind !== "finished"; }).length;
      var finished = tasks.length - working;
      var count = working > 0 ? String(working) : "";
      var word = working > 0 ? "working" : "All done";
      var line = working > 0 ? (finished > 0 ? finished + " done" : "") : tasks.length === 1 ? "the task is finished" : tasks.length + " tasks finished";
      var key = count + "|" + word + "|" + line;
      if (key === sayKey) return false;
      var first = sayKey === "";
      sayKey = key;
      setText(parts.count, count);
      parts.count.hidden = count === "";
      setText(parts.word, word);
      parts.word.classList.toggle("whole", count === "");
      setText(parts.sub, line);
      parts.sub.hidden = line === "";
      if (!first && mood === "work") {
        rise(parts.count, 0, 2.4);
        rise(parts.word, 60, 1.6);
        if (!parts.sub.hidden) rise(parts.sub, 110, 1.2);
      }
      return true;
    }

    // ---- the call ------------------------------------------------------

    var STEPS = [4.4, 4.0, 3.6, 3.2, 2.9, 2.6];
    var monoAsked = false;
    function fitCommand(side) {
      var command = parts.callBody && parts.callBody.querySelector(".command");
      if (!command) return;
      if (!monoAsked && document.fonts && !document.fonts.check("700 40px 'Key Mono'")) {
        monoAsked = true;
        document.fonts.load("700 40px 'Key Mono'").then(fitCentre, function () {});
      }
      command.style.maxWidth = side * 0.98 + "px";
      command.classList.remove("long");
      for (var i = 0; i < STEPS.length; i++) {
        command.style.fontSize = STEPS[i] + "vmin";
        if (command.scrollWidth <= command.clientWidth + 1) return;
      }
      // Too long for one line even small: break it at spaces, at a size that still reads across a room.
      command.classList.add("long");
      command.style.fontSize = "3vmin";
    }

    function drawCall(first, others, state) {
      var at = first.approval_since_ms !== undefined ? first.approval_since_ms : first.updated_at_ms;
      var waited = state.nowMs - at;
      var key = JSON.stringify([first.source, first.session, Math.floor(waited / MINUTE), others, first.request || "", first.project || ""]);
      if (key === callKey) return { changed: false, isNew: false };
      var isNew = callKey === "" || JSON.parse(callKey)[1] !== first.session;
      callKey = key;
      layers.call.style.setProperty("--hue", hueOf(first.source).ink);
      var who = el("div", "who");
      who.append(el("span", "agent", agentName(first.source, state.agents)), el("span", "since", "waiting " + duration(waited)));
      var list = [who];
      if (first.request) {
        // Each word of the command is kept whole, so a long one breaks only at spaces,
        // never after a dash inside a flag.
        var command = el("div", "command");
        first.request.split(/( +)/).forEach(function (part) {
          if (part === "") return;
          if (/^ +$/.test(part) || part.length > 24) command.appendChild(document.createTextNode(part));
          else command.appendChild(el("span", "w", part));
        });
        command.dir = "auto";
        list.push(el("div", "label", "Wants to run"), command);
      } else {
        list.push(el("div", "note", "Look at the terminal"));
      }
      if (first.project) {
        var project = el("div", "project");
        project.dir = "auto";
        project.append(el("span", "in", "in "), document.createTextNode(first.project));
        list.push(project);
      }
      if (others > 0) list.push(el("div", "more", "+" + others + " more waiting"));
      parts.callBody.replaceChildren.apply(parts.callBody, list);
      return { changed: true, isNew: isNew };
    }

    // The one big move: the centre opens and a wave runs out (the field does that);
    // NEEDS YOU lands in it a beat later, then who, what and where.
    function land() {
      var nodes = [parts.big].concat(Array.prototype.slice.call(parts.callBody.children));
      nodes.forEach(function (node, i) {
        if (reduce.matches) {
          node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 80 + i * 40, easing: "ease-out", fill: "backwards" });
          return;
        }
        var first = i === 0;
        node.animate([{ opacity: 0, transform: first ? "scale(0.86)" : "translateY(2.4vmin)" }, { opacity: 1, transform: "none" }],
          { duration: first ? LAND.duration : SETTLE.duration, delay: first ? 260 : 360 + i * 55, easing: first ? LAND.easing : SETTLE.easing, fill: "backwards" });
      });
    }

    // ---- task cards ----------------------------------------------------

    function buildCard(entry) {
      var node = el("div", "card");
      var bits = { mark: markOf(entry.hue), words: el("div", "words"), head: el("div", "head"), agent: el("span", "agent"), since: el("span", "since"), what: el("div", "what"), where: el("div", "where") };
      bits.mark.classList.add("mark");
      bits.what.dir = "auto";
      bits.where.dir = "auto";
      bits.head.append(bits.agent, bits.since);
      bits.words.append(bits.head, bits.what, bits.where);
      node.append(bits.mark, bits.words);
      node.style.setProperty("--hue", entry.hue.ink);
      return { node: node, parts: bits, done: undefined };
    }

    function fillCard(entry, card, state) {
      var said = since(card, state.nowMs);
      var bits = entry.parts;
      setText(bits.agent, agentName(card.source, state.agents));
      setText(bits.since, said.text);
      var heading = card.name || card.title || "";
      setText(bits.what, heading);
      bits.what.hidden = heading === "";
      var where = card.project && card.project !== heading ? card.project : "";
      if (where !== "" && card.branch) where += " on " + card.branch;
      setText(bits.where, where);
      bits.where.hidden = where === "";
      var changed = entry.done !== undefined && entry.done !== said.done;
      entry.node.classList.toggle("done", said.done);
      entry.done = said.done;
      // As its ring settles back into the palette, the card settles a hair and its time rises in.
      if (changed && !reduce.matches) {
        entry.node.animate([{ transform: "translateX(0.8vmin)" }, { transform: "translateX(0)" }], { duration: SETTLE.duration, easing: SETTLE.easing });
        bits.since.animate([{ opacity: 0, transform: "translateY(1.2vmin)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 360, easing: EASE_OUT });
      } else if (changed) {
        bits.since.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      }
    }

    function enter(entry, order) {
      if (reduce.matches) {
        entry.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: order * 60, easing: "ease-out", fill: "backwards" });
        return;
      }
      // The ring moves into place first (the field does that), then its card lands at the end of its leader.
      entry.node.animate([{ opacity: 0, transform: "translateX(3.2vmin) scale(0.97)" }, { opacity: 1, transform: "none" }],
        { duration: SETTLE.duration, delay: 240 + order * 60, easing: SETTLE.easing, fill: "backwards" });
    }

    function leave(entry) {
      var to = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateX(2vmin)" };
      var motion = entry.node.animate([{}, to], { duration: 200, easing: EASE_OUT, fill: "forwards" });
      motion.onfinish = function () { entry.node.remove(); };
    }

    function placeCards() {
      var shown = Math.min(cards.size, MAX_CARDS);
      var g = geometry(window.innerWidth, window.innerHeight, "work", shown);
      var i = 0;
      cards.forEach(function (entry) {
        var slot = g.slots[i++];
        if (!slot) { entry.node.style.display = "none"; return; }
        entry.node.style.display = "";
        entry.node.style.left = g.colL + "px";
        entry.node.style.width = g.colR - g.colL + "px";
        entry.node.style.top = slot.top + "px";
        entry.node.style.height = slot.height + "px";
        var markSize = Math.min(0.62 * slot.height, 8.4 * g.vmin);
        entry.parts.mark.style.width = entry.parts.mark.style.height = markSize + "px";
        entry.node.style.paddingLeft = Math.max(1.2 * g.vmin, (slot.height - markSize) / 2) + "px";
        entry.node.classList.toggle("roomy", slot.height >= 0.135 * g.h);
        entry.node.classList.toggle("snug", slot.height < 0.155 * g.h);
        entry.node.classList.toggle("tight", slot.height < 0.12 * g.h);
        entry.node.classList.toggle("tighter", slot.height < 0.085 * g.h);
      });
      var last = g.slots[g.slots.length - 1];
      more.hidden = cards.size <= MAX_CARDS || !last;
      if (!more.hidden) {
        more.textContent = "+" + (cards.size - MAX_CARDS) + " more";
        more.style.left = g.colL + 3 * g.vmin + "px";
        more.style.top = last.top + last.height + 0.6 * g.vmin + "px";
      }
    }

    function drawCards(tasks, state) {
      var wanted = new Set(), fresh = 0, order = [];
      ordered(tasks).forEach(function (item) {
        var card = item.card;
        var key = card.source + "\u0000" + card.session;
        wanted.add(key);
        var entry = cards.get(key);
        var isNew = entry === undefined;
        if (isNew) {
          entry = buildCard(item);
          cardsBox.append(entry.node);
        }
        fillCard(entry, card, state);
        order.push([key, entry]);
        if (isNew) enter(entry, fresh++);
      });
      cards.forEach(function (entry, key) {
        if (!wanted.has(key)) leave(entry);
      });
      cards = new Map(order);
      placeCards();
    }

    // ---- the whole board -----------------------------------------------

    var current = "";
    function showLayer(name, animate) {
      current = name;
      ["rest", "work", "call"].forEach(function (key) {
        var layer = layers[key];
        if (key === name) {
          layer.getAnimations().forEach(function (motion) { motion.cancel(); });
          layer.classList.add("on");
          return;
        }
        if (!layer.classList.contains("on")) return;
        if (!animate) { layer.classList.remove("on"); return; }
        // the old words leave fast, then their layer hides
        var out = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE_OUT, fill: "forwards" });
        out.onfinish = function () { if (current !== key) layer.classList.remove("on"); out.cancel(); };
      });
    }

    function draw(state) {
      if (!box) return;
      var next = show === "time" ? "rest" : moodOf(state);
      var tasks = next === "work" || next === "done" ? state.cards : [];
      var layerName = next === "done" ? "work" : next;
      var restChanged = drawRest(state.nowMs);
      var sayChanged = next === "work" || next === "done" ? drawSay(tasks) : false;
      var callNew = false, callChanged = false;
      if (next === "call") {
        var waiting = waitingOf(state.cards);
        var drawn = drawCall(waiting[0], waiting.length - 1, state);
        callNew = drawn.isNew;
        callChanged = drawn.changed;
      } else {
        callKey = "";
      }
      var moved = next !== mood;
      var wasLayer = mood === "done" ? "work" : mood;
      if (moved) {
        // The centre moves with the mood, so the old words go at once instead of fading in the wrong place.
        showLayer(layerName, false);
        if (mood !== "" && wasLayer !== layerName) {
          if (layerName === "rest") { rise(parts.time, 120, 2.4); rise(parts.date, 200, 1.6); }
          if (layerName === "work") { rise(parts.count, 260, 2.4); rise(parts.word, 320, 1.6); if (!parts.sub.hidden) rise(parts.sub, 370, 1.2); }
        }
        var cardsShown = next === "work" || next === "done";
        if (mood !== "" && (mood === "work" || mood === "done") !== cardsShown) fade(cardsBox, cardsShown, cardsShown ? 200 : 0);
        else if (mood === "") cardsBox.style.opacity = cardsShown ? "" : "0";
        if (cardsShown) cardsBox.style.opacity = "";
      }
      if (next === "call" && (moved || callNew)) land();
      mood = next;
      drawCards(tasks, state);
      // Measuring forces a layout, so it runs only when the words changed.
      if (moved || restChanged || sayChanged || callChanged) fitCentre();
    }

    function setShow(options) {
      show = options.show === "time" ? "time" : "agents";
    }

    var onResize = function () {
      placeCards();
      fitCentre();
    };

    return {
      mount: function (root, ctx) {
        // Fill the whole screen, not the fade-in wrapper the runtime puts around us.
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = el("style");
        style.textContent = STYLE;
        box = el("div", "skb");
        stage = el("div", "stage");
        centre = el("div", "centre");
        layers.rest = el("div", "layer rest");
        layers.work = el("div", "layer work");
        layers.call = el("div", "layer call");
        parts.time = el("div", "time display");
        parts.date = el("div", "date");
        layers.rest.append(parts.time, parts.date);
        parts.count = el("div", "count display");
        parts.word = el("div", "word display");
        parts.sub = el("div", "sub");
        parts.sub.hidden = true;
        layers.work.append(parts.count, parts.word, parts.sub);
        parts.big = el("div", "big display", "Needs you");
        parts.callBody = el("div", "body");
        parts.callBody.style.cssText = "display:flex;flex-direction:column;align-items:center;max-width:100%";
        layers.call.append(parts.big, parts.callBody);
        centre.append(layers.rest, layers.work, layers.call);
        cardsBox = el("div", "cards");
        more = el("div", "more");
        more.hidden = true;
        cardsBox.appendChild(more);
        stage.append(cardsBox, centre);
        box.appendChild(stage);
        root.append(style, box);
        setShow(ctx.options);
        var sway = function () {
          var d = driftAt(Date.now(), vmin());
          stage.style.transform = "translate(" + d.x.toFixed(2) + "px, " + d.y.toFixed(2) + "px)";
        };
        sway();
        if (!reduce.matches) cancelDrift = ctx.requestFrame(sway, 1);
        if (document.fonts && document.fonts.load) {
          Promise.all([document.fonts.load("400 40px 'Key Display'"), document.fonts.load("700 40px 'Key Sans'"), document.fonts.load("500 40px 'Key Sans'")]).then(onResize, function () {});
        }
        window.addEventListener("resize", onResize);
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      setOptions: function (options) {
        setShow(options);
        if (lastState) draw(lastState);
      },
      unmount: function () {
        window.removeEventListener("resize", onResize);
        if (cancelDrift) cancelDrift();
        cancelDrift = undefined;
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = stage = centre = cardsBox = more = lastState = undefined;
        layers = {};
        parts = {};
        cards.clear();
        mood = sayKey = callKey = restKey = "";
      },
    };
  });
})();
