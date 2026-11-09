import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path.cwd()
OUT = ROOT / 'outputs/vocabulary-merge-20261108'
PATHS = [
    'richy/app/question/business/QuestionService.js',
    'richy/app/topic/controllers/VocabularyDuplicateController.js',
    'richy/app/topic/views/vocabulary_duplicates.html',
    'richy/app/topic/vocabulary_duplicates.css',
    'richy/app/tests/vocabulary-duplicates.test.cjs',
    'richy/richy-api/src/main/java/com/globits/richy/domain/Question.java',
    'richy/richy-api/src/main/java/com/globits/richy/dto/VocabularyDuplicateDto.java',
    'richy/richy-api/src/main/java/com/globits/richy/rest/RestVocabularyDuplicateController.java',
    'richy/richy-api/src/main/java/com/globits/richy/service/impl/VocabularyDuplicateService.java',
    'richy/richy-api/src/test/java/com/globits/richy/question/VocabularyDuplicatePersistenceTest.java',
    'richy/database/vocabulary-duplicate-review.sql',
    'deployment/vocabulary-duplicate-review.md',
]
INDEX_PATH = 'richy/app/index.html'
SUFFIX = b'-vocab-batch-review-1'
ENV = dict(os.environ, GIT_INDEX_FILE=str(OUT / 'batch-review.index'))

def git(*args):
    return subprocess.check_output(['git', *args], env=ENV)

assert git('symbolic-ref', 'HEAD').decode().strip() == 'refs/heads/main'
parent = git('rev-parse', 'HEAD').decode().strip()
git('read-tree', parent)
git('-c', 'core.safecrlf=false', 'add', '--', *PATHS)
content = git('show', parent + ':' + INDEX_PATH)
match = re.search(rb"window.APP_VERSION = '([^']+)';", content)
assert match and SUFFIX not in match[1]
content = content[:match.end(1)] + SUFFIX + content[match.end(1):]
candidate = OUT / 'index-for-batch-commit.html'
candidate.write_bytes(content)
blob = git('hash-object', '-w', '--no-filters', str(candidate)).decode().strip()
git('update-index', '--cacheinfo', '100644,' + blob + ',' + INDEX_PATH)
changed = git('diff', '--cached', '--name-only').decode().splitlines()
assert set(changed) == set(PATHS + [INDEX_PATH]), changed
git('-c', 'core.whitespace=cr-at-eol', 'diff', '--cached', '--check')
tree = git('write-tree').decode().strip()
(OUT / 'batch-commit-state.json').write_text(json.dumps({'parent':parent,'tree':tree,'paths':PATHS,'indexPath':INDEX_PATH}), encoding='utf8')
print(git('diff', '--cached', '--stat').decode())
print('Prepared parent:', parent)
print('Prepared tree:', tree)
