/* ---------- 翻译 (Part IV: Chinese → English) ---------- */
const isTrans = a => !!a && a.type === 'trans';
const enWords = s => (String(s || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
let trSaveT = 0;

// split a Chinese sentence into plain text + expression buttons (longest expression first)
function trZhHtml(a, z, live){
  let segs = [{ t: z }];
  (a.expr || []).map((e, i) => [e, i]).sort((x, y) => y[0].zh.length - x[0].zh.length).forEach(([e, i]) => {
    if (!e.zh) return;
    segs = segs.flatMap(sg => {
      if (sg.i != null || !sg.t.includes(e.zh)) return [sg];
      const parts = sg.t.split(e.zh); const out = [];
      parts.forEach((pt, k) => { if (pt) out.push({ t: pt }); if (k < parts.length - 1) out.push({ i, t: e.zh }); });
      return out;
    });
  });
  return segs.map(sg => sg.i == null || !live ? esc(sg.t)
    : `<button class="tr-k${S.panel && S.panel.type === 'expr' && S.panel.i === sg.i ? ' on' : ''}" data-act="trk" data-i="${sg.i}">${esc(sg.t)}</button>`).join('');
}
function transHtml(a){
  const p = S.prog[a.id] || {}; const R = p.review; const shown = !!(p.revealed || R);
  const zhChars = a.paragraphs.reduce((n, pp) => n + pp.sentences.reduce((m, s) => m + String(s.zh || '').replace(/\s/g, '').length, 0), 0);
  const busy = S.trBusy === a.id;
  const keys = a.keys || []; const used = new Set();
  const src = a.paragraphs.map(pp => `<p class="tr-src-p">${pp.sentences.map(s => trZhHtml(a, s.zh, shown)).join('')}</p>`).join('');
  const pairs = shown ? a.paragraphs.map((pp, pi) => pp.sentences.map((s, si) => {
    const tk = toks(s.en); markKw(tk, keys, used);
    return `<li class="tr-pair"><p class="tr-zh">${trZhHtml(a, s.zh, true)}</p><p class="tr-en"><span class="s" data-p="${pi}" data-s="${si}">${renderToks(a, tk)}</span></p></li>`;
  }).join('')).join('') : '';
  const wc = enWords(p.draft);
  const fixes = R && (R.fixes || []).length ? `<h5 class="p-sec">逐句修改</h5><ol class="tr-fix">${R.fixes.map(f => `<li><p class="tr-orig">${esc(f.orig)}</p><p class="tr-better">${esc(f.fix)}</p>${f.why ? `<p class="tr-why">${esc(f.why)}</p>` : ''}</li>`).join('')}</ol>` : '';
  const ring = R ? (() => { const C = 2 * Math.PI * 26, off = C * (1 - Math.max(0, Math.min(15, R.score)) / 15); return `<svg class="tr-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="rt" cx="30" cy="30" r="26"/><circle class="rf" cx="30" cy="30" r="26" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${off.toFixed(2)}"/></svg>`; })() : '';
  return `<article class="story tr">
    <div class="kicker">${esc(a.source || '翻译')}</div>
    <h2 class="headline">${esc(a.title)}</h2>
    ${a.zh ? `<p class="dek">${esc(a.zh)}</p>` : ''}
    <div class="byline"><span>汉译英 · ${a.paragraphs.reduce((n, pp) => n + pp.sentences.length, 0)} 句 · ${zhChars} 字 · 建议 30 分钟</span><span>${R ? `Claude 批改 <b>${R.score}/15</b>` : p.draft ? `已写 <b>${wc}</b> 词` : '还没开始'}</span></div>
    <section class="tr-src"><h3>原文 <span>Chinese</span></h3>${src}${shown ? '<p class="tr-hint">点带下划线的词语，看对应的英文表达。</p>' : ''}</section>
    <section class="tr-work">
      <header><h3>Your Translation<span>我的译文</span></h3><span class="tr-wc" id="trWc">${wc} 词</span></header>
      <textarea id="trIn" class="tr-in" spellcheck="true" placeholder="在这里写你的英文译文。六级翻译 30 分钟，参考译文约 ${a.paragraphs.reduce((n, pp) => n + pp.sentences.reduce((m, s) => m + enWords(s.en), 0), 0)} 词。写完再对照参考译文，或者交给 Claude 按六级标准打分。">${esc(p.draft || '')}</textarea>
      <div class="tr-act">
        ${S.sample ? `<button class="pbtn primary" data-act="trgrade" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>Claude 正在批改…' : R ? '修改后重新批改' : '交给 Claude 批改'}</button>` : ''}
        <button class="pbtn ${S.sample ? 'ghost' : 'primary'}" data-act="trshow">${shown && !R ? '收起参考译文' : shown ? '参考译文在下方' : '对照参考译文'}</button>
      </div>
      ${S.trErr && S.trErr.id === a.id ? `<p class="dload" style="color:var(--red)">${esc(S.trErr.msg)}</p>` : ''}
    </section>
    ${R ? `<section class="tr-rev">
      <div class="tr-score">${ring}<div><b class="cu" data-to="${R.score}">${R.score}</b><span>/ 15</span></div><div class="tr-band"><i>${esc(R.band || '')}</i><p>${esc(R.summary || '')}</p></div></div>
      ${(R.good || []).length ? `<h5 class="p-sec">做得好的地方</h5><ul class="tr-good">${R.good.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
      ${fixes}
      ${R.polished ? `<h5 class="p-sec">在你的译文基础上润色</h5><p class="tr-pol">${esc(R.polished)}</p>` : ''}
      <p class="dsrc">评分依据六级翻译五档标准（14 / 11 / 8 / 5 / 2 分档），由 Claude 批改，仅供参考。</p>
    </section>` : ''}
    ${shown ? `<section class="tr-ref"><h3>Reference <span>参考译文 · 逐句对照</span></h3><div id="body" class="${S.showKw ? 'show-kw' : ''} ${S.showSt ? 'show-st' : ''}"><ol class="tr-pairs">${pairs}</ol></div></section>
      ${(a.expr || []).length ? `<section class="tr-exprs"><h3>Expressions <span>表达积累</span></h3><ul>${a.expr.map((e, i) => `<li><button class="tr-x" data-act="trk" data-i="${i}"><b>${esc(e.zh)}</b><span>${esc(e.en)}</span></button></li>`).join('')}</ul></section>` : ''}` : ''}
    ${shown && (a.tips || []).length ? `<section class="tips"><h3>Technique <span>翻译技巧</span></h3><ol>${a.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>` : ''}
  </article>`;
}
function exprCard(a, i){
  const e = (a.expr || [])[i]; if (!e) return idleHtml();
  const k = wkey(e.en); const R = S.words[k];
  return `${top(`表达 ${i + 1} / ${(a.expr || []).length}`)}
    <p class="tr-ezh">${esc(e.zh)}</p><p class="tr-een">${esc(e.en)}</p>
    ${e.alt ? `<p class="ex"><b>也可以说</b> ${esc(e.alt)}</p>` : ''}
    ${e.n ? `<div class="note"><b>用法</b><br>${esc(e.n)}</div>` : ''}
    <div class="p-actions"><button class="pbtn ${R ? 'ghost' : 'primary'}" data-act="trkeep" data-i="${i}">${R ? '已收进单词本 · 移除' : '收进单词本'}</button>
      ${i + 1 < a.expr.length ? `<button class="pbtn ghost" data-act="trk" data-i="${i + 1}">下一个 →</button>` : ''}</div>`;
}
async function trGrade(a){
  if (!S.sample || S.trBusy) return;
  const draft = String((S.prog[a.id] || {}).draft || '');
  if (enWords(draft) < 20) { toast('译文太短了，写满 20 个词以上再批改'); return; }
  S.trBusy = a.id; S.trErr = null; renderView();
  const src = a.paragraphs.map(p => p.sentences.map(s => s.zh).join('')).join('\n');
  const ref = a.paragraphs.map(p => p.sentences.map(s => s.en).join(' ')).join('\n');
  const prompt = `你是大学英语六级考试的翻译阅卷老师。请按六级翻译评分标准给学生的译文打分并讲评。
评分标准（满分 15 分，五个档次）：
14 分档（13–15 分）：译文准确表达了原文意思，用词贴切，行文流畅，基本无语言错误，仅有个别小错。
11 分档（10–12 分）：译文基本表达了原文意思，结构较清晰，语言错误相对较少。
8 分档（7–9 分）：译文勉强表达了原文意思，用词欠准确，语言错误相当多，其中有些是严重错误。
5 分档（4–6 分）：译文仅表达了一小部分原文意思，用词不准确，有相当多的严重语言错误。
2 分档（1–3 分）：译文支离破碎，除个别词语或句子外，绝大部分文字没有表达原文意思。
漏译的部分按未表达原文意思处理。参考译文只是一种译法，学生用其他正确译法不扣分。

原文：
${src}

参考译文：
${ref}

学生译文：
${draft}

只输出一个 JSON 对象，不要其他文字：
{"score": 0 到 15 的整数, "band": "例如 11 分档", "summary": "一两句总体评价（中文）", "good": ["学生译文里值得肯定的一两处（中文，可引用原词）"], "fixes": [{"orig": "学生译文中有问题的原句或片段（原样摘录）", "fix": "改正后的写法（英文）", "why": "错在哪、为什么这样改（中文，简短）"}], "polished": "在学生译文基础上修改润色后的完整英文译文，尽量保留学生的用词和句式"}
fixes 按原文顺序列出，最多 8 条，只挑真正影响得分的问题（漏译、误译、语法、搭配、时态、主谓一致、拼写）。`;
  try {
    const r = await S.sample.json(prompt, { modelTier: 'default' });
    if (!r || typeof r !== 'object' || r.score == null) throw { code: 'invalid_json' };
    const review = {
      score: Math.max(0, Math.min(15, Math.round(+r.score || 0))), band: String(r.band || ''), summary: String(r.summary || ''),
      good: (r.good || []).map(String).slice(0, 4),
      fixes: (r.fixes || []).filter(f => f && (f.orig || f.fix)).map(f => ({ orig: String(f.orig || ''), fix: String(f.fix || ''), why: String(f.why || '') })).slice(0, 8),
      polished: String(r.polished || ''), at: Date.now(), draft
    };
    const p = progOf(a.id); p.draft = draft; p.review = review; p.revealed = true;
    p.attempts = [...(p.attempts || []), { at: Date.now(), secs: 0, score: review.score, total: 15 }].slice(-30);
    setProg(a.id, p);
    S.trBusy = null; S.enter = false; renderChrome(); renderView(); animateCounts($('#view'));
    const el = $('.tr-rev'); if (el) el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  } catch(e){ S.trBusy = null; S.trErr = { id: a.id, msg: sampleErr(e) }; renderView(); }
}
function trAction(act, t, a){
  if (!a || !isTrans(a)) return;
  switch (act) {
    case 'trshow': { const p = progOf(a.id); const R = p.review; if (R) { const el = $('.tr-ref'); if (el) el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); break; } p.revealed = !p.revealed; setProg(a.id, p); renderView(); if (p.revealed) { const el = $('.tr-ref'); if (el) el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } break; }
    case 'trgrade': trGrade(a); break;
    case 'trk': S.panel = { type: 'expr', i: +t.dataset.i }; renderPanel(); $$('.tr-k').forEach(b => b.classList.toggle('on', +b.dataset.i === +t.dataset.i)); break;
    case 'trkeep': {
      const e = (a.expr || [])[+t.dataset.i]; if (!e) break;
      const k = wkey(e.en);
      if (S.words[k]) { removeWord(k); toast(`已移出单词本：${e.en}`); }
      else {
        let ctx = null;
        a.paragraphs.forEach((pp, pi) => pp.sentences.forEach((s, si) => { if (!ctx && s.zh.includes(e.zh)) ctx = { art: a.id, title: a.title, p: pi, s: si, text: s.en, at: Date.now() }; }));
        upsertWord(k, { forms: [k], status: 'new', fill: { pos: '表达', zh: e.zh, en: e.n || '' } }, ctx);
        toast(`已收进单词本：${e.en}`);
      }
      renderChrome(); renderPanel(true); break;
    }
  }
}
document.addEventListener('input', e => {
  if (e.target.id !== 'trIn') return;
  const a = cur(); if (!a || !isTrans(a)) return;
  const v = e.target.value; const wc = $('#trWc'); if (wc) wc.textContent = `${enWords(v)} 词`;
  S.prog[a.id] = { ...(S.prog[a.id] || {}), draft: v };
  clearTimeout(trSaveT); trSaveT = setTimeout(() => { const p = progOf(a.id); p.draft = v; setProg(a.id, p); }, 700);
});
