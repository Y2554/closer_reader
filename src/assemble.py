"""Build close-reader.html from src/.

Usage:  python3 src/assemble.py          (run from anywhere)
Output: close-reader.html in the project root, plus build/check.js (the page's
script on its own, for `node --check build/check.js`).

base.html is the original single-file page. This script cuts it at a few
comment markers, swaps in the newer parts (partB-E, match, stand, tabs) and
applies small anchored patches. Every patch asserts its anchor occurs exactly
once, so a failed build means an anchor drifted - fix the anchor, never the
output file.
"""
import os, re, shutil, subprocess
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = open('src/base.html', encoding='utf-8').read()
L = src.split('\n')
def lines(a, b): return '\n'.join(L[a-1:b])
def find(pred=None, start=0):
    for i in range(start, len(L)):
        if pred(L[i]): return i + 1   # 1-indexed
    raise SystemExit('marker not found')
iA = find(lambda x: x == '(() => {')
iDC = find(start=iA, pred=lambda x: x.startswith('function dictCard'))
iImp = find(start=iA, pred=lambda x: x.startswith('/* ---------- import'))
iAct = find(start=iA, pred=lambda x: x.startswith('/* ---------- actions'))
iDrag = find(start=iA, pred=lambda x: x.startswith('/* ---------- bottom sheet drag'))
iBoot = find(start=iA, pred=lambda x: x.startswith('/* ---------- boot'))
head = lines(1, iA - 1); partA = lines(iA, iDC - 1); importSec = lines(iImp, iAct - 2); drag = lines(iDrag, iBoot - 2)
B = open('src/partB.js', encoding='utf-8').read(); C = open('src/partC.js', encoding='utf-8').read().replace('/*@@TABS@@*/\n', open('src/tabs.js', encoding='utf-8').read()); D = open('src/partD.js', encoding='utf-8').read(); E = open('src/partE.js', encoding='utf-8').read() + '\n' + open('src/match.js', encoding='utf-8').read() + '\n' + open('src/mcq.js', encoding='utf-8').read() + '\n' + open('src/trans.js', encoding='utf-8').read() + '\n' + open('src/stand.js', encoding='utf-8').read() + '\n' + open('src/dict.js', encoding='utf-8').read()
i0 = partA.index('const S = {'); i1 = partA.index('};', i0) + 2
partA = partA[:i0] + """const S = {
  db: null, sample: null, dl: null, dbState: 'loading',
  articles: [], prog: {}, words: {}, formIdx: new Map(), cats: [], wordsLoaded: false, legacy: null,
  view: 'read', cur: null, userChose: false, panel: null, pop: [],
  showPos: LS.get('showPos', false), showKw: LS.get('showKw', true), showSt: LS.get('showSt', true), zhAll: false, group: LS.get('group', false),
  hideZh: LS.get('hideZh', false), vshow: new Set(), vtab: 'list', vf: 'all', vc: 'all', va: 'all', vq: '', confirmDelW: null,
  nwLvl: LS.get('nwLvl', '6'), confirmBulk: false, newCat: false,
  mistakes: {}, mkRetry: {}, mkType: 'all', mkShowDone: false, examRun: null, examSel: null, justFilled: null, revealAnim: false,
  confirmSubmit: false, confirmMode: false, confirmRetake: false, segFrom: null, edit: null, enter: false, ctxRepaired: false, progLoaded: false,
  rv: null, dt: null, dtScope: 'learn', newLimit: LS.get('newLimit', 20), bk: null,
  notes: {}, dictAll: false, sheet: 'half',
  openZh: new Set(), unguard: new Set(), hint: false, confirmReset: false, confirmDel: null, selAt: 0,
  impMode: 'text', impForm: { impTitle:'', impText:'', impBank:'', impAns:'' }, impFile: null, imp: null, impCtl: null, impDirty: true
};""" + partA[i1:]
reps = [
 ("const vocabHas = (art, w) => S.vocab.find(v => v.art === art && v.w === w);\n", ""),
 (".then(() => { if (P.showDetail) loadMore(P); if (S.panel === P) renderPanel(true); });", ".then(() => { if (P.showDetail) loadMore(P); fillMissing(P); refresh(P); });"),
 ("    .then(() => { if (S.panel === P) renderPanel(true); });", "    .then(() => refresh(P));"),
 ("  let h = `<div class=\"xsec\"><h4 class=\"xh\">详解 · ${esc(lemma)}</h4>`;", "  let h = '<div class=\"xsec\">';"),
 ("P.aiBusy = true; P.aiErr = ''; renderPanel(true);", "P.aiBusy = true; P.aiErr = ''; refresh(P);"),
 ("  if (S.panel === P) renderPanel(true);\n}", "  refresh(P);\n}"),
]
for a, b in reps:
    assert partA.count(a) == 1, a[:70]; partA = partA.replace(a, b)
