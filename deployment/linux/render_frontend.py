"""Render the existing two-domain IIS HTML rules for Nginx releases."""
import grp
import os
import pathlib
import re
import xml.etree.ElementTree as ET


def nginx_quote(value):
    if any(character in value for character in '\r\n\x00'):
        raise ValueError('Control character in static filename')
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$') + '"'


def render(release, rules_file, ownership=True):
    release = pathlib.Path(release)
    webroot = release / 'webroot'
    source = (webroot / 'index.html').read_text(encoding='utf-8-sig')
    if '<!--#' in source:
        raise ValueError('Unexpected SSI directive in the source entry')
    rules = ET.parse(rules_file).findall('./system.webServer/rewrite/outboundRules/rule')
    entries = release / 'entries'
    entries.mkdir(mode=0o750, exist_ok=True)
    group = grp.getgrnam('www-data').gr_gid if ownership else os.getgid()
    seen = {}
    mappings = []
    for path in sorted(webroot.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlink in frontend release')
        if not path.is_file():
            continue
        relative = '/' + path.relative_to(webroot).as_posix()
        if relative.lower() in seen:
            raise ValueError('Case-insensitive static filename collision')
        seen[relative.lower()] = relative
        mappings.append(nginx_quote(relative) + ' ' + nginx_quote(relative) + ';')
    mapping = release / 'static-paths.map'
    mapping.write_text('\n'.join(mappings) + '\n', encoding='utf-8')
    mapping.chmod(0o644)
    for site in ['ielts', 'tntt']:
        for private in [False, True]:
            content = source
            for rule in rules:
                match, action = rule.find('match'), rule.find('action')
                if match is None or action is None or match.attrib.get('filterByTags') != 'None':
                    continue
                condition = rule.attrib.get('preCondition')
                if condition == 'TnttHtmlResponse' and site != 'tntt':
                    continue
                if condition == 'PrivateAppHtmlResponse' and not private:
                    continue
                if condition not in ['TnttHtmlResponse', 'PrivateAppHtmlResponse']:
                    raise ValueError('Unsupported HTML rewrite condition')
                value = action.attrib['value'].replace(
                    '{HtmlEncode:{UNENCODED_URL}}', '<!--# echo var="request_uri" encoding="entity" -->')

                def replacement(found):
                    return re.sub(r'\{R:(\d+)\}', lambda token: found.group(int(token.group(1))) or '', value)

                content = re.sub(match.attrib['pattern'], replacement, content,
                                 count=int(match.attrib.get('occurrences', '1')), flags=re.I)
            if private and re.search(r'<link id="site-canonical"[^>]*>', content, re.I):
                raise ValueError('Private entry retains canonical metadata')
            if private and not re.search(r'<meta name="robots"\s+content="noindex, nofollow"', content, re.I):
                raise ValueError('Private entry lacks noindex metadata')
            if site == 'tntt' and 'TNTT Phùng Khoang | Thiếu Nhi Thánh Thể Phùng Khoang' not in content:
                raise ValueError('TNTT domain metadata missing')
            path = entries / (site + ('-private' if private else '-public') + '.html')
            path.write_text(content, encoding='utf-8')
            path.chmod(0o640)
            if ownership:
                os.chown(path, 0, group)
    if ownership:
        os.chown(entries, 0, group)
    entries.chmod(0o750)
    return len(mappings)
