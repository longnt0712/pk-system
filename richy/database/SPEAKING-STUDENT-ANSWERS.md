# Bộ Speaking dùng chung và câu trả lời riêng của học sinh

## Triển khai

Phần này có thay đổi backend. Chạy toàn bộ `speaking-student-answers.sql` trong đúng database ứng dụng **trước khi thay JAR**, rồi cập nhật frontend cùng phiên bản trên `main`. Script dùng cú pháp SQL Server 2008 R2 trở lên và có thể chạy lại. Nó chỉ bổ sung nơi lưu câu trả lời, không thay đổi các câu hỏi, sample, dấu Pass, lượt luyện hay bản ghi âm hiện có. Các bảng Speaking từ `speaking-studio.sql` vẫn là điều kiện tiên quyết.

Bản giới hạn import cho admin và danh sách học sinh theo lớp không đổi schema. Nếu đã chạy SQL Speaking và SQL câu trả lời riêng ở bản trước, chỉ cần cập nhật JAR và frontend; không có SQL bổ sung cho lần sửa này.

## Hai lối vào Speaking

**Speaking Studio** trên Dashboard và trong Test Room mở `/speaking`. Đây là không gian cá nhân cho mọi tài khoản, kể cả giáo viên và admin: chọn bộ, xem/sửa câu trả lời của chính mình, xem dấu Pass và luyện tập. Không có công cụ import, tạo bộ hay chọn học sinh ở màn hình này. Lịch sử luyện tập ở Studio luôn là của tài khoản đang đăng nhập.

**Tạo test Speaking** mở `/create_speaking_test` và tập trung công cụ quản lý bộ đề, import, chọn lớp và View bài của từng học sinh. Quyền tạo/quản lý bộ và xác nhận Pass được giữ như trước; các thao tác import chỉ dành cho admin. Chuyển về Studio luôn trở lại câu trả lời của chính tài khoản, không mang lựa chọn học sinh từ màn hình quản lý sang.

## Bộ dùng chung

Bộ có chủ sở hữu hiện giữ quyền admin được tự động mở cho mọi tài khoản đã đăng nhập. Quy tắc này áp dụng cả bộ đã tạo từ trước, không tạo bản sao hay thay mã câu. Nút Chia sẻ không còn cần thiết với bộ này. Import câu hỏi và sample chỉ dành cho admin, đồng thời vẫn kiểm tra quyền quản lý bộ đề. Tài khoản giáo viên thường vẫn có thể xem kho riêng theo cơ chế chia sẻ cũ.

Giáo viên được xem câu trả lời và xác nhận Pass cho học sinh thuộc lớp mình phụ trách, kể cả lớp con. Quyền đọc bộ đề chung không tự mở quyền đọc bài luyện và bản ghi âm riêng của người khác. Học sinh được sửa câu trả lời của chính mình, không tự xác nhận Pass hoặc sửa bài của bạn khác.

## Import và sửa câu trả lời

1. Admin mở **Tạo test Speaking**, chọn bộ đề rồi chọn lớp bằng cây lớp/đội trong danh sách học sinh. Cây chỉ hiển thị các lớp có `schoolId = 1` của IELTSRoom, có thể mở/thu gọn nhánh và tìm theo tên hoặc mã. Có thể tìm tên/tài khoản và chuyển trang học sinh trong đúng lớp đã chọn, gồm các lớp con thuộc cùng trường.
2. Bấm **Import** ở dòng của học sinh cần nhập. Tải mẫu của đúng em đó, điền hoặc dán câu trả lời vào cột tương ứng, giữ các mã và thông tin nhận dạng.
3. Import file để xem trước. Kiểm tra các dòng mới, có thay đổi, giữ nguyên hoặc lỗi. Chỉ chọn những dòng muốn lưu; dòng lỗi không được nhập. Dòng không có trong file không bị xóa. Backend kiểm tra quyền admin trên cả tải mẫu, xem trước và xác nhận; giáo viên/học sinh không thể import bằng cách gọi API trực tiếp.
4. Việc thay thế một câu trả lời đã có chỉ áp dụng cho các dòng được chọn, kèm ghi chú gắn trong câu trả lời đó. Không tác động sample dùng chung hoặc câu trả lời của học sinh khác.
5. Mở câu trả lời để sửa nội dung, chữ đậm, nghiêng hoặc gạch chân. Bôi chọn đoạn chữ để thêm note hoặc highlight; bấm vào đoạn có note để mở/đóng, bấm ra ngoài để đóng note.

Bấm **View** ở từng học sinh để xem đúng bài của em đó. Khi có câu trả lời đã lưu, giao diện mở một câu trả lời để xem ngay; nếu chưa có, giao diện báo rõ. Đổi lớp hoặc bộ sẽ bỏ lựa chọn học sinh đang xem, giữ nháp editor theo tài khoản/học sinh/câu và không nhận kết quả tải trễ từ lớp trước. Với kho riêng chưa chia sẻ cho học sinh, thao tác Import/View bị chặn thay vì tự thay quyền chia sẻ.

Backend cũng kiểm tra `schoolId = 1` khi mở danh sách học sinh; không thể chọn lớp trường khác bằng cách gọi API trực tiếp. Nhánh con thuộc trường khác hoặc thiếu `schoolId` không được nhập vào kết quả của lớp IELTSRoom. Lớp IELTSRoom có cha không nằm trong danh sách hợp lệ vẫn có thể xuất hiện như một gốc độc lập trên cây. Thay đổi bộ chọn cây/phạm vi trường cần cập nhật backend và frontend, không cần thêm SQL.

Quyền sửa trực tiếp không thay đổi: học sinh sửa câu trả lời của mình; giáo viên sửa/xác nhận Pass cho học sinh trong phạm vi phụ trách. Giới hạn admin áp dụng cho công cụ import, không mở quyền giáo viên hoặc học sinh xem bài của người khác.

Câu trả lời và note được lưu theo học sinh và mã câu hỏi. Sample chung được lưu riêng. Khi cách hỏi được import thành biến thể mới, câu hỏi mới có vùng trả lời riêng, không ghi đè câu trả lời của câu cũ.

Chỉ báo lưu thành công khi backend xác nhận đúng bộ, học sinh, câu hỏi và phiên bản. Nếu giáo viên và học sinh cùng sửa một bản cũ, hệ thống báo xung đột và giữ nội dung đang sửa để đối chiếu; không tự ghi đè bản mới của người kia. Bản nháp trên trình duyệt là phương án khôi phục khi chưa đồng bộ, không phải xác nhận đã lưu lên server.

Kiểm tra bằng code và database H2 cô lập; không dùng Chrome và không truy cập dữ liệu production. Script SQL cần được chạy và kiểm tra trên database triển khai thực tế.
