# Bộ tranh cầu nguyện Hoa thiêng

Mười một tranh được tạo bằng công cụ image_gen tích hợp, theo ảnh tham khảo và mẫu chibi người dùng đã chọn. Bảy tranh đầu được tạo ngày 03/10/2026; bốn tranh bổ sung được người dùng duyệt trước khi tích hợp ngày 18/10/2026. Dòng cảm ơn `Thanks ♥ GIÁO LÝ SKETCHING` được đặt nhỏ trên một dòng ở góc trái phía dưới mỗi ảnh để cảm ơn nguồn cảm hứng.

Mỗi tranh có bố cục ngang 4:3, tông vàng kem, nhân vật và nét màu nước đồng nhất. Tranh không chứa lời nguyện để phần chữ trong giao diện vẫn rõ và có thể thay đổi độc lập.

Đã gắn cả 11 tranh vào modal lời nguyện trong `campaign/views/campaign.html`, theo ý tương ứng ở `CampaignController.js`. Modal dùng bản JPEG cùng tên (960 × 720, chất lượng 86, progressive), chỉ tải ảnh được chọn. JPEG được thu nhỏ và mã hóa từ PNG gốc, giữ toàn bộ bố cục và dòng cảm ơn. Nếu ảnh lỗi tải, modal vẫn hiển thị đầy đủ lời nguyện và nút Amen. Khi triển khai frontend cần chép cả 11 JPEG cùng các file JS/HTML/CSS và `index.html` có `window.APP_VERSION='20261018-8'`; riêng phần lời nguyện không cần build backend.

| Ảnh | Ý cầu nguyện |
| --- | --- |
| [01-grandparents-parents.png](01-grandparents-parents.png) | ông bà, cha mẹ |
| [02-sick.png](02-sick.png) | những người đang đau ốm |
| [03-children-in-need.png](03-children-in-need.png) | các bạn nhỏ gặp khó khăn |
| [04-lonely.png](04-lonely.png) | những người đang buồn hoặc cô đơn |
| [05-family.png](05-family.png) | gia đình của em |
| [06-parish.png](06-parish.png) | giáo xứ và xứ đoàn |
| [07-self.png](07-self.png) | chính em |
| [08-evangelization.png](08-evangelization.png) | việc truyền giáo |
| [09-archbishop-joseph.png](09-archbishop-joseph.png) | Đức Tổng Giám mục Giu-se |
| [10-parish-priests.png](10-parish-priests.png) | các cha xứ |
| [11-pope.png](11-pope.png) | Đức Giáo Hoàng |

Xem toàn bộ tranh và lời nguyện tương ứng trong [preview.html](preview.html). Bấm **Tải ảnh** để lấy từng PNG.

[prompts.json](prompts.json) giữ nguyên prompt của bảy tranh đầu, bổ sung lời nguyện và thông tin tạo bốn tranh mới. Các prompt được ghi lại dưới dạng tóm tắt có trường `promptType: "summary"` để phân biệt với prompt nguyên văn.

