# Rà soát auth/token — 28/10/2026

> Đây là báo cáo baseline trước sửa. Bản vá và kiểm thử đã được thực hiện ở lượt tiếp theo; xem [hướng dẫn bản vá](C:/Users/Admin/git/pk-system/deployment/windows-server-2012-r2/HUONG-DAN-VA-AUTH-TOKEN.md). Các probe trong thư mục này được giữ làm bằng chứng hành vi cũ; dùng bộ regression hiện hành để kiểm tra bản đã sửa.

Rà source tại commit `9bc6860`, tập trung ứng dụng `richy`, phần security dùng chung trong `core/core-api`, và đối chiếu cấu hình `core/core-app`. Có các lỗi cho phép tài khoản đã đăng nhập chiếm quyền tài khoản khác; cần ưu tiên xử lý các phát hiện P1 dưới đây.

Đây là kết quả rà source và tái hiện cục bộ bằng dữ liệu giả. Không gọi API production, không truy cập dữ liệu người dùng thật và không thay đổi code ứng dụng. Các probe nằm cùng thư mục báo cáo.

## Luồng hiện tại

1. Frontend gửi username/password tới `/service/oauth/token` theo password grant; OAuth client được cấu hình trong JavaScript.
2. Backend kiểm tra mật khẩu bằng BCrypt qua `CustomUserDetailsService`.
3. Token là opaque token, được tra trong `JdbcTokenStore` và các bảng `oauth_access_token`/`oauth_refresh_token`; hệ thống này không dùng JWT để xác minh request.
4. Custom `DefaultTokenServices` cấp access token 86.400 giây và để refresh token theo mặc định thư viện là 30 ngày, tái sử dụng refresh token.
5. Frontend lưu access token và refresh token trong cookie JSON `token`, có thời hạn; cookie `education.user` lưu thông tin người dùng. JavaScript đọc và gắn Bearer vào các request `/service/api/` đúng origin.
6. Khi API trả 401, frontend gộp refresh đồng thời trong một tab, refresh rồi thử lại request một lần. Logout xóa cookie ngay và gọi `DELETE /service/oauth/logout` bằng access token đã chụp trước khi xóa.

## Các phát hiện cần sửa

### 1. [P1] Tài khoản thường lấy được bearer token của các tài khoản khác

Vị trí: [TokenController.java:39](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/rest/TokenController.java:39).

`GET /tokens/{clientId}` dùng `findTokensByClientId()` rồi trả nguyên `token.getValue()` của mọi phiên thuộc client. Không có kiểm tra role quản trị hoặc chủ sở hữu. Với client frontend đang sử dụng, một người dùng đã đăng nhập có thể lấy cả token của admin đang có phiên, rồi sử dụng token đó để gọi API dưới danh tính admin.

Đường dẫn này nằm dưới context `/service` khi chạy richy. Resource server hiện yêu cầu authenticated cho request này; không kết luận endpoint truy cập được khi chưa đăng nhập. Dòng `permitAll("/tokens/**")` trong web config không phải bằng chứng đủ để kết luận anonymous vì còn thứ tự các security filter chain.

Đã tái hiện qua MockMvc với cấu hình Spring Security hiện tại và token giả: anonymous nhận 401, `ROLE_STUDENT` nhận 200 chứa token admin. Nên bỏ endpoint trả bearer token; nếu cần quản lý phiên, chỉ trả metadata của các phiên được phép xem. Việc chặn trên giao diện không khắc phục lỗi này.

### 2. [P1] Đổi mật khẩu cá nhân có thể đổi mật khẩu người khác

Vị trí: [RestUserController.java:217](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/rest/RestUserController.java:217), [UserServiceImpl.java:1266](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/service/impl/UserServiceImpl.java:1266).

`PUT /api/users/password/self` chỉ so sánh `dto.username` với username của người đang đăng nhập. Service lại tìm tài khoản cần đổi bằng `dto.id`. Hai giá trị này không được ràng buộc với nhau.

Một tài khoản thường có thể gửi username của chính mình, ID của tài khoản đích và mật khẩu mới. Controller cho qua, service đổi mật khẩu tài khoản đích. Endpoint không xác minh mật khẩu cũ trong cùng thao tác; `/password/valid` là một request khác và có thể bị bỏ qua.

Đã tái hiện qua MockMvc/Spring Security trên controller/service hiện tại với repository giả: `ROLE_STUDENT` nhận 200 và mật khẩu của tài khoản đích bị thay đổi. Cần lấy ID tài khoản từ principal phía server; đồng thời xác minh mật khẩu hiện tại trong chính thao tác đổi mật khẩu cá nhân. Luồng admin reset phải có quyền riêng.

