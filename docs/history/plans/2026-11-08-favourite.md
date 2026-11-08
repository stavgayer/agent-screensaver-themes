# Favourite Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Favourite, the ninth community theme, drawn in code from the cover of the Fontaines D.C. single *Favourite*.

**Architecture:** Four parts under `themes/favourite/`: a theme manifest, a layout, a WebGL background that draws the sky, the heart-face, the daggers, the spikes and the drip, and one full-screen board component that draws every word (clock, date, song line, task cards, limit labels, needs-you card). The background and the board each hold an identical copy of one pure geometry function, so text lines up with the drawing without the parts touching each other.

**Tech Stack:** Classic browser scripts (no modules), WebGL 1 fragment shader, CSS, the agent-screensaver extension API 2 (`helpers.songProgress`, `helpers.recoverWebGL`). Checks: `scripts/check.mjs`, the skill's `preview.html` and `shoot.mjs`. This repository has no unit test runner; the preview matrix and `shoot.mjs` are the tests.

**Spec:** `docs/history/specs/2026-11-08-favourite-design.md` (approved 2026-11-08). Read it before any task.

## Global Constraints

- Follow `skills/create-agent-screensaver-theme/SKILL.md` and its `references/` (build, craft, design, test-and-ship). Its Critical rules table is binding.
- Ids: `stavgayer.favourite`, `stavgayer.favourite-layout`, `stavgayer.favourite-ground`, `stavgayer.favourite-board`. Name shown: `Favourite`.
- Every part: `"version": "1.4.0"`, `"requires": "0.5.0"`. `api: 2` for ground and board, `api: 1` for theme and layout.
- Palette (from the spec): sky `#034d87` → `#096faa` → `#52a4c7` → `#87c2c4` top to bottom; face `#d34d68` and `#eba6b3`; daggers silver; lime `#9bf95e`.
- Lime is reserved for the clock, the date, "needs you" and waiting daggers.
- Agent colours: `claude` `#d34d68`, `codex` `#87c2c4`, `cursor` `#eba6b3`; any other source picks from `["#d34d68", "#87c2c4", "#eba6b3", "#c9d3dc"]` by a stable hash of its name. Every dagger handle gets a 2 px `#022a4a` outline so it reads on the sky.
- Fonts: UnifrakturCook (display), Outfit (text), JetBrains Mono (command). All SIL OFL, each with its `OFL-<Font>.txt` next to it.
- No artwork, no cover image, no band wordmark anywhere in the repository. The README says it is a fan-made tribute with no artwork or logos.
- Frame rates: background default `fps` 12 (max 30), canvas at half scale (`scale` option default 0.5), `powerPreference: "low-power"`.
- Plain English, no em-dashes, in every file people read.
- Commits: conventional, staged by explicit path, as `git -c user.email=1496522+stavgayer@users.noreply.github.com -c user.name=stavgayer commit`. No AI attribution lines.
- Work on a branch `feat/favourite-theme` cut from `main`, never on `main`. Commit the spec and this plan as the branch's first commit (`docs(favourite): design and plan`).
- Never run `ScreenSaverEngine` or install into the real home folder. Install checks use `HOME=$(mktemp -d)`.

## Review Focus

1. **4:3 and 5:4 screens with 7 tasks and 6 limits.** Expected: heart shrinks, nothing overlaps, the last card says "+N more". Pinned in Task 6.
2. **Two agents waiting at once.** Expected: the longest-waiting one on the big card, "+1 more waiting", both daggers lime. Pinned in Task 5.
3. **Privacy mode and missing fields in `call`.** Expected: "Look at the terminal", no "undefined", "NaN" or empty rows. Pinned in Task 6.
4. **A task that runs for hours.** Expected: its dagger stops at full depth after 60 minutes and never goes further. Pinned in Task 3.
5. **Sleep and wake (lost WebGL context).** Expected: one fresh canvas, same state drawn again. Pinned in Task 2.

---

### Task 1: Scaffold the pack

**Files:**
- Create: `themes/favourite/stavgayer.favourite/extension.json`
- Create: `themes/favourite/stavgayer.favourite-layout/extension.json`
- Create: `themes/favourite/stavgayer.favourite-ground/extension.json`, `index.js`
- Create: `themes/favourite/stavgayer.favourite-board/extension.json`, `index.js`, `fonts/`

**Interfaces:**
- Produces: the four folders and ids above, which Tasks 2 to 7 fill in.

