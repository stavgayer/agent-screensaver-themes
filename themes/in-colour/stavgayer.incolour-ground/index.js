// The In Colour wheel: hard-edged wedges of the whole spectrum, fanned out
// from one point to past every edge of the screen. The wheel turns very
// slowly (one turn in 40 minutes by default), which also moves every pixel
// against burn-in. The mood follows the agents:
//   work: the full spectrum, bright;
//   call: an agent waits, and a second wheel in shades of that agent's one
//         hue turns into place over the spectrum and holds;
//   rest: nothing runs (all done, or no tasks): a dark veil settles over the
//         wheel, so only deep tones of the colours remain.
// Only transform (the turn) and opacity (the mono wheel, the veil) animate,
// with one CSS animation and short WAAPI moves. No script runs per frame.
(function () {
  var SPECTRUM = [
    "#fbd713", "#f7a416", "#f07915", "#e6471d", "#e7302a", "#dd0834", "#df0655", "#e0186e",
    "#da0581", "#bc107e", "#89207f", "#5c2578", "#3e287b", "#193e8f", "#1d61ac", "#2784c7",
    "#159dd7", "#1fa29d", "#1e996a", "#1a9d3f", "#62b237", "#b0cc20", "#eee61f",
  ];
  // Each agent owns one hue of the wheel. Others get one by their name.
  var OWN = { claude: "#e6471d", codex: "#1d61ac", cursor: "#1a9d3f" };
  var SPARE = ["#da0581", "#f7a416", "#5c2578", "#159dd7", "#b0cc20", "#dd0834"];
  // The point the wedges fan out from, as a share of the screen.
  var CENTER_X = 0.71, CENTER_Y = 0.44;
  var NS = "http://www.w3.org/2000/svg";
  var EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

  function hueOf(source) {
    if (Object.prototype.hasOwnProperty.call(OWN, source)) return OWN[source];
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
    return SPARE[Math.abs(hash) % SPARE.length];
  }

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(hex, toward, amount) {
    var from = rgb(hex);
    return "rgb(" + from.map(function (c) { return Math.round(c + (toward - c) * amount); }).join(",") + ")";
  }

  // Wedge widths vary a little, as on a hand-cut fan; the same every time.
  function angles(count) {
    var weights = [], sum = 0;
    for (var i = 0; i < count; i++) {
      var w = 1 + 0.34 * Math.sin(i * 1.7 + 0.4);
      weights.push(w);
      sum += w;
    }
    var at = -Math.PI / 2 - 0.3, out = [];
    weights.forEach(function (w) {
      var span = (w / sum) * Math.PI * 2;
      out.push([at, at + span]);
      at += span;
    });
    return out;
  }

  function wheel(className) {
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "-1 -1 2 2");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    angles(SPECTRUM.length).forEach(function (span) {
      var r = 1.5; // past the corners of the square (1.414), so the edge never shows
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M0 0L" + (r * Math.cos(span[0])).toFixed(4) + " " + (r * Math.sin(span[0])).toFixed(4) +
        "L" + (r * Math.cos(span[1])).toFixed(4) + " " + (r * Math.sin(span[1])).toFixed(4) + "Z");
      // The stroke in the same colour closes the hairline seams between wedges.
      path.setAttribute("stroke-width", "0.006");
      svg.appendChild(path);
    });
    return svg;
  }

  function paint(svg, colours) {
    Array.prototype.forEach.call(svg.children, function (path, i) {
      path.setAttribute("fill", colours[i]);
      path.setAttribute("stroke", colours[i]);
    });
  }

  // One hue in many shades: lighter and darker steps in two slow waves.
  function shadesOf(hex) {
    return SPECTRUM.map(function (_, i) {
      var t = 0.34 * Math.sin((i / SPECTRUM.length) * Math.PI * 4 + 0.5);
      return t >= 0 ? mix(hex, 255, t * 0.8) : mix(hex, 0, -t);
    });
  }

  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var STYLE = [
    ".icg { position: absolute; inset: 0; overflow: hidden; background: #0b0b0b; }",
    ".icg .turn { position: absolute; will-change: transform; animation: icg-turn var(--icg-turn, 2400s) linear infinite; }",
    ".icg .turn svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }",
    ".icg .mono { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; opacity: 0; will-change: transform, opacity; }",
    ".icg .veil { position: absolute; inset: 0; background: #050505; opacity: 0; transition: opacity 1400ms " + EASE_OUT + "; }",
    ".icg.rest .veil { opacity: 0.78; }",
    "@keyframes icg-turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }",
    "@media (prefers-reduced-motion: reduce) { .icg .turn { animation: none; } .icg .veil { transition-duration: 300ms; } }",
  ].join("\n");

  window.agentScreensaver.register(function () {
    var box, turn, mono, monoWheel, veil, style, mood = "", monoHue = "";

    function place() {
      if (!box) return;
      var w = box.clientWidth, h = box.clientHeight;
      var cx = w * CENTER_X, cy = h * CENTER_Y;
      var far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
      var size = Math.ceil(far * 2) + 4;
      turn.style.width = turn.style.height = size + "px";
      turn.style.left = Math.round(cx - size / 2) + "px";
      turn.style.top = Math.round(cy - size / 2) + "px";
    }

    function callIn() {
      if (reduce.matches) {
        mono.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" });
        return;
      }
      // The one transition: the waiting agent's hue blooms out of the centre of the
      // wheel, turning a quarter as it grows, until it covers the screen and holds.
      mono.animate(
        [
          { opacity: 0, transform: "scale(0.04) rotate(-90deg)", offset: 0 },
          { opacity: 1, transform: "scale(0.16) rotate(-75deg)", offset: 0.12 },
          { opacity: 1, transform: "scale(1) rotate(0deg)", offset: 1 },
        ],
        { duration: 900, easing: EASE_OUT, fill: "forwards" },
      );
    }

    function callOut() {
      mono.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: EASE_OUT, fill: "forwards" });
    }

    var onResize = function () { place(); };

    return {
      start: function (root, ctx) {
        style = document.createElement("style");
        style.textContent = STYLE;
        box = document.createElement("div");
        box.className = "icg";
        turn = document.createElement("div");
        turn.className = "turn";
        var minutes = Number(ctx.options.turn);
        if (Number.isFinite(minutes) && minutes > 0) turn.style.setProperty("--icg-turn", Math.round(minutes * 60) + "s");
        var spectrum = wheel("spectrum");
        paint(spectrum, SPECTRUM);
        mono = document.createElement("div");
        mono.className = "mono";
        monoWheel = wheel("shades");
        mono.appendChild(monoWheel);
        turn.append(spectrum, mono);
        veil = document.createElement("div");
        veil.className = "veil";
        box.append(turn, veil);
        root.append(style, box);
        place();
        window.addEventListener("resize", onResize);
      },
      update: function (state) {
        if (!box) return;
        var waiting = state.display === "main" ? state.cards.filter(function (card) { return card.kind === "approval"; }) : [];
        waiting.sort(function (a, b) { return (a.approval_since_ms || Infinity) - (b.approval_since_ms || Infinity); });
        var busy = state.cards.some(function (card) { return card.kind !== "finished"; });
        var next = waiting.length > 0 ? "call" : busy ? "work" : "rest";
        if (next === "call") {
          var hue = hueOf(waiting[0].source);
          if (hue !== monoHue) {
            monoHue = hue;
            paint(monoWheel, shadesOf(hue));
          }
        }
        if (next === mood) return;
        if (next === "call") callIn();
        else if (mood === "call") callOut();
        box.classList.toggle("rest", next === "rest");
        mood = next;
      },
      stop: function () {
        window.removeEventListener("resize", onResize);
        if (box) box.remove();
        if (style) style.remove();
        box = turn = mono = monoWheel = veil = style = undefined;
        mood = monoHue = "";
      },
    };
  });
})();
