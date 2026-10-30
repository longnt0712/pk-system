# Bộ Speaking dùng chung và câu trả lời riêng của học sinh

## Triển khai

Phần này có thay đổi backend. Chạy toàn bộ `speaking-student-answers.sql` trong đúng database ứng dụng **trước khi thay JAR**, rồi cập nhật frontend cùng phiên bản trên `main`. Script dùng cú pháp SQL Server 2008 R2 trở lên và có thể chạy lại. Nó chỉ bổ sung nơi lưu câu trả lời, không thay đổi các câu hỏi, sample, dấu Pass, lượt luyện hay bản ghi âm hiện có. Các bảng Speaking từ `speaking-studio.sql` vẫn là điều kiện tiên quyết.

Bản lịch sử phiên bản và sổ ghi chú chung cần chạy thêm **`speaking-answer-history.sql` trước khi thay JAR**, kể cả khi đã chạy hai script Speaking trước đó. Script bổ sung cột sổ ghi chú vào câu trả lời hiện có và bảng lưu phiên bản, dùng cú pháp SQL Server 2008 R2, có thể chạy lại. Cập nhật frontend cùng bản backend. Bản cũ chỉ có giới hạn import/chọn lớp không cần script mới; bản có lịch sử và sổ chung cần script này.

Bổ sung nút import bài của bản thân và quyền giáo viên tự import cần cập nhật JAR cùng frontend, không thay schema. Nếu đã chạy script lịch sử ở bản trước thì đợt bổ sung import bản thân không cần SQL mới.

## Hai lối vào Speaking

**Speaking Studio** trên Dashboard và trong Test Room mở `/speaking`. Đây là không gian cá nhân cho mọi tài khoản, kể cả giáo viên và admin: chọn bộ, xem/sửa câu trả lời của chính mình, xem dấu Pass và luyện tập. Không có công cụ import, tạo bộ hay chọn học sinh ở màn hình này. Lịch sử luyện tập ở Studio luôn là của tài khoản đang đăng nhập.

**Tạo test Speaking** mở `/create_speaking_test` và tập trung công cụ quản lý bộ đề, import, chọn lớp và View bài của từng học sinh. Admin và giáo viên được import câu trả lời của chính mình. Giáo viên chủ nhiệm được import cho học sinh thuộc lớp mình; admin giữ phạm vi quản lý hiện có. Import câu hỏi/sample chung vẫn chỉ dành cho admin. Chuyển về Studio luôn trở lại câu trả lời của chính tài khoản, không mang lựa chọn học sinh từ màn hình quản lý sang.

## Bộ dùng chung

Bộ có chủ sở hữu hiện giữ quyền admin được tự động mở cho mọi tài khoản đã đăng nhập. Quy tắc này áp dụng cả bộ đã tạo từ trước, không tạo bản sao hay thay mã câu. Nút Chia sẻ không còn cần thiết với bộ này. Import câu hỏi và sample chỉ dành cho admin, đồng thời vẫn kiểm tra quyền quản lý bộ đề. Tài khoản giáo viên thường vẫn có thể xem kho riêng theo cơ chế chia sẻ cũ.

Giáo viên được xem câu trả lời và xác nhận Pass cho học sinh thuộc lớp mình phụ trách, kể cả lớp con. Quyền đọc bộ đề chung không tự mở quyền đọc bài luyện và bản ghi âm riêng của người khác. Học sinh được sửa câu trả lời của chính mình, không tự xác nhận Pass hoặc sửa bài của bạn khác.

## Import và sửa câu trả lời

Để admin hoặc giáo viên nhập bài của chính mình, mở **Tạo test Speaking**, chọn bộ rồi bấm **Import bài của tôi**. Tải mẫu ở hộp thoại này, điền cột câu trả lời, đọc đối chiếu và chọn các dòng muốn lưu. Không cần gán tài khoản vào lớp; thông tin trong mẫu và đích lưu luôn là tài khoản đang đăng nhập. Sau khi nhập, mở **Bài Speaking của tôi** để xem trong Studio. Thao tác này không phụ thuộc học sinh đang được View ở danh sách lớp.

API import bản thân lấy người nhận từ tài khoản đăng nhập và kiểm tra quyền giáo viên/admin. Không thể đổi ID trong file hoặc payload để biến thao tác này thành nhập bài cho người khác. Học sinh thường không được dùng công cụ import bản thân.

