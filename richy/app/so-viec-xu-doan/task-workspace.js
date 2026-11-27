import {parseTaskCsv, formatTaskDate, taskFromFields} from './task-csv.js?v=6';
import {errorMessage, normalizeEmail} from './member-data.js';

const statusStyles = {
    'Chưa làm': 'status-todo', 'Đang làm': 'status-active', 'Xong': 'status-done', 'Cha đã duyệt': 'status-approved'
};
const taskAssignees = task => Array.isArray(task.nguoiPhuTrach)
    ? task.nguoiPhuTrach.filter(name => typeof name === 'string' && name.trim()) : [];
const filterKey = value => String(value ?? '').trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const searchKey = value => filterKey(value).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

function filterTasks(tasks, filters) {
    const words = searchKey(filters.keyword).split(' ').filter(Boolean);
    return tasks.filter(task => {
        if (filters.status && task.trangThai !== filters.status) { return false; }
        if (filters.department && filterKey(task.ban) !== filters.department) { return false; }
        if (filters.campaign && filterKey(task.dot) !== filters.campaign) { return false; }
        if (filters.assignee && !taskAssignees(task).some(name => filterKey(name) === filters.assignee)) { return false; }
        if ((filters.firstDate || filters.lastDate) && (!task.ngay ||
                (filters.firstDate && task.ngay < filters.firstDate) || (filters.lastDate && task.ngay > filters.lastDate))) { return false; }
        if ((filters.firstTime || filters.lastTime) && (!task.gio ||
                (filters.firstTime && task.gio < filters.firstTime) || (filters.lastTime && task.gio > filters.lastTime))) { return false; }
        if (!words.length) { return true; }
        const searchable = searchKey([task.tieuDe, task.ghiChu, task.ban, task.dot, task.trangThai, ...taskAssignees(task)].join(' '));
        return words.every(word => searchable.includes(word));
    });
}

