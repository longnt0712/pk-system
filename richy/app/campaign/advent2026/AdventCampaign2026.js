(function (window) {
    'use strict';

    var startDate = '2026-11-29';
    var endDate = '2027-01-03';
    var lastPracticeDate = '2027-01-02';
    var assetPath = 'assets/images/advent-2026/tuan-';
    var practices = [
        {
            name: 'Cầu nguyện',
            instructions: 'Dành thời gian nói chuyện với Chúa và dâng lên Chúa một lời cầu nguyện.',
            prayers: [
                illustratedPrayer('tinh-thuc', 'Tỉnh thức đón Chúa',
                    'Lạy Chúa Giê-su, xin giúp con dành một chút yên lặng mỗi ngày để nhớ đến Chúa. Xin cho con biết nhận ra Chúa đang đến trong những người con gặp.',
                    'Một bạn nhỏ chắp tay cầu nguyện bên ngọn nến Mùa Vọng.'),
                illustratedPrayer('cau-cho-viec-truyen-giao', 'Cầu cho việc truyền giáo',
                    'Lạy Chúa Hài Đồng, con dâng kinh Lạy Cha để cầu cho việc truyền giáo. Xin nâng đỡ những người mang Tin Mừng đến các miền xa và cho mọi người nhận ra Chúa yêu thương họ.',
                    'Một gia đình cùng cầu nguyện bên hang đá nhỏ và quả địa cầu.'),
                illustratedPrayer('loi-nguyen-belem', 'Tâm tình với Chúa Hài Đồng',
                    'Lạy Chúa Hài Đồng, con dâng Chúa những niềm vui và cả những điều con đang lo. Xin cho lòng con thành một mái ấm nhỏ để Chúa ở cùng con và gia đình con.',
                    'Một bạn nhỏ vẽ trái tim lên tấm thiệp đặt cạnh hang đá.')
            ]
        },
        {
            name: 'Tham dự Thánh lễ',
            instructions: 'Tham dự Thánh lễ và chăm chú lắng nghe Lời Chúa.',
            prayers: [
                illustratedPrayer('lang-nghe-loi-chua', 'Lắng nghe Lời Chúa',
                    'Lạy Chúa Giê-su, xin giúp con chăm chú lắng nghe Lời Chúa trong Thánh lễ. Xin nhắc con nhớ một điều Chúa dạy để đem ra thực hành hôm nay.',
                    'Một bạn nhỏ chăm chú lắng nghe cha đọc sách tại nhà thờ.'),
                illustratedPrayer('ta-on-trong-thanh-le', 'Tạ ơn trong Thánh lễ',
                    'Lạy Chúa Giê-su, con cảm ơn Chúa đã đến gần chúng con trong Thánh lễ. Xin cho con nhận ra những điều tốt đẹp Chúa ban và biết nói lời cảm ơn mỗi ngày.',
                    'Một bạn nhỏ và bà quỳ cầu nguyện hướng về bàn thờ.'),
                illustratedPrayer('cung-nhau-den-nha-chua', 'Cùng nhau đến nhà Chúa',
                    'Lạy Chúa Hài Đồng, con dâng lên Chúa gia đình con. Xin cho chúng con biết dành thời gian cùng đến nhà thờ, cùng lắng nghe và tạ ơn Chúa.',
                    'Một bạn nhỏ nắm tay người thân trên đường vào nhà thờ.')
            ]
        },
        {
            name: 'Hy sinh',
            instructions: 'Tự nguyện nhường nhịn hoặc từ bỏ một điều nhỏ vì yêu mến Chúa.',
            prayers: [
                illustratedPrayer('biet-nhuong-nhin', 'Biết nhường nhịn',
                    'Lạy Chúa Hài Đồng, con dâng Chúa một lần con biết nhường nhịn. Xin cho con vui khi chia sẻ điều mình thích, như góp một cọng rơm nhỏ để máng cỏ của Chúa thêm ấm.',
                    'Một bạn nhỏ nhường đồ chơi bằng gỗ cho em.'),
                illustratedPrayer('vang-loi-va-giup-do', 'Vâng lời và giúp đỡ',
                    'Lạy Chúa Giê-su, xin giúp con biết vâng lời ông bà, cha mẹ và sẵn lòng giúp một việc vừa sức. Xin cho con làm việc ấy với lòng yêu thương, ngay cả khi phải dừng cuộc chơi.',
                    'Một bạn nhỏ giúp bà gấp khăn.'),
                illustratedPrayer('tha-thu-va-lam-hoa', 'Tha thứ và làm hòa',
                    'Lạy Chúa Giê-su, có lúc con giận bạn và khó nói lời xin lỗi. Xin cho con can đảm làm hòa, biết tha thứ và bắt đầu lại với bạn.',
                    'Hai bạn nhỏ làm hòa trong sân trường.')
            ]
        },
        {
            name: 'Làm tông đồ',
            instructions: 'Chia sẻ tình yêu Chúa bằng một lời nói hoặc việc làm tốt.',
            prayers: [
                illustratedPrayer('chia-se-yeu-thuong', 'Chia sẻ yêu thương',
                    'Lạy Chúa Hài Đồng, xin mở lòng con trước những người đang thiếu thốn. Xin cho con biết chia sẻ điều mình có để người khác cảm nhận được niềm vui Giáng Sinh.',
                    'Hai bạn nhỏ mang một giỏ thức ăn tặng người hàng xóm.'),
                illustratedPrayer('song-that-tha', 'Sống thật thà',
                    'Lạy Chúa Giê-su, xin giúp con sống thật thà ở nhà và ở trường, ngay cả khi không ai nhìn thấy. Qua những việc nhỏ con làm, xin cho các bạn nhận ra tình yêu của Chúa.',
                    'Một bạn nhỏ trả lại hộp bút bị thất lạc cho bạn cùng lớp.'),
                illustratedPrayer('toa-sang-tin-mung', 'Tỏa sáng Tin Mừng',
                    'Lạy Chúa Hài Đồng, xin cho mỗi việc tốt của chúng con như một ngôi sao nhỏ soi sáng mái ấm Bêlem. Xin giúp chúng con đem niềm vui Tin Mừng đến gia đình và bạn bè.',
                    'Các bạn nhỏ treo những ngôi sao tự làm quanh hang đá Bêlem.')
            ]
        }
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

    function illustratedPrayer(slug, title, prayer, imageAlt) {
        return {title: title, prayer: prayer, image: 'assets/images/advent-2026/prayers/' + slug + '.webp', imageAlt: imageAlt};
    }

    function nameKey(name) {
        return String(name || '').normalize('NFD').toLowerCase()
            .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
    }

    function matches(campaign) {
        return !!campaign && campaign.startDate === startDate && campaign.endDate === endDate &&
            /\bmua vong\b.*\bgiang sinh\b/.test(nameKey(campaign.name));
    }

    function prayersFor(name) {
        var key = nameKey(name);
        var practice = practices.find(function (item) { return nameKey(item.name) === key; });
        return practice ? practice.prayers : practices.reduce(function (prayers, item) {
            return prayers.concat(item.prayers);
        }, []);
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
        prayersFor: prayersFor,
        draft: draft
    };
}(window));