- [ ] **Step 1:** Copy `skills/create-agent-screensaver-theme/assets/starter/` parts into `themes/favourite/`, renaming each `acme.sample*` folder and id to the ids in Global Constraints. Do not copy the starter `README.md` yet (Task 7).
- [ ] **Step 2:** Theme manifest `style`: `--accent: #9bf95e`, `--attention: #9bf95e`, `--done: #eba6b3`, `--warn: #eba6b3`.
- [ ] **Step 3:** Layout: all three modes put only `stavgayer.favourite-board` in `center` (no `builtin.limit-rings`); `secondary` passes `"options": { "show": "time" }`.
- [ ] **Step 4:** Ground manifest options: `fps` (number, default 12, min 1, max 30), `scale` (number, default 0.5, min 0.25, max 1), `drift` (number, minutes for one drift, default 4, min 1, max 30). Ground is `api: 2`.
- [ ] **Step 5:** Fonts into `stavgayer.favourite-board/fonts/`: copy `Outfit.ttf` and `OFL-Outfit.txt` from `themes/currents/stavgayer.currents-board/fonts/`, `JetBrainsMono.woff2` and `OFL-JetBrainsMono.txt` from the same folder. Download `UnifrakturCook-Bold.ttf` and its `OFL.txt` (renamed `OFL-UnifrakturCook.txt`) from `https://github.com/google/fonts/tree/main/ofl/unifrakturcook`. Check the licence file says SIL Open Font License 1.1.
- [ ] **Step 6:** Run `node scripts/check.mjs`. Expected: `ok: 9 themes`.
- [ ] **Step 7:** Commit: `feat(favourite): scaffold the Favourite theme pack`.

### Task 2: The geometry function and the sky, heart and eyes

**Files:**
- Modify: `themes/favourite/stavgayer.favourite-ground/index.js`
- Modify: `themes/favourite/stavgayer.favourite-board/index.js` (only the geometry function copy)

**Interfaces:**
- Produces, copied byte-for-byte into both files between the comments `// geometry: keep identical in ground and board` and `// end geometry`:
  `function favouriteFrame(width, height, limitCount, cardCount)` returning
  `{ heart: { cx, cy, size }, clockTop, clockHeight, spikesTop, labelsTop, labelRows, cardsRow, sideColumns: { left: {x, w}, right: {x, w} } }`, all in CSS pixels.
  Rules: `labelRows` is 1, or 2 when `limitCount` labels at 150 px each do not fit `heart.size`; `cardsRow` is true when `width / height < 1.45` and `cardCount > 0`; vertical order clock, heart, spikes, labels, card row; `heart.size` is the largest value (at most `0.62 * min(width, height)`) that fits everything vertically; the heart is centred horizontally; side columns fill the space beside the heart minus a gutter of `0.03 * width`, and are `null` when `cardsRow` is true.
- Produces, ground: `start(root, ctx)`, `update(state)`, `stop()`, returned through `window.agentScreensaver.helpers.recoverWebGL(api, () => canvas)`.

- [ ] **Step 1:** Write `favouriteFrame` in the ground file per the rules above.
- [ ] **Step 2:** Run this check (it must print `same` and pass the asserts):
  ```bash
  node -e '
  const fs=require("fs"),get=f=>fs.readFileSync(f,"utf8").split("// geometry: keep identical in ground and board")[1].split("// end geometry")[0];
  const a=get("themes/favourite/stavgayer.favourite-ground/index.js"),b=get("themes/favourite/stavgayer.favourite-board/index.js");
  console.log(a===b?"same":"DIFFERENT"); const f=new Function(a+";return favouriteFrame")();
  const w=f(1440,900,4,3),n=f(1024,768,6,7);
  console.assert(w.cardsRow===false&&w.sideColumns.left.w>0,"wide uses side columns");
  console.assert(n.cardsRow===true&&n.sideColumns===null,"4:3 uses a card row");
  console.assert(n.heart.size<w.heart.size&&n.heart.size>0,"heart shrinks on 4:3");'
  ```
  It fails until Step 3 copies the function into the board.
