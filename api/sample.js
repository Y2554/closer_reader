/* api/sample.js — Vercel Function behind POST /api/sample (and GET /api/sample for quota).
 *
 * The page sends { prompt, images: [dataURL…], modelTier } and expects the model's JSON back.
 * Two ways to pay for a call:
 *
 *   1. Free trial (owner's key, DEEPSEEK_API_KEY). Counted per device, once only:
 *        FREE_IMPORTS article imports + FREE_SMALL small calls (glosses, notes, translation review).
 *      Extra guards: per-IP per-day cap, whole-site per-day cap. Counters live in Upstash Redis;
 *      without Redis the free trial is OFF (never unlimited).
 *   2. Bring your own key: headers X-CR-Provider / X-CR-Key / X-CR-Model. Forwarded to that
 *      provider only (fixed allowlist below), never stored, never logged. Only a per-device
 *      hourly rate limit applies.
 *
 * Importing one article makes two calls: the article itself (modelTier 'complex') and a long
 * word-tagging call. A successful free import returns a one-time ticket (X-CR-Ticket) that lets
 * the follow-up call through without spending another credit.
 *
 * Env (Vercel → Settings → Environment Variables):
 *   DEEPSEEK_API_KEY          owner's key for the free trial (required for the free trial)
 *   KV_REST_API_URL / KV_REST_API_TOKEN        (added by the Upstash integration)
 *     or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   FREE_IMPORTS=2  FREE_SMALL=20  IP_DAILY=40  GLOBAL_DAILY=150  BYOK_HOURLY=120
 *   FREE_MODEL=deepseek-flash
 *   CR_DEV_MEMORY=1           local development only: keep counters in memory instead of Redis
 *   CR_UPSTREAM_OVERRIDE=url  tests only: send every model call to this URL
 *
 * Responses (non-stream): 200 parsed JSON · 400 bad_request · 401 bad_key · 402 free_used_up / no_balance
 *            · 403 forbidden · 413 prompt_too_large · 422 invalid_json · 429 rate_limited / busy_today
 *            · 502 upstream_error / model_rejected · 503 ai_unavailable
 * Errors are JSON: { "error": "<code>" }.
 *
 * Stream mode (request body "stream": true): 200 text/plain, the model's raw text as it is written,
 * then "\u0001" + {"value": parsed JSON} or "\u0001" + {"error": "<code>"}. Errors found before the
 * model starts answering still come back as normal JSON error responses.
 */

