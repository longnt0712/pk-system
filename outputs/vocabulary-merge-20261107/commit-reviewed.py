import json
from pathlib import Path
import re
import subprocess

folder = Path.cwd() / 'outputs/vocabulary-merge-20261107'
state = json.loads((folder / 'commit-state.json').read_text(encoding='utf8'))
def git(*args):
    return subprocess.check_output(['git', *args])

assert git('symbolic-ref', 'HEAD').decode().strip() == 'refs/heads/main'
assert git('rev-parse', 'HEAD').decode().strip() == state['parent'], 'HEAD moved; prepare and review again'
message = folder / 'commit-message.txt'
message.write_text('Add scoped duplicate vocabulary review and transactional merge\n\n'
    'List same-word groups in the current account, review all topic memberships,\n'
    'choose the canonical card and merge distinct meanings with slash separators.\n'
    'Transfer topic/category links and retain saved answer IDs in one transaction;\n'
    'reject changed previews, foreign cards and direct test/assignment roots.\n\n'
    'Validation: 26 Java checks and 13 Node checks passed. No schema changes.\n', encoding='utf8')
commit = git('commit-tree', state['tree'], '-p', state['parent'], '-F', str(message)).decode().strip()
git('update-ref', 'refs/heads/main', commit, state['parent'])
# The shared default index is not used to create this commit. Update only our
# paths, retaining any staged cache token or other files owned by the TNTT chat.
git('reset', '-q', 'HEAD', '--', *state['paths'])
index_path = state['indexPath']
for attempt in range(5):
    data = git('show', ':' + index_path)
    version = re.search(rb"window.APP_VERSION = '([^']+)';", data)
    assert version
    if b'-vocab-merge-1' in version[1]:
        break
    adjusted = data[:version.end(1)] + b'-vocab-merge-1' + data[version.end(1):]
    candidate = folder / 'index-for-shared-staging.html'
    candidate.write_bytes(adjusted)
    blob = git('hash-object', '-w', '--no-filters', str(candidate)).decode().strip()
    if git('show', ':' + index_path) != data:
        continue
    git('update-index', '--cacheinfo', '100644,' + blob + ',' + index_path)
    break
else:
    raise RuntimeError('Shared cache staging changed repeatedly; inspect index')
changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines()
assert set(changed) == set(state['paths'] + [index_path]), changed
(folder / 'commit.txt').write_text(commit + '\n', encoding='ascii')
print(git('show', '--stat', '--oneline', commit).decode())
print('Default staged paths retained:', git('diff', '--cached', '--name-only').decode())
