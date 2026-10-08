# Battle Online với video

Áp dụng cho CLASSIC, GUESS WORD, COUNTDOWN, XIN TIỀN, THOÁT KHỎI QUỶ NGU, DIỆT QUỶ NGU và LỤM NGAY.

## Sử dụng

- Soạn hoặc sửa đề Tổng hợp, chọn Video và nhập link cùng mốc xuất hiện câu hỏi.
- Nhập **Thời gian trả lời trong Battle**, mặc định 20 giây. Mỗi câu có thể đặt từ 1 đến 3600 giây. Nhóm câu hỏi có thời gian mặc định chung và có thể ghi đè cho từng câu con.
- Chọn đề này khi tạo Battle. Host phát video trên màn hình chung; học sinh nhận sẵn câu hỏi nhưng chưa nhìn thấy nội dung.
- Đến mốc, video dừng; server mở cùng một câu cho cả lớp và bắt đầu thời gian trả lời. Nộp sớm vẫn chờ hết giờ. Hết giờ, host tự tiếp tục video tới mốc kế tiếp.
- Các câu có cùng mốc được trả lời lần lượt, video giữ nguyên vị trí trong các lượt đó. Đề video luôn theo mốc, kể cả khi bật đảo thứ tự câu hỏi.
- Sau câu cuối của trận, kết thúc ngay; không chờ video phát hết và không giới hạn tổng số phút. Nếu còn video khác trong bộ đề, xem hết đoạn hiện tại rồi chuyển sang video kế tiếp. Số câu vẫn theo cấu hình phòng. Điểm, kỹ năng, mật khẩu và quà của từng mode vẫn hoạt động.
- Với đề video, chỉ đồng hồ trả lời từng câu dùng thời gian trong đề. DIỆT QUỶ NGU tạm dừng quỷ khi lớp xem video và cho quỷ chạy trong các lượt trả lời.
- Nếu trình duyệt chưa cho tự phát, host bấm **Phát / tiếp tục video**. Nếu video bị chặn nhúng hoặc mốc lớn hơn thời lượng video, sửa link hoặc mốc trong đề.
- Host tải lại trang sẽ tiếp tục từ vị trí đã đồng bộ gần nhất (khoảng một giây); học sinh tải lại vẫn tuân theo trạng thái câu hỏi của phòng.

## Đưa bản cập nhật lên server

1. Chạy `battle-video-answer-time.sql` trong đúng database ứng dụng bằng SSMS. Script chỉ thêm cột còn thiếu; không sửa dữ liệu câu hỏi đang có.
2. Sao lưu frontend và JAR đang chạy. Dừng `richy-wine-service`, kiểm tra không còn Java cũ chiếm cổng 8085 rồi thay `C:\richy-wine-service\richy-wine-exec.jar` bằng JAR trong gói.
3. Copy **nội dung** thư mục `frontend` trong gói vào thư mục đang phục vụ web (thư mục `ielts-clients` trên server), giữ cấu trúc thư mục con. Gói có cả sửa lỗi báo trạng thái lưu Topic của lượt trước.
4. Start service, kiểm tra trạng thái Running và tải lại trang web để nhận phiên bản `20261008-237`.
5. Tạo một phòng với đề video có hai câu tại hai mốc khác nhau; cho host và một tài khoản học sinh tham gia. Kiểm tra: trước mốc không thấy câu hỏi, đến mốc hiện câu và đếm giờ, nộp sớm không chuyển câu, hết giờ video chạy tiếp. Thử sửa một câu thành 35 giây, lưu và mở lại đề để kiểm tra dữ liệu đã lưu.

Gói được build và kiểm thử tại máy phát triển; chưa triển khai lên ieltsroom.com.

## Kiểm thử tại dự án

Backend: `BattleOnlineVideoTest`, các kiểm thử Battle, GiftDrop, DemonDefense và `ComprehensiveVideoValidationTest`.

Frontend: các kiểm thử Battle và ComprehensiveVideo; kiểm thử trình duyệt dùng template thật của host/học sinh và editor, bao gồm giao diện học sinh 390px.
