# Favourite

A fan-made tribute theme for agent-screensaver. It is inspired by the cover of the Fontaines D.C. single Favourite (2024), art by Lulu Lin: a wide, hot pink heart, low in a blue sky, with silver daggers in its top edge and the title in acid-lime blackletter at the top. Here each task is a dagger in the heart, each usage limit is a steel spike under it, the song is a drip of the heart's own liquid from its bottom point, and when an agent needs you lime light floods the heart's highlights. Everything is drawn in code. It includes no artwork, cover image or logos.

![Favourite working, then an agent needs you, looping demo](media/demo.gif)

Needs [agent-screensaver 0.5.0](https://github.com/stavgayer/agent-screensaver/releases/tag/v0.5.0) or later.

## What the screen shows

| State | Still |
|---|---|
| Agents working: one polished steel dagger stands in the top edge of the heart for each task, up to seven, with a thin band in the agent's colour on its grip. Each task also gets a dark blue card in the sky beside the heart, with the agent, how long it has run, the task, the project and the branch. A dagger sinks very slowly into the heart over the first hour. When more tasks run than the columns can hold, the last card says `+N more`. On narrow screens (4:3 and 5:4) the cards go in one row under the limits. | ![Working](media/working.jpg) |
| All done: every dagger stays where it is and glints one time. The cards say `done`. The daggers stand still. When the app clears the finished tasks, each dagger slides out and falls away. | ![Done](media/done.jpg) |
| An agent waits for you: the heart's highlights turn lime, as if a lime light came on, the sky goes to its deepest blue, the waiting agent's dagger turns lime and the other daggers dim. The cards and the limits fade back, and one large card sits over the heart's point: `needs you` in lime blackletter, the agent, how long it has waited, the project and the exact command. If more than one agent waits, the one that has waited longest shows, with a line `+N more waiting`. The song hides. | ![Needs you](media/approval.jpg) |
| Nothing running: the heart alone, low in the sky, no daggers. The time in lime blackletter at the top centre, the date under it, and the usage limits under the heart. With "Show what's playing" on, the song line shows under the date and the drip hangs from the heart's bottom point. | ![Idle](media/idle.jpg) |
| Second display: the sky, the heart, the time and the date. | ![Second display](media/secondary.jpg) |

Each usage limit is one polished steel spike that comes out of the heart's bottom edge, like the small silver spikes on the cover, with a thin tint of its agent's colour where it leaves the heart. It grows longer the more of the limit is used, and it is never shorter than 15% of its full length, so it stays visible. A small dark blue plate under each spike gives the agent, the window (`5h`, `week` or `plan`), the percent used and when it resets. A limit the app has not read is left out. A reading that is old is dimmed and shows its age, such as `2h ago`. `est.` marks an estimated reading. `Reset` with 0% shows a window that has reset.

With "Show what's playing" on, the title and the artist show in one small pink line under the date, and the heart's own pink liquid runs from its bottom point: the drip and the heart are one smooth surface, with no seam. The drip grows longer and a drop swells at its end as the song plays. When the song ends, the drop breaks off and falls. A song that Music streams has no length, so its drip hangs at half length and stays. With no song there is no drip. The song hides while an agent waits for you, and it never shows on the second display.

Each agent owns one colour from the cover: Claude red `#d34d68`, Codex sea green `#87c2c4`, Cursor pink `#eba6b3`. Other agents get one of those or a light silver by their name. The steel has no outline: it turns darker at its edges, so it reads on the sky. Lime is kept for the time, the date, `needs you` and the grip band of a waiting agent's dagger. All small text sits on dark blue plates, so it reads over the sky. Privacy mode keeps working: titles, commands and branches show only when the service sends them. Without a command the approval says "Look at the terminal".

## Motion

- The heart has the shape of the Favourite cover's heart: wide round lobes, a shallow dip between them, and sides that taper to a soft point. It is wider than it is tall. It looks like thick, glossy pink liquid. Its pinks were measured on the Favourite cover and the Romance album heart: hot pink `#f96c87`, deep pink `#d34663` and dark red `#b72342` away from the light, light pink `#feb2d7` where the light falls, and a touch of magenta `#e878bc` at the edge. The darker parts softly mirror the blue sky, like liquid chrome. Soft, broad highlights sit on the lobes, small sharp white glints catch the light, and one thin, soft line of light follows the top edge.
- The heart is liquid. Its outline flows and bulges like a blob of liquid: slow waves that feed into other waves, taking 6 to 14 seconds each and moving the edge by about 5 to 8% of the heart's size, less near the point so the point stays a point. Over a few seconds you see bulges travel across it. The highlights and the glints flow with the surface, and a slow swirl of noise moves the light over it. While an agent needs you, the outline moves half as much, easing in and out with the lime, so the heart keeps its lobes and dip; the light keeps flowing. The daggers, the spikes and the drip stay on the moving edge. The spikes stand out from the surface and sway as it turns. The drip swings and stretches a moment after the point moves. The heart also breathes: a very slow swell of about 1.5% every 8 seconds.
- The daggers and the spikes are polished steel. Like a mirror, they show the sky above and the heart's pink below, with a bright line where the two meet, sharp white highlights, and darker steel at their edges. The daggers follow the cover's shape: a slim blade with two faces that meet in a ridge, a steeper bevel at each edge and a sharp bright line along its lit edge, a long, thin crossguard whose ends flare, a plain steel grip and a round pommel. A thin band on the grip is in the agent's colour (lime while that agent waits for you). With six or seven tasks the daggers are drawn a little smaller, with shorter crossguards, so they do not overlap. Where a blade goes into the heart, the liquid climbs it a little, small ripples run out from it, and the blade casts a soft shadow on the skin.
- The whole picture drifts a few pixels over minutes, so no pixel stays lit in one place. Option `drift` sets the minutes for one drift (4 by default).
- One move for each event. A new task stabs a dagger in with one short move. A finished task glints once. When an agent needs you, lime floods the heart's highlights and the sky goes deep blue, both over about a second. Nothing pulses.
- The background is one WebGL shader. It draws at three quarters of the screen's size (option `scale`, 0.75 by default), so the steel edges stay crisp. It draws 12 frames a second (option `fps`, at most 30), and it starts again on its own if the graphics card resets.
- With "Reduce motion" on in macOS, the picture stands still: the heart does not flow, breathe or drift, the spikes do not sway, the liquid around the blades does not ripple, and the picture is drawn again only when something changes. The drip still gets longer as the song plays, without swinging, and it fades out when the song ends. The lime cross-fades in and out, and daggers fade in and out instead of moving.

## What is in this folder

| Folder | Type | What it does |
|---|---|---|
| `stavgayer.favourite` | theme | Picks the background and the layout. |
| `stavgayer.favourite-layout` | layout | The board over the whole screen. A second display shows the board with the time only. |
| `stavgayer.favourite-ground` | background | The sky, the heart, the daggers, the spikes and the drip. Options: `fps`, `scale`, `drift`. |
| `stavgayer.favourite-board` | component | The time and the date, the song, the task cards, the limit plates and the needs-you card. Option `show`: `agents` (default) or `time`. |

The `media` folder holds the stills and the demo for this page. It is not part of the pack zip.

## Install

Download `favourite.zip` from the Releases page of this repo. Open the agent-screensaver settings window, drop the zip on it or click Install… under Extensions, then pick the theme under Theme & background.

Or in Terminal, with the `agent-screensaver` command set up as the [main README](../../README.md#in-terminal) shows:

```
agent-screensaver ext install favourite.zip
agent-screensaver theme set stavgayer.favourite
```

To build the zip yourself, run `scripts/pack.sh favourite` from the root of this repo.

## Uninstall

```
agent-screensaver ext remove stavgayer.favourite
```

This removes the theme and its parts that no other theme uses.

## Options

To use less power, lower the frame rate or the render scale. To move the picture more slowly, raise the minutes for one drift:

```
agent-screensaver option set stavgayer.favourite-ground fps 10
agent-screensaver option set stavgayer.favourite-ground scale 0.35
agent-screensaver option set stavgayer.favourite-ground drift 8
```

## Credits and licences

- Theme code and manifests: MIT, see the `LICENSE` file at the root of this repo.
- Font: UnifrakturCook, for the time, the date and `needs you`, SIL Open Font License 1.1. Files: `UnifrakturCook-Bold.ttf` and `OFL-UnifrakturCook.txt` in the `fonts` folder of `stavgayer.favourite-board`.
- Font: Outfit, for the cards, the plates and the song, SIL Open Font License 1.1. Files: `Outfit.ttf` and `OFL-Outfit.txt` in the `fonts` folder of `stavgayer.favourite-board`.
- Font: JetBrains Mono, for the approval command, SIL Open Font License 1.1. Files: `JetBrainsMono.woff2` and `OFL-JetBrainsMono.txt` in the `fonts` folder of `stavgayer.favourite-board`.
- Fan-made tribute. Not affiliated with Fontaines D.C., Lulu Lin or their label.
