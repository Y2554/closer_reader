/* ---------- 段落匹配 (Section B) ---------- */
const isMatch = a => !!a && a.type === 'match';
const targetOf = a => (isMatch(a) ? 15 : a && a.type === 'mcq' ? 8 : 10) * 60;
const paraOf = (a, L) => a.paragraphs.findIndex(p => p.label === L);
function paraPreview(a, L, n){
  const p = a.paragraphs[paraOf(a, L)]; if (!p) return '';
  const w = (p.sentences[0] || {}).en.split(/\s+/);
  return w.slice(0, n || 6).join(' ') + (w.length > (n || 6) ? '…' : '');
}
function itemsHtml(a){
  const exam = inExam(a); const ns = blankNums(a);
  const showZh = n => !exam && (S.zhAll || st(a, n).done);
  return `<section class="mqs${exam ? ' exam' : ''}">
    <header class="mqs-hd"><h3>Statements<span>题目 ${ns[0]}–${ns[ns.length - 1]}</span></h3><p>每句话的信息出自哪一段？同一段可以选多次。</p></header>
    <ol class="mq-list">${ns.map(n => {
      const it = (a.items || {})[n] || {};
      const on = (S.panel && (S.panel.type === 'blank' || S.panel.type === 'epick') && S.panel.n === n) || S.examSel === n;
      return `<li class="mq${on ? ' on' : ''}" data-n="${n}">
        <span class="mq-n">${n}</span>
        <div class="mq-body"><p class="mq-en">${esc(it.en || '')}</p>${showZh(n) && it.zh ? `<p class="mq-zh">${esc(it.zh)}</p>` : ''}</div>
        ${blankHtml(a, n)}
      </li>`; }).join('')}</ol>
    ${matchBankHtml(a)}
  </section>`;
}
function matchBankHtml(a){
  const exam = inExam(a);
  const ans = exam ? examAns(a) : {};
  const cnt = {}; Object.values(exam ? ans : Object.fromEntries(blankNums(a).filter(n => st(a, n).done).map(n => [n, st(a, n).pick || a.blanks[n].ans]))).forEach(l => { cnt[l] = (cnt[l] || 0) + 1; });
  const selL = exam && S.examSel ? ans[S.examSel] : null;
  return `<div class="pchips${exam ? ' exam' : ''}">${a.paragraphs.map(p => `<button class="pchip${selL === p.label ? ' chosen' : ''}" data-act="opt" data-l="${esc(p.label)}" title="${esc(paraPreview(a, p.label, 10))}"><b>${esc(p.label)}</b>${cnt[p.label] ? `<i>${cnt[p.label]}</i>` : ''}</button>`).join('')}</div>
    <p class="bank-note">${exam ? (S.examSel ? `正在做第 <b>${S.examSel}</b> 题：点段落字母填入，电脑上也可以直接按字母键。` : '先点一道题右边的空格，再选段落。') : '点段落字母可以跳到那一段。'}</p>`;
}
function jumpPara(a, L){
  const i = paraOf(a, L); const el = document.querySelector(`#body .para[data-p="${i}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  el.classList.remove('pflash'); void el.offsetWidth; el.classList.add('pflash');
}
function letterGrid(a, n, act, sel, extra){
  return `<div class="lgrid">${a.paragraphs.map(p => `<button class="lpick${sel === p.label ? ' chosen' : ''}${extra && extra(p.label) ? ' ' + extra(p.label) : ''}" data-act="${act}" data-n="${n}" data-l="${esc(p.label)}"><b>${esc(p.label)}</b><span>${esc(paraPreview(a, p.label, 5))}</span></button>`).join('')}</div>`;
}
function matchEpick(a, n){
  const ans = examAns(a); const it = (a.items || {})[n] || {};
  const all = blankNums(a).every(m => ans[m]);
  return `${top(`第 ${n} 题 · 考试中`)}<p class="p-en mq-stem">${esc(it.en || '')}</p>
    ${letterGrid(a, n, 'efill', ans[n])}
    <div class="p-actions">${ans[n] ? `<button class="pbtn ghost" data-act="efill" data-n="${n}" data-l="">清空这一题</button>` : ''}${all ? '' : `<button class="pbtn ghost" data-act="enext" data-n="${n}">下一题 →</button>`}</div>
    <p class="bank-note">${all ? `${blankNums(a).length} 道题都选好了，检查一遍就可以交卷。` : '每个字母后面是该段开头几个词，方便回忆。同一段可以重复选。'}</p>`;
}
function matchCard(a, n){
  const b = a.blanks[n]; if (!b) return idleHtml();
  const r = st(a, n); const it = (a.items || {})[n] || {};
  const head = `${top(`第 ${n} 题`)}<p class="p-en mq-stem">${esc(it.en || '')}</p>`;
  if (!r.done) {
    return `${head}
      <p class="need">${S.hint ? esc(b.need) : '先圈出题目里最独特的词，再回原文找同义替换。'}</p>
      ${letterGrid(a, n, 'pick', null)}
      <div class="p-actions"><button class="pbtn ghost" data-act="hint">${S.hint ? '收起提示' : '提示：看定位词'}</button><button class="pbtn ghost" data-act="show" data-n="${n}">直接看答案</button></div>`;
  }
  const [p, s] = locate(a, n);
  const src = a.paragraphs[p] && a.paragraphs[p].sentences[s];
  const verdict = r.shown ? `<p class="verdict shown">答案</p>` : r.ok ? `<p class="verdict ok">✓ 答对了</p>` : `<p class="verdict bad">✗ 你选了 ${esc(r.pick)} 段</p>`;
  const nx = nextOpen(a, n);
  return `${head}${verdict}
    <div class="ans-big"><b>段落</b><span>${esc(r.ans)}</span><i>${esc(paraPreview(a, r.ans, 8))}</i></div>
    ${src ? `<h5 class="p-sec">原文定位 · ${esc(r.ans)} 段</h5><blockquote class="srcq">${esc(src.en)}<span>${esc(src.zh)}</span></blockquote>
      <button class="more" data-act="gosrc" data-n="${n}">在文中查看这句 ↓</button>` : ''}
    <h5 class="p-sec">定位词</h5><p class="ex">${esc(b.need)}</p>
    <h5 class="p-sec">同义替换与解析</h5><p class="ex">${esc(b.why)}</p>
    ${b.trap ? `<h5 class="p-sec">易混段落</h5><p class="ex trap">${esc(b.trap)}</p>` : ''}
    ${b.tip ? `<div class="note"><b>技巧</b><br>${esc(b.tip)}</div>` : ''}
    ${it.zh ? `<h5 class="p-sec">题目译文</h5><p class="p-zht">${esc(it.zh)}</p>` : ''}
    <button class="more fixit" data-act="edopen" data-n="${n}">答案或解析有误？去修改</button>
    <div class="p-actions">${nx ? `<button class="pbtn primary" data-act="blank" data-n="${nx}">下一题 · ${nx}</button>` : ''}<button class="pbtn ghost" data-act="redo" data-n="${n}">重做这一题</button></div>`;
}
function goSrc(a, n){
  const [p, s] = locate(a, n);
  const q = `#body .s[data-p="${p}"][data-s="${s}"]`;
  if (!$(q)) { toast('没找到这句，先回到原文页再试'); return; }
  S.srcHit = { id: a.id, n: String(n), p, s };
  if (window.innerWidth < 1040 && S.panel) { S.panel = null; renderPanel(); } else highlight();
  const go = smooth => {
    const el = $(q); if (!el) return;
    const r = el.getBoundingClientRect();
    const y = window.scrollY + r.top - Math.max(16, (window.innerHeight - r.height) / 2);
    try { window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' }); } catch(e){ window.scrollTo(0, Math.max(0, y)); }
    if (!smooth) { try { el.scrollIntoView({ block: 'center' }); } catch(e){ el.scrollIntoView(); } }
  };
  go(!reduced());
  setTimeout(() => {
    const el = $(q); if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) go(false);
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }, reduced() ? 0 : 700);
}
