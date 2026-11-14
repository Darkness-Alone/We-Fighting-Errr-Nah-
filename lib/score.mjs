// Scoring engine for the We Beefin Index, TheseHandsCon and the Beef Clock.
// Pure functions: no network, and the clock only comes in through `now` arguments.
//
// Every curve below was set against real history with scripts/calibrate.mjs (see README, "Calibration"):
//   quiet days (Jun 2019, Jun 2021)             Action 23-32
//   ordinary tense days (Nov 2026)              Action 30-49
//   Russia invades Ukraine (24 Feb 2022)        Action 83
//   Hamas attack / Gaza war (8 Oct 2023)        Action 88
//   Iran's missile attack on Israel (Apr 2024)  Action 100

import { dyadWeight, countryName, theaterOfDyad, THEATERS, OTHER_THEATER, theaterOfFips, placeName } from './geo.mjs';
import { pct } from './gdelt.mjs';
import { clusterStories, heatOf, recency } from './classify.mjs';

export const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const round1 = (x) => Math.round(x * 10) / 10;

// ---- Scales --------------------------------------------------------------------

// Band edges come from the back-test: quiet years sit at 16-23, ordinary tense days at 29-45,
// crisis days at 58-73, and the days a major war opened (24 Feb 2022, 14 Apr 2024) at 80-84.
export const STATUSES = [
  { key: 'cool', label: 'We Cool', min: 0, max: 25, color: 'green', blurb: 'Everybody minding their business. Enjoy it.' },
  { key: 'lookin', label: 'Why They Lookin At Me', min: 25, max: 55, color: 'yellow', blurb: 'Side-eyes worldwide. The usual fights are on, nobody new has swung, nobody is relaxed.' },
  { key: 'squared', label: 'Squared Up', min: 55, max: 80, color: 'orange', blurb: 'Stances taken. A real crisis is under way somewhere.' },
  { key: 'mouth', label: 'Told Ya Too Watch Ya Mouth', min: 80, max: 100, color: 'red', blurb: 'It is on. Somebody did not listen.' },
];
// Heating up registers at once. Cooling down has to clear the line by 2 points, so the label
// does not flicker when the index sits on a boundary.
export function statusFor(index, prevKey = null) {
  const byNumber = STATUSES.find((s) => index < s.max) || STATUSES[STATUSES.length - 1];
  const prev = STATUSES.find((s) => s.key === prevKey);
  if (prev && byNumber.min < prev.min && index > prev.min - 2) return prev;
  return byNumber;
}

// `min` is the posture score at which the level kicks in.
export const HANDSCON = [
  { level: 5, min: 0, name: 'Hands In Pockets', blurb: 'Peacetime posture. The big dogs are minding their business.' },
  { level: 4, min: 24, name: 'Hands On Hips', blurb: 'Side-eyes between the heavyweights. Somebody said something slick.' },
  { level: 3, min: 42, name: 'Hands Up', blurb: 'Guard is up. Jewelry coming off, friends holding people back.' },
  { level: 2, min: 62, name: 'Knuckles Cracked', blurb: 'One wrong word from a swing between nuclear powers. Phones are out and recording.' },
  { level: 1, min: 80, name: 'Hands Thrown', blurb: 'It is on between the big dogs. Maximum readiness, no more talking.' },
];

// Where a matchup stands on the escalation ladder.
export const RUNGS = [
  { rung: 1, name: "Talkin' Spicy", what: 'insults, demands, accusations' },
  { rung: 2, name: "Flexin'", what: 'threats, sanctions, troop moves' },
  { rung: 3, name: "Swingin'", what: 'actual strikes and clashes' },
  { rung: 4, name: 'Full Send', what: 'sustained, war-level fighting' },
];

// Index = Action + Chatter + Big Dogs + Money. A missing ingredient hands its share to the others.
export const WEIGHTS = { action: 0.35, chatter: 0.35, bigdogs: 0.2, money: 0.1 };
export const INGREDIENTS = {
  action: { name: 'The Action', what: 'Fighting between countries, as coded from world news by GDELT' },
  chatter: { name: 'The Chatter', what: 'How much of the news is about fighting, and how bad' },
  bigdogs: { name: 'The Big Dogs', what: 'Nuclear powers squaring up, plus nuclear talk' },
  money: { name: 'The Money', what: 'Wall Street fear gauge and the oil price' },
};

// ---- The Action: what GDELT says is physically happening ------------------------

// Articles per hour on a log scale: 1/h = 15, 10/h = 52, 100/h = 100.
const rateScore = (perHour) => clamp((100 * Math.log10(1 + perHour)) / 2);

