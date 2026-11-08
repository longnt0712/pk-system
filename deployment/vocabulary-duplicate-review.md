# Gộp 10 nhóm từ và lưu trạng thái Đã check

## Triển khai

1. Chạy `richy/database/vocabulary-duplicate-review.sql` trong database ứng dụng trước khi cập nhật JAR. Script tương thích SQL Server 2008 R2+, chỉ thêm hai cột nullable vào `dbo.tbl_question`; chạy lại được, không gộp hay sửa dữ liệu từ vựng hiện có.
2. Build và deploy JAR từ cùng phiên bản code với frontend. Entity `Question` có hai cột mới, vì vậy cần hoàn thành bước SQL trước khi khởi động JAR mới.
3. Cập nhật frontend. Màn hình dùng thêm API `/api/question/vocabulary/duplicates/merge_batch` và `/review`; cần backend mới để lưu.

## Cách dùng

- Mỗi trang hiển thị tối đa 10 nhóm có cùng nguyên từ/cụm từ, trong kho tài khoản đang đăng nhập. Chỉ tải chi tiết 10 nhóm hiện tại.
- Chọn các thẻ cần gộp và một bản chính, sửa nghĩa sau gộp rồi bấm **Lưu & gộp**. Có thể bỏ chọn một nhóm để xử lý sau. Giao diện mặc định ghép các nghĩa khác nhau bằng ` / `; nghĩa trùng hệt chỉ giữ một lần. **Giữ nghĩa bản chính** là lựa chọn riêng; nội dung đã sửa tay vẫn được giữ khi đổi lựa chọn thẻ.
- Tất cả topic/category của các thẻ được chọn được chuyển vào bản chính, loại liên kết trùng. Giữ ID bản chính, phiên âm, CEFR, mô tả và các ID liên kết câu trả lời đã lưu. Các bản phụ được xóa sau khi chuyển liên kết.
- Cả lượt lưu là một transaction: một nhóm lỗi hoặc dữ liệu thay đổi thì không lưu dở các nhóm khác. Nhóm có con hoặc đang làm nguồn đề/bài giao trực tiếp được chặn theo quy tắc sẵn có.
- Sau khi server xác nhận gộp thành công, toàn bộ nhóm từ còn lại được đánh dấu **Đã check**, kể cả bản khác nghĩa cố ý chưa chọn gộp. Mặc định ẩn nhóm đã check.
- Ô tích bên cạnh từ trong thanh danh sách lưu/bỏ trạng thái **Đã check** ngay, không gộp từ và không thay đổi topic/nghĩa.
- Bật **Hiện tất cả** để xem lại nhóm đã check hoặc bỏ tích. Đây là trạng thái nhóm hiện tại; không khôi phục các thẻ phụ đã gộp.
- Dấu check được lưu trên server và gắn với đúng danh sách ID hiện tại. Có bản trùng mới hoặc đổi nguyên từ/cụm từ thì nhóm cần được kiểm tra lại. Nếu nhóm đổi trong lúc đang sửa, tải lại danh sách trước khi xác nhận gộp.
- Khi phản hồi lỗi hoặc mất kết nối, giữ phần đang sửa và không tự đánh dấu thành công. Tải lại danh sách để đối chiếu trước khi gửi lại.

## Kiểm tra

- `node --test richy/app/tests/vocabulary-duplicates.test.cjs`
- Maven: `VocabularyDuplicatePersistenceTest,VocabularyAccessTest` trong module `richy-api` cùng các module phụ thuộc. Có kiểm tra FK và rollback khi nhóm sau của lượt lưu lỗi.
- Script SQL đã được kiểm tra chạy lần đầu, chạy lại và rollback khi cột có kiểu sai trong database cục bộ độc lập. Không chạy gộp dữ liệu thật để kiểm thử giao diện.
