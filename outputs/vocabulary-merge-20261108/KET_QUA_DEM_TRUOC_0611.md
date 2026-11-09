# Đếm thẻ gốc trước 06/11/2026

Đã chạy truy vấn chỉ đọc `DEM_TRUNG_BAN_GOC_TRUOC_0611_ENGLISH.sql` trong SSMS qua Remote ngày 08/11/2026. Database `ecommerce`, tài khoản từ vựng `english`. SSMS báo Query executed successfully.

| Chỉ tiêu | Kết quả |
| --- | ---: |
| Nhóm có ít nhất hai thẻ tạo trước 06/11/2026 | 779 |
| Tổng thẻ cũ trong các nhóm đó | 1.735 |
| Số bản dư nếu mỗi nhóm chỉ giữ một thẻ | 956 |

Phạm vi: `question_type=6`, `parent_id IS NULL`, chủ sở hữu `english`, `create_date < 2026-11-06 00:00:00`. Chuẩn hóa chữ thường, khoảng trắng đầu/cuối và khoảng trắng lặp để nhóm theo mặt chữ; không đối chiếu nghĩa.

Đếm dữ liệu còn tồn tại tại thời điểm truy vấn sau các lượt gộp; không phải ảnh chụp lịch sử trước khi gộp. Tính cả các nhóm đã đánh dấu Đã check. Chưa đối chiếu bộ lọc giao diện đang báo 389. Không thực hiện thêm thao tác gộp hoặc thay đổi dữ liệu ứng dụng.
