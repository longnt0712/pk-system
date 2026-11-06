# Speaking studio · triển khai

Module mới dùng 6 bảng `tbl_speaking_*`, không sửa kết quả cũ hoặc cách tính bài tập đã giao.

1. Sao lưu database theo quy trình hiện tại. Chạy **toàn bộ** `speaking-studio.sql` trong database ứng dụng bằng SQL Server Management Studio. Script hỗ trợ SQL Server 2008 R2 (10.50) trở lên, có thể chạy lại và không xoá dữ liệu. Bản này đã thay cú pháp báo lỗi không tương thích ở file trước; chạy thành công sẽ hiện `Speaking studio: schema is ready (6 tables).`
2. Dừng dịch vụ backend và thay JAR bằng bản `richy-wine-exec.jar` đi kèm bản phát hành này. Giữ cấu hình kết nối và thư mục upload hiện có.
3. Chọn thư mục ghi âm riêng, ví dụ thêm `speaking.storage.directory=C:/pk-data/speaking-recordings` vào cấu hình ngoài JAR. Cấp quyền đọc/ghi cho tài khoản chạy dịch vụ; không trỏ vào webroot. Nếu bỏ trống, mặc định là `<user.home>/.ieltsroom/speaking-recordings` của tài khoản dịch vụ.
4. Khởi động backend, sau đó cập nhật frontend. Vào **TEST ROOM → Speaking studio** (`/speaking`). Dùng HTTPS để trình duyệt xin quyền microphone.
5. Giáo viên tạo bộ, tải mẫu Excel, điền năm/bộ và các tab PART_1/2/3; đọc đối chiếu trước khi chọn nhập. Chia sẻ bộ cho lớp/học sinh rồi kiểm tra với tài khoản học sinh. Backend xác thực cả quyền truy cập bộ, tiến độ và từng bản ghi âm.

Mỗi năm có 3 bộ: tháng 1–4, 5–8 và 9–12. Sample và liên kết Part 2 được lưu theo từng bộ; cùng câu chữ trong nhiều bộ dùng chung dấu Pass. Mã câu trong bản xuất giúp đối chiếu khi nhập lại. Cách hỏi thay đổi mặc định tạo biến thể/Pass mới, giữ câu và lịch sử cũ; chỉ chọn sửa lỗi nhỏ nếu muốn giữ Pass. Nội dung không có trong file mới vẫn được giữ. Danh sách “chưa import” đối chiếu với file gần nhất giáo viên đã cung cấp, không tự dự đoán bộ đề còn thiếu.

Luyện tập hỗ trợ nhiều bộ của cùng giáo viên, các Part tuỳ chọn, chọn ngẫu nhiên không lặp cùng câu. Part 2 chọn 1 cue card; Part 3 ưu tiên liên quan khi đã chọn Part 2. Hoàn thành lượt luyện được ghi là “Đã luyện”; chỉ giáo viên sở hữu kho đánh dấu Pass cho học sinh.

Ghi âm là tuỳ chọn. Dữ liệu được sao lưu IndexedDB theo tài khoản và gửi từng đoạn có mã chống trùng. Chỉ báo lưu thành công sau khi server xác nhận đủ các đoạn. Khi mất mạng, giữ trang mở rồi bấm thử đồng bộ; bản thu gián đoạn có nút khôi phục. Việc đổi câu, rời trang, chuyển ứng dụng sẽ dừng microphone. Trình duyệt và thiết bị có thể ngắt ghi khi khoá màn hình; nên thử một bản ngắn trên thiết bị học sinh trước khi dùng cả buổi.

Ghi âm được giữ **3 ngày từ lúc tạo bản thu trên server**, áp dụng cả bản thu đã có trước khi cập nhật và cả bản chưa tải đủ. Hết hạn sẽ chặn nghe/tải tiếp ngay; tác vụ chạy mỗi 15 phút (lần đầu sau khi khởi động 1 phút) xoá file hoàn chỉnh, các đoạn tải lên và file tạm. Mỗi bản được xử lý riêng; lỗi ổ đĩa được ghi log để thử lại. Tiến độ luyện tập, câu trả lời, ghi chú và Pass vẫn được giữ. Chỉ giữ metadata nhận diện bản thu đã hết hạn để việc thử gửi lại bản cũ không tạo lại file.

Mỗi tài khoản được tạo tối đa **10 bản thu trong 3 ngày gần nhất**, tính chung các lượt luyện và các tab. `ROLE_ADMIN` được miễn giới hạn số bản; thời gian lưu 3 ngày vẫn áp dụng. Gửi từng đoạn hoặc thử tải lại cùng mã bản thu chỉ tính một lần. Server khoá theo tài khoản để các yêu cầu đồng thời không vượt hạn mức. Bản sao IndexedDB quá 3 ngày được dọn khi mở lại trang hoặc thử đồng bộ; bản chưa được server nhận vì đầy hạn mức được giữ tạm trên thiết bị và không tự gửi lại trước khi có lượt trống.

Giới hạn dung lượng hiện có: 64 MB/bản thu, 128 MB/lượt luyện, 64 bản thu/lượt, tối đa 10.000 câu và 4 triệu ký tự/lần import (file nén tối đa 8 MB). API nghe lại yêu cầu đăng nhập, không cung cấp URL public. Nếu có bản sao lưu database hoặc thư mục ghi âm riêng, cần đặt thời hạn giữ bản sao phù hợp; tác vụ này chỉ dọn kho ghi âm đang chạy.

Cập nhật chính sách ghi âm 3 ngày/10 bản cần **deploy JAR backend mới và frontend**, **không cần SQL mới**. Kiểm tra quyền xoá trong thư mục `speaking.storage.directory`; thư mục của bản thu phải là UUID nằm ngay dưới thư mục này, không chấp nhận liên kết tượng trưng thay cho thư mục bản thu.

Chấm GPT đang **tắt** ở giao diện và backend (`aiEnabled=false`, `aiStatus=DISABLED`). Không gọi API, không dùng token. Bản này có trạng thái chờ tích hợp; khi bật chấm cần triển khai bộ chuyển đổi ghi âm và đánh giá trước.

Kiểm tra tự động thực hiện bằng code và database H2 cô lập; không truy cập database production và không mở Chrome. Cần xác nhận microphone/quyền ghi âm bằng thiết bị thực tế sau deploy.
