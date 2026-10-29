"""Build compact data files for Hanzi Flow.

Inputs (scratchpad/src):
  complete.json          drkameleon/complete-hsk-vocabulary (MIT)
  mmah_dictionary.txt    skishore/makemeahanzi dictionary (LGPL-3.0)
  mmah_graphics.txt      skishore/makemeahanzi stroke graphics (Arphic Public License)
  nazmul/hsk_sentences.js iam-nazmul/chinese hand-authored sentences (MIT)
  roxaleen/sentences.json (optional) Roxaleen/hsk-annotated-corpus, tatoeba subset

Outputs (project/data):
  vocab.js, chars.js, sentences.js, strokes-1.js .. strokes-6.js
"""
import json, os, re, sys, unicodedata
from collections import defaultdict, Counter
from pypinyin import pinyin as _pinyin, Style as _Style

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

TONE_MARKS = {'̄': 1, '́': 2, '̌': 3, '̀': 4}

def syllables(pinyin):
    """'nǐ hǎo' -> [['ni',3],['hao',3]]; keeps ü; merges a standalone erhua 'r' into the previous syllable."""
    out = []
    for raw in pinyin.replace('u:', 'ü').split():
        tone = 5
        base = []
        for ch in unicodedata.normalize('NFD', raw.lower()):
            if ch in TONE_MARKS:
                tone = TONE_MARKS[ch]
            elif ch == '̈':
                base.append('̈')
            elif unicodedata.category(ch).startswith('M'):
                continue
            else:
                base.append(ch)
        b = unicodedata.normalize('NFC', ''.join(base))
        b = re.sub(r"[^a-zü]", '', b)
        if not b:
            continue
        if b == 'r' and out:
            out[-1][0] += 'r'
            continue
        out.append([b, tone])
    return out

def is_erhua(word, pinyin):
    """True for 哪儿 'nǎr', 女孩儿 'nǚ hái r', 有空儿 'yǒukòngr5'; False for 女儿 'nǚ ér'."""
    if len(word) < 2 or not word.endswith('儿'):
        return False
    toks = pinyin.split()
    last = norm_py(toks[-1]) if toks else ''
    return last.endswith('r') and last != 'er'

def syllables_by_char(word, erhua):
    """Per-character pinyin from pypinyin, used when CEDICT pinyin is not syllable-separated."""
    toks = [x[0] for x in _pinyin(word, style=_Style.TONE3, heteronym=False, v_to_u=True, neutral_tone_with_five=True)]
    out = []
    for tok in toks:
        tone = int(tok[-1]) if tok[-1].isdigit() else 5
        b = re.sub(r"[^a-zü]", '', tok.replace('u:', 'ü'))
        if b:
            out.append([b, tone])
    if erhua and len(out) >= 2 and out[-1][0] in ('er', 'r'):
        out[-2][0] += 'r'
        out.pop()
    return out

def norm_py(p):
    d = unicodedata.normalize('NFD', p.replace('u:', 'ü').lower())
    keep = []
    for ch in d:
        if ch == '\u0308':
            keep.append(ch)
        elif unicodedata.category(ch).startswith('M'):
            continue
        else:
            keep.append(ch)
    return re.sub(r'[^a-zü]', '', unicodedata.normalize('NFC', ''.join(keep)))

def pick_form(e):
    """Choose the CEDICT form that matches the word's everyday reading (not a surname or rare reading)."""
    forms = [f for f in e['forms'] if not all(m.lower().startswith(JUNK_PREFIXES) for m in f['meanings'])] or e['forms']
    def surname_only(f):
        return all(m.lower().startswith(('surname ', '(coll.)', 'old variant', 'variant')) for m in f['meanings'])
    good = [f for f in forms if not surname_only(f)] or forms
    word = e['simplified']
    want = ''.join(x[0] for x in _pinyin(word, style=_Style.NORMAL, heteronym=False, v_to_u=True))
    want_t = ''.join(x[0] for x in _pinyin(word, style=_Style.TONE3, heteronym=False, v_to_u=True, neutral_tone_with_five=True))
    pos0 = (e.get('pos') or [''])[0]
    def score(f):
        p = f['transcriptions']['pinyin']
        y = syllables(p)
        s = 0.0
        if norm_py(p) == want: s += 4
        if ''.join(b + str(tn) for b, tn in y) == want_t: s += 2
        if pos0 in ('u', 'y') and len(word) == 1 and y and all(tn == 5 for _, tn in y): s += 3
        if not p[:1].isupper(): s += 1
        s += min(len(f['meanings']), 3) * 0.1
        return s
    return max(good, key=score)

