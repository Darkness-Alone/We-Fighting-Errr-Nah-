#!/usr/bin/env node
// Bakes the current public/data.json into a single self-contained HTML file
// (no server needed, opens straight from disk). Usage: node scripts/snapshot.mjs [out.html] [--fragment]

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { withCsp } from '../lib/csp.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || path.join(root, 'snapshot.html');

const data = JSON.parse(await readFile(path.join(root, 'public', 'data.json'), 'utf8'));
let html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
html = html.replace('/*SNAPSHOT*/', () => `window.__SNAPSHOT__=${json};`); // baked data changes the script hash
// A snapshot is a standalone file: no visitor counter (count.js isn't next to it, and a local file shouldn't count).
html = withCsp(html.replace(/<!-- Visitor counter[\s\S]*?<\/script>\n/, ''));
if (fragment) {
  // Body-only form for hosts that supply their own document skeleton.
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<\/?(html|head|body)[^>]*>\s*/gi, '')
    .replace(/<meta (charset|name="viewport")[^>]*>\s*/gi, '');
}
await writeFile(out, html);
console.log(`wrote ${out} (index ${data.index})`);
