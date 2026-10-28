// The time and the date in the corner, on a small dark plate, round where it
// ends. With no tasks the board shows the time large, so this corner
// stays empty. It checks the clock once a second and writes only on change.
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var STYLE = [
    "@font-face { font-family: 'CS Display'; src: url('" + base + "fonts/Fraunces.ttf') format('truetype'); font-weight: 100 900; }",
    "@font-face { font-family: 'CS Text'; src: url('" + base + "fonts/Outfit.ttf') format('truetype'); font-weight: 100 900; }",
    ".csc { display: flex; align-items: baseline; gap: 2vmin; height: 8vmin; box-sizing: border-box; margin: -1vmin 0 0 -8vmin;",
    "  padding: 1.8vmin 4.4vmin 0 8vmin; background: #120a1f; color: #f4ecdf; border-radius: 0 999px 999px 0;",
    "  box-shadow: 0 1vmin 2.6vmin rgba(8, 3, 16, 0.35);",
    "  font-family: 'CS Text', 'Helvetica Neue', sans-serif; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap;",
    "  -webkit-font-smoothing: antialiased; transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".csc .time { font-family: 'CS Display', Georgia, serif; font-variation-settings: 'SOFT' 100, 'WONK' 1; font-weight: 800; font-size: 4.8vmin; letter-spacing: -0.02em; line-height: 1; }",
    ".csc .date { font-size: 2.3vmin; font-weight: 500; line-height: 1; color: #c3b6d6; }",
    ".csc.away { opacity: 0; }",
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
        box.className = "csc";
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
