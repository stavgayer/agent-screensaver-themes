// The bar: the time and the usage limits on cream labels. While tasks run, or
// an agent waits, the time stands in a label at the top left and the limits
// in a label at the top right; the two share one row, so they never meet: the
// limits wrap to a second line first. With no tasks the board shows the time in
// the centre of the field, so the time label steps away and the limits move to
// one label under the centre, across the lower rings, where the sleeve sets
// its title. Order, numbers and captions follow builtin.limit-rings: an old
// reading is dimmed and says its age, an estimate says "est.", and a window
// that reset since the reading is empty and says "Reset". Time comes from
// state.nowMs.
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

  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var MINUTE = 60000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;
  var DRIFT_S = 240;
  var WINDOW_ORDER = ["5h", "week", "plan"];
  var STALE_AFTER = { "5h": 30 * MINUTE, week: 6 * HOUR, plan: 6 * HOUR };
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var RADIUS = 19;
  var ARC = 2 * Math.PI * RADIUS;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var STYLE = [
    "@font-face { font-family: 'Key Display'; src: url('" + base + "fonts/Caprasimo.ttf') format('truetype'); font-weight: 400; }",
    "@font-face { font-family: 'Key Sans'; src: url('" + base + "fonts/AlegreyaSans-Medium.ttf') format('truetype'); font-weight: 500; }",
    ".skr { --ink: #3c190e; --muted: #74412b; --cream: #fcefd4; position: absolute; inset: 0; pointer-events: none; color: var(--ink);",
    "  font-family: 'Key Sans', 'Gill Sans', 'Helvetica Neue', sans-serif; font-weight: 500; font-variant-numeric: tabular-nums lining-nums; -webkit-font-smoothing: antialiased; }",
    ".skr .stage { position: absolute; inset: 0; }",
    ".skr[hidden] { display: none; }",
    ".skr .row { position: absolute; left: 4vw; right: 4vw; top: 4.2vh; display: flex; justify-content: space-between; align-items: flex-start; gap: 3vmin; }",
    ".skr .label { background: var(--cream); border-radius: 999px; box-shadow: 0 0.4vmin 1.8vmin rgba(58, 16, 6, 0.3); }",
    ".skr .when { flex: none; display: flex; align-items: baseline; gap: 1.6vmin; padding: 1.2vmin 2.6vmin 1.1vmin; white-space: nowrap; transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".skr .when .time { font-family: 'Key Display', 'Cooper Black', Georgia, serif; font-size: 3.8vmin; line-height: 1.05; }",
    ".skr .when .date { font-size: 2.2vmin; line-height: 1.2; color: var(--muted); }",
    ".skr .when.away { opacity: 0; }",
    ".skr .limits { --size: 4.4vmin; min-width: 0; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 1.4vmin 2.8vmin; padding: 1vmin 2.6vmin 1vmin 1.2vmin; }",
    ".skr .limits[hidden] { display: none; }",
    ".skr .limits.low { position: absolute; transform: translateX(-50%); justify-content: center; --size: 5vmin; padding: 1.3vmin 3.2vmin 1.3vmin 1.6vmin; max-width: 86vw; }",
    ".skr .item { display: flex; align-items: center; gap: calc(var(--size) * 0.28); white-space: nowrap; }",
    ".skr .item.stale { opacity: 0.6; }",
    ".skr .ring { position: relative; width: var(--size); height: var(--size); flex: none; }",
    ".skr svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".skr .track { fill: none; stroke: #ead2a8; stroke-width: 4.5; }",
    ".skr .arc { fill: none; stroke: var(--hue); stroke-width: 4.5; }",
    ".skr .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--size) * 0.27); font-weight: 500; line-height: 1.2; }",
    ".skr .caption { display: flex; flex-direction: column; gap: 0.3vmin; font-size: calc(var(--size) * 0.37); line-height: 1.2; }",
    ".skr .detail { font-size: calc(var(--size) * 0.31); color: var(--muted); line-height: 1.2; }",
  ].join("\n");

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function driftAt(nowMs, vmin) {
    if (reduce.matches) return { x: 0, y: 0 };
    var t = (nowMs / 1000 / DRIFT_S) * Math.PI;
    return { x: 1.0 * vmin * Math.sin(t), y: 0.45 * vmin * Math.sin(0.73 * t + 1) };
  }

  function displayName(source) {
    return source.charAt(0).toUpperCase() + source.slice(1);
  }

  function countdown(ms) {
    if (ms <= 0) return "Reset";
    var minutes = Math.floor(ms / MINUTE);
    if (minutes < 1) return "under 1m";
    if (minutes < 60) return minutes + "m";
    return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
  }

  // Local time, built by hand so it never depends on locale data.
  function resetLabel(resetsAtS, nowMs, short) {
    if (resetsAtS === undefined || resetsAtS === null) return "";
    var at = resetsAtS * 1000;
    var left = at - nowMs;
    if (left <= DAY) return countdown(left);
    var moment = new Date(at);
    var dayTime = WEEKDAYS[moment.getDay()] + " " + pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
    if (left <= 6 * DAY) return dayTime;
    var date = moment.getDate() + " " + MONTHS[moment.getMonth()];
    return short ? date : date + " " + dayTime.slice(4);
  }

  function shortAge(ms) {
    if (ms < HOUR) return Math.floor(ms / MINUTE) + "m";
    if (ms < DAY) return Math.floor(ms / HOUR) + "h";
    return Math.floor(ms / DAY) + "d";
  }

  function percentOf(used) {
    if (!Number.isFinite(used)) return 0;
    return Math.min(100, Math.max(0, Math.round(used)));
  }

  function view(limit, nowMs) {
    var shown = { hue: hueOf(limit.source).ink, name: displayName(limit.source) + " " + limit.window };
    if (limit.resets_at !== undefined && limit.resets_at !== null && nowMs >= limit.resets_at * 1000) {
      shown.stale = false;
      shown.percent = 0;
      shown.detail = "Reset";
      return shown;
    }
    var age = nowMs - limit.updated_at_ms;
    var more = [];
    shown.stale = age > STALE_AFTER[limit.window];
    if (shown.stale) more.push(shortAge(age) + " ago");
    if (limit.estimated === true) more.push("est.");
    shown.percent = percentOf(limit.used_percent);
    shown.detail = [resetLabel(limit.resets_at, nowMs, more.length > 0)].concat(more).filter(function (text) { return text !== ""; }).join(", ");
    return shown;
  }

  function order(limits, agentOrder) {
    function rank(source) {
      var known = agentOrder.indexOf(source);
      return known === -1 ? agentOrder.length : known;
    }
    return limits.slice().sort(function (a, b) {
      return rank(a.source) - rank(b.source) || a.source.localeCompare(b.source) || WINDOW_ORDER.indexOf(a.window) - WINDOW_ORDER.indexOf(b.window);
    });
  }

  function svgNode(tag, attributes) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    return node;
  }

  function text(className, value) {
    var node = document.createElement("div");
    node.className = className;
    node.textContent = value;
    return node;
  }

  function ring(shown) {
    var item = document.createElement("div");
    item.className = "item" + (shown.stale ? " stale" : "");
    item.style.setProperty("--hue", shown.hue);
    var holder = document.createElement("div");
    holder.className = "ring";
    var svg = svgNode("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    svg.append(
      svgNode("circle", { class: "track", cx: 24, cy: 24, r: RADIUS }),
      svgNode("circle", { class: "arc", cx: 24, cy: 24, r: RADIUS, "stroke-dasharray": ((ARC * shown.percent) / 100).toFixed(2) + " " + ARC.toFixed(2) }),
    );
    holder.append(svg, text("value", shown.percent + "%"));
    var caption = document.createElement("div");
    caption.className = "caption";
    caption.append(text("name", shown.name), text("detail", shown.detail === "" ? " " : shown.detail));
    item.append(holder, caption);
    return item;
  }

  window.agentScreensaver.register(function () {
    var box, stage, row, when, time, date, limits, lastKey = "", low, cancelTick, cancelDrift;

    function tick(nowMs) {
      var moment = new Date(nowMs);
      var t = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
      var d = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      if (time.textContent !== t) time.textContent = t;
      if (date.textContent !== d) date.textContent = d;
    }

    // At rest the limits stand under the centre of the field, across the lower rings.
    function place() {
      if (!box) return;
      if (!low) {
        if (limits.parentElement !== row) row.appendChild(limits);
        limits.style.left = limits.style.top = "";
        return;
      }
      if (limits.parentElement !== stage) stage.appendChild(limits);
      var g = geometry(window.innerWidth, window.innerHeight, "rest", 0);
      limits.style.left = g.cx + "px";
      limits.style.top = Math.max(g.cy + g.r[1] + 4 * g.vmin, 0.8 * g.h) + "px";
    }

    return {
      mount: function (root, ctx) {
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "skr";
        stage = document.createElement("div");
        stage.className = "stage";
        row = document.createElement("div");
        row.className = "row";
        when = document.createElement("div");
        when.className = "label when away";
        time = text("time", "");
        date = text("date", "");
        when.append(time, date);
        limits = document.createElement("div");
        limits.className = "label limits";
        row.append(when, limits);
        stage.appendChild(row);
        box.appendChild(stage);
        root.append(style, box);
        tick(ctx.now());
        cancelTick = ctx.requestFrame(function () { tick(ctx.now()); }, 1);
        var sway = function () {
          var d = driftAt(Date.now(), Math.min(window.innerWidth, window.innerHeight) / 100);
          stage.style.transform = "translate(" + d.x.toFixed(2) + "px, " + d.y.toFixed(2) + "px)";
        };
        sway();
        if (!reduce.matches) cancelDrift = ctx.requestFrame(sway, 1);
        window.addEventListener("resize", place);
        lastKey = "";
        low = undefined;
      },
      update: function (state) {
        if (!box) return;
        var resting = moodOf(state) === "rest";
        when.classList.toggle("away", resting);
        // The second display shows the field and the time only.
        box.hidden = state.display !== "main";
        limits.hidden = state.limits.length === 0;
        if (low !== undefined && resting !== low && !limits.hidden) {
          // It changes place with the mood: it fades into the new one.
          var from = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: (resting ? "translateX(-50%) " : "") + "translateY(1.6vmin)" };
          var to = { opacity: 1, transform: resting ? "translateX(-50%)" : "none" };
          limits.animate([from, to], { duration: 420, delay: 140, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
        }
        low = resting;
        limits.classList.toggle("low", resting);
        place();
        var shown = order(state.limits, state.agentOrder || []).map(function (limit) { return view(limit, state.nowMs); });
        var key = JSON.stringify(shown);
        if (key === lastKey) return;
        lastKey = key;
        limits.replaceChildren.apply(limits, shown.map(ring));
      },
      unmount: function () {
        window.removeEventListener("resize", place);
        if (cancelTick) cancelTick();
        if (cancelDrift) cancelDrift();
        cancelTick = cancelDrift = undefined;
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = stage = row = when = time = date = limits = undefined;
      },
    };
  });
})();
