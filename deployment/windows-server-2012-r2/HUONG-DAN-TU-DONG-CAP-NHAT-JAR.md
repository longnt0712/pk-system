# Build ở local và tự cập nhật JAR trên server

Luồng dùng cho máy local Windows và server `118-27-192-59`:

```text
Local build Java 8 -> GitHub Release riêng tư -> server tải và kiểm tra SHA-256
-> khóa thao tác reset -> dừng service, đợi Java thoát -> thay JAR
-> khởi động, kiểm tra HTTP -> ghi nhận bản đã triển khai
```

JAR được đính kèm Release, không commit vào lịch sử Git. Server kết nối ra GitHub
bằng HTTPS; không cần cài SSH/SFTP hoặc mở thêm cổng nhận kết nối từ Internet.

## Chuẩn bị một lần trên local

1. Dùng JDK 8 để tương thích Java trên server. Script build kiểm tra phiên bản
   Java, build `core-api` trước, sau đó build `richy-api` và `richy-app`.
2. Cài [GitHub CLI](https://cli.github.com/) nếu lệnh `gh` chưa có, mở lại terminal
   sau khi cài và đăng nhập tài khoản có quyền tạo Release:

```powershell
gh auth login
```

3. Repository chứa Release phải là **Private**. Mặc định dùng repository origin
   của source, hiện là `longnt0712/pk-system`. Có thể dùng một repository Private
   riêng để lưu JAR bằng tham số `-ReleaseRepository owner/repo`.
   Script từ chối đưa JAR lên repository Public vì JAR của ứng dụng có thể chứa
   cấu hình kết nối đóng gói cùng chương trình.
4. Giữ các script local trong repository tại:
   `C:\Users\Admin\git\pk-system\deployment\windows-server-2012-r2`.

Maven tiêu chuẩn được hỗ trợ qua cấu hình script. Máy local hiện có JDK
`C:\Program Files\Java\jdk1.8.0_131` và Maven nhúng trong Eclipse; phần preflight
của script sẽ cho biết công cụ thực tế được chọn.

## Chuẩn bị một lần trên server

1. Giải nén gói triển khai vào `C:\BackendAutoDeploy` trên server.
   Thư mục cần có `Install-BackendReleaseTask.ps1`, `Update-BackendRelease.ps1`
   và `Reset-RichyService.ps1` bản mới trong cùng gói.
2. Trên GitHub, tạo **fine-grained personal access token** cho server:
   [Trang tạo token](https://github.com/settings/personal-access-tokens/new).
   Chọn đúng Resource owner, Repository access = **Only select repositories**,
   chọn repository Private chứa Release, Repository permissions > **Contents = Read-only**.
   Chọn hạn sử dụng phù hợp; token hết hạn cần thay lại trên server.
3. Mở PowerShell **Run as administrator** trên server và chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\BackendAutoDeploy\Install-BackendReleaseTask.ps1" -Repository "longnt0712/pk-system"
```

Khi script hỏi token, nhập trực tiếp tại prompt trên server. Không ghi token vào
file BAT, tham số dòng lệnh, source hoặc gửi qua chat. Token được mã hóa bằng
DPAPI trên máy server và nằm trong thư mục chỉ SYSTEM/Administrators có quyền.

Script cài runtime tại `C:\pk-deploy\backend-release`, cấu hình và task
**PK System Backend Release Deploy** chạy mỗi phút bằng SYSTEM. Nó không tự
chạy deploy ngay trong lệnh cài; task sẽ kiểm tra bản mới theo lịch sau khi cài.

4. Kiểm tra kết nối/cấu hình bằng lệnh chỉ đọc:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\pk-deploy\backend-release\Update-BackendRelease.ps1" -CheckOnly
```

Nếu dùng repository chứa JAR riêng, thay `longnt0712/pk-system` trong lệnh cài
bằng repository đó, đồng thời dùng cùng giá trị khi publish ở local.

## Mỗi lần cập nhật backend

Chạy trên local, trong PowerShell:

```powershell
& "C:\Users\Admin\git\pk-system\deployment\windows-server-2012-r2\build-deploy-backend.bat"
```

Hoặc mở file BAT trong repository để chạy. BAT gọi build và publish; JAR nằm tại
`richy\richy-app\target\richy-wine-exec.jar`.

Script build dùng hai bước Maven theo thứ tự:

```text
core/pom.xml:  -pl core-api -am clean install
richy/pom.xml: clean package
```

Các bước này bỏ qua test Java cũ bằng `-Dmaven.test.skip=true`; việc build thành
công không thay thế kiểm thử nghiệp vụ. Không dùng JAR còn lại từ lần build trước
nếu lệnh build hiện tại thất bại.

Chỉ sau khi build thành công và kiểm tra đúng executable JAR, script mới tạo
Release nháp, tải lên JAR cùng manifest SHA-256, rồi publish Release hoàn chỉnh.
Source commit, trạng thái source có thay đổi chưa commit và thời điểm build được
ghi trong manifest. Nếu dùng repository source làm nơi chứa Release, nên commit
và push source tương ứng trước khi publish để GitHub tạo tag đúng commit.

Trong khoảng một phút sau khi publish, server tải bản mới về staging, kiểm tra
kích thước/checksum và cập nhật backend. Website sẽ gián đoạn trong lúc service
dừng/khởi động, tương tự lần reset đã kiểm tra trước đây.

## Cơ chế tránh lỗi chạy chồng

- Giữ nguyên task frontend tự pull; pipeline này chỉ triển khai backend JAR.
- Bản cập nhật và script reset service dùng chung khóa
  `Global\PkSystemReset_richy-wine-service`.
- Nếu một lần reset đang chạy, deploy không thay JAR. Nếu deploy đang chạy,
  lần reset cùng khóa sẽ không khởi động thêm một Java khác.
- Chỉ thay JAR sau khi service dừng, Java cũ thoát và cổng 8085 trống.
- Khởi động lại qua chính `richy-wine-service`, giữ XML/cấu hình service hiện có.
- Sau khi khởi động, kiểm tra đúng quan hệ wrapper/Java và HTTP tại localhost.
  HTTP 200/401/403/405 ở endpoint kiểm tra xác nhận ứng dụng đã phản hồi;
  không xác nhận mọi nghiệp vụ của ứng dụng.
- Nếu bản mới không khởi động hoặc không phản hồi HTTP, script cố gắng dừng bản
  mới an toàn, phục hồi JAR cũ và khởi động lại. Nếu Java không chịu dừng, nó ghi
  lỗi để xử lý, không ghi đè JAR đang chạy và không kill hàng loạt Java.

**Giới hạn rollback:** `application.properties` hiện có
`spring.jpa.hibernate.ddl-auto=update`. Rollback trong bộ script chỉ khôi phục
JAR, không khôi phục database hoặc đảo ngược thay đổi schema. Với bản cập nhật
thay đổi schema, cần kế hoạch migration và backup database trước khi triển khai.

## Theo dõi và khắc phục

Trong Task Scheduler, xem **PK System Backend Release Deploy**. Đọc log/state
trong `C:\pk-deploy\backend-release` và log reset của script ở cùng runtime.
Chỉ báo triển khai thành công khi JAR thực tế trùng SHA-256 manifest và bước
khởi động/HTTP đã đạt. Sau đó kiểm tra thao tác thực tế trên website.

Một Release đã triển khai lỗi sẽ được ghi nhận để không restart lặp mỗi phút.
Sau khi xử lý lỗi, có thể publish một Release mới hoặc chạy thủ công updater
với `-RetryFailed` để thử lại bản đã thất bại.

Nếu cần dừng cập nhật tự động, Disable task **PK System Backend Release Deploy**.
Task reset hằng ngày, frontend deploy và backup SQL là các task riêng.

Nếu Maven báo `maven-default-http-blocker`, một repository HTTP cũ đang bị chặn.
Sửa repository/mirror sang HTTPS; không tắt kiểm tra TLS. Có thể dùng `-Offline`
khi máy đã có đầy đủ dependency trong Maven cache. Build lỗi thì không publish.

## Tài liệu chính thức

- [GitHub CLI đăng nhập](https://cli.github.com/manual/gh_auth_login)
- [Tạo và publish Release](https://cli.github.com/manual/gh_release_create)
- [Quyền Contents Read cho tải release asset](https://docs.github.com/en/rest/releases/assets)
- [Tạo fine-grained token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Maven và repository HTTP cũ](https://maven.apache.org/docs/3.8.1/release-notes.html)