JUNK_PREFIXES = ('variant of', 'old variant of', 'erhua variant', 'see ', 'also written', 'also pr.', 'taiwan pr.', 'cl:', 'abbr. for', 'used in ')

def clean_meanings(ms):
    keep = []
    for m in ms:
        s = m.strip()
        low = s.lower()
        if not s or low.startswith(JUNK_PREFIXES):
            continue
        if low.startswith('surname ') and len(ms) > 1:
            continue
        # trim very long senses at a semicolon boundary
        if len(s) > 70:
            parts = s.split(';')
            acc = ''
            for p in parts:
                if len(acc) + len(p) > 70 and acc:
                    break
                acc = (acc + ';' + p) if acc else p
            s = acc.strip()
        keep.append(s)
        if len(keep) >= 3:
            break
    if not keep and ms:
        keep = [ms[0].strip()[:70]]
    return keep

# ---------------- vocabulary ----------------
complete = json.load(open(os.path.join(SRC, 'complete.json'), encoding='utf-8'))
words = []
for e in complete:
    lv = [int(l[-1]) for l in e['level'] if l.startswith('old-')]
    src = 'old'
    if not lv:
        # HSK 3.0 bands 1-6 fill the gaps of the 2.0 lists (e.g. 你好, 没有, 他们)
        lv = [int(l[-1]) for l in e['level'] if l.startswith('new-') and l[-1] in '123456']
        src = 'new'
        if not lv:
            continue
    level = min(lv)
    form = pick_form(e)
    tr = form['transcriptions']
    erhua = is_erhua(e['simplified'], tr['pinyin'])
    y = syllables(tr['pinyin'])
    if len(y) != len(e['simplified']) - (1 if erhua else 0):
        y = syllables_by_char(e['simplified'], erhua)
    words.append({
        's': e['simplified'],
        't': form['traditional'] if form['traditional'] != e['simplified'] else '',
        'p': tr['pinyin'].replace('u:', 'ü'),
        'y': y,
        'erhua': erhua,
        'm': clean_meanings(form['meanings']),
        'l': level,
        'q': e.get('frequency') or 99999,
        'pos': e.get('pos') or [],
        'cl': form.get('classifiers') or [],
        'src': src,
    })
words.sort(key=lambda w: (w['l'], w['q'], w['s']))
assert len(set(w['s'] for w in words)) == len(words), 'duplicate simplified words'

# verify syllable count == character count where possible (diagnostic only)
mismatch = [w['s'] for w in words if len(w['y']) != len(w['s']) - (1 if w['erhua'] else 0)]
print('words:', len(words), 'syllable/char mismatches:', len(mismatch), mismatch[:12])
from collections import Counter as _C
print('per level (old+new3.0 extras):', sorted(_C((w['l'], w['src']) for w in words).items()))

vocab_rows = [[w['s'], w['t'], w['p'], w['y'], w['m'], w['l'], ','.join(w['pos']), '/'.join(w['cl'][:3])] for w in words]
for chk in ('说', '都', '吗', '吧', '得', '着', '还', '那', '听', '读', '看', '打', '几', '和', '中', '了', '地', '过', '哪儿', '女儿', '有空儿', '侵略', '致力于', '中国'):
    w = next((w for w in words if w['s'] == chk), None)
    if w: print('  check', chk, w['y'], w['m'][0][:40])