### 3. [P1] Khóa tài khoản, đổi mật khẩu hoặc gỡ quyền không vô hiệu hóa phiên đang tồn tại

Vị trí: [OAuth2AuthorizationServerConfig.java:62](C:/Users/Admin/git/pk-system/richy/richy-app/src/main/java/com/globits/richy/config/OAuth2AuthorizationServerConfig.java:62), [OAuth2ResourceServerConfig.java:74](C:/Users/Admin/git/pk-system/richy/richy-app/src/main/java/com/globits/richy/config/OAuth2ResourceServerConfig.java:74), [UserServiceImpl.java:1272](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/service/impl/UserServiceImpl.java:1272).

Custom `DefaultTokenServices` chỉ được gắn token store và thời hạn. Không có bước tải lại user khi refresh. `endpoints.authenticationManager(...)` không tự cấu hình lại instance token service đã được truyền vào qua `.tokenServices(...)`.

Resource server đọc authentication đã lưu trong token store, bao gồm quyền tại thời điểm đăng nhập. Đổi password, cập nhật `active` và sửa role không thu hồi các token đó. Người giữ token cũ vẫn được xác thực và có thể tiếp tục refresh với quyền cũ tới hạn refresh. Việc frontend tải lại user và ẩn menu không thay đổi quyền được backend đọc từ token.

Đã đối chiếu source của đúng dependency local `spring-security-oauth2 2.0.14.RELEASE`. Probe dùng cùng cấu hình `DefaultTokenServices` và `InMemoryTokenStore` xác nhận refresh vẫn thành công khi principal bị disable, đồng thời quyền admin đã có vẫn nằm trong authentication. Với JDBC, authentication là bản lưu serialized; việc không tải lại DB được xác minh từ source dependency. Không thực hiện thao tác khóa user thật trong DB production.

Cần cơ chế thu hồi hoặc kiểm tra phiên bản phiên khi password/trạng thái/quyền thay đổi, và kiểm tra user hiện hành khi refresh. Chỉ giảm thời hạn access token không giải quyết việc refresh vẫn dùng quyền cũ. Lỗi cấu hình tương tự có ở `core/core-app`.

### 4. [P1] API tra cứu user trả cả hash mật khẩu

Vị trí: [UserDto.java:77](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/dto/UserDto.java:77), [UserDto.java:222](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/dto/UserDto.java:222), [RestUserController.java:55](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/rest/RestUserController.java:55), [RestUserController.java:83](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/rest/RestUserController.java:83).

`UserDto(User)` sao chép `entity.password`, và getter password được serialize bình thường. Các API tra cứu theo username hoặc user ID chỉ yêu cầu đăng nhập và trả DTO chưa loại password. Vì vậy tài khoản thường đọc được BCrypt hash của tài khoản khác, kể cả admin, để dò mật khẩu offline.

`getCurrentUser` có riêng lệnh `setPassword(null)`, nhưng bảo vệ đó không áp dụng cho các API lookup. MockMvc với `ROLE_STUDENT` và hash giả xác nhận trường password xuất hiện trong JSON trả về qua HTTP.

Nên dùng response DTO không có password/hash; dữ liệu bí mật dùng cho xác thực phải đi theo đường nội bộ riêng. Nếu đặt password thành write-only trên DTO hiện tại, cần giữ nguyên luồng đọc password nội bộ cho `CustomUserDetailsService`, đồng thời kiểm tra các response trả entity trực tiếp.

### 5. [P2] Logout có thể không thu hồi refresh token trên server

Vị trí: [application.services.js:99](C:/Users/Admin/git/pk-system/richy/app/application.services.js:99), [TokenController.java:29](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/rest/TokenController.java:29).

Frontend chỉ gửi access token tới logout. Khi refresh chạy đồng thời, token service có thể đã xóa access token cũ và tạo access token mới trước lúc logout dùng access token cũ tới nơi. `revokeToken(oldAccess)` không tìm thấy access cũ thì trả false và không xóa refresh token. Nếu access đã hết hạn, security filter cũng có thể trả 401 trước khi controller thu hồi phiên.

Cookie đã bị xóa nên trình duyệt trông như đã logout; điều đó không chứng minh access mới/refresh token phía server đã bị thu hồi. Người còn giữ refresh token vẫn có thể tiếp tục dùng phiên. Probe xác nhận refresh token còn tồn tại sau khi refresh rồi revoke bằng access token cũ.

