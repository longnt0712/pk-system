# Chiến dịch Mân Côi 2026

Phần hướng dẫn frontend dành riêng cho chiến dịch **Cùng Mẹ, em yêu mến Chúa** bắt đầu trong tháng 10/2026 trên tên miền TNTT. Không tạo/sửa chiến dịch hoặc lưu dữ liệu hướng dẫn trong database.

- Ngắm thứ nhất: 02/10/2026 (ngày người dùng yêu cầu); mỗi ngày tăng một ngắm, sau ngắm 5 quay về 1, kết thúc 31/10/2026. Ngày lấy theo đồng hồ máy chủ, múi giờ Việt Nam.
- Chiên → Vui; Ấu → Mừng; Thiếu → Sáng; Nghĩa → Thương. Đối chiếu tiền tố tên lớp, không phân biệt dấu/hoa-thường. Nhiều lớp cùng ngành dùng chung ngành; không có ngành rõ ràng hoặc có nhiều ngành khác nhau thì chọn ngẫu nhiên trong 20 ngắm.
- Nút “Em muốn ngắm nào nữa 😊” chỉ dành cho lựa chọn ngẫu nhiên; luôn đổi sang ngắm khác.
- Quét QR đúng → ảnh hướng dẫn tham gia chiến dịch → hai nút thật bên dưới: “Đi đến Hoa thiêng” mở phiếu ngang của tuần hiện tại; “Xem ngắm của ngày hôm nay” mở ngắm đúng ngành và ngày. Ảnh dùng huong-dan-tham-gia-chien-dich-v5.png (giữ tranh cũ, thêm bước 6 “Tô vườn hoa”: mỗi ngày một bông, mỗi ô đã tích = một lượt tô, chọn bông/màu/cánh); các nút điều hướng nằm trong HTML. Đổi tuần không mở lại hướng dẫn; quét thẻ khác hoặc sang ngày mới mở lại. Bên dưới bảng tích trên phiếu có hai nút “Xem hướng dẫn” (ảnh hướng dẫn tham gia) và “Xem ngắm” (ngắm hôm nay); mở lại giữ nguyên ngắm đã chọn và các ô đã tích. Mở phiếu từ hướng dẫn luôn đưa về tuần chứa ngày hôm nay. Hướng dẫn nằm ngoài phần xoay A4; mở lại khi đang toàn màn hình sẽ thoát toàn màn hình phiếu.
- Lời ngắm và lời xin theo bản chính thức: https://www.tonggiaophanhanoi.org/phan-thu-ba-ngam-cac-phep-lan-hat/ (đối chiếu 02/10/2026).
- 19 ảnh do người dùng cung cấp, giữ nguyên ảnh và dấu tác giả. Ảnh Sáng 4 là ảnh tạo thêm theo yêu cầu trong cuộc trò chuyện, không gắn tên tác giả của ảnh gốc.
- Ảnh nằm trong assets/images/rosary-2026. Các giá trị cố định, tên chiến dịch, ngày và lời ngắm được tập trung trong RosaryCampaign2026.js để mở rộng sau này.
- Không tự tích hoặc ghi nhận việc lần hạt. Học sinh tự tích trên phiếu và vẫn dùng API hoa thiêng hiện tại.

## Vườn hoa Hoa thiêng

- Môi trường triển khai: SQL Server 2008 / 2008 R2, Windows Server 2012, Java 8. Script ở `richy/database/campaign-flower-paint-color.sql` dùng `RAISERROR`, không dùng `THROW`.

- Bật riêng cho “Cùng Mẹ, em yêu mến Chúa”, từ 01–31/10/2026. Nút “Tô vườn hoa 🌼” xuất hiện ở hướng dẫn tham gia và dưới phiếu. Sau tháng 10 vẫn mở lại được vườn đã lưu từ phiếu.
- Tranh dọc gồm nền nhà thờ Phùng Khoang đã có màu và 31 bông SVG, mỗi bông một ngày. Nhụy vàng, cánh trắng; chạm vào ngày để mở bông lớn, chọn một trong 7 màu rồi chọn cánh.
- Số cánh bằng số việc Hoa thiêng. Mỗi cánh gắn với `itemKey`, nên thêm việc (4 → 5) hoặc đổi thứ tự vẫn giữ màu của các mục cũ. Xóa mục sẽ bỏ cánh và lượt tích của mục đó; nếu giảm số lượt, hệ thống bỏ phần màu vượt lượt.
- Một việc đã tích và lưu thành công cho một ngày cho một lượt tô bông của ngày đó. Có thể chọn cánh bất kỳ, đổi màu cánh đã tô không tốn thêm lượt. Không tô trước ngày; các ngày đã qua vẫn dùng được lượt đã tích trước đó. Tô màu không tự tích việc.
- “Xóa màu và tô lại” mở xác nhận, chỉ xóa màu của học sinh trong chiến dịch này, giữ ô tích và hoàn lượt đã dùng. Nhà thờ, lá và nhụy không bị xóa.
- Thiết kế/ngày/bảng màu được cố định trong `FlowerGarden2026.js`. Tiến độ của từng học sinh được lưu bằng cột nullable `paint_color` (varchar(7)) trong `tbl_campaign_flower_entry`; không tạo cấu hình chiến dịch trong database. Cần cập nhật **cả frontend và backend**.
- API theo credential QR hiện tại: GET `.../campaigns/{id}/garden`; PUT `.../garden/{date}/{itemKey}` với `{color}`; POST `.../garden/reset`. Backend tự xác định học sinh, kiểm tra ngày, mục, màu và lượt; khóa bản ghi QR khi ghi để tránh dùng trùng lượt trên nhiều thiết bị.
- Nền minh họa được tạo từ bản phác thảo đã duyệt, tham khảo ảnh nhà thờ Phùng Khoang: https://commons.wikimedia.org/wiki/File:Phùng_Khoang_church_building.jpg. Các ảnh ngắm và ảnh hướng dẫn hiện có được giữ nguyên.

Kiểm tra: 31 test Java của chiến dịch/phiếu, 108 test frontend thành công (2 test không liên quan được bỏ qua); kiểm tra thao tác trên trình duyệt với dữ liệu giả ở kích thước điện thoại và máy tính. Chưa chạy migration hay ghi thử trên database thật.
