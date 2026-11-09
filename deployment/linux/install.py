#!/usr/bin/python3
"""Install/update the Linux deployment runtime. Enabling timers is a separate step."""
import argparse
import grp
import json
import os
import pathlib
import pwd
import re
import shutil
import subprocess
import sys

from pk_deploy import DEFAULT, atomic_link, atomic_json, digest, validate_jar
from render_frontend import render


def put(path, content, mode=0o644):
    path = pathlib.Path(path)
    temporary = path.with_name(path.name + '.pk-install.tmp')
    temporary.write_text(content, encoding='utf-8')
    temporary.chmod(mode)
    os.replace(temporary, path)


def prepare(baseline):
    if os.geteuid() != 0 or subprocess.check_output(['hostname'], text=True).strip() != '163-44-193-27':
        raise RuntimeError('Run installer as root on the intended Linux VPS')
    if not re.fullmatch('[a-f0-9]{64}', baseline):
        raise ValueError('Verified migration source baseline is required')
    backup = pathlib.Path('/root/pk-automation-20261103/installation-backup')
    backup.mkdir(mode=0o700, exist_ok=True)
    for directory in ['/etc/pk-deploy', '/usr/local/lib/pk-deploy', '/var/lib/pk-deploy-control', '/var/log/pk-deploy']:
        path = pathlib.Path(directory)
        path.mkdir(mode=0o755 if directory == '/usr/local/lib/pk-deploy' else 0o700, exist_ok=True)
        os.chown(path, 0, 0)
        path.chmod(0o755 if directory == '/usr/local/lib/pk-deploy' else 0o700)
    account = pwd.getpwnam('pk-deploy')
    os.chown('/etc/pk-deploy', 0, account.pw_gid)
    pathlib.Path('/etc/pk-deploy').chmod(0o750)
    cache = pathlib.Path('/var/cache/pk-deploy/m2')
    cache.mkdir(mode=0o700, exist_ok=True)
    os.chown(cache, account.pw_uid, account.pw_gid)
    subprocess.run(['runuser', '-u', 'pk-deploy', '--', 'git', '-c', 'credential.helper=',
                    '-c', 'core.hooksPath=/dev/null', '-C', DEFAULT['repo'], 'sparse-checkout', 'set',
                    'core', 'richy/richy-api', 'richy/richy-app', 'richy/app'], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    for name in ['pk_deploy.py', 'render_frontend.py']:
        target = pathlib.Path('/usr/local/lib/pk-deploy') / name
        shutil.copyfile(pathlib.Path(__file__).parent / name, target)
        target.chmod(0o644)
    settings = {**DEFAULT, 'baseline_backend_signature': baseline}
    atomic_json('/etc/pk-deploy/settings.json', settings)
    put('/etc/pk-deploy/maven-settings.xml', '''<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
<mirrors>
<mirror><id>pk-https-central</id><mirrorOf>central</mirrorOf><url>https://repo.maven.apache.org/maven2/</url></mirror>
<mirror><id>pk-https-legacy</id><mirrorOf>external:http:*</mirrorOf><url>https://repo.maven.apache.org/maven2/</url></mirror>
</mirrors></settings>
''', 0o644)
    os.chown('/etc/pk-deploy/maven-settings.xml', 0, account.pw_gid)
    pathlib.Path('/etc/pk-deploy/maven-settings.xml').chmod(0o640)
    if not pathlib.Path('/etc/pk-deploy/iis-web.config').exists():
        shutil.copyfile('/srv/pk-transfer/incoming/live-web.config', '/etc/pk-deploy/iis-web.config')
        pathlib.Path('/etc/pk-deploy/iis-web.config').chmod(0o600)
    current = pathlib.Path(DEFAULT['current'])
    web_link = pathlib.Path('/srv/pk-system/www')
    if not current.exists():
        original = web_link.resolve()
        if not original.is_relative_to(pathlib.Path(DEFAULT['releases'])) or original.name != 'webroot':
            raise ValueError('Unexpected migrated webroot')
        release = original.parent
        render(release, '/etc/pk-deploy/iis-web.config')
        atomic_link(current, release, DEFAULT['releases'])
        atomic_link(web_link, current / 'webroot', DEFAULT['releases'])
    nginx = pathlib.Path(DEFAULT['nginx_config'])
    saved = backup / 'nginx.conf'
    if not saved.exists():
        shutil.copyfile(nginx, saved)
        saved.chmod(0o600)
    original = nginx.read_text()
    locations = pathlib.Path(DEFAULT['nginx_locations'])
    original_locations = locations.read_text()
    saved_locations = backup / 'pk-web-locations.conf'
    if not saved_locations.exists():
        shutil.copyfile(locations, saved_locations)
        saved_locations.chmod(0o600)
    updated = original.replace('/etc/nginx/pk-static-paths.map', '/srv/pk-system/current/static-paths.map')
    updated_locations = original_locations.replace('/srv/pk-system/entries/', '/srv/pk-system/current/entries/')
    if '/srv/pk-system/current/static-paths.map' not in updated or '/srv/pk-system/current/entries/' not in updated_locations:
        raise ValueError('Expected Nginx layout is missing')
    put(nginx, updated)
    put(locations, updated_locations)
    try:
        subprocess.run(['nginx', '-t'], check=True, capture_output=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        put(nginx, original)
        put(locations, original_locations)
        raise
    jar_link = pathlib.Path(DEFAULT['jar'])
    if not jar_link.exists():
        initial = pathlib.Path('/opt/pk-system/releases/richy-wine-exec-20261101.jar')
        validate_jar(initial)
        atomic_link(jar_link, initial, DEFAULT['jars'])
    dropin = pathlib.Path('/etc/systemd/system/pk-system.service.d')
    dropin.mkdir(mode=0o755, exist_ok=True)
    put(dropin / '20-auto-deploy.conf', '''[Service]
ExecStart=
ExecStart=/usr/bin/java -Xms256m -Xmx896m -XX:MaxMetaspaceSize=384m -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Ho_Chi_Minh -Djava.security.properties=/etc/pk-system/sql2008-compat.security -Djdk.tls.client.protocols=TLSv1.2,TLSv1 -jar /opt/pk-system/current.jar --spring.config.location=classpath:/application.properties,file:/etc/pk-system/application-production.properties
SuccessExitStatus=143
''')
    common = '''[Unit]
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
Environment=TZ=Asia/Ho_Chi_Minh
Environment=GIT_TERMINAL_PROMPT=0
Environment=JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
UMask=0077
Nice=15
CPUQuota=100%
IOWeight=10
MemoryMax=768M
OOMPolicy=continue
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadOnlyPaths=/etc/pk-system
ReadWritePaths=/var/lib/pk-deploy /var/lib/pk-deploy-control /var/cache/pk-deploy /var/log/pk-deploy /var/log/nginx /srv/pk-system /opt/pk-system /etc/nginx /run
TimeoutStartSec=3600
SuccessExitStatus=75
'''
    for unit, command in [('pk-system-autodeploy', 'poll'), ('pk-system-scheduled-restart', 'restart'), ('pk-system-healthcheck', 'healthcheck')]:
        put('/etc/systemd/system/' + unit + '.service', common +
            'ExecStart=/usr/bin/python3 /usr/local/lib/pk-deploy/pk_deploy.py ' + command + '\n')
    put('/etc/systemd/system/pk-system-autodeploy.timer', '''[Unit]
Description=Check main for frontend/backend source updates
[Timer]
OnBootSec=2min
OnUnitInactiveSec=60s
AccuracySec=1s
Unit=pk-system-autodeploy.service
[Install]
WantedBy=timers.target
''')
    put('/etc/systemd/system/pk-system-scheduled-restart.timer', '''[Unit]
Description=Restart PK Java at the three requested Vietnam times
[Timer]
OnCalendar=*-*-* 02:30:00 Asia/Ho_Chi_Minh
OnCalendar=*-*-* 07:00:00 Asia/Ho_Chi_Minh
OnCalendar=*-*-* 17:30:00 Asia/Ho_Chi_Minh
AccuracySec=1s
RandomizedDelaySec=0
Persistent=false
Unit=pk-system-scheduled-restart.service
[Install]
WantedBy=timers.target
''')
    put('/etc/systemd/system/pk-system-healthcheck.timer', '''[Unit]
Description=Check the running Java HTTP endpoint
[Timer]
OnBootSec=3min
OnUnitInactiveSec=60s
AccuracySec=1s
Unit=pk-system-healthcheck.service
[Install]
WantedBy=timers.target
''')
    put('/etc/logrotate.d/pk-deploy', '''/var/log/pk-deploy/*.log {
    weekly
    rotate 4
    missingok
    notifempty
    compress
    delaycompress
    su root root
}
''')
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    subprocess.run(['systemd-analyze', 'verify', '/etc/systemd/system/pk-system-autodeploy.service',
                    '/etc/systemd/system/pk-system-scheduled-restart.timer',
                    '/etc/systemd/system/pk-system-healthcheck.service'], check=True)
    print('AUTOMATION_PREPARED timers=disabled backend=kept-running jar=' + digest(jar_link))


def enable():
    state = json.loads(pathlib.Path(DEFAULT['state']).read_text())
    if not state.get('verified_build_commit'):
        raise RuntimeError('Complete the bootstrap build verification first')
    subprocess.run(['systemctl', 'start', 'pk-system-healthcheck.service'], check=True)
    subprocess.run(['systemctl', 'enable', '--now', 'pk-system-autodeploy.timer',
                    'pk-system-scheduled-restart.timer', 'pk-system-healthcheck.timer'], check=True)
    print('AUTOMATION_ENABLED schedule=02:30,07:00,17:30 timezone=Asia/Ho_Chi_Minh')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'enable'])
    parser.add_argument('--baseline-backend-signature')
    args = parser.parse_args()
    prepare(args.baseline_backend_signature) if args.mode == 'prepare' else enable()
