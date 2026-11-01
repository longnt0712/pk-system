# SEO cho IELTS Room và TNTT Phùng Khoang

## Phần kỹ thuật

- Mỗi domain có title, description, canonical, favicon và dữ liệu WebSite/Organization riêng ngay trong HTML máy chủ trả về.
- `/gioi-thieu` là trang HTML công khai, không cần JavaScript hoặc đăng nhập để đọc.
- Trang đăng nhập có giới thiệu bằng văn bản và liên kết tới trang công khai.
- `/robots.txt` và `/sitemap.xml` được IIS chọn theo domain. Sitemap chỉ chứa trang chủ và trang giới thiệu; không đưa lớp học, bài làm, danh sách học sinh hoặc đường dẫn chia sẻ cá nhân vào sitemap.
- Các đường dẫn ứng dụng ngoài trang chủ/login có `X-Robots-Tag: noindex, nofollow` và meta robots tương ứng. Điều này kiểm soát lập chỉ mục, không thay thế đăng nhập hay phân quyền.
- Giữ `googlee681f7a21f5f3fd4.html` tại thư mục gốc website để duy trì quyền sở hữu Search Console.

## Search Console

Đã triển khai và xác nhận ngày 01/11/2026 bằng tài khoản Google TNTT Phùng Khoang đang đăng nhập:

| URL-prefix | Quyền sở hữu | Sitemap |
| --- | --- | --- |
| `https://tnttphungkhoang.com/` | Đã xác minh bằng tệp HTML | Google đã xử lý thành công, khám phá 2 trang |
| `https://ieltsroom.com/` | Đã xác minh bằng tệp HTML | Google đã xử lý thành công, khám phá 2 trang |

Mở [Search Console TNTT](https://search.google.com/search-console?resource_id=https%3A%2F%2Ftnttphungkhoang.com%2F) hoặc [Search Console IELTS Room](https://search.google.com/search-console?resource_id=https%3A%2F%2Fieltsroom.com%2F) bằng tài khoản trên. Hai trang được khám phá ở mỗi website là `/` và `/gioi-thieu`; khám phá URL chưa đồng nghĩa với được lập chỉ mục.

Thiết lập hai sản phẩm URL-prefix chính xác `https://tnttphungkhoang.com/` và `https://ieltsroom.com/`, xác minh bằng tệp HTML do tài khoản Google cung cấp. Không thay đổi DNS trong đợt này. URL-prefix chỉ bao phủ giao thức/hostname tương ứng; có thể bổ sung Domain property qua DNS sau nếu muốn gộp HTTP/HTTPS và mọi subdomain.

Sitemap đã gửi là `sitemap.xml` của từng sản phẩm. URL Inspection xác nhận cả hai trang chủ đã nằm trong chỉ mục Google. Đã gửi yêu cầu lập chỉ mục lại cho cả hai trang chủ; Google xác nhận đã thêm URL vào hàng đợi ưu tiên thu thập dữ liệu. Dùng công cụ này kiểm tra lại sau các thay đổi nội dung; trang giới thiệu mới đã được Google khám phá qua sitemap. Không gửi yêu cầu hàng loạt hoặc cam kết vị trí trên Google.

## Nhóm từ khóa ban đầu

Đây là giả thuyết nội dung dựa trên tính năng đang có, chưa phải dữ liệu lượng tìm kiếm hoặc độ khó. Ưu tiên thương hiệu trước; dùng báo cáo Search Console để điều chỉnh theo truy vấn thực tế.

| Website | Ưu tiên thương hiệu | Cụm từ khóa nội dung cần phát triển |
| --- | --- | --- |
| IELTS Room | IELTS Room; ieltsroom; Saint Paul Academy | luyện IELTS online; luyện IELTS Reading online; luyện Listening điều chỉnh tốc độ; học từ vựng tiếng Anh theo chủ đề; luyện Speaking với ghi chú |
| TNTT Phùng Khoang | TNTT Phùng Khoang; Thiếu Nhi Thánh Thể Phùng Khoang; xứ đoàn Phùng Khoang | hoạt động TNTT Phùng Khoang; sinh hoạt xứ đoàn Phùng Khoang; hoa thiêng TNTT Phùng Khoang |

Không tạo nhiều trang giống nhau chỉ đổi từ khóa. Mỗi bài công khai nên giải quyết một câu hỏi cụ thể, có ví dụ thật và liên kết tới chức năng liên quan.

## Nội dung tiếp theo

1. IELTS: hướng dẫn luyện Reading, cách nghe lại một đoạn Listening, cách ôn từ theo topic, cách dùng ghi chú khi luyện Speaking. Chỉ đưa đề, hình ảnh và audio có quyền sử dụng công khai; các bài làm cá nhân vẫn ở trong tài khoản.
2. TNTT: giới thiệu xứ đoàn đầy đủ hơn, bài tổng kết hoạt động và hướng dẫn tham gia chiến dịch. Xác nhận tên người phụ trách, lịch sinh hoạt và thông tin liên hệ trước khi công khai. Chỉ dùng hình ảnh được phép đăng.
3. Mỗi tuần kiểm tra Performance: truy vấn, lượt hiển thị, click và trang đích. Đối chiếu Pages/Sitemaps để sửa lỗi truy cập hoặc lập chỉ mục. Khi có dữ liệu, ưu tiên trang có lượt hiển thị phù hợp nhưng tiêu đề/mô tả chưa rõ.

## Kiểm tra sau phát hành

Mở `/`, `/gioi-thieu`, `/robots.txt`, `/sitemap.xml` trên cả hai domain. Kiểm tra title/canonical/schema bằng HTML thô, không chỉ giao diện sau JavaScript. `/dashboard` và các trang quản lý phải có `X-Robots-Tag`; tệp xác minh phải trả đúng nội dung Google cung cấp.

Nguồn chính thức: [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [xác minh quyền sở hữu](https://support.google.com/webmasters/answer/9008080), [sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview). Sitemap giúp khám phá URL; không bảo đảm được lập chỉ mục hoặc tăng hạng.
