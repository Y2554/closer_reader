/* ---------- welcome: the front page a first-time visitor sees ----------
   Shown once, when the archive has loaded and no article has ever been opened (partD decides).
   The footer's 「使用说明」 brings it back. The clipping on the right is a working sample built
   from the real dog-cognition article: it plays itself (a pointer taps a word, adds it to the
   word book, tries a wrong option, then the right one, then switches to 精讲). The moment a
   mouse moves onto it — or a finger touches it, or it gets keyboard focus — the show stops and
   the same sample is live, so the visitor can try every one of those things themselves. */
function welcomeStarter(){
  const ok = a => !isTrans(a) && Object.keys(a.blanks || {}).length;
  const a = S.articles.find(x => x.id === 'dog-cognition') || S.articles.find(ok) || S.articles[0];
  return a ? a.id : null;
}
function welcomeDone(){ LS.set('welcomed', true); }

const WD = {
  words: {
    examined: ['v.', '审视；仔细研究', 'examine studies 审阅研究', 'B1', 'b'],
    intelligent: ['adj.', '聪明的；有智力的', 'among the more intelligent … 属于较聪明的一类', 'A2', '4'],
    domestic: ['adj.', '家养的；国内的', 'domestic animals 家畜', 'B2', '4']
  },
  opts: [['H', 'outperformed', '胜过（过去式）'], ['M', 'prove', '证明'], ['D', 'differentiate', '区分'], ['N', 'surpass', '超过；胜过']],
  ans: 'N',
  why: 'does not 后面只能接动词原形，还要能直接带宾语 other intelligent animals；和前半句“狗算聪明”构成转折的，只有 surpass。',
  no: {
    H: 'outperformed 意思对得上，但它是过去式，放在 does not 后面语法错误——这是本篇最典型的陷阱。',
    M: 'prove 是动词原形，语法上没问题，可“智力没有证明其他动物”说不通，和前半句也接不上。',
    D: 'differentiate 是原形，但意思是“区分”，常用 differentiate A from B，放进这句意思不通。'
  }
};

function welcomeHtml(){
  const n = S.articles.length;
  const ai = window.CR_AI ? '新用户有免费试用额度，用完可以填自己的 API Key。' : '';
  const feats = [
    ['点词即查', '点正文里任何一个词：它在这篇文章里的意思、词典释义、词源和近义辨析，一张卡片看全，顺手收进单词本。'],
    ['逐句精讲', '切到「精讲」，每句话下面排好中文翻译，重点词和语块标出来，长句也能一句句啃下来。'],
    ['先做题，再看解析', '文章带题目时默认是考试模式：限时作答、交卷判分，每个空为什么选它、陷阱在哪，都写在解析里。'],
    ['导入你自己的文章', `粘贴一篇英文，或把纸质文章、试卷拍下来（可以多页），AI 拆句、翻译、标注生词。${ai}`]
  ];
  const W = (k, cls = '') => `<button type="button" class="wd-w${cls}" data-wd="w" data-k="${k}">${k}</button>`;
  return `<section class="wel" aria-labelledby="welH">
    <div class="wel-top">
      <div class="wel-mast" style="--i:0">
        <div class="kicker">致读者 · 创刊词</div>
        <h2 class="wel-h" id="welH">把一篇英文<br>读成一份报纸</h2>
        <p class="wel-dek">外刊、考试真题、课本里的文章，都可以排进来慢慢读。每个词在这篇文章里是什么意思，每一句怎么翻、怎么拆，每道题为什么选它，都排在版面上。</p>
        <div class="wel-cta">
          <button class="pbtn primary big" data-act="welstart">先读一篇试试</button>
          <button class="pbtn ghost" data-act="welimport">导入自己的文章</button>
        </div>
        ${n ? `<p class="wel-sub">往期已备好 ${n} 篇（含四六级真题），可以随时在「往期」里换。</p>` : ''}
      </div>
      <figure class="wel-demo" id="wdemo" style="--i:1" aria-label="试读样张：可以点词、选答案、切换精讲">
        <div class="wd-sheet">
          <span class="wd-cur" aria-hidden="true"></span>
          <div class="wd-head">
            <span class="wd-kick">试读样张 · ¶1</span>
            <span class="wd-seg" role="group" aria-label="阅读模式"><button type="button" data-wd="mode" data-m="read" aria-pressed="true">阅读</button><button type="button" data-wd="mode" data-m="study" aria-pressed="false">精讲</button><i class="wd-seg-bg" aria-hidden="true"></i></span>
          </div>
          <p class="wd-text">
            <span class="wd-s">Scientists recently ${W('examined', ' key')} studies on dog intelligence and compared them with research into the minds of other animals.<span class="wd-zh"><span>科学家们最近审视了有关狗的智力的研究，并将其与其他动物心智的研究作了比较。</span></span></span>
            <span class="wd-s">They found that dogs are among the more ${W('intelligent')} carnivores and ${W('domestic', ' key')} animals, but that their intelligence does not <button type="button" class="wd-blank" data-wd="blank" aria-label="第 26 空"><span class="wd-num">26</span><b class="wd-l"></b></button> other intelligent animals.<span class="wd-zh"><span>研究人员发现，在食肉动物和家养动物中，狗属于较聪明的一类，但它们的智力并没有<u>超过</u>其他聪明的动物。</span></span></span>
          </p>
          <div class="wd-slot" aria-live="polite"></div>
        </div>
        <figcaption><span class="wd-hint"></span><button type="button" class="wd-replay" data-wd="replay" hidden>↻ 再看一遍演示</button></figcaption>
      </figure>
    </div>
    <ol class="wel-feats">${feats.map(([t, p], i) => `<li style="--i:${i + 2}"><span class="wf-n">0${i + 1}</span><div><b>${t}</b><p>${p}</p></div></li>`).join('')}</ol>
    <p class="wel-note" style="--i:6">${window.claude && window.claude.local
      ? '不用注册。文章、作答和单词本都保存在这台设备的浏览器里；换设备或清理浏览器之前，在「单词本 → 备份」导出一份。'
      : '文章、作答和单词本保存在你的 claude.ai 账号里，换设备打开也在。'}</p>
  </section>`;
}

