# Tests for publish_audit.py: it must catch what it says it catches, never
# report a false "clean", and never contain the private terms it looks for.
#   python -I engine/test/test_publish_audit.py
import io
import os
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(HERE, 'publish_audit.py')
failures = []


def check(name, ok, detail=''):
    print(('pass  ' if ok else 'FAIL  ') + name + ('' if ok else f': {detail}'))
    if not ok:
        failures.append(name)


def run(repo, *args):
    p = subprocess.run([sys.executable, '-I', AUDIT, repo, *args], capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def git(repo, *a):
    subprocess.run(['git', '-C', repo, *a], check=True, capture_output=True)


def docx_with_author(name):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('docProps/core.xml', f'<cp:coreProperties><dc:creator>{name}</dc:creator></cp:coreProperties>')
        z.writestr('word/document.xml', '<w:document>Hello</w:document>')
    return buf.getvalue()


with tempfile.TemporaryDirectory() as tmp:
    repo = os.path.join(tmp, 'repo')
    os.makedirs(repo)
    git(repo, 'init', '-q')
    git(repo, 'config', 'user.name', 'T')
    git(repo, 'config', 'user.email', 't@users.noreply.github.com')
    with open(os.path.join(repo, 'lesson.docx'), 'wb') as f:
        f.write(docx_with_author('Plantedperson Example'))
    with open(os.path.join(repo, 'broken.pdf'), 'wb') as f:
        f.write(b'%PDF-1.4 this is not a readable pdf')
    with open(os.path.join(repo, 'clean.md'), 'w') as f:
        f.write('Nothing private here.\n')
    git(repo, 'add', '-A')
    planted_email = 'someone' + '@' + 'example-school.org'  # built from parts so this file isn't a finding
    git(repo, 'commit', '-qm', f'Notes for {planted_email}')

    terms = os.path.join(tmp, 'private_terms.txt')
    with open(terms, 'w') as f:
        f.write('# one pattern per line\nplantedperson\n')

    code, out = run(repo, '--private-terms', terms, '--skip-identities')
    check('a private term inside a Word file is found', 'lesson.docx' in out and 'private term' in out, out)
    check('an email in a commit message is found', 'commit message' in out and planted_email in out, out)
    check('an unreadable PDF is a finding, not a silent pass', 'broken.pdf' in out and 'could not read' in out, out)
    check('findings exit 1', code == 1, f'exit {code}')

    code, out = run(repo, '--private-terms', os.path.join(tmp, 'missing.txt'), '--skip-identities')
    check('a missing private-terms file never reports clean', code == 2 and 'private' in out.lower(), f'exit {code}: {out[-200:]}')

    clean = os.path.join(tmp, 'clean')
    os.makedirs(clean)
    git(clean, 'init', '-q')
    git(clean, 'config', 'user.name', 'T')
    git(clean, 'config', 'user.email', 't@users.noreply.github.com')
    with open(os.path.join(clean, 'a.md'), 'w') as f:
        f.write('Nothing private here.\n')
    git(clean, 'add', '-A')
    git(clean, 'commit', '-qm', 'A clean commit')
    code, out = run(clean, '--private-terms', terms)
    check('a clean repo passes with exit 0', code == 0 and 'NOTHING FOUND' in out, f'exit {code}: {out[-200:]}')

# Neither the audit nor this test may name anything private. The private terms
# come from the maintainer's own, never-committed list, not from this file.
import re
mine = os.path.join(HERE, '.audit_private_terms')
if os.path.exists(mine):
    pats = [re.compile(l.strip(), re.I) for l in open(mine, encoding='utf-8') if l.strip() and not l.lstrip().startswith('#')]
    for f in (AUDIT, os.path.abspath(__file__)):
        text = open(f, encoding='utf-8').read()
        leaks = sorted({m.group(0) for p in pats for m in p.finditer(text)})
        check(f'{os.path.basename(f)} names nothing from the private-terms list', not leaks, f'{len(leaks)} term(s)')
else:
    print('skip  no engine/test/.audit_private_terms here, so the files can\'t be checked against it')

print(f'\n{"all passed" if not failures else str(len(failures)) + " failed"}')
sys.exit(1 if failures else 0)
