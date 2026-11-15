import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { classify, heatOf, clusterStories, prettySlug, recency } from '../lib/classify.mjs';
import { dyadWeight, theaterOfDyad, theaterOfText, placeName } from '../lib/geo.mjs';
import * as gd from '../lib/gdelt.mjs';
import * as sc from '../lib/score.mjs';

// ---- classifier ----------------------------------------------------------------

test('headlines land on the right rung', () => {
  const cases = [
    ['North Korea conducts nuclear test, Seoul says', 5],
    ['Russia invades Ukraine as Putin declares war', 4],
    ['Russian warship hit by Ukrainian drone in Gulf of Finland', 4],
    ['Israeli strike on Gaza hospital kills six Palestinians', 3],
    ['IRGC says tanker caught fire after hitting mines in Strait of Hormuz', 3],
    ['Three killed in Russia as Ukraine claims US floated NATO membership option', 3],
    ['US deploys second aircraft carrier to the Gulf', 2],
    ["UN watchdog 'increasingly concerned' over uninspected Iran nuclear site", 2],
    ['China warns Taiwan over planned visit', 1],
    ['Pope cheered on return to Peru city where he served as bishop', 0],
  ];
  for (const [title, tier] of cases) assert.equal(classify(title).tier, tier, title);
});

test('scary words in harmless places score nothing', () => {
  for (const title of [
    'Workers go on strike at Boeing plant',
    "Setback for SpaceX Starship rocket's double-catch test",
    'Trade war fears hit markets',
    'Call of Duty adds airstrike mode in new season',
    'Watch: Divers explore US ship sunk off Florida coast to create new reef',
    'Arsenal striker scores hat-trick in Champions League',
    'In Korea a tribunal is underway on US atomic bombings',
    'Heart attack risk falls with new drug',
  ]) assert.equal(classify(title).tier, 0, title);
  // Local crime and street protest are not beef between states.
  assert.ok(classify('Police arrest gunman after mass shooting').tier <= 1);
  assert.ok(classify('Clashes erupt in Barcelona after thousands join general strike').tier <= 1);
  assert.ok(classify('British soldier charged with rape of woman in Cyprus').tier <= 1);
});

test('cooling down counts for less, a collapsing deal counts for more', () => {
  const calm = classify('Ceasefire agreed after weeks of shelling');
  assert.equal(calm.calm, true);
  assert.ok(heatOf(calm) < calm.tier);
  const broke = classify('Ceasefire collapses as talks break down');
  assert.equal(broke.calm, false);
  assert.ok(broke.tier >= 3);
  const talks = classify('Trump to meet Xi and Putin for nuclear talks');
  assert.equal(talks.calm, true);
  assert.ok(talks.tier < 3);
});

test('nuclear flag ignores power stations', () => {
  assert.equal(classify('North Korea fires ICBM toward Japan').nuke, true);
  assert.equal(classify('New nuclear power plant approved in Wales').nuke, false);
});

test('the same story from several outlets becomes one story', () => {
  const now = Date.now();
  const mk = (title, source, tier = 3) => ({ title, source, url: `https://x.test/${source}`, time: now - 3600000, tier, calm: false, nuke: false });
  const stories = clusterStories([
    mk('Israeli airstrikes hit southern Lebanon, killing five', 'A'),
    mk('Israel strikes Lebanon as ceasefire falters', 'B'),
    mk('Five dead as Israeli strike hits Lebanon village', 'C'),
    mk('Pope visits Peru on first foreign trip', 'A', 0),
  ], now);
  assert.equal(stories.length, 2);
  assert.equal(stories[0].n, 3);
  assert.equal(stories[0].tier, 3);
  assert.ok(stories[0].heat > stories[1].heat);
});

test('recency halves every twelve hours and ends at two days', () => {
  assert.equal(recency(0), 1);
  assert.ok(Math.abs(recency(12) - 0.5) < 1e-9);
  assert.equal(recency(49), 0);
});

test('slug titles get their capitals back', () => {
  assert.equal(prettySlug('us seeks to disrupt iran supply networks'), 'US seeks to disrupt Iran supply networks');
});

// ---- geography ------------------------------------------------------------------

test('matchups are weighted by how dangerous they are', () => {
  assert.equal(dyadWeight('USA', 'RUS'), 1);
  assert.equal(dyadWeight('IND', 'PAK'), 1);
  assert.equal(dyadWeight('POL', 'RUS'), 0.8);
  assert.equal(dyadWeight('CHN', 'TWN'), 0.8);
  assert.equal(dyadWeight('IRN', 'ISR'), 0.55);
  assert.equal(dyadWeight('RUS', 'UKR'), 0.35);
  assert.equal(dyadWeight('SAU', 'YEM'), 0.15);
  assert.ok(dyadWeight('USA', 'GBR') <= 0.1); // allies
  assert.equal(dyadWeight('RUS', 'USA'), dyadWeight('USA', 'RUS'));
});

