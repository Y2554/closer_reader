/* ---------- welcome: the front page a first-time visitor sees ----------
   Shown once, when the archive has loaded and no article has ever been opened (partD decides).
   The footer's 「使用说明」 brings it back. The little clipping on the right is a looping demo
   built from the real dog-cognition article: tap a word → its card, fill blank 26 → the answer. */
function welcomeStarter(){
  const ok = a => !isTrans(a) && Object.keys(a.blanks || {}).length;
  const a = S.articles.find(x => x.id === 'dog-cognition') || S.articles.find(ok) || S.articles[0];
  return a ? a.id : null;
}
function welcomeDone(){ LS.set('welcomed', true); }
function welcomeHtml(){
  const n = S.articles.length;
  const ai = window.CR_AI ? '新用户有免费试用额度，用完可以填自己的 API Key。' : '';
  const feats = [
    ['先考后讲', '新文章默认是考试模式：限时作答、交卷判分。再切到「精讲」，看逐句翻译和每个空的解题思路。'],
    ['点词即查', '点正文里任何一个词：本文里的意思、英汉词典、词源和近义辨析，一张卡片看全。'],
    ['错题和生词自动归档', '做错的空进错题本，收藏的词进单词本，按遗忘曲线安排复习和默写。'],
    ['导入你自己的卷子', `粘贴原文，或把试卷拍下来（可以多页），AI 拆句、翻译、写解析。${ai}`]
  ];
  return `<section class="wel" aria-labelledby="welH">
    <div class="wel-top">
      <div class="wel-mast" style="--i:0">
        <div class="kicker">致读者 · 创刊词</div>
        <h2 class="wel-h" id="welH">把六级阅读<br>读成一份报纸</h2>
        <p class="wel-dek">每天一篇真题文章。先限时做题，再逐句精读：每个空为什么选它，每个词在这篇文章里是什么意思，都排在版面上。</p>
        <div class="wel-cta">
          <button class="pbtn primary big" data-act="welstart">从一篇选词填空开始</button>
          <button class="pbtn ghost" data-act="welimport">导入自己的试卷</button>
        </div>
        ${n ? `<p class="wel-sub">往期已备好 ${n} 篇，可以随时在「往期」里换。</p>` : ''}
      </div>
      <figure class="wel-demo" style="--i:1" aria-hidden="true">
        <div class="wd-sheet">
          <div class="wd-kick">CET-6 · 选词填空 · ¶1</div>
          <p class="wd-text">The researchers found that dogs are among the more <span class="wd-w">intelligent</span> carnivores, but that their intelligence does not <span class="wd-blank"><span class="wd-num">26</span><b class="wd-l">N</b></span> other intelligent animals.</p>
          <div class="wd-slot">
            <div class="wd-card"><b>intelligent</b><i>adj.</i><span>聪明的；有智力的</span><em>本文</em></div>
            <div class="wd-ans"><span class="wd-ok">✓</span><div><b>N) surpass</b> · 超过；胜过<small>does not 后接动词原形，还要能直接带宾语 other intelligent animals。</small></div></div>
          </div>
        </div>
        <figcaption>点词看释义 · 填空看解析</figcaption>
      </figure>
    </div>
    <ol class="wel-feats">${feats.map(([t, p], i) => `<li style="--i:${i + 2}"><span class="wf-n">0${i + 1}</span><div><b>${t}</b><p>${p}</p></div></li>`).join('')}</ol>
    <p class="wel-note" style="--i:6">${window.claude && window.claude.local
      ? '不用注册。文章、作答和单词本都保存在这台设备的浏览器里；换设备或清理浏览器之前，在「单词本 → 备份」导出一份。'
      : '文章、作答和单词本保存在你的 claude.ai 账号里，换设备打开也在。'}</p>
  </section>`;
}
