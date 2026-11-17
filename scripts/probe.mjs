// Temporary: checks which candidate sources answer from GitHub's servers.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; we-beefin-index/2.0)', accept: '*/*' };
const urls = [
  'https://api.pullpush.io/reddit/search/submission/?subreddit=worldnews&size=5&sort=desc&sort_type=created_utc',
  'https://www.reddit.com/r/worldnews/new.json?limit=5',
  'https://www.reddit.com/r/worldnews/new/.rss',
  'https://old.reddit.com/r/worldnews/new/.rss',
  'https://www.reddit.com/r/CredibleDefense/new/.rss',
  'https://liveuamap.com/rss',
  'https://liveuamap.com/',
  'https://ground.news/',
  'https://ground.news/rss',
  'https://api.airplanes.live/v2/mil',
  'https://opendata.adsb.fi/api/v2/mil',
  'https://globe.adsbexchange.com/',
  'https://www.flightradar24.com/',
  'https://acleddata.com/api/acled/read?limit=1',
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    console.log('PROBE', r.status, t.length, u, '|', t.slice(0, 140).replace(/\s+/g, ' '));
  } catch (e) { console.log('PROBE ERR', u, e.cause?.code || e.message); }
}