test('theaters and place names', () => {
  assert.equal(theaterOfDyad('USA', 'IRN'), 'gulf');
  assert.equal(theaterOfDyad('RUS', 'UKR'), 'ukraine');
  assert.equal(theaterOfText('Houthi missile hits ship in Red Sea'), 'redsea');
  assert.equal(placeName('Gaza, Israel (general), Israel'), 'Gaza, Israel');
});

// ---- GDELT -----------------------------------------------------------------------

function makeZip(name, text) {
  const data = zlib.deflateRawSync(Buffer.from(text));
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(text.length, 22); local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(text.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = 30 + nameBuf.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nameBuf.length, 12); end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, nameBuf, data, central, nameBuf, end]);
}

// One GDELT event row: 61 tab-separated columns, most of them irrelevant here.
function row({ a = '', aType = '', b = '', bType = '', code = '190', quad = '4', geoType = '4', geo = 'Kyiv, Ukraine', fips = 'UP', lat = '50.4', lon = '30.5', url }) {
  const r = Array(61).fill('');
  r[7] = a; r[12] = aType; r[17] = b; r[22] = bType; r[26] = code; r[28] = code.slice(0, 2); r[29] = quad;
  r[51] = geoType; r[52] = geo; r[53] = fips; r[56] = lat; r[57] = lon; r[60] = url;
  return r.join('\t');
}

test('unzip reads a one-file archive', () => {
  assert.equal(gd.unzipFirst(makeZip('a.csv', 'hello\tworld\n')).toString(), 'hello\tworld\n');
  assert.throws(() => gd.unzipFirst(Buffer.from('not a zip at all, just some text')));
});

test('headline slugs come out of URLs', () => {
  assert.deepEqual(gd.slugOf('https://www.example.com/world/israel-strikes-lebanon-kills-five-2026/'), { domain: 'example.com', text: 'israel strikes lebanon kills five' });
  assert.equal(gd.slugOf('https://example.com/articles/345613').text, '');
  assert.equal(gd.slugOf('nonsense'), null);
});

test('ingest keeps state-on-state events and counts by article', () => {
  const csv = [
    row({ a: 'RUS', b: 'UKR', aType: 'MIL', url: 'https://n.test/world/russia-strikes-kyiv-with-missile-barrage' }),
    row({ a: 'RUS', b: 'UKR', url: 'https://n.test/world/russia-strikes-kyiv-with-missile-barrage' }), // same article
    row({ a: 'RUS', b: 'UKR', code: '112', quad: '3', url: 'https://n.test/world/kremlin-accuses-kyiv-of-provocation-again' }),
    row({ a: 'USA', b: 'USA', aType: 'COP', url: 'https://local.test/news/police-respond-to-downtown-shooting-tonight' }), // domestic
    row({ a: 'USA', aType: 'BUS', b: 'CHN', url: 'https://biz.test/markets/company-battles-china-rival-for-share' }), // business
    row({ a: 'AFR', b: 'ZAF', url: 'https://n.test/africa/region-code-is-not-a-country-actor' }), // region pseudo-actor
    'short\trow',
  ].join('\n');
  const slot = gd.ingest(csv, true);
  assert.equal(slot.n, 6);
  assert.equal(slot.c[0], 2); // two force events, both RUS-UKR
  assert.deepEqual(slot.d, { 'RUS-UKR': [1, 0, 0, 1] }); // one talk article, one hands article
  assert.equal(slot.g.length, 1);
  assert.equal(slot.g[0][2], 1);
  assert.equal(slot.s[0], 5); // distinct URLs
  assert.ok(slot.x.some((x) => x[4].includes('missile barrage')));
});

test('refresh fills a day of slots, remembers gaps, and windows add up', async () => {
  const latest = '20261114120000';
  const now = gd.stampToMs(latest) + 5 * 60000;
  const csv = row({ a: 'IRN', b: 'ISR', url: 'https://n.test/world/iran-fires-missiles-at-israel-overnight' });
  const calls = [];
  const getBuffer = async (url) => {
    calls.push(url);
    if (url.includes('.translation.')) return null; // translated feed missing everywhere
    return makeZip('x.CSV', csv);
  };
  const store = {};
  const r = await gd.refresh(store, latest, getBuffer, { now });
  assert.equal(r.fetched, gd.KEEP_SLOTS);
  assert.equal(calls.length, gd.KEEP_SLOTS * 2);
  assert.equal(store.tr[latest], undefined); // fresh gap: ask again next time
  assert.equal(store.tr[gd.stamp(gd.stampToMs(latest) - 3 * 3600000)], 0); // old gap: stop asking

  const again = await gd.refresh(store, latest, getBuffer, { now });
  assert.equal(again.fetched, 0);

  const six = gd.windowStats(store, 6), day = gd.windowStats(store, 24);
  assert.equal(six.hours, 6);
  assert.equal(day.hours, 24);
  assert.deepEqual(day.dyads.get('IRN-ISR'), [0, 0, 0, 96]);
  assert.equal(six.hot.length, 24);
  assert.equal(gd.windowStats(null, 6).n, 0);
});

