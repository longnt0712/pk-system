# Cập nhật Battle Online — 09/10/2026

Phiên bản frontend: `20261009-239`.

## Thay đổi

- Mặc định bật đảo thứ tự câu hỏi. Các câu video vẫn chạy theo mốc thời gian; lựa chọn tắt đã lưu của phòng được giữ nguyên.
- Host thấy modal câu hỏi gần toàn màn hình khi video đến mốc, có đồng hồ đếm ngược. Modal tự đóng khi video tiếp tục.
- Học sinh thấy thông báo nhỏ `Correct` / `Incorrect` ở góc màn hình trong chế độ video.
- Thêm nút `List câu hỏi` cạnh nút phát. Danh sách chỉ hiện mốc thời gian, số câu và phần đầu ngắn của câu hỏi.
- Câu đang đến được tô nổi bật và tự cuộn về khoảng 1/3 từ trên xuống trong danh sách, kể cả khi đổi kích thước màn hình.
- Bấm câu trong danh sách để nhảy video đến đúng mốc. Hộp hỏi có hai lựa chọn: `Chỉ xem lại` hoặc `Cho lớp trả lời lại`.
- `Chỉ xem lại` giữ điểm và tiến độ câu hỏi của lớp. Dùng `Về câu hiện tại` để quay về luồng trận đang chạy.
- `Cho lớp trả lời lại` mở lượt trả lời mới cho câu đã chọn, bắt đầu lại đồng hồ và xóa trạng thái đã nộp của lượt trước. Điểm đã có được giữ; lượt trả lời mới tính điểm theo chế độ đang chơi. Cả lớp nhận câu đã chọn qua cập nhật phòng.
- Đáp án gửi chậm từ lượt cũ không được tính vào lượt mở lại.
- Ẩn cài đặt `Sai bị khóa (giây)` trong phòng video và bỏ các dòng mô tả dưới video.
- Gói này cũng chứa các sửa trước: video vừa một màn hình, tự tiếp tục khi mọi học sinh đang chơi đã nộp, trả lời sai không khóa ôn lại 3 giây, và bỏ đoạn hướng dẫn trong cột thời gian Lụm ngay.

## Cài đặt

1. Sao lưu frontend và JAR hiện tại.
2. Copy nội dung thư mục `frontend` vào thư mục frontend website đang phục vụ, giữ cấu trúc thư mục con.
3. Dừng backend, thay JAR bằng `richy-wine-exec.jar` trong gói, rồi khởi động lại.
4. Host và học sinh tải lại trang để nhận phiên bản `20261009-239` trước khi tạo trận mới.

Cập nhật cả frontend và backend trong cùng lần để dùng danh sách và lượt trả lời lại. Không cần thay đổi database cho bản cập nhật này.

## Kiểm thử

- Maven build thành công; 42 kiểm thử backend đạt.
- 61 kiểm thử frontend đạt, bao gồm kiểm tra template thật trên Chrome, màn hình máy tính/điện thoại, modal đếm ngược, cuộn danh sách, nhảy video, lựa chọn xem lại và trả lời lại, cùng đáp án gửi chậm.
- `SHA256SUMS.csv` chứa mã kiểm tra các file trong gói.

Đã đóng gói tại máy phát triển; chưa triển khai lên ieltsroom.com.
