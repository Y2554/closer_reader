"""End-to-end check of 段落匹配 (exam, scoring, study card, mistakes, editor) on desktop and phone widths."""
import asyncio, os
from harness import Server, STUB, SHOTS
from playwright.async_api import async_playwright
OUT = SHOTS; URL = None
async def run(b, mobile):
    tag = 'm' if mobile else 'd'
    ctx = await b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 860}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'TUNNEL' not in m.text and '404' not in m.text else None)
    await pg.add_init_script(path=STUB)
    await pg.goto(URL); await pg.wait_for_timeout(1800)
    ev = pg.evaluate; log = lambda *a: print(f'[{tag}]', *a)
    click = (lambda s: pg.tap(s)) if mobile else (lambda s: pg.click(s))
    log('default article:', await ev("document.querySelector('.headline').textContent"))
    if 'Gratitude' not in await ev("document.querySelector('.headline').textContent"):
        await click('.tab[data-v="archive"]'); await pg.wait_for_timeout(500)
        await click('[data-act="open"][data-id="gratitude-lifesaving"]'); await pg.wait_for_timeout(800)
    log('labels:', await ev("[...document.querySelectorAll('.plabel')].map(e=>e.textContent).join('')"), '| statements:', await ev("document.querySelectorAll('.mq').length"), '| chips:', await ev("document.querySelectorAll('.pchip').length"), '| byline:', await ev("document.querySelector('.byline span').textContent"))
    log('exam idle:', await ev("!!document.querySelector('#exbar.idle')"), await ev("document.querySelector('.exb-intro span')?.textContent"))
    await pg.screenshot(path=f'{OUT}/{tag}-1-top.png')
    await pg.evaluate("document.querySelector('.mq[data-n=\"36\"]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    await click('.mq[data-n="36"] .blank'); await pg.wait_for_timeout(500)
    log('picker:', await ev("document.querySelector('#panel .p-eyebrow')?.textContent"), '| letters:', await ev("document.querySelectorAll('#panel .lpick').length"))
    await pg.screenshot(path=f'{OUT}/{tag}-2-picker.png')
    answers = {'36': 'D', '37': 'G', '38': 'A', '39': 'I', '40': 'F', '41': 'K', '42': 'F', '43': 'M', '44': 'B'}   # 36 near-miss, 42 wrong(loc), 45 empty
    for n, L in answers.items():
        if not mobile: await pg.keyboard.press(L)
        else: await click(f'#panel .lpick[data-l="{L}"]')
        await pg.wait_for_timeout(150)
    log('exam answers:', await ev("JSON.stringify(window.__store['progress/gratitude-lifesaving']?.exam?.answers)"))
    log('chip counts:', await ev("[...document.querySelectorAll('.pchip i')].map(i=>i.parentElement.querySelector('b').textContent+i.textContent).join(' ')"))
    await pg.evaluate("document.querySelector('.mqs').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300)
    await pg.screenshot(path=f'{OUT}/{tag}-3-filled.png')
    await click('.exb-sub'); await pg.wait_for_timeout(250); await click('.exb-sub'); await pg.wait_for_timeout(1600)
    log('result:', await ev("document.querySelector('.res-score')?.textContent"), await ev("document.querySelector('.stamp')?.textContent"), await ev("document.querySelector('.res-meta')?.textContent"))
    log('mistake types:', await ev("Object.entries(window.__store).filter(([k])=>k.startsWith('mistakes/gratitude')).map(([k,v])=>v.n+':'+v.type)"))
    await pg.screenshot(path=f'{OUT}/{tag}-4-result.png')
    await click('#panel [data-act="blank"][data-n="36"]') if not mobile else await pg.evaluate("document.querySelector('#panel [data-act=\"blank\"][data-n=\"36\"]').click()")
    await pg.wait_for_timeout(500)
    log('study card:', await ev("document.querySelector('#panel .verdict')?.textContent"), '| src:', (await ev("document.querySelector('#panel .srcq')?.textContent"))[:60], '| src highlighted in text:', await ev("!!document.querySelector('#body .s.src')"))
    await pg.screenshot(path=f'{OUT}/{tag}-5-card.png')
    await pg.evaluate("document.querySelector('#panel [data-act=\"gosrc\"]').click()"); await pg.wait_for_timeout(700)
    log('gosrc flash:', await ev("!!document.querySelector('#body .s.flash')"))
    # chip jump in study mode
    await pg.evaluate("document.querySelector('.pchip[data-l=\"K\"]').click()"); await pg.wait_for_timeout(700)
    log('jump K:', await ev("document.querySelector('.para.pflash .plabel')?.textContent"))
    # word lookup works in study
    await pg.evaluate("window.scrollTo(0,0)"); await pg.wait_for_timeout(200)
    await click('#body .s[data-p="0"][data-s="0"] .w[data-i="0"]'); await pg.wait_for_timeout(900)
    log('pop:', await ev("document.querySelector('.pop-w')?.textContent"), '| ctx:', await ev("document.querySelector('.pop-ctxzh')?.textContent"))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # mistakes
    await click('.tab[data-v="mistakes"]'); await pg.wait_for_timeout(1200)
    log('mk bars:', await ev("[...document.querySelectorAll('.mk-bar')].map(b=>b.textContent.replace(/\\s+/g,''))"))
    mid = await ev("[...document.querySelectorAll('.mk')].find(e=>e.id.includes('gratitude'))?.id.slice(3)")
    await pg.evaluate(f"document.getElementById('mk-{mid}').scrollIntoView({{block:'center'}})")
    await pg.evaluate(f"document.querySelector('[id=\"mk-{mid}\"] [data-act=\"mkretry\"]').click()"); await pg.wait_for_timeout(400)
    log('retry letters:', await ev(f"document.querySelectorAll('[id=\"mk-{mid}\"] .lpick').length"))
    await pg.screenshot(path=f'{OUT}/{tag}-6-mk.png')
    ans = await ev(f"window.__store['mistakes/{mid}'].ans")
    await pg.evaluate(f"document.querySelector('[id=\"mk-{mid}\"] .lpick[data-l=\"{ans}\"]').click()"); await pg.wait_for_timeout(500)
    log('retry ok:', await ev(f"window.__store['mistakes/{mid}'].resolved"))
    # editor
    await click('.tab[data-v="read"]'); await pg.wait_for_timeout(600)
    await click('.toolbar [data-act="edopen"]'); await pg.wait_for_timeout(600)
    log('editor match: options hidden', await ev("!document.querySelector('.ed-opts')"), '| statement fields:', await ev("document.querySelectorAll('[data-ed^=\"i.\"]').length"), '| select:', await ev("document.querySelector('[data-ed=\"b.36.ans\"] option')?.textContent"))
    await click('.ed-bar [data-act="edcancel"]'); await pg.wait_for_timeout(500)
    # cloze article unaffected
    await click('.tab[data-v="archive"]'); await pg.wait_for_timeout(500)
    await click('[data-act="open"][data-id="dog-cognition"]'); await pg.wait_for_timeout(700)
    log('cloze ok:', await ev("document.querySelectorAll('#body .blank').length"), await ev("!!document.querySelector('.bank')"), await ev("!document.querySelector('.mqs')"))
    log('overflow-x:', await ev("document.documentElement.scrollWidth > innerWidth"))
    log('ERRORS:', errs)
    await ctx.close()
async def main():
    global URL
    os.makedirs(OUT, exist_ok=True)
    srv = Server(8770); URL = srv.url
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for m in (False, True): await run(b, m)
            await b.close()
    finally:
        srv.close()
asyncio.run(main())
