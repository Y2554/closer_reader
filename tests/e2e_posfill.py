"""补标词性: an article whose word tagging never finished gets its tags in one click.

  python3 tests/e2e_posfill.py

Uses the fake model / fake Redis / dev server from e2e_ai.py. The fake model tags every word it is
asked about. The test article is a 仔细阅读 passage (~490 words) saved with an empty lex, as happened
to real imports before the token caps were raised.
"""
import asyncio, json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e_ai as T
from playwright.async_api import async_playwright

def article():
    # ~360 different made-up words over 6 paragraphs, so the tagging has to go out in more than one batch
    import itertools
    pool = [''.join(t) for t in itertools.product('bdgklmnprst', 'aeiou', 'bdgklmnprst', 'aeiou')][:360]
    paras = []
    for p in range(6):
        ws = pool[p * 60:(p + 1) * 60]
        sents = [{'en': ' '.join(ws[k * 15:(k + 1) * 15]).capitalize() + ' in 2021.', 'zh': '测试'} for k in range(4)]
        paras.append({'sentences': sents})
    return {'id': 'posfill-test', 'title': 'The Return of Platform Shoes in Athletics', 'zh': '厚底鞋', 'source': 'CET-6 · 仔细阅读',
            'paragraphs': paras, 'options': {}, 'blanks': {}, 'keys': [], 'tips': [], 'lex': {}, 'createdAt': 1}

class Model(T.Model):
    def do_POST(self):
        n = int(self.headers['Content-Length']); body = json.loads(self.rfile.read(n))
        text = body['messages'][0]['content']
        T.SEEN.append({'kind': 'lex' if '全部单词' in text else 'other', 'len': len(text), 'stream': bool(body.get('stream'))})
        ws = [w.strip() for w in text.split('单词列表：', 1)[-1].split(',') if w.strip()]
        out = json.dumps({w: ['n.', '测试义', 'a test gloss'] for w in ws}, ensure_ascii=False)
        __import__('time').sleep(1.2)
        res = json.dumps({'choices': [{'message': {'role': 'assistant', 'content': out}}]}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(res)

async def main():
    T.serve(Model, 8794); T.serve(T.Redis, 8795); dev = T.dev_server(8796)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1280, 'height': 900})).new_page()
            await pg.route('**/fonts.g*/**', lambda r: r.abort())
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script("localStorage.setItem('cr.welcomed','true'); localStorage.setItem('cr.showPos','true')")
            await pg.goto('http://127.0.0.1:8796/index.html'); await pg.wait_for_timeout(1200); ev = pg.evaluate
            await ev("(async a => { const db = await window.claude.use('db'); await db.doc('articles/' + a.id).set(a); await db.doc('progress/' + a.id).set({ lastOpened: Date.now(), mode: 'study' }); })(%s)" % json.dumps(article()))
            await pg.reload(); await pg.wait_for_timeout(1500)
            await ev("document.querySelector('.tab[data-v=archive]')?.click()"); await pg.wait_for_timeout(500)
            await ev("[...document.querySelectorAll('[data-act=open],[data-id]')].find(x => x.dataset.id === 'posfill-test')?.click()"); await pg.wait_for_timeout(900)
            if await ev("!!document.querySelector('[data-act=mode][data-m=study]:not([aria-pressed=true])')"):
                await ev("document.querySelector('[data-act=mode][data-m=study]').click()"); await pg.wait_for_timeout(500)
            T.check('the untagged article is open', 'Platform Shoes' in await ev("document.querySelector('#view').innerText"))
            T.check('untagged words show no placeholder dot', await ev("[...document.querySelectorAll('#body .w')].filter(w => w.dataset.pos === '·').length") == 0)
            banner = await ev("document.querySelector('.pos-fill')?.innerText || ''")
            print('      banner:', banner.replace('\n', ' '))
            T.check('词性标注 on + no tags → banner offers 补标', '没标词性' in banner and '现在补标' in banner)
            n0 = len(T.SEEN)
            await ev("document.querySelector('[data-act=posfill]').click()"); await pg.wait_for_timeout(150)
            busy = await ev("document.querySelector('.pos-fill.busy')?.innerText || ''")
            T.check('banner shows progress while tagging', '正在补标' in busy)
            await pg.wait_for_function("!document.querySelector('.pos-fill.busy')", timeout=30000); await pg.wait_for_timeout(400)
            calls = T.SEEN[n0:]
            print('      calls:', calls)
            T.check('tagging went out in several short batches (each under the 8,000-char limit)', len(calls) >= 2 and all(c['kind'] == 'lex' and c['len'] < 8000 for c in calls))
            tagged = await ev("[...document.querySelectorAll('#body .w')].filter(w => w.dataset.pos).length")
            total = await ev("document.querySelectorAll('#body .w').length")
            T.check(f'words now show their part of speech ({tagged}/{total})', total and tagged >= total * 0.95)
            T.check('success note replaces the offer', '已补标' in await ev("document.querySelector('.pos-fill')?.innerText || ''"))
            await pg.reload(); await pg.wait_for_timeout(1500)
            kept = await ev("(async () => { const db = await window.claude.use('db'); const d = await db.doc('articles/posfill-test').get(); return Object.keys(d.data().lex || {}).length; })()")
            T.check('tags are saved with the article', kept > 20)
            T.check('no page errors', not errs)
            if errs: print(errs)
        print(f'\n{sum(T.OK)}/{len(T.OK)} passed'); sys.exit(0 if all(T.OK) else 1)
    finally: dev.kill()

if __name__ == '__main__': asyncio.run(main())
