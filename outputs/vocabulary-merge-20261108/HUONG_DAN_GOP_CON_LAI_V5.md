# Gộp phần còn lại của kho english — V5

Dựa trên file `english-duplicates-remaining-20261108.xml` mới, không dùng lại danh sách đã gộp của V3/V4.

## Kế hoạch đã đối chiếu

- 2.758 cụm nghĩa, thuộc 2.619 nhóm cùng từ tiếng Anh.
- Gộp 3.823 bản phụ vào các bản chính được tạo **trước 06/11/2026**.
- Chọn ngày tạo cũ nhất; nếu cùng ngày tạo thì chọn ID nhỏ hơn. Không lấy ngày sửa làm ngày tạo.
- Giữ nguyên nghĩa của bản chính, không nối `/`, không lấy nghĩa mới ghi đè nghĩa cũ.
- Giữ nguyên IPA, CEFR, mô tả, trạng thái, ngày tạo và ID bản chính.
- Hợp nhất topic/category; các liên kết trùng chỉ giữ một. Cộng bộ đếm luyện tập.
- Giữ ID câu trả lời, bài giao và kết quả, chuyển tham chiếu sang bản chính.
- Không đụng tới 157 nhóm đã được đánh dấu **Đã check** và còn đúng dấu check trong XML.
- Những nghĩa khác nhau hoặc chưa đủ chắc chắn vẫn để riêng. Không gộp hai từ tiếng Anh khác nhau chỉ vì nghĩa tiếng Việt giống nhau.

## Chạy trong SSMS

1. Mở `GOP_TU_TRUNG_CON_LAI_GIU_BAN_GOC_ENGLISH_V5.sql`, chọn database **ecommerce**.
2. Chạy **toàn bộ file** với `DECLARE @Apply bit = 0;` để xem trước. Bước này không sửa dữ liệu ứng dụng.
3. Kiểm tra các bảng kết quả: ID chính/phụ, nghĩa và `original_created_date`.
4. Đổi thành `DECLARE @Apply bit = 1;`, giữ `@MaxGroups = 1000`, chạy toàn bộ file. Không chỉ bôi chọn chạy phần cuối.
5. Chạy lại toàn bộ file để gộp các cụm kế tiếp. Theo XML này cần **3 lượt có thay đổi**: 1.000 + 1.000 + 758 cụm. Chạy thêm một lượt sẽ báo không còn cặp đủ điều kiện.

Mỗi lượt hiển thị `eligible_groups_remaining_before_this_run`, là số cụm còn đủ điều kiện **trước** lượt đang chạy. Khi giá trị là 0 và hiện thông báo `KHÔNG CÒN CẶP ĐỦ ĐIỀU KIỆN`, kế hoạch đã chạy hết. Các nhóm còn hiện trùng chữ có thể thuộc những nghĩa riêng được giữ lại.

Không chạy đồng thời ở nhiều tab. SQL dùng bảng tạm riêng `#VM5_` nên có thể chạy sau V3/V4 trong cùng tab, nhưng tab không được có transaction chưa kết thúc.

## Dữ liệu thay đổi sau lúc xuất XML

SQL kiểm tra toàn bộ các bản thuộc nhóm từ có trong kế hoạch, kể cả một nghĩa khác không được chọn để gộp. Nếu từ, nghĩa, IPA, CEFR, trạng thái, ngày tạo hoặc dấu check đã đổi, cả nhóm được bỏ qua và liệt kê lý do. Những nhóm khác vẫn xử lý bình thường.

Bản đã bị gộp hoặc xóa sẽ không được tạo lại. Việc chạy lại không cộng bộ đếm lần nữa. Một nhóm chỉ được gộp khi vẫn còn ít nhất hai bản đã duyệt và còn bản chính trước 06/11/2026.

Mỗi lượt có thay đổi tạo các bảng backup với tiền tố `vocab_merge_english_...`, hiển thị ở kết quả cuối. Nếu có lỗi trong lúc ghi, toàn bộ lượt đó cùng các bảng backup được hoàn tác. Các lượt đã chạy thành công trước đó vẫn được giữ.

## Kết quả dự kiến nếu kho chưa thay đổi so với XML

- 3.823 bản phụ được gộp, còn 7.148 bản trong tập XML này. Đây **không phải** tổng số từ của toàn bộ tài khoản.
- Còn 2.282 nhóm cùng chữ tiếng Anh, bao gồm 157 nhóm đã check. Trong đó có nhiều nhóm mang các nghĩa khác nhau thật.
- 389 trước đó là số trang ở giao diện 10 nhóm/trang, không phải 389 nhóm.

## Kiểm chứng

Đã thử trên SQL Server cục bộ, database dùng một lần đặt compatibility level 100, với toàn bộ 10.971 bản trong XML: xem trước không sửa dữ liệu; ba lượt gộp và chạy lại không gộp trùng; bản chính và các bản không chọn được giữ nguyên; topic, lịch sử, bài giao, kết quả và bộ đếm được bảo toàn.

Đã kiểm tra riêng: nhóm vừa sửa/đánh dấu check, bản đổi chủ, thêm bản mới, thay đổi xảy ra sau bước lập kế hoạch, bản phụ đã xóa, giới hạn một cụm mỗi lượt, lỗi khóa ngoại và tràn bộ đếm. Lỗi ghi hoàn tác toàn lượt. Đã thử V4 rồi V5 lặp lại trong cùng phiên SQL để kiểm tra lỗi bảng tạm Msg 213.

Không chạy ghi dữ liệu trên server của bạn. Không cần cập nhật JAR, frontend hay schema ứng dụng cho file này.
