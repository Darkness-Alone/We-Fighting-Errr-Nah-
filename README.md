# We Fighting Errr Nah?

**Live page: <https://darkness-alone.github.io/We-Fighting-Errr-Nah-/>**

A personal OSINT tension tracker. It reads public data about what the world's militaries, governments
and newsrooms are doing right now, boils it down to one number, and shows the receipts.

No dependencies, no API keys, no accounts. Just Node.

> For fun and situational awareness. Real DEFCON levels are classified, and nothing here is one.

## What's on the page

| Panel | What it shows |
| --- | --- |
| **We Beefin Index** | A 0–100 gauge, its status, the trend, a ghost needle for 24 hours ago, and what went into the number |
| **TheseHandsCon** | An estimated readiness level, 5 (calm) to 1 (it's on), with the reasons for it |
| **The Rundown** | The whole picture in four or five sentences, with a copy button |
| **Where It's Poppin** | A world map of places named in reports of force, plus heat by region |
| **The Fight Card** | Country-vs-country matchups: how much is talk, how much is flexin', how much is hands |
| **Doomsday Watch** | The official Doomsday Clock, a live Beef Clock, a nuclear-test check, and every clock setting since 1947 |
| **Trend & Beef Log** | The index over the last 7 days and every change of status or level |
| **The Wire** | Headlines grouped into stories, each tagged with a beef type and how many outlets carry it |
| **X OSINT scroller** | Latest posts from popular OSINT accounts on X, or links to them when X will not serve the posts. Shown, never scored |
| **Birds Up** | Military aircraft in the air: doomsday planes, bombers, tankers, spy planes, airlift |
| **The Money** | Wall Street's fear gauge and the oil price |
| **Do Not Pull Up List** | Countries the US State Department says not to travel to |
| **Mother Nature's Hands** | Significant earthquakes and space weather. Shown, never scored |
| **Receipts** | A status light per source, the method, and the back-test table |

Birds Up, The Money and Do Not Pull Up List appear only when their feed answers.

### We Beefin Index

| Index | Status | Color |
| --- | --- | --- |
| 0–24 | We Cool | Green |
| 25–54 | Why They Lookin At Me | Yellow |
| 55–79 | Squared Up | Orange |
| 80–100 | Told Ya Too Watch Ya Mouth | Red |

A status tightens the moment the index crosses a line. It relaxes only once the index is 2 points
clear of the line, so the label does not flicker at a boundary.

### TheseHandsCon

| Level | Name | Posture score |
| --- | --- | --- |
| 5 | Hands In Pockets | 0–23 |
| 4 | Hands On Hips | 24–41 |
| 3 | Hands Up | 42–61 |
| 2 | Knuckles Cracked | 62–79 |
| 1 | Hands Thrown | 80–100 |

The posture score is 60% The Big Dogs and 40% the index, so a regional war moves it less than
nuclear powers squaring up. Relaxing a level needs the score 3 points clear of the line. Two hard
triggers override the score: a nuclear test picked up by seismometers forces level 2 or tighter, and
two nuclear-armed rivals trading blows forces level 3 or tighter.

## How the number is made

The index blends four ingredients. If one has no data, the others take over its share.

| Ingredient | Weight | What it measures |
| --- | --- | --- |
| **The Action** | 35% | The share of all world news events GDELT codes as one state using force on another, plus how hard the hottest matchup is going |
| **The Chatter** | 35% | The share of headlines about fighting, weighted by how bad: 60% the wider press (thousands of sites), 40% front pages of major outlets |
| **The Big Dogs** | 20% | Friction between nuclear powers and their treaty allies, plus nuclear-weapons talk that is not diplomacy |
| **The Money** | 10% | The VIX fear gauge and the 5-day move in the oil price |

Details that matter:

- **GDELT is filtered hard.** One 15-minute file is noisy, so the tool keeps 24 hours of them and
  counts only events between two different countries with state-level actors, by distinct article.
  Local crime, sports and business "battles" drop out.
- **Recent hours count more.** Each GDELT score is 60% the last 6 hours and 40% the last 24.
- **Headlines get a beef type.** Talkin' Spicy (threats), Flexin' (troops, sanctions), Swingin'
  (strikes, clashes), Full Send (invasions, missile barrages), Nuclear Option. Ceasefires and peace
  talks count for less; a ceasefire that collapses counts for more. Sports, films, court cases,
  space launches and history pieces are screened out.
- **One event counts once.** Headlines about the same thing are grouped into a story, and a story
  carried by more outlets counts for more.
- **Matchups have stakes.** US vs Russia or India vs Pakistan weighs 1.0. Russia vs a NATO member
  or China vs Taiwan weighs 0.8. Iran vs a nuclear power 0.55. One nuclear power in the fight 0.35.
  Neither 0.15. Allies bickering is left off the card.
- **The index rises fast and falls slowly.** It closes half the gap to a higher reading in 10
  minutes and half the gap to a lower one in 45.
- **The Beef Clock** starts from the official Doomsday Clock and moves with the nuclear reading
  (nuclear standoffs and nuclear talk): every 30 points hotter halves the time left.

## Calibration

Every curve and band was set by running the live pipeline over GDELT's archive of real days
(`npm run calibrate`, see `scripts/calibrate.mjs`).

| Day | What happened | Index | TheseHandsCon |
| --- | --- | --- | --- |
| 5 Jun 2019 | A quiet day | 23 | 5 |
| 15 Jun 2021 | A quiet day | 16 | 5 |
| 9 Aug 2017 | "Fire and fury": US and North Korea trade nuclear threats | 52 | 2 |
| 27 Feb 2019 | India and Pakistan dogfight over Kashmir | 43 | 3 |
| 8 Jan 2020 | Iran fires missiles at US bases in Iraq | 73 | 2 |
| 24 Feb 2022 | Russia invades Ukraine | 80 | 2 |
| 8 Oct 2023 | Hamas attack, Gaza war begins | 71 | 3 |
| 14 Apr 2024 | Iran launches missiles and drones at Israel | 84 | 2 |
| 20 Nov 2024 | Long-range strikes into Russia, Moscow lowers its nuclear threshold | 61 | 2 |
| 7 May 2025 | India and Pakistan exchange strikes | 50 | 3 |

This back-test uses the GDELT ingredients only. Front pages and markets are not archived the same
way, so their curves were set by reasoning, not history. One known soft spot: GDELT under-covers
South Asia, so the India–Pakistan days read lower than they felt.

## Sources

| Source | Used for |
| --- | --- |
| GDELT 2.0 event files, English and translated from 65 languages | The Action, the wider-press half of The Chatter, The Big Dogs, the map, the Fight Card |
| BBC (world plus six regional feeds), Al Jazeera | Front pages, The Wire |
| The Guardian, NPR, France 24, DW, Sky News, New York Times | Front pages, The Wire |
| Defense News, Breaking Defense, The War Zone, USNI News, Times of Israel, Kyiv Independent, Yonhap, UN News | The Wire and regional heat |
| USGS | Significant earthquakes, and its catalog of detected nuclear explosions |
| NOAA Space Weather Prediction Center | Planetary Kp index |
| adsb.lol | Military aircraft in the air |
| FRED (St. Louis Fed) | VIX and Brent crude, daily closes |
| US State Department | Travel advisories |
| X (public embed timeline) | Posts from the accounts in `X_ACCOUNTS`, for the scroller only |
| Bulletin of the Atomic Scientists | Official Doomsday Clock |

Things to know:

- **Tested against the live services:** GDELT, BBC, Al Jazeera, USGS and NOAA.
- **Not yet tested live:** the other news outlets, adsb.lol, FRED and the State Department. The
  machine this was built on could not reach them, so they are written to each service's documented
  format and checked with sample data in `test/`. If one fails it shows under Receipts and its
  panel hides; nothing else breaks.
- **The official Doomsday Clock is typed in by hand.** It is `DOOMSDAY_OFFICIAL` at the top of
  `collect.mjs`. The Bulletin resets it each January; update it then, and add the new year to
  `DOOMSDAY_TIMELINE` below it.
- **The X scroller is unofficial.** X has no free API, so it reads the timeline X serves for embedding.
  X throttles that hard; when it refuses, the scroller shows links to the accounts instead.
- **Birds Up needs a week.** It only judges what is unusual after 48 readings of its own baseline.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm start
```

Open <http://localhost:8787>. The server takes a reading right away, then every 10 minutes. The
first reading downloads 24 hours of GDELT files (about 12 MB); after that only the new ones.

```sh
npm run collect    # take one reading: writes public/data.json and public/state.json
npm run snapshot   # take a reading and bake it into one snapshot.html you can open or send
npm test           # run the tests
npm run calibrate -- <folder>   # back-test the scoring on downloaded GDELT files
```

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8787` | Port the server listens on |
| `REFRESH_MIN` | `10` | Minutes between readings (minimum 2) |
| `PREV_URL` | none | Address of a published copy to pick up state from, used by the Pages workflow |

## Hosting on GitHub Pages

`.github/workflows/pages.yml` takes a reading and publishes the page on every push to `main` and on
a schedule (minutes 7, 22, 37 and 52 of each hour). Pages must be set to **Settings → Pages →
Source → GitHub Actions**.

GitHub treats schedules as best effort and can delay or skip runs, especially on a quiet repo. If
the page says **Stale**, open the **Actions** tab, pick **We Beefin Index** and press **Run
workflow**. GitHub also pauses schedules after 60 days without repo activity; the same button
restarts them.

## Make it yours

| To change | Edit |
| --- | --- |
| Status names, colors, bands | `STATUSES` in `lib/score.mjs` |
| TheseHandsCon names, blurbs, thresholds | `HANDSCON` in `lib/score.mjs` |
| Ingredient weights | `WEIGHTS` in `lib/score.mjs` |
| Which words count as which beef type | the `TIER` lists in `lib/classify.mjs` |
| Regions, country names, matchup stakes | `lib/geo.mjs` |
| News outlets | `FEEDS` in `lib/sources.mjs` (any RSS or Atom feed) |
| OSINT accounts in the X scroller | `X_ACCOUNTS` in `lib/sources.mjs` |
| Ticker speed | the `16` (seconds per headline) in the `fillTicker` call in `public/index.html` |
| Colors and fonts | the `:root` block at the top of `public/index.html` |

After changing a curve or a word list, run `npm test`, and `npm run calibrate` if you have GDELT
files to check against.

## Project layout

```
collect.mjs            takes a reading: fetch, score, write data.json and state.json
server.mjs             serves public/ and re-runs the collector on a timer
lib/sources.mjs        one fetcher per feed, the feed list, the RSS/Atom parser
lib/gdelt.mjs          downloads GDELT event files and boils them down
lib/classify.mjs       reads a headline: beef type, calm or not, nuclear or not; groups stories
lib/geo.mjs            countries, regions, how much each matchup matters
lib/score.mjs          every scale and scoring rule (pure functions)
public/index.html      the whole dashboard in one file
scripts/calibrate.mjs  back-tests the scoring on archived GDELT days
scripts/snapshot.mjs   bakes a reading into a standalone HTML file
test/                  tests for the classifier, GDELT handling, scoring and feed parsers
.github/workflows/     GitHub Pages publishing, plus a check that tests and takes a dry reading on branches
```

`public/data.json`, `public/state.json` and `snapshot.html` are generated and not committed.

## Troubleshooting

- **"No reading yet"**: the page loaded before the first reading finished. Wait a few seconds and
  reload, or run `npm run collect`.
- **"Stale"**: the reading is more than 45 minutes old. Locally, check the server is running. On
  GitHub Pages, see the hosting section above.
- **Sources not reporting**: listed under Receipts with the reason. The index runs on whatever is
  left and marks the signal as Decent or Weak.
- **"No Signal"**: every feed failed. Check the internet connection.
- **Behind a proxy**: on Node 22.21 or newer, start with `NODE_USE_ENV_PROXY=1 npm start` so Node
  honors `HTTPS_PROXY`.