- [ ] **Step 3:** Copy the function into the board file. Run Step 2 again. Expected: `same`, no assertion output.
- [ ] **Step 4:** In the ground, draw with one WebGL 1 fragment shader on a canvas at `scale` of the screen: the sky as a vertical gradient through the four sky colours; the heart-face as a heart SDF centred at `heart.cx, heart.cy` with size `heart.size`, airbrushed between `#d34d68` and `#eba6b3`, with a soft specular highlight that slides across it every 20 to 40 s; shut eyes as two curved lids; a uniform `uEyes` (0 shut, 1 open) that draws open eyes looking straight out; a slow breath (scale ±1.5%, period 8 s); a drift of a few pixels over `drift` minutes. Draw with `ctx.requestFrame(() => draw(ctx.now()), fps)`.
- [ ] **Step 5:** Mood from state with the skill's `moodOf`. `call` sets `uEyes` target 1 (0.25 s ease) and the sky's top colour toward `#021f3a`; every other mood sets 0 and the resting sky. Second display: heart and sky only, eyes shut.
- [ ] **Step 6:** Reduce motion (`matchMedia("(prefers-reduced-motion: reduce)")`): no breath, no drift, no slide; draw only when the state changes; eyes cross-fade.
- [ ] **Step 7:** Set up the preview (`skills/create-agent-screensaver-theme/references/test-and-ship.md`, "The preview page") and run, from `skills/create-agent-screensaver-theme/assets`, with `P="http://localhost:8000/skills/create-agent-screensaver-theme/assets/preview.html?pack=themes/favourite"`:
  `node shoot.mjs "$P&state=rest" --out /tmp/fav-rest.jpg`, `node shoot.mjs "$P&state=call" --lose-context`, `node shoot.mjs "$P&state=rest" --reduce`.
  Expected: exit 0, fps at or under 12, one fresh canvas after the loss, 0 fps with `--reduce`. Look at the still: heart low and centred, eyes shut.
- [ ] **Step 8:** Commit: `feat(favourite): draw the sky, the heart and its eyes`.

### Task 3: Daggers

**Files:**
- Modify: `themes/favourite/stavgayer.favourite-ground/index.js`

**Interfaces:**
- Consumes: `favouriteFrame`, the mood from Task 2.
- Produces: daggers drawn from `state.cards`, in card order, at most 7.

- [ ] **Step 1:** Positions along the heart's top edge: 1 task at the centre, 2 at the cover's left and right spots, 3 at left, centre and right; 4 to 7 spread evenly between the outer spots. Pass up to 7 daggers as uniform arrays (x, depth, colour, glint, lime, dim).
- [ ] **Step 2:** Depth: `depth = 1 - (1 - min(1, runMs / 3_600_000))^2`, where `runMs = state.nowMs - card.started_at_ms`; full depth is a third of the blade length. A finished card keeps the depth it had.
- [ ] **Step 3:** Silver blade, handle in the agent colour (Global Constraints) with the navy outline. A new dagger stabs in with one 0.4 s move. A card that turns `finished` plays one glint (0.6 s), then stands still. In `call`, every card with `kind === "approval"` gets a lime handle; the others dim to 40%.
- [ ] **Step 4:** When a card leaves the state, its dagger slides out and falls (0.8 s). Reduce motion: daggers fade in and out instead.
- [ ] **Step 5:** Run `node shoot.mjs "$P&state=work&tasks=7" --out /tmp/fav-work7.jpg` and `node shoot.mjs "$P&state=done" --out /tmp/fav-done.jpg`. Expected: exit 0; seven daggers, none overlapping; done daggers still. To pin Review Focus 4, add a temporary console check in the preview: a card with `started_at_ms` 5 hours ago draws the same depth as one 1 hour ago.
- [ ] **Step 6:** Commit: `feat(favourite): one dagger per task`.

### Task 4: Spikes and the drip

**Files:**
- Modify: `themes/favourite/stavgayer.favourite-ground/index.js`

**Interfaces:**
- Consumes: `favouriteFrame` (`spikesTop`), `state.limits` in `state.agentOrder` order, `helpers.songProgress(state.nowPlaying, ctx.now())`.

- [ ] **Step 1:** One spike per limit, evenly spaced under the heart, in its agent's colour. Length = full × (0.15 + 0.85 × used_percent / 100). No limits: no spikes.
- [ ] **Step 2:** The drip hangs from the lip. Length = progress × its full length; when `songProgress` is `null`, half length and still; no `nowPlaying` or second display or `call`: no drip. When progress passes 0.99 the drip falls once (0.6 s).
- [ ] **Step 3:** Run `node shoot.mjs "$P&state=work&song=normal"` and `node shoot.mjs "$P&state=work&song=stream" --reduce`. Expected: exit 0; the stream run reports 0 fps.
- [ ] **Step 4:** Commit: `feat(favourite): spikes for the limits and the drip for the song`.

### Task 5: The board

**Files:**
- Modify: `themes/favourite/stavgayer.favourite-board/index.js`

**Interfaces:**
- Consumes: `favouriteFrame`, the same `moodOf`, option `show` (`agents` or `time`).
- Produces: every word on screen, all with `textContent`, placed from `favouriteFrame` and redrawn on `resize`.

