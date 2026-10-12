# tools/build_zip_bosses.py — writes dist/toadcity_taskD_batch2_v1.zip (the O6 layout: src/, kit/, viewer.html, previews/, tools/,
# harness/, README_bosses.md (+ README.md copy), LICENSES.md, package.json). Run from the repo root.
import os, zipfile, glob, json
IDS = ['admiral_redclaw', 'big_jimmy', 'voltage_vic', 'chef_crabcake', 'arabber_al', 'pool_shark']
files = []  # (zip path, source path)
files += [(f'src/boss_{i}.js', f'src/boss_{i}.js') for i in IDS]
files += [(p, p) for p in sorted(glob.glob('kit/*'))]
files += [(p, p) for p in sorted(glob.glob('harness/*'))]
files += [('viewer.html', 'viewer_bosses.html')]
for i in IDS: files += [(p, p) for p in sorted(glob.glob(f'previews/{i}_*.png'))]
for t in ['measure_boss.mjs', 'check_hooks.mjs', 'boss_seq.js', 'boss_jobs.mjs', 'shoot.mjs', 'readme_tables.mjs', 'readme_build.mjs',
          'README_bosses.template.md', 'README_bosses.notes.md', 'build_zip_bosses.py']: files.append((f'tools/{t}', f'tools/{t}'))
for i in IDS: files += [(f'tools/results_boss_{i}.json', f'tools/results_boss_{i}.json'), (f'tools/shots_{i}.json', f'tools/shots_{i}.json')]
files += [('README_bosses.md', 'README_bosses.md'), ('README.md', 'README_bosses.md'), ('LICENSES.md', 'LICENSES.md')]
pkg = {"name": "toadcity-taskd-batch2", "private": True, "type": "module",
       "description": "Toad City Baltimore Task D bosses batch 2 (O6): harness deps",
       "dependencies": {"three": "0.160.0"}, "devDependencies": {"playwright-core": "^1.48.0"}}
os.makedirs('dist', exist_ok=True)
out = 'dist/toadcity_taskD_batch2_v1.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for zp, src in files:
        assert os.path.isfile(src), src
        z.write(src, zp)
    z.writestr('package.json', json.dumps(pkg, indent=2) + '\n')
print(out, len(files) + 1, 'files', os.path.getsize(out), 'bytes')
