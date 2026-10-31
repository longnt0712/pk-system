# Modal đăng nhập lại khi 401 — 01/11/2026

## Lỗi đã sửa

AngularJS giữ tham chiếu nội bộ tới mảng interceptor. Bản cũ gán mảng mới qua `.filter()`, khiến interceptor refresh/401 mới không được `$http` gọi. Bản này sửa trực tiếp mảng gốc và thêm modal đăng nhập lại dùng chung.

Refresh được thì tiếp tục dùng phiên. Refresh bị từ chối hoặc API vẫn 401 sau tối đa hai lần phục hồi thì tự hiện một modal, ngay trên trang đang mở. Không mở nhiều modal khi nhiều request 401; sai mật khẩu được thử lại trong modal. Lỗi mạng/403/5xx không tự thu hồi phiên.

Sau đăng nhập, xác minh lại tài khoản trên server và đúng ID/username trước khi tiếp tục. Dashboard tải lại dữ liệu; các trang làm bài/form khác giữ nguyên controller và dữ liệu đang nhập, không tự gửi lại POST cũ dưới phiên mới. Không xóa localStorage. Battle ưu tiên modal kết nối lại riêng đã có.

## Cập nhật

Commit/pull source: cập nhật đúng nhánh `main`, đảm bảo IIS phục vụ các file mới trong `richy/app`. Nếu IIS dùng thư mục publish riêng, cần chép/publish frontend vào thư mục đó.

Hoặc sao lưu rồi chép toàn bộ nội dung `frontend` trong ZIP này vào website IIS, giữ nguyên đường dẫn con. Gồm sáu file:

- `application.js`
- `application.configs.js`
- `application.services.js`
- `index.html`
- `common/business/SessionLoginModal.js` (mới)
- `assets/css/session-login-modal.css` (mới)

Không cần thay JAR hay chạy SQL. Cần đủ sáu file cùng lúc; đặc biệt phải có `application.configs.js`, không chỉ tăng version index.

Kiểm tra `APP_VERSION = '20261101-auth-login-modal-1'`. Tab đang mở trước triển khai cần tải lại trang bình thường để nhận JavaScript mới; iOS/Android dùng nút tải lại trang. Các phiên còn hợp lệ vẫn giữ đăng nhập.

## Kiểm thử

99/99 kiểm thử đạt: 87 auth frontend, 8 Battle, 4 trình duyệt Chromium với AngularJS, OAuthToken, UI Bootstrap và cấu hình HTTP production thật; toàn bộ HTTP/credential kiểm thử là giả lập, không dùng tài khoản production.

Bao phủ refresh thành công không hiện modal, refresh bị từ chối tự hiện modal, resource 401 lặp có giới hạn, một modal duy nhất, sai mật khẩu rồi đăng nhập đúng, lỗi mạng, fullscreen, đổi tài khoản ở tab khác, ID người dùng không khớp, giữ draft và không phát lại POST cũ dưới tài khoản mới. Kiểm tra hiển thị ở 390px và 1366px, gồm dark mode và độ tương phản nhãn biểu mẫu.

Log: `verification.log`. Ảnh kiểm tra: `session-modal-390.png`, `session-modal-1366.png`. Chưa chạy kiểm thử trên thiết bị iOS/Android vật lý hoặc build Gulp frontend core. Bản sửa này không thay backend.
