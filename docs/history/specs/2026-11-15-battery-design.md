# Battery in the community themes: design

Date: 2026-11-15. Status: approach approved by the owner; this note waits for approval.

## Why

agent-screensaver v0.6.0 shows the battery, so you know from across the room when a laptop that runs agents will die. The built-in themes draw it. The community themes do not, so a person who uses Favourite or Kid A does not see the warning. This change gives every community theme the battery, each in its own style.

## The contract (from the app)

- `state.power` is there whenever the Mac has a battery: `on_battery`, `percent`, `minutes_left` (optional), `charging`, `low`, `warn`, `working`. A Mac without a battery has no `power`.
- On battery: show the percent and the time left (`2h 10m left`); leave the time out when `minutes_left` is missing.
- On a power plug: show the percent and `Charging` while it charges, else `Full` at 100%, else `Plugged in`.
- `low` and `warn` are false on a power plug. The theme reads them and does not repeat the rule.
- When `warn` is true: one line, `Battery 18%: plug in, 2 agents are working` (`1 agent is working` for one), from `percent` and `working`.
- The battery shows only on the main display, and also in privacy mode.
- The field is optional, so no theme needs `requires: "0.6.0"`. Older apps send no `power`, and the theme draws nothing.

## Goals

- Every community theme draws the battery and the warning, in the theme's own look.
- Nothing changes on a Mac without a battery, or on an older app.

## Non-goals

- No change to the RAM theme (private).
- No new shapes in the ring themes beyond one more ring.
- No sound, tray or attention changes: the app already does them.

## Approaches (decided)

For Favourite the owner chose **one more steel spike with its own plate** over two others: the chrome in the heart draining like a liquid level (most poetic, but hard shader work, and it fights the lime flood that means "needs you"), and a plate with no spike (cheap, but unlike everything else under the heart).

For the other eight themes the owner chose **one more ring after the usage rings**, in each theme's own ring style, over a separate idea per cover. Every one of them already draws limits as rings, so the battery reads as one more of the same.

## Favourite

- **The spike.** The battery is one more steel spike, always the last one on the right, after the limit spikes. Its length is how empty the battery is (`100 - percent`), so every spike means the same thing: longer is closer to running out. It keeps the 15% minimum length of an unused limit, so a full battery still shows a stub. The thin tint at its root is the board's pale steel blue `#a9c6da` instead of an agent colour (the cover's light pink was first chosen, but it is Cursor's colour in this theme). It counts in the spike spread and in `maxSpikes` like a limit.
- **The plate.** Under the spike, the same dark blue plate as a limit: the name `Battery`, the percent on the right, and the detail under them (`2h 10m left`, `Charging`, `Full` or `Plugged in`). The plate edge is the same steel blue. When `low` is true, the percent is lime.
- **The warning.** When `warn` is true, the line under the date shows the warning in lime, in place of the song, and the song line hides. When `warn` turns false, the song comes back. The drip keeps showing the song.
- **Layout.** The frame counts the battery as one more limit, in both the ground and the board, so the label row and the heart size stay in step. With no limits and a battery, the frame has one spike and one plate.
- **Needs you.** The battery plate fades back with the limit labels. The warning line hides with the song, because the large card owns the screen.

## The ring themes

Currents, Dark Side of the Moon, In Colour, Kid A, Pablo, Piñata, Songs in the Key of Life, Unknown Pleasures.

- **The ring.** One more ring after the usage rings, built by the theme's own ring function, so it has the same size, stroke, plate and caption. The arc is the percent left. The centre shows the percent; the caption shows `Battery` and the detail (time left, `Charging`, `Full` or `Plugged in`).
- **Colours.** Three states, each from the theme's own palette (already measured from its cover): on battery, the theme's neutral text colour; on a power plug, the theme's accent; when `low`, the theme's warm alarm colour. None may match an agent colour in that theme. Pablo has no palette beyond orange and black, so its battery ring is black, and when low it takes the existing `high` stamp fill.
- **The warning line.** Under the rings, in the theme's caption type, in the alarm colour. It hides with the rings while an agent needs you, where the theme already hides its rings or song.

## Preview and skill

- `preview.html` gets a `power` URL parameter: `none` (default, no field), `battery` (64%, 110 minutes left), `low` (18%, 34 minutes, `warn` true, `working` from the task count), `idle-low` (18%, `low` true, `warn` false, 0 working), `charging` (80%), `full` (100%, plugged in, not charging), `plugged` (79%, plugged in, not charging). In privacy mode the field stays.
- `references/test-and-ship.md` lists the parameter in its table and adds the battery states to the check list. `SKILL.md` names `power` where it lists the edge-case parameters.

### The skill teaches `power` (owner added, 2026-11-15)

The skill does not mention `state.power` today, so a new theme would miss it.

- `references/build.md`: one row for `power` next to `nowPlaying`, with the shape `{on_battery, percent, minutes_left?, charging, low, warn, working}`. It says: present whenever the Mac has a battery; `low` and `warn` only on battery; `minutes_left` can be missing; optional, so older themes keep working and need no `requires` change; needs agent-screensaver 0.6.0. The wording comes from the app's `docs/extensions.md`, and it documents only what the app does.
- `references/design.md` and `references/craft.md`: short guidance. Treat the battery like a limit. Be loud only when `warn` is true, and use the `working` count in the line. On a power plug show `Charging`, `Full` or `Plugged in`. Never draw it on the second display. `craft.md` also holds the shared `powerView` and `powerWarning` code that the themes copy.
- `SKILL.md`: version 1.5.0 to 1.6.0.

## Versions

Each changed theme gets a patch bump on every part (the check script needs one version per theme). No `requires` change.

## Left to the builder

- The exact neutral, accent and alarm colours per ring theme, from the theme's own palette.
- Where the warning line sits in themes whose rings move between rest and work.
- Small spacing so the extra ring or plate fits at 4:3 and 21:9.

## Done

The owner approved the look; every theme draws each `power` state in the preview at every screen shape; `node scripts/check.mjs` passes; the changes are committed on the `feat/battery` branch.
