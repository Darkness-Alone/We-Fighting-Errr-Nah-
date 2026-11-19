# We Fighting Errr Nah?

**Live page: <https://darkness-alone.github.io/We-Fighting-Errr-Nah-/>**

A personal OSINT tension tracker. It reads public data about what the world's militaries, governments
and newsrooms are doing right now, boils it down to one number, and shows the receipts.

No dependencies, no API keys, no accounts. Just Node.

> For fun and situational awareness. Real DEFCON levels are classified, and nothing here is one.

## What's on the page

The site is four pages plus a deep dive, with the same nav bar on each: **THE FRONT PAGE / THE WIRE / THE CARD / THE VAULT**. Old one-page bookmarks still work: a link like `…/#skypanel` or `…/#receipts` forwards to the page the section moved to.

**The Front Page** (`index.html`, same address as before): the daily check-in.

| Panel | What it shows |
| --- | --- |
| **Search the Intel** | Type a word or words to get every report that mentions them: the last 48 hours from all the news feeds, defense press, OSINT channels, Reddit and conflict headlines from thousands of sites, newest first and filterable by kind. Press Search to add live worldwide results from GDELT's news search (last 3 days) |
| **We Beefin Index** | A 0–100 gauge, its status, the trend, a ghost needle for 24 hours ago, and what went into the number |
| **The Streak** | Under the gauge: how many days in a row the index has closed at today's level |
| **The Judges' Split** | Under the gauge, only when the ingredients land two or more levels apart (The Action says Square Up while The Money says We Cool) |
| **What moved it** | How much the index moved and which ingredients pushed it, with the stories and matchups behind the move |
| **TheseHandsCon** | An estimate of US military readiness on a DEFCON-style scale, 5 (normal) to 1 (nuclear war), with the reasons for it |
| **The Rundown** | The whole picture in four or five sentences, with a copy button |
| **The Weigh-In** | Today's index, TheseHandsCon and main event on one card sized for a single phone screenshot |
| **Where It's Poppin** | A world map of places named in reports of force, plus heat by region. Zoom in (scroll, pinch, double-click or +) and drag to pull apart close dots |
| **The Fight Card** | The top four matchups, with the Tale of the Tape on the main event |
| **Doomsday Watch** | The official Doomsday Clock, a live Beef Clock, a nuclear-test check, and every clock setting since 1947 |
| **Trend** | The index over the last 7 days |
| **The Wire** | The top stories |
| **Where'd It Go?** | Links to every section that moved to another page. A "we moved" note at the top points to it until February 2027, or until dismissed |
| **The Scorebug** | Once the gauge scrolls away, a strip pinned to the top with the index, TheseHandsCon and the main event. Tap it to jump back up |

**The Wire** (`wire.html`): the full wire (smoke only or everything), the wider press, Reddit, both scrollers (WIRE and OSINT), search, plus Birds Up, The Money, Do Not Pull Up List and Mother Nature's Hands.

**The Card** (`card.html`):

| Panel | What it shows |
| --- | --- |
| **The Poster** | A typographic fight poster for the main event: billing, the two sides, date, and the region as the venue |
| **The Fight Card** | All eight bouts, each linking to its deep dive, with the Tale of the Tape on the main event and the explainer |
| **Press Conference** | The sharpest recent line from each side of the main event, with a link |
| **Card Changes** | Which bouts debuted today and which fell off since the last card on file |
| **The Undercard** | The next twelve real matchups below the main card's cutoff |
| **Training Camp** | Build-up before anything pops: drills, call-ups, mobilizations, deployments, missile tests |
| **The Cutman** | De-escalation on the table: ceasefire talk, negotiations, mediators, backchannels, off-ramps |

**The Vault** (`vault.html`): The Streak, The Record Book (all-time high and low, longest run at each level, on this day in beef history, most days as the main event), The Beef Log (every level change), and Receipts with the method and the back-test table.