Cần thu hồi theo định danh phiên/refresh token thuộc đúng người dùng, xử lý cả access đã hết hạn và đồng bộ với refresh đang chạy. Kiểm tra quyền sở hữu phải nằm ở server. Luồng logout offline có thể vẫn xóa local, nhưng không nên xem đó là thu hồi thành công ở server.

### 6. [P2] Thời hạn cấu hình trên OAuth client trong DB bị bỏ qua

Vị trí: [OAuth2AuthorizationServerConfig.java:62](C:/Users/Admin/git/pk-system/richy/richy-app/src/main/java/com/globits/richy/config/OAuth2AuthorizationServerConfig.java:62).

Custom token service không được gắn `ClientDetailsService`. Vì vậy `access_token_validity` và `refresh_token_validity` trong `oauth_client_details` không được áp dụng bởi instance này, dù `clients.jdbc(dataSource)` đã được cấu hình cho endpoint. Các SQL seed trong repo đặt giá trị 36.000 giây; đó là seed, không phải giá trị đã xác minh trong DB đang chạy.

Theo cấu hình và dependency hiện tại, access thực tế là 24 giờ và refresh là 30 ngày. Frontend cũng tự suy ra hạn phiên 30 ngày. Cần thống nhất policy và truyền đúng thời hạn phiên cho frontend, tránh chỉ thay DB rồi tưởng thời hạn đã được giảm.

### 7. [P2] Các cờ khóa/hết hạn trong DB bị bỏ qua khi đăng nhập mới

Vị trí: [CustomUserDetailsService.java:39](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/CustomUserDetailsService.java:39), [UserDto.java:152](C:/Users/Admin/git/pk-system/core/core-api/src/main/java/com/globits/security/dto/UserDto.java:152).

Luồng load user chuyển entity sang DTO rồi gọi `toEntity()`. Trong phép chuyển ngược, `accountNonExpired`, `accountNonLocked`, `credentialsNonExpired` đều bị gán cứng thành true. Vì vậy các giá trị false tương ứng trong DB không ngăn password login mới, miễn tài khoản còn `active=true` và password đúng.

`active=false` vẫn chặn đăng nhập mới. Chưa thấy API hiện tại sửa ba cờ khóa/hết hạn nói trên; mức ảnh hưởng vận hành phụ thuộc việc các cờ đó có đang được sử dụng hay không. Cần tạo principal từ dữ liệu thật và giữ nguyên các trạng thái bảo mật, thay vì chuyển qua DTO làm mất thông tin.

### 8. [P2] Phản hồi password login cũ có thể ghi đè phiên mới hoặc làm xuất hiện lại phiên sau logout

Vị trí: [LoginController.js:147](C:/Users/Admin/git/pk-system/richy/app/common/controllers/LoginController.js:147), [angular-oauth2.min.js:47](C:/Users/Admin/git/pk-system/richy/app/assets/scripts/external/angular-oauth2.min.js:47).

Hai trường hợp đã được tái hiện bằng JavaScript thật:

- Đang chờ `getCurrentUser` của A, phiên đã chuyển sang B, response A về vẫn ghi cookie user A và role A. Kết quả token thuộc B nhưng thông tin user/quyền giao diện thuộc A.
- Password login đang chờ, người dùng logout, response login về sau vẫn được thư viện OAuth gọi `setToken()`, khiến token xuất hiện lại.

Background user lookup đã có kiểm tra identity; luồng login thủ công chưa có kiểm tra tương đương. Cần quản lý password login cùng generation của phiên, kiểm tra trước cả bước ghi token và ghi user/role/điều hướng. Tác động xác minh ở đây là sai danh tính giao diện và logout bị đảo ngược; chưa suy ra được bypass phân quyền backend chỉ từ lỗi frontend này.

## Những bảo vệ frontend đã kiểm tra

Chạy `node --test richy/app/tests/auth-session.test.cjs`: **42/42 test đạt**. Các test hiện có xác nhận gộp refresh đồng thời trong một tab, retry một lần, bỏ qua 401 của phiên cũ, giữ phiên khi lỗi mạng/403/5xx, giới hạn nơi gắn bearer và giữ FormData khi retry.

Các test đó không kiểm tra quyền truy cập endpoint backend hoặc việc refresh token đã thật sự bị thu hồi trong token store sau logout. Vì vậy việc bộ test đang xanh không phủ định các phát hiện trên.

