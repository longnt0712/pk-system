# Tự cập nhật và restart trên Ubuntu

Runtime dành cho VPS Ubuntu `163.44.193.27`, sau migration ngày 02/11/2026. SQL vẫn trên Windows `118.27.192.59`; bộ này chỉ quản lý Java/Nginx và code trên Linux.

Đã bật và xác minh ngày **03/11/2026**: ba timer hoạt động; lần restart kế tiếp lúc **02:30 cùng ngày**. Bootstrap đã build thành công source `2d4381989b99`, cập nhật frontend từ `main` và giữ backend migration đang chạy vì source backend không đổi. Có 15 kiểm thử cho cơ chế deploy/rollback/watchdog; HTTPS công khai của hai website đạt HTTP 200.

## Hoạt động

| Thành phần | Cách chạy |
|---|---|
| `pk-system-autodeploy.timer` | Kiểm tra `origin/main` khoảng mỗi phút, sau khi lần kiểm tra trước kết thúc |
| Frontend | Theo dõi `richy/app`; chuẩn bị release, kiểm tra qua Nginx HTTPS ở loopback rồi đổi symlink và reload Nginx |
| Backend | Theo dõi hai POM cha và các module `core-api`, `richy-api`, `richy-app`; build Java 8, xác minh executable JAR rồi dừng/thay/start Java qua systemd |
| `pk-system-scheduled-restart.timer` | Restart **Java** lúc **02:30, 07:00, 17:30 hằng ngày**, múi giờ **Asia/Ho_Chi_Minh (UTC+7)** |
| `pk-system-healthcheck.timer` | Kiểm tra HTTP Java khoảng mỗi phút; ba lần lỗi liên tiếp mới xét restart |

Restart theo lịch không khởi động lại VPS, SQL hoặc IIS Windows. Lịch không chạy bù các mốc đã bỏ lỡ khi VPS tắt; Java/Nginx có cấu hình khởi động cùng máy.

Các thao tác chuyển release, restart theo lịch và xử lý HTTP lỗi dùng chung khóa bảo trì. Build có khóa riêng và diễn ra trước khi lấy khóa bảo trì, để không giữ lịch restart chờ cả quá trình compile.

## Nguồn code và tài nguyên

- Repository hiện công khai: `https://github.com/longnt0712/pk-system.git`, nhánh `main`. VPS lấy source qua HTTPS, không lưu token GitHub.
- Git/build chạy bằng tài khoản `pk-deploy`, trong checkout riêng `/var/lib/pk-deploy/source`. Checkout này có thể được reset/clean; không đặt dữ liệu người dùng trong đó.
- Source local chưa commit/push không được deploy. Thay đổi dưới `deployment/linux` không tự thay helper đang chạy với quyền root; nâng cấp helper là thao tác quản trị riêng.
- Quy trình cập nhật Linux là commit/push source lên `main`. Bộ BAT build/publish và các task deploy Windows cũ không cập nhật máy Linux.
- Maven heap 384 MiB; unit điều phối/build có `MemoryMax=768M`, `CPUQuota=100%` (tối đa một CPU), ưu tiên thấp hơn ứng dụng. Git cache/Maven cache nằm ngoài dữ liệu ứng dụng.
- Build `core-api` trước, sau đó `richy` bằng JDK 8. Dùng HTTPS cho Maven Central. Bỏ qua test Java cũ như quy trình build hiện có; build thành công không thay thế kiểm thử nghiệp vụ.
- Dùng `-Dassembly.skipAssembly=true` để bỏ bản `jar-with-dependencies` thừa; sản phẩm triển khai là Spring Boot `richy-wine-exec.jar` có đủ hai thư viện ứng dụng.

## Dữ liệu và release

