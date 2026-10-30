// The usage limits as rings: a faint track and a thin arc in the agent's
// colour of the spectrum, the percent inside, a two-line caption beside it.
// While tasks run they stand in one row in the top right corner, clear of the
// light. With no tasks they stand under the spectrum, under the date, larger,
// two to a row. Order, numbers and captions follow builtin.limit-rings: an old
// reading is dimmed and says its age, an estimate says "est.", and a window
// that reset since the reading is empty and says "Reset". Time comes from
// state.nowMs.
// The song that plays (state.nowPlaying, agent-screensaver 0.4.0 and later) is
// set like one more ring: a thin ring that fills as the song plays, the song,
// then its artist. While tasks run it stands in the top row, centred between
// the clock and the limits; with no tasks, in the empty corner under the
// prism, where the count stands while tasks run. It steps away while an agent
// waits for you.
(function () {
  // ---- shared with the board and the rings: keep these in step ----
  var MAX_CARDS = 7;
  // The six bands, top to bottom, in their print colours. Text gets a lighter tint so it reads on black.
  var BANDS = [
    { band: "#d2242e", text: "#ff6a5c" },
    { band: "#e17c26", text: "#f39a4c" },
    { band: "#f9dd00", text: "#f9dd00" },
    { band: "#57a243", text: "#82c86b" },
    { band: "#009ad1", text: "#3cb8ee" },
    { band: "#6e5f96", text: "#a99ad8" },
  ];
  var OWN = {
    claude: { rank: 0, band: "#d2242e", text: "#ff6a5c" },
    cursor: { rank: 2.5, band: "#b4c61c", text: "#cddc3c" },
    codex: { rank: 4, band: "#009ad1", text: "#3cb8ee" },
  };
  var SPARE = [1, 2, 3, 5]; // orange, yellow, green, violet

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function hueOf(source) {
    if (has(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    var at = SPARE[Math.abs(hash) % SPARE.length];
    return { rank: at, band: BANDS[at].band, text: BANDS[at].text };
  }

  // The cards in the order of the spectrum, red at the top; ties keep their order.
  function ordered(cards) {
    return cards
      .map(function (card, index) { return { card: card, index: index, hue: hueOf(card.source) }; })
      .sort(function (a, b) { return a.hue.rank - b.hue.rank || a.index - b.index; });
  }

  // The picture in screen px. The prism, the beam and the bands keep the
  // proportions of the 1973 sleeve on a square as tall as the screen, set a
  // little left of the middle; the beam and the bands run on to the edges.
  function geometry(w, h, n) {
    var k = h / 900, ox = 0.38 * w - 450 * k;
    var g = { w: w, h: h, k: k, vmin: Math.min(w, h) / 100, side: 280 * k };
    function at(x, y) { return [ox + x * k, y * k]; }
    g.A = at(450, 223);
    g.L = at(312, 467);
    g.R = at(592, 467);
    g.E = at(388, 335); // where the beam enters the left face
    g.beamSlope = -98 / 388;
    g.face = function (u) { return [g.R[0] + (g.A[0] - g.R[0]) * u, g.R[1] + (g.A[1] - g.R[1]) * u]; };
    g.uTop = 0.642; // the top of the red, on the right face, from its foot (0) to the apex (1)
    g.uBot = 0.406; // the foot of the violet
    g.slope = function (f) { return 0.153 + 0.095 * f; }; // the bands fan a little as they fall
    var mid = g.face(0.524);
    g.mid = mid;
    g.lineAt = function (x) { return mid[1] + (x - mid[0]) * 0.2; }; // the middle of the spectrum
    g.colL = 0.64 * w;
    g.colR = 0.955 * w;
    g.callL = 0.56 * w;
    var shown = Math.min(n, MAX_CARDS), top = 0.14 * h, bottom = 0.95 * h, gap = 1.2 * g.vmin;
    var slot = shown ? Math.min(0.16 * h, (bottom - top - (shown - 1) * gap) / shown) : 0;
    var total = shown * slot + Math.max(0, shown - 1) * gap;
    var centre = Math.min(bottom - total / 2, Math.max(top + total / 2, g.lineAt(g.colL)));
    g.slots = [];
    for (var i = 0; i < shown; i++) {
      var y = centre - total / 2 + i * (slot + gap);
      g.slots.push({ top: y, height: slot, mid: y + slot / 2 });
    }
    return g;
  }
  // ---- end of the shared part ----

  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var MINUTE = 60000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;
  var WINDOW_ORDER = ["5h", "week", "plan"];
  var STALE_AFTER = { "5h": 30 * MINUTE, week: 6 * HOUR, plan: 6 * HOUR };
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var RADIUS = 20;
  var ARC = 2 * Math.PI * RADIUS;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var STYLE = [
    "@font-face { font-family: 'Prism Sans'; src: url('" + base + "fonts/Cabin.ttf') format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; }",
    ".dsr { --size: 4.6vmin; position: absolute; right: 4.5vw; top: 4.4vh; max-width: 58vw; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2.4vmin 3.4vmin; align-items: center; color: #e8ecee;",
    "  font-family: 'Prism Sans', 'Gill Sans', 'Helvetica Neue', sans-serif; font-weight: 500; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }",
    ".dsr[hidden] { display: none; }",
    ".dsr.big { --size: 5.4vmin; right: auto; max-width: none; display: grid; grid-template-columns: 1fr 1fr; row-gap: 3vmin; column-gap: 3vmin; }",
    ".dsr .item { display: flex; align-items: center; gap: calc(var(--size) * 0.3); white-space: nowrap; }",
    ".dsr .item.stale { opacity: 0.55; }",
    ".dsr .ring { position: relative; width: var(--size); height: var(--size); flex: none; }",
    ".dsr svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".dsr .track { fill: none; stroke: #e8ecee; stroke-width: 2.6; opacity: 0.18; }",
    ".dsr .arc { fill: none; stroke: var(--hue); stroke-width: 2.6; }",
    ".dsr .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--size) * 0.27); font-weight: 560; }",
    ".dsr .caption { display: flex; flex-direction: column; gap: 0.5vmin; font-size: calc(var(--size) * 0.36); line-height: 1.05; }",
    ".dsr.big .caption { font-size: calc(var(--size) * 0.31); }",
    ".dsr .detail { font-size: calc(var(--size) * 0.31); color: #a2aaa8; }",
    ".dsr.big .detail { font-size: calc(var(--size) * 0.27); }",
    // the song: placeSong sets where it stands and how wide it may grow
    ".dsp { --size: 4.6vmin; position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: calc(var(--size) * 0.3); color: #e8ecee;",
    "  font-family: 'Prism Sans', 'Gill Sans', 'Helvetica Neue', sans-serif; font-weight: 500; -webkit-font-smoothing: antialiased; transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".dsp.big { --size: 5.4vmin; }",
    ".dsp[hidden], .dsp .ring[hidden], .dsp .detail[hidden] { display: none; }",
    ".dsp.away { opacity: 0; }",
    ".dsp .ring { position: relative; width: var(--size); height: var(--size); flex: none; }",
    ".dsp svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".dsp .track { fill: none; stroke: #e8ecee; stroke-width: 2.6; opacity: 0.18; }",
    ".dsp .arc { fill: none; stroke: #e8ecee; stroke-width: 2.6; }",
    ".dsp .caption { min-width: 0; display: flex; flex-direction: column; gap: 0.5vmin; font-size: calc(var(--size) * 0.36); line-height: 1.05; }",
    ".dsp.big .caption { font-size: calc(var(--size) * 0.31); }",
    ".dsp .detail { font-size: calc(var(--size) * 0.31); color: #a2aaa8; }",
    ".dsp.big .detail { font-size: calc(var(--size) * 0.27); }",
    ".dsp .name, .dsp .detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    "@media (prefers-reduced-motion: reduce) { .dsp { transition: none; } }",
  ].join("\n");

  function pad2(value) {
    return String(value).padStart(2, "0");
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
    var shown = { hue: hueOf(limit.source).text, name: displayName(limit.source) + " " + limit.window };
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

  // How far the song is, 0 to 1, moved on from when it was read; null when the
  // app gives no length (Music, for songs it streams).
  function songProgress(track, nowMs) {
    if (!(track.duration_ms > 0)) return null;
    var at = track.position_ms + Math.max(0, nowMs - track.at_ms);
    return Math.min(1, Math.max(0, at / track.duration_ms));
  }

  function songItem() {
    var node = document.createElement("div");
    node.className = "dsp";
    node.hidden = true;
    var holder = document.createElement("div");
    holder.className = "ring";
    var svg = svgNode("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    var arc = svgNode("circle", { class: "arc", cx: 24, cy: 24, r: RADIUS, "stroke-dasharray": "0 " + ARC.toFixed(2) });
    svg.append(svgNode("circle", { class: "track", cx: 24, cy: 24, r: RADIUS }), arc);
    holder.append(svg);
    var caption = document.createElement("div");
    caption.className = "caption";
    var name = text("name", "");
    var detail = text("detail", "");
    caption.append(name, detail);
    node.append(holder, caption);
    return { node: node, ring: holder, arc: arc, name: name, detail: detail };
  }

  window.agentScreensaver.register(function () {
    var box, lastKey = "", big, song, track, waiting = false, now, cancelSong;

    // With no tasks: the empty corner under the prism, as far in from the left
    // and up from the foot as the clock is from the top. While tasks run: the
    // top row, centred in the room between the clock (the clock component, in
    // the same full-screen layer) and the limits, cut with "…" when short.
    function placeSong() {
      if (!song || song.node.hidden) return;
      var vw = window.innerWidth / 100, vh = window.innerHeight / 100, vmin = Math.min(vw, vh);
      var node = song.node, ringsShown = !box.hidden;
      node.classList.toggle("big", big === true);
      if (big) {
        node.style.maxWidth = 40 * vw + "px";
        node.style.left = 5 * vw + "px";
        node.style.top = window.innerHeight - 5 * vh - node.offsetHeight + "px";
        return;
      }
      var clock = document.querySelector(".dsc");
      var from = (clock ? clock.offsetLeft + clock.offsetWidth : 5 * vw + 30 * vmin) + 4 * vmin;
      var to = (ringsShown ? box.offsetLeft : window.innerWidth - 4.5 * vw) - 4 * vmin;
      node.style.maxWidth = Math.max(0, to - from) + "px";
      node.style.left = from + Math.max(0, (to - from - node.offsetWidth) / 2) + "px";
      var middle = ringsShown ? box.offsetTop + Math.min(box.offsetHeight, 6.6 * vmin) / 2 : 4.4 * vh + 2.3 * vmin;
      node.style.top = middle - node.offsetHeight / 2 + "px";
    }

    // The ring of the song moves on between the service's reads, a few times a second, and the song keeps its place.
    function drawSong() {
      if (!song || !track) return;
      var progress = songProgress(track, now());
      song.ring.hidden = progress === null;
      if (progress !== null) song.arc.setAttribute("stroke-dasharray", (ARC * progress).toFixed(2) + " " + ARC.toFixed(2));
      placeSong();
    }

    function showSong(next) {
      var title = next && next.title ? next.title : "";
      var appears = song.node.hidden && title !== "";
      track = title === "" ? undefined : next;
      song.node.hidden = title === "";
      song.node.classList.toggle("away", waiting);
      if (title === "") return;
      if (song.name.textContent !== title) song.name.textContent = title;
      if (song.detail.textContent !== next.artist) song.detail.textContent = next.artist;
      song.detail.hidden = next.artist === "";
      drawSong();
      if (appears && !waiting) song.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    }

    // Under the spectrum when nothing runs: the date sits under the violet, the rings under the date.
    function place() {
      if (!box) return;
      if (!big) { box.style.left = box.style.top = box.style.width = ""; return; }
      var g = geometry(window.innerWidth, window.innerHeight, 0), foot = g.face(g.uBot);
      box.style.left = g.callL + "px";
      box.style.width = g.colR - g.callL + "px";
      box.style.top = foot[1] + g.slope(1) * (g.colR - foot[0]) + 10 * g.vmin + "px";
    }
    return {
      mount: function (root, ctx) {
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "dsr";
        song = songItem();
        root.append(style, box, song.node);
        now = function () { return ctx.now(); };
        cancelSong = ctx.requestFrame(drawSong, 4);
        window.addEventListener("resize", place);
        lastKey = "";
        big = undefined;
      },
      update: function (state) {
        if (!box) return;
        var nowBig = state.cards.length === 0;
        box.hidden = state.limits.length === 0;
        if (big !== undefined && nowBig !== big) {
          // It changes place with the mood: it fades into the new one.
          var from = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateY(1.6vmin)" };
          box.animate([from, { opacity: 1, transform: "translateY(0)" }], { duration: 420, delay: 120, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
        }
        big = nowBig;
        box.classList.toggle("big", nowBig);
        place();
        waiting = state.mode === "attention";
        showSong(state.nowPlaying);
        var shown = order(state.limits, state.agentOrder).map(function (limit) { return view(limit, state.nowMs); });
        var key = JSON.stringify(shown);
        if (key === lastKey) return;
        lastKey = key;
        box.replaceChildren.apply(box, shown.map(ring));
        placeSong();
      },
      unmount: function () {
        window.removeEventListener("resize", place);
        if (cancelSong) cancelSong();
        cancelSong = undefined;
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = song = track = undefined;
      },
    };
  });
})();
