#!/usr/bin/env node
// Takes one reading: pulls every feed, scores it, and writes public/data.json (for the page)
// and public/state.json (what the next reading needs: 24h of GDELT slots, history, the last index).
//
//   node collect.mjs                    one reading
//   PREV_URL=https://host/site node collect.mjs
//                                       start from the state of an already-published copy
//                                       (how the GitHub Pages workflow keeps its memory between runs)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as src from './lib/sources.mjs';
import * as sc from './lib/score.mjs';
import * as gd from './lib/gdelt.mjs';
import { classify, clusterStories, prettySlug, BEEF_TYPES, CALM_NAME } from './lib/classify.mjs';
import { theaterOfText, countryName, usFoeWeight, US_PEERS } from './lib/geo.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(ROOT, 'public', 'data.json');
export const STATE_FILE = path.join(ROOT, 'public', 'state.json');

// The Bulletin of the Atomic Scientists sets this once a year, in late January. Update it by hand then.
const DOOMSDAY_OFFICIAL = { seconds: 85, setOn: '2026-01-27', source: 'Bulletin of the Atomic Scientists' };
// Every setting since 1947, [year, seconds to midnight], for the timeline chart.
const DOOMSDAY_TIMELINE = [
  [1947, 420], [1949, 180], [1953, 120], [1960, 420], [1963, 720], [1968, 420], [1969, 600], [1972, 720], [1974, 540],
  [1980, 420], [1981, 240], [1984, 180], [1988, 360], [1990, 600], [1991, 1020], [1995, 840], [1998, 540], [2002, 420],
  [2007, 300], [2010, 360], [2012, 300], [2015, 180], [2017, 150], [2018, 120], [2020, 100], [2023, 90], [2025, 89], [2026, 85],
];

const HOUR = 3600000;
const round = Math.round;
const orNull = (x) => (x == null ? null : round(x));

async function attempt(name, fn, sources, describe) {
  try {
    const value = await fn();
    sources.push({ name, ok: true, note: describe ? describe(value) : Array.isArray(value) ? `${value.length} items` : 'ok' });
    return value;
  } catch (err) {
    sources.push({ name, ok: false, note: String(err.cause?.code || err.message || err).slice(0, 80) });
    return null;
  }
}

async function loadState() {
  const base = process.env.PREV_URL?.replace(/\/(data|state)\.json$/, '').replace(/\/$/, '');
  if (base) {
    for (const name of ['state.json', 'data.json']) {
      try {
        const res = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;
        const json = await res.json();
        return name === 'state.json' ? json : { history: json.history || [] };
      } catch { /* try the next one */ }
    }
  }
  try { return JSON.parse(await readFile(STATE_FILE, 'utf8')); } catch { /* first run */ }
  try { return { history: JSON.parse(await readFile(DATA_FILE, 'utf8')).history || [] }; } catch { return {}; }
}

// Full detail for the last day, one point per half hour before that, a week in all.
function thin(history, now) {
  const out = [];
  let lastKept = 0;
  for (const p of history) {
    if (now - p.t > 7 * 24 * HOUR) continue;
    if (now - p.t < 24 * HOUR || p.t - lastKept >= 30 * 60000) { out.push(p); lastKept = p.t; }
  }
  return out;
}

