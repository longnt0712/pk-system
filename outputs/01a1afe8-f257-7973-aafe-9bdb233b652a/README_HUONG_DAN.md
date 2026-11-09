# Nhập bộ IELTS vào IELTSRoom

Gói này chứa 158 đề Reading/Listening và 548 topic từ vựng cho tài khoản **english (ID 26, quản trị)** trong database **ecommerce**, SQL Server **2008 R2**. Có 146 đề đã đủ điều kiện hiển thị và 12 đề được lưu nháp để rà soát nguồn. Một đề nguồn chưa được nhập vì trùng số câu; chi tiết ở bên dưới.

| Nội dung | Số lượng |
|---|---:|
| Đề được đưa vào SQL | 158 |
| Topic từ vựng | 548 |
| Mục từ trong mỗi topic | 184–211 |
| Liên kết từ vựng–topic | 113,862 |
| Flashcard riêng biệt dùng chung giữa các topic | 19,173 |
| File audio / audio full test | 356 / 70 |
| Hình sơ đồ, bản đồ | 33 |

1. Trong SQL Server Management Studio, kết nối máy chủ và chọn database `ecommerce`.
2. Chọn **File → Open → File**, mở `IELTSROOM_IMPORT_english.sql` trong gói ZIP đã giải nén. Kiểm tra ô database trên thanh công cụ vẫn là `ecommerce`.
3. File mặc định có `SET @CommitChanges=1;`. Nhấn **Execute** hoặc **F5** một lần để nhập.
4. Khi chạy xong, xem bảng kết quả cuối: `Committed = 1` cho biết đã ghi dữ liệu. Sau đó mở IELTSRoom bằng tài khoản `english` để xem đề và các topic.

Có thể xem thử bằng cách đổi `SET @CommitChanges=1;` thành `SET @CommitChanges=0;` rồi Execute. Chế độ này kiểm tra trong transaction và hoàn tác; kết quả cuối có `Committed = 0`. Đổi lại thành `1` và chạy để ghi thật.

Chạy lại cùng file sẽ bỏ qua các bản ghi đã nhập và các liên kết topic đã có. SQL đã được kiểm tra hai lần trên các bảng tạm tương ứng với cấu trúc SQL Server 2008 R2: lần chạy thứ hai không tạo thêm bản ghi. Báo cáo nằm trong `validation/sql-validation.json`.

Topic trùng tên và flashcard trùng nội dung được tái sử dụng. Với topic cũ chưa có ghi nguồn từ điển, SQL bổ sung phần ghi nguồn vào cuối nội dung hiện có.

Nguồn đăng hai bản có nội dung hoàn toàn giống nhau của **Vol 5 READING FULL TEST 11** (ID 2120 và 1612). Gói đã gộp vào bản 1612 và hợp nhất các topic tương ứng; chi tiết nằm trong `review/NGUON_TRUNG_LAP.json`.

Audio và hình ảnh đã được đặt ở các đường dẫn IELTSRoom ghi trong SQL. Cả 389 URL đã được kiểm tra HTTPS, kích thước và loại nội dung. Gói ZIP chứa SQL và báo cáo; các file media đang được phục vụ trên máy chủ web.

**Các trường hợp cần rà nguồn**

- **Vol 3 READING FULL TEST 2 (nguồn 1095):** nguồn có 41 câu và hai câu mang số 27. Đề này chưa được nhập. Bản dữ liệu đề và đáp án nguồn được giữ trong `review/source-1095-exam.json` và `review/source-1095-answers.json`.
- **Vol 1 LISTENING FULL TEST 10 (nguồn 1503):** link audio Part 4 ở nguồn báo 404.
- **Real Tests LISTENING FULL TEST 2 (nguồn 484):** nguồn thiếu Part 4 và chỉ có 28 câu.
- **Vol 1 READING FULL TEST 5 (nguồn 1004):** nguồn thiếu câu 40; Passage 3 được đánh số lại thành 27–39.

