/* ---------- archive: a newsstand, one rack per day ---------- */
const WK = '日一二三四五六';
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function dayLabel(t){
  const d = new Date(t); const z = new Date(); z.setHours(0, 0, 0, 0);
  const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
  const diff = Math.round((z - d0) / 864e5);
  return diff === 0 ? '今天' : diff === 1 ? '昨天' : diff === 2 ? '前天' : '';
}
function npSnippet(a){
  let out = '';
  for (const p of a.paragraphs || []) {
    for (const s of p.sentences || []) {
      out += (isTrans(a) ? String(s.zh || '') : String(s.en || '').replace(/\{\{\d+\}\}/g, '_____') + ' ');
      if (out.length > 1500) return out;
    }
  }
  return out;
}
function npKind(a){
  if (isMatch(a)) return ['Section B', '段落匹配'];
  if (isMcq(a)) return ['Section C', '仔细阅读'];
  if (isTrans(a)) return ['Part IV', '汉译英'];
  if (blankNums(a).length) return ['Section A', '选词填空'];
  return ['Reading', '精读'];
}
function paperHtml(a, i, no, swing){
  const sc = score(a); const p = S.prog[a.id] || {};
  const vc = Object.values(S.words).filter(w => (w.status === 'new' || w.status === 'learning') && (w.ctx || []).some(c => c.art === a.id)).length;
  const at = p.attempts || []; const last = at[at.length - 1];
  const [sec, kind] = npKind(a);
  const tilt = [-0.8, 0.6, -0.35, 0.9, -0.55][i % 5];
  const pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
  const stamp = last ? `<span class="np-stamp${last.score / last.total >= 0.6 ? '' : ' low'}" aria-hidden="true"><b>${last.score}/${last.total}</b><i>${isTrans(a) ? '批改' : '考过'}${at.length > 1 ? ' ×' + at.length : ''}</i></span>`
    : sc.total && sc.done === sc.total ? `<span class="np-stamp done" aria-hidden="true"><b>✓</b><i>做完</i></span>` : '';
  const reading = S.cur === a.id;
  const del = S.confirmDel === a.id;
  return `<div class="hang" style="--t:${tilt}deg;--d:${(i * 0.075).toFixed(3)}s">
    <button class="np" data-act="open" data-id="${esc(a.id)}" aria-label="${esc(a.title)}${reading ? '（正在读）' : ''}">
      <span class="peg l" aria-hidden="true"></span><span class="peg r" aria-hidden="true"></span>
      ${reading ? '<span class="np-rib" aria-hidden="true">在<br>读</span>' : ''}
      <span class="np-mast" aria-hidden="true">The Close Reader</span>
      <span class="np-line" aria-hidden="true"><span>No. ${no}</span><span>${a.createdAt ? (d => `${d.getMonth() + 1}月${d.getDate()}日`)(new Date(a.createdAt)) : ''}</span><span>CET-6</span></span>
      <span class="np-kick">${sec} · ${kind}</span>
      <span class="np-hl">${esc(a.title)}</span>
      ${a.zh ? `<span class="np-zh">${esc(a.zh)}</span>` : ''}
      <span class="np-cols" aria-hidden="true">${esc(npSnippet(a))}</span>
      <span class="np-foot">
        ${sc.total ? `<span class="np-bar"><i style="width:${pct}%"></i></span>` : ''}
        <span class="np-fm"><span>${isTrans(a) ? (p.review ? `批改 ${p.review.score}/15` : p.draft ? `已写 ${enWords(p.draft)} 词` : '译文 · 未开始') : sc.total ? (sc.done ? `作答 ${sc.done}/${sc.total}` : last ? `用时 ${fmtSecs(last.secs)}` : `${sc.total} 题 · 未开始`) : '阅读篇'}</span><span>生词 ${vc}</span></span>
      </span>
      ${stamp}
    </button>
    <div class="hang-meta">
      <span>${p.lastOpened ? '上次 ' + (d => `${d.getMonth() + 1}/${d.getDate()}`)(new Date(p.lastOpened)) : '还没读过'}</span>
      <button class="hm-del${del ? ' sure' : ''}" data-act="delart" data-id="${esc(a.id)}">${del ? '确认删除？' : '删除'}</button>
    </div>
  </div>`;
}
function archiveHtml(){
  if (!S.articles.length) return readHtml();
  const swing = S.enter && !reduced();
  const byAge = [...S.articles].sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
  const no = id => byAge.findIndex(a => a.id === id) + 1;
  const groups = [];
  [...S.articles].sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)).forEach(a => {
    const k = a.createdAt ? dayKey(a.createdAt) : '?';
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) groups.push(g = { k, t: a.createdAt, list: [] });
    g.list.push(a);
  });
  let idx = 0;
  const racks = groups.map(g => {
    const d = g.t ? new Date(g.t) : null; const rel = d ? dayLabel(g.t) : '';
    const head = `<header class="day">
      ${d ? `<b class="day-n">${d.getDate()}</b><span class="day-t"><span>${d.getMonth() + 1}月 · 星期${WK[d.getDay()]}${rel ? `<em>${rel}</em>` : ''}</span><small>${d.getFullYear()}</small></span>` : `<span class="day-t"><span>日期未注明</span></span>`}
      <i class="day-rule" aria-hidden="true"></i>
      <span class="day-c">${g.list.length} 份</span>
    </header>`;
    const papers = g.list.map(a => paperHtml(a, idx++, no(a.id), swing)).join('');
    return `<section class="shelf">${head}<div class="rack"><div class="hangs">${papers}</div></div></section>`;
  }).join('');
  return `<div class="stand${swing ? ' swing' : ''}">
    <div class="sect-head"><h2>往期报亭</h2><p>${S.articles.length} 份 · ${groups.length} 天 · 点报纸取下来读</p></div>
    ${racks}
  </div>`;
}
function takePaper(el, id){
  if (reduced() || !el) { openArticle(id); return; }
  el.classList.add('take');
  setTimeout(() => openArticle(id), 260);
}
