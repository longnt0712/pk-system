# Sổ việc Xứ đoàn

Ai có đường dẫn Sổ việc Xứ đoàn cũng có thể xem các công việc. Đăng nhập Google để mở phần Thành viên và thao tác theo quyền được cấp. Mở [Sổ việc Xứ đoàn](https://tnttphungkhoang.com/so-viec-xu-doan/index.html) hoặc dùng nút Sổ việc trong Dashboard và Tài liệu của TNTT.

## 1. Tạo project Firebase

1. Mở [Firebase Console](https://console.firebase.google.com/) và chọn **Create a project**. Đặt tên như **Sổ việc Xứ đoàn**, giữ gói **Spark**. Có thể tắt Google Analytics vì phần này không cần đến Analytics.
2. Ở trang tổng quan project, bấm biểu tượng **Web (`</>`)** hoặc vào **Project settings → Your apps → Add app → Web**. Đăng ký tên ứng dụng **Sổ việc Xứ đoàn**.
3. Chép các giá trị `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` và `appId` từ đối tượng `firebaseConfig` vào [firebase-config.js](firebase-config.js). Giữ `authDomain` theo giá trị Console cung cấp và `useEmulators = false` khi dùng Firebase thật. Tài liệu Firebase mô tả cách lấy đối tượng này. [Đăng ký ứng dụng web](https://firebase.google.com/docs/web/setup)

## 2. Bật đăng nhập Google

1. Trong project, mở **Authentication → Get started → Sign-in method → Google**. Chọn **Enable**, chọn email hỗ trợ cho project rồi bấm **Save**. [Đăng nhập bằng Google](https://firebase.google.com/docs/auth/web/google-signin)
2. Mở **Authentication → Settings → Authorized domains → Add domain**. Điền `tnttphungkhoang.com` để dùng trên website và `localhost` để thử trên máy. Nhập tên miền dạng chữ, ví dụ `localhost`. [Miền được phép đăng nhập](https://firebase.google.com/docs/auth/faq-and-troubleshooting#limit_your_authorized_authentication_domains)

## 3. Tạo Firestore và cài Rules

1. Mở **Firestore Database → Create database**. Chọn **Standard edition**, Database ID **(default)** và **Production mode**. Nếu Console cho chọn vùng, có thể dùng **asia-southeast1 (Singapore)**. Hạn mức miễn phí áp dụng cho một database đủ điều kiện trong project. [Tạo Firestore Standard](https://firebase.google.com/docs/firestore/quickstart) · [Hạn mức](https://firebase.google.com/docs/firestore/quotas)
2. Mở tab **Rules** của database vừa tạo. Chép toàn bộ nội dung [firestore.rules](firestore.rules) vào trình soạn thảo, rồi bấm **Publish**. Quy tắc này được viết cho database riêng của Sổ việc. [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
3. Mở tab **Data → Start collection**, nhập Collection ID `members`. Dùng email Google của quản trị đầu tiên làm Document ID, rồi thêm các trường dưới đây với thông tin của người đó và bấm **Save**. Nếu đã có bản ghi với cùng ID trong Firestore, cập nhật bản ghi đó.

| Trường | Kiểu | Giá trị |
|---|---|---|
| `email` | string | Email Google của quản trị, viết thường |
| `hoTen` | string | Họ tên đầy đủ của quản trị |
| `tenGoi` | string | Tên ngắn của quản trị |
| `laQuanTri` | boolean | `true` |
| `banNganh` | string | Ban điều hành |
| `vaiTro` | string | Trưởng xứ đoàn |
| `mangDieuHanh` | string | Ban điều hành |
| `dienThoai` | string | Để trống |
| `viecChinh` | string | Điều hành công việc xứ đoàn |

Document ID và trường `email` dùng cùng địa chỉ viết thường. Giữ kiểu `boolean` cho `laQuanTri` để Firestore nhận đúng vai trò. Từ lần đăng nhập sau, quản trị có thể cấp hoặc thu quyền ngay trên trang **Thành viên**. Nếu mọi tài khoản quản trị đã bị thu quyền, chủ project có thể khôi phục `laQuanTri` từ Firebase Console.

## 4. Chạy thử trên máy

Mở PowerShell tại thư mục gốc của repo, rồi chạy hai dòng sau. Node chỉ phục vụ tệp tĩnh khi thử trên máy.

```powershell
cd richy/app/so-viec-xu-doan
node tools/serve.mjs
```

Mở [Sổ việc trên máy](http://localhost:5505/) để xem danh sách công khai. Bấm **Đăng nhập bằng Google** và chọn tài khoản quản trị đã cấu hình trong Firestore để sử dụng phần nhập CSV và quản lý thành viên.

1. Trong cửa sổ ẩn danh, đăng nhập một tài khoản Google bạn dùng để thử. Nếu email chưa được cấp quyền, trang hiển thị **“Bạn chưa được cấp quyền, vui lòng liên hệ Trưởng xứ đoàn.”**
2. Từ cửa sổ quản trị, thêm email thử nghiệm với quyền thành viên. Cửa sổ ẩn danh sẽ mở danh sách thành viên khi Firestore cập nhật. Nút **Thêm thành viên** chỉ xuất hiện với quản trị.
3. Xóa quyền của email thử nghiệm trong cửa sổ quản trị. Cửa sổ ẩn danh sẽ quay lại thông báo chưa được cấp quyền.

## 5. Thêm, sửa và nhập công việc

Thành viên đã đăng nhập có thể chọn **Thêm công việc** hoặc bấm **Sửa** trên thẻ công việc. Điền các thông tin cần thiết rồi bấm **Lưu công việc**. Có thể thêm **Đến giờ** nếu đã điền **Từ giờ**. Hai mốc nằm trong cùng ngày, ví dụ 09:15–09:45. Nội dung đã lưu cập nhật trên danh sách công khai.

1. Sau khi đăng nhập bằng tài khoản quản trị, vào **Công việc → Nhập CSV công việc**.
2. Chọn file CSV UTF-8 có đủ cột **Việc**, **Ngày**, **Trạng thái**, **Ban phụ trách**, **Người phụ trách**, **Đợt** và **Ghi chú**. Sổ việc bỏ qua phần phía trên dòng tiêu đề **Việc** và các dòng trống. Ngày dùng dạng dd/mm/yyyy hoặc để trống. Có thể thêm cột **Từ giờ** (hoặc **Giờ**) và **Đến giờ** với giá trị dạng HH:mm. Chọn một trong bốn trạng thái **Chưa làm**, **Đang làm**, **Xong** hoặc **Cha đã duyệt**. Ghi nhiều người phụ trách bằng dấu phẩy trong cùng một ô.
3. Kiểm tra số việc và các dòng xem trước, rồi bấm **Nhập công việc**. Tên việc, ngày, giờ (nếu có), trạng thái, ban, người phụ trách, đợt và ghi chú sẽ hiển thị công khai. Bộ lọc giờ hiển thị các công việc có thời gian trùng một phần hoặc toàn bộ với khoảng giờ đã chọn.
4. Khi nhập lại, các việc có cùng tên, ngày, giờ bắt đầu, ban và đợt được bỏ qua. Giờ kết thúc, trạng thái, người phụ trách và ghi chú đã lưu được giữ nguyên.

Để thử thao tác nhập với dữ liệu giả lập, chạy `pnpm emulators` trong thư mục Sổ việc. Trong một cửa sổ PowerShell khác, chạy `node tools/serve.mjs --emulator`. Dùng một tài khoản Google giả lập và tạo bản ghi quản trị tương ứng trong Firestore Emulator theo mẫu ở phần 3.

## 6. Đưa tính năng nhập lên website

Sau khi duyệt triển khai, cập nhật Security Rules của project Firebase theo phần 3, rồi đẩy mã frontend lên nhánh `main`. Khi mở bản mới với tài khoản quản trị, Sổ việc tự đồng bộ các công việc đã nhập vào danh sách công khai. Mở lại link trong cửa sổ ẩn danh để kiểm tra.

## Kiểm tra Rules bằng dữ liệu giả lập

Nếu muốn chạy bộ kiểm tra quyền tự động, dùng Node từ 24.12 và Java 21. Trong thư mục Sổ việc, chạy `npm install` rồi `npm run test:rules`. Bộ kiểm tra dùng project giả lập `demo-so-viec-xu-doan`. [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore) · [Kiểm thử Security Rules](https://firebase.google.com/docs/rules/unit-tests)
