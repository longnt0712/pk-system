# Hội chợ tổng kết

Giao diện dùng trên trình duyệt điện thoại, ưu tiên màn hình dọc và camera sau.

Phần hội chợ chỉ mở trên `tnttphungkhoang.com` và `www.tnttphungkhoang.com`. Các domain khác không hiển thị menu và không mở được các trang `/hoi-cho`, kể cả khi tài khoản có quyền hội chợ.

## Mở các trang

- `/hoi-cho/quan-tri`: admin tạo hội chợ, sửa mức phiếu, gán gian hàng, tạo/in thẻ khách và sửa giao dịch.
- `/hoi-cho/lam-viec`: người trực cộng phiếu hoặc đổi quà theo quyền và gian hàng đã giao.
- `/hoi-cho`: tra cứu công khai, không đăng nhập; mặc định mở hội chợ đang hoạt động mới nhất.
- `/hoi-cho/{id}/tra-cuu`: link tra cứu cố định của một hội chợ. Có thể thêm `?ma=MA_THE` để xem ngay.
- `/hoi-cho/{id}/lam-viec` và `/hoi-cho/{id}/quan-tri`: mở cố định hội chợ theo mã.

Trang quản lý có sẵn đường link tra cứu để mở trên các điện thoại dùng chung.

## Chuẩn bị hội chợ

1. Cập nhật cả backend và frontend. Backend tự tạo `ROLE_PLAY`, `ROLE_GIFT` nếu chưa có. Bốn bảng `tbl_fair_event`, `tbl_fair_wallet`, `tbl_fair_station`, `tbl_fair_transaction` được tạo bởi cơ chế Hibernate `ddl-auto=update` hiện có.
2. Admin tạo hội chợ, đặt ba mức dễ / trung bình / khó. Giá trị mặc định là 8 / 12 / 20; mỗi mức nhận số nguyên dương. Cấu hình này áp dụng cho cả thưởng trò chơi và đổi quà.
3. Gán `ROLE_PLAY` cho tài khoản trực trò chơi, `ROLE_GIFT` cho tài khoản đổi quà trong trang tài khoản hiện có.
4. Người trực đăng nhập bằng tài khoản đã gán quyền ở danh sách học sinh/tài khoản là dùng được ngay, không cần gán gian thêm. Khối “Gán người trực gian hàng” đang tạm ẩn (`showStationSetup=false`), giữ lại mã và dữ liệu để có thể bật lại sau.
5. Tạo khoảng 100 thẻ khách, rồi bấm in. Mỗi lần tạo thêm sinh mã mới và đánh số tiếp, không tái sử dụng ví cũ. QR của khách có mã đầy đủ `HC-{event}-KHxxx-{suffix}`; số KHxxx cũng được in rõ trên thẻ.
6. Người phụ trách mở sẵn link tra cứu trên các điện thoại, cấp quyền camera rồi để học sinh tự quét. Cần HTTPS và kết nối mạng.

## Quy tắc phiếu

- Phiếu giấy dùng độc lập: thu giấy khi đổi quà, không nhập thành phiếu ảo.
- Phiếu trong thẻ bắt đầu bằng 0 cho từng học sinh/khách ở từng hội chợ. Tra cứu ví chưa phát sinh giao dịch chỉ trả 0, không tạo ví hay cộng phiếu.
- Thẻ học sinh in sẵn vẫn dùng mã học sinh hiện tại; chỉ tài khoản học sinh đang hoạt động được nhận diện.
- `ROLE_PLAY` chỉ hiện “Thưởng trò chơi”, `ROLE_GIFT` chỉ hiện “Đổi quà”, admin hiện cả hai. Quyền tài khoản quyết định thao tác; cấu hình gian cũ không ép người trực chọn sai chức năng hoặc khóa một mức.
- Luồng cộng phiếu: bật camera → quét thẻ → chọn mức dễ / trung bình / khó → xác nhận rõ mức, số phiếu và học sinh → cộng phiếu và hiện số dư mới. Hủy xác nhận thì không gửi giao dịch và vẫn ở màn hình chọn mức. Đổi quà vẫn ghi nhận ngay khi chọn mức. Camera và bấm lặp không tạo thêm lượt khi đang xử lý hoặc đã hiện kết quả.
- Các mức luôn lấy từ cấu hình hội chợ. Khi admin đổi số phiếu, giao dịch cũ giữ nguyên. Nếu điện thoại còn giá cũ, máy chủ từ chối lượt đó, giao diện tải lại cấu hình; kiểm tra mức mới trước khi thử lại.
- Sau một lượt cộng, nút “Hoàn tác cộng phiếu” hỏi xác nhận trước khi trừ lại đúng số vừa cộng. Chỉ tài khoản đã thực hiện được hoàn tác lượt cộng gốc gần nhất của mình; không hoàn tác lại lượt đã sửa/hoàn tác, không làm số dư âm. Hoàn tác có mã chống trùng và lịch sử riêng; thử lại sau mất mạng không trừ thêm lần nữa. Đổi quà không có nút hoàn tác cộng phiếu.
- Mỗi lượt có mã chống trùng. Lượt đang gửi được lưu trên điện thoại trước khi gửi. Khi mạng chưa xác nhận, bấm “Kiểm tra kết quả” để gửi lại đúng mã cũ; không lập lượt khác. Sau tải lại trang/đăng nhập lại cùng tài khoản, lượt này vẫn được phục hồi.
- Số dư được khóa trong giao dịch cơ sở dữ liệu khi cập nhật; hai gian hàng không thể cùng tiêu vượt số phiếu đang có.
- Ngoài nút hoàn tác lượt cộng của chính mình, chỉ admin được sửa giao dịch trong lịch sử. Nhập số phiếu đúng của lượt và lý do; hệ thống ghi riêng phần chênh lệch, giữ bản gốc. Ví dụ đã cộng 8, đúng là 20 thì cộng bù 12. Nhập 0 để hủy tác động của lượt. Mỗi lượt gốc được sửa một lần; không cho sửa làm số dư âm.
- Đổi cấu hình không tính lại lịch sử hoặc số dư. Đóng hội chợ dừng giao dịch mới và vẫn cho phép tra cứu qua link cố định. Muốn bắt đầu số dư 0 cho đợt mới, tạo hội chợ mới.

## Kiểm tra

```text
node --test richy/app/tests/fair.test.cjs richy/app/tests/auth-session.test.cjs richy/app/tests/campaign.test.cjs
node --test richy/app/tests/fair-browser.test.cjs
mvn -f richy/richy-api/pom.xml -DskipTests=false -Dtest=FairServiceTest test
```

Kiểm tra trình duyệt dùng Playwright/Chrome theo cùng cách với các bài kiểm tra giao diện hiện có. Java test chạy H2 độc lập, không kết nối cơ sở dữ liệu ứng dụng, bao gồm giao dịch đồng thời và gửi lại cùng mã.
