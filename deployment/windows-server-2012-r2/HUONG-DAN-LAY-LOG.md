# Lấy log lỗi lưu Topic và bài test

Backend vẫn tải danh sách và lưu Test Result được. Lưu Topic, bài tổng hợp tạo tay và bài import Excel đang lỗi. Cần lấy log đúng thời điểm thao tác để xác định lỗi của hai API lưu; chưa kết luận backend ngừng hoạt động.

1. Giải nén `lay-log-loi-luu.zip` trên máy chủ đang có thư mục `C:\richy-wine-service`.
2. Trên website, thử lưu một Topic mới và đợi xuất hiện lỗi. Ghi lại giờ bấm Lưu.
3. Tại thư mục vừa giải nén trên máy chủ, mở PowerShell và chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Collect-BackendSaveLogs.ps1
```

4. Gửi file `backend-save-log.txt` vừa tạo trong thư mục đó, kèm giờ bấm Lưu Topic. Nếu thử lưu bài test ngay trước khi chạy script, ghi thêm giờ thao tác đó.

Script chỉ đọc phần cuối ba log `richy-wine-service.out.log`, `richy-wine-service.err.log`, `richy-wine-service.wrapper.log`, thông tin tiến trình/service và thời điểm thay JAR. Script không dừng hoặc khởi động lại service, không thay JAR và không ghi dữ liệu lên database. Script không đọc XML cấu hình kết nối; các dạng mật khẩu/token phổ biến trong log được che.

Nếu script báo không đọc được log, mở thư mục `C:\richy-wine-service` và gửi file `.out.log` và `.err.log` hiện tại. Log `.err.log` trong ảnh trước có thời điểm cập nhật cũ, nên cần đối chiếu cả `.out.log`.
