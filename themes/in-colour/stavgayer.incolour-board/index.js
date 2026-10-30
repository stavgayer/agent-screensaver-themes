// The In Colour board: the statement, the task cards and the approval card in
// one component, because they answer the same mood as the wheel behind them.
//
// Everything that carries words sits on a white "leg": a flat white slab cut
// at 45 degrees, the one shape on the record sleeve that is not colour. In
// the bright moods (agents working, an agent waiting) the legs are white and
// the ink is black, so text passes on every hue the wheel turns past. In the
// rest mood (all done, or no tasks) the wheel goes dark, the legs drop away
// and the ink turns white.
//
// Each agent owns one hue of the wheel. Its cards carry that hue as a solid
// band, and when it waits for you the whole wheel turns to that hue.
//
// Only the fields the state gives are shown, so privacy mode keeps working.
// Motion is transform and opacity only, with CSS animations and the Web
// Animations API; there is no per-frame script. With reduced motion nothing
// travels: cards and words fade in place.
(function () {
  var MINUTE = 60000;
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");

  var OWN = { claude: "#e6471d", codex: "#1d61ac", cursor: "#1a9d3f" };
  var SPARE = ["#da0581", "#f7a416", "#5c2578", "#159dd7", "#b0cc20", "#dd0834"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var STYLE = [
    "@font-face { font-family: 'IC Grotesk'; src: url('" + base + "fonts/SpaceGrotesk.ttf') format('truetype'); font-weight: 300 700; }",
    "@font-face { font-family: 'IC Mono'; src: url('" + base + "fonts/JetBrainsMono.woff2') format('woff2'); font-weight: 100 800; }",
    ".icb { --ink: #0b0b0b; --paper: #ffffff; --ease-out: cubic-bezier(0.23, 1, 0.32, 1);",
    "  position: absolute; inset: 0; overflow: hidden; color: var(--ink); font-family: 'IC Grotesk', 'Helvetica Neue', sans-serif;",
    "  font-weight: 700; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }",
    ".icb.rest { --ink: #ffffff; }",
    // a very slow drift of everything, against burn-in
    ".icb .stage { position: absolute; inset: 0; will-change: transform; animation: icb-drift 210s ease-in-out infinite alternate; }",
    "@keyframes icb-drift { from { transform: translate(-1.2vmin, 0.8vmin); } to { transform: translate(1.2vmin, -0.8vmin); } }",
    // the legs
    ".icb .leg { position: absolute; left: -3vmin; display: flex; align-items: center; box-sizing: border-box; height: var(--h);",
    "  padding: 0 calc(var(--h) + 2vmin) 0 calc(3vmin + 5vmin); background: var(--paper); color: #0b0b0b;",
    "  clip-path: polygon(0 0, 100% 0, calc(100% - var(--h)) 100%, 0 100%); white-space: nowrap;",
    "  transition: background-color 900ms var(--ease-out), color 900ms var(--ease-out); }",
    ".icb.rest .leg { background: transparent; color: #ffffff; }",
    ".icb .hero { --h: 21vmin; top: 18.5vh; }",
    ".icb .hero .word { display: inline-block; font-size: 17vmin; line-height: 1; letter-spacing: -0.045em; text-transform: uppercase; }",
    ".icb .sub { --h: 8vmin; top: calc(18.5vh + 21vmin - 1px); }",
    ".icb .sub .word { font-size: 4.6vmin; font-weight: 600; letter-spacing: -0.02em; }",
    ".icb.time .hero { --h: 40vmin; top: 25vh; }",
    ".icb.time .hero .word { font-size: 39vmin; letter-spacing: -0.05em; }",
    ".icb.time .sub { --h: 9vmin; top: calc(25vh + 40vmin - 1px); }",
    ".icb.time .sub .word { font-size: 5vmin; }",
    ".icb .sub[hidden] { display: none; }",
    // the song (state.nowPlaying, agent-screensaver 0.4.0): one more leg, under the lowest one shown (placeSong sets its top)
    ".icb .song { --h: 8vmin; top: calc(18.5vh + 21vmin + 2vmin); gap: 1.6vmin; max-width: 64vw; transition: background-color 900ms var(--ease-out), color 900ms var(--ease-out), opacity 260ms var(--ease-out); }",
    ".icb .song[hidden], .icb .song .ring[hidden], .icb .song .who[hidden] { display: none; }",
    ".icb.call .song, .icb.bare .song { opacity: 0; }",
    ".icb .song .ring { flex: none; width: 4.6vmin; height: 4.6vmin; }",
    ".icb .song svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".icb .song circle { fill: none; stroke: currentColor; stroke-width: 6; }",
    ".icb .song .track { opacity: 0.2; }",
    ".icb .song .words { min-width: 0; display: flex; flex-direction: column; gap: 0.3vmin; line-height: 1.1; }",
    ".icb .song .title { font-size: 3vmin; letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; }",
    ".icb .song .who { font-size: 2.2vmin; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }",
    // all done: the spectrum settles into the hues of the agents that did the work
    ".icb .chord { display: flex; gap: 1.4vmin; margin: 0 3.4vmin 0 2vmin; }",
    ".icb .chord:empty { display: none; }",
    ".icb .chord span { display: block; width: 7vmin; height: 4.4vmin; background: var(--hue); transform: skewX(-45deg); }",
    // task cards
    ".icb .cards { position: absolute; left: 5vmin; right: 5vmin; bottom: 5vmin; display: flex; align-items: flex-end; gap: 2.6vmin;",
    "  transition: opacity 260ms var(--ease-out), transform 260ms var(--ease-out); }",
    ".icb.call .cards { opacity: 0; transform: translateY(4vmin); }",
    ".icb .card { flex: 0 1 30vw; min-width: 0; container-type: inline-size; background: var(--paper); color: #0b0b0b;",
    "  clip-path: polygon(0 0, calc(100% - 5vmin) 0, 100% 5vmin, 100% 100%, 0 100%); }",
    ".icb .band { display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: 1.6vmin; row-gap: 0; padding: 1.2vmin 6vmin 1.2vmin 2.2vmin;",
    "  background: var(--hue); color: var(--on-hue); font-size: min(2.3vmin, max(1.2vmin, calc((100cqi - 8.2vmin) / 6.6))); font-weight: 600; line-height: 1.25; white-space: nowrap; }",
    // the agent name keeps its full width; when the time does not fit beside it, the time drops to its own line
    ".icb .band .agent { flex: 0 1 auto; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }",
    ".icb .band .since { flex: none; }",
    ".icb .card .state { display: flex; align-items: center; gap: 0.16em; padding: 2.2vmin 2.2vmin 0.6vmin; font-size: min(7vmin, calc((100cqi - 4.4vmin) / 4.3)); line-height: 0.95; color: var(--hue-ink);",
    "  letter-spacing: -0.045em; text-transform: uppercase; white-space: nowrap; overflow: hidden; }",
    ".icb .card .state .word { display: inline-block; }",
    ".icb .card .state svg { flex: none; width: 0.74em; height: 0.74em; }",
    ".icb .card .state svg path { fill: none; stroke: currentColor; stroke-width: 3.4; stroke-linecap: square; }",
    ".icb .card .what { padding: 0.8vmin 2.2vmin 0; font-size: 2.8vmin; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }",
    ".icb .card .where { padding: 1.2vmin 2.2vmin 2.4vmin; font-size: 2.1vmin; font-weight: 500; line-height: 1.2; white-space: nowrap;",
    "  overflow: hidden; text-overflow: ellipsis; }",
    ".icb .card .what[hidden], .icb .card .where[hidden] { display: none; }",
    ".icb .card.done .state { color: #ffffff; }",
    ".icb .card.done { background: #0b0b0b; color: #ffffff; transition: background-color 900ms var(--ease-out); }",
    ".icb.rest .card.done { background: transparent; }",
    // the approval card
    ".icb .call { position: absolute; left: -3vmin; top: calc(18.5vh + 25vmin); width: 84vw; background: var(--paper); color: #0b0b0b;",
    "  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 9vmin), calc(100% - 9vmin) 100%, 0 100%); opacity: 0; visibility: hidden; }",
    ".icb.call .call { opacity: 1; visibility: visible; }",
    ".icb .call .band { padding: 1.8vmin 4vmin 1.8vmin 8vmin; font-size: 3.6vmin; justify-content: flex-start; gap: 3vmin; }",
    ".icb .call .band .agent { flex: 0 1 auto; }",
    ".icb .call .band .more { margin-left: auto; flex: none; }",
    ".icb .call .body { padding: 4vmin 12vmin 5vmin 8vmin; display: grid; grid-template-columns: max-content minmax(0, 1fr);",
    "  column-gap: 3.4vmin; row-gap: 2.2vmin; align-items: baseline; }",
    ".icb .call .label { font-size: 2.6vmin; font-weight: 500; }",
    ".icb .call .command { font-family: 'IC Mono', ui-monospace, Menlo, monospace; font-size: 6.4vmin; font-weight: 700; line-height: 1.25;",
    "  letter-spacing: -0.02em; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }",
    ".icb .call .note { font-size: 4vmin; font-weight: 600; line-height: 1.15; }",
    ".icb .call .project { font-size: 3.4vmin; font-weight: 600; line-height: 1.15; overflow-wrap: anywhere; }",
    "@media (prefers-reduced-motion: reduce) { .icb .stage { animation: none; } .icb .cards { transition-property: opacity; } .icb.call .cards { transform: none; } }",
  ].join("\n");

  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5 9.5 18.5 20.5 5.5"/></svg>';
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
  var SETTLE = spring(230, 22); // overshoots a hair, then settles
  var LAND = spring(520, 40); // lands firmly, almost no bounce
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  // Black or white, whichever reads better on the hue (WCAG contrast).
  function inkOn(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    var onBlack = (l + 0.05) / 0.05, onWhite = 1.05 / (l + 0.05);
    return onBlack >= onWhite ? "#0b0b0b" : "#ffffff";
  }

  function contrastOnWhite(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 1.05 / (0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2] + 0.05);
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
    var box, stage, hero, heroWord, sub, subWord, chord, cardsBox, call, lastState;
    var song, track, cancelSong, now;
    var show = "agents", mood = "", heroKey = "", callKey = "";
    var cards = new Map();

    // ---- the statement --------------------------------------------------

    function statement(state, waiting, tasks) {
      var moment = new Date(state.nowMs);
      var time = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
      var date = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      if (show === "time" || (tasks.length === 0 && waiting.length === 0)) return { time: true, word: time, sub: date };
      if (waiting.length > 0) return { time: false, word: "Needs you", sub: "" };
      var working = tasks.filter(function (card) { return card.kind !== "finished"; }).length;
      if (working === 0) return { time: false, word: "All done", sub: tasks.length === 1 ? "The task is finished" : tasks.length + " tasks finished",
        hues: tasks.map(function (card) { return hueOf(card.source); }) };
      return { time: false, word: working + " at work", sub: "" };
    }

    function drawHero(said) {
      var hues = said.hues || [];
      var key = said.word + "|" + said.sub + "|" + hues.join(",");
      if (key === heroKey) return;
      var first = heroKey === "";
      var wordChanged = heroWord.textContent !== said.word;
      heroKey = key;
      box.classList.toggle("time", said.time);
      setText(heroWord, said.word);
      setText(subWord, said.sub);
      chord.replaceChildren.apply(chord, hues.map(function (hue, i) {
        var swatch = el("span");
        swatch.style.setProperty("--hue", hue);
        if (!first && !reduce.matches) swatch.animate([{ opacity: 0, transform: "skewX(-45deg) translateX(-3vmin)" }, { opacity: 1, transform: "skewX(-45deg) translateX(0)" }],
          { duration: SETTLE.duration, delay: 160 + i * 70, easing: SETTLE.easing, fill: "backwards" });
        return swatch;
      }));
      sub.hidden = said.sub === "";
      // A new word rises into its leg; the clock's minute change is not news.
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
      var band = el("div", "band");
      var parts = { agent: el("span", "agent"), since: el("span", "since"), state: el("div", "state"), word: el("span", "word"),
        what: el("div", "what"), where: el("div", "where") };
      band.append(parts.agent, parts.since);
      parts.state.appendChild(parts.word);
      parts.what.dir = "auto";
      parts.where.dir = "auto";
      node.append(band, parts.state, parts.what, parts.where);
      var hue = hueOf(card.source);
      node.style.setProperty("--hue", hue);
      node.style.setProperty("--on-hue", inkOn(hue));
      node.style.setProperty("--hue-ink", contrastOnWhite(hue) >= 3 ? hue : "#0b0b0b");
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
      entry.node.animate([{ transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: SETTLE.duration, easing: SETTLE.easing });
    }

    function enter(entry, order) {
      if (reduce.matches) {
        entry.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: order * 60, easing: "ease-out", fill: "backwards" });
        return;
      }
      entry.node.animate(
        [{ opacity: 0, transform: "translateY(10vmin) scale(0.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
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
      var hue = hueOf(first.source);
      var key = JSON.stringify([first.source, first.session, Math.floor(waited / MINUTE), more, first.request || "", first.project || ""]);
      if (key === callKey) return;
      callKey = key;
      var band = el("div", "band");
      band.style.setProperty("--hue", hue);
      band.style.setProperty("--on-hue", inkOn(hue));
      band.append(el("span", "agent", agentName(first.source, state.agents)), el("span", "since", "waiting " + duration(waited)));
      if (more > 0) band.appendChild(el("span", "more", "+" + more + " more waiting"));
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
      call.replaceChildren(band, body);
    }

    function land() {
      if (reduce.matches) {
        call.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
        return;
      }
      // The card arrives a beat after the wheel starts to turn, from the left, as the leg does.
      call.animate(
        [{ opacity: 0, transform: "translateX(-18vmin)" }, { opacity: 1, transform: "translateX(0)" }],
        { duration: LAND.duration, delay: 180, easing: LAND.easing, fill: "backwards" },
      );
    }

    // ---- the whole board ------------------------------------------------

    // ---- the song --------------------------------------------------------

    var RADIUS = 19;
    var ARC = 2 * Math.PI * RADIUS;

    function svgNode(tag, attributes) {
      var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
      return node;
    }

    function buildSong() {
      var leg = el("div", "leg song");
      leg.hidden = true;
      var ring = el("div", "ring");
      var svg = svgNode("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
      var arc = svgNode("circle", { class: "arc", cx: 24, cy: 24, r: RADIUS, "stroke-dasharray": "0 " + ARC.toFixed(2) });
      svg.append(svgNode("circle", { class: "track", cx: 24, cy: 24, r: RADIUS }), arc);
      ring.appendChild(svg);
      var words = el("div", "words");
      var title = el("div", "title");
      var who = el("div", "who");
      words.append(title, who);
      leg.append(ring, words);
      return { leg: leg, ring: ring, arc: arc, title: title, who: who };
    }

    // How far the song is, 0 to 1, moved on from when it was read; null when the
    // app gives no length (Music, for songs it streams).
    function songProgress(next, nowMs) {
      if (!(next.duration_ms > 0)) return null;
      var at = next.position_ms + Math.max(0, nowMs - next.at_ms);
      return Math.min(1, Math.max(0, at / next.duration_ms));
    }

    // Under the lowest leg shown, unless the task cards reach that high: then
    // just above them. Layout positions, so the drift and a card rising in do not move it.
    function placeSong() {
      if (!song || song.leg.hidden) return;
      var vmin = Math.min(box.clientWidth, box.clientHeight) / 100;
      var gap = 2 * vmin;
      var above = sub.hidden ? hero : sub;
      var top = above.offsetTop + above.offsetHeight + gap;
      var height = song.leg.offsetHeight;
      var cardsTop = Infinity;
      Array.prototype.forEach.call(cardsBox.children, function (card) { cardsTop = Math.min(cardsTop, cardsBox.offsetTop + card.offsetTop); });
      if (top + height + gap > cardsTop) top = Math.max(above.offsetTop + above.offsetHeight, cardsTop - gap - height);
      song.leg.style.top = top + "px";
    }

    // The ring moves on between the service's reads, a few times a second, and the leg keeps its place.
    function tickSong() {
      if (!song || !track) return;
      var progress = songProgress(track, now());
      song.ring.hidden = progress === null;
      if (progress !== null) song.arc.setAttribute("stroke-dasharray", (ARC * progress).toFixed(2) + " " + ARC.toFixed(2));
      placeSong();
    }

    function drawSong(next) {
      var title = next && next.title ? next.title : "";
      var appears = song.leg.hidden && title !== "";
      track = title === "" ? undefined : next;
      song.leg.hidden = title === "";
      box.classList.toggle("bare", show === "time");
      if (title === "") return;
      setText(song.title, title);
      setText(song.who, next.artist);
      song.who.hidden = next.artist === "";
      tickSong();
      if (appears && mood !== "call" && show !== "time") song.leg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
    }

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
      drawSong(state.nowPlaying);
      placeSong();
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
        box = el("div", "icb");
        stage = el("div", "stage");
        hero = el("div", "leg hero");
        heroWord = el("span", "word");
        hero.appendChild(heroWord);
        sub = el("div", "leg sub");
        subWord = el("span", "word");
        chord = el("div", "chord");
        sub.append(chord, subWord);
        sub.hidden = true;
        cardsBox = el("div", "cards");
        call = el("div", "call");
        song = buildSong();
        stage.append(hero, sub, song.leg, cardsBox, call);
        now = function () { return ctx.now(); };
        cancelSong = ctx.requestFrame(tickSong, 4);
        box.appendChild(stage);
        root.append(style, box);
        setShow(ctx.options);
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
        if (cancelSong) cancelSong();
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = stage = hero = heroWord = sub = subWord = chord = cardsBox = call = song = track = cancelSong = undefined;
        cards.clear();
        mood = heroKey = callKey = "";
      },
    };
  });
})();