# ---------------- characters ----------------
chars_in_words = {}
for w in words:
    for ch in w['s']:
        if '一' <= ch <= '鿿':
            chars_in_words[ch] = min(chars_in_words.get(ch, 9), w['l'])

dictionary = {}
for line in open(os.path.join(SRC, 'mmah_dictionary.txt'), encoding='utf-8'):
    o = json.loads(line)
    dictionary[o['character']] = o

def hint_for(o):
    et = o.get('etymology') or {}
    t = et.get('type')
    if t == 'pictophonetic':
        sem = et.get('semantic') or ''
        ph = et.get('phonetic') or ''
        h = et.get('hint') or ''
        parts = []
        if sem:
            parts.append(f"{sem} ({h}) gives the meaning" if h else f"{sem} gives the meaning")
        if ph:
            parts.append(f"{ph} gives the sound")
        return ', '.join(parts)
    if t in ('ideographic', 'pictographic'):
        h = et.get('hint') or ''
        return (('Picture: ' if t == 'pictographic' else '') + h) if h else ''
    return et.get('hint') or ''

char_rows = {}
components = set()
for ch, lv in chars_in_words.items():
    o = dictionary.get(ch)
    if not o:
        char_rows[ch] = ['', '', '', '', '', lv]
        continue
    dec = o.get('decomposition') or ''
    for c in dec:
        if '一' <= c <= '鿿' or '⺀' <= c <= '⿟':
            components.add(c)
    char_rows[ch] = [o.get('definition', ''), ' / '.join(o.get('pinyin') or []), dec if '？' not in dec else '', hint_for(o), o.get('radical', ''), lv]
# add components so hints can show their meanings (level 0 = component only)
for c in components:
    if c in char_rows:
        continue
    o = dictionary.get(c)
    if o:
        char_rows[c] = [o.get('definition', ''), ' / '.join(o.get('pinyin') or []), '', '', o.get('radical', ''), 0]
print('chars:', len(chars_in_words), '+ components:', len(char_rows) - len(chars_in_words))

# ---------------- strokes ----------------
need = set(chars_in_words)
graphics = {}
for line in open(os.path.join(SRC, 'mmah_graphics.txt'), encoding='utf-8'):
    o = json.loads(line)
    if o['character'] in need:
        graphics[o['character']] = {'strokes': o['strokes'], 'medians': o['medians']}
missing = [c for c in need if c not in graphics]
print('stroke data missing for', len(missing), missing[:10])
by_level = defaultdict(dict)
for ch, lv in chars_in_words.items():
    if ch in graphics:
        by_level[lv][ch] = graphics[ch]

def dump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))

def dump_list(rows):
    """One record per line, so the file stays readable and diff-friendly in an editor."""
    return '[\n' + ',\n'.join(dump(r) for r in rows) + '\n]'

def dump_dict(d):
    return '{\n' + ',\n'.join(json.dumps(k, ensure_ascii=False) + ':' + dump(v) for k, v in d.items()) + '\n}'

for lv in range(1, 7):
    path = os.path.join(OUT, f'strokes-{lv}.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// Stroke data derived from Make Me a Hanzi (graphics.txt), Arphic Public License.\n')
        f.write('// One character per line: {"strokes": [SVG paths], "medians": [[x,y] points per stroke]} in Hanzi Writer\'s 1024-unit grid.\n')
        f.write(f'window.CF_STROKES=window.CF_STROKES||{{}};\nObject.assign(window.CF_STROKES,{dump_dict(by_level[lv])});\n')
        f.write(f'window.CF_STROKES_LOADED=window.CF_STROKES_LOADED||{{}};window.CF_STROKES_LOADED[{lv}]=true;\n')
    print(f'strokes-{lv}.js chars={len(by_level[lv])} bytes={os.path.getsize(path)}')

