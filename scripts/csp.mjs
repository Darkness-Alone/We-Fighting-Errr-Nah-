#!/usr/bin/env node
// Rewrites the Content-Security-Policy meta tag in public/index.html with fresh script hashes.
import { readFile, writeFile } from 'node:fs/promises';
import { withCsp } from '../lib/csp.mjs';

const file = new URL('../public/index.html', import.meta.url);
const html = await readFile(file, 'utf8');
const next = withCsp(html);
if (next === html) console.log('CSP already up to date');
else { await writeFile(file, next); console.log('CSP updated in public/index.html'); }
