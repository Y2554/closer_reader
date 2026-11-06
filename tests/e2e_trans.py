"""翻译（trans）+ 第二篇仔细阅读：写译文 / 自动保存 / 对照参考译文 / 表达卡 / 收进单词本 / Claude 批改（替身）/ 往期标签。"""
import asyncio, os
from playwright.async_api import async_playwright
from harness import Server, STUB, SHOTS

async def run(b, url, mobile):
    tag = 'm' if mobile else 'd'
    ctx = await b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 860}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'TUNNEL' not in m.text else None)
    await pg.add_init_script(path=STUB)
    await pg.goto(url + '?sample'); await pg.wait_for_timeout(1800)
    ev = pg.evaluate; log = lambda *a: print(f'[{tag}]', *a)
    shot = lambda n: pg.screenshot(path=os.path.join(SHOTS, f'trans-{tag}-{n}.png'), full_page=n.endswith('full'))
    await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(1600)
    log('papers:', await ev("[...document.querySelectorAll('.np')].map(n=>n.dataset.id+':'+n.querySelector('.np-kick').textContent)"))
    # passage two quick check
    await ev("document.querySelector('.np[data-id=\"reading-wars\"]').click()"); await pg.wait_for_timeout(900)
    for n, L in [('51','A'),('52','B'),('53','B'),('54','C'),('55','D')]:
        await ev(f"document.querySelector('.mo[data-n=\"{n}\"][data-l=\"{L}\"]').click()"); await pg.wait_for_timeout(120)
    await ev("document.querySelector('.exb-sub').click()"); await pg.wait_for_timeout(1500)
    log('reading-wars result:', await ev("document.querySelector('.res-score')?.textContent"))
    # translation
    await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(1500)
    log('trans footer:', await ev("document.querySelector('.np[data-id=\"cn-culture\"] .np-fm')?.textContent"))
    await ev("document.querySelector('.np[data-id=\"cn-culture\"]').click()"); await pg.wait_for_timeout(900)
    log('byline:', await ev("document.querySelector('.byline').textContent"), '| ref hidden:', await ev("!document.querySelector('.tr-ref')"), '| grade btn:', await ev("!!document.querySelector('[data-act=trgrade]')"))
    await shot('1-blank')
    await pg.fill('#trIn', 'In recent years, more and more Chinese culture products is popular with overseas consumers and have entered the global market. With the fast development of foreign cultural trade, the export value has been among the top of the world for many years.')
    await pg.wait_for_timeout(1200)
    log('wc:', await ev("document.querySelector('#trWc').textContent"), '| saved draft words:', await ev("(window.__store['progress/cn-culture']?.draft||'').split(/\\s+/).length"))
    await ev("document.querySelector('[data-act=trgrade]').click()"); await pg.wait_for_timeout(200)
    log('busy:', await ev("document.querySelector('[data-act=trgrade]').textContent"))
    await pg.wait_for_timeout(1200)
    log('review score:', await ev("document.querySelector('.tr-score b')?.textContent"), '| fixes:', await ev("document.querySelectorAll('.tr-fix li').length"), '| ref shown:', await ev("!!document.querySelector('.tr-ref')"), '| pairs:', await ev("document.querySelectorAll('.tr-pair').length"))
    log('prompt has draft:', await ev("(window.__prompts||[]).some(p=>p.includes('more and more Chinese culture products'))"))
    await shot('2-review')
    # expression card
    await ev("document.querySelector('.tr-src .tr-k').click()"); await pg.wait_for_timeout(400)
    log('expr card:', await ev("document.querySelector('#panel .tr-ezh')?.textContent"), '->', await ev("document.querySelector('#panel .tr-een')?.textContent"))
    await ev("document.querySelector('#panel [data-act=trkeep]').click()"); await pg.wait_for_timeout(300)
    log('kept:', await ev("Object.keys(window.__store).filter(k=>k.startsWith('words/in_recent')||k.startsWith('words/in recent')).length || Object.values(window.__store).filter(v=>v&&v.w==='in recent years').length"))
    await shot('3-expr')
    if not mobile:
        await ev("document.querySelector('#panel [data-act=close]')?.click()"); await pg.wait_for_timeout(300)
    else:
        await pg.keyboard.press('Escape'); await ev("document.querySelector('#panel [data-act=close]')?.click()"); await pg.wait_for_timeout(300)
    # word popover in reference
    await ev("document.querySelector('.tr-ref').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300)
    await pg.click('.tr-ref .w >> nth=6'); await pg.wait_for_timeout(1000)
    log('popover word:', await ev("document.querySelector('.pop-w')?.textContent"), '| ctx:', await ev("document.querySelector('.pop-ctxzh')?.textContent"))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    await shot('4-ref')
    # archive stamp
    await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(1700)
    log('trans stamp:', await ev("document.querySelector('.np[data-id=\"cn-culture\"] .np-stamp')?.textContent"), '| footer:', await ev("document.querySelector('.np[data-id=\"cn-culture\"] .np-fm')?.textContent"))
    log('overflow-x:', await ev("document.documentElement.scrollWidth > innerWidth"))
    log('ERRORS:', errs)
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = Server(8779)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for m in (False, True): await run(b, srv.url, m)
            await b.close()
    finally:
        srv.close()
asyncio.run(main())
