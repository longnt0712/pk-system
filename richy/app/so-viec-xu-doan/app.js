import {firebaseConfig, useEmulators} from './firebase-config.js';
import {normalizeEmail, initials, errorMessage} from './member-data.js';
import {createTaskWorkspace} from './task-workspace.js?v=7';

const byId = id => document.getElementById(id);
const form = byId('member-form');
const dialog = byId('member-dialog');
const state = {user: null, profile: null, members: [], epoch: 0, saving: false};
let firebase;
let stopProfile;
let stopMembers;
const taskWorkspace = createTaskWorkspace({byId, element, showMessage});

function showWorkspaceView(view) {
    const showTasks = view === 'tasks' || !state.profile;
    byId('tasks-view').hidden = !showTasks;
    byId('members-view').hidden = showTasks;
    byId('show-tasks').setAttribute('aria-pressed', String(showTasks));
    byId('show-members').setAttribute('aria-pressed', String(!showTasks));
}

byId('show-tasks').addEventListener('click', () => showWorkspaceView('tasks'));
byId('show-members').addEventListener('click', () => showWorkspaceView('members'));

function showMessage(id, message) {
    const element = byId(id);
    element.textContent = message || '';
    element.hidden = !message;
}

function clearMembers() {
    if (stopMembers) { stopMembers(); stopMembers = null; }
    state.members = [];
    byId('members').replaceChildren();
    byId('member-count').textContent = '';
}

function clearPrivateData() {
    clearMembers();
    taskWorkspace.clearProfile();
    state.profile = null;
    byId('workspace-nav').hidden = true;
    byId('add-member').hidden = true;
    showWorkspaceView('tasks');
    showMessage('workspace-error', '');
    showMessage('workspace-status', '');
    form.reset();
    dialog.close();
}

function renderAccount() {
    byId('account').hidden = !state.user;
    byId('sign-in').hidden = !!state.user;
    byId('account-name').textContent = state.profile?.tenGoi || state.user?.email || '';
    byId('account-role').hidden = !state.profile;
    byId('account-role').textContent = state.profile?.laQuanTri ? 'Quản trị' : 'Thành viên';
}

function denyAccess() {
    clearPrivateData();
    byId('access-denied').hidden = false;
    showMessage('login-status', '');
    renderAccount();
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.textContent = text; }
    return node;
}

async function memberAction(button, action) {
    if (state.profile?.laQuanTri !== true) { return; }
    const epoch = state.epoch;
    button.disabled = true;
    showMessage('workspace-error', '');
    try {
        await action();
    } catch (error) {
        if (epoch === state.epoch && state.profile) { showMessage('workspace-error', errorMessage(error)); }
    } finally { button.disabled = false; }
}

function renderMembers() {
    const container = byId('members');
    container.replaceChildren();
    const members = [...state.members].sort((left, right) => String(left.hoTen).localeCompare(String(right.hoTen), 'vi'));
    byId('member-count').textContent = members.length + ' người';
    for (const member of members) {
        const row = element('article', 'member-row');
        row.append(element('span', 'avatar', initials(member.hoTen)));
        const details = element('div');
        details.append(element('strong', 'member-name', member.hoTen));
        details.append(element('span', 'member-email', member.email || 'Chưa liên kết email Google'));
        const meta = element('div', 'member-detail');
        meta.append(element('span', 'role-pill', member.laQuanTri ? 'Quản trị' : 'Thành viên'));
        if (member.banNganh) { meta.append(element('span', 'muted', member.banNganh)); }
        details.append(meta);
        row.append(details);
        if (state.profile?.laQuanTri) {
            const actions = element('div', 'member-actions');
            const change = element('button', 'button button-subtle', member.laQuanTri ? 'Đổi về thành viên' : 'Cấp quản trị');
            change.type = 'button';
            change.disabled = !member.email;
            change.addEventListener('click', () => {
                const question = member.laQuanTri ? 'Chuyển ' + member.hoTen + ' về quyền thành viên?' : 'Cấp quyền quản trị cho ' + member.hoTen + '?';
                if (confirm(question)) { memberAction(change, () => firebase.setAdmin(member.id, !member.laQuanTri)); }
            });
            const remove = element('button', 'button button-subtle delete-button', 'Xóa');
            remove.type = 'button';
            remove.setAttribute('aria-label', 'Xóa thành viên ' + member.hoTen);
            remove.addEventListener('click', () => {
                if (confirm('Xóa quyền truy cập sổ việc của ' + member.hoTen + '?')) {
                    memberAction(remove, () => firebase.removeMember(member.id));
                }
            });
            actions.append(change, remove);
            row.append(actions);
        }
        container.append(row);
    }
    if (!members.length) { container.append(element('p', 'empty-state', 'Đang tải danh sách thành viên…')); }
}

