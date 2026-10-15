# Trứng và pet thưởng trong Battle Online

Battle đọc cùng các tệp `*/pet.json` trong thư mục này. Khi thêm pet, tạo thư mục có tên khớp `id`, thêm ảnh và khai báo `name`, `evolution` theo các pet hiện có. Mỗi giai đoạn cần level riêng, `form` (`egg-intact`, `egg-cracked`, `hatched`) và tên tệp ảnh. Không trùng level với pet khác. Pet dùng sprite atlas cần `atlas.fallbackFile` là ảnh tĩnh để hiển thị thưởng.

Build và triển khai lại cả backend lẫn frontend sau khi thêm pet. Maven tự đóng gói các manifest vào API; không cần thêm level, tên hay đường dẫn ảnh vào bộ bốc thưởng hoặc màn hình kết quả. Trận mới sử dụng danh sách đã đóng gói; trận đang chạy giữ nguyên pool đã tạo. Cơ chế thưởng điểm này không thay đổi điều kiện mở khóa pet trong tài khoản.

Các level 0–14 có trọng số tham chiếu `round(10000 × 0.75^level)`. Trứng thối có trọng số tham chiếu 10000 và luôn nhận 0,5 điểm; mỗi kỹ năng được bật có trọng số tham chiếu 2500.

Các giai đoạn mới gồm tất cả level từ 15 trở lên và tự nhận các pet thêm sau. Xác suất tham chiếu của Jerry đã nở (level 14) được giữ cố định theo danh sách cũ và số kỹ năng được bật. Bộ bốc dùng 1.000.000 vé; khi tắt kỹ năng, Jerry giữ 3598 vé (0,3598%). Mỗi giai đoạn mới, xếp tăng theo level, giảm tiếp 100 vé = 0,01 điểm phần trăm: Tuffy 0,3498% → 0,3398% → 0,3298%; Pikachu 0,3198% → 0,3098% → 0,2998%. Nếu bật kỹ năng, xác suất tham chiếu Jerry thấp hơn nhưng bước giảm vẫn là 0,01 điểm phần trăm. Tỉ lệ tối thiểu của giai đoạn mới là 0,01%, để pet thêm sau luôn có thể xuất hiện.

Jerry và các giai đoạn mới nhận số vé trước. Các phần thưởng cũ còn lại, trứng thối và kỹ năng chia phần xác suất còn lại theo trọng số tham chiếu, bảo đảm tổng xác suất bằng 100%. Quy tắc này thay thế cách chia nhóm mới tổng 10%.

Kết quả nhận thưởng và lịch sử gửi `rewardImage`, `rewardLabel` từ máy chủ. Pool chưa bóc chỉ gửi ID, giữ kín loại thưởng. Điểm pet thường vẫn bằng điểm cơ bản × (level + 1).
