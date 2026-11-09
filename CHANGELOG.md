# Changelog

The release notes of agent-screensaver-themes, newest first. This file is where they are written: the message of each release tag is made from the section of its version, and CI refuses to release a version that has no section here. See the README for how to release.

## v1.4.0 (2026-11-08)

## New theme: Favourite

A tribute to the cover of the Fontaines D.C. single Favourite, art by Lulu Lin. A glossy pink heart hangs low in a blue sky and flows slowly like liquid. Each task is a polished steel dagger in its top edge, each usage limit is a steel spike under it, and the song is a drip of the heart's own liquid from its point. The time and the date sit at the top in lime blackletter. When an agent needs you, the heart's light turns lime, the sky goes deep blue and one large card says `needs you`.

Download `favourite.zip`, drop it on the agent-screensaver settings window, and pick Favourite under Theme & background. It needs agent-screensaver 0.5.0 or later.

It is drawn in code. No artwork or logos are included. The fonts are UnifrakturCook, Outfit and JetBrains Mono, all SIL Open Font License 1.1.

The other eight themes are unchanged.

## v1.3.0 (2026-11-02)

## Every theme now needs agent-screensaver 0.5.0

All eight themes use the shared helpers that agent-screensaver 0.5.0 added, instead of carrying their own copies: the song progress, and starting a WebGL background again after sleep. That removes about 320 lines of copied code. Nothing changes on screen.

Update agent-screensaver to 0.5.0 or later before you install these zips. Older versions refuse them with "unsupported api 2" and install nothing, so a theme you already have keeps working.

New versions: Currents 1.4.0, Prism 1.2.0, In Colour 1.2.0, Kid A 1.3.0, Pablo 2.3.0, Piñata 1.1.0, Key of Life 1.2.0, Unknown Pleasures 1.3.0.

## Also

- The create-agent-screensaver-theme skill (1.4.0): the starter uses the helpers too.

## v1.2.1 (2026-11-02)

## Lighter backgrounds for Prism and Key of Life

Prism and Key of Life (both now 1.1.2) no longer ask the graphics card to keep every frame after it is shown. They draw the whole picture each time, so keeping it only cost GPU work all night. Nothing changes on screen.

Install the new `dark-side-of-the-moon.zip` or `songs-in-the-key-of-life.zip` over the old one to update. The other six themes are unchanged.

## v1.2.0 (2026-11-02)

## New theme: Piñata

A tribute to Piñata by Freddie Gibbs and Madlib. Zebra fur drawn in code frames the whole screen, the window in the middle holds soft park light, and every task gets a small gold and black plate like the cover's name plate. When an agent needs you, the fur takes its colour and one big NEEDS YOU plate drops in.

Download `pinata.zip`, drop it on the agent-screensaver settings window, and pick Piñata under Theme & background. The song needs agent-screensaver 0.4.0 or later.

## Also new

The `create-agent-screensaver-theme` skill in `skills/` holds the method behind these themes, with a starter theme and a preview page, so a coding agent can help you make your own. Piñata was its first test.

The other seven themes are unchanged.

## v1.1.1 (2026-11-02)

## Backgrounds recover after sleep

After the Mac wakes from sleep, or after a graphics reset, a WebGL background could stay black or frozen. The five themes with a WebGL background now start their background again by themselves, with what the screen showed before.

| Theme | Zip | Version |
| --- | --- | --- |
| [Currents](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/currents) | `currents.zip` | 1.3.1 |
| [Kid A](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/kid-a) | `kid-a.zip` | 1.2.1 |
| [Unknown Pleasures](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/unknown-pleasures) | `unknown-pleasures.zip` | 1.2.1 |
| [Prism](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/dark-side-of-the-moon) | `dark-side-of-the-moon.zip` | 1.1.1 |
| [Key of Life](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/songs-in-the-key-of-life) | `songs-in-the-key-of-life.zip` | 1.1.1 |
| [Pablo](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/pablo) | `pablo.zip` | 2.2.0, unchanged |
| [In Colour](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/in-colour) | `in-colour.zip` | 1.1.0, unchanged |

