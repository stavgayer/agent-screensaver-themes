// The time and the date as one printed line in the corner, in the poster's face.
// When nothing runs, the rows already repeat the time large, so this line gives
// only the date. While an agent waits it prints in orange on the black field. It checks the clock once a second and writes only on change.
// The date steps down to a short form, then to nothing, so it never runs into the usage rings beside it.
(function () {
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var STYLE =
    ".pablo-clock { display: flex; gap: 1.2em; align-items: baseline; color: var(--pablo-ink, #111111);" +
    "  font-family: Arial, \"Helvetica Neue\", Helvetica, sans-serif; font-weight: 700; text-transform: uppercase;" +
    "  font-variant-numeric: tabular-nums; white-space: nowrap; }" +
    ".pablo-clock .time { font-size: 5.6vmin; line-height: 0.8; letter-spacing: -0.04em; }" +
    ".pablo-clock .date { font-size: 2.4vmin; line-height: 1.2; letter-spacing: 0.01em; }" +
    ".pablo-clock .date[hidden] { display: none; }" +
    ".pablo-clock .measure { position: absolute; visibility: hidden; pointer-events: none; font-size: 2.4vmin; line-height: 1.2; letter-spacing: 0.01em; }" +
    ".pablo-clock.date-only .time { display: none; }" +
    ".pablo-clock { transition: color 320ms cubic-bezier(0.23, 1, 0.32, 1); }" +
    ".pablo-clock.calling { color: var(--pablo-ground, #f58a3c); }";

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  window.agentScreensaver.register(function () {
    var box, time, date, measure, cancel, lastNow = 0, onResize;

    function show(element, text) {
      if (element && element.textContent !== text) element.textContent = text;
    }

    function tick(nowMs) {
      var moment = new Date(nowMs);
      show(time, pad2(moment.getHours()) + ":" + pad2(moment.getMinutes()));
      var weekday = WEEKDAYS[moment.getDay()], month = MONTHS[moment.getMonth()];
      var forms = [weekday + " " + moment.getDate() + " " + month, weekday.slice(0, 3) + " " + moment.getDate() + " " + month.slice(0, 3)];
      show(date, forms[fit(forms)]);
    }

    // The first date form that ends before the rings begin; -1 hides the date. The rings sit in the
    // other corner region, so their left edge is read from the page.
    function fit(forms) {
      var rings = box.ownerDocument.getElementById("region-top-right");
      var hasRings = rings !== null && rings.childElementCount > 0;
      var limit = (hasRings ? rings.getBoundingClientRect().left : window.innerWidth) - window.innerHeight * 0.02;
      var left = box.getBoundingClientRect().left;
      var style = window.getComputedStyle(box);
      var gap = parseFloat(style.columnGap) || 0;
      var used = box.classList.contains("date-only") ? 0 : time.getBoundingClientRect().width + gap;
      for (var i = 0; i < forms.length; i++) {
        measure.textContent = forms[i];
        if (left + used + measure.getBoundingClientRect().width <= limit) {
          date.hidden = false;
          return i;
        }
      }
      date.hidden = true;
      return forms.length - 1;
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
        measure = document.createElement("span");
        measure.className = "date measure";
        measure.setAttribute("aria-hidden", "true");
        box.append(time, date, measure);
        root.append(style, box);
        lastNow = ctx.now();
        tick(lastNow);
        cancel = ctx.requestFrame(function () { lastNow = ctx.now(); tick(lastNow); }, 1);
        onResize = function () { tick(lastNow); };
        window.addEventListener("resize", onResize);
      },
      update: function (state) {
        if (!box) return;
        box.classList.toggle("date-only", state.cards.length === 0);
        // While an agent waits the field turns black, so the ink turns orange.
        box.classList.toggle("calling", state.cards.some(function (card) { return card.kind === "approval"; }));
        tick(lastNow);
      },
      unmount: function () {
        if (cancel) cancel();
        cancel = undefined;
        if (onResize) window.removeEventListener("resize", onResize);
        onResize = undefined;
        if (box && box.parentElement) box.parentElement.replaceChildren();
        box = time = date = measure = undefined;
      },
    };
  });
})();
