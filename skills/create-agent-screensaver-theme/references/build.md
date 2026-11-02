# Building a theme

The parts, the files and the API a theme is written against. The full reference is [extensions.md](https://github.com/stavgayer/agent-screensaver/blob/main/docs/extensions.md) in the agent-screensaver repository, and the rules for extension code are in [extension-code-rules.md](https://github.com/stavgayer/agent-screensaver/blob/main/docs/extension-code-rules.md). This file holds everything from them that a theme needs, so you can build one without them: the pack, the manifests, the API and [the rules for extension code](#the-rules-for-extension-code).

## The pack

A theme you share is a pack: one folder per extension, all installed and removed together. In this repository a theme is `themes/<theme-name>/`, with one folder per extension and a `README.md` and a `media/` folder that are not packed.

```
themes/my-theme/
  README.md                 the theme's page (not packed)
  media/                    stills and a demo for the page (not packed)
  acme.mytheme/             theme: picks the background, the layout, the colours
  acme.mytheme-layout/      layout: where the components go, per mode
  acme.mytheme-ground/      background: draws the full screen
  acme.mytheme-board/       component: the words, the task cards, the approval
  acme.mytheme-rings/       component: the usage limits (optional: builtin.limit-rings works too)
```

The folder name is the extension's `id`. Ids are lowercase letters, digits and dashes with at least one dot, and must not start with `builtin.`. Use your own prefix for all your extensions, such as your GitHub name (`yourname.`), and the theme's short name after it: `yourname.mytheme`, `yourname.mytheme-board`. Never use `stavgayer.`: that prefix belongs to the maintainer's own themes in this repository.

A theme and its layout may point only at parts in the same theme folder or at `builtin.*` extensions. `node scripts/check.mjs` fails on any other id, which also catches an `acme.sample` id left over from the starter.

Every part of a theme carries the same `version`. Bump it in all of them when any of them changes, or people who have the theme do not get the update.

## The manifests

Every folder has an `extension.json`:

| Field | Meaning |
|---|---|
| `id` | The folder name. |
| `name` | Shown to people. |
| `version` | `x.y.z`, the same in every part of the theme. |
| `type` | `theme`, `layout`, `background` or `component`. |
| `api` | `1`, or `2` when the part uses the shared helpers (see below). |
| `requires` | Optional. The oldest agent-screensaver that can run the part, as `x.y.z`. From 0.5.0 on, an older app refuses to install it and tells people to update. |
| `entry` | Background and component only: the JavaScript file. |
| `options` | Settings people can change: `type` (`string`, `number`, `boolean`, `color`, `enum`, `file`), `default` (required), `label`, `min`, `max`, `values`. |

### Shared helpers (agent-screensaver 0.5.0 and later)

`window.agentScreensaver.helpers` gives every extension two helpers, so you do not copy them into your code:

| Helper | What it does |
|---|---|
| `songProgress(track, nowMs)` | How far the song is, from 0 to 1, or `null` when the app gives no length. Pass `ctx.now()`. |
| `recoverWebGL(api, surfaceOf)` | Wraps a background so it starts again on a fresh canvas after WebGL loses its context. `surfaceOf` returns your canvas. |

A part that uses them declares `"api": 2` and `"requires": "0.5.0"`. Older apps accept only api 1, so they refuse the theme instead of running code that breaks. The theme manifest, the layout and any part that uses no helper stay at api 1, but give them the same `"requires": "0.5.0"` so the whole theme states one minimum. `node scripts/check.mjs` fails when an api 2 part has no `requires` of 0.5.0 or later.

Use the helpers for a new theme: the starter does. Copy the code from [craft.md](craft.md) instead, and keep api 1 without `requires`, only if the theme must also run on 0.4.

The theme:

```json
{
  "id": "acme.mytheme", "name": "My Theme", "version": "1.0.0", "type": "theme", "api": 1,
  "theme": {
    "background": { "id": "acme.mytheme-ground" },
    "layout": "acme.mytheme-layout",
    "style": { "--accent": "#e6471d", "--attention": "#e6471d", "--done": "#ffffff", "--warn": "#f7a416" }
  }
}
```

`style` keys that start with `--` become CSS variables on the page. Built-in parts read `--accent`, `--attention`, `--done` and `--warn`; your own parts can read any variable you set.

The layout has three modes: `idle` and `attention` are required, `secondary` is optional. Each mode lists regions (`top-left`, `top-right`, `center`, `bottom`), and each region a list of components, which can carry `options`:

```json
{
  "id": "acme.mytheme-layout", "name": "My Theme layout", "version": "1.0.0", "type": "layout", "api": 1,
  "layout": { "modes": {
    "idle":      { "center": [{ "id": "acme.mytheme-board" }], "top-right": [{ "id": "builtin.limit-rings" }] },
    "attention": { "center": [{ "id": "acme.mytheme-board" }] },
    "secondary": { "center": [{ "id": "acme.mytheme-board", "options": { "show": "time" } }] }
  } }
}
```

A component that fills the whole screen (most boards here do) sits in `center` and sets its own `root` to `position: absolute; inset: 0`.

The `attention` mode above leaves the limits out on purpose: while an agent waits for you, everything except the approval steps back or hides ([design.md](design.md#3-design-every-screen-state)). Keep them in `attention` only if your own component dims them.

## Five states from three modes

The layout's modes are coarse: `idle` covers nothing running, working and all done; `attention` is an approval; `secondary` is a second screen. Work out the five states of [design.md](design.md#3-design-every-screen-state) from the view state yourself, as every theme here does:

```js
function moodOf(state) {
  if (state.display !== "main" || state.cards.length === 0) return "rest";
  if (state.cards.some(function (card) { return card.kind === "approval"; })) return "call";
  return state.cards.some(function (card) { return card.kind !== "finished"; }) ? "work" : "done";
}
```

## The entry file

One classic script: no `import`, no `export`. It registers a factory:

```js
(function () {
  window.agentScreensaver.register(function () {
    return {
      mount: function (root, ctx) {},   // component: build your elements in root
      update: function (state) {},      // every new state, and once a minute
      unmount: function () {},          // cancel frames, remove listeners, clear root
    };
  });
})();
```

A background returns `start(root, ctx)`, `update(state)` and `stop()` instead. A component can also have `setOptions(options)`, called when it moves to a placement with other options.

`ctx` gives:

| Member | Use |
|---|---|
| `ctx.options` | The merged options of this placement. |
| `ctx.requestFrame(cb, fps)` | Calls `cb(nowMs)` every frame at up to `fps` until you call the function it returns. Call it once. `nowMs` is the frame clock: milliseconds since the page loaded, not the time of day. |
| `ctx.now()` | The time of day in milliseconds (`Date.now()`). |

Never mix the two clocks. Inside a frame callback, read `ctx.now()` and ignore the argument, as the built-ins do:

```js
cancelFrame = ctx.requestFrame(function () { draw(ctx.now()); }, 15);
```

A theme that took the argument as the time of day, or drew once with `ctx.now()` and then with the argument, jumped on its first frame, and its eased values flew off for seconds.
| `ctx.display` | `"main"` or `"secondary"`. |

The view state your `update` gets:

| Field | What it holds |
|---|---|
| `mode` | `"idle"`, `"attention"` or `"secondary"`. |
| `cards` | One per task: `source`, `session`, `kind` (`approval`, `running`, `finished`, `unknown`, `no_activity`), `started_at_ms` and `updated_at_ms`, and when known `project`, `title`, `request`, `name`, `model`, `branch`, `context_percent`, `background`, `approval_since_ms`. |
| `agents` | By card `source`: `name` and `mark_url`. |
| `agentOrder` | The agents' sources, in the order limits are shown. |
| `limits` | One per usage window: `source`, `window` (`5h`, `week`, `plan`), `used_percent`, `resets_at` (seconds), `updated_at_ms`, `estimated`. |
| `nowMs` | The time of this state. |
| `serviceOk` | Whether the service runs. |
| `display` | `"main"` or `"secondary"`. |
| `nowPlaying` | Only when the user turned on "Show what's playing" and a song plays: `app`, `title`, `artist` (can be `""`), `position_ms`, `duration_ms` (`0` when the app gives no length), `at_ms`. Needs agent-screensaver 0.4.0. |

Any field marked "when known" can be missing, and privacy mode removes `title`, `request`, `name` and `branch` from every card and leaves out `nowPlaying`. Show what is there and leave out what is not. A guard costs nothing even for the fields that are always sent: never let a number that is not there print as "NaN".

`update` runs on every new state and once a minute. It does not run when the screen changes size. If anything you draw depends on the size (how many cards fit, where the song goes), listen for `resize` on `window`, keep the last state, and draw it again; remove the listener in `unmount` or `stop`.

## Files your code loads

A script finds its own folder while it first runs:

```js
var base = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
// then: base + "fonts/Archivo.ttf", base + "photos/field.jpg"
```

Fonts: load them with `@font-face` in your stylesheet or with `FontFace`, from a file in your folder, and ship the font's licence next to it.

## The rules for extension code

The essentials of [extension-code-rules.md](https://github.com/stavgayer/agent-screensaver/blob/main/docs/extension-code-rules.md). Every theme in this repository follows them.

What the page blocks (its policy is `default-src 'none'`):

| Blocked | So |
|---|---|
| Any network request: `fetch`, `XMLHttpRequest`, WebSocket, EventSource | Ship every file in your extension folder. |
| Scripts, styles, fonts, images and media from a web address | No CDN, no Google Fonts, no remote pictures. |
| Inline `<script>` and `onclick="…"` attributes | Attach handlers from your script. |
| `eval`, `new Function` and `setTimeout` with a string | Write plain code. |
| Images from `blob:` URLs, and fonts from `data:` URLs | Draw into a canvas, or ship the file. |
| Frames of any kind | Draw in your own `root`. |

Your code can use the web API above, files in its own folder (by a URL relative to its script), images as `data:` URLs, the DOM inside its `root`, CSS, canvas 2D and WebGL (ask for `powerPreference: "low-power"`). It cannot write files, leave the page or reach the settings.

The rules:

1. Touch only your own `root`. Parts of the same theme may read each other's position to share a layout, but never change them, and never read the elements of a built-in or of another theme.
2. Clean up. In `unmount` or `stop`, cancel what `requestFrame` gave you, remove every listener you added to `window` or `document`, and remove what you drew.
3. Draw with `ctx.requestFrame` at the lowest rate that looks right. No `requestAnimationFrame` loop or timer of your own that never stops.
4. Show times from the state: `state.nowMs`, and `ctx.now()` between states. Reading the clock for motion only, such as a drift against burn-in, is fine.
5. Respect "Reduce motion": stand still or fade, do not move or scale.
6. Handle a lost WebGL context ([craft.md](craft.md#recover-from-a-lost-webgl-context)).
7. Keep text readable everywhere, and cut long text with "…".
8. Show only what the state says. A field that is missing is left out.
9. Use no logos or artwork you do not own.
