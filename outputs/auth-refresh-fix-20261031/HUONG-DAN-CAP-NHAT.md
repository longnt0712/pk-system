# Sửa mất phiên khi mở lại web — 31/10/2026

Gói gồm backend và ba file frontend richy cần thay cùng nhau. Không có SQL migration mới; cơ sở dữ liệu đã dùng bản auth 29/10 giữ nguyên.

1. Sao lưu JAR và ba file frontend hiện có trên server.
2. Thay JAR bằng `backend/richy-wine-exec.jar` thông qua quy trình cập nhật Windows service hiện có; kiểm tra SHA256 theo `SHA256.txt`.
3. Chép ba file trong `frontend/` vào đúng thư mục web IIS đang phục vụ IELTS Room (application.js, application.services.js, index.html), giữ cấu trúc tên file. Cập nhật frontend và backend trong cùng đợt bảo trì.
4. Kiểm tra web trả `APP_VERSION` có hậu tố `auth-refreshfix`; tải lại trang để lấy code mới.
5. Đăng nhập lại nếu phiên đã bị thu hồi ở bản cũ. Thử hai tab và hai thiết bị: mở lại tab sau thời gian access token hết hạn; logout một thiết bị thì thiết bị kia vẫn dùng được. Đổi mật khẩu với lựa chọn đăng xuất tất cả vẫn phải thu hồi mọi phiên.

Backend giữ access token còn hợp lệ khi các tab refresh cùng phiên; frontend phối hợp refresh, chặn phản hồi cũ ghi đè và không tự xóa phiên chỉ vì một resource 401. Refresh grant bị thu hồi thật vẫn yêu cầu đăng nhập lại. Không tăng thời hạn access token, không tắt kiểm tra tài khoản/quyền.

Đã kiểm chứng: 55 backend security tests, 73 auth frontend tests; Maven package core/richy thành công. Gói này được tạo cục bộ, chưa triển khai lên server từ chat.

Bản JAR cũ tìm được trong workspace có thời gian 30/10/2026 15:43:22 và SHA256 `131922DF3B0351BD49167D30FEF6A492864214C1DC53B4A8F3791A3A7687C4DD`. Bản gốc được giữ tại `outputs/auth-review-2026-10-31/artifact-inspection/original-richy-wine-exec-20261030.jar`.