/* the sample's little state machine — the autoplay and a real visitor drive the very same actions */
function welcomeMount(){
  const root = $('#wdemo'); if (!root || root.dataset.on) return;
  root.dataset.on = '1';
  const sheet = $('.wd-sheet', root), slot = $('.wd-slot', root), cur = $('.wd-cur', root), hint = $('.wd-hint', root), replay = $('.wd-replay', root);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(hover: none)').matches;
  const st = { auto: !still, word: null, saved: {}, open: false, picked: [], done: false, mode: 'read', touched: false };
  let timers = [], resumeT = 0, view = '';
  const later = (ms, f) => timers.push(setTimeout(() => { if (!document.contains(root)) return halt(); f(); }, ms));
  const halt = () => { timers.forEach(clearTimeout); timers = []; clearTimeout(resumeT); };

  const slotHtml = () => {
    if (st.word) {
      const [pos, zh, ex, lv, x] = WD.words[st.word], saved = st.saved[st.word];
      return `<div class="wd-card"><div class="wd-ch"><b>${st.word}</b><i>${pos}</i><span class="lvl cefr c${lv[0]}" title="CEFR ${lv} · ${CEFR_ZH[lv]}">${lv}</span><span class="lvl lvl-${x}">${LVL[x]}</span><em>本文</em></div>
        <p>${zh}</p><small>${ex}</small>
        <button type="button" class="wd-save${saved ? ' on' : ''}" data-wd="save">${saved ? '✓ 已加入单词本' : '+ 加入单词本'}</button></div>`;
    }
    if (st.open || st.picked.length) {
      const last = st.picked[st.picked.length - 1], right = st.done;
      const chips = WD.opts.map(([k, w, zh]) => {
        const p = st.picked.includes(k), cls = p ? (k === WD.ans ? ' ok' : ' no') : '';
        return `<button type="button" class="wd-opt${cls}" data-wd="opt" data-o="${k}"${right ? ' disabled' : ''}><b>${k}</b> ${w}<small>${zh}</small></button>`;
      }).join('');
      const note = right ? `<p class="wd-why ok"><span class="wd-mk">✓</span><span><b>N) surpass</b> ${WD.why}</span></p>`
        : last ? `<p class="wd-why no"><span class="wd-mk">✗</span><span>${WD.no[last]}</span></p>`
        : '<p class="wd-need">26 题 · 这里需要：<b>及物动词原形</b></p>';
      return `<div class="wd-opts${right ? ' fin' : ''}">${right ? '' : `<div class="wd-chips">${chips}</div>`}${note}</div>`;
    }
    return `<p class="wd-idle">${st.mode === 'study' ? '精讲模式：每句下面是中文翻译，<span class="wd-k">虚线</span>标的是重点词。' : '点<span class="wd-u">划线的词</span>看释义，点空格 <b>26</b> 选答案。'}</p>`;
  };
  const paint = () => {
    const html = slotHtml();
    if (html !== view) { view = html; slot.innerHTML = html; slot.firstElementChild.classList.add('wd-in'); }
    $$('.wd-w', root).forEach(b => { b.classList.toggle('on', b.dataset.k === st.word); b.classList.toggle('saved', !!st.saved[b.dataset.k]); });
    const blank = $('.wd-blank', root);
    blank.classList.toggle('on', st.open && !st.done); blank.classList.toggle('ok', st.done);
    blank.querySelector('.wd-l').textContent = st.done ? 'surpass' : '';
    sheet.classList.toggle('study', st.mode === 'study');
    $$('[data-wd=mode]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === st.mode)));
    root.classList.toggle('auto', st.auto);
    hint.textContent = st.auto ? (touch ? '自动演示中 · 点一下，自己试试' : '自动演示中 · 把鼠标移上来，自己试试')
      : st.touched ? '这些在每篇文章里都能用。' : '轮到你了：点划线的词，或者点空格 26';
    replay.hidden = st.auto || still || !st.touched;
  };
  const reset = () => { Object.assign(st, { word: null, saved: {}, open: false, picked: [], done: false, mode: 'read' }); };

  const act = el => {
    const k = el.dataset.wd;
    if (k === 'w') { st.word = st.word === el.dataset.k ? null : el.dataset.k; st.open = false; }
    else if (k === 'save') st.saved[st.word] = !st.saved[st.word];
    else if (k === 'blank') { st.word = null; st.open = true; if (st.done) { st.picked = []; st.done = false; } }
    else if (k === 'opt') { const o = el.dataset.o; if (!st.picked.includes(o)) st.picked.push(o); st.done = o === WD.ans; st.open = true; }
    else if (k === 'mode') { st.mode = el.dataset.m; st.word = null; st.open = false; if (!st.done) st.picked = []; }
    paint();
  };

  // the pointer: glides to the target, taps (a ring), then performs the same action a click would
  const tap = sel => {
    const el = typeof sel === 'string' ? $(sel, root) : sel; if (!el) return;
    const a = sheet.getBoundingClientRect(), b = el.getBoundingClientRect();
    cur.style.transform = `translate(${b.left - a.left + Math.min(b.width * .6, 40)}px,${b.top - a.top + b.height * .62}px)`;
    cur.classList.add('show');
    later(640, () => { cur.classList.remove('tap'); void cur.offsetWidth; cur.classList.add('tap'); act(el); });
  };
  const play = () => {
    halt(); st.auto = true; reset(); paint(); cur.classList.remove('show', 'tap');
    let t = 700;
    const at = (gap, f) => { t += gap; later(t, f); };
    at(0, () => tap('[data-k=intelligent]'));
    at(2300, () => tap('[data-wd=save]'));
    at(1900, () => tap('[data-wd=blank]'));
    at(1700, () => tap('[data-o=H]'));
    at(2900, () => tap('[data-o=N]'));
    at(3300, () => tap('[data-m=study]'));
    at(4200, () => { cur.classList.remove('show'); });
    at(500, play);
  };
  const stop = (clean) => {
    if (!st.auto) return;
    halt(); st.auto = false; cur.classList.remove('show', 'tap');
    if (clean) reset();
    paint();
  };

  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') stop(true); });
  root.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse' || still || st.touched) return;
    clearTimeout(resumeT); resumeT = setTimeout(() => { if (document.contains(root) && !root.matches(':hover')) play(); }, 1600);
  });
  root.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') stop(!e.target.closest('.wd-slot')); });   // a tap inside the answer box keeps what's there so the tap still lands
  root.addEventListener('focusin', () => stop(true));
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-wd]'); if (!el || !e.isTrusted) return;
    if (el.dataset.wd === 'replay') { st.touched = false; play(); return; }
    stop(false); st.touched = true; act(el);
  });
  // the tour only runs while the sample is on screen
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(x => {
    if (!document.contains(root)) return;
    if (!x.isIntersecting && st.auto) halt();
    else if (x.isIntersecting && st.auto && !timers.length) play();
  })).observe(root);
  // hold the sheet at its tallest layout (精讲 adds a translation under each sentence) so the page never jumps
  const fit = () => {
    if (!document.contains(root)) return removeEventListener('resize', fitSoon);
    const was = sheet.classList.contains('study');
    sheet.style.minHeight = ''; sheet.classList.add('wd-measure');
    sheet.classList.add('study'); const h1 = sheet.offsetHeight;
    sheet.classList.remove('study'); const h0 = sheet.offsetHeight;
    sheet.classList.toggle('study', was); void sheet.offsetHeight; sheet.classList.remove('wd-measure');
    sheet.style.minHeight = Math.ceil(Math.max(h0, h1) + 26) + 'px';
  };
  let fitT = 0; const fitSoon = () => { clearTimeout(fitT); fitT = setTimeout(fit, 150); };
  addEventListener('resize', fitSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if (st.auto) play(); else paint();
  fit();
}
