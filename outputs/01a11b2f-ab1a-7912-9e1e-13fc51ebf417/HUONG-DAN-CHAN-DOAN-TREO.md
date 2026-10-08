# Chẩn đoán lỗi lưu Topic, test tổng hợp và tạo phòng Battle

Trang chủ trả HTTP 200 nhưng hai API Topic/Battle không phản hồi trong lần kiểm tra từ xa. Các yêu cầu kiểm tra chưa đăng nhập nên kết quả này chưa chứng minh mọi API hay database đều bị treo. Cần thu trạng thái máy chủ **ngay khi thao tác đang chờ**, trước khi khởi động lại Java.

1. Giải nén gói này trên máy chủ đang chạy `C:\richy-wine-service`.
2. Bấm tạo phòng Battle hoặc lưu test tổng hợp trên website bằng tài khoản đang gặp lỗi.
3. Trong lúc website vẫn đang chờ, mở PowerShell bằng Administrator tại thư mục vừa giải nén và chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Collect-BackendHangDiagnostics.ps1
```

Script tự tìm Java đang giữ port 8085, lấy hai bản trạng thái luồng cách nhau 5 giây bằng `jcmd` hoặc `jstack`, rồi lấy log bằng script có sẵn. Mỗi lần gọi công cụ Java có giới hạn 15 giây. Script không dừng backend, không thay JAR và không ghi dữ liệu lên API/database.

Nếu dùng gói cũ và gặp `Join-Path ... Path ... empty string` ở dòng khai báo `ReportPath`, truyền đường dẫn báo cáo trực tiếp. Ví dụ khi giải nén vào `C:\chan-doan`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\chan-doan\Collect-BackendHangDiagnostics.ps1" -ReportPath "C:\chan-doan\backend-hang-diagnostics.txt"
```

Gói mới đã sửa lỗi này trong cả hai script: đường dẫn mặc định được xác định sau khi PowerShell khởi tạo script.

Nếu báo không có `jcmd/jstack`, chạy thêm `-JdkDirectory "C:\duong-dan-JDK"` với **JDK đã cài cùng phiên bản Java của backend**. Script vẫn lấy log nếu không có công cụ Java; không cần cài thêm gì để lấy log.

4. Gửi hai file `backend-hang-diagnostics.txt` và `backend-save-log.txt`, kèm giờ bấm nút và thao tác cụ thể.
5. Nếu có SSMS, trong lúc thao tác đang chờ hãy mở đúng database ứng dụng, chạy `check-database-blocking.sql` và gửi kết quả. SQL chỉ đọc; cần quyền `VIEW SERVER STATE` cho các bảng trạng thái hệ thống.

Hai bản trạng thái Java xác định request đang chờ JDBC, khóa `synchronized` của phòng Battle, hay bước khác. SQL xác định phiên đang giữ khóa, kể cả phiên ngủ nhưng còn giao dịch mở. Log xác định lỗi schema, lớp Java, phân quyền hoặc lỗi lưu. Khi chưa có những kết quả này, chưa thể chốt nguyên nhân ở Java, SQL hay IIS.