Import cho lớp của giáo viên dùng API riêng, kiểm tra **Giáo viên chủ nhiệm** (`primaryTeacherId`) đang gán tại lớp. Học sinh phải đang hoạt động và có lớp chính hoặc lớp bổ sung khớp một lớp `schoolId = 1` mà người thao tác là chủ nhiệm; cả giáo viên lẫn học sinh cần được đọc bộ Speaking. Không suy quyền chỉ từ vai trò giáo viên hoặc quyền sở hữu bộ đề. Lớp con chỉ nằm trong phạm vi import khi cũng gán cùng giáo viên chủ nhiệm; không tự lấy quyền từ lớp cha. Tải mẫu, xem trước và xác nhận đều kiểm tra lại quyền hiện tại, nên thay người chủ nhiệm sau khi đọc file cũng không cho phép lưu bằng quyền cũ.

1. Admin hoặc giáo viên chủ nhiệm mở **Tạo test Speaking**, chọn bộ đề rồi chọn lớp bằng cây lớp/đội trong danh sách học sinh. Cây import của giáo viên chỉ hiện lớp mình chủ nhiệm; admin giữ danh sách lớp IELTSRoom. Cây chỉ hiển thị các lớp có `schoolId = 1`, có thể mở/thu gọn nhánh và tìm theo tên hoặc mã. Có thể tìm tên/tài khoản và chuyển trang học sinh trong đúng phạm vi lớp đã chọn.
2. Bấm **Import** ở dòng của học sinh cần nhập. Tải mẫu của đúng em đó, điền hoặc dán câu trả lời vào cột tương ứng, giữ các mã và thông tin nhận dạng.
3. Import file để xem trước. Kiểm tra các dòng mới, có thay đổi, giữ nguyên hoặc lỗi. Chỉ chọn những dòng muốn lưu; dòng lỗi không được nhập. Dòng không có trong file không bị xóa. Backend kiểm tra quyền admin hoặc đúng giáo viên chủ nhiệm trên cả tải mẫu, xem trước và xác nhận import cho học sinh; đổi ID hoặc nội dung file không mở quyền nhập ngoài lớp.
4. Việc thay thế một câu trả lời đã có chỉ áp dụng cho các dòng được chọn, kèm ghi chú gắn trong câu trả lời đó. Không tác động sample dùng chung hoặc câu trả lời của học sinh khác.
5. Mở câu trả lời để sửa nội dung, chữ đậm, nghiêng hoặc gạch chân. Bôi chọn đoạn chữ để thêm note hoặc highlight; bấm vào đoạn có note để mở/đóng, bấm ra ngoài để đóng note.

Bấm **View** ở từng học sinh để xem đúng bài của em đó. Khi có câu trả lời đã lưu, giao diện mở một câu trả lời để xem ngay; nếu chưa có, giao diện báo rõ. Đổi lớp hoặc bộ sẽ bỏ lựa chọn học sinh đang xem, giữ nháp editor theo tài khoản/học sinh/câu và không nhận kết quả tải trễ từ lớp trước. Với kho riêng chưa chia sẻ cho học sinh, thao tác Import/View bị chặn thay vì tự thay quyền chia sẻ.

Backend cũng kiểm tra `schoolId = 1` khi mở danh sách học sinh; không thể chọn lớp trường khác bằng cách gọi API trực tiếp. Nhánh con thuộc trường khác hoặc thiếu `schoolId` không được nhập vào kết quả của lớp IELTSRoom. Lớp IELTSRoom có cha không nằm trong danh sách hợp lệ vẫn có thể xuất hiện như một gốc độc lập trên cây. Thay đổi bộ chọn cây/phạm vi trường cần cập nhật backend và frontend, không cần thêm SQL.

Học sinh sửa câu trả lời của mình; giáo viên sửa/xác nhận Pass cho học sinh trong phạm vi phụ trách. Quyền import cho lớp được giới hạn theo chủ nhiệm và học sinh hợp lệ, không mở quyền nhập hoặc xem bài của người khác ngoài phạm vi. Các bộ riêng vẫn yêu cầu cả hai bên được truy cập bộ đó.

Câu trả lời và note được lưu theo học sinh và mã câu hỏi. Sample chung được lưu riêng. Khi cách hỏi được import thành biến thể mới, câu hỏi mới có vùng trả lời riêng, không ghi đè câu trả lời của câu cũ.

## Tự lưu, phiên bản và cập nhật khi cùng xem

Chữ, định dạng, highlight và ghi chú gắn vào chữ tự đồng bộ sau khi sửa; không phải chờ tới mốc lịch sử. Giao diện hiển thị trạng thái đồng bộ và chỉ đưa ra thao tác thử lại khi cần. **Xóa ghi chú** trong ô note gỡ nội dung note và liên kết note, giữ nguyên chữ, định dạng và highlight còn lại.

