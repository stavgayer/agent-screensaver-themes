# Craft: what we learned making these themes

Each rule here comes from a real mistake in one of the seven themes, or from a fix that made one of them better. Follow them and a new theme avoids the same work.

## Text stays readable everywhere

- Put small text on something solid in the source's style: Kid A's near-black plates, Key of Life's cream labels, Pablo's printed cards, In Colour's white bars cut at 45°, Unknown Pleasures' plain black field. A soft dark halo (`text-shadow: 0 0 0.8vmin #000`) works for light text on a busy background.
- Cut long text with "…" instead of letting it wrap or run into something: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`. Inside a flex row the element also needs `min-width: 0`, or it never shrinks.
- Build text with `textContent`, never `innerHTML` from the state. Task titles and commands come from outside.

## Place things from the real layout

Two of the themes first placed an element at a fixed position, and it overlapped something on another screen shape: Pablo's song card covered the task cards at 1440 × 900, and a bar under the limits in In Colour would have hit the big statement at 1024 × 768. Sizes in `vmin` and `vw` scale differently on 4:3, 16:10 and ultra-wide screens.

When an element must fit between others, measure them:

```js
// Under the photo, unless the task cards reach that high: then just above them.
// offsetTop/offsetHeight are layout positions, so a card that is still rising
// in, or is tilted, does not move it.
function placeSong() {
  var vmin = Math.min(box.clientWidth, box.clientHeight) / 100, gap = 2.4 * vmin;
  var height = song.offsetHeight;
  var top = photo.offsetTop + photo.offsetHeight + gap;
  var cardsTop = Infinity;
  Array.prototype.forEach.call(cardsBox.children, function (card) {
    cardsTop = Math.min(cardsTop, cardsBox.offsetTop + card.offsetTop);
  });
  if (top + height + gap > cardsTop) top = Math.max(photo.offsetTop, cardsTop - gap - height);
  song.style.top = top + "px";
}
```

Call it from `update`, on resize, and from your low-rate frame callback, so it also follows a card that grew when its font arrived.

When an element shares a row with others, give it only the room they leave, so it never pushes them:

```css
.row  { display: flex; justify-content: space-between; }
.slot { flex: 1 1 0; min-width: 0; display: flex; justify-content: center; } /* takes the leftover only */
.song { min-width: 0; max-width: 100%; }                                      /* cut with … inside the slot */
```

Letting the song shrink together with the limits made the limits break onto two lines in Key of Life. The slot with `flex-basis: 0` fixed it.

## Low cost, all night

- Draw with `ctx.requestFrame(cb, fps)` at the lowest rate that looks right: 1 for a clock, about 4 for a progress bar, and for a moving background as few as the motion needs, never more than 30. A slow drift looks smooth at 12 to 15; only fast motion needs 24 to 30. Never start your own `requestAnimationFrame` loop or a timer that never stops.
- Inside the callback, read `ctx.now()`. The callback's argument is the frame clock (milliseconds since the page loaded), not the time of day ([build.md](build.md#the-entry-file)).
- A WebGL background: one full-screen triangle and a fragment shader, at half the screen's pixels (an option `scale`, default `0.5`) and at most 30 frames a second (an option `fps`, with a default as low as the motion allows). Ask for `{ alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }`. Draw only while something moves.
- Animate only `transform` and `opacity` on elements.
- Drift the whole picture by a few pixels over minutes against burn-in. Do not move text by fractions of a pixel: it shimmers. Move the background under it instead.

## Recover from a lost WebGL context

On agent-screensaver 0.5.0 and later, use the built-in helper: `return window.agentScreensaver.helpers.recoverWebGL(api, function () { return surface; });`, with `"api": 2` and `"requires": "0.5.0"` in the part's manifest ([build.md](build.md#shared-helpers-agent-screensaver-050-and-later)). The code below is the same thing, for a theme that must also run on older versions.

After sleep and wake, or a graphics reset, WebGL loses its context and the background stays black or frozen. Wrap your background so it starts again on a fresh canvas with the last state. Your `stop()` should lose the context on purpose to free the GPU, so the listener must come off before every stop, or the theme restarts forever:

```js
function recovering(api, surfaceOf) {
  var root, ctx, state, canvas, timer;
  function attach() { canvas = surfaceOf(); if (canvas) canvas.addEventListener("webglcontextlost", lost); }
  function detach() { if (canvas) canvas.removeEventListener("webglcontextlost", lost); canvas = undefined; }
  function lost(event) {
    event.preventDefault();
    if (timer !== undefined) return;
    timer = setTimeout(function () {
      timer = undefined;
      var last = state;
      detach(); api.stop(); api.start(root, ctx); attach();
      if (last) api.update(last);
    }, 400);
  }
  return {
    start: function (r, c) { root = r; ctx = c; api.start(r, c); attach(); },
    update: function (s) { state = s; api.update(s); },
    stop: function () { clearTimeout(timer); timer = undefined; detach(); api.stop(); root = ctx = state = undefined; },
  };
}
// in register: build `api` with start/update/stop as usual, then
// return recovering(api, function () { return surface; });
```

Test it by forcing a loss in the browser console. This finds the background's canvas and works for WebGL 2 and WebGL 1:

```js
var canvas = document.querySelector("#background canvas");
(canvas.getContext("webgl2") || canvas.getContext("webgl")).getExtension("WEBGL_lose_context").loseContext();
```

One fresh canvas should replace the old one, and it should stay the same canvas a few seconds later. `assets/shoot.mjs --lose-context` does the same and reports it ([test-and-ship.md](test-and-ship.md#the-headless-check)).

## Reduce motion

```js
var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
```

With `reduce.matches`, draw the background once per change and stand still, and fade elements instead of moving or scaling them. In CSS: `@media (prefers-reduced-motion: reduce) { .thing { transition: none; } }`.

Check it with `node assets/shoot.mjs <preview URL> --reduce`: the frames a second should drop to 0 while nothing changes ([test-and-ship.md](test-and-ship.md#the-headless-check)).

## The song that plays

With "Show what's playing" on (agent-screensaver 0.4.0 and later), `state.nowPlaying` holds the song. Draw it in your theme's own style, not with the built-in widget's white text:

- Show the title, the artist (skip the line when it is `""`) and the progress: a ring like your limit rings, or a thin bar.
- Move the progress on between states, and hide it when the app gives no length (Music, for songs it streams). On 0.5.0 and later, `window.agentScreensaver.helpers.songProgress(track, ctx.now())` does this (api 2, see [build.md](build.md#shared-helpers-agent-screensaver-050-and-later)); the code below is the same, for older versions:

```js
function songProgress(track, nowMs) {
  if (!(track.duration_ms > 0)) return null;
  var at = track.position_ms + Math.max(0, nowMs - track.at_ms);
  return Math.min(1, Math.max(0, at / track.duration_ms));
}
```

- Update it from a `ctx.requestFrame(drawSong, 4)` callback, using `ctx.now()`.
- Hide it while an agent waits for you (`state.mode === "attention"`), and when `nowPlaying` is missing.
- Find a spot that is free in every state, and measure your neighbours (see above). The themes here use: under the limits (Currents, Kid A), the top row between the clock and the limits (Unknown Pleasures, Prism), one more card under a photo (Pablo), one more white bar under the statement (In Colour), a label between the time and the limits (Key of Life).

## The usage limits

Use `builtin.limit-rings` in your layout, or draw your own from a copy of a theme's rings component here. The built-in rings draw light text with no plate or halo behind it: they read on a dark background, not on a light or busy one. Over a light picture, draw your own rings on a plate in your theme's style. Keep its rules, so a limit never misleads: order by `agentOrder`, dim a reading older than 30 minutes (5h window) or 6 hours (week and plan) and say its age, add "est." to an estimate, and show an empty ring that says "Reset" once `nowMs` passes `resets_at`.

## Missing data and privacy

Any card field can be missing, and privacy mode removes titles, commands, conversation names and branches before your code gets the state. Leave out what is not there. Without a command, an approval says "Look at the terminal". Never fill a gap with made-up text.