function receiveProfile(profile, epoch) {
    if (epoch !== state.epoch) { return; }
    if (!profile || normalizeEmail(profile.email) !== normalizeEmail(state.user?.email)) { denyAccess(); return; }
    state.profile = profile;
    byId('access-denied').hidden = true;
    byId('workspace-nav').hidden = false;
    byId('add-member').hidden = profile.laQuanTri !== true;
    taskWorkspace.setProfile(profile);
    byId('workspace-description').textContent = profile.laQuanTri ?
        'Bạn có thể thêm thành viên và quản lý quyền truy cập sổ việc.' :
        'Danh sách những người đã được cấp quyền truy cập sổ việc.';
    showMessage('login-error', '');
    showMessage('login-status', '');
    renderAccount();
    renderMembers();
    if (!profile.laQuanTri && dialog.open) { form.reset(); dialog.close(); }
    if (!stopMembers) {
        stopMembers = firebase.watchMembers(members => {
            if (epoch !== state.epoch || !state.profile) { return; }
            state.members = members;
            renderMembers();
        }, error => {
            if (epoch !== state.epoch || !state.profile) { return; }
            clearMembers();
            showMessage('workspace-error', errorMessage(error));
        });
    }
}

function handleAuth(user) {
    const epoch = ++state.epoch;
    if (stopProfile) { stopProfile(); stopProfile = null; }
    clearPrivateData();
    state.user = user;
    byId('access-denied').hidden = true;
    byId('sign-in').disabled = !!user;
    renderAccount();
    showMessage('login-error', '');
    if (!user) { showMessage('login-status', ''); return; }
    if (!user.email || !user.emailVerified || !user.providerData.some(provider => provider.providerId === 'google.com')) {
        denyAccess(); return;
    }
    showMessage('login-status', 'Đang kiểm tra quyền truy cập…');
    stopProfile = firebase.watchMyMembership(user.email, profile => receiveProfile(profile, epoch), error => {
        if (epoch !== state.epoch) { return; }
        clearPrivateData();
        showMessage('login-status', '');
        showMessage('login-error', errorMessage(error));
        renderAccount();
    });
}

byId('sign-in').addEventListener('click', async () => {
    if (!firebase) { return; }
    byId('sign-in').disabled = true;
    showMessage('login-error', '');
    showMessage('login-status', 'Đang mở đăng nhập Google…');
    try { await firebase.signIn(); }
    catch (error) {
        if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
            showMessage('login-error', errorMessage(error));
        }
        showMessage('login-status', '');
    } finally { byId('sign-in').disabled = !!state.user; }
});

async function logout() {
    if (!firebase || state.saving || taskWorkspace.importing || taskWorkspace.saving) { return; }
    try { await firebase.signOut(); }
    catch (error) { showMessage('login-error', errorMessage(error)); }
}
byId('sign-out').addEventListener('click', logout);

byId('add-member').addEventListener('click', () => {
    if (state.profile?.laQuanTri !== true) { return; }
    form.reset();
    showMessage('member-error', '');
    dialog.showModal();
    form.elements.hoTen.focus();
});
function closeDialog() { if (!state.saving) { dialog.close(); } }
byId('close-member-dialog').addEventListener('click', closeDialog);
byId('cancel-member').addEventListener('click', closeDialog);
dialog.addEventListener('cancel', event => { if (state.saving) { event.preventDefault(); } });

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.saving || state.profile?.laQuanTri !== true || !form.reportValidity()) { return; }
    const epoch = state.epoch;
    state.saving = true;
    byId('save-member').disabled = true;
    byId('save-member').textContent = 'Đang thêm…';
    showMessage('member-error', '');
    try {
        await firebase.addMember({
            hoTen: form.elements.hoTen.value,
            tenGoi: form.elements.tenGoi.value,
            email: form.elements.email.value,
            laQuanTri: form.elements.laQuanTri.checked
        });
        if (epoch === state.epoch && state.profile) {
            dialog.close();
            form.reset();
            showMessage('workspace-status', 'Đã thêm thành viên. Người này có thể đăng nhập bằng email Google vừa cấp.');
        }
    } catch (error) {
        if (epoch === state.epoch && state.profile) { showMessage('member-error', errorMessage(error)); }
    } finally {
        state.saving = false;
        byId('save-member').disabled = false;
        byId('save-member').textContent = 'Thêm thành viên';
    }
});

async function start() {
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    if (required.some(key => typeof firebaseConfig[key] !== 'string' || !firebaseConfig[key].trim())) {
        byId('setup').hidden = false;
        showMessage('task-count', '');
        showMessage('tasks-error', 'Cần kết nối Firebase để tải công việc.');
        return;
    }
    try {
        const {connectFirebase} = await import('./firebase.js?v=6');
        firebase = connectFirebase(firebaseConfig, useEmulators);
        taskWorkspace.connect(firebase);
        firebase.watchAuth(handleAuth);
    } catch (error) {
        showMessage('task-count', '');
        showMessage('tasks-error', errorMessage(error));
        byId('setup').hidden = false;
    }
}
start();
