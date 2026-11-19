import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ex from '../lib/extras.mjs';
import { countriesIn, mentionAt } from '../lib/geo.mjs';
import { signals, classify } from '../lib/classify.mjs';
import * as gd from '../lib/gdelt.mjs';
import { STATUSES } from '../lib/score.mjs';

const curated = JSON.parse(readFileSync(new URL('../public/curated.json', import.meta.url), 'utf8'));
const DAY = 24 * 3600000;
const T0 = Date.parse('2026-11-10T12:00:00Z');

test('countriesIn finds countries by name and alias, "US" only in capitals', () => {
  assert.deepEqual(countriesIn('Zelensky says Russia launched 300 drones at Kyiv').sort(), ['RUS', 'UKR']);
  assert.deepEqual(countriesIn('U.S. warns Iran over Hormuz').sort(), ['IRN', 'USA']);
  assert.deepEqual(countriesIn('Give us a break: Latin America leaders meet'), []);
  assert.deepEqual(countriesIn('Return to talks on irans nuclear program'), ['IRN']);
  assert.equal(mentionAt('Zelensky says Russia launched', 'UKR'), 0);
});

test('homeOf maps feed outlets, domains and country web suffixes to a home country', () => {
  assert.equal(ex.homeOf('Kyiv Independent', 'https://kyivindependent.com/x', curated), 'UKR');
  assert.equal(ex.homeOf('tass.com', 'https://tass.com/politics/1', curated), 'RUS');
  assert.equal(ex.homeOf('rg.ru', 'https://www.rg.ru/a', curated), 'RUS');
  assert.equal(ex.homeOf('example.com', 'https://example.com/a', curated), null);
  const row = ex.tagRow([T0, 'press', 'tass.com', 'Kremlin warns Kyiv', 'https://tass.com/1', 2, 0], curated);
  assert.deepEqual(row.slice(7), ['RUS,UKR', 'RUS']);
});

test('signals: de-escalation and build-up finds, without touching the beef tier', () => {
  assert.equal(signals('Russia and Ukraine agree to new round of peace talks in Istanbul').cut, 'peace talks');
  assert.equal(signals('Ceasefire collapses as shelling resumes in Gaza').cut, null);
  assert.equal(signals('China launches large-scale military drills around Taiwan').camp, 'military drills');
  assert.equal(signals('North Korea test-fires ballistic missile').camp, 'missile test');
  assert.equal(signals('Wall Street pledged to mobilize billions for Nvidia').camp, null);
  assert.equal(signals('NFL training camp opens').camp, null);
  assert.deepEqual(classify('China launches large-scale military drills around Taiwan'), { tier: 2, calm: false, nuke: false });
});

test('daily archive: streak, record book and card changes', () => {
  const card = (keys) => keys.map((k) => ({ key: k, a: k.slice(0, 3), b: k.slice(4), talk: 5, flex: 1, hands: 2, rung: 2 }));
  let days = [];
  const readings = [[0, 20, 'cool'], [1, 30, 'lookin'], [2, 31, 'lookin'], [3, 60, 'squared'], [4, 40, 'lookin'], [5, 41, 'lookin'], [6, 44, 'lookin']];
  for (const [d, i, s] of readings) days = ex.updateDays(days, T0 + d * DAY, { index: i, status: s, con: 4, card: card(d < 6 ? ['A-B', 'C-D'] : ['A-B', 'E-F']) });
  const now = T0 + 6 * DAY;
  assert.deepEqual(ex.streak(days, 'lookin', now), { days: 3, since: '2026-11-14', status: 'lookin' });
  const rec = ex.records(days, STATUSES, now);
  assert.deepEqual(rec.high, { i: 60, d: '2026-11-13' });
  assert.equal(rec.longest.find((l) => l.status === 'lookin').days, 3);
  assert.equal(rec.longest.find((l) => l.status === 'mouth').days, 0);
  const ch = ex.cardChanges(days, now);
  assert.deepEqual(ch.debuts.map((m) => m.key), ['E-F']);
  assert.deepEqual(ch.dropped.map((m) => m.key), ['C-D']);
  assert.equal(ex.cardChanges(days.slice(0, 1), T0).first, true);
  // a later reading the same day overwrites it, keeping the day's high
  days = ex.updateDays(days, now + 3600000, { index: 39, status: 'lookin', con: 4, card: card(['A-B']) });
  assert.equal(days.length, 7);
  assert.deepEqual([days[6].i, days[6].hi], [39, 44]);
});

test('Press Conference picks a line where that side is the one speaking', () => {
  const m = { key: 'RUS-UKR', ca: 'RUS', cb: 'UKR' };
  const r = (t, title, tier = 2) => ex.tagRow([t, 'press', 'x.com', title, 'https://x.com/' + t, tier, 0], curated);
  const rows = [
    r(T0, 'Russian man accused of spying on Ukraine aid workers'),
    r(T0 - 1000, 'Kremlin warns Ukraine over long-range missiles', 3),
    r(T0 - 2000, 'Zelensky says Russia is stalling peace talks'),
  ];
  const p = ex.pressers([m], rows, T0)['RUS-UKR'];
  assert.equal(p.a.text, 'Kremlin warns Ukraine over long-range missiles');
  assert.equal(p.b.text, 'Zelensky says Russia is stalling peace talks');
  assert.deepEqual(ex.pressers([m], [], T0), {});
});

test('GDELT ingest splits each matchup by who acted, alongside the pair totals', () => {
  const cols = (a1, a2, root, url) => {
    const r = new Array(61).fill('');
    Object.assign(r, { 7: a1, 12: 'GOV', 17: a2, 22: 'GOV', 26: root + '0', 28: root, 29: root >= '18' ? '4' : '3', 60: url });
    return r.join('\t');
  };
  const slot = gd.ingest([cols('RUS', 'UKR', '19', 'u1'), cols('UKR', 'RUS', '19', 'u2'), cols('UKR', 'RUS', '19', 'u3')].join('\n'), true);
  assert.deepEqual(slot.d['RUS-UKR'], [0, 0, 0, 3]);
  assert.deepEqual(slot.o['RUS-UKR'], [0, 0, 0, 1, 0, 0, 0, 2]);
});
