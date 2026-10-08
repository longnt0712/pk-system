# Cập nhật Battle Online — 09/10/2026

Phiên bản frontend: `20261009-238`.

## Thay đổi

- Trong chế độ video, khi tất cả học sinh đang chơi đã nộp đáp án, video tự tiếp tục ngay. Nếu còn học sinh chưa nộp, vẫn dùng thời gian trả lời đã cấu hình. Áp dụng cho cả 7 chế độ Battle.
- Học sinh trả lời sai trong chế độ video chỉ thấy “SAI RỒI!”, không bị khóa ôn lại 3 giây. Mỗi học sinh vẫn chỉ được nộp một lần cho mỗi câu.
- Khung video giữ tỷ lệ 16:9 và tự giới hạn kích thước theo chiều cao màn hình, có chỗ cho thông báo và nút phát.
- Bỏ đoạn hướng dẫn về pool 3 trứng, bổ sung trứng và lượt bóc trong cột thời gian của host Lụm ngay, cho cả chế độ thường và video.

## Cài đặt

1. Sao lưu frontend và JAR đang chạy.
2. Copy nội dung thư mục `frontend` vào thư mục frontend mà website đang phục vụ, giữ cấu trúc thư mục con.
3. Dừng backend, thay JAR hiện tại bằng `richy-wine-exec.jar` trong gói, rồi khởi động lại backend.
4. Tải lại trang để nhận phiên bản `20261009-238`.

Bản cập nhật này không thêm cột database. Với hệ thống đang dùng bản Battle video trước đó, không cần chạy SQL mới.

## Kiểm tra sau cập nhật

Tạo phòng có ít nhất 2 học sinh và đề video có 2 mốc câu hỏi. Sau lượt nộp đầu tiên, video vẫn dừng. Sau lượt nộp cuối, video tự chạy đến mốc kế tiếp dù còn thời gian. Thử trả lời sai để kiểm tra chỉ có thông báo sai và không có khóa 3 giây. Kiểm tra cột thời gian Lụm ngay đã bỏ đoạn hướng dẫn.

Gói đã được build và kiểm thử tại máy phát triển; chưa triển khai lên ieltsroom.com.
