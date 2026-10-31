# Sửa giao diện khi phiên đăng nhập cũ không còn dùng được

Ngày: 31/10/2026. Gói này dành cho frontend IELTS Room (`richy/app`). Backend tiếp tục dùng bản vá giữ phiên đã triển khai. Chưa triển khai gói này lên server từ chat.

## Kết quả

- Phiên còn hợp lệ tiếp tục được giữ/refresh. Không đăng xuất hàng loạt theo ngày cập nhật.
- Nếu không xác minh được phiên sau hai lần phục hồi, trang hiện thông báo với nút **Thử khôi phục phiên** và **Đăng nhập lại**, thay vì chỉ hiện lỗi tải bài.
- Nút khôi phục xác minh lại tài khoản trên server; chỉ tải lại dữ liệu trang sau khi xác minh thành công.
- Khi server từ chối refresh hoặc cookie xác thực không còn, trang dọn thông tin tài khoản cũ và đưa về đăng nhập với thông báo. Có sẵn ô tài khoản/mật khẩu ngay dưới thông báo, dùng được trên điện thoại và máy tính.
- Nút đăng nhập lại chỉ thu hồi phiên của trình duyệt hiện tại. Không thu hồi các phiên đăng nhập độc lập trên thiết bị khác; không xóa bài làm trong localStorage.
- Lỗi mạng, thiếu quyền (403), máy chủ bận (5xx) không tự làm mất phiên.

Phiên theo chính sách bảo mật cũ hoặc đã bị thu hồi không thể được làm hợp lệ bằng frontend. Người dùng đó cần đăng nhập lại một lần. Không chạy SQL khôi phục token hoặc xóa toàn bộ bảng token.

## Cập nhật trên IIS

1. Sao lưu năm file frontend tương ứng trên server.
2. Chép toàn bộ nội dung thư mục `frontend` trong gói này vào thư mục website IIS đang phục vụ `ieltsroom.com`, giữ nguyên đường dẫn con:

   - `application.js`
   - `application.services.js`
   - `index.html`
   - `common/views/application.html`
   - `common/views/login/login.html`

3. Không cần thay JAR, khởi động lại backend hoặc chạy migration SQL cho riêng bản sửa giao diện này.
4. Kiểm tra index có `APP_VERSION = '20261031-login-preview-contrast-1-auth-recovery-1'`. Giữ cấu hình không cache index hiện có của IIS. Các tab đang chạy JavaScript cũ cần tải lại trang để nhận bản sửa; không cần xóa cookie thủ công.
5. Thử một phiên mới còn dùng được và một phiên cũ gặp lỗi. Phiên còn hợp lệ phải giữ đăng nhập; phiên bị thu hồi cần thấy biểu mẫu đăng nhập lại. Nếu sau đăng nhập lại vẫn lỗi tải bài, cần kiểm tra lỗi API riêng, không quy hết thành hết phiên.

Chỉ cập nhật năm file này khi frontend server cùng dòng mã với workspace hiện tại. Nếu server đã có phiên bản frontend mới hơn, áp dụng thay đổi nguồn tương ứng và tăng APP_VERSION để tránh ghi đè các thay đổi mới hơn.

## Kiểm thử

89 kiểm thử đạt: 78 auth frontend, 8 đăng nhập lại trong Battle và 3 kiểm thử trình duyệt Chromium với AngularJS thật, HTTP giả lập. Kiểm tra biểu mẫu ở kích thước 390px và 1366px, phiên cũ bị từ chối, retry, đăng nhập lại, không thu hồi phiên chỉ vì resource 401, lỗi mạng, hai tab và phản hồi cũ sau khi đổi tài khoản. Không dùng cookie/tài khoản production trong kiểm thử.

Log: `verification.log`. Ảnh kiểm tra: `old-session-login-390.png`, `old-session-login-1366.png`.
