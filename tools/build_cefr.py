"""Build cefr.json — the CEFR level (A1–C2) of about 9,600 English headwords — from two open word lists:

  tools/cefr/cefrj-vocabulary-profile-1.5.csv        A1–B2  CEFR-J Wordlist 1.5, Tono Laboratory, Tokyo University of Foreign Studies
  tools/cefr/octanove-vocabulary-profile-c1c2-1.0.csv C1–C2  Octanove Vocabulary Profile 1.0, Octanove Labs, CC BY-SA 4.0
  (both from github.com/openlanguageprofiles/olp-en-cefrj)

  python3 tools/build_cefr.py

A word listed under several parts of speech keeps its lowest level ("about" A1 even if one sense is B1).
Spelling pairs like "analyze/analyse" become two entries. Output: {"src": ..., "A1": "a about ...", ...},
one space-separated string per level, ~75 KB, loaded next to level.json.
"""
import csv, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = [('cefrj-vocabulary-profile-1.5.csv'), ('octanove-vocabulary-profile-c1c2-1.0.csv')]
ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
best = {}
for name in SRC:
    with open(os.path.join(ROOT, 'tools', 'cefr', name), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            lv = (r.get('CEFR') or '').strip().upper()
            if lv not in ORDER: continue
            for w in r['headword'].split('/'):
                w = ' '.join(w.strip().lower().split())
                if not w: continue
                if w not in best or ORDER.index(lv) < ORDER.index(best[w]): best[w] = lv
out = {'src': 'CEFR-J Wordlist 1.5 (Tono Lab, TUFS) + Octanove Vocabulary Profile C1/C2 1.0 (CC BY-SA 4.0)'}
for lv in ORDER: out[lv] = ' '.join(sorted(w.replace(' ', '_') for w, l in best.items() if l == lv))
with open(os.path.join(ROOT, 'cefr.json'), 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print({lv: len(out[lv].split()) for lv in ORDER}, os.path.getsize(os.path.join(ROOT, 'cefr.json')), 'bytes')