const hms = (secondsToMidnight) => {
  const s = 86400 - secondsToMidnight, p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

export async function collect(now = Date.now()) {
  const sources = [];
  const state = await loadState();
  const store = state.gdelt || {};

  // ---- fetch everything at once
  const feedJobs = src.FEEDS.map((f) => src.fetchFeed(f).then((items) => ({ f, items }), (err) => ({ f, err })));
  const [latest, feeds, quakes, nukeTests, kp, sky, money, advisories, tgFeed] = await Promise.all([
    attempt('GDELT', () => src.fetchGdeltLatest(gd.GDELT_BASE), sources, () => ''),
    Promise.all(feedJobs),
    attempt('USGS earthquakes', src.fetchQuakes, sources),
    attempt('USGS nuclear-test watch', () => src.fetchNukeTests(now), sources, (v) => (v.length ? `${v.length} detected` : 'none detected')),
    attempt('NOAA space weather', src.fetchKp, sources, (v) => `Kp ${v.kp}`),
    attempt('adsb.lol military aircraft', src.fetchSky, sources, (v) => `${v.airborne} airborne`),
    attempt('FRED markets', () => src.fetchMoney(now), sources, (v) => Object.keys(v).join(', ')),
    attempt('State Dept advisories', () => src.fetchAdvisories(now), sources, (v) => `${v.total} countries`),
    attempt('OSINT channels on Telegram', () => src.fetchTelegram(now), sources, (v) => `${v.posts.length} posts (${v.report})`),
  ]);

  // A good batch of channel posts is kept for up to six hours in case Telegram refuses a run.
  const tgKept = state.tg && now - state.tg.t < 6 * HOUR ? state.tg : null;
  const tgPosts = (tgFeed ? tgFeed.posts : tgKept ? tgKept.posts : []).filter((p) => now - p.time < 24 * HOUR);
  if (!tgFeed && tgKept) {
    const s = sources.find((x) => x.name === 'OSINT channels on Telegram');
    Object.assign(s, { ok: true, cached: true, note: `no answer this time, showing ${tgPosts.length} posts from earlier` });
  }

  // ---- GDELT: bring the 24h store up to date
  const gdeltSource = sources.find((s) => s.name === 'GDELT');
  if (latest) {
    const r = await gd.refresh(store, latest, src.getBuffer, { now });
    const have = Object.values(store.en).filter(Boolean).length;
    gdeltSource.note = `${have * 15} min of event files, ${r.fetched} new`;
    if (!have) Object.assign(gdeltSource, { ok: false, note: 'no event files could be read' });
  } else if (store.latest && now - gd.stampToMs(store.latest) < 3 * HOUR) {
    Object.assign(gdeltSource, { ok: true, cached: true, note: 'index unreachable, using the last 24h on file' });
  }
  const gdeltOk = gdeltSource.ok && store.latest;
  const recent = gd.windowStats(gdeltOk ? store : null, 6);
  const day = gd.windowStats(gdeltOk ? store : null, 24);

  // ---- headlines
  const byOutlet = new Map();
  const seen = new Set();
  const items = [];
  for (const { f, items: got, err } of feeds) {
    const o = byOutlet.get(f.outlet) || { ok: 0, bad: 0, n: 0, err: '' };
    if (err) { o.bad++; o.err = String(err.cause?.code || err.message).slice(0, 60); }
    else {
      o.ok++;
      for (const it of got) {
        const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (seen.has(key)) continue;
        seen.add(key);
        o.n++;
        items.push({ ...it, source: f.outlet, outlet: f.outlet, kind: f.kind, rank: f.kind === 'front' ? 1 : 2, ...classify(it.title) });
      }
    }
    byOutlet.set(f.outlet, o);
  }
  for (const [outlet, o] of byOutlet) {
    sources.push({ name: outlet, group: 'news', ok: o.ok > 0, note: o.ok ? `${o.n} headlines` : o.err });
  }
  const front = sc.frontPages(items, now);
  const stories = front.stories.map((s) => ({ ...s, theater: theaterOfText(s.title) }));
  const smoke = stories.filter((s) => s.tier > 0);

  // What the wider press is running, rebuilt from headline slugs in the last six hours of GDELT.
  const press = clusterStories(recent.hot.map((h) => ({ ...h, rank: 5 })), now)
    .filter((c) => c.n >= 3)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((c) => ({ title: prettySlug(c.title), url: c.url, n: c.n, tier: c.tier, calm: c.calm, time: c.time, sample: c.sources.slice(0, 3) }));

  // ---- ingredients
  const actR = sc.actionScore(recent), actD = sc.actionScore(day);
  const prR = sc.pressScore(recent), prD = sc.pressScore(day);
  const nkR = sc.nukeChatter(recent), nkD = sc.nukeChatter(day);
  const escD = sc.escalation(day);
  const action = sc.fastSlow(actR.score, actD.score);
  const pressScore = sc.fastSlow(prR.score, prD.score);
  const nuke = sc.fastSlow(nkR.score, nkD.score);
  const esc = sc.fastSlow(sc.escalation(recent).score, escD.score);
  const nuclearEsc = sc.fastSlow(sc.escalation(recent, 0.8).score, sc.escalation(day, 0.8).score);
  const chatter = sc.chatterScore(pressScore, front.score);

  // Optional feeds only ever nudge: aircraft count when it breaks out of its own week-long range,
  // advisories when Washington newly tells people to leave somewhere.
  const history = state.history || [];
  const skyBase = history.filter((p) => p.k != null && now - p.t < 7 * 24 * HOUR).map((p) => p.k).sort((a, b) => a - b);
  let skyNote = null, skyBonus = 0;
  if (sky && skyBase.length >= 48) {
    const median = skyBase[Math.floor(skyBase.length / 2)], p90 = skyBase[Math.floor(skyBase.length * 0.9)];
    if (sky.strategic >= Math.max(p90 * 1.5, median + 8)) { skyBonus = 6; skyNote = 'surge'; }
    else if (sky.strategic >= Math.max(p90, median + 4)) { skyBonus = 3; skyNote = 'busy'; }
    else skyNote = 'normal';
    sky.usual = median;
  }
  if (sky) sky.note = skyNote;
  const advisoryBonus = advisories ? Math.min(9, 3 * advisories.newLevel4) : 0;

  const bigdogs = sc.bigDogsScore(esc, nuke, { sky: skyBonus, advisories: advisoryBonus });
  const moneyScore = sc.moneyScore(money);
  const parts = { action, chatter, bigdogs, money: moneyScore };
  const mix = sc.blend(parts);

  // ---- index, status, trend
  const smoothed = sc.smooth(mix.raw, state.last, now);
  const index = orNull(smoothed);
  const status = index == null ? null : sc.statusFor(index, state.last?.status);
  const d1 = index == null ? null : sc.changeSince(history, now, index, 1);
  const d24 = index == null ? null : sc.changeSince(history, now, index, 24);
  const trend = index == null ? null : { ...sc.trendFor(d1, d24), d1, d24 };

  // ---- TheseHandsCon
  const freshTest = (nukeTests || []).filter((t) => now - t.time < 7 * 24 * HOUR);
  // TheseHandsCon is about US readiness: 60% the last six hours, 40% the full day, like the index.
  const usR = sc.usPosture(recent, nkR.score), usD = sc.usPosture(day, nkD.score);
  const posture = usD ? sc.fastSlow(usR?.score, usD.score) : null;
  // Hard floors. A nuclear test anywhere, or the US trading blows with Russia, China or North Korea,
  // means at least level 3. US forces in an exchange of fire with any state means at least level 4.
  const usSwing = sc.matchups(day).filter((m) => (m.a === 'USA' || m.b === 'USA') && usFoeWeight(m.a === 'USA' ? m.b : m.a) > 0 && m.rung >= 3);
  const peerFight = sc.matchups(recent).filter((m) => (m.a === 'USA' || m.b === 'USA') && US_PEERS.has(m.a === 'USA' ? m.b : m.a) && m.handsPerHour >= 3);
  const floor = freshTest.length || peerFight.length ? 3 : usSwing.length ? 4 : 5;
  const handsCon = posture == null ? null : sc.handsConFor(posture, state.last?.con, floor);
  const why = [];
  if (handsCon) {
    for (const t of freshTest) why.push(`Seismic network logged a nuclear explosion: ${t.title}. That alone means level 3 or tighter`);
    for (const m of peerFight) why.push(`The US and ${countryName(m.a === 'USA' ? m.b : m.a)} are trading blows right now. That alone means level 3 or tighter`);
    for (const m of usSwing.slice(0, 2)) why.push(`US forces are trading fire with ${countryName(m.a === 'USA' ? m.b : m.a)}: ${m.hands} reports of force in 24h. That alone means level 4 or tighter`);
    const st = usD?.standoffs[0];
    if (st) why.push(st.ally
      ? `Closest call with a nuclear rival: ${countryName(st.ally)}, a US ally, vs ${countryName(st.foe)}`
      : `Closest call with a nuclear rival: the US vs ${countryName(st.foe)}, ${round(st.heat)} out of 100`);
    if (usD) why.push(`US posture score ${round(posture)}: rival standoffs ${round(usD.parts.peer)}, US in combat ${round(usD.parts.regional)}, nuclear talk ${round(usD.parts.nuke)}`);
    if (skyNote === 'surge' || skyNote === 'busy') why.push(`Strategic aircraft up: ${sky.strategic} tracked, usually about ${sky.usual}`);
    if (advisoryBonus) why.push(`${advisories.newLevel4} new "Do Not Travel" warning${advisories.newLevel4 === 1 ? '' : 's'} from Washington this week`);
  }

  // ---- Doomsday
  const doom = sc.doomScore(nuclearEsc, nuke, freshTest.length > 0);
  const beefSeconds = sc.beefClockSeconds(DOOMSDAY_OFFICIAL.seconds, doom);

  // ---- history, change log
  const log = state.log || [];
  if (index != null) {
    const prev = state.last;
    if (prev?.status && prev.status !== status.key) log.push({ t: now, kind: 'status', from: prev.status, to: status.key });
    if (prev?.con && handsCon && prev.con !== handsCon.level) log.push({ t: now, kind: 'con', from: prev.con, to: handsCon.level });
    history.push({
      t: now, i: index, x: Math.round(smoothed * 10) / 10, c: handsCon?.level, d: beefSeconds,
      a: orNull(action), h: orNull(chatter), b: orNull(bigdogs), m: orNull(moneyScore),
      ...(sky ? { k: sky.strategic } : {}),
    });
  }
  const kept = thin(history, now);

  // ---- the page's parts
  const card = gdeltOk ? sc.fightCard(day, recent) : [];
  const theaters = sc.theaterBoard(day, stories);
  const ingredients = Object.keys(sc.WEIGHTS).map((key) => ({
    key, ...sc.INGREDIENTS[key], score: orNull(parts[key]), points: mix.contributions[key] ?? null,
  }));
  const detail = {
    action: gdeltOk ? `${actD.share.toFixed(2)}% of ${day.n.toLocaleString('en-US')} coded events in 24h were state-on-state force` : null,
    chatter: prD.score != null ? `${prD.kinetic.toLocaleString('en-US')} of ${prD.articles.toLocaleString('en-US')} headlines in 24h were about fighting` : front.score != null ? `${front.outlets} front pages` : null,
    bigdogs: escD.top[0] ? `Led by ${countryName(escD.top[0].a)} vs ${countryName(escD.top[0].b)}` : null,
    money: money ? [money.vix && `VIX ${money.vix.price}`, money.oil && `Brent $${money.oil.price}`].filter(Boolean).join(', ') : null,
  };
  for (const ing of ingredients) ing.detail = detail[ing.key];

  const feedsOk = sources.filter((s) => s.ok).length;
  // Ingredient coverage, marked down when only a few of the news outlets answered.
  const outletsOk = [...byOutlet.values()].filter((o) => o.ok).length;
  const conf = mix.confidence * (0.7 + (0.3 * outletsOk) / Math.max(1, byOutlet.size)) * (gdeltSource.cached ? 0.6 : 1);
  const confidence = { pct: round(conf * 100), ok: feedsOk, total: sources.length,
    label: conf >= 0.8 ? 'Strong signal' : conf >= 0.5 ? 'Decent signal' : 'Weak signal' };

  const rundown = [];
  if (index != null) {
    const moved = d24 == null ? '' : d24 === 0 ? ', flat on the day' : `, ${d24 > 0 ? 'up' : 'down'} ${Math.abs(d24)} on the day`;
    rundown.push(`The We Beefin Index reads ${index}${moved}: ${status.label}.${trend.key === 'new' ? '' : ` ${trend.label}.`}`);
    if (card[0]) {
      const rest = card.slice(1, 4).map((m) => `${m.a} vs ${m.b} (${sc.RUNGS[m.rung - 1].name})`);
      rundown.push(`Main event is ${card[0].a} vs ${card[0].b}, ${sc.RUNGS[card[0].rung - 1].name}, with ${card[0].hands} reports of force in 24 hours.${rest.length ? ` Also on the card: ${rest.join(', ')}.` : ''}`);
    }
    if (smoke[0]) rundown.push(`Top story: "${smoke[0].title}" (${smoke[0].n === 1 ? smoke[0].source : `${smoke[0].n} outlets`}).`);
    if (handsCon) rundown.push(`TheseHandsCon ${handsCon.level}, ${handsCon.name}.` + (beefSeconds == null ? '' : ` The Beef Clock reads ${hms(beefSeconds)}, ${beefSeconds} seconds to midnight against the official ${DOOMSDAY_OFFICIAL.seconds}.`));
    if (sky) rundown.push(`In the air: ${sky.groups.map((g) => `${g.n} ${g.name.toLowerCase()}`).join(', ')}.`);
  }

  const data = {
    version: 2,
    generatedAt: now,
    index, raw: orNull(mix.raw), status, trend, confidence,
    ingredients,
    handsCon: handsCon && { ...handsCon, score: round(posture), why },
    doomsday: {
      official: DOOMSDAY_OFFICIAL, timeline: DOOMSDAY_TIMELINE, beefSeconds, score: orNull(doom),
      drivers: [
        { label: 'Nuclear standoffs', value: orNull(nuclearEsc), what: 'Friction between nuclear-armed rivals and their treaty allies' },
        { label: 'Nuclear talk', value: orNull(nuke), what: 'Headlines about nuclear weapons, tests and threats (not diplomacy)' },
      ],
      nukeTests: nukeTests || null,
    },
    rundown,
    fightCard: card,
    hotSpots: gdeltOk ? sc.hotSpots(day) : [],
    theaters,
    wire: {
      stories: smoke.slice(0, 40),
      quiet: stories.filter((s) => !s.tier).sort((a, b) => b.time - a.time).slice(0, 20),
      press,
      pressStats: prD.score == null ? null : { articles: prD.articles, kinetic: prD.kinetic },
      outlets: [...byOutlet].filter(([, o]) => o.ok).length,
    },
    sky: sky || null,
    money: money || null,
    advisories: advisories || null,
    osint: { channels: src.TG_CHANNELS, posts: tgPosts },
    nature: { quakes: (quakes || []).slice(0, 5), kp: kp || null },
    gdelt: gdeltOk ? { latest: gd.stampToMs(store.latest), events: day.n, hours: day.hours } : null,
    sources,
    history: kept.map((p) => ({ t: p.t, i: p.i, c: p.c })),
    log: log.slice(-12),
    scales: { statuses: sc.STATUSES, handsCon: sc.HANDSCON, rungs: sc.RUNGS, beefTypes: BEEF_TYPES, calm: CALM_NAME, weights: sc.WEIGHTS },
  };

  const next = {
    gdelt: store, history: kept, log: log.slice(-12), tg: tgFeed ? { t: now, posts: tgFeed.posts } : state.tg,
    last: index == null ? state.last : { t: now, x: smoothed, status: status.key, con: handsCon?.level },
  };
  return { data, state: next };
}

export async function collectAndWrite() {
  const { data, state } = await collect();
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data));
  await writeFile(STATE_FILE, JSON.stringify(state));
  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const d = await collectAndWrite();
  console.log(`We Beefin Index: ${d.index} (${d.status?.label}) | TheseHandsCon ${d.handsCon?.level} | Beef Clock ${d.doomsday.beefSeconds}s | ${d.confidence.label}`);
  console.log('  ' + d.ingredients.map((i) => `${i.name} ${i.score ?? '-'}`).join(' | '));
  for (const s of d.sources) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.note ? `: ${s.note}` : ''}`);
  if (d.index == null) process.exitCode = 1;
}
