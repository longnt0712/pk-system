#!/usr/bin/python3
"""Pull/build as an unprivileged user; activate releases through existing systemd units."""
import argparse
import contextlib
import fcntl
import grp
import hashlib
import html.parser
import http.client
import json
import os
import pathlib
import pwd
import re
import shutil
import socket
import ssl
import subprocess
import sys
import time
import urllib.parse
import uuid
import zipfile

from render_frontend import render

DOMAINS = ('ieltsroom.com', 'tnttphungkhoang.com')
DEFAULT = {
    'repo': '/var/lib/pk-deploy/source',
    'repository': 'https://github.com/longnt0712/pk-system.git',
    'branch': 'main',
    'user': 'pk-deploy',
    'state': '/var/lib/pk-deploy-control/deploy-state.json',
    'health_state': '/var/lib/pk-deploy-control/health-state.json',
    'releases': '/srv/pk-system/releases',
    'current': '/srv/pk-system/current',
    'jars': '/opt/pk-system/releases',
    'jar': '/opt/pk-system/current.jar',
    'rules': '/etc/pk-deploy/iis-web.config',
    'maven_settings': '/etc/pk-deploy/maven-settings.xml',
    'log': '/var/log/pk-deploy',
    'maintenance_lock': '/run/lock/pk-system-maintenance.lock',
    'poll_lock': '/run/lock/pk-system-poll.lock',
    'nginx_config': '/etc/nginx/nginx.conf',
    'nginx_locations': '/etc/nginx/pk-web-locations.conf',
    'java_home': '/usr/lib/jvm/java-8-openjdk-amd64',
}


def log(message):
    print(time.strftime('%Y-%m-%dT%H:%M:%S%z') + ' ' + message, flush=True)


def digest(path):
    result = hashlib.sha256()
    with pathlib.Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def git_blob_hash(path):
    path = pathlib.Path(path)
    result = hashlib.sha1(('blob ' + str(path.stat().st_size) + '\0').encode())
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def atomic_json(path, value):
    path = pathlib.Path(path)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temporary.chmod(0o600)
    os.replace(temporary, path)


def read_json(path):
    path = pathlib.Path(path)
    return json.loads(path.read_text()) if path.exists() else {}


def relative_parts(name):
    parts = pathlib.PurePosixPath(name).parts
    if not parts or name.startswith('/') or '\\' in name or ':' in name or any(p in ('.', '..') for p in parts):
        raise ValueError('Unsafe source path')
    return parts


def checked_path(root, name):
    root = pathlib.Path(root).resolve()
    target = root.joinpath(*relative_parts(name))
    if not target.resolve().is_relative_to(root):
        raise ValueError('Path escapes release root')
    cursor = root
    for part in relative_parts(name):
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError('Symlink in managed source path')
    return target


def atomic_link(link, target, allowed):
    link, target, allowed = pathlib.Path(link), pathlib.Path(target).absolute(), pathlib.Path(allowed).resolve()
    if not target.exists() or not target.resolve().is_relative_to(allowed):
        raise ValueError('Release target is outside the managed directory')
    if link.exists() and not link.is_symlink():
        raise ValueError('Refusing to replace a regular file/directory with a release link')
    temporary = link.with_name('.' + link.name + '-' + uuid.uuid4().hex)
    temporary.symlink_to(target)
    os.replace(temporary, link)


@contextlib.contextmanager
def lock(path, timeout=0):
    with open(path, 'a+') as stream:
        deadline = time.monotonic() + timeout
        while True:
            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError('Another maintenance operation owns the lock')
                time.sleep(0.2)
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def tcp_open(port):
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=2):
            return True
    except OSError:
        return False


