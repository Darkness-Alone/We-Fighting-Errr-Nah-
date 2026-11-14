#!/usr/bin/env node
// Serves the dashboard and refreshes the reading on a timer. No dependencies.
//   node server.mjs            http://localhost:8787, refresh every 10 minutes
//   PORT=3000 REFRESH_MIN=5 node server.mjs

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectAndWrite } from './collect.mjs';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 8787;
const REFRESH_MS = Math.max(2, Number(process.env.REFRESH_MIN) || 10) * 60000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

async function refresh() {
  try {
    const d = await collectAndWrite();
    const down = d.sources.filter((s) => !s.ok).map((s) => s.name);
    console.log(`${new Date().toISOString()}  index ${d.index} · ${d.status?.label} · TheseHandsCon ${d.handsCon?.level}${down.length ? ` · down: ${down.join(', ')}` : ''}`);
  } catch (err) {
    console.error('refresh failed:', err.message);
  }
}

http
  .createServer(async (req, res) => {
    const name = new URL(req.url, 'http://x').pathname;
    const file = path.join(PUBLIC, path.normalize(name === '/' ? 'index.html' : name));
    if (!file.startsWith(PUBLIC + path.sep)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  })
  .listen(PORT, () => console.log(`We Beefin Index → http://localhost:${PORT}`));

refresh();
setInterval(refresh, REFRESH_MS);