export function matchups(w) {
  const h = w.hours || 1;
  const out = [];
  for (const [key, [talk, threats, posture, hands]] of w.dyads) {
    const [a, b] = key.split('-');
    const total = talk + threats + posture + hands;
    if (!total) continue;
    const handsPerHour = hands / h;
    const heat = rateScore(handsPerHour + (0.5 * posture) / h + (0.25 * threats) / h);
    const weight = dyadWeight(a, b);
    let rung = 1;
    if ((threats + posture) / total >= 0.3 || posture / h >= 0.5) rung = 2;
    if (hands / total >= 0.25 && handsPerHour >= 0.5) rung = 3;
    if (handsPerHour >= 6) rung = 4;
    out.push({ key, a, b, talk, threats, posture, hands, total, handsPerHour, heat, weight, strat: heat * weight, rung });
  }
  return out;
}

// Half "how much of the world's news is state-on-state force", half "how hard is the hottest fight going".
export function actionScore(w) {
  if (!w.n) return { score: null, share: 0, peak: 0, matchups: [] };
  const ms = matchups(w).sort((x, y) => y.handsPerHour - x.handsPerHour);
  const share = pct(w.c[0], w.n);
  const shareScore = share > 0 ? clamp((100 * Math.log(share / 0.5)) / Math.log(10)) : 0;
  const peak = ms.length ? ms[0].handsPerHour : 0;
  return { score: 0.5 * shareScore + 0.5 * rateScore(peak), share, peak, matchups: ms };
}

// The hottest strategically dangerous matchups. `minWeight` narrows it to true nuclear standoffs.
export function escalation(w, minWeight = 0) {
  if (!w.n) return { score: null, top: [] };
  const ms = matchups(w).filter((m) => m.weight >= minWeight).sort((x, y) => y.strat - x.strat);
  const score = (ms[0]?.strat || 0) + 0.35 * (ms[1]?.strat || 0) + 0.15 * (ms[2]?.strat || 0);
  return { score: clamp(score), top: ms.slice(0, 3) };
}

// ---- The Chatter, part 1: the world's press, read from headline slugs in GDELT ---

// Severity-weighted share of headlines about fighting. 1.5 on a normal day, 7 on a crisis day, 15+ for an invasion.
export function pressScore(w) {
  const slugged = w.slug[1];
  if (slugged < 200) return { score: null, share: 0, articles: slugged, kinetic: 0 };
  const share = pct(w.slug[4], slugged) + 2 * pct(w.slug[5], slugged) + 3 * pct(w.slug[6], slugged);
  const score = share > 0.6 ? clamp((100 * Math.log(share / 0.6)) / Math.log(20 / 0.6)) : 0;
  return { score, share, articles: slugged, kinetic: w.slug[4] + w.slug[5] + w.slug[6] };
}

// Nuclear-weapons talk that is not diplomacy. 0.15 is background; 1.7 was "fire and fury" (Aug 2017).
export function nukeChatter(w) {
  const slugged = w.slug[1];
  if (slugged < 200) return { score: null, share: 0, articles: 0 };
  const share = pct(w.slug[8], slugged) + 2 * pct(w.slug[6], slugged);
  const score = share > 0.1 ? clamp((100 * Math.log(share / 0.1)) / Math.log(30)) : 0;
  return { score, share, articles: w.slug[8] };
}

// Recent hours react fast; the full day keeps one noisy hour from running the show.
export const fastSlow = (recent, day) => (recent == null ? day : day == null ? recent : 0.6 * recent + 0.4 * day);

// ---- The Chatter, part 2: front pages of major outlets --------------------------

// items: scored headlines [{title, url, source, outlet, kind, time, tier, calm, nuke}]
export function frontPages(items, now) {
  const fresh = items.filter((it) => now - it.time < 48 * 3600000 && it.time < now + 3600000);
  const byOutlet = new Map();
  for (const it of fresh) {
    if (it.kind !== 'front') continue;
    const o = byOutlet.get(it.outlet) || { heat: 0, weight: 0, n: 0 };
    const r = recency((now - it.time) / 3600000);
    o.heat += r * (heatOf(it) / 5);
    o.weight += r;
    o.n++;
    byOutlet.set(it.outlet, o);
  }
  const outlets = [...byOutlet.values()].filter((o) => o.n >= 8 && o.weight > 0);
  const stories = clusterStories(fresh, now);
  if (!outlets.length) return { score: null, density: 0, outlets: 0, stories };
  const density = outlets.reduce((s, o) => s + o.heat / o.weight, 0) / outlets.length;
  const densityScore = 100 * (1 - Math.exp(-density / 0.18));
  // A tier-5 story carried by eight outlets tops out the lead score.
  const leadScore = clamp(((stories[0]?.heat || 0) / 12.5) * 100);
  return { score: 0.7 * densityScore + 0.3 * leadScore, density, outlets: outlets.length, stories };
}

