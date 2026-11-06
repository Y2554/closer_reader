"""Regenerate the README screenshots in docs/img (needs Playwright + Chromium)."""
import asyncio, os
from playwright.async_api import async_playwright
from harness import Server, STUB, ROOT
OUT = os.path.join(ROOT, 'docs', 'img')

async def shot(pg, name, clip_h=None):
    await pg.wait_for_timeout(350)
    kw = {'path': os.path.join(OUT, name)}
    if clip_h: kw['clip'] = {'x': 0, 'y': 0, 'width': pg.viewport_size['width'], 'height': clip_h}
    await pg.screenshot(**kw)

async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = Server(8773)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            # desktop
            ctx = await b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=2)
            pg = await ctx.new_page(); await pg.add_init_script(path=STUB)
            await pg.goto(srv.url + '?stand'); await pg.wait_for_timeout(1800)
            ev = pg.evaluate
            await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(2800)
            await ev("window.scrollTo(0, 330)"); await shot(pg, 'newsstand.png')
            await ev("document.querySelector('.np[data-id=\"dog-cognition\"]').click()"); await pg.wait_for_timeout(900)
            if await ev("!!document.querySelector('.mseg button[data-m=\"study\"]')"):
                await ev("document.querySelector('.mseg button[data-m=\"study\"]').click()"); await pg.wait_for_timeout(300)
                if await ev("!!document.querySelector('.mseg button[data-m=\"study\"]')"): await ev("document.querySelector('.mseg button[data-m=\"study\"]').click()")
            await pg.wait_for_timeout(500)
            await ev("window.scrollTo(0, 300)"); await shot(pg, 'reading.png')
            await ev("document.querySelector('#body .blank[data-n=\"26\"]').scrollIntoView({block:'center'})")
            await ev("document.querySelector('#body .blank[data-n=\"26\"]').click()"); await pg.wait_for_timeout(500)
            await shot(pg, 'blank-card.png')
            await ev("document.querySelector('#body .s[data-p=\"0\"][data-s=\"0\"]').scrollIntoView({block:'center'})")
            await pg.click('#body .s[data-p="0"][data-s="0"] .w[data-i="2"]'); await pg.wait_for_timeout(1400)
            await shot(pg, 'word-card.png')
            await pg.keyboard.press('Escape')
            await ev("document.querySelector('.tab[data-v=vocab]').click()"); await pg.wait_for_timeout(1200)
            await ev("window.scrollTo(0, 300)"); await shot(pg, 'vocab.png')
            await ctx.close()
            # phone
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); await pg.add_init_script(path=STUB)
            await pg.goto(srv.url); await pg.wait_for_timeout(1800)
            await pg.evaluate("window.scrollTo(0, 240)"); await shot(pg, 'phone.png')
            await ctx.close(); await b.close()
    finally:
        srv.close()
    print('wrote', sorted(os.listdir(OUT)))
asyncio.run(main())
