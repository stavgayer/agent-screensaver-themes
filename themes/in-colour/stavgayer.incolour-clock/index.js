// The time and the date in the corner, on a small white leg while the wheel
// is bright, in white ink on the dark wheel at rest. With no tasks the board
// shows the time large, so this corner stays empty. It checks the clock once
// a second and writes only on change.
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var STYLE = [
    "@font-face { font-family: 'IC Grotesk'; src: url('" + base + "fonts/SpaceGrotesk.ttf') format('truetype'); font-weight: 300 700; }",
    ".icc { --h: 8vmin; display: flex; align-items: center; gap: 2vmin; height: var(--h); margin: -1vmin 0 0 -4vmin;",
    "  padding: 0 calc(var(--h) + 1.6vmin) 0 4.6vmin; background: #ffffff; color: #0b0b0b;",
    "  clip-path: polygon(0 0, 100% 0, calc(100% - var(--h)) 100%, 0 100%);",
    "  font-family: 'IC Grotesk', 'Helvetica Neue', sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap;",
    "  -webkit-font-smoothing: antialiased; transition: background-color 900ms cubic-bezier(0.23, 1, 0.32, 1), color 900ms cubic-bezier(0.23, 1, 0.32, 1),",
    "  opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".icc .time { font-size: 4.8vmin; letter-spacing: -0.04em; line-height: 1; }",
    ".icc .date { font-size: 2.3vmin; font-weight: 600; line-height: 1; }",
    ".icc.rest { background: transparent; color: #ffffff; }",
    ".icc.away { opacity: 0; }",
  ].join("\n");

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  window.agentScreensaver.register(function () {
    var box, time, date, cancel;

    function show(element, text) {
      if (element && element.textContent !== text) element.textContent = text;
    }

    function tick(nowMs) {
      var moment = new Date(nowMs);
      show(time, pad2(moment.getHours()) + ":" + pad2(moment.getMinutes()));
      show(date, WEEKDAYS[moment.getDay()] + " " + moment.getDate() + " " + MONTHS[moment.getMonth()]);
    }

    return {
      mount: function (root, ctx) {
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "icc";
        time = document.createElement("div");
        time.className = "time";
        date = document.createElement("div");
        date.className = "date";
        box.append(time, date);
        root.append(style, box);
        tick(ctx.now());
        cancel = ctx.requestFrame(function () { tick(ctx.now()); }, 1);
      },
      update: function (state) {
        if (!box) return;
        var busy = state.cards.some(function (card) { return card.kind !== "finished"; });
        box.classList.toggle("rest", !busy);
        box.classList.toggle("away", state.cards.length === 0);
      },
      unmount: function () {
        if (cancel) cancel();
        cancel = undefined;
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = time = date = undefined;
      },
    };
  });
})();
