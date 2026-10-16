# Backup ecommerce luc 03:00, giu 10 ban gan nhat

Chay tren may chu SQL Server trong anh: `118-27-192-59\SQLEXPRESS`.
File su dung `.\SQLEXPRESS` vi chay ngay tren may chu do.
Chi backup database `ecommerce`.

## 1. Chep file va dien mat khau

Tao thu muc `C:\SQLBackup`, chep `Backup-Ecommerce.bat` vao do.
Mo file bang Notepad, tim dong `if not defined SQLCMDPASSWORD set "SQLCMDPASSWORD="`,
dien mat khau SQL cua `sa` sau dau `=`, truoc dau ngoac kep cuoi dong.
Khong gui mat khau qua chat va khong commit ban da dien mat khau vao Git.
Neu mat khau co ky tu `%`, viet thanh `%%` trong file BAT; ky tu `!` duoc giu nguyen.
Neu mat khau co dau ngoac kep (`"`), nen cung cap qua bien moi truong
`SQLCMDPASSWORD` cua tai khoan Windows chay task va bo dong gan mat khau trong BAT.
Gioi han quyen doc file BAT cho quan tri vien va tai khoan Windows chay task.
Mat khau duoc truyen cho sqlcmd qua bien moi truong, khong qua tham so `-P`.

Mac dinh luu backup vao `C:\SQLBackups\ecommerce`. Neu muon luu o o D,
doi `BACKUP_DIR` thanh mot thu muc tren o D co that va du dung luong.
File tu tim sqlcmd trong PATH va hai vi tri Tools\Binn cua SQL Server 2008.
Neu khong tim thay, dien duong dan day du cua `sqlcmd.exe` vao `SQLCMD_EXE`.

## 2. Kiem tra quyen ghi thu muc

Trong SQL Server Configuration Manager, vao SQL Server Services, xem cot
Log On As cua **SQL Server (SQLEXPRESS)**. Tao thu muc backup va cap quyen
Modify cho dung tai khoan dich vu nay qua Properties > Security.
Tai khoan Windows chay task cung can quyen Modify de tao log, doi ten va xoa ban cu.
Khong can cap quyen cho Everyone. Quyen Windows Administrator hoac login SQL `sa`
khong tu dong cap quyen ghi thu muc cho tai khoan dich vu SQL Server.

## 3. Chay thu truoc khi dat lich

Mo Command Prompt tren server bang tai khoan Windows se chay task:

```bat
"C:\SQLBackup\Backup-Ecommerce.bat"
echo %ERRORLEVEL%
```

Thanh cong se hien `SUCCESS`, ma thoat `0`, va tao file vi du:

```text
C:\SQLBackups\ecommerce\ecommerce_20261017_030000_123.bak
```

Log nam trong `C:\SQLBackups\ecommerce\logs`.
Neu loi, mo file log moi nhat; chua dat lich cho den khi chay thu thanh cong.

## 4. Dat lich 03:00 hang ngay

Mo **Task Scheduler** > **Create Task...**:

1. **General**: Name = `Backup ecommerce 03h`. Chon tai khoan Windows quan tri
   dang dung tren server, chon **Run whether user is logged on or not**.
   Neu tai khoan nay can chay voi quyen nang cao, chon **Run with highest privileges**.
2. **Triggers** > New: **Daily**, Start = **03:00:00 AM**, Recur every = **1 day**,
   Enabled = bat. Gio nay theo mui gio cua Windows tren server; kiem tra mui gio
   **(UTC+07:00) Bangkok, Hanoi, Jakarta** neu muon chay luc 03:00 gio Viet Nam.
3. **Actions** > New > Start a program:
   - Program/script: `C:\Windows\System32\cmd.exe`
   - Add arguments: `/d /c ""C:\SQLBackup\Backup-Ecommerce.bat""`
   - Start in: `C:\SQLBackup`
4. **Conditions**: bo dieu kien idle hoac AC power neu chung co the ngan task chay
   tren server nay.
5. **Settings**: bat **Run task as soon as possible after a scheduled start is missed**.
   If the task is already running = **Do not start a new instance**.
   Bo **Stop the task if it runs longer than** de khong cat ngang backup lon.
6. Nhan OK, nhap mat khau **tai khoan Windows** chay task, khong phai mat khau SQL `sa`.

Click phai task > **Run** de thu. Sau khi task ket thuc, Last Run Result phai la
`0x0`; dong thoi kiem tra co file `.bak` moi va log co dong `SUCCESS`.
Task van chay khi ban ngat Remote Desktop, mien la server van bat va dich vu
Task Scheduler dang hoat dong.

## 5. Cach giu 10 file

Moi lan chay tao mot **full backup COPY_ONLY** voi CHECKSUM, sau do chay
`RESTORE VERIFYONLY WITH CHECKSUM, STOP_ON_ERROR`. Khi thanh cong, file tam
`.bak.pending` duoc doi ten thanh `.bak`, roi moi xoa cac ban cu de giu 10 ban moi nhat.
Neu backup hoac kiem tra loi, script tra ma loi `1`, giu nguyen cac ban `.bak` cu
va co gang xoa file tam cua lan chay hong.

Chi cac file dung mau `ecommerce_yyyyMMdd_HHmmss_fff.bak` ngay trong BACKUP_DIR
moi duoc don dep; khong xoa file khac, khong quet thu muc con.
Chay deu moi ngay thi thuong co khoang 10 ngay; moi lan chay thu thu cong cung
duoc tinh la mot ban. Log duoc giu rieng trong thu muc `logs`.

VERIFYONLY kiem tra kha nang doc va checksum, khong thay the viec restore thu.
Nen dinh ky restore vao database thu nghiem va giu them ban sao o may/bo luu tru khac.
Full backup moi ngay cho phep khoi phuc toi lan backup thanh cong gan nhat;
muon khoi phuc den tung thoi diem can thiet ke them lich transaction log backup.

## Tai lieu Microsoft

- [Tu dong backup SQL Server Express bang sqlcmd va Task Scheduler](https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/backup-restore/schedule-automate-backup-database)
- [Quyen backup va quyen tai khoan dich vu SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/create-a-full-database-backup-sql-server)
- [Gioi han cua RESTORE VERIFYONLY](https://learn.microsoft.com/en-us/sql/t-sql/statements/restore-statements-verifyonly-transact-sql)
