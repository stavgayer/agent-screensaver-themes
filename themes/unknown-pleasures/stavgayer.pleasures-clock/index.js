// The time and the date, small, over the left edge of the plot. With no tasks
// the board shows the time large in its column, so this corner steps away. It
// checks the clock once a second and writes only on change.
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var STYLE = [
    "@font-face { font-family: 'UP Sans'; src: url('" + base + "fonts/InstrumentSans.ttf') format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; }",
    ".upc { position: absolute; left: 5vw; top: 5vh; display: flex; align-items: baseline; gap: 1.8vmin; color: #ecebe6;",
    "  font-family: 'UP Sans', 'Helvetica Neue', sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; -webkit-font-smoothing: antialiased;",
    "  transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".upc .time { font-stretch: 75%; font-weight: 600; font-size: 4.2vmin; line-height: 1; letter-spacing: -0.01em; }",
    ".upc .date { font-size: 2.1vmin; font-weight: 500; line-height: 1; color: #9c9a93; }",
    ".upc.away { opacity: 0; }",
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
        root.style.position = "absolute";
        root.style.inset = "0";
        var style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "upc away";
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
