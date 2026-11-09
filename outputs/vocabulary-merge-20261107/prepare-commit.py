import json
import os
from pathlib import Path
import re
import subprocess

root = Path.cwd()
folder = root / 'outputs/vocabulary-merge-20261107'
paths = [
    'richy/app/common/views/navs/header-hoz.html',
    'richy/app/question/business/QuestionService.js',
    'richy/app/topic/topic.module.js',
    'richy/app/topic/controllers/VocabularyDuplicateController.js',
    'richy/app/topic/views/vocabulary_duplicates.html',
    'richy/app/topic/vocabulary_duplicates.css',
    'richy/app/tests/vocabulary-duplicates.test.cjs',
    'richy/richy-api/src/main/java/com/globits/richy/dto/VocabularyDuplicateDto.java',
    'richy/richy-api/src/main/java/com/globits/richy/rest/RestVocabularyDuplicateController.java',
    'richy/richy-api/src/main/java/com/globits/richy/service/impl/VocabularyDuplicateService.java',
    'richy/richy-api/src/test/java/com/globits/richy/question/VocabularyDuplicatePersistenceTest.java',
]
index_path = 'richy/app/index.html'
env = dict(os.environ, GIT_INDEX_FILE=str(folder / 'merge.index'))
def git(*args):
    return subprocess.check_output(['git', *args], env=env)

parent = git('rev-parse', 'HEAD').decode().strip()
git('read-tree', parent)
git('-c', 'core.safecrlf=false', 'add', '--', *paths)
data = git('show', parent + ':' + index_path)
version = re.search(rb"window.APP_VERSION = '([^']+)';", data)
assert version and b'-vocab-merge-1' not in version[1]
data = data[:version.end(1)] + b'-vocab-merge-1' + data[version.end(1):]
candidate = folder / 'index-for-commit.html'
candidate.write_bytes(data)
blob = git('hash-object', '-w', '--no-filters', str(candidate)).decode().strip()
git('update-index', '--cacheinfo', '100644,' + blob + ',' + index_path)
staged = git('diff', '--cached', '--name-only').decode().splitlines()
assert set(staged) == set(paths + [index_path]), staged
git('-c', 'core.whitespace=cr-at-eol', 'diff', '--cached', '--check')
tree = git('write-tree').decode().strip()
(folder / 'commit-state.json').write_text(json.dumps({'parent': parent, 'tree': tree, 'paths': paths, 'indexPath': index_path}), encoding='utf8')
print(git('diff', '--cached', '--stat').decode())
print('Prepared parent:', parent)
print('Prepared tree:', tree)
