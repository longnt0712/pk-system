# Bộ tranh cầu nguyện Hoa thiêng

Bảy tranh mới được tạo bằng công cụ image_gen tích hợp, theo ảnh tham khảo và mẫu chibi người dùng đã chọn. Dòng cảm ơn `Thanks ♥ GIÁO LÝ SKETCHING` được đặt nhỏ trên một dòng ở góc trái phía dưới mỗi ảnh để cảm ơn nguồn cảm hứng.

Mỗi tranh có bố cục ngang 4:3, tông vàng kem, nhân vật và nét màu nước đồng nhất. Tranh không chứa lời nguyện để phần chữ trong giao diện vẫn rõ và có thể thay đổi độc lập.

Đã gắn cả 7 tranh vào modal lời nguyện trong `campaign/views/campaign.html`, theo ý tương ứng ở `CampaignController.js`. Modal dùng bản JPEG cùng tên (960 × 720, chất lượng 86, progressive; khoảng 145–185 KiB), chỉ tải ảnh được chọn. JPEG được thu nhỏ và mã hóa từ PNG gốc, giữ toàn bộ bố cục và dòng cảm ơn. Nếu ảnh lỗi tải, modal vẫn hiển thị đầy đủ lời nguyện và nút Amen. Khi triển khai frontend cần chép cả 7 JPEG cùng các file JS/HTML/CSS và `index.html` bản cache `20261003-208`; không cần build backend.

| Ảnh | Ý cầu nguyện |
| --- | --- |
| [01-grandparents-parents.png](01-grandparents-parents.png) | ông bà, cha mẹ |
| [02-sick.png](02-sick.png) | những người đang đau ốm |
| [03-children-in-need.png](03-children-in-need.png) | các bạn nhỏ gặp khó khăn |
| [04-lonely.png](04-lonely.png) | những người đang buồn hoặc cô đơn |
| [05-family.png](05-family.png) | gia đình của em |
| [06-parish.png](06-parish.png) | giáo xứ và xứ đoàn |
| [07-self.png](07-self.png) | chính em |

Xem toàn bộ tranh và lời nguyện tương ứng trong [preview.html](preview.html). Bấm **Tải ảnh** để lấy từng PNG.

[prompts.json](prompts.json) lưu đầy đủ prompt của từng tranh, lời nguyện và thông tin tạo ảnh.

