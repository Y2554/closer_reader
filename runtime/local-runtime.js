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

  const toDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
  const sample = window.CLOSE_READER_SAMPLE_ENDPOINT ? {
    async json(prompt, opts = {}) {
      const images = opts.images ? await Promise.all(opts.images.map(i => typeof i === 'string' ? i : toDataURL(i))) : [];
      let r;
      try {
        r = await fetch(window.CLOSE_READER_SAMPLE_ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: opts.signal,
          body: JSON.stringify({ prompt, images, modelTier: opts.modelTier || 'default' })
        });
      } catch (e) { throw (e && e.name === 'AbortError') ? { code: 'cancelled' } : { code: 'network' }; }
      if (r.status === 429) throw { code: 'rate_limited' };
      if (r.status === 422) throw { code: 'invalid_json' };
      if (r.status === 413) throw { code: 'prompt_too_large' };
      if (!r.ok) throw { code: 'sampling_disabled' };
      try { return await r.json(); } catch (e) { throw { code: 'invalid_json' }; }
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
