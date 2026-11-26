import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc} from 'firebase/firestore';

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
