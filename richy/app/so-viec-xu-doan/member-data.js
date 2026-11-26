export function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function newMember(values) {
    const email = normalizeEmail(values.email);
    const hoTen = String(values.hoTen || '').trim();
    const tenGoi = String(values.tenGoi || '').trim();
    if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email) || email.length > 254) {
        throw new Error('Bạn hãy nhập một địa chỉ email Google hợp lệ.');
    }
    if (!hoTen || hoTen.length > 120 || !tenGoi || tenGoi.length > 50) {
        throw new Error('Hãy điền họ tên và tên gọi. Họ tên tối đa 120 ký tự, tên gọi tối đa 50 ký tự.');
    }
    return {
        banNganh: '', vaiTro: '', hoTen, tenGoi, dienThoai: '',
        mangDieuHanh: '', viecChinh: '', email, laQuanTri: values.laQuanTri === true
    };
}

export function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(-2).map(word => word.charAt(0)).join('').toLocaleUpperCase('vi');
}

export function errorMessage(error) {
    const messages = {
        'auth/unauthorized-domain': 'Tên miền này chưa được cho phép đăng nhập. Thêm localhost hoặc tên miền đang dùng vào Authorized domains của Firebase.',
        'auth/operation-not-allowed': 'Hãy bật phương thức đăng nhập Google trong Firebase Authentication.',
        'auth/invalid-api-key': 'Khóa API chưa đúng. Hãy sao chép lại cấu hình ứng dụng web từ Firebase Console.',
        'auth/popup-blocked': 'Trình duyệt đang chặn cửa sổ Google. Cho phép cửa sổ bật lên rồi bấm đăng nhập lại.',
        'auth/network-request-failed': 'Chưa kết nối được với Google. Bạn kiểm tra mạng rồi thử lại nhé.',
        'permission-denied': 'Quyền truy cập đã thay đổi hoặc Security Rules chưa được cài đúng. Bạn hãy tải lại trang.',
        'unavailable': 'Chưa kết nối được Firestore. Bạn kiểm tra mạng rồi thử lại nhé.'
    };
    if (error?.code) { return messages[error.code] || 'Chưa kết nối được với Firebase. Bạn kiểm tra cấu hình và thử lại nhé.'; }
    return error?.message || 'Chưa thực hiện được. Bạn thử lại nhé.';
}
