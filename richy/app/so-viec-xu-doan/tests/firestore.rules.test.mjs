import assert from 'node:assert/strict';
import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch} from 'firebase/firestore';

const adminEmail = 'admin@example.test';
const memberEmail = 'member@example.test';
const strangerEmail = 'stranger@example.test';
let env;

const profile = (email, laQuanTri = false) => ({email, laQuanTri, hoTen: 'Người thử nghiệm', tenGoi: 'Người thử'});
const task = email => ({
    tieuDe: 'Chuẩn bị lịch sinh hoạt', ngay: '2026-12-06', trangThai: 'Chưa làm', ban: 'Sinh hoạt',
    nguoiPhuTrach: ['Người thử'], dot: 'Mùa Vọng 2026', ghiChu: '',
    nguoiTao: email, nguoiSuaCuoi: email, thoiGianSua: serverTimestamp()
});
const google = (email, email_verified = true, provider = 'google.com') => env.authenticatedContext(email, {
    email, email_verified, firebase: {sign_in_provider: provider, identities: {}}
}).firestore();

before(async () => {
    env = await initializeTestEnvironment({
        projectId: 'demo-so-viec-xu-doan',
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}
    });
});
after(async () => { if (env) { await env.cleanup(); } });

beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await Promise.all([
            setDoc(doc(db, 'members', adminEmail), profile(adminEmail, true)),
            setDoc(doc(db, 'members', memberEmail), profile(memberEmail)),
            setDoc(doc(db, 'tasks', 'example'), task(adminEmail)),
            setDoc(doc(db, 'categories', 'sinh-hoat'), {ten: 'Sinh hoạt'})
        ]);
    });
});

test('Tài khoản lạ chỉ có thể kiểm tra bản ghi của chính mình', async () => {
    const db = google(strangerEmail);
    await assertSucceeds(getDoc(doc(db, 'members', strangerEmail)));
    await assertFails(getDoc(doc(db, 'members', adminEmail)));
    await assertFails(getDocs(collection(db, 'members')));
    await assertFails(getDocs(collection(db, 'tasks')));
    await assertFails(getDocs(collection(db, 'categories')));
    await assertFails(setDoc(doc(db, 'members', strangerEmail), profile(strangerEmail, true)));
    await assertFails(setDoc(doc(db, 'tasks', 'new'), task(strangerEmail)));
});

test('Phiên thiếu đăng nhập Google hoặc email xác minh không thể đọc dữ liệu', async () => {
    const variant = [
        env.unauthenticatedContext().firestore(),
        google(adminEmail, false),
        google(adminEmail, true, 'password')
    ];
    for (const db of variant) {
        await assertFails(getDoc(doc(db, 'members', adminEmail)));
        await assertFails(getDoc(doc(db, 'tasks', 'example')));
    }
});

test('Thành viên đọc, thêm và cập nhật việc với đúng thông tin người sửa', async () => {
    const db = google(memberEmail.toUpperCase());
    await assertSucceeds(getDocs(collection(db, 'tasks')));
    await assertSucceeds(getDocs(collection(db, 'members')));
    await assertSucceeds(getDocs(collection(db, 'categories')));
    await assertSucceeds(setDoc(doc(db, 'tasks', 'new'), {...task(memberEmail), ngay: ''}));
    await assertFails(setDoc(doc(db, 'tasks', 'csv-' + 'd'.repeat(64)), task(memberEmail)));
    const reference = doc(db, 'tasks', 'example');
    const audit = {nguoiSuaCuoi: memberEmail, thoiGianSua: serverTimestamp()};
    await assertSucceeds(updateDoc(reference, {trangThai: 'Đang làm', ...audit}));
    await assertFails(updateDoc(reference, {nguoiTao: memberEmail, ...audit}));
    await assertFails(updateDoc(reference, {trangThai: 'Mới', ...audit}));
    await assertFails(updateDoc(reference, {trangThai: 'Xong', ...audit, nguoiSuaCuoi: adminEmail}));
    await assertFails(updateDoc(reference, {trangThai: 'Xong', nguoiSuaCuoi: memberEmail}));
    await assertFails(deleteDoc(reference));
    await assertFails(updateDoc(doc(db, 'members', memberEmail), {laQuanTri: true}));
    await assertFails(setDoc(doc(db, 'categories', 'new'), {ten: 'Ban mới'}));
    await assertFails(setDoc(doc(db, 'unknown', 'new'), {email: memberEmail}));
});

test('Quản trị quản lý thành viên, danh mục, xóa việc và thu quyền ngay', async () => {
    const admin = google(adminEmail);
    const member = google(memberEmail);
    const importedId = 'csv-' + 'a'.repeat(64);
    await assertSucceeds(setDoc(doc(admin, 'tasks', importedId), task(adminEmail)));
    await assertSucceeds(getDoc(doc(member, 'tasks', importedId)));
    await assertSucceeds(setDoc(doc(admin, 'members', strangerEmail), profile(strangerEmail)));
    await assertFails(setDoc(doc(admin, 'members', 'invalid@example.test'), profile(strangerEmail, true)));
    await assertSucceeds(updateDoc(doc(admin, 'members', memberEmail), {laQuanTri: true}));
    await assertSucceeds(setDoc(doc(member, 'categories', 'new'), {ten: 'Ban mới'}));
    await assertSucceeds(deleteDoc(doc(admin, 'tasks', 'example')));
    await assertSucceeds(deleteDoc(doc(admin, 'members', memberEmail)));
    await assertFails(getDocs(collection(member, 'members')));
    await assertFails(getDocs(collection(member, 'tasks')));
    await assertFails(updateDoc(doc(member, 'categories', 'new'), {ten: 'Tên khác'}));
});

