# Trứng và pet thưởng trong Battle Online

Battle đọc cùng các tệp `*/pet.json` trong thư mục này. Khi thêm pet, tạo thư mục có tên khớp `id`, thêm ảnh và khai báo `name`, `evolution` theo các pet hiện có. Mỗi giai đoạn cần level riêng, `form` (`egg-intact`, `egg-cracked`, `hatched`) và tên tệp ảnh. Không trùng level với pet khác. Pet dùng sprite atlas cần `atlas.fallbackFile` là ảnh tĩnh để hiển thị thưởng.

Build và triển khai lại cả backend lẫn frontend sau khi thêm pet. Maven tự đóng gói các manifest vào API; không cần thêm level, tên hay đường dẫn ảnh vào bộ bốc thưởng hoặc màn hình kết quả. Trận mới sử dụng danh sách đã đóng gói; trận đang chạy giữ nguyên pool đã tạo. Cơ chế thưởng điểm này không thay đổi điều kiện mở khóa pet trong tài khoản.

Danh sách hiện có gồm đầy đủ các dạng của pet được chọn trong tài khoản, kể cả Tia sét lấp lánh, trứng Son Goku, Son Goku thường và Siêu Saiyan 1/2/4. `battleRewardLevel` là ID phần thưởng, độc lập với level mở khóa tài khoản: 22 là Tia sét, 23–27 là năm dạng Goku. Điểm ở mức cơ bản 10 lần lượt là 230, 240, 250, 260, 270, 280. Bí ngô Halloween có ID 28 và tham chiếu điểm/tỉ lệ của Pikachu đã nở (level thưởng 20), nhận 210 điểm khi điểm cơ bản là 10. Son Goku Siêu Saiyan 4 hiện là pet được hiệu ứng ngọc rồng tăng tỉ lệ.

`battleRewardSeason: "HALLOWEEN"` chỉ cho phép bí ngô rơi từ 1/10 đến hết 5/11 hằng năm theo UTC+7, áp dụng cho mọi người chơi kể cả admin. Máy chủ xét thời điểm bóc thực tế: trứng đã tạo trước khi hết mùa, kể cả vòng bóc cuối, không thể cho bí ngô sau 00:00 ngày 6/11. Vé ngẫu nhiên của trứng không đổi; các phần thưởng chưa bóc được ánh xạ theo danh sách đang hợp lệ. Lịch sử đã nhận giữ nguyên ảnh/tên cũ. Hiệu ứng bảo hộ Perry, tăng tỉ lệ may mắn và ngọc rồng cũng không thể làm bí ngô xuất hiện ngoài mùa; tỉ lệ mỗi ngọc rồng vẫn chính xác 0,8333%.

Tên riêng từng dạng có thể khai báo bằng `name` trong từng mục `evolution`. Bí ngô/sét may mắn tăng 10% tương đối cho tất cả pet thường từ Mèo Tom trở lên, bao gồm các dạng mới; ngọc rồng tăng cho pet thường có điểm cao nhất đang được phép rơi.

Các level 0–14 có trọng số tham chiếu `round(10000 × 0.75^level)`. Trứng thối có trọng số tham chiếu 10000 và luôn nhận 0,5 điểm; mỗi kỹ năng được bật có trọng số tham chiếu 2500.

Các pet mới gồm tất cả level từ 15 trở lên và tự nhận các pet thêm sau. Bộ bốc dùng 1.000.000 vé. Jerry giữ cố định ba mức 0,63% (trứng nguyên), 0,47% (trứng nứt), 0,36% (đã nở). Mỗi **loài mới** giảm tiếp 100 vé = 0,01 điểm phần trăm ở **từng cột tương ứng**: Tuffy 0,62% / 0,46% / 0,35%; Pikachu 0,61% / 0,45% / 0,34%; loài tiếp theo 0,60% / 0,44% / 0,33%. Các mức này giữ nguyên khi bật kỹ năng. Tỉ lệ tối thiểu là 0,01%, để pet thêm sau luôn có thể xuất hiện.

Các giai đoạn được ghép theo `id` của pet và `form` trong manifest, không suy ra loài từ tên hiển thị hoặc vị trí level. Thứ tự loài mới dựa trên level xuất hiện đầu tiên của loài đó.

Jerry và các loài mới nhận số vé trước. Các phần thưởng cũ còn lại, trứng thối và kỹ năng chia phần xác suất còn lại theo trọng số tham chiếu, bảo đảm tổng xác suất bằng 100%.

Kết quả nhận thưởng và lịch sử gửi `rewardImage`, `rewardLabel` từ máy chủ. Pool chưa bóc chỉ gửi ID, giữ kín loại thưởng. Điểm pet thường vẫn bằng điểm cơ bản × (level + 1).
