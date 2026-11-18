// Content Security Policy for public/index.html. The page runs only its own inline scripts, pinned by
// SHA-256 hash, so a script tag slipped into the page (or a hijacked third-party CDN) cannot run.
// After editing a <script> in index.html, run `npm run csp` to refresh the hashes; a test fails until you do.
import { createHash } from 'node:crypto';

export const scriptHashes = (html) =>
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);

export const cspFor = (html) => [
  "default-src 'none'",
  `script-src ${scriptHashes(html).join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "connect-src 'self' https://api.gdeltproject.org",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const META = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
export const currentCsp = (html) => (html.match(META) || [])[0]?.match(/content="([^"]*)"/)[1] ?? null;
export const withCsp = (html) => {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${cspFor(html)}">`;
  return META.test(html) ? html.replace(META, () => tag) : html.replace(/<meta charset="utf-8">\n/, (m) => `${m}${tag}\n`);
};
