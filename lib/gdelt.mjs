// GDELT 2.0 event files: every 15 minutes GDELT publishes every "who did what to whom" it coded
// from the world's news, in English and (machine-translated) 65 other languages.
// One file is noisy. A day of them, filtered to state-vs-state events and counted by article, is not.
//
// This module downloads the files, boils each one down to a small "slot", and adds slots up over a window.

import zlib from 'node:zlib';
import { dyadKey, isRegionCode } from './geo.mjs';
import { classify } from './classify.mjs';

export const GDELT_BASE = 'https://storage.googleapis.com/data.gdeltproject.org/gdeltv2';
export const SLOT_MS = 15 * 60000;
export const KEEP_SLOTS = 96; // 24 hours
const HOT_SLOTS = 24; // slugs are only kept for the last 6 hours
const MAX_HOT_PER_SLOT = 40;
const MAX_SEARCH_PER_SLOT = 80; // conflict-related headlines kept for keyword search, 24h

// ---- zip ---------------------------------------------------------------------
// Each download is a zip holding one CSV. This reads just enough of the format for that.
export function unzipFirst(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad zip directory');
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('bad zip entry');
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return zlib.inflateRawSync(data);
  throw new Error(`unsupported zip method ${method}`);
}

// ---- slugs -------------------------------------------------------------------
// Most news URLs carry the headline: /world/israel-strikes-lebanon-kills-five-2026-11-14/
const slugCache = new Map();
export function slugOf(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  let best = '';
  for (const seg of u.pathname.split('/')) {
    const words = seg.replace(/\.(html?|php|aspx?|shtml|cms|ece|story)$/i, '').split(/[-_+]/).filter((w) => /^[a-z]{2,}$/i.test(w));
    if (words.length >= 4) {
      const text = words.join(' ').toLowerCase();
      if (text.length > best.length) best = text;
    }
  }
  return { domain: u.hostname.replace(/^www\./, ''), text: best };
}

// ---- one file -> one slot ----------------------------------------------------

// Actor types that can make a state-level event. Blank means "the country itself".
const STATE_TYPES = new Set(['', 'GOV', 'MIL', 'SPY', 'REB', 'INS', 'UAF', 'SEP', 'LEG']);
const ARMED_TYPES = new Set(['MIL', 'REB', 'INS', 'UAF', 'SEP']);
// Countries whose local news floods the English feed. A "fight" located there only counts for the map
// when a foreign state is involved; otherwise it is almost always a crime story or a figure of speech.
const HOME_FRONT = new Set(['US', 'UK', 'CA', 'AS', 'EI', 'NZ']);

// Column positions in the GDELT 2.0 event export.
const C = { a1: 7, a1type: 12, a2: 17, a2type: 22, code: 26, root: 28, quad: 29, geoType: 51, geoName: 52, geoFips: 53, lat: 56, lon: 57, url: 60 };

