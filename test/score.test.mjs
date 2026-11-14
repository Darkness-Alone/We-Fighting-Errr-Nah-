import test from 'node:test';
import assert from 'node:assert/strict';
import * as sc from '../lib/score.mjs';
import { parseRss } from '../lib/sources.mjs';

test('headline tiers', () => {
  assert.equal(sc.scoreHeadline('North Korea conducts nuclear test').tier, 5);
  assert.equal(sc.scoreHeadline('Airstrike hits port city').tier, 3);
  assert.equal(sc.scoreHeadline('Setback for SpaceX Starship rocket test').tier, 0);
  assert.equal(sc.scoreHeadline('Bake sale raises record funds').tier, 0);
  assert.ok(sc.scoreHeadline('Ceasefire agreed after weeks of shelling').heat < sc.scoreHeadline('Weeks of shelling continue').heat);
});

test('old headlines stop counting', () => {
  const now = Date.now();
  const fresh = sc.scoreNews([{ title: 'Missile strikes kill dozens', time: now - 3600000 }], now).heat;
  const stale = sc.scoreNews([{ title: 'Missile strikes kill dozens', time: now - 72 * 3600000 }], now).heat;
  assert.ok(fresh > 0);
  assert.equal(stale, 0);
});

test('status bands and posture ladder', () => {
  assert.equal(sc.statusFor(0).label, 'We Cool');
  assert.equal(sc.statusFor(30).label, 'Why They Lookin At Me');
  assert.equal(sc.statusFor(60).label, 'Squared Up');
  assert.equal(sc.statusFor(85).label, 'Told Ya Too Watch Ya Mouth');
  assert.equal(sc.statusFor(100).label, 'Told Ya Too Watch Ya Mouth');
  assert.equal(sc.handsConFor(5).level, 5);
  assert.equal(sc.handsConFor(36).level, 4);
  assert.equal(sc.handsConFor(36, 0.3).level, 3);
  assert.equal(sc.handsConFor(95).level, 1);
  assert.equal(sc.handsConFor(95, 1).level, 1);
});

test('news score climbs with heat and is empty without headlines', () => {
  const now = Date.now();
  const h = (n) => Array.from({ length: n }, (_, i) => ({ title: `Airstrike hits city ${i}`, time: now - 3600000 }));
  const few = sc.scoreNews(h(2), now).score, many = sc.scoreNews(h(20), now).score;
  assert.ok(few < 30 && many > 80, `${few} / ${many}`);
  assert.equal(sc.scoreNews([], now).score, null);
});

test('beef clock runs from 12 minutes to midnight', () => {
  assert.equal(sc.beefClockSeconds(0), 720);
  assert.equal(sc.beefClockSeconds(100), 0);
  assert.ok(sc.beefClockSeconds(40) > sc.beefClockSeconds(60));
});

test('rss parsing handles CDATA, entities and junk links', () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Tom & Jerry's "truce"]]></title><link>https://example.com/a?x=1&amp;y=2</link><pubDate>Fri, 13 Nov 2026 23:40:45 GMT</pubDate><description>&lt;p&gt;Hi&lt;/p&gt;</description></item>
    <item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Fri, 13 Nov 2026 23:40:45 GMT</pubDate></item>
  </channel></rss>`;
  const items = parseRss(xml, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, `Tom & Jerry's "truce"`);
  assert.equal(items[0].url, 'https://example.com/a?x=1&y=2');
});
