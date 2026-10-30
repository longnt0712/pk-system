# Kiểm tra phiên bản và cache frontend

`APP_VERSION` trong `richy/app/index.html` là phiên bản của CSS, JS và template nội bộ. Khi phát hành frontend, tăng phiên bản này và chép đủ các file đã sửa. Query phiên bản trên từng asset chỉ có tác dụng khi trình duyệt nhận được `index.html` mới.

`web.config` đặt các HTTP response header sau cho trang vào ứng dụng, bao gồm `/index.html`, `/dashboard`, `/speaking` và các đường dẫn SPA được rewrite về index:

```text
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

Quy tắc chỉ áp dụng khi phản hồi là HTML và file phục vụ là index. CSS, JS, ảnh, template riêng và API giữ chính sách cache sẵn có. Các đường dẫn `/service`, `/api`, `/oauth`, `/public`, `/assets` được loại trừ. Quy tắc metadata TNTT và cấu hình nén hiện tại được giữ nguyên. Cơ chế sửa HTTP response header dùng URL Rewrite đã có trong ứng dụng; xem [tài liệu Microsoft](https://learn.microsoft.com/en-us/iis/extensions/url-rewrite-module/modifying-http-response-headers).

Các thẻ `<meta http-equiv>` trong HTML không phải cấu hình response header của IIS. Có thể đọc thêm cấu hình HTTP client cache tại [Microsoft Learn](https://learn.microsoft.com/en-us/iis/configuration/system.webserver/staticcontent/clientcache).

## Xác nhận sau khi triển khai

Chạy PowerShell từ máy có thể truy cập website; các lệnh dưới đây chỉ đọc dữ liệu công khai:

```powershell
$page = Invoke-WebRequest -Uri 'https://ieltsroom.com/dashboard' -UseBasicParsing -Headers @{'Cache-Control'='no-cache'}
$page.StatusCode
$page.Headers['Cache-Control']
$page.Headers['Pragma']
$page.Headers['Expires']
if ($page.Content -match "APP_VERSION\s*=\s*'([^']+)'") { $Matches[1] }
```

Đối chiếu phiên bản trả về với `index.html` của bản triển khai. Kiểm tra tương tự `/index.html` và một đường dẫn sâu. Header mới chỉ có hiệu lực khi `web.config` đã được chép lên thư mục website.

Trong DevTools → Network, kiểm tra URL CSS/JS/template nội bộ có `v=` của bản hiện tại. Một tab đã mở vẫn đang chạy mã đã tải trong bộ nhớ; header mới không tự thay thế mã trong tab đó. Cho học sinh tải lại trang sau khi đã lưu bài và kết thúc lượt làm đang chạy. Không tự ép tải lại giữa bài thi.

Nếu phiên bản ngoài website còn cũ, kiểm tra log `C:\pk-deploy\frontend-deploy.log` và các file đã triển khai trước khi kết luận do cache của học sinh. Không cần xóa cookie hoặc dữ liệu đăng nhập để kiểm tra phiên bản.

## Kiểm tra cấu hình trong repository

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deployment/windows-server-2012-r2/tests/frontend-cache-config.test.ps1
```

Kiểm tra này parse XML thật và đánh giá điều kiện cho index trực tiếp, SPA rewrite, asset, template và API; không chạy IIS và không triển khai. Vẫn cần xác nhận response header trên máy chủ sau khi phát hành.
