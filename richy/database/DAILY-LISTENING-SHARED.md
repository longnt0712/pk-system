# Daily Listening trong kho test chung

Daily Listening mới dùng `tbl_question` như các bài test: `question_type = 11`,
`test_format = 'DAILY_LISTENING'`, `status = 7`. Tiêu đề ở `title`, audio ở
`pronounce`, transcript ở `mother_tongue`. Không cần bảng hay cột mới cho phần này.
Folder dùng `tbl_test_folder` với `test_mode = 'DAILY_LISTENING'`; mỗi giáo viên
có cây folder riêng. Database cần có schema folder hiện hành trong
`comprehensive-test-folders.sql` và `ielts-test-folders.sql` như các phần test khác.

## Triển khai và chuyển bài cũ

1. Build lại JAR backend và triển khai cùng frontend có `APP_VERSION = 20261012-257`.
2. Đăng nhập bằng tài khoản giáo viên có `ROLE_ADMIN`, mở **TEST ROOM → Tạo Daily Listening**.
3. Chọn **Chuyển bài cũ vào kho chung**, chọn những bài cần chuyển rồi bấm **Đưa sang Daily Listening**.
   Danh sách mặc định gồm bài đã đánh dấu Listening (`status = 5`) có audio và
   transcript của mọi người tạo. Bật **Bao gồm flashcard chưa đánh dấu Listening**
   nếu cần chọn thêm bài chưa đánh dấu. Không cần chọn tài khoản nguồn.
4. Bài đã chuyển hiện ở cấp gốc. Tạo folder/folder con và kéo bài vào folder,
   hoặc dùng nút **Di chuyển** để chọn vị trí trong cây folder.
5. Học sinh bấm thẻ **DAILY LISTENING** trên dashboard hoặc mở **TEST ROOM → Daily Listening** để xem thư viện chung và làm bài.

API `POST /api/daily_listening/migrate/{id}` đọc bản ghi hiện có rồi đổi phân loại
ngay trên ID đó. Giữ người tạo, audio, transcript nguyên gốc, bộ đếm, answers và
liên kết topic cũ để kết quả, bài giao và bản nháp học sinh tiếp tục dùng đúng ID.
Nếu folder cũ thuộc loại test khác, bài được đưa về cấp gốc Daily Listening.
Gọi lại với bài đã chuyển không tạo bản sao hay ghi lại bài. Bài không có audio
hợp lệ/transcript sẽ bị từ chối; những bài lỗi vẫn được chọn trong modal để thử lại.

Bài sau khi chuyển rời danh sách flashcard. Giao diện làm bài vẫn dùng cơ chế
Daily Listening cũ, tự sinh gaps khi mở bài, ghi nhận từ đúng và hoàn thành ở 90%.
Backend cũng dùng ngưỡng 90% cho kết quả gắn với bài trong kho chung. Các bài cũ
chưa chuyển vẫn hoạt động như trước.

Chỉ mở giao diện hoặc triển khai code không tự sửa dữ liệu. Dữ liệu được chuyển
khi giáo viên chọn và thực hiện thao tác chuyển trong modal.
