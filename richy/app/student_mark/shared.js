(function () {
    'use strict';
    var token = window.location.hash.substring(1), inFlight = false, stopped = false, timer;
    var status = document.getElementById('status'), wrap = document.getElementById('table-wrap');
    var search = document.getElementById('name-search'), lastTable = null, loadError = '';
    function searchable(text) {
        var value = String(text === null || text === undefined ? '' : text).toLowerCase();
        if (value.normalize) value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return value.replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
    }
    function birthDateText(value) {
        if (value === null || value === undefined || value === '') return '';
        if (typeof value === 'string') {
            var text = value.trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;
            var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
            return iso ? iso[3] + '/' + iso[2] + '/' + iso[1] : '';
        }
        if (typeof value === 'number' && isFinite(value)) {
            var date = new Date(value);
            if (!isNaN(date.getTime())) return date.toLocaleDateString('en-GB', {timeZone:'Asia/Ho_Chi_Minh'});
        }
        return '';
    }
    function cell(tag, text, parent, className) {
        var node = document.createElement(tag);
        node.textContent = text === null || text === undefined ? '' : String(text);
        if (className) node.className = className;
        parent.appendChild(node);
        return node;
    }
    function showError(text, clear) {
        loadError = text;
        status.textContent = text; status.className = 'error';
        if (clear) {
            lastTable = null; search.disabled = true;
            wrap.hidden = true;
            document.getElementById('rows').textContent = '';
            document.getElementById('head').textContent = '';
            document.getElementById('scope').textContent = '';
        }
    }
    function render(data, resetTop) {
        var top = resetTop ? 0 : wrap.scrollTop, left = wrap.scrollLeft;
        var head = document.getElementById('head'), rows = document.getElementById('rows');
        var columns = data.columns || [], students = data.rows || [];
        var keyword = searchable(search.value), visibleCount = 0;
        head.textContent = ''; rows.textContent = '';
        document.getElementById('scope').textContent = data.className + ' — ' + data.programName;
        var header = cell('tr', '', head);
        cell('th', 'STT', header, 'number'); cell('th', 'Tên học sinh', header, 'name-heading');
        columns.forEach(function (column) { cell('th', column.name, header); });
        cell('th', 'Trung bình', header);
        students.forEach(function (student, index) {
            if (keyword && searchable(student.name).indexOf(keyword) === -1) return;
            visibleCount++;
            var row = cell('tr', '', rows), total = 0, weight = 0;
            cell('td', index + 1, row, 'number');
            var name = cell('td', student.name, row, 'name');
            var birthDate = birthDateText(student.birthDate);
            if (birthDate) cell('small', birthDate, name);
            columns.forEach(function (column, i) {
                var value = student.marks[i];
                cell('td', value === null || value === undefined ? '—' : value, row,
                    value !== null && value !== undefined && value < 5 ? 'low' : value >= 8 ? 'good' : '');
                if (value !== null && value !== undefined && isFinite(Number(value))) {
                    var coefficient = Number(column.coefficient) || 1;
                    total += Number(value) * coefficient; weight += coefficient;
                }
            });
            cell('td', weight ? (total / weight).toFixed(2) : '—', row);
        });
        if (!visibleCount) { var empty = cell('tr', '', rows); cell('td', students.length ? 'Không tìm thấy học sinh phù hợp.' : 'Chưa có học sinh phù hợp với bảng này.', empty).colSpan = columns.length + 3; }
        wrap.hidden = false; wrap.scrollTop = top; wrap.scrollLeft = left;
        status.className = loadError ? 'error' : '';
        status.textContent = (loadError ? loadError + ' · Cập nhật trước: ' : 'Cập nhật: ') + new Date(data.refreshedAt).toLocaleString('vi-VN');
    }
    function refresh() {
        if (stopped || inFlight || document.hidden) return;
        inFlight = true;
        window.fetch('/service/public/student-marks/' + encodeURIComponent(token), {credentials:'omit', cache:'no-store', headers:{Accept:'application/json'}})
            .then(function (response) {
                if (!response.ok) {
                    var error = new Error('Không tải được bảng điểm.'); error.status = response.status; throw error;
                }
                return response.json();
            }).then(function (data) {
                if (!stopped) { lastTable = data; loadError = ''; search.disabled = false; render(data, false); }
            })
            .catch(function (error) {
                if (stopped) return;
                if (error.status === 404 || error.status === 410) {
                    stopped = true; window.clearInterval(timer);
                    showError('Link không tồn tại hoặc đã được thu hồi. Vui lòng liên hệ giáo viên.', true);
                } else if (error.status === 401 || error.status === 403) {
                    showError('Chưa mở được chế độ chỉ xem. Vui lòng báo giáo viên kiểm tra cấu hình.', true);
                } else {
                    showError('Không tải được điểm mới. Nếu có điểm đang hiển thị thì đó là lần cập nhật trước; trang sẽ thử lại sau một phút.', false);
                }
            }).then(function () { inFlight = false; });
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { showError('Link không hợp lệ. Vui lòng dùng đầy đủ link giáo viên gửi.', true); return; }
    search.addEventListener('input', function () { if (lastTable) render(lastTable, true); });
    refresh();
    timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pagehide', function () { stopped = true; window.clearInterval(timer); });
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) { stopped = false; timer = window.setInterval(refresh, 60000); refresh(); }
    });
})();