## Also

- The README now leads with installing from the settings window, and explains how to run `agent-screensaver` in Terminal, since install does not put it on your PATH.
- The license is plain MIT again, so GitHub shows it. A new `NOTICE` file lists the 13 bundled font families and their licence, the SIL Open Font License.

## Install or update

Drop the zip on the settings window (agent-screensaver 0.3.2 or later), or click Install… under Extensions. Installing a newer zip over an older one updates the theme.

## v1.1.0 (2026-10-31)

## Every theme shows what's playing

With "Show what's playing" on in [agent-screensaver 0.4.0](https://github.com/stavgayer/agent-screensaver/releases/tag/v0.4.0) or later, each theme shows the song that Spotify or Music plays, drawn in its own style:

| Theme | Zip | Version | The song |
| --- | --- | --- | --- |
| [Pablo](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/pablo) | `pablo.zip` | 2.2.0 | One more printed card, under the small photo |
| [In Colour](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/in-colour) | `in-colour.zip` | 1.1.0 | One more white bar cut at 45 degrees |
| [Currents](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/currents) | `currents.zip` | 1.3.0 | A dark plate under the limits |
| [Kid A](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/kid-a) | `kid-a.zip` | 1.2.0 | A near-black plate under the limits |
| [Unknown Pleasures](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/unknown-pleasures) | `unknown-pleasures.zip` | 1.2.0 | Set like one more limit ring |
| [Prism](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/dark-side-of-the-moon) | `dark-side-of-the-moon.zip` | 1.1.0 | Set like one more limit ring |
| [Key of Life](https://github.com/stavgayer/agent-screensaver-themes/tree/main/themes/songs-in-the-key-of-life) | `songs-in-the-key-of-life.zip` | 1.1.0 | A cream label with a ring that fills |

In every theme the song steps away while an agent waits for you, and a long name is cut with "…". A song that Music streams shows no progress, because Music gives no length for it. Each theme's page says where the song stands.

On agent-screensaver 0.3.x the themes work as before, without the song.

## Install or update

Drop the zip on the settings window (agent-screensaver 0.3.2 or later), or click Install… under Extensions, or run:

```
agent-screensaver ext install pablo.zip
agent-screensaver theme set stavgayer.pablo
```

Installing a newer zip over an older one updates the theme.

## v1.0.0 (2026-10-29)

## The first seven themes

Seven fan-made tribute themes for agent-screensaver, each drawn in code from one album cover. None of them includes the album artwork or logos.

| Theme | Inspired by |
|---|---|
| Pablo | a stacked-title cover: a flat orange field, two photographs, one statement repeated in huge black rows |
| In Colour | hard-edged colour wedges fanned out from one point, with one white bar cut at 45 degrees |
| Currents | turbulent flow: thin lilac lines on a dark liquid surface, with a chrome ball and a red thread |
| Kid A | painted and scraped canvases of putty, soot and red stain |
| Unknown Pleasures | the 1970 plot of 80 radio pulses from the pulsar CP 1919 |
| Prism | the 1973 sleeve: a white beam that enters a glass prism and leaves as six colours |
| Key of Life | the 1976 double album sleeve on Motown's Tamla label |

Each theme shows what your agents are doing: their tasks, an approval when one waits for you, and the usage limits. Each one also designs the time when nothing runs, and a second display.

## Install

Download a theme's zip below and drop it on the agent-screensaver settings window, or run `agent-screensaver ext install <zip>`. The themes need agent-screensaver 0.3.0 or later. Each theme's page in this repository lists its zip, its stills and its credits.

> These notes were rewritten on 2026-11-02: the first published notes were the app's v0.3.0 notes by mistake.
