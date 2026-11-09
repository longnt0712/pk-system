# Gộp bổ sung V4.1 — giữ bản chính gốc trước 06/11/2026

Dùng **GOP_BO_SUNG_GIU_BAN_GOC_ENGLISH_V4_1.sql** cho phần gộp bổ sung lần này. Chỉ xử lý tài khoản `english` trong database `ecommerce`; không cần cập nhật JAR/frontend.

V4.1 sửa lỗi `Msg 213` khi chạy V4 sau V3 trong cùng tab SSMS: dùng bộ bảng tạm riêng và khai báo rõ cột khi INSERT. Danh sách 1.583 cụm và quy tắc giữ bản gốc được giữ nguyên. Nếu V4 đang chạy được ở tab mới thì để truy vấn đó hoàn tất, không cần ngắt giữa chừng để đổi file.

## Quy tắc giữ bản chính

- Chọn thẻ còn tồn tại có **ngày tạo `create_date` trước 06/11/2026**. Nếu có nhiều thẻ cũ phù hợp, giữ thẻ tạo sớm nhất; cùng ngày/giờ tạo thì giữ ID nhỏ hơn.
- Không dùng ngày sửa `modify_date` hay đoán bản gốc từ ID. Thẻ cũ vừa được sửa hôm nay vẫn được nhận diện là thẻ cũ.
- **Giữ nguyên nghĩa hiện có, phiên âm, CEFR, mô tả, trạng thái, ngày tạo và ID của bản chính.** Không lấy định nghĩa mới đè lên, không tự ghép dấu `/`.
- Gom các topic/category từ bản phụ về bản chính; cộng các bộ đếm và chuyển tham chiếu câu trả lời/bài giao/kết quả, giữ ID và lịch sử tương ứng.
- Không xác định được bản gốc phù hợp trước 06/11 thì bỏ qua cả cụm. Thẻ đã sửa từ/nghĩa ngoài các bản đã đối chiếu cũng làm cụm được bỏ qua để giữ công việc bạn đã sửa tay.
- Không tự phục hồi hoặc sửa lại nội dung của các lượt gộp trước. Bản này giữ nội dung hiện có của bản gốc tại lúc chạy.

## Phần bổ sung

Đã đọc đối chiếu thêm **1.583 cụm** sau kế hoạch V3, chủ yếu là cùng nghĩa nhưng khác cách viết, từ đồng nghĩa, số bằng chữ/số và cách trình bày. Ví dụ: `century` — “thế kỉ / thế kỷ”, `misunderstand` — “hiểu nhầm / hiểu lầm”, `taxpayer` — “người nộp thuế / người đóng thuế”.

Những cặp khác nghĩa rõ ràng để riêng, chẳng hạn `patient` — “bệnh nhân / kiên nhẫn”, `swear` — “thề / chửi thề”, hoặc bản dịch sai như `millionaire` — “tỉ phú / triệu phú”. Không dùng mức giống ký tự để tự chốt nghĩa.

Con số 1.583 là danh sách đối chiếu từ XML cũ, **không phải cam kết số nhóm còn gộp được trên server**. Nhóm bạn đã xử lý hoặc không còn thẻ gốc đủ điều kiện sẽ được bỏ qua. Khi chạy xem trước, SQL tính số thực tế.

## Chạy bằng SSMS

1. Chọn database **ecommerce**, mở file V4.1 và chạy toàn bộ file với `@Apply = 0` để xem trước.
2. Xem bảng `merge_groups` / `redundant_cards`, bảng có `original_created_date` và các cụm bỏ qua kèm lý do.
3. Đổi `@Apply = 1`, chạy toàn bộ file. Mỗi lượt tối đa **1.000 cụm**.
4. Đợi truy vấn hoàn tất rồi chạy lại để gộp phần tiếp theo; khi `merge_groups = 0` thì hết nhóm đủ điều kiện trong kế hoạch V4.

Mỗi lượt có thay đổi tạo 7 bảng backup trong cùng database; kết quả cuối hiện `backup_table_prefix`. Nếu có lỗi giữa lượt, transaction hoàn tác toàn bộ thay đổi của lượt đó.

SQL này chưa được chạy trên server thật. Kiểm tra dùng database cục bộ tách riêng và tự xóa khi kết thúc.

## Kết quả kiểm tra

- Thử nối tiếp V3 rồi V4 trên toàn bộ 23.197 thẻ trong XML: V4 xử lý thêm 1.583 cụm; nội dung và thông tin bản gốc còn sống được giữ; topic và lịch sử vẫn đủ. Chạy lại không thay đổi thêm.
- Kiểm tra riêng việc ưu tiên ngày tạo dù ID bản gốc lớn hơn, thẻ cũ vừa được sửa, mốc 06/11 và ngày tạo bị thiếu, sửa tay sau XML, khác tài khoản, gộp dở từ trước và chạy nhiều lượt.
- Tràn bộ đếm hoặc lỗi khóa ngoại giữa lượt đều hoàn tác toàn bộ transaction, bao gồm các bảng backup của lượt lỗi.
- Database thử dùng compatibility level 100. Thời gian chạy trên server đang phục vụ học sinh phụ thuộc dữ liệu và tải thực tế.
- Đã tái hiện lỗi `Msg 213` bằng V3 → V4 trong cùng một kết nối. Với V4.1: V3 → V4.1 → V4.1 trong cùng một kết nối đều qua kiểm tra, bao gồm xem trước, gộp thật trên database thử và chạy lại không thay đổi thêm.
