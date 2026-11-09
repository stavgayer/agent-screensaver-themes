# Favourite theme

Date: 2026-11-08. Owner: Stav Gayer. Status: draft for owner review.

## Why

The built-in Chrome theme feels generic to the owner. It came from a mood (the stage look of Fontaines D.C.), not from one real source. This repository's method is the opposite: pick one real source, measure it, and make every piece of data an element of that source.

The owner chose the cover of the Fontaines D.C. single *Favourite* (2024) as the one source. The owner does not want any built-in theme tied to a band. So Favourite is a new community theme in this repository, the ninth. Built-in Chrome does not change in this work.

## Goals

- A new theme, `themes/favourite/`, made with the `create-agent-screensaver-theme` skill and its rules.
- Someone who knows the cover recognises the theme in one second.
- Every state is designed on purpose: nothing running, working, all done, needs you, second display, and the song.

## Non-goals

- Changes to built-in Chrome or to the app. A later, separate job looks at Chrome.
- Other covers from the same era (Romance, Starburster and others).

## Anti-goals (a failure even if it works)

- Any artwork, photo of the cover, or logo in the repository or the zip. Everything is drawn in code.
- The band's painted wordmark copied. We use a free blackletter font.
- A needs-you card that is hard to read. Looks never beat "what does the agent want".
- A theme that makes the fan spin or drains the battery overnight.

## The source: facts

Measured on 2026-11-08 from a 500 x 500 thumbnail (Cover Art Archive). The image was deleted after measuring. Values are within about 5 per channel.

- Artist: Lulu Lin. The band licensed five of her existing pieces for the album and singles. The album, all singles and this cover share one look: a glossy, airbrushed pink creature in a blue sky, with the title in acid-lime blackletter at the top centre.
- Composition: a heart-shaped face, about 79% of the frame width and about 1:1, sits centred and low. Its eyes are shut. Three silver daggers stand in its top edge (left, centre, right). Small spikes are under it. A drip hangs at the lip.
- Colours:
  - Sky, about 54% of the frame: `#034d87` at the top, through `#096faa` and `#52a4c7`, to `#87c2c4` at the bottom.
  - Face, about 28%: `#d34d68` and `#eba6b3`.
  - Daggers: silver, the only metal on the cover (not measured).
  - Type: `#9bf95e`.
- Finish: smooth airbrush gradients and glossy, chrome-like highlights on the skin. No grain.
- Type: hand-painted blackletter, lower case. Nearest free font: UnifrakturCook (SIL OFL).
- Its one strong idea: a heart pierced by daggers. Love as injury.
- Sources: https://theartofcoverart.substack.com/p/the-visual-romance-behind-fontaines , https://www.itsnicethat.com/articles/lulu-lin-project-illustration-080323 , MusicBrainz release data.

## The data on the cover (owner decisions)

| Data | Element of the cover |
|---|---|
| One task | One dagger in the top edge of the heart. Its handle has the agent's colour. More than three tasks spread along the top edge. |
| How long a task runs | Its dagger sinks into the heart, very slowly. |
| A task is done | Its dagger glints one time, then stays still. |
| An agent needs you | The face opens its eyes. This is the only time the eyes open. |
| The time and the date | The title spot at the top centre: the time large in lime blackletter, the date small under it. |
| One usage limit | One spike under the heart. It grows longer as more of the limit is used. It has the agent's colour. A small label under it on a dark blue plate gives the agent, the limit, the percent used and the reset time. |
| The task cards | In the open sky to the left and the right of the heart, in columns. A dark navy plate (`#034d87` or darker) with a thin edge in the agent's colour. On narrow screens (4:3) the cards go in a row under the limit labels. |
| The song | The drip at the lip grows as the song plays and falls when it ends. The title and the artist go in one small line under the date. |

Agent colours come from the cover's own palette, one colour per agent, the same on its dagger handle, its card edge and its spikes. Unknown agents get a palette colour by their name. The exact colour for each agent is the builder's choice, from the measured palette.

## The five states

- **Nothing running.** The heart alone, low in the blue sky, eyes shut, no daggers. The clock and the date at the top. The spikes and their labels under the heart. This is the state people see most.
- **Working.** One dagger per task, sinking slowly. One card per task beside the heart, with the agent, how long, the task, and the project (and model, branch and context when known).
- **All done.** Every dagger stays in place, still and glinted. The cards say done. The sky stays the cover's resting blue (working does not change the sky; only needs-you does). Nothing moves. When the app clears the finished tasks, each dagger slides out and falls away, and the heart is whole again.
- **Needs you.** One move takes over the screen. The eyes open. The waiting agent's dagger turns lime and the other daggers dim. The sky goes to its deepest blue. The cards and the limit labels fade back. One large card sits over the lower half of the heart: "needs you" in large lime blackletter, then the agent, how long it waited, the project, and the exact command in a plain monospace font. The song hides.
- **Second display.** The sky and the heart, eyes shut, and the clock. No tasks, no approval.

## Type

