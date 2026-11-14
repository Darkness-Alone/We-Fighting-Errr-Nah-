#!/usr/bin/env node
// Runs the live scoring pipeline over a folder of already-downloaded GDELT event files and prints
// one line per day. This is how the curves in lib/score.mjs were set, and how to re-check them.
//
//   node scripts/calibrate.mjs <folder>
//
// The folder holds unzipped files named as GDELT ships them:
//   YYYYMMDDHHMMSS.export.CSV and YYYYMMDDHHMMSS.translation.export.CSV
// from https://storage.googleapis.com/data.gdeltproject.org/gdeltv2/<name>.zip
// A sample of a day (say one file every two hours) is enough; rates are per hour of files present.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ingest, windowStats } from '../lib/gdelt.mjs';
import * as sc from '../lib/score.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/calibrate.mjs <folder of GDELT event CSVs>');
  process.exit(1);
}

const days = new Map();
for (const f of readdirSync(dir).filter((f) => f.endsWith('.CSV')).sort()) {
  const ts = f.slice(0, 14), day = ts.slice(0, 8);
  if (!days.has(day)) days.set(day, { en: {}, tr: {}, latest: ts });
  const store = days.get(day);
  const feed = f.includes('.translation.') ? 'tr' : 'en';
  store[feed][ts] = ingest(readFileSync(path.join(dir, f), 'utf8'), feed === 'en');
  if (ts > store.latest) store.latest = ts;
}

const n = (x) => String(x == null ? '-' : Math.round(x)).padStart(4);
console.log('day       hours force% | action press nuke | dogs nucl | index  con  clock | hottest matchups (hands per hour)');
for (const [day, store] of days) {
  const w = windowStats(store, 24);
  const action = sc.actionScore(w);
  const press = sc.pressScore(w);
  const nuke = sc.nukeChatter(w);
  const esc = sc.escalation(w);
  const nuclear = sc.escalation(w, 0.8);
  const dogs = sc.bigDogsScore(esc.score, nuke.score);
  const { raw } = sc.blend({ action: action.score, chatter: press.score, bigdogs: dogs, money: null });
  const con = sc.handsConFor(sc.postureScore(raw, dogs));
  const clock = sc.beefClockSeconds(85, sc.doomScore(nuclear.score, nuke.score));
  const top = action.matchups.slice(0, 3).map((m) => `${m.key} ${m.handsPerHour.toFixed(1)}`).join(', ');
  console.log(
    day, w.hours.toFixed(1).padStart(5), action.share.toFixed(2).padStart(6), '|', n(action.score), n(press.score), n(nuke.score).padStart(5),
    '|', n(dogs), n(nuclear.score), '|', n(raw).padStart(5), String(con.level).padStart(4), `${String(clock).padStart(5)}s`, '|', top,
  );
}
