"""Cut the per-letter dictionary files into small sorted buckets for the web page.

    python3 tools/split_dict.py

Why: dict/s.json is 2 MB (≈700 KB gzipped). Looking up one word used to download the whole
letter, which on a slow phone connection to an overseas CDN meant seconds of spinner or a
timeout. Buckets are ~120 KB raw (~40 KB gzipped), so a lookup downloads one small file.

Input  (source of truth, kept in the repo, NOT deployed — see .vercelignore):
    dict/<a-z>.json   core entries        (written by tools/build_dict.py)
    more/<a-z>.json   etymology, roots, synonyms, look-alikes
Output (what the page fetches):
    dict/b/index.json + dict/b/NNN.json
    more/b/index.json + more/b/NNN.json
index.json = {"v": 1, "b": [[first_key, "NNN.json"], ...]} sorted by key. A bucket never spans
two letters, so a whole letter (the dictionary's A–Z browser) is just the buckets whose first
key starts with that letter. Run this again whenever dict/ or more/ letter files change.
"""
import glob, json, os, string

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = 120 * 1024


def split(kind):
    out = os.path.join(ROOT, kind, 'b')
    os.makedirs(out, exist_ok=True)
    for f in glob.glob(os.path.join(out, '*.json')):
        os.remove(f)
    index, n, total = [], 0, 0

    def flush(cur):
        nonlocal n
        name = f'{n:03d}.json'
        with open(os.path.join(out, name), 'w', encoding='utf-8') as fh:
            json.dump(cur, fh, ensure_ascii=False, separators=(',', ':'))
        index.append([min(cur), name])
        n += 1

    for L in string.ascii_lowercase:
        path = os.path.join(ROOT, kind, f'{L}.json')
        if not os.path.exists(path):
            continue
        d = json.load(open(path, encoding='utf-8'))
        cur, size = {}, 0
        for k in sorted(d):                       # Python and JS order BMP strings the same way
            item = len(json.dumps({k: d[k]}, ensure_ascii=False, separators=(',', ':')).encode())
            if cur and size + item > TARGET:
                flush(cur); cur, size = {}, 0
            cur[k] = d[k]; size += item; total += 1
        if cur:
            flush(cur)
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'n': total, 'b': index}, fh, ensure_ascii=False, separators=(',', ':'))
    sizes = [os.path.getsize(os.path.join(out, x[1])) for x in index]
    print(f'{kind}/b: {total} entries in {len(index)} buckets, largest {max(sizes) // 1024} KB')


if __name__ == '__main__':
    split('dict')
    split('more')