// text: the CSV. english: whether headline slugs are worth reading (they are not for translated feeds).
// Slot fields (kept short because 192 of these live in the state file):
//   n events · c [force, hands, material, talk, threats, posture, wmd] state-vs-state event counts
//   d matchups {"IRN-USA": [talk, threats, posture, hands]} as distinct articles
//   g hot spots [[lat, lon, articles, name, fips]] · s slug counts [urls, slugged, t1..t5, calm, nuke]
//   x hot slugs [[tier, calm, nuke, domain, text, url]]
export function ingest(text, english) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  const dyads = new Map();
  const dirs = new Map(); // same counts split by who acted: [first side acting x4, second side acting x4]
  const spots = new Map();
  const urls = new Set();
  let n = 0;

  for (const line of text.split('\n')) {
    const r = line.split('\t');
    if (r.length !== 61) continue;
    n++;
    const url = r[C.url], root = r[C.root], code = r[C.code], quad = r[C.quad];
    const a = r[C.a1], b = r[C.a2];
    urls.add(url);
    const inter = a && b && a !== b && STATE_TYPES.has(r[C.a1type]) && STATE_TYPES.has(r[C.a2type]) &&
      !isRegionCode(a) && !isRegionCode(b);
    const hands = root === '18' || root === '19' || root === '20';
    const armed = ARMED_TYPES.has(r[C.a1type]) || ARMED_TYPES.has(r[C.a2type]);

    if (inter && (quad === '3' || quad === '4') && root !== '14') {
      const force = root === '19' || root === '20';
      const posture = root === '15' || root === '16' || root === '17';
      const threat = root === '13';
      if (force) c[0]++;
      if (hands) c[1]++;
      if (hands || posture) c[2]++;
      if (quad === '3') c[3]++;
      if (threat) c[4]++;
      if (root === '15' || code.startsWith('138') || code === '139') c[5]++;
      if (root === '20' || code === '1385') c[6]++;
      const key = dyadKey(a, b);
      let sets = dyads.get(key);
      if (!sets) dyads.set(key, (sets = [new Set(), new Set(), new Set(), new Set()]));
      const cat = hands ? 3 : posture ? 2 : threat ? 1 : 0;
      sets[cat].add(url);
      let dir = dirs.get(key);
      if (!dir) dirs.set(key, (dir = Array.from({ length: 8 }, () => new Set())));
      dir[(a < b ? 0 : 4) + cat].add(url); // dyadKey puts the alphabetically first code first
    }

    // Where force is reported, for the map. Needs a real place (city or province), not a country centroid,
    // and either an armed actor or two different countries, which drops most local crime.
    const gt = r[C.geoType];
    const place = hands && (gt === '3' || gt === '4' || gt === '5') && r[C.lat];
    if (place && (HOME_FRONT.has(r[C.geoFips]) ? inter : (armed || inter) && (root !== '18' || armed))) {
      const lat = Number(r[C.lat]), lon = Number(r[C.lon]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const key = `${Math.round(lat)},${Math.round(lon)}`;
        let s = spots.get(key);
        if (!s) spots.set(key, (s = { lat, lon, urls: new Set(), names: new Map(), fips: r[C.geoFips] }));
        s.urls.add(url);
        s.names.set(r[C.geoName], (s.names.get(r[C.geoName]) || 0) + 1);
      }
    }
  }

  const slot = { n, c, d: {}, g: [] };
  for (const [key, sets] of dyads) slot.d[key] = sets.map((s) => s.size);
  slot.o = {};
  for (const [key, sets] of dirs) slot.o[key] = sets.map((s) => s.size);
  slot.g = [...spots.values()]
    .sort((x, y) => y.urls.size - x.urls.size)
    .slice(0, 40)
    .map((s) => [
      Math.round(s.lat * 10) / 10, Math.round(s.lon * 10) / 10, s.urls.size,
      [...s.names].sort((x, y) => y[1] - x[1])[0][0], s.fips,
    ]);

  if (english) {
    const s = [urls.size, 0, 0, 0, 0, 0, 0, 0, 0];
    const hot = [];
    const find = [];
    for (const url of urls) {
      let hit = slugCache.get(url);
      if (hit === undefined) {
        const slug = slugOf(url);
        hit = slug && slug.text ? { ...slug, ...classify(slug.text) } : null;
        if (slugCache.size > 20000) slugCache.clear();
        slugCache.set(url, hit);
      }
      if (!hit) continue;
      s[1]++;
      if (hit.tier) s[1 + hit.tier]++;
      if (hit.calm) s[7]++;
      if (hit.nuke && !hit.calm) s[8]++; // nuclear talk that is not diplomacy
      if (hit.tier >= 3 || hit.nuke) hot.push([hit.tier, hit.calm ? 1 : 0, hit.nuke ? 1 : 0, hit.domain, hit.text, url]);
      if (hit.tier >= 1 || hit.nuke) find.push([hit.tier, hit.calm ? 1 : 0, hit.domain, hit.text, url]);
    }
    slot.s = s;
    slot.x = hot.sort((x, y) => y[0] - x[0]).slice(0, MAX_HOT_PER_SLOT);
    slot.w = find.sort((x, y) => y[0] - x[0]).slice(0, MAX_SEARCH_PER_SLOT);
  }
  return slot;
}

// ---- keeping the last 24 hours up to date -------------------------------------

export function stamp(ms) {
  return new Date(ms).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}
export function stampToMs(ts) {
  return Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10), +ts.slice(10, 12));
}

