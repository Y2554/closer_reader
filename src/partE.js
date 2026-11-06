/* ---------- shared helpers ---------- */
function fullSent(a, p, s){
  const sn = a.paragraphs[p] && a.paragraphs[p].sentences[s]; if (!sn) return '';
  return toks(sn.en).map(t => t.t === 'b' ? (optW(a, (a.blanks[t.n] || {}).ans) || '____') : t.v).join('');
}
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).filter(k => k !== '_id' && v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v === undefined ? null : v);
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } };
function animateCounts(root){
  $$('.cu[data-to]', root || document).forEach(el => {
    const to = +el.dataset.to || 0;
    if (reduced() || !to) { el.textContent = to; return; }
    const t0 = performance.now(), d = 750;
    const step = now => { const k = Math.min(1, (now - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    el.textContent = '0'; requestAnimationFrame(step);
  });
}
function moveTabInd(){
  const ind = $('.tab-ind'); if (!ind) return;
  const t = $('.tab[aria-current="page"]');
  if (!t) { ind.style.opacity = '0'; return; }
  const nav = t.parentElement;
  ind.style.opacity = '1';
  ind.style.width = Math.max(12, t.offsetWidth - 28) + 'px';
  ind.style.transform = `translateX(${t.offsetLeft + 14}px)`;
  if (nav.scrollWidth > nav.clientWidth) { const want = t.offsetLeft - (nav.clientWidth - t.offsetWidth) / 2; nav.scrollTo({ left: want, behavior: reduced() ? 'auto' : 'smooth' }); }
}
function repairCtx(){
  if (S.ctxRepaired || !S.wordsLoaded || S.dbState !== 'ok' || !S.articles.length) return;
  S.ctxRepaired = true;
  Object.values(S.words).forEach(w => {
    let changed = false;
    const ctx = (w.ctx || []).map(c => {
      if (!c || !/_{3,}/.test(c.text || '')) return c;
      const a = S.articles.find(x => x.id === c.art); if (!a) return c;
      const text = fullSent(a, c.p, c.s); if (!text || text === c.text) return c;
      changed = true; return { ...c, text };
    });
    if (changed) upsertWord(w.w, { ctx });
  });
}

/* ---------- exam mode ---------- */
const RING_C = 2 * Math.PI * 15;
const hasBlanks = a => !!(a && blankNums(a).length);
function modeOf(a){
  if (!hasBlanks(a)) return 'study';
  const p = S.prog[a.id] || {};
  if (p.mode) return p.mode;
  return (Object.keys(p.picks || {}).length || Object.keys(p.shown || {}).length || (p.attempts || []).length) ? 'study' : 'exam';
}
const inExam = a => !!a && modeOf(a) === 'exam';
const examOf = a => (S.prog[a.id] || {}).exam || null;
const examAns = a => (examOf(a) || {}).answers || {};
const fmtSecs = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function examElapsed(a){
  const e = examOf(a) || {}; const R = S.examRun;
  if (R && R.id === a.id) return R.base + (Date.now() - R.t0) / 1000;
  return e.elapsed || 0;
}
let tickT = 0;
function startTick(){
  if (tickT) return;
  tickT = setInterval(() => { if (!S.examRun) { clearInterval(tickT); tickT = 0; return; } updateExamBar(); }, 1000);
}
function examEnsure(a){
  const p = progOf(a.id);
  if (!p.exam) p.exam = { answers: {}, elapsed: 0, started: false };
  p.exam.answers = { ...(p.exam.answers || {}) };
  return p;
}
function examStart(a){
  const p = examEnsure(a);
  p.exam.started = true; p.mode = 'exam';
  setProg(a.id, p);
  S.examRun = { id: a.id, t0: Date.now(), base: p.exam.elapsed || 0 };
  startTick();
}
function examPause(){
  const R = S.examRun; if (!R) return;
  S.examRun = null;
  const a = S.articles.find(x => x.id === R.id); if (!a) return;
  const p = progOf(a.id);
  if (p.exam) { p.exam.elapsed = Math.round(R.base + (Date.now() - R.t0) / 1000); setProg(a.id, p); }
}
function examResume(a){
  if (!a || !inExam(a) || document.hidden) return;
  const e = examOf(a); if (!e || !e.started) return;
  if (S.examRun && S.examRun.id === a.id) return;
  if (S.examRun) examPause();
  S.examRun = { id: a.id, t0: Date.now(), base: e.elapsed || 0 };
  startTick();
}
function examFill(a, n, L){
  const p = examEnsure(a);
  if (!p.exam.started) { p.exam.started = true; S.examRun = { id: a.id, t0: Date.now(), base: p.exam.elapsed || 0 }; startTick(); }
  p.exam.elapsed = Math.round(examElapsed(a));
  if (L) {
    if (!isItems(a)) Object.keys(p.exam.answers).forEach(m => { if (p.exam.answers[m] === L && m !== n) delete p.exam.answers[m]; });
    p.exam.answers[n] = L;
  } else delete p.exam.answers[n];
  p.mode = 'exam'; setProg(a.id, p);
  S.justFilled = L ? n : null; S.confirmSubmit = false;
}
function nextEmpty(a, n){
  const ns = blankNums(a); const ans = examAns(a); const i = ns.indexOf(n);
  for (let k = 1; k <= ns.length; k++) { const m = ns[(i + k) % ns.length]; if (!ans[m]) return m; }
  return null;
}
function examBarHtml(a){
  const e = examOf(a) || {}; const ans = e.answers || {}; const ns = blankNums(a);
  const filled = ns.filter(n => ans[n]).length;
  if (!e.started) return `<div class="exbar idle" id="exbar">
      <div class="exb-intro"><b>考试模式</b><span>${ns.length} ${isItems(a) ? '道题' : '个空'} · 建议 ${targetOf(a) / 60} 分钟内完成。${isItems(a) ? '全部选完' : '填完'}再交卷，过程中可以随时改。</span></div>
      <button class="pbtn primary" data-act="examstart">开始计时</button></div>`;
  const secs = examElapsed(a);
  const off = RING_C * (1 - Math.min(secs / targetOf(a), 1));
  return `<div class="exbar${secs > targetOf(a) ? ' over' : ''}" id="exbar">
    <div class="exb-t"><svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="rt" cx="18" cy="18" r="15"/><circle class="rf" cx="18" cy="18" r="15" style="stroke-dasharray:${RING_C.toFixed(2)};stroke-dashoffset:${off.toFixed(2)}"/></svg><span class="exb-time" id="exTime">${fmtSecs(secs)}</span></div>
    <div class="exb-dots" role="group" aria-label="空格进度">${ns.map(n => `<button class="dot${ans[n] ? ' on' : ''}${S.examSel === n ? ' sel' : ''}${S.justFilled === n ? ' just' : ''}" data-act="blank" data-n="${n}" aria-label="第 ${n} 空${ans[n] ? '，已填' : ''}">${n}</button>`).join('')}</div>
    <button class="pbtn primary exb-sub${filled === ns.length ? ' ready' : ''}${S.confirmSubmit ? ' warn' : ''}" data-act="examsubmit">${S.confirmSubmit ? `还有 ${ns.length - filled} 空没填，确认交卷` : `交卷 <small>${filled}/${ns.length}</small>`}</button>
  </div>`;
}
function updateExamBar(){
  const a = cur(); if (!a || S.view !== 'read' || !S.examRun) return;
  const secs = examElapsed(a);
  const t = $('#exTime'); if (t) t.textContent = fmtSecs(secs);
  const rf = $('#exbar .rf'); if (rf) rf.style.strokeDashoffset = (RING_C * (1 - Math.min(secs / targetOf(a), 1))).toFixed(2);
  const bar = $('#exbar'); if (bar) bar.classList.toggle('over', secs > targetOf(a));
}
function epickHtml(a, n){
  const [p, s] = locate(a, n); const ans = examAns(a);
  const ctx = toks(a.paragraphs[p].sentences[s].en).map(t => {
    if (t.t !== 'b') return esc(t.v);
    const L = ans[t.n];
    if (t.n === n) return `<mark class="ep-gap">${L ? `<span class="fill">${esc(optW(a, L))}</span>` : `(${n})____`}</mark>`;
    return L ? `<span class="fill">${esc(optW(a, L))}</span>` : `<span class="gap">(${t.n})____</span>`;
  }).join('');
  const usedBy = {}; Object.entries(ans).forEach(([m, l]) => { if (m !== n) usedBy[l] = m; });
  const L = Object.keys(a.options || {}).sort();
  const all = blankNums(a).every(m => ans[m]);
  return `${top(`第 ${n} 空 · 考试中`)}<p class="p-en" style="margin-top:8px">${ctx}</p>
    <div class="pick-grid">${L.map(l => `<button class="pick${ans[n] === l ? ' chosen' : ''}${usedBy[l] ? ' taken' : ''}" data-act="efill" data-n="${n}" data-l="${l}"><b>${l}</b><span>${esc(a.options[l].w)}</span>${usedBy[l] ? `<i>${usedBy[l]}</i>` : ''}</button>`).join('')}</div>
    <div class="p-actions">${ans[n] ? `<button class="pbtn ghost" data-act="efill" data-n="${n}" data-l="">清空这一空</button>` : ''}${all ? '' : `<button class="pbtn ghost" data-act="enext" data-n="${n}">下一个空 →</button>`}</div>
    <p class="bank-note">${all ? '10 个空都填好了，检查一遍就可以交卷。' : '选过的词会标出它在哪个空；再选一次会把它挪到这里。电脑上可以直接按字母键。'}</p>`;
}
function examSubmit(a){
  const p = examEnsure(a); const ns = blankNums(a);
  const ans = p.exam.answers || {};
  const empty = ns.filter(n => !ans[n]).length;
  if (empty && !S.confirmSubmit) {
    S.confirmSubmit = true; renderView(); afterReadRender();
    setTimeout(() => { if (S.confirmSubmit) { S.confirmSubmit = false; if (S.view === 'read') { renderView(); afterReadRender(); } } }, 4000);
    return;
  }
  S.confirmSubmit = false;
  const secs = Math.round(examElapsed(a)); S.examRun = null;
  let scoreN = 0; ns.forEach(n => { if (ans[n] === a.blanks[n].ans) scoreN++; });
  p.picks = { ...ans }; p.shown = {}; ns.forEach(n => { if (!ans[n]) p.shown[n] = true; });
  p.attempts = [...(p.attempts || []), { at: Date.now(), secs, score: scoreN, total: ns.length, picks: { ...ans } }].slice(-30);
  p.exam = null; p.mode = 'study';
  setProg(a.id, p);
  ns.forEach(n => { if (ans[n] !== a.blanks[n].ans) recordMistake(a, n, ans[n] || ''); });
  S.revealAnim = true; S.examSel = null;
  S.panel = { type: 'result' };
  closePop(); renderChrome(); renderView(); afterReadRender(); renderPanel();
}
function resultHtml(a){
  const p = S.prog[a.id] || {}; const list = p.attempts || []; const at = list[list.length - 1];
  if (!at) return idleHtml();
  const prev = list[list.length - 2];
  const pct = at.score / at.total;
  const [stamp, sk] = at.score === at.total ? ['满分', 'top'] : pct >= .8 ? ['优秀', 'good'] : pct >= .6 ? ['及格', 'ok'] : ['再练练', 'low'];
  const ns = blankNums(a);
  const wrong = ns.filter(n => at.picks[n] !== a.blanks[n].ans);
  const off = RING_C * (1 - pct);
  return `${top('交卷结果')}
    <div class="res-hero">
      <div class="res-ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="rt" cx="18" cy="18" r="15"/><circle class="rf" cx="18" cy="18" r="15" style="stroke-dasharray:${RING_C.toFixed(2)};--off:${off.toFixed(2)}"/></svg>
        <div class="res-score"><span class="cu" data-to="${at.score}">${at.score}</span><small>/ ${at.total}</small></div></div>
      <div class="stamp s-${sk}">${stamp}</div>
    </div>
    <div class="res-meta"><span>用时 <b>${fmtSecs(at.secs)}</b></span><span>${at.secs <= targetOf(a) ? '在建议时间内' : `超过建议时间 ${fmtSecs(at.secs - targetOf(a))}`}</span>${prev ? `<span>上次 ${prev.score}/${prev.total}${at.score > prev.score ? ' · 进步了' : ''}</span>` : ''}</div>
    <ol class="res-list">${ns.map((n, i) => { const pk = at.picks[n]; const ok = pk === a.blanks[n].ans; return `<li class="${ok ? 'ok' : 'bad'}" style="--i:${i}"><button data-act="blank" data-n="${n}"><b>${n}</b><span class="rr-mark">${ok ? '✓' : '✗'}</span><span class="rr-w">${pk ? esc(optW(a, pk)) : '未填'}</span>${ok ? '' : `<span class="rr-ans">→ ${esc(optW(a, a.blanks[n].ans))}</span>`}</button></li>`; }).join('')}</ol>
    <p class="bank-note">${wrong.length ? `错的 ${wrong.length} 题已收进错题本，点任意一题看解析。` : '全部答对。点任意一题也可以看解析。'}</p>
    <div class="p-actions">${wrong.length ? `<button class="pbtn primary" data-act="blank" data-n="${wrong[0]}">看错题解析</button>` : ''}<button class="pbtn ghost${S.confirmRetake ? ' warn' : ''}" data-act="retake">${S.confirmRetake ? '再点一次，重新考' : '再考一次'}</button></div>`;
}
function modeSegHtml(a){
  if (!hasBlanks(a)) return '';
  const m = modeOf(a);
  return `<div class="mseg" role="group" aria-label="做题模式"><i class="mseg-thumb" aria-hidden="true"></i><button data-act="mode" data-m="study" aria-pressed="${m === 'study'}">精讲</button><button data-act="mode" data-m="exam" aria-pressed="${m === 'exam'}">考试</button></div>`;
}
function setMode(a, m){
  const cur0 = modeOf(a); if (m === cur0) { S.confirmMode = false; return; }
  const p = progOf(a.id);
  if (m === 'exam') {
    const hasWork = Object.keys(p.picks || {}).length || Object.keys(p.shown || {}).length;
    if (hasWork && !S.confirmMode) { S.confirmMode = true; renderView(); afterReadRender(); return; }
    S.confirmMode = false;
    p.picks = {}; p.shown = {};
    if (!p.exam) p.exam = { answers: {}, elapsed: 0, started: false };
    p.mode = 'exam'; setProg(a.id, p);
    S.panel = null; S.examSel = null;
  } else {
    examPause();
    const q = progOf(a.id); q.mode = 'study'; setProg(a.id, q);
    S.confirmMode = false; S.examSel = null; if (S.panel && S.panel.type === 'epick') S.panel = null;
  }
  S.segFrom = cur0;
  closePop(); renderChrome(); renderView(); afterReadRender(); renderPanel();
}
function retake(a){
  if (!S.confirmRetake) { S.confirmRetake = true; renderPanel(true); setTimeout(() => { if (S.confirmRetake) { S.confirmRetake = false; if (S.panel && S.panel.type === 'result') renderPanel(true); } }, 4000); return; }
  S.confirmRetake = false;
  const p = progOf(a.id);
  p.picks = {}; p.shown = {}; p.exam = { answers: {}, elapsed: 0, started: false }; p.mode = 'exam';
  setProg(a.id, p);
  S.panel = null; S.examSel = null; S.segFrom = 'study';
  renderChrome(); renderView(); afterReadRender(); renderPanel();
  window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
}
function afterReadRender(){
  const a = cur(); if (!a || S.view !== 'read') return;
  S.justFilled = null; S.revealAnim = false;
  if (S.segFrom) {
    const th = $('.mseg-thumb');
    if (th && !reduced()) { th.style.transition = 'none'; th.style.transform = S.segFrom === 'exam' ? 'translateX(100%)' : 'translateX(0)'; void th.offsetWidth; th.style.transition = ''; requestAnimationFrame(() => { th.style.transform = ''; }); }
    S.segFrom = null;
  }
  if (inExam(a)) examResume(a);
  marks(); placePop();
}

/* ---------- mistake book ---------- */
const MK_TYPES = { pos: '词性判断', form: '词形 / 时态', sense: '语义辨析', near: '相邻段混淆', loc: '定位错段', swap: '偷换概念', infer: '无中生有', part: '以偏概全', flip: '正反颠倒', blank: '没有作答' };
const MK_TIPS = {
  pos: '先看空格前后的功能词：冠词后要名词，助动词和 to 后要动词原形，as…as 中间是形容词或副词。定好词性再在同一组里选。',
  form: '词性对了却错在形式：does not、to 后用原形，has / have 后用过去分词，主语后缺谓语就看时态。',
  sense: '词性和形式都对了还选错，多半是语义没读透。找转折词和同义复现，把候选词放回句子里读一遍。',
  near: '答案就在隔壁段：相邻段落常常讲同一话题，要比较题目和两段的细节，看哪一段有完整的同义替换。',
  loc: '定位跑偏了：不要追逐全文反复出现的主题词，抓题目里最独特的词（专名、数字、比较结构）再回原文找。',
  swap: '选项用了原文的词，却换了主语、对象或范围。逐个核对选项里每个成分是否和原文对应，原词复现不等于正确。',
  infer: '选项说的内容原文根本没有，或推得太远。答案必须能在原文找到依据，加上自己的常识就是陷阱。',
  part: '只抓住了原文的一部分或一个例子，当成了整体结论。看清题干问的是整体还是某一点。',
  flip: '意思和原文正好相反，常见于否定词、反义词（minimize ↔ better luck）。读选项时注意方向词。',
  blank: '不会的题先跳过，最后用排除法补上，不要留空。'
};
const mkId = (art, n) => (art + '~' + n).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 180);
const formOf = pos => { const m = String(pos || '').match(/[（(]([^）)]+)[）)]/); return m ? m[1] : ''; };
function classify(a, n, pick){
  if (!pick) return 'blank';
  if (isMatch(a)) return Math.abs(paraOf(a, pick) - paraOf(a, a.blanks[n].ans)) === 1 ? 'near' : 'loc';
  if (isMcq(a)) return ((a.blanks[n] || {}).ot || {})[pick] || 'swap';
  const po = a.options[pick] || {}, ao = a.options[a.blanks[n].ans] || {};
  if (posClass(po.pos) !== posClass(ao.pos)) return 'pos';
  if (formOf(po.pos) !== formOf(ao.pos)) return 'form';
  return 'sense';
}
function recordMistake(a, n, pick){
  const id = mkId(a.id, n); const old = S.mistakes[id]; const b = a.blanks[n]; if (!b) return;
  const [p, s] = locate(a, n);
  const doc = { art: a.id, title: a.title, n, p, s, kind: isMatch(a) ? 'match' : isMcq(a) ? 'mcq' : 'cloze', sent: isItems(a) ? ((a.items || {})[n] || {}).en || '' : fullSent(a, p, s), pick: pick || '', ans: b.ans,
    pickW: pick ? optW(a, pick) : '', ansW: optW(a, b.ans), type: classify(a, n, pick),
    times: (old ? old.times || 1 : 0) + 1, at: old ? old.at || Date.now() : Date.now(), last: Date.now(), resolved: false };
  S.mistakes[id] = { ...doc, _id: id };
  write('mistakes/' + id, ref => ref.set(doc));
  renderChrome();
}
function setResolved(id, v){
  const m = S.mistakes[id]; if (!m) return;
  S.mistakes[id] = { ...m, resolved: v };
  const doc = { ...m, resolved: v }; delete doc._id;
  write('mistakes/' + id, ref => ref.set(doc));
}
function mistakesHtml(){
  const all = Object.values(S.mistakes).sort((x, y) => (y.last || 0) - (x.last || 0));
  const open = all.filter(m => !m.resolved);
  const head = `<div class="sect-head"><h2>错题本</h2><p>${open.length} 道待巩固 · 已掌握 ${all.length - open.length}</p></div>`;
  if (!all.length) return head + `<div class="empty"><div class="kicker">还没有错题</div><h2>先去考一篇</h2><p>用考试模式做一篇选词填空，交卷后答错和没填的题会自动收进来，并按错误类型归类。精讲模式里选错的题也会记录。</p>${S.articles.length ? `<button class="pbtn primary" data-act="view" data-v="read">去做题</button>` : ''}</div>`;
  const types = Object.keys(MK_TYPES).filter(t => all.some(m => m.type === t));
  const cnt = t => open.filter(m => m.type === t).length;
  const max = Math.max(1, ...types.map(cnt));
  const topT = types.slice().sort((x, y) => cnt(y) - cnt(x))[0];
  let list = S.mkShowDone ? all : open;
  if (S.mkType !== 'all') list = list.filter(m => m.type === S.mkType);
  return head + `<section class="mk-chart">
      <div class="mk-bars">${types.map(t => `<button class="mk-bar${S.mkType === t ? ' on' : ''}" data-act="mktype" data-t="${t}" aria-pressed="${S.mkType === t}"><span class="mk-bl">${MK_TYPES[t]}</span><span class="mk-track"><i class="mk-fill t-${t}" style="--w:${(cnt(t) / max).toFixed(3)}"></i></span><b class="cu" data-to="${cnt(t)}">${cnt(t)}</b></button>`).join('')}</div>
      ${open.length ? `<p class="mk-tip"><b>${MK_TYPES[topT]}</b>错得最多。${MK_TIPS[topT]}</p>` : `<p class="mk-tip">错题都巩固完了，做得好。</p>`}
    </section>
    <div class="vtools">
      <button class="tbtn" data-act="mktype" data-t="all" aria-pressed="${S.mkType === 'all'}">全部类型</button>
      <button class="tbtn" data-act="mkdoneview" aria-pressed="${S.mkShowDone}">显示已掌握</button>
    </div>
    <div class="mk-list">${list.length ? list.map(mkCard).join('') : '<p class="p-miss">这个筛选下没有错题。</p>'}</div>`;
}
function mkCard(m){
  const a = S.articles.find(x => x.id === m.art);
  const R = S.mkRetry[m._id] || null;
  const b = a && a.blanks[m.n];
  let sent;
  const sn = a && a.paragraphs[m.p] && a.paragraphs[m.p].sentences[m.s];
  const mq = isMcq(a) || m.kind === 'mcq';
  const mt = !mq && (isMatch(a) || m.kind === 'match');
  const qit = a && (a.items || {})[m.n] || {};
  if (mq) {
    const ansL = b ? b.ans : m.ans;
    sent = `${esc(qit.en || m.sent || '')}<span class="mk-pick">${R && !R.ok && !R.reveal ? '选出正确的选项' : `${m.pick ? `你选 <s class="mk-wrong">${esc(m.pick)}</s>` : '<span class="mk-none">未作答</span>'} → <b class="mk-ans">${esc(ansL)}</b> ${esc(((qit.o || {})[ansL] || {}).en || '')}`}</span>`;
  } else if (mt) {
    const it = a && (a.items || {})[m.n] || {};
    const ansL = b ? b.ans : m.ans;
    sent = `${esc(it.en || m.sent || '')}<span class="mk-pick">${R && !R.ok && !R.reveal ? '选出正确的段落' : `${m.pick ? `你选 <s class="mk-wrong">${esc(m.pick)} 段</s>` : '<span class="mk-none">未作答</span>'} → <b class="mk-ans">${esc(ansL)} 段</b>`}</span>`;
  } else if (sn) {
    sent = toks(sn.en).map(t => {
      if (t.t !== 'b') return esc(t.v);
      if (t.n !== String(m.n) && t.n !== m.n) return `<span class="mk-other">${esc(optW(a, a.blanks[t.n].ans))}</span>`;
      if (R && !R.ok && !R.reveal) return `<span class="mk-gap">(${m.n}) _____</span>`;
      if (R && R.ok) return `<b class="mk-ans">${esc(optW(a, b.ans))}</b>`;
      return `${m.pickW ? `<s class="mk-wrong">${esc(m.pickW)}</s> ` : `<span class="mk-none">未填</span> `}<b class="mk-ans">${esc(optW(a, b.ans))}</b>`;
    }).join('');
  } else sent = esc(m.sent || '');
  const L = a ? Object.keys(a.options || {}).sort() : [];
  const retry = R && !R.ok && !R.reveal && mq ? `<div class="mpicks mk-picks">${mcqOpts(a, m.n).map(l => `<button class="mpick${(R.no || []).includes(l) ? ' no' : ''}" data-act="mkpick" data-id="${esc(m._id)}" data-l="${l}"><b>${l})</b><span>${esc(qit.o[l].en)}</span></button>`).join('')}</div>`
    : R && !R.ok && !R.reveal && mt ? `<div class="mk-picks">${letterGrid(a, '', 'mkpick', null, l => (R.no || []).includes(l) ? 'no' : '').replace(/data-n=""/g, `data-id="${esc(m._id)}"`)}</div>`
    : R && !R.ok && !R.reveal ? `<div class="pick-grid mk-picks">${L.map(l => `<button class="pick${(R.no || []).includes(l) ? ' no' : ''}" data-act="mkpick" data-id="${esc(m._id)}" data-l="${l}"><b>${l}</b><span>${esc(a.options[l].w)}</span></button>`).join('')}</div>` : '';
  const srcLine = (mt || mq) && sn && (!R || R.ok || R.reveal) ? `<blockquote class="srcq sm">${esc(sn.en)}</blockquote>` : '';
  const why = b && (!R || R.ok || R.reveal) ? `${srcLine}<div class="mk-why"><p><b>${mt || mq ? '定位' : '需要'}</b>${esc(b.need)}</p><p>${esc(b.why)}</p>${mq && m.pick && (b.ox || {})[m.pick] ? `<p><b>错因</b>${esc(b.ox[m.pick])}</p>` : ''}${b.tip ? `<p class="mk-tipline"><b>技巧</b>${esc(b.tip)}</p>` : ''}</div>` : '';
  return `<article class="mk${m.resolved ? ' done' : ''}${R && R.fx ? ' ' + R.fx : ''}" id="mk-${esc(m._id)}">
    <div class="mk-hd"><span class="mk-type t-${m.type}">${MK_TYPES[m.type] || ''}</span><span class="mk-src">《${esc(m.title || '')}》第 ${m.n} ${mt || mq ? '题' : '空'}</span>${m.times > 1 ? `<span class="mk-times">错过 ${m.times} 次</span>` : ''}${m.resolved ? '<span class="mk-ok">已掌握</span>' : ''}</div>
    <p class="mk-sent">${sent}</p>
    ${retry}${R && R.ok ? '<p class="mk-res ok">✓ 这次做对了，已标为掌握。</p>' : R && R.reveal ? '<p class="mk-res bad">两次都没选对，看一下解析。</p>' : ''}
    ${why}
    <div class="mk-act">${m.resolved ? `<button class="pbtn ghost" data-act="mkundo" data-id="${esc(m._id)}">移回待巩固</button>`
      : `${a && !(R && !R.ok && !R.reveal) ? `<button class="pbtn primary" data-act="mkretry" data-id="${esc(m._id)}">重做</button>` : ''}<button class="pbtn ghost" data-act="mkdone" data-id="${esc(m._id)}">我会了</button>`}
      ${a ? `<button class="pbtn ghost" data-act="mkgo" data-id="${esc(m._id)}">回到原题</button>` : ''}</div>
  </article>`;
}
function mkPick(id, l){
  const m = S.mistakes[id]; const a = m && S.articles.find(x => x.id === m.art); if (!a) return;
  const R = S.mkRetry[id] || (S.mkRetry[id] = { no: [] });
  if (l === a.blanks[m.n].ans) { R.ok = true; R.fx = 'okfx'; setResolved(id, true); toast('答对了，已标为掌握'); }
  else { R.no = [...(R.no || []), l]; R.fx = 'shake'; if (R.no.length >= 2) R.reveal = true; const mm = S.mistakes[id]; S.mistakes[id] = { ...mm, times: (mm.times || 1) + 1 }; }
  renderMkCard(id);
}
function renderMkCard(id){
  const el = document.getElementById('mk-' + id); const m = S.mistakes[id];
  if (!el || !m) { renderView(); return; }
  const tmp = document.createElement('div'); tmp.innerHTML = mkCard(m);
  el.replaceWith(tmp.firstElementChild);
  const R = S.mkRetry[id]; if (R) R.fx = '';
  renderChrome();
}

