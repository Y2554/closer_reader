"""Augment the core dictionary and build the extended lexicon + Chinese→English index.

    git clone --depth 1 --filter=blob:none --sparse https://github.com/skywind3000/ECDICT /tmp/ecdict
    (cd /tmp/ecdict && git sparse-checkout set --no-cone /ecdict.csv)
    python3 tools/build_dict.py /tmp/ecdict/ecdict.csv

What it does (idempotent — safe to run again):
  1. dict/<a-z>.json (core, 87k entries, already carries WordNet senses + IPA):
     adds  ex  (inflections from ECDICT "exchange", e.g. "p:went/d:gone/i:going/3:goes")
           fq  (COCA frequency rank) · bn (BNC rank) · d (ECDICT English definition, only when no WordNet senses)
  2. ext/*.json + ext/index.json (extended lexicon, ~600k ECDICT entries not in core:
     phrases like "give up", technical terms, newer words). Sorted, cut into ~1 MB buckets at
     two-letter boundaries; index.json lists [first-two-letters, file]. Same field names as core.
  3. tools/newwords.json → merged into ext (recent words ECDICT lacks; marked  s: "n").
  0. level.json: every lemma's level is re-derived from ECDICT exam tags (see level_of).
  4. dict/zh.json: [[word, short Chinese gloss, level], …] for exam-level and common words,
     used for Chinese → English lookup.

The WordNet / IPA / etymology data in dict/ and more/ came from an earlier one-off conversion
(Open English WordNet, GCIDE); this script keeps it untouched.
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
csv.field_size_limit(10 ** 8)
BAD = '�'
WORD_OK = re.compile(r"[a-z][a-z0-9' \-.]{0,59}")
INFL = set('pdi3srt')

def clean(s, cap=None):
    s = (s or '').replace('\\n', '\n').replace(BAD, '').replace('\r', '').strip()
    s = re.sub(r'\n{2,}', '\n', s)
    if cap and len(s) > cap:
        cut = s[:cap]; nl = cut.rfind('\n')
        s = cut[:nl] if nl > cap * 0.5 else cut.rstrip(',; ') + '…'
    return s

def rank(v):
    try: n = int(v or 0)
    except ValueError: n = 0
    return n if n > 0 else None

def exch(v):
    """'0:go/1:p' → lemma info;  'p:went/d:gone' → 'p:went/d:gone' (inflections only)."""
    lemma = kinds = None; forms = []
    for part in (v or '').split('/'):
        if ':' not in part: continue
        k, w = part.split(':', 1)
        if k == '0': lemma = w
        elif k == '1': kinds = w
        elif k in INFL and w: forms.append(f'{k}:{w}')
    return lemma, kinds, '/'.join(forms)

def level_of(tags):
    """One level per word, the one a CET learner meets it at.
    zk (中考) words are basic; otherwise the first CET-relevant exam that lists it wins;
    a word only on the 高考 list (gk) with no college exam tag is basic too."""
    t = set(tags.split())
    if 'zk' in t: return 'b'
    if 'cet4' in t: return '4'
    if 'cet6' in t: return '6'
    if 'ky' in t: return 'k'
    if 'gk' in t: return 'b'
    if 'ielts' in t or 'toefl' in t: return 't'
    if 'gre' in t: return 'g'
    return None

def main(src):
    core = {}
    for L in 'abcdefghijklmnopqrstuvwxyz':
        core[L] = json.load(open(os.path.join(ROOT, 'dict', f'{L}.json'), encoding='utf-8'))
    allcore = {w: e for sh in core.values() for w, e in sh.items()}

    ext = {}
    n_aug = 0
    with open(src, encoding='utf-8') as f:
        level = json.load(open(os.path.join(ROOT, 'level.json'), encoding='utf-8'))
        relevel = {}
        for r in csv.DictReader(f):
            w = r['word']
            if w in level and not level[w].startswith('>'):
                lv = level_of(r['tag'])
                if lv and lv != level[w]: relevel[w] = lv
            lemma, kinds, forms = exch(r['exchange'])
            if w in allcore:
                e = allcore[w]; changed = False
                if forms and e.get('ex') != forms: e['ex'] = forms; changed = True
                for k, col in (('fq', 'frq'), ('bn', 'bnc')):
                    v = rank(r[col])
                    if v and e.get(k) != v: e[k] = v; changed = True
                if not e.get('w') and not e.get('d') and r['definition'].strip():
                    e['d'] = clean(r['definition'], 260); changed = True
                n_aug += changed
                continue
            t = clean(r['translation'], 420)
            if not t or not WORD_OK.fullmatch(w): continue
            e = {'t': t}
            if r['phonetic'].strip(): e['p'] = clean(r['phonetic'])
            d = clean(r['definition'], 500)
            if d: e['d'] = d
            if r['tag'].strip(): e['g'] = r['tag'].strip()
            c = rank(r['collins'])
            if c: e['c'] = c
            if r['oxford'].strip() == '1': e['o'] = 1
            for k, col in (('fq', 'frq'), ('bn', 'bnc')):
                v = rank(r[col])
                if v: e[k] = v
            if forms: e['ex'] = forms
            if lemma and lemma != w and kinds:
                e['l'] = lemma; e['f'] = ''.join(ch for ch in kinds if ch in INFL)
            ext[w] = e

    # recent words ECDICT does not have
    nw_path = os.path.join(ROOT, 'tools', 'newwords.json')
    n_new = 0
    if os.path.exists(nw_path):
        for w, e in json.load(open(nw_path, encoding='utf-8')).items():
            w = w.lower()
            if w in allcore: continue
            ext[w] = {**e, 's': 'n'}; n_new += 1

    for L, sh in core.items():
        with open(os.path.join(ROOT, 'dict', f'{L}.json'), 'w', encoding='utf-8') as f:
            json.dump(sh, f, ensure_ascii=False, separators=(',', ':'))

    # ---- buckets
    out = os.path.join(ROOT, 'ext'); os.makedirs(out, exist_ok=True)
    for fn in os.listdir(out):
        if fn.endswith('.json'): os.remove(os.path.join(out, fn))
    keys = sorted(ext)
    groups = {}
    for w in keys: groups.setdefault(w[:2], []).append(w)
    index, cur, cur_size, start, n = [], {}, 0, None, 0
    LIMIT = 1_000_000
    def flush():
        nonlocal cur, cur_size, start, n
        if not cur: return
        name = f'{n:03d}.json'
        with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
            json.dump(cur, f, ensure_ascii=False, separators=(',', ':'))
        index.append([start, name]); n += 1; cur = {}; cur_size = 0; start = None
    for p2 in sorted(groups):
        part = {w: ext[w] for w in groups[p2]}
        size = len(json.dumps(part, ensure_ascii=False).encode())
        if cur and cur_size + size > LIMIT: flush()
        if start is None: start = p2
        cur.update(part); cur_size += size
    flush()
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'v': 1, 'n': len(ext), 'b': index}, f, ensure_ascii=False, separators=(',', ':'))

    # ---- levels
    level.update(relevel)
    with open(os.path.join(ROOT, 'level.json'), 'w', encoding='utf-8') as f:
        json.dump(level, f, ensure_ascii=False, separators=(',', ':'))
    print(f'levels re-derived: {len(relevel)} changed')

    # ---- Chinese → English index (exam-level words + Collins/Oxford core words)
    ORDER = {'4': 0, '6': 1, 'b': 2, 'k': 3, 't': 4, 'g': 5}
    zh = []
    for w, e in allcore.items():
        if e.get('l') or ' ' in w: continue
        lv = level.get(w)
        lv = lv if isinstance(lv, str) and not lv.startswith('>') else ''
        if not lv and not (e.get('c', 0) >= 2 or e.get('o')): continue
        lines = [re.sub(r'^(?:[a-z]+\.\s*)', '', l).strip() for l in e.get('t', '').split('\n') if l and not l.startswith('[')]
        g = '；'.join(x for x in lines if x)[:60]
        if g: zh.append([w, g, lv, e.get('fq') or e.get('bn') or 0])
    zh.sort(key=lambda x: (ORDER.get(x[2], 9), -(allcore[x[0]].get('c') or 0), len(x[0])))
    with open(os.path.join(ROOT, 'dict', 'zh.json'), 'w', encoding='utf-8') as f:
        json.dump(zh, f, ensure_ascii=False, separators=(',', ':'))

    tot = sum(os.path.getsize(os.path.join(out, x)) for x in os.listdir(out))
    print(f'core augmented: {n_aug} · ext entries: {len(ext)} (new words {n_new}) in {len(index)} buckets, {tot/1e6:.1f} MB · zh index: {len(zh)}')

if __name__ == '__main__':
    if len(sys.argv) < 2: raise SystemExit(__doc__)
    main(sys.argv[1])
