// dev-server.mjs — local static server for index.html + the same /api/sample function Vercel runs.
//
//   node server/dev-server.mjs                                   → http://localhost:8080
//   CR_DEV_MEMORY=1 DEEPSEEK_API_KEY=sk-... node server/dev-server.mjs   (free trial, counters in memory)
//   PORT=3000 FREE_IMPORTS=2 FREE_SMALL=20 ...                   (all options: see api/sample.js)
//
// Node 18+. No dependencies. Keys stay on the server; never put one in the page.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

// /api/sample is the very same handler Vercel runs (api/sample.js), so local tests match production.
const require = createRequire(import.meta.url);
const sampleHandler = require('../api/sample.js');

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/sample') return await sampleHandler(req, res);
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, p);
    if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
  } catch (e) { console.error(e); send(res, 500, { error: 'server error' }); }
}).listen(PORT, () => {
  console.log(`The Close Reader → http://localhost:${PORT}`);
  console.log(process.env.DEEPSEEK_API_KEY ? 'free trial on /api/sample (DeepSeek)' : 'DEEPSEEK_API_KEY not set: only bring-your-own-key works');
});
