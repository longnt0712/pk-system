# Lỗi 500 khi upload Excel ngày 21/10/2026

Log backend ghi nhận lúc 20:38:48 và 20:49:08, Java PID 3616 không nạp được
`org.springframework.web.multipart.support.StandardMultipartHttpServletRequest`.
Stack trace dừng ở `StandardServletMultipartResolver.resolveMultipart` và
`DispatcherServlet.checkMultipart`, trước khi gọi controller đọc Excel.
Cùng tiến trình còn báo thiếu `Hibernate ClearEvent`, `NClobTypeDescriptor$1`
và `Logback ThrowableProxy`.

Wrapper log ghi PID 3616 khởi động lúc 17:55:55 ngày 21/10. Các log này xác nhận
lỗi nạp thư viện của backend; chưa xác nhận file JAR trên máy chủ bị thiếu lớp,
bị thay trong khi Java chạy, hay nguyên nhân khác. Cần kiểm tra file thực tế.

## 1. Kiểm tra trên máy chủ

Giải nén gói vào `C:\chan-doan-excel` trên máy chủ `118-27-192-59`.
Mở PowerShell bằng **Run as administrator** và chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\chan-doan-excel\Test-Backend.ps1" -JarPath "C:\richy-wine-service\richy-wine-exec.jar" -ReportPath "C:\chan-doan-excel\backend-before.txt"
```

Lệnh chỉ đọc. Kiểm tra bốn dòng đều là `True`:

- `StandardMultipartHttpServletRequest present`
- `Hibernate ClearEvent present`
- `Hibernate NClobTypeDescriptor$1 present`
- `ThrowableProxy present`

Nếu có `False`, `Required library NOT FOUND` hoặc `JAR inspection failed`,
cần kiểm tra/copy lại bản executable JAR hoàn chỉnh. Dừng service và xác nhận
Java cũ đã thoát trước khi thay JAR, rồi khởi động lại bằng service hiện có.
Không chép đè JAR đang được Java sử dụng.

Nếu xuất hiện `JAR MODIFIED AFTER PROCESS START`, file trên đĩa mới hơn tiến
trình Java; chưa có bằng chứng rằng tiến trình đã nạp đúng bản cập nhật đó.

## 2. Khởi động lại để nạp thư viện

Khi các thư viện trên đều có trong JAR, kiểm tra service trước:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\chan-doan-excel\Restart-Backend.ps1" -CheckOnly
```

Sau đó chạy lệnh dưới đây. Backend sẽ gián đoạn ngắn; script giữ cấu hình Java,
JAR và database hiện tại, nhận diện đúng service/Java đang giữ port 8085.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\chan-doan-excel\Restart-Backend.ps1"
```

Kết quả cần có `Confirmed listener PID` mới. Nếu script báo lỗi, giữ nguyên
thông báo để kiểm tra, không mở thêm một tiến trình Java bằng tay.

## 3. Xác nhận phục hồi

Đăng nhập lại nếu cần, mở Flashcard → Import Excel và bấm **Read and preview**.
Bước này chỉ xem trước, chưa import dữ liệu. Nếu bảng từ xuất hiện, lỗi nhận
upload đã phục hồi. Sau đó mới bấm **Confirm import** khi muốn lưu từ.

Nếu vẫn lỗi, gửi `backend-before.txt`, `backend-check-after-restart.txt` và
đoạn log mới sau lần thử. HTTP 401/403/405 của các GET chẩn đoán chưa đăng nhập
chỉ xác nhận API có phản hồi; chưa xác nhận import thành công.