css_new = open('src/extra.css', encoding='utf-8').read() + '\n' + open('src/extra2.css', encoding='utf-8').read() + '\n' + open('src/match.css', encoding='utf-8').read() + '\n' + open('src/mcq.css', encoding='utf-8').read() + '\n' + open('src/trans.css', encoding='utf-8').read() + '\n' + open('src/stand.css', encoding='utf-8').read() + '\n' + open('src/tabs.css', encoding='utf-8').read() + '\n' + open('src/dict.css', encoding='utf-8').read()
head = head.replace("@media (prefers-reduced-motion: reduce)", css_new + "\n@media (prefers-reduced-motion: reduce)")
tok_l = "  --shadow:0 -10px 30px rgba(20,24,27,.14);\n"
assert head.count(tok_l) == 1
head = head.replace(tok_l, tok_l + "  --st1:rgba(226,112,58,.20); --st1-ink:#b04f26; --st2:rgba(214,166,36,.22); --st2-ink:#856010;\n  --pop-shadow:0 18px 50px rgba(20,24,27,.22),0 2px 6px rgba(20,24,27,.10);\n")
tok_d = "    --shadow:0 -10px 30px rgba(0,0,0,.5);\n"
assert head.count(tok_d) == 1
head = head.replace(tok_d, tok_d + "    --st1:rgba(255,140,90,.22); --st1-ink:#ff9f73; --st2:rgba(240,196,80,.20); --st2-ink:#e9c46a;\n    --pop-shadow:0 18px 50px rgba(0,0,0,.6),0 2px 6px rgba(0,0,0,.45);\n")
tok_d2 = "  --sb:rgba(228,231,225,.16); --sb-hover:rgba(228,231,225,.34); --sb-active:rgba(147,171,255,.6);\n  color-scheme:dark;"
assert head.count(tok_d2) == 1
head = head.replace(tok_d2, "  --sb:rgba(228,231,225,.16); --sb-hover:rgba(228,231,225,.34); --sb-active:rgba(147,171,255,.6);\n  --st1:rgba(255,140,90,.22); --st1-ink:#ff9f73; --st2:rgba(240,196,80,.20); --st2-ink:#e9c46a;\n  --pop-shadow:0 18px 50px rgba(0,0,0,.6),0 2px 6px rgba(0,0,0,.45);\n  color-scheme:dark;")
h_old = '<div id="toast" class="toast" hidden></div>'
assert head.count(h_old) == 1
head = head.replace(h_old, h_old + '\n<div id="pop" class="pop" hidden role="dialog" aria-label="查词卡片"></div>')
imp_old = "    openArticle(id);\n    toast('新文章已排版，开始精读吧');"
assert importSec.count(imp_old) == 1
importSec = importSec.replace(imp_old, "    openEditor(id, true);")
tabs_old = '<button class="tab" data-act="view" data-v="vocab">'
assert head.count(tabs_old) == 1
head = head.replace(tabs_old, '<button class="tab" data-act="view" data-v="mistakes">错题本 <span class="ct" id="ctMis"></span></button>\n      ' + tabs_old)
head = head.replace('data-v="read">今日精读<', 'data-v="read">当前精读<')
head = head.replace('<div id="toast" class="toast" hidden></div>', '<div id="toast" class="toast" hidden></div>\n<button id="backq" class="backq" data-act="backq" hidden></button>', 1)
nav_end = '<button class="tab" data-act="view" data-v="import">导入新文章</button>'
head = head.replace(nav_end, '<button class="tab" data-act="view" data-v="dict">词典</button>\n      ' + nav_end, 1)
assert head.count('<div id="pop"') == 1
head = head.replace('<div id="pop"', '<div id="dkov" class="dk-ov" hidden></div>\n<div id="pop"', 1)
assert head.count(nav_end) == 1
head = head.replace(nav_end, nav_end + '\n      <span class="tab-ind" aria-hidden="true"></span>')
nav_open = '    <nav class="tabs" aria-label="栏目">'
assert head.count(nav_open) == 1
head = head.replace(nav_open, '    <div class="tabs-shell">\n' + nav_open)
nav_close = '      <span class="tab-ind" aria-hidden="true"></span>\n    </nav>'
assert head.count(nav_close) == 1
head = head.replace(nav_close, nav_close + '''
      <span class="tabs-glow l" aria-hidden="true"></span><span class="tabs-glow r" aria-hidden="true"></span>
      <button class="tabs-fade l" type="button" tabindex="-1" aria-hidden="true" data-tscroll="-1"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg></button>
      <button class="tabs-fade r" type="button" tabindex="-1" aria-hidden="true" data-tscroll="1"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg></button>
    </div>''')
