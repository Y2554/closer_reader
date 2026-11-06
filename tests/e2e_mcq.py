"""仔细阅读（mcq）：考试作答 / 键盘 / 交卷 / 逐项解析 / 原文定位 / 错题分类与重做 / 编辑器 / 往期标签。"""
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
    shot = lambda n: pg.screenshot(path=os.path.join(SHOTS, f'mcq-{tag}-{n}.png'))
    await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(1500)
    log('paper kicker:', await ev("document.querySelector('.np[data-id=\"ai-judgment\"] .np-kick')?.textContent"))
    await ev("document.querySelector('.np[data-id=\"ai-judgment\"]').click()"); await pg.wait_for_timeout(900)
    log('byline:', await ev("document.querySelector('.byline span').textContent"), '| questions:', await ev("document.querySelectorAll('.mq.mcq').length"), '| options:', await ev("document.querySelectorAll('.mo').length"))
    log('exam bar:', await ev("document.querySelector('.exb-intro span')?.textContent"))
    await shot('1-exam')
    # answer in exam by clicking options: 46 D, 47 A, 48 C(wrong), 49 A(wrong), 50 left empty then keyboard
    for n, L in [('46', 'D'), ('47', 'A'), ('48', 'C'), ('49', 'A')]:
        await ev(f"document.querySelector('.mo[data-n=\"{n}\"][data-l=\"{L}\"]').click()"); await pg.wait_for_timeout(200)
    log('answers:', await ev("JSON.stringify(window.__store['progress/ai-judgment']?.exam?.answers)"))
    # toggle off & on
    await ev("document.querySelector('.mo[data-n=\"49\"][data-l=\"A\"]').click()"); await pg.wait_for_timeout(150)
    log('49 cleared:', await ev("!window.__store['progress/ai-judgment'].exam.answers['49']"))
    await ev("document.querySelector('.mo[data-n=\"49\"][data-l=\"A\"]').click()"); await pg.wait_for_timeout(150)
    if not mobile:
        await ev("document.querySelector('.mq[data-n=\"50\"] .blank').click()"); await pg.wait_for_timeout(300)
        log('epick:', await ev("document.querySelectorAll('#panel .mpick').length"))
        await pg.keyboard.press('B'); await pg.wait_for_timeout(300)
        log('key B ->', await ev("window.__store['progress/ai-judgment'].exam.answers['50']"))
        await ev("document.querySelector('.mo[data-n=\"50\"][data-l=\"B\"]').click()"); await pg.wait_for_timeout(150)  # un-answer 50 again
    await ev("document.querySelector('.mqs').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
    await shot('2-answered')
    await ev("document.querySelector('.exb-sub').click()"); await pg.wait_for_timeout(250); await ev("document.querySelector('.exb-sub').click()"); await pg.wait_for_timeout(1500)
    log('result:', await ev("document.querySelector('.res-score')?.textContent"), await ev("document.querySelector('.res-meta')?.textContent"))
    log('mistakes:', await ev("Object.entries(window.__store).filter(([k])=>k.startsWith('mistakes/ai-judgment')).map(([k,v])=>v.n+':'+v.type).sort()"))
    await shot('3-result')
    # study card for 48
    await ev("document.querySelector('#panel [data-act=blank][data-n=\"48\"]')?.click()"); await pg.wait_for_timeout(600)
    log('card:', await ev("document.querySelector('#panel .verdict')?.textContent"), '| ox rows:', await ev("document.querySelectorAll('#panel .oxl li').length"), '| tags:', await ev("[...document.querySelectorAll('#panel .ox-tag')].map(t=>t.textContent).join(',')"))
    log('src highlighted:', await ev("!!document.querySelector('#body .s.src')"), '| options marked:', await ev("[...document.querySelectorAll('.mo[data-n=\"48\"]')].map(o=>o.className.replace('mo','').trim()||'-').join(',')"))
    await shot('4-card')
    # mistakes view & retry
    await ev("document.querySelector('.tab[data-v=mistakes]').click()"); await pg.wait_for_timeout(1200)
    log('mk bars:', await ev("[...document.querySelectorAll('.mk-bar')].map(b=>b.textContent.replace(/\\s+/g,''))"))
    mid = 'ai-judgment~48'
    await ev(f"document.querySelector('[id=\"mk-{mid}\"] [data-act=mkretry]').click()"); await pg.wait_for_timeout(300)
    log('retry options:', await ev(f"document.querySelectorAll('[id=\"mk-{mid}\"] .mpick').length"))
    await ev(f"document.querySelector('[id=\"mk-{mid}\"] .mpick[data-l=\"A\"]').click()"); await pg.wait_for_timeout(400)
    log('retry ok:', await ev(f"window.__store['mistakes/{mid}'].resolved"))
    await shot('5-mistakes')
    # editor
    await ev("document.querySelector('.tab[data-v=read]').click()"); await pg.wait_for_timeout(600)
    await ev("document.querySelector('.toolbar [data-act=edopen]').click()"); await pg.wait_for_timeout(600)
    log('editor: option fields', await ev("document.querySelectorAll('[data-ed^=\"q.\"]').length"), '| ox fields', await ev("document.querySelectorAll('[data-ed^=\"x.\"]').length"), '| select', await ev("document.querySelector('[data-ed=\"b.46.ans\"] option')?.textContent"))
    await ev("document.querySelector('.ed-bar [data-act=edcancel]').click()"); await pg.wait_for_timeout(500)
    log('overflow-x:', await ev("document.documentElement.scrollWidth > innerWidth"))
    log('ERRORS:', errs)
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = Server(8778)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for m in (False, True): await run(b, srv.url, m)
            await b.close()
    finally:
        srv.close()
asyncio.run(main())
