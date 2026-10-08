# Kiểm tra lỗi API lưu không phản hồi

## Kết quả báo cáo lúc 18:33 ngày 08/10/2026

`backend-save-log.txt` xác nhận Java PID 320 vẫn giữ port 8085 và đã chạy từ 07:00:04. JAR trong `C:\richy-wine-service` được thay lúc 16:18:24. Service `richy-wine-service` đang Stopped nhưng Java vẫn hoạt động. Wrapper log ghi lần dừng lúc 11:13:10 thất bại với `Access is denied`; các lần khởi động lúc 14:42, 15:00, 16:22 và 17:56 đều thất bại với `Address already in use` trên port 8085. Vì vậy chưa có lần khởi động mới thành công thay thế PID 320 sau khi cập nhật JAR.

Đây là lỗi khởi động lại/triển khai đã được xác nhận. Chưa có trạng thái luồng của Java để xác định bước chờ trong thao tác lưu: máy chủ chỉ có JRE 8, không tìm thấy jcmd/jstack. `.err.log` cập nhật lần cuối lúc 10:50 và các lỗi AccessDeniedException trong đó thuộc endpoint learning draft; không thể dùng chúng để kết luận lỗi lưu Topic/Battle lúc 18:33.

Người vận hành sau đó xác nhận đã End Task tiến trình Java trong Task Manager rồi khởi động lại service thành công. Kết quả phù hợp với lỗi còn sót Java chiếm port được ghi trong log. Cần thử lưu Topic/test và tạo phòng Battle sau lần khởi động này để xác nhận các thao tác nghiệp vụ đã phục hồi.

Kiểm tra từ xa sau thao tác này: trang chủ HTTP 200 trong 0,14 giây; `/service/api/topic/get_one/1` HTTP 401 trong 0,19 giây và `/service/api/battle-music-config/active` HTTP 401 trong 0,12 giây. Hai API được gọi không đăng nhập nên 401 là phản hồi phù hợp; kết quả xác nhận đường API đã phản hồi trở lại, thay cho timeout 12 giây trước đó. Chưa kiểm tra ghi dữ liệu bằng phiên đăng nhập ADMIN.

Ưu tiên đưa backend về đúng Windows service với JAR hiện tại, rồi kiểm tra lưu Topic, test tổng hợp và tạo phòng Battle. `Restart-Backend.ps1` đã bổ sung nhận diện service bị dừng nhưng còn Java giữ port, kiểm tra đúng wrapper trong thư mục JAR, dừng đúng tiến trình Java đó, đợi port trống rồi khởi động service bằng cấu hình hiện có. Script cũng nhận diện được đường dẫn Java mà WinSW dùng không có đuôi `.exe`. Không thay JAR, service XML hay database.

Sau khi giải nén gói phục hồi vào `C:\chan-doan` trên server, mở PowerShell bằng Administrator và chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\chan-doan\Restart-Backend.ps1"
```

Thao tác này khởi động lại backend và gây gián đoạn ngắn. Kiểm tra report `backend-check-after-restart.txt`: cần PID mới và phản hồi HTTP của API; 401/403/405 từ kiểm tra chưa đăng nhập chỉ xác nhận API đã phản hồi. Sau đó thử lưu bằng tài khoản ADMIN và tải lại danh sách để xác nhận dữ liệu đã lưu. Nếu service không mở port, lấy phần cuối `.out.log` và `.wrapper.log` mới.

## Thông tin mới: lỗi xảy ra ở một số API lưu

Người vận hành xác nhận vẫn tải danh sách và lưu Test Result được; lưu Topic mới, bài tổng hợp tạo thủ công một câu và bài import Excel đều không được. Không thể kết luận toàn bộ backend ngừng hoạt động từ các GET không đăng nhập bị timeout. Lỗi bài tổng hợp cũng xảy ra khi không dùng Excel, nên cần kiểm tra API lưu Question và Topic trước khi quy lỗi cho parser import.

Ưu tiên gói `lay-log-loi-luu.zip` và hướng dẫn `HUONG-DAN-LAY-LOG.md` để lấy log mới ngay sau thao tác lỗi. Script này chỉ đọc, không khởi động lại service. Script Restart-Backend.ps1 bản trước dừng ở bước nhận diện lệnh Java, chưa thực hiện dừng tiến trình; chưa sử dụng lại script đó để xử lý lỗi hiện tại.

Ngày 08/10/2026, trang ieltsroom.com trả HTTP 200 và APP_VERSION 20261008-235. Hai yêu cầu GET không đăng nhập tới API câu hỏi và Topic đều hết thời gian chờ sau 12 giây. Ảnh Console của thao tác import cho thấy timeoutRequest sau giới hạn chờ 120 giây. Những kiểm tra này xác nhận API không trả phản hồi đúng hạn; chưa xác định được nguyên nhân bên trong Java, SQL Server hay IIS.

File log được gửi lần sau giống hoàn toàn file log trước. JAR trong workspace có đủ lớp ThrowableProxy, trường video và bản sửa alias SQL của chiến dịch. Thông tin này chưa xác nhận tiến trình trên máy chủ đang chạy đúng JAR đó.

Người vận hành xác nhận đã dừng và chạy lại Java sau khi chép JAR. Cần đối chiếu phản hồi tại localhost, IIS và trạng thái giao dịch SQL để tìm nguyên nhân hiện tại.

Báo cáo lúc 16:54 ngày 08/10/2026 cho thấy API localhost cũng không phản hồi; port 8085 do Java PID 320 phục vụ và tiến trình bắt đầu lúc 07:00 cùng ngày. Thư mục JAR trên máy chủ được xác nhận là C:\richy-wine-service.

## Khởi động lại backend đang phục vụ port 8085

Giải nén gói khoi-dong-lai-backend.zip trên máy chủ 118-27-192-59. Mở PowerShell bằng quyền Administrator tại thư mục vừa giải nén rồi chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Restart-Backend.ps1
```

