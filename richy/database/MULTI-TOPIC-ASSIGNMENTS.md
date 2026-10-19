# Giao nhiều topic và lưu kết quả an toàn

## Triển khai

1. Chạy [daily-vocab-assignment-topics.sql](daily-vocab-assignment-topics.sql), sau đó [test-result-attempt-lookup.sql](test-result-attempt-lookup.sql) trên database SQL Server của ứng dụng trước khi khởi động backend mới. Dùng công cụ hỗ trợ `GO` để chạy script có phân tách batch.
2. Build và triển khai backend JAR từ cùng phiên bản code, rồi khởi động lại service.
3. Cập nhật frontend và tải lại các tab đang mở để dùng mã lượt làm mới. Luồng tự pull frontend không thay thế bước triển khai backend.

Backend cũ không có `multiTopicVocabEnabled`; frontend sẽ giữ form và báo cần cập nhật backend khi lưu một task có nhiều topic, tránh chỉ lưu nhầm topic đầu.

## Quy tắc được giữ

- Daily Vocab có thể giao nhiều topic trong một task. Mỗi topic xuất hiện thành một bài riêng, cùng `assignmentTaskId`. Số lần yêu cầu áp dụng cho từng topic.
- Với một lần đạt cho mỗi topic: hoàn thành 1/3 tương ứng 33%, 2/3 tương ứng 67%, đủ 3/3 mới hoàn thành task. Học lại một topic nhiều lần không thay thế topic khác.
- Bài tập chỉ tính kết quả phù hợp với học sinh, task, topic/track/phần được giao và cửa sổ thời gian giao bài. Các lượt `FAILED` không hoàn thành bài tập. Dữ liệu Daily Vocab cũ có trạng thái `NULL` giữ cách tính trước đây, đồng nhất giữa màn hình giáo viên và học sinh.
- Đối chiếu ở buổi học tiếp theo vẫn dùng task đã giao ở buổi trước. Quy tắc giáo viên đánh “Cần bổ sung” giữ nguyên; thay đổi quy tắc này được để xử lý riêng.
- Danh sách Test Result gồm mọi lượt nộp đã lưu, gồm cả lượt chưa đạt. Số dòng không đồng nghĩa số bài tập đã hoàn thành. Một kết quả có nhiều topic nội dung vẫn chỉ ghi nhận topic được giao đã xác thực.

## Mã lượt và bản nháp

`assignmentTaskId` nhận diện nhiệm vụ giáo viên giao; `clientAttemptKey` nhận diện một lượt làm. Lưu lại cùng lượt dùng lại mã lượt, còn lượt làm mới có mã mới và giữ nguyên task, đề/phần và hạn giao.

Backend xử lý tuần tự các lượt lưu có mã của cùng tài khoản trong giao dịch database. Cùng mã lượt, tài khoản và loại bài chỉ nhận một kết quả; các mã lượt khác nhau vẫn là các lần làm riêng. Áp dụng cho Daily Vocab, Daily Listening, Reading, Listening, Writing và Tổng hợp. Không đổi luồng Battle.

Kết quả Writing hiển thị “Đạt / Chưa đạt” theo trạng thái đã lưu, thay cho phần trăm số ô trả lời; không thay đổi ngưỡng chấm.

Writing đã nộp chưa đạt giữ bài viết và xác nhận kết quả trong bản nháp. Reload mở lại kết quả cũ, tránh tự nộp lại bản nháp 0 giây. Nút “Làm lượt mới” tạo lượt mới theo lựa chọn rõ ràng của học sinh, giữ bài viết để sửa, tính giờ theo đề và giữ hạn giao bài. Bản nháp cũ 0 giây chưa có xác nhận không được tự nộp khi khôi phục.

Bản nháp Daily Vocab và kết quả chờ lưu tách theo task, topic và lượt. Phản hồi chậm hoặc thao tác xóa của lượt cũ không được xóa bản sao của lượt mới. Kết quả chỉ báo lưu thành công sau khi có ID hợp lệ và thông tin task/phần/topic phù hợp.

## Giới hạn dữ liệu cũ

Không xóa hoặc gộp lịch sử Test Result. Các tab chưa tải lại có thể vẫn gửi dữ liệu theo giao thức cũ không có mã lượt; không thể tự khẳng định hai kết quả cũ là cùng một lượt chỉ dựa vào tên bài và thời điểm gần nhau. Ngưỡng chấm đạt/chưa đạt hiện có được giữ nguyên.
