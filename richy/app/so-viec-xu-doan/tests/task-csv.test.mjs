import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseTaskCsv} from '../task-csv.js';

const header = 'Việc,Ngày,Trạng thái,Ban phụ trách,Người phụ trách,Đợt,Ghi chú';

test('Đọc qua phần đầu bảng và giữ đủ các ô CSV bằng tiếng Việt', async () => {
    const input = '\uFEFFSổ việc xứ đoàn,,,,,,\r\n' + header +
        '\r\n"Chuẩn bị, họp ban",5/12/2026,Đang làm,Sinh hoạt,"An, Bình",Mùa Vọng,"Dòng 1\r\nDòng ""2"""';
    const {tasks} = await parseTaskCsv(input);
    assert.deepEqual(tasks[0].task, {
        tieuDe: 'Chuẩn bị, họp ban', ngay: '2026-12-05', trangThai: 'Đang làm', ban: 'Sinh hoạt',
        nguoiPhuTrach: ['An', 'Bình'], dot: 'Mùa Vọng', ghiChu: 'Dòng 1\nDòng "2"'
    });
});

test('Giữ đúng việc chưa có ngày và dùng lại ID khi thay trạng thái hoặc ghi chú', async () => {
    const first = await parseTaskCsv(header + '\nChuẩn bị,,Chưa làm,Sinh hoạt,[chưa có tên],Mùa Vọng,');
    const later = await parseTaskCsv(header + '\nChuẩn bị,,Cha đã duyệt,Sinh hoạt,An,Mùa Vọng,Đã xong');
    assert.equal(first.tasks[0].id, later.tasks[0].id);
    assert.equal(first.tasks[0].task.ngay, '');
    assert.deepEqual(first.tasks[0].task.nguoiPhuTrach, []);
    assert.equal(later.tasks[0].task.trangThai, 'Cha đã duyệt');
});

test('Bỏ qua dòng trùng và báo số dòng nếu thông tin về cùng một việc mâu thuẫn', async () => {
    const row = '\nChuẩn bị,05/12/2026,Chưa làm,Sinh hoạt,An,Mùa Vọng,';
    const identical = await parseTaskCsv(header + row + row);
    assert.equal(identical.tasks.length, 1);
    assert.equal(identical.duplicates, 1);
    await assert.rejects(parseTaskCsv(header + row + row.replace('Chưa làm', 'Xong')), /Dòng 3.*dòng 2/);
});

test('Từ chối ngày không tồn tại và báo dòng cần sửa', async () => {
    await assert.rejects(parseTaskCsv(header + '\nChuẩn bị,31/02/2026,Xong,Sinh hoạt,An,Mùa Vọng,'), /Dòng 2.*dd\/mm\/yyyy/);
});

test('Nhập giờ tùy chọn, giữ ID của việc cũ và phân biệt các khung giờ cùng ngày', async () => {
    const row = '\nChuẩn bị,05/12/2026,Chưa làm,Sinh hoạt,An,Mùa Vọng,';
    const previous = await parseTaskCsv(header + row);
    const {tasks} = await parseTaskCsv(header + ',Giờ' + row + ',' + row + ',8:30' + row + ',18:00');
    assert.equal(tasks[0].id, previous.tasks[0].id);
    assert.equal(tasks[0].task.gio, undefined);
    assert.deepEqual(tasks.slice(1).map(({task}) => task.gio), ['08:30', '18:00']);
    assert.equal(new Set(tasks.map(({id}) => id)).size, 3);
    await assert.rejects(parseTaskCsv(header + ',Giờ' + row + ',24:00'), /Dòng 2.*HH:mm/);
});
