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

Copy only the `builtin.*` extensions: they are the shared parts a layout can use. Never copy the whole extensions folder: it holds every theme installed on this Mac, including private ones. Any free port works instead of 8000. Then open:

```
http://localhost:8000/skills/create-agent-screensaver-theme/assets/preview.html?pack=themes/my-theme&state=work&song=long
```

| Parameter | Values |
|---|---|
| `pack` | The theme folder, from the repository root. Default: the starter. |
| `state` | `rest`, `work`, `done`, `call`, `second`. |
| `song` | `none`, `normal`, `long` (a very long title), `stream` (no length, like Music's streamed songs). |
| `tasks` | 1 to 7 cards. |
| `title` | `long`: the first task gets a very long title, project, branch and command. |
| `privacy` | `1`: what privacy mode does: no title, command, conversation name or branch on any card, and no song. |
| `missing` | `1`: leaves out the fields the service may leave out: `project` and `approval_since_ms`. (`started_at_ms` and `updated_at_ms` are always sent.) |
| `agent` | `unknown`: one more task from `gemini`, an agent with no extension, so it has no entry in `agents`. |
| `jobs` | `N`: the first finished card (in `state=done`, the first card) gets `background: N`, as if the session still runs N background jobs. It has an effect only when a card is finished (for example with `state=done`). |

The page fades in like the screen saver. A browser pane that is not visible may run no animation frames at all and no resize events: it shows the layout, but frame rates, "Reduce motion" and stills cannot be checked there. Use the headless check below for those, and load the page again for each screen size instead of resizing it.

## The test matrix

Check every theme in every cell before you ship it:

| Check | How |
|---|---|
| All five states | `state=rest`, `work`, `done`, `call`, `second` |
| Many tasks | `tasks=7`: nothing overlaps, extra cards say "+N more" |
| Long text | `title=long&song=long`, in `work` and `call`: cut with "…", never over another element |
| Privacy mode | `privacy=1`, in `work` and `call`: no empty rows or made-up text; the approval says "Look at the terminal" |
| Missing fields | `missing=1`: no "NaN", no "undefined", no empty line |
| Background jobs | `state=done&jobs=3`: the card says "3 jobs running" and the theme stays in its working look; `jobs=1` says "1 job running" |
| Unknown agent | `agent=unknown`: the task shows with a colour from your palette and a name |
| No length | `song=stream`: the song shows without progress |
| The song steps away | `state=call&song=normal`: hidden |
| Screen shapes | 1440 × 900, 1024 × 768 (4:3), 1280 × 1024 (5:4), 2560 × 1080 (ultra-wide) |
| Frame rate | `node assets/shoot.mjs <URL>`: the frames a second match your `fps` option, and stay low |
| Reduce motion | `node assets/shoot.mjs <URL> --reduce`: 0 frames a second while nothing changes, and things fade |
| Lost WebGL context | `node assets/shoot.mjs <URL> --lose-context`, or in the console: `var canvas = document.querySelector("#background canvas"); (canvas.getContext("webgl2") \|\| canvas.getContext("webgl")).getExtension("WEBGL_lose_context").loseContext()` |
| Errors | `shoot.mjs` reports no console errors (exit code 0) |

Measure instead of trusting your eye when two things come close: `element.getBoundingClientRect()` in the console gives exact edges.

## The headless check

[`assets/shoot.mjs`](../assets/shoot.mjs) loads a preview URL in headless Chrome over the DevTools protocol, waits for the fade and the fonts, counts how many frames a second the canvases draw, and reports console errors. It can emulate "Reduce motion", force a lost WebGL context, and save a JPEG still that is 1440 pixels wide at any screen size. It needs Node 22 or later and Google Chrome, and no packages (set `CHROME` to the browser's path if it is not in `/Applications`). Run the preview server first.

```bash
cd skills/create-agent-screensaver-theme/assets
P="http://localhost:8000/skills/create-agent-screensaver-theme/assets/preview.html?pack=themes/my-theme"
node shoot.mjs "$P&state=work&song=normal"                    # frames a second, console errors
node shoot.mjs "$P&state=work" --reduce                        # should report 0 frames a second
node shoot.mjs "$P&state=call" --lose-context                  # one fresh canvas, drawing again
node shoot.mjs "$P&state=work&tasks=7&title=long" --size 1024x768 --out /tmp/narrow.jpg
```

It prints a JSON report and exits with 1 when the console logged an error. A `--reduce` run still counts frames for a song bar or anything else that changes; the picture itself should stand still.

### The stills for the README

Save one still per state, at 1440 × 900, straight into the theme's `media` folder:

```bash
M=../../../themes/my-theme/media
node shoot.mjs "$P&state=work&song=normal" --out $M/working.jpg
node shoot.mjs "$P&state=call&song=normal" --out $M/approval.jpg
node shoot.mjs "$P&state=done&song=normal" --out $M/done.jpg
node shoot.mjs "$P&state=rest&song=normal" --out $M/idle.jpg
node shoot.mjs "$P&state=second" --out $M/secondary.jpg
```

Each comes out 1440 pixels wide at JPEG quality 82; check that each is under 400 KB (the report gives `bytes`). Then record the looping `media/demo.gif` that the themes grid shows:

```bash
node shoot.mjs "$P&state=work&song=normal" --gif $M/demo.gif
```

It records 9 seconds at 12 frames a second, 800 pixels wide (1440 × 936 on screen, like the other demos): working, then after 2 seconds the first task asks for approval, then after 6 seconds it goes back. So the demo shows the theme's biggest move, the switch to "needs you". It needs `ffmpeg` (`brew install ffmpeg`). The other demos here are 0.05 to 4 MB.

## On the real screen saver

Install the pack and use it, then run the demo, which plays made-up tasks and an approval when the screen saver next starts:

```bash
agent-screensaver ext install themes/my-theme      # or drop the folder's zip on the settings window
agent-screensaver theme set yourname.mytheme
agent-screensaver demo --seconds 60
```

From agent-screensaver 0.5.1, install puts the `agent-screensaver` command on your PATH (open a new Terminal window first). On an older version, run it as `./agent-screensaver` from the unzipped agent-screensaver folder, or set the alias from this repository's README.

These commands change the user's real screen saver. To check only that the pack installs, without touching anything real (an agent should do this, not the commands above), give the command a throwaway home folder. It then reads and writes only under that folder:

```bash
H=$(mktemp -d)
HOME=$H agent-screensaver ext install themes/my-theme     # the folder
scripts/pack.sh my-theme && HOME=$H agent-screensaver ext install dist/my-theme.zip
HOME=$H agent-screensaver theme set yourname.mytheme
HOME=$H agent-screensaver ext list
```

A theme pack installs without a question. `ext install` also takes `--yes`, but it only skips the question an upgrade of an agent extension asks; a theme does not need it.

## Before you open a pull request

```bash
node scripts/check.mjs              # every script parses, every manifest is valid, one version per theme
scripts/pack.sh my-theme            # builds dist/my-theme.zip
```

- Give the theme a `README.md`: start from the starter's [README.md](../assets/starter/README.md), which has the headings the others use. Say what the source is (and that it is a fan-made tribute with no artwork or logos), show a still for every state, describe the motion, and list the folders and the fonts' licences. Put the stills in `media/` as 1440-pixel-wide JPEGs under 400 KB, named `working`, `approval`, `done`, `idle` and `secondary` ([how](#the-stills-for-the-readme)).
- Add a row for the theme to the table of stills in this repository's root `README.md` (name, `media/working.jpg`, folder). Add the `demo.gif` to the grid of demos above it too, and show it at the top of the theme's own README, under the first paragraph, like the other themes.
- Bump the version in every part when you change a theme that was already released. `node scripts/check.mjs --since <last tag>` refuses a changed theme with an old version, and so does the release.

## Releases

Releases come from CI: a maintainer pushes an annotated version tag whose message is the notes, and CI checks every theme, builds the zips and publishes the release. See "Release" in this repository's README.
