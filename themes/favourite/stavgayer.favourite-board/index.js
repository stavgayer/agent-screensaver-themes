// The Favourite board: every word on the screen, over the sky the ground paints.
// It reads the same frame as the ground (the shared geometry below), so the
// words sit where the cover has room for them:
//   the clock and the date in lime blackletter at the top centre, where the
//   cover's title is, and the song in one small pink line under them;
//   one label under each spike, on a dark blue plate;
//   the task cards in the open sky left and right of the heart, or in one row
//   under the labels on narrow (4:3) screens;
//   while an agent waits, one large card over the lower half of the heart, and
//   the cards and labels fade back.
// The second display shows only the clock and the date. Text is built with
// textContent only, long text is cut with "…", fields that are missing are left
// out, and everything is placed again when the screen changes size.
(function () {
  var MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
  var base = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // geometry: keep identical in ground and board
  // Where everything sits, from the screen size alone, so the shader and the page
  // elements agree. From the top: the clock and the date, room for the daggers,
  // the heart, its spikes, the limit labels and, on narrow screens, one row of
  // task cards. The heart takes the height that is left, and any spare height
  // opens above it, so it sits low like on the cover. The side columns beside the
  // heart end above the spikes, so the labels and the card row get the full width.
  // Sizes in vmin unless noted.
  var FRAME = {
    margin: 4, // above the clock
    clock: 14, // the time and the date
    gap: 2, // between blocks
    rise: 0.24, // of the heart's size: the daggers stand above its top edge (always kept, so the heart never jumps)
    spikes: 0.12, // of the heart's size: the spikes hang under it (only with limits)
    labelRow: 6.5, // one row of limit labels
    labelWidth: 150, // CSS px per limit label
    cards: 15, // the row of cards on narrow screens
    bottom: 3, // under everything
    maxHeart: 0.62, // of the smaller side
    narrow: 1.45, // width / height under which the cards go in a row
    gutter: 0.03, // of the width, at both screen edges and beside the heart
    spikeSpread: 0.26, // of the heart's size: how far from its centre the outer spikes hang
    maxSpikes: 12, // a limit past the twelfth has a label but no spike
  };

  function favouriteFrame(width, height, limitCount, cardCount) {
    var vmin = Math.min(width, height) / 100, gutter = FRAME.gutter * width;
    var cardsRow = width / height < FRAME.narrow && cardCount > 0;
    var labelRows = limitCount * FRAME.labelWidth > width - 2 * gutter ? 2 : 1;
    var spikes = limitCount > 0 ? FRAME.spikes : 0;
    // Under the heart, in vmin: the labels with their gap, then the card row with its gap.
    var labels = limitCount > 0 ? FRAME.gap + labelRows * FRAME.labelRow : 0;
    var cards = cardsRow ? FRAME.gap + FRAME.cards : 0;
    var fixed = (FRAME.margin + FRAME.clock + FRAME.gap + labels + cards + FRAME.bottom) * vmin;
    var size = Math.max(0, Math.min(FRAME.maxHeart * 100 * vmin, (height - fixed) / (1 + FRAME.rise + spikes)));
    // Placed from the bottom up.
    var labelsTop = height - (FRAME.bottom + cards + (limitCount > 0 ? labelRows * FRAME.labelRow : 0)) * vmin;
    var spikesTop = labelsTop - (limitCount > 0 ? FRAME.gap * vmin : 0) - spikes * size;
    var heart = { cx: width / 2, cy: spikesTop - size / 2, size: size };
    var side = Math.max(0, heart.cx - size / 2 - 2 * gutter), top = FRAME.margin * vmin;
    return {
      heart: heart,
      clockTop: top,
      clockHeight: FRAME.clock * vmin,
      spikesTop: spikesTop,
      labelsTop: labelsTop,
      labelRows: labelRows,
      cardsRow: cardsRow,
      sideColumns: cardsRow ? null : {
        left: { x: gutter, w: side, top: top, bottom: spikesTop },
        right: { x: width - gutter - side, w: side, top: top, bottom: spikesTop },
      },
    };
  }

  // The same frame for the same state in every part: the second display shows no
  // limits and no cards, and only the limits that can be read count.
  function frameOf(state, width, height) {
    var main = state.display === "main";
    return favouriteFrame(width, height, main ? limitsInOrder(state).length : 0, main ? state.cards.length : 0);
  }

  // Each agent owns one colour of the cover; an agent we do not know gets one by its name.
  var OWN_COLOURS = { claude: "#d34d68", codex: "#87c2c4", cursor: "#eba6b3" };
  var SPARE_COLOURS = ["#d34d68", "#87c2c4", "#eba6b3", "#c9d3dc"];

  function agentColour(source) {
    if (Object.prototype.hasOwnProperty.call(OWN_COLOURS, source)) return OWN_COLOURS[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE_COLOURS[Math.abs(hash) % SPARE_COLOURS.length];
  }

  // The five states of the design, from the view state.
  function moodOf(state) {
    if (state.display !== "main" || state.cards.length === 0) return "rest";
    if (state.cards.some(function (card) { return card.kind === "approval"; })) return "call";
    return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "done";
  }

  // The limits that can be read, from left to right: by state.agentOrder, then each
  // agent's windows in the order the app sends them (the sort keeps that order).
  // A limit whose used_percent is not a number is left out: no spike, no label.
  function limitsInOrder(state) {
    var order = state.agentOrder || [];
    function rank(limit) {
      var known = order.indexOf(limit.source);
      return known < 0 ? order.length : known;
    }
    return (state.limits || [])
      .filter(function (limit) { return Number.isFinite(limit.used_percent); })
      .sort(function (a, b) { return rank(a) - rank(b); });
  }

  // How much of a limit from limitsInOrder is used, 0 to 100: 0 once it has reset.
  function usedPercent(limit, nowMs) {
    if (limit.resets_at > 0 && nowMs >= limit.resets_at * 1000) return 0;
    return Math.min(100, Math.max(0, limit.used_percent));
  }

  // Where spike `index` of `count` hangs, as a share of the heart's size from its
  // centre (x = heart.cx + offset * heart.size): one under the tip, more spread
  // evenly along the bottom of the face. Only the first maxSpikes count.
  function spikeOffset(index, count) {
    count = Math.min(count, FRAME.maxSpikes);
    return count < 2 ? 0 : FRAME.spikeSpread * ((2 * index) / (count - 1) - 1);
  }
  // end geometry

  var STALE_AFTER = { "5h": 30 * MINUTE, week: 6 * HOUR, plan: 6 * HOUR };
  var COMMAND_STEPS = [4.4, 3.9, 3.4, 3, 2.6]; // vmin: the command steps down to keep one line
  var CARD_MIN = 30; // vmin: the narrowest card in the row on narrow screens
  var GAP = 1.6; // vmin between cards

  var STYLE = [
    "@font-face { font-family: 'FV Display'; src: url('" + base + "fonts/UnifrakturCook-Bold.ttf') format('truetype'); font-weight: 700; }",
    "@font-face { font-family: 'FV Text'; src: url('" + base + "fonts/Outfit.ttf') format('truetype'); font-weight: 100 900; }",
    "@font-face { font-family: 'FV Mono'; src: url('" + base + "fonts/JetBrainsMono.woff2') format('woff2'); font-weight: 100 800; }",
    ".fvb { --navy: #022a4a; --plate: rgba(2, 42, 74, 0.85); --lime: #9bf95e; --pink: #eba6b3; --cream: #f3f6f8; --muted: #a9c6da;",
    "  position: absolute; inset: 0; overflow: hidden; color: var(--cream); font-family: 'FV Text', 'Helvetica Neue', sans-serif; font-weight: 500;",
    "  -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }",
    ".fvb [hidden] { display: none !important; }",
    // the title spot of the cover: the time, the date, the song
    ".fvb .clock { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; color: var(--lime); }",
    ".fvb .time, .fvb .date, .fvb .call .title { font-family: 'FV Display', Georgia, serif; font-weight: 700; white-space: nowrap; }",
    ".fvb .time { line-height: 0.95; }",
    ".fvb .date { line-height: 1.1; }",
    ".fvb .song { color: var(--pink); font-weight: 500; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    // the cards and labels step back while an agent waits
    ".fvb .labels, .fvb .cards { transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".fvb.call .labels, .fvb.call .cards { opacity: 0.15; }",
    // one label under each spike; its width is fixed in px (FRAME.labelWidth), so its padding and type stop growing too
    ".fvb .limit { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 0.2vmin;",
    "  padding: 0 min(1vmin, 9px); background: var(--plate); border-left: 3px solid var(--hue); border-radius: 0.6vmin; }",
    ".fvb .limit .top { display: flex; align-items: baseline; gap: 0.4em; font-size: min(2vmin, 15px); font-weight: 600; line-height: 1.2; white-space: nowrap; }",
    ".fvb .limit .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
    ".fvb .limit .percent { flex: none; margin-left: auto; font-weight: 700; }",
    ".fvb .limit .detail { font-size: min(1.7vmin, 13px); line-height: 1.2; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".fvb .limit.stale > * { opacity: 0.55; }",
    // the task cards: beside the heart, or in a row on narrow screens
    ".fvb .column, .fvb .row { position: absolute; }",
    ".fvb .stack { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; gap: " + GAP + "vmin; }",
    ".fvb .left .stack { align-items: flex-end; }",
    ".fvb .right .stack { align-items: flex-start; }",
    ".fvb .row { display: flex; justify-content: center; align-items: stretch; gap: " + GAP + "vmin; }",
    ".fvb .card { box-sizing: border-box; width: 100%; max-width: 46vmin; padding: 1.5vmin 2vmin 1.7vmin; background: var(--navy);",
    "  border-left: 3px solid var(--hue); border-radius: 0.8vmin; box-shadow: 0 1vmin 2.4vmin rgba(1, 20, 38, 0.35); }",
    ".fvb .row .card { flex: 1 1 0; min-width: 0; overflow: hidden; padding: 1.3vmin 1.8vmin; }",
    ".fvb .card .head { display: flex; align-items: center; gap: 0.9vmin; font-size: 2.1vmin; font-weight: 600; line-height: 1.25; white-space: nowrap; }",
    ".fvb .card .mark { flex: none; width: 1.1em; height: 1.1em; object-fit: contain; }",
    ".fvb .card .dot { width: 0.7em; height: 0.7em; border-radius: 50%; background: var(--hue); }",
    ".fvb .card .agent { min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
    ".fvb .card .state { flex: none; margin-left: auto; color: var(--hue); }",
    ".fvb .card .since { flex: none; color: var(--muted); font-weight: 500; }",
    ".fvb .card .what { margin-top: 0.8vmin; font-size: 2.6vmin; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere;",
    "  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }",
    ".fvb .row .card .what { -webkit-line-clamp: 1; }",
    ".fvb .card .where, .fvb .card .meta { margin-top: 0.5vmin; font-size: 2vmin; line-height: 1.25; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".fvb .card .meta { font-size: 1.8vmin; }",
    ".fvb .more { flex: none; align-self: center; padding: 1.2vmin 2vmin; background: var(--navy); border-radius: 0.8vmin; font-size: 2.2vmin; font-weight: 600; color: var(--muted); white-space: nowrap; }",
    ".fvb .stack .more { align-self: auto; }",
    // the needs-you card, over the lower half of the heart
    ".fvb .call { position: absolute; box-sizing: border-box; padding: 2.6vmin 3.2vmin 3vmin; background: var(--navy); border-left: 0.6vmin solid var(--hue);",
    "  border-radius: 1.2vmin; box-shadow: 0 1.6vmin 4vmin rgba(1, 16, 30, 0.5); animation: fvb-in 360ms cubic-bezier(0.23, 1, 0.32, 1); }",
    "@keyframes fvb-in { from { opacity: 0; } to { opacity: 1; } }",
    ".fvb .call .title { color: var(--lime); font-size: 8vmin; line-height: 1; }",
    ".fvb .call .who { margin-top: 1.4vmin; display: flex; align-items: baseline; gap: 1.6vmin; font-size: 3.2vmin; font-weight: 600; line-height: 1.25; white-space: nowrap; }",
    ".fvb .call .agent { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--hue); }",
    ".fvb .call .since { flex: none; }",
    ".fvb .call .project { margin-top: 0.6vmin; font-size: 2.6vmin; line-height: 1.25; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    // The command keeps one line and steps down in size to fit. Only a command too
    // long even at the smallest step breaks, at spaces, into up to four lines.
    ".fvb .call .command { margin-top: 1.8vmin; font-family: 'FV Mono', ui-monospace, Menlo, monospace; font-weight: 700; line-height: 1.25;",
    "  letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; min-width: 0; }",
    ".fvb .call .command.long { white-space: normal; overflow-wrap: break-word; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }",
    ".fvb .call .note { margin-top: 1.8vmin; font-size: 3.4vmin; font-weight: 600; line-height: 1.2; }",
    ".fvb .call .others { margin-top: 1.6vmin; font-size: 2.4vmin; color: var(--muted); }",
    "@media (prefers-reduced-motion: reduce) { .fvb .labels, .fvb .cards { transition-duration: 200ms; } }",
  ].join("\n");

  function pad2(value) { return String(value).padStart(2, "0"); }

  function duration(ms) {
    var minutes = Math.floor(ms / MINUTE);
    if (minutes < 1) return "under 1 min";
    if (minutes < 60) return minutes + " min";
    var rest = minutes % 60;
    return Math.floor(minutes / 60) + " hr" + (rest === 0 ? "" : " " + rest + " min");
  }

  function own(object, key) {
    return object && Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
  }

  // An agent with no extension has no name in state.agents: show its source, capitalised.
  function agentName(state, source) {
    var agent = own(state.agents, source);
    return (agent && agent.name) || source.charAt(0).toUpperCase() + source.slice(1);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // never innerHTML: titles and commands come from outside
    return node;
  }

  function since(fromMs, nowMs) {
    return Number.isFinite(fromMs) ? duration(nowMs - fromMs) : "";
  }

  // ---- the limit labels: the rules of builtin.limit-rings ----------------

  function countdown(ms) {
    var minutes = Math.floor(ms / MINUTE);
    if (minutes < 1) return "under 1m";
    if (minutes < 60) return minutes + "m";
    return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
  }

  // When the window resets, in local time built by hand so it never depends on locale data.
  function resetLabel(resetsAtS, nowMs) {
    if (!(resetsAtS > 0)) return "";
    var at = resetsAtS * 1000, left = at - nowMs, moment = new Date(at);
    if (left <= DAY) return countdown(left);
    var dayTime = WEEKDAYS[moment.getDay()].slice(0, 3) + " " + pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
    return left <= 6 * DAY ? dayTime : moment.getDate() + " " + MONTHS[moment.getMonth()].slice(0, 3);
  }

  function shortAge(ms) {
    if (ms < HOUR) return Math.floor(ms / MINUTE) + "m";
    if (ms < DAY) return Math.floor(ms / HOUR) + "h";
    return Math.floor(ms / DAY) + "d";
  }

  // What one label says: an old reading is dimmed and says its age, an estimate
  // says "est.", and a window that reset since the reading says "Reset".
  function limitView(limit, nowMs) {
    if (limit.resets_at > 0 && nowMs >= limit.resets_at * 1000) return { percent: 0, detail: "Reset", stale: false };
    var age = nowMs - limit.updated_at_ms, extra = [];
    var stale = age > (STALE_AFTER[limit.window] || STALE_AFTER.week);
    if (stale) extra.push(shortAge(age) + " ago");
    if (limit.estimated === true) extra.push("est.");
    var reset = resetLabel(limit.resets_at, nowMs);
    // The warnings first, so a cut line drops the reset time, never "est." or the age;
    // the reset time keeps its word, so it never reads as a second age.
    return { percent: Math.round(usedPercent(limit, nowMs)), detail: extra.concat(reset && "resets " + reset).filter(Boolean).join(" · "), stale: stale };
  }

  // Centres for a row of labels `step` apart, each as close as it can be to the
  // spike above it: pushed apart left to right, then the row shifted back to the
  // spikes' middle and into the screen. A row wider than the screen is centred.
  function spread(ideals, step, min, max) {
    var at = [];
    ideals.forEach(function (x, i) { at.push(i === 0 ? x : Math.max(x, at[i - 1] + step)); });
    var shift = (ideals[0] + ideals[ideals.length - 1] - at[0] - at[at.length - 1]) / 2;
    var low = at[0] + shift - step / 2, high = at[at.length - 1] + shift + step / 2;
    if (high - low > max - min) shift += (min + max - low - high) / 2;
    else if (low < min) shift += min - low;
    else if (high > max) shift -= high - max;
    return at.map(function (x) { return x + shift; });
  }

  // ---- the task cards -----------------------------------------------------

  function taskState(card, nowMs) {
    switch (card.kind) {
      case "running": return { word: "working", since: since(card.started_at_ms, nowMs) };
      case "approval": return { word: "waiting", since: since(card.approval_since_ms, nowMs) };
      case "finished": return { word: "done", since: Number.isFinite(card.updated_at_ms) ? (nowMs - card.updated_at_ms < MINUTE ? "just now" : duration(nowMs - card.updated_at_ms) + " ago") : "" };
      case "no_activity": return { word: "quiet", since: since(card.updated_at_ms, nowMs) };
      default: return { word: "", since: "" };
    }
  }

  function mark(state, source) {
    var agent = own(state.agents, source);
    if (!agent || !agent.mark_url) return el("span", "mark dot");
    var image = el("img", "mark");
    image.src = agent.mark_url;
    image.alt = "";
    return image;
  }

  function taskCard(card, state) {
    var node = el("div", "card");
    node.style.setProperty("--hue", agentColour(card.source));
    var said = taskState(card, state.nowMs);
    var head = el("div", "head");
    head.append(mark(state, card.source), el("span", "agent", agentName(state, card.source)));
    if (said.word) head.appendChild(el("span", "state", said.word));
    if (said.since) head.appendChild(el("span", "since", said.since));
    node.appendChild(head);
    var heading = card.title || card.name;
    if (heading) node.appendChild(el("div", "what", heading)).dir = "auto";
    if (card.project) node.appendChild(el("div", "where", card.project)).dir = "auto";
    var context = Number.isFinite(card.context_percent) ? Math.round(card.context_percent) + "% context" : "";
    var meta = [card.model, card.branch, context].filter(Boolean).join(" · ");
    if (meta) node.appendChild(el("div", "meta", meta));
    return node;
  }

  // Oldest approval first; one without a start time sorts last, ties keep their order.
  function approvals(cards) {
    return cards
      .map(function (card, index) { return { card: card, index: index }; })
      .filter(function (entry) { return entry.card.kind === "approval"; })
      .sort(function (a, b) {
        var x = a.card.approval_since_ms, y = b.card.approval_since_ms;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return Number.isFinite(x) ? -1 : Number.isFinite(y) ? 1 : a.index - b.index;
        return x - y || a.index - b.index;
      })
      .map(function (entry) { return entry.card; });
  }

  window.agentScreensaver.register(function () {
    var box, clock, time, date, song, labels, cards, left, right, row, call, lastState, show = "agents";

    function redraw() {
      if (lastState) draw(lastState);
    }

    function place(node, x, y, w, h) {
      node.style.left = x + "px";
      node.style.top = y + "px";
      node.style.width = w + "px";
      if (h !== undefined) node.style.height = h + "px";
    }

    function drawClock(state, frame, showSong) {
      var moment = new Date(state.nowMs), height = frame.clockHeight;
      time.textContent = pad2(moment.getHours()) + ":" + pad2(moment.getMinutes());
      date.textContent = WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()];
      clock.style.top = frame.clockTop + "px";
      time.style.fontSize = 0.66 * height + "px";
      date.style.fontSize = 0.19 * height + "px";
      // The song: title and artist in one line, only between the card columns.
      var track = showSong && state.nowPlaying && state.nowPlaying.title ? state.nowPlaying : undefined;
      song.hidden = !track;
      if (!track) return;
      song.textContent = track.artist ? track.title + " · " + track.artist : track.title;
      song.dir = "auto";
      song.style.fontSize = 0.15 * height + "px";
      var columns = frame.sideColumns, width = box.clientWidth, vmin = Math.min(width, box.clientHeight) / 100;
      var room = columns ? columns.right.x - columns.left.x - columns.left.w : width;
      song.style.maxWidth = room - 2 * FRAME.gutter * width - 2 * GAP * vmin + "px";
    }

    // One label per limit, under its spike; past the twelfth spike they carry on after.
    function drawLabels(limits, state, frame) {
      labels.replaceChildren();
      var count = limits.length;
      if (count === 0) return;
      var width = box.clientWidth, vmin = Math.min(width, box.clientHeight) / 100, gutter = FRAME.gutter * width;
      var step = FRAME.labelWidth, plateWidth = step - 8, plateHeight = (FRAME.labelRow - 0.8) * vmin; // 8 px between plates
      var ideals = [];
      limits.forEach(function (limit, index) {
        ideals.push(index < FRAME.maxSpikes ? frame.heart.cx + spikeOffset(index, count) * frame.heart.size : ideals[index - 1] + step);
      });
      var perRow = frame.labelRows === 1 ? count : Math.ceil(count / 2);
      for (var first = 0, rowIndex = 0; first < count; first += perRow, rowIndex++) {
        var centres = spread(ideals.slice(first, first + perRow), step, gutter, width - gutter);
        centres.forEach(function (centre, offset) {
          var limit = limits[first + offset], view = limitView(limit, state.nowMs);
          var node = el("div", "limit" + (view.stale ? " stale" : ""));
          node.style.setProperty("--hue", agentColour(limit.source));
          var top = el("div", "top");
          top.append(el("span", "name", agentName(state, limit.source)), el("span", "percent", view.percent + "%"));
          node.append(top, el("div", "detail", [limit.window, view.detail].filter(Boolean).join(" · ")));
          place(node, centre - plateWidth / 2, frame.labelsTop + rowIndex * FRAME.labelRow * vmin, plateWidth, plateHeight);
          labels.appendChild(node);
        });
      }
    }

    // Puts cards from `nodes[from]` into a column while they fit its height.
    function fill(column, nodes, from, to) {
      var stack = column.firstChild, room = column.offsetHeight;
      for (var i = from; i < to; i++) {
        stack.appendChild(nodes[i]);
        if (stack.offsetHeight > room) {
          stack.removeChild(nodes[i]);
          return i;
        }
      }
      return to;
    }

    function more(count) {
      return el("div", "more", "+" + count + " more");
    }

    function drawColumns(nodes, frame) {
      var columns = frame.sideColumns;
      [left, right].forEach(function (column, index) {
        var area = index === 0 ? columns.left : columns.right;
        place(column, area.x, area.top, area.w, area.bottom - area.top);
        column.firstChild.replaceChildren();
      });
      // The first half on the left, the rest on the right, as many as fit.
      var shown = fill(left, nodes, 0, Math.ceil(nodes.length / 2));
      shown = fill(right, nodes, shown, nodes.length);
      if (shown < nodes.length) {
        var last = right.firstChild.childElementCount > 0 ? right.firstChild : left.firstChild;
        if (last.lastChild) {
          last.removeChild(last.lastChild);
          shown--;
        }
        last.appendChild(more(nodes.length - shown));
      }
      [left, right].forEach(function (column) {
        column.firstChild.style.top = Math.max(0, (column.offsetHeight - column.firstChild.offsetHeight) / 2) + "px";
      });
    }

    function drawRow(nodes, frame) {
      var width = box.clientWidth, height = box.clientHeight, vmin = Math.min(width, height) / 100, gutter = FRAME.gutter * width;
      place(row, gutter, height - (FRAME.bottom + FRAME.cards) * vmin, width - 2 * gutter, FRAME.cards * vmin);
      var fits = Math.max(1, Math.floor((width - 2 * gutter + GAP * vmin) / ((CARD_MIN + GAP) * vmin)));
      var shown = nodes.length > fits ? nodes.slice(0, fits - 1).concat(more(nodes.length - fits + 1)) : nodes;
      row.replaceChildren.apply(row, shown);
    }

    function drawCards(tasks, state, frame) {
      var nodes = tasks.map(function (card) { return taskCard(card, state); });
      var inRow = frame.cardsRow && nodes.length > 0, inColumns = !frame.cardsRow && nodes.length > 0;
      row.hidden = !inRow;
      left.hidden = right.hidden = !inColumns;
      if (inRow) drawRow(nodes, frame);
      else row.replaceChildren();
      if (inColumns) drawColumns(nodes, frame);
    }

    function fitCommand() {
      var command = call.querySelector(".command");
      if (!command) return;
      command.classList.remove("long");
      for (var i = 0; i < COMMAND_STEPS.length; i++) {
        command.style.fontSize = COMMAND_STEPS[i] + "vmin";
        if (command.scrollWidth <= command.clientWidth + 1) return;
      }
      command.classList.add("long");
    }

    // The agent that has waited longest, over the lower half of the heart, just
    // under the eyes; raised when it would run off the bottom of the screen.
    function drawCall(waiting, state, frame) {
      call.hidden = waiting.length === 0;
      if (call.hidden) return;
      var first = waiting[0], heart = frame.heart;
      var width = box.clientWidth, height = box.clientHeight, vmin = Math.min(width, height) / 100;
      call.style.setProperty("--hue", agentColour(first.source));
      var who = el("div", "who");
      who.appendChild(el("span", "agent", agentName(state, first.source)));
      var waited = since(first.approval_since_ms, state.nowMs);
      if (waited) who.appendChild(el("span", "since", "waiting " + waited));
      var parts = [el("div", "title", "needs you"), who];
      if (first.project) parts.push(el("div", "project", first.project));
      parts.push(first.request ? el("div", "command", first.request) : el("div", "note", "Look at the terminal"));
      if (waiting.length > 1) parts.push(el("div", "others", "+" + (waiting.length - 1) + " more waiting"));
      parts.forEach(function (part) { part.dir = "auto"; });
      call.replaceChildren.apply(call, parts);
      var cardWidth = Math.min(width - 2 * FRAME.gutter * width, Math.max(1.4 * heart.size, 70 * vmin));
      place(call, heart.cx - cardWidth / 2, 0, cardWidth);
      fitCommand();
      call.style.top = Math.max(0, Math.min(heart.cy + 0.06 * heart.size, height - FRAME.bottom * vmin - call.offsetHeight)) + "px";
    }

    function draw(state) {
      if (!box) return;
      var timeOnly = show === "time" || state.display !== "main";
      var mood = timeOnly ? "rest" : moodOf(state);
      var frame = frameOf(state, box.clientWidth, box.clientHeight);
      box.classList.toggle("call", mood === "call");
      drawClock(state, frame, !timeOnly && mood !== "call");
      drawLabels(timeOnly ? [] : limitsInOrder(state), state, frame);
      drawCards(timeOnly ? [] : state.cards, state, frame);
      drawCall(mood === "call" ? approvals(state.cards) : [], state, frame);
    }

    function setShow(options) {
      show = options.show === "time" ? "time" : "agents";
    }

    function column(side) {
      var node = el("div", "column " + side);
      node.appendChild(el("div", "stack"));
      return node;
    }

    return {
      mount: function (root, ctx) {
        // Fill the whole screen, not the region's small box.
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = el("style");
        style.textContent = STYLE;
        box = el("div", "fvb");
        clock = el("div", "clock");
        time = el("div", "time");
        date = el("div", "date");
        song = el("div", "song");
        clock.append(time, date, song);
        labels = el("div", "labels");
        cards = el("div", "cards");
        left = column("left");
        right = column("right");
        row = el("div", "row");
        cards.append(left, right, row);
        call = el("div", "call");
        call.hidden = true;
        box.append(clock, labels, cards, call);
        root.append(style, box);
        setShow(ctx.options);
        // Sizes depend on the screen and on the fonts' real widths: place again on both.
        window.addEventListener("resize", redraw);
        if (document.fonts) document.fonts.addEventListener("loadingdone", redraw);
      },
      update: function (state) {
        lastState = state;
        draw(state);
      },
      setOptions: function (options) {
        setShow(options);
        redraw();
      },
      unmount: function () {
        window.removeEventListener("resize", redraw);
        if (document.fonts) document.fonts.removeEventListener("loadingdone", redraw);
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = clock = time = date = song = labels = cards = left = right = row = call = lastState = undefined;
      },
    };
  });
})();
