# Ghi nhớ đăng nhập và lựa chọn đăng xuất — 29/10/2026

- Backend mới bật persistent session cho các lần đăng nhập mới ở cả core và richy. Refresh token không có hạn thời gian; access token vẫn có TTL hữu hạn và được làm mới theo luồng đang có.
- Mỗi lần đăng nhập có phiên độc lập. Logout chỉ thu hồi phiên đó; khóa user/đổi quyền/reset password admin vẫn thu hồi các phiên bị ảnh hưởng.
- Đổi mật khẩu cá nhân có `logoutAllDevices`: mặc định true. False giữ các phiên đã đăng nhập; true hoặc thiếu/null thu hồi tất cả. Mật khẩu hiện tại vẫn được kiểm trong transaction có khóa; không lưu/kiểm tra mật khẩu cũ để cho đăng nhập mới.
- Cookie persistent có hạn 365 ngày, được gia hạn khi dùng/mở lại ứng dụng. Không hứa giữ mãi khi browser tự xóa cookie hoặc người dùng dùng trình duyệt/profile khác.
- Token policy trước bản này bị từ chối; sau triển khai cần đăng nhập lại một lần. Không thêm migration mới ngoài `auth_version` đã có trong bản vá trước.

Đã kiểm chứng:

- **51/51 backend JUnit tests**, bao gồm MockMvc/OAuth, JDBC/H2/transaction và race. Log `backend-security-tests.txt`.
- **64/64 auth frontend tests** cho core/richy. Log `frontend-auth-results.log`.
- Maven offline/JDK 8 package **BUILD SUCCESS** cho core-api, core-app, richy-api, richy-app. Log `maven-package-results.log`. Test chạy riêng.
- Chưa deploy production, chưa chạy Gulp của core frontend và chưa thay đổi DB production.

[Hướng dẫn triển khai](C:/Users/Admin/git/pk-system/deployment/windows-server-2012-r2/HUONG-DAN-VA-AUTH-TOKEN.md).
