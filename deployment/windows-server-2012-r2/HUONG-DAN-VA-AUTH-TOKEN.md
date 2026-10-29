# Bản vá auth/token — cập nhật 29/10/2026

Bản vá thay đổi backend dùng chung và cả hai frontend `richy/app`, `core/core-app/web-app`. Chưa triển khai lên máy chủ từ chat này.

## Hành vi sau bản vá

- Đóng toàn bộ `/tokens/**`; không còn API trả bearer token của các tài khoản khác.
- Đổi mật khẩu cá nhân chỉ dùng ID từ principal và yêu cầu `currentPassword` trong cùng request với `password`. Admin reset có quyền riêng.
- Không serialize password, confirmPassword, currentPassword hoặc authVersion trong response user.
- Mỗi lần đăng nhập có phiên riêng. Logout một phiên không thu hồi các phiên đăng nhập độc lập khác.
- Mỗi request có token và mỗi lần refresh đều đối chiếu tài khoản hiện hành: ID, trạng thái khóa/hết hạn, quyền và phiên bản bảo mật. Không cache kết quả kiểm tra này. Policy mới dùng `auth_version` để quyết định thu hồi sau đổi mật khẩu, cho phép giữ phiên khi người dùng chủ động bỏ chọn đăng xuất tất cả.
- Đổi username, trạng thái hoặc danh sách quyền xoay `auth_version`; phiên cũ không sống lại khi khóa rồi mở lại tài khoản hoặc gỡ rồi cấp lại quyền. Admin reset mật khẩu luôn thu hồi mọi phiên.
- Đổi mật khẩu cá nhân có ô **Đăng xuất khỏi tất cả thiết bị**, mặc định được chọn. Request `logoutAllDevices=false` giữ nguyên phiên bản bảo mật và các phiên; `true`, thiếu hoặc NULL thu hồi mọi phiên, bao gồm thiết bị hiện tại. Mật khẩu cũ không còn dùng để đăng nhập hoặc xác minh đổi mật khẩu, kể cả khi các phiên được giữ.
- Hai backend bật `security.auth.persistent-sessions=true`: phiên đăng nhập mới có refresh token không hết hạn theo thời gian; vẫn bị thu hồi khi logout hoặc có thay đổi bảo mật nêu trên. Access token vẫn có thời hạn dương theo `access_token_validity` trong database; NULL mặc định 24 giờ. Thay đổi `refresh_token_validity` trong database không giới hạn phiên ghi nhớ mới khi chế độ này đang bật.
- Nếu tắt cấu hình ghi nhớ (`false`), các lần đăng nhập mới dùng refresh TTL dương trong `oauth_client_details`, NULL mặc định 30 ngày. Thay đổi cấu hình chỉ ảnh hưởng phiên được cấp mới; không biến đổi các refresh token đã lưu. Phiên hữu hạn không được frontend tự kéo dài qua hạn server.
- Logout mới dùng `POST /service/oauth/revoke` với form body chứa refresh token (hoặc access token), `client_id`, `client_secret`. Có kiểm tra client, không đưa secret vào URL. Logout hoạt động khi access token đã hết hạn. Request refresh giao nhau với logout không làm phiên đã thu hồi sử dụng lại được.
- Frontend kiểm tra phản hồi login/refresh/user lookup thuộc đúng phiên trước khi ghi cookie, quyền hoặc điều hướng, kể cả thay đổi ở tab khác. Chỉ response có `persistent_session=true` mới bật cookie ghi nhớ dài hạn; phiên hữu hạn lấy hạn từ server.
- Cookie ghi nhớ có thời hạn 365 ngày và được gia hạn khi ứng dụng hoạt động/trở lại. Server không ép đăng nhập lại sau 30 ngày, nhưng trình duyệt có thể xóa/giới hạn cookie theo cài đặt hoặc chế độ riêng tư. Đổi trình duyệt, hồ sơ trình duyệt hay dùng tab ẩn danh cũng là nơi lưu cookie khác.

## Thứ tự triển khai

1. Sao lưu database theo quy trình hiện có. Chạy migration cho đúng database **trước khi khởi động backend mới**:

   - SQL Server: `core/SQL/auth-version-sqlserver.sql`.
   - MySQL: `core/SQL/auth-version-mysql.sql`.

   Migration chỉ thêm `tbl_user.auth_version varchar(36) NULL`, chạy lại được và không sửa password/tài khoản hiện có. Kiểm thử cục bộ sử dụng H2; chưa chạy migration trên SQL Server/MySQL thật từ chat này.