for a_, b_ in [
  ('  "paragraphs": [ { "sentences": [ { "en": "英文原句，填空处写成 {{26}}", "zh": "整句中文翻译" } ] } ],',
   '  "type": "cloze（选词填空或普通文章）、match（段落匹配）、mcq（仔细阅读：四选一）或 trans（汉译英）",\n  "paragraphs": [ { "label": "段落匹配时写原文段落字母 A、B…，其他题型省略", "sentences": [ { "en": "英文原句，填空处写成 {{26}}", "zh": "整句中文翻译" } ] } ],\n  "items": { "36": { "en": "题目原文（段落匹配 / 仔细阅读）", "zh": "题目翻译", "o": { "A": { "en": "仔细阅读的选项原文", "zh": "选项翻译" } } } },'),
  ('"tip": "可迁移的技巧" } },', '"tip": "可迁移的技巧", "loc": [0, 1], "ox": { "B": "仔细阅读：这个错误选项错在哪" }, "ot": { "B": "swap" } } },'),
  ('6. tips 写 3–5 条本篇的技巧小结。', '6. tips 写 3–5 条本篇的技巧小结。\n7. 如果是段落匹配（Section B：一组带字母的段落 + 一组题目）：type 写 "match"；每段写 label（原文字母）；题目放进 items，键是题号；blanks 的键也是题号，ans 是段落字母，need 写题目里的定位词，why 写原文对应句以及题目与原文的同义替换，trap 写最容易混淆的段落及原因，tip 写一条可迁移的技巧，loc 写答案句的位置 [段落序号, 句子序号]（都从 0 开始）；options 输出 {}，cands 输出 []。\n8. 如果是仔细阅读（Section C：一篇文章 + 若干四选一题目，一次只整理一篇 Passage）：type 写 "mcq"；题干放进 items[题号].en/zh，四个选项放进 items[题号].o，键为 A–D，每个选项写 en 和 zh；blanks[题号].ans 是正确选项字母，need 写题干定位词及对应段落，why 写原文依据和同义替换，loc 写答案句位置，ox 为每个错误选项写一句错因，ot 为每个错误选项标干扰类型：swap 偷换概念 / infer 无中生有 / part 以偏概全 / flip 正反颠倒；trap 写最迷惑的选项，tip 写一条技巧；options 输出 {}，cands 输出 []。\n9. 如果是翻译题（Part IV：一段中文，要求译成英文）：type 写 "trans"；paragraphs 里每句的 zh 写中文原句（逐字保留），en 写一句地道、准确、符合六级 14 分档水平的参考译文；另外输出 expr 数组，列出 8–14 个翻译难点，每项 {"zh": "原文中连续出现的中文词语", "en": "对应英文表达", "alt": "可选的其他译法", "n": "用法或翻译技巧说明"}；keys 挑参考译文里的重点表达；tips 写 4–5 条本题用到的翻译技巧；options、blanks 输出 {}。其他题型 type 写 "cloze"，不写 items 和 loc。'),
  ("  const paragraphs = d.paragraphs.map(p => ({ sentences:", "  const paragraphs = d.paragraphs.map(p => ({ ...(p.label ? { label: String(p.label).trim().toUpperCase().slice(0, 2) } : {}), sentences:"),
  ("tip: String(v.tip || '') }; });", "tip: String(v.tip || ''), ...(Array.isArray(v.loc) && v.loc.length === 2 ? { loc: [+v.loc[0] || 0, +v.loc[1] || 0] } : {}), ...(v.ox && typeof v.ox === 'object' ? { ox: Object.fromEntries(Object.entries(v.ox).map(([l, t]) => [String(l).trim().toUpperCase().slice(0, 1), String(t)])) } : {}), ...(v.ot && typeof v.ot === 'object' ? { ot: Object.fromEntries(Object.entries(v.ot).map(([l, t]) => [String(l).trim().toUpperCase().slice(0, 1), ['swap', 'infer', 'part', 'flip'].includes(t) ? t : 'swap'])) } : {}) }; });"),
  ("  return { title: String(d.title || '未命名文章'),", """  const type = d.type === 'match' ? 'match' : d.type === 'mcq' ? 'mcq' : d.type === 'trans' ? 'trans' : 'cloze';
  const expr = (d.expr || []).filter(e => e && e.zh && e.en).map(e => ({ zh: String(e.zh), en: String(e.en), ...(e.alt ? { alt: String(e.alt) } : {}), n: String(e.n || '') })).slice(0, 20);
  const items = {}; Object.entries(d.items || {}).forEach(([k, v]) => { const n = String(k).replace(/\\D/g, ''); if (n && v && v.en) items[n] = { en: String(v.en), zh: String(v.zh || ''), ...(v.o && typeof v.o === 'object' ? { o: Object.fromEntries(Object.entries(v.o).filter(([, x]) => x && x.en).map(([l, x]) => [String(l).trim().toUpperCase().slice(0, 1), { en: String(x.en), zh: String(x.zh || '') }])) } : {}) }; });
  if (type === 'match') {
    paragraphs.forEach((p, i) => { if (!p.label) p.label = String.fromCharCode(65 + i); });
    Object.keys(options).forEach(k => delete options[k]);
    paragraphs.forEach(p => { const w = p.sentences[0].en.split(/\\s+/); options[p.label] = { w: p.label, pos: '段落', zh: p.sentences[0].zh.slice(0, 18), en: w.slice(0, 7).join(' ') }; });
  }
  if (type === 'mcq') { Object.keys(options).forEach(k => delete options[k]); ['A', 'B', 'C', 'D'].forEach(l => { options[l] = { w: l, pos: '选项', zh: '', en: '' }; }); }
  return { type, ...(type === 'match' || type === 'mcq' ? { items } : {}), ...(type === 'trans' ? { expr } : {}), title: String(d.title || '未命名文章'),"""),
]:
    assert importSec.count(a_) == 1, a_[:60]
    importSec = importSec.replace(a_, b_)