## Các điểm thiết kế cần lưu ý, chưa coi là lỗi đã khai thác

- Refresh token tồn tại trong cookie JavaScript đọc được, `path=/`, có thể sống 30 ngày. Nếu có XSS cùng origin, refresh token có thể bị đọc. Lần rà này chưa chứng minh một đường XSS; không ghi đây thành lỗ hổng khai thác độc lập.
- Cookie token đặt `Secure` khi trang chạy HTTPS. Cấu hình `server.session.cookie.http-only=true` chỉ bảo vệ session cookie phía server; nó không làm cookie `token` do Angular tạo trở thành HttpOnly.
- `web.config` trong repo không chứa rule ép HTTPS, nhưng IIS có thể cấu hình việc này ở ngoài repo. Chưa kết luận production truyền token qua HTTP.
- OAuth client secret có trong JavaScript nên không thể dùng nó làm bằng chứng chỉ frontend hợp lệ mới được gọi API. Bảo vệ phải dựa trên người dùng và quyền phía server.
- Token service mặc định tái sử dụng access token còn hạn cho cùng username/client/scope. Vì vậy hai lần đăng nhập trên hai thiết bị không nhất thiết có hai phiên độc lập; logout một thiết bị có thể ảnh hưởng thiết bị còn lại. Đây là hành vi đã đối chiếu source dependency, cần quyết định rõ policy nhiều thiết bị trước khi thiết kế lại quản lý phiên.
- `POST /tokens/revokeRefreshToken/{tokenId}` thiếu kiểm tra quyền sở hữu và đặt refresh token trong URL. Cần xem lại cùng thiết kế quản lý phiên; không tính thành đường chiếm quyền độc lập chỉ từ việc endpoint tồn tại.

## Thứ tự xử lý đề nghị

1. Đóng đường trả bearer token và sửa self-password lấy ID từ principal.
2. Ngừng trả password/hash trong API; bổ sung kiểm thử quyền với user thường và admin.
3. Triển khai thu hồi phiên khi đổi password/khóa user/gỡ quyền; kiểm tra user hiện hành lúc refresh. Khi triển khai bản vá cần có bước thu hồi phiên cũ vì thay code không tự xóa token đã lưu.
4. Sửa logout đồng thời refresh, áp dụng đúng thời hạn client và giữ nguyên các cờ trạng thái tài khoản.
5. Thống nhất lifecycle password login/refresh/logout ở frontend; thêm test cho response cũ và nhiều tab.

Chưa xác minh có người đã khai thác các lỗi này. Muốn kết luận mức ảnh hưởng thực tế cần kiểm tra bản backend đang triển khai, token store và access log của môi trường chạy; source review không cung cấp bằng chứng khai thác lịch sử.

## Chạy lại bằng chứng cục bộ

Từ thư mục repo:

```powershell
node --test richy/app/tests/auth-session.test.cjs
& ./outputs/auth-review-2026-10-28/Run-BackendTokenProbe.ps1
node ./outputs/auth-review-2026-10-28/frontend-auth-probe.cjs
& ./outputs/auth-review-2026-10-28/endpoint-probe/run-probe.ps1
```

Backend probe sử dụng dependency có sẵn trong Maven cache và JDK 8; runner cho phép truyền `-MavenRepository` và `-JavaDirectory`. Dữ liệu token/user trong probe đều là dữ liệu giả. Probe kiểm chứng hành vi hiện tại, không phải test xác nhận hệ thống đã được sửa.

Endpoint probe biên dịch lại các controller/service/DTO và security config từ source hiện tại, dùng MockMvc/Spring Security với repository giả và `InMemoryTokenStore`. Nó cần `javac`/`java`, các dependency và build artifact có sẵn tại máy này; không tự tải dependency hoặc chạy Maven build. Bốn assertion đều đã chạy đạt:

```text
CONFIRMED resource filter rejects anonymous token listing
CONFIRMED ROLE_STUDENT bearer gets another user's administrator token through HTTP
CONFIRMED ROLE_STUDENT HTTP user lookup exposes victim hash
CONFIRMED ROLE_STUDENT HTTP self password endpoint changes another user's password
```

Kết quả token-service probe:

```text
disabledUserRefreshIssued=true
loadedPrincipalDisabled=true
staleAdminAuthority=true
accessLifetimeSeconds=86400
refreshLifetimeDays=30
revokeOldAccessAfterRefresh=false
refreshSurvivesOldAccessRevoke=true
```