const PROVIDERS = {
  deepseek: { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-flash', deepseek: true },
  qwen:     { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' },
  moonshot: { url: 'https://api.moonshot.cn/v1/chat/completions' },
  zhipu:    { url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  doubao:   { url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' }
};

const env = process.env;
const num = (k, d) => { const v = parseInt(env[k], 10); return Number.isFinite(v) && v >= 0 ? v : d; };
const LIMIT = {
  imports: num('FREE_IMPORTS', 2), small: num('FREE_SMALL', 20),
  ipDaily: num('IP_DAILY', 40), globalDaily: num('GLOBAL_DAILY', 150), byokHourly: num('BYOK_HOURLY', 120)
};
// Output caps. Tagging every word of an article (the import's follow-up call) takes 7–15k tokens,
// so non-import calls get room too; you only pay for what the model actually writes.
const MAX_TOKENS = { import: 32000, long: 24000, small: 24000 };
const MAX_PROMPT = { import: 30000, long: 40000, small: 8000 };
const MAX_IMAGES = 6;                          // pages of one article (the page shrinks them to fit 4.5 MB)
const TIMEOUT_MS = 285000;                     // the function itself may run 300 s (vercel.json)

/* ---------------- small helpers ---------------- */
function send(res, code, body, headers = {}) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
const fail = (res, code, error, headers) => send(res, code, { error }, headers);

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {           // Vercel already parsed it
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
    return req.body;
  }
  let s = '';
  for await (const chunk of req) { s += chunk; if (s.length > 6e6) throw { status: 413 }; }
  return JSON.parse(s || '{}');
}

function clientIp(req) {
  const h = req.headers;
  const xf = String(h['x-forwarded-for'] || h['x-real-ip'] || '').split(',')[0].trim();
  return (xf || (req.socket && req.socket.remoteAddress) || 'unknown').slice(0, 64);
}
const beijingDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const hourSlot = () => Math.floor(Date.now() / 3600e3);

// The model is asked for "JSON only", but tolerate code fences or a sentence around it.
function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch (e) { /* fall through */ }
  const i = t.search(/[\[{]/), j = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (i >= 0 && j > i) return JSON.parse(t.slice(i, j + 1));
  throw new Error('no json');
}

/* ---------------- counters: Upstash Redis REST, or memory in local dev ---------------- */
const R_URL = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
const R_TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
const mem = new Map();
const store = R_URL && R_TOKEN ? {
  async run(cmds) {
    const r = await fetch(R_URL.replace(/\/$/, '') + '/pipeline', {
      method: 'POST', headers: { Authorization: 'Bearer ' + R_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    if (!r.ok) throw new Error('redis ' + r.status);
    return (await r.json()).map(x => { if (x.error) throw new Error('redis ' + x.error); return x.result; });
  }
} : env.CR_DEV_MEMORY === '1' ? {
  async run(cmds) {                              // just enough Redis for this file, for local testing
    return cmds.map(([op, k, ...a]) => {
      const cur = mem.get(k);
      if (op === 'INCR') { const v = (+cur || 0) + 1; mem.set(k, String(v)); return v; }
      if (op === 'DECR') { const v = (+cur || 0) - 1; mem.set(k, String(v)); return v; }
      if (op === 'GET') return cur ?? null;
      if (op === 'MGET') return [k, ...a].map(x => mem.get(x) ?? null);
      if (op === 'SET') { mem.set(k, String(a[0])); return 'OK'; }
      if (op === 'GETDEL') { mem.delete(k); return cur ?? null; }
      if (op === 'EXPIRE') return 1;
      throw new Error('unsupported ' + op);
    });
  }
} : null;

/* ---------------- request classification ---------------- */
function classify(prompt, images, tier) {
  if (images.length || tier === 'complex') return 'import';
  return prompt.length > MAX_PROMPT.small ? 'long' : 'small';
}

/* free trial: reserve one credit (and refund it if the model call fails) */
async function reserveFree(device, ip, kind, ticket) {
  const day = beijingDay();
  // The call right after a free import is its word-tagging step: let it through on the ticket,
  // whatever its length. Long prompts are only ever allowed this way on the free trial.
  if (kind !== 'import' && /^[a-f0-9]{32}$/.test(ticket)) {
    const [ok] = await store.run([['GETDEL', 'cr:ticket:' + ticket]]);
    if (ok) return { refund: () => store.run([['SET', 'cr:ticket:' + ticket, '1', 'EX', 900]]).catch(() => {}) };
  }
  if (kind === 'long') return { error: 'forbidden' };
  const dKey = `cr:dev:${device}:${kind}`, ipKey = `cr:ip:${day}:${ip}`, gKey = `cr:all:${day}`;
  const [d, i, , g] = await store.run([['INCR', dKey], ['INCR', ipKey], ['EXPIRE', ipKey, 172800], ['INCR', gKey], ['EXPIRE', gKey, 172800]]);
  const refund = () => store.run([['DECR', dKey], ['DECR', ipKey], ['DECR', gKey]]).catch(() => {});
  const cap = kind === 'import' ? LIMIT.imports : LIMIT.small;
  if (d > cap) { await refund(); return { error: 'free_used_up' }; }
  if (i > LIMIT.ipDaily || g > LIMIT.globalDaily) { await refund(); return { error: 'busy_today' }; }
  return { refund };
}

async function freeLeft(device) {
  if (!store) return { enabled: false };
  const [a, b] = await store.run([['MGET', `cr:dev:${device}:import`, `cr:dev:${device}:small`]])
    .then(r => r[0]);
  return {
    enabled: !!env.DEEPSEEK_API_KEY,
    importsLeft: Math.max(0, LIMIT.imports - (+a || 0)), smallLeft: Math.max(0, LIMIT.small - (+b || 0)),
    imports: LIMIT.imports, small: LIMIT.small
  };
}
const quotaHeader = q => q && q.enabled !== false ? { 'X-CR-Free': `${q.importsLeft},${q.smallLeft}` } : {};

/* ---------------- the model call ---------------- */
// With `sink`, the model's text is streamed as it is generated (sink.start() sends the response
// headers, sink.write() each piece). Without it, the whole reply is read at once.
async function callModel({ url, key, model, deepseek }, kind, prompt, images, signal, sink) {
  const content = images.length
    ? [{ type: 'text', text: prompt }, ...images.map(u => ({ type: 'image_url', image_url: { url: u } }))]
    : prompt;
  const body = { model, messages: [{ role: 'user', content }], max_tokens: MAX_TOKENS[kind], stream: !!sink };
  if (deepseek) body.thinking = { type: 'disabled' };         // faster and cheaper for structured output
  const why = () => signal.reason === 'client' ? 499 : signal.reason === 'timeout' ? 504 : 502;
  let r;
  try {
    r = await fetch(env.CR_UPSTREAM_OVERRIDE || url, {
      method: 'POST', signal,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { return { status: why() }; }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    return { status: r.status, message: (data && data.error && data.error.message) || '' };
  }
  if (!sink) {
    const data = await r.json().catch(() => ({}));
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    return { status: 200, text: msg ? msg.content : '' };
  }
  // Server-sent events: lines of `data: {json}` ending with `data: [DONE]`.
  sink.start();
  let text = '', buf = '';
  try {
    const rd = r.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const d = JSON.parse(data).choices[0].delta;
          if (d && d.content) { text += d.content; sink.write(d.content); }
        } catch (e) { /* keep-alive or a provider-specific line */ }
      }
    }
  } catch (e) { return { status: why(), streamed: true }; }
  return { status: 200, text, streamed: true };
}

const END = '\u0001';   // stream mode: the model text, then END + {"value":…} or {"error":…}

/* ---------------- handler ---------------- */
module.exports = async function handler(req, res) {
  try {
    // Only this site's pages may call us from a browser (other sites get blocked here and by CORS).
    const origin = req.headers.origin;
    if (origin) {
      let host = ''; try { host = new URL(origin).host; } catch (e) {}
      if (host !== req.headers.host) return fail(res, 403, 'forbidden');
    }

    const device = String(req.headers['x-cr-device'] || '');
    if (!/^[A-Za-z0-9-]{16,64}$/.test(device)) return fail(res, 400, 'bad_request');

    if (req.method === 'GET') {
      const q = await freeLeft(device).catch(() => ({ enabled: false }));
      return send(res, 200, { free: q, providers: Object.keys(PROVIDERS) });
    }
    if (req.method !== 'POST') return fail(res, 405, 'bad_request');

    let input;
    try { input = await readBody(req); } catch (e) { return fail(res, e && e.status === 413 ? 413 : 400, e && e.status === 413 ? 'prompt_too_large' : 'bad_request'); }
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    const images = Array.isArray(input.images) ? input.images.filter(u => typeof u === 'string') : [];
    if (!prompt) return fail(res, 400, 'bad_request');
    if (images.some(u => !/^data:image\/(jpeg|png|webp|gif);base64,/.test(u))) return fail(res, 400, 'bad_request');
    const kind = classify(prompt, images, input.modelTier);
    if (prompt.length > MAX_PROMPT[kind]) return fail(res, 413, 'prompt_too_large');
    if (images.length > MAX_IMAGES) return fail(res, 413, 'prompt_too_large');

    const ip = clientIp(req);
    const byokProvider = String(req.headers['x-cr-provider'] || '');
    const byokKey = String(req.headers['x-cr-key'] || '');
    let target, reservation = null;

    if (byokKey) {
      /* ---- bring your own key ---- */
      const P = PROVIDERS[byokProvider];
      const model = String(req.headers['x-cr-model'] || '') || (P && P.model) || '';
      if (!P || !/^[\x21-\x7e]{8,300}$/.test(byokKey) || !/^[A-Za-z0-9._:\/-]{1,100}$/.test(model)) return fail(res, 400, 'bad_request');
      if (store) {
        const k = `cr:byok:${hourSlot()}:${device}`;
        const [n] = await store.run([['INCR', k], ['EXPIRE', k, 7200]]);
        if (n > LIMIT.byokHourly) return fail(res, 429, 'rate_limited');
      }
      target = { url: P.url, key: byokKey, model, deepseek: !!P.deepseek };
    } else {
      /* ---- free trial on the owner's key ---- */
      if (!env.DEEPSEEK_API_KEY || !store) return fail(res, 503, 'ai_unavailable');
      reservation = await reserveFree(device, ip, kind, String(req.headers['x-cr-ticket'] || ''));
      if (reservation.error) {
        const code = reservation.error === 'free_used_up' ? 402 : reservation.error === 'busy_today' ? 429 : 403;
        return fail(res, code, reservation.error, quotaHeader(await freeLeft(device).catch(() => null)));
      }
      target = { url: PROVIDERS.deepseek.url, key: env.DEEPSEEK_API_KEY, model: env.FREE_MODEL || PROVIDERS.deepseek.model, deepseek: true };
    }

    // Headers known before the model answers: remaining free credits, and for a free import the
    // one-time ticket for its word-tagging follow-up (only activated once the import succeeds).
    const headers = {};
    const ticket = reservation && kind === 'import' ? require('crypto').randomBytes(16).toString('hex') : '';
    if (ticket) headers['X-CR-Ticket'] = ticket;
    if (!byokKey) Object.assign(headers, quotaHeader(await freeLeft(device).catch(() => null)));

    // Stop the model call (and give the credit back) if the visitor presses 停止 or closes the page.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort('timeout'), TIMEOUT_MS);
    res.on('close', () => { if (!res.writableEnded) ctl.abort('client'); });

    const streaming = input.stream === true;
    const sink = streaming ? {
      start() {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Accel-Buffering', 'no');
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        if (res.flushHeaders) res.flushHeaders();
      },
      write(t) { res.write(t); }
    } : null;

    const out = await callModel(target, kind, prompt, images, ctl.signal, sink);
    clearTimeout(timer);
    let value, error = '';
    if (out.status !== 200) {
      if (!byokKey && out.status !== 499) console.error('[sample] free-trial upstream', out.status, (out.message || '').slice(0, 200));
      const s = out.status;
      error = byokKey && (s === 401 || s === 403) ? 'bad_key'
        : byokKey && s === 402 ? 'no_balance'
        : s === 429 ? 'rate_limited'
        : byokKey && (s === 400 || s === 404 || s === 422) ? 'model_rejected'
        : !byokKey && (s === 401 || s === 402) ? 'ai_unavailable'
        : 'upstream_error';
    } else {
      try { value = parseJson(out.text); } catch (e) { error = 'invalid_json'; }
    }
    if (error) {
      if (reservation) await reservation.refund();
      if (out.status === 499) return res.end();                 // nobody is listening any more
      if (out.streamed) return res.end(END + JSON.stringify({ error }));
      const code = { bad_key: 401, no_balance: 402, rate_limited: 429, model_rejected: 502, ai_unavailable: 503, invalid_json: 422 }[error] || (out.status === 504 ? 504 : 502);
      return fail(res, code, error);
    }
    if (ticket) await store.run([['SET', 'cr:ticket:' + ticket, '1', 'EX', 900]]).catch(() => {});
    if (out.streamed) return res.end(END + JSON.stringify({ value }));
    return send(res, 200, value, headers);
  } catch (e) {
    console.error('[sample] error', e && e.message);
    if (res.headersSent) return res.end(END + JSON.stringify({ error: 'upstream_error' }));
    return fail(res, 500, 'upstream_error');
  }
};
