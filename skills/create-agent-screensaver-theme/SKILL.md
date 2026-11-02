---
name: create-agent-screensaver-theme
description: >
  Designs, builds, tests and ships a theme for agent-screensaver, the macOS screen saver
  that shows what coding agents (Claude Code, Codex, Cursor) are doing.
  Trigger: when the user wants to create, design, restyle or improve an agent-screensaver
  theme, background or widget, or turn an album cover, poster or other picture into one.
license: MIT
metadata:
  author: stavgayer
  version: "1.2.0"
---

# Create an agent-screensaver theme

The seven themes in this repository look made, not generated, because each one came from one real source, studied closely, and was tested in every state on every screen shape. This skill is that method. Follow it in order.

## When to use

- Making a new theme for agent-screensaver, from a picture, a cover, a poster or an idea.
- Restyling or fixing a theme, a background or a widget.
- Adding a feature to a theme, such as the song that plays.

## Before you start

Work inside a fork or clone of [agent-screensaver-themes](https://github.com/stavgayer/agent-screensaver-themes). The new theme goes in its `themes/` folder, and the preview page, `scripts/check.mjs` and `scripts/pack.sh` run from there. If you are not in it, clone it first.

## The workflow

1. **Research the source** ([references/design.md](references/design.md)). Find what it is made of and how it was made. Write down the facts: shapes, ratios, colours as hex values, type. Never draw from memory, and never use the artwork or a logo. Reading the cover's pixels to measure it is fine, as long as no image is saved or shipped.
2. **Map the data onto it.** Each task becomes one element that belongs to the source. Each agent gets one colour from its palette.
3. **Design all five states**: nothing running, working, all done, needs you, second display. Plus the song, if the user turns it on.
4. **Start from the starter** ([assets/starter/](assets/starter/)): copy it to `themes/<name>/`, rename the `acme.sample` folders and ids to your own prefix, `<you>.<name>` (never `stavgayer.`, which is the maintainer's), then replace its background and restyle its board after your source ([references/build.md](references/build.md)).
5. **Apply the craft rules** ([references/craft.md](references/craft.md)): readable text, placement from the real layout, low cost, WebGL recovery, Reduce motion, the song.
6. **Test the matrix** ([references/test-and-ship.md](references/test-and-ship.md)) in the preview page and with the headless check (`assets/shoot.mjs`), then on the real screen saver.
7. **Ship**: `node scripts/check.mjs`, a README from the starter's with a still for every state, a row in the root README's table, and the same version in every part.

## Critical rules

| Rule | Why |
|---|---|
| Research the real source before you design | A theme drawn from measured facts looks like its source. One drawn from a mood looks like every other one. |
| Draw in code; no artwork, photos of it, or logos | It is a fan-made tribute, and the README says so. |
| Five states, each designed on purpose | "Nothing running" is what people see most; "needs you" must take over the screen with one move. |
| Small text on a plate, card or halo in the source's style | It must read over every part of the background. |
| Place elements from the real layout, not fixed positions | `vmin` and `vw` scale differently on 4:3, 16:10 and ultra-wide. Fixed spots overlapped in two themes. |
| Cut long text with "…" (`min-width: 0` in flex) | Long titles and song names must never run over other things. |
| `ctx.requestFrame` at the lowest rate that looks right (1 for a clock, 4 for a bar, never more than 30); WebGL at half scale, `low-power` | A screen saver runs all night. |
| Inside a frame callback, read `ctx.now()` | The callback's argument is the frame clock (ms since the page loaded), not the time of day. |
| Recover from a lost WebGL context, and remove the listener before `stop()` | Otherwise the background stays black after sleep, or restarts forever. |
| Respect "Reduce motion" | Stand still and fade. |
| Text only with `textContent`; show only what the state says | Titles and commands come from outside; privacy mode removes them. |
| No network, no remote files, no `eval` | The page blocks them. Bundle fonts and pictures with their licence. |
| The same version in every part; bump it on every change | Otherwise people who have the theme never get the update. |
| Your own id prefix, never `stavgayer.` | That prefix is the maintainer's own themes. |

The full rules for extension code are in [extension-code-rules.md](https://github.com/stavgayer/agent-screensaver/blob/main/docs/extension-code-rules.md); their essentials are in [references/build.md](references/build.md#the-rules-for-extension-code), so you can work without it.

## Commands

```bash
# Preview a theme in any state (setup in references/test-and-ship.md); any free port works
python3 -m http.server 8000
# then open .../skills/create-agent-screensaver-theme/assets/preview.html?pack=themes/my-theme&state=work&song=long
# more parameters: tasks=7, title=long, privacy=1, missing=1, agent=unknown

# Frame rate, Reduce motion, lost context, console errors, and the stills
node skills/create-agent-screensaver-theme/assets/shoot.mjs "<preview URL>" [--reduce] [--lose-context] [--out still.jpg]

# Check and pack
node scripts/check.mjs
scripts/pack.sh my-theme

# Check that it installs, without touching the real screen saver
HOME=$(mktemp -d) agent-screensaver ext install themes/my-theme

# Try it on the real screen saver (changes the user's setup)
agent-screensaver ext install themes/my-theme
agent-screensaver theme set yourname.mytheme
agent-screensaver demo --seconds 60
```

## Resources

- **Design method**: [references/design.md](references/design.md), with what each of the seven themes took from its source.
- **Building**: [references/build.md](references/build.md), the pack, the manifests, the five states and the API.
- **Craft**: [references/craft.md](references/craft.md), the lessons from these themes, with code.
- **Testing and shipping**: [references/test-and-ship.md](references/test-and-ship.md).
- **Starter theme**: [assets/starter/](assets/starter/), a small complete theme that follows every rule.
- **Preview page**: [assets/preview.html](assets/preview.html).
- **Headless check**: [assets/shoot.mjs](assets/shoot.mjs), frame rate, Reduce motion, lost context, console errors and the stills.
- **Worked examples**: the seven themes in [themes/](../../themes/).