export function createTaskWorkspace({byId, element, showMessage}) {
    const dialog = byId('task-import-dialog');
    const form = byId('task-import-form');
    const input = byId('task-csv-file');
    const preview = byId('task-import-preview');
    const save = byId('save-task-import');
    const filters = byId('task-filters');
    const resetFilters = byId('reset-task-filters');
    const taskDialog = byId('task-dialog');
    const taskForm = byId('task-form');
    const taskSave = byId('save-task');
    let firebase;
    let profile;
    let publishedIds;
    let syncStarted = false;
    let tasksToImport = [];
    let session = 0;
    let selection = 0;
    let importing = false;
    let saving = false;
    let editingTask = null;
    let allTasks = [];
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
        closeTaskEditor();
        byId('task-actions').hidden = true;
        byId('open-task-import').hidden = true;
        showMessage('tasks-status', '');
        renderTasks();
    }

    function updateFilterOptions(select, values) {
        const previous = select.value;
        const previousLabel = select.selectedOptions[0]?.textContent;
        const options = new Map();
        for (const value of values) {
            const key = filterKey(value);
            if (key && !options.has(key)) { options.set(key, value.trim()); }
        }
        if (previous && !options.has(previous)) { options.set(previous, previousLabel); }
        const entries = [...options].sort((left, right) => left[1].localeCompare(right[1], 'vi'));
        select.replaceChildren(select.options[0], ...entries.map(([key, label]) => {
            const option = element('option', '', label);
            option.value = key;
            return option;
        }));
        select.value = previous;
    }

    function renderTasks() {
        if (filters.hidden) { return; }
        const values = Object.fromEntries(new FormData(filters));
        const hasFilters = Object.values(values).some(value => value.trim());
        resetFilters.hidden = !hasFilters;
        let error = '';
        if (values.firstDate && values.lastDate && values.firstDate > values.lastDate) {
            error = 'Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.';
        } else if (values.firstTime && values.lastTime && values.firstTime > values.lastTime) {
            error = 'Giờ bắt đầu phải trước hoặc trùng giờ kết thúc.';
        }
        showMessage('task-filter-error', error);
        const matching = error ? [] : filterTasks(allTasks, values);
        byId('task-count').textContent = error ? '' : (hasFilters ? matching.length + '/' + allTasks.length : allTasks.length) + ' công việc';
        const cards = matching.map(task => {
            const card = element('article', 'task-card');
            const heading = element('header', 'task-card-heading');
            heading.append(element('h2', '', task.tieuDe),
                element('span', 'task-status ' + (statusStyles[task.trangThai] || ''), task.trangThai));
            const meta = element('dl', 'task-meta');
            for (const [label, value] of [
                ['Ngày', formatTaskDate(task.ngay)],
                ['Giờ', task.gio],
                ['Ban', task.ban || 'Chưa có ban'],
                ['Phụ trách', taskAssignees(task).join(', ') || '[chưa có tên]'],
                ['Đợt', task.dot]
            ]) {
                if (value) { meta.append(element('dt', '', label), element('dd', '', value)); }
            }
            card.append(heading, meta);
            if (task.ghiChu) {
                const notes = element('div', 'task-notes');
                notes.append(element('strong', '', 'Ghi chú'), element('p', '', task.ghiChu));
                card.append(notes);
            }
            if (profile) {
                const footer = element('footer', 'task-card-footer');
                const edit = element('button', 'button button-subtle', 'Sửa');
                edit.type = 'button';
                edit.setAttribute('aria-label', 'Sửa ' + task.tieuDe);
                edit.addEventListener('click', () => openTaskEditor(task));
                footer.append(edit);
                card.append(footer);
            }
            return card;
        });
        if (!cards.length && !error) {
            cards.push(element('p', 'empty-state', hasFilters ? 'Không có công việc khớp bộ lọc.' : 'Chưa có công việc nào.'));
        }
        byId('tasks').replaceChildren(...cards);
    }

    filters.addEventListener('submit', event => event.preventDefault());
    filters.addEventListener('input', renderTasks);
    resetFilters.addEventListener('click', () => {
        filters.reset();
        filters.elements.keyword.focus();
        renderTasks();
    });

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
            allTasks = [...tasks].sort((left, right) =>
                (left.ngay || '9999-99-99').localeCompare(right.ngay || '9999-99-99') ||
                (left.gio || '99:99').localeCompare(right.gio || '99:99') || left.tieuDe.localeCompare(right.tieuDe, 'vi')
            );
            updateFilterOptions(filters.elements.assignee, tasks.flatMap(taskAssignees));
            updateFilterOptions(filters.elements.department, tasks.map(task => task.ban));
            updateFilterOptions(filters.elements.campaign, tasks.map(task => task.dot));
            filters.hidden = false;
            showMessage('tasks-error', '');
            renderTasks();
            syncExistingTasks();
        }, error => {
            filters.hidden = resetFilters.hidden = true;
            byId('tasks').replaceChildren();
            byId('task-count').textContent = '';
            showMessage('tasks-error', errorMessage(error));
        });
    }

    function setProfile(member) {
        profile = member;
        byId('task-actions').hidden = !profile;
        byId('open-task-import').hidden = !canImport();
        if (!canImport() && dialog.open) { closeImport(); }
        renderTasks();
        syncExistingTasks();
    }

    function openTaskEditor(task = null) {
        if (!profile || saving || taskDialog.open) { return; }
        editingTask = task;
        taskForm.reset();
        if (task) {
            for (const field of ['tieuDe', 'ngay', 'gio', 'trangThai', 'ban', 'dot', 'ghiChu']) {
                taskForm.elements[field].value = task[field] ?? '';
            }
            taskForm.elements.nguoiPhuTrach.value = taskAssignees(task).join(', ');
        }
        byId('task-dialog-heading').textContent = task ? 'Sửa công việc' : 'Thêm công việc';
        showMessage('tasks-status', '');
        showMessage('task-save-error', '');
        taskDialog.showModal();
        taskForm.elements.tieuDe.focus();
    }

    function closeTaskEditor() {
        editingTask = null;
        taskForm.reset();
        taskDialog.close();
    }

    byId('add-task').addEventListener('click', () => openTaskEditor());
    for (const id of ['close-task-dialog', 'cancel-task']) {
        byId(id).addEventListener('click', () => { if (!saving) { closeTaskEditor(); } });
    }
    taskDialog.addEventListener('cancel', event => {
        event.preventDefault();
        if (!saving) { closeTaskEditor(); }
    });

    taskForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!profile || saving || !taskForm.reportValidity()) { return; }
        showMessage('task-save-error', '');
        let content;
        try {
            content = taskFromFields(Object.fromEntries(new FormData(taskForm)));
        } catch (error) {
            showMessage('task-save-error', errorMessage(error));
            return;
        }
        const activeSession = session;
        const original = editingTask;
        saving = true;
        byId('task-editor-fields').disabled = taskSave.disabled = true;
        taskSave.textContent = 'Đang lưu…';
        try {
            await firebase.saveTask(content, normalizeEmail(profile.email), original);
            if (activeSession !== session) { return; }
            closeTaskEditor();
            showMessage('tasks-status', original ? 'Đã cập nhật công việc.' : 'Đã thêm công việc.');
        } catch (error) {
            if (activeSession === session) { showMessage('task-save-error', errorMessage(error)); }
        } finally {
            saving = false;
            byId('task-editor-fields').disabled = taskSave.disabled = false;
            taskSave.textContent = 'Lưu công việc';
        }
    });

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
                element('li', '', task.tieuDe + ' · ' + [formatTaskDate(task.ngay), task.gio].filter(Boolean).join(' '))
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

    return {connect, clearProfile, setProfile, get importing() { return importing; }, get saving() { return saving; }};
}
