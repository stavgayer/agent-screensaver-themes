// The time and the date as one printed line in the corner, in the poster's face.
// When nothing runs, the rows already repeat the time large, so this line gives
// only the date. While an agent waits it prints in orange on the black field. It checks the clock once a second and writes only on change.
(function () {
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var STYLE =
    ".pablo-clock { display: flex; gap: 1.2em; align-items: baseline; color: var(--pablo-ink, #111111);" +
    "  font-family: Arial, \"Helvetica Neue\", Helvetica, sans-serif; font-weight: 700; text-transform: uppercase;" +
    "  font-variant-numeric: tabular-nums; white-space: nowrap; }" +
    ".pablo-clock .time { font-size: 5.6vmin; line-height: 0.8; letter-spacing: -0.04em; }" +
    ".pablo-clock .date { font-size: 2.4vmin; line-height: 1; letter-spacing: 0.01em; }" +
    ".pablo-clock.date-only .time { display: none; }" +
    ".pablo-clock { transition: color 320ms cubic-bezier(0.23, 1, 0.32, 1); }" +
    ".pablo-clock.calling { color: var(--pablo-ground, #f58a3c); }";

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
        box.className = "pablo-clock";
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
        box.classList.toggle("date-only", state.cards.length === 0);
        // While an agent waits the field turns black, so the ink turns orange.
        box.classList.toggle("calling", state.cards.some(function (card) { return card.kind === "approval"; }));
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
