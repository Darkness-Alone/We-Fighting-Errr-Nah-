// Fetchers for each public feed. Every fetcher returns plain data or throws;
// collect.mjs records which ones failed so the page can say so.

const UA = 'Mozilla/5.0 (compatible; osint-dashboard/1.0)';

async function get(url, { timeout = 20000 } = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ---- RSS -------------------------------------------------------------------

export const RSS_FEEDS = [
  { id: 'bbc', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
}

export function parseRss(xml, source) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const block = m[0];
    const title = tag(block, 'title');
    const url = tag(block, 'link');
    const time = Date.parse(tag(block, 'pubDate'));
    if (!title || !/^https?:\/\//.test(url) || !Number.isFinite(time)) continue;
    items.push({ title, url, time, source, summary: tag(block, 'description').slice(0, 300) });
  }
  return items;
}

export async function fetchRss(feed) {
  return parseRss(await (await get(feed.url)).text(), feed.name);
}

// ---- GDELT (optional, rate limited to one request per 5s) ------------------

export async function fetchGdelt() {
  const q = encodeURIComponent(
    '(airstrike OR missile OR invasion OR "military strike" OR "nuclear") sourcelang:english',
  );
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=40&sort=datedesc&timespan=24h`;
  const text = await (await get(url, { timeout: 25000 })).text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 60) || 'empty response');
  }
  return (data.articles || [])
    .map((a) => {
      const d = a.seendate || '';
      const time = Date.parse(
        `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`,
      );
      return { title: decode(a.title || ''), url: a.url, time, source: a.domain || 'GDELT', summary: '' };
    })
    .filter((a) => a.title && /^https?:\/\//.test(a.url || '') && Number.isFinite(a.time));
}

// ---- Natural hazards (shown, never counted in the index) -------------------

export async function fetchQuakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';
  const data = await (await get(url)).json();
  return (data.features || []).map((f) => ({
    title: f.properties.title,
    mag: f.properties.mag,
    time: f.properties.time,
    url: f.properties.url,
  }));
}

export async function fetchKp() {
  const url = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
  const rows = await (await get(url)).json();
  // Feed has shipped as both an array of objects and a header-row table.
  const parsed = rows
    .map((r) => (Array.isArray(r) ? { t: r[0], kp: Number(r[1]) } : { t: r.time_tag, kp: Number(r.Kp) }))
    .filter((r) => Number.isFinite(r.kp));
  if (!parsed.length) throw new Error('no readings');
  const last = parsed[parsed.length - 1];
  const max24 = Math.max(...parsed.slice(-8).map((r) => r.kp));
  return { kp: last.kp, max24h: max24, time: Date.parse(last.t.replace(' ', 'T') + 'Z') };
}
