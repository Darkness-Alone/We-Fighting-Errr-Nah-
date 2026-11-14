import test from 'node:test';
import assert from 'node:assert/strict';
import * as sc from '../lib/score.mjs';
import { parseRss, pickMarket } from '../lib/sources.mjs';

test('market classification picks direction and severity', () => {
  assert.deepEqual(sc.classifyMarket('Will China invade Taiwan by end of 2026?'), { kind: 'escalation', severity: 4 });
  assert.deepEqual(sc.classifyMarket('Iran Nuke before 2027?'), { kind: 'escalation', severity: 5 });
  assert.equal(sc.classifyMarket('Israel x Iran ceasefire continues through November 15?').kind, 'breakdown');
  assert.equal(sc.classifyMarket('Russia x Ukraine Ceasefire by December 31?').kind, 'thaw');
  assert.equal(sc.classifyMarket('US-Iran Final Nuclear Deal by December 31?').kind, 'thaw');
  assert.equal(sc.classifyMarket('US announces end of Iranian blockade by November 30?').kind, 'thaw');
});

test('non-conflict markets are left out', () => {
  for (const t of [
    'Prime Minister of Israel after the next election?',
    'Where will Trump and Putin meet next in 2026?',
    'Putin out as President of Russia by June 30?',
    'Will Reza Pahlavi enter Iran by December 31?',
    'FAA outage attributed to Iran?',
  ]) assert.equal(sc.classifyMarket(t), null, t);
});

test('market score rises with escalation odds and reads inverse markets backwards', () => {
  const mk = (pYes, kind = 'escalation') => ({ kind, severity: 3, pYes, vol24h: 10000 });
  const calm = sc.scoreMarkets([mk(0.02), mk(0.05), mk(0.03)]).score;
  const hot = sc.scoreMarkets([mk(0.6), mk(0.8), mk(0.4)]).score;
  assert.ok(calm < 10 && hot > 50, `${calm} / ${hot}`);
  assert.ok(sc.scoreMarkets([mk(0.95, 'breakdown')]).score < 10);
  assert.ok(sc.scoreMarkets([mk(0.1, 'breakdown')]).score > 80);
  assert.equal(sc.scoreMarkets([]).score, null);
});

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

test('combine falls back to whichever signal is alive', () => {
  assert.equal(sc.combine(50, 0), 30);
  assert.equal(sc.combine(null, 44), 44);
  assert.equal(sc.combine(41, null), 41);
  assert.equal(sc.combine(null, null), null);
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

test('pickMarket skips closed and expired markets', () => {
  const now = Date.parse('2026-11-14T00:00:00Z');
  const ev = { markets: [
    { question: 'old', closed: true, outcomePrices: '["1","0"]', volume24hr: 999, endDate: '2026-12-01T00:00:00Z' },
    { question: 'past', closed: false, outcomePrices: '["0.9","0.1"]', volume24hr: 500, endDate: '2026-11-01T00:00:00Z' },
    { question: 'live', closed: false, outcomePrices: '["0.2","0.8"]', volume24hr: 10, endDate: '2026-12-01T00:00:00Z', oneDayPriceChange: 0.03 },
  ] };
  const m = pickMarket(ev, now);
  assert.equal(m.question, 'live');
  assert.equal(m.pYes, 0.2);
  assert.equal(pickMarket({ markets: [] }, now), null);
});
