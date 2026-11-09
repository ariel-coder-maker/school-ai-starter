# Before anything is published: scan every file in every commit (including
# inside Word, PowerPoint, Excel and PDF files), every commit message, and every
# commit's author and committer, for keys, emails, personal paths, private
# addresses, student-data words and YOUR OWN private terms. Prints where each
# finding is and what kind it is, never a secret itself.
#
#   python engine/test/publish_audit.py .                    every branch
#   python engine/test/publish_audit.py . --ref main         only what pushing main would publish
#   python engine/test/publish_audit.py . --skip-identities  leave out commit authors
#   python engine/test/publish_audit.py . --private-terms <file>
#
# PDFs are read with the pymupdf library (pip install pymupdf). Without it, each
# PDF is reported as "could not read": a file that can't be read is never cleared.
#
# YOUR PRIVATE TERMS (your school's name, your town, your computer's user name,
# a private repo's name...) are never written in this file, because this file
# is published. They live in engine/test/.audit_private_terms, one pattern per
# line, which .gitignore keeps out of git. Start from audit_private_terms.example.
#
# Exit 0: nothing found. 1: something found. 2: the check couldn't be done
# fully (no private-terms file). 3: only commit identities (a real email in a
# commit record). Never push on anything but 0.
import io
import os
import re
import subprocess
import sys
import zipfile
from collections import defaultdict

args = sys.argv[1:]
repo = args[0] if args and not args[0].startswith('--') else '.'
opt = lambda name: args[args.index(name) + 1] if name in args else None
skip_identities = '--skip-identities' in args
refs = [opt('--ref')] if opt('--ref') else ['--all']
terms_path = opt('--private-terms') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '.audit_private_terms')
git = lambda *a: subprocess.run(['git', '-C', repo, *a], capture_output=True).stdout

# Patterns anyone may read. Nothing here identifies a person or a school.
KEYS = {
    'Anthropic key':       rb'sk-ant-[A-Za-z0-9_\-]{20,}',
    'sk- style key':       rb'\bsk-[A-Za-z0-9]{20,}',
    'Google key':          rb'AIza[0-9A-Za-z_\-]{30,}',
    'NVIDIA key':          rb'nvapi-[A-Za-z0-9_\-]{20,}',
    'GitHub token':        rb'gh[pousr]_[A-Za-z0-9]{30,}',
    'Slack token':         rb'xox[abpr]-[A-Za-z0-9\-]{10,}',
    'private key block':   rb'-----BEGIN [A-Z ]*PRIVATE KEY-----',
    'JWT':                 rb'eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.',
    # A secret written out as text: a quoted literal in code, or a filled-in
    # KEY=value line. Variables (password: body.password) are not findings.
    'password or token as text': rb'(?i)(password|passwd|secret|token|api_key)["\']?[ \t]*[:=][ \t]*["\'][^\s"\']{8,}["\']',
    'filled-in secret line':     rb'(?m)^[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|API_KEY)[ \t]*=[ \t]*[^\s#]{8,}',
}
PERSONAL = {
    'email address':       rb'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}',
    # /home/node/ is the n8n container's own folder, not a person's.
    'personal path':       rb'(?i)C:[\\/]+Users[\\/]+[A-Za-z0-9_.\-]+|/home/(?!node/)[a-z][a-z0-9_\-]+/|/Users/[A-Za-z][A-Za-z0-9_\-]+/',
    'private IP address':  rb'\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b',
    'phone number':        rb'\+\d{2,3}[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}',
    # Built from parts so this file doesn't match itself.
    'student-data words':  rb'(?i)\b(student' + rb'_name|student' + rb' id|date of' + rb' birth|guardian' + rb' email|parent' + rb' email|grade' + rb' book)\b',
}
# Placeholders and addresses that are meant to be public.
ALLOW = [rb'noreply@anthropic\.com', rb'@users\.noreply\.github\.com', rb'noreply@github\.com', rb'@example\.',
         rb'change-me-once', rb'kit-test-only', rb'kit-dev-only', rb'kit-real-test', rb'practice-test-only',
         rb'dev-only-passphrase', rb'correct horse battery', rb"'123456789'"]
