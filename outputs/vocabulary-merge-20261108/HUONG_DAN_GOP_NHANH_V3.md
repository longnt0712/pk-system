# Gộp nhanh từ trùng của tài khoản english — V3

File chạy: **GOP_NHANH_ENGLISH_20261108_V3.sql**. Mở bằng SSMS, chọn database **ecommerce**, chạy **toàn bộ file**.

## Phạm vi

- Chỉ gộp thẻ từ thuộc tài khoản `english`, cùng từ/cụm từ tiếng Anh và có nghĩa đã đối chiếu là giống hoặc gần nhau.
- Giữ một định nghĩa có sẵn đã chọn, không tự nối nghĩa bằng dấu `/`. Các nhóm chưa rõ nghĩa để lại để duyệt riêng.
- Theo XML ngày 08/11/2026: kế hoạch gồm **4.586 cụm**, tương ứng tối đa **5.741 bản phụ**. Có thêm **587 cụm được đối chiếu bổ sung**, gộp được thêm **748 bản phụ** so với kế hoạch cũ. Đây là số liệu của XML, không phải số còn lại trên server sau khi bạn đã gộp thủ công.
- ID đã xóa hoặc đã gộp được bỏ qua. Nếu một thẻ còn tồn tại đã đổi từ/nghĩa ngoài các định nghĩa được đối chiếu, cả cụm đó được bỏ qua để giữ phần bạn đã sửa tay. Không tự đưa các thẻ mới ngoài XML vào kế hoạch.

## Cách chạy

1. Để `DECLARE @Apply bit = 0;` rồi Execute/F5 để xem trước. Xem `eligible_groups_remaining_before_this_run` là số cụm hiện còn đủ điều kiện; `merge_groups` và `redundant_cards` là số sẽ xử lý trong lượt này. Bảng bỏ qua có lý do riêng.
2. Đổi thành `DECLARE @Apply bit = 1;`, chạy toàn bộ file để gộp. Mặc định tối đa **1.000 cụm mỗi lượt**; SSMS chỉ hiện tối đa 200 dòng mẫu để giảm tải hiển thị.
3. Đợi truy vấn báo hoàn tất. Chạy lại toàn bộ file để xử lý lượt tiếp theo; nhóm đã gộp không bị gộp lại. Khi số cụm đủ điều kiện bằng 0 thì kế hoạch này đã xử lý xong phần có thể gộp. Nhóm bị bỏ qua cần đối chiếu riêng, không tự đổi chốt kiểm tra để ép gộp.

`@MaxGroups` có thể đổi từ 1 đến 10.000; mặc định 1.000 giúp chia nhỏ mỗi transaction. Không cần sửa `@MergeTestReferences = 1`: đây là lựa chọn đã chốt, cho chuyển tham chiếu thẻ từ trong bài giao/kết quả về bản chính.

## Dữ liệu được giữ

- Gom toàn bộ topic và category của các thẻ đã chọn vào bản chính; liên kết trùng chỉ giữ một.
- Giữ phiên âm, CEFR, mô tả và trạng thái của bản chính; cộng các bộ đếm lượt luyện của những thẻ được gộp.
- Giữ ID câu trả lời và lịch sử kết quả. Khi chuyển tham chiếu thẻ từ trong bài giao/kết quả, giữ ID task/result và các trường tiến độ/trạng thái.
- Mỗi lượt có thay đổi tạo 7 bảng sao lưu trong cùng database, tiền tố `vocab_merge_english_...`. Kết quả cuối truy vấn hiển thị tiền tố tương ứng. Nếu lỗi giữa lượt, transaction hoàn tác toàn bộ thay đổi của lượt đó.

Không cần cập nhật frontend, JAR hay chạy migration schema cho bản SQL này. Chưa chạy gộp trên server thật; bản kiểm tra dùng database cục bộ riêng, tự xóa sau khi thử.

## Đã kiểm tra

- Chạy với toàn bộ 23.197 thẻ của XML trên database thử riêng ở compatibility level 100: xem trước không ghi dữ liệu; gộp 4.586 cụm / 5.741 bản phụ; kiểm tra định nghĩa, liên kết topic và ID lịch sử; chạy lại không thay đổi thêm.
- Kiểm tra riêng: cụm đã sửa tay, thiếu ID sau khi gộp dở, mất bản chính cũ, khác chủ sở hữu, thẻ mới ngoài XML, giới hạn số cụm mỗi lượt, tràn bộ đếm và lỗi khóa ngoại. Lỗi giữa transaction hoàn tác các thay đổi của lượt đó.
- Kiểm tra cục bộ không xác định thời gian chạy thực tế trên server đang phục vụ học sinh.
