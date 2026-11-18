// Content Security Policy for public/index.html. The page runs only its own inline scripts, pinned by
// SHA-256 hash, plus script files served from the site itself (the self-hosted GoatCounter count.js),
// so a script tag slipped into the page (or a hijacked third-party CDN) cannot run.
// After editing a <script> in index.html, run `npm run csp` to refresh the hashes; a test fails until you do.
import { createHash } from 'node:crypto';

export const scriptHashes = (html) =>
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);

// Visitor counts go to the GoatCounter address named in the page's data-goatcounter attribute (and only there).
export const counterOrigin = (html) => (html.match(/data-goatcounter="(https:\/\/[a-z0-9-]+\.goatcounter\.com)\//) || [])[1] || null;
// Script files loaded from the site itself, e.g. <script src="count.js">. Remote script URLs are never allowed.
const hasOwnScriptFile = (html) => /<script\b[^>]*\ssrc="(?!https?:|\/\/)[^"]+"/.test(html);

export const cspFor = (html) => {
  const counter = counterOrigin(html);
  return [
    "default-src 'none'",
    `script-src ${[hasOwnScriptFile(html) ? "'self'" : '', ...scriptHashes(html)].filter(Boolean).join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    `connect-src 'self' https://api.gdeltproject.org${counter ? ' ' + counter : ''}`,
    `img-src 'self' data:${counter ? ' ' + counter : ''}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
};

const META = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
export const currentCsp = (html) => (html.match(META) || [])[0]?.match(/content="([^"]*)"/)[1] ?? null;
export const withCsp = (html) => {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${cspFor(html)}">`;
  return META.test(html) ? html.replace(META, () => tag) : html.replace(/<meta charset="utf-8">\n/, (m) => `${m}${tag}\n`);
};