Lệnh này sẽ khởi động lại backend. Script kiểm tra đúng máy chủ, file C:\richy-wine-service\richy-wine-exec.jar và tiến trình Java đang giữ port 8085 trước khi dừng. Nếu backend thuộc Windows service phù hợp, script khởi động lại service đó. Với tiến trình Java chạy trực tiếp, script dùng lại Java cùng tham số JVM và ứng dụng hiện tại, đặt thư mục làm việc là C:\richy-wine-service, rồi chạy nền và ghi log mới vào backend-runtime-logs trong thư mục JAR. Script kiểm tra PID mới và gọi Test-Backend.ps1 để tạo backend-check-after-restart.txt.

Có thể xem thông tin trước khi chạy bằng tham số -CheckOnly. Script sẽ dừng nếu máy chủ, JAR hoặc tiến trình không khớp. Nếu backend chưa có tiến trình lắng nghe, sử dụng cách khởi động backend hiện tại để giữ đúng cấu hình ban đầu.

Khi chạy xong, gửi backend-check-after-restart.txt. Nếu Java mới không mở port sau 60 giây, lấy file .out.log và .err.log mới nhất trong C:\richy-wine-service\backend-runtime-logs. Với Windows service, lấy log khởi động từ cơ chế ghi log của service đang dùng.

## Kiểm tra trên máy chủ

Chép Test-Backend.ps1 vào máy Windows Server đang chạy Java và IIS. Mở PowerShell bằng quyền Administrator trong thư mục chứa script rồi chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Test-Backend.ps1
```

Script chỉ đọc tiến trình, file JAR và gửi GET không đăng nhập; không dừng Java, thay file hoặc ghi dữ liệu lên API. Báo cáo được lưu vào backend-check.txt. Nếu Java dùng đường dẫn JAR tương đối, chạy thêm với đường dẫn tuyệt đối thực tế:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Test-Backend.ps1 -JarPath "C:\thu-muc-backend-thuc-te\richy-wine-exec.jar"
```

Đọc kết quả:

- Local API có HTTP 401/403/405, Public API không phản hồi: kiểm tra IIS/ARR và đường chuyển tiếp tới 127.0.0.1:8085.
- Cả Local API và Public API không phản hồi: kiểm tra tiến trình Java và SQL Server.
- Không có tiến trình lắng nghe port 8085: khởi động backend bằng cấu hình hiện tại.
- JAR MODIFIED AFTER PROCESS START: kiểm tra việc khởi động lại Java sau khi cập nhật JAR.
- ThrowableProxy present: True nhưng tiến trình vẫn báo ClassNotFoundException cho lớp đó: kiểm tra đúng đường dẫn JAR đang chạy và khởi động lại sau khi thay file.

HTTP 401/403/405 xác nhận ứng dụng có phản hồi HTTP. Thử lưu Topic sau đó để kiểm tra khả năng ghi dữ liệu bằng tài khoản đã đăng nhập.

## Cập nhật lại backend

Giữ cấu hình kết nối database, tham số khởi động và thư mục làm việc hiện tại. Dừng đúng tiến trình Java phục vụ port 8085 bằng cách quản lý backend đang dùng. Sau khi tiến trình đã dừng, chép JAR mới vào đường dẫn chạy thực tế rồi khởi động lại bằng lệnh hoặc dịch vụ hiện tại. Chạy Test-Backend.ps1 lần nữa để kiểm tra phản hồi HTTP.

Nếu Local API vẫn bị treo, mở SSMS và chạy check-database-blocking.sql trong đúng database của ứng dụng. Cột blocking_session_id khác 0 cho biết yêu cầu đang chờ một phiên SQL khác. Báo cáo giao dịch có thể cho thấy phiên mở giao dịch lâu. Script này chỉ đọc thông tin, không đóng phiên hoặc thay dữ liệu. Hai cột video trả NULL nghĩa là schema còn thiếu; sử dụng migration richy/database/comprehensive-video-questions.sql đã có trong dự án.

Khi API phản hồi trở lại, tạo một Topic thử, tải lại danh sách để xác nhận đã lưu, rồi thử lại bài video. Nếu vẫn lỗi, lấy đoạn log mới đúng thời điểm thao tác cùng backend-check.txt để xác định bước bị treo.
