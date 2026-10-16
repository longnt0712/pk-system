# Reset service richy-wine-service

## Ket qua doi chieu ngay 16/10/2026

Anh hien tai: Windows service Running, PID 4268; mot Java PID 4208,
bat dau 15:00:04, giu port 8085 tren 127.0.0.1.
Hai PID khac nhau co the la wrapper va Java con, khong phai bang chung hai
ban backend cung chay. Script moi kiem tra ParentProcessId de xac nhan quan he nay.

Ghi chep 08/10 xac nhan loi cu: service Stopped nhung Java PID 320 van giu port,
stop bao Access is denied, cac lan start sau bao Address already in use.
Update-Frontend.ps1 trong repository chi cap nhat frontend; can doi chieu ban
da cai tren server truoc khi ket luan co script khac dang restart backend.

## Cai ban reset moi

1. Tao thu muc `C:\ServiceReset` tren server, chep `reset-daily.bat` moi va
   `Reset-RichyService.ps1` vao do. Giu file reset cu de co the doi lai neu can.
2. Mo PowerShell Administrator va kiem tra truoc:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ServiceReset\Reset-RichyService.ps1" -CheckOnly
```

CheckOnly chi ghi log, doc trang thai service, Java va port; khong restart.
Neu co ERROR thi doc log va xu ly truoc khi bat lich. Neu Java con sot khi
service Stopped, script moi se chan start, khong tu kill Java.

3. Mo Properties cua task `daily reset richy` dang co, Actions > Edit:
   - Program/script: `C:\Windows\System32\cmd.exe`
   - Add arguments: `/d /c ""C:\ServiceReset\reset-daily.bat""`
   - Start in: `C:\ServiceReset`
   Chi thay action dang goi reset cu; khong tao task reset thu hai.
4. Trong task nay, General: chon Run whether user is logged
   on or not va Run with highest privileges. Tai khoan phai co quyen quan tri
   service va quyen ghi thu muc chua script.
5. Triggers: xem tat ca gio dang bat (truoc day task co Multiple triggers defined).
   Giu dung cac gio reset can dung; neu chi muon 07:00 thi chi giu trigger 07:00.
   Gio Java bat dau 15:00 khop voi lan task reset chay 15:00 trong anh truoc,
   nhung chua co noi dung cac trigger de xac nhan toan bo lich.
6. Settings: Do not start a new instance. Trong Conditions, bo dieu kien idle,
   AC power hoac network neu khong can cho task tren server nay.
7. Chay thu task vao luc chap nhan gian doan backend ngan. Last Run Result
   phai la 0x0; log trong `reset-logs` can co dong SUCCESS voi wrapper PID va
   Java PID moi, port 8085. Thu truy cap website sau reset de kiem tra ung dung.

## Co che bao ve

- Khoa chung giua cac lan chay script nay de tranh reset chong nhau.
- Kiem tra dung may 118-27-192-59, wrapper, JAR, service va quan he cha/con.
- Neu stop loi, het thoi gian cho, con Java cu hoac port chua trong: tra ma 1,
  ghi log va khong goi start.
- Chi start Windows service da co; khong goi java -jar va khong taskkill Java.
- Neu co nhieu backend Java, chuong trinh khac giu port hoac Java mo coi:
  dung lai de dieu tra thay vi khoi dong them mot ban backend.
- Neu co service dang chay phu thuoc richy-wine-service: chan reset tu dong
  de tranh dung keo theo service khac.
- Khoa chi bao ve cac lan chay script nay. Cac script quan tri backend khac
  cung can dung chung quy trinh neu sau nay co them tu dong deploy backend.

Script khong thay JAR, XML cau hinh, database hay task auto pull frontend.
Log kiem tra va reset duoc giu trong thu muc `reset-logs` ben canh script.
