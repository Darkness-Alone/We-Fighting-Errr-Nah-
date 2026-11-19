#!/usr/bin/env node
// Rewrites the Content-Security-Policy meta tag in every page in public/ with fresh script hashes.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { withCsp } from '../lib/csp.mjs';

const dir = new URL('../public/', import.meta.url);
for (const name of (await readdir(dir)).filter((f) => f.endsWith('.html')).sort()) {
  const file = new URL(name, dir);
  const html = await readFile(file, 'utf8');
  const next = withCsp(html);
  if (next === html) console.log(`${name}: CSP already up to date`);
  else { await writeFile(file, next); console.log(`${name}: CSP updated`); }
}
