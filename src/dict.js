/* ---------- dictionary: 词典 tab + double-click anywhere blank to summon ---------- */
/* Sources: core dict/ (ECDICT + Open English WordNet + IPA), ext/ (the rest of ECDICT: phrases,
   technical and newer words, plus a few editor-added recent words), more/ (GCIDE etymology,
   roots, synonyms, look-alikes), dict/zh.json (Chinese → English for exam-level words). */
S.dk = { open: false, closing: false, q: '', tok: 0, sel: -1, list: null, P: null, back: [], letter: '', lpage: 1, pg: 1, focus: false, allDefs: false, wod: null, nf: null };
const DK_TOTAL_CORE = 87211;
const dkHist = () => LS.get('dkHist', []);
function dkRemember(w){ LS.set('dkHist', [w, ...dkHist().filter(x => x !== w)].slice(0, 24)); }
const dkNorm = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/^[\s"'“”‘.,;:!?()[\]]+|[\s"'“”‘.,;:!?()[\]]+$/g, '').replace(/\s+/g, ' ');
const hasCJK = s => /[㐀-鿿]/.test(s);

/* ---- extended lexicon: ext/index.json + ~1 MB sorted buckets ---- */
let EXT_IX = null, EXT_IX_P = null; const EXT = {}, EXT_P = {}, EXTK = {};
function extIndex(){
  if (EXT_IX) return Promise.resolve(EXT_IX);
  if (!EXT_IX_P) EXT_IX_P = fetch('ext/index.json').then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(j => (EXT_IX = j)).catch(e => { EXT_IX_P = null; throw e; });
  return EXT_IX_P;
}
function extBucketName(ix, w){ const p2 = w.slice(0, 2); let name = null; for (const [s, f] of ix.b) { if (s <= p2) name = f; else break; } return name; }
function extBucket(name){
  if (EXT[name]) return Promise.resolve(EXT[name]);
  if (!EXT_P[name]) EXT_P[name] = fetch('ext/' + name).then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(j => (EXT[name] = j)).catch(e => { delete EXT_P[name]; throw e; });
  return EXT_P[name];
}
async function extGet(w){ const ix = await extIndex(); const n = extBucketName(ix, w); if (!n) return undefined; return (await extBucket(n))[w]; }
async function extLookup(w){
  let e = await extGet(w), key = w;
  if (e === undefined && !/\s/.test(w)) for (const c of stems(w)) { const f = await extGet(c); if (f) { e = f; key = c; break; } }
  if (!e) return null;
  if (e.l) { const base = (await rawGet(e.l)) || (await extGet(e.l)); if (base && !base.l) return { lemma: e.l, form: w, ff: e.f || '', e: base }; }
  return { lemma: key, form: key !== w ? w : null, ff: '', e };
}
// popover and dictionary both fall through to the extended lexicon when the core has nothing
const coreLookup = dictLookup;
dictLookup = async function(word, ctxPos){
  const r = await coreLookup(word, ctxPos);
  if (r) return r;
  const w = dkNorm(word).replace(/'s$/, '');
  if (!/^[a-z]/.test(w)) return null;
  try { return await extLookup(w); } catch(e){ return null; }
};

/* ---- Chinese → English ---- */
let ZH = null, ZH_P = null;
function zhIndex(){
  if (ZH) return Promise.resolve(ZH);
  if (!ZH_P) ZH_P = fetch('dict/zh.json').then(r => { if (!r.ok) throw new Error('http'); return r.json(); }).then(j => (ZH = j)).catch(e => { ZH_P = null; throw e; });
  return ZH_P;
}
function zhSearch(q){
  const out = [];
  for (const [w, g, lv, fq] of ZH) {
    const i = g.indexOf(q); if (i < 0) continue;
    const exact = g.split(/[；;,，、]/).some(s => s.replace(/[（(][^)）]*[)）]/g, '').trim() === q);
    out.push({ r: (exact ? 0 : 2e7) + Math.min(i, 9) * 1e6 + (fq || 9e5), w, zh: g, lv });
    if (out.length > 600) break;
  }
  return out.sort((a, b) => a.r - b.r).slice(0, 40);
}

/* ---- suggestions ---- */
async function coreKeys(ch){ if (EXTK['core:' + ch]) return EXTK['core:' + ch]; const d = await shard(ch); return (EXTK['core:' + ch] = Object.keys(d).sort()); }
function lowerBound(a, q){ let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < q) lo = m + 1; else hi = m; } return lo; }
const fqOf = e => (e && (e.fq || e.bn)) || 1e7;
function shortZh(t){
  const line = String(t || '').split('\n').find(l => l && !l.startsWith('[')) || String(t || '').split('\n')[0] || '';
  const s = line.replace(/^(?:[a-z]+\.\s*)+/, '').trim();
  return s.length > 28 ? s.slice(0, 27) + '…' : s;
}
function dkItem(w, e, ext){ return { w, zh: shortZh(e && e.t), lv: levelOf(w) || '', ext: !!ext, nw: e && e.s === 'n' }; }
function editDist(a, b, max){   // optimal string alignment: insert / delete / substitute / swap two letters
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pp = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
      cur[j] = v; if (v < best) best = v;
    }
    if (best > max) return max + 1;
    pp = prev; prev = cur;
  }
  return prev[b.length];
}
async function dkFuzzy(q){
  if (q.length < 3 || /\s/.test(q)) return [];
  const keys = await coreKeys(q[0]); const D = DICT[q[0]]; const out = [];
  for (const k of keys) {
    if (Math.abs(k.length - q.length) > 2 || /\s/.test(k)) continue;
    const e = D[k]; if (e.l) continue;
    const d = editDist(q, k, 2); if (d <= 2) out.push([d, fqOf(e), k]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out.slice(0, 8).map(x => dkItem(x[2], D[x[2]]));
}
async function dkSuggest(){
  const q = dkNorm(S.dk.q); const tok = ++S.dk.tok;
  S.dk.sel = -1;
  if (!q) { S.dk.list = null; dkRenderList(); return; }
  S.dk.list = { kind: 'loading' }; dkRenderList();
  try {
    if (hasCJK(q)) { await zhIndex(); if (tok !== S.dk.tok) return; S.dk.list = { kind: 'zh', items: zhSearch(q) }; dkRenderList(); return; }
    if (!/^[a-z]/.test(q)) { S.dk.list = { kind: 'none', items: [] }; dkRenderList(); return; }
    const keys = await coreKeys(q[0]); const D = DICT[q[0]];
    let hits = [];
    for (let i = lowerBound(keys, q); i < keys.length && keys[i].startsWith(q) && hits.length < 600; i++) { const e = D[keys[i]]; if (!e.l || keys[i] === q) hits.push(keys[i]); }
    hits.sort((a, b) => (b === q) - (a === q) || fqOf(D[a]) - fqOf(D[b]) || a.length - b.length);
    const items = hits.slice(0, 9).map(k => dkItem(k, D[k]));
    if (q.length >= 2) {
      const ix = await extIndex(); const name = extBucketName(ix, q);
      if (name) {
        const B = await extBucket(name); const ek = EXTK[name] || (EXTK[name] = Object.keys(B).sort());
        const eh = [];
        for (let i = lowerBound(ek, q); i < ek.length && ek[i].startsWith(q) && eh.length < 400; i++) if (!B[ek[i]].l || ek[i] === q) eh.push(ek[i]);
        eh.sort((a, b) => (b === q) - (a === q) || (/\s/.test(b) - /\s/.test(a)) * (q.includes(' ') ? 1 : 0) || fqOf(B[a]) - fqOf(B[b]) || a.length - b.length);
        eh.slice(0, items.length ? 6 : 12).forEach(k => items.push(dkItem(k, B[k], true)));
      }
    }
    if (tok !== S.dk.tok) return;
    if (items.length) { S.dk.list = { kind: 'pre', items }; dkRenderList(); return; }
    const fz = await dkFuzzy(q);
    if (tok !== S.dk.tok) return;
    S.dk.list = { kind: fz.length ? 'fuzzy' : 'none', items: fz }; dkRenderList();
  } catch(e){ if (tok === S.dk.tok) { S.dk.list = { kind: 'err', items: [] }; dkRenderList(); } }
}

/* ---- lookups & page turns ---- */
function dkLookup(word, opts = {}){
  const w = dkNorm(word); if (!w) return;
  const old = S.dk.P;
  if (old && old.w === w) { S.dk.focus = false; dkSyncMode(); return; }
  if (old && !opts.back) S.dk.back = [...S.dk.back, old.w].slice(-30);
  const root = dkRoot(); const sc = root && root.querySelector('#dkEntry');
  const oldHtml = sc ? sc.innerHTML : '', oldY = sc ? sc.scrollTop : 0;
  const P = { kind: 'dict', w, disp: w, pos: '', anchor: null, showDetail: true };
  S.dk.P = P; S.dk.allDefs = false; S.dk.nf = null; S.dk.pg += 2; S.dk.focus = false;
  loadDict(P, w, '');
  dkRenderEntry(false);
  if (old) dkFlip(opts.back ? -1 : 1, oldHtml, oldY);
  if (!hasCJK(w)) dkRemember(w);
}
function dkRoot(){ return S.dk.open ? $('#dkov .dbook') : (S.view === 'dict' ? $('#view .dbook') : null); }
function dkSyncMode(){ const r = dkRoot(); if (r) r.classList.toggle('listing', !S.dk.P || (S.dk.focus && !!S.dk.q) || !!S.dk.letter && S.dk.focus); }
/* page turn: forward = the old page lifts off the right and settles on the left;
   back = the previous page swings back over from the left onto the right */
function dkFlip(dir, oldHtml, oldY){
  const root = dkRoot(); if (!root || reduced() || root.classList.contains('listing')) return;
  const spread = root.querySelector('.dk-spread'), page = root.querySelector('.dk-r'), sc = root.querySelector('#dkEntry');
  if (!spread || !page || !sc) return;
  root.querySelectorAll('.dk-leaf,.dk-under').forEach(l => l.remove());
  const front = dir > 0 ? oldHtml : sc.innerHTML;
  const leaf = document.createElement('div');
  leaf.className = 'dk-leaf ' + (dir > 0 ? 'fwd' : 'bwd'); leaf.setAttribute('aria-hidden', 'true');
  leaf.innerHTML = `<div class="dk-lf"><div class="dk-scroll">${front}</div><i class="dk-shade"></i></div><div class="dk-lb"><i class="dk-shade"></i></div>`;
  spread.appendChild(leaf);
  leaf.querySelector('.dk-scroll').scrollTop = dir > 0 ? oldY : 0;
  let under = null;
  if (dir < 0) { under = document.createElement('div'); under.className = 'dk-under'; under.innerHTML = `<div class="dk-scroll">${oldHtml}</div>`; page.appendChild(under); under.firstChild.scrollTop = oldY; }
  setTimeout(() => { leaf.remove(); if (under) under.remove(); }, 800);
}

/* ---- rendering ---- */
const DK_LINKS = w => {
  const q = encodeURIComponent(w);
  return [
    ['剑桥', `https://dictionary.cambridge.org/search/direct/?datasetsearch=english-chinese-simplified&q=${q}`],
    ['牛津高阶', `https://www.oxfordlearnersdictionaries.com/search/english/?q=${q}`],
    ['韦氏', `https://www.merriam-webster.com/dictionary/${q}`],
    ['柯林斯', `https://www.collinsdictionary.com/search/?dictCode=english&q=${q}`],
    ['朗文', `https://www.ldoceonline.com/search/english/direct/?q=${q}`],
    ['Etymonline 词源', `https://www.etymonline.com/search?q=${q}`],
    ['有道', `https://dict.youdao.com/result?word=${q}&lang=en`],
    ['YouGlish 真人发音', `https://youglish.com/pronounce/${q}/english`]
  ];
};
const DK_SRC = `<p class="dk-src">中文释义、考试标签、词频：<b>ECDICT</b>（MIT）· 英英释义、例句、音标：<b>Open English WordNet</b>（CC BY 4.0，源自 Princeton WordNet）· 词源：<b>Webster 1913 / GCIDE</b> · 构词与辨析：ECDICT wordroot / resemble · CEFR 等级：<b>CEFR-J Wordlist 1.5</b>（東京外国語大学投野由紀夫研究室）与 <b>Octanove Vocabulary Profile C1/C2</b>（CC BY-SA 4.0）· 少量新词由本站编者补充并标注</p>`;
const EXN = { p: '过去式', d: '过去分词', i: '现在分词', '3': '三单', s: '复数', r: '比较级', t: '最高级' };
function dkTotal(){ return DK_TOTAL_CORE + (EXT_IX ? EXT_IX.n : 0); }
function dkCover(){
  return `<div class="dk-cover" aria-hidden="true"><div class="dk-cf"><span class="dk-cf-top">The Close Reader</span><b>Dictionary</b><span class="dk-cf-zh">英 汉 双 解 词 典</span><span class="dk-cf-orn">❦</span><span class="dk-cf-bot">ECDICT · WORDNET · WEBSTER</span></div><div class="dk-cb"></div></div>`;
}
function dkBookHtml(where){
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return `<div class="dbook ${where}${!S.dk.P || (S.dk.focus && S.dk.q) ? ' listing' : ''}" role="${where === 'ov' ? 'dialog' : 'region'}" aria-label="词典">
    <div class="dk-board" aria-hidden="true"></div>
    <div class="dk-spread">
      <section class="dk-page dk-l">
        <header class="dk-run"><span>Lexicon · 词典</span><span>${S.dk.pg}</span></header>
        <label class="dk-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input id="dkq" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="查单词、词组，或输入中文" value="${esc(S.dk.q)}" aria-label="查词"></label>
        <div class="dk-list" id="dkList">${dkListHtml()}</div>
      </section>
      <section class="dk-page dk-r"><div class="dk-scroll" id="dkEntry">${dkEntryHtml()}</div></section>
    </div>
    <nav class="dk-thumbs" aria-label="按字母浏览">${letters.map((L, i) => `<button data-act="dkletter" data-l="${L.toLowerCase()}" style="--i:${i}" class="${S.dk.letter === L.toLowerCase() ? 'on' : ''}">${L}</button>`).join('')}</nav>
    ${dkCover()}
    ${where === 'ov' ? '<button class="dk-x" data-act="dkclose" aria-label="合上词典">×</button>' : ''}
  </div>`;
}
function dkItemsHtml(items, label){
  return `${label ? `<h5 class="dk-lh">${label}</h5>` : ''}<ul class="dk-items">${items.map((it, i) => `<li><button class="dk-it${i === S.dk.sel ? ' on' : ''}" data-act="dkgo" data-w="${esc(it.w)}"><b>${esc(it.w)}</b><span>${esc(it.zh)}</span>${it.lv ? `<i class="lvl lvl-${it.lv}">${LVL[it.lv]}</i>` : it.nw ? '<i class="lvl">新词</i>' : ''}</button></li>`).join('')}</ul>`;
}
function dkListHtml(){
  const L = S.dk.list;
  if (S.dk.q && L) {
    if (L.kind === 'loading') return `<p class="dload"><span class="spin"></span>翻找中…</p>`;
    if (L.kind === 'err') return `<p class="dload">词典分卷没加载出来，检查网络后再试。</p>`;
    if (L.kind === 'pre') return dkItemsHtml(L.items, '') + `<p class="dk-tip">↑↓ 选择 · Enter 查看</p>`;
    if (L.kind === 'zh') return L.items.length ? dkItemsHtml(L.items, `汉 → 英 · 考试词汇里含「${esc(S.dk.q.trim())}」的词`) : `<p class="dload">考试词汇里没有找到这个中文释义，换个说法试试。</p>`;
    if (L.kind === 'fuzzy') return dkItemsHtml(L.items, '没有完全一样的词，你要找的是不是：');
    return `<p class="dload">没有找到以「${esc(S.dk.q.trim())}」开头的词条。</p>`;
  }
  if (S.dk.letter) return dkLetterHtml();
  const h = dkHist();
  const W = S.dk.wod;
  return `${W ? `<div class="dk-wod"><span class="dk-lh">今日一词</span><button class="dk-wod-w" data-act="dkgo" data-w="${esc(W.w)}">${esc(W.w)}</button><p>${esc(W.zh)}</p></div>` : ''}
    ${h.length ? `<h5 class="dk-lh">最近查过</h5><div class="dk-hist">${h.map(w => `<button data-act="dkgo" data-w="${esc(w)}">${esc(w)}</button>`).join('')}<button class="dk-clr" data-act="dkclr">清空</button></div>` : ''}
    <h5 class="dk-lh">按字母浏览考试词汇</h5><div class="dk-az">${'abcdefghijklmnopqrstuvwxyz'.split('').map(l => `<button data-act="dkletter" data-l="${l}">${l.toUpperCase()}</button>`).join('')}</div>
    <p class="dk-tip">在任何页面<b>双击空白处</b>都能召唤词典；也可以按 <kbd>/</kbd> 键。</p>`;
}
function dkLetterHtml(){
  const l = S.dk.letter;
  if (!LEVEL || !DICT[l]) { Promise.all([loadLevel(), shard(l)]).then(() => { if (S.dk.letter === l) dkRenderList(); }).catch(() => {}); return `<p class="dload"><span class="spin"></span>翻到 ${l.toUpperCase()} 部…</p>`; }
  const all = Object.keys(LEVEL).filter(w => w[0] === l && /^[46k]$/.test(LEVEL[w])).sort();
  const n = S.dk.lpage * 80; const D = DICT[l];
  return `<div class="dk-lhd"><button class="more" data-act="dkletter" data-l="">← 返回</button><span class="dk-big">${l.toUpperCase()}</span><span>四六级 · 考研词汇 ${all.length} 个</span></div>
    ${dkItemsHtml(all.slice(0, n).map(w => dkItem(w, D[w])), '')}
    ${all.length > n ? `<button class="pbtn ghost dk-more" data-act="dkmorel">再翻一页</button>` : ''}`;
}
function dkTitle(){
  return `<div class="dk-title"><span class="dk-cf-top">The Close Reader</span><b>Dictionary</b><span class="dk-tz">英汉双解 · 约 ${(dkTotal() / 10000).toFixed(dkTotal() > 100000 ? 0 : 1)} 万词条</span>
    <ul><li>中文释义、四六级 / 考研 / 雅思托福 / GRE 标签、COCA 词频 —— ECDICT</li><li>CEFR 等级（A1–C2）—— CEFR-J Wordlist 1.5 + Octanove C1/C2</li><li>英英释义、例句、英美音标 —— Open English WordNet</li><li>词源 —— Webster 1913；词根、近义辨析、形近词</li><li>词组、专业词、新词一并收录，查不到的词附权威在线词典链接</li></ul>
    <p class="dk-tip">在左页输入单词、词组或中文开始查。</p></div>`;
}
function dkCites(lemma, forms){
  const set = [...new Set(forms.filter(Boolean).map(f => f.toLowerCase()))];
  if (!set.length) return [];
  const re = new RegExp(`\\b(${set.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
  const out = [];
  for (const a of S.articles) {
    (a.paragraphs || []).forEach((p, pi) => (p.sentences || []).forEach((s, si) => {
      if (out.length >= 6) return;
      const t = fullSent(a, pi, si);
      const m = t.match(re); if (m) out.push({ a, p: pi, s: si, t, m: m[0] });
    }));
    if (out.length >= 6) break;
  }
  return out;
}
function dkEntryHtml(){
  const P = S.dk.P;
  if (!P) return dkTitle();
  const D = P.dict;
  const run = (w) => `<header class="dk-run"><span>${esc(w)}</span><span>${S.dk.pg + 1}</span></header>`;
  const back = S.dk.back.length ? `<button class="more dk-back" data-act="dkback">← ${esc(S.dk.back[S.dk.back.length - 1])}</button>` : '';
  if (!D || D.state === 'loading') return `${run(P.w)}${back}<h2 class="dk-hw">${esc(P.w)}</h2><p class="dload"><span class="spin"></span>正在翻查…</p>`;
  if (D.state === 'err') return `${run(P.w)}${back}<h2 class="dk-hw">${esc(P.w)}</h2><p class="dload">这一卷没加载出来。<button class="more" data-act="dkretry">重试</button></p>`;
  if (D.state === 'none') {
    if (!S.dk.nf) { S.dk.nf = { w: P.w, items: null }; dkFuzzy(P.w).then(items => { if (S.dk.nf && S.dk.nf.w === P.w) { S.dk.nf.items = items; dkRenderEntry(true); } }).catch(() => {}); }
    const it = S.dk.nf.items;
    return `${run(P.w)}${back}<h2 class="dk-hw">${esc(P.w)}</h2><p class="dk-nf">本地 ${(dkTotal() / 10000).toFixed(0)} 万词条里没有收录「${esc(P.w)}」。</p>
      ${it && it.length ? dkItemsHtml(it, '你要找的是不是：') : ''}
      <h5 class="p-sec">去权威在线词典查</h5><div class="dk-links">${DK_LINKS(P.w).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div>`;
  }
  const r = D.res, e = r.e || {}, lemma = r.lemma;
  const R = S.words[wkey(lemma)] || wordOf(lemma);
  const lv = levelOf(lemma);
  const tags = (e.g || '').split(' ').filter(t => TAGS[t]).map(t => `<span class="tag${t === 'cet6' ? ' hot' : ''}">${TAGS[t]}</span>`).join('');
  const stars = e.c ? `<span class="stars" title="柯林斯 ${e.c} 星">${'★'.repeat(e.c)}${'☆'.repeat(5 - e.c)}</span>` : '';
  const say = (ipa, lang, lbl) => `<button class="dk-say" data-act="dksay" data-w="${esc(lemma)}" data-l="${lang}">${lbl ? `<i>${lbl}</i>` : ''}${ipa ? `/${esc(ipa)}/` : ''}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>`;
  const phon = e.i && (e.i[0] || e.i[1]) ? say(e.i[0], 'en-GB', '英') + say(e.i[1] || e.i[0], 'en-US', '美') : say(e.p || '', 'en-US', e.p ? '' : '发音');
  // inflections: from the lemma's own entry
  const ex = String(e.ex || '').split('/').map(x => x.split(':')).filter(x => x[1] && EXN[x[0]]);
  const exHtml = ex.length ? `<h5 class="p-sec">词形变化</h5><div class="dk-ex">${ex.map(([k, f]) => `<button data-act="dkgo" data-w="${esc(f)}"><i>${EXN[k]}</i>${esc(f)}</button>`).join('')}</div>` : '';
  const tr = trLines(e.t, '');
  const df = defLines(e, '');
  const nDef = S.dk.allDefs ? df.length : Math.min(8, df.length);
  const li = (l, cls) => `<li style="--pc:var(--${({ v: 'pos-v', n: 'pos-n', a: 'pos-adj', r: 'pos-adv' })[l.k] || 'ink-3'})"><span class="tp">${esc(l.tp)}</span><span class="${cls}">${esc(l.text)}${l.ex ? `<em class="exm">${esc(l.ex)}</em>` : ''}</span></li>`;
  const forms = [lemma, r.form, ...ex.map(x => x[1]), ...inflect(lemma)];
  const cites = dkCites(lemma, forms);
  const citeHtml = cites.length ? `<h5 class="p-sec">在你读过的文章里</h5><ul class="dk-cites">${cites.map(c => {
    const i = c.t.toLowerCase().indexOf(c.m.toLowerCase());
    return `<li><button data-act="dkcite" data-id="${esc(c.a.id)}" data-p="${c.p}" data-s="${c.s}">${esc(c.t.slice(0, i))}<mark>${esc(c.t.slice(i, i + c.m.length))}</mark>${esc(c.t.slice(i + c.m.length))}<small>《${esc(c.a.title)}》 ¶${c.p + 1}</small></button></li>`; }).join('')}</ul>` : '';
  let detail = '';
  if (P.more && !(P.more.state === 'ok' && !P.more.e.e && !(P.more.e.r || []).length && !(P.more.e.s || []).length && !(P.more.e.k || []).length && !P.more.groups.length && !S.notes[lemma] && !S.sample)) {
    detail = detailBlock(P).replace(/data-act="look"/g, 'data-act="dkgo"').replace(/data-act="ainote"/g, 'data-act="dkainote"').replace(/data-act="detailretry"/g, 'data-act="dkretry"');
  }
  return `${run(lemma)}${back}
    <div class="dk-hd"><h2 class="dk-hw">${esc(lemma)}</h2>${lvBadges(lemma, { e })}${e.s === 'n' ? '<span class="tag">新词 · 编者补充</span>' : ''}</div>
    ${r.form && r.form !== lemma ? `<p class="lemma-note">${esc(r.form)} → 原形 <b>${esc(lemma)}</b>${r.ff ? ` · ${esc(formNote(r.ff, ''))}` : ''}</p>` : ''}
    <div class="dk-phon">${canSpeak ? phon : ''}</div>
    ${tags || stars || e.o || e.fq ? `<div class="phon">${tags}${e.o ? '<span class="tag">牛津3000</span>' : ''}${stars}${e.fq ? `<span class="tag" title="COCA 语料库词频排名">词频 #${e.fq}</span>` : ''}</div>` : ''}
    <div class="dk-act">
      <button class="pa-btn pa-save${R ? ' on' : ''}${R && S.justSaved ? ' just' : ''}" data-act="dksave"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="${R ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>${R ? '已收藏' : '收藏'}</span></button>
      <div class="dk-st" role="group" aria-label="熟悉度">${ST_ORDER.map(x => `<button class="st-b st-${x}${R && R.status === x ? ' on' : ''}" data-act="dkst" data-s="${x}">${STATUS[x]}</button>`).join('')}</div>
    </div>
    ${tr.length ? `<h5 class="p-sec">释义</h5><ul class="dl">${tr.map(l => li(l, 'zh')).join('')}</ul>` : ''}
    ${exHtml}
    ${df.length ? `<h5 class="p-sec">英英释义${e.w ? ' · WordNet' : ''}</h5><ol class="dl en-list">${df.slice(0, nDef).map(l => li(l, 'en')).join('')}</ol>${df.length > 8 ? `<button class="more" data-act="dkdefs">${S.dk.allDefs ? '收起' : `展开全部 ${df.length} 条`}</button>` : ''}` : ''}
    ${citeHtml}
    ${detail}
    <h5 class="p-sec">权威在线词典</h5><div class="dk-links">${DK_LINKS(lemma).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div>
    ${DK_SRC}`;
}
function dkRenderList(){ const r = dkRoot(); const el = r && r.querySelector('#dkList'); if (el) el.innerHTML = dkListHtml(); dkSyncMode(); }
function dkRenderEntry(keep){
  const r = dkRoot(); const el = r && r.querySelector('#dkEntry'); if (!el) return;
  const y = el.scrollTop; el.innerHTML = dkEntryHtml(); el.scrollTop = keep ? y : 0;
  const run = r.querySelector('.dk-l .dk-run span:last-child'); if (run) run.textContent = S.dk.pg;
  dkSyncMode();
}
function dkWod(){
  if (S.dk.wod) return;
  loadLevel().then(async () => {
    const list = Object.keys(LEVEL).filter(w => LEVEL[w] === '6').sort();
    const w = list[Math.floor(Date.now() / 864e5) % list.length]; if (!w) return;
    const d = await shard(w[0]); S.dk.wod = { w, zh: shortZh((d[w] || {}).t) };
    if (!S.dk.q && !S.dk.letter) dkRenderList();
  }).catch(() => {});
}
function dictPageHtml(){
  extIndex().then(() => { const r = dkRoot(); if (r && !S.dk.P) dkRenderEntry(true); }).catch(() => {});
  dkWod();
  return `<div class="sect-head"><h2>词典</h2><p>英汉双解 · 词组 · 汉英反查 · 在任何页面双击空白处都能召唤</p></div>${dkBookHtml('page')}`;
}
function afterDictRender(){
  const r = dkRoot(); if (!r) return;
  if (S.enter && !reduced()) { r.classList.add('opening'); setTimeout(() => r.classList.remove('opening'), 1200); }
  if (matchMedia('(pointer:fine)').matches) setTimeout(() => { const i = $('#dkq'); if (i) i.focus({ preventScroll: true }); }, S.enter && !reduced() ? 900 : 0);
}

/* ---- overlay ---- */
function dkOpen(x, y, q){
  if (S.dk.open) return;
  const a = cur();
  if (S.view === 'read' && a && inExam(a)) { toast('考试中先不查词典。想边读边查，点上方的「精讲」'); return; }
  if (S.view === 'dict') { const i = $('#dkq'); if (i) { i.focus(); i.select(); } return; }
  closePop();
  S.dk.open = true; S.dk.closing = false;
  const ov = $('#dkov'); ov.hidden = false; ov.classList.remove('closing'); ov.innerHTML = dkBookHtml('ov');
  const book = ov.querySelector('.dbook');
  S.dk.ox = x == null ? innerWidth / 2 : x; S.dk.oy = y == null ? innerHeight / 2 : y;
  book.style.setProperty('--dx', (S.dk.ox - innerWidth / 2).toFixed(0) + 'px');
  book.style.setProperty('--dy', (S.dk.oy - innerHeight / 2).toFixed(0) + 'px');
  document.documentElement.classList.add('dk-lock');
  extIndex().then(() => { if (S.dk.open && !S.dk.P) dkRenderEntry(true); }).catch(() => {});
  dkWod();
  const t = reduced() ? 0 : 1150;
  if (t) { book.classList.add('opening'); setTimeout(() => book.classList.remove('opening'), t + 50); }
  setTimeout(() => { const i = $('#dkq'); if (i && S.dk.open && matchMedia('(pointer:fine)').matches) i.focus({ preventScroll: true }); }, t ? 800 : 0);
  if (q) dkLookup(q);
}
function dkClose(){
  if (!S.dk.open || S.dk.closing) return;
  const ov = $('#dkov'); const book = ov.querySelector('.dbook');
  const done = () => { ov.hidden = true; ov.innerHTML = ''; ov.classList.remove('closing'); S.dk.open = false; S.dk.closing = false; document.documentElement.classList.remove('dk-lock'); };
  if (reduced() || !book) { done(); return; }
  S.dk.closing = true; S.dk.focus = false;
  book.classList.remove('opening', 'listing'); book.classList.add('closing'); ov.classList.add('closing');
  setTimeout(done, 760);
}

/* ---- actions (called from the main click handler for data-act="dk…") ---- */
function dkAction(act, t){
  const P = S.dk.P;
  switch (act) {
    case 'dkclose': dkClose(); break;
    case 'dkgo': { S.dk.q = ''; S.dk.list = null; const i = $('#dkq'); if (i) i.value = ''; dkRenderList(); dkLookup(t.dataset.w); break; }
    case 'dkback': { const prev = S.dk.back.pop(); if (prev) dkLookup(prev, { back: true }); break; }
    case 'dkletter': S.dk.letter = t.dataset.l || ''; S.dk.lpage = 1; S.dk.q = ''; S.dk.list = null; { const i2 = $('#dkq'); if (i2) i2.value = ''; }
      { const r = dkRoot(); if (r) r.querySelectorAll('.dk-thumbs button').forEach(b => b.classList.toggle('on', b.dataset.l === S.dk.letter)); }
      S.dk.focus = !!S.dk.letter; dkRenderList(); { const r = dkRoot(); if (r) { r.classList.toggle('listing', !S.dk.P || !!S.dk.letter); const l = r.querySelector('#dkList'); if (l) l.scrollTop = 0; } } break;
    case 'dkmorel': S.dk.lpage++; dkRenderList(); break;
    case 'dkclr': LS.set('dkHist', []); dkRenderList(); break;
    case 'dkdefs': S.dk.allDefs = !S.dk.allDefs; dkRenderEntry(true); break;
    case 'dkretry': if (P) { if (P.dict && P.dict.state === 'err') loadDict(P, P.w, ''); else loadMore(P); dkRenderEntry(true); } break;
    case 'dkainote': if (P) aiNote(P); break;
    case 'dksay': try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.dataset.w); u.lang = t.dataset.l || 'en-US'; u.rate = .9; speechSynthesis.speak(u); } catch(e){} break;
    case 'dksave': if (P && P.dict && P.dict.state === 'ok') { collect(P); dkRenderEntry(true); S.justSaved = false; } break;
    case 'dkst': if (P && P.dict && P.dict.state === 'ok') { setStatus(P, t.dataset.s); dkRenderEntry(true); } break;
    case 'dkcite': {
      const id = t.dataset.id, p = +t.dataset.p, s = +t.dataset.s;
      if (S.dk.open) dkClose();
      openArticle(id);
      setTimeout(() => { const el = $(`#body .s[data-p="${p}"][data-s="${s}"]`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }, 120);
      break;
    }
    case 'dkfrom': { const Q = popCur(); const w = Q && Q.dict && Q.dict.state === 'ok' ? Q.dict.res.lemma : Q && Q.w; const an = Q && Q.anchor && $(Q.anchor); const rc = an ? an.getBoundingClientRect() : null; closePop(); if (w) { S.dk.P = null; dkOpen(rc ? rc.left + rc.width / 2 : null, rc ? rc.top : null, w); } break; }
  }
}

/* ---- input / keys ---- */
document.addEventListener('input', e => { if (e.target.id === 'dkq') { S.dk.q = e.target.value; S.dk.letter = ''; S.dk.focus = true; dkSuggest(); } });
document.addEventListener('focusin', e => { if (e.target.id === 'dkq') { S.dk.focus = true; dkSyncMode(); } });
document.addEventListener('keydown', e => {
  if (e.target.id === 'dkq') {
    const L = S.dk.list; const n = L && L.items ? L.items.length : 0;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); S.dk.sel = (S.dk.sel + 1) % n; dkRenderList(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); S.dk.sel = (S.dk.sel - 1 + n) % n; dkRenderList(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = n && S.dk.sel >= 0 ? L.items[S.dk.sel].w : (L && L.kind === 'zh' && n ? L.items[0].w : S.dk.q);
      if (!dkNorm(pick)) return;
      S.dk.q = ''; e.target.value = ''; S.dk.list = null; dkRenderList(); dkLookup(pick); e.target.blur();
    }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (S.dk.q) { S.dk.q = ''; e.target.value = ''; S.dk.list = null; dkRenderList(); } else if (S.dk.open) dkClose(); else e.target.blur(); }
    return;
  }
  if (S.dk.open && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dkClose(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (!typing && !S.dk.open && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); dkOpen(); }
}, true);

/* ---- summon: double-click (or double-tap) on blank space ---- */
function isBlankPoint(e){
  const t = e.target;
  if (!(t instanceof Element)) return false;
  if (t.closest('input,textarea,select,button,a,label,img,svg,video,[data-act],[contenteditable],#pop,#dkov,.dbook,.toast,.grab-zone,.dk-leaf')) return false;
  let node = null, off = 0;
  try {
    if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(e.clientX, e.clientY); if (c) { node = c.offsetNode; off = c.offset; } }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); if (r) { node = r.startContainer; off = r.startOffset; } }
  } catch(err){}
  if (node && node.nodeType === 3) {
    const rg = document.createRange(), len = node.length;
    for (const o of [off - 1, off]) {
      if (o < 0 || o >= len || !/\S/.test(node.data[o])) continue;
      rg.setStart(node, o); rg.setEnd(node, o + 1);
      const b = rg.getBoundingClientRect();
      if (b.width && e.clientX >= b.left - 3 && e.clientX <= b.right + 3 && e.clientY >= b.top - 3 && e.clientY <= b.bottom + 3) return false;
    }
  }
  return true;
}
let dkTapAt = 0;
function dkSummon(e){
  if (S.dk.open || Date.now() - dkTapAt < 600) return;
  dkTapAt = Date.now();
  try { getSelection().removeAllRanges(); } catch(err){}
  dkOpen(e.clientX, e.clientY);
}
document.addEventListener('dblclick', e => { if (isBlankPoint(e)) dkSummon(e); });
let dkLastTap = null;
document.addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch') return;
  const now = Date.now(), L = dkLastTap;
  if (L && now - L.t < 340 && Math.hypot(e.clientX - L.x, e.clientY - L.y) < 30 && L.blank && isBlankPoint(e)) { dkLastTap = null; dkSummon(e); return; }
  dkLastTap = { t: now, x: e.clientX, y: e.clientY, blank: isBlankPoint(e) };
}, { passive: true });
document.addEventListener('click', e => { if (S.dk.open && e.target.id === 'dkov') dkClose(); });