OFFICE = ('.docx', '.pptx', '.xlsx', '.dotx', '.potx')
SKIP = ('.png', '.jpg', '.jpeg', '.gif', '.ico', '.zip')
SELF = os.path.basename(__file__)

if not os.path.exists(terms_path):
    print(f'No private-terms file at {terms_path}.')
    print("Without it this can't check for your school's own names. Copy engine/test/audit_private_terms.example")
    print('to engine/test/.audit_private_terms and put your private terms in it (it is never committed).')
    sys.exit(2)
PRIVATE = [re.compile(line.strip().encode(), re.I) for line in open(terms_path, encoding='utf-8')
           if line.strip() and not line.lstrip().startswith('#')]

findings = defaultdict(set)


def hide(kind, s):
    shown = s.decode('utf-8', 'replace')
    return shown[:12] + '…' if kind in KEYS else shown[:60]


def scan(where, data, only_keys=False):
    tables = (KEYS,) if only_keys else (KEYS, PERSONAL)
    for table in tables:
        for kind, pat in table.items():
            for m in re.finditer(pat, data):
                if not any(re.search(a, m.group(0)) for a in ALLOW):
                    findings[kind].add(f'{where}: {hide(kind, m.group(0))}')
    for pat in PRIVATE:
        for m in pat.finditer(data):
            findings['private term'].add(f'{where}: {m.group(0).decode("utf-8", "replace")[:60]}')


def contents(sha, path):
    """The text to scan in one file version: a list of (where, bytes)."""
    data = git('cat-file', '-p', sha)
    low = path.lower()
    if low.endswith(SKIP):
        return []
    if low.endswith('.pdf'):
        try:
            import pymupdf
            return [(path, ''.join(p.get_text() for p in pymupdf.open(stream=data, filetype='pdf')).encode())]
        except Exception as e:
            findings['could not read'].add(f"{path}: {type(e).__name__} (a file that can't be read can't be cleared)")
            return []
    if low.endswith(OFFICE):
        try:
            z = zipfile.ZipFile(io.BytesIO(data))
            return [(f'{path} › {n}', z.read(n)) for n in z.namelist() if n.endswith(('.xml', '.rels'))]
        except Exception as e:
            findings['could not read'].add(f'{path}: {type(e).__name__}')
            return []
    return [(path, data)]


count = 0
seen = set()
for line in git('rev-list', '--objects', *refs).splitlines():
    parts = line.split(b' ', 1)
    if len(parts) != 2 or parts[0] in seen or git('cat-file', '-t', parts[0]).strip() != b'blob':
        continue
    seen.add(parts[0])
    count += 1
    path = parts[1].decode('utf-8', 'replace')
    for where, data in contents(parts[0], path):
        # This file holds patterns, not data: only keys and private terms are looked for in it.
        scan(where, data, only_keys=os.path.basename(path) == SELF)

messages = [m for m in git('log', *refs, '--format=%H%x00%B%x01').split(b'\x01') if b'\x00' in m]
for msg in messages:
    sha, body = msg.strip().split(b'\x00', 1)
    scan(f'commit message {sha[:7].decode()}', body)

identities = set()
if not skip_identities:
    for line in git('log', *refs, '--format=%an <%ae>%n%cn <%ce>').decode('utf-8', 'replace').splitlines():
        email = line[line.find('<') + 1:-1]
        if email and 'noreply' not in email:
            identities.add(line)
        for pat in PRIVATE:
            if pat.search(line.encode()):
                findings['private term'].add(f'commit identity: {line}')

print(f'Scanned {count} file versions and {len(messages)} commit messages, with {len(PRIVATE)} private term(s).')
for kind, items in findings.items():
    print(f'\n## {kind} ({len(items)})')
    for i in sorted(items)[:30]:
        print('  ' + i)
if identities:
    print('\n## commit identities with a real email (visible on GitHub)')
    for i in sorted(identities):
        print('  ' + i)
if not findings and not identities:
    print('NOTHING FOUND')
sys.exit(1 if findings else 3 if identities else 0)