- Display: UnifrakturCook for the time, the date and "needs you". Test the digits first. If they do not read clearly from across a room, use a bold plain face for the digits only.
- Text: one plain face for the cards and labels, and a monospace face for the command. The builder picks them, preferably from the fonts already in this repository (see the skill's `references/design.md`).
- Small text sits on dark blue plates so it reads over every part of the sky and the heart.

## Motion

- The heart breathes: a very slow swell, about one breath every 8 seconds. Light slides across its gloss from time to time.
- One move per event: a new dagger stabs in with one short move, a finished dagger glints once, the eyes open. The eyes opening is the only fast move.
- The whole picture drifts by a few pixels over minutes, against burn-in.
- With "Reduce motion" on: stand still and fade.

## How it is built

- The builder's choice (agreed): the sky, the heart and the daggers are one WebGL fragment shader at half resolution and a low frame rate, like Currents. Text, cards, the clock and the labels are page elements on top.
- Parts, like the other themes: a theme, a layout, a background (the shader), and components for the board, the clock and the limits. Ids use the `stavgayer.favourite` prefix. api 2, `"requires": "0.5.0"`, the same version in every part.
- The skill's craft and test rules apply in full: the preview matrix at every screen shape, WebGL context recovery, the frame rate rules, privacy mode, long text cut with "…".

## Ship

- `node scripts/check.mjs`, a README from the starter's that says the theme is a fan-made tribute with no artwork or logos, a still for every state and a demo gif, a row in the root README's table, a CHANGELOG section.
- Released in the next themes release, v1.4.0. Every part of Favourite starts at version `1.4.0`, the same way Piñata started at the release it shipped in (`1.1.0`).

## Calls made after the builder check (not owner decisions)

A reviewer read this document as a builder. These are the answers to its questions. They are the designer's calls; the owner can change any of them.

- **Layout owner.** One layout function computes the heart's centre and size from the screen, and passes the same numbers to the shader (uniforms) and to the page elements. Spike labels, cards and the needs-you card are placed from those numbers, never from fixed positions.
- **Size on every screen.** The heart scales by the smaller side (`vmin`) and shrinks to fit. It never crops. The vertical order is: clock and date, heart, spikes and labels, and on 4:3 the card row. Test at 1024 x 768, 1440 x 900 and 3440 x 1440.
- **Spikes.** One spike per limit the app sends (it can be six or more). The labels go in one row under the heart and wrap to a second row when they do not fit. With no limit data there are no spikes. The skill's craft rules for old readings ("est.", "Reset") apply to the labels. A spike is at least 15% of its full length at 0% (so it is always visible) and full length at 100%.
- **Daggers.** Daggers stand evenly along the top edge of the heart, and the cover's three spots are the positions for three tasks. One dagger stands at the centre, two stand at the left and the right spots. At most 7 daggers are drawn. A task past the seventh has a card but no dagger.
- **Cards.** As many cards per side as fit the height. When more tasks run than fit, the last card on the right says "+N more".
- **Sink.** A dagger sinks from 0 to its full depth over 60 minutes on an ease-out curve, then stays at full depth. Full depth is about a third of the blade.
- **More than one agent waiting.** The large card shows the one that has waited longest. A small line under it says "+N more waiting". Every waiting agent's dagger turns lime.
- **Song with no length.** When the app gives no length, the drip hangs at half length and does not move. The song never shows on the second display.
- **Reduce motion.** The eyes cross-fade from shut to open. Daggers fade in and out instead of moving.
- **Lime is reserved** for the clock, "needs you" and waiting daggers. No agent colour may be close to it.

## Left to the builder

- The exact agent colours, the plain text face and the monospace face.
- How the face, the eyes, the daggers and the spikes are drawn in the shader, as long as the result follows the measured facts.
- Exact sizes, spacing and timings, inside the rules above.

## Owner change after the first build (2026-11-09)

The owner saw the stills. Everything but the heart was approved. The heart looked like a cartoon: on the cover it is more metallic and more oval, and its face is not a cartoon. These decisions replace every mention of the face, the eyes and the lip above:

- **No face.** The heart has no eyes, no lips and no face of any kind.
- **Pink chrome.** The heart is a mirror-like metal surface tinted the cover's pinks (`#d34d68`, `#eba6b3`). It reflects the blue sky and has sharp, bright highlights. It must read as metal, not as glossy plastic.
- **Oval.** The heart is wider than it is tall, about 1.15 : 1, like the album's heart.
- **Needs you.** The one move is now the chrome flooding with lime: the heart's reflections take the lime `#9bf95e` as if a lime light came on, and the sky darkens as before. Nothing pulses. Everything else in needs-you stays as it was (lime waiting daggers, other daggers dim, cards fade, the large card).
- **The song.** The drip is a drop of liquid chrome that hangs from the heart's bottom point. It grows as the song plays and falls when it ends; it hangs at half length when the song has no length.
- **Reduce motion.** The lime flood cross-fades in and out.

## Second owner change (2026-11-09)

The owner shared three references: the *Romance* album heart, the *Favourite* cover, and the stage heart from the Romance tour (a large inflated mylar heart). Decisions:

- **Lighter pink.** The heart is the covers' hot pink with light pink highlights, not maroon. Colours are measured from the references, not guessed.
- **Thin, soft reflection.** One soft, thin highlight band and soft broad highlights, airbrushed like the covers. No heavy band that splits the heart in two.
- **The heart shape reads first.** Wide rounded top lobes, a shallow dip between them, sides that taper to a soft, slightly blunt point, wider than tall, as on the *Favourite* cover. It reads as a heart at a glance in every state, including needs-you.
- **Liquid motion.** The heart is alive like the original Chrome theme's liquid shape: its outline and surface wobble slowly like an inflated balloon or a liquid blob, and its reflections shift with it. The motion is slow and low (a screen saver), never rubbery or fast. Daggers, spikes and the drip stay attached to the moving edge.
- **Reduce motion.** The heart stands still (no wobble).
