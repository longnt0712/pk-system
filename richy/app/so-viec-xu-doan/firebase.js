import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
    getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
    getFirestore, collection, doc, onSnapshot, runTransaction, updateDoc, deleteDoc,
    serverTimestamp, connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import {newMember, normalizeEmail} from './member-data.js';

export function connectFirebase(config, useEmulators) {
    const app = initializeApp(config, 'so-viec-xu-doan');
    const auth = getAuth(app);
    const database = getFirestore(app);
    auth.languageCode = 'vi';
    if (useEmulators) {
        if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || !config.projectId.startsWith('demo-')) {
            throw new Error('Chế độ giả lập chỉ chạy trên máy với projectId bắt đầu bằng demo-.');
        }
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
        connectFirestoreEmulator(database, '127.0.0.1', 8088);
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({prompt: 'select_account'});
    return {
        watchAuth: handler => onAuthStateChanged(auth, handler),
        signIn: () => signInWithPopup(auth, provider),
        signOut: () => signOut(auth),
        // Mỗi email có đúng một bản ghi cấp quyền. Cùng một người dùng bản ghi nhân sự này.
        watchMyMembership(email, receive, fail) {
            return onSnapshot(doc(database, 'members', normalizeEmail(email)), {includeMetadataChanges: true}, snapshot => {
                // Chờ Firestore xác nhận quyền trước khi hiển thị thông tin riêng.
                if (!snapshot.metadata.fromCache) {
                    receive(snapshot.exists() ? {...snapshot.data(), id: snapshot.id} : null);
                }
            }, fail);
        },
        watchMembers(receive, fail) {
            return onSnapshot(collection(database, 'members'), snapshot => {
                receive(snapshot.docs.map(member => ({...member.data(), id: member.id})));
            }, fail);
        },
        watchTasks(receive, fail) {
            return onSnapshot(collection(database, 'tasks'), {includeMetadataChanges: true}, snapshot => {
                if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
                    receive(snapshot.docs.map(task => task.data()));
                }
            }, fail);
        },
        async importTasks(rows, email, canContinue) {
            let added = 0;
            const membership = doc(database, 'members', email);
            // Dùng ID cố định và chỉ tạo việc chưa tồn tại, kể cả khi hai lần nhập chạy đồng thời.
            for (let offset = 0; offset < rows.length; offset += 50) {
                if (!canContinue()) { throw new Error('Quyền nhập CSV đã thay đổi.'); }
                const batch = rows.slice(offset, offset + 50);
                added += await runTransaction(database, async transaction => {
                    const profile = await transaction.get(membership);
                    if (profile.data()?.laQuanTri !== true) { throw new Error('Chỉ quản trị mới được nhập CSV.'); }
                    const references = batch.map(row => doc(database, 'tasks', row.id));
                    const existing = await Promise.all(references.map(reference => transaction.get(reference)));
                    let created = 0;
                    batch.forEach((row, index) => {
                        if (existing[index].exists()) { return; }
                        transaction.set(references[index], {
                            ...row.task, nguoiTao: email, nguoiSuaCuoi: email, thoiGianSua: serverTimestamp()
                        });
                        created++;
                    });
                    return created;
                });
            }
            return {added, skipped: rows.length - added};
        },
        async addMember(values) {
            const member = newMember(values);
            const reference = doc(database, 'members', member.email);
            // Giao dịch tránh tạo đè khi hai quản trị cùng thêm một email.
            await runTransaction(database, async transaction => {
                if ((await transaction.get(reference)).exists()) {
                    throw new Error('Email này đã có trong danh sách thành viên.');
                }
                transaction.set(reference, member);
            });
        },
        setAdmin: (id, value) => updateDoc(doc(database, 'members', id), {laQuanTri: value === true}),
        removeMember: id => deleteDoc(doc(database, 'members', id))
    };
}
