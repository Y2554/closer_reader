// dev-server.mjs — static server for the standalone build + a Claude proxy at /api/sample.
//
//   node server/dev-server.mjs                      → http://localhost:8080  (no AI features)
//   ANTHROPIC_API_KEY=sk-... node server/dev-server.mjs
//   PORT=3000 CLOSE_READER_MODEL=claude-sonnet-5-5 MAX_TOKENS=16000 node server/dev-server.mjs
//
// Then uncomment window.CLOSE_READER_SAMPLE_ENDPOINT = '/api/sample' in runtime/config.js.
// Node 18+ (uses built-in fetch). No dependencies. The API key stays on the server;
// never put it in the page. This is a development server: no auth, no rate limiting.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080);
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.CLOSE_READER_MODEL || 'claude-sonnet-5-5';
const MAX_TOKENS = +(process.env.MAX_TOKENS || 16000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

// Model output → JSON value. The page's prompts ask for "JSON only", but tolerate fences / stray text.
function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch {}
  const i = t.search(/[\[{]/), j = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (i >= 0 && j > i) return JSON.parse(t.slice(i, j + 1));
  throw new Error('no json');
}

async function sample(req, res) {
  if (!KEY) return send(res, 503, { error: 'ANTHROPIC_API_KEY not set' });
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 40e6) return send(res, 413, { error: 'too large' }); }
  const { prompt, images = [] } = JSON.parse(body || '{}');
  const content = [];
  for (const url of images) {                       // data:image/jpeg;base64,....
    const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/.exec(url || '');
    if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  content.push({ type: 'text', text: String(prompt || '') });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content }] })
  });
  if (r.status === 429) return send(res, 429, { error: 'rate limited' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('[sample]', r.status, data?.error?.message || ''); return send(res, 502, { error: data?.error?.message || 'upstream error' }); }
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { send(res, 200, parseJson(text)); }
  catch { console.error('[sample] model did not return JSON:', text.slice(0, 200)); send(res, 422, { error: 'invalid json' }); }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/sample' && req.method === 'POST') return await sample(req, res);
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
  console.log(KEY ? `Claude proxy on /api/sample (model ${MODEL})` : 'ANTHROPIC_API_KEY not set: AI features off');
});
