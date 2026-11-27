const columns = ['Việc', 'Ngày', 'Trạng thái', 'Ban phụ trách', 'Người phụ trách', 'Đợt', 'Ghi chú'];
const statuses = ['Chưa làm', 'Đang làm', 'Xong', 'Cha đã duyệt'];
const utf8 = new TextEncoder();

function key(value) {
    return value.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

// Đọc CSV có dấu phẩy, ô được trích dẫn và nội dung xuống dòng trong ô.
function readCsv(text) {
    const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const rows = [];
    let fields = [];
    let field = '';
    let quoted = false;
    let endedQuote = false;
    let line = 1;
    let rowLine = 1;
    for (let index = 0; index < source.length; index++) {
        const character = source[index];
        if (quoted) {
            if (character === '"' && source[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
                endedQuote = true;
            } else {
                field += character;
                if (character === '\n') { line++; }
            }
            continue;
        }
        if (character === ',' || character === '\n') {
            fields.push(field.trim());
            field = '';
            endedQuote = false;
            if (character === '\n') {
                rows.push({fields, line: rowLine});
                fields = [];
                rowLine = ++line;
            }
        } else if (character === '"' && !endedQuote && !field.trim()) {
            field = '';
            quoted = true;
        } else if (character === '"' || (endedQuote && character !== ' ' && character !== '\t')) {
            throw new Error('Dòng ' + line + ' có dấu ngoặc kép chưa đúng định dạng CSV.');
        } else {
            field += character;
        }
    }
    if (quoted) { throw new Error('Ô bắt đầu ở dòng ' + rowLine + ' chưa đóng dấu ngoặc kép.'); }
    fields.push(field.trim());
    rows.push({fields, line: rowLine});
    return rows;
}

function isoDate(value) {
    if (!value) { return ''; }
    const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (parts) {
        const iso = parts[3] + '-' + parts[2].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
        if (validIsoDate(iso)) { return iso; }
    }
    throw new Error('Ngày phải là ngày hợp lệ theo dạng dd/mm/yyyy.');
}

function validIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isoTime(value) {
    if (!value) { return ''; }
    const parts = /^(\d{1,2}):([0-5]\d)$/.exec(value);
    if (!parts || Number(parts[1]) > 23) { throw new Error('Giờ phải hợp lệ theo dạng HH:mm.'); }
    return parts[1].padStart(2, '0') + ':' + parts[2];
}

function taskRecord(row, indexes, startTimeIndex, endTimeIndex) {
    const [tieuDe, ngay, trangThai, ban, nguoiPhuTrach, dot, ghiChu] = indexes.map(index => row.fields[index] || '');
    return taskFromFields({
        tieuDe, ngay: isoDate(ngay), trangThai, ban, nguoiPhuTrach, dot, ghiChu,
        gio: row.fields[startTimeIndex], gioKetThuc: row.fields[endTimeIndex]
    });
}

export function taskFromFields(fields) {
    const tieuDe = fields.tieuDe.trim();
    const ngay = fields.ngay;
    const ban = fields.ban.trim();
    const dot = fields.dot.trim();
    const ghiChu = fields.ghiChu.trim();
    if (!tieuDe) { throw new Error('Thiếu tên việc.'); }
    if (ngay && !validIsoDate(ngay)) { throw new Error('Ngày công việc không hợp lệ.'); }
    const status = fields.trangThai.trim();
    const trangThai = status ? statuses.find(option => key(option) === key(status)) : statuses[0];
    if (!trangThai) { throw new Error(`Trạng thái hợp lệ gồm ${statuses.join(', ')}.`); }
    const nguoiPhuTrach = fields.nguoiPhuTrach.split(',').map(name => name.trim()).filter(name => name && key(name) !== '[chưa có tên]');
    if (tieuDe.length > 300 || ban.length > 120 || dot.length > 150 || ghiChu.length > 10000 || nguoiPhuTrach.length > 30) {
        throw new Error('Một cột vượt giới hạn độ dài hoặc có hơn 30 người phụ trách.');
    }
    const gio = isoTime((fields.gio || '').trim());
    const gioKetThuc = isoTime((fields.gioKetThuc || '').trim());
    if (gioKetThuc && !gio) { throw new Error('Điền Từ giờ trước khi nhập Đến giờ.'); }
    if (gioKetThuc && gioKetThuc < gio) { throw new Error('Đến giờ phải bằng hoặc sau Từ giờ trong cùng ngày.'); }
    return {
        tieuDe, ngay, trangThai, ban, nguoiPhuTrach, dot, ghiChu,
        ...(gio ? {gio} : {}), ...(gioKetThuc ? {gioKetThuc} : {})
    };
}

export async function parseTaskCsv(text) {
    const rows = readCsv(text);
    const headerPosition = rows.findIndex(row => key(row.fields[0]) === 'việc');
    if (headerPosition < 0) { throw new Error('Không tìm thấy dòng tiêu đề bắt đầu bằng “Việc”. Hãy chọn file CSV phân cách bằng dấu phẩy.'); }
    const header = rows[headerPosition].fields.map(key);
    const indexes = columns.map(column => header.indexOf(key(column)));
    const firstTimeIndex = header.indexOf(key('Từ giờ'));
    const startTimeIndex = firstTimeIndex >= 0 ? firstTimeIndex : header.indexOf(key('Giờ'));
    const endTimeIndex = header.indexOf(key('Đến giờ'));
    if (indexes.some(index => index < 0)) { throw new Error('File cần đủ 7 cột: ' + columns.join(', ') + '.'); }
    const unique = new Map();
    let duplicates = 0;
    for (const row of rows.slice(headerPosition + 1)) {
        if (!row.fields.some(Boolean)) { continue; }
        try {
            if (row.fields.length > header.length && row.fields.slice(header.length).some(Boolean)) {
                throw new Error('Thừa cột. Nếu một ô chứa dấu phẩy, hãy đặt cả ô trong dấu ngoặc kép.');
            }
            const task = taskRecord(row, indexes, startTimeIndex, endTimeIndex);
            // Giờ kết thúc, trạng thái, ghi chú và người phụ trách có thể thay đổi sau khi nhập.
            const identityFields = [key(task.tieuDe), task.ngay, key(task.ban), key(task.dot)];
            if (task.gio) { identityFields.push(task.gio); }
            const identity = JSON.stringify(identityFields);
            const previous = unique.get(identity);
            if (previous) {
                if (JSON.stringify(previous.task) !== JSON.stringify(task)) {
                    throw new Error('Trùng việc, ngày, giờ, ban và đợt với dòng ' + previous.line + ' nhưng nội dung khác.');
                }
                duplicates++;
            } else {
                unique.set(identity, {task, line: row.line});
            }
        } catch (error) {
            throw new Error('Dòng ' + row.line + ' — ' + error.message);
        }
    }
    if (!unique.size) { throw new Error('File chưa có công việc nào để nhập.'); }
    const tasks = await Promise.all(Array.from(unique, async ([identity, {task}]) => {
        const digest = await crypto.subtle.digest('SHA-256', utf8.encode(identity));
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        return {id: 'csv-' + hash, task};
    }));
    return {tasks, duplicates};
}

export function formatTaskDate(iso) {
    return iso ? iso.split('-').reverse().join('/') : 'Chưa có ngày';
}
