# Gộp từ trùng của tài khoản english

File chạy: `GOP_TU_TRUNG_ENGLISH_20261108.sql`.

Kế hoạch dựa trên `english-duplicates-20261108.xml`: 23.197 thẻ, thuộc 8.535 nhóm có cùng từ tiếng Anh. Dự kiến giữ 4.101 bản chính và gộp 4.993 bản phụ. Một từ có thể có nhiều cụm nghĩa khác nhau; số cụm gộp không phải số nguyên từ.

Chỉ gộp cùng từ/cụm tiếng Anh, với các nghĩa trùng thành phần hoặc những nghĩa gần nhau đã chọn cụ thể theo ID. Mỗi cụm giữ **một định nghĩa có sẵn**; không ghép nhiều định nghĩa bằng `/`. Dấu `/` vốn đã có trong chính định nghĩa được giữ không bị tự ý thay đổi. Các trường hợp khác nghĩa hoặc chưa đủ chắc chắn vẫn giữ riêng; bảng kết quả thứ ba của SQL hiển thị các thẻ còn trùng chữ.

## Cách chạy

1. Mở file bằng SSMS, chọn database **ecommerce** và chạy toàn bộ file. Mặc định `DECLARE @Apply bit = 0;` chỉ xem trước, không đổi dữ liệu.
2. Kiểm tra bảng 1 (số cụm/bản phụ), bảng 2 (ID chính, ID phụ, nghĩa được giữ) và bảng 3 (các nghĩa còn để riêng).
3. Khi chấp nhận danh sách, đổi duy nhất `DECLARE @Apply bit = 0;` thành `DECLARE @Apply bit = 1;`, rồi chạy toàn bộ file.

Nên sao lưu database và chạy lúc ít học sinh đang làm bài. Đây là tác vụ ghi nhiều thẻ, có thể giữ khóa trong lúc thực hiện. Không cần cập nhật JAR hoặc chạy SQL tạo bảng chức năng mới.

## Dữ liệu được giữ

- Chỉ tài khoản `english`, chỉ thẻ từ vựng gốc loại 6. Các bản chính giữ ID nhỏ nhất trong cụm.
- Toàn bộ topic và category của các bản đã chọn được gom về bản chính; liên kết trùng giữ một lần.
- Giữ phiên âm, CEFR, mô tả và trạng thái của bản chính. Cộng dồn các bộ đếm lượt luyện.
- Giữ ID các câu trả lời và lịch sử kết quả; chỉ chuyển liên kết về bản chính. Không xóa Test Result.
- Thẻ đang là đề/bài được giao hoặc có câu con được bảo vệ. Nếu một ID trong danh sách đối chiếu đã đổi từ/nghĩa/chủ sở hữu hoặc không còn đủ điều kiện, SQL dừng trước khi gộp.

Mọi thay đổi nằm trong một transaction. Nếu có lỗi giữa chừng thì hoàn tác cả lượt. Khi chạy thành công, SQL tạo 5 bảng sao lưu các dòng bị tác động, có tiền tố `vocab_merge_english_...` được trả về cuối cùng. Các bảng này hỗ trợ khôi phục có kiểm tra; không phải nút hoàn tác tự động.

Chạy lại cùng file sau khi thành công không gộp lặp các cặp đã xử lý. Nếu dữ liệu đã thay đổi theo cách khác, file có thể yêu cầu đối chiếu lại.

## Kiểm tra đã thực hiện

- 8 ca kiểm tra: xem trước, phạm vi chủ sở hữu/loại thẻ, gom đủ liên kết, giữ lịch sử, chạy lại, giữ một nghĩa gần nhau, dữ liệu cũ không còn khớp, tràn bộ đếm và lỗi sau khi chuyển liên kết.
- Nạp toàn bộ 23.197 thẻ XML vào database thử nghiệm riêng, tạo thêm các liên kết topic/category/lịch sử mẫu. Gộp được đúng 4.101 cụm / 4.993 bản phụ; giữ đủ các liên kết và ID lịch sử. Chạy lại không thay đổi thêm dữ liệu.
- Kiểm tra trên SQL Server cục bộ 2022 với compatibility level 100; cú pháp được viết cho SQL Server 2008 R2. Chưa chạy gộp trên server thật.
