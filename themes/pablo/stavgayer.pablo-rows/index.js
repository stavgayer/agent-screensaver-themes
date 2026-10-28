// The Pablo board: the whole poster in one component, because its parts answer
// each other (an approval flips the field, the rows and the cards together).
//
// Layers, back to front:
//   1. (the ground background turns the field black while an agent waits);
//   2. stacked rows of one repeated statement in bold caps, drifting very slowly
//      as marquees, every other row the other way (the cover's repeated title);
//   3. two flat photographs in the upper half, one large, one small;
//   4. one printed card per task, stuck on the lower half: solid black while the
//      agent works, outlined when it is done. While an agent waits, the task
//      cards step aside and one large card says what it wants to run.
//
// Only the fields the state gives are shown, so privacy mode keeps working.
// Motion is transform and opacity only, run by CSS animations and the Web
// Animations API on a few elements; there is no per-frame script. With reduced
// motion the rows and photos stand still and cards fade instead of moving.
(function () {
  var MINUTE = 60000;
  var MARQUEE_PX_PER_S = 9; // a row moves its own width in many minutes
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";

  var STYLE = [
    ":root { --pb-ground: var(--pablo-ground, #f58a3c); --pb-ink: var(--pablo-ink, #111111);",
    "  --pb-face: Arial, \"Helvetica Neue\", Helvetica, sans-serif; --pb-ease-out: cubic-bezier(0.23, 1, 0.32, 1); }",
    ".pb { position: absolute; inset: 0; overflow: hidden; color: var(--pb-ink); font-family: var(--pb-face); font-weight: 700; }",
    ".pb .rows { position: absolute; left: 0; right: 0; top: 15vmin; bottom: 0; }",
    ".pb .row { position: relative; white-space: nowrap; letter-spacing: -0.035em; text-transform: uppercase; }",
    ".pb .row.front { z-index: 3; }",
    ".pb.calling .row { color: var(--pb-ground); }",
    ".pb .track { display: inline-block; will-change: transform; animation: pb-marquee var(--pb-run, 300s) linear infinite; }",
    ".pb .row:nth-child(even) .track { animation-direction: reverse; }",
    ".pb .track > span { padding-right: 0.32em; }",
    "@keyframes pb-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }",
    ".pb .photo { position: absolute; z-index: 2; overflow: hidden; background: var(--pb-ink); }",
    ".pb .photo img { display: block; width: 100%; height: 100%; object-fit: cover; will-change: transform;",
    "  animation: pb-drift 90s ease-in-out infinite alternate; }",
    ".pb .photo.orange { left: 4vmin; top: 19vh; width: 40vw; aspect-ratio: 1200 / 933; }",
    // the small one is cropped wider: it loses empty forecourt, never the car
    ".pb .photo.brown { left: 58vw; top: 25vh; width: 25vw; aspect-ratio: 1200 / 780; }",
    ".pb .photo.brown img { object-position: 50% 30%; animation-duration: 110s; animation-direction: alternate-reverse; }",
    "@keyframes pb-drift { from { transform: scale(1.02) translate(0, 0); } to { transform: scale(1.07) translate(-1.2%, 0.8%); } }",
    // the task cards
    ".pb .cards { position: absolute; z-index: 4; right: 4vmin; bottom: 4vmin; left: 4vmin; display: flex; justify-content: flex-end;",
    "  align-items: flex-end; gap: 2.2vmin; transition: opacity 240ms var(--pb-ease-out); }",
    ".pb.calling .cards { opacity: 0; }",
    ".pb .card { flex: 0 1 29vw; min-width: 0; container: card / inline-size; background: var(--pb-ink); color: var(--pb-ground);",
    "  border: 0.6vmin solid var(--pb-ink); outline: 0.8vmin solid var(--pb-ground); transform: rotate(var(--tilt, 0deg)); }",
    ".pb .card .band { display: flex; justify-content: space-between; gap: 1em; padding: 1vmin 1.6vmin; background: var(--pb-ground);",
    "  color: var(--pb-ink); font-size: 2.1vmin; line-height: 1.1; text-transform: uppercase; white-space: nowrap; }",
    ".pb .card .band .agent { overflow: hidden; text-overflow: ellipsis; }",
    ".pb .card .state { display: flex; align-items: center; gap: 0.18em; padding: 2vmin 1.6vmin 0.8vmin; font-size: min(7.4vmin, 17cqi);",
    "  line-height: 0.82; letter-spacing: -0.045em; text-transform: uppercase; white-space: nowrap; overflow: hidden; }",
    ".pb .card .state svg { flex: none; width: 0.78em; height: 0.78em; }",
    ".pb .card .state svg path { fill: none; stroke: currentColor; stroke-width: 4.2; stroke-linecap: square; }",
    ".pb .card .what { padding: 0.6vmin 1.6vmin 0; font-size: 2.7vmin; line-height: 1.12; text-transform: uppercase; letter-spacing: -0.01em;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }",
    ".pb .card .where { padding: 1vmin 1.6vmin 1.6vmin; font-size: 2vmin; line-height: 1.15; text-transform: uppercase; white-space: nowrap;",
    "  overflow: hidden; text-overflow: ellipsis; }",
    ".pb .card.done { background: var(--pb-ground); color: var(--pb-ink); }",
    ".pb .card.done .band { background: var(--pb-ink); color: var(--pb-ground); }",
    ".pb .card .state .word { display: inline-block; }",
    // the approval card
    ".pb .call { position: absolute; z-index: 4; left: 4vmin; bottom: 4vmin; width: 66vw; background: var(--pb-ground); color: var(--pb-ink);",
    "  outline: 1vmin solid var(--pb-ink);",
    "  opacity: 0; visibility: hidden; }",
    ".pb.calling .call { opacity: 1; visibility: visible; }",
    // the header sits inside the card: the card's own ground, ink text, a heavy rule under it
    ".pb .call .band { display: flex; align-items: baseline; gap: 1.6em; padding: 1.5vmin 2.2vmin; background: var(--pb-ground); color: var(--pb-ink);",
    "  border-bottom: 0.9vmin solid var(--pb-ink); font-size: 3vmin; line-height: 1.1; text-transform: uppercase; white-space: nowrap; }",
    ".pb .call .band .since { flex: none; text-align: right; }",
    ".pb .call .band .agent { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }",
    ".pb .call .state { padding: 2.4vmin 2.2vmin 1vmin; font-size: 15vmin; line-height: 0.8; letter-spacing: -0.05em; text-transform: uppercase;",
    "  white-space: nowrap; }",
    ".pb .call .run { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 2.4vmin; row-gap: 1vmin; align-items: baseline;",
    "  padding: 1.4vmin 2.2vmin 2.4vmin; }",
    ".pb .call .label { font-size: 1.9vmin; text-transform: uppercase; }",
    ".pb .call .command { font-size: 4.4vmin; line-height: 1.08; letter-spacing: -0.02em; overflow-wrap: anywhere;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }",
    ".pb .call .project { font-size: 3vmin; line-height: 1.1; text-transform: uppercase; overflow-wrap: anywhere; }",
    ".pb .measure { position: absolute; visibility: hidden; white-space: nowrap; letter-spacing: -0.035em; text-transform: uppercase; font-size: 100px; }",
    ".pb.bare .rows { top: 0; }",
    "@media (prefers-reduced-motion: reduce) { .pb .track, .pb .photo img { animation: none; } }",
  ].join("\n");

  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5 9.5 18.5 20.5 5.5"/></svg>';

  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // A critically shaped spring sampled into a CSS linear() curve, so WAAPI can
  // play it with no per-frame script. Falls back to a strong ease-out.
  function spring(stiffness, damping) {
    var x = 0, v = 0, dt = 1 / 240, t = 0, points = [0], next = 1 / 60;
    while (t < 3) {
      var a = -stiffness * (x - 1) - damping * v;
      v += a * dt;
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
  var SETTLE = spring(240, 23); // overshoots a hair, then settles
  var LAND = spring(560, 42); // lands hard, almost no bounce

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function clock(nowMs) {
    var date = new Date(nowMs);
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  // Spelled out: in capitals "10M" could read as months.
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
        return { tone: "working", word: "Quiet", since: duration(nowMs - card.updated_at_ms) };
      default:
        return { tone: "working", word: "Check", since: "" };
    }
  }

  // Oldest approval first; one without a start time sorts last, ties keep their order.
  function approvals(cards) {
    return cards
      .filter(function (card) { return card.kind === "approval"; })
      .map(function (card, index) { return { card: card, index: index }; })
      .sort(function (a, b) {
        var x = a.card.approval_since_ms, y = b.card.approval_since_ms;
        if (x === y) return a.index - b.index;
        if (x === undefined) return 1;
        if (y === undefined) return -1;
        return x - y;
      })
      .map(function (entry) { return entry.card; });
  }

  // The poster's one statement. It is texture, so each card still says it all.
  function statement(state, show, waiting, tasks) {
    if (show === "time" || tasks.length === 0) return clock(state.nowMs);
    if (waiting.length > 0) return "Needs you";
    var working = tasks.some(function (card) { return card.kind !== "finished"; });
    return working ? "Still working" : "All done";
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

  // Small tilts, as if each card was stuck on by hand; fixed per session so a card never jumps.
  function tiltFor(key) {
    var hash = 0;
    for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return ((Math.abs(hash) % 5) - 2) * 0.45;
  }

  window.agentScreensaver.register(function () {
    var box, rowsBox, cardsBox, call, measure, observer;
    var show = "agents", lastState, rowsKey = "", rowsText = "";
    var cards = new Map(); // key -> { node, parts, tone, word }
    var calling = false, callKey = "";

    function photo(name) {
      var frame = el("div", "photo " + name);
      var image = el("img");
      image.alt = "";
      if (scriptSrc !== "") image.src = new URL("photos/" + name + ".jpg", scriptSrc).href;
      frame.appendChild(image);
      return frame;
    }

    // ---- rows -------------------------------------------------------------

    function drawRows(text, flood) {
      var height = rowsBox.clientHeight, width = rowsBox.clientWidth;
      if (height === 0 || width === 0) return;
      var key = [text.length, width, height].join("|");
      if (key === rowsKey && rowsBox.childElementCount > 0) {
        // Same shape: change the words in place and keep the drift running.
        if (text !== rowsText) rowsBox.querySelectorAll(".track > span").forEach(function (span) { span.textContent = text; });
        if (text !== rowsText && flood) floodRows();
        rowsText = text;
        return;
      }
      rowsKey = key;
      rowsText = text;
      var count = Math.max(4, Math.round(height / (window.innerHeight * 0.155)));
      var size = height / (count * 0.8);
      measure.style.fontSize = size + "px";
      measure.textContent = text;
      var phrase = measure.getBoundingClientRect().width + size * 0.32;
      var copies = Math.max(2, Math.ceil(width / phrase) + 1);
      var run = Math.round((copies * phrase) / MARQUEE_PX_PER_S);
      var rows = [];
      for (var r = 0; r < count; r++) {
        // One row runs over the foot of the photos, as the type does on the cover.
        var row = el("div", r === Math.floor(count * 0.55) ? "row front" : "row");
        row.style.fontSize = size.toFixed(2) + "px";
        row.style.lineHeight = "0.8";
        var track = el("div", "track");
        track.style.setProperty("--pb-run", run + "s");
        // Start each row at another point of its loop, so the stack never lines up.
        track.style.animationDelay = "-" + Math.round(run * ((r * 0.37) % 1)) + "s";
        for (var c = 0; c < copies * 2; c++) track.appendChild(el("span", "", text));
        row.appendChild(track);
        rows.push(row);
      }
      rowsBox.replaceChildren.apply(rowsBox, rows);
      if (flood) floodRows();
    }

    // The rows change their words with one move: each rises into place, top first.
    function floodRows() {
      Array.prototype.forEach.call(rowsBox.children, function (row, index) {
        var from = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateY(45%)" };
        var to = reduce.matches ? { opacity: 1 } : { opacity: 1, transform: "translateY(0)" };
        row.animate([from, to], { duration: 460, delay: index * 45, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
      });
    }

    // ---- task cards -------------------------------------------------------

    function buildCard(key) {
      var node = el("div", "card");
      node.style.setProperty("--tilt", tiltFor(key) + "deg");
      var band = el("div", "band");
      var parts = { agent: el("span", "agent"), since: el("span", "since"), state: el("div", "state"), word: el("span", "word"),
        what: el("div", "what"), where: el("div", "where") };
      band.append(parts.agent, parts.since);
      parts.state.appendChild(parts.word);
      parts.what.dir = "auto";
      parts.where.dir = "auto";
      node.append(band, parts.state, parts.what, parts.where);
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
      setText(parts.where, card.project && card.project !== heading ? card.project : "");
      parts.where.hidden = parts.where.textContent === "";
      var changed = entry.word !== "" && (entry.word !== said.word || entry.tone !== said.tone);
      if (entry.word !== said.word) setText(parts.word, said.word);
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

    // A state change happens on the card itself: the new word rises in and the
    // card takes a small stamp, as if the label was pressed on again.
    function stamp(entry) {
      if (reduce.matches) {
        entry.parts.word.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
        return;
      }
      var tilt = entry.node.style.getPropertyValue("--tilt");
      entry.node.animate(
        [{ transform: "rotate(" + tilt + ") scale(1.045)" }, { transform: "rotate(" + tilt + ") scale(1)" }],
        { duration: SETTLE.duration, easing: SETTLE.easing },
      );
      entry.parts.word.animate(
        [{ opacity: 0, transform: "translateY(40%)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 380, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    }

    function enter(entry, order) {
      var tilt = entry.node.style.getPropertyValue("--tilt");
      if (reduce.matches) {
        entry.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: order * 60, easing: "ease-out", fill: "backwards" });
        return;
      }
      entry.node.animate(
        [
          { opacity: 0, transform: "translateY(9vmin) rotate(" + tilt + ") scale(0.96)" },
          { opacity: 1, transform: "translateY(0) rotate(" + tilt + ") scale(1)" },
        ],
        { duration: SETTLE.duration, delay: order * 70, easing: SETTLE.easing, fill: "backwards" },
      );
    }

    function leave(entry) {
      var tilt = entry.node.style.getPropertyValue("--tilt");
      var to = reduce.matches ? { opacity: 0 } : { opacity: 0, transform: "translateY(4vmin) rotate(" + tilt + ") scale(0.97)" };
      var motion = entry.node.animate([{}, to], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" });
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
          entry = buildCard(key);
          cards.set(key, entry);
        }
        fillCard(entry, card, state);
        // Keep the cards in the order of the state, touching only what is out of place.
        var at = cardsBox.children[index];
        if (at !== entry.node) cardsBox.insertBefore(entry.node, at || null);
        if (isNew) enter(entry, fresh++);
      });
      cards.forEach(function (entry, key) {
        if (wanted.has(key)) return;
        cards.delete(key);
        leave(entry);
      });
    }

    // ---- the approval card ------------------------------------------------

    function drawCall(first, more, state) {
      var waited = state.nowMs - (first.approval_since_ms !== undefined ? first.approval_since_ms : first.updated_at_ms);
      var band = el("div", "band");
      band.append(el("span", "agent", agentName(first.source, state.agents)), el("span", "since", "waiting " + duration(waited)));
      if (more > 0) band.appendChild(el("span", "more", "+" + more + " more"));
      var parts = [band, el("div", "state", "Needs you")];
      var facts = [];
      if (first.request) facts.push(["Wants to run", "command", first.request]);
      if (first.project) facts.push(["Project", "project", first.project]);
      if (facts.length > 0) {
        var run = el("div", "run");
        facts.forEach(function (fact) {
          var value = el("div", fact[1], fact[2]);
          value.dir = "auto";
          run.append(el("div", "label", fact[0]), value);
        });
        parts.push(run);
      }
      var key = JSON.stringify([first.source, first.session, waited < MINUTE ? 0 : Math.floor(waited / MINUTE), more, first.request, first.project]);
      if (key !== callKey) {
        callKey = key;
        call.replaceChildren.apply(call, parts);
      }
    }

    function land() {
      if (reduce.matches) {
        call.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
        return;
      }
      call.animate(
        [{ opacity: 0, transform: "translateY(14vmin) scale(1.03)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: LAND.duration, delay: 140, easing: LAND.easing, fill: "backwards" },
      );
    }

    // ---- the whole board --------------------------------------------------

    function draw(state) {
      if (!box) return;
      var waiting = show === "time" ? [] : approvals(state.cards);
      var tasks = show === "time" ? [] : state.cards.filter(function (card) { return card.kind !== "approval"; });
      var nowCalling = waiting.length > 0;
      var flip = nowCalling !== calling;
      box.classList.toggle("calling", nowCalling);
      if (nowCalling) drawCall(waiting[0], waiting.length - 1, state);
      if (flip && nowCalling) land();
      calling = nowCalling;
      drawRows(statement(state, show, waiting, tasks.concat(waiting)), flip);
      drawCards(tasks, state);
    }

    function setShow(options) {
      show = options.show === "time" ? "time" : "agents";
      if (box) box.classList.toggle("bare", show === "time");
    }

    return {
      mount: function (root, ctx) {
        // Fill the region (the whole screen) rather than the fade-in wrapper around us.
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = el("style");
        style.textContent = STYLE;
        box = el("div", "pb");
        rowsBox = el("div", "rows");
        cardsBox = el("div", "cards");
        call = el("div", "call");
        measure = el("span", "measure");
        measure.setAttribute("aria-hidden", "true");
        box.append(rowsBox, photo("orange"), photo("brown"), cardsBox, call, measure);
        root.append(style, box);
        setShow(ctx.options);
        observer = new ResizeObserver(function () {
          rowsKey = "";
          if (lastState) draw(lastState);
        });
        observer.observe(rowsBox);
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      setOptions: function (options) {
        setShow(options);
        rowsKey = "";
        if (lastState) draw(lastState);
      },
      unmount: function () {
        if (observer) observer.disconnect();
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = rowsBox = cardsBox = call = measure = observer = undefined;
        cards.clear();
        rowsKey = "";
        callKey = "";
        calling = false;
      },
    };
  });
})();