export function chatterScore(press, front) {
  if (press == null) return front;
  if (front == null) return press;
  return 0.6 * press + 0.4 * front;
}

// ---- The Money (optional feed) ---------------------------------------------------

// quotes: { vix: {price}, oil: {price, change5d} }  change5d in percent. Only fear counts: falling oil scores 0.
export function moneyScore(quotes) {
  if (!quotes) return null;
  const parts = [];
  if (quotes.vix) parts.push([0.65, clamp(((quotes.vix.price - 12) / 33) * 100)]);
  if (quotes.oil) parts.push([0.35, clamp(quotes.oil.change5d * 10)]);
  if (!parts.length) return null;
  const w = parts.reduce((s, p) => s + p[0], 0);
  return parts.reduce((s, p) => s + p[0] * p[1], 0) / w;
}

// ---- The Big Dogs ----------------------------------------------------------------

// escalationScore and nuke are 0..100; extras are small bounded nudges from optional feeds.
export function bigDogsScore(escalationScore, nuke, extras = {}) {
  if (escalationScore == null && nuke == null) return null;
  const base = escalationScore == null ? nuke : nuke == null ? escalationScore : 0.65 * escalationScore + 0.35 * nuke;
  return clamp(base + (extras.sky || 0) + (extras.advisories || 0));
}

// ---- Roll-up ---------------------------------------------------------------------

// parts: { action, chatter, bigdogs, money } each 0..100 or null
export function blend(parts) {
  let have = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) if (parts[k] != null) have += w;
  if (!have) return { raw: null, confidence: 0, contributions: {} };
  const contributions = {};
  let raw = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    contributions[k] = parts[k] == null ? null : round1((parts[k] * w) / have);
    if (parts[k] != null) raw += (parts[k] * w) / have;
  }
  return { raw: clamp(raw), confidence: have, contributions };
}

// Rises fast (half the gap in 10 minutes), falls slowly (half in 45): real tension does not vanish in one reading.
export function smooth(raw, prev, now) {
  if (raw == null) return null;
  if (!prev || prev.x == null || now - prev.t > 2 * 3600000 || now <= prev.t) return raw;
  const minutes = (now - prev.t) / 60000;
  const halfLife = raw > prev.x ? 10 : 45;
  return prev.x + (1 - Math.pow(0.5, minutes / halfLife)) * (raw - prev.x);
}

// Posture leans on the Big Dogs: a regional war moves the index more than it moves this.
export function postureScore(index, bigdogs) {
  if (index == null) return null;
  return bigdogs == null ? index : 0.4 * index + 0.6 * bigdogs;
}

// prevLevel adds stickiness: relaxing a level needs the score 3 points clear of the line.
// floor forces at least that much readiness (a lower number) when a hard trigger fires.
export function handsConFor(score, prevLevel = null, floor = 5) {
  let i = 0;
  for (let k = 0; k < HANDSCON.length; k++) if (score >= HANDSCON[k].min) i = k;
  let level = HANDSCON[i].level;
  if (prevLevel && level > prevLevel) {
    const line = HANDSCON.find((h) => h.level === prevLevel).min;
    if (score > line - 3) level = prevLevel;
  }
  level = Math.min(level, floor);
  return HANDSCON.find((h) => h.level === level);
}

// ---- Doomsday ----------------------------------------------------------------------

// The Bulletin of the Atomic Scientists sets the real clock once a year. The Beef Clock starts from
// that setting and moves with today's nuclear-risk reading: every 30 points hotter halves the time left.
export const DOOMSDAY_NEUTRAL = 30; // the reading at which the Beef Clock equals the official one

export function doomScore(nuclearEscalation, nuke, nukeTestDetected = false) {
  if (nuclearEscalation == null && nuke == null) return null;
  const base = nuclearEscalation == null ? nuke : nuke == null ? nuclearEscalation : 0.55 * nuclearEscalation + 0.45 * nuke;
  return clamp(base + (nukeTestDetected ? 25 : 0));
}
export function beefClockSeconds(officialSeconds, score) {
  if (score == null) return null;
  return Math.max(1, Math.round(officialSeconds * Math.pow(2, (DOOMSDAY_NEUTRAL - score) / 30)));
}

// ---- Trend -------------------------------------------------------------------------

