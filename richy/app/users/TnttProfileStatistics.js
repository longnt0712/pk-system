(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TnttProfileStatistics = api;
}(typeof window !== 'undefined' ? window : this, function () {
    'use strict';
    var branches = [
        {code: 'CHIEN_CON', name: 'Chiên con', match: 'chien con'},
        {code: 'AU_NHI', name: 'Ấu nhi', match: 'au nhi'},
        {code: 'THIEU_NHI', name: 'Thiếu nhi', match: 'thieu nhi'},
        {code: 'NGHIA_SI', name: 'Nghĩa sĩ', match: 'nghia si'},
        {code: 'HIEP_SI', name: 'Hiệp sĩ', match: 'hiep si'}
    ];
    var types = {DOAN_SINH: 'Đoàn sinh', DU_TRUONG: 'Dự trưởng', HUYNH_TRUONG: 'Huynh trưởng',
        TRO_TA: 'Trợ tá', TRO_UY: 'Trợ úy', TUYEN_UY: 'Tuyên úy'};
    function id(value) { var n = Number(value); return n > 0 && n % 1 === 0 ? n : null; }
    function branchName(code) { return (branches.filter(function (b) { return b.code === code; })[0] || {}).name || code || 'Chưa có'; }
    function levelName(value) { return value == null || value === '' ? 'Chưa có' : ({1: 'Cấp I', 2: 'Cấp II', 3: 'Cấp III', 4: 'Đặc cấp'}[value] || String(value)); }
    function expected(name) {
        var text = String(name || '').split('(')[0].toLowerCase();
        if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        text = text.replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
        for (var i = 0; i < branches.length; i++) {
            var match = text.match(new RegExp('^' + branches[i].match + '\\s*(?:cap\\s*)?([1-3]|iii|ii|i)(?=[ab\\s/_.-]|$)', 'i'));
            if (match) return {branch: branches[i].code, branchName: branches[i].name,
                level: {i: 1, ii: 2, iii: 3}[match[1]] || Number(match[1])};
        }
        return null;
    }
    function catalog(classes) {
        var byId = {}, roots = {};
        (classes || []).forEach(function (c) { if (c && id(c.id) && Number(c.schoolId) === 2) byId[id(c.id)] = c; });
        Object.keys(byId).forEach(function (key) {
            var current = byId[key], seen = {};
            while (current && id(current.parentId)) {
                if (seen[id(current.id)]) { current = null; break; }
                seen[id(current.id)] = true;
                current = byId[id(current.parentId)];
            }
            if (current) roots[key] = current;
        });
        return {byId: byId, roots: roots};
    }
    function row(key, name, target) {
        return {id: key, name: name, expected: target, total: 0, matched: 0, mismatched: 0,
            missing: 0, branchMismatch: 0, levelMismatch: 0};
    }
    function add(target, issue) {
        target.total++;
        if (!issue) { target.matched++; return; }
        target.mismatched++;
        if (issue.missing) target.missing++;
        if (issue.branchMismatch) target.branchMismatch++;
        if (issue.levelMismatch) target.levelMismatch++;
    }
    function birthDate(value) {
        var text = String(value || ''), match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return match[3] + '/' + match[2] + '/' + match[1];
        if (value == null || value === '') return '';
        var date = new Date(value);
        return isNaN(date.getTime()) ? '' : ('0' + date.getDate()).slice(-2) + '/' +
            ('0' + (date.getMonth() + 1)).slice(-2) + '/' + date.getFullYear();
    }
    function build(users, classes, selectedIds, includeInactive) {
        var cat = catalog(classes), classRows = {}, branchRows = {}, selected = {}, seen = {};
        var report = row('total', 'Tổng', null);
        report.classes = []; report.branches = []; report.issues = [];
        report.includeInactive = !!includeInactive;
        (selectedIds || []).forEach(function (value) {
            var key = id(value), c = cat.byId[key], target = c && expected(c.name);
            if (c && !id(c.parentId) && target) {
                selected[key] = true; classRows[key] = row(key, c.name, target);
                if (!branchRows[target.branch]) branchRows[target.branch] = row(target.branch, target.branchName, null);
            }
        });
        (users || []).forEach(function (user) {
            if (!user || !id(user.id) || seen[user.id]) return;
            var active = user.active === true || user.active === 1 || user.active === '1' || String(user.active).toLowerCase() === 'true';
            if (!includeInactive && !active) return;
            seen[user.id] = true;
            var person = user.person || {}, primary = cat.roots[id(person.enrollmentClassId)], candidates = {}, assigned;
            if (primary && expected(primary.name)) assigned = primary;
            else (user.enrollmentClassIds || []).forEach(function (value) {
                var c = cat.roots[id(value)]; if (c && expected(c.name)) candidates[c.id] = c;
            });
            var candidateIds = Object.keys(candidates);
            if (!assigned && candidateIds.length === 1) assigned = candidates[candidateIds[0]];
            var unresolved = !assigned && candidateIds.length > 1 && candidateIds.some(function (key) { return selected[key]; });
            if (!unresolved && (!assigned || !selected[assigned.id])) return;
            var target = assigned && expected(assigned.name), classRow, branchRow, reasons = [];
            var missing = false, badBranch = false, badLevel = false;
            if (unresolved) {
                if (!classRows.review) classRows.review = row('review', 'Cần xác định lớp TNTT chính', null);
                if (!branchRows.review) branchRows.review = row('review', 'Chưa xác định lớp', null);
                classRow = classRows.review; branchRow = branchRows.review;
                reasons.push('Có nhiều lớp TNTT; cần xác định lớp chính');
            } else {
                classRow = classRows[assigned.id]; branchRow = branchRows[target.branch];
                missing = !person.tnttMemberType || !person.tnttBranch || person.tnttLevel == null || person.tnttLevel === '';
                badBranch = person.tnttMemberType !== 'DOAN_SINH' || person.tnttBranch !== target.branch;
                badLevel = person.tnttMemberType !== 'DOAN_SINH' || Number(person.tnttLevel) !== target.level;
                if (!person.tnttMemberType) reasons.push('Chưa có thành phần TNTT');
                else if (person.tnttMemberType !== 'DOAN_SINH') reasons.push('Thành phần chưa là Đoàn sinh');
                if (!person.tnttBranch) reasons.push('Chưa có ngành');
                else if (person.tnttBranch !== target.branch) reasons.push('Ngành chưa phù hợp với lớp');
                if (person.tnttLevel == null || person.tnttLevel === '') reasons.push('Chưa có cấp');
                else if (Number(person.tnttLevel) !== target.level) reasons.push('Cấp chưa phù hợp với lớp');
            }
            var issue = reasons.length ? {userId: user.id, classId: classRow.id, branchId: branchRow.id,
                className: unresolved ? candidateIds.map(function (key) { return candidates[key].name; }).join(', ') : assigned.name,
                name: ((person.lastName || '') + ' ' + (person.firstName || '')).trim() || person.displayName || user.displayName || user.username || '',
                patron: person.patron || '', username: String(user.username || ''), birthDate: birthDate(person.birthDate),
                currentType: types[person.tnttMemberType] || person.tnttMemberType || 'Chưa có',
                currentBranch: branchName(person.tnttBranch), currentLevel: levelName(person.tnttLevel),
                expectedBranch: target ? target.branchName : 'Cần xác định lớp', expectedLevel: target ? levelName(target.level) : '',
                reason: reasons.join('; '), missing: missing, branchMismatch: badBranch, levelMismatch: badLevel, active: active} : null;
            if (issue) report.issues.push(issue);
            add(report, issue); add(classRow, issue); add(branchRow, issue);
        });
        report.classes = Object.keys(classRows).map(function (key) { return classRows[key]; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });
        report.branches = branches.filter(function (b) { return branchRows[b.code]; }).map(function (b) { return branchRows[b.code]; });
        if (branchRows.review) report.branches.push(branchRows.review);
        report.issues.sort(function (a, b) { return a.className.localeCompare(b.className, 'vi') || a.name.localeCompare(b.name, 'vi') || a.userId - b.userId; });
        return report;
    }
    function workbook(XLSX, report) {
        var book = XLSX.utils.book_new();
        function sheet(name, headers, rows, widths) {
            var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
            ws['!cols'] = widths.map(function (width) { return {wch: width}; });
            ws['!autofilter'] = {ref: ws['!ref']};
            XLSX.utils.book_append_sheet(book, ws, name);
        }
        function counts(r) { return [r.total, r.matched, r.mismatched, r.missing, r.branchMismatch, r.levelMismatch]; }
        var labels = ['Tổng HS', 'Đúng ngành/cấp', 'Cần bổ sung / kiểm tra', 'Thiếu thông tin', 'Chưa đúng ngành', 'Chưa đúng cấp'];
        sheet('Theo ngành', ['Ngành'].concat(labels), report.branches.map(function (r) { return [r.name].concat(counts(r)); }), [24, 12, 18, 24, 20, 20, 20]);
        sheet('Theo lớp', ['Lớp', 'Ngành theo lớp', 'Cấp theo lớp'].concat(labels), report.classes.map(function (r) {
            return [r.name, r.expected ? r.expected.branchName : '', r.expected ? levelName(r.expected.level) : ''].concat(counts(r));
        }), [40, 24, 18, 12, 18, 24, 20, 20, 20]);
        sheet('Danh sách cần bổ sung', ['STT', 'Lớp', 'Mã học sinh', 'Tên thánh', 'Họ và tên', 'Ngày sinh', 'Thành phần hiện tại',
            'Ngành hiện tại', 'Cấp hiện tại', 'Ngành theo lớp', 'Cấp theo lớp', 'Nội dung cần kiểm tra', 'Trạng thái tài khoản'],
            report.issues.map(function (r, i) { return [i + 1, r.className, r.username, r.patron, r.name, r.birthDate,
                r.currentType, r.currentBranch, r.currentLevel, r.expectedBranch, r.expectedLevel, r.reason, r.active ? 'Kích hoạt' : 'Không kích hoạt']; }),
            [8, 40, 20, 18, 30, 16, 24, 22, 18, 22, 18, 65, 24]);
        return book;
    }
    return {expected: expected, build: build, workbook: workbook};
}));
