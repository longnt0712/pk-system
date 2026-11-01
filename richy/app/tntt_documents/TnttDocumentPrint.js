(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').factory('TnttDocumentPrint', ['$window', '$q', function (window, q) {
        function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
        function markup(title, doc) {
            var width = doc.orientation === 'landscape' ? 1123 : 794, height = doc.orientation === 'landscape' ? 794 : 1123;
            var marks = (doc.strokes || []).map(function (s) {
                var points = s.points || []; points.forEach(function (p) { height = Math.max(height, p[1] + 40); });
                var common = ' stroke="' + escape(s.color) + '" stroke-width="' + Number(s.width) + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (s.tool === 'highlighter' ? '.25' : '1') + '"';
                return points.length === 1 ? '<circle cx="' + Number(points[0][0]) + '" cy="' + Number(points[0][1]) + '" r="' + Number(s.width) / 2 + '" fill="' + escape(s.color) + '"/>' : '<polyline fill="none"' + common + ' points="' + points.map(function (p) { return Number(p[0]) + ',' + Number(p[1]); }).join(' ') + '"/>';
            }).join('');
            var lines = String(doc.text || '').split('\n').reduce(function (n, line) { return n + Math.max(1, Math.ceil(line.length / (doc.orientation === 'landscape' ? 110 : 72))); }, 0);
            height = Math.max(height, lines * 28 + 100);
            return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + escape(title) + '</title><style>@page{size:A4 ' + (doc.orientation === 'landscape' ? 'landscape' : 'portrait') + ';margin:0}*{box-sizing:border-box}body{margin:0;color:#17263c;font-family:Arial,sans-serif}header{max-width:' + width + 'px;margin:auto;padding:18px 30px;background:#f3eff7;display:flex;justify-content:space-between;align-items:center;gap:20px}h1{font-size:20px;margin:0}.paper{position:relative;margin:auto;width:' + width + 'px;min-height:' + height + 'px;background:white}.text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:17px/28px Arial,sans-serif;padding:40px;position:relative;z-index:1}.ink{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}button{padding:9px 14px}@media print{header{display:none}.paper{width:100%;margin:0}.text{font-size:17px}.ink{overflow:visible}}</style></head><body><header><h1>' + escape(title) + '</h1><button type="button" onclick="window.print()">In / Lưu PDF</button></header><article class="paper"><pre class="text">' + escape(doc.text) + '</pre><svg class="ink" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">' + marks + '</svg></article></body></html>';
        }
        function create() { var popup = window.open('', '_blank'); if (!popup) { throw new Error('Cho phép mở cửa sổ in để lưu PDF.'); } popup.opener = null; return popup; }
        function render(popup, title, doc) { popup.document.open(); popup.document.write(markup(title, doc)); popup.document.close(); }
        return {markup: markup, open: function (title, doc) { render(create(), title, doc); }, openAsync: function (load) {
            var popup; try { popup = create(); } catch (error) { return q.reject(error); }
            return load().then(function (row) { if (!popup.closed) { render(popup, row.title, row.document); } }).catch(function (error) { popup.close(); throw error; });
        }};
    }]);
}());
