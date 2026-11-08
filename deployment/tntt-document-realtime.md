# Đồng bộ trực tiếp sổ tài liệu TNTT

Backend và frontend cần được cập nhật cùng phiên bản. Dùng cấu hình `tntt.documents.enabled=true` hiện có; tính năng này không thêm bảng hoặc cột SQL.

Admin và Quản lý đào tạo cùng mở **chế độ chỉnh sửa** của một tài liệu. Nhãn **Trực tiếp** cho biết kết nối đã sẵn sàng. Mỗi phiên mở tài liệu có con trỏ, tên và màu riêng, kể cả hai máy đăng nhập cùng tài khoản. Nội dung được tự lưu và ghép khi nhiều người cùng sửa. Bản thông báo đã công bố và link chỉ xem giữ cơ chế xem hiện có.

Kết nối sử dụng:

- `POST /service/api/tntt-documents/entries/{id}/live-ticket`: cấp vé dùng một lần, yêu cầu OAuth và quyền sửa đúng tài liệu.
- `wss://tnttphungkhoang.com/service/public/tntt-document-live?ticket=...`: truyền vị trí con trỏ, danh sách người đang mở và báo có phiên bản đã lưu. Access token không nằm trong URL WebSocket.
- Nội dung tiếp tục đọc/ghi qua REST có xác thực và kiểm tra phiên bản. Vị trí con trỏ không ghi vào lịch sử tài liệu.

## Reverse proxy

Trong DevTools → Network → WS, kết nối `tntt-document-live` phải trả **101 Switching Protocols** và nhận gói `welcome`. Nếu API vẫn hoạt động nhưng nhãn hiển thị **Đồng bộ định kỳ** hoặc **Đang nối lại**, kiểm tra proxy WebSocket.

Với Nginx, khai báo trong khối `http` nếu chưa có map tương đương:

```nginx
map $http_upgrade $tntt_note_connection {
    default upgrade;
    ''      close;
}
```

Trong `location` đang chuyển tiếp `/service/` tới Java, giữ nguyên `proxy_pass` và các cấu hình hiện có, bổ sung:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $tntt_note_connection;
proxy_read_timeout 75s;
```

Chạy `nginx -t` trước khi reload. Kết nối có heartbeat; khi kết nối trực tiếp tạm gián đoạn, bản nháp được giữ và việc kiểm tra bản mới định kỳ vẫn hoạt động.

Origin mặc định gồm `https://tnttphungkhoang.com` và `https://www.tnttphungkhoang.com`. Khi dùng host phát triển khác, khai báo danh sách origin chính xác trong `tntt.documents.realtime.allowed-origins`.
