# Thông tin TNTT trong hồ sơ cá nhân

Chạy `tntt-person-profile.sql` trong database đang dùng **trước khi cập nhật backend**. Script dành cho SQL Server 2008 trở lên, có thể chạy lại, không tự gán ngành/cấp cho dữ liệu cũ.

Cập nhật backend có chứa `core-api` mới và ba file frontend:

- `users/controllers/UserController.js`
- `users/business/UserService.js`
- `users/views/users.html`

Trong **Danh sách học sinh → Thêm/Cập nhật người dùng → Thông tin TNTT**:

- Chọn thành phần: Đoàn sinh, Dự trưởng, Huynh trưởng, Trợ tá, Trợ úy hoặc Tuyên úy.
- Đoàn sinh: chọn ngành Chiên con, Ấu nhi, Thiếu nhi, Nghĩa sĩ hoặc Hiệp sĩ; sau đó chọn cấp I, II hoặc III.
- Huynh trưởng: chọn cấp I, II, III hoặc Đặc cấp.
- Có thể để chưa xác định thành phần/ngành/cấp và bổ sung sau. Chọn ngành trước khi chọn cấp đoàn sinh.
- Khi đổi thành phần hoặc ngành, cấp cũ được bỏ để chọn lại đúng cấp trong thành phần/ngành mới.

Danh sách hiển thị một cột **Ngành / Cấp TNTT**, có thể sắp xếp theo thứ tự thành phần, ngành và cấp. Xuất Excel/ảnh có ba cột riêng: Thành phần TNTT, Ngành TNTT, Cấp TNTT. Các trường và cột TNTT được ẩn trên domain IELTS Room.

Nút **Sửa/Thêm thông tin TNTT** mở bảng gồm họ tên, mã học sinh (tên đăng nhập), ngày sinh và ba cột TNTT của danh sách đang hiển thị (giữ bộ lọc, trang và thứ tự). Quản trị viên, quản lý học sinh và quản lý giáo dục được dùng nút này trên trang TNTT.

- Tích ô ở tiêu đề để bật/tắt sửa cả cột; tích ô cạnh từng thông tin để sửa riêng ô đó.
- Tích **Sửa tất cả cột TNTT** để mở sửa cả ba cột bằng một lần tích. Bỏ tích khóa lại các ô nhưng giữ bản nháp.
- Chọn giá trị trong ô **Áp dụng cả cột…** dưới tiêu đề để điền một lần cho mọi học sinh phù hợp. Ví dụ: chọn Đoàn sinh → Ấu nhi → Cấp I để điền cho toàn bộ bảng, rồi bấm Lưu thay đổi. Các lựa chọn **Xóa thành phần/ngành/cấp** xóa giá trị trong bản nháp.
- Ngành chỉ điền cho đoàn sinh. Cấp I–III điền cho đoàn sinh đã chọn ngành và Huynh trưởng; Đặc cấp chỉ điền cho Huynh trưởng. Dòng không phù hợp giữ nguyên và số dòng này hiển thị trong thông báo.
- Ô tích chỉ điều khiển việc mở sửa. Bỏ tích không xóa thay đổi đã nhập và không tự ghi dữ liệu.
- Bấm **Lưu thay đổi** để lưu các dòng có thay đổi; đóng modal khi chưa lưu sẽ bỏ bản nháp.
- Ngành chỉ áp dụng cho đoàn sinh; cấp áp dụng cho đoàn sinh hoặc Huynh trưởng, theo cùng quy tắc với hồ sơ cá nhân.
- Lỗi lưu hiển thị trên từng dòng. Những dòng đã lưu giữ nguyên; bấm Lưu lần nữa để thử lại các dòng chưa lưu.

API `PUT /api/users/{userId}/tntt-profile` nhận các trường TNTT thay đổi trong `PersonDto`, trả về hồ sơ cá nhân đã lưu; không cập nhật tên, ngày sinh, lớp hoặc quyền tài khoản. Trường không gửi giữ nguyên; `null` xóa giá trị. Đổi thành phần/ngành mà không gửi cấp sẽ bỏ cấp cũ. API dùng cùng quyền cập nhật thông tin cơ bản; trả 400 cho TNTT không hợp lệ và 404 khi không tìm thấy học sinh.

Dữ liệu lưu trên `tbl_person`:

| Cột | Giá trị |
| --- | --- |
| `tntt_member_type` | `DOAN_SINH`, `DU_TRUONG`, `HUYNH_TRUONG`, `TRO_TA`, `TRO_UY`, `TUYEN_UY` hoặc NULL |
| `tntt_branch` | `CHIEN_CON`, `AU_NHI`, `THIEU_NHI`, `NGHIA_SI`, `HIEP_SI` hoặc NULL; chỉ áp dụng cho đoàn sinh |
| `tntt_level` | 1, 2, 3 hoặc NULL; 4 là Đặc cấp, chỉ áp dụng cho Huynh trưởng |

Thông tin TNTT được lưu riêng với quyền đăng nhập và lớp chính. Cấp không tự thay đổi khi đổi lớp. API cũ không gửi các trường TNTT vẫn giữ thông tin TNTT đã lưu.
