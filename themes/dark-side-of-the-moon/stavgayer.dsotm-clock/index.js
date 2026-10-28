// The time and the date, small, in the top left corner, clear of the light.
// With no tasks the board shows the time large above the spectrum, so this
// corner steps away. It
// checks the clock once a second and writes only on change.
(function () {
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var base = scriptSrc.replace(/[^/]*$/, "");
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var STYLE = [
    "@font-face { font-family: 'Prism Sans'; src: url('" + base + "fonts/Cabin.ttf') format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; }",
    ".dsc { position: absolute; left: 5vw; top: 5vh; display: flex; align-items: baseline; gap: 1.8vmin; color: #e8ecee;",
    "  font-family: 'Prism Sans', 'Gill Sans', 'Helvetica Neue', sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; -webkit-font-smoothing: antialiased;",
    "  transition: opacity 400ms cubic-bezier(0.23, 1, 0.32, 1); }",
    ".dsc .time { font-stretch: 75%; font-weight: 600; font-size: 4.2vmin; line-height: 1; letter-spacing: -0.01em; }",
    ".dsc .date { font-size: 2.1vmin; font-weight: 500; line-height: 1; color: #a2aaa8; }",
    ".dsc.away { opacity: 0; }",
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
        box.className = "dsc away";
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
