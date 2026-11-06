"""Standalone deployment check: index.html + runtime/local-runtime.js (no claude.ai).
Seeds on first run, answers persist across reloads (IndexedDB), export downloads a file."""
import asyncio, functools, http.server, os, threading
from playwright.async_api import async_playwright
from harness import ROOT

async def main():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8774), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:8774/index.html'
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1280, 'height': 860}, accept_downloads=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.goto(url); await pg.wait_for_timeout(2000); ev = pg.evaluate
            print('local runtime:', await ev("!!(window.claude && window.claude.local)"))
            print('archive count:', await ev("document.querySelector('#ctArch')?.textContent"))
            print('headline:', await ev("document.querySelector('.headline')?.textContent"))
            # open the cloze article, switch to study mode, answer blank 26
            await ev("document.querySelector('.tab[data-v=archive]').click()"); await pg.wait_for_timeout(1500)
            await ev("document.querySelector('.np[data-id=\"dog-cognition\"]').click()"); await pg.wait_for_timeout(900)
            for _ in range(2):
                if await ev("!!document.querySelector('.mseg button[data-m=\"study\"][aria-pressed=\"false\"]')"):
                    await ev("document.querySelector('.mseg button[data-m=\"study\"]').click()"); await pg.wait_for_timeout(300)
            await ev("document.querySelector('#body .blank[data-n=\"26\"]').click()"); await pg.wait_for_timeout(400)
            await ev("document.querySelector('#panel [data-act=\"pick\"][data-l=\"N\"]').click()"); await pg.wait_for_timeout(600)
            print('answered 26:', await ev("document.querySelector('#body .blank[data-n=\"26\"]').className"))
            # collect a word
            await pg.click('#body .s[data-p="0"][data-s="0"] .w[data-i="2"]'); await pg.wait_for_timeout(1200)
            await ev("document.querySelector('.pa-save')?.click()"); await pg.wait_for_timeout(500)
            await pg.reload(); await pg.wait_for_timeout(2000)
            print('after reload headline:', await ev("document.querySelector('.headline')?.textContent"))
            print('26 still answered:', await ev("document.querySelector('#body .blank[data-n=\"26\"]')?.className"))
            print('vocab count:', await ev("document.querySelector('#ctVocab')?.textContent"))
            # export JSON
            await ev("document.querySelector('.tab[data-v=vocab]').click()"); await pg.wait_for_timeout(600)
            await ev("document.querySelector('[data-act=\"vtab\"][data-v=\"backup\"]').click()"); await pg.wait_for_timeout(400)
            async with pg.expect_download() as dl:
                await ev("document.querySelector('[data-act=\"exjson\"]').click()")
            d = await dl.value; print('download:', d.suggested_filename)
            print('import without endpoint:', await ev("document.querySelector('.tab[data-v=import]').click(), new Promise(r=>setTimeout(()=>r(document.querySelector('#view').innerText.slice(0,80).replace(/\\s+/g,' ')),400))"))
            print('errors:', errs)
            await b.close()
    finally:
        srv.shutdown()
asyncio.run(main())
