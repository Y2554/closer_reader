// These tests exercise the reader, not the first-visit front page (that is covered in e2e_ai.py).
try { localStorage.setItem('cr.welcomed', 'true'); } catch (e) {}
/* In-memory stand-in for the claude.ai artifact runtime (window.claude).
   Implements just the surface the page uses: db.doc(path).set/update/delete/onSnapshot,
   db.collection(path).onSnapshot, and downloads.save. 'sample' (Claude calls) is not
   stubbed, so import / AI notes show their "unavailable" state.
   Seeds two articles from seeds/. Add ?stand to the URL for 8 extra papers across 3 days
   (newsstand fixtures). Everything lives in window.__store and is lost on reload. */
(() => {
  const store = {};   // path -> data
  const subs = [];    // {kind:'col'|'doc', path, fn}
  const colOf = p => p.split('/').slice(0, -1).join('/');
  const fire = (path) => {
    subs.forEach(s => {
      if (s.kind === 'col' && colOf(path) === s.path) s.fn(colSnap(s.path));
      if (s.kind === 'doc' && s.path === path) s.fn(docSnap(path));
    });
  };
  const docSnap = p => ({ id: p.split('/').pop(), exists: p in store, data: () => store[p] ? JSON.parse(JSON.stringify(store[p])) : undefined });
  const colSnap = c => { const docs = Object.keys(store).filter(p => colOf(p) === c).map(docSnap); return { docs, size: docs.length, empty: !docs.length }; };
  const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = b[k]; } return a; };
  const db = {
    doc: p => ({
      set: async d => { store[p] = JSON.parse(JSON.stringify(d)); window.__writes = (window.__writes || 0) + 1; setTimeout(() => fire(p), 5); },
      update: async d => { if (!(p in store)) throw { code: 'invalid_argument' }; merge(store[p], JSON.parse(JSON.stringify(d))); setTimeout(() => fire(p), 5); },
      delete: async () => { delete store[p]; setTimeout(() => fire(p), 5); },
      onSnapshot: (fn) => { subs.push({ kind: 'doc', path: p, fn }); setTimeout(() => fn(docSnap(p)), 10); return () => {}; }
    }),
    collection: c => ({ onSnapshot: (fn) => { subs.push({ kind: 'col', path: c, fn }); setTimeout(() => fn(colSnap(c)), 10); return () => {}; } })
  };
  window.__store = store;
  window.__seed = async () => {
    const seed = await (await fetch('seeds/seed-dog.json')).json();
    store['articles/dog-cognition'] = seed; store['articles/gratitude-lifesaving'] = await (await fetch('seeds/seed-gratitude.json')).json(); store['articles/ai-judgment'] = await (await fetch('seeds/seed-ai-judgment.json')).json(); store['articles/reading-wars'] = await (await fetch('seeds/seed-reading-wars.json')).json(); store['articles/cn-culture'] = await (await fetch('seeds/seed-cn-culture.json')).json();
    if (location.search.includes('stand')) {
      const D = 864e5, now = Date.now();
      const g = store['articles/gratitude-lifesaving']; g.createdAt = now - 3600e3;
      store['articles/dog-cognition'].createdAt = now - 1.2 * D;
      const clone = (src, id, title, zh, t) => { const c = JSON.parse(JSON.stringify(src)); c.id = id; c.title = title; c.zh = zh; c.createdAt = t; store['articles/' + id] = c; };
      clone(g, 'g2', 'Why Cities Need More Trees Than Ever', '城市为何比以往更需要树木', now - 2 * 3600e3);
      clone(seed, 'd2', 'The Quiet Revolution in Remote Work', '远程办公的静悄悄革命', now - 3 * 3600e3);
      clone(g, 'g3', 'Can Boredom Make You More Creative?', '无聊能让你更有创造力吗', now - 4 * 3600e3);
      clone(seed, 'd3', 'Sleep, Memory and the Teenage Brain', '睡眠、记忆与青少年的大脑', now - 4.5 * 3600e3);
      clone(seed, 'd4', 'Plastic Oceans', '塑料海洋', now - 5 * D);
      clone(g, 'g4', 'What Bees Teach Us About Democracy', '蜜蜂教给我们的民主', now - 5 * D - 3600e3);
      store['progress/gratitude-lifesaving'] = { attempts: [{ score: 7, total: 10, secs: 812, at: now - 1000 }], lastOpened: now - 1000 };
      store['progress/g3'] = { attempts: [{ score: 4, total: 10, secs: 900, at: now }, { score: 5, total: 10, secs: 700, at: now }], lastOpened: now - 2 * D };
      const picks = {}; Object.entries(seed.blanks).forEach(([n, b]) => picks[n] = b.ans);
      store['progress/d2'] = { picks, lastOpened: now - D };
      const pp = {}; Object.entries(seed.blanks).slice(0, 4).forEach(([n, b]) => pp[n] = b.ans);
      store['progress/d4'] = { picks: pp, lastOpened: now - 3 * D };
    }
    store['words/domestic'] = { w: 'domestic', forms: ['domestic','domestics'], status: 'new', cat: '', pos: 'adj.', zh: '家养的；驯养的', en: 'kept by people', ph: 'dəˈmɛstɪk', lvl: '4', ctx: [{ art: 'dog-cognition', title: 'Are Dogs Really That Smart?', p: 0, s: 1, text: 'The researchers found that dogs are among the more intelligent carnivores (食肉动物), social hunters, and domestic animals, but that their intelligence does not ____ other intelligent animals in any of those categories.', at: 1 }], at: 1, up: 1, srs: null };
  };
  const ready = window.__seed();
  window.__saved = [];
  window.claude = { use: async name => {
    await ready;
    if (name === 'db') return db;
    if (name === 'sample' && location.search.includes('sample')) return { json: async (prompt) => { window.__prompts = (window.__prompts || []).concat(prompt); await new Promise(r => setTimeout(r, 300)); return { score: 11, band: '11 分档', summary: '基本表达了原文意思，个别搭配和时态有误。', good: ['用 a growing number of 表达“越来越多的”'], fixes: [{ orig: 'Chinese culture products is popular', fix: 'Chinese cultural products are popular', why: '形容词 cultural 作定语；主语复数，谓语用 are' }], polished: 'In recent years, a growing number of Chinese cultural products have entered the global market.' }; } };
    if (name === 'downloads') return { save: async ({ filename, data }) => { window.__saved.push({ filename, size: (data && data.length) || 0, head: String(data).slice(0, 200) }); return { status: 'saved' }; } };
    return null;
  } };
})();
