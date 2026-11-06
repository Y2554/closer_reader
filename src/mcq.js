/* ---------- 仔细阅读 (Section C: four-option multiple choice) ---------- */
const isMcq = a => !!a && a.type === 'mcq';
const isItems = a => isMatch(a) || isMcq(a);       // question-list types (no {{n}} gaps in the text)
const MCQ_L = ['A', 'B', 'C', 'D'];
const mcqOpts = (a, n) => MCQ_L.filter(L => (((a.items || {})[n] || {}).o || {})[L]);
const OT_LABEL = { swap: '偷换概念', infer: '无中生有', part: '以偏概全', flip: '正反颠倒' };

function mcqHtml(a){
  const exam = inExam(a); const ns = blankNums(a); const ans = exam ? examAns(a) : {};
  return `<section class="mqs mcqs${exam ? ' exam' : ''}">
    <header class="mqs-hd"><h3>Questions<span>题目 ${ns[0]}–${ns[ns.length - 1]}</span></h3><p>${exam ? '读完全文再作答，直接点选项，交卷前随时可以改。' : '点选项作答，立刻判对错并在旁边给出解析。'}</p></header>
    <ol class="mq-list">${ns.map(n => {
      const it = (a.items || {})[n] || {}; const r = exam ? null : st(a, n);
      const on = S.panel && (S.panel.type === 'blank' || S.panel.type === 'epick') && S.panel.n === n;
      const zh = !exam && (S.zhAll || (r && r.done));
      const opts = mcqOpts(a, n).map(L => {
        const o = it.o[L]; let cls = 'mo';
        if (exam) { if (ans[n] === L) cls += ' chosen'; }
        else if (r.done) cls += L === r.ans ? ' right' : L === r.pick ? ' wrong' : ' dim';
        return `<li><button class="${cls}" data-act="mcpick" data-n="${n}" data-l="${L}"><b>${L})</b><span class="mo-t"><span class="mo-en">${esc(o.en)}</span>${zh && o.zh ? `<span class="mo-zh">${esc(o.zh)}</span>` : ''}</span></button></li>`;
      }).join('');
      return `<li class="mq mcq${on ? ' on' : ''}" data-n="${n}">
        <div class="mq-top"><span class="mq-n">${n}.</span><div class="mq-body"><p class="mq-en">${esc(it.en || '')}</p>${zh && it.zh ? `<p class="mq-zh">${esc(it.zh)}</p>` : ''}</div>${blankHtml(a, n)}</div>
        <ol class="mos">${opts}</ol></li>`; }).join('')}</ol>
  </section>`;
}
function mcqPick(a, n, L){
  if (!a || !a.blanks[n]) return;
  if (inExam(a)) {
    examFill(a, n, examAns(a)[n] === L ? '' : L);
    S.examSel = null; S.panel = null;
    renderView(); afterReadRender(); renderPanel(); return;
  }
  const r = st(a, n);
  if (!r.done) {
    const p = progOf(a.id); p.picks[n] = L; delete p.shown[n]; setProg(a.id, p);
    if (L !== a.blanks[n].ans) recordMistake(a, n, L);
    S.justFilled = n;
  }
  S.panel = { type: 'blank', n }; S.hint = false;
  renderView(); afterReadRender(); renderPanel();
}
function mcqEpick(a, n){
  const ans = examAns(a); const it = (a.items || {})[n] || {};
  const all = blankNums(a).every(m => ans[m]);
  return `${top(`第 ${n} 题 · 考试中`)}<p class="p-en mq-stem">${esc(it.en || '')}</p>
    <div class="mpicks">${mcqOpts(a, n).map(L => `<button class="mpick${ans[n] === L ? ' chosen' : ''}" data-act="efill" data-n="${n}" data-l="${L}"><b>${L})</b><span>${esc(it.o[L].en)}</span></button>`).join('')}</div>
    <div class="p-actions">${ans[n] ? `<button class="pbtn ghost" data-act="efill" data-n="${n}" data-l="">清空这一题</button>` : ''}${all ? '' : `<button class="pbtn ghost" data-act="enext" data-n="${n}">下一题 →</button>`}</div>
    <p class="bank-note">${all ? `${blankNums(a).length} 道题都选好了，检查一遍就可以交卷。` : '也可以直接在文章下方的题目里点选项，电脑上按 A–D 键。'}</p>`;
}
function mcqCard(a, n){
  const b = a.blanks[n]; if (!b) return idleHtml();
  const r = st(a, n); const it = (a.items || {})[n] || {};
  const head = `${top(`第 ${n} 题`)}<p class="p-en mq-stem">${esc(it.en || '')}</p>`;
  if (!r.done) {
    return `${head}
      <p class="need">${S.hint ? `定位：<b>${esc(b.need)}</b>` : '先圈出题干里的定位词，回原文找到对应的句子再选。'}</p>
      <div class="mpicks">${mcqOpts(a, n).map(L => `<button class="mpick" data-act="mcpick" data-n="${n}" data-l="${L}"><b>${L})</b><span>${esc(it.o[L].en)}</span></button>`).join('')}</div>
      <div class="p-actions"><button class="pbtn ghost" data-act="hint">${S.hint ? '收起提示' : '提示：看定位'}</button><button class="pbtn ghost" data-act="show" data-n="${n}">直接看答案</button></div>`;
  }
  const [p, s] = locate(a, n);
  const src = a.paragraphs[p] && a.paragraphs[p].sentences[s];
  const verdict = r.shown ? `<p class="verdict shown">答案</p>` : r.ok ? `<p class="verdict ok">✓ 答对了</p>` : `<p class="verdict bad">✗ 你选了 ${esc(r.pick)}</p>`;
  const ao = (it.o || {})[r.ans] || {};
  const ox = b.ox || {}, ot = b.ot || {};
  const nx = nextOpen(a, n);
  return `${head}${verdict}
    <div class="ans-big"><b>答案</b><span>${esc(r.ans)}</span><i>${esc(ao.en || '')}</i></div>
    ${src ? `<h5 class="p-sec">原文定位 · 第 ${p + 1} 段</h5><blockquote class="srcq">${esc(src.en)}<span>${esc(src.zh)}</span></blockquote>
      <button class="more" data-act="gosrc" data-n="${n}">在文中查看这句 ↓</button>` : ''}
    <h5 class="p-sec">定位</h5><p class="ex">${esc(b.need)}</p>
    <h5 class="p-sec">解题思路</h5><p class="ex">${esc(b.why)}</p>
    <h5 class="p-sec">逐项分析</h5><ul class="oxl">${mcqOpts(a, n).map(L => `<li class="${L === r.ans ? 'ok' : L === r.pick ? 'bad' : ''}"><b>${L}</b><div><p class="ox-en">${esc(it.o[L].en)}${it.o[L].zh ? `<span>${esc(it.o[L].zh)}</span>` : ''}</p>${L === r.ans ? '<p class="ox-why"><i class="ox-tag ok">正确</i>与原文同义替换，见上方解题思路。</p>' : ox[L] ? `<p class="ox-why">${ot[L] ? `<i class="ox-tag t-${ot[L]}">${OT_LABEL[ot[L]] || ''}</i>` : ''}${esc(ox[L])}</p>` : ''}</div></li>`).join('')}</ul>
    ${b.tip ? `<div class="note"><b>技巧</b><br>${esc(b.tip)}</div>` : ''}
    ${it.zh ? `<h5 class="p-sec">题干译文</h5><p class="p-zht">${esc(it.zh)}</p>` : ''}
    <button class="more fixit" data-act="edopen" data-n="${n}">答案或解析有误？去修改</button>
    <div class="p-actions">${nx ? `<button class="pbtn primary" data-act="blank" data-n="${nx}">下一题 · ${nx}</button>` : ''}<button class="pbtn ghost" data-act="redo" data-n="${n}">重做这一题</button></div>`;
}
