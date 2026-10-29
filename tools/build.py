#!/usr/bin/env python3
"""Build the release files from the one code base in game/.

    python3 tools/build.py                  # itch-demo and itch-full
    python3 tools/build.py itch-demo web    # pick editions

Each edition is copied to dist/<edition>/ with its MR.EDITION and MR.BUILD set in js/edition.js, then zipped to
dist/crater-crew-<edition>-<build>.zip, with index.html at the top of the zip as itch.io expects.
The build name is the current git tag or commit. What each edition includes is decided in game/js/edition.js.
"""
import os, re, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DIST = os.path.join(ROOT, 'game'), os.path.join(ROOT, 'dist')
EDITIONS = ['web', 'itch-demo', 'itch-full', 'desktop']

def build_name():
    try:
        return subprocess.check_output(['git', 'describe', '--tags', '--always', '--dirty'], cwd=ROOT, text=True).strip()
    except Exception:
        return 'local'

def build(edition, name):
    out = os.path.join(DIST, edition)
    shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(SRC, out)
    path = os.path.join(out, 'js', 'edition.js')
    js = open(path, encoding='utf-8').read()
    js, n1 = re.subn(r"MR\.EDITION = '[^']*';", f"MR.EDITION = '{edition}';", js)
    js, n2 = re.subn(r"MR\.BUILD = '[^']*';", f"MR.BUILD = '{name}';", js)
    if n1 != 1 or n2 != 1:
        sys.exit('edition.js: could not find the MR.EDITION and MR.BUILD lines')
    open(path, 'w', encoding='utf-8').write(js)
    zpath = os.path.join(DIST, f'crater-crew-{edition}-{name}.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(out):
            for f in sorted(files):
                full = os.path.join(base, f)
                z.write(full, os.path.relpath(full, out))
    print(f'{edition:10} {os.path.getsize(zpath) // 1024:6} KB  {os.path.relpath(zpath, ROOT)}')

if __name__ == '__main__':
    picks = sys.argv[1:] or ['itch-demo', 'itch-full']
    bad = [e for e in picks if e not in EDITIONS]
    if bad:
        sys.exit(f'unknown edition: {", ".join(bad)} (choose from {", ".join(EDITIONS)})')
    os.makedirs(DIST, exist_ok=True)
    name = build_name()
    for e in picks:
        build(e, name)
