"""Open the page locally with an in-memory database.

    python3 tests/preview.py            -> http://127.0.0.1:8000/_preview.html
    python3 tests/preview.py --stand    -> same, with the newsstand fixtures (?stand)

Data resets on every reload; Claude calls (import, AI notes) are unavailable.
"""
import sys, time
from harness import Server
srv = Server(8000, '_preview.html', inject_stub=True)
print('open', srv.url + ('?stand' if '--stand' in sys.argv else ''), '  (Ctrl+C to stop)')
try:
    while True: time.sleep(3600)
except KeyboardInterrupt:
    srv.close()
