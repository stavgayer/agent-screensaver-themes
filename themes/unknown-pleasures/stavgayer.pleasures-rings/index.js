// The usage limits as rings: a faint track and a thin arc in the agent's
// colour, the percent inside, a two-line caption beside it. While tasks run
// they stand in one row in the top right corner, over the column. With no
// tasks they move into the column under the large time, larger, two to a row.
// Order, numbers and captions follow builtin.limit-rings: an old reading is
// dimmed and says its age, an estimate says "est.", and a window that reset
// since the reading is empty and says "Reset". Time comes from state.nowMs.
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var MINUTE = 60000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;
  var WINDOW_ORDER = ["5h", "week", "plan"];
  var STALE_AFTER = { "5h": 30 * MINUTE, week: 6 * HOUR, plan: 6 * HOUR };
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var OWN = { claude: "#ff5b3d", codex: "#57c7ff", cursor: "#ffb52e" };
  var SPARE = ["#ff6fae", "#5fe0b4", "#b9a4ff", "#ffd36a", "#7fa8ff", "#ff8a4c"];
  var RADIUS = 20;
  var ARC = 2 * Math.PI * RADIUS;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var STYLE = [
    "@font-face { font-family: 'UP Sans'; src: url('" + base + "fonts/InstrumentSans.ttf') format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; }",
    ".upr { --size: 4.6vmin; position: absolute; right: 4.5vw; top: 4.4vh; display: flex; gap: 3.4vmin; align-items: center; color: #ecebe6;",
    "  font-family: 'UP Sans', 'Helvetica Neue', sans-serif; font-weight: 500; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }",
    ".upr[hidden] { display: none; }",
    ".upr.big { --size: 5.6vmin; right: auto; left: 70.5vw; top: 56vh; width: 25vw; display: grid; grid-template-columns: 1fr 1fr; row-gap: 3.6vmin; column-gap: 3vmin; }",
    ".upr .item { display: flex; align-items: center; gap: calc(var(--size) * 0.3); white-space: nowrap; }",
    ".upr .item.stale { opacity: 0.55; }",
    ".upr .ring { position: relative; width: var(--size); height: var(--size); flex: none; }",
    ".upr svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".upr .track { fill: none; stroke: #ecebe6; stroke-width: 2.6; opacity: 0.18; }",
    ".upr .arc { fill: none; stroke: var(--hue); stroke-width: 2.6; }",
    ".upr .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--size) * 0.27); font-weight: 560; }",
    ".upr .caption { display: flex; flex-direction: column; gap: 0.5vmin; font-size: calc(var(--size) * 0.36); line-height: 1.05; }",
    ".upr.big .caption { font-size: calc(var(--size) * 0.31); }",
    ".upr .detail { font-size: calc(var(--size) * 0.31); color: #9c9a93; }",
    ".upr.big .detail { font-size: calc(var(--size) * 0.27); }",
  ].join("\n");

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

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
    var shown = { hue: hueOf(limit.source), name: displayName(limit.source) + " " + limit.window };
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
    var box, lastKey = "", big;
    return {
      mount: function (root) {
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "upr";
        root.append(style, box);
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
        var shown = order(state.limits, state.agentOrder).map(function (limit) { return view(limit, state.nowMs); });
        var key = JSON.stringify(shown);
        if (key === lastKey) return;
        lastKey = key;
        box.replaceChildren.apply(box, shown.map(ring));
      },
      unmount: function () {
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = undefined;
      },
    };
  });
})();
