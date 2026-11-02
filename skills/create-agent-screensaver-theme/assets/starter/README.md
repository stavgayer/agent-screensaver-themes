# Sample

<!-- Replace every line in this file. Keep the headings: the other themes use them. -->

A fan-made tribute theme for agent-screensaver. It is inspired by <the source, in one or two sentences: what it is and how it was made>. Here <how the data of the agents becomes part of the picture>. Everything is drawn in code. No artwork, photos of it, or logos are included.

Needs [agent-screensaver 0.3.0](https://github.com/stavgayer/agent-screensaver/releases/tag/v0.3.0) or later. The song needs 0.4.0 or later.

## What the screen shows

| State | Still |
|---|---|
| Agents working: <one element per task, the count, the cards>. | ![Working](media/working.jpg) |
| All done: <how it calms down>. | ![Done](media/done.jpg) |
| An agent waits for you: <the one move that takes over the screen>. | ![Needs you](media/approval.jpg) |
| Nothing running: <the source at rest, the time, the date, the limits>. | ![Idle](media/idle.jpg) |
| Second display: <the source and the time only>. | ![Second display](media/secondary.jpg) |

With "Show what's playing" on, <where the song shows and how it looks>. It hides while an agent waits for you.

<Each agent's colour. How small text stays readable. That privacy mode works and what the approval says without a command.>

## Motion

- <The slow motion of the picture, and the drift against burn-in.>
- <The one move for each event.>
- <The frame rate and render scale, and their options.>
- With "Reduce motion" on in macOS, <what stands still and what fades>.

## What is in this folder

| Folder | Type | What it does |
|---|---|---|
| `yourname.sample` | theme | Picks the background and the layout. |
| `yourname.sample-layout` | layout | Where the components go in each mode. |
| `yourname.sample-ground` | background | <What it draws.> Options: `fps`. |
| `yourname.sample-board` | component | <What it shows.> Option `show`: `agents` (default) or `time`. |

The `media` folder holds the stills for this page. It is not part of the pack zip.

## Install

Download `sample.zip` from the Releases page of this repo. Open the agent-screensaver settings window, drop the zip on it or click Install… under Extensions, then pick the theme under Theme & background.

Or in Terminal, with the `agent-screensaver` command set up as the [main README](../../README.md#in-terminal) shows:

```
agent-screensaver ext install sample.zip
agent-screensaver theme set yourname.sample
```

To build the zip yourself, run `scripts/pack.sh sample` from the root of this repo.

## Uninstall

```
agent-screensaver ext remove yourname.sample
```

This removes the theme and its parts that no other theme uses.

## Credits and licences

- Theme code and manifests: MIT, see the `LICENSE` file at the root of this repo.
- Font: <name>, for <what>, SIL Open Font License 1.1. Files: `<Font>.ttf` and `OFL-<Font>.txt` in the `fonts` folder of `<component>`.
- Fan-made tribute. Not affiliated with <the artist, the label>.
