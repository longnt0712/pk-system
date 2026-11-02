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

## Thống kê ngành/cấp theo lớp

Vào **Danh sách học sinh → Thống kê → Theo ngành/cấp TNTT**, chọn các lớp rồi xác nhận. Mặc định chỉ tính tài khoản đang kích hoạt; có thể tích **Bao gồm tài khoản không kích hoạt** trước khi chạy báo cáo.

- Ngành/cấp cần đối chiếu lấy từ tên lớp hiện tại, ví dụ `ẤU NHI 1A (ĐCN2 CŨ)` → Ấu nhi cấp I. Phần tên cũ trong ngoặc không được dùng. Các lớp không thuộc ngành TNTT như Giáo lý viên, Huynh trưởng, Khác và Ca đoàn không tham gia đối chiếu này.
- Học sinh thuộc đội con được gộp về lớp cha. Ưu tiên lớp TNTT chính trong hồ sơ; lớp phụ không làm đổi ngành/cấp cần đối chiếu. Nếu chưa có lớp TNTT chính nhưng chỉ có một lớp TNTT trong các lớp tham gia, dùng lớp đó; nếu có nhiều lớp TNTT thì đưa vào nhóm **Cần xác định lớp TNTT chính**, không tự chọn một lớp.
- Xem tổng hợp theo ngành và từng lớp: tổng số học sinh, số đúng ngành/cấp, số cần bổ sung/kiểm tra, số thiếu thông tin, chưa đúng ngành và chưa đúng cấp. Một em có nhiều lý do vẫn chỉ tính một lần ở số cần bổ sung/kiểm tra. Các chỉ số lý do có thể trùng nhau.
- Bấm số **Cần bổ sung / kiểm tra** của ngành hoặc lớp để xem họ tên, mã học sinh, ngày sinh, thông tin hiện tại, thông tin theo lớp và lý do. **Xem tất cả** trở lại toàn bộ danh sách cần kiểm tra.
- **Xuất Excel thống kê** tải tệp `.xlsx` gồm ba trang **Theo ngành**, **Theo lớp**, **Danh sách cần bổ sung**. Tệp gồm toàn bộ phạm vi lớp và trạng thái tài khoản đã chọn, kể cả khi đang xem chi tiết một lớp. Mã học sinh được giữ dạng chữ để không mất số 0 đầu.

Báo cáo chỉ đọc dữ liệu qua API danh sách học sinh hiện có, phân trang 500 tài khoản mỗi lần và giữ phạm vi quyền của tài khoản đăng nhập. Lỗi tải sẽ ngăn xuất báo cáo chưa đủ dữ liệu. Chức năng này chỉ hiện trên giao diện TNTT và không tự sửa hồ sơ. Bản cập nhật thống kê chỉ cần cập nhật frontend, không có SQL mới hoặc yêu cầu build lại JAR.
