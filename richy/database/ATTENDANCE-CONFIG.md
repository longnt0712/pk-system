# Cấu hình giờ điểm danh

Trong `person_date`, chọn **Công cụ → Cấu hình giờ điểm danh** bằng tài khoản
`ROLE_ADMIN` hoặc `ROLE_EDUCATION_MANAGERMENT`. Giáo viên có quyền điểm danh được
đọc cấu hình và chọn mọi trạng thái trong dropdown điểm danh tay.

| Cấu hình mặc định | Giá trị |
| --- | --- |
| Giờ bắt đầu Lễ | 08:00 |
| Muộn Lễ từ | 5 phút, tức từ đúng 08:05:00 |
| Tự tính muộn QR Lễ | Bật |
| Giờ bắt đầu Giáo lý | 09:00 |
| Số phút du di Giáo lý | 15 phút, tức từ đúng 09:15:00 |
| Tự tính muộn QR Giáo lý | Tắt |
| Giờ chuyển QR Lễ sang Giáo lý / Ngoại khóa | 09:00 |

Cấu hình được lưu dùng chung trong `tbl_attendance_config` (bản ghi `id = 1`).
Giờ chuyển QR dùng một mốc: Lễ được quét trước mốc này, Giáo lý và Ngoại khóa
được quét từ đúng mốc này. Giờ bắt đầu và số phút du di Giáo lý chỉ dùng để tính
muộn, độc lập với giờ chuyển QR.

Máy chủ quyết định trạng thái và thời gian theo `Asia/Ho_Chi_Minh`. QR tắt tự
tính muộn luôn ghi trạng thái có đi trong thời gian cho phép. Ngoại khóa không
tự tính muộn. Điểm danh tay không áp dụng ngưỡng giờ QR hoặc tự tính muộn;
giáo viên có thể chọn MUỘN hoặc sửa lại trạng thái.

QR quét lại giữ trạng thái và thời gian của bản ghi đã điểm danh (có đi, muộn,
hoặc ca đoàn Lễ), kể cả trạng thái giáo viên đã chỉnh. Máy chủ trả
`qrAlreadyRecorded = true` cho loại đã điểm danh; giao diện báo **Đã điểm danh
trước đó**, giữ nguyên giờ và người cập nhật đã lưu. Lễ, Giáo lý và Ngoại khóa
được kiểm tra riêng: đã điểm danh Lễ vẫn có thể điểm danh Giáo lý lần đầu.
Giáo viên có thể hủy điểm
danh để xóa giờ, sau đó quét lại để ghi nhận lần mới. Mỗi lượt QR chỉ cập nhật
loại được chọn; không tính lại dữ liệu lịch sử khi đổi cấu hình.
MUỘN được tính là có mặt trong tổng điểm danh và thống kê theo ngày.

## Triển khai

1. Chạy `attendance-config.sql` trên đúng cơ sở dữ liệu SQL Server của ứng dụng.
   Script có thể chạy lại và giữ nguyên cấu hình đã lưu.
2. Triển khai backend và frontend cùng phiên bản. Hibernate cũng có thể tạo
   bảng khi `spring.jpa.hibernate.ddl-auto=update`; script SQL dùng để chuẩn bị
   bảng trước khi triển khai.
3. Mở mục cấu hình và kiểm tra các giá trị mặc định. Cấu hình được tải lại mỗi
   lần mở camera; máy chủ đọc cấu hình hiện tại ở mỗi lượt quét.

Không cần thay đổi các bản ghi `tbl_person_date` hiện có. Bộ kiểm tra gồm
`AttendanceConfigServiceTest`, `PersonDateQrAttendanceTest`, và:

```sh
node --test richy/app/tests/person-date-attendance.test.cjs
node --test richy/app/tests/person-date-attendance-browser.test.cjs
```
