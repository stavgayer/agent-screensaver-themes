// The Piñata board: everything with words, over the whole screen. It follows
// the cover's one plate: a gold frame (#dbc086) around a black field of gold
// halftone dots that crowd toward a gold band in the middle, and in the band
// black capitals in a bold condensed face. On the cover the plate sits in the
// top border, centred, 27% of the side wide and 13% high (2.16 to 1).
//
// Here the same plate carries the date at the top; each task is a small plate
// in the window with its dots in the agent's colour; an approval is one big
// plate that drops into the window; the usage limits and the song are plain
// black plates with a gold frame in the bottom border. The frame is 15vmin on
// every edge, the same number the background uses.
//
// It works out the five states from the view state, builds text only with
// textContent, cuts long text with "…", measures instead of guessing where the
// song fits, and cleans up in unmount.
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MINUTE = 60000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;
  var WINDOW_ORDER = ["5h", "week", "plan"];
  var STALE_AFTER = { "5h": 30 * MINUTE, week: 6 * HOUR, plan: 6 * HOUR };
  // Each agent owns one colour from the photo in the window: Claude the sunlit
  // clay of the path, Codex the leaves, Cursor the hazy sky. An agent we do not
  // know gets one of the spare colours by its name.
  var OWN = { claude: "#d9895b", codex: "#93b89c", cursor: "#9fb2c4" };
  var SPARE = ["#e3c58d", "#c7a17d", "#b7a9c9"];
  var GOLD = "#dbc086";
  var MAX_CARDS = 4;
  var RADIUS = 19;
  var ARC = 2 * Math.PI * RADIUS;

  var STYLE = [
    "@font-face { font-family: 'PN Type'; src: url('" + base + "fonts/Archivo.ttf') format('truetype'); font-weight: 100 900; font-stretch: 62% 125%; }",
    "@font-face { font-family: 'PN Mono'; src: url('" + base + "fonts/JetBrainsMono.woff2') format('woff2'); font-weight: 100 800; }",
    ".pn { --gold: " + GOLD + "; --ink: #0b0b0a; --cream: #f0ece5; --dim: #a8946a; position: absolute; inset: 0; color: var(--cream);",
    "  font-family: 'PN Type', 'Helvetica Neue', Arial, sans-serif; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }",
    ".pn [hidden] { display: none !important; }",
    // The plate: a gold frame, a black field of dots that crowd toward the band.
    ".pn .plate { box-sizing: border-box; display: flex; flex-direction: column; background: var(--ink); border: var(--rim, 0.4vmin) solid var(--gold); box-shadow: 0 0.8vmin 2.4vmin rgba(0, 0, 0, 0.45); }",
    ".pn .dots { flex: 1 1 0; min-height: 0; --dot: var(--gold);",
    "  background-image: radial-gradient(circle at center, var(--dot) 0 30%, transparent 36%); background-size: var(--pitch, 0.9vmin) var(--pitch, 0.9vmin); background-position: center; }",
    ".pn .dots.up { -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.15), #000); mask-image: linear-gradient(to bottom, rgba(0,0,0,0.15), #000); }",
    ".pn .dots.down { -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,0.15), #000); mask-image: linear-gradient(to top, rgba(0,0,0,0.15), #000); }",
    ".pn .band { flex: none; background: var(--gold); color: var(--ink); font-weight: 820; font-stretch: 72%; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    // The name plate in the top border, at the cover's 2.16 to 1.
    ".pn .name { position: absolute; top: 1.6vmin; left: calc(50% - 13vmin); width: 26vmin; height: 12vmin; transition: opacity 500ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".pn .name .band { padding: 0.55vmin 1vmin; font-size: 1.9vmin; line-height: 1.1; text-align: center; }",
    ".pn .name.away { opacity: 0; }",
    // The window, inside the fur.
    ".pn .window { position: absolute; left: 15vmin; right: 15vmin; top: 15vmin; bottom: 15vmin; }",
    ".pn .big { position: absolute; font-weight: 820; font-stretch: 72%; text-transform: uppercase; line-height: 0.9; letter-spacing: -0.01em; white-space: nowrap; text-shadow: 0 0 2.4vmin rgba(0, 0, 0, 0.55); }",
    ".pn .big.clock { left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font-size: 30vmin; letter-spacing: -0.02em; }",
    ".pn .big.word { left: 4vmin; right: 4vmin; top: 4vmin; font-size: 13vmin; overflow: hidden; text-overflow: ellipsis; }",
    ".pn .cards { position: absolute; left: 4vmin; right: 4vmin; bottom: 4vmin; display: flex; gap: 2vmin; align-items: stretch; }",
    ".pn .card { --rim: 0.35vmin; --pitch: 0.75vmin; flex: 1 1 0; min-width: 0; }",
    ".pn .card .dots { flex: none; height: 1.8vmin; --dot: var(--hue); }",
    ".pn .card .band { display: flex; justify-content: space-between; gap: 1em; padding: 0.5vmin 1.2vmin; font-size: 1.9vmin; line-height: 1.1; }",
    ".pn .card .band span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
    ".pn .card .band span:last-child { flex: none; }",
    ".pn .card .body { padding: 1.2vmin 1.4vmin 1.3vmin; }",
    ".pn .card .what { font-size: 2.5vmin; font-weight: 620; line-height: 1.2; }",
    ".pn .card .where { margin-top: 0.4vmin; font-size: 1.9vmin; font-weight: 500; color: var(--dim); }",
    ".pn .card .what, .pn .card .where { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".pn .card.done { opacity: 0.72; }",
    ".pn .card.done .dots { --dot: var(--dim); }",
    ".pn .card.more { flex: none; justify-content: center; align-items: center; padding: 0 2.4vmin; font-size: 2.4vmin; font-weight: 700; font-stretch: 72%; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gold); }",
    // The approval: one big plate in the agent's colour.
    ".pn .call { --rim: 0.7vmin; --pitch: 1.3vmin; position: absolute; left: 50%; top: 50%; width: min(calc(100% - 8vmin), 112vmin); transform: translate(-50%, -50%); }",
    ".pn .call .dots { flex: none; height: 4.4vmin; --dot: var(--hue); }",
    ".pn .call .band { padding: 0.6vmin 3vmin 0.2vmin; font-size: 12vmin; line-height: 1; text-align: center; letter-spacing: 0.02em; }",
    ".pn .call .body { padding: 2.6vmin 3.4vmin 2.8vmin; }",
    ".pn .call .who { font-size: 3vmin; font-weight: 700; color: var(--hue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".pn .call .command { margin-top: 1.4vmin; font: 600 3.8vmin/1.3 'PN Mono', ui-monospace, Menlo, monospace; overflow-wrap: anywhere;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }",
    ".pn .call .where { margin-top: 1.2vmin; font-size: 2.5vmin; font-weight: 500; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    // The bottom border: the limits, then the song in the room they leave.
    ".pn .row { position: absolute; left: 4vmin; right: 4vmin; bottom: 0; height: 15vmin; display: flex; align-items: center; gap: 3vmin; transition: opacity 500ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".pn .row.back { opacity: 0; }",
    ".pn .limits { --rim: 0.3vmin; flex: none; flex-direction: row; align-items: center; gap: 2.4vmin; height: 9vmin; padding: 0 2.2vmin; }",
    ".pn .item { display: flex; align-items: center; gap: 1.1vmin; white-space: nowrap; }",
    ".pn .item.stale { opacity: 0.55; }",
    ".pn .ring { position: relative; width: 5.6vmin; height: 5.6vmin; flex: none; }",
    ".pn svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".pn .track { fill: none; stroke: var(--cream); stroke-width: 6; opacity: 0.16; }",
    ".pn .arc { fill: none; stroke: var(--hue); stroke-width: 6; }",
    ".pn .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: 1.6vmin; font-weight: 700; font-stretch: 80%; }",
    ".pn .caption { display: flex; flex-direction: column; gap: 0.4vmin; line-height: 1.05; }",
    ".pn .caption .label { font-size: 1.7vmin; font-weight: 700; font-stretch: 80%; text-transform: uppercase; letter-spacing: 0.04em; }",
    ".pn .caption .detail { font-size: 1.6vmin; font-weight: 500; color: var(--dim); }",
    ".pn .slot { flex: 1 1 0; min-width: 0; display: flex; justify-content: flex-end; }",
    ".pn .song { --rim: 0.3vmin; min-width: 0; max-width: 100%; padding: 1.2vmin 2vmin 1.3vmin; transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".pn .song .title { font-size: 2.2vmin; font-weight: 700; }",
    ".pn .song .artist { margin-top: 0.3vmin; font-size: 1.8vmin; font-weight: 500; color: var(--dim); }",
    ".pn .song .title, .pn .song .artist { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".pn .song .bar { margin-top: 0.9vmin; height: 0.35vmin; background: rgba(219, 192, 134, 0.22); overflow: hidden; }",
    ".pn .song .fill { height: 100%; background: var(--gold); transform-origin: left center; transform: scaleX(0); }",
    ".pn .call { transition: opacity 600ms cubic-bezier(0.23, 1, 0.32, 1); }",
    "@media (prefers-reduced-motion: reduce) { .pn .name, .pn .row, .pn .song, .pn .call { transition: none; } }",
  ].join("\n");

  function pad2(value) { return String(value).padStart(2, "0"); }

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  // The five states of the design, from the view state.
  function moodOf(state, show) {
    if (show === "time" || state.display !== "main" || state.cards.length === 0) return "rest";
    if (state.cards.some(function (card) { return card.kind === "approval"; })) return "call";
    return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "done";
  }

  function minutes(ms) {
    var m = Math.max(0, Math.floor(ms / MINUTE));
    return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
  }

  function el(className, text) {
    var node = document.createElement("div");
    node.className = className;
    if (text !== undefined) node.textContent = text; // never innerHTML: titles and commands come from outside
    return node;
  }

  function span(text) {
    var node = document.createElement("span");
    node.textContent = text;
    return node;
  }

  // A plate: dots, a band, an optional body, dots.
  function plate(className, band, body) {
    var node = el("plate " + className);
    node.append(el("dots up"), band);
    if (body) node.appendChild(body);
    node.appendChild(el("dots down"));
    return node;
  }

  function agentName(state, source) {
    var agent = state.agents && state.agents[source];
    return agent && agent.name ? agent.name : source.charAt(0).toUpperCase() + source.slice(1);
  }

  // The limits follow builtin.limit-rings: order by agentOrder, an old reading
  // is dimmed and says its age, an estimate says "est.", a window that reset
  // since the reading is empty and says "Reset".
  function countdown(ms) {
    if (ms <= 0) return "Reset";
    var m = Math.floor(ms / MINUTE);
    if (m < 1) return "under 1m";
    if (m < 60) return m + "m";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }

  function resetLabel(resetsAtS, nowMs, short) {
    if (resetsAtS === undefined || resetsAtS === null) return "";
    var at = resetsAtS * 1000;
    var left = at - nowMs;
    if (left <= DAY) return countdown(left);
    var moment = new Date(at);
    var dayTime = SHORT_DAYS[moment.getDay()] + " " + pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
    if (left <= 6 * DAY) return dayTime;
    var date = moment.getDate() + " " + SHORT_MONTHS[moment.getMonth()];
    return short ? date : date + " " + dayTime.slice(4);
  }

  function shortAge(ms) {
    if (ms < HOUR) return Math.floor(ms / MINUTE) + "m";
    if (ms < DAY) return Math.floor(ms / HOUR) + "h";
    return Math.floor(ms / DAY) + "d";
  }

  function limitView(limit, nowMs) {
    var shown = { hue: hueOf(limit.source), label: limit.source.charAt(0).toUpperCase() + limit.source.slice(1) + " " + limit.window };
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
    shown.percent = Number.isFinite(limit.used_percent) ? Math.min(100, Math.max(0, Math.round(limit.used_percent))) : 0;
    shown.detail = [resetLabel(limit.resets_at, nowMs, more.length > 0)].concat(more).filter(function (text) { return text !== ""; }).join(", ");
    return shown;
  }

  function ordered(limits, agentOrder) {
    var order = agentOrder || [];
    function rank(source) {
      var known = order.indexOf(source);
      return known === -1 ? order.length : known;
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

  function ring(shown) {
    var item = el("item" + (shown.stale ? " stale" : ""));
    item.style.setProperty("--hue", shown.hue);
    var holder = el("ring");
    var svg = svgNode("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    svg.append(
      svgNode("circle", { class: "track", cx: 24, cy: 24, r: RADIUS }),
      svgNode("circle", { class: "arc", cx: 24, cy: 24, r: RADIUS, "stroke-dasharray": ((ARC * shown.percent) / 100).toFixed(2) + " " + ARC.toFixed(2) }),
    );
    holder.append(svg, el("value", shown.percent + "%"));
    var caption = el("caption");
    caption.append(el("label", shown.label), el("detail", shown.detail === "" ? " " : shown.detail));
    item.append(holder, caption);
    return item;
  }

  window.agentScreensaver.register(function () {
    var box, nameBand, name, win, big, cards, call, row, limits, song, track, show = "agents";
    var cancelSong, now, lastState, lastLimits = "", lastMood = "";

    function card(task, state) {
      var finished = task.kind === "finished";
      var band = el("band");
      var since = finished ? "Done" : task.started_at_ms !== undefined ? minutes(state.nowMs - task.started_at_ms) : "";
      band.append(span(agentName(state, task.source)), span(since));
      var body = el("body");
      if (task.title) body.appendChild(el("what", task.title)); // privacy mode removes it: leave the line out
      if (task.project) body.appendChild(el("where", task.branch ? task.project + " on " + task.branch : task.project));
      var node = plate("card" + (finished ? " done" : ""), band, body);
      node.style.setProperty("--hue", hueOf(task.source));
      return node;
    }

    function drawCall(state) {
      var waiting = state.cards.filter(function (task) { return task.kind === "approval"; })[0];
      var since = waiting.approval_since_ms !== undefined ? waiting.approval_since_ms : waiting.updated_at_ms;
      var body = el("body");
      body.appendChild(el("who", agentName(state, waiting.source) + (since !== undefined ? " · waited " + minutes(state.nowMs - since) : "")));
      body.appendChild(el("command", waiting.request || "Look at the terminal"));
      if (waiting.project) body.appendChild(el("where", waiting.branch ? waiting.project + " on " + waiting.branch : waiting.project));
      var band = el("band", "Needs you");
      call.replaceChildren(el("dots up"), band, body, el("dots down"));
      call.style.setProperty("--hue", hueOf(waiting.source));
    }

    function drawSong() {
      if (!track || !song) return;
      var progress = window.agentScreensaver.helpers.songProgress(track, now());
      song.querySelector(".bar").hidden = progress === null;
      if (progress !== null) song.querySelector(".fill").style.transform = "scaleX(" + progress.toFixed(4) + ")";
    }

    function drawLimits(state) {
      var shown = ordered(state.limits || [], state.agentOrder).map(function (limit) { return limitView(limit, state.nowMs); });
      var key = JSON.stringify(shown);
      limits.hidden = shown.length === 0;
      if (key === lastLimits) return;
      lastLimits = key;
      limits.replaceChildren.apply(limits, shown.map(ring));
    }

    function draw(state) {
      if (!box) return;
      var mood = moodOf(state, show);
      var moment = new Date(state.nowMs);
      var clock = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
      var date = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];

      // The name plate: the date, and the time too once the window has other words.
      nameBand.textContent = mood === "rest" ? date : clock + " · " + SHORT_DAYS[moment.getDay()] + " " + moment.getDate() + " " + SHORT_MONTHS[moment.getMonth()];
      name.classList.toggle("away", mood === "call");

      big.className = "big " + (mood === "rest" ? "clock" : "word");
      if (mood === "rest") big.textContent = clock;
      else if (mood === "done") big.textContent = "All done";
      else if (mood === "work") big.textContent = state.cards.filter(function (task) { return task.kind !== "finished"; }).length + " working";
      big.hidden = mood === "call";

      cards.hidden = mood !== "work" && mood !== "done";
      var shown = [];
      if (!cards.hidden) {
        // Up to four plates; more say how many, so a task is never dropped without a word.
        // A narrow window (4:3, 5:4) holds three plates, a wide one four, so the
        // agent's name in the band is never cut.
        var vmin = Math.min(box.clientWidth, box.clientHeight) / 100;
        var most = vmin > 0 && win.clientWidth / vmin < 115 ? MAX_CARDS - 1 : MAX_CARDS;
        var room = state.cards.length > most ? most - 1 : most;
        shown = state.cards.slice(0, room).map(function (task) { return card(task, state); });
        if (state.cards.length > room) {
          var more = el("plate card more", "+" + (state.cards.length - room) + " more");
          shown.push(more);
        }
      }
      cards.replaceChildren.apply(cards, shown);

      var calling = mood === "call";
      call.hidden = !calling;
      if (calling) {
        drawCall(state);
        if (lastMood !== "call") {
          // One move: the plate drops from the top border into the window.
          var moves = reduce() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translate(-50%, calc(-50% - 8vmin))" }, { opacity: 1, transform: "translate(-50%, -50%)" }];
          call.animate(moves, { duration: 700, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
        }
      }

      // The bottom border: gone on the second display, steps back during a call.
      var second = show === "time" || state.display !== "main";
      row.hidden = second;
      row.classList.toggle("back", calling);
      if (!second) drawLimits(state);
      track = !second && !calling && state.nowPlaying && state.nowPlaying.title ? state.nowPlaying : undefined;
      song.hidden = !track;
      if (track) {
        var title = song.querySelector(".title"), artist = song.querySelector(".artist");
        if (title.textContent !== track.title) title.textContent = track.title;
        if (artist.textContent !== track.artist) artist.textContent = track.artist || "";
        artist.hidden = !track.artist;
        drawSong();
      }
      lastMood = mood;
    }

    function redraw() {
      if (lastState) draw(lastState);
    }

    function reduce() {
      return window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
    }

    return {
      mount: function (root, ctx) {
        root.style.position = "absolute"; // fill the whole screen, not the region's small box
        root.style.inset = "0";
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = el("pn");
        nameBand = el("band");
        name = plate("name", nameBand);
        win = el("window");
        big = el("big clock");
        cards = el("cards");
        call = el("plate call");
        call.hidden = true;
        win.append(big, cards, call);
        row = el("row");
        limits = el("plate limits");
        song = el("plate song");
        var bar = el("bar");
        bar.appendChild(el("fill"));
        song.append(el("title"), el("artist"), bar);
        song.hidden = true;
        var slot = el("slot");
        slot.appendChild(song);
        row.append(limits, slot);
        box.append(name, win, row);
        root.append(style, box);
        show = ctx.options.show === "time" ? "time" : "agents";
        now = function () { return ctx.now(); };
        lastLimits = "";
        lastMood = "";
        // The runtime calls update once a minute with a new nowMs, which moves the
        // clock and the minutes. Only the song's bar needs frames: four a second.
        cancelSong = ctx.requestFrame(drawSong, 4);
        window.addEventListener("resize", redraw);
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      setOptions: function (options) {
        show = options.show === "time" ? "time" : "agents";
        if (lastState) draw(lastState);
      },
      unmount: function () {
        if (cancelSong) cancelSong();
        window.removeEventListener("resize", redraw);
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = nameBand = name = win = big = cards = call = row = limits = song = track = lastState = cancelSong = undefined;
      },
    };
  });
})();