out = '\n'.join([head, partA, B, E, importSec, '', C, drag, '', D, '})();', '</script>', ''])
open('close-reader.html', 'w', encoding='utf-8').write(out)
# index.html: the same page as a normal web document, with the local runtime
# (IndexedDB storage, downloads, optional Claude endpoint) standing in for claude.ai.
web = ('<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<script src="runtime/config.js"></script>\n'
       '<script src="runtime/local-runtime.js"></script>\n'
       '<script src="runtime/ai-panel.js"></script>\n</head>\n<body>\n' + out + '</body>\n</html>\n')
# The standalone site talks to whatever model api/sample.js is configured for (DeepSeek by default),
# not to Claude, so its UI text says "AI". The claude.ai build (close-reader.html) keeps "Claude".
for a_, b_ in [
    ('<p class="imp-alt">也可以直接在对话里把试卷照片发给 Claude，说“按精读日报的格式加进去”，整理好后会出现在往期里。</p>', ''),
    ('也可以直接在对话里把照片发给 Claude，让它整理好放进往期。', ''),
]:
    assert web.count(a_) == 1, a_[:40]
    web = web.replace(a_, b_)
web = web.replace('Claude', 'AI')
# Storage lives in this browser (IndexedDB), not in a claude.ai account.
for a_, b_ in [
    ('文章、作答进度和单词本保存在你的 claude.ai 账号里，换设备打开也在。',
     '文章、作答进度和单词本保存在这台设备的浏览器里。换浏览器或清除网站数据之前，记得在「单词本 → 备份」里导出。'),
    ('文章库存在 claude.ai 里。请在 claude.ai 或 AI App 中登录后打开这个页面。',
     '浏览器没能打开本地存档，可能是开了隐私模式或禁用了网站数据。换成普通窗口再试一次。'),
]:
    assert web.count(a_) == 1, a_[:40]
    web = web.replace(a_, b_)
# Google Fonts is often slow or unreachable in mainland China; a render-blocking <link> there can
# hold first paint for many seconds. Load it without blocking: system serif fonts show first,
# web fonts swap in if they arrive.
web, nfont = re.subn(r'<link href="(https://fonts\.googleapis\.com/css2\?[^"]+)" rel="stylesheet">',
                     r'''<link rel="stylesheet" href="\1" media="print" onload="this.media='all'">''', web)
assert nfont == 1, 'font link not found'
open('index.html', 'w', encoding='utf-8').write(web)
m = re.search(r'<script>(.*)</script>', out, re.S)
os.makedirs('build', exist_ok=True); open('build/check.js', 'w', encoding='utf-8').write(m.group(1))
if shutil.which('node'):
    r = subprocess.run(['node', '--check', 'build/check.js'], capture_output=True, text=True)
    if r.returncode: raise SystemExit('syntax error in built script:\n' + r.stderr)
    print('node --check: ok')
print('ok', len(out))
