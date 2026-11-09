import json
from pathlib import Path
import re
import subprocess

ROOT = Path.cwd()
OUT = ROOT / 'outputs/vocabulary-merge-20261108'
STATE = json.loads((OUT / 'batch-commit-state.json').read_text(encoding='utf8'))
SUFFIX = b'-vocab-batch-review-1'

def git(*args):
    return subprocess.check_output(['git', *args])

assert git('symbolic-ref','HEAD').decode().strip() == 'refs/heads/main'
assert git('rev-parse','HEAD').decode().strip() == STATE['parent'], 'HEAD changed: prepare and review again'
message = OUT / 'batch-commit-message.txt'
message.write_text('Add batch vocabulary merges and persistent review checks\n\n'
    'Review ten same-word groups per page, keep primary definitions by default,\n'
    'and save selected groups atomically with stale preview protection.\n'
    'Persist manual sidebar check marks and hide reviewed groups by default;\n'
    'show all to revisit them, and reopen review when new duplicate IDs arrive.\n\n'
    'Deploy vocabulary-duplicate-review.sql before the matching backend JAR.\n'
    'Validation: 33 Java checks, 13 Node checks, and isolated local SQL migration\n'
    'tests for initial run, repeatability, unchanged data and DDL rollback.\n', encoding='utf8')
commit = git('commit-tree',STATE['tree'],'-p',STATE['parent'],'-F',str(message)).decode().strip()
git('update-ref','refs/heads/main',commit,STATE['parent'])
git('reset','-q','HEAD','--',*STATE['paths'])
index_path = STATE['indexPath']

# Retain unrelated staged and unstaged edits to the shared frontend version file.
for attempt in range(5):
    content = git('show', ':'+index_path)
    match = re.search(rb"window.APP_VERSION = '([^']+)';",content)
    assert match
    if SUFFIX in match[1]: break
    adjusted = content[:match.end(1)] + SUFFIX + content[match.end(1):]
    candidate = OUT / 'index-for-shared-batch-staging.html'
    candidate.write_bytes(adjusted)
    blob = git('hash-object','-w','--no-filters',str(candidate)).decode().strip()
    if git('show', ':'+index_path) != content: continue
    git('update-index','--cacheinfo','100644,'+blob+','+index_path)
    break
else: raise RuntimeError('Shared staged frontend version kept changing; inspect index')

file = ROOT / index_path
for attempt in range(5):
    content = file.read_bytes()
    match = re.search(rb"window.APP_VERSION = '([^']+)';",content)
    assert match
    if SUFFIX in match[1]: break
    adjusted = content[:match.end(1)] + SUFFIX + content[match.end(1):]
    if file.read_bytes() != content: continue
    file.write_bytes(adjusted)
    break
else: raise RuntimeError('Shared working frontend version kept changing; inspect file')

changed = git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines()
assert set(changed) == set(STATE['paths'] + [index_path]),changed
(OUT / 'batch-commit.txt').write_text(commit+'\n', encoding='ascii')
print(git('show','--stat','--oneline',commit).decode())
print('Other staged paths retained:',git('diff','--cached','--name-only').decode())
