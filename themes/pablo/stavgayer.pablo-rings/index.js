// The usage limits as printed rings: a thin black track, a heavy black arc, the
// percent in the middle and a two-line caption beside it. Order, numbers and
// captions follow builtin.limit-rings: an old reading is dimmed and says its age,
// an estimate says "est.", and a window that reset since the reading is empty and
// says "Reset". Above 80% the disc fills black and the number turns ground color,
// like a stamp. Time comes from state.nowMs only.
(function () {
  var MINUTE = 60000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;
  var WINDOW_ORDER = ["5h", "week", "plan"];
  var STALE_AFTER = { "5h": 30 * MINUTE, week: 6 * HOUR, plan: 6 * HOUR };
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var RADIUS = 20;
  var ARC = 2 * Math.PI * RADIUS;

  var STYLE =
    ".pablo-rings { display: flex; gap: 3.6vmin; align-items: center; color: var(--pablo-ink, #111111);" +
    "  font-family: Arial, \"Helvetica Neue\", Helvetica, sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; }" +
    ".pablo-rings .item { display: flex; align-items: center; gap: 1.1vmin; white-space: nowrap; }" +
    ".pablo-rings .item.stale { opacity: 0.5; }" +
    ".pablo-rings .ring { position: relative; width: 8vmin; height: 8vmin; flex: none; }" +
    ".pablo-rings svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }" +
    ".pablo-rings .track { fill: none; stroke: currentColor; stroke-width: 1; }" +
    ".pablo-rings .arc { fill: none; stroke: currentColor; stroke-width: 5; }" +
    ".pablo-rings .disc { fill: none; }" +
    ".pablo-rings .high .disc { fill: currentColor; }" +
    ".pablo-rings .value { position: absolute; inset: 0; display: grid; place-items: center; font-size: 2.4vmin; letter-spacing: -0.03em; }" +
    ".pablo-rings .high .value { color: var(--pablo-ground, #f58a3c); }" +
    ".pablo-rings .caption { display: flex; flex-direction: column; gap: 0.4vmin; font-size: 2.2vmin; line-height: 1.1;" +
    "  text-transform: uppercase; letter-spacing: 0.01em; }" +
        ".pablo-rings { transition: color 320ms cubic-bezier(0.23, 1, 0.32, 1); }" +
    ".pablo-rings.calling { color: var(--pablo-ground, #f58a3c); }" +
    ".pablo-rings.calling .high .value { color: var(--pablo-ink, #111111); }";

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
    if (limit.resets_at !== undefined && limit.resets_at !== null && nowMs >= limit.resets_at * 1000) {
      return { stale: false, percent: 0, name: name, detail: "Reset" };
    }
    var age = nowMs - limit.updated_at_ms;
    var stale = age > STALE_AFTER[limit.window];
    var more = [];
    if (stale) more.push(shortAge(age) + " ago");
    if (limit.estimated === true) more.push("est.");
    var details = [resetLabel(limit.resets_at, nowMs, more.length > 0)].concat(more).filter(function (text) { return text !== ""; });
    return { stale: stale, percent: percentOf(limit.used_percent), name: name, detail: details.join(" / ") };
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

  function text(tag, className, value) {
    var node = document.createElement(tag);
    node.className = className;
    node.textContent = value;
    return node;
  }

  function ring(shown) {
    var item = document.createElement("div");
    item.className = "item" + (shown.stale ? " stale" : "");
    var holder = document.createElement("div");
    holder.className = "ring" + (shown.percent > 80 ? " high" : "");
    var svg = svgNode("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    svg.append(
      svgNode("circle", { class: "disc", cx: 24, cy: 24, r: RADIUS + 2.5 }),
      svgNode("circle", { class: "track", cx: 24, cy: 24, r: RADIUS }),
      svgNode("circle", { class: "arc", cx: 24, cy: 24, r: RADIUS, "stroke-dasharray": ((ARC * shown.percent) / 100).toFixed(2) + " " + ARC.toFixed(2) }),
    );
    holder.append(svg, text("div", "value", shown.percent + "%"));
    var caption = document.createElement("div");
    caption.className = "caption";
    caption.append(text("div", "name", shown.name), text("div", "detail", shown.detail === "" ? " " : shown.detail));
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
        box.className = "pablo-rings";
        root.append(style, box);
        lastKey = "";
      },
      update: function (state) {
        var shown = order(state.limits, state.agentOrder).map(function (limit) { return view(limit, state.nowMs); });
        var key = JSON.stringify(shown);
        if (!box) return;
        box.classList.toggle("calling", state.cards.some(function (card) { return card.kind === "approval"; }));
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