// ---- scoring ---------------------------------------------------------------------

const windowOf = ({ n = 100000, force = 800, hours = 24, dyads = {}, slug = [0, 20000, 800, 800, 300, 30, 10, 100, 30] }) => ({
  hours, n, c: [force, force, force, 0, 0, 0, 0], dyads: new Map(Object.entries(dyads)), spots: new Map(), slug, hot: [],
});

test('action score matches the calibration anchors', () => {
  const quiet = sc.actionScore(windowOf({ force: 780, dyads: { 'ISR-PSE': [20, 0, 0, 48] } })).score;
  const invasion = sc.actionScore(windowOf({ force: 2340, dyads: { 'RUS-UKR': [900, 100, 200, 2430] } })).score;
  assert.ok(quiet > 15 && quiet < 35, `quiet ${quiet}`);
  assert.ok(invasion > 78 && invasion < 90, `invasion ${invasion}`);
  assert.equal(sc.actionScore(windowOf({ n: 0 })).score, null);
});

test('escalation cares who is fighting, not just how hard', () => {
  const regional = sc.escalation(windowOf({ dyads: { 'SAU-YEM': [10, 0, 0, 480] } })).score;
  const nuclear = sc.escalation(windowOf({ dyads: { 'IND-PAK': [10, 0, 0, 480] } })).score;
  assert.ok(nuclear > regional * 4);
  assert.equal(sc.escalation(windowOf({ dyads: { 'SAU-YEM': [10, 0, 0, 480] } }), 0.8).score, 0);
});

test('press and nuclear-talk scores follow their shares', () => {
  const normal = sc.pressScore(windowOf({})).score; // 1.5% + 0.3% + 0.15%
  const crisis = sc.pressScore(windowOf({ slug: [0, 20000, 800, 1800, 1200, 300, 40, 50, 60] })).score;
  assert.ok(normal > 20 && normal < 40, `normal ${normal}`);
  assert.ok(crisis > 65, `crisis ${crisis}`);
  assert.equal(sc.pressScore(windowOf({ slug: [0, 50, 0, 0, 0, 0, 0, 0, 0] })).score, null);
  assert.ok(sc.nukeChatter(windowOf({ slug: [0, 20000, 0, 0, 0, 0, 90, 0, 170] })).score > 75);
});

test('front pages: a crisis front page outscores a normal one', () => {
  const now = Date.now();
  const page = (hot) => Array.from({ length: 20 }, (_, i) => ({
    title: i < hot ? `Missile strike number ${i} hits city ${i}` : `Ordinary story number ${i} about topic ${i}`,
    url: `https://o.test/${i}`, source: 'O', outlet: 'O', kind: 'front', time: now - 3600000, tier: i < hot ? 3 : 0, calm: false, nuke: false,
  }));
  const normal = sc.frontPages(page(3), now).score, crisis = sc.frontPages(page(12), now).score;
  assert.ok(normal < 45 && crisis > 60, `${normal} / ${crisis}`);
  assert.equal(sc.frontPages([], now).score, null);
});

test('blend hands a missing ingredient to the others', () => {
  const all = sc.blend({ action: 50, chatter: 50, bigdogs: 50, money: 50 });
  assert.equal(Math.round(all.raw), 50);
  assert.ok(Math.abs(all.confidence - 1) < 1e-9);
  const noMoney = sc.blend({ action: 80, chatter: 40, bigdogs: 20, money: null });
  assert.ok(Math.abs(noMoney.raw - (80 * 0.35 + 40 * 0.35 + 20 * 0.2) / 0.9) < 1e-9);
  assert.equal(sc.blend({ action: null, chatter: null, bigdogs: null, money: null }).raw, null);
});

test('smoothing rises fast and falls slowly', () => {
  const prev = { t: 0, x: 40 };
  const up = sc.smooth(80, prev, 10 * 60000), down = sc.smooth(0, prev, 10 * 60000);
  assert.ok(Math.abs(up - 60) < 1e-9); // half the gap in ten minutes
  assert.ok(down > 33 && down < 36); // much less of it on the way down
  assert.equal(sc.smooth(80, { t: 0, x: 40 }, 3 * 3600000), 80); // stale history is ignored
  assert.equal(sc.smooth(80, null, 1), 80);
});

