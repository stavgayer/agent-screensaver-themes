// The usage limits as rings in the hue of each agent's thread: a faint
// track and a heavy arc, the percent inside, a two-line caption beside it, all
// on one dark plate, round where it ends, like the board's plates. With no
// tasks at all they grow, since they are then half of what the screen says.
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
  var OWN = { claude: "#ff6a3d", codex: "#9d8cff", cursor: "#ffc94a" };
  var SPARE = ["#ff5fa2", "#5fd3c4", "#ff8f5a", "#c7a6ff", "#f2e266", "#7fb2ff"];
  var RADIUS = 19;
  var ARC = 2 * Math.PI * RADIUS;

  var STYLE = [
    "@font-face { font-family: 'CS Text'; src: url('" + base + "fonts/Outfit.ttf') format('truetype'); font-weight: 100 900; }",
    ".csr { --size: 6.6vmin; --h: calc(var(--size) + 3.4vmin); display: flex; gap: 3vmin; align-items: center; height: var(--h); box-sizing: border-box;",
    "  margin: -1vmin -8vmin 0 0; padding: 0 8vmin 0 4.4vmin; background: #120a1f; color: #f4ecdf; border-radius: 999px 0 0 999px;",
    "  box-shadow: 0 1vmin 2.6vmin rgba(8, 3, 16, 0.35);",
    "  font-family: 'CS Text', 'Helvetica Neue', sans-serif; font-weight: 600; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }",
    ".csr[hidden] { display: none; }",
    ".csr.big { --size: 9.4vmin; gap: 4vmin; padding-left: 5.4vmin; }",
    ".csr .item { display: flex; align-items: center; gap: calc(var(--size) * 0.22); white-space: nowrap; }",
    ".csr .item.stale { opacity: 0.55; }",
    ".csr .ring { position: relative; width: var(--size); height: var(--size); flex: none; }",
    ".csr svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }",
    ".csr .track { fill: none; stroke: #f4ecdf; stroke-width: 6; opacity: 0.16; }",
    ".csr .arc { fill: none; stroke: var(--hue); stroke-width: 6; }",
    ".csr .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--size) * 0.28); letter-spacing: -0.03em; }",
    ".csr .caption { display: flex; flex-direction: column; gap: 0.5vmin; font-size: calc(var(--size) * 0.29); line-height: 1.05; }",
    ".csr .detail { font-weight: 500; font-size: calc(var(--size) * 0.26); color: #c3b6d6; }",
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
    var name = displayName(limit.source) + " " + limit.window;
    var hue = hueOf(limit.source);
    var shown = { hue: hue, name: name };
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
    caption.append(text("name", shown.name), text("detail", shown.detail === "" ? " " : shown.detail));
    item.append(holder, caption);
    return item;
  }

  window.agentScreensaver.register(function () {
    var box, lastKey = "";
    return {
      mount: function (root) {
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "csr";
        root.append(style, box);
        lastKey = "";
      },
      update: function (state) {
        if (!box) return;
        box.classList.toggle("big", state.cards.length === 0);
        box.hidden = state.limits.length === 0;
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
