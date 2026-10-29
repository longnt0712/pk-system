# Chia bài Tổng hợp và chọn thời gian khi giao

Bản này cần **SQL mới + JAR mới + frontend mới**. Chạy toàn bộ `comprehensive-assignment-sections.sql` trong đúng database ứng dụng, sau đó thay JAR rồi cập nhật frontend. Script hỗ trợ SQL Server 2008 R2 (10.50) trở lên, dùng `RAISERROR`; có thể chạy lại, chỉ thêm cột nullable và index, không sửa lịch sử đã lưu. Nếu chưa chạy SQL Speaking trước đó, vẫn cần chạy riêng SQL Speaking khi deploy bản JAR chứa Speaking.

Trong modal giao task, chọn **Bài tập tổng hợp**, chọn đề rồi:

1. Chọn **Có tính giờ** và nhập số phút, hoặc **Không tính giờ**. Lựa chọn này dùng được cả với bài nguyên đề.
2. Nếu muốn chia bài, bật chia phần, nhập số câu mục tiêu (ví dụ 50), bấm **Xem cách chia**. Kiểm tra các phần và đặt thời gian riêng cho từng phần nếu cần; có thể để một phần không tính giờ.
3. Lưu task như bình thường. 200 câu trắc nghiệm độc lập sẽ thành 4 phần × 50. Nhóm dùng chung đề/answer bank/kéo thả/ô điền được giữ trọn; passage có heading luôn thành một phần riêng. Số câu có thể lệch mốc để tránh cắt hỏng nhóm. Phần đuôi quá ít câu có thể được gộp với phần trước nếu không ảnh hưởng nhóm heading.

Học sinh thấy mỗi phần là một thẻ để mở và làm riêng. Cùng một `assignmentTaskId` được giữ; mỗi phần có mã riêng do server tạo và danh sách ID câu cố định. Chia theo đề gốc trước khi xáo. Bản nháp, biên nhận nộp, lần làm lại và lời nhắc đều phân biệt phần. Phần đã đạt được giữ khi học sinh làm phần khác.

Ngưỡng khách quan 85% tính riêng trên toàn bộ câu của phần, gồm cả câu bỏ trống: 50 câu cần ít nhất 43 câu đúng. Các yêu cầu riêng của Writing hoặc bài nghe điền từ lồng trong Tổng hợp được giữ, chỉ kiểm tra phần đang làm. Kết quả ngoài phần, câu trùng hoặc phần của task khác bị từ chối. Thử gửi lại cùng một mã lượt không tạo kết quả mới.

Với yêu cầu một lần đạt mỗi phần, tiến độ task là 25/50/75/100% khi có 4 phần. Nếu yêu cầu nhiều lần đạt, từng phần cần đủ số lần đó; lượt dư ở phần này không cộng cho phần khác. Trạng thái giáo viên đánh thủ công vẫn giữ ưu tiên như trước. Task chia phần đã có kết quả không được đổi đề hoặc cách chia; hãy tạo task mới để giữ đúng lịch sử. Có thể sửa thời gian và các thông tin khác mà không đổi mã phần.

Không tính giờ vẫn giữ chế độ làm bài được giao và hạn nộp của giáo viên. Đồng hồ ghi thời gian hoạt động, không tự nộp vì hết thời lượng. Bài không có video và có tính giờ giữ cách tự nộp khi hết giờ. **Bài có video giữ cách cũ: hết thời gian dự kiến vẫn tiếp tục làm**, không đổi hạn giao. Đề bị sửa mất câu hoặc đổi nhóm chung qua ranh giới các phần sẽ được báo rõ; không tự chia lại làm sai tiến độ cũ.

Task cũ không tự bị chia và không đổi thời gian: các cột mới NULL giữ cách hoạt động trước đây. Kết quả nguyên đề cũ không bị dùng để cộng hoàn thành phần mới. Nếu frontend đã cập nhật nhưng backend còn cũ, lựa chọn chia phần/thời gian mới được chặn để tránh lưu sai cấu hình.

Kiểm tra tự động dùng code và database H2 cô lập. Không mở Chrome, không truy cập dữ liệu production. Chưa chạy script trực tiếp trên SQL Server của bạn; kiểm tra thông báo `Comprehensive assignment sections: schema is ready.` sau khi chạy SQL.
