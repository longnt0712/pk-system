"""Commit only the reviewed frontend fix, preserving the shared index/worktree."""
import os
from pathlib import Path
import re
import subprocess

ROOT = Path.cwd()
OUT = ROOT / 'outputs/vocabulary-merge-20261108'
PATHS = ['deployment/vocabulary-duplicate-review.md',
         'richy/app/topic/controllers/VocabularyDuplicateController.js',
         'richy/app/topic/views/vocabulary_duplicates.html',
         'richy/app/tests/vocabulary-duplicates.test.cjs']
INDEX_PATH = 'richy/app/index.html'
SUFFIX = b'-vocab-meaning-join-1'
ENV = dict(os.environ,GIT_INDEX_FILE=str(OUT/'meaning-fix.index'))

def git(*args,isolated=False):
    return subprocess.check_output(['git',*args],env=ENV if isolated else None)

def bump(content):
    match = re.search(rb"window.APP_VERSION = '([^']+)';",content)
    assert match
    return content if SUFFIX in match[1] else content[:match.end(1)]+SUFFIX+content[match.end(1):]

assert git('symbolic-ref','HEAD').decode().strip() == 'refs/heads/main'
parent = git('rev-parse','HEAD').decode().strip()
git('read-tree',parent,isolated=True)
git('-c','core.safecrlf=false','add','--',*PATHS,isolated=True)
candidate = OUT/'meaning-index.html'
candidate.write_bytes(bump(git('show',parent+':'+INDEX_PATH)))
blob = git('hash-object','-w','--no-filters',str(candidate)).decode().strip()
git('update-index','--cacheinfo','100644,'+blob+','+INDEX_PATH,isolated=True)
assert set(git('diff','--cached','--name-only',isolated=True).decode().splitlines()) == set(PATHS+[INDEX_PATH])
git('-c','core.whitespace=cr-at-eol','diff','--cached','--check',isolated=True)
print(git('diff','--cached','--stat',isolated=True).decode())
tree = git('write-tree',isolated=True).decode().strip()
assert git('rev-parse','HEAD').decode().strip()==parent,'HEAD changed; rerun preparation'
message = OUT/'meaning-commit-message.txt'
message.write_text('Restore slash-joined definitions in manual vocabulary merges\n\n'
    'Default the preview to all distinct selected meanings, removing exact\n'
    'duplicates and preserving manually edited text when selection changes.\n'
    'Keep the explicit primary-only option and refresh the frontend cache token.\n\n'
    'Validation: all 14 vocabulary duplicate frontend checks passed, including\n'
    'the reported activist case through confirmation and submitted payload.\n'
    'Frontend only; no backend or SQL changes in this commit.\n',encoding='utf8')
commit = git('commit-tree',tree,'-p',parent,'-F',str(message)).decode().strip()
git('update-ref','refs/heads/main',commit,parent)
git('reset','-q','HEAD','--',*PATHS)
for attempt in range(5):
    current = git('show',':'+INDEX_PATH)
    adjusted = bump(current)
    if adjusted==current: break
    candidate.write_bytes(adjusted)
    blob = git('hash-object','-w','--no-filters',str(candidate)).decode().strip()
    if git('show',':'+INDEX_PATH)!=current: continue
    git('update-index','--cacheinfo','100644,'+blob+','+INDEX_PATH)
    break
else: raise RuntimeError('Shared staged version kept changing; inspect index')
file = ROOT/INDEX_PATH
for attempt in range(5):
    current=file.read_bytes()
    adjusted=bump(current)
    if adjusted==current: break
    if file.read_bytes()!=current: continue
    file.write_bytes(adjusted)
    break
else: raise RuntimeError('Shared frontend version kept changing; inspect worktree')
assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==set(PATHS+[INDEX_PATH])
(OUT/'meaning-commit.txt').write_text(commit+'\n',encoding='ascii')
print(git('show','--stat','--oneline',commit).decode())
