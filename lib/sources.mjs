// One fetcher per public feed. Each returns plain data or throws; collect.mjs records what failed
// so the page can show it. No API keys anywhere.

const UA = 'Mozilla/5.0 (compatible; we-beefin-index/2.0)';

async function get(url, { timeout = 20000 } = {}) {
  return fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(timeout) });
}
async function getOk(url, opts) {
  const res = await get(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}
// For GDELT files: a missing file is normal (not published yet), so 404 comes back as null.
export async function getBuffer(url) {
  const res = await get(url, { timeout: 30000 });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- News feeds ----------------------------------------------------------------
// kind 'front': general world desks. The share of their stories that is about fighting drives the front-page score.
// kind 'beat':  defense desks and regional papers. They sharpen the story list and regional heat, but are
//               all-conflict by design, so they are left out of the front-page mix.
// To add an outlet, add a line. Any RSS or Atom feed works.

export const FEEDS = [
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
  { outlet: 'BBC', kind: 'front', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
  { outlet: 'Al Jazeera', kind: 'front', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { outlet: 'The Guardian', kind: 'front', url: 'https://www.theguardian.com/world/rss' },
  { outlet: 'NPR', kind: 'front', url: 'https://feeds.npr.org/1004/rss.xml' },
  { outlet: 'France 24', kind: 'front', url: 'https://www.france24.com/en/rss' },
  { outlet: 'DW', kind: 'front', url: 'https://rss.dw.com/rdf/rss-en-world' },
  { outlet: 'Sky News', kind: 'front', url: 'https://feeds.skynews.com/feeds/rss/world.xml' },
  { outlet: 'New York Times', kind: 'front', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { outlet: 'Defense News', kind: 'beat', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml' },
  { outlet: 'Breaking Defense', kind: 'beat', url: 'https://breakingdefense.com/feed/' },
  { outlet: 'The War Zone', kind: 'beat', url: 'https://www.twz.com/feed' },
  { outlet: 'USNI News', kind: 'beat', url: 'https://news.usni.org/feed' },
  { outlet: 'Times of Israel', kind: 'beat', url: 'https://www.timesofisrael.com/feed/' },
  { outlet: 'Kyiv Independent', kind: 'beat', url: 'https://kyivindependent.com/news-archive/rss/' },
  { outlet: 'Yonhap', kind: 'beat', url: 'https://en.yna.co.kr/RSS/news.xml' },
  { outlet: 'UN News', kind: 'beat', url: 'https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml' },
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(lt|gt);/g, (m, n) => ENTITIES[n])
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
function tag(block, ...names) {
  for (const name of names) {
    const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
    if (m && m[1].trim()) return decode(m[1]);
  }
  return '';
}

// Handles RSS 2.0 (<item>, <pubDate>), RDF (<item>, <dc:date>) and Atom (<entry>, <link href>, <updated>).
export function parseFeed(xml) {
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/g)) {
    const block = m[0];
    const title = tag(block, 'title');
    let url = tag(block, 'link');
    if (!url) {
      const href = block.match(/<link\b(?![^>]*rel=["'](?:self|edit|enclosure)["'])[^>]*href=["']([^"']+)["']/);
      url = href ? decode(href[1]) : '';
    }
    const time = Date.parse(tag(block, 'pubDate', 'dc:date', 'published', 'updated'));
    if (!title || !/^https?:\/\//.test(url) || !Number.isFinite(time)) continue;
    items.push({ title, url, time });
  }
  return items;
}

export async function fetchFeed(feed) {
  return parseFeed(await (await getOk(feed.url)).text());
}

// ---- GDELT ---------------------------------------------------------------------

export async function fetchGdeltLatest(base) {
  const text = await (await getOk(`${base}/lastupdate.txt`)).text();
  const m = text.match(/(\d{14})\.export\.CSV\.zip/);
  if (!m) throw new Error('no file listed');
  return m[1];
}

// ---- Earth and sky (shown, never counted in the index) ---------------------------

export async function fetchQuakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';
  const data = await (await getOk(url)).json();
  return (data.features || []).map((f) => ({
    title: f.properties.title, mag: f.properties.mag, time: f.properties.time, url: f.properties.url,
  }));
}

// USGS labels underground nuclear tests in its catalog (it did for North Korea's in 2016 and 2017).
export async function fetchNukeTests(now, days = 30) {
  const start = new Date(now - days * 86400000).toISOString().slice(0, 10);
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=nuclear%20explosion&starttime=${start}`;
  const data = await (await getOk(url)).json();
  return (data.features || []).map((f) => ({
    title: f.properties.title, mag: f.properties.mag, time: f.properties.time, url: f.properties.url,
  }));
}

export async function fetchKp() {
  const rows = await (await getOk('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')).json();
  // The feed has shipped both as an array of objects and as a header-row table.
  const parsed = rows
    .map((r) => (Array.isArray(r) ? { t: r[0], kp: Number(r[1]) } : { t: r.time_tag, kp: Number(r.Kp) }))
    .filter((r) => Number.isFinite(r.kp));
  if (!parsed.length) throw new Error('no readings');
  const last = parsed[parsed.length - 1];
  return { kp: last.kp, max24h: Math.max(...parsed.slice(-8).map((r) => r.kp)), time: Date.parse(String(last.t).replace(' ', 'T') + 'Z') };
}

// ---- Optional extras -------------------------------------------------------------
// These three could not be reached from the machine this was built on, so they are written against the
// services' documented formats and checked with fixtures in test/. If one fails, its panel simply hides.

// Military aircraft currently broadcasting, from the volunteer ADS-B network adsb.lol.
export const BIRDS = [
  { id: 'doomsday', name: 'Doomsday planes', what: 'flying nuclear command posts (E-4B, E-6B)', re: /^(E6|E4|E4B)$/ },
  { id: 'bombers', name: 'Bombers', what: 'B-52, B-1, B-2', re: /^(B52|B1|B2)$/ },
  { id: 'tankers', name: 'Gas stations', what: 'air-refuelling tankers', re: /^(K35[A-Z]?|KC?46[A-Z]?|KC10|KC3[0-9]|K767|MRTT|A332|A310)$/ },
  { id: 'snoops', name: 'Snoops', what: 'spy, radar and patrol planes', re: /^(R135|E3TF|E3CF|E3|P8|Q4|U2|E737|E8)$/ },
  { id: 'movers', name: 'Movers', what: 'heavy airlift (C-17, C-5, A400M)', re: /^(C17|C5M?|A400)$/ },
];
const E4B_TAILS = /^7[345]-/; // the four E-4Bs are 73-1676, 73-1677, 74-0787, 75-0125
function skyRegion(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'position hidden';
  if (lat >= 12 && lat <= 42 && lon >= 25 && lon <= 63) return 'Middle East';
  if (lat >= 35 && lat <= 72 && lon >= -12 && lon <= 45) return 'Europe';
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) return 'the US';
  if (lat >= -10 && lat <= 55 && (lon >= 95 || lon <= -140)) return 'the Pacific';
  if (lon > -66 && lon < -12 && lat > 0) return 'the Atlantic';
  return 'elsewhere';
}
export function summarizeAircraft(list) {
  const groups = BIRDS.map((b) => ({ id: b.id, name: b.name, what: b.what, n: 0, where: {} }));
  const notable = [];
  let airborne = 0;
  for (const ac of list || []) {
    if (!ac || ac.alt_baro === 'ground' || ac.alt_baro == null) continue;
    airborne++;
    const type = String(ac.t || '').toUpperCase();
    let i = BIRDS.findIndex((b) => b.re.test(type));
    if (type === 'B742' && E4B_TAILS.test(String(ac.r || ''))) i = 0; // E-4B reports as a 747-200
    if (i < 0) continue;
    const region = skyRegion(Number(ac.lat), Number(ac.lon));
    groups[i].n++;
    groups[i].where[region] = (groups[i].where[region] || 0) + 1;
    if (i <= 1 && notable.length < 8) notable.push({ kind: BIRDS[i].name, type, callsign: String(ac.flight || '').trim() || String(ac.r || ''), region });
  }
  return { airborne, groups, notable, strategic: groups[0].n + groups[1].n + groups[2].n };
}
// Two volunteer receiver networks, adsb.lol and adsb.fi, see different planes. Merging them (one entry per
// transponder code) covers more sky than either alone, and one network being down is not fatal.
export const SKY_FEEDS = [
  { name: 'adsb.lol', url: 'https://api.adsb.lol/v2/mil' },
  { name: 'adsb.fi', url: 'https://opendata.adsb.fi/api/v2/mil' },
];
export function mergeAircraft(lists) {
  const byHex = new Map();
  for (const list of lists) for (const ac of list || []) {
    if (!ac) continue;
    const key = ac.hex || `${ac.r}-${ac.flight}`;
    if (!byHex.has(key)) byHex.set(key, ac);
  }
  return [...byHex.values()];
}
export async function fetchSky() {
  const got = await Promise.allSettled(SKY_FEEDS.map(async (f) => {
    const data = await (await getOk(f.url)).json();
    if (!Array.isArray(data.ac)) throw new Error('unexpected response');
    return data.ac;
  }));
  const ok = got.map((g, i) => (g.status === 'fulfilled' ? SKY_FEEDS[i].name : null)).filter(Boolean);
  if (!ok.length) throw new Error(String(got[0].reason?.message || 'no feed answered'));
  return { ...summarizeAircraft(mergeAircraft(got.map((g) => (g.status === 'fulfilled' ? g.value : [])))), feeds: ok };
}

// ---- Reddit ------------------------------------------------------------------------
// Reddit's JSON API refuses servers, but its public RSS still answers. One combined feed, one request,
// because Reddit rate-limits hard. Shown and searchable, never scored: titles are written by users.
export const SUBREDDITS = ['worldnews', 'geopolitics', 'CredibleDefense', 'UkrainianConflict', 'CombatFootage'];
export function parseReddit(xml) {
  return parseFeed(xml).map((it) => {
    const sub = (it.url.match(/reddit\.com\/r\/([\w]+)\//) || [])[1] || 'reddit';
    return { ...it, sub };
  }).filter((it) => /^https:\/\/(www\.|old\.)?reddit\.com\//.test(it.url));
}
export async function fetchReddit() {
  const url = `https://www.reddit.com/r/${SUBREDDITS.join('+')}/new/.rss?limit=100`;
  const items = parseReddit(await (await getOk(url)).text());
  if (!items.length) throw new Error('empty feed');
  return items;
}

// Wall Street's fear gauge and the oil price, from the St. Louis Fed's public CSV download (daily closes).
export function parseFredCsv(csv) {
  return csv
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(','))
    .filter((r) => r.length === 2 && r[1] !== '.' && Number.isFinite(Number(r[1])) && /^\d{4}-\d\d-\d\d$/.test(r[0]))
    .map((r) => ({ date: r[0], value: Number(r[1]) }));
}
async function fredSeries(id, now) {
  const start = new Date(now - 60 * 86400000).toISOString().slice(0, 10);
  const rows = parseFredCsv(await (await getOk(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`)).text());
  if (rows.length < 6) throw new Error('too few rows');
  return rows;
}
export function quoteFrom(rows, lo, hi) {
  const last = rows[rows.length - 1], back = rows[rows.length - 6];
  if (!(last.value >= lo && last.value <= hi)) throw new Error('value out of range');
  return {
    price: last.value, date: last.date,
    change5d: Math.round(((last.value - back.value) / back.value) * 1000) / 10,
    spark: rows.slice(-30).map((r) => r.value),
  };
}
export async function fetchMoney(now) {
  const [vix, oil] = await Promise.allSettled([fredSeries('VIXCLS', now), fredSeries('DCOILBRENTEU', now)]);
  const out = {};
  if (vix.status === 'fulfilled') out.vix = quoteFrom(vix.value, 5, 150);
  if (oil.status === 'fulfilled') out.oil = quoteFrom(oil.value, 5, 400);
  if (!out.vix && !out.oil) throw new Error(String(vix.reason?.message || oil.reason?.message || 'no data'));
  return out;
}

// US State Department travel advisories. Level 4 is "Do Not Travel".
export function parseAdvisories(xml, now) {
  const all = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const block = m[0];
    const title = tag(block, 'title');
    const lv = (title + ' ' + block).match(/Level\s*([1-4])/);
    const country = title.split(/\s+[-–]\s+/)[0].replace(/\s+Travel Advisory$/i, '').trim();
    if (!lv || !country) continue;
    const url = tag(block, 'link');
    all.push({ country, level: Number(lv[1]), time: Date.parse(tag(block, 'pubDate')) || null, url: /^https?:\/\//.test(url) ? url : null });
  }
  if (!all.length) throw new Error('no advisories found');
  const recent = (days) => (a) => a.time && now - a.time < days * 86400000;
  return {
    total: all.length,
    doNotTravel: all.filter((a) => a.level === 4).map((a) => a.country).sort(),
    reconsider: all.filter((a) => a.level === 3).length,
    fresh: all.filter((a) => a.level >= 3).filter(recent(14)).sort((a, b) => b.time - a.time).slice(0, 8),
    newLevel4: all.filter((a) => a.level === 4).filter(recent(7)).length,
  };
}
export async function fetchAdvisories(now) {
  return parseAdvisories(await (await getOk('https://travel.state.gov/_res/rss/TAsTWs.xml')).text(), now);
}

// ---- OSINT channels on Telegram -------------------------------------------------
// Telegram serves a public web preview of every public channel at t.me/s/<name>: no key, no login.
// The list mixes outlets from different sides on purpose; several are partisan or state-linked.
// Posts are shown as-is and never counted in the index: they are fast, and often unverified.
// To add one, add its t.me name. Channels without a public preview, or that post mostly in other
// languages, simply show nothing.
export const TG_CHANNELS = [
  { name: 'clashreport', label: 'Clash Report' },
  { name: 'Middle_East_Spectator', label: 'Middle East Spectator' },
  { name: 'wartranslated', label: 'WarTranslated' },
  { name: 'bnonews', label: 'BNO News' },
  { name: 'warmonitors', label: 'War Monitor' },
  { name: 'AuroraIntel', label: 'Aurora Intel' },
  { name: 'osintdefender', label: 'OSINTdefender' },
  { name: 'idfofficial', label: 'IDF (official)' },
  { name: 'QudsNen', label: 'Quds News Network' },
  { name: 'rybar_in_english', label: 'Rybar (English)' },
  { name: 'intelslava', label: 'Intel Slava Z' },
];

// Mostly Latin letters, so the ticker stays readable. Russian, Ukrainian, Hebrew, Arabic posts are skipped.
function mostlyLatin(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length < 12) return false;
  return letters.filter((c) => /[A-Za-z]/.test(c)).length / letters.length >= 0.7;
}

export function parseTelegram(html, channel, now) {
  if (!/tgme_widget_message/.test(html)) throw new Error('no public preview');
  const posts = [];
  for (const m of html.matchAll(/<div class="tgme_widget_message [^"]*"[^>]*data-post="([\w]+)\/(\d+)"[\s\S]*?(?=<div class="tgme_widget_message_wrap|$)/g)) {
    const block = m[0];
    const [, user, id] = m;
    const time = Date.parse((block.match(/<time datetime="([^"]+)"/) || [])[1]);
    const raw = (block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
    const text = decode(raw.replace(/<br\s*\/?>/gi, ' ')).replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(time) || now - time > 24 * 3600000 || !mostlyLatin(text)) continue;
    posts.push({
      user: channel.label, handle: user,
      text: text.length > 240 ? text.slice(0, 237) + '…' : text,
      url: `https://t.me/${user}/${id}`, time,
    });
  }
  return posts;
}

export async function fetchTelegram(now) {
  const results = await Promise.allSettled(TG_CHANNELS.map(async (c) => {
    const res = await getOk(`https://t.me/s/${c.name}`, { timeout: 15000 });
    return parseTelegram(await res.text(), c, now).sort((a, b) => b.time - a.time);
  }));
  const report = TG_CHANNELS.map((c, i) => `${c.name}:${results[i].status === 'fulfilled' ? results[i].value.length : 'x'}`).join(' ');
  const all = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value).sort((a, b) => b.time - a.time);
  if (!all.length) throw new Error(`no recent English posts (${report})`);
  // The ticker gets at most four per channel so one busy channel cannot take it over; search gets everything.
  const perChannel = new Map();
  const posts = all.filter((p) => { const k = (perChannel.get(p.handle) || 0) + 1; perChannel.set(p.handle, k); return k <= 4; }).slice(0, 30);
  return { posts, all, report };
}