- `/opt/pk-system/current.jar` trỏ đến JAR đang chọn. JVM dùng cấu hình riêng trong `/etc/pk-system`; deploy giữ nguyên biến môi trường, đường SQL SSH và `ddl-auto=none`.
- `/srv/pk-system/current` trỏ đến release frontend; `/srv/pk-system/www` đi theo `current/webroot`.
- Các trang HTML riêng cho hai tên miền và map tên file không phân biệt hoa/thường nằm cùng release. Quy tắc HTML được lấy từ cấu hình đã xác minh khi migration, lưu tại `/etc/pk-deploy/iis-web.config`.
- `web.config` trong Git là cấu hình IIS, không phải cập nhật cấu hình Nginx. Thay routing/SEO trên server phải cập nhật cấu hình Linux tương ứng.
- Release frontend mới dùng hardlink cho file cũ và thay inode khi cập nhật. Chỉ xóa file đã được Git quản lý ở lần triển khai trước; giữ các file media ngoài Git. Có xử lý đổi hoa/thường từ dữ liệu Windows.
- Ghi âm và upload vẫn ở `/var/lib/pk-system/speaking-recordings`, `/var/lib/pk-system/files`; không nằm trong checkout hoặc vùng dọn release.
- Giữ ba release tự động mới nhất và bảo vệ release đang dùng/bản trước; giữ snapshot migration gốc. Giữ tối đa 20 log build còn nguyên.

## Khi bản mới lỗi

- Build hoặc xác minh JAR thất bại: không chuyển bản đang phục vụ.
- Khởi động backend, HTTPS hoặc reload frontend thất bại: cố gắng khôi phục symlink trước và kiểm tra lại dịch vụ.
- Source đã deploy lỗi được ghi nhận, tránh thử cùng bản lỗi mỗi phút. Sau khi sửa, push thay đổi source mới hoặc chạy `poll --retry` có chủ đích.
- Rollback này khôi phục **phần mềm**, không khôi phục database hoặc đảo ngược thay đổi dữ liệu. Code có thay đổi schema cần kế hoạch SQL/backup riêng trước khi push vào nhánh tự deploy.

HTTP watchdog dùng endpoint SockJS công khai có sẵn để phát hiện Java không phản hồi. Nó không thay thế kiểm tra mọi truy vấn SQL/nghiệp vụ. Watchdog bỏ qua khi service đã được dừng, có thao tác bảo trì, hoặc không có cổng tunnel SQL; giới hạn ba lần tự khôi phục trong 24 giờ và có khoảng chờ 15 phút sau lần khởi động lại thành công.

## Theo dõi

Chạy trong SSH Ubuntu bằng tài khoản quản trị:

```sh
systemctl list-timers 'pk-system-*' --all --no-pager
systemctl status pk-system nginx --no-pager
journalctl -u pk-system-autodeploy -n 40 --no-pager
journalctl -u pk-system-scheduled-restart -n 40 --no-pager
journalctl -u pk-system-healthcheck -n 40 --no-pager
cat /var/lib/pk-deploy-control/deploy-state.json
```

Log build: `/var/log/pk-deploy/build-<commit>.log`. Cấu hình: `/etc/pk-deploy/settings.json`. Mã điều phối đã cài: `/usr/local/lib/pk-deploy/`.

Kiểm tra cập nhật ngay hoặc thử lại bản đã sửa điều kiện build:

```sh
systemctl start pk-system-autodeploy.service
python3 /usr/local/lib/pk-deploy/pk_deploy.py poll --retry
```

Tạm dừng tự cập nhật, vẫn giữ website và lịch restart:

```sh
systemctl disable --now pk-system-autodeploy.timer
```

Muốn bảo trì và dừng Java có chủ đích, tạm dừng cả timer liên quan trước để tránh lịch restart khởi động lại ứng dụng trong thời gian bảo trì.

## Kiểm thử và cài đặt

Kiểm thử chuẩn trên Linux, không gọi dịch vụ production:

```sh
python3 -m unittest discover -s deployment/linux/tests -v
```

`install.py prepare --baseline-backend-signature <sha256>` chuẩn bị cấu hình và các unit, giữ timer chưa bật. Baseline phải được đối chiếu với source của bản migration. Lần bootstrap chạy trong unit giới hạn tài nguyên với `pk_deploy.py bootstrap --verify-build`; nó xác minh build, áp dụng frontend mới nếu khác snapshot và chỉ đổi backend nếu source backend khác baseline.

Chỉ chạy `install.py enable` sau khi bootstrap thành công. Khóa SSH quản trị tạm của phiên cài đặt được thu hồi sau xác minh; dịch vụ tự động tiếp tục chạy độc lập với MobaXterm và máy cá nhân.

Tài liệu tham khảo: [lịch systemd và múi giờ](https://manpages.ubuntu.com/manpages/jammy/man7/systemd.time.7.html), [tham số bỏ assembly thừa của Maven](https://maven.apache.org/plugins/maven-assembly-plugin/single-mojo.html#skipAssembly).
