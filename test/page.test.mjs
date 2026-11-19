import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const PUB = new URL('../public/', import.meta.url);
const PAGES = readdirSync(PUB).filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(new URL(f, PUB), 'utf8');

test('the site has its five pages', () => {
  assert.deepEqual(PAGES.sort(), ['card.html', 'fight.html', 'index.html', 'vault.html', 'wire.html']);
});

// A syntax error anywhere in the page script blanks the whole dashboard, so every script must parse.
test('page scripts parse', () => {
  assert.doesNotThrow(() => new vm.Script(read('app.js')), 'app.js');
  for (const page of PAGES) {
    const scripts = [...read(page).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 1, page);
    for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code), `${page}: ${code.slice(0, 60)}`);
    assert.match(read(page), /<script src="app\.js"><\/script>/, page);
  }
});

// The Content Security Policy pins each inline script by hash; editing a script without `npm run csp` would blank the page.
test('CSP script hashes match the page scripts', async () => {
  const { cspFor, currentCsp } = await import('../lib/csp.mjs');
  for (const page of PAGES) {
    const html = read(page);
    assert.equal(currentCsp(html), cspFor(html), `${page}: run \`npm run csp\` to refresh the hashes`);
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<link'), `${page}: CSP meta must come before any resource`);
  }
});

// The visitor counter is GoatCounter's script served from this site, never a remote script tag.
test('visitor counter is self-hosted and allowed only to its own GoatCounter address', async () => {
  const { counterOrigin, cspFor } = await import('../lib/csp.mjs');
  assert.ok(read('count.js').includes('GoatCounter'));
  for (const page of PAGES) {
    const html = read(page);
    assert.doesNotMatch(html, /<script\b[^>]*\ssrc="(https?:)?\/\//, `${page}: no remote script files`);
    const origin = counterOrigin(html);
    assert.match(origin, /^https:\/\/[a-z0-9-]+\.goatcounter\.com$/, page);
    assert.match(cspFor(html), new RegExp(`connect-src [^;]*${origin.replace(/\./g, '\\.')}`), page);
  }
});