test('Khách xem đủ các cột công việc công khai, thông tin đăng nhập và quyền ghi vẫn riêng tư', async () => {
    const admin = google(adminEmail);
    const guest = env.unauthenticatedContext().firestore();
    const {nguoiTao, nguoiSuaCuoi, thoiGianSua, ...view} = task(adminEmail);
    const existing = doc(admin, 'publicTasks', 'example');
    await assertFails(setDoc(existing, {...view, nguoiTao}));
    await assertFails(setDoc(existing, {...view, ghiChu: 'Nội dung không có trong việc gốc'}));
    await assertSucceeds(setDoc(existing, view));
    const publicView = doc(guest, 'publicTasks', 'example');
    assert.deepEqual((await assertSucceeds(getDoc(publicView))).data(), view);
    await assertSucceeds(getDocs(collection(guest, 'publicTasks')));
    await assertFails(getDocs(collection(guest, 'tasks')));
    await assertFails(getDocs(collection(guest, 'members')));
    await assertFails(updateDoc(publicView, {ghiChu: 'Sửa khi chưa đăng nhập'}));
});

test('Nhập nhiều việc và tạo bản công khai cùng giao dịch', async () => {
    const admin = google(adminEmail);
    const batch = writeBatch(admin);
    const {nguoiTao, nguoiSuaCuoi, thoiGianSua, ...view} = task(adminEmail);
    for (let index = 0; index < 8; index++) {
        const id = 'csv-' + index;
        const columns = index === 0 ? {...view, gio: '18:30'} : view;
        batch.set(doc(admin, 'tasks', id), {...columns, nguoiTao, nguoiSuaCuoi, thoiGianSua});
        batch.set(doc(admin, 'publicTasks', id), columns);
    }
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(doc(admin, 'publicTasks', 'missing'), view));
    const guest = env.unauthenticatedContext().firestore();
    assert.equal((await getDocs(collection(guest, 'publicTasks'))).size, 8);
    assert.equal((await getDoc(doc(guest, 'publicTasks', 'csv-0'))).data().gio, '18:30');
    await assertFails(setDoc(doc(admin, 'publicTasks', 'csv-0'), view));
    await assertFails(setDoc(doc(admin, 'publicTasks', 'csv-1'), {...view, gio: '19:30'}));
    await assertFails(setDoc(doc(admin, 'tasks', 'csv-invalid'), {...task(adminEmail), gio: '24:00'}));
});

test('Việc đã công khai đồng bộ khi thành viên sửa hoặc quản trị xóa', async () => {
    const admin = google(adminEmail);
    const member = google(memberEmail);
    const {nguoiTao, nguoiSuaCuoi, thoiGianSua, ...view} = task(adminEmail);
    await setDoc(doc(admin, 'publicTasks', 'example'), view);
    const original = doc(member, 'tasks', 'example');
    const publicView = doc(member, 'publicTasks', 'example');
    const audit = {nguoiSuaCuoi: memberEmail, thoiGianSua: serverTimestamp()};
    await assertFails(updateDoc(original, {trangThai: 'Xong', ...audit}));
    await assertFails(updateDoc(publicView, {trangThai: 'Xong'}));
    const edit = writeBatch(member);
    edit.update(original, {trangThai: 'Cha đã duyệt', ...audit});
    edit.update(publicView, {trangThai: 'Cha đã duyệt'});
    await assertSucceeds(edit.commit());
    assert.equal((await getDoc(publicView)).data().trangThai, 'Cha đã duyệt');
    const deleteOriginal = doc(admin, 'tasks', 'example');
    const deletePublic = doc(admin, 'publicTasks', 'example');
    await assertFails(deleteDoc(deleteOriginal));
    await assertFails(deleteDoc(deletePublic));
    const remove = writeBatch(admin);
    remove.delete(deleteOriginal);
    remove.delete(deletePublic);
    await assertSucceeds(remove.commit());
});

test('Thành viên lưu việc mới kèm giờ và ghi chú cho khách xem trong cùng giao dịch', async () => {
    const member = google(memberEmail);
    const guest = env.unauthenticatedContext().firestore();
    const {nguoiTao, nguoiSuaCuoi, thoiGianSua, ...columns} = task(memberEmail);
    const view = {...columns, gio: '18:45', ghiChu: 'Mang theo sổ sinh hoạt.'};
    const originalRef = doc(collection(member, 'tasks'));
    const publicRef = doc(member, 'publicTasks', originalRef.id);
    await assertSucceeds(runTransaction(member, async transaction => {
        transaction.set(originalRef, {...view, nguoiTao, nguoiSuaCuoi, thoiGianSua});
        transaction.set(publicRef, view);
    }));
    const guestRef = doc(guest, 'publicTasks', originalRef.id);
    assert.deepEqual((await getDoc(guestRef)).data(), view);
    await assertSucceeds(runTransaction(member, async transaction => {
        const original = (await transaction.get(originalRef)).data();
        transaction.set(originalRef, {...columns, trangThai: 'Xong', nguoiTao: original.nguoiTao,
            nguoiSuaCuoi, thoiGianSua: serverTimestamp()});
        transaction.set(publicRef, {...columns, trangThai: 'Xong'});
    }));
    assert.deepEqual((await getDoc(guestRef)).data(), {...columns, trangThai: 'Xong'});
});