test('status bands and TheseHandsCon levels', () => {
  assert.equal(sc.statusFor(0).label, 'We Cool');
  assert.equal(sc.statusFor(24).label, 'We Cool');
  assert.equal(sc.statusFor(25).label, 'Why They Lookin At Me');
  assert.equal(sc.statusFor(55).label, 'Square Up');
  assert.equal(sc.statusFor(80).label, 'Told Ya To Watch Ya Mouth');
  assert.equal(sc.statusFor(100).label, 'Told Ya To Watch Ya Mouth');
  assert.equal(sc.statusFor(24, 'lookin').key, 'lookin'); // one point under the line: label holds
  assert.equal(sc.statusFor(22, 'lookin').key, 'cool'); // clearly under: relaxes
  assert.equal(sc.statusFor(56, 'lookin').key, 'squared'); // heating up is immediate
  assert.deepEqual([10, 45, 60, 75, 90].map((s) => sc.handsConFor(s).level), [5, 4, 3, 2, 1]);
  assert.equal(sc.handsConFor(53, 3).level, 3); // just under the line: stays put
  assert.equal(sc.handsConFor(50, 3).level, 4); // clearly under: relaxes
  assert.equal(sc.handsConFor(56, 4).level, 3); // tightening is immediate
  assert.equal(sc.handsConFor(10, null, 2).level, 2); // a hard trigger sets a floor
});

test('beef clock is anchored to the official clock', () => {
  assert.equal(sc.beefClockSeconds(85, sc.DOOMSDAY_NEUTRAL), 85);
  assert.equal(sc.beefClockSeconds(85, sc.DOOMSDAY_NEUTRAL + 30), 43);
  assert.equal(sc.beefClockSeconds(85, sc.DOOMSDAY_NEUTRAL - 30), 170);
  assert.equal(sc.beefClockSeconds(85, null), null);
  assert.ok(sc.doomScore(20, 20, true) > sc.doomScore(20, 20, false));
});

test('trend labels', () => {
  const now = 100 * 3600000;
  const history = [{ t: now - 24 * 3600000, i: 30 }, { t: now - 3600000, i: 38 }];
  assert.equal(sc.changeSince(history, now, 40, 24), 10);
  assert.equal(sc.changeSince(history, now, 40, 1), 2);
  assert.equal(sc.changeSince([], now, 40, 24), null);
  assert.equal(sc.trendFor(2, 10).key, 'up');
  assert.equal(sc.trendFor(-3, null).key, 'down');
  assert.equal(sc.trendFor(1, -1).key, 'flat');
  assert.equal(sc.trendFor(null, null).key, 'new');
});

test('fight card leaves allies off and ranks by heat', () => {
  const day = windowOf({ dyads: { 'RUS-UKR': [100, 10, 20, 200], 'GBR-USA': [50, 0, 30, 10], 'CHN-USA': [60, 5, 20, 4] } });
  const card = sc.fightCard(day, windowOf({ hours: 6 }));
  assert.deepEqual(card.map((m) => m.key), ['RUS-UKR', 'CHN-USA']);
  assert.equal(card[0].rung, 4);
  assert.equal(card[1].stakes, 'nuclear');
});

test('TheseHandsCon follows US involvement, not world tension', () => {
  const w = (dyads) => windowOf({ dyads });
  // A big war the US is not in barely registers.
  const notUs = sc.usPosture(w({ 'ISR-PSE': [100, 10, 30, 1800] }), 0).score;
  // US forces fighting Iran hard: raised, but capped below level 2.
  const usIran = sc.usPosture(w({ 'IRN-USA': [200, 50, 30, 1500] }), 0).score;
  // US and Russia trading blows: the top of the scale is reachable.
  const usRussia = sc.usPosture(w({ 'RUS-USA': [200, 60, 80, 600] }), 60).score;
  // A NATO ally under Russian pressure counts, at half weight.
  const ally = sc.usPosture(w({ 'POL-RUS': [80, 20, 40, 300] }), 0);
  assert.ok(notUs < 40, `not US ${notUs}`);
  assert.ok(usIran >= 55 && usIran < 70, `US-Iran ${usIran}`);
  assert.ok(usRussia >= 70, `US-Russia ${usRussia}`);
  assert.ok(ally.score > notUs && ally.standoffs[0].ally === 'POL');
  assert.equal(sc.usPosture(windowOf({ n: 0 }), 0), null);
});
