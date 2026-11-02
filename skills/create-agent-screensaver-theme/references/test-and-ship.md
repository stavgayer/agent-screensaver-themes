# Testing and shipping a theme

## The preview page

[`assets/preview.html`](../assets/preview.html) shows any theme pack in a browser, in any state, with made-up data, using the real agent-screensaver runtime. Set it up once from the root of this repository:

```bash
mkdir -p .preview
cp -R "$HOME/Library/Application Support/agent-screensaver/runtime" .preview/runtime
mkdir -p .preview/extensions
cp -R "$HOME/Library/Application Support/agent-screensaver/extensions"/builtin.* .preview/extensions/
python3 -m http.server 8000
```

Copy only the `builtin.*` extensions: they are the shared parts a layout can use. Then open:

```
http://localhost:8000/skills/create-agent-screensaver-theme/assets/preview.html?pack=themes/my-theme&state=work&song=long
```

| Parameter | Values |
|---|---|
| `pack` | The theme folder, from the repository root. Default: the starter. |
| `state` | `rest`, `work`, `done`, `call`, `second`. |
| `song` | `none`, `normal`, `long` (a very long title), `stream` (no length, like Music's streamed songs). |
| `tasks` | 1 to 7 cards. |

The page fades in like the screen saver. A browser pane that is not visible renders slowly and runs no resize events, so wait a few seconds and load the page again for each screen size instead of resizing it.

## The test matrix

Check every theme in every cell before you ship it:

| Check | How |
|---|---|
| All five states | `state=rest`, `work`, `done`, `call`, `second` |
| Many tasks | `tasks=7`: nothing overlaps, extra cards say "+N more" |
| Long text | `song=long`, and long task titles: cut with "…", never over another element |
| No length | `song=stream`: the song shows without progress |
| The song steps away | `state=call&song=normal`: hidden |
| Screen shapes | 1440 × 900, 1024 × 768 (4:3), 1280 × 1024 (5:4), 2560 × 1080 (ultra-wide) |
| Reduce motion | Turn it on in macOS: the picture stands still, things fade |
| Lost WebGL context | In the console: `canvas.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()` |
| Errors | The browser console stays empty |

Measure instead of trusting your eye when two things come close: `element.getBoundingClientRect()` in the console gives exact edges.

## On the real screen saver

Install the pack and use it, then run the demo, which plays made-up tasks and an approval when the screen saver next starts:

```bash
agent-screensaver ext install themes/my-theme      # or drop the folder's zip on the settings window
agent-screensaver theme set yourname.mytheme
agent-screensaver demo --seconds 60
```

The `agent-screensaver` command is not on your PATH after install: run it as `./agent-screensaver` from the unzipped agent-screensaver folder, or set the alias from this repository's README.

## Before you open a pull request

```bash
node scripts/check.mjs              # every script parses, every manifest is valid, one version per theme
scripts/pack.sh my-theme            # builds dist/my-theme.zip
```

- Give the theme a `README.md` in the style of the others: what the source is (and that it is a fan-made tribute with no artwork or logos), a still for every state, the motion, and the folders. Put the stills in `media/` as 1440-pixel-wide JPEGs under 400 KB, named `working`, `approval`, `done`, `idle` and `secondary`.
- Bump the version in every part when you change a theme that was already released. `node scripts/check.mjs --since <last tag>` refuses a changed theme with an old version, and so does the release.

## Releases

Releases come from CI: a maintainer pushes an annotated version tag whose message is the notes, and CI checks every theme, builds the zips and publishes the release. See "Release" in this repository's README.
