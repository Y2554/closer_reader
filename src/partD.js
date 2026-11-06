/* ---------- boot ---------- */
function migrateVocab(){
  if (!S.wordsLoaded || !S.legacy || !S.legacy.length) return;
  const L = S.legacy; S.legacy = [];
  L.forEach(v => {
    const k = wkey(v.w); if (!k) return;
    if (!S.words[k]) upsertWord(k, { status: v.done ? 'known' : 'new', at: v.at || Date.now(), forms: [k, ...inflect(k)], fill: { pos: v.pos, zh: v.zh, en: v.en, ph: v.ph } },
      v.p != null ? { art: v.art, title: v.title, p: v.p, s: v.s, text: v.ctx || '', at: v.at || Date.now() } : null);
    write('vocab/' + v.id, ref => ref.delete());
  });
}
render();
loadLevel().then(() => {
  if (S.view === 'read') { renderView(); textChanged(); if (S.panel && S.panel.type === 'nw') renderPanel(true); }
}).catch(() => {});
(async () => {
  const C = window.claude;
  if (!C || typeof C.use !== 'function') { S.dbState = 'none'; render(); return; }
  C.use('sample').then(s => { S.sample = s || null; if (S.view === 'import') { S.impDirty = true; renderView(); } else renderPop(true); }).catch(() => {});
  C.use('downloads').then(d => { S.dl = d || null; }).catch(() => {});
  let db = null;
  try { db = await C.use('db'); } catch(e){ db = null; }
  if (!db) { S.dbState = 'none'; render(); return; }
  S.db = db;
  const settle = () => { if (!S.userChose) S.cur = pickDefault(); };
  const quietVocab = () => S.view === 'vocab' && (S.rv || S.dt || S.vtab === 'backup');
  db.collection('articles').onSnapshot(snap => {
    S.articles = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
    S.dbState = 'ok';
    if (S.cur && !S.articles.find(a => a.id === S.cur)) S.cur = null;
    if (!S.cur) settle();
    renderChrome(); repairCtx();
    if (S.view === 'read' || S.view === 'archive') { renderView(); afterReadRender(); renderPanel(true); renderPop(true); }
  }, () => { S.dbState = 'err'; render(); });
  db.collection('progress').onSnapshot(snap => {
    let changed = false;
    snap.docs.forEach(d => { const v = d.data(); if (canon(v) !== canon(S.prog[d.id])) { changed = true; S.prog[d.id] = v; } });
    if (!changed && S.progLoaded) return;
    S.progLoaded = true;
    if (!S.userChose) settle();
    if (S.view === 'read' || S.view === 'archive') { renderChrome(); renderView(); afterReadRender(); if (S.panel) renderPanel(true); }
  }, () => {});
  db.collection('notes').onSnapshot(snap => {
    snap.docs.forEach(d => { S.notes[d.id] = d.data(); });
    const P = popCur(); if (P && P.showDetail) renderPop(true);
  }, () => {});
  db.collection('words').onSnapshot(snap => {
    const m = {};
    snap.docs.forEach(d => { const v = d.data(); if (v && v.w) m[v.w] = { ...v, _id: d.id }; });
    const same = S.wordsLoaded && Object.keys(m).length === Object.keys(S.words).length && Object.keys(m).every(k => canon(m[k]) === canon(S.words[k]));
    S.words = m; S.wordsLoaded = true; rebuildIdx(); migrateVocab(); repairCtx();
    if (same) return;
    renderChrome();
    if (S.view === 'read') { renderView(); afterReadRender(); if (S.panel && S.panel.type === 'nw') renderPanel(true); }
    else if (S.view === 'vocab' && !quietVocab()) { if (S.vtab === 'list') renderVocabList(); else renderView(); }
    else if (S.view === 'archive') renderView();
    if (popCur()) renderPop(true);
  }, () => {});
  db.doc('meta/settings').onSnapshot(snap => {
    const d = snap.exists ? snap.data() : null;
    S.cats = d && Array.isArray(d.cats) ? d.cats.map(String) : [];
    if (popCur()) renderPop(true);
    if (S.view === 'vocab' && S.vtab === 'list') renderVocabList();
  }, () => {});
  db.collection('mistakes').onSnapshot(snap => {
    const m = {}; snap.docs.forEach(d => { m[d.id] = { ...d.data(), _id: d.id }; });
    const same = Object.keys(m).length === Object.keys(S.mistakes).length && Object.keys(m).every(k => canon(m[k]) === canon(S.mistakes[k]));
    S.mistakes = m; renderChrome();
    if (!same && S.view === 'mistakes' && !Object.keys(S.mkRetry).length) renderView();
  }, () => {});
  db.collection('vocab').onSnapshot(snap => {
    S.legacy = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    migrateVocab();
  }, () => {});
})();
