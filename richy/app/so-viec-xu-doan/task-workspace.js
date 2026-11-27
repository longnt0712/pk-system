import {parseTaskCsv, formatTaskDate} from './task-csv.js';
import {errorMessage, normalizeEmail} from './member-data.js';

const statusStyles = {'Chưa làm': 'status-todo', 'Đang làm': 'status-active', 'Xong': 'status-done'};

export function createTaskWorkspace({byId, element, showMessage}) {
    const dialog = byId('task-import-dialog');
    const form = byId('task-import-form');
    const input = byId('task-csv-file');
    const preview = byId('task-import-preview');
    const save = byId('save-task-import');
    let firebase;
    let profile;
    let publishedIds;
    let syncStarted = false;
    let tasksToImport = [];
    let session = 0;
    let selection = 0;
    let importing = false;
    const canImport = () => profile?.laQuanTri === true;

    function resetPreview() {
        selection++;
        tasksToImport = [];
        preview.replaceChildren();
        preview.hidden = true;
        save.disabled = true;
        showMessage('task-import-preview-status', '');
        showMessage('task-import-error', '');
    }

    function closeImport() {
        resetPreview();
        form.reset();
        dialog.close();
    }

    function clearProfile() {
        session++;
        profile = null;
        syncStarted = false;
        closeImport();
        byId('open-task-import').hidden = true;
        showMessage('tasks-status', '');
    }

    function renderTasks(tasks) {
        const sorted = [...tasks].sort((left, right) =>
            (left.ngay || '9999-99-99').localeCompare(right.ngay || '9999-99-99') || left.tieuDe.localeCompare(right.tieuDe, 'vi')
        );
        byId('task-count').textContent = sorted.length + ' công việc';
        const cards = sorted.map(task => {
            const card = element('article', 'task-card');
            const heading = element('header', 'task-card-heading');
            heading.append(element('h2', '', task.tieuDe),
                element('span', 'task-status ' + (statusStyles[task.trangThai] || ''), task.trangThai));
            const meta = element('dl', 'task-meta');
            for (const [label, value] of [
                ['Ngày', formatTaskDate(task.ngay)],
                ['Ban', task.ban || 'Chưa có ban'],
                ['Phụ trách', task.nguoiPhuTrach?.filter(name => typeof name === 'string').join(', ') || '[chưa có tên]'],
                ['Đợt', task.dot]
            ]) {
                if (value) { meta.append(element('dt', '', label), element('dd', '', value)); }
            }
            card.append(heading, meta);
            if (task.ghiChu) {
                const notes = element('details', 'task-notes');
                notes.append(element('summary', '', 'Ghi chú'), element('p', '', task.ghiChu));
                card.append(notes);
            }
            return card;
        });
        if (!cards.length) { cards.push(element('p', 'empty-state', 'Chưa có công việc nào.')); }
        byId('tasks').replaceChildren(...cards);
    }

    function syncExistingTasks() {
        if (!canImport() || !publishedIds || syncStarted) { return; }
        syncStarted = true;
        const activeSession = session;
        const canContinue = () => activeSession === session && canImport();
        firebase.publishExistingTasks(publishedIds, normalizeEmail(profile.email), canContinue).catch(error => {
            if (!canContinue()) { return; }
            showMessage('tasks-status', 'Chưa đồng bộ được các việc đã nhập. ' + errorMessage(error));
        });
    }

    function connect(connection) {
        firebase = connection;
        firebase.watchPublicTasks(tasks => {
            publishedIds = new Set(tasks.map(task => task.id));
            showMessage('tasks-error', '');
            renderTasks(tasks);
            syncExistingTasks();
        }, error => {
            byId('tasks').replaceChildren();
            byId('task-count').textContent = '';
            showMessage('tasks-error', errorMessage(error));
        });
    }

    function setProfile(member) {
        profile = member;
        byId('open-task-import').hidden = !canImport();
        if (!canImport() && dialog.open) { closeImport(); }
        syncExistingTasks();
    }

    byId('open-task-import').addEventListener('click', () => {
        if (!canImport() || importing) { return; }
        form.reset();
        resetPreview();
        showMessage('tasks-status', '');
        dialog.showModal();
        input.focus();
    });
    for (const id of ['close-task-import', 'cancel-task-import']) {
        byId(id).addEventListener('click', () => { if (!importing) { closeImport(); } });
    }
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        if (!importing) { closeImport(); }
    });

    input.addEventListener('change', async () => {
        resetPreview();
        const file = input.files[0];
        if (!file || !canImport()) { return; }
        const activeSelection = selection;
        showMessage('task-import-preview-status', 'Đang kiểm tra file…');
        try {
            if (!/\.csv$/i.test(file.name)) { throw new Error('Hãy chọn một file có đuôi .csv.'); }
            if (file.size > 2 * 1024 * 1024) { throw new Error('File CSV tối đa 2 MB.'); }
            const bytes = await file.arrayBuffer();
            let text;
            try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
            catch { throw new Error('Hãy lưu lại file dưới dạng CSV UTF-8 để giữ đúng tiếng Việt.'); }
            const {tasks, duplicates} = await parseTaskCsv(text);
            if (activeSelection !== selection || !canImport()) { return; }
            tasksToImport = tasks;
            preview.replaceChildren(...tasks.slice(0, 8).map(({task}) =>
                element('li', '', task.tieuDe + ' · ' + formatTaskDate(task.ngay))
            ));
            preview.hidden = false;
            const skipped = duplicates ? ' Bỏ qua ' + duplicates + ' dòng trùng trong file.' : '';
            showMessage('task-import-preview-status',
                tasks.length + ' công việc hợp lệ. Xem trước ' + Math.min(8, tasks.length) + ' dòng.' + skipped);
            save.disabled = false;
        } catch (error) {
            if (activeSelection !== selection) { return; }
            showMessage('task-import-preview-status', '');
            showMessage('task-import-error', errorMessage(error));
        }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (importing || !canImport() || !tasksToImport.length) { return; }
        const activeSession = session;
        const canContinue = () => activeSession === session && canImport();
        importing = true;
        input.disabled = save.disabled = true;
        save.textContent = 'Đang nhập…';
        showMessage('task-import-error', '');
        try {
            const result = await firebase.importTasks(tasksToImport, normalizeEmail(profile.email), canContinue);
            if (!canContinue()) { return; }
            closeImport();
            showMessage('tasks-status', 'Đã thêm ' + result.added + ' công việc. Bỏ qua ' + result.skipped + ' việc đã có.');
        } catch (error) {
            if (!canContinue()) { return; }
            showMessage('task-import-error', errorMessage(error) + ' Bạn có thể nhập lại cùng file để tiếp tục.');
        } finally {
            importing = false;
            input.disabled = false;
            save.disabled = !canImport() || !tasksToImport.length;
            save.textContent = 'Nhập công việc';
        }
    });

    return {connect, clearProfile, setProfile, get importing() { return importing; }};
}