/* ---------- article editor (校对) ---------- */
function openEditor(id, fresh, focusN){
  const a = S.articles.find(x => x.id === id); if (!a) return;
  examPause();
  S.cur = id; S.userChose = true;
  S.edit = { id, fresh: !!fresh, draft: JSON.parse(JSON.stringify(a)), focus: focusN || null, msg: '' };
  S.view = 'edit'; S.pop = []; S.panel = null; S.enter = true;
  render(); window.scrollTo({ top: 0 });
  if (focusN) requestAnimationFrame(() => { const el = document.getElementById('ed-b-' + focusN); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } });
}
function editHtml(){
  const E = S.edit; if (!E) return '';
  const d = E.draft; const L = Object.keys(d.options || {}).sort(); const ns = Object.keys(d.blanks || {}).sort((x, y) => +x - +y);
  const ta = (path, val, cls, rows) => `<textarea class="ed-ta ${cls || ''}" data-ed="${path}" rows="${rows || 2}">${esc(val)}</textarea>`;
  const inp = (path, val, ph, cls) => `<input class="ed-in ${cls || ''}" type="text" data-ed="${path}" value="${esc(val)}" placeholder="${esc(ph || '')}">`;
  const refs = new Set(); d.paragraphs.forEach(p => p.sentences.forEach(s => (String(s.en).match(/\{\{(\d+)\}\}/g) || []).forEach(x => refs.add(x.replace(/\D/g, '')))));
  const missing = [...refs].filter(n => !d.blanks[n] || !d.blanks[n].ans);
  return `<section class="ed">
    <div class="ed-bar"><div><div class="kicker">校对</div><b class="ed-ttl">${esc(d.title)}</b></div>
      <div class="ed-btns"><button class="pbtn ghost" data-act="edcancel">${E.fresh ? '跳过，直接做题' : '取消'}</button><button class="pbtn primary" data-act="edsave">保存修改</button></div></div>
    ${E.fresh ? `<div class="note ed-note"><b>导入完成</b><br>文字识别和答案解析都是 AI 生成的，可能有错。对照原卷看一遍：原文拼写、每个空的答案、解析。没问题就直接保存。</div>` : ''}
    ${missing.length ? `<div class="note ed-warn"><b>注意</b><br>正文里有空格 ${missing.join('、')} 还没有答案。</div>` : ''}
    <h3 class="ed-h">基本信息</h3>
    <div class="ed-grid3"><label>英文标题${inp('title', d.title)}</label><label>中文标题${inp('zh', d.zh)}</label><label>出处${inp('source', d.source)}</label></div>
    <h3 class="ed-h">正文与翻译 <small>空格写成 {{26}} 这样的形式</small></h3>
    ${d.paragraphs.map((p, pi) => `<div class="ed-para"><span class="ed-pn">¶${pi + 1}</span>${p.sentences.map((s, si) => `<div class="ed-sent"><span class="ed-sn">${si + 1}</span>${ta(`s.${pi}.${si}.en`, s.en, 'en')}${ta(`s.${pi}.${si}.zh`, s.zh, 'zh')}</div>`).join('')}</div>`).join('')}
    ${L.length && !isItems(d) ? `<h3 class="ed-h">选项</h3><div class="ed-opts">${L.map(l => `<div class="ed-opt"><b>${l}</b>${inp(`o.${l}.w`, d.options[l].w, '单词', 'w')}${inp(`o.${l}.pos`, d.options[l].pos, '词性', 'pos')}${inp(`o.${l}.zh`, d.options[l].zh, '中文', 'zh')}</div>`).join('')}</div>` : ''}
    ${ns.length ? `<h3 class="ed-h">答案与解析</h3>${ns.map(n => { const b = d.blanks[n]; return `<div class="ed-blank" id="ed-b-${n}">
        <div class="ed-bh"><b>第 ${n} ${isItems(d) ? '题' : '空'}</b><label>答案 <select data-ed="b.${n}.ans">${L.map(l => `<option value="${l}"${b.ans === l ? ' selected' : ''}>${isMatch(d) ? `${l} 段` : isMcq(d) ? `${l}) ${esc(((((d.items || {})[n] || {}).o || {})[l] || {}).en || '').slice(0, 40)}` : `${l}) ${esc(d.options[l].w)}`}</option>`).join('')}</select></label>${inp(`b.${n}.need`, b.need, '需要的词性', 'need')}</div>
        ${isMcq(d) ? `<div class="ed-mcq">${MCQ_L.filter(l => ((((d.items || {})[n] || {}).o) || {})[l]).map(l => `<div class="ed-mo"><b>${l}</b>${ta(`q.${n}.${l}.en`, d.items[n].o[l].en || '', 'en', 1)}${ta(`q.${n}.${l}.zh`, d.items[n].o[l].zh || '', 'zh', 1)}${l !== b.ans ? ta(`x.${n}.${l}`, (b.ox || {})[l] || '', '', 1) : ''}</div>`).join('')}</div>` : ''}
        ${isItems(d) ? `<div class="ed-grid2"><label>题目${ta(`i.${n}.en`, ((d.items || {})[n] || {}).en || '', 'en', 2)}</label><label>题目译文${ta(`i.${n}.zh`, ((d.items || {})[n] || {}).zh || '', 'zh', 2)}</label></div>` : ''}
        <label>${isItems(d) ? '同义替换与解析' : '解题思路'}${ta(`b.${n}.why`, b.why, '', 3)}</label>
        <div class="ed-grid2"><label>干扰项${ta(`b.${n}.trap`, b.trap, '', 2)}</label><label>技巧${ta(`b.${n}.tip`, b.tip, '', 2)}</label></div></div>`; }).join('')}` : ''}
    <div class="ed-foot"><span class="dload">${esc(E.msg || '')}</span><button class="pbtn primary" data-act="edsave">保存修改</button></div>
  </section>`;
}
function edSet(path, val){
  const d = S.edit && S.edit.draft; if (!d) return;
  const [k, ...rest] = path.split('.');
  if (k === 's') { const [p, s, f] = rest; d.paragraphs[+p].sentences[+s][f] = f === 'en' ? val.replace(/\{\{\s*(\d+)\s*\}\}/g, '{{$1}}') : val; }
  else if (k === 'o') { const [l, f] = rest; d.options[l][f] = val; }
  else if (k === 'b') { const [n, f] = rest; d.blanks[n][f] = val; }
  else if (k === 'i') { const [n, f] = rest; d.items = d.items || {}; d.items[n] = d.items[n] || { en: '', zh: '' }; d.items[n][f] = val; }
  else if (k === 'q') { const [n, l, f] = rest; d.items[n].o[l][f] = val; }
  else if (k === 'x') { const [n, l] = rest; d.blanks[n].ox = { ...(d.blanks[n].ox || {}), [l]: val }; }
  else d[k] = val;
  S.edit.dirty = true;
}
function autosize(el){ el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
async function edSave(){
  const E = S.edit; if (!E) return;
  const doc = { ...E.draft, id: E.id, editedAt: Date.now() };
  const i = S.articles.findIndex(x => x.id === E.id);
  if (i >= 0) S.articles[i] = doc;
  await write('articles/' + E.id, ref => ref.set(doc));
  Object.values(S.mistakes).filter(m => m.art === E.id).forEach(m => {
    const a = doc; const b = a.blanks[m.n];
    if (b && (b.ans !== m.ans)) { const cl = { ...m, ans: b.ans, ansW: optW(a, b.ans), sent: fullSent(a, m.p, m.s) }; S.mistakes[m._id] = cl; const x = { ...cl }; delete x._id; write('mistakes/' + m._id, ref => ref.set(x)); }
  });
  const fresh = E.fresh; S.edit = null;
  toast(fresh ? '已保存，开始做题吧' : '已保存修改');
  openArticle(E.id);
}
