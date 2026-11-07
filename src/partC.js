/* ---------- actions ---------- */
function openArticle(id){
  examPause(); S.enter = S.view !== 'read' || S.cur !== id; S.examSel = null; S.confirmMode = false;
  S.cur = id; S.userChose = true; S.view = 'read'; S.panel = null; S.pop = [];
  S.openZh = new Set(); S.unguard = new Set(); S.confirmReset = false;
  const p = progOf(id); p.lastOpened = Date.now(); setProg(id, p);
  render(); afterReadRender(); window.scrollTo({ top: 0 });
}
function pickDefault(){
  if (!S.articles.length) return null;
  let best = null, t = -1;
  S.articles.forEach(a => { const lo = (S.prog[a.id] || {}).lastOpened || 0; if (lo > t) { t = lo; best = a.id; } });
  return t > 0 ? best : S.articles[0].id;
}
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in'); clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }
function speak(w){
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(w); u.lang = 'en-US'; u.rate = .9; speechSynthesis.speak(u); } catch(e){}
}
function textChanged(){ marks(); placePop(); }
function addCat(){
  const i = $('#newCatIn'); const v = (i ? i.value : '').trim().slice(0, 20); const P = popCur();
  S.newCat = false;
  if (!v) { renderPop(true); return; }
  if (!S.cats.includes(v)) saveCats([...S.cats, v]);
  if (P) setCat(P, v); else renderPop(true);
}
const POP_OPENERS = new Set(['opt', 'optpop', 'nwgo', 'vlook']);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  const inPop = !!e.target.closest('#pop');
  const wEl = e.target.closest('#body .w');
  if (!inPop && popCur() && !wEl && !(t && POP_OPENERS.has(t.dataset.act))) {
    closePop();
    if (!t) return;
  }
  if (!t) {
    if (wEl && Date.now() - S.selAt > 350) {
      if (inExam(cur())) { wEl.classList.remove('nope'); void wEl.offsetWidth; wEl.classList.add('nope'); toast('考试中先不查词。想边读边查，点上方的「精讲」'); }
      else openPop(wordPopFrom(wEl));
    }
    return;
  }
  const act = t.dataset.act; const a = cur(); const P = popCur();
  if (act.startsWith('dk')) { dkAction(act, t); return; }
  if (act === 'mcpick') { mcqPick(a, t.dataset.n, t.dataset.l); return; }
  if (/^tr[a-z]/.test(act)) { trAction(act, t, a); return; }
  switch (act) {
    case 'welstart': { welcomeDone(); const id = welcomeStarter(); if (id) openArticle(id); else { S.view = 'import'; S.impDirty = true; S.enter = true; render(); } break; }
    case 'welimport': welcomeDone(); S.view = 'import'; S.impDirty = true; S.enter = true; S.panel = null; S.pop = []; render(); window.scrollTo({ top: 0 }); break;
    case 'welcome': if (S.view === 'read') examPause(); S.view = 'welcome'; S.enter = true; S.panel = null; S.pop = []; S.edit = null; render(); window.scrollTo({ top: 0 }); break;
    case 'view':
      if (S.view === 'welcome') welcomeDone();
      if (S.view === 'read') examPause();
      S.enter = S.view !== t.dataset.v; S.view = t.dataset.v; S.panel = null; S.pop = []; S.confirmDel = null; S.confirmDelW = null; S.edit = null;
      if (S.view === 'import') S.impDirty = true;
      render(); afterReadRender(); window.scrollTo({ top: 0 }); break;
    case 'close': S.panel = null; S.srcHit = null; S.confirmBulk = false; renderPanel(); break;
    case 'blank': {
      if (inExam(a)) {
        if (!(examOf(a) || {}).started) examStart(a);
        S.examSel = t.dataset.n; S.panel = { type: 'epick', n: t.dataset.n };
        renderView(); afterReadRender(); renderPanel(); break;
      }
      S.panel = { type: 'blank', n: t.dataset.n }; S.hint = false; renderPanel();
      if (!t.closest('#body') && !t.closest('.mq')) { const b = $(`.story .blank[data-n="${t.dataset.n}"]`); if (b && window.innerWidth >= 1040) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      break;
    }
    case 'pick': {
      const p = progOf(a.id); p.picks[t.dataset.n] = t.dataset.l; delete p.shown[t.dataset.n];
      setProg(a.id, p);
      if (t.dataset.l !== a.blanks[t.dataset.n].ans) recordMistake(a, t.dataset.n, t.dataset.l);
      S.justFilled = t.dataset.n; renderView(); afterReadRender(); renderPanel(); break;
    }
    case 'show': { const p = progOf(a.id); p.shown[t.dataset.n] = true; setProg(a.id, p); recordMistake(a, t.dataset.n, ''); S.justFilled = t.dataset.n; renderView(); afterReadRender(); renderPanel(); break; }
    case 'redo': { const p = progOf(a.id); delete p.picks[t.dataset.n]; delete p.shown[t.dataset.n]; setProg(a.id, p); S.hint = false; renderView(); renderPanel(); break; }
    case 'hint': S.hint = !S.hint; renderPanel(true); break;
    case 'revealAll': { const p = progOf(a.id); blankNums(a).forEach(n => { if (!st(a, n).done) p.shown[n] = true; }); setProg(a.id, p); renderView(); renderPanel(); break; }
    case 'reset': {
      if (!S.confirmReset) { S.confirmReset = true; renderView(); textChanged(); setTimeout(() => { if (S.confirmReset) { S.confirmReset = false; if (S.view === 'read') { renderView(); textChanged(); } } }, 3500); break; }
      S.confirmReset = false; const p = progOf(a.id); p.picks = {}; p.shown = {}; setProg(a.id, p); S.unguard = new Set(); S.panel = null; renderView(); renderPanel(); toast('已清空本篇作答'); break;
    }
    /* floating word card */
    case 'opt': {
      if (inExam(a)) {
        if (!S.examSel) { toast('先点文中的一个空格，再选词'); break; }
        const n = S.examSel; examFill(a, n, t.dataset.l);
        const nx = nextEmpty(a, n); S.examSel = nx || n; S.panel = { type: 'epick', n: S.examSel };
        renderView(); afterReadRender(); renderPanel(); break;
      }
      if (isMatch(a)) { jumpPara(a, t.dataset.l); break; }
      const np = optPop(t.dataset.l, true); if (np) openPop(np); break;
    }
    case 'gosrc': if (a) goSrc(a, t.dataset.n); break;
    case 'backq': if (a && S.srcHit) { const n = S.srcHit.n; S.panel = { type: 'blank', n }; renderPanel(); } break;
    case 'efill': {
      if (!a) break; const n = t.dataset.n; examFill(a, n, t.dataset.l);
      if (t.dataset.l) { const nx = nextEmpty(a, n); if (nx) { S.examSel = nx; S.panel = { type: 'epick', n: nx }; } }
      renderView(); afterReadRender(); renderPanel(); break;
    }
    case 'enext': { if (!a) break; const nx = nextEmpty(a, t.dataset.n); if (nx) { S.examSel = nx; S.panel = { type: 'epick', n: nx }; renderView(); afterReadRender(); renderPanel(); } break; }
    case 'examstart': if (a) { examStart(a); renderView(); afterReadRender(); } break;
    case 'examsubmit': if (a) examSubmit(a); break;
    case 'mode': if (a) setMode(a, t.dataset.m); break;
    case 'retake': if (a) retake(a); break;
    /* mistakes */
    case 'mktype': S.mkType = S.mkType === t.dataset.t ? 'all' : t.dataset.t; renderView(); break;
    case 'mkdoneview': S.mkShowDone = !S.mkShowDone; renderView(); break;
    case 'mkretry': S.mkRetry[t.dataset.id] = { no: [] }; renderMkCard(t.dataset.id); break;
    case 'mkpick': mkPick(t.dataset.id, t.dataset.l); break;
    case 'mkdone': setResolved(t.dataset.id, true); delete S.mkRetry[t.dataset.id]; toast('已标为掌握'); if (S.mkShowDone) renderMkCard(t.dataset.id); else { const el = document.getElementById('mk-' + t.dataset.id); if (el && !reduced()) { el.classList.add('out'); setTimeout(() => renderView(), 260); } else renderView(); } renderChrome(); break;
    case 'mkundo': setResolved(t.dataset.id, false); renderMkCard(t.dataset.id); break;
    case 'mkgo': {
      const m = S.mistakes[t.dataset.id]; if (!m) break;
      openArticle(m.art); const aa = cur(); if (!aa) break;
      if (inExam(aa)) setMode(aa, 'study');
      S.panel = { type: 'blank', n: String(m.n) }; renderPanel();
      const b = $(`.story .blank[data-n="${m.n}"]`); if (b) b.scrollIntoView({ block: 'center' });
      break;
    }
    /* editor */
    case 'edopen': if (a) openEditor(a.id, false, t.dataset.n || null); break;
    case 'edsave': edSave(); break;
    case 'edcancel': { const E = S.edit; S.edit = null; if (E) openArticle(E.id); else { S.view = 'read'; render(); } break; }
    case 'optpop': { const np = optPop(t.dataset.l, false); if (np) openPop(np); break; }
    case 'pclose': closePop(); break;
    case 'pback': if (S.pop.length > 1) { S.pop.pop(); S.newCat = false; renderPop(); } break;
    case 'look': if (P) openPop({ kind: 'dict', w: t.dataset.w.toLowerCase(), disp: t.dataset.w, pos: '', anchor: P.anchor }, true); break;
    case 'detail': if (P) { P.showDetail = true; P.placed = false; loadMore(P); renderPop(true); } break;
    case 'detailoff': if (P) { P.showDetail = false; P.placed = false; renderPop(true); } break;
    case 'detailretry': if (P) { loadMore(P); renderPop(true); } break;
    case 'dictmore': S.dictAll = !S.dictAll; renderPop(true); break;
    case 'dictretry': if (P) { loadDict(P, P.w, P.pos); renderPop(true); } break;
    case 'ainote': if (P) aiNote(P); break;
    case 'pstatus': if (P) setStatus(P, t.dataset.s); break;
    case 'pcollect': if (P) collect(P); break;
    case 'pkw': {
      if (!P || !a) break; const kw = (a.keys || [])[P.k]; if (!kw) break; const k = wkey(kw.t);
      if (S.words[k]) { removeWord(k); toast(`已移出单词本：${kw.t}`); }
      else { upsertWord(k, { status: 'new', forms: [k], fill: { pos: 'phrase', zh: kw.n } }, ctxOf(P)); toast(`已收藏搭配：${kw.t}`); }
      afterWordChange(); break;
    }
    case 'addcat': addCat(); break;
    case 'lookup': if (P) lookup(a, P, t); break;
    case 'speak': speak(t.dataset.w); break;
    /* reading toggles */
    case 'ptr': { const p = +t.dataset.p; S.openZh.has(p) ? S.openZh.delete(p) : S.openZh.add(p); if (S.zhAll && !S.openZh.has(p)) S.zhAll = false; renderView(); textChanged(); break; }
    case 'unguard': S.unguard.add(t.dataset.k); if (S.view === 'read') { renderView(); renderPanel(true); } break;
    case 'toggle': {
      const k = t.dataset.k; S[k] = !S[k]; if (k !== 'zhAll') LS.set(k, S[k]); if (k === 'zhAll' && !S.zhAll) S.openZh = new Set();
      if (S.view === 'vocab') renderVocabList(); else { renderView(); textChanged(); }
      if (S.view === 'vocab') { const b = t; b.setAttribute('aria-pressed', String(S[k])); }
      break;
    }
    /* 本篇生词 */
    case 'nwopen':
      if (S.panel && S.panel.type === 'nw') { S.panel = null; renderPanel(); break; }
      closePop(); S.panel = { type: 'nw' }; S.confirmBulk = false; renderPanel();
      loadLevel().then(() => { if (S.panel && S.panel.type === 'nw') renderPanel(true); }).catch(() => toast('词汇等级表没加载出来'));
      break;
    case 'nwlvl': S.nwLvl = t.dataset.v; LS.set('nwLvl', S.nwLvl); S.confirmBulk = false; renderPanel(true); renderView(); textChanged(); break;
    case 'nwst': if (a) { nwSet(a, t.dataset.k, t.dataset.s); afterWordChange(); } break;
    case 'nwgo': {
      if (!a) break; const r = nwRows(a).find(x => x.key === t.dataset.k);
      if (r) popAt(r.p, r.s, r.i); break;
    }
    case 'nwbulk': {
      if (!a) break;
      if (!S.confirmBulk) { S.confirmBulk = true; renderPanel(true); setTimeout(() => { if (S.confirmBulk) { S.confirmBulk = false; if (S.panel && S.panel.type === 'nw') renderPanel(true); } }, 4000); break; }
      S.confirmBulk = false;
      const rows = nwRows(a).filter(r => !r.rec);
      (async () => { for (const r of rows) await nwSet(a, r.key, 'known'); toast(`${rows.length} 个词已标为已掌握`); afterWordChange(); })();
      afterWordChange(); break;
    }
    /* archive */
    case 'open': if (t.classList.contains('np')) takePaper(t, t.dataset.id); else openArticle(t.dataset.id); break;
    case 'delart': {
      const id = t.dataset.id;
      if (S.confirmDel !== id) { S.confirmDel = id; renderView(); break; }
      S.confirmDel = null; S.articles = S.articles.filter(x => x.id !== id);
      write('articles/' + id, ref => ref.delete()); write('progress/' + id, ref => ref.delete());
      if (S.cur === id) S.cur = pickDefault();
      render(); toast('已删除这篇文章（单词本里的词保留）'); break;
    }
    /* vocab book */
    case 'vtab': S.vtab = t.dataset.v; S.confirmDelW = null; renderView(); break;
    case 'vf': S.vf = t.dataset.v; renderView(); break;
    case 'vreveal': S.vshow.add(t.dataset.k); renderVocabList(); break;
    case 'vst': upsertWord(t.dataset.k, { status: t.dataset.s }); afterWordChange(); break;
    case 'vdel': {
      const k = t.dataset.k;
      if (S.confirmDelW !== k) { S.confirmDelW = k; renderVocabList(); break; }
      S.confirmDelW = null; removeWord(k); renderChrome(); renderVocabList(); toast(`已删除 ${k}`); break;
    }
    case 'goto': gotoWord(t.dataset.k); break;
    case 'vlook': { const w = S.words[t.dataset.k]; if (w) openPop({ kind: 'dict', w: w.w, disp: w.w, pos: w.pos || '', anchor: null }); break; }
    case 'rvstart': rvStart(); break;
    case 'rvshow': if (S.rv) { S.rv.shown = true; renderView(); } break;
    case 'rvrate': rvRate(+t.dataset.g); break;
    case 'rvend': S.rv = null; renderView(); break;
    case 'dtstart': dtStart(); break;
    case 'dtcheck': dtCheck(false); break;
    case 'dtskip': dtCheck(true); break;
    case 'dthint': if (S.dt) { S.dt.input = $('#dtIn') ? $('#dtIn').value : ''; S.dt.hint = true; renderView(); } break;
    case 'dtsay': if (S.dt) { S.dt.input = $('#dtIn') ? $('#dtIn').value : ''; const w = S.dt.q[S.dt.i]; speak(w); const i = $('#dtIn'); if (i) i.focus(); } break;
    case 'dtnext': dtNext(); break;
    case 'dtretry': dtStart(S.dt.wrong.map(x => x.w)); break;
    case 'dtend': S.dt = null; renderView(); break;
    case 'exjson': exportJson(); break;
    case 'excsv': exportCsv(); break;
    case 'imgo': runRestore(); break;
    case 'imcancel': S.bk = null; renderView(); break;
    case 'bkcopy': {
      const ta = $('#bkText'); if (!ta) break;
      const done = () => toast('已复制');
      try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast('已全选，按复制键复制'); }); } catch(err){ ta.select(); toast('已全选，按复制键复制'); }
      break;
    }
    /* import */
    case 'impmode': S.impMode = t.dataset.m; S.imp = null; S.impDirty = true; renderView(); break;
    case 'impgo': runImport(); break;
    case 'impdel': S.impFiles.splice(+t.dataset.i, 1); S.imp = null; S.impDirty = true; renderView(); break;
    case 'impmv': { const i = +t.dataset.i, f = S.impFiles; if (i > 0 && i < f.length) [f[i - 1], f[i]] = [f[i], f[i - 1]]; S.impDirty = true; renderView(); break; }
    case 'impstop': if (S.impCtl) S.impCtl.abort(); break;
  }
});
function gotoWord(k){
  const w = S.words[k]; if (!w) return;
  const c = (w.ctx || [])[0]; if (!c) return;
  const a = S.articles.find(x => x.id === c.art);
  if (!a) { toast('原文已被删除'); return; }
  if (S.cur !== a.id || S.view !== 'read') openArticle(a.id);
  const sent = a.paragraphs[c.p] && a.paragraphs[c.p].sentences[c.s]; if (!sent) return;
  const forms = new Set(w.forms || [w.w]);
  const i = toks(sent.en).findIndex(t => t.t === 'w' && (forms.has(t.v.toLowerCase()) || lemmaOf(t.v.toLowerCase()) === w.w));
  const sEl = $(`#body .s[data-p="${c.p}"][data-s="${c.s}"]`);
  if (sEl) { sEl.classList.remove('flash'); void sEl.offsetWidth; sEl.classList.add('flash'); }
  if (i < 0 || !popAt(c.p, c.s, i)) { if (sEl) sEl.scrollIntoView({ block: 'center' }); }
}
async function lookup(a, P, btn){
  if (!S.sample || !P || P.kind !== 'word' || !a) return;
  btn.disabled = true; btn.textContent = '正在查…';
  try {
    const res = await S.sample.json(`英文句子："${plainSent(a, P.p, P.s)}"\n请给出单词 "${P.disp}" 在这句话中的词性和简明中文释义。只输出 JSON 数组 ["词性", "中文释义", "这句话里的简短英文释义"]，词性用 n. v. adj. adv. prep. conj. pron. 等缩写，变化形式写在括号里，如 "v.（过去式）"。`, { modelTier: 'quick' });
    if (!Array.isArray(res) || res.length < 2) throw { code: 'invalid_json' };
    const entry = res[2] ? [String(res[0]), String(res[1]), String(res[2])] : [String(res[0]), String(res[1])];
    const idx = S.articles.findIndex(x => x.id === a.id);
    if (idx >= 0) S.articles[idx] = { ...S.articles[idx], lex: { ...(S.articles[idx].lex || {}), [P.w]: entry } };
    write('articles/' + a.id, ref => ref.update({ lex: { [P.w]: entry } }));
    P.pos = entry[0];
    renderView(); renderPop(true);
  } catch(e){ btn.disabled = false; btn.textContent = '让 Claude 按语境释义'; toast(sampleErr(e)); }
}
document.addEventListener('input', e => {
  const id = e.target.id;
  if (e.target.dataset && e.target.dataset.ed) { edSet(e.target.dataset.ed, e.target.value); if (e.target.tagName === 'TEXTAREA') autosize(e.target); return; }
  if (id in S.impForm) S.impForm[id] = e.target.value;
  else if (id === 'vq') { S.vq = e.target.value; renderVocabList(); }
  else if (id === 'dtIn' && S.dt) S.dt.input = e.target.value;
});
document.addEventListener('change', e => {
  const el = e.target; const id = el.id;
  if (el.dataset && el.dataset.ed) { edSet(el.dataset.ed, el.value); return; }
  if (id === 'vaSel') { S.va = el.value; renderVocabList(); }
  else if (id === 'vcSel') { S.vc = el.value; renderVocabList(); }
  else if (id === 'popCat') {
    const P = popCur(); if (!P) return;
    if (el.value === '__new') { S.newCat = true; renderPop(true); }
    else setCat(P, el.value);
  }
  else if (el.classList.contains('vcat')) {
    const k = el.dataset.k;
    if (el.value === '__new') { const w = S.words[k]; if (w) { openPop({ kind: 'dict', w: w.w, disp: w.w, pos: w.pos || '', anchor: null }); S.newCat = true; renderPop(true); } el.value = w && w.cat || ''; }
    else { upsertWord(k, { cat: el.value }); toast(el.value ? `已归入「${el.value}」` : '已设为未分类'); }
  }
  else if (id === 'newLimit') { S.newLimit = +el.value; LS.set('newLimit', S.newLimit); renderChrome(); renderView(); }
  else if (id === 'dtScope') { S.dtScope = el.value; renderView(); }
  else if (id === 'imFile') { const f = el.files && el.files[0]; if (f) readBackup(f); }
  else if (id === 'impFile') impAdd(el);
});
function onSelect(){
  const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const body = $('#body'); if (!body) return;
  const r = sel.getRangeAt(0); if (!body.contains(r.commonAncestorContainer)) return;
  if (sel.toString().trim().length < 2) return;
  const list = $$('.s', body).filter(el => r.intersectsNode(el)).map(el => [+el.dataset.p, +el.dataset.s]);
  if (!list.length) return;
  S.selAt = Date.now(); closePop(); S.panel = { type: 'sent', list }; renderPanel();
}
document.addEventListener('mouseup', () => setTimeout(onSelect, 10));
document.addEventListener('touchend', () => setTimeout(onSelect, 120));
document.addEventListener('keydown', e => {
  const id = e.target && e.target.id;
  if (e.key === 'Escape') { if (popCur()) { closePop(); return; } if (S.panel) { S.panel = null; renderPanel(); } return; }
  if (id === 'newCatIn' && e.key === 'Enter') { e.preventDefault(); addCat(); return; }
  if (id === 'dtIn' && e.key === 'Enter') { e.preventDefault(); dtCheck(false); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (!typing && S.view === 'read' && S.examSel && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-zA-Z]$/.test(e.key)) {
    const a = cur(); const L = e.key.toUpperCase();
    if (a && inExam(a) && a.options[L]) {
      e.preventDefault(); const n = S.examSel; examFill(a, n, L);
      const nx = nextEmpty(a, n); if (nx) { S.examSel = nx; S.panel = { type: 'epick', n: nx }; }
      renderView(); afterReadRender(); renderPanel(); return;
    }
  }
  if (!typing && S.view === 'vocab' && S.vtab === 'review' && S.rv && S.rv.i < S.rv.q.length) {
    if ((e.key === ' ' || e.key === 'Enter') && !S.rv.shown && !e.target.closest('button')) { e.preventDefault(); S.rv.shown = true; renderView(); }
    else if (S.rv.shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); rvRate(+e.key); }
  }
});
let popRaf = 0;
window.addEventListener('scroll', () => {
  if (!popCur() || popRaf) return;
  popRaf = requestAnimationFrame(() => {
    popRaf = 0; const P = popCur(); if (!P) return;
    if (P.anchor) {
      const an = $(P.anchor); const r = an && an.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { closePop(); return; }
    }
    placePop();
  });
}, { passive: true });
window.addEventListener('resize', () => { placePop(); moveTabInd(); });
/*@@TABS@@*/
document.addEventListener('visibilitychange', () => { if (document.hidden) examPause(); else if (S.view === 'read') { examResume(cur()); updateExamBar(); } });
