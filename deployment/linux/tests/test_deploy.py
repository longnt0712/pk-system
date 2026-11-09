import hashlib
import io
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest import mock
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import pk_deploy as deploy


def fixture_jar(path, major=52):
    nested = io.BytesIO()
    with zipfile.ZipFile(nested, 'w') as jar:
        jar.writestr('Sample.class', b'\xca\xfe\xba\xbe\0\0\0' + bytes([52]))
    with zipfile.ZipFile(path, 'w') as jar:
        jar.writestr('org/springframework/boot/loader/JarLauncher.class', b'loader')
        jar.writestr('BOOT-INF/classes/com/globits/richy/RichyApplication.class',
                     b'\xca\xfe\xba\xbe\0\0\0' + bytes([major]))
        jar.writestr('META-INF/MANIFEST.MF', 'Start-Class: com.globits.richy.RichyApplication\r\n')
        for name in ['core-api-1.jar', 'richy-api-1.jar']:
            jar.writestr('BOOT-INF/lib/' + name, nested.getvalue())


class FakeDeployer(deploy.Deployer):
    def __init__(self, root):
        settings = {key: str(root / key) for key in ['state', 'health_state', 'maintenance_lock', 'poll_lock', 'log', 'repo']}
        settings.update({'user': 'root', 'releases': str(root / 'releases'), 'jars': str(root / 'jars'),
                         'current': str(root / 'current'), 'jar': str(root / 'current.jar')})
        super().__init__(settings)
        pathlib.Path(self.c['log']).mkdir()
        self.events = []
        self.fail_jar = None
        self.fail_reload = False
        self.fail_build = False
        self.fake_signatures = ('front-new', 'back-new')

    def validate_frontend(self, candidate):
        self.events.append('validate')

    def stop_backend(self):
        self.events.append('stop')

    def start_backend(self):
        current = pathlib.Path(self.c['jar']).resolve()
        self.events.append('start-' + current.name)
        if current == self.fail_jar:
            raise RuntimeError('Simulated startup failure')

    def reload_frontend(self):
        self.events.append('reload')
        if self.fail_reload:
            self.fail_reload = False
            raise RuntimeError('Simulated reload failure')

    def check_live(self):
        self.events.append('check')

    def fetch(self):
        return 'a' * 40

    def source_files(self):
        return {'index.html': 'example'}

    def signatures(self, files):
        return self.fake_signatures

    def build(self, commit):
        self.events.append('build')
        if self.fail_build:
            raise RuntimeError('Simulated build failure')
        return pathlib.Path(self.c['jars']) / 'new.jar'

    def prepare_frontend(self, commit, files, previous_files):
        return pathlib.Path(self.c['releases']) / 'new'


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='pk-deploy-test-')
        self.root = pathlib.Path(self.directory.name)
        self.worker = FakeDeployer(self.root)
        for name in ['old', 'new']:
            (self.root / 'releases' / name / 'webroot').mkdir(parents=True)
        (self.root / 'jars').mkdir()
        for name in ['old.jar', 'new.jar']:
            (self.root / 'jars' / name).write_text(name)
        deploy.atomic_link(self.root / 'current', self.root / 'releases/old', self.root / 'releases')
        deploy.atomic_link(self.root / 'current.jar', self.root / 'jars/old.jar', self.root / 'jars')

    def tearDown(self):
        self.directory.cleanup()

    def assert_old_active(self):
        self.assertEqual((self.root / 'current').resolve(), self.root / 'releases/old')
        self.assertEqual((self.root / 'current.jar').resolve(), self.root / 'jars/old.jar')

    def test_success_stops_old_before_starting_new(self):
        with mock.patch.object(deploy, 'tcp_open', return_value=True):
            self.worker.activate(self.root / 'releases/new', self.root / 'jars/new.jar')
        self.assertEqual(self.worker.events, ['validate', 'stop', 'start-new.jar', 'reload', 'check'])

    def test_startup_failure_restores_backend_and_frontend(self):
        self.worker.fail_jar = self.root / 'jars/new.jar'
        with mock.patch.object(deploy, 'tcp_open', return_value=True):
            with self.assertRaisesRegex(RuntimeError, 'previous release restored'):
                self.worker.activate(self.root / 'releases/new', self.root / 'jars/new.jar')
        self.assert_old_active()
        self.assertIn('start-old.jar', self.worker.events)

    def test_nginx_failure_restores_both_releases(self):
        self.worker.fail_reload = True
        with mock.patch.object(deploy, 'tcp_open', return_value=True):
            with self.assertRaises(RuntimeError):
                self.worker.activate(self.root / 'releases/new', self.root / 'jars/new.jar')
        self.assert_old_active()

    def test_frontend_update_does_not_restart_java(self):
        self.worker.activate(frontend=self.root / 'releases/new')
        self.assertNotIn('stop', self.worker.events)
        self.assertNotIn('start-new.jar', self.worker.events)

    def test_dynamic_webroot_alias_follows_release_switch(self):
        alias = self.root / 'www'
        deploy.atomic_link(alias, self.root / 'current/webroot', self.root / 'releases')
        deploy.atomic_link(self.root / 'current', self.root / 'releases/new', self.root / 'releases')
        self.assertEqual(alias.resolve(), self.root / 'releases/new/webroot')

    def test_candidate_nginx_inlines_shared_locations_and_isolates_listeners(self):
        main = 'pid /run/nginx.pid; server { listen 443 ssl; include /etc/nginx/pk-web-locations.conf; } map $uri $x { include /srv/pk-system/current/static-paths.map; }'
        locations = 'root /srv/pk-system/www; alias /srv/pk-system/current/entries/$entry;'
        output = deploy.candidate_nginx_configuration(main, locations, '/srv/pk-system/releases/test')
        self.assertIn('listen 127.0.0.1:18443 ssl;', output)
        self.assertIn('root /srv/pk-system/releases/test/webroot;', output)
        self.assertIn('alias /srv/pk-system/releases/test/entries/', output)
        self.assertNotIn('/srv/pk-system/current', output)
        self.assertNotIn('include /etc/nginx/pk-web-locations.conf;', output)

    def test_external_link_targets_and_source_symlinks_are_rejected(self):
        with self.assertRaises(ValueError):
            deploy.atomic_link(self.root / 'current', self.root, self.root / 'releases')
        (self.root / 'releases/new/webroot/link').symlink_to(self.root)
        with self.assertRaises(ValueError):
            deploy.checked_path(self.root / 'releases/new/webroot', 'link/data')
        for name in ['../data', '/etc/shadow', 'folder/../../data', 'a\\b', 'C:/data']:
            with self.assertRaises(ValueError):
                deploy.relative_parts(name)

    def test_build_failure_preserves_live_release_and_blocks_repeat(self):
        deploy.atomic_json(self.worker.c['state'], {'frontend_signature': 'front-old', 'backend_signature': 'back-old'})
        self.worker.fail_build = True
        with self.assertRaises(RuntimeError):
            self.worker.poll()
        self.assert_old_active()
        self.worker.events.clear()
        self.worker.poll()
        self.assertEqual(self.worker.events, [])
        state = deploy.read_json(self.worker.c['state'])
        self.assertEqual(state['backend_signature'], 'back-old')
        self.assertIn('failed_signature', state)

    def test_same_source_does_not_build_or_restart(self):
        deploy.atomic_json(self.worker.c['state'], {'frontend_signature': 'front-new', 'backend_signature': 'back-new'})
        self.worker.poll()
        self.assertEqual(self.worker.events, [])

    def test_file_lock_excludes_a_second_operation(self):
        with deploy.lock(self.worker.c['maintenance_lock']):
            with self.assertRaises(TimeoutError):
                with deploy.lock(self.worker.c['maintenance_lock']):
                    self.fail('Lock was acquired twice')

    def test_watchdog_requires_three_failures_and_limits_restarts(self):
        process = mock.Mock(returncode=0)
        with mock.patch.object(deploy.subprocess, 'run', return_value=process), \
                mock.patch.object(deploy, 'backend_health', return_value=False), \
                mock.patch.object(deploy, 'tcp_open', return_value=True):
            self.worker.healthcheck()
            self.worker.healthcheck()
            self.assertEqual(self.worker.events, [])
            self.worker.healthcheck()
            self.assertEqual(self.worker.events, ['stop', 'start-old.jar'])
            self.worker.events.clear()
            for _ in range(4):
                self.worker.healthcheck()
            self.assertEqual(self.worker.events, [])

    def test_watchdog_leaves_service_running_if_sql_tunnel_is_down(self):
        deploy.atomic_json(self.worker.c['health_state'], {'failures': 10})
        with mock.patch.object(deploy.subprocess, 'run', return_value=mock.Mock(returncode=0)), \
                mock.patch.object(deploy, 'backend_health', return_value=False), \
                mock.patch.object(deploy, 'tcp_open', return_value=False):
            self.worker.healthcheck()
        self.assertEqual(self.worker.events, [])

    def test_java_version_and_required_libraries_are_verified(self):
        jar = self.root / 'test.jar'
        fixture_jar(jar)
        self.assertEqual(deploy.validate_jar(jar), deploy.digest(jar))
        fixture_jar(jar, major=61)
        with self.assertRaises(ValueError):
            deploy.validate_jar(jar)

    def test_git_blob_hash_matches_git_object_format(self):
        path = self.root / 'sample'
        path.write_bytes(b'example\n')
        self.assertEqual(deploy.git_blob_hash(path), hashlib.sha1(b'blob 8\0example\n').hexdigest())

    def test_frontend_copy_keeps_runtime_files_and_never_edits_old_hardlinks(self):
        old = self.root / 'releases/old/webroot'
        index = '<html><head><title>IELTS Room</title><meta name="robots" content="index, follow"><link id="site-canonical" href="https://ieltsroom.com"></head><body>OLD</body></html>'
        (old / 'index.html').write_text(index)
        (old / 'application.js').write_text('unchanged')
        (old / 'runtime.mp3').write_bytes(b'private-runtime-fixture')
        (old / 'obsolete.js').write_text('obsolete tracked file')
        (old / 'APPLICATION.JS').write_text('unchanged')
        (old / 'application.js').unlink()
        source = self.root / 'repo/richy/app'
        source.mkdir(parents=True)
        (source / 'index.html').write_text(index.replace('OLD', 'NEW'))
        (source / 'application.js').write_text('unchanged')
        configuration = ET.Element('configuration')
        rules = ET.SubElement(ET.SubElement(ET.SubElement(configuration, 'system.webServer'), 'rewrite'), 'outboundRules')
        for condition, pattern, value in [
                ('TnttHtmlResponse', '<title>[^<]+</title>', '<title>TNTT Phùng Khoang | Thiếu Nhi Thánh Thể Phùng Khoang</title>'),
                ('PrivateAppHtmlResponse', '<meta name="robots" content="[^"]*">', '<meta name="robots" content="noindex, nofollow">'),
                ('PrivateAppHtmlResponse', '<link id="site-canonical"[^>]*>', '')]:
            rule = ET.SubElement(rules, 'rule', preCondition=condition)
            ET.SubElement(rule, 'match', filterByTags='None', pattern=pattern)
            ET.SubElement(rule, 'action', value=value)
        rules_file = self.root / 'rules.xml'
        ET.ElementTree(configuration).write(rules_file, encoding='utf-8')
        self.worker.c['rules'] = str(rules_file)
        files = {name: deploy.git_blob_hash(source / name) for name in ['index.html', 'application.js']}
        previous_umask = os.umask(0o077)
        try:
            candidate = deploy.Deployer.prepare_frontend(self.worker, 'a' * 40, files,
                                                         ['index.html', 'application.js', 'obsolete.js'])
        finally:
            os.umask(previous_umask)
        self.assertEqual(candidate.stat().st_mode & 0o777, 0o750)
        self.assertEqual((candidate / 'entries').stat().st_mode & 0o777, 0o750)
        self.assertIn('OLD', (old / 'index.html').read_text())
        self.assertIn('NEW', (candidate / 'webroot/index.html').read_text())
        self.assertTrue((old / 'obsolete.js').exists())
        self.assertFalse((candidate / 'webroot/obsolete.js').exists())
        self.assertEqual((candidate / 'webroot/runtime.mp3').read_bytes(), b'private-runtime-fixture')
        self.assertEqual((old / 'runtime.mp3').stat().st_ino, (candidate / 'webroot/runtime.mp3').stat().st_ino)
        self.assertTrue((old / 'APPLICATION.JS').exists())
        self.assertFalse((candidate / 'webroot/APPLICATION.JS').exists())
        self.assertEqual((candidate / 'webroot/application.js').read_text(), 'unchanged')
        self.assertNotEqual((old / 'index.html').stat().st_ino, (candidate / 'webroot/index.html').stat().st_ino)


if __name__ == '__main__':
    unittest.main(verbosity=2)
