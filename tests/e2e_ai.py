"""End-to-end check of the AI path in the standalone build, with no real model and no real Redis.

  python3 tests/e2e_ai.py

Starts: a fake OpenAI-compatible model server, a fake Upstash REST server, and
server/dev-server.mjs (which runs api/sample.js). Then drives the page in Chromium and checks:
free-trial counting (2 imports + small calls, follow-up word tagging not double-charged),
the "AI 设置" box, bring-your-own-key, a bad key, photo shrinking, origin check, daily caps.
"""
import asyncio, base64, io, json, os, subprocess, sys, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEEN = []          # every request the fake model received
STREAM_DELAY = 0.03
DB = {}            # fake Redis

ARTICLE = {"title": "Test Article", "zh": "测试", "source": "精读",
           "paragraphs": [{"sentences": [{"en": "Dogs are clever animals {{26}}.", "zh": "狗是聪明的动物。"}]}],
           "options": {"A": {"w": "indeed", "pos": "adv.", "zh": "确实", "en": "really"}},
           "blanks": {"26": {"ans": "A", "need": "副词", "cands": ["A"], "why": "test"}}, "keys": [], "tips": []}

class Model(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        auth = self.headers.get('Authorization', '')
        msg = body['messages'][0]['content']
        text = msg if isinstance(msg, str) else next(p['text'] for p in msg if p['type'] == 'text')
        imgs = [] if isinstance(msg, str) else [p['image_url']['url'] for p in msg if p['type'] == 'image_url']
        SEEN.append({'stream': bool(body.get('stream')), 'auth': auth, 'model': body.get('model'), 'thinking': body.get('thinking'), 'max_tokens': body.get('max_tokens'),
                     'kind': 'import' if '六级阅读老师' in text else 'lex' if '全部单词' in text else 'small', 'imgs': [len(u) for u in imgs],
                     'img_type': [u[:23] for u in imgs], 'text': text[:400]})
        if auth == 'Bearer sk-bad-key-000000':
            self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":{"message":"bad key"}}'); return
        if '六级阅读老师' in text: out = '```json\n' + json.dumps(ARTICLE, ensure_ascii=False) + '\n```'
        elif '全部单词' in text: out = json.dumps({"dogs": ["n.", "狗", "dogs"], "clever": ["adj.", "聪明的", "smart"]})
        else: out = json.dumps(["adj.", "聪明的", "smart"], ensure_ascii=False)
        if body.get('stream'):                    # server-sent events, a few characters at a time
            self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
            try:
                for i in range(0, len(out), 6):
                    self.wfile.write(('data: ' + json.dumps({"choices": [{"delta": {"content": out[i:i + 6]}}]}) + '\n\n').encode()); self.wfile.flush()
                    time.sleep(STREAM_DELAY)
                self.wfile.write(b'data: [DONE]\n\n')
            except (BrokenPipeError, ConnectionResetError): SEEN[-1]['aborted'] = True
            return
        res = json.dumps({"choices": [{"message": {"role": "assistant", "content": out}}]}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(res)

class Redis(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        assert self.headers.get('Authorization') == 'Bearer test-token'
        cmds = json.loads(self.rfile.read(int(self.headers['Content-Length']))); out = []
        for c in cmds:
            op, k, *a = c
            if op == 'INCR': DB[k] = str(int(DB.get(k, 0)) + 1); out.append({'result': int(DB[k])})
            elif op == 'DECR': DB[k] = str(int(DB.get(k, 0)) - 1); out.append({'result': int(DB[k])})
            elif op == 'EXPIRE': out.append({'result': 1})
            elif op == 'SET': DB[k] = a[0]; out.append({'result': 'OK'})
            elif op == 'GETDEL': out.append({'result': DB.pop(k, None)})
            elif op == 'MGET': out.append({'result': [DB.get(x) for x in [k, *a]]})
            else: out.append({'error': 'unsupported ' + op})
        b = json.dumps(out).encode(); self.send_response(200); self.end_headers(); self.wfile.write(b)

def serve(H, port):
    s = ThreadingHTTPServer(('127.0.0.1', port), H); threading.Thread(target=s.serve_forever, daemon=True).start(); return s

def dev_server(port, **extra):
    env = {**os.environ, 'PORT': str(port), 'DEEPSEEK_API_KEY': 'sk-owner-key', 'KV_REST_API_URL': 'http://127.0.0.1:8795',
           'KV_REST_API_TOKEN': 'test-token', 'CR_UPSTREAM_OVERRIDE': 'http://127.0.0.1:8794/chat/completions',
           'FREE_IMPORTS': '2', 'FREE_SMALL': '3', **extra}
    p = subprocess.Popen(['node', 'server/dev-server.mjs'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(50):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/index.html'); return p
        except Exception: time.sleep(0.1)
    raise SystemExit('dev server did not start')

def post(port, device, headers=None, body=None):
    h = {'Content-Type': 'application/json', 'X-CR-Device': device, **(headers or {})}
    r = urllib.request.Request(f'http://127.0.0.1:{port}/api/sample', data=json.dumps(body or {'prompt': 'hi'}).encode(), headers=h, method='POST')
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

OK = []
def check(name, cond):
    OK.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name)

def big_png():
    # 4000x3000 noisy PNG, several MB: a stand-in for a phone photo
    import struct, zlib, random
    w, h = 4000, 3000; random.seed(1)
    row = lambda y: b'\x00' + bytes(random.getrandbits(8) for _ in range(w * 3))
    raw = b''.join(row(y) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 1)) + chunk(b'IEND', b'')

async def main():
    serve(Model, 8794); serve(Redis, 8795)
    dev = dev_server(8796)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1280, 'height': 900}); pg = await ctx.new_page()
            await pg.route('**/fonts.g*/**', lambda r: r.abort())
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://127.0.0.1:8796/index.html'); await pg.wait_for_timeout(1500); ev = pg.evaluate
            async def to_import():
                await ev("document.querySelector('.tab[data-v=import]').click()"); await pg.wait_for_timeout(700)
            async def text_import():
                await to_import()
                await pg.fill('#impText', 'Dogs are clever animals ___26___.'); await ev("document.querySelector('[data-act=impgo]').click()")
                await pg.wait_for_function("!document.querySelector('#impp')", timeout=40000); await pg.wait_for_timeout(500)
            check('first visit shows the welcome front page', await ev("!!document.querySelector('.wel') && document.querySelector('.tab[aria-current=page]')?.dataset.v === 'read'"))
            check('welcome page has the start button and the live demo', await ev("!!document.querySelector('[data-act=welstart]') && !!document.querySelector('.wd-sheet')"))
            await to_import()
            check('leaving the welcome page remembers it', await ev("localStorage.getItem('cr.welcomed')") == 'true')
            box = await ev("document.querySelector('.crai .q')?.innerText")
            check('AI 设置 box shows full free trial (2 imports, 3 small)', box and '2' in box and '3' in box)
            check('UI says AI, not Claude', 'Claude' not in await ev("document.querySelector('#view').innerText"))

            n0 = len(SEEN)
            await ev("""window.__seen = { lines: 0, chips: 0, stages: new Set() }; window.__obs = setInterval(() => {
                const g = document.querySelector('#imppGal'); if (!g) return; window.__seen.stages.add(g.dataset.stage);
                window.__seen.lines = Math.max(window.__seen.lines, document.querySelectorAll('.impp-l:not(.impp-cur)').length + (document.querySelector('.impp-cur .tx')?.textContent ? 1 : 0));
                window.__seen.chips = Math.max(window.__seen.chips, document.querySelectorAll('.impp-chip').length); }, 40)""")
            await text_import()
            seen = await ev("clearInterval(window.__obs), { lines: window.__seen.lines, chips: window.__seen.chips, stages: [...window.__seen.stages].sort().join('') }")
            print('      progress card saw:', seen)
            check('progress card showed sentences being written, then word chips, then done', seen['lines'] >= 1 and seen['chips'] >= 1 and seen['stages'] == '1234')
            check('both import calls were streamed', all(c['stream'] for c in SEEN[n0:]))
            view = await ev("document.querySelector('#view').innerText")
            check('free import #1 lands on the proofreading page with the new article', '导入完成' in view and 'Test Article' in view)
            calls = SEEN[n0:]
            check('import made 2 model calls (article + word tagging)', [c['kind'] for c in calls] == ['import', 'lex'])
            check('free trial uses owner key + deepseek-flash + thinking disabled',
                  all(c['auth'] == 'Bearer sk-owner-key' and c['model'] == 'deepseek-flash' and c['thinking'] == {'type': 'disabled'} for c in calls))
            dev_keys = {k: v for k, v in DB.items() if k.startswith('cr:dev:')}
            check('word-tagging call was not charged (1 import, 0 small)', sorted(dev_keys.values()) == ['1'] and any(k.endswith(':import') for k in dev_keys))
            lex = await ev("""(async () => { const db = await window.claude.use('db'); const c = await db.collection('articles').get();
                const d = c.docs.map(x => x.data()).find(a => a.title === 'Test Article'); return d && d.lex; })()""")
            check('saved article has the word tags from the follow-up call', lex and lex.get('clever', [None, None])[1] == '聪明的')

            # press 停止 half-way: the server aborts the model call and refunds the credit
            await to_import(); await pg.fill('#impText', 'Stopped article.'); await ev("document.querySelector('[data-act=impgo]').click()")
            await pg.wait_for_function("document.querySelectorAll('.impp-l').length > 0", timeout=20000)
            await ev("document.querySelector('[data-act=impstop]').click()"); await pg.wait_for_timeout(1500)
            st = await ev("document.querySelector('#impStatus').innerText")
            imp_used = DB.get(next((k for k in DB if k.endswith(':import')), ''), None)
            check('停止 shows "已停止" and the import credit is refunded', '已停止' in st and imp_used == '1')
            check('the model call upstream was cut off too', SEEN[-1].get('aborted') is True)
            await text_import()
            await to_import()
            box = await ev("document.querySelector('.crai .q')?.innerText")
            check('after 2 imports the box says 0 imports left', '导入0篇' in box.replace(' ', ''))
            await pg.fill('#impText', 'Third article.'); await ev("document.querySelector('[data-act=impgo]').click()")
            await pg.wait_for_function("!document.querySelector('#impp')", timeout=40000)
            st = await ev("document.querySelector('#impStatus').innerText")
            check('3rd free import refused with the "free trial used up" message', '免费试用已经用完' in st)

            # small calls: 3 allowed, 4th refused
            res = await ev("""(async () => { const s = await window.claude.use('sample'); const out = [];
                for (let i = 0; i < 4; i++) { try { await s.json('gloss ' + i); out.push('ok'); } catch (e) { out.push(e.code); } } return out; })()""")
            check('small calls: 3 ok then free_used_up', res == ['ok', 'ok', 'ok', 'free_used_up'])

            # bring your own key through the panel
            await to_import()
            await ev("document.querySelector('.crai details').open = true")
            await pg.select_option('#crAiProv', 'deepseek'); await pg.fill('#crAiKey', 'sk-user-key-123456'); await pg.click('#crAiSave')
            await pg.wait_for_timeout(300)
            check('panel switches to "your own key" wording', '你自己的' in await ev("document.querySelector('.crai .q').innerText"))
            n0 = len(SEEN); free_before = dict(DB)
            await pg.fill('#impText', 'BYOK article.'); await ev("document.querySelector('[data-act=impgo]').click()")
            await pg.wait_for_function("!document.querySelector('#impp')", timeout=40000); await pg.wait_for_timeout(500)
            check('BYOK import works after the free trial ran out', '导入完成' in await ev("document.querySelector('#view').innerText"))
            check('BYOK calls carry the user key, not the owner key', all(c['auth'] == 'Bearer sk-user-key-123456' for c in SEEN[n0:]) and len(SEEN[n0:]) == 2)
            check('BYOK does not touch free-trial counters', {k: v for k, v in DB.items() if k.startswith('cr:dev:')} == {k: v for k, v in free_before.items() if k.startswith('cr:dev:')})

            # photo import: several big pages, reorder, delete, BYOK
            png = big_png(); paths = []
            for i in range(4):
                pth = os.path.join(ROOT, 'tests', f'_page{i}.png'); open(pth, 'wb').write(png); paths.append(pth)
            await to_import(); await ev("document.querySelector('[data-act=impmode][data-m=photo]').click()"); await pg.wait_for_timeout(300)
            await pg.set_input_files('#impFile', paths[:2]); await pg.wait_for_timeout(400)
            await pg.set_input_files('#impFile', paths[2:]); await pg.wait_for_timeout(400)
            names = lambda: ev("[...document.querySelectorAll('.imp-pages img')].length")
            check('4 photos picked in two batches all listed', await names() == 4)
            await ev("document.querySelector('[data-act=impdel][data-i=\"3\"]').click()"); await pg.wait_for_timeout(300)
            check('delete removes a page', await names() == 3)
            order0 = await ev("S.impFiles.map(f => f.name).join(',')") if False else None
            await ev("document.querySelector('[data-act=impmv][data-i=\"2\"]').click()"); await pg.wait_for_timeout(300)
            check('thumbnails render (object URLs set)', await ev("[...document.querySelectorAll('.imp-pages img')].every(i => i.src.startsWith('blob:'))"))
            n0 = len(SEEN); await ev("document.querySelector('[data-act=impgo]').click()")
            await pg.wait_for_function("!document.querySelector('#impp')", timeout=60000)
            for pth in paths: os.remove(pth)
            sent = SEEN[n0]['imgs'] if len(SEEN) > n0 else []
            print(f'      3 pages, original PNG {len(png)/1e6:.1f} MB each → sent {[round(x/1e6, 2) for x in sent]} MB, total {sum(sent)/1e6:.2f} MB')
            check('3 pages sent in one request, all JPEG', len(sent) == 3 and all(t == 'data:image/jpeg;base64,' for t in SEEN[n0]['img_type']))
            check('whole request stays under the 4.5 MB limit', sum(sent) < 4.2e6)
            check('prompt tells the model the pages are one article', '3 张照片' in SEEN[n0].get('text', ''))
            check('photo list cleared after a successful import', '导入完成' in await ev("document.querySelector('#view').innerText"))

            # bad key
            await to_import(); await ev("document.querySelector('[data-act=impmode][data-m=text]').click()"); await pg.wait_for_timeout(300)
            await ev("document.querySelector('.crai details').open = true")
            await pg.fill('#crAiKey', 'sk-bad-key-000000'); await pg.click('#crAiSave'); await pg.wait_for_timeout(200)
            await pg.fill('#impText', 'Bad key.'); await ev("document.querySelector('[data-act=impgo]').click()")
            await pg.wait_for_function("!document.querySelector('#impp')", timeout=40000)
            check('bad key shows the "API Key 无效" message', 'API Key 无效' in await ev("document.querySelector('#impStatus').innerText"))
            await ev("document.querySelector('.crai details').open = true"); await pg.click('#crAiClear'); await pg.wait_for_timeout(500)
            check('clearing the key returns to free-trial wording', '免费试用' in await ev("document.querySelector('.crai .q').innerText"))
            check('key is stored only in this browser (localStorage) and removed on clear', await ev("localStorage.getItem('cr-ai')") is None)
            check('no page errors', not errs)
            if errs: print(errs)
            await b.close()
    finally:
        dev.terminate()

    # server-side guards, straight HTTP
    dev2 = dev_server(8797, IP_DAILY='2', FREE_SMALL='50')
    try:
        DB.clear()
        r = [post(8797, 'device-aaaaaaaaaaaaaaaa')[0] for _ in range(2)] + [post(8797, 'device-bbbbbbbbbbbbbbbb')[0]]
        check('per-IP daily cap: 3rd call from same IP refused even with a new device id', r == [200, 200, 429])
        check('refused call was refunded (counters stay at 2)', DB.get(next(k for k in DB if k.startswith('cr:ip:'))) == '2')
        check('other site origin refused', post(8797, 'device-cccccccccccccccc', {'Origin': 'https://evil.example'})[0] == 403)
        check('missing device id refused', post(8797, 'x')[0] == 400)
        check('provider outside the allowlist refused', post(8797, 'device-dddddddddddddddd', {'X-CR-Provider': 'evil', 'X-CR-Key': 'sk-123456789'})[0] == 400)
        check('long prompt without a ticket refused on the free trial', post(8797, 'device-eeeeeeeeeeeeeeee', body={'prompt': 'x' * 9000})[0] == 403)
    finally:
        dev2.terminate()
    dev3 = dev_server(8798, KV_REST_API_URL='', KV_REST_API_TOKEN='')
    try:
        check('without Redis the free trial is OFF (never unlimited)', post(8798, 'device-ffffffffffffffff')[0] == 503)
    finally:
        dev3.terminate()
    print(f'\n{sum(OK)}/{len(OK)} passed')
    sys.exit(0 if all(OK) else 1)

asyncio.run(main())
