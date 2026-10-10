# Thông tin TNTT trong hồ sơ cá nhân

Chạy `tntt-person-profile.sql` trong database đang dùng **trước khi cập nhật backend**. Script dành cho SQL Server 2008 trở lên, có thể chạy lại, không tự gán ngành/cấp cho dữ liệu cũ.

Cập nhật backend có chứa `core-api` mới và hai file frontend:

- `users/controllers/UserController.js`
- `users/views/users.html`

Trong **Danh sách học sinh → Thêm/Cập nhật người dùng → Thông tin TNTT**:

- Chọn thành phần: Đoàn sinh, Dự trưởng, Huynh trưởng, Trợ tá, Trợ úy hoặc Tuyên úy.
- Đoàn sinh: chọn ngành Chiên con, Ấu nhi, Thiếu nhi, Nghĩa sĩ hoặc Hiệp sĩ; sau đó chọn cấp I, II hoặc III.
- Huynh trưởng: chọn cấp I, II, III hoặc Đặc cấp.
- Có thể để chưa xác định thành phần/ngành/cấp và bổ sung sau. Chọn ngành trước khi chọn cấp đoàn sinh.
- Khi đổi thành phần hoặc ngành, cấp cũ được bỏ để chọn lại đúng cấp trong thành phần/ngành mới.

Danh sách hiển thị một cột **Ngành / Cấp TNTT**, có thể sắp xếp theo thứ tự thành phần, ngành và cấp. Xuất Excel/ảnh có ba cột riêng: Thành phần TNTT, Ngành TNTT, Cấp TNTT. Các trường và cột TNTT được ẩn trên domain IELTS Room.

Dữ liệu lưu trên `tbl_person`:

| Cột | Giá trị |
| --- | --- |
| `tntt_member_type` | `DOAN_SINH`, `DU_TRUONG`, `HUYNH_TRUONG`, `TRO_TA`, `TRO_UY`, `TUYEN_UY` hoặc NULL |
| `tntt_branch` | `CHIEN_CON`, `AU_NHI`, `THIEU_NHI`, `NGHIA_SI`, `HIEP_SI` hoặc NULL; chỉ áp dụng cho đoàn sinh |
| `tntt_level` | 1, 2, 3 hoặc NULL; 4 là Đặc cấp, chỉ áp dụng cho Huynh trưởng |

Thông tin TNTT được lưu riêng với quyền đăng nhập và lớp chính. Cấp không tự thay đổi khi đổi lớp. API cũ không gửi các trường TNTT vẫn giữ thông tin TNTT đã lưu.