# ---------------- sentences ----------------
sentences = []
t = open(os.path.join(SRC, 'nazmul', 'hsk_sentences.js'), encoding='utf-8').read()
i = t.find('const SENTENCES=')
j = t.find('\n', i)
arr = json.loads(t[i + len('const SENTENCES='):j].rstrip(';'))
wordset = set(w['s'] for w in words)
for s in arr:
    ws = [x for x in s['words'] if x in wordset]
    sentences.append([s['zh'], s['py'], s['en'], s['lv'], ws, 'n'])
print('nazmul sentences:', len(sentences))

rox = os.path.join(SRC, 'roxaleen', 'sentences.json')
if os.path.exists(rox) and os.path.getsize(rox) > 10000:
    from pypinyin import pinyin, Style
    ERHUA = {w['s'] for w in words if w['erhua']}
    data = json.load(open(rox, encoding='utf-8'))
    have = Counter()
    for s in sentences:
        for w in s[4]:
            have[w] += 1
    level_of = {w['s']: w['l'] for w in words}
    cands = []
    for zh, info in data.items():
        if info.get('source') != 'tatoeba':
            continue
        if not (4 <= len(zh) <= 18):
            continue
        tr = info.get('translation') or ''
        if not tr or len(tr) > 90:
            continue
        lvl = info.get('level') or 9
        if lvl > 6:
            continue
        tags = [t[0] for t in info.get('tags', []) if t[0] in wordset]
        if not tags:
            continue
        cands.append((lvl, len(zh), zh, tr, tags))
    cands.sort()
    added = 0
    for lvl, ln, zh, tr, tags in cands:
        useful = [w for w in tags if have[w] < 2 and level_of[w] >= max(1, lvl - 1)]
        if not useful:
            continue
        syl = [x[0] for x in pinyin(zh, style=Style.TONE, heteronym=False, errors=lambda t: list(t))]
        if len(syl) == len(zh):
            for w in tags:
                if w in ERHUA:
                    for m in re.finditer(re.escape(w), zh):
                        k = m.end() - 1
                        if k > 0 and syl[k]:
                            syl[k - 1] += 'r'
                            syl[k] = ''
        py = ' '.join(s for s in syl if s)
        py = re.sub(r'\s+([，。！？、；：,.!?])', r'\1', py)
        sentences.append([zh, py, tr, lvl, tags, 't'])
        for w in tags:
            have[w] += 1
        added += 1
    print('tatoeba sentences added:', added)

sent_rows = sentences
with open(os.path.join(OUT, 'sentences.js'), 'w', encoding='utf-8') as f:
    f.write('// Sentences: iam-nazmul/chinese (MIT) [n]; Tatoeba via Roxaleen/hsk-annotated-corpus (CC BY 2.0 FR) [t].\n')
    f.write('// Row: [chinese, pinyin, english, hskLevel, [vocab words used], source]\n')
    f.write(f'window.CF_SENTENCES={dump_list(sent_rows)};\n')

with open(os.path.join(OUT, 'vocab.js'), 'w', encoding='utf-8') as f:
    f.write('// HSK 2.0 vocabulary from drkameleon/complete-hsk-vocabulary (MIT), definitions CC-CEDICT (CC BY-SA 4.0).\n')
    f.write('// Row: [simplified, traditional-if-different, pinyin, syllables[[base,tone]], meanings[], level, pos, classifiers]\n')
    f.write(f'window.CF_VOCAB={dump_list(vocab_rows)};\n')
with open(os.path.join(OUT, 'chars.js'), 'w', encoding='utf-8') as f:
    f.write('// Character data from Make Me a Hanzi dictionary.txt (LGPL-3.0). Row: [definition, pinyin, decomposition, hint, radical, firstLevel]\n')
    f.write(f'window.CF_CHARS={dump_dict(char_rows)};\n')
for name in ('vocab.js', 'chars.js', 'sentences.js'):
    print(name, os.path.getsize(os.path.join(OUT, name)), 'bytes')
cov = Counter()
for s in sentences:
    for w in s[4]:
        cov[w] += 1
for L in range(1, 7):
    ws = [w['s'] for w in words if w['l'] == L]
    print(f'L{L}: {sum(1 for w in ws if w in cov)}/{len(ws)} words have a sentence')
