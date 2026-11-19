// Features built on top of a reading: the daily archive (streaks, the record book, card changes),
// Press Conference quotes, and the Cutman / Training Camp lists. Pure functions over data the collector
// already has. Nothing here feeds back into the index or TheseHandsCon.

import { countriesIn, countryName, mentionAt, theaterOfText, THEATERS, OTHER_THEATER } from './geo.mjs';
import { signals, norm } from './classify.mjs';

const HOUR = 3600000;
export const dayOf = (t) => new Date(t).toISOString().slice(0, 10); // UTC calendar day
const nextDay = (d) => dayOf(Date.parse(d + 'T12:00:00Z') + 24 * HOUR);
const statusAt = (i, statuses) => (statuses.find((s) => i < s.max) || statuses[statuses.length - 1]).key;

// ---- whose press is this --------------------------------------------------------
// curated.json maps feed outlets and web domains to the country whose domestic press they are.
export function homeOf(source, url, curated) {
  if (curated.outlets[source]) return curated.outlets[source];
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { host = String(source || ''); }
  for (const [domain, code] of Object.entries(curated.domains)) if (host === domain || host.endsWith('.' + domain)) return code;
  return curated.tld[host.split('.').pop()] || null;
}

// Search rows: [time, kind, source, title, url, tier, calm] + [countries named, home press].
export function tagRow(r, curated) {
  if (r.length >= 9) return r;
  return [...r.slice(0, 7), countriesIn(r[3]).join(','), homeOf(r[2], r[4], curated) || ''];
}

// ---- the daily archive ----------------------------------------------------------
// One entry per UTC day, overwritten by every reading that day, so the last reading of a day is its record.
// { d, i: index, hi, lo, s: status key, c: TheseHandsCon, card: [[key, a, b, talk, flex, hands, rung], ...] }
export function seedDays(history, statuses) {
  const days = new Map();
  for (const p of history || []) {
    if (p.i == null) continue;
    const d = dayOf(p.t), e = days.get(d) || { d, i: p.i, hi: p.i, lo: p.i, s: null, c: p.c ?? null, card: null };
    e.i = p.i; e.hi = Math.max(e.hi, p.i); e.lo = Math.min(e.lo, p.i); e.c = p.c ?? e.c; e.s = statusAt(p.i, statuses);
    days.set(d, e);
  }
  return [...days.values()];
}

export function updateDays(days, now, { index, status, con, card }, keep = 400) {
  const d = dayOf(now);
  const out = (days || []).filter((e) => e.d !== d);
  const prev = (days || []).find((e) => e.d === d);
  out.push({
    d, i: index, hi: Math.max(index, prev?.hi ?? index), lo: Math.min(index, prev?.lo ?? index), s: status, c: con ?? null,
    card: card.map((m) => [m.key, m.a, m.b, m.talk, m.flex, m.hands, m.rung]),
  });
  return out.sort((x, y) => (x.d < y.d ? -1 : 1)).slice(-keep);
}

// Runs of consecutive days at the same status, oldest first.
function runs(days) {
  const out = [];
  for (const e of days) {
    const last = out[out.length - 1];
    if (last && last.s === e.s && nextDay(last.to) === e.d) { last.to = e.d; last.days++; }
    else out.push({ s: e.s, from: e.d, to: e.d, days: 1 });
  }
  return out;
}

// How many days in a row the index has closed at the current status, counting today.
export function streak(days, statusKey, now) {
  const r = runs(days).pop();
  if (!r || r.to !== dayOf(now) || r.s !== statusKey) return { days: 1, since: dayOf(now), status: statusKey };
  return { days: r.days, since: r.from, status: statusKey };
}

export function records(days, statuses, now) {
  if (!days.length) return null;
  const hi = days.reduce((a, e) => (e.hi > a.hi ? e : a));
  const lo = days.reduce((a, e) => (e.lo < a.lo ? e : a));
  const longest = statuses.map((st) => {
    const best = runs(days).filter((r) => r.s === st.key).sort((x, y) => y.days - x.days || (x.to < y.to ? 1 : -1))[0];
    return { status: st.key, label: st.label, ...(best ? { days: best.days, from: best.from, to: best.to } : { days: 0 }) };
  });
  const today = dayOf(now);
  const onThisDay = days.filter((e) => e.d.slice(5) === today.slice(5) && e.d < today)
    .map((e) => ({ d: e.d, i: e.i, s: e.s, c: e.c, main: e.card && e.card[0] ? `${e.card[0][1]} vs ${e.card[0][2]}` : null }));
  const mains = new Map();
  for (const e of days) if (e.card && e.card[0]) {
    const [key, a, b] = e.card[0], m = mains.get(key) || { key, name: `${a} vs ${b}`, days: 0 };
    m.days++; mains.set(key, m);
  }
  return {
    since: days[0].d, tracked: days.length,
    high: { i: hi.hi, d: hi.d }, low: { i: lo.lo, d: lo.d },
    longest, onThisDay,
    mostMain: [...mains.values()].sort((x, y) => y.days - x.days).slice(0, 3),
  };
}

