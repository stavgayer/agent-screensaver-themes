// One flat color over the whole screen, and a black field laid over it that
// fades in while an agent waits for the user, so the whole poster flips. The
// background sits behind every region, so the clock and the rings stay on top.
// No frames and no texture: flatness is the look. Only opacity animates.
window.agentScreensaver.register(function () {
  var box, field;
  return {
    start: function (root, ctx) {
      var color = typeof ctx.options.color === "string" ? ctx.options.color : "#f58a3c";
      box = document.createElement("div");
      box.style.cssText = "position:absolute;inset:0;background:" + color + ";";
      field = document.createElement("div");
      field.style.cssText = "position:absolute;inset:0;background:var(--pablo-ink,#111111);opacity:0;" +
        "transition:opacity 320ms cubic-bezier(0.23,1,0.32,1);";
      box.appendChild(field);
      root.appendChild(box);
    },
    update: function (state) {
      var calling = state.display === "main" && state.cards.some(function (card) { return card.kind === "approval"; });
      if (field) field.style.opacity = calling ? "1" : "0";
    },
    stop: function () {
      if (box) box.remove();
      box = field = undefined;
    },
  };
});