**Deep dive** (`fight.html?p=RUS-UKR`): one page per matchup, driven by the pair in the address. Every bout on the card links to it. It has the poster, Tale of the Tape, Cornermen, Press Conference, Rematch History (the last day the pair closed at Swingin' or worse, with the index and TheseHandsCon that day), talk/flexin'/hands per day, Home Crowd (each side's own press, side by side), a 48-hour timeline, and a play-by-play of every report naming both sides.

Birds Up, The Money and Do Not Pull Up List appear only when their feed answers.

### We Beefin Index

| Index | Status | Color |
| --- | --- | --- |
| 0–24 | We Cool | Green |
| 25–54 | Why They Lookin At Me | Yellow |
| 55–79 | Square Up | Orange |
| 80–100 | Told Ya To Watch Ya Mouth | Red |

A status tightens the moment the index crosses a line. It relaxes only once the index is 2 points
clear of the line, so the label does not flicker at a boundary.

### TheseHandsCon

TheseHandsCon estimates where **US** military readiness would sit on the DEFCON scale. Like DEFCON,
it is about the United States, not the world: a war the US is not part of barely moves it.

| Level | Name | Meaning | US posture score |
| --- | --- | --- | --- |
| 5 | Hands In Pockets | Normal peacetime readiness | 0–39 |
| 4 | Hands On Hips | Heightened watch: US forces trading fire somewhere, or real friction with a nuclear rival | 40–54 |
| 3 | Hands Up | Raised readiness: the US in sustained combat, or squared off with Russia, China or North Korea | 55–69 |
| 2 | Knuckles Cracked | Next step to war: the US and a nuclear power on the brink | 70–84 |
| 1 | Hands Thrown | Nuclear war imminent or under way | 85–100 |

For reference, real DEFCON has been 3 twice in public record (the 1973 Yom Kippur War and 9/11), 2
once (the 1962 Cuban Missile Crisis, for Strategic Air Command), and 1 never.

The US posture score is built from three signals:

- **Rival standoffs**: the US, or a US treaty ally, squaring off with Russia, China or North Korea.
  This is the only signal that can reach levels 2 and 1.
- **US in combat**: US forces using or taking force against anyone else, with Iran counted double.
  On its own this tops out inside level 3.
- **Nuclear talk** in the press, which adds at most 15 points.

The strongest of the first two leads. Relaxing a level needs the score 3 points clear of the line.
Three hard triggers set a minimum: US forces trading fire with any state means level 4 or tighter;
the US trading blows with Russia, China or North Korea, or a nuclear test detected anywhere, means
level 3 or tighter.

## Fight night features: where the data comes from

None of these change the index, TheseHandsCon or any score. They are built from data the collector already had, plus one hand-made file.

- **Tale of the Tape** splits each matchup's talk / flexin' / hands by which side acted, using GDELT's actor 1 → actor 2 coding. The collector stores that split alongside the pair totals (`slot.o` in the GDELT store); the scored totals are untouched. Until a fresh 24 hours of slots carry the split, the tape shows the pair totals instead.
- **Allies, Cornermen and Home Crowd** come from `public/curated.json`, a short hand-made list: allies, arms suppliers and treaty ties for about 30 countries, and which outlets and web addresses are each country's domestic press. It is labelled on the page as curated and approximate.
- **Press Conference** has no article text or transcripts to work from, so a "statement" is a headline or channel post in which one side is named first and then speaks ("Zelensky says…", "Kremlin warns…"). Reddit is left out. If nothing fits, the panel hides.
- **The Cutman and Training Camp** run two extra keyword lists from `lib/classify.mjs` (`signals()`) over the same 24 hours of headlines and posts. The Cutman only keeps finds that touch a matchup on today's card or read as an outright calm-down. Training Camp needs a military word in the headline and skips anything already Swingin' or worse (missile tests excepted).
- **The Streak, Record Book, Card Changes and Rematch History** read a daily archive the collector now keeps in `state.json` and publishes as `public/history.json`: one entry per UTC day (the last reading of the day) with the index, its high and low, status, TheseHandsCon and the day's top 20 matchups, up to 400 days. The first run seeds it from the 7-day trend, so the record book starts with about a week of index history and builds card history from there.
- **search.json** rows carry two more fields for the deep dive: the countries a headline names (`lib/geo.mjs`, `countriesIn()`) and whose domestic press it is.

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
| 27 Feb 2019 | India and Pakistan dogfight; US–Russia row over the INF nuclear treaty | 43 | 3 |
| 8 Jan 2020 | Iran fires missiles at US bases in Iraq | 74 | 3 |
| 24 Feb 2022 | Russia invades Ukraine | 80 | 3 |
| 15 Mar 2023 | A Russian jet downs a US drone over the Black Sea | 36 | 3 |
| 8 Oct 2023 | Hamas attack, Gaza war begins (US not in the fight) | 71 | 5 |
| 14 Apr 2024 | Iran fires missiles and drones at Israel; US forces help shoot them down | 84 | 4 |
| 20 Nov 2024 | US-supplied missiles hit Russia, Moscow lowers its nuclear threshold | 61 | 2 |
| 7 May 2025 | India and Pakistan exchange strikes (US not in the fight) | 50 | 5 |

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
| adsb.lol and adsb.fi | Military aircraft in the air (merged; either one can be down) |
| Reddit (public RSS) | The On Reddit list and search |
| FRED (St. Louis Fed) | VIX and Brent crude, daily closes |
| US State Department | Travel advisories |
| Telegram public channel previews (t.me/s) | Posts from the channels in `TG_CHANNELS`, for the scroller only |
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
- **The OSINT scroller mixes sides on purpose.** Several channels are partisan or state-linked
  (IDF, Quds News Network, Rybar, Intel Slava). Their posts are unverified and never scored.
- **Birds Up needs a week.** It only judges what is unusual after 48 readings of its own baseline.

### Sources that were asked for but are not used

Each was tested from GitHub's servers, where the hosted page is built.

| Source | Why not |
| --- | --- |
| Flightradar24 | Behind a bot wall (HTTP 403), and its terms forbid scraping. adsb.lol and adsb.fi cover military aircraft instead |
| ADS-B Exchange | Its data is a paid API. adsb.fi, run on the same kind of volunteer receivers, is used instead |
| Liveuamap | Blocks servers (HTTP 403) and has no free feed |
| PullPush (Reddit archive) | Behind a bot wall (HTTP 403). Reddit's own RSS works and is used |
| Ground News | No feed or API; only its web page |
| ACLED | Needs a registered account. It could be added with your login stored as a GitHub secret |

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
| Channels in the OSINT scroller | `TG_CHANNELS` in `lib/sources.mjs` |
| Ticker speed | `TICKER_SPEED` in `public/index.html` (pixels per second; lower is slower) |
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
lib/csp.mjs            the pages' Content Security Policy (script hashes)
public/index.html      the front page; wire.html, card.html, vault.html and fight.html are the other pages
public/app.js          the page script all five pages share (each page draws the sections it has)
public/style.css       the shared stylesheet
public/curated.json    hand-made allies, arms suppliers, treaty ties and outlet home countries
lib/extras.mjs         daily archive, streak, record book, card changes, Press Conference, Cutman and Camp lists
public/count.js        GoatCounter's visitor-count script, served from the site
scripts/calibrate.mjs  back-tests the scoring on archived GDELT days
scripts/snapshot.mjs   bakes a reading into a standalone HTML file
scripts/csp.mjs        refreshes the CSP hashes after a script edit (npm run csp)
test/                  tests for the classifier, GDELT handling, scoring and feed parsers
.github/workflows/     GitHub Pages publishing, plus a check that tests and takes a dry reading on branches
```

`public/data.json`, `public/state.json`, `public/search.json` (the 48-hour search archive) and `snapshot.html` are generated and not committed.

## Visitor stats

The live page counts visits with [GoatCounter](https://www.goatcounter.com): visitors per day, countries, referring sites, and screen sizes. It uses no cookies and keeps no IP addresses. Only the account owner can see the dashboard at `https://weinthisthang.goatcounter.com`.

- **Skip your own visits:** open the live page once with `#toggle-goatcounter` on the end of the address. That browser stops counting until you do it again.
- **Change the account:** edit the `data-goatcounter` address near the end of each page in `public/`, then run `npm run csp`. The security policy follows that address.
- **Turn it off:** delete that `<script>` tag from each page and run `npm run csp`.
- Local copies (`npm start`, snapshots) are never counted.

## Security

The page loads no third-party JavaScript: no A/B testing (such as Optimizely), no ad or tag scripts, and no npm packages. Its only outside file is the Google Fonts stylesheet. The visitor counter's script (`public/count.js`) is GoatCounter's own code, copied into this repo and served from the site, so no remote script ever runs. A Content Security Policy in `public/index.html` lets the browser run only the page's own inline scripts (each pinned by SHA-256 hash) and script files from the site itself. Data can be fetched only from the site, GDELT, and the GoatCounter address. Any other script added to the page is blocked. Headlines and posts from feeds are shown as text, never run.

Most of the page code lives in `public/app.js`, which the policy allows as a file from the site itself, so editing it needs no hash update. If you edit an inline `<script>` in one of the pages, run `npm run csp` to refresh the hashes (it updates every page). `npm test` fails until you do, so a stale hash can't blank the live page. If one ever slips through, the status line says "the security policy blocked this page's own script".

## Troubleshooting

- **Stuck on "Checking who's beefin…"**: the page code didn't start. The status line shows
  "Page error: …" with the browser's message and line number when it can; if JavaScript is off for
  the site, a note under the status line says so.
- **"No reading yet"**: the page loaded before the first reading finished. Wait a few seconds and
  reload, or run `npm run collect`.
- **"Stale"**: the reading is more than 45 minutes old. Locally, check the server is running. On
  GitHub Pages, see the hosting section above.
- **Sources not reporting**: listed under Receipts with the reason. The index runs on whatever is
  left and marks the signal as Decent or Weak.
- **"No Signal"**: every feed failed. Check the internet connection.
- **Behind a proxy**: on Node 22.21 or newer, start with `NODE_USE_ENV_PROXY=1 npm start` so Node
  honors `HTTPS_PROXY`.
