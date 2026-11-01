# Chương trình đào tạo Main

1. Chạy `education-program-main.sql` trên đúng database SQL Server của hệ thống, trước khi thay JAR backend. Script thêm cột nullable `is_main` và unique filtered index để chỉ một chương trình được đánh dấu Main; có thể chạy lại và không tự chọn hoặc xóa dữ liệu cũ.
2. Cập nhật backend JAR và frontend rồi khởi động lại dịch vụ backend bằng quy trình đang dùng.
3. Vào `/education_programs`, tích cột **Main** ở chương trình muốn dùng. Admin và Quản lý đào tạo được đổi Main; Quản lý học sinh chỉ xem.

Danh sách sắp theo ngày tạo giảm dần, dùng ID giảm dần khi trùng ngày tạo. Chọn Main mới sẽ bỏ cờ ở chương trình Main trước trong cùng giao dịch; việc mở hoặc lưu tên/mã trên form cũ không tự đổi lựa chọn Main.

Khi mở `/student_marks` và `/marks`, ô chương trình tự chọn Main. Người dùng vẫn có thể chọn chương trình khác để làm việc. Khi chưa có Main, `/student_marks` dùng chương trình đầu danh sách như trước; `/marks` giữ lựa chọn trống như trước.
