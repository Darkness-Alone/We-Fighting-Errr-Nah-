import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, summarizeAircraft, parseFredCsv, quoteFrom, parseAdvisories, FEEDS } from '../lib/sources.mjs';

test('RSS 2.0: CDATA, entities, junk links', () => {
  const items = parseFeed(`<rss><channel>
    <item><title><![CDATA[Tom & Jerry's "truce"]]></title><link>https://example.com/a?x=1&amp;y=2</link><pubDate>Fri, 13 Nov 2026 23:40:45 GMT</pubDate></item>
    <item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Fri, 13 Nov 2026 23:40:45 GMT</pubDate></item>
    <item><title>No date</title><link>https://example.com/b</link></item>
  </channel></rss>`);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, `Tom & Jerry's "truce"`);
  assert.equal(items[0].url, 'https://example.com/a?x=1&y=2');
});

test('Atom and RDF feeds parse too', () => {
  const atom = parseFeed(`<feed><entry><title type="html">Atom &amp; Eve</title>
    <link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/atom"/>
    <updated>2026-11-13T10:00:00Z</updated></entry></feed>`);
  assert.deepEqual(atom.map((i) => [i.title, i.url]), [['Atom & Eve', 'https://example.com/atom']]);
  const rdf = parseFeed(`<rdf:RDF><item rdf:about="https://example.com/rdf"><title>RDF story</title>
    <link>https://example.com/rdf</link><dc:date>2026-11-13T10:00:00+01:00</dc:date></item></rdf:RDF>`);
  assert.equal(rdf.length, 1);
  assert.equal(rdf[0].time, Date.parse('2026-11-13T09:00:00Z'));
});

test('feed list is well formed', () => {
  for (const f of FEEDS) {
    assert.ok(/^https:\/\//.test(f.url), f.url);
    assert.ok(['front', 'beat'].includes(f.kind), f.outlet);
  }
  assert.equal(new Set(FEEDS.map((f) => f.url)).size, FEEDS.length);
});

// adsb.lol returns readsb-style aircraft objects: t = type code, r = registration, alt_baro = feet or "ground".
test('military aircraft are sorted into groups', () => {
  const sky = summarizeAircraft([
    { t: 'E6', flight: 'IRON99 ', alt_baro: 28000, lat: 41.1, lon: -95.9 },
    { t: 'B742', r: '73-1676', flight: 'TITAN25', alt_baro: 31000, lat: 39, lon: -104 }, // E-4B
    { t: 'B742', r: '82-8000', alt_baro: 30000, lat: 39, lon: -77 }, // Air Force One: not counted
    { t: 'B52', flight: 'DOOM11', alt_baro: 30000, lat: 52, lon: 1 },
    { t: 'K35R', alt_baro: 26000, lat: 30, lon: 45 },
    { t: 'K35R', alt_baro: 'ground', lat: 30, lon: 45 }, // parked
    { t: 'R135', alt_baro: 31000 }, // no position
    { t: 'C17', alt_baro: 30000, lat: 35, lon: 140 },
    { t: 'H60', alt_baro: 900, lat: 35, lon: -80 }, // helicopter: airborne but in no group
    null,
  ]);
  assert.equal(sky.airborne, 8);
  assert.deepEqual(sky.groups.map((g) => g.n), [2, 1, 1, 1, 1]);
  assert.equal(sky.strategic, 4);
  assert.deepEqual(sky.groups[2].where, { 'Middle East': 1 });
  assert.deepEqual(sky.groups[3].where, { 'position hidden': 1 });
  assert.deepEqual(sky.notable.map((n) => n.callsign), ['IRON99', 'TITAN25', 'DOOM11']);
  assert.equal(summarizeAircraft(undefined).airborne, 0);
});

test('FRED CSV: skips the header and missing days', () => {
  const rows = parseFredCsv('observation_date,VIXCLS\n2026-11-05,16.1\n2026-11-06,.\n2026-11-09,17.0\n2026-11-10,18.0\n2026-11-11,19.0\n2026-11-12,20.0\n2026-11-13,22.0\n');
  assert.equal(rows.length, 6);
  const q = quoteFrom(rows, 5, 150);
  assert.equal(q.price, 22);
  assert.equal(q.change5d, 36.6); // from 16.1 five trading days back
  assert.throws(() => quoteFrom(rows, 30, 150)); // out of the plausible range: refuse it
});

test('State Department advisories', () => {
  const now = Date.parse('2026-11-14T00:00:00Z');
  const a = parseAdvisories(`<rss><channel>
    <item><title>Iran - Level 4: Do Not Travel</title><link>https://travel.state.gov/iran</link><pubDate>Tue, 10 Nov 2026</pubDate></item>
    <item><title>Yemen - Level 4: Do Not Travel</title><link>https://travel.state.gov/yemen</link><pubDate>Mon, 02 Mar 2026</pubDate></item>
    <item><title>Egypt - Level 3: Reconsider Travel</title><link>https://travel.state.gov/egypt</link><pubDate>Mon, 09 Nov 2026</pubDate></item>
    <item><title>Japan - Level 1: Exercise Normal Precautions</title><link>https://travel.state.gov/japan</link><pubDate>Mon, 09 Nov 2026</pubDate></item>
  </channel></rss>`, now);
  assert.deepEqual(a.doNotTravel, ['Iran', 'Yemen']);
  assert.equal(a.reconsider, 1);
  assert.equal(a.newLevel4, 1);
  assert.deepEqual(a.fresh.map((f) => f.country), ['Iran', 'Egypt']);
  assert.throws(() => parseAdvisories('<rss></rss>', now));
});
