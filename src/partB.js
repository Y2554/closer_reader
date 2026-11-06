/* ---------- writes ---------- */
const queues = {};
function write(path, fn){
  if (!S.db) { toast('现在连不上存档，这次改动不会保存'); return Promise.resolve(); }
  const run = async () => { try { await fn(S.db.doc(path)); } catch(e){ toast(dbErr(e)); } };
  queues[path] = (queues[path] || Promise.resolve()).then(run);
  return queues[path];
}
function dbErr(e){
  const c = e && e.code;
  if (c === 'quota_exceeded') return '存储空间满了，删掉一些旧文章或单词再试';
  if (c === 'invalid_argument') return '你只有查看权限，改动没有保存';
  if (c === 'resource_exhausted') return '操作太快了，稍等一下再试';
  return '保存失败，请稍后再试';
}
function setProg(id, obj){ S.prog[id] = obj; write('progress/' + id, ref => ref.set(obj)); }
function progOf(id){ const p = JSON.parse(JSON.stringify(S.prog[id] || {})); return { ...p, picks: { ...(p.picks || {}) }, shown: { ...(p.shown || {}) }, lastOpened: p.lastOpened || 0 }; }

/* ---------- words: status, level, categories ---------- */
const STATUS = { new: '生词', learning: '学习中', known: '已掌握', ignored: '忽略' };
const ST_ORDER = ['new', 'learning', 'known', 'ignored'];
const LVL = { b: '基础词', '4': '四级', '6': '六级', k: '考研', t: '雅思托福', g: 'GRE', x: '超纲' };
let LEVEL = null, LEVEL_P = null;
function loadLevel(){
  if (LEVEL) return Promise.resolve(LEVEL);
  if (!LEVEL_P) LEVEL_P = fetch('level.json').then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(j => (LEVEL = j)).catch(e => { LEVEL_P = null; throw e; });
  return LEVEL_P;
}
function lemmaOf(w){
  if (!LEVEL || !w) return w;
  const v = LEVEL[w];
  if (typeof v === 'string') return v[0] === '>' ? v.slice(1) : w;
  for (const c of stems(w)) { if (/ly$/.test(w) && c === w.slice(0, -2)) continue; const x = LEVEL[c]; if (typeof x === 'string') return x[0] === '>' ? x.slice(1) : c; }
  return w;
}
// the level shown for a saved word follows the current level table, not the value stored when it was saved
const wLvl = w => (LEVEL ? levelOf(w.w) : '') || w.lvl || '';
function levelOf(l){ if (!LEVEL || !l) return null; const v = LEVEL[l]; return typeof v === 'string' && v[0] !== '>' ? v : null; }
const wkey = w => String(w || '').toLowerCase().trim().replace(/\s+/g, ' ');
const wdoc = k => wkey(k).replace(/[^a-z0-9_\-.~:@+]/g, '_').slice(0, 180) || '_';
function inflect(l){
  if (!l || /\s/.test(l)) return [];
  const f = [l + 's', l + 'es', l + 'ed', l + 'd', l + 'ing'];
  if (/e$/.test(l)) f.push(l.slice(0, -1) + 'ing');
  if (/[^aeiou]y$/.test(l)) { const b = l.slice(0, -1); f.push(b + 'ies', b + 'ied', b + 'ier', b + 'iest'); }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(l) && l.length <= 6) { const c = l.slice(-1); f.push(l + c + 'ed', l + c + 'ing'); }
  return f;
}
function rebuildIdx(){
  const m = new Map();
  Object.values(S.words).forEach(w => { m.set(w.w, w.w); (w.forms || []).forEach(f => { if (!m.has(f)) m.set(f, w.w); }); });
  S.formIdx = m;
}
function wordOf(lw){
  if (!lw) return null;
  const k = S.formIdx.get(lw); if (k && S.words[k]) return S.words[k];
  const l = lemmaOf(lw);
  if (l !== lw) { const k2 = S.formIdx.get(l); if (k2 && S.words[k2]) return S.words[k2]; }
  return null;
}
function upsertWord(key, patch, ctx){
  const k = wkey(key); if (!k) return null;
  const old = S.words[k]; const now = Date.now();
  const doc = old ? JSON.parse(JSON.stringify(old)) : { w: k, forms: [k], status: 'new', cat: '', pos: '', zh: '', en: '', ph: '', lvl: '', ctx: [], at: now, srs: null };
  delete doc._id;
  const { forms, fill, ...set } = patch || {};
  if (forms) doc.forms = [...new Set([k, ...(doc.forms || []), ...forms.map(wkey).filter(Boolean)])].slice(0, 30);
  if (fill) Object.entries(fill).forEach(([f, v]) => { if (v && !doc[f]) doc[f] = v; });
  Object.assign(doc, set);
  if (ctx && !(doc.ctx || []).some(c => c.art === ctx.art && c.p === ctx.p && c.s === ctx.s)) doc.ctx = [ctx, ...(doc.ctx || [])].slice(0, 6);
  doc.up = now;
  S.words[k] = { ...doc, _id: old && old._id ? old._id : wdoc(k) }; rebuildIdx();
  const path = 'words/' + S.words[k]._id;
  return write(path, ref => ref.set(doc)).then(() => S.words[k]);
}
function removeWord(k){
  const w = S.words[k]; if (!w) return;
  delete S.words[k]; rebuildIdx();
  write('words/' + (w._id || wdoc(k)), ref => ref.delete());
}
function saveCats(list){ S.cats = list; write('meta/settings', ref => ref.set({ cats: list })); }
function catOptions(sel){
  return `<option value="">未分类</option>${S.cats.map(c => `<option value="${esc(c)}"${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new">＋ 新建分类…</option>`;
}
function optLoc(a, l){ let r = [null, null]; blankNums(a).forEach(n => { if (a.blanks[n].ans === l) r = locate(a, n); }); return r; }
function ctxOf(P){
  const a = cur(); if (!a || (P.kind !== 'word' && P.kind !== 'opt')) return null;
  let p = P.p, s = P.s;
  if (P.kind === 'opt') [p, s] = optLoc(a, P.l);
  if (p == null) return null;
  return { art: a.id, title: a.title, p, s, text: fullSent(a, p, s), at: Date.now() };
}
function cardEntry(P){
  const a = cur(); const D = P.dict && P.dict.state === 'ok' ? P.dict.res : null;
  const lemma = wkey(D ? D.lemma : lemmaOf(P.w));
  const lex = P.kind === 'word' && a ? lexOf(a, P.w) : null;
  const opt = P.kind === 'opt' && a ? a.options[P.l] : null;
  const tl = D ? trLines(D.e.t, ctxKey(P.pos))[0] : null;
  const ex = dictExtras(P);
  return {
    key: lemma,
    patch: {
      forms: [P.w, lemma, ...inflect(lemma)],
      fill: { pos: lex ? lex[0] : opt ? opt.pos : tl ? tl.tp : '', zh: lex ? lex[1] : opt ? opt.zh : tl ? tl.text : '',
        en: (lex && lex[2]) || (opt && opt.en) || ex.en || '', ph: ex.ph || '', lvl: levelOf(lemma) || '' }
    },
    ctx: ctxOf(P)
  };
}
function recOf(P){
  const D = P.dict && P.dict.state === 'ok' ? P.dict.res : null;
  return (D && S.words[wkey(D.lemma)]) || wordOf(P.w) || null;
}
function setStatus(P, stt){
  const old = recOf(P);
  if (old && old.status === stt) return;
  const e = cardEntry(P);
  upsertWord(old ? old.w : e.key, { ...e.patch, status: stt }, e.ctx);
  toast(`${old ? old.w : e.key} · ${STATUS[stt]}`);
  afterWordChange();
}
function collect(P){
  const old = recOf(P);
  if (old) { removeWord(old.w); toast(`已移出单词本：${old.w}`); }
  else { const e = cardEntry(P); upsertWord(e.key, { ...e.patch, status: 'new' }, e.ctx); S.justSaved = true; toast(`已收藏：${e.key}`); }
  afterWordChange();
}
function setCat(P, cat){
  const old = recOf(P); const e = cardEntry(P);
  upsertWord(old ? old.w : e.key, { ...e.patch, cat, ...(old ? {} : { status: 'new' }) }, e.ctx);
  toast(cat ? `已归入「${cat}」` : '已设为未分类');
  afterWordChange();
}
function fillMissing(P){
  const r = recOf(P); if (!r || !(P.dict && P.dict.state === 'ok')) return;
  const ex = dictExtras(P); const lv = levelOf(r.w) || '';
  if ((!r.ph && ex.ph) || (!r.en && ex.en) || (!r.lvl && lv)) upsertWord(r.w, { fill: { ph: ex.ph, en: ex.en, lvl: lv } });
}
function afterWordChange(){
  renderChrome();
  if (S.view === 'read') { renderView(); if (S.panel && S.panel.type === 'nw') renderPanel(true); else marks(); }
  else if (S.view === 'vocab' && S.vtab === 'list') renderVocabList();
  else if (S.view === 'archive') renderView();
  renderPop(true);
}

/* ---------- chrome ---------- */
function renderChrome(){
  const d = new Date(); const wk = '日一二三四五六'[d.getDay()];
  $('#dateLine').textContent = `${dateCN(d)} · 星期${wk}`;
  $('#issueLine').textContent = S.articles.length ? `第 ${S.articles.length} 期` : '创刊号';
  $('#ctArch').textContent = S.articles.length || '';
  const due = dueList().length + newQueue().length;
  $('#ctVocab').textContent = due ? `${due} 待复习` : (Object.values(S.words).filter(w => w.status === 'new' || w.status === 'learning').length || '');
  const mo = Object.values(S.mistakes).filter(m => !m.resolved).length; $('#ctMis').textContent = mo || '';
  $$('.tab').forEach(t => t.toggleAttribute('aria-current', false));
  const t = $(`.tab[data-v="${S.view === 'edit' ? 'read' : S.view}"]`); if (t) t.setAttribute('aria-current', 'page');
  moveTabInd();
  $('.layout').classList.toggle('has-rail', S.view === 'read' && !!cur());
}
function render(){ renderChrome(); renderView(); renderPanel(); renderPop(); }
function renderView(){
  const v = $('#view');
  if (S.view === 'import') {
    if (S.impDirty || !v.querySelector('.imp')) {
      v.innerHTML = importHtml(); S.impDirty = false;
      const img = $('#impPrev'); if (img && S.impFile) { try { img.src = URL.createObjectURL(S.impFile); } catch(err){} }
      if (window.CR_AI && window.CR_AI.mount) window.CR_AI.mount($('#crAiBox'));   // standalone build: "AI 设置" box
    }
    else { const s = $('#impStatus'); if (s) s.innerHTML = impStatusHtml(); }
    return;
  }
  v.innerHTML = S.view === 'read' ? readHtml() : S.view === 'archive' ? archiveHtml() : S.view === 'mistakes' ? mistakesHtml() : S.view === 'edit' ? editHtml() : S.view === 'dict' ? dictPageHtml() : vocabHtml();
  if (S.view === 'vocab') afterVocabRender();
  if (S.view === 'edit') $$('.ed-ta', v).forEach(autosize);
  if (S.view === 'dict') afterDictRender();
  if (S.enter) {
    S.enter = false;
    v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
    animateCounts(v);
    clearTimeout(S.enterT); S.enterT = setTimeout(() => v.classList.remove('enter'), 900);
  }
}

/* ---------- read view ---------- */
function readHtml(){
  const a = cur();
  if (!a) {
    if (S.dbState === 'loading') return `<div class="story"><div class="kicker">正在取报</div><div class="skel" style="width:80%;height:38px"></div><div class="skel" style="width:55%"></div><div class="skel"></div><div class="skel"></div><div class="skel" style="width:70%"></div></div>`;
    if (S.dbState !== 'ok') return `<div class="empty"><div class="kicker">暂时无法读取</div><h2>存档没有连上</h2><p>文章库存在 claude.ai 里。请在 claude.ai 或 Claude App 中登录后打开这个页面。</p></div>`;
    return `<div class="empty"><div class="kicker">创刊号待印</div><h2>报纸还空着</h2><p>粘贴一篇文章或拍一张试卷，就能生成第一期精读。</p><button class="pbtn primary" data-act="view" data-v="import">导入第一篇</button></div>`;
  }
  if (isTrans(a)) return transHtml(a);
  const exam = inExam(a);
  const keys = exam ? [] : (a.keys || []); const used = new Set(); let wc = 0;
  const paras = a.paragraphs.map((p, pi) => {
    const sents = p.sentences.map((s, si) => {
      const tk = toks(s.en); markKw(tk, keys, used);
      wc += tk.filter(t => t.t === 'w').length;
      return `<span class="s" data-p="${pi}" data-s="${si}">${renderToks(a, tk)}</span>`;
    }).join(' ');
    const open = !exam && (S.zhAll || S.openZh.has(pi));
    const zh = open ? `<div class="para-zh">${guarded('p' + pi, paraHasOpen(a, pi), esc(p.sentences.map(s => s.zh).join('')))}</div>` : '';
    return `<div class="para${isMatch(a) ? ' lab' : ''}" data-p="${pi}"><div class="gut">${isMatch(a) && p.label ? `<span class="plabel">${esc(p.label)}</span>` : `<span class="pnum">¶${pi + 1}</span>`}${exam ? '' : `<button class="ptr" data-act="ptr" data-p="${pi}" aria-pressed="${open}">${open ? '收起' : '译文'}</button>`}</div><p class="ptext">${sents}</p>${zh}</div>`;
  }).join('');
  const sc = score(a);
  const att = ((S.prog[a.id] || {}).attempts || []).slice(-1)[0];
  let scoreTxt = '阅读篇';
  if (sc.total && exam) scoreTxt = `考试中 · 已填 <b>${Object.keys(examAns(a)).length}/${sc.total}</b>`;
  else if (att) scoreTxt = `最近一次 <b>${att.score}/${att.total}</b> · 用时 <b>${fmtSecs(att.secs)}</b>`;
  else if (sc.total) scoreTxt = `已作答 <b>${sc.done}/${sc.total}</b> · 答对 <b>${sc.ok}</b>`;
  const nw = LEVEL ? nwRows(a) : null;
  const nwCount = nw ? nw.length : '…';
  const tools = exam ? '' : `
      <button class="tbtn nwbtn" data-act="nwopen" aria-pressed="${!!(S.panel && S.panel.type === 'nw')}">本篇生词 <b>${nwCount}</b></button>
      <button class="tbtn" data-act="toggle" data-k="showSt" aria-pressed="${S.showSt}">生词着色</button>
      <button class="tbtn" data-act="toggle" data-k="showPos" aria-pressed="${S.showPos}">词性标注</button>
      <button class="tbtn" data-act="toggle" data-k="showKw" aria-pressed="${S.showKw}">重点划线</button>
      <button class="tbtn" data-act="toggle" data-k="zhAll" aria-pressed="${S.zhAll}">全文对照</button>
      ${sc.total ? `<button class="tbtn" data-act="revealAll" ${sc.done === sc.total ? 'disabled' : ''}>显示全部答案</button>
      <button class="tbtn${S.confirmReset ? ' warn' : ''}" data-act="reset">${S.confirmReset ? '再点一次确认重做' : '重做本篇'}</button>` : ''}
      <button class="tbtn" data-act="edopen">校对</button>`;
  return `<article class="story">
    <div class="kicker">${esc(a.source || '精读')}</div>
    <h2 class="headline">${esc(a.title)}</h2>
    ${a.zh ? `<p class="dek">${esc(a.zh)}</p>` : ''}
    <div class="byline"><span>${isMatch(a) ? '段落匹配 · ' : isMcq(a) ? '仔细阅读 · ' : ''}${a.paragraphs.length} 段 · ${wc} 词${sc.total ? ` · ${sc.total} ${isItems(a) ? '题' : '空'}` : ''}</span><span>${scoreTxt}</span></div>
    <div class="toolbar">${modeSegHtml(a)}${tools}</div>
    ${S.confirmMode ? `<p class="mode-warn">切到考试会清空本篇当前的作答，历史成绩会保留。再点一次“考试”确认。</p>` : ''}
    ${exam ? examBarHtml(a) : ''}
    <div id="body" class="${exam ? 'exam ' : ''}${!exam && S.showKw ? 'show-kw' : ''} ${!exam && S.showPos ? 'show-pos' : ''} ${S.showSt ? 'show-st' : ''}">${paras}</div>
    ${isMatch(a) ? itemsHtml(a) : isMcq(a) ? mcqHtml(a) : bankHtml(a)}
    ${!exam && (a.tips || []).length ? `<section class="tips"><h3>Technique <span>技巧小结</span></h3><ol>${a.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>` : ''}
  </article>`;
}
function renderToks(a, tk){
  const first = {}, last = {};
  tk.forEach((t, i) => { if (t.kw != null) { if (first[t.kw] == null) first[t.kw] = i; last[t.kw] = i; } });
  const opens = {}, closes = {};
  for (const k in first) { opens[first[k]] = k; closes[last[k]] = (closes[last[k]] || 0) + 1; }
  let h = '';
  tk.forEach((t, i) => {
    if (opens[i] != null) { const kk = a.keys[opens[i]]; h += `<span class="kw${kk.k === 'phrase' ? ' ph' : ''}" data-k="${opens[i]}">`; }
    if (t.t === 'w') {
      const lw = t.v.toLowerCase();
      const e = lexOf(a, lw);
      const rec = wordOf(lw);
      const sc = rec ? (rec.status === 'new' ? ' st1' : rec.status === 'learning' ? ' st2' : '') : '';
      h += `<span class="w ${e ? posClass(e[0]) : 'pf'}${sc}" data-i="${i}" data-pos="${e ? esc(shortPos(e[0])) : '·'}">${esc(t.v)}</span>`;
    } else if (t.t === 'b') h += blankHtml(a, t.n);
    else h += esc(t.v);
    if (closes[i]) h += '</span>'.repeat(closes[i]);
  });
  return h;
}
function blankHtml(a, n){
  const base = `data-act="blank" data-n="${n}"`;
  const idx = blankNums(a).indexOf(n);
  if (inExam(a)) {
    const L = examAns(a)[n];
    const cls = `blank ex${L ? ' filled' : ''}${S.examSel === n ? ' sel' : ''}${S.justFilled === n && L ? ' ink' : ''}`;
    return `<button class="${cls}" ${base} aria-label="第 ${n} 空，${L ? '已填 ' + esc(optW(a, L)) : '未填'}"><span class="bn">${n}</span><span class="bw">${L ? esc(optW(a, L)) : ''}</span></button>`;
  }
  const r = st(a, n);
  const anim = (S.revealAnim ? ' rvl' : '') + (S.justFilled === n ? ' just' : '');
  const sty = S.revealAnim ? ` style="--i:${idx}"` : '';
  if (!r.done) return `<button class="blank${S.panel && S.panel.type === 'blank' && S.panel.n === n ? ' on' : ''}" ${base} aria-label="第 ${n} 空，未作答"><span class="bn">${n}</span><span class="bw"></span></button>`;
  const w = esc(optW(a, r.ans));
  if (r.shown) return `<button class="blank shown${anim}"${sty} ${base} aria-label="第 ${n} 空，答案 ${w}"><span class="bn">${n}</span><span class="bw">${w}</span></button>`;
  if (r.ok) return `<button class="blank ok${anim}"${sty} ${base} aria-label="第 ${n} 空，答对"><span class="bn">${n}</span><span class="bw">${w}</span></button>`;
  return `<button class="blank bad${anim}"${sty} ${base} aria-label="第 ${n} 空，答错"><span class="bn">${n}</span><span class="bw"><s>${esc(optW(a, r.pick))}</s> ${w}</span></button>`;
}
const POS_RANK = p => /原形/.test(p) ? 0 : /^v/.test(p) ? 1 : /^n/.test(p) ? 2 : /^adj/.test(p) ? 3 : /^adv/.test(p) ? 4 : 5;
function bankHtml(a){
  const L = Object.keys(a.options || {}).sort();
  if (!L.length) return '';
  const exam = inExam(a);
  const usedBy = {};
  if (exam) Object.entries(examAns(a)).forEach(([n, l]) => { usedBy[l] = n; });
  else blankNums(a).forEach(n => { const r = st(a, n); if (r.done) usedBy[r.ans] = n; });
  const item = l => `<button class="opt${usedBy[l] ? ' used' : ''}${exam && S.examSel && examAns(a)[S.examSel] === l ? ' chosen' : ''}" data-act="opt" data-l="${l}"><b>${l})</b><span>${esc(a.options[l].w)}</span>${usedBy[l] ? `<span class="u">→${usedBy[l]}</span>` : ''}</button>`;
  let inner;
  if (S.group && !exam) {
    const g = {};
    L.forEach(l => { const k = a.options[l].pos || '其他'; (g[k] = g[k] || []).push(l); });
    inner = Object.keys(g).sort((x, y) => POS_RANK(x) - POS_RANK(y)).map(k => `<div class="grp"><h4>${esc(k)} <span>· ${g[k].length} 个</span></h4><div class="opts">${g[k].map(item).join('')}</div></div>`).join('');
  } else inner = `<div class="opts">${L.map(item).join('')}</div>`;
  const note = exam ? (S.examSel ? `正在填第 <b>${S.examSel}</b> 空：点一个词填进去，电脑上也可以直接按字母键。` : '先点文中的一个空格，再从这里选词。考试中不显示词义。')
    : S.group ? '先分词性、再看语义：判断每个空需要什么词性，候选就只剩这一组。' : '点选项看词义和词性；点文中的空格作答。';
  return `<section class="bank${exam ? ' exam' : ''}"><header><h3>Word Bank<span>选项词库</span></h3>${exam ? '' : `<button class="tbtn" data-act="toggle" data-k="group" aria-pressed="${S.group}">按词性分组</button>`}</header>${inner}
    <p class="bank-note">${note}</p></section>`;
}

/* ---------- side panel (desktop rail / phone sheet) ---------- */
function renderPanel(keep){
  const el = $('#panel'); const a = cur(); const y = el.scrollTop;
  if (S.view !== 'read' || !a) { el.innerHTML = ''; el.classList.remove('open'); S.srcHit = null; const bq = $('#backq'); if (bq) bq.hidden = true; return; }
  const P = S.panel;
  el.classList.toggle('open', !!P);
  if (!P) S.sheet = 'half';
  el.classList.toggle('full', !!P && S.sheet === 'full');
  let h = '';
  try {
    if (!P) h = idleHtml();
    else if (P.type === 'blank') h = isMatch(a) ? matchCard(a, P.n) : isMcq(a) ? mcqCard(a, P.n) : blankCard(a, P.n);
    else if (P.type === 'sent') h = sentCard(a, P.list);
    else if (P.type === 'nw') h = nwHtml(a);
    else if (P.type === 'epick') h = isMatch(a) ? matchEpick(a, P.n) : isMcq(a) ? mcqEpick(a, P.n) : epickHtml(a, P.n);
    else if (P.type === 'result') h = resultHtml(a);
    else if (P.type === 'expr') h = exprCard(a, P.i);
  } catch(e){ h = idleHtml(); }
  el.innerHTML = `<div class="grab-zone" data-grab aria-label="拖动调整高度，下拉关闭" role="button" tabindex="-1"><span class="grab"></span></div>${h}`;
  el.scrollTop = keep ? y : 0;
  if (P && P.type === 'result' && !keep) animateCounts(el);
  const nb = $('.nwbtn'); if (nb) nb.setAttribute('aria-pressed', String(!!(P && P.type === 'nw')));
  marks();
}
const top = label => `<div class="p-top"><span class="p-eyebrow">${label}</span><button class="p-close" data-act="close" aria-label="关闭">×</button></div>`;
function idleHtml(){
  return `<div class="idle">${top('读报指南')}<h3>怎么用这一版</h3><ul>
    <li><b>考试模式</b><span>计时做完再交卷，交卷后看成绩和逐题解析，错题自动进错题本</span></li>
    <li><b>点单词</b><span>弹出查词卡：本文释义、常见释义、熟悉度和词典链接，可展开详解</span></li>
    <li><b>本篇生词</b><span>按四六级等级列出这篇里可能不认识的词，一键标记</span></li>
    <li><b>选中句子</b><span>拖选一句或几句，这里给出对应译文</span></li>
    <li><b>点空格</b><span>从词库里作答，立刻判对错并给出解题思路</span></li>
    <li><b>双击空白</b><span>随时召唤词典，查任何单词、词组或中文；也可以按 / 键</span></li>
  </ul>
  <div class="legend"><span class="lg st1">生词</span><span class="lg st2">学习中</span><span class="l1">重点词</span><span class="l2">固定搭配</span></div>
  <div class="posleg"><span class="chip pn">n. 名词</span><span class="chip pv">v. 动词</span><span class="chip pa">adj. 形容词</span><span class="chip pd">adv. 副词</span><span class="chip pf">功能词</span></div></div>`;
}
function sentCard(a, list){
  return `${top(list.length > 1 ? `选中 ${list.length} 句` : `¶${list[0][0] + 1} · 第 ${list[0][1] + 1} 句`)}
    ${list.map(([p, s]) => `<h5 class="p-sec">¶${p + 1} · 第 ${s + 1} 句</h5><p class="p-en">${sentHtml(a, p, s)}</p>${zhBlock(a, p, s)}`).join('')}`;
}
function locate(a, n){
  if (isItems(a)) { const b = a.blanks[n]; return b && Array.isArray(b.loc) ? b.loc : [0, 0]; }
  for (let p = 0; p < a.paragraphs.length; p++) for (let s = 0; s < a.paragraphs[p].sentences.length; s++)
    if (a.paragraphs[p].sentences[s].en.includes(`{{${n}}}`)) return [p, s];
  return [0, 0];
}
function blankCard(a, n){
  const b = a.blanks[n]; if (!b) return idleHtml();
  const r = st(a, n); const [p, s] = locate(a, n);
  const ctx = toks(a.paragraphs[p].sentences[s].en).map(t => {
    if (t.t !== 'b') return esc(t.v);
    if (t.n === n) return r.done ? `<mark><span class="fill">${esc(optW(a, r.ans))}</span></mark>` : `<mark>(${n})____</mark>`;
    const o = st(a, t.n); return o.done ? `<span class="fill">${esc(optW(a, o.ans))}</span>` : `<span class="gap">(${t.n})____</span>`;
  }).join('');
  const L = Object.keys(a.options || {}).sort();
  const taken = {}; blankNums(a).forEach(m => { const o = st(a, m); if (o.done && m !== n) taken[o.ans] = m; });
  const head = `${top(`第 ${n} 空`)}<p class="p-en" style="margin-top:8px">${ctx}</p>`;
  if (!r.done) {
    return `${head}
      <p class="need">${S.hint ? `这个空需要：<b>${esc(b.need)}</b>` : '先自己判断：这个空需要什么词性？'}</p>
      <div class="pick-grid">${L.map(l => `<button class="pick${S.hint && (b.cands || []).includes(l) ? ' cand' : ''}${taken[l] ? ' taken' : ''}" data-act="pick" data-n="${n}" data-l="${l}"><b>${l}</b>${esc(a.options[l].w)}</button>`).join('')}</div>
      <div class="p-actions"><button class="pbtn ghost" data-act="hint">${S.hint ? '收起提示' : '提示：看词性候选'}</button><button class="pbtn ghost" data-act="show" data-n="${n}">直接看答案</button></div>`;
  }
  const ans = a.options[r.ans] || {};
  const verdict = r.shown ? `<p class="verdict shown">答案</p>` : r.ok ? `<p class="verdict ok">✓ 答对了</p>` : `<p class="verdict bad">✗ 你选了 ${esc(r.pick)}) ${esc(optW(a, r.pick))}</p>`;
  const nx = nextOpen(a, n);
  return `${head}${verdict}
    <div class="ans-big"><b>${esc(r.ans)})</b><span>${esc(ans.w)}</span><i>${esc(ans.pos || '')} ${esc(ans.zh || '')}</i></div>
    <h5 class="p-sec">需要的词性</h5><p class="ex">${esc(b.need)}</p>
    ${(b.cands || []).length ? `<div class="cands">${b.cands.map(l => `<span class="${l === r.ans ? 'hit' : ''}">${esc(l)} ${esc(optW(a, l))}</span>`).join('')}</div>` : ''}
    <h5 class="p-sec">解题思路</h5><p class="ex">${esc(b.why)}</p>
    ${b.trap ? `<h5 class="p-sec">干扰项</h5><p class="ex trap">${esc(b.trap)}</p>` : ''}
    ${b.tip ? `<div class="note"><b>技巧</b><br>${esc(b.tip)}</div>` : ''}
    <h5 class="p-sec">本句译文</h5><p class="p-zht">${esc(a.paragraphs[p].sentences[s].zh)}</p>
    <button class="more fixit" data-act="edopen" data-n="${n}">答案或解析有误？去修改</button>
    <div class="p-actions">${nx ? `<button class="pbtn primary" data-act="blank" data-n="${nx}">下一空 · ${nx}</button>` : ''}<button class="pbtn ghost" data-act="redo" data-n="${n}">重做这一空</button>
      ${ans.w ? `<button class="pbtn ghost" data-act="optpop" data-l="${esc(r.ans)}">查看 ${esc(ans.w)}</button>` : ''}</div>`;
}
function nextOpen(a, n){
  const ns = blankNums(a); const i = ns.indexOf(n);
  for (let k = 1; k <= ns.length; k++) { const m = ns[(i + k) % ns.length]; if (!st(a, m).done) return m; }
  return null;
}
function highlight(){
  $$('#view .on').forEach(e => e.classList.remove('on'));
  $$('#view .hit, #view .src').forEach(e => e.classList.remove('hit', 'src'));
  const P = S.panel; const H = S.srcHit;
  if (H && (H.id !== S.cur || (P && !(P.type === 'blank' && P.n === H.n)))) S.srcHit = null;
  if (S.srcHit && !P) { const e = $(`#body .s[data-p="${H.p}"][data-s="${H.s}"]`); if (e) e.classList.add('hit'); }
  const bq = $('#backq'); if (bq) { const show = !!(S.srcHit && !P && S.view === 'read'); bq.hidden = !show; if (show) bq.textContent = `↩ 回到第 ${S.srcHit.n} 题`; }
  if (!P) return;
  if (P.type === 'blank' || P.type === 'epick') {
    const b = $(`#body .blank[data-n="${P.n}"]`); if (b) b.classList.add('on');
    const a = cur();
    if (isItems(a)) {
      const q = $(`.mq[data-n="${P.n}"]`); if (q) q.classList.add('on');
      if (P.type === 'blank' && st(a, P.n).done) { const [p, s] = locate(a, P.n); const e = $(`#body .s[data-p="${p}"][data-s="${s}"]`); if (e) e.classList.add('on', 'src'); }
    }
  }
  else if (P.type === 'sent') P.list.forEach(([p, s]) => { const e = $(`#body .s[data-p="${p}"][data-s="${s}"]`); if (e) e.classList.add('on'); });
}
function marks(){
  highlight();
  const P = popCur(); if (P && P.anchor) { const an = $(P.anchor); if (an) an.classList.add('on'); }
}

/* ---------- 本篇生词 ---------- */
const NW_LV = { '4': ['4', '6', 'k', 't', 'g', null], '6': ['6', 'k', 't', 'g', null], k: ['k', 't', 'g', null] };
function nwRows(a){
  const seen = new Map(); const lower = new Set();
  a.paragraphs.forEach(p => p.sentences.forEach(s => toks(s.en).forEach(t => { if (t.t === 'w' && /^[a-z]/.test(t.v)) lower.add(t.v); })));
  a.paragraphs.forEach((p, pi) => p.sentences.forEach((s, si) => {
    let first = true;
    toks(s.en).forEach((t, i) => {
      if (t.t !== 'w') return;
      const isFirst = first; first = false;
      if (/\d/.test(t.v) || t.v.length < 2) return;
      const lw = t.v.toLowerCase(); const lem = lemmaOf(lw); const lv = levelOf(lem);
      const lx = lexOf(a, lw);
      if (lx && /名）|名\)|人名|地名/.test(lx[0])) return;
      if (/^[A-Z]/.test(t.v) && !lv && (!isFirst || !lower.has(lw))) return;
      if (!lv && (lw.length < 4 || /['’]/.test(lw))) return;
      if (!seen.has(lem)) seen.set(lem, { key: lem, lw, disp: t.v, lv, p: pi, s: si, i, n: 0, lex: lexOf(a, lw) });
      seen.get(lem).n++;
    });
  }));
  const allow = NW_LV[S.nwLvl] || NW_LV['6'];
  const out = [];
  seen.forEach(r => {
    r.rec = wordOf(r.lw) || S.words[r.key] || null;
    const s = r.rec && r.rec.status;
    if (s === 'new' || s === 'learning') out.push(r);
    else if (!s && allow.includes(r.lv)) out.push(r);
  });
  return out;
}
function nwHtml(a){
  if (!LEVEL) return `${top('本篇生词')}<p class="dload"><span class="spin"></span>正在加载词汇等级表…</p>`;
  const rows = nwRows(a);
  const marked = rows.filter(r => r.rec), open = rows.filter(r => !r.rec);
  const row = r => {
    const s = r.rec ? r.rec.status : '';
    return `<li><div class="nw-top"><button class="nw-w" data-act="nwgo" data-k="${esc(r.key)}">${esc(r.key)}</button>${r.lv ? `<span class="lvl lvl-${r.lv}">${LVL[r.lv]}</span>` : '<span class="lvl lvl-x">超纲</span>'}<span class="nw-n">×${r.n}</span></div>
      ${r.lex ? `<div class="nw-zh"><span class="chip ${posClass(r.lex[0])}">${esc(shortPos(r.lex[0]))}</span> ${esc(r.lex[1])}</div>` : ''}
      <div class="mini-st">${ST_ORDER.map(x => `<button class="st-b st-${x}${s === x ? ' on' : ''}" data-act="nwst" data-k="${esc(r.key)}" data-s="${x}">${STATUS[x]}</button>`).join('')}</div></li>`;
  };
  return `${top('本篇生词')}
    <p class="nw-sum">在单词本里 <b>${marked.length}</b> 个 · 还没标记 <b>${open.length}</b> 个</p>
    <div class="seg sm" role="group" aria-label="等级">${[['4', '四级以上'], ['6', '六级以上'], ['k', '考研以上']].map(([k, t]) => `<button data-act="nwlvl" data-v="${k}" aria-pressed="${S.nwLvl === k}">${t}</button>`).join('')}</div>
    ${marked.length ? `<h5 class="p-sec">单词本里的词</h5><ul class="nw">${marked.map(row).join('')}</ul>` : ''}
    ${open.length ? `<h5 class="p-sec">可能不认识的词</h5><ul class="nw">${open.map(row).join('')}</ul>
      <div class="p-actions"><button class="pbtn${S.confirmBulk ? ' primary' : ' ghost'}" data-act="nwbulk">${S.confirmBulk ? `再点一次：${open.length} 个全部标为已掌握` : '其余都认识 · 全部标为已掌握'}</button></div>`
      : `<p class="dload">这个等级下没有还没标记的词了。</p>`}
    <p class="bank-note">已掌握和忽略的词不会再出现在这里，也不会在文中着色。等级来自 ECDICT 的考试词表。</p>`;
}
function nwSet(a, key, stt){
  const r = nwRows(a).find(x => x.key === key) || null;
  const rec = r ? r.rec : S.words[key];
  if (rec && rec.status === stt) return;
  const patch = { status: stt, forms: r ? [r.lw, key, ...inflect(key)] : [key, ...inflect(key)], fill: { pos: r && r.lex ? r.lex[0] : '', zh: r && r.lex ? r.lex[1] : '', en: r && r.lex ? (r.lex[2] || '') : '', lvl: (r && r.lv) || '' } };
  const ctx = r ? { art: a.id, title: a.title, p: r.p, s: r.s, text: fullSent(a, r.p, r.s), at: Date.now() } : null;
  return upsertWord(rec ? rec.w : key, patch, ctx);
}

/* ---------- floating word card ---------- */
const popCur = () => S.pop.length ? S.pop[S.pop.length - 1] : null;
function openPop(P, push){
  if (push) S.pop.push(P); else S.pop = [P];
  S.dictAll = false; S.newCat = false;
  loadDict(P, P.w, P.pos || '');
  renderPop();
}
function closePop(){ if (!S.pop.length) return; S.pop = []; S.newCat = false; renderPop(); }
function refresh(P){ if (popCur() === P) renderPop(true); if (S.dk && S.dk.P === P) dkRenderEntry(true); }
const DICT_LINKS = (lemma, w) => [
  ['剑桥词典', `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${encodeURIComponent(lemma)}`],
  ['有道', `https://dict.youdao.com/result?word=${encodeURIComponent(w)}&lang=en`],
  ['YouGlish 真人发音', `https://youglish.com/pronounce/${encodeURIComponent(w)}/english`]
];
function popHtml(P){
  const a = cur(); const D = P.dict; const ok = D && D.state === 'ok'; const e = ok ? D.res.e || {} : {};
  const lemma = ok ? D.res.lemma : lemmaOf(P.w);
  const R = recOf(P);
  const lex = P.kind === 'word' && a ? lexOf(a, P.w) : null;
  const opt = P.kind === 'opt' && a ? a.options[P.l] : null;
  const kw = P.kind === 'word' && P.k != null && a ? (a.keys || [])[P.k] : null;
  const ipa = e.i && (e.i[0] || e.i[1]) ? (e.i[0] || e.i[1]) : (e.p || (R && R.ph) || '');
  const lv = levelOf(lemma) || (ok && LEVEL ? 'x' : null);
  const back = S.pop.length > 1 ? S.pop[S.pop.length - 2] : null;
  let h = `<div class="pop-hd">
    <div class="pop-tt">${back ? `<button class="pop-back" data-act="pback">‹ ${esc(back.disp)}</button>` : ''}
      <div class="pop-title"><b class="pop-w">${esc(P.disp)}</b>${ipa ? `<button class="pop-ipa" data-act="speak" data-w="${esc(P.disp)}" title="点击朗读">/${esc(ipa)}/</button>` : ''}${lv ? `<span class="lvl lvl-${lv}">${LVL[lv]}</span>` : ''}${R ? `<span class="stp st-${R.status}">${STATUS[R.status]}</span>` : ''}</div></div>
    <button class="pop-x" data-act="pclose" aria-label="关闭">×</button></div><div class="pop-body">`;
  if (ok && D.res.form) h += `<p class="pop-lem">${esc(D.res.form)} → 原形 <b>${esc(D.res.lemma)}</b>${D.res.ff ? ` · ${esc(formNote(D.res.ff, P.pos))}` : ''}</p>`;
  const cm = lex ? { pos: lex[0], zh: lex[1], en: lex[2] } : opt ? { pos: opt.pos, zh: opt.zh, en: opt.en } : null;
  if (cm) h += `<div class="pop-ctx"><span class="pop-lbl">${P.kind === 'opt' ? '选项' : '本文'}</span><div class="pop-ctxm"><span class="chip ${posClass(cm.pos)}">${esc(shortPos(cm.pos))}</span> <span class="pop-ctxzh">${esc(cm.zh)}</span>${cm.en ? `<span class="pop-ctxen">${esc(cm.en)}</span>` : ''}</div></div>`;
  else if (P.kind === 'word' && S.sample && a) h += `<button class="more" data-act="lookup">让 Claude 按语境释义</button>`;
  if (!D || D.state === 'loading') h += `<p class="dload"><span class="spin"></span>正在查词典…</p>`;
  else if (D.state === 'err') h += `<p class="dload">词典没加载出来。<button class="more" data-act="dictretry">重试</button></p>`;
  else if (D.state === 'none') h += `<p class="dload">词典里没有收录这个词。</p>`;
  else {
    const tr = trLines(e.t, ctxKey(P.pos)).slice(0, 3);
    h += `<ul class="pop-mean">${tr.map(l => `<li style="--pc:var(--${({ v: 'pos-v', n: 'pos-n', a: 'pos-adj', r: 'pos-adv' })[l.k] || 'ink-3'})"><span class="tp">${esc(l.tp)}</span><span>${esc(l.text)}</span></li>`).join('')}</ul>`;
    if (!cm || !cm.en) { const d0 = defLines(e, ctxKey(P.pos))[0]; if (d0) h += `<p class="pop-en"><span class="tp">EN</span>${esc(d0.text)}</p>`; }
  }
  if (kw) h += `<div class="pop-kw"><b>${kw.k === 'phrase' ? '搭配' : '重点'} · ${esc(kw.t)}</b>${esc(kw.n)}${kw.k === 'phrase' ? ` <button class="more" data-act="pkw">${S.words[wkey(kw.t)] ? '已收藏搭配 · 移除' : '收藏搭配'}</button>` : ''}</div>`;
  h += `<div class="pop-act">
      ${canSpeak ? `<button class="pa-btn" data-act="speak" data-w="${esc(P.disp)}">${SPEAK}<span>发音</span></button>` : ''}
      <select class="pa-sel" id="popCat" aria-label="分类">${catOptions(R ? R.cat : '')}</select>
      <button class="pa-btn pa-save${R ? ' on' : ''}${R && S.justSaved ? ' just' : ''}" data-act="pcollect"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="${R ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>${R ? '已收藏' : '收藏'}</span></button>
    </div>
    ${S.newCat ? `<div class="pop-newcat"><input id="newCatIn" type="text" maxlength="20" placeholder="分类名，如 六级高频" autocomplete="off"><button class="pa-btn" data-act="addcat">添加</button></div>` : ''}
    <div class="pop-st" role="group" aria-label="熟悉度">${ST_ORDER.map(x => `<button class="st-b st-${x}${R && R.status === x ? ' on' : ''}" data-act="pstatus" data-s="${x}">${STATUS[x]}</button>`).join('')}</div>`;
  if (ok && P.showDetail) h += `<div class="pop-detail">${detailFull(P)}</div>`;
  h += `</div><div class="pop-foot"><div class="pop-links">${DICT_LINKS(lemma, P.w).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div>
    <button class="pop-dk" data-act="dkfrom">在词典中打开 ↗</button>${ok ? `<button class="pop-more" data-act="${P.showDetail ? 'detailoff' : 'detail'}">${P.showDetail ? '收起详解 ▴' : '展开详解 ▾'}</button>` : ''}</div>`;
  return h;
}
function detailFull(P){
  const e = P.dict.res.e || {}; const key = ctxKey(P.pos);
  const tags = (e.g || '').split(' ').filter(t => TAGS[t]).map(t => `<span class="tag${t === 'cet6' ? ' hot' : ''}">${TAGS[t]}</span>`).join('');
  const stars = e.c ? `<span class="stars" title="柯林斯 ${e.c} 星">${'★'.repeat(e.c)}${'☆'.repeat(5 - e.c)}</span>` : '';
  const ipa2 = e.i && e.i[0] && e.i[1] ? `<span class="ipa">英 /${esc(e.i[0])}/ · 美 /${esc(e.i[1])}/</span>` : '';
  const tr = trLines(e.t, key);
  const df = defLines(e, key); const n = S.dictAll ? df.length : Math.min(4, df.length);
  const li = (l, cls) => `<li class="${key && l.k === key ? 'hit' : ''}" style="--pc:var(--${({ v: 'pos-v', n: 'pos-n', a: 'pos-adj', r: 'pos-adv' })[l.k] || 'ink-3'})"><span class="tp">${esc(l.tp)}</span><span class="${cls}">${esc(l.text)}${l.ex ? `<em class="exm">${esc(l.ex)}</em>` : ''}</span></li>`;
  return `${ipa2 || tags || stars ? `<div class="phon">${ipa2}${tags}${e.o ? '<span class="tag">牛津3000</span>' : ''}${stars}</div>` : ''}
    ${tr.length > 3 ? `<h5 class="p-sec">全部中文释义</h5><ul class="dl">${tr.map(l => li(l, 'zh')).join('')}</ul>` : ''}
    ${df.length ? `<h5 class="p-sec">英英释义 · WordNet</h5><ol class="dl en-list">${df.slice(0, n).map(l => li(l, 'en')).join('')}</ol>
      ${df.length > 4 ? `<button class="more" data-act="dictmore">${S.dictAll ? '收起' : `展开全部 ${df.length} 条`}</button>` : ''}` : ''}
    ${detailBlock(P)}${DSRC}`;
}
function renderPop(keep){
  const el = $('#pop'); const P = popCur();
  $$('#view .w.on, #view .opt.on').forEach(x => x.classList.remove('on'));
  if (!P) {
    highlight();
    if (el.hidden) return;
    if (reduced()) { el.hidden = true; el.innerHTML = ''; el.classList.remove('big'); return; }
    el.classList.add('leaving'); clearTimeout(S.popLeaveT);
    S.popLeaveT = setTimeout(() => { if (!popCur()) { el.hidden = true; el.innerHTML = ''; el.classList.remove('big', 'leaving'); } }, 150);
    return;
  }
  clearTimeout(S.popLeaveT); el.classList.remove('leaving');
  const wasHidden = el.hidden;
  const body0 = el.querySelector('.pop-body'); const y = keep && body0 ? body0.scrollTop : 0;
  const focusNew = S.newCat && !(document.activeElement && document.activeElement.id === 'newCatIn') ? true : false;
  const keepVal = $('#newCatIn') ? $('#newCatIn').value : '';
  el.innerHTML = popHtml(P); S.justSaved = false;
  el.hidden = false;
  if (wasHidden || !keep) { el.classList.remove('opening'); void el.offsetWidth; el.classList.add('opening'); }
  el.classList.toggle('big', !!P.showDetail);
  el.classList.toggle('docked', !P.anchor);
  const body = el.querySelector('.pop-body'); if (body) body.scrollTop = y;
  const ni = $('#newCatIn'); if (ni) { ni.value = keepVal; if (focusNew || keepVal) ni.focus(); }
  marks();
  placePop();
}
function placePop(){
  const el = $('#pop'); const P = popCur(); if (!P || el.hidden) return;
  const an = P.anchor ? $(P.anchor) : null;
  const W = window.innerWidth, H = window.innerHeight, M = 12, G = 8;
  const w = Math.min(P.showDetail ? 480 : 440, W - 2 * M);
  el.style.width = w + 'px'; el.style.maxHeight = 'none'; el.style.top = '0px'; el.style.left = '-9999px';
  const natural = el.offsetHeight;
  let r = an ? an.getBoundingClientRect() : null;
  if (r && (r.bottom < 0 || r.top > H || (!r.width && !r.height))) r = null;
  if (r && !P.placed && W < 1040) {
    const room = Math.max(H - r.bottom - G - M, r.top - G - M);
    const want0 = Math.min(natural, H * (P.showDetail ? 0.8 : 0.72));
    if (room < want0) { window.scrollBy(0, r.top - 84); r = an.getBoundingClientRect(); }
  }
  P.placed = true;
  let topY, maxH, left;
  if (!r) {
    maxH = H - 2 * M; const hgt = Math.min(natural, maxH);
    topY = W < 700 ? H - M - hgt : Math.max(M, (H - hgt) / 2);
    left = (W - w) / 2;
  } else {
    const below = H - r.bottom - G - M, above = r.top - G - M;
    const want = Math.min(natural, H * (P.showDetail ? 0.88 : 0.72));
    if (below >= want || below >= above) { maxH = below; topY = r.bottom + G; }
    else { maxH = above; topY = r.top - G - Math.min(want, above); }
    if (maxH < Math.min(want, 240)) { maxH = H - 2 * M; const hgt = Math.min(natural, maxH); topY = W < 700 ? H - M - hgt : Math.max(M, (H - hgt) / 2); }
    left = Math.min(Math.max(M, r.left + r.width / 2 - w / 2), W - w - M);
  }
  el.style.maxHeight = Math.floor(Math.min(maxH, H - 2 * M)) + 'px';
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(Math.max(M, topY)) + 'px';
  el.dataset.side = r && topY < r.top ? 'above' : 'below';
}
function wordPopFrom(wEl){
  const sEl = wEl.closest('.s'); const kw = wEl.closest('.kw');
  const lw = wEl.textContent.toLowerCase(); const le = lexOf(cur(), lw);
  const p = +sEl.dataset.p, s = +sEl.dataset.s, i = +wEl.dataset.i;
  return { kind: 'word', w: lw, disp: wEl.textContent, p, s, i, k: kw ? +kw.dataset.k : null, pos: le ? le[0] : '',
    anchor: `#body .s[data-p="${p}"][data-s="${s}"] .w[data-i="${i}"]` };
}
function optPop(l, anchored){
  const a = cur(); const o = a && a.options[l]; if (!o) return null;
  return { kind: 'opt', l, w: o.w.toLowerCase(), disp: o.w, pos: o.pos, anchor: anchored ? `.opt[data-l="${l}"]` : null };
}
function popAt(p, s, i){
  const sel = `#body .s[data-p="${p}"][data-s="${s}"] .w[data-i="${i}"]`;
  const el = $(sel); if (!el) return false;
  if (window.innerWidth < 1040 && S.panel) { S.panel = null; renderPanel(); }
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.bottom > window.innerHeight * 0.55) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  requestAnimationFrame(() => openPop(wordPopFrom(el)));
  return true;
}

/* ---------- spaced repetition: FSRS-4.5 with its published default parameters ---------- */
const FW = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DAY = 864e5, F_DECAY = -0.5, F_FACTOR = 19 / 81, F_RET = 0.9;
const clampD = d => Math.min(10, Math.max(1, d));
const fD0 = g => clampD(FW[4] - (g - 3) * FW[5]);
const fR = (t, s) => Math.pow(1 + F_FACTOR * t / s, F_DECAY);
const fIvl = s => Math.max(1, Math.min(36500, Math.round(s / F_FACTOR * (Math.pow(F_RET, 1 / F_DECAY) - 1))));
const fNextD = (d, g) => clampD(FW[7] * fD0(3) + (1 - FW[7]) * (d - FW[6] * (g - 3)));
const fSOk = (d, s, r, g) => s * (1 + Math.exp(FW[8]) * (11 - d) * Math.pow(s, -FW[9]) * (Math.exp((1 - r) * FW[10]) - 1) * (g === 2 ? FW[15] : 1) * (g === 4 ? FW[16] : 1));
const fSFail = (d, s, r) => FW[11] * Math.pow(d, -FW[12]) * (Math.pow(s + 1, FW[13]) - 1) * Math.exp((1 - r) * FW[14]);
function fsrsNext(srs, g, now){
  if (!srs || !srs.reps) {
    const s = FW[g - 1], d = fD0(g);
    return { s, d, reps: 1, lapses: 0, last: now, due: g === 1 ? now + 10 * 60e3 : now + fIvl(s) * DAY };
  }
  const t = Math.max(0, (now - srs.last) / DAY), r = fR(t, srs.s);
  if (g === 1) return { s: Math.min(fSFail(srs.d, srs.s, r), srs.s), d: fNextD(srs.d, 1), reps: srs.reps + 1, lapses: (srs.lapses || 0) + 1, last: now, due: now + 10 * 60e3 };
  const s = fSOk(srs.d, srs.s, r, g);
  return { s, d: fNextD(srs.d, g), reps: srs.reps + 1, lapses: srs.lapses || 0, last: now, due: now + fIvl(s) * DAY };
}
function fsrsPreview(srs, now){
  const o = {}; [1, 2, 3, 4].forEach(g => { o[g] = fsrsNext(srs, g, now); });
  if (o[3].due <= o[2].due) o[3].due = o[2].due + DAY;
  if (o[4].due <= o[3].due) o[4].due = o[3].due + DAY;
  return o;
}
function spanLabel(ms){
  const m = ms / 60e3;
  if (m < 60) return `${Math.max(1, Math.round(m))} 分钟`;
  if (m < 1440) return `${Math.round(m / 60)} 小时`;
  const d = Math.round(m / 1440);
  if (d < 31) return `${d} 天`;
  if (d < 365) return `${Math.round(d / 30)} 个月`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')} 年`;
}
function dueList(){ const now = Date.now(); return Object.values(S.words).filter(w => w.srs && w.srs.reps && w.status !== 'ignored' && w.srs.due <= now).sort((a, b) => a.srs.due - b.srs.due); }
function newToday(){ const t = LS.get('newDay', {}); return t.d === new Date().toDateString() ? t.n : 0; }
function newQueue(){
  const left = Math.max(0, S.newLimit - newToday());
  return Object.values(S.words).filter(w => (!w.srs || !w.srs.reps) && (w.status === 'new' || w.status === 'learning')).sort((a, b) => (a.at || 0) - (b.at || 0)).slice(0, left);
}

/* ---------- vocab book ---------- */
function vocabHtml(){
  const all = Object.values(S.words);
  const n = s => all.filter(w => w.status === s).length;
  const due = dueList().length + newQueue().length;
  const tabs = [['list', '词表'], ['review', `复习${due ? ` · ${due}` : ''}`], ['dict', '默写'], ['backup', '备份']];
  const head = `<div class="sect-head"><h2>单词本</h2><p>生词 ${n('new')} · 学习中 ${n('learning')} · 已掌握 ${n('known')}${n('ignored') ? ` · 忽略 ${n('ignored')}` : ''}</p></div>
    <div class="seg vtabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" data-act="vtab" data-v="${k}" aria-pressed="${S.vtab === k}">${t}</button>`).join('')}</div>`;
  if (S.vtab === 'review') return head + reviewHtml();
  if (S.vtab === 'dict') return head + dictationHtml();
  if (S.vtab === 'backup') return head + backupHtml();
  const arts = [...new Set(all.flatMap(w => (w.ctx || []).map(c => c.art)))];
  return head + `<div class="vtools">
      ${[['all', '全部'], ['new', '生词'], ['learning', '学习中'], ['known', '已掌握'], ['ignored', '忽略']].map(([k, t]) => `<button class="tbtn" data-act="vf" data-v="${k}" aria-pressed="${S.vf === k}">${t}</button>`).join('')}
    </div>
    <div class="vtools">
      <input id="vq" type="search" placeholder="搜索单词或释义" value="${esc(S.vq)}" autocomplete="off">
      <select id="vcSel" aria-label="按分类筛选"><option value="all">全部分类</option><option value=""${S.vc === '' ? ' selected' : ''}>未分类</option>${S.cats.map(c => `<option value="${esc(c)}"${S.vc === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select id="vaSel" aria-label="按文章筛选"><option value="all">全部文章</option>${arts.map(id => { const a = S.articles.find(x => x.id === id); const w = all.find(x => (x.ctx || []).some(c => c.art === id)); const t = a ? a.title : (w && w.ctx.find(c => c.art === id).title); return `<option value="${esc(id)}" ${S.va === id ? 'selected' : ''}>${esc(t || id)}</option>`; }).join('')}</select>
      <button class="tbtn" data-act="toggle" data-k="hideZh" aria-pressed="${S.hideZh}">遮住释义自测</button>
    </div>
    <div id="vlist">${vocabListHtml()}</div>`;
}
function vocabFiltered(){
  let list = Object.values(S.words);
  if (S.vf === 'all') list = list.filter(w => w.status !== 'ignored'); else list = list.filter(w => w.status === S.vf);
  if (S.vc !== 'all') list = list.filter(w => (w.cat || '') === S.vc);
  if (S.va !== 'all') list = list.filter(w => (w.ctx || []).some(c => c.art === S.va));
  const q = S.vq.trim().toLowerCase();
  if (q) list = list.filter(w => w.w.includes(q) || (w.zh || '').includes(q) || (w.en || '').toLowerCase().includes(q));
  return list.sort((a, b) => (b.at || 0) - (a.at || 0));
}
function markIn(text, forms){
  let h = esc(text || '');
  const fs = [...new Set(forms || [])].filter(Boolean).sort((a, b) => b.length - a.length).map(f => esc(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  if (!fs.length) return h;
  return h.replace(new RegExp(`\\b(${fs.join('|')})\\b`, 'i'), '<mark>$1</mark>');
}
function vocabListHtml(){
  if (!Object.keys(S.words).length) return `<div class="empty"><h2>还没有生词</h2><p>在精读页点任意单词，卡片里点“收藏”或选一个熟悉度。也可以打开“本篇生词”批量标记。</p></div>`;
  const list = vocabFiltered();
  if (!list.length) return `<p class="p-miss">这个筛选下没有单词。</p>`;
  return `<div class="vgrid">${list.map(w => {
    const blur = S.hideZh && !S.vshow.has(w.w);
    const c0 = (w.ctx || [])[0];
    const due = w.srs && w.srs.reps ? (w.srs.due <= Date.now() ? '今天该复习' : `${spanLabel(w.srs.due - Date.now())}后复习`) : '还没复习过';
    return `<article class="vitem vs-${w.status}">
      <div class="vhead"><button class="vword" data-act="vlook" data-k="${esc(w.w)}">${esc(w.w)}</button>${w.ph ? `<span class="vipa">/${esc(w.ph)}/</span>` : ''}${wLvl(w) ? `<span class="lvl lvl-${wLvl(w)}">${LVL[wLvl(w)] || ''}</span>` : ''}${speakBtn(w.w)}</div>
      <div class="mini-st">${ST_ORDER.map(x => `<button class="st-b st-${x}${w.status === x ? ' on' : ''}" data-act="vst" data-k="${esc(w.w)}" data-s="${x}">${STATUS[x]}</button>`).join('')}</div>
      <p class="vzh${blur ? ' blur' : ''}" ${blur ? `data-act="vreveal" data-k="${esc(w.w)}" title="点按显示"` : ''}>${w.pos ? `<span class="chip ${posClass(w.pos)}">${esc(shortPos(w.pos))}</span> ` : ''}${esc(w.zh)}</p>
      ${w.en && !blur ? `<p class="ven">${esc(w.en)}</p>` : ''}
      ${c0 && c0.text ? `<p class="vctx">${markIn(c0.text, w.forms)}</p>` : ''}
      <div class="vsrc">${c0 ? `《${esc(c0.title || '')}》 ¶${(c0.p ?? 0) + 1}${w.ctx.length > 1 ? ` · 出现在 ${w.ctx.length} 处` : ''} · ` : ''}${due}</div>
      <div class="vact">${c0 ? `<button class="pbtn" data-act="goto" data-k="${esc(w.w)}">回到原句</button>` : ''}
        <select class="vcat" data-k="${esc(w.w)}" aria-label="分类">${catOptions(w.cat || '')}</select>
        <button class="pbtn ghost" data-act="vdel" data-k="${esc(w.w)}" style="${S.confirmDelW === w.w ? 'color:var(--red);border-color:var(--red)' : ''}">${S.confirmDelW === w.w ? '确认删除' : '删除'}</button></div>
    </article>`;
  }).join('')}</div>`;
}
function renderVocabList(){ const el = $('#vlist'); if (el) el.innerHTML = vocabListHtml(); else renderView(); }
function afterVocabRender(){
  S.rvAnim = false;
  const i = $('#dtIn'); if (i && S.dt && S.dt.state === 'ask') { i.value = S.dt.input || ''; i.focus(); }
}

/* review */
function reviewHtml(){
  const R = S.rv;
  if (!R) {
    const due = dueList(), fresh = newQueue();
    const upcoming = Object.values(S.words).filter(w => w.srs && w.srs.reps && w.srs.due > Date.now() && w.status !== 'ignored').sort((a, b) => a.srs.due - b.srs.due)[0];
    return `<section class="rv">
      <div class="rv-intro">
        <div class="rv-stat"><b class="cu" data-to="${due.length}">${due.length}</b><span>到期复习</span></div>
        <div class="rv-stat"><b class="cu" data-to="${fresh.length}">${fresh.length}</b><span>今日新词</span></div>
        <div class="rv-stat"><b>${Object.values(S.words).filter(w => w.srs && w.srs.reps).length}</b><span>已在复习</span></div>
      </div>
      ${due.length + fresh.length ? `<button class="pbtn primary big" data-act="rvstart">开始复习 · ${due.length + fresh.length} 个</button>`
        : `<p class="dload">今天没有要复习的词了。${upcoming ? `下一个是 <b>${esc(upcoming.w)}</b>，${spanLabel(upcoming.srs.due - Date.now())}后。` : '先去精读页收藏一些生词吧。'}</p>`}
      <div class="rv-set"><label for="newLimit">每天新词上限</label><select id="newLimit">${[10, 20, 30, 50].map(v => `<option value="${v}"${S.newLimit === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <p class="bank-note">复习间隔用 FSRS 间隔重复算法排期（FSRS-4.5，默认参数，目标记忆保持率 90%）。生词和学习中的词会进入复习；一个词的记忆稳定期超过 30 天会自动标为已掌握。</p>
    </section>`;
  }
  if (R.i >= R.q.length) return `<section class="rv"><div class="rv-card done"><p class="rv-done">这一轮复习完了 ✓</p><p class="dload">共 ${R.done} 次作答，其中 ${R.again} 次选了“忘了”。</p><div class="p-actions" style="justify-content:center"><button class="pbtn primary" data-act="rvend">好的</button></div></div></section>`;
  const w = S.words[R.q[R.i]]; if (!w) { R.i++; return reviewHtml(); }
  const c0 = (w.ctx || [])[0]; const pv = fsrsPreview(w.srs, Date.now());
  return `<section class="rv"><div class="rv-card${S.rvAnim ? ' enter' : ''}">
    <div class="rv-prog"><span>剩余 ${R.q.length - R.i}</span><span>${w.srs && w.srs.reps ? '复习' : '新词'}</span></div>
    <div class="rv-w">${esc(w.w)}</div>
    <div class="rv-ipa">${w.ph ? `/${esc(w.ph)}/` : ''} ${speakBtn(w.w)}</div>
    ${c0 && c0.text ? `<p class="rv-ctx">${markIn(c0.text, w.forms)}</p>` : ''}
    ${R.shown ? `<div class="rv-ans">${w.pos ? `<span class="chip ${posClass(w.pos)}">${esc(shortPos(w.pos))}</span> ` : ''}<b>${esc(w.zh || '（没有释义）')}</b>${w.en ? `<p class="ven">${esc(w.en)}</p>` : ''}</div>
      <div class="rate">${[[1, '忘了'], [2, '模糊'], [3, '记得'], [4, '简单']].map(([g, t]) => `<button class="r${g}" data-act="rvrate" data-g="${g}">${t}<small>${spanLabel(pv[g].due - Date.now())}</small></button>`).join('')}</div>
      <p class="bank-note" style="text-align:center">快捷键 1 2 3 4</p>`
      : `<button class="pbtn primary big" data-act="rvshow">显示释义 <small>空格</small></button>`}
  </div></section>`;
}
function rvStart(){
  const q = [...dueList(), ...newQueue()].map(w => w.w);
  S.rv = { q, i: 0, shown: false, done: 0, again: 0 }; S.rvAnim = true;
  renderView();
}
function rvRate(g){
  const R = S.rv; if (!R || !R.shown) return;
  const w = S.words[R.q[R.i]]; if (!w) return;
  const now = Date.now(); const wasNew = !w.srs || !w.srs.reps;
  const srs = fsrsPreview(w.srs, now)[g];
  let status = w.status;
  if (g >= 2 && status === 'new') status = 'learning';
  if (g === 1 && status === 'known') status = 'learning';
  if (g >= 3 && status === 'learning' && srs.s >= 30) { status = 'known'; toast(`${w.w} 已标为已掌握`); }
  upsertWord(w.w, { srs, status });
  if (wasNew) { const t = LS.get('newDay', {}); const d = new Date().toDateString(); LS.set('newDay', { d, n: (t.d === d ? t.n : 0) + 1 }); }
  R.done++; if (g === 1) { R.again++; R.q.push(w.w); }
  R.i++; R.shown = false; S.rvAnim = true;
  renderChrome(); renderView();
}

/* dictation */
function dtPool(){
  const sc = S.dtScope; let list = Object.values(S.words).filter(w => !/\s/.test(w.w) && (w.zh || w.en));
  if (sc === 'learn') list = list.filter(w => w.status === 'new' || w.status === 'learning');
  else if (sc === 'all') list = list.filter(w => w.status !== 'ignored');
  else if (sc.startsWith('cat:')) list = list.filter(w => (w.cat || '') === sc.slice(4) && w.status !== 'ignored');
  return list;
}
function maskIn(text, forms){
  const fs = [...new Set(forms || [])].filter(Boolean).sort((a, b) => b.length - a.length).map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!fs.length) return esc(text);
  return esc(String(text).replace(new RegExp(`\\b(${fs.join('|')})\\b`, 'gi'), '\u0000')).replace(/\u0000/g, '<span class="gapw">_____</span>');
}
function dictationHtml(){
  const D = S.dt;
  if (!D) {
    const pool = dtPool();
    return `<section class="rv">
      <div class="rv-set"><label for="dtScope">默写范围</label><select id="dtScope"><option value="learn"${S.dtScope === 'learn' ? ' selected' : ''}>生词 + 学习中</option><option value="all"${S.dtScope === 'all' ? ' selected' : ''}>全部（除忽略）</option>${S.cats.map(c => `<option value="cat:${esc(c)}"${S.dtScope === 'cat:' + c ? ' selected' : ''}>分类：${esc(c)}</option>`).join('')}</select></div>
      ${pool.length ? `<button class="pbtn primary big" data-act="dtstart">开始默写 · ${Math.min(20, pool.length)} 个</button>` : `<p class="dload">这个范围里还没有可以默写的单词。</p>`}
      <p class="bank-note">看中文释义、英文释义和挖空的原句，拼出这个词。每轮随机 20 个。拼错的已掌握词会退回学习中。</p>
    </section>`;
  }
  if (D.i >= D.q.length) {
    return `<section class="rv"><div class="rv-card done"><p class="rv-done">默写完成：${D.right} / ${D.q.length}</p>
      ${D.wrong.length ? `<h5 class="p-sec">拼错的词</h5><ul class="dt-wrong">${D.wrong.map(x => `<li><b>${esc(x.w)}</b><s>${esc(x.got || '（跳过）')}</s></li>`).join('')}</ul>` : '<p class="dload">全对，厉害。</p>'}
      <div class="p-actions" style="justify-content:center">${D.wrong.length ? `<button class="pbtn primary" data-act="dtretry">再练一遍错词</button>` : ''}<button class="pbtn ghost" data-act="dtend">结束</button></div></div></section>`;
  }
  const w = S.words[D.q[D.i]]; if (!w) { D.i++; return dictationHtml(); }
  const c0 = (w.ctx || [])[0];
  const hint = D.hint ? `${w.w[0]} ${'_ '.repeat(w.w.length - 1).trim()}` : `${w.w.length} 个字母`;
  const res = D.state === 'ask' ? '' : D.state === 'right'
    ? `<p class="dt-res ok">✓ ${esc(w.w)}</p>`
    : `<p class="dt-res bad"><s>${esc(D.input || '（空）')}</s> → <span class="dt-diff">${diffMark(D.input || '', w.w)}</span></p>`;
  return `<section class="rv"><div class="rv-card">
    <div class="rv-prog"><span>第 ${D.i + 1} / ${D.q.length} 题</span><span>对 ${D.right}</span></div>
    <p class="dt-zh">${w.pos ? `<span class="chip ${posClass(w.pos)}">${esc(shortPos(w.pos))}</span> ` : ''}${esc(w.zh)}</p>
    ${w.en ? `<p class="ven" style="text-align:center">${esc(w.en)}</p>` : ''}
    ${c0 && c0.text ? `<p class="rv-ctx">${maskIn(c0.text, w.forms)}</p>` : ''}
    <p class="dt-hint">${hint}</p>
    ${D.state === 'ask' ? `<input id="dtIn" class="dt-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="拼写这个单词，回车确认" aria-label="拼写">
      <div class="p-actions" style="justify-content:center"><button class="pbtn primary" data-act="dtcheck">确认</button>${canSpeak ? '<button class="pbtn ghost" data-act="dtsay">听发音</button>' : ''}${D.hint ? '' : '<button class="pbtn ghost" data-act="dthint">提示首字母</button>'}<button class="pbtn ghost" data-act="dtskip">跳过</button></div>`
      : `${res}<div class="p-actions" style="justify-content:center"><button class="pbtn primary" data-act="dtnext" id="dtNext">下一个 <small>回车</small></button>${speakBtn(w.w)}</div>`}
  </div></section>`;
}
function dtStart(keys){
  const pool = keys ? keys : dtPool().map(w => w.w);
  const q = [...pool].sort(() => Math.random() - .5).slice(0, 20);
  S.dt = { q, i: 0, right: 0, wrong: [], state: 'ask', input: '', hint: false };
  renderView();
}
function dtCheck(skip){
  const D = S.dt; if (!D || D.state !== 'ask') return;
  const w = S.words[D.q[D.i]]; if (!w) return;
  const got = skip ? '' : ($('#dtIn') ? $('#dtIn').value : D.input).trim().toLowerCase();
  D.input = got;
  if (!skip && got === w.w) { D.state = 'right'; D.right++; }
  else { D.state = 'wrong'; D.wrong.push({ w: w.w, got }); if (w.status === 'known') upsertWord(w.w, { status: 'learning' }); }
  renderView();
  const nb = $('#dtNext'); if (nb) nb.focus();
}
function dtNext(){ const D = S.dt; if (!D) return; D.i++; D.state = 'ask'; D.input = ''; D.hint = false; renderView(); }

/* backup */
function backupHtml(){
  const B = S.bk || {};
  return `<section class="bk">
    <div class="bk-item"><h4>导出全部数据</h4><p>文章、作答进度、单词本（含熟悉度、分类、复习进度）和 Claude 讲解，存成一个 JSON 文件。以后搬到 GitHub 版本时可以直接导入。</p>
      <button class="pbtn primary" data-act="exjson">导出 JSON</button></div>
    <div class="bk-item"><h4>导出到 Anki</h4><p>字段依次是：单词、音标、词性、中文释义、英文释义、原句、等级、熟悉度、分类。CSV 格式，在 Anki 里选“导入文件”即可。</p>
      <div class="vtools"><select id="exScope"><option value="learn">生词 + 学习中</option><option value="all">全部（除忽略）</option>${S.cats.map(c => `<option value="cat:${esc(c)}">分类：${esc(c)}</option>`).join('')}</select><button class="pbtn primary" data-act="excsv">导出 CSV</button></div></div>
    <div class="bk-item"><h4>从备份恢复</h4><p>选择之前导出的 JSON。只会补上缺少的内容；同一个单词保留更新时间较晚的那份，不会删除任何东西。</p>
      <input type="file" id="imFile" accept=".json,application/json">
      ${B.pending ? `<div class="note"><b>准备恢复</b><br>${B.pending.summary}</div><div class="p-actions"><button class="pbtn primary" data-act="imgo" ${B.busy ? 'disabled' : ''}>${B.busy ? '正在恢复…' : '确认恢复'}</button><button class="pbtn ghost" data-act="imcancel">取消</button></div>` : ''}
      ${B.msg ? `<p class="imp-status"><span class="${B.err ? 'err' : 'done'}">${esc(B.msg)}</span></p>` : ''}</div>
    ${B.fallback ? `<div class="bk-item"><h4>${esc(B.fallback.name)}</h4><p>这里不能直接下载文件。全选下面的内容，复制后存成 ${esc(B.fallback.name)}。</p><textarea id="bkText" readonly>${esc(B.fallback.data)}</textarea><div class="p-actions"><button class="pbtn" data-act="bkcopy">复制</button></div></div>` : ''}
  </section>`;
}
const ymd = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const strip = o => { const c = { ...o }; delete c._id; return c; };
async function saveFile(name, data){
  S.bk = { ...(S.bk || {}), msg: '', err: false, fallback: null };
  if (S.dl) {
    try { await S.dl.save({ filename: name, data }); S.bk.msg = `已导出 ${name}`; renderView(); return; }
    catch(e){
      if (e && e.code === 'declined') { S.bk.msg = '已取消导出'; renderView(); return; }
      if (e && e.code === 'rate_limited') { S.bk.msg = '上一个保存提示还开着，处理完再试'; S.bk.err = true; renderView(); return; }
    }
  }
  S.bk.fallback = { name, data: typeof data === 'string' ? data.replace(/^﻿/, '') : '' };
  renderView();
}
function exportJson(){
  const data = { app: 'close-reader', version: 2, exportedAt: new Date().toISOString(),
    articles: S.articles.map(a => ({ ...a })), progress: S.prog, words: Object.values(S.words).map(strip), settings: { cats: S.cats }, notes: S.notes };
  saveFile(`close-reader-backup-${ymd()}.json`, JSON.stringify(data, null, 1));
}
function exportCsv(){
  const sc = $('#exScope') ? $('#exScope').value : 'learn';
  let list = Object.values(S.words).filter(w => w.status !== 'ignored');
  if (sc === 'learn') list = list.filter(w => w.status === 'new' || w.status === 'learning');
  else if (sc.startsWith('cat:')) list = list.filter(w => (w.cat || '') === sc.slice(4));
  if (!list.length) { S.bk = { ...(S.bk || {}), msg: '这个范围里没有单词', err: true }; renderView(); return; }
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['单词', '音标', '词性', '中文释义', '英文释义', '原句', '等级', '熟悉度', '分类'].map(q).join(',')];
  list.forEach(w => rows.push([w.w, w.ph ? `/${w.ph}/` : '', w.pos, w.zh, w.en, (w.ctx || [])[0] ? w.ctx[0].text : '', LVL[wLvl(w)] || '', STATUS[w.status], w.cat].map(q).join(',')));
  saveFile(`vocab-${ymd()}.csv`, '﻿' + rows.join('\r\n'));
}
function readBackup(file){
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || d.app !== 'close-reader') throw new Error('not ours');
      const arts = (d.articles || []).filter(a => a && a.id && !S.articles.some(x => x.id === a.id));
      const words = (d.words || []).filter(w => w && w.w && (!S.words[wkey(w.w)] || (w.up || w.at || 0) > (S.words[wkey(w.w)].up || S.words[wkey(w.w)].at || 0)));
      const prog = Object.entries(d.progress || {}).filter(([k]) => !S.prog[k]);
      const notes = Object.entries(d.notes || {}).filter(([k]) => !S.notes[k]);
      const cats = ((d.settings || {}).cats || []).filter(c => !S.cats.includes(c));
      const summary = `新文章 ${arts.length} 篇 · 单词 ${words.length} 个 · 作答进度 ${prog.length} 篇 · 讲解 ${notes.length} 条 · 分类 ${cats.length} 个`;
      S.bk = { pending: { arts, words, prog, notes, cats, summary }, msg: '' };
    } catch(e){ S.bk = { msg: '这个文件不是精读日报导出的备份', err: true }; }
    renderView();
  };
  fr.readAsText(file);
}
async function runRestore(){
  const B = S.bk; if (!B || !B.pending || B.busy) return;
  B.busy = true; renderView();
  const P = B.pending;
  for (const a of P.arts) { const { id, ...doc } = a; await write('articles/' + id, ref => ref.set({ ...doc, id })); }
  for (const [k, v] of P.prog) await write('progress/' + k, ref => ref.set(v));
  for (const [k, v] of P.notes) await write('notes/' + k, ref => ref.set(v));
  for (const w of P.words) { const k = wkey(w.w); const doc = strip({ ...w, w: k }); S.words[k] = { ...doc, _id: wdoc(k) }; await write('words/' + wdoc(k), ref => ref.set(doc)); }
  if (P.cats.length) saveCats([...S.cats, ...P.cats]);
  rebuildIdx();
  S.bk = { msg: `已恢复：${P.summary}` };
  renderChrome(); renderView();
}