2. Chạy kiểm thử dưới đây, build backend bằng JDK 8 và quy trình build hiện có. Phải đưa `core-api` mới vào bản backend, không chỉ thay `richy-app`.
3. Triển khai backend và frontend cùng đợt. Nếu có nhiều backend, chuyển toàn bộ instance sang bản vá trước khi mở lại lưu lượng. Phiên ở backend cũ chưa có các bảo vệ mới.
4. Frontend dùng cache version mới của bản ghi nhớ phiên; cần build/copy đầy đủ assets mới và cấu hình index không bị giữ cache cũ.
5. **Người dùng phải đăng nhập lại một lần:** access/refresh token theo policy trước 29/10 (`auth_policy=2` hoặc thiếu policy) bị từ chối, kể cả token chưa hết hạn. Sau đó phiên mới áp dụng chế độ ghi nhớ. Bài làm chưa lưu cần được lưu trước thời điểm triển khai.

## Kiểm thử cục bộ

Từ thư mục repo:

```powershell
node --test richy/app/tests/auth-session.test.cjs
& ./deployment/windows-server-2012-r2/Test-AuthSecurity.ps1
```

Runner backend biên dịch source hiện hành bằng JDK 8, chạy JUnit với Spring Security/MockMvc và H2 cô lập. Nó dùng dependency có sẵn tại máy, không gọi production hoặc tải phần mềm. Có thể truyền `-JavaDirectory`, `-MavenRepository`, `-DependencyJar` khi chạy trên máy khác. Log kết quả lần chạy trong chat được lưu tại `outputs/auth-review-2026-10-28/`.

Kết quả đã chạy ngày 28/10/2026: **40/40 backend security tests**, **57/57 auth frontend tests**. Chạy thêm admin selection, TNTT profile, fair và campaign cùng auth đạt **143/143 frontend tests**. Maven offline/JDK 8 package thành công cả `core-api`, `core-app`, `richy-api`, `richy-app` trong một reactor; test được chạy riêng bằng các lệnh ở trên. Frontend core đã kiểm syntax và test source, chưa chạy Gulp build với toolchain cũ.

Cập nhật ngày 29/10/2026: chế độ ghi nhớ phiên và lựa chọn đăng xuất khi đổi mật khẩu đạt **51/51 backend tests**, **64/64 auth frontend tests**; Maven offline/JDK 8 package lại cả core/richy thành công. Bao phủ refresh không hết hạn qua JDBC/reload, access vẫn hết hạn, thu hồi một thiết bị, refresh/logout đồng thời, cookie còn lại sau 100 ngày giả lập, và đổi mật khẩu giữ/thu hồi hai thiết bị. Log tại `outputs/auth-review-2026-10-29/`. Chưa triển khai production; frontend core chưa chạy Gulp build.

Sau khi triển khai, kiểm tra đăng nhập tài khoản thường/admin, đổi mật khẩu đúng/sai, refresh, logout khi access hết hạn, khóa rồi mở lại user, đổi quyền, và đăng nhập hai thiết bị. Tài khoản thường phải bị từ chối ở `/tokens/**` và API admin reset; response user không có trường password/hash.

## Giới hạn cần giữ rõ

- Mỗi request được xác thực thêm bằng dữ liệu tài khoản hiện hành, tạo thêm truy vấn DB. Kiểm thử cục bộ xác nhận chức năng và race; chưa đo tải trên database production.
- Nếu reset password hoặc thay đổi trạng thái/quyền trực tiếp bằng SQL hay chương trình khác, phải đồng thời đặt `auth_version` thành UUID mới trong cùng transaction để thu hồi các phiên. Policy mới không so password hash trong token với DB vì cần hỗ trợ người dùng đổi mật khẩu nhưng chủ động giữ các phiên. Live checks chặn trạng thái đang bị khóa, nhưng thay đổi ngoài ứng dụng không tự gọi setter xoay phiên bản.
- Token vẫn được JavaScript đọc từ cookie. Bản vá này không chuyển hệ thống sang HttpOnly refresh-cookie/BFF; cần tiếp tục bảo vệ nội dung cùng origin khỏi XSS.
- Logout khi mất mạng chỉ đảm bảo xóa phiên local. Không thể xác nhận server đã thu hồi token cho tới khi request thu hồi tới được server.
- Nếu hai tab đăng nhập chính xác cùng lúc, cơ chế bảo vệ có thể yêu cầu thử đăng nhập lại; không dùng phản hồi cũ để ghi đè danh tính phiên mới.
