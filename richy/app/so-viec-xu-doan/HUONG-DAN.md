# Sổ việc Xứ đoàn · Phần 1

Phần này gồm đăng nhập Google, cấp quyền theo email và quản lý danh sách thành viên. Địa chỉ dự kiến trên website là `https://tnttphungkhoang.com/so-viec-xu-doan/index.html`. Trang có thẻ `noindex` và được mở bằng đường dẫn riêng.

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

Mở [Sổ việc trên máy](http://localhost:5505/), bấm **Đăng nhập bằng Google** và chọn tài khoản quản trị đã cấu hình trong Firestore. Trang sẽ hiện tên ngắn của quản trị, vai trò **Quản trị** và nút **Thêm thành viên**.

1. Trong cửa sổ ẩn danh, đăng nhập một tài khoản Google bạn dùng để thử. Nếu email chưa được cấp quyền, trang hiển thị **“Bạn chưa được cấp quyền, vui lòng liên hệ Trưởng xứ đoàn.”**
2. Từ cửa sổ quản trị, thêm email thử nghiệm với quyền thành viên. Cửa sổ ẩn danh sẽ mở danh sách thành viên khi Firestore cập nhật. Nút **Thêm thành viên** chỉ xuất hiện với quản trị.
3. Xóa quyền của email thử nghiệm trong cửa sổ quản trị. Cửa sổ ẩn danh sẽ quay lại thông báo chưa được cấp quyền.

Sau khi chạy thử phần này, bước tiếp theo là nhập `data/viec-can-lam.csv` và `data/nhan-su.csv`. Đưa trang lên website theo bước triển khai đã được bạn duyệt.

## Kiểm tra Rules bằng dữ liệu giả lập

Nếu muốn chạy bộ kiểm tra quyền tự động, dùng Node từ 24.12 và Java 21. Trong thư mục Sổ việc, chạy `npm install` rồi `npm run test:rules`. Bộ kiểm tra dùng project giả lập `demo-so-viec-xu-doan`. [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore) · [Kiểm thử Security Rules](https://firebase.google.com/docs/rules/unit-tests)
