# checks that no ANSWER_KEYS.md text is on any round-2 page or in any ZIP: the file itself, its private headings, and every expected quiz answer line
import zipfile, glob, os, re, sys
R2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ak = open(R2 + '/ANSWER_KEYS.md').read()
needles = ['ANSWER KEYS (PRIVATE', 'Quiz: expected answers', 'Canary strings to find in the delivery', 'Required self-check numbers and pass thresholds', 'How to use: when an AI sends its Step 0 reply']
# every quiz line "N. **question** → answer" as it appears in the key (question+answer together)
for m in re.finditer(r'^\d+\. \*\*(.+?)\*\* → (.+)$', ak, re.M): needles.append(m.group(1) + '** → ' + m.group(2)); needles.append('→ ' + m.group(2))
blobs = []
for f in glob.glob(R2 + '/build/pages/*/**', recursive=True):
    if os.path.isfile(f) and not f.endswith('.zip'): blobs.append((f, open(f, 'rb').read().decode('utf8', 'ignore')))
for z in glob.glob(R2 + '/*.zip') + glob.glob(R2 + '/build/pages/*/*.zip'):
    with zipfile.ZipFile(z) as Z:
        for n in Z.namelist():
            if 'ANSWER' in n.upper(): blobs.append((z + ':' + n, 'ANSWER KEYS (PRIVATE FILE NAME'))
            blobs.append((z + ':' + n, Z.read(n).decode('utf8', 'ignore')))
hits = [(f, n) for f, t in blobs for n in needles if n in t]
print('files scanned', len(blobs), 'needles', len(needles), 'hits', len(hits))
for h in hits[:20]: print('LEAK', h[0], '|', h[1][:80])
sys.exit(1 if hits else 0)
