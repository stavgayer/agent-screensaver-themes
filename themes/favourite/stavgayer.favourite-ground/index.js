// The Favourite background: a slow field of soft bands on a dark ground, drawn on
// a 2D canvas. Replace it with your source's picture. It follows the rules a
// background needs: a low frame rate from ctx.requestFrame, a drift against
// burn-in, a still picture with "Reduce motion" on, and a clean stop.
(function () {
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  // The ground warms toward the waiting agent's colour during an approval.
  var CALL = "#ff6b4a";

  window.agentScreensaver.register(function () {
    var canvas, paint, cancelFrame, calling = false, now;

    function fit() {
      if (!canvas) return;
      canvas.width = Math.round(canvas.clientWidth / 2); // half the pixels: soft bands need no more
      canvas.height = Math.round(canvas.clientHeight / 2);
    }

    function draw(nowMs) {
      if (!paint) return;
      var w = canvas.width, h = canvas.height;
      // One slow cycle every 6 minutes moves every pixel a little against burn-in.
      var t = reduce.matches ? 0 : (nowMs / 360000) * Math.PI * 2;
      paint.fillStyle = "#121014";
      paint.fillRect(0, 0, w, h);
      for (var i = 0; i < 6; i++) {
        var y = h * (0.2 + i * 0.13) + Math.sin(t + i) * h * 0.02;
        paint.fillStyle = calling ? CALL : "#f2c14e";
        paint.globalAlpha = 0.05 + i * 0.015;
        paint.fillRect(0, y, w, h * 0.06);
      }
      paint.globalAlpha = 1;
    }

    return {
      start: function (root, ctx) {
        canvas = document.createElement("canvas");
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
        root.appendChild(canvas);
        paint = canvas.getContext("2d");
        now = function () { return ctx.now(); };
        fit();
        window.addEventListener("resize", fit);
        draw(ctx.now());
        var fps = Number(ctx.options.fps);
        // The callback's own argument is the frame clock (ms since the page loaded),
        // not the time of day: always read ctx.now() inside it, like the built-ins do.
        if (!reduce.matches) cancelFrame = ctx.requestFrame(function () { draw(ctx.now()); }, Number.isFinite(fps) ? fps : 12);
      },
      update: function (state) {
        calling = state.mode === "attention";
        draw(now());
      },
      stop: function () {
        if (cancelFrame) cancelFrame();
        window.removeEventListener("resize", fit);
        if (canvas) canvas.remove();
        canvas = paint = cancelFrame = undefined;
      },
    };
  });
})();
