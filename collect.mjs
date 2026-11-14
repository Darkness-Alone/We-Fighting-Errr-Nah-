#!/usr/bin/env node
// Pulls every feed, scores it, and writes public/data.json.
//   node collect.mjs                 one-shot
//   PREV_URL=https://.../data.json   carry history over from a deployed copy (used by the Pages workflow)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as src from './lib/sources.mjs';
import * as sc from './lib/score.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(ROOT, 'public', 'data.json');
const HISTORY_MAX = 7 * 24 * 4; // a week of 15-minute readings

// The Bulletin of the Atomic Scientists sets this once a year. Update by hand each January.
const DOOMSDAY_OFFICIAL = { seconds: 85, setOn: '2026-01-27', source: 'Bulletin of the Atomic Scientists' };

async function attempt(name, fn, sources) {
  try {
    const value = await fn();
    sources.push({ name, ok: true, count: Array.isArray(value) ? value.length : 1 });
    return value;
  } catch (err) {
    sources.push({ name, ok: false, error: String(err.cause?.code || err.message).slice(0, 80) });
    return null;
  }
}

// Previous reading: carries the trend history and the last good GDELT pull forward.
async function loadPrevious() {
  try {
    if (process.env.PREV_URL) {
      const res = await fetch(process.env.PREV_URL, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return await res.json();
    }
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export async function collect(now = Date.now()) {
  const sources = [];
  const prev = await loadPrevious();
  const [events, quakes, kp, gdelt, ...rss] = await Promise.all([
    attempt('Polymarket', src.fetchPolymarketEvents, sources),
    attempt('USGS Earthquakes', src.fetchQuakes, sources),
    attempt('NOAA Space Weather', src.fetchKp, sources),
    attempt('GDELT', src.fetchGdelt, sources),
    ...src.RSS_FEEDS.map((f) => attempt(f.name, () => src.fetchRss(f), sources)),
  ]);

  // GDELT allows one request every 5 seconds and drops out often. Reuse the last good pull
  // for up to 3 hours so the news score does not jump every time it does.
  let gdeltCache = gdelt ? { t: now, items: gdelt } : prev.gdeltCache;
  if (!gdelt && gdeltCache && now - gdeltCache.t < 3 * 3600000) {
    const s = sources.find((x) => x.name === 'GDELT');
    Object.assign(s, { ok: true, cached: true, count: gdeltCache.items.length });
    delete s.error;
  } else if (!gdelt) gdeltCache = undefined;
  const gdeltItems = gdeltCache?.items || [];

  // Markets
  const candidates = [];
  for (const ev of events || []) {
    const picked = src.pickMarket(ev, now);
    if (!picked) continue;
    const text = `${ev.title} ${picked.question}`;
    const cls = sc.classifyMarket(text);
    if (!cls) continue;
    candidates.push({
      title: picked.question || ev.title,
      url: `https://polymarket.com/event/${ev.slug}`,
      ...cls,
      pYes: picked.pYes,
      change24h: picked.change24h,
      vol24h: Number(ev.volume24hr) || 0,
      endDate: picked.endDate,
      theater: sc.theaterOf(text),
    });
  }
  const mk = sc.scoreMarkets(candidates);
  const markets = mk.markets.map((m) => ({
    ...m,
    // Signed so that positive always means "more beef".
    riskChange24h: m.kind === 'escalation' ? m.change24h : -m.change24h,
  }));

  // Headlines
  const seen = new Set();
  const raw = [...rss.flatMap((r) => r || []), ...gdeltItems].filter((h) => {
    const key = h.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key) || now - h.time > 48 * 3600000 || h.time > now + 3600000) return false;
    seen.add(key);
    return true;
  });
  const nw = sc.scoreNews(raw, now);
  const headlines = nw.headlines
    .map((h) => ({ ...h, theater: sc.theaterOf(h.title + ' ' + h.summary), summary: undefined }))
    .sort((a, b) => b.time - a.time);
  const hotHeadlines = headlines.filter((h) => h.tier > 0);

  // Theaters: who is beefin' with who
  const theaters = [...sc.THEATERS, { id: 'other', name: 'Everywhere Else' }]
    .map((th) => {
      const ms = markets.filter((m) => m.theater === th.id);
      const hs = hotHeadlines.filter((h) => h.theater === th.id);
      const mHeat = ms.reduce((s, m) => s + m.weight * m.risk, 0);
      const hHeat = hs.reduce((s, h) => s + h.heat, 0);
      return { id: th.id, name: th.name, markets: ms.length, headlines: hs.length, raw: mHeat + hHeat * 1.5 };
    })
    .filter((t) => t.markets + t.headlines > 0)
    .sort((a, b) => b.raw - a.raw);
  const maxRaw = theaters[0]?.raw || 1;
  for (const t of theaters) {
    t.heat = Math.round((100 * t.raw) / maxRaw);
    delete t.raw;
  }

  // Nuclear chatter: highest live odds on a nuclear market, plus nuclear headlines
  const nukeOdds = Math.max(0, ...markets.filter((m) => m.severity === 5).map((m) => m.risk));
  const nukeHeadlines = hotHeadlines.filter((h) => h.tier === 5).length;
  const nukeHeat = Math.min(1, nukeOdds + nukeHeadlines * 0.05);

  const index = sc.combine(mk.score, nw.score);
  const status = index == null ? null : sc.statusFor(index);
  const handsCon = index == null ? null : sc.handsConFor(index, nukeHeat);

  const history = prev.history || [];
  if (index != null) history.push({ t: now, i: index, c: handsCon.level });

  return {
    generatedAt: now,
    index,
    status,
    handsCon,
    components: {
      markets: mk.score == null ? null : Math.round(mk.score),
      news: nw.score == null ? null : Math.round(nw.score),
      nuke: Math.round(nukeHeat * 100),
    },
    doomsday: {
      official: DOOMSDAY_OFFICIAL,
      beefSeconds: index == null ? null : sc.beefClockSeconds(index),
    },
    theaters,
    markets,
    headlines: headlines.slice(0, 60),
    nature: { quakes: (quakes || []).slice(0, 5), kp },
    sources,
    history: history.slice(-HISTORY_MAX),
    gdeltCache,
    scales: { statuses: sc.STATUSES, handsCon: sc.HANDSCON },
  };
}

export async function collectAndWrite() {
  const data = await collect();
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data));
  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const d = await collectAndWrite();
  console.log(`We Beefin Index: ${d.index} (${d.status?.label}) | TheseHandsCon ${d.handsCon?.level}`);
  console.log(`  markets ${d.components.markets} (${d.markets.length} tracked) | news ${d.components.news} | nuke ${d.components.nuke}`);
  for (const s of d.sources) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.ok ? ` (${s.count})` : `: ${s.error}`}`);
  if (d.index == null) process.exitCode = 1;
}