// Who debuted on today's card and who fell off, against the last earlier day with a card.
export function cardChanges(days, now, shown = 8) {
  const today = days.find((e) => e.d === dayOf(now));
  const prev = days.filter((e) => e.d < dayOf(now) && e.card && e.card.length).pop();
  if (!today || !today.card) return null;
  if (!prev) return { first: true, since: today.d };
  const top = (e) => e.card.slice(0, shown);
  const keys = (e) => new Set(top(e).map((m) => m[0]));
  const name = (m) => ({ key: m[0], name: `${m[1]} vs ${m[2]}`, rung: m[6] });
  const was = keys(prev), now2 = keys(today);
  return {
    first: false, vs: prev.d,
    debuts: top(today).filter((m) => !was.has(m[0])).map(name),
    dropped: top(prev).filter((m) => !now2.has(m[0])).map(name),
    newMain: today.card[0] && prev.card[0] && today.card[0][0] !== prev.card[0][0] ? { now: name(today.card[0]), was: name(prev.card[0]) } : null,
  };
}

// ---- Press Conference -------------------------------------------------------------
// The pipeline has headlines and channel posts, not article text, so a "statement" is a headline or post
// where one side is named first and then speaks: "Zelensky says...", "Iran warns...", "Kremlin: ...".
const SPEECH = /\b(says?|said|warns?|warned|vows?|vowed|threatens?|threatened|claims?|claimed|accuses?|accused|tells?|told|insists?|denies|denied|slams?|blasts?|urges?|demands?|rejects?|pledges?|declares?|calls? on|responds?|hits back|condemns?)\b|[“"]|:\s/i;
const PASSIVE = /\b(accused of|charged with|said to|told to|claimed by|blamed for|suspected of)\b/i;
export function pressers(card, rows, now, hours = 48) {
  const out = {};
  const recent = rows.filter((r) => now - r[0] < hours * HOUR && r[1] !== 'reddit');
  for (const m of card) {
    const pick = (me, them) => {
      let best = null, bestScore = -Infinity;
      for (const r of recent) {
        const codes = (r[7] || '').split(',');
        if (!codes.includes(me) || !codes.includes(them)) continue;
        const text = r[3], verb = SPEECH.exec(text);
        if (!verb) continue;
        const at = mentionAt(text, me), other = mentionAt(text, them);
        // This side has to be the one talking, near the start: "Zelensky says", "Iran's foreign ministry warns".
        if (at < 0 || at > 30 || verb.index < at || verb.index - at > 45 || (other >= 0 && other < at)) continue;
        if (PASSIVE.test(text.slice(0, verb.index + 20))) continue;
        const score = 3 * (r[5] || 0) + (/[“"]/.test(text) ? 2 : 0) + (r[1] === 'osint' ? -1 : 1) - (now - r[0]) / (12 * HOUR);
        if (score > bestScore) { bestScore = score; best = r; }
      }
      return best && { text: best[3].length > 240 ? best[3].slice(0, 237) + '…' : best[3], url: best[4], source: best[2], time: best[0], kind: best[1] };
    };
    const a = pick(m.ca, m.cb), b = pick(m.cb, m.ca);
    if (a || b) out[m.key] = { a, b };
  }
  return out;
}

// ---- The Cutman and Training Camp ----------------------------------------------------
const THEATER_NAME = Object.fromEntries([...THEATERS, OTHER_THEATER].map((t) => [t.id, t.name]));
// A de-escalation find has to touch a matchup on today's card (or undercard), or read as an outright
// calm-down headline ("ceasefire agreed"). Talks between friends are not a cutman's business.
export function cornerLists(rows, now, { hours = 24, limit = 12, pairs = [] } = {}) {
  const onCard = (codes) => pairs.some((p) => codes.includes(p[0]) && codes.includes(p[1]));
  const lists = { cut: [], camp: [] }, seen = { cut: new Set(), camp: new Set() }, per = new Map();
  for (const r of rows) {
    if (now - r[0] > hours * HOUR || r[1] === 'reddit') continue;
    const sig = signals(r[3]);
    for (const k of ['cut', 'camp']) {
      if (!sig[k] || lists[k].length >= limit) continue;
      const codes = (r[7] || '').split(',').filter(Boolean);
      if (k === 'cut' && !(r[6] && r[5] >= 2) && !onCard(codes)) continue;
      const key = norm(r[3]).slice(0, 60), kind = k + sig[k];
      if (seen[k].has(key) || (per.get(kind) || 0) >= 4) continue; // no single kind of find takes over the list
      per.set(kind, (per.get(kind) || 0) + 1);
      seen[k].add(key);
      const where = codes.length ? codes.slice(0, 3).map(countryName).join(', ') : THEATER_NAME[theaterOfText(r[3])];
      lists[k].push({ title: r[3].length > 200 ? r[3].slice(0, 197) + '…' : r[3], url: r[4], source: r[2], time: r[0], kind: r[1], what: sig[k], where });
    }
  }
  return lists;
}
