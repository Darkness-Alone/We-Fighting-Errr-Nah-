import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// A syntax error anywhere in the page script blanks the whole dashboard, so every inline script must parse.
test('page scripts parse', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1);
  for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code), code.slice(0, 60));
});

// The Content Security Policy pins each inline script by hash; editing a script without `npm run csp` would blank the page.
test('CSP script hashes match the page scripts', async () => {
  const { cspFor, currentCsp } = await import('../lib/csp.mjs');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.equal(currentCsp(html), cspFor(html), 'run `npm run csp` to refresh the hashes');
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<link'), 'CSP meta must come before any resource');
});

// The visitor counter is GoatCounter's script served from this site, never a remote script tag.
test('visitor counter is self-hosted and allowed only to its own GoatCounter address', async () => {
  const { counterOrigin, cspFor } = await import('../lib/csp.mjs');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(readFileSync(new URL('../public/count.js', import.meta.url), 'utf8').includes('GoatCounter'));
  assert.doesNotMatch(html, /<script\b[^>]*\ssrc="(https?:)?\/\//, 'no remote script files');
  const origin = counterOrigin(html);
  assert.match(origin, /^https:\/\/[a-z0-9-]+\.goatcounter\.com$/);
  assert.match(cspFor(html), new RegExp(`connect-src [^;]*${origin.replace(/\./g, '\\.')}`));
});
