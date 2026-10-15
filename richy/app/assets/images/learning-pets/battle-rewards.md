# Trứng và pet thưởng trong Battle Online

Battle đọc cùng các tệp `*/pet.json` trong thư mục này. Khi thêm pet, tạo thư mục có tên khớp `id`, thêm ảnh và khai báo `name`, `evolution` theo các pet hiện có. Mỗi giai đoạn cần level riêng, `form` (`egg-intact`, `egg-cracked`, `hatched`) và tên tệp ảnh. Không trùng level với pet khác. Pet dùng sprite atlas cần `atlas.fallbackFile` là ảnh tĩnh để hiển thị thưởng.

Build và triển khai lại cả backend lẫn frontend sau khi thêm pet. Maven tự đóng gói các manifest vào API; không cần thêm level, tên hay đường dẫn ảnh vào bộ bốc thưởng hoặc màn hình kết quả. Trận mới sử dụng danh sách đã đóng gói; trận đang chạy giữ nguyên pool đã tạo. Cơ chế thưởng điểm này không thay đổi điều kiện mở khóa pet trong tài khoản.

Các level 0–14 có trọng số tham chiếu `round(10000 × 0.75^level)`. Trứng thối có trọng số tham chiếu 10000 và luôn nhận 0,5 điểm; mỗi kỹ năng được bật có trọng số tham chiếu 2500.

Các pet mới gồm tất cả level từ 15 trở lên và tự nhận các pet thêm sau. Bộ bốc dùng 1.000.000 vé. Jerry giữ cố định ba mức 0,63% (trứng nguyên), 0,47% (trứng nứt), 0,36% (đã nở). Mỗi **loài mới** giảm tiếp 100 vé = 0,01 điểm phần trăm ở **từng cột tương ứng**: Tuffy 0,62% / 0,46% / 0,35%; Pikachu 0,61% / 0,45% / 0,34%; loài tiếp theo 0,60% / 0,44% / 0,33%. Các mức này giữ nguyên khi bật kỹ năng. Tỉ lệ tối thiểu là 0,01%, để pet thêm sau luôn có thể xuất hiện.

Các giai đoạn được ghép theo `id` của pet và `form` trong manifest, không suy ra loài từ tên hiển thị hoặc vị trí level. Thứ tự loài mới dựa trên level xuất hiện đầu tiên của loài đó.

Jerry và các loài mới nhận số vé trước. Các phần thưởng cũ còn lại, trứng thối và kỹ năng chia phần xác suất còn lại theo trọng số tham chiếu, bảo đảm tổng xác suất bằng 100%.

Kết quả nhận thưởng và lịch sử gửi `rewardImage`, `rewardLabel` từ máy chủ. Pool chưa bóc chỉ gửi ID, giữ kín loại thưởng. Điểm pet thường vẫn bằng điểm cơ bản × (level + 1).
