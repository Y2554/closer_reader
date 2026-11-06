"""词典：双击空白召唤（翻书动效）、词典栏目、查词 / 词组 / 汉英 / 拼写纠错、翻页、熟悉度、关闭；考试中禁用。"""
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
    await pg.goto(url); await pg.wait_for_timeout(1800)
    ev = pg.evaluate; log = lambda *a: print(f'[{tag}]', *a)
    shot = lambda n: pg.screenshot(path=os.path.join(SHOTS, f'dict-{tag}-{n}.png'))
    # make sure we're on the cloze article in study mode (not exam) so summoning is allowed
    await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(600)
    await ev("document.querySelector('[data-act=open][data-id=\"dog-cognition\"]').click()"); await pg.wait_for_timeout(900)
    exam = await ev("!!document.querySelector('.mseg button[data-m=\"exam\"][aria-pressed=\"true\"]')")
    if exam:
        # summoning during an exam must be refused
        x, y = (6, 500) if mobile else (40, 600)
        if mobile:
            await pg.touchscreen.tap(x, y); await pg.wait_for_timeout(120); await pg.touchscreen.tap(x, y)
        else:
            await pg.mouse.dblclick(x, y)
        await pg.wait_for_timeout(300)
        log('exam blocks summon:', await ev("document.querySelector('#dkov').hidden"), await ev("document.querySelector('#toast').textContent"))
        for _ in range(2):
            await ev("document.querySelector('.mseg button[data-m=\"study\"]')?.click()"); await pg.wait_for_timeout(300)
    # double-click on blank margin
    x, y = (8, 520) if mobile else (40, 600)
    log('blank point?', await ev(f"(() => {{ const el = document.elementFromPoint({x},{y}); return el && el.className }})()"))
    if mobile:
        await pg.touchscreen.tap(x, y); await pg.wait_for_timeout(120); await pg.touchscreen.tap(x, y)
    else:
        await pg.mouse.dblclick(x, y)
    await pg.wait_for_timeout(330); await shot('1-flying')
    await pg.wait_for_timeout(330); await shot('2-cover')
    log('overlay open:', await ev("!document.querySelector('#dkov').hidden"), '| opening:', await ev("document.querySelector('#dkov .dbook')?.className"))
    await pg.wait_for_timeout(900); await shot('3-open')
    log('title page:', (await ev("document.querySelector('#dkEntry')?.innerText || ''"))[:60].replace('\n', ' '))
    # search: prefix
    await pg.fill('#dkq', 'aband'); await pg.wait_for_timeout(1200)
    log('suggest aband:', await ev("[...document.querySelectorAll('#dkList .dk-it b')].map(b=>b.textContent).slice(0,6)"))
    await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
    log('entry:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"), '| secs:', await ev("[...document.querySelectorAll('#dkEntry .p-sec')].map(h=>h.textContent.trim()).join(' / ')"))
    await shot('4-entry')
    # synonym → page turn
    has_syn = await ev("!!document.querySelector('#dkEntry [data-act=dkgo]')")
    if has_syn:
        await ev("document.querySelector('#dkEntry .rel [data-act=dkgo], #dkEntry .dk-ex [data-act=dkgo]').click()"); await pg.wait_for_timeout(300)
        log('leaf turning:', await ev("!!document.querySelector('.dk-leaf.fwd')"))
        await shot('5-turn')
        await pg.wait_for_timeout(1200)
        log('now:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"), '| back btn:', await ev("document.querySelector('.dk-back')?.textContent"))
        await ev("document.querySelector('.dk-back').click()"); await pg.wait_for_timeout(250)
        log('back leaf:', await ev("!!document.querySelector('.dk-leaf.bwd')")); await pg.wait_for_timeout(900)
        log('back to:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"))
    # phrase from the extended lexicon
    await pg.fill('#dkq', 'give up'); await pg.wait_for_timeout(1500)
    log('suggest give up:', await ev("[...document.querySelectorAll('#dkList .dk-it b')].map(b=>b.textContent).slice(0,5)"))
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
    log('phrase entry:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"), (await ev("document.querySelector('#dkEntry .dl .zh')?.textContent || ''"))[:30])
    # new word
    await pg.fill('#dkq', 'blockchain'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
    log('new word:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"), await ev("document.querySelector('#dkEntry .dk-hd .tag')?.textContent"))
    # chinese → english
    await pg.fill('#dkq', '放弃'); await pg.wait_for_timeout(1500)
    log('zh 放弃:', await ev("[...document.querySelectorAll('#dkList .dk-it b')].map(b=>b.textContent).slice(0,6)"))
    await shot('6-zh')
    # typo
    await pg.fill('#dkq', 'recieve'); await pg.wait_for_timeout(1200)
    log('typo recieve:', await ev("document.querySelector('#dkList .dk-lh')?.textContent"), await ev("[...document.querySelectorAll('#dkList .dk-it b')].map(b=>b.textContent).slice(0,4)"))
    await pg.fill('#dkq', 'surpass'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
    log('cites:', await ev("document.querySelectorAll('#dkEntry .dk-cites li').length"))
    # status
    await ev("document.querySelector('#dkEntry [data-act=dkst][data-s=learning]').click()"); await pg.wait_for_timeout(300)
    log('saved word:', await ev("JSON.stringify(Object.entries(window.__store).filter(([k])=>k==='words/surpass').map(([k,v])=>v.status))"))
    await shot('7-surpass')
    # close
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await shot('8-closing')
    await pg.wait_for_timeout(700)
    log('closed:', await ev("document.querySelector('#dkov').hidden"))
    # double-click on a word must NOT summon
    if not mobile:
        await ev("document.querySelector('#body .w').scrollIntoView({block:'center'})")
        bb = await (await pg.query_selector('#body .w')).bounding_box()
        await pg.mouse.dblclick(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); await pg.wait_for_timeout(300)
        log('dblclick on word summons?', not await ev("document.querySelector('#dkov').hidden"))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        # "/" shortcut
        await pg.keyboard.press('/'); await pg.wait_for_timeout(1300)
        log('slash opens:', not await ev("document.querySelector('#dkov').hidden"))
        await pg.mouse.click(5, 5); await pg.wait_for_timeout(900)
        log('backdrop click closes:', await ev("document.querySelector('#dkov').hidden"))
    # popover → dictionary
    await ev("window.scrollTo(0,0)"); await pg.wait_for_timeout(200)
    await ev("document.querySelector('#body .s[data-p=\"0\"][data-s=\"0\"]').scrollIntoView({block:'center'})")
    await pg.click('#body .s[data-p="0"][data-s="0"] .w[data-i="2"]'); await pg.wait_for_timeout(1200)
    await ev("document.querySelector('.pop-dk').click()"); await pg.wait_for_timeout(1700)
    log('from popover:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(900)
    # 词典 tab
    await ev("document.querySelector('.tab[data-v=dict]').scrollIntoView(); document.querySelector('.tab[data-v=dict]').click()"); await pg.wait_for_timeout(500)
    await shot('9-tab-opening')
    await pg.wait_for_timeout(1200)
    log('tab book:', await ev("!!document.querySelector('#view .dbook.page')"), '| tab current:', await ev("document.querySelector('.tab[aria-current]')?.textContent"))
    await pg.fill('#dkq', 'ubiquitous'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1600)
    log('tab entry:', await ev("document.querySelector('#dkEntry .dk-hw')?.textContent"))
    await shot('10-tab')
    log('overflow-x:', await ev("document.documentElement.scrollWidth > innerWidth"))
    log('ERRORS:', errs)
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = Server(8775)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for m in (False, True): await run(b, srv.url, m)
            await b.close()
    finally:
        srv.close()
asyncio.run(main())
