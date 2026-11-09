# SQL V2 — cho phép chuyển liên kết bài test

File: `GOP_TU_TRUNG_ENGLISH_20261108_V2.sql`.

V2 dùng cùng danh sách 4.101 cụm / 4.993 bản phụ đã đối chiếu từ XML. Mỗi cụm giữ một định nghĩa có sẵn, không nối các nghĩa bằng `/`.

- `@MergeTestReferences = 1` đã được bật theo yêu cầu: thẻ từ đang được bài giao hoặc kết quả tham chiếu được phép gộp. SQL chỉ chuyển các cột tham chiếu sang ID từ chính. ID task, ID kết quả, mã lượt, trạng thái và tiến độ trong các bản ghi đó được giữ nguyên.
- Mọi topic/category vẫn được gom đầy đủ. Giữ ID câu trả lời và lịch sử kết quả.
- Các đề có câu con vẫn dừng để tránh trộn cấu trúc đề. Chốt đúng tài khoản `english`, đúng từ và đúng nghĩa so với XML vẫn giữ.
- Nếu còn cặp bị chặn, tab **Results** sẽ có bảng số lượng theo lý do và bảng ID/giá trị hiện tại để đối chiếu. Thông báo chung ở tab Messages của bản cũ không đủ kết luận rằng nguyên nhân là bài test.

## Chạy

1. Chọn database **ecommerce**, chạy **toàn bộ file** với `DECLARE @Apply bit = 0;` để xem trước.
2. Nếu danh sách đã đúng, đổi thành `DECLARE @Apply bit = 1;` rồi chạy toàn bộ file.
3. Chạy lúc ít người sử dụng và sao lưu database trước khi gộp nhiều thẻ.

V2 tạo 7 bảng sao lưu các dòng bị tác động, gồm cả bài giao/kết quả có tham chiếu được chuyển. Tất cả thay đổi trong một transaction; lỗi giữa chừng sẽ hoàn tác toàn bộ. Không cần JAR mới. Chưa chạy gộp trên server thật.
