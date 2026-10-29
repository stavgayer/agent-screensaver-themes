// The Unknown Pleasures board: the words beside the plot. The sleeve has no
// words at all, so here they stay few and stand in their own column right of
// the plot, the way a scientist labels a figure: one statement at the top,
// then one card for each agent, a black plate in a hairline frame set at the
// height of the band of lines that agent owns and joined to it by a leader in
// the agent's colour, like a label on the axis of the graph. When an agent waits, the
// column becomes one call: NEEDS YOU, who, how long, the exact command, the
// project. With no tasks the column holds the time, large.
//
// Only the fields the state gives are shown, so privacy mode keeps working.
// Motion is transform and opacity only, through the Web Animations API, with
// springs sampled into CSS linear() curves. With reduced motion nothing
// travels: things fade in place.
(function () {
  var MINUTE = 60000;
  var ROWS = 64;
  var MAX_BANDS = 5;
  var GAP = 3; // the quiet lines at the back of each band
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var OWN = { claude: "#ff5b3d", codex: "#57c7ff", cursor: "#ffb52e" };
  var SPARE = ["#ff6fae", "#5fe0b4", "#b9a4ff", "#ffd36a", "#7fa8ff", "#ff8a4c"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var STYLE = [
    "@font-face { font-family: 'UP Sans'; src: url('" + base + "fonts/InstrumentSans.ttf') format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; }",
    "@font-face { font-family: 'UP Mono'; src: url('" + base + "fonts/GeistMono.ttf') format('truetype'); font-weight: 100 900; }",
    ".upb { --ink: #ecebe6; --muted: #9c9a93; --ground: #0b0b0a; position: absolute; inset: 0; overflow: hidden; color: var(--ink);",
    "  font-family: 'UP Sans', 'Helvetica Neue', sans-serif; font-weight: 500; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }",
    ".upb .stage { position: absolute; inset: 0; }",
    ".upb .col { position: absolute; left: 70.5vw; right: 4.5vw; }",
    // the display voice: Instrument Sans at its narrowest, in capitals, set tight
    ".upb .say { top: 13vh; font-stretch: 75%; font-weight: 600; font-size: 8.6vmin; line-height: 0.86; letter-spacing: -0.02em; text-transform: uppercase; white-space: nowrap; }",
    ".upb .sub { top: calc(13vh + 9.2vmin); font-size: 2.6vmin; color: var(--muted); white-space: nowrap; }",
    ".upb .sub[hidden], .upb .say[hidden] { display: none; }",
    // A card is a black plate in a hairline frame, like a label pinned beside the figure.
    ".upb .card { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 0.45vmin;",
    "  padding: 1vmin 1.8vmin; background: var(--ground); box-shadow: inset 0 0 0 1px rgba(236, 235, 230, 0.6); overflow: hidden; }",
    ".upb .card .agent { font-size: 2vmin; font-weight: 600; line-height: 1.25; color: var(--hue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".upb .card .since { font-family: 'UP Mono', ui-monospace, Menlo, monospace; font-size: 3.7vmin; font-weight: 520; line-height: 1.25; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".upb .card .what { font-size: 2.4vmin; font-weight: 520; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".upb .card .where { font-size: 1.9vmin; line-height: 1.3; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".upb .card .what[hidden], .upb .card .where[hidden] { display: none; }",
    ".upb .card.tight .where { display: none; }",
    ".upb .card.tight .since { font-size: 3.2vmin; }",
    // Lines need their full height or the overflow clip cuts descenders; very short plates drop to two lines.
    ".upb .card.tighter { gap: 0.2vmin; padding-block: 0.6vmin; }",
    ".upb .card.tighter .agent { display: none; }",
    ".upb .card.tighter .since { font-size: 2.6vmin; color: var(--hue); }",
    ".upb .card.done.tighter .since { color: var(--muted); }",
    ".upb .card.tighter .what { font-size: 2.1vmin; }",
    ".upb .card.done { box-shadow: inset 0 0 0 1px rgba(236, 235, 230, 0.22); }",
    ".upb .card.done .agent, .upb .card.done .since { color: var(--muted); }",
    ".upb .card.done .what { color: #c9c7c0; }",
    // the leader: a hair in the agent's colour from the band's lines to its card
    ".upb .lead { position: absolute; height: 2px; margin-top: -1px; background: var(--hue); opacity: 0.9; transform-origin: left center; }",
    ".upb .lead.done { background: var(--ink); opacity: 0.25; }",
    ".upb .more { font-size: 2.1vmin; color: var(--muted); }",
    // the call
    ".upb .call { top: 13vh; visibility: hidden; }",
    ".upb.calling .call { visibility: visible; }",
    ".upb .call .big { font-stretch: 75%; font-weight: 650; font-size: 14vmin; line-height: 0.84; letter-spacing: -0.025em; text-transform: uppercase; }",
    ".upb .call .who { margin-top: 4.4vmin; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 2.2vmin; row-gap: 0.6vmin; font-size: 3.6vmin; line-height: 1.1; }",
    ".upb .call .who .agent { color: var(--hue); font-weight: 650; overflow-wrap: anywhere; }",
    ".upb .call .who .since { white-space: nowrap; }",
    ".upb .call .label { margin-top: 4vmin; font-size: 2.2vmin; color: var(--muted); }",
    // The command keeps one line: it steps down in size to fit the column. Only a
    // command too long even at the smallest step breaks into up to four lines.
    ".upb .call .command { margin-top: 1.2vmin; font-family: 'UP Mono', ui-monospace, Menlo, monospace; font-weight: 520; font-size: 4.6vmin; line-height: 1.22;",
    "  letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; }",
    ".upb .call .command.long { white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }",
    ".upb .call .command .word { white-space: nowrap; }",
    ".upb .call .note { margin-top: 1.2vmin; font-size: 4.2vmin; font-weight: 600; line-height: 1.1; }",
    ".upb .call .project { margin-top: 1vmin; font-size: 3.2vmin; font-weight: 560; line-height: 1.15; overflow-wrap: anywhere; }",
    ".upb .call .more { margin-top: 3.4vmin; font-size: 2.4vmin; }",
    // the time, when nothing runs
    ".upb .time { top: 28vh; visibility: hidden; }",
    ".upb.resting .time { visibility: visible; }",
    ".upb .time .clock { font-stretch: 75%; font-weight: 560; font-size: 14.6vmin; line-height: 0.82; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".upb .time .date { margin-top: 2.6vmin; font-size: 2.8vmin; color: var(--muted); white-space: nowrap; }",
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
  var SETTLE = spring(200, 21); // a hair of overshoot, then still
  var LAND = spring(170, 17); // the call: arrives with weight
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  // The same numbers as the plot, so a card stands beside its band.
  function plotLayout(w, h, count) {
    var p = { w: w, h: h, right: 0.655 * w, top: 0.2 * h, bottom: 0.93 * h, colLeft: 0.705 * w, colRight: 0.955 * w };
    p.step = (p.bottom - p.top) / (ROWS - 1);
    var shown = Math.min(count, MAX_BANDS), first = 14, room = 60 - first;
    p.band = shown ? Math.min(15, Math.floor(room / shown)) : 0;
    p.start = first + Math.floor((room - p.band * shown) / 2);
    p.bands = [];
    for (var i = 0; i < shown; i++) {
      var from = p.start + i * p.band;
      p.bands.push({ from: from, to: from + p.band, y: p.top + from * p.step, lead: p.top + (from + GAP + (p.band - GAP) / 2) * p.step });
    }
    return p;
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

  // The card's time is set large in mono, so it is kept short enough for one line.
  function compact(ms) {
    var minutes = Math.floor(ms / MINUTE);
    if (minutes < 1) return "now";
    if (minutes < 60) return minutes + " min";
    return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
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

  window.agentScreensaver.register(function () {
    var box, stage, say, sub, cardsBox, more, call, time, clock, date, lastState;
    var show = "agents", mood = "", sayKey = "", callKey = "";
    var cards = new Map();

    function rise(node, delay, distance) {
      if (reduce.matches) {
        node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: delay, easing: "ease-out", fill: "backwards" });
        return;
      }
      node.animate([{ opacity: 0, transform: "translateY(" + (distance || 4) + "vmin)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: SETTLE.duration, delay: delay, easing: SETTLE.easing, fill: "backwards" });
    }

    function fade(node, show) {
      var from = show ? 0 : 1, to = show ? 1 : 0;
      var shift = reduce.matches ? "none" : show ? "translateY(0)" : "translateY(-1.6vmin)";
      node.animate([{ opacity: from }, { opacity: to, transform: shift }], { duration: show ? 320 : 200, easing: EASE_OUT, fill: "forwards" });
    }

    // ---- the statement --------------------------------------------------

    function drawSay(state, tasks) {
      var working = tasks.filter(function (card) { return card.kind !== "finished"; }).length;
      var word = working > 0 ? working + " working" : "All done";
      var line = working > 0 ? "" : tasks.length === 1 ? "The task is finished" : tasks.length + " tasks finished";
      var key = word + "|" + line;
      if (key === sayKey) return;
      var first = sayKey === "";
      sayKey = key;
      setText(say, word);
      setText(sub, line);
      sub.hidden = line === "";
      if (!first) {
        rise(say, 0, 3);
        if (!sub.hidden) rise(sub, 70, 2);
      }
    }

    // ---- task cards -----------------------------------------------------

    function buildCard(card) {
      var node = el("div", "card");
      var parts = { agent: el("div", "agent"), since: el("div", "since"), what: el("div", "what"), where: el("div", "where") };
      parts.what.dir = "auto";
      parts.where.dir = "auto";
      node.append(parts.agent, parts.since, parts.what, parts.where);
      node.style.setProperty("--hue", hueOf(card.source));
      var lead = el("div", "lead");
      lead.style.setProperty("--hue", hueOf(card.source));
      return { node: node, lead: lead, parts: parts, done: undefined };
    }

    function fillCard(entry, card, state) {
      var said = since(card, state.nowMs);
      var parts = entry.parts;
      setText(parts.agent, agentName(card.source, state.agents));
      setText(parts.since, said.text);
      var heading = card.name || card.title || "";
      setText(parts.what, heading);
      parts.what.hidden = heading === "";
      var where = card.project && card.project !== heading ? card.project : "";
      if (where !== "" && card.branch) where += " on " + card.branch;
      setText(parts.where, where);
      parts.where.hidden = where === "";
      var changed = entry.done !== undefined && entry.done !== said.done;
      entry.node.classList.toggle("done", said.done);
      entry.lead.classList.toggle("done", said.done);
      entry.done = said.done;
      // The change happens on the card as its lines go flat: it settles a hair and its time line rises in.
      if (changed && !reduce.matches) {
        entry.node.animate([{ transform: "translateX(0.8vmin)" }, { transform: "translateX(0)" }], { duration: SETTLE.duration, easing: SETTLE.easing });
        parts.since.animate([{ opacity: 0, transform: "translateY(1.2vmin)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 360, easing: EASE_OUT });
      } else if (changed) {
        parts.since.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      }
    }

    function enter(entry, order) {
      if (reduce.matches) {
        entry.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: order * 70, easing: "ease-out", fill: "backwards" });
        entry.lead.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 300, delay: order * 70, easing: "ease-out", fill: "backwards" });
        return;
      }
      // The leader draws out from the band, then the card lands at its end.
      entry.lead.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 260, delay: 60 + order * 70, easing: EASE_OUT, fill: "backwards" });
      entry.node.animate([{ opacity: 0, transform: "translateX(3.2vmin)" }, { opacity: 1, transform: "translateX(0)" }],
        { duration: SETTLE.duration, delay: 120 + order * 70, easing: SETTLE.easing, fill: "backwards" });
    }

    function leave(entry) {
      var to = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateX(2vmin)" };
      var motion = entry.node.animate([{}, to], { duration: 200, easing: EASE_OUT, fill: "forwards" });
      motion.onfinish = function () { entry.node.remove(); entry.lead.remove(); };
      entry.lead.animate([{}, { opacity: 0 }], { duration: 200, easing: EASE_OUT, fill: "forwards" });
    }

    function placeCards() {
      var lay = plotLayout(window.innerWidth, window.innerHeight, Math.max(0, cards.size));
      var i = 0;
      cards.forEach(function (entry) {
        var band = lay.bands[i++];
        if (!band) { entry.node.style.display = entry.lead.style.display = "none"; return; }
        entry.node.style.display = entry.lead.style.display = "";
        // The plate covers the band's own lines, its quiet ones excepted, beside the plot.
        var top = band.y + (GAP - 0.5) * lay.step, height = (band.to - band.from - GAP) * lay.step;
        entry.node.style.left = lay.colLeft + "px";
        entry.node.style.width = lay.colRight - lay.colLeft + "px";
        entry.node.style.top = top + "px";
        entry.node.style.height = height + "px";
        entry.node.classList.toggle("tight", height < 0.15 * lay.h);
        entry.node.classList.toggle("tighter", height < 0.095 * lay.h);
        entry.lead.style.left = lay.right + 0.008 * lay.w + "px";
        entry.lead.style.width = lay.colLeft - lay.right - 0.008 * lay.w + "px";
        entry.lead.style.top = Math.round(band.lead) + "px";
      });
      var last = lay.bands[lay.bands.length - 1];
      more.hidden = cards.size <= MAX_BANDS || !last;
      if (!more.hidden) {
        more.textContent = "+" + (cards.size - MAX_BANDS) + " more";
        more.style.left = lay.colLeft + "px";
        more.style.top = last.y + (last.to - last.from) * lay.step + "px";
      }
    }

    function drawCards(tasks, state) {
      var wanted = new Set(), fresh = 0, order = [];
      tasks.forEach(function (card) {
        var key = card.source + "\u0000" + card.session;
        wanted.add(key);
        var entry = cards.get(key);
        var isNew = entry === undefined;
        if (isNew) {
          entry = buildCard(card);
          cardsBox.append(entry.lead, entry.node);
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

    // ---- the call -------------------------------------------------------

    var STEPS = [4.6, 4.1, 3.6, 3.2, 2.8, 2.5];
    var monoAsked = false;
    function fitCommand() {
      var command = call && call.querySelector(".command");
      if (!command) return;
      if (!monoAsked && document.fonts && !document.fonts.check("520 40px 'UP Mono'")) {
        monoAsked = true;
        document.fonts.load("520 40px 'UP Mono'").then(fitCommand, function () {});
      }
      command.classList.remove("long");
      for (var i = 0; i < STEPS.length; i++) {
        command.style.fontSize = STEPS[i] + "vmin";
        if (command.scrollWidth <= command.clientWidth + 1) return;
      }
      // Too long for one line even small: break it at spaces, at a size that still reads across a room.
      command.classList.add("long");
      command.style.fontSize = "3.4vmin";
    }

    function drawCall(first, others, state) {
      var at = first.approval_since_ms !== undefined ? first.approval_since_ms : first.updated_at_ms;
      var waited = state.nowMs - at;
      var key = JSON.stringify([first.source, first.session, Math.floor(waited / MINUTE), others, first.request || "", first.project || ""]);
      if (key === callKey) return false;
      var isNew = callKey === "" || JSON.parse(callKey)[1] !== first.session;
      callKey = key;
      call.style.setProperty("--hue", hueOf(first.source));
      var big = el("div", "big", "Needs you");
      var who = el("div", "who");
      who.append(el("span", "agent", agentName(first.source, state.agents)), el("span", "since", "waiting " + duration(waited)));
      var parts = [big, who];
      if (first.request) {
        // Each word of the command is kept whole, so a long one breaks only at spaces,
        // never after a dash inside a flag.
        var command = el("div", "command");
        first.request.split(/( +)/).forEach(function (part) {
          if (part === "") return;
          // A word longer than the column may still break where it has to.
          if (/^ +$/.test(part) || part.length > 26) command.appendChild(document.createTextNode(part));
          else command.appendChild(el("span", "word", part));
        });
        command.dir = "auto";
        parts.push(el("div", "label", "Wants to run"), command);
      } else {
        parts.push(el("div", "label", "Wants"), el("div", "note", "Look at the terminal"));
      }
      if (first.project) {
        var project = el("div", "project", first.project);
        project.dir = "auto";
        parts.push(el("div", "label", "Project"), project);
      }
      if (others > 0) parts.push(el("div", "more", "+" + others + " more waiting"));
      call.replaceChildren.apply(call, parts);
      fitCommand();
      return isNew;
    }

    // The one big move: the words of the column step aside, the burst rises in the
    // plot (the ground does that), and NEEDS YOU lands a beat later, then who and what.
    function land() {
      var parts = Array.prototype.slice.call(call.children);
      parts.forEach(function (node, i) {
        if (reduce.matches) {
          node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 80 + i * 40, easing: "ease-out", fill: "backwards" });
          return;
        }
        var first = i === 0;
        node.animate([{ opacity: 0, transform: "translateY(" + (first ? 7 : 3) + "vmin)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: first ? LAND.duration : SETTLE.duration, delay: first ? 160 : 260 + i * 55, easing: first ? LAND.easing : SETTLE.easing, fill: "backwards" });
      });
    }

    // ---- the time -------------------------------------------------------

    function drawTime(nowMs) {
      var moment = new Date(nowMs);
      setText(clock, pad2(moment.getHours()) + ":" + pad2(moment.getMinutes()));
      setText(date, WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()]);
    }

    // ---- the whole board ------------------------------------------------

    function draw(state) {
      if (!box) return;
      var resting = show === "time" || state.cards.length === 0;
      var waiting = resting || state.display !== "main" ? [] : approvals(state.cards);
      var next = resting ? "rest" : waiting.length > 0 ? "call" : "work";
      var tasks = resting ? [] : state.cards;
      drawTime(state.nowMs);
      if (next === "call") {
        var isNew = drawCall(waiting[0], waiting.length - 1, state);
        if (mood !== "call" || isNew) land();
      } else {
        callKey = "";
      }
      if (next !== mood) {
        box.classList.toggle("calling", next === "call");
        box.classList.toggle("resting", next === "rest");
        if (mood !== "") {
          var wordsShown = next === "work";
          if ((mood === "work") !== wordsShown) {
            fade(say, wordsShown);
            fade(sub, wordsShown);
            fade(cardsBox, wordsShown);
          }
          if (mood === "call") fade(call, false);
          if (next === "call") call.getAnimations().forEach(function (a) { a.cancel(); });
          if (next === "rest") rise(time, 0, 3);
        } else if (next !== "work") {
          [say, sub, cardsBox].forEach(function (node) { node.style.opacity = "0"; });
        }
        if (next === "work") [say, sub, cardsBox].forEach(function (node) { node.style.opacity = ""; });
      }
      mood = next;
      if (!resting) drawSay(state, tasks);
      drawCards(tasks, state);
    }

    function setShow(options) {
      show = options.show === "time" ? "time" : "agents";
    }

    var onResize = function () {
      placeCards();
      fitCommand();
    };

    return {
      mount: function (root, ctx) {
        // Fill the whole screen, not the fade-in wrapper the runtime puts around us.
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = el("style");
        style.textContent = STYLE;
        box = el("div", "upb");
        stage = el("div", "stage");
        say = el("div", "col say");
        sub = el("div", "col sub");
        sub.hidden = true;
        cardsBox = el("div", "cards");
        more = el("div", "more");
        more.style.position = "absolute";
        more.hidden = true;
        cardsBox.appendChild(more);
        call = el("div", "col call");
        time = el("div", "col time");
        clock = el("div", "clock");
        date = el("div", "date");
        time.append(clock, date);
        stage.append(say, sub, cardsBox, call, time);
        box.appendChild(stage);
        root.append(style, box);
        setShow(ctx.options);
        // The words do not sway with the plot: moved by fractions of a pixel, text
        // is painted again at each step and its edges shimmer. Only the plot sways,
        // a few pixels at most, so each card still stands beside its band.
        if (document.fonts && document.fonts.load) document.fonts.load("600 40px 'UP Sans'").then(onResize, function () {});
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
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = stage = say = sub = cardsBox = more = call = time = clock = date = lastState = undefined;
        cards.clear();
        mood = sayKey = callKey = "";
      },
    };
  });
})();
