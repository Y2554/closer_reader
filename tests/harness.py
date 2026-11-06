"""Shared helpers: serve the project root and open the built page with the runtime stub."""
import functools, http.server, os, threading
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB = os.path.join(ROOT, 'tests', 'stub-db.js')
SHOTS = os.path.join(ROOT, 'tests', 'shots')
WRAP = ('<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>{}</body></html>')

class Server:
    """Writes _test.html (the page wrapped the way claude.ai wraps it) and serves ROOT."""
    def __init__(self, port, name='_test.html', inject_stub=False):
        self.port, self.name = port, name
        html = open(os.path.join(ROOT, 'close-reader.html'), encoding='utf-8').read()
        if inject_stub: html = '<script src="tests/stub-db.js"></script>\n' + html
        with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as f: f.write(WRAP.format(html))
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        H = functools.partial(Quiet, directory=ROOT)
        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), H)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{port}/{name}'
    def close(self):
        self.srv.shutdown()
        try: os.remove(os.path.join(ROOT, self.name))
        except FileNotFoundError: pass
