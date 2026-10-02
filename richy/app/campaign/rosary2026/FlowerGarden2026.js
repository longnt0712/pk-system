(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FlowerGarden2026 = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
    'use strict';
    var palette = [
        {name: 'Hồng', color: '#F48FB1'}, {name: 'Đỏ', color: '#EF5350'},
        {name: 'Cam', color: '#FFB74D'}, {name: 'Vàng', color: '#FFE082'},
        {name: 'Tím', color: '#B39DDB'}, {name: 'Xanh dương', color: '#81D4FA'}, {name: 'Xanh ngọc', color: '#80CBC4'}
    ];
    function enabled(campaign) {
        var name = String(campaign && campaign.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return name === 'cung me em yeu men chua' && campaign.startDate === '2026-10-01' && campaign.endDate === '2026-10-31';
    }
    function point(radius, angle) {
        return (radius * Math.cos(angle)).toFixed(2) + ' ' + (radius * Math.sin(angle)).toFixed(2);
    }
    function petalPath(index, count) {
        var center = -Math.PI / 2 + index * 2 * Math.PI / count, half = Math.min(Math.PI * .46, Math.PI / count * .94);
        var a = center - half, b = center + half;
        return 'M ' + point(17, a) + ' C ' + point(58, a) + ', ' + point(82, center - half * .45) + ', ' + point(70, center) +
            ' C ' + point(82, center + half * .45) + ', ' + point(58, b) + ', ' + point(17, b) + ' A 17 17 0 0 0 ' + point(17, a) + ' Z';
    }
    function build(campaign, entries, today) {
        var items = campaign.flowerItems || [], byDate = {}, earnedTotal = 0, usedTotal = 0;
        (entries || []).forEach(function (entry) { (byDate[entry.date] || (byDate[entry.date] = {}))[entry.itemKey] = entry; });
        var flowers = [];
        for (var day = 1; day <= 31; day++) {
            var date = '2026-10-' + ('0' + day).slice(-2), values = byDate[date] || {}, earned = 0, used = 0;
            var petals = items.map(function (item, index) {
                var entry = values[item.itemKey] || {}, color = palette.some(function (p) { return p.color === entry.paintColor; }) ? entry.paintColor : null;
                if (entry.completed === true) { earned++; }
                if (color) { used++; }
                return {key: item.itemKey, name: item.name, number: index + 1, path: petalPath(index, items.length), color: color || '#FFFFFF'};
            });
            var row = Math.floor((day - 1) / 5), col = (day - 1) % 5;
            if (day >= 26) { row = 5; col = day - 26; }
            var columns = row === 5 ? 6 : 5, x = 82 + col * (776 / (columns - 1)), y = 775 + row * 148;
            flowers.push({date: date, day: day, petals: petals, earned: earned, used: used, available: Math.max(0, earned - used),
                future: date > today, left: (x / 940 * 100) + '%', top: (y / 1672 * 100) + '%'});
            earnedTotal += earned; usedTotal += used;
        }
        return {flowers: flowers, earned: earnedTotal, used: usedTotal, available: Math.max(0, earnedTotal - usedTotal)};
    }
    return {enabled: enabled, palette: palette, build: build, petalPath: petalPath};
}));