// history: [{t, i}] oldest first. Finds the reading closest to `hoursAgo`, within a third of that span.
export function changeSince(history, now, index, hoursAgo) {
  const target = now - hoursAgo * 3600000;
  let best = null;
  for (const p of history) {
    const d = Math.abs(p.t - target);
    if (d <= (hoursAgo * 3600000) / 3 && (!best || d < Math.abs(best.t - target))) best = p;
  }
  return best ? index - best.i : null;
}
export function trendFor(d1, d24) {
  if (d1 == null && d24 == null) return { key: 'new', label: 'No Trend Yet' };
  const up = (d24 != null && d24 >= 4) || (d1 != null && d1 >= 3);
  const down = (d24 != null && d24 <= -4) || (d1 != null && d1 <= -3);
  if (up && !down) return { key: 'up', label: "Heatin' Up" };
  if (down && !up) return { key: 'down', label: "Coolin' Off" };
  return { key: 'flat', label: "Holdin' Steady" };
}

// ---- Shaping GDELT windows for the page ----------------------------------------------

export function fightCard(day, recent, limit = 8) {
  const recentBy = new Map(matchups(recent).map((m) => [m.key, m]));
  return matchups(day)
    .filter((m) => m.total >= 6 && m.weight > 0.15) // allies bickering is not a matchup
    .sort((x, y) => y.heat - x.heat || y.total - x.total)
    .slice(0, limit)
    .map((m) => {
      const now = recentBy.get(m.key);
      const nowRate = now ? now.handsPerHour : 0;
      const move = nowRate > m.handsPerHour * 1.5 + 0.3 ? 'up' : nowRate < m.handsPerHour * 0.5 - 0.1 ? 'down' : 'flat';
      return {
        key: m.key, a: countryName(m.a), b: countryName(m.b), theater: theaterOfDyad(m.a, m.b),
        talk: m.talk + m.threats, flex: m.posture, hands: m.hands, articles: m.total,
        handsPerHour: round1(m.handsPerHour), heat: Math.round(m.heat), rung: m.rung,
        stakes: m.weight >= 0.8 ? 'nuclear' : m.weight >= 0.35 ? 'big' : 'regional',
        move,
      };
    });
}

// Capitals where decisions get announced, not where anything is landing. A dot there would mislead.
const NEWSROOMS = /^(washington|white house|pentagon|capitol hill|london|new york|united nations|brussels|paris|berlin|geneva|ottawa|canberra|the hague|vienna)\b/i;
const PLACE_ALIAS = { Kiev: 'Kyiv', Petersburg: 'St Petersburg', Odessa: 'Odesa', Teheran: 'Tehran', Kharkov: 'Kharkiv' };
const fixPlace = (name) => name.replace(/^[^,]+/, (first) => PLACE_ALIAS[first] || first);

export function hotSpots(w, limit = 50) {
  const all = [...w.spots.values()].filter((s) => !NEWSROOMS.test(s.name));
  // A place needs a few independent reports, scaled to how busy the day is, before it earns a dot.
  const floor = Math.max(3, 0.08 * Math.max(0, ...all.map((s) => s.count)));
  return all
    .filter((s) => s.count >= floor)
    .sort((x, y) => y.count - x.count)
    .slice(0, limit)
    .map((s) => ({ lat: s.lat, lon: s.lon, n: s.count, name: fixPlace(placeName(s.name)), theater: theaterOfFips(s.fips) }));
}

// Heat per region from three independent views: matchups, places where force is reported, and headlines.
export function theaterBoard(day, stories) {
  const acc = new Map([...THEATERS, OTHER_THEATER].map((t) => [t.id, { id: t.id, name: t.name, hands: 0, places: 0, stories: 0, storyHeat: 0, top: null }]));
  for (const m of matchups(day)) if (m.weight > 0.15) acc.get(theaterOfDyad(m.a, m.b)).hands += m.hands;
  for (const s of day.spots.values()) if (!NEWSROOMS.test(s.name)) acc.get(theaterOfFips(s.fips)).places += s.count;
  for (const s of stories) {
    if (!s.tier) continue;
    const t = acc.get(s.theater) || acc.get('other');
    t.stories++;
    t.storyHeat += s.heat;
    if (!t.top || s.heat > t.top.heat) t.top = { title: s.title, url: s.url, heat: s.heat };
  }
  const list = [...acc.values()].map((t) => ({ ...t, raw: t.hands + 0.5 * t.places + 6 * t.storyHeat }));
  const max = Math.max(1, ...list.map((t) => t.raw));
  return list
    .filter((t) => t.raw > 0)
    .sort((x, y) => y.raw - x.raw)
    .map((t) => ({
      id: t.id, name: t.name, heat: Math.round((100 * t.raw) / max), hands: t.hands, places: t.places, stories: t.stories,
      top: t.top && { title: t.top.title, url: t.top.url },
    }));
}
