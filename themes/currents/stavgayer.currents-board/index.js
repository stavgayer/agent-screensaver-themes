// The Currents board: the statement, the task cards and the approval card in
// one component, because they answer the same mood as the current behind them.
//
// Every word sits on a dark plate, flat on the left edge of the screen and round
// where it ends. The lined surface behind moves all the time, so the plates keep
// the text readable everywhere on it.
//
// Each task card sits right under its agent's ball in the surface, and carries
// the hue of that ball's thread. A finished card turns to paper as its thread
// fades. When an agent waits, its colour floods the surface (the ground does that) and
// one large card says what it wants to run.
//
// Only the fields the state gives are shown, so privacy mode keeps working.
// Motion is transform and opacity only, with CSS animations and the Web
// Animations API; there is no per-frame script. With reduced motion nothing
// travels: cards and words fade in place.
(function () {
  var MINUTE = 60000;
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");

  var OWN = { claude: "#ff6a3d", codex: "#9d8cff", cursor: "#ffc94a" };
  var SPARE = ["#ff5fa2", "#5fd3c4", "#ff8f5a", "#c7a6ff", "#f2e266", "#7fb2ff"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var STYLE = [
    "@font-face { font-family: 'CS Display'; src: url('" + base + "fonts/Fraunces.ttf') format('truetype'); font-weight: 100 900; }",
    "@font-face { font-family: 'CS Text'; src: url('" + base + "fonts/Outfit.ttf') format('truetype'); font-weight: 100 900; }",
    "@font-face { font-family: 'CS Mono'; src: url('" + base + "fonts/JetBrainsMono.woff2') format('woff2'); font-weight: 100 800; }",
    ".csb { --plate: #120a1f; --cream: #f4ecdf; --muted: #c3b6d6; --paper: #f4ecdf; --ink: #140b24; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);",
    "  position: absolute; inset: 0; overflow: hidden; color: var(--cream); font-family: 'CS Text', 'Helvetica Neue', sans-serif;",
    "  font-weight: 600; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }",
    // the same slow drift as the current, so each card stays under its ball
    ".csb .stage { position: absolute; inset: 0; will-change: transform; animation: csb-drift 240s ease-in-out infinite alternate; }",
    "@keyframes csb-drift { from { transform: translate(-1.4vmin, -0.9vmin); } to { transform: translate(1.4vmin, 0.9vmin); } }",
    // plates: flat on the screen edge, round where they end
    ".csb .plate { position: absolute; left: -4vmin; display: flex; align-items: center; box-sizing: border-box; background: var(--plate);",
    "  border-radius: 0 999px 999px 0; white-space: nowrap; box-shadow: 0 1.2vmin 3vmin rgba(8, 3, 16, 0.35); }",
    ".csb .hero { top: 16vh; height: 20vmin; padding: 0 9vmin 0 9vmin; }",
    // the display face: Fraunces, soft and wonky, as heavy as it goes
    ".csb .display { font-family: 'CS Display', Georgia, serif; font-variation-settings: 'SOFT' 100, 'WONK' 1; font-optical-sizing: auto; }",
    ".csb .hero .word { display: inline-block; font-size: 15vmin; font-weight: 900; line-height: 1; letter-spacing: -0.035em; padding-bottom: 0.1em; }",
    ".csb .sub { top: calc(16vh + 21.4vmin); height: 7.6vmin; padding: 0 5vmin 0 9vmin; gap: 2.2vmin; }",
    ".csb .sub .word { font-size: 3.6vmin; font-weight: 500; letter-spacing: -0.01em; color: var(--cream); }",
    ".csb .sub[hidden] { display: none; }",
    ".csb .dots { display: flex; gap: 1vmin; }",
    ".csb .dots:empty { display: none; }",
    // tiny gunmetal balls: near black, one hard highlight, a soft lift toward the foot
    ".csb .dots span { width: 3vmin; height: 3vmin; border-radius: 50%; box-shadow: inset 0 0 0 0.2vmin #0b0812;",
    "  background: radial-gradient(circle at 34% 30%, #ffffff 0 12%, rgba(255,255,255,0) 20%),",
    "  radial-gradient(circle at 50% 85%, #6a6276 0%, #2a2532 45%, #111017 75%); }",
    ".csb.time .hero { top: 18vh; height: 36vmin; padding: 0 12vmin 0 9vmin; }",
    ".csb.time .hero .word { font-size: 31vmin; letter-spacing: -0.04em; font-weight: 800; padding-bottom: 0.04em; }",
    ".csb.time .sub { top: calc(18vh + 37.6vmin); height: 9vmin; }",
    ".csb.time .sub .word { font-size: 4.4vmin; }",
    // task cards, one under each ball
    ".csb .cards { position: absolute; left: 5vmin; right: 5vmin; bottom: 5vmin; display: flex; align-items: flex-end; gap: 2.6vmin;",
    "  transition: opacity 260ms var(--ease-out), transform 260ms var(--ease-out); }",
    ".csb.call .cards { opacity: 0; transform: translateY(4vmin); }",
    ".csb .card { flex: none; width: min(30vw, calc((100vw - 10vmin - (var(--n) - 1) * 2.6vmin) / var(--n))); min-width: 0; box-sizing: border-box; container-type: inline-size;",
    "  background: var(--plate); color: var(--cream); border-radius: 3.2vmin; padding: 2.6vmin 2.8vmin 2.8vmin;",
    "  box-shadow: 0 1.4vmin 3.4vmin rgba(8, 3, 16, 0.4); transition: background-color 700ms var(--ease-out), color 700ms var(--ease-out); }",
    ".csb .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; column-gap: 1.6vmin; row-gap: 0; font-size: min(2.5vmin, max(1.2vmin, calc(100cqi / 6.4))); line-height: 1.25; white-space: nowrap; }",
    // the agent name keeps its full width; when the time does not fit beside it, the time drops to its own line
    ".csb .head .agent { color: var(--hue); flex: 0 1 auto; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }",
    ".csb .head .since { flex: none; color: var(--muted); font-weight: 500; }",
    ".csb .card .state { display: flex; align-items: center; gap: 0.2em; margin-top: 1vmin; font-size: min(7.6vmin, calc(100cqi / 4.5)); font-weight: 900; line-height: 1;",
    "  color: var(--hue); letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; padding-bottom: 0.12em; }",
    ".csb .card .state .word { display: inline-block; }",
    ".csb .card .state svg { flex: none; width: 0.7em; height: 0.7em; }",
    ".csb .card .state svg path { fill: none; stroke: currentColor; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }",
    ".csb .card .what { margin-top: 1.4vmin; font-size: 2.9vmin; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }",
    ".csb .card .where { margin-top: 1vmin; font-size: 2.2vmin; font-weight: 500; line-height: 1.2; color: var(--muted); white-space: nowrap;",
    "  overflow: hidden; text-overflow: ellipsis; }",
    ".csb .card .what[hidden], .csb .card .where[hidden] { display: none; }",
    // a finished card turns to paper, as its thread fades
    ".csb .card.done { background: var(--paper); color: var(--ink); }",
    ".csb .card.done .head .agent, .csb .card.done .state { color: var(--ink); }",
    ".csb .card.done .head .since, .csb .card.done .where { color: #4a3d5e; }",
    // the approval card
    ".csb .call { position: absolute; left: -4vmin; top: calc(16vh + 23vmin); width: 61vw; box-sizing: border-box; background: var(--plate); color: var(--cream);",
    "  border-radius: 0 5vmin 5vmin 0; box-shadow: 0 1.6vmin 4vmin rgba(8, 3, 16, 0.45); padding: 3.6vmin 6vmin 4.4vmin 9vmin; opacity: 0; visibility: hidden; }",
    ".csb.call .call { opacity: 1; visibility: visible; }",
    ".csb .call .top { display: flex; align-items: baseline; gap: 3vmin; font-size: 4.2vmin; line-height: 1.25; white-space: nowrap; }",
    ".csb .call .top .agent { color: var(--hue); font-weight: 700; overflow: hidden; text-overflow: ellipsis; }",
    ".csb .call .top .since { color: var(--cream); font-weight: 500; flex: none; }",
    ".csb .call .top .more { margin-left: auto; flex: none; color: var(--muted); font-weight: 500; font-size: 3vmin; }",
    ".csb .call .body { margin-top: 3.4vmin; display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 3.4vmin; row-gap: 2.4vmin; align-items: baseline; }",
    ".csb .call .label { font-size: 2.5vmin; font-weight: 500; color: var(--muted); }",
    // The command keeps one line: it steps down in size to fit the card. Only a
    // command too long even at the smallest step breaks, at spaces, into up to three lines.
    ".csb .call .command { font-family: 'CS Mono', ui-monospace, Menlo, monospace; font-size: 5.6vmin; font-weight: 700; line-height: 1.25;",
    "  letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; min-width: 0; }",
    ".csb .call .command.long { white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }",
    ".csb .call .note { font-size: 4vmin; font-weight: 600; line-height: 1.15; }",
    ".csb .call .project { font-size: 3.4vmin; font-weight: 600; line-height: 1.15; overflow-wrap: anywhere; }",
    "@media (prefers-reduced-motion: reduce) { .csb .stage { animation: none; } .csb .cards { transition-property: opacity; } .csb.call .cards { transform: none; } }",
  ].join("\n");

  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"/></svg>';
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

  window.agentScreensaver.register(function () {
    var box, stage, hero, heroWord, sub, subWord, dots, cardsBox, call, lastState;
    var show = "agents", mood = "", heroKey = "", callKey = "";
    var cards = new Map();

    // ---- the statement --------------------------------------------------

    function statement(state, waiting, tasks) {
      var moment = new Date(state.nowMs);
      var time = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
      var date = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      if (show === "time" || (tasks.length === 0 && waiting.length === 0)) return { time: true, word: time, sub: date, dots: 0 };
      if (waiting.length > 0) return { time: false, word: "Needs you", sub: "", dots: 0 };
      var working = tasks.filter(function (card) { return card.kind !== "finished"; }).length;
      if (working === 0) return { time: false, word: "All done", sub: tasks.length === 1 ? "The task is finished" : tasks.length + " tasks finished", dots: tasks.length };
      return { time: false, word: working + " in motion", sub: "", dots: 0 };
    }

    function drawHero(said) {
      var key = said.word + "|" + said.sub + "|" + said.dots;
      if (key === heroKey) return;
      var first = heroKey === "";
      var wordChanged = heroWord.textContent !== said.word;
      heroKey = key;
      box.classList.toggle("time", said.time);
      setText(heroWord, said.word);
      setText(subWord, said.sub);
      var count = Math.min(said.dots, 8);
      if (dots.children.length !== count) {
        dots.replaceChildren();
        for (var i = 0; i < count; i++) {
          var dot = el("span");
          dots.appendChild(dot);
          if (!first && !reduce.matches) dot.animate([{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }],
            { duration: SETTLE.duration, delay: 180 + i * 70, easing: SETTLE.easing, fill: "backwards" });
        }
      }
      sub.hidden = said.sub === "";
      // A new word rises into its plate; the clock's minute change is not news.
      if (!first && wordChanged && !said.time) rise(heroWord, 0);
      if (!first && !sub.hidden && wordChanged) rise(subWord, 80);
    }

    function rise(node, delay) {
      var from = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateY(35%)" };
      var to = reduce.matches ? { opacity: 1 } : { opacity: 1, transform: "translateY(0)" };
      node.animate([from, to], { duration: 420, delay: delay, easing: EASE_OUT, fill: "backwards" });
    }

    // ---- task cards -----------------------------------------------------

    function buildCard(card) {
      var node = el("div", "card");
      var head = el("div", "head");
      var parts = { agent: el("span", "agent"), since: el("span", "since"), state: el("div", "state display"), word: el("span", "word"),
        what: el("div", "what"), where: el("div", "where") };
      head.append(parts.agent, parts.since);
      parts.state.appendChild(parts.word);
      parts.what.dir = "auto";
      parts.where.dir = "auto";
      node.append(head, parts.state, parts.what, parts.where);
      node.style.setProperty("--hue", hueOf(card.source));
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
      setText(parts.word, said.word);
      if (entry.tone !== said.tone) {
        entry.node.classList.toggle("done", said.tone === "done");
        var mark = parts.state.querySelector("svg");
        if (said.tone === "done" && !mark) parts.state.insertAdjacentHTML("afterbegin", CHECK);
        if (said.tone !== "done" && mark) mark.remove();
      }
      entry.tone = said.tone;
      entry.word = said.word;
      if (changed) stamp(entry);
    }

    // The change happens on the card: it takes a small press and the new word rises in.
    function stamp(entry) {
      rise(entry.parts.word, 0);
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

    var STEPS = [5.6, 5, 4.4, 3.9, 3.4, 3];
    var monoAsked = false;
    function fitCommand() {
      var command = call && call.querySelector(".command");
      if (!command) return;
      // Measure in the real face: wait for it once if it is not loaded yet.
      if (!monoAsked && document.fonts && !document.fonts.check("700 40px 'CS Mono'")) {
        monoAsked = true;
        document.fonts.load("700 40px 'CS Mono'").then(fitCommand, function () {});
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
      // The card arrives a beat after the current starts to bloom, from the left, as the plates do.
      call.animate(
        [{ opacity: 0, transform: "translateX(-16vmin)" }, { opacity: 1, transform: "translateX(0)" }],
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
        box = el("div", "csb");
        stage = el("div", "stage");
        hero = el("div", "plate hero");
        heroWord = el("span", "word display");
        hero.appendChild(heroWord);
        sub = el("div", "plate sub");
        subWord = el("span", "word");
        dots = el("div", "dots");
        sub.append(dots, subWord);
        sub.hidden = true;
        cardsBox = el("div", "cards");
        call = el("div", "call");
        stage.append(hero, sub, cardsBox, call);
        box.appendChild(stage);
        root.append(style, box);
        setShow(ctx.options);
        window.addEventListener("resize", fitCommand);
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
        window.removeEventListener("resize", fitCommand);
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = stage = hero = heroWord = sub = subWord = dots = cardsBox = call = lastState = undefined;
        cards.clear();
        mood = heroKey = callKey = "";
      },
    };
  });
})();
