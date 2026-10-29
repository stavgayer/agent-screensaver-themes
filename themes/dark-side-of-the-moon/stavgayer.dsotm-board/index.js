// The prism board: the words beside the light. The picture has no words, so
// they stay few and keep clear of the glass and the beam:
//   work: one card for each task at the end of its band of the spectrum, like
//         the legend of a figure: the agent in its colour, the time, the task
//         and the project. The count stands large at the bottom left;
//   call: the spectrum has folded into one beam across the screen. NEEDS YOU
//         stands large above the beam; under it the agent, how long it has
//         waited, the exact command and the project;
//   rest: the time stands large above the spectrum, the date under it.
//
// Only the fields the state gives are shown, so privacy mode keeps working.
// Motion is transform and opacity only, through the Web Animations API, with
// springs sampled into CSS linear() curves. With reduced motion nothing
// travels: things fade in place.
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

  var MINUTE = 60000;
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var STYLE = [
    "@font-face { font-family: 'Prism Sans'; src: url('" + base + "fonts/Cabin.ttf') format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; }",
    "@font-face { font-family: 'Prism Mono'; src: url('" + base + "fonts/RedHatMono.ttf') format('truetype'); font-weight: 300 700; }",
    ".dsb { --ink: #e8ecee; --muted: #a2aaa8; --field: #090d0c; position: absolute; inset: 0; overflow: hidden; color: var(--ink);",
    "  font-family: 'Prism Sans', 'Gill Sans', 'Helvetica Neue', sans-serif; font-weight: 500; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }",
    ".dsb .stage { position: absolute; inset: 0; }",
    ".dsb [hidden] { display: none !important; }",
    // the count, large, at the bottom left, under the beam and clear of the glass
    ".dsb .say { position: absolute; left: 5vw; bottom: 6.5vh; }",
    ".dsb .say .word { font-stretch: 75%; font-weight: 600; font-size: 13vmin; line-height: 1; letter-spacing: -0.02em; white-space: nowrap; }",
    ".dsb .say .sub { margin-top: 0.6vmin; font-size: 2.8vmin; line-height: 1.25; color: var(--muted); white-space: nowrap; }",
    // a card is a legend entry: the band lands on its bar, the words stand beside it
    ".dsb .card { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 0.5vmin;",
    "  padding: 0 0 0 2.6vmin; container-type: inline-size; background: var(--field); }",
    ".dsb .card .bar { position: absolute; left: 0; top: 8%; bottom: 8%; width: 0.55vmin; background: var(--band); }",
    ".dsb .card .head { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1.6vmin; row-gap: 0; font-size: min(2.4vmin, 5.6cqi); line-height: 1.25; }",
    // the name keeps its whole width; when the time does not fit beside it, the time goes under it
    ".dsb .card .agent { color: var(--text); font-weight: 650; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }",
    ".dsb .card .since { color: var(--muted); white-space: nowrap; }",
    ".dsb .card .what { font-size: min(3.3vmin, 7.4cqi); font-weight: 560; line-height: 1.22; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".dsb .card.roomy .what { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }",
    ".dsb .card .where { font-size: min(2.1vmin, 4.9cqi); line-height: 1.25; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".dsb .card.tight { gap: 0.3vmin; }",
    ".dsb .card.tight .what { font-size: min(2.8vmin, 6.4cqi); }",
    ".dsb .card.tighter .where { display: none; }",
    ".dsb .card.done .bar { background: #c9d0d2; opacity: 0.55; }",
    ".dsb .card.done .agent { color: var(--muted); }",
    ".dsb .card.done .what { color: #c5ccca; }",
    ".dsb .more { position: absolute; font-size: 2.2vmin; line-height: 1.25; color: var(--muted); }",
    // the call
    ".dsb .call-top, .dsb .call-body { position: absolute; visibility: hidden; }",
    ".dsb .call-top { container-type: inline-size; }",
    ".dsb.calling .call-top, .dsb.calling .call-body { visibility: visible; }",
    ".dsb .call-top .big { font-stretch: 75%; font-weight: 650; font-size: min(15vmin, 21cqi); line-height: 0.92; letter-spacing: -0.025em; text-transform: uppercase; white-space: nowrap; }",
    ".dsb .call-body .who { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 2.4vmin; row-gap: 0.4vmin; font-size: 4.2vmin; line-height: 1.2; }",
    ".dsb .call-body .who .agent { color: var(--hue); font-weight: 700; }",
    ".dsb .call-body .who .since { white-space: nowrap; }",
    ".dsb .call-body .label { margin-top: 2.6vmin; font-size: 2.3vmin; line-height: 1.25; color: var(--muted); }",
    // The command keeps one line: it steps down in size to fit the column. Only a
    // command too long even at the smallest step breaks at spaces into up to four lines.
    ".dsb .call-body .command { margin-top: 0.9vmin; font-family: 'Prism Mono', ui-monospace, Menlo, monospace; font-weight: 500; font-size: 4.6vmin; line-height: 1.24;",
    "  letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; }",
    ".dsb .call-body .command.long { white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }",
    ".dsb .call-body .command .word { white-space: nowrap; }",
    ".dsb .call-body .note { margin-top: 0.9vmin; font-size: 4.4vmin; font-weight: 650; line-height: 1.2; }",
    ".dsb .call-body .project { margin-top: 2.2vmin; font-size: 3.2vmin; font-weight: 560; line-height: 1.22; overflow-wrap: anywhere; }",
    ".dsb .call-body .project .in { color: var(--muted); font-weight: 500; }",
    ".dsb .call-body .more { position: static; margin-top: 2vmin; font-size: 2.4vmin; }",
    // the time, when nothing runs
    ".dsb .clock, .dsb .date { position: absolute; visibility: hidden; }",
    ".dsb.resting .clock, .dsb.resting .date { visibility: visible; }",
    ".dsb .clock { font-stretch: 75%; font-weight: 560; font-size: 21vmin; line-height: 0.9; letter-spacing: -0.03em; white-space: nowrap; }",
    ".dsb .date { font-size: 3vmin; line-height: 1.25; color: var(--muted); white-space: nowrap; }",
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
  var LAND = spring(170, 17);
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

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
    var agent = has(agents, source) ? agents[source] : undefined;
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

  // The top edge of the red and the foot of the violet at a given x, where the bands run free.
  function edges(g) {
    var top = g.face(g.uTop), foot = g.face(g.uBot);
    return {
      top: function (x) { return top[1] + g.slope(0) * (x - top[0]); },
      foot: function (x) { return foot[1] + g.slope(1) * (x - foot[0]); },
    };
  }

  window.agentScreensaver.register(function () {
    var box, stage, say, word, sub, cardsBox, more, callTop, callBody, clock, date, lastState;
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

    function fade(node, shown) {
      var shift = reduce.matches ? "none" : shown ? "translateY(0)" : "translateY(-1.6vmin)";
      node.animate([{ opacity: shown ? 0 : 1 }, { opacity: shown ? 1 : 0, transform: shift }], { duration: shown ? 320 : 200, easing: EASE_OUT, fill: "forwards" });
    }

    // ---- the count ------------------------------------------------------

    function drawSay(tasks) {
      var working = tasks.filter(function (card) { return card.kind !== "finished"; }).length;
      var finished = tasks.length - working;
      var text = working > 0 ? working + " working" : "All done";
      var line = working > 0 ? (finished > 0 ? finished + " done" : "") : tasks.length === 1 ? "The task is finished" : tasks.length + " tasks finished";
      var key = text + "|" + line;
      if (key === sayKey) return;
      var first = sayKey === "";
      sayKey = key;
      setText(word, text);
      setText(sub, line);
      sub.hidden = line === "";
      if (!first) {
        rise(word, 0, 3);
        if (!sub.hidden) rise(sub, 70, 2);
      }
    }

    // ---- task cards -----------------------------------------------------

    function buildCard(entry) {
      var node = el("div", "card");
      var parts = { bar: el("div", "bar"), head: el("div", "head"), agent: el("span", "agent"), since: el("span", "since"), what: el("div", "what"), where: el("div", "where") };
      parts.what.dir = "auto";
      parts.where.dir = "auto";
      parts.head.append(parts.agent, parts.since);
      node.append(parts.bar, parts.head, parts.what, parts.where);
      node.style.setProperty("--band", entry.hue.band);
      node.style.setProperty("--text", entry.hue.text);
      return { node: node, parts: parts, done: undefined };
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
      entry.done = said.done;
      // As its band thins back to white, the card settles a hair and its time rises in.
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
        return;
      }
      // The band shoots out from the prism first (the light does that), then its card lands at its end.
      entry.node.animate([{ opacity: 0, transform: "translateX(3.2vmin)" }, { opacity: 1, transform: "translateX(0)" }],
        { duration: SETTLE.duration, delay: 220 + order * 70, easing: SETTLE.easing, fill: "backwards" });
    }

    function leave(entry) {
      var to = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateX(2vmin)" };
      var motion = entry.node.animate([{}, to], { duration: 200, easing: EASE_OUT, fill: "forwards" });
      motion.onfinish = function () { entry.node.remove(); };
    }

    function placeCards() {
      var g = geometry(window.innerWidth, window.innerHeight, cards.size);
      var i = 0;
      cards.forEach(function (entry) {
        var slot = g.slots[i++];
        if (!slot) { entry.node.style.display = "none"; return; }
        entry.node.style.display = "";
        entry.node.style.left = g.colL + "px";
        entry.node.style.width = g.colR - g.colL + "px";
        entry.node.style.top = slot.top + "px";
        entry.node.style.height = slot.height + "px";
        entry.node.classList.toggle("roomy", slot.height >= 0.145 * g.h);
        entry.node.classList.toggle("tight", slot.height < 0.12 * g.h);
        entry.node.classList.toggle("tighter", slot.height < 0.085 * g.h);
      });
      var last = g.slots[g.slots.length - 1];
      more.hidden = cards.size <= MAX_CARDS || !last;
      if (!more.hidden) {
        more.textContent = "+" + (cards.size - MAX_CARDS) + " more";
        more.style.left = g.colL + 2.6 * g.vmin + "px";
        more.style.top = last.top + last.height + 0.4 * g.vmin + "px";
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

    // ---- the call -------------------------------------------------------

    var STEPS = [4.6, 4.1, 3.6, 3.2, 2.8, 2.5];
    var monoAsked = false;
    function fitCommand() {
      var command = callBody && callBody.querySelector(".command");
      if (!command) return;
      if (!monoAsked && document.fonts && !document.fonts.check("500 40px 'Prism Mono'")) {
        monoAsked = true;
        document.fonts.load("500 40px 'Prism Mono'").then(fitCommand, function () {});
      }
      command.classList.remove("long");
      for (var i = 0; i < STEPS.length; i++) {
        command.style.fontSize = STEPS[i] + "vmin";
        if (command.scrollWidth <= command.clientWidth + 1) return;
      }
      // Too long for one line even small: break it at spaces, at a size that still reads across a room.
      command.classList.add("long");
      command.style.fontSize = "3.2vmin";
    }

    // The call stands in the column right of the glass: NEEDS YOU above the beam, the rest under it.
    function placeCall() {
      var g = geometry(window.innerWidth, window.innerHeight, 0), v = g.vmin;
      var half = 1.2 * v;
      callTop.style.left = callBody.style.left = g.callL + "px";
      callTop.style.width = callBody.style.width = g.colR - g.callL + "px";
      callTop.style.top = "auto";
      callTop.style.bottom = g.h - (g.lineAt(g.callL) - half - 3.6 * v) + "px";
      callBody.style.top = g.lineAt(g.colR) + half + 3.6 * v + "px";
    }

    function drawCall(first, others, state) {
      var at = first.approval_since_ms !== undefined ? first.approval_since_ms : first.updated_at_ms;
      var waited = state.nowMs - at;
      var key = JSON.stringify([first.source, first.session, Math.floor(waited / MINUTE), others, first.request || "", first.project || ""]);
      if (key === callKey) return false;
      var isNew = callKey === "" || JSON.parse(callKey)[1] !== first.session;
      callKey = key;
      var hue = hueOf(first.source);
      callBody.style.setProperty("--hue", hue.text);
      callTop.replaceChildren(el("div", "big", "Needs you"));
      var who = el("div", "who");
      who.append(el("span", "agent", agentName(first.source, state.agents)), el("span", "since", "waiting " + duration(waited)));
      var parts = [who];
      if (first.request) {
        // Each word of the command is kept whole, so a long one breaks only at spaces,
        // never after a dash inside a flag.
        var command = el("div", "command");
        first.request.split(/( +)/).forEach(function (part) {
          if (part === "") return;
          if (/^ +$/.test(part) || part.length > 26) command.appendChild(document.createTextNode(part));
          else command.appendChild(el("span", "word", part));
        });
        command.dir = "auto";
        parts.push(el("div", "label", "Wants to run"), command);
      } else {
        parts.push(el("div", "label", "Wants"), el("div", "note", "Look at the terminal"));
      }
      if (first.project) {
        var project = el("div", "project");
        project.dir = "auto";
        project.append(el("span", "in", "in "), document.createTextNode(first.project));
        parts.push(project);
      }
      if (others > 0) parts.push(el("div", "more", "+" + others + " more waiting"));
      callBody.replaceChildren.apply(callBody, parts);
      fitCommand();
      return isNew;
    }

    // The one big move: the spectrum folds into the beam (the light does that), and
    // NEEDS YOU lands above it a beat later, then who, what and where under it.
    function land() {
      var parts = [callTop.firstChild].concat(Array.prototype.slice.call(callBody.children));
      parts.forEach(function (node, i) {
        if (!node) return;
        if (reduce.matches) {
          node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 80 + i * 40, easing: "ease-out", fill: "backwards" });
          return;
        }
        var first = i === 0;
        node.animate([{ opacity: 0, transform: "translateY(" + (first ? 6 : -2.4) + "vmin)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: first ? LAND.duration : SETTLE.duration, delay: first ? 240 : 320 + i * 55, easing: first ? LAND.easing : SETTLE.easing, fill: "backwards" });
      });
    }

    // ---- the time -------------------------------------------------------

    function placeTime() {
      var g = geometry(window.innerWidth, window.innerHeight, 0), v = g.vmin, e = edges(g);
      clock.style.left = date.style.left = g.callL + "px";
      // above the red, with room for a heartbeat to pass under it
      clock.style.bottom = g.h - (e.top(g.callL) - 5.4 * v) + "px";
      date.style.top = e.foot(g.colR) + 3 * v + "px";
    }

    function drawTime(nowMs) {
      var moment = new Date(nowMs);
      setText(clock, pad2(moment.getHours()) + ":" + pad2(moment.getMinutes()));
      setText(date, WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()]);
    }

    // ---- the whole board ------------------------------------------------

    function draw(state) {
      if (!box) return;
      var resting = show === "time" || state.cards.length === 0 || state.display !== "main";
      var waiting = resting ? [] : approvals(state.cards);
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
            fade(cardsBox, wordsShown);
          }
          if (mood === "call") { fade(callTop, false); fade(callBody, false); }
          if (next === "call") [callTop, callBody].forEach(function (node) { node.getAnimations().forEach(function (a) { a.cancel(); }); });
          if (next === "rest") { rise(clock, 0, 3); rise(date, 90, 2); }
        } else if (next !== "work") {
          [say, cardsBox].forEach(function (node) { node.style.opacity = "0"; });
        }
        if (next === "work") [say, cardsBox].forEach(function (node) { node.style.opacity = ""; });
      }
      mood = next;
      if (!resting) drawSay(tasks);
      drawCards(tasks, state);
    }

    function setShow(options) {
      show = options.show === "time" ? "time" : "agents";
    }

    var onResize = function () {
      placeCards();
      placeCall();
      placeTime();
      fitCommand();
    };

    return {
      mount: function (root, ctx) {
        // Fill the whole screen, not the fade-in wrapper the runtime puts around us.
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = el("style");
        style.textContent = STYLE;
        box = el("div", "dsb");
        stage = el("div", "stage");
        say = el("div", "say");
        word = el("div", "word");
        sub = el("div", "sub");
        sub.hidden = true;
        say.append(word, sub);
        cardsBox = el("div", "cards");
        more = el("div", "more");
        more.hidden = true;
        cardsBox.appendChild(more);
        callTop = el("div", "call-top");
        callBody = el("div", "call-body");
        clock = el("div", "clock");
        date = el("div", "date");
        stage.append(say, cardsBox, callTop, callBody, clock, date);
        box.appendChild(stage);
        root.append(style, box);
        setShow(ctx.options);
        onResize();
        // The words do not sway with the light: moved by fractions of a pixel, text
        // is painted again at each step and its edges shimmer. The ground keeps the
        // ends of the bands still, so each band still meets its card.
        if (document.fonts && document.fonts.load) document.fonts.load("600 40px 'Prism Sans'").then(onResize, function () {});
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
        box = stage = say = word = sub = cardsBox = more = callTop = callBody = clock = date = lastState = undefined;
        cards.clear();
        mood = sayKey = callKey = "";
      },
    };
  });
})();
