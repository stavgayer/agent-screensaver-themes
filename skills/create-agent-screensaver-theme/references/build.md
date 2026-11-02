# Building a theme

The parts, the files and the API a theme is written against. The full reference is [extensions.md](https://github.com/stavgayer/agent-screensaver/blob/main/docs/extensions.md) in the agent-screensaver repository, and the rules for extension code are in [extension-code-rules.md](https://github.com/stavgayer/agent-screensaver/blob/main/docs/extension-code-rules.md). This file is the part you need every time.

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

The folder name is the extension's `id`. Ids are lowercase letters, digits and dashes with at least one dot, and must not start with `builtin.`. Use one prefix for all your extensions (`yourname.`), and the theme's short name after it.

Every part of a theme carries the same `version`. Bump it in all of them when any of them changes, or people who have the theme do not get the update.

## The manifests

Every folder has an `extension.json`:

| Field | Meaning |
|---|---|
| `id` | The folder name. |
| `name` | Shown to people. |
| `version` | `x.y.z`, the same in every part of the theme. |
| `type` | `theme`, `layout`, `background` or `component`. |
| `api` | Exactly `1`. |
| `entry` | Background and component only: the JavaScript file. |
| `options` | Settings people can change: `type` (`string`, `number`, `boolean`, `color`, `enum`, `file`), `default` (required), `label`, `min`, `max`, `values`. |

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
    "attention": { "center": [{ "id": "acme.mytheme-board" }], "top-right": [{ "id": "builtin.limit-rings" }] },
    "secondary": { "center": [{ "id": "acme.mytheme-board", "options": { "show": "time" } }] }
  } }
}
```

A component that fills the whole screen (most boards here do) sits in `center` and sets its own `root` to `position: absolute; inset: 0`.

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
| `ctx.requestFrame(cb, fps)` | Calls `cb(nowMs)` every frame at up to `fps` until you call the function it returns. Call it once. |
| `ctx.now()` | The current time in milliseconds. |
| `ctx.display` | `"main"` or `"secondary"`. |

The view state your `update` gets:

| Field | What it holds |
|---|---|
| `mode` | `"idle"`, `"attention"` or `"secondary"`. |
| `cards` | One per task: `source`, `session`, `kind` (`approval`, `running`, `finished`, `unknown`, `no_activity`), and when known `project`, `title`, `request`, `name`, `model`, `branch`, `context_percent`, `background`, `started_at_ms`, `updated_at_ms`, `approval_since_ms`. |
| `agents` | By card `source`: `name` and `mark_url`. |
| `agentOrder` | The agents' sources, in the order limits are shown. |
| `limits` | One per usage window: `source`, `window` (`5h`, `week`, `plan`), `used_percent`, `resets_at` (seconds), `updated_at_ms`, `estimated`. |
| `nowMs` | The time of this state. |
| `serviceOk` | Whether the service runs. |
| `display` | `"main"` or `"secondary"`. |
| `nowPlaying` | Only when the user turned on "Show what's playing" and a song plays: `app`, `title`, `artist` (can be `""`), `position_ms`, `duration_ms` (`0` when the app gives no length), `at_ms`. Needs agent-screensaver 0.4.0. |

Any field marked "when known" can be missing, and privacy mode removes `title`, `request`, `name` and `branch`. Show what is there and leave out what is not.

## Files your code loads

A script finds its own folder while it first runs:

```js
var base = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
// then: base + "fonts/Archivo.ttf", base + "photos/field.jpg"
```

Fonts: load them with `@font-face` in your stylesheet or with `FontFace`, from a file in your folder, and ship the font's licence next to it.
