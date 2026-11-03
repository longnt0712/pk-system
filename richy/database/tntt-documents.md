# Tài liệu và thông báo TNTT

1. Sao lưu database, chạy `tntt-documents.sql` và `tntt-team-gender.sql` trên database ứng dụng. Các script chỉ bổ sung bốn bảng mới và cột loại đội; không sửa danh sách học sinh hiện có.
2. Cập nhật backend và frontend, sau đó đặt `TNTT_DOCUMENTS_ENABLED=true` và khởi động lại backend. Mặc định tính năng tắt để không truy vấn bảng chưa được tạo.
3. Admin và `ROLE_EDUCATION_MANAGEMENT` soạn tài liệu chung. Những người nhận được chọn chỉ xem bản được chia sẻ. Tài khoản `ROLE_STUDENT` và hồ sơ `DOAN_SINH` không được nhận thông báo.
4. Nhóm giáo lý viên/huynh trưởng bao gồm thành phần trưởng, trợ tá, trợ úy, tuyên úy và tài khoản giáo viên `ROLE_USER` có lớp trường 2; bao gồm người phụ trách lớp gốc trường 2, không lấy giáo viên IELTS chưa thuộc TNTT.

## Khi giao diện báo chưa kích hoạt

API `api/tntt-documents/capabilities` trả `enabled: false` khi cấu hình backend chưa bật. Chạy SQL chỉ tạo cấu trúc lưu trữ, không tự bật tính năng.

Sau khi chạy cả hai script SQL, thêm hoặc sửa trong file `application.properties` bên ngoài JAR mà dịch vụ backend đang đọc:

```properties
tntt.documents.enabled=true
```

Hoặc cấu hình biến môi trường `TNTT_DOCUMENTS_ENABLED=true` cho chính dịch vụ Java. Cần khởi động lại dịch vụ để nhận cấu hình mới; không cần build lại JAR. Sau đó tải lại trang Tài liệu, API capabilities phải trả `enabled: true`. Nếu dùng biến môi trường của Windows, tiến trình dịch vụ phải nhận được biến đó khi khởi động.

Trên server Windows đang dùng quy trình reset của dự án, mở PowerShell bằng **Run as administrator**, sau khi lưu cấu hình thì chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ServiceReset\Reset-RichyService.ps1"
```

Đây là đường dẫn cài script trong `deployment/windows-server-2012-r2/HUONG-DAN-RESET-SERVICE.md`; nếu script đã được cài tại thư mục khác thì dùng đúng đường dẫn đó. Đợi log `SUCCESS` rồi tải lại trang. Dịch vụ backend gián đoạn trong lúc reset. Script khởi động lại service `richy-wine-service` hiện có, không chạy thêm một lệnh `java -jar` song song.

Nếu dịch vụ chưa dùng file cấu hình ngoài JAR, Spring Boot mặc định đọc `application.properties` và `config/application.properties` theo thư mục làm việc của dịch vụ. Xác nhận đúng thư mục làm việc và các tham số cấu hình hiện có trước khi tạo file; giữ nguyên cấu hình kết nối đang dùng.

## Email (tùy chọn)

Thiết lập bằng biến môi trường, không đưa mật khẩu vào source:

- `TNTT_DOCUMENTS_EMAIL_ENABLED=true`
- `TNTT_DOCUMENTS_EMAIL_HOST`, `TNTT_DOCUMENTS_EMAIL_PORT` (mặc định 587, bắt buộc STARTTLS và kiểm tra chứng thư máy chủ)
- `TNTT_DOCUMENTS_EMAIL_USERNAME`, `TNTT_DOCUMENTS_EMAIL_PASSWORD`
- `TNTT_DOCUMENTS_EMAIL_FROM` (địa chỉ gửi được nhà cung cấp cho phép)
- `TNTT_DOCUMENTS_PUBLIC_URL=https://tnttphungkhoang.com`

Không có cấu hình thì vẫn dùng website; lựa chọn gửi email bị vô hiệu hóa. Email chỉ gồm tiêu đề/tóm tắt và link cần đăng nhập, không đính toàn bộ biên bản. Worker chạy mỗi phút, chỉ lấy thông báo đang trong hạn và còn chia sẻ. Mỗi địa chỉ chỉ được gửi một lần trong đợt; không tự gửi lại sau khi tắt/bật. Tin đã chuyển sang `SENDING` nhưng máy chủ bị dừng được giữ để đối soát, không tự gửi lại gây trùng. `FAILED` có nghĩa chưa xác nhận được việc gửi, không phải xác nhận người nhận chưa nhận tin. Dùng đợt nhắc mới sau khi kiểm tra hộp thư khi cần gửi lại.

Zalo chưa tích hợp, không tạo hàng đợi Zalo và không có nút gửi Zalo. Sau khi có OA và mẫu tin được duyệt sẽ bổ sung kênh này riêng.

## Quy tắc dữ liệu

- Thời gian lưu là epoch milliseconds; form dùng giờ Việt Nam UTC+7, mốc kết thúc không bao gồm chính thời điểm đó.
- Mỗi đợt công bố giữ bản chụp riêng. Sửa bản soạn thảo không phát tán nội dung chưa công bố và không gửi thông báo mới.
- Hết hạn chỉ dừng nhắc, tài liệu vẫn được xem nếu còn chia sẻ và thuộc nhóm nhận. Tắt chia sẻ chặn cả link trực tiếp và dừng các email chưa gửi.
- Đã đọc lưu theo tài khoản trên máy chủ. Đóng modal chưa đánh dấu đã đọc. Pet chỉ có khi còn thông báo chưa đọc, chưa hết hạn.
- Tài khoản nam (`M`) dùng nhân vật nữ; nữ (`F`) hoặc chưa rõ dùng nhân vật nam. Học sinh không có pet.
- Bản nháp lỗi mạng lưu riêng theo tài khoản/tài liệu trên thiết bị. Sửa đồng thời được kiểm tra phiên bản; không âm thầm ghi đè. Có 30 mốc gần nhất, các lần sửa liên tiếp của cùng người được gộp khoảng 10 phút.
- Không chạy migration hay gửi email thật trong các bài kiểm tra.

## Bảng màu và màu chữ

Ô **Màu** trong sổ tay dùng chung cho chữ gõ và các nét bút viết tiếp. Chọn màu sẽ đổi toàn bộ phần chữ gõ của tài liệu; những nét bút đã viết giữ màu cũ. Màu chữ được lưu bằng thuộc tính JSON tùy chọn `textColor` (`#RRGGBB`), đi cùng bản nháp, lịch sử, bản công bố và bản in/PDF. Tài liệu cũ không có thuộc tính này vẫn mở bình thường.

Bản bổ sung màu chữ cần cập nhật **backend JAR và frontend**; không có migration SQL mới. Bảng 80 màu được dùng chung trong các sổ tay, TinyMCE (soạn nội dung) và Quill (nhận xét bài làm).

## Phân đội

Loại đội Nam / Nữ / Tổng hợp do người phân đội chọn; không tự chuyển hay tự chia lại học sinh. Đội cũ chưa có loại được hiển thị là Tổng hợp. Trưởng/phó chọn ngay trên thẻ thành viên, có thể bấm lại để bỏ; mỗi đội một trưởng và có thể có nhiều phó. Chuyển đội sẽ gỡ vai trò ở đội cũ. Những vai trò này không cấp quyền quản trị tài khoản.
