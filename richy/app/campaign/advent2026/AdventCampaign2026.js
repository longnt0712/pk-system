(function (window) {
    'use strict';

    var startDate = '2026-11-29';
    var endDate = '2027-01-03';
    var lastPracticeDate = '2027-01-02';
    var assetPath = 'assets/images/advent-2026/tuan-';
    var practices = [
        {name: 'Cầu nguyện', instructions: 'Dành thời gian nói chuyện với Chúa và dâng lên Chúa một lời cầu nguyện.'},
        {name: 'Tham dự Thánh lễ', instructions: 'Tham dự Thánh lễ và chăm chú lắng nghe Lời Chúa.'},
        {name: 'Hy sinh', instructions: 'Tự nguyện nhường nhịn hoặc từ bỏ một điều nhỏ vì yêu mến Chúa.'},
        {name: 'Làm tông đồ', instructions: 'Chia sẻ tình yêu Chúa bằng một lời nói hoặc việc làm tốt.'}
    ];
    var weeks = [
        'Tỉnh thức đón Chúa',
        'Dọn lòng sẵn sàng đón Chúa',
        'Mong chờ Chúa đến',
        'Nguyện trời đổ xuống sương mai',
        'Niềm vui Giáng Sinh'
    ].map(function (title, index) {
        var asset = assetPath + (index + 1);
        return {title: title, image: asset + '.webp', pdf: asset + '.pdf'};
    });

    function nameKey(name) {
        return String(name || '').normalize('NFD').toLowerCase()
            .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
    }

    function matches(campaign) {
        return !!campaign && campaign.startDate === startDate && campaign.endDate === endDate &&
            /\bmua vong\b.*\bgiang sinh\b/.test(nameKey(campaign.name));
    }

    function sheetItems(campaign) {
        var items = campaign.flowerItems || [];
        if (items.length !== practices.length) { return null; }
        var ordered = practices.map(function (practice) {
            return items.find(function (item) { return nameKey(item.name) === nameKey(practice.name); });
        });
        return ordered.every(Boolean) ? ordered : null;
    }

    function draft() {
        return {
            name: 'Hoa Thiêng Mùa Vọng – Giáng Sinh 2026',
            theme: 'Mái ấm Bêlem – Tỏa sáng Tin Mừng',
            description: 'Cùng chuẩn bị tâm hồn đón Chúa Hài Đồng qua năm tuần sống Lời Chúa và thực hành Hoa Thiêng. Chiến dịch kết thúc vào Chủ nhật 03/01/2027.',
            startDate: startDate,
            endDate: endDate,
            flowerInstructions: 'Mỗi ngày, em tích vào các ô tương ứng với những việc đã làm. Trên phiếu giấy, em có thể viết một lời cầu nguyện với Chúa Hài Đồng.',
            flowerItems: practices.map(function (practice) {
                return {name: practice.name, instructions: practice.instructions};
            })
        };
    }

    window.AdventCampaign2026 = {
        matches: matches,
        lastPracticeDate: lastPracticeDate,
        weeks: weeks,
        sheetItems: sheetItems,
        draft: draft
    };
}(window));
