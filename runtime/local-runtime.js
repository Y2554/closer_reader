/* local-runtime.js — run The Close Reader outside claude.ai.
 *
 * On claude.ai the page gets window.claude from the Artifact runtime. Anywhere else
 * (a static server, GitHub Pages, a local folder) this file provides the same surface:
 *
 *   claude.use('db')        → IndexedDB-backed document store (persists in this browser)
 *   claude.use('downloads') → save({ filename, data }) via a Blob download
 *   claude.use('sample')    → Claude calls; only if window.CLOSE_READER_SAMPLE_ENDPOINT is set
 *
 * Load it BEFORE the page script. index.html (built by src/assemble.py) already does.
 * If window.claude already exists (i.e. inside claude.ai) this file does nothing.
 *
 * Optional config, set before this script loads:
 *   window.CLOSE_READER_SEED = false               // don't import seeds/*.json on first run
 *   window.CLOSE_READER_SAMPLE_ENDPOINT = '/api/sample'
 *     POST { prompt, images: [dataURL…], modelTier } → JSON body = the parsed model output
 *     (an object or array). 429 rate limit · 422 model returned no JSON · 413 too large ·
 *     anything else non-2xx → "can't call Claude". server/dev-server.mjs implements this.
 */
(() => {
  if (window.claude && typeof window.claude.use === 'function') return;

  /* ---------- tiny IndexedDB key/value: key = full doc path ("words/abandon") ---------- */
  const DB_NAME = 'close-reader', STORE = 'docs';
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const idbP = open();
  const tx = async (mode, fn) => {
    const db = await idbP;
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode); const st = t.objectStore(STORE); let out;
      Promise.resolve(fn(st, v => { out = v; })).catch(rej);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  /* in-memory mirror so snapshots are synchronous and cheap */
  const mem = new Map();
  const ready = (async () => {
    await tx('readonly', async (st, out) => {
      const kR = st.getAllKeys(), vR = st.getAll();
      const [keys, vals] = await Promise.all([req(kR), req(vR)]);
      keys.forEach((k, i) => mem.set(k, vals[i])); out();
    });
  })();

  const ID_OK = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const colOf = p => p.split('/').slice(0, -1).join('/');
  const checkDoc = p => {
    const seg = String(p).split('/');
    if (seg.length % 2 || !seg.every(s => ID_OK.test(s))) throw { code: 'invalid_argument', message: 'bad doc path: ' + p };
  };
  const merge = (a, b) => {
    for (const k in b) {
      const v = b[k];
      if (v && typeof v === 'object' && v.__delete__ === true) { delete a[k]; continue; }
      if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v);
      else a[k] = clone(v);
    }
    return a;
  };

  const subs = new Set();   // { kind: 'doc'|'col', path, fn }
  const docSnap = p => ({ id: p.split('/').pop(), exists: mem.has(p), data: () => clone(mem.get(p)) });
  const colSnap = c => {
    const docs = [...mem.keys()].filter(p => colOf(p) === c).sort().map(docSnap);
    return { docs, size: docs.length, empty: !docs.length };
  };
  let pending = new Set(), flushT = 0;
  const fire = path => {
    pending.add(path);
    if (flushT) return;
    flushT = setTimeout(() => {
      const paths = pending; pending = new Set(); flushT = 0;
      subs.forEach(s => {
        if (s.kind === 'doc' && paths.has(s.path)) s.fn(docSnap(s.path));
        if (s.kind === 'col' && [...paths].some(p => colOf(p) === s.path)) s.fn(colSnap(s.path));
      });
    }, 0);
  };
  const persist = (p, v) => tx('readwrite', st => { v === undefined ? st.delete(p) : st.put(v, p); })
    .catch(e => { throw (e && e.name === 'QuotaExceededError') ? { code: 'quota_exceeded' } : e; });

  const db = {
    doc(path) {
      checkDoc(path);
      return {
        async get() { await ready; return docSnap(path); },
        async set(data) { await ready; const v = clone(data); mem.set(path, v); fire(path); await persist(path, v); },
        async update(data) {
          await ready;
          if (!mem.has(path)) throw { code: 'not_found' };
          const v = merge(clone(mem.get(path)), data); mem.set(path, v); fire(path); await persist(path, v);
        },
        async delete() { await ready; mem.delete(path); fire(path); await persist(path, undefined); },
        onSnapshot(fn) {
          const s = { kind: 'doc', path, fn }; subs.add(s);
          ready.then(() => subs.has(s) && fn(docSnap(path)));
          return () => subs.delete(s);
        }
      };
    },
    collection(path) {
      return {
        async get() { await ready; return colSnap(path); },
        onSnapshot(fn) {
          const s = { kind: 'col', path, fn }; subs.add(s);
          ready.then(() => subs.has(s) && fn(colSnap(path)));
          return () => subs.delete(s);
        }
      };
    }
  };

  /* first run: import the two sample articles so the page isn't empty */
  const seeded = ready.then(async () => {
    if (window.CLOSE_READER_SEED === false || mem.has('meta/seeded')) return;
    const has = [...mem.keys()].some(p => p.startsWith('articles/'));
    if (!has) {
      for (const f of ['seeds/seed-dog.json', 'seeds/seed-gratitude.json', 'seeds/seed-ai-judgment.json', 'seeds/seed-reading-wars.json', 'seeds/seed-cn-culture.json']) {
        try { const a = await (await fetch(f)).json(); if (a && a.id) await db.doc('articles/' + a.id).set(a); } catch (e) { /* seeds optional */ }
      }
    }
    await db.doc('meta/seeded').set({ at: Date.now() });
  });

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return { status: 'saved' };
    }
  };

  /* ---------- AI calls: POST to our own /api/sample (see api/sample.js) ---------- */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  };
  // A random id for this browser, so the free trial can be counted per device. Not personal data.
  let device = ls.get('cr-device');
  if (!device || !/^[A-Za-z0-9-]{16,64}$/.test(device)) {
    device = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
    ls.set('cr-device', device);
  }
  // The user's own API key (optional). Lives only in this browser's localStorage.
  const aiCfg = () => { try { const c = JSON.parse(ls.get('cr-ai') || 'null'); return c && c.key ? c : null; } catch (e) { return null; } };
  const quota = { enabled: null, importsLeft: null, smallLeft: null };
  const changed = () => window.dispatchEvent(new CustomEvent('cr-ai-change'));
  const readQuota = r => {
    const h = r.headers.get('X-CR-Free');
    if (h) { const [a, b] = h.split(',').map(Number); quota.enabled = true; quota.importsLeft = a; quota.smallLeft = b; changed(); }
  };
  let ticket = '';   // one-time pass so an import's follow-up word-tagging call isn't charged twice

  // Phone photos are 3–10 MB each; a request to Vercel may be at most 4.5 MB, and DeepSeek scales
  // every image down to about 1300×1300 px anyway. So: ≤1600 px on the long side, JPEG, white
  // background — and if several pages together still exceed ~3.6 MB, shrink them all further.
  const toDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
  async function shrinkAll(files) {
    let max = 1600, q = 0.82, out = [];
    for (let round = 0; round < 3; round++) {
      out = await Promise.all(files.map(f => typeof f === 'string' ? f : shrink(f, max, q)));
      if (out.reduce((n, u) => n + u.length, 0) <= 3.6e6) break;
      max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.1);
    }
    return out;
  }
  async function shrink(file, max, q) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    } catch (e) { return toDataURL(file); }   // couldn't decode: send as is, the server will judge
    finally { URL.revokeObjectURL(url); }
  }

  const ERR = {   // server error code → the page's error codes (sampleErr in src/base.html)
    free_used_up: 'free_used_up', busy_today: 'busy_today', bad_key: 'bad_key', no_balance: 'no_balance',
    model_rejected: 'model_rejected', invalid_json: 'invalid_json', prompt_too_large: 'prompt_too_large',
    rate_limited: 'rate_limited', ai_unavailable: 'ai_unavailable', forbidden: 'ai_unavailable'
  };
  const EP = window.CLOSE_READER_SAMPLE_ENDPOINT;
  const headersFor = () => {
    const h = { 'Content-Type': 'application/json', 'X-CR-Device': device };
    const c = aiCfg();
    if (c) { h['X-CR-Provider'] = c.provider || 'deepseek'; h['X-CR-Key'] = c.key; if (c.model) h['X-CR-Model'] = c.model; }
    else if (ticket) h['X-CR-Ticket'] = ticket;
    return h;
  };
  const sample = EP ? {
    async json(prompt, opts = {}) {
      const images = opts.images ? await shrinkAll(opts.images) : [];
      const usedTicket = ticket;
      // With opts.onText the reply is streamed: onText({ text }) gets the model's text so far,
      // which the import page turns into live progress. See "Stream mode" in api/sample.js.
      const stream = typeof opts.onText === 'function';
      const gone = e => (e && e.name === 'AbortError') || (opts.signal && opts.signal.aborted) ? { code: 'cancelled' } : { code: 'network' };
      let r;
      try {
        r = await fetch(EP, {
          method: 'POST', headers: headersFor(), signal: opts.signal,
          body: JSON.stringify({ prompt, images, modelTier: opts.modelTier || 'default', stream })
        });
      } catch (e) { throw gone(e); }
      readQuota(r);
      if (r.headers.get('X-CR-Ticket')) ticket = r.headers.get('X-CR-Ticket');
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw { code: ERR[body && body.error] || (r.status === 413 ? 'prompt_too_large' : r.status === 429 ? 'rate_limited' : 'ai_unavailable') };
      }
      if (!/^text\/plain/.test(r.headers.get('Content-Type') || '')) {
        let v; try { v = await r.json(); } catch (e) { throw { code: 'invalid_json' }; }
        if (usedTicket && usedTicket === ticket) ticket = '';
        return v;
      }
      let all = '', last = 0;
      try {
        const rd = r.body.getReader(), dec = new TextDecoder();
        for (;;) {
          const { value, done } = await rd.read();
          if (done) break;
          all += dec.decode(value, { stream: true });
          const k = all.indexOf('\u0001');
          const text = k < 0 ? all : all.slice(0, k);
          if (text.length !== last) { last = text.length; try { opts.onText({ text }); } catch (e) {} }
        }
      } catch (e) { throw gone(e); }
      const k = all.indexOf('\u0001');
      if (k < 0) throw { code: 'network' };                      // the connection dropped mid-way
      let end; try { end = JSON.parse(all.slice(k + 1)); } catch (e) { throw { code: 'network' }; }
      if (end.error) throw { code: ERR[end.error] || 'ai_unavailable' };
      if (usedTicket && usedTicket === ticket) ticket = '';   // used up only by a successful call
      return end.value;
    }
  } : null;

  /* Small API for runtime/ai-panel.js (the "AI 设置" box on the import page). */
  window.CR_AI = EP ? {
    providers: [
      { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-flash', hint: '可不填，默认 deepseek-flash（能看图）' },
      { id: 'qwen', name: '通义千问（阿里云百炼）', hint: '例如 qwen-vl-max；拍照导入要选能看图的 VL 模型' },
      { id: 'moonshot', name: 'Kimi（月之暗面）', hint: '填平台文档里的模型名' },
      { id: 'zhipu', name: '智谱 GLM', hint: '填平台文档里的模型名；看图要选 V 系列' },
      { id: 'doubao', name: '豆包（火山方舟）', hint: '填推理接入点 ID（ep- 开头）或模型名' }
    ],
    get: aiCfg,
    set(c) { ls.set('cr-ai', c && c.key ? JSON.stringify({ provider: c.provider, key: c.key, model: c.model || '' }) : null); changed(); },
    quota: () => ({ ...quota }),
    async refresh() {
      try {
        const r = await fetch(EP, { headers: { 'X-CR-Device': device } });
        const d = r.ok ? await r.json() : null;
        if (d && d.free) Object.assign(quota, { enabled: !!d.free.enabled, importsLeft: d.free.importsLeft ?? null, smallLeft: d.free.smallLeft ?? null });
        else quota.enabled = false;              // no /api/sample here (e.g. a plain static server)
        changed();
      } catch (e) { if (quota.enabled == null) { quota.enabled = false; changed(); } }
      return { ...quota };
    }
  } : null;

  window.claude = {
    local: true,
    async use(name) {
      if (name === 'db') { await seeded; return db; }
      if (name === 'downloads') return downloads;
      if (name === 'sample') return sample;
      return null;
    }
  };
})();
