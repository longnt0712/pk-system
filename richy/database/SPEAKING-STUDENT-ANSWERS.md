# Bộ Speaking dùng chung và câu trả lời riêng của học sinh

## Triển khai

Phần này có thay đổi backend. Chạy toàn bộ `speaking-student-answers.sql` trong đúng database ứng dụng **trước khi thay JAR**, rồi cập nhật frontend cùng phiên bản trên `main`. Script dùng cú pháp SQL Server 2008 R2 trở lên và có thể chạy lại. Nó chỉ bổ sung nơi lưu câu trả lời, không thay đổi các câu hỏi, sample, dấu Pass, lượt luyện hay bản ghi âm hiện có. Các bảng Speaking từ `speaking-studio.sql` vẫn là điều kiện tiên quyết.

## Bộ dùng chung

Bộ có chủ sở hữu hiện giữ quyền admin được tự động mở cho mọi tài khoản đã đăng nhập. Quy tắc này áp dụng cả bộ đã tạo từ trước, không tạo bản sao hay thay mã câu. Nút Chia sẻ không còn cần thiết với bộ này. Tài khoản tạo bộ vẫn giữ quyền import và quản lý nội dung bộ đề; tài khoản giáo viên thường vẫn có thể dùng kho riêng theo cơ chế chia sẻ cũ.

Giáo viên được xem câu trả lời và xác nhận Pass cho học sinh thuộc lớp mình phụ trách, kể cả lớp con. Quyền đọc bộ đề chung không tự mở quyền đọc bài luyện và bản ghi âm riêng của người khác. Học sinh được sửa câu trả lời của chính mình, không tự xác nhận Pass hoặc sửa bài của bạn khác.

## Import và sửa câu trả lời

1. Mở Speaking, chọn bộ đề. Giáo viên chọn học sinh cần làm việc; học sinh mở phần của chính mình.
2. Tải mẫu câu trả lời của bộ/học sinh đang chọn. Mẫu chứa mã và nội dung câu hỏi để đối chiếu; điền hoặc dán câu trả lời vào cột tương ứng, giữ các mã và thông tin nhận dạng.
3. Import file để xem trước. Kiểm tra các dòng mới, có thay đổi, giữ nguyên hoặc lỗi. Chỉ chọn những dòng muốn lưu; dòng lỗi không được nhập. Dòng không có trong file không bị xóa.
4. Việc thay thế một câu trả lời đã có chỉ áp dụng cho các dòng được chọn, kèm ghi chú gắn trong câu trả lời đó. Không tác động sample dùng chung hoặc câu trả lời của học sinh khác.
5. Mở câu trả lời để sửa nội dung, chữ đậm, nghiêng hoặc gạch chân. Bôi chọn đoạn chữ để thêm note hoặc highlight; bấm vào đoạn có note để mở/đóng, bấm ra ngoài để đóng note.

Câu trả lời và note được lưu theo học sinh và mã câu hỏi. Sample chung được lưu riêng. Khi cách hỏi được import thành biến thể mới, câu hỏi mới có vùng trả lời riêng, không ghi đè câu trả lời của câu cũ.

Chỉ báo lưu thành công khi backend xác nhận đúng bộ, học sinh, câu hỏi và phiên bản. Nếu giáo viên và học sinh cùng sửa một bản cũ, hệ thống báo xung đột và giữ nội dung đang sửa để đối chiếu; không tự ghi đè bản mới của người kia. Bản nháp trên trình duyệt là phương án khôi phục khi chưa đồng bộ, không phải xác nhận đã lưu lên server.

Kiểm tra bằng code và database H2 cô lập; không dùng Chrome và không truy cập dữ liệu production. Script SQL cần được chạy và kiểm tra trên database triển khai thực tế.
