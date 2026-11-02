# Designing a theme

A theme looks made, not generated, when it comes from one real source and follows it closely. This file is the method the seven themes in this repository were made with, and what each one took from its source.

## 1. Research the source before you design

Pick one source: an album cover, a poster, a painting, a scientific plot, a place. Then study the real thing, not your memory of it.

- Find what it is made of: its shapes and their proportions, its exact colours, its type, its texture, and how it was made. How it was made often gives the best idea. (Kid A's cover was paint scraped with knives, photographed, and turned into a height map by software. The theme does the same in a shader.)
- Write the facts down: angles, ratios, counts, colours as hex values, the typeface or its nearest free match.
- Find its one strong idea. Each theme here has one: a wheel of wedges, a stack of pulses, a beam through a prism.

A theme drawn from a general mood ("retro", "calm", "neon") looks like every other one. A theme drawn from measured facts looks like its source.

Do not use the artwork itself, a photo of it, or any logo. Draw the look in code, from the facts you wrote down, and say in the README that the theme is a fan-made tribute that includes no artwork or logos.

## 2. Map the data onto the source's own elements

The screen shows agents at work. Give each task one element that already belongs to the source, so the data looks like part of the picture:

| Theme | Source | One task is |
|---|---|---|
| In Colour | Colour wedges fanned from one point, one white bar cut at 45° | A white card with a band in the agent's hue |
| Pablo | Flat orange field, stacked rows of black Arial Bold, two photos | A printed card, and the rows say the state ("STILL WORKING") |
| Currents | Thin lilac lines on a dark surface, a chrome ball, a red thread, a wake | A chrome ball with its own coloured thread |
| Kid A | Ice-white peaks under a black sky, a red band, small fires | A ridge that grows with the time the task runs, with a fire over it |
| Unknown Pleasures | 80 stacked radio pulses of a pulsar, white on black | A band of lines that peaks while the task works |
| Prism | A white beam enters a prism and leaves as six bands of colour | One band of the spectrum, running to the task's card |
| Key of Life | Torn rings in airbrushed reds, orange and amber around a glowing centre | One ring between the centre and the cards |

Give each agent one colour from the source's palette, and use it everywhere for that agent: its element, its card, its limit rings. Give agents you do not know a colour from the palette by their name, so the same agent always gets the same colour. Each theme here picks its own (Key of Life: Claude vermilion, Codex gold, Cursor crimson; In Colour: Claude vermilion, Codex blue, Cursor green).

## 3. Design every screen state

The screen saver has five states. Design each one on purpose; do not let one be the leftover of another.

| State | When | What it must do |
|---|---|---|
| Nothing running | No tasks | Show the source at rest, close to the original. The time large, the date, the usage limits. This is the state people see most. |
| Working | Tasks run | One element per task, a count ("3 working"), and a card per task: the agent, how long, the task, the project. |
| All done | Every task finished | Calm down: elements settle, colours fade toward the source's base, cards say done. |
| Needs you | An agent waits for approval | One move takes over the screen: the waiting agent's colour, a large "Needs you", the agent, how long it has waited, the exact command, the project. Everything else steps back or hides. |
| Second display | A second screen | The source and the time only. No tasks, no approval. |

If the user turned on "Show what's playing", also design the song: its title, its artist and its progress, in the theme's own style, in a spot that is free in every state (see [craft.md](craft.md#the-song-that-plays)). It hides while an agent waits for you.

## 4. Type and text

- Use at most two families: one display face for big words and numbers, one text face for small text. Bundle them as files with their licence (the SIL Open Font License is the common one), because the page cannot load fonts from the internet.
- Make every word readable over every part of the background. Put small text on a plate, a card or a soft dark halo in the source's own style: Kid A uses near-black plates, Key of Life cream labels, Pablo printed cards, In Colour white bars cut at 45°.
- Big words stand on calm parts of the picture. Keep busy texture away from them.

## 5. Motion

- Move slowly. A screen saver runs for hours; motion should feel like the source breathing, not like an app.
- One clear move per event: a task starts, a task finishes, an agent needs you. Nothing pulses while it waits.
- Drift the whole picture by a few pixels over minutes, so no pixel stays lit in one place.
- With "Reduce motion" on, stand still and fade instead of moving.

## 6. Check it against the source

Put your screenshot next to the source. If someone who knows the source would not recognise it in a second, go back to step 1. The theme people loved most here (In Colour) was the one that followed its cover's real geometry most closely.
