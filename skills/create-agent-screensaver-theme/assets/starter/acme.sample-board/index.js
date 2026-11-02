// The Sample board: the words, the task cards, the approval and the song, over
// the whole screen. It works out the five states from the view state (the
// layout's modes are coarser), builds text only with textContent, cuts long
// text with "…", and cleans up in unmount. Restyle it after your source.
(function () {
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // Each agent owns one colour; an agent we do not know gets one by its name.
  var OWN = { claude: "#ff6b4a", codex: "#6aa9ff", cursor: "#f2c14e" };
  var SPARE = ["#e58fd1", "#7fd1b9", "#c7a6ff"];

  var STYLE = [
    ".smp { position: absolute; inset: 0; color: #f4f1ea; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }",
    ".smp .say { position: absolute; left: 6vmin; top: 20vh; font-size: 14vmin; font-weight: 700; line-height: 0.9; letter-spacing: -0.03em; white-space: nowrap; }",
    ".smp .sub { position: absolute; left: 6.4vmin; top: calc(20vh + 14vmin); font-size: 3.4vmin; color: #b9b2a6; white-space: nowrap; }",
    ".smp .cards { position: absolute; left: 6vmin; right: 6vmin; bottom: 6vmin; display: flex; gap: 2vmin; }",
    // Small text sits on a plate, so it reads over every part of the background.
    ".smp .card { flex: 1 1 0; min-width: 0; padding: 1.8vmin 2.2vmin; background: rgba(18, 16, 20, 0.86); border-top: 0.5vmin solid var(--hue); }",
    ".smp .card .top { display: flex; justify-content: space-between; gap: 1em; font-size: 2.2vmin; color: var(--hue); }",
    ".smp .card .what { margin-top: 1vmin; font-size: 2.8vmin; font-weight: 600; }",
    ".smp .card .where { margin-top: 0.6vmin; font-size: 2vmin; color: #b9b2a6; }",
    ".smp .card .top span, .smp .card .what, .smp .card .where { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }",
    ".smp .card.done { opacity: 0.6; }",
    ".smp .card.more { flex: none; display: grid; place-items: center; border-top-color: transparent; font-size: 2.6vmin; color: #b9b2a6; }",
    ".smp .call { position: absolute; left: 6vmin; right: 6vmin; bottom: 8vmin; padding: 3vmin 3.6vmin; background: rgba(18, 16, 20, 0.92); border-left: 1vmin solid var(--hue); }",
    ".smp .call .who { font-size: 3vmin; color: var(--hue); }",
    ".smp .call .command { margin-top: 1.4vmin; font: 600 4.4vmin ui-monospace, Menlo, monospace; overflow-wrap: anywhere; }",
    ".smp .call .where { margin-top: 1vmin; font-size: 2.6vmin; color: #b9b2a6; }",
    ".smp .song { position: absolute; left: 6vmin; top: 6vmin; max-width: 40vw; padding: 1.2vmin 1.8vmin; background: rgba(18, 16, 20, 0.86); }",
    ".smp .song .title { font-size: 2.4vmin; font-weight: 600; }",
    ".smp .song .artist { margin-top: 0.4vmin; font-size: 2vmin; color: #b9b2a6; }",
    ".smp .song .title, .smp .song .artist { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".smp .song .bar { margin-top: 1vmin; height: 0.4vmin; background: rgba(244, 241, 234, 0.18); overflow: hidden; }",
    ".smp .song .fill { height: 100%; background: var(--accent, #f2c14e); transform-origin: left center; transform: scaleX(0); }",
    ".smp [hidden] { display: none !important; }",
    ".smp .song, .smp .call { transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1); }",
    "@media (prefers-reduced-motion: reduce) { .smp .song, .smp .call { transition: none; } }",
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

  // An agent with no extension has no name in state.agents: show its source, capitalised.
  function agentName(state, source) {
    var agent = state.agents && state.agents[source];
    return agent && agent.name ? agent.name : source.charAt(0).toUpperCase() + source.slice(1);
  }

  function minutes(ms) {
    var m = Math.max(0, Math.floor(ms / 60000));
    return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
  }

  function el(className, text) {
    var node = document.createElement("div");
    node.className = className;
    if (text !== undefined) node.textContent = text; // never innerHTML: titles and commands come from outside
    return node;
  }

  window.agentScreensaver.register(function () {
    var box, say, sub, cards, call, song, track, show = "agents", cancelSong, now, lastState;

    function card(task, state) {
      var node = el("card" + (task.kind === "finished" ? " done" : ""));
      node.style.setProperty("--hue", hueOf(task.source));
      var top = el("top");
      var name = document.createElement("span");
      name.textContent = agentName(state, task.source);
      top.appendChild(name);
      // started_at_ms can be missing: then leave the time out, never show "NaN".
      var started = Number.isFinite(task.started_at_ms) ? task.started_at_ms : undefined;
      if (task.kind === "finished" || started !== undefined) {
        var since = document.createElement("span");
        since.textContent = task.kind === "finished" ? "done" : minutes(state.nowMs - started);
        top.appendChild(since);
      }
      node.appendChild(top);
      if (task.title) node.appendChild(el("what", task.title));
      if (task.project) node.appendChild(el("where", task.branch ? task.project + " on " + task.branch : task.project));
      return node;
    }

    function drawCall(state) {
      var waiting = state.cards.filter(function (task) { return task.kind === "approval"; })[0];
      call.style.setProperty("--hue", hueOf(waiting.source));
      var since = Number.isFinite(waiting.approval_since_ms) ? waiting.approval_since_ms : waiting.updated_at_ms;
      var who = agentName(state, waiting.source);
      call.replaceChildren(
        el("who", Number.isFinite(since) ? who + " has waited " + minutes(state.nowMs - since) : who + " is waiting"),
        el("command", waiting.request || "Look at the terminal"),
      );
      if (waiting.project) call.appendChild(el("where", waiting.project));
    }

    function drawSong() {
      if (!track) return;
      var progress = window.agentScreensaver.helpers.songProgress(track, now());
      song.querySelector(".bar").hidden = progress === null;
      if (progress !== null) song.querySelector(".fill").style.transform = "scaleX(" + progress + ")";
    }

    function draw(state) {
      if (!box) return;
      var mood = moodOf(state, show);
      var moment = new Date(state.nowMs);
      if (mood === "rest") {
        say.textContent = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
        sub.textContent = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      } else if (mood === "call") {
        say.textContent = "Needs you";
        sub.textContent = "";
      } else {
        var working = state.cards.filter(function (task) { return task.kind !== "finished"; }).length;
        say.textContent = mood === "done" ? "All done" : working + " working";
        sub.textContent = "";
      }
      sub.hidden = sub.textContent === "";
      cards.hidden = mood === "rest" || mood === "call";
      // Up to four cards; more say how many, so a task is never dropped without a word.
      var shown = cards.hidden ? [] : state.cards.slice(0, 4).map(function (task) { return card(task, state); });
      if (!cards.hidden && state.cards.length > 4) shown.push(el("card more", "+" + (state.cards.length - 4) + " more"));
      cards.replaceChildren.apply(cards, shown);
      call.hidden = mood !== "call";
      if (mood === "call") drawCall(state);
      // The song: hidden while an agent waits, and without one.
      track = mood !== "call" && show !== "time" && state.nowPlaying && state.nowPlaying.title ? state.nowPlaying : undefined;
      song.hidden = !track;
      if (track) {
        song.querySelector(".title").textContent = track.title;
        song.querySelector(".artist").textContent = track.artist;
        song.querySelector(".artist").hidden = track.artist === "";
        drawSong();
      }
    }

    return {
      mount: function (root, ctx) {
        root.style.position = "absolute"; // fill the whole screen, not the region's small box
        root.style.inset = "0";
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = el("smp");
        say = el("say");
        sub = el("sub");
        cards = el("cards");
        call = el("call");
        song = el("song");
        var bar = el("bar");
        bar.appendChild(el("fill"));
        song.append(el("title"), el("artist"), bar);
        box.append(say, sub, cards, call, song);
        root.append(style, box);
        show = ctx.options.show === "time" ? "time" : "agents";
        now = function () { return ctx.now(); };
        // The runtime calls update once a minute with a new nowMs, which moves the
        // clock and the cards' minutes. Only the song's bar needs frames: about four a second.
        // drawSong reads ctx.now() itself; the callback's argument is the frame clock.
        cancelSong = ctx.requestFrame(function () { drawSong(); }, 4);
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
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = say = sub = cards = call = song = track = lastState = cancelSong = undefined;
      },
    };
  });
})();
