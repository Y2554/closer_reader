"""End-to-end check of the 往期报亭 (newsstand archive): day groups, stamps, delete confirm, open, light/dark/phone."""
import asyncio, os
from harness import Server, STUB, SHOTS
from playwright.async_api import async_playwright
OUT = SHOTS; URL = None
async def run(b, w, h, tag, dark=False):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, color_scheme='dark' if dark else 'light', has_touch=w < 500, is_mobile=w < 500)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'TUNNEL' not in m.text and '404' not in m.text else None)
    await pg.add_init_script(path=STUB)
    await pg.goto(URL + '?stand'); await pg.wait_for_timeout(1800)
    ev = pg.evaluate; log = lambda *a: print(f'[{tag}]', *a)
    log('tab:', await ev("document.querySelector('.tab[data-v=read]').textContent"))
    await pg.evaluate("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(250)
    await pg.screenshot(path=f'{OUT}/stand-{tag}-0-mid.png')
    await pg.wait_for_timeout(2600)
    log('days:', await ev("[...document.querySelectorAll('.day')].map(d=>d.textContent.replace(/\\s+/g,' ').trim())"))
    log('papers:', await ev("document.querySelectorAll('.np').length"), '| stamps:', await ev("[...document.querySelectorAll('.np-stamp')].map(s=>s.textContent)"), '| ribbon:', await ev("document.querySelectorAll('.np-rib').length"))
    log('overflow:', await ev("document.documentElement.scrollWidth - innerWidth"))
    await pg.screenshot(path=f'{OUT}/stand-{tag}-1.png', full_page=True)
    if w > 500:
        await pg.hover('.hang:nth-child(2) .np'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/stand-{tag}-2-hover.png')
    # delete confirm
    await pg.evaluate("document.querySelector('.hm-del[data-id=d3]').click()"); await pg.wait_for_timeout(200)
    log('confirm:', await ev("document.querySelector('.hm-del[data-id=d3]').textContent"), '| swing after rerender:', await ev("!!document.querySelector('.stand.swing')"))
    await pg.evaluate("document.querySelector('.np[data-id=g2]').click()"); await pg.wait_for_timeout(700)
    log('opened:', await ev("document.querySelector('.headline')?.textContent"), '| view:', await ev("document.querySelector('.tab.on, .tab[aria-current]')?.textContent"))
    log('errors:', errs)
    await ctx.close()
async def main():
    global URL
    os.makedirs(OUT, exist_ok=True)
    srv = Server(8771); URL = srv.url
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            await run(b, 1280, 900, 'd')
            await run(b, 390, 844, 'm')
            await run(b, 1280, 900, 'dk', dark=True)
            await b.close()
    finally:
        srv.close()
asyncio.run(main())