- [ ] **Step 1:** Clock: the time (`HH:MM`) in UnifrakturCook, lime, at `clockTop` with height `clockHeight`; the date under it, small, lime. Check the digits read at 1440 × 900 from a still; if any digit is unclear, set the digits in Outfit 800 and keep the date in UnifrakturCook. Song line under the date (Outfit, `#eba6b3` on no plate, cut with "…"), hidden in `call`, on the second display and when there is no `nowPlaying`.
- [ ] **Step 2:** Limit labels at `labelsTop`, one per spike, in `labelRows` rows, each on a `#022a4a` plate at 85% opacity: agent name, window, percent, reset time, plus the skill's craft rules for old and estimated readings (`references/craft.md`, "The usage limits").
- [ ] **Step 3:** Cards: in `sideColumns` (left first, then right) or in the card row when `cardsRow` is true. Each a navy plate (`#022a4a`) with a 3 px left edge in the agent colour: agent mark and name, state word, time running, title, project, then model, branch and context when known. As many as fit; the last one shown says "+N more" when some do not fit. Done cards say done.
- [ ] **Step 4:** Needs you (`call`): cards and labels fade to 15%. One large card over the lower half of the heart: "needs you" in UnifrakturCook lime, then the agent, how long it has waited (from `approval_since_ms`, left out when missing), the project, and `request` in JetBrains Mono (one line, smaller to fit, up to four lines at spaces). No `request`: "Look at the terminal". The card shows the approval with the oldest `approval_since_ms`; with more than one, a line "+N more waiting".
- [ ] **Step 5:** `show: "time"` (second display): only the clock and the date.
- [ ] **Step 6:** Run `node shoot.mjs "$P&state=call&song=normal" --out /tmp/fav-call.jpg` and the same with `tasks=3` after editing the preview's fake state in the console to give two cards `kind: "approval"`. Expected: the older one on the card, "+1 more waiting", two lime daggers.
- [ ] **Step 7:** Commit: `feat(favourite): clock, cards, limit labels and the needs-you card`.

### Task 6: The test matrix

**Files:**
- Modify: any Favourite file the matrix shows is wrong.

- [ ] **Step 1:** Run every cell of the matrix in `references/test-and-ship.md` ("The test matrix") with `shoot.mjs`, at 1440 × 900, 1024 × 768, 1280 × 1024 and 2560 × 1080, saving stills to `/tmp/fav-matrix/`. Required cells include `tasks=7&title=long&song=long` at 1024x768 and 1280x1024, `privacy=1` and `missing=1` in `work` and `call`, `agent=unknown`.
- [ ] **Step 2:** For each still, check with `getBoundingClientRect` in the preview console that no two text boxes overlap and nothing leaves the screen. Fix and re-run until every cell passes and every run exits 0.
- [ ] **Step 3:** Put a still of `state=rest` next to the facts in the spec. If it would not be recognised as the cover in one second, go back to Task 2.
- [ ] **Step 4:** Commit any fixes: `fix(favourite): <what the matrix found>`.

### Task 7: Ship

**Files:**
- Create: `themes/favourite/README.md`, `themes/favourite/media/{working,approval,done,idle,secondary}.jpg`, `themes/favourite/media/demo.gif`
- Modify: `README.md` (root: demo grid and stills table), `CHANGELOG.md`

- [ ] **Step 1:** Stills and demo with the commands in `references/test-and-ship.md`, "The stills for the README". Each still under 400 KB.
- [ ] **Step 2:** `themes/favourite/README.md` from the starter's README headings: the source (the cover of the Fontaines D.C. single *Favourite*, art by Lulu Lin), that it is a fan-made tribute with no artwork or logos, the demo gif under the first paragraph, a still per state, motion, the folders, the fonts and their licences. Describe only what is built.
- [ ] **Step 3:** Root `README.md`: add Favourite to the demo grid and a row to the stills table, like Piñata.
- [ ] **Step 4:** `CHANGELOG.md`: a `## v1.4.0 (<date>)` section, "New theme: Favourite", in the style of the v1.2.0 Piñata section.
- [ ] **Step 5:** Run `node scripts/check.mjs --since v1.3.0`, `scripts/pack.sh favourite`, then `H=$(mktemp -d); HOME=$H agent-screensaver ext install dist/favourite.zip && HOME=$H agent-screensaver theme set stavgayer.favourite && HOME=$H agent-screensaver ext list`. Expected: all pass; the list shows the four Favourite parts at 1.4.0.
- [ ] **Step 6:** Commit: `docs(favourite): README, stills, demo and changelog`. Do not tag or push; the release is the owner's call.