def backend_health():
    connection = http.client.HTTPConnection('127.0.0.1', 8085, timeout=5)
    try:
        connection.request('GET', '/service/public/battle-online-ws/info')
        response = connection.getresponse()
        return response.status == 200 and json.loads(response.read(16384)).get('websocket') is True
    except (OSError, ValueError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def wait_backend(seconds=150):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if backend_health():
            return
        time.sleep(2)
    raise RuntimeError('Backend HTTP readiness timed out')


def https_get(domain, path='/', port=443, headers=None, method='GET'):
    connection = http.client.HTTPSConnection(domain, port, timeout=15)
    connection.sock = ssl.create_default_context().wrap_socket(
        socket.create_connection(('127.0.0.1', port), timeout=15), server_hostname=domain)
    try:
        connection.request(method, path, headers={'Host': domain, **(headers or {})})
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


class EntryAssets(html.parser.HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.assets = []
        self.feed(content)

    def handle_starttag(self, tag, attributes):
        value = dict(attributes)
        source = value.get('src') if tag == 'script' else value.get('href') if tag == 'link' and value.get('rel') == 'stylesheet' else None
        if source and not source.startswith(('http:', 'https:', '//', 'data:')):
            self.assets.append('/' + source.lstrip('/'))


def smoke_frontend(port, full=False, webroot=None):
    for domain in DOMAINS:
        status, headers, body = https_get(domain, port=port)
        if status != 200 or b'<html' not in body.lower() or 'no-cache' not in headers.get('Cache-Control', ''):
            raise RuntimeError('Public entry readiness failed: ' + domain)
        if domain == DOMAINS[1] and b'TNTT' not in body:
            raise RuntimeError('TNTT domain metadata missing')
        status, headers, private = https_get(domain, '/dashboard', port)
        if status != 200 or b'noindex, nofollow' not in private:
            raise RuntimeError('Private entry metadata failed')
        for path in ['/WEB.CONFIG', '/.git/config']:
            if https_get(domain, path, port)[0] != 404:
                raise RuntimeError('Private static file became accessible')
        if https_get(domain, '/service/public/battle-online-ws/info', port)[0] != 200:
            raise RuntimeError('HTTPS backend readiness failed')
        if full:
            for asset in sorted(set(EntryAssets(body.decode('utf-8')).assets)):
                code, asset_headers, data = https_get(domain, asset, port)
                if code != 200 or not data:
                    raise RuntimeError('Missing entry asset: ' + asset)
                extension = urllib.parse.urlsplit(asset).path.lower()
                mime = asset_headers.get('Content-Type', '')
                if extension.endswith('.js') and 'javascript' not in mime or extension.endswith('.css') and 'text/css' not in mime:
                    raise RuntimeError('Incorrect entry asset content type')
    if full and webroot:
        audio = next(iter(sorted(pathlib.Path(webroot).rglob('*.mp3'))), None)
        if audio:
            path = '/' + audio.relative_to(webroot).as_posix()
            status, headers, data = https_get(DOMAINS[0], urllib.parse.quote(path), port, {'Range': 'bytes=0-15'})
            with audio.open('rb') as stream:
                expected = stream.read(16)
            if status != 206 or data != expected:
                raise RuntimeError('Audio byte-range readiness failed')


def validate_jar(path):
    with zipfile.ZipFile(path) as jar:
        names = jar.namelist()
        required = ['org/springframework/boot/loader/JarLauncher.class',
                    'BOOT-INF/classes/com/globits/richy/RichyApplication.class', 'META-INF/MANIFEST.MF']
        if not all(name in names for name in required):
            raise ValueError('Not the expected executable backend JAR')
        manifest = jar.read('META-INF/MANIFEST.MF').decode('utf-8').replace('\r\n ', '')
        if 'Start-Class: com.globits.richy.RichyApplication' not in manifest:
            raise ValueError('Unexpected backend main class')
        for library in ['core-api-', 'richy-api-']:
            if sum(name.startswith('BOOT-INF/lib/' + library) and name.endswith('.jar') for name in names) != 1:
                raise ValueError('Backend library missing/duplicated')
        for name in names:
            if name.startswith('BOOT-INF/classes/') and name.endswith('.class'):
                header = jar.read(name)[:8]
                if len(header) != 8 or header[:4] != b'\xca\xfe\xba\xbe' or int.from_bytes(header[6:8], 'big') > 52:
                    raise ValueError('Backend class is incompatible with Java 8')
    return digest(path)


def candidate_nginx_configuration(configuration, locations, candidate):
    configuration = configuration.replace('include /etc/nginx/pk-web-locations.conf;', locations)
    configuration = configuration.replace('/srv/pk-system/current', str(candidate))
    configuration = configuration.replace('/srv/pk-system/www', str(pathlib.Path(candidate) / 'webroot'))
    configuration = configuration.replace('pid /run/nginx.pid;', 'pid /run/pk-system-nginx-candidate.pid;')
    configuration = configuration.replace('listen 80', 'listen 127.0.0.1:18081')
    configuration = configuration.replace('listen 443', 'listen 127.0.0.1:18443')
    configuration = re.sub(r'error_log [^;]+;', 'error_log /var/log/pk-deploy/nginx-candidate.log warn;', configuration)
    return re.sub(r'access_log [^;]+;', 'access_log off;', configuration)


class Deployer:
    def __init__(self, settings=None):
        self.c = {**DEFAULT, **(settings or {})}
        self.repo = pathlib.Path(self.c['repo'])
        self.account = pwd.getpwnam(self.c['user'])

    def git(self, arguments):
        command = ['runuser', '-u', self.c['user'], '--', 'git', '-c', 'credential.helper=',
                   '-c', 'core.hooksPath=/dev/null', '-C', str(self.repo)] + arguments
        result = subprocess.run(command, capture_output=True, timeout=180)
        if result.returncode:
            raise RuntimeError('Git operation failed; credentials/source output suppressed')
        return result.stdout

    def fetch(self):
        if self.git(['remote', 'get-url', 'origin']).decode().strip() != self.c['repository']:
            raise ValueError('Unexpected source repository')
        self.git(['fetch', '--quiet', '--depth=1', 'origin', self.c['branch']])
        target = self.git(['rev-parse', 'FETCH_HEAD']).decode().strip()
        if not re.fullmatch('[a-f0-9]{40}', target):
            raise ValueError('Unexpected commit identity')
        self.git(['reset', '--quiet', '--hard', target])
        self.git(['clean', '-q', '-ffdx'])  # Dedicated disposable checkout, never application data.
        return target

    def source_files(self):
        files = {}
        for record in self.git(['ls-tree', '-rz', '--full-tree', 'HEAD', '--', 'richy/app']).split(b'\0'):
            if not record:
                continue
            metadata, name = record.split(b'\t', 1)
            mode, kind, oid = metadata.decode().split()
            name = name.decode('utf-8')
            relative = name[len('richy/app/'):]
            parts = relative_parts(relative)
            if relative.lower() == 'web.config':
                continue  # Windows routing configuration is not a Linux runtime update.
            if any(part.startswith('.') or part in ('tests', 'node_modules') for part in parts):
                continue
            if mode not in ('100644', '100755') or kind != 'blob':
                raise ValueError('Unsupported frontend source file type')
            files[relative] = oid
        if 'index.html' not in files or 'application.js' not in files:
            raise ValueError('Frontend source entry missing')
        return files

    def signatures(self, files):
        frontend = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
        trees = []
        for path in ['core/pom.xml', 'core/core-api', 'richy/pom.xml', 'richy/richy-api', 'richy/richy-app']:
            trees.append(self.git(['rev-parse', 'HEAD:' + path]).decode().strip())
        backend = hashlib.sha256('|'.join(trees).encode()).hexdigest()
        return frontend, backend

    def build(self, commit):
        log_path = pathlib.Path(self.c['log']) / ('build-' + commit[:12] + '.log')
        environment = os.environ.copy()
        environment.update({'JAVA_HOME': self.c['java_home'], 'HOME': self.account.pw_dir,
                            'MAVEN_OPTS': '-Xmx384m -XX:MaxMetaspaceSize=192m -Dfile.encoding=UTF-8',
                            'GIT_TERMINAL_PROMPT': '0'})
        common = ['runuser', '-u', self.c['user'], '--', 'mvn', '-B', '-ntp', '-s', self.c['maven_settings'],
                  '-Dmaven.repo.local=/var/cache/pk-deploy/m2', '-Dmaven.test.skip=true',
                  '-Dassembly.skipAssembly=true']  # Only the Spring Boot executable is deployed.
        with log_path.open('w') as stream:
            log_path.chmod(0o600)
            for pom, parameters in [('core/pom.xml', ['-pl', 'core-api', '-am', 'clean', 'install']),
                                    ('richy/pom.xml', ['clean', 'package'])]:
                result = subprocess.run(common + ['-f', str(self.repo / pom)] + parameters,
                                        env=environment, cwd=self.repo, stdout=stream, stderr=subprocess.STDOUT,
                                        timeout=1500)
                if result.returncode:
                    raise RuntimeError('Backend build failed; live application unchanged; inspect ' + str(log_path))
        source = self.repo / 'richy/richy-app/target/richy-wine-exec.jar'
        sha = validate_jar(source)
        target = pathlib.Path(self.c['jars']) / ('auto-' + commit[:12] + '-' + sha[:12] + '.jar')
        if not target.exists():
            temporary = target.with_suffix('.tmp')
            shutil.copyfile(source, temporary)
            if digest(temporary) != sha:
                raise RuntimeError('Backend changed during staging copy')
            os.chown(temporary, 0, grp.getgrnam('pk-system').gr_gid)
            temporary.chmod(0o640)
            os.replace(temporary, target)
        elif digest(target) != sha:
            raise RuntimeError('Existing backend release checksum mismatch')
        return target

    def prepare_frontend(self, commit, files, previous_files):
        current = pathlib.Path(self.c['current']).resolve()
        candidate = pathlib.Path(self.c['releases']) / ('auto-' + time.strftime('%Y%m%d-%H%M%S') + '-' + commit[:12])
        if candidate.exists():
            raise RuntimeError('Frontend release already exists')
        candidate.mkdir(mode=0o750)
        os.chown(candidate, 0, grp.getgrnam('www-data').gr_gid)
        candidate.chmod(0o750)
        subprocess.run(['cp', '-al', str(current / 'webroot'), str(candidate / 'webroot')], check=True)
        existing_case = {}
        for path in (candidate / 'webroot').rglob('*'):
            if path.is_symlink():
                raise ValueError('Symlink in existing frontend release')
            if path.is_file():
                relative = path.relative_to(candidate / 'webroot').as_posix()
                folded = relative.lower()
                if folded in existing_case:
                    raise ValueError('Ambiguous existing static filename casing')
                existing_case[folded] = relative
        for name in sorted(set(previous_files) - set(files)):
            path = checked_path(candidate / 'webroot', name)
            if path.exists():
                if not path.is_file():
                    raise ValueError('Unexpected type for removed source file')
                path.unlink()
        for name, oid in files.items():
            source = checked_path(self.repo / 'richy/app', name)
            target = checked_path(candidate / 'webroot', name)
            if not source.is_file():
                raise ValueError('Tracked frontend source missing')
            if git_blob_hash(source) != oid:
                raise RuntimeError('Source file changed after checkout')
            old_case = existing_case.get(name.lower())
            if old_case and old_case != name:
                old_path = checked_path(candidate / 'webroot', old_case)
                if old_path.exists():
                    old_path.unlink()  # New stage only; preserve the previous release inode.
            if target.is_file() and digest(target) == digest(source):
                continue
            target.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
            temporary = target.with_name('.pkdeploy-' + uuid.uuid4().hex)
            shutil.copyfile(source, temporary)
            os.chown(temporary, 0, grp.getgrnam('www-data').gr_gid)
            temporary.chmod(0o640)
            os.replace(temporary, target)
            parent = target.parent
            while parent != candidate:
                os.chown(parent, 0, grp.getgrnam('www-data').gr_gid)
                parent.chmod(0o750)
                parent = parent.parent
        render(candidate, self.c['rules'])
        return candidate

    def validate_frontend(self, candidate):
        configuration = pathlib.Path(self.c['nginx_config']).read_text()
        locations = pathlib.Path(self.c['nginx_locations']).read_text()
        configuration = candidate_nginx_configuration(configuration, locations, candidate)
        path = pathlib.Path(self.c['log']) / 'nginx-candidate.conf'
        path.write_text(configuration)
        path.chmod(0o600)
        subprocess.run(['nginx', '-t', '-c', str(path)], check=True, capture_output=True)
        subprocess.run(['nginx', '-c', str(path)], check=True, capture_output=True)
        try:
            smoke_frontend(18443, full=True, webroot=candidate / 'webroot')
        finally:
            subprocess.run(['nginx', '-s', 'quit', '-c', str(path)], check=True, capture_output=True)

    def stop_backend(self):
        subprocess.run(['systemctl', 'stop', 'pk-system'], check=True, timeout=80)
        if tcp_open(8085):
            raise RuntimeError('Backend port remains occupied after systemd stop')

    def start_backend(self):
        subprocess.run(['systemctl', 'start', 'pk-system'], check=True, timeout=30)
        wait_backend()

    def reload_frontend(self):
        subprocess.run(['nginx', '-t'], check=True, capture_output=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True, timeout=30)

    def check_live(self):
        smoke_frontend(443)

    def prune(self, state):
        protected = {str(pathlib.Path(self.c['current']).resolve()), str(pathlib.Path(self.c['jar']).resolve()),
                     state.get('previous_frontend'), state.get('previous_backend')}
        for key, expression, directory in [('releases', r'auto-\d{8}-\d{6}-[a-f0-9]{12}', True),
                                            ('jars', r'auto-[a-f0-9]{12}-[a-f0-9]{12}\.jar', False)]:
            root = pathlib.Path(self.c[key]).resolve()
            candidates = sorted((path for path in root.iterdir() if re.fullmatch(expression, path.name)
                                 and not path.is_symlink()), key=lambda path: path.stat().st_mtime, reverse=True)
            for path in candidates[3:]:
                if str(path.resolve()) in protected or not path.resolve().is_relative_to(root):
                    continue
                if directory:
                    shutil.rmtree(path)
                else:
                    path.unlink()
        logs = sorted(pathlib.Path(self.c['log']).glob('build-*.log'), key=lambda path: path.stat().st_mtime, reverse=True)
        for path in logs[20:]:
            if re.fullmatch(r'build-[a-f0-9]{12}\.log', path.name) and not path.is_symlink():
                path.unlink()

    def activate(self, frontend=None, jar=None):
        old_front = pathlib.Path(self.c['current']).resolve()
        old_jar = pathlib.Path(self.c['jar']).resolve()
        stopped = False
        try:
            if frontend:
                self.validate_frontend(frontend)
            if jar:
                if not tcp_open(11433):
                    raise RuntimeError('SQL tunnel is unavailable; backend deployment postponed')
                self.stop_backend()
                stopped = True
                atomic_link(self.c['jar'], jar, self.c['jars'])
                self.start_backend()
            if frontend:
                atomic_link(self.c['current'], frontend, self.c['releases'])
                self.reload_frontend()
            self.check_live()
        except Exception as original:
            log('ACTIVATION_FAILED ' + type(original).__name__ + ': ' + str(original) + '; restoring previous release')
            try:
                if stopped:
                    self.stop_backend()
                    atomic_link(self.c['jar'], old_jar, self.c['jars'])
                    self.start_backend()
                if frontend:
                    atomic_link(self.c['current'], old_front, self.c['releases'])
                    self.reload_frontend()
                self.check_live()
            except Exception as rollback:
                raise RuntimeError('Activation and rollback failed; operator attention required') from rollback
            raise RuntimeError('New release rejected; previous release restored') from original

    def poll(self, bootstrap=False, retry=False, verify_build=False):
        with lock(self.c['poll_lock']):
            commit = self.fetch()
            files = self.source_files()
            front_sig, back_sig = self.signatures(files)
            state = read_json(self.c['state'])
            if bootstrap:
                if state:
                    raise ValueError('Deployment baseline already exists')
                built = self.build(commit) if verify_build else None
                differences = [name for name in files if not checked_path(pathlib.Path(self.c['current']) / 'webroot', name).is_file()
                               or git_blob_hash(checked_path(pathlib.Path(self.c['current']) / 'webroot', name)) != files[name]]
                frontend = self.prepare_frontend(commit, files, []) if differences else None
                baseline = self.c.get('baseline_backend_signature', back_sig)
                changed_backend = baseline != back_sig
                if changed_backend and built is None:
                    built = self.build(commit)
                if frontend or changed_backend:
                    with lock(self.c['maintenance_lock'], timeout=600):
                        self.activate(frontend, built if changed_backend else None)
                state = {'commit': commit, 'frontend_signature': front_sig, 'backend_signature': back_sig,
                         'frontend_files': sorted(files), 'backend_sha256': digest(self.c['jar']),
                         'bootstrap_frontend_updates': len(differences),
                         'bootstrap_backend_changed': changed_backend}
                if verify_build:
                    state['verified_build_commit'] = commit
                atomic_json(self.c['state'], state)
                log('BASELINE_READY ' + commit)
                return
            if not state:
                raise ValueError('Initialize the verified migration baseline before enabling polling')
            changed_front = state.get('frontend_signature') != front_sig
            changed_back = state.get('backend_signature') != back_sig
            signature = front_sig + ':' + back_sig
            if not changed_front and not changed_back:
                return
            if state.get('failed_signature') == signature and not retry:
                return
            try:
                jar = self.build(commit) if changed_back else None
                frontend = self.prepare_frontend(commit, files, state.get('frontend_files', [])) if changed_front else None
                with lock(self.c['maintenance_lock'], timeout=600):
                    previous_front = str(pathlib.Path(self.c['current']).resolve())
                    previous_jar = str(pathlib.Path(self.c['jar']).resolve())
                    self.activate(frontend, jar)
                    state.update({'commit': commit, 'frontend_signature': front_sig, 'backend_signature': back_sig,
                                  'frontend_files': sorted(files), 'backend_sha256': digest(self.c['jar']),
                                  'deployed_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                                  'previous_frontend': previous_front, 'previous_backend': previous_jar})
                    state.pop('failed_signature', None)
                    state.pop('last_error', None)
                    atomic_json(self.c['state'], state)
                    try:
                        self.prune(state)
                    except OSError as error:
                        log('RETENTION_WARNING ' + type(error).__name__)
                log('DEPLOYMENT_OK ' + commit + ' frontend=' + str(changed_front) + ' backend=' + str(changed_back))
            except Exception as error:
                state.update({'failed_signature': signature, 'last_error': str(error), 'failed_commit': commit})
                atomic_json(self.c['state'], state)
                raise

    def scheduled_restart(self):
        with lock(self.c['maintenance_lock'], timeout=600):
            if not tcp_open(11433):
                raise RuntimeError('SQL tunnel unavailable; scheduled restart skipped')
            log('SCHEDULED_RESTART_START')
            self.stop_backend()
            self.start_backend()
            self.check_live()
            health = read_json(self.c['health_state'])
            health.update({'failures': 0, 'last_successful_restart': time.time()})
            atomic_json(self.c['health_state'], health)
            log('SCHEDULED_RESTART_OK')

    def healthcheck(self):
        try:
            with lock(self.c['maintenance_lock']):
                active = subprocess.run(['systemctl', 'is-active', '--quiet', 'pk-system']).returncode == 0
                if not active:
                    return
                health = read_json(self.c['health_state'])
                if backend_health():
                    if health.get('failures'):
                        health['failures'] = 0
                        atomic_json(self.c['health_state'], health)
                    return
                health['failures'] = health.get('failures', 0) + 1
                atomic_json(self.c['health_state'], health)
                log('HTTP_HEALTH_FAILURE count=' + str(health['failures']))
                now = time.time()
                recent = [stamp for stamp in health.get('recovery_restarts', []) if stamp > now - 86400]
                if health['failures'] < 3 or not tcp_open(11433) or len(recent) >= 3 or now - health.get('last_successful_restart', 0) < 900:
                    return
                health['recovery_restarts'] = recent + [now]
                atomic_json(self.c['health_state'], health)
                self.stop_backend()
                self.start_backend()
                health.update({'failures': 0, 'last_successful_restart': time.time()})
                atomic_json(self.c['health_state'], health)
                log('HTTP_HEALTH_RECOVERY_OK')
        except TimeoutError:
            return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['poll', 'restart', 'healthcheck', 'bootstrap'])
    parser.add_argument('--config', default='/etc/pk-deploy/settings.json')
    parser.add_argument('--retry', action='store_true')
    parser.add_argument('--verify-build', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise PermissionError('Run deployment control through its root systemd unit')
    deployer = Deployer(read_json(args.config))
    if args.mode in ('poll', 'bootstrap'):
        deployer.poll(bootstrap=args.mode == 'bootstrap', retry=args.retry, verify_build=args.verify_build)
    elif args.mode == 'restart':
        deployer.scheduled_restart()
    else:
        deployer.healthcheck()


if __name__ == '__main__':
    try:
        main()
    except TimeoutError as error:
        log('MAINTENANCE_BUSY ' + str(error))
        sys.exit(75)
    except Exception as error:
        log('FAILED ' + type(error).__name__ + ': ' + str(error))
        cause = error.__cause__
        while cause is not None:
            log('CAUSE ' + type(cause).__name__ + ': ' + str(cause))
            cause = cause.__cause__
        sys.exit(1)
