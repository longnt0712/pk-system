# Đối chiếu JAR và lỗi mất phiên — 31/10/2026

JAR tìm được tại `richy/richy-app/target/richy-wine-exec.jar` trước khi build bản sửa:

- File timestamp: 30/10/2026 15:43:22 (Asia/Bangkok).
- Kích thước: 86.940.561 bytes.
- SHA256: `131922DF3B0351BD49167D30FEF6A492864214C1DC53B4A8F3791A3A7687C4DD`.
- Bản gốc đã lưu ở `original-richy-wine-exec-20261030.jar` trong thư mục này.
- `BOOT-INF/classes/application.properties` chứa `security.auth.persistent-sessions=true`.
- Bytecode core-api chứa auth policy 3 và hỗ trợ refresh token không hết hạn.

Đây là JAR đang có trong workspace. Chưa đọc file hoặc cấu hình override trên server production; SHA trên server cần khớp mới kết luận hai artifact giống hệt.

Frontend công khai tại IELTS Room đọc ngày 31/10/2026 có release `20261030-battle-catalog-1`, có logic gia hạn cookie ghi nhớ. Điều này xác nhận mã frontend ghi nhớ đã có trên website, không xác nhận effective configuration backend hoặc cookie của người dùng.

Probe dùng đúng `deployed-core-api.jar` trích từ JAR gốc, không biên dịch lại service và chỉ dùng tài khoản/token giả. Kết quả:

- Phiên riêng cho hai thiết bị hoạt động; logout một thiết bị không ảnh hưởng thiết bị kia.
- Persistent refresh token được hỗ trợ, access token vẫn có TTL.
- Refresh lần hai làm access token vừa cấp ở lần đầu mất hiệu lực, dù cùng refresh token vẫn còn hợp lệ.
- Phản hồi refresh về khác thứ tự ở nhiều tab có thể làm frontend ghi token đã bị thay, nhận 401 rồi tự xóa cookie/thu hồi refresh.

Đã sửa hành vi này trong backend và hai frontend. Đây là lỗi đã tái hiện trong artifact; chưa khẳng định đó là nguyên nhân duy nhất của lần mất phiên cụ thể vì chưa có log production của thời điểm xảy ra.

Xem `deployed-artifact-refresh-probe.txt` và `ValidatingTokenServices.javap.txt` để đối chiếu.
