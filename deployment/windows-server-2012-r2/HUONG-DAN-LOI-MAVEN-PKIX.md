# Maven báo PKIX khi tải thư viện qua HTTPS

Trên máy đang dùng JDK `1.8.0_131`, kết nối Maven Central thất bại với kho CA của JDK nhưng thành công khi Java dùng kho chứng chỉ Windows. Chuỗi chứng chỉ được kiểm tra có gốc ISRG của Let's Encrypt. Đây là lỗi xác thực HTTPS khi tải dependency, xảy ra trước bước biên dịch.

## Build bằng Eclipse trên Windows

Trong project `ielts` (thư mục `richy`), đã có cấu hình dùng chung `Build Richy Windows.launch`:

1. Refresh project bằng F5.
2. Mở **Run → Run Configurations → Maven Build → Build Richy Windows**.
3. Ở tab **JRE**, chọn JDK Java 8 đã cài, rồi Run.

Cấu hình chạy `clean install` tại `${project_loc:ielts}`. Nếu project được đổi tên, sửa Base directory cho khớp tên trong Eclipse.

Với cấu hình Maven riêng đang có, thêm vào **JRE → VM arguments**:

```text
-Djavax.net.ssl.trustStoreType=Windows-ROOT
-Djavax.net.ssl.trustStoreProvider=SunMSCAPI
-Djavax.net.ssl.trustStore=NONE
```

`Windows-ROOT` chọn các CA mà Windows đã tin cậy. `NONE` chỉ ra rằng kho này không phải một file JKS; Java vẫn xác thực chuỗi chứng chỉ và tên máy chủ. Những tùy chọn này chỉ áp dụng cho tiến trình Maven của cấu hình build đó. Không đưa chúng vào tham số chạy backend trên server.

Nếu Eclipse đang mở khi cấu hình riêng được sửa từ ngoài, dùng cấu hình dùng chung mới sau F5 hoặc mở lại Eclipse để nạp lại cấu hình riêng.

## Khi dùng Maven độc lập

Dùng Maven 3.9.x và JDK Java 8. Có thể đặt ba tùy chọn trên vào `MAVEN_OPTS` của cửa sổ build, rồi chạy `mvn -B -f richy/pom.xml clean install`. Giữ nguyên các tùy chọn Maven khác đang cần và phục hồi `MAVEN_OPTS` sau khi build.

Không dùng tùy chọn bỏ kiểm tra SSL, không đổi Maven Central sang HTTP và không nhập chứng chỉ máy chủ lấy từ một kết nối chưa được xác minh.

Phiên bản JavaMail được khai báo tập trung tại `richy/pom.xml` để cả `richy-api` và JAR backend dùng `1.6.2`, tránh bị Spring Boot cũ kéo về `1.5.6` khi đóng gói. Loại dependency `javax.mail:mail:1.4.5` đi kèm thư viện Azure của JDBC khỏi hai module Richy để JAR cuối chỉ chứa một JavaMail provider.

Tham khảo: [Oracle về Windows-ROOT và SunMSCAPI](https://www.oracle.com/technical-resources/articles/javase/security.html), [chuỗi chứng chỉ Let's Encrypt](https://letsencrypt.org/certificates/).
