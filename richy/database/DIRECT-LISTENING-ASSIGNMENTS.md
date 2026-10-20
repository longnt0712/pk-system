# Daily Listening giao trực tiếp bằng bài nghe

## Triển khai bản cập nhật 20/10/2026

- Cập nhật JAR backend từ cùng commit và khởi động lại service. Không có migration SQL mới trong bản này.
- Nếu đã chạy hai SQL của bản giao nhiều topic trước đó thì không cần chạy lại vì thay đổi này.
- Frontend chỉ cho lưu Daily Listening không Topic khi API xác nhận `directListeningAssignmentsEnabled=true`; backend cũ sẽ giữ form và báo cần cập nhật.

## Quy tắc

- Bài Daily Listening độc lập đã xuất bản có thể được giao bằng `sourceQuestionId`, không cần Topic.
- Kết quả chỉ tính hoàn thành khi đúng học sinh, task và bài nghe, đạt `SUCCESS` và nằm trong cửa sổ thời gian của task. Thử lưu lại cùng mã lượt vẫn trả kết quả đã lưu.
- Topic/Track cũ và trạng thái giáo viên đánh thủ công giữ quy tắc hiện có. Tiến độ task trực tiếp có ba lượt yêu cầu hiển thị 33%, 67%, 100%.
- Bản nháp bài được giao tách theo học sinh, nguồn bài và task. Không lấy bản nháp luyện tự do hoặc của task khác để nộp vào task hiện tại.
- Tổng tiến độ trên bảng giáo viên cộng mỗi task đúng một lần: 1/3 là 33%, 2/3 là 67%, 3/3 là 100%.
- Bài Tổng hợp chưa đạt có nút “Làm lượt mới”: giữ câu trả lời để sửa, task/phần và hạn giao; kiểm tra hạn mới nhất trước khi đặt lại đồng hồ. Tải lại kết quả cũ không tự tạo thêm lượt nộp.