| Đề lưu nháp | Lý do |
|---|---|
| Vol 6 LISTENING FULL TEST 2 | Ngân hàng lựa chọn ở nguồn có nội dung trùng; đã gộp các lựa chọn giống nhau. |
| Vol 2 LISTENING FULL TEST 7 | Ngân hàng lựa chọn ở nguồn có nội dung trùng; đã gộp các lựa chọn giống nhau. Ngân hàng lựa chọn ở nguồn thiếu một số đáp án được ghi trong phần giải; đã khôi phục nội dung để rà lại. |
| Vol 1 LISTENING FULL TEST 10 | Audio Part 4 ở nguồn trả về HTTP 404; bộ đề được lưu nháp để bổ sung audio. |
| Vol 4 READING FULL TEST 3 | Ngân hàng lựa chọn ở nguồn có nội dung trùng; đã gộp các lựa chọn giống nhau. |
| Vol 3 READING FULL TEST 7 | Ngân hàng lựa chọn ở nguồn thiếu một số đáp án được ghi trong phần giải; đã khôi phục nội dung để rà lại. |
| Vol 3 READING FULL TEST 4 | Thứ tự hoặc nhãn lựa chọn ở nguồn không nhất quán; cần đối chiếu lại. |
| Vol 5 READING FULL TEST 7 | Thứ tự hoặc nhãn lựa chọn ở nguồn không nhất quán; cần đối chiếu lại. |
| Vol 5 READING FULL TEST 1 | Ngân hàng lựa chọn ở nguồn thiếu một số đáp án được ghi trong phần giải; đã khôi phục nội dung để rà lại. |
| Vol 2 READING FULL TEST 6 | Ngân hàng lựa chọn ở nguồn có nội dung trùng; đã gộp các lựa chọn giống nhau. Ngân hàng lựa chọn ở nguồn thiếu một số đáp án được ghi trong phần giải; đã khôi phục nội dung để rà lại. |
| Vol 4 LISTENING FULL TEST 9 | Ngân hàng lựa chọn ở nguồn có nội dung trùng; đã gộp các lựa chọn giống nhau. Ngân hàng lựa chọn ở nguồn thiếu một số đáp án được ghi trong phần giải; đã khôi phục nội dung để rà lại. |
| Vol 1 READING FULL TEST 5 | Passage 3 ở nguồn đánh số lại từ 1; đã chuyển thành 27–39 theo thứ tự Passage. Nguồn thiếu câu 40; bộ đề được lưu nháp. |
| Real Tests LISTENING FULL TEST 2 | Nguồn có 3 Part và 28 câu, thiếu Part 4; bộ đề được lưu nháp. |

**Điều chỉnh để khớp giao diện IELTSRoom**

- **Vol 4 LISTENING FULL TEST 8 (nguồn 1542):** đổi thứ tự số câu trong form theo vị trí hiển thị: câu 8 là ngân sách `£120,000`, câu 9 là chi nhánh `Park Square`, câu 10 là hành động `collect`. Đáp án và phần giải thích đi cùng đúng ô trống.
- **Vol 4 READING FULL TEST 6 (nguồn 2147):** đặt lại các tiêu đề của phần tóm tắt đúng trước nhóm câu tương ứng và bỏ một ô tĩnh trùng với phần cuối câu 11.
- **38 nhóm điền từ bằng danh sách:** chuyển hướng dẫn nhập chữ cái A/B/C sang kéo đúng từ/cụm từ vào ô trống để phù hợp loại câu 13 của IELTSRoom. Nội dung đáp án được giữ theo từng ô.
- Nhóm có nhiều đáp án đúng được lưu theo dạng chọn nhiều đáp án. Đáp án số/mã có khoảng trắng chấp nhận cả dạng có cách và dạng viết liền; số 0 ở đầu được giữ dưới dạng văn bản.
- Chi tiết các điều chỉnh được lưu trong `review/DIEU_CHINH_CHUAN_HOA.json`.

**Từ vựng và nguồn đối chiếu**

Từ vựng được chọn từ bài đọc/bản chép audio, câu hỏi, lựa chọn và nội dung bảng; gồm cả từ cơ bản hữu ích và cụm từ. Mỗi topic có phiên âm, nghĩa tiếng Việt và CEFR. Các flashcard giống hoàn toàn về từ, nghĩa, phiên âm và CEFR được liên kết dùng chung giữa các topic.

Các topic từ vựng của những Passage/Part hiện có vẫn được giữ, gồm cả ba Passage của đề nguồn 1095 đã được tách riêng vì lỗi số câu.

Đã thực hiện kiểm tra tự động và rà mẫu. CEFR ngoài danh sách Oxford và CEFR của một số cụm từ là ước lượng phục vụ học tập. Một số phiên âm cụm từ được ghép từ phiên âm các thành phần; giáo viên có thể tiếp tục điều chỉnh nghĩa và cách đọc theo ngữ cảnh giảng dạy. Phạm vi kiểm tra và các số liệu liên quan nằm trong `validation/vocabulary-qa.json` nếu có.

Nguồn từ điển: [Từ điển Anh–Việt thichhoc-dict](https://github.com/thichhoc-org/thichhoc-dict), CC BY-SA 4.0; nguồn gốc WordNet 3.1 (Princeton), CMUdict (CMU), Wiktionary; dữ liệu đã được chỉnh sửa. Phiên âm được đối chiếu với [ipa-dict](https://github.com/open-dict-data/ipa-dict), giấy phép MIT. CEFR tham khảo [Oxford 3000/5000](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000). Phần ghi nguồn cũng được đặt trong nội dung các topic; giấy phép kèm trong thư mục `licenses`.

SHA-256 của file SQL: `6a91ebf4b11ebb781d1a4c6e4fe2d7295d9a3d32dc2caef8f84702aab3d1c56b`.
