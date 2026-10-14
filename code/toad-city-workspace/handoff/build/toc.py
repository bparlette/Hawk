import subprocess, json, sys
sys.path.insert(0, '.')
import importlib.util
spec = importlib.util.spec_from_file_location('gen', 'gen.py'); 
src = open('gen.py').read().split("if __name__ == '__main__':")[0]
ns = {}; exec(src, ns)
res = {}
for key, d in ns['DOCS'].items():
    pdf = '../' + d['file']; n = int([l for l in subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout.split('\n') if l.startswith('Pages')][0].split()[-1])
    texts = [subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), pdf, '-'], capture_output=True, text=True).stdout for i in range(1, n + 1)]
    res[key] = {}
    for t, _ in d['toc']:
        probe = t[:22]
        for i in range(2, n):
            if any(l.strip().startswith(probe) for l in texts[i].split('\n')):
                res[key][t] = i + 1; break
    print(key, n, res[key])
print(json.dumps(res), file=open('/workspace/work/tc_pp/tocpages.json', 'w'))
