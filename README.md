# We Fighting? Errr… Nah

A personal OSINT tension tracker. It reads public news feeds, scores how much smoke is in the
air, and shows it on one page: a gauge, a readiness level, a doomsday clock and the headlines
behind the number.

No dependencies, no API keys, no accounts. Just Node.

> For fun and situational awareness. Real DEFCON levels are classified, and nothing here is one.

## What's on the page

| Panel | What it shows |
| --- | --- |
| **We Beefin Index** | A 0–100 gauge with a needle and a status |
| **TheseHandsCon** | An estimated readiness level, 5 (calm) to 1 (it's on) |
| **Doomsday Watch** | The official Doomsday Clock, a live Beef Clock, and a 7-day trend line |
| **Who Beefin** | Heat by region: Iran & the Gulf, Russia & Ukraine, China & Taiwan and more |
| **The Wire** | The headlines driving the number, each with a smoke level 1–5, plus a scrolling ticker |
| **Mother Nature's Hands** | Significant earthquakes and space weather. Shown, never scored |
| **Sources & Method** | A status light per feed and a plain-English method note |

### We Beefin Index

| Index | Status | Color |
| --- | --- | --- |
| 0–29 | We Cool | Green |
| 30–59 | Why They Lookin At Me | Yellow |
| 60–84 | Squared Up | Orange |
| 85–100 | Told Ya Too Watch Ya Mouth | Red |

### TheseHandsCon

| Level | Name | Index |
| --- | --- | --- |
| 5 | Hands In Pockets | 0–19 |
| 4 | Hands On Hips | 20–39 |
| 3 | Hands Up | 40–59 |
| 2 | Knuckles Cracked | 60–79 |
| 1 | Hands Thrown | 80–100 |

The level tightens one extra step when nuclear chatter passes 25 (about three nuclear headlines).

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm start
```

Open <http://localhost:8787>. The server takes a reading right away, then again every 10 minutes.
The page checks for a new reading every minute.

Other commands:

```sh
npm run collect    # take one reading and write public/data.json
npm run snapshot   # take a reading and bake it into a single snapshot.html you can open or send
npm test           # run the scoring tests
```

Settings, as environment variables:

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8787` | Port the server listens on |
| `REFRESH_MIN` | `10` | Minutes between readings (minimum 2) |

Example: `PORT=3000 REFRESH_MIN=5 npm start`

## Host it free on GitHub Pages

`.github/workflows/pages.yml` takes a reading every 15 minutes and publishes the page, so you can
check it from your phone without leaving a computer on.

1. Merge this code into `main`.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Open the **Actions** tab and run **We Beefin Index** once, or wait for the next 15-minute run.

Each run pulls the trend history from the copy that is already live, so the 7-day line survives
between runs. GitHub can delay scheduled runs when it is busy, so readings may land a few minutes late.

## Sources

| Feed | Used for |
| --- | --- |
| BBC World RSS | Headlines for the index |
| Al Jazeera RSS | Headlines for the index |
| GDELT | Extra conflict headlines for the index |
| USGS | Significant earthquakes, past 7 days |
| NOAA Space Weather Prediction Center | Planetary Kp index |
| Bulletin of the Atomic Scientists | Official Doomsday Clock |

Two things to know:

- **GDELT drops out often.** It allows one request every 5 seconds and regularly times out. The last
  good pull is reused for up to 3 hours. When GDELT is missing, the index reads lower.
- **The official Doomsday Clock is typed in by hand.** It is the `DOOMSDAY_OFFICIAL` constant at the
  top of `collect.mjs`. The Bulletin resets it each January; update it then.

## How the number is made

All scoring lives in `lib/score.mjs`.

1. Every headline from the last 48 hours is checked against keyword lists and given a smoke level:

   | Level | Examples |
   | --- | --- |
   | 5 | nuclear strike, nuclear test, nukes |
   | 4 | invasion, declares war, ballistic missile, martial law |
   | 3 | airstrike, missiles, shelling, drone attack, blockade, troops |
   | 2 | military, sanctions, coup, clash, militia, war |
   | 1 | tensions, threat, warns, standoff, escalation |

2. Newer headlines count more: full weight under 6 hours, 60% under 24 hours, 30% under 48 hours.
3. Headlines about ceasefires, truces and peace deals count half.
4. The levels are added up into a heat total and curved onto 0–100, so each extra headline moves
   the needle a little less than the one before.

The **Beef Clock** converts the index into time before midnight: 12 minutes out at 0, midnight at 100.

**Who Beefin** sorts those same headlines by region and scales the hottest region to 100. With few
headlines in play, one or two stories can put a region on top.

## Make it yours

Everything you are likely to change is a table near the top of a file.

| To change | Edit |
| --- | --- |
| Status names, colors, index bands | `STATUSES` in `lib/score.mjs` |
| TheseHandsCon names, blurbs, thresholds | `HANDSCON` in `lib/score.mjs` |
| Regions and the words that map to them | `THEATERS` in `lib/score.mjs` |
| Which words count as smoke, and how much | `H_TIERS` and `H_CALM` in `lib/score.mjs` |
| How much news it takes to move the needle | `NEWS_SCALE` in `lib/score.mjs` (lower = jumpier) |
| News feeds | `RSS_FEEDS` in `lib/sources.mjs` |
| Ticker speed | the `16` (seconds per headline) in the `fillTicker` call in `public/index.html` |
| Colors and fonts | the `:root` block at the top of `public/index.html` |

Adding a news feed is one line in `RSS_FEEDS`: an id, a display name and an RSS URL. More feeds make
the index steadier. If you add several, raise `NEWS_SCALE` so the reading does not drift upward.

## Project layout

```
collect.mjs            takes a reading: fetch feeds, score, write public/data.json
server.mjs             serves public/ and re-runs the collector on a timer
lib/sources.mjs        one fetcher per feed, plus the RSS parser
lib/score.mjs          all scoring rules and scales (pure functions)
public/index.html      the whole dashboard: markup, styles and script in one file
scripts/snapshot.mjs   bakes a reading into a standalone HTML file
test/score.test.mjs    tests for the scoring rules and RSS parser
.github/workflows/     GitHub Pages publishing, every 15 minutes
```

`public/data.json` and `snapshot.html` are generated and are not committed.

## Troubleshooting

- **"No reading yet"** — the page loaded before the first reading finished. Wait a few seconds and
  reload, or run `npm run collect`.
- **A source shows a red light** — that feed failed on the last reading. The index keeps running on
  whatever is left. Hover the name for the error.
- **"No Signal"** — every news feed failed. Check your internet connection.
- **Behind a corporate proxy** — on Node 22.21 or newer, start with `NODE_USE_ENV_PROXY=1 npm start`
  so Node honors `HTTPS_PROXY`.