// store: { en: {ts: slot|0}, tr: {ts: slot|0} }  (0 = file never appeared; stop asking)
// getBuffer(url) -> Buffer, or null on 404. Returns how many files were fetched and how many failed.
export async function refresh(store, latestTs, getBuffer, { concurrency = 12, now = Date.now() } = {}) {
  store.en ||= {};
  store.tr ||= {};
  const latest = stampToMs(latestTs);
  const want = [];
  for (let i = 0; i < KEEP_SLOTS; i++) {
    const ts = stamp(latest - i * SLOT_MS);
    for (const feed of ['en', 'tr']) {
      const have = store[feed][ts];
      // English slots saved before keyword search existed lack `w`; fetch those again once.
      if (have === undefined || (feed === 'en' && have && !have.w)) want.push({ ts, feed });
    }
  }
  let fetched = 0, failed = 0;
  let next = 0;
  async function worker() {
    while (next < want.length) {
      const { ts, feed } = want[next++];
      const name = feed === 'en' ? `${ts}.export.CSV.zip` : `${ts}.translation.export.CSV.zip`;
      try {
        const buf = await getBuffer(`${GDELT_BASE}/${name}`);
        if (buf) {
          store[feed][ts] = ingest(unzipFirst(buf).toString('utf8'), feed === 'en');
          fetched++;
        } else if (now - stampToMs(ts) > 2 * 3600000) {
          store[feed][ts] = 0; // two hours on and still missing: GDELT skipped it
        }
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  // Drop what has aged out, and the bulky slug lists once they are past six hours.
  const keepFrom = stamp(latest - (KEEP_SLOTS - 1) * SLOT_MS);
  const hotFrom = stamp(latest - (HOT_SLOTS - 1) * SLOT_MS);
  for (const feed of ['en', 'tr']) {
    for (const ts of Object.keys(store[feed])) {
      if (ts < keepFrom || ts > latestTs) delete store[feed][ts];
      else if (ts < hotFrom && store[feed][ts]) delete store[feed][ts].x;
    }
  }
  store.latest = latestTs;
  return { fetched, failed, wanted: want.length };
}

// ---- adding slots up -----------------------------------------------------------

// Everything in the last `hours`, English and translated together.
export function windowStats(store, hours) {
  const out = {
    hours: 0, n: 0, c: [0, 0, 0, 0, 0, 0, 0], dyads: new Map(), dirs: new Map(), spots: new Map(),
    slug: [0, 0, 0, 0, 0, 0, 0, 0, 0], hot: [], find: [],
  };
  if (!store?.latest) return out;
  const from = stamp(stampToMs(store.latest) - (hours * 4 - 1) * SLOT_MS);
  for (const feed of ['en', 'tr']) {
    for (const [ts, slot] of Object.entries(store[feed] || {})) {
      if (!slot || ts < from) continue;
      if (feed === 'en') out.hours += 0.25;
      out.n += slot.n;
      slot.c.forEach((v, i) => (out.c[i] += v));
      for (const [key, v] of Object.entries(slot.d)) {
        const cur = out.dyads.get(key) || [0, 0, 0, 0];
        v.forEach((x, i) => (cur[i] += x));
        out.dyads.set(key, cur);
      }
      for (const [key, v] of Object.entries(slot.o || {})) {
        const cur = out.dirs.get(key) || [0, 0, 0, 0, 0, 0, 0, 0];
        v.forEach((x, i) => (cur[i] += x));
        out.dirs.set(key, cur);
      }
      for (const [lat, lon, count, name, fips] of slot.g) {
        const key = `${Math.round(lat)},${Math.round(lon)}`;
        const cur = out.spots.get(key) || { lat, lon, count: 0, name, top: 0, fips };
        cur.count += count;
        if (count > cur.top) { cur.top = count; cur.name = name; cur.lat = lat; cur.lon = lon; }
        out.spots.set(key, cur);
      }
      if (slot.s) slot.s.forEach((v, i) => (out.slug[i] += v));
      if (slot.w) for (const x of slot.w) out.find.push({ tier: x[0], calm: !!x[1], source: x[2], title: x[3], url: x[4], time: stampToMs(ts) });
      if (slot.x) for (const x of slot.x) out.hot.push({ tier: x[0], calm: !!x[1], nuke: !!x[2], source: x[3], title: x[4], url: x[5], time: stampToMs(ts) });
    }
  }
  return out;
}

export const pct = (part, whole) => (whole ? (100 * part) / whole : 0);
