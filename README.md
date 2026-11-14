# We Fighting? Errr… Nah

A personal OSINT tension tracker. One page, no dependencies.

- **We Beefin Index** — a 0–100 gauge: We Cool → Why They Lookin At Me → Squared Up → Told Ya Too Watch Ya Mouth
- **TheseHandsCon 5–1** — an estimated readiness posture, from Hands In Pockets to Hands Thrown
- **Doomsday Watch** — the official Doomsday Clock next to a live Beef Clock, plus a 7-day trend
- **Who Beefin** — heat by theater (Iran & the Gulf, Russia & Ukraine, China & Taiwan…)
- **The Wire** — the headlines driving the number, plus a scrolling ticker
- **Mother Nature's Hands** — significant earthquakes and space weather (shown, not scored)

## Run it

```sh
npm start          # http://localhost:8787, re-reads the feeds every 10 minutes
npm run collect    # take one reading and write public/data.json
npm run snapshot   # bake the current reading into a single snapshot.html
npm test
```

Needs Node 20+. `PORT` and `REFRESH_MIN` change the port and refresh interval.

## Host it free on GitHub Pages

`.github/workflows/pages.yml` takes a reading every 15 minutes and publishes the page.
Merge to `main`, then set **Settings → Pages → Source** to **GitHub Actions**.

## Sources

| Feed | Used for |
| --- | --- |
| BBC World, Al Jazeera RSS | News smoke: the whole index |
| GDELT | More conflict headlines for the index (rate-limited; last good pull is reused for 3 hours) |
| USGS, NOAA SWPC | Earthquakes and space weather |
| Bulletin of the Atomic Scientists | Official Doomsday Clock, a constant in `collect.mjs` updated each January |

## How the number is made

All scoring lives in `lib/score.mjs`.

- **Index.** Headlines from the last 48h get a smoke level 1–5 by keyword; newer counts more; talk of
  ceasefires and peace deals counts half.
- **TheseHandsCon** steps up every 20 index points and tightens one more step when nuclear chatter passes 25.

To tune it: status bands, posture names, theaters, keyword lists and `NEWS_SCALE` (how much news it takes to move the needle) are in `lib/score.mjs`.

This is for fun and situational awareness. Real DEFCON levels are classified, and nothing here is one.