Lịch sử của từng câu trả lời giữ tối đa **5 mốc trong 14 ngày gần nhất**. Các lần sửa tương tác liên tiếp của cùng một người được gộp trong cửa sổ 10 phút tính từ lúc bắt đầu mốc, không kéo dài cửa sổ mỗi lần gõ. Đổi người sửa, import hoặc khôi phục tạo mốc riêng. Mốc lưu cả câu trả lời, note/highlight và tài liệu sổ A4. Khi cập nhật câu trả lời đã có từ bản cũ, hệ thống giữ bản hiện tại làm mốc đầu; không thể tạo lại những bản trước đây chưa từng được lưu lịch sử.

Mốc quá 14 ngày không xuất hiện/khôi phục được; tác vụ nền quét mỗi giờ để xóa vật lý các mốc hết hạn kể cả bài lâu không mở. Lúc lưu cũng dọn các mốc hết hạn và giới hạn số lượng. Mốc thứ 6 sẽ loại mốc cũ nhất kể cả khi tất cả mới được tạo trong cùng một ngày; 14 ngày là tuổi tối đa, không phải cam kết luôn có lịch sử đủ hai tuần. Bài hiện tại, sample, dấu Pass và kết quả không bị tác vụ dọn lịch sử xóa.

Người có quyền sửa có thể xem lịch sử và khôi phục bản đã xem. Khôi phục nội dung khác bản hiện tại sẽ tạo mốc mới, không xóa các mốc cũ ngoài giới hạn lưu trữ. Giao diện và backend kiểm tra phiên bản hiện tại lẫn phiên bản bản xem trước để không khôi phục đè lên thay đổi chưa được đối chiếu.

Khi hai bên đang mở cùng câu trả lời, giao diện kiểm tra cập nhật khoảng mỗi 3 giây khi trang đang hiện. Nếu không có thay đổi cục bộ, chữ và ghi chú mới tự hiện. Nếu đang gõ, viết bút hoặc còn bản nháp chưa đồng bộ, bản trên máy được giữ và thay đổi đồng thời được đưa ra để đối chiếu. Đây không phải cơ chế tự trộn hai người đang gõ cùng một đoạn.

## Sổ ghi chú riêng theo học sinh và câu hỏi

Nút **Xem ghi chú** cạnh **Câu trả lời riêng** có ở cả **Part 1, Part 2 và Part 3**, mở sổ A4 có gõ chữ, bút/vẽ, highlight, tẩy, kiểu giấy, hướng giấy và zoom như trong màn hình học test. Mỗi câu có sổ riêng theo học sinh. Sổ tự lưu và dùng chung giữa học sinh đó với giáo viên/admin có quyền xem bài của em. Quyền truy cập vẫn kiểm tra theo bộ đề, học sinh và câu hỏi; không dùng kho bản nháp cá nhân của test để chia sẻ sổ.

Sửa sổ giữ nguyên phần trả lời và note trên chữ; sửa/import phần trả lời giữ nguyên sổ. Nháp trên thiết bị tách theo tài khoản đang thao tác, học sinh, bộ và câu để tránh lẫn giữa các em khi chuyển View.

## Tên và tài khoản đang hoạt động

Danh sách Speaking dùng họ và tên hiện tại (`lastName` + `firstName`) như danh sách học sinh, thay vì cột `displayName` cũ có thể còn tên của người từng dùng tài khoản. Tìm kiếm và sắp xếp dùng cùng tên hiện tại; thiếu tên thì hiện username. Không đổi ID tài khoản, câu trả lời hay lịch sử.

Danh sách học sinh theo lớp luôn lọc `active = true`. Các lựa chọn học sinh/chia sẻ cũng bỏ tài khoản không hoạt động, kể cả khi tài khoản xuất hiện trong danh sách chia sẻ cũ hoặc tìm trực tiếp theo username.

Chỉ báo lưu thành công khi backend xác nhận đúng bộ, học sinh, câu hỏi và phiên bản. Nếu giáo viên và học sinh cùng sửa một bản cũ, hệ thống báo xung đột và giữ nội dung đang sửa để đối chiếu; không tự ghi đè bản mới của người kia. Bản nháp trên trình duyệt là phương án khôi phục khi chưa đồng bộ, không phải xác nhận đã lưu lên server.

Kiểm tra bằng code và database H2 cô lập; không dùng Chrome và không truy cập dữ liệu production. Script SQL cần được chạy và kiểm tra trên database triển khai thực tế.

Để đo dung lượng thực tế thay vì dự đoán theo số chữ/nét bút, có thể chạy `speaking-storage-report.sql` trong database ứng dụng. Đây là báo cáo chỉ đọc, trả số lượng và kích thước tổng hợp, không trả tên học sinh hoặc nội dung câu trả lời. Con số nội dung không bao gồm index, phần phụ của database và backup/log.
