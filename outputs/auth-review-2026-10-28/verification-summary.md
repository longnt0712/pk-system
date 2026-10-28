# Kết quả xác minh bản vá auth/token

Ngày 28/10/2026, source tại working tree hiện tại:

- Backend security: **40/40 JUnit tests đạt**, gồm Spring Security/OAuth HTTP, JDBC/H2, transaction, logout/refresh race và generation. Chạy bằng `deployment/windows-server-2012-r2/Test-AuthSecurity.ps1`. Log: `security-regression-results.log`.
- Frontend auth của richy và core: **57/57 tests đạt** trong `richy/app/tests/auth-session.test.cjs`.
- Auth cùng các test liên quan admin selection, TNTT profile, fair và campaign: **143/143 frontend tests đạt**.
- Maven offline với JDK 8: **BUILD SUCCESS** cho core parent, core-api, core-app, richy parent, richy-api và richy-app. Log: `maven-package-results.log`. Packaging skip test vì các bộ security đã được chạy riêng.
- Diff check với `core.whitespace=cr-at-eol` đạt.

Không chạy migration trên SQL Server/MySQL thật, không deploy production, chưa chạy Gulp build của frontend core. Migration `auth_version` phải chạy trước backend mới; người dùng cần đăng nhập lại một lần.

Chi tiết vận hành: [Hướng dẫn bản vá](C:/Users/Admin/git/pk-system/deployment/windows-server-2012-r2/HUONG-DAN-VA-AUTH-TOKEN.md).
