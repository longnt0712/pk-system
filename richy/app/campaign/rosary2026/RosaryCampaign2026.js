/* Chiến dịch Mân Côi 2026: static artwork, prayers and class schedule; no persistence. */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.RosaryCampaign2026 = factory(); }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';
    var name = 'Chiến dịch Mân Côi 2026';
    var startDate = '2026-10-02', endDate = '2026-10-31';
    var sourceUrl = 'https://www.tonggiaophanhanoi.org/phan-thu-ba-ngam-cac-phep-lan-hat/';
    var mysteries = {
    "vui": {
        "title": "Năm sự Vui",
        "items": [
            [
                "Thiên thần truyền tin cho Đức Bà chịu thai.",
                "Ta hãy xin cho được ở khiêm nhường."
            ],
            [
                "Đức Bà đi viếng bà thánh Isave.",
                "Ta hãy xin cho được lòng yêu người."
            ],
            [
                "Đức Bà sinh Đức Chúa Giêsu nơi hang đá.",
                "Ta hãy xin cho được lòng khó khăn."
            ],
            [
                "Đức Bà dâng Đức Chúa Giêsu trong đền thánh.",
                "Ta hãy xin cho được vâng lời chịu lụy."
            ],
            [
                "Đức Bà tìm được Đức Chúa Giêsu trong đền thánh.",
                "Ta hãy xin cho được giữ nghĩa cùng Chúa luôn."
            ]
        ]
    },
    "sang": {
        "title": "Năm sự Sáng",
        "items": [
            [
                "Đức Chúa Giêsu chịu phép Rửa tại sông Gio-đan.",
                "Ta hãy xin cho được sống xứng đáng là con Thiên Chúa."
            ],
            [
                "Đức Chúa Giêsu làm phép lạ tại tiệc cưới Cana.",
                "Ta hãy xin cho được noi gương Đức Mẹ mà vững tin vào Chúa."
            ],
            [
                "Đức Chúa Giêsu rao giảng Nước Trời và kêu gọi sám hối.",
                "Ta hãy xin cho được tin vào lòng Chúa thương xót và siêng năng lãnh nhận Bí tích Giao hòa."
            ],
            [
                "Đức Chúa Giêsu biến hình trên núi.",
                "Ta hãy xin cho được biến đổi nhờ Chúa Thánh Thần."
            ],
            [
                "Đức Chúa Giêsu lập Bí tích Thánh Thể.",
                "Ta hãy xin cho được siêng năng tham dự Thánh lễ và rước Mình Máu Thánh Người."
            ]
        ]
    },
    "thuong": {
        "title": "Năm sự Thương",
        "items": [
            [
                "Đức Chúa Giêsu lo buồn đổ mồ hôi máu.",
                "Ta hãy xin cho được ăn năn tội nên."
            ],
            [
                "Đức Chúa Giêsu chịu đánh đòn.",
                "Ta hãy xin cho được hãm mình chịu khó bằng lòng."
            ],
            [
                "Đức Chúa Giêsu chịu đội mão gai.",
                "Ta hãy xin cho được chịu mọi sự sỉ nhục bằng lòng."
            ],
            [
                "Đức Chúa Giêsu vác Thánh giá.",
                "Ta hãy xin cho được vác Thánh giá theo chân Chúa."
            ],
            [
                "Đức Chúa Giêsu chịu chết trên cây Thánh giá.",
                "Ta hãy xin đóng đanh tính xác thịt vào Thánh giá Chúa."
            ]
        ]
    },
    "mung": {
        "title": "Năm sự Mừng",
        "items": [
            [
                "Đức Chúa Giêsu sống lại.",
                "Ta hãy xin cho được sống lại thật về phần linh hồn."
            ],
            [
                "Đức Chúa Giêsu lên trời.",
                "Ta hãy xin cho được ái mộ những sự trên trời."
            ],
            [
                "Đức Chúa Thánh Thần hiện xuống.",
                "Ta hãy xin cho được lòng đầy rẫy mọi ơn Đức Chúa Thánh Thần."
            ],
            [
                "Đức Chúa Trời cho Đức Bà lên trời.",
                "Ta hãy xin ơn chết lành trong tay Đức Mẹ."
            ],
            [
                "Đức Chúa Trời thưởng Đức Mẹ trên trời.",
                "Ta hãy xin Đức Mẹ phù hộ cho ta được thưởng cùng Đức Mẹ trên nước thiên đàng."
            ]
        ]
    }
};
    var groups = ['vui', 'mung', 'sang', 'thuong'];
    var ordinals = ['nhất', 'hai', 'ba', 'bốn', 'năm'];
    function normalize(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function appliesTo(campaign, today) {
        return !!campaign && normalize(campaign.name) === 'cung me em yeu men chua' &&
            /^2026-10-/.test(campaign.startDate || '') && today >= startDate && today <= endDate &&
            today >= campaign.startDate && today <= campaign.endDate;
    }
    function classGroup(student) {
        var matches = [];
        (student && student.classes || []).forEach(function (className) {
            var value = normalize(className), key;
            if (/^chien(?: |$)/.test(value)) { key = 'vui'; }
            else if (/^au(?: |$)/.test(value)) { key = 'mung'; }
            else if (/^thieu(?: |$)/.test(value)) { key = 'sang'; }
            else if (/^nghia(?: |$)/.test(value)) { key = 'thuong'; }
            if (key && matches.indexOf(key) < 0) { matches.push(key); }
        });
        return matches.length === 1 ? matches[0] : null;
    }
    function select(student, today, random, previous) {
        if (today < startDate || today > endDate) { return null; }
        var group = classGroup(student), randomizable = !group, index;
        if (group) {
            index = Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000) % 5;
        } else {
            var options = [];
            groups.forEach(function (key) { for (var i = 0; i < 5; i++) {
                if (!previous || previous.group !== key || previous.number !== i + 1) { options.push({group: key, index: i}); }
            }});
            var choice = options[Math.min(options.length - 1, Math.max(0, Math.floor((random || Math.random)() * options.length)))];
            group = choice.group; index = choice.index;
        }
        var item = mysteries[group].items[index], number = index + 1;
        return {campaignName: name, date: today, group: group, title: mysteries[group].title, number: number,
            contemplation: 'Thứ ' + ordinals[index] + ' thì ngắm: ' + item[0], prayer: item[1],
            imageUrl: 'assets/images/rosary-2026/' + group + '-' + number + (group === 'sang' && number === 4 ? '.png' : '.jpg'),
            imageAlt: mysteries[group].title + ' — ' + item[0], randomizable: randomizable};
    }
    return {name: name, startDate: startDate, endDate: endDate, sourceUrl: sourceUrl, mysteries: mysteries,
        appliesTo: appliesTo, classGroup: classGroup, select: select};
});
