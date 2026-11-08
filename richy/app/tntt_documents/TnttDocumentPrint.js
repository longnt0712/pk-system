(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').factory('TnttDocumentPrint', ['$window', '$q', function (window, q) {
        function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
        function validLink(value) {
            return typeof value === 'string' && value.length <= 2048 && /^https?:\/\/(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[a-f0-9:]+\])(?::[0-9]{1,5})?(?:[/?#][^\s<>"'\\\u0000-\u001f\u007f]*)?$/i.test(value);
        }
        function linkMarkup(text, url) { return '<a href="' + escape(url) + '" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:underline">' + escape(text) + '</a>'; }
        function linkedText(text, destination) {
            if (validLink(destination)) { return linkMarkup(text, destination); }
            var pattern = /(^|[\s([{])((?:https?:\/\/|www\.)[^\s<>"'\\]+|(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,24}(?::[0-9]{1,5})?(?:[/?#][^\s<>"'\\]*)?)/gi;
            var html = '', end = 0, match;
            while ((match = pattern.exec(text))) {
                var label = match[2].replace(/[.,;:!?]+$/, '');
                [['(', ')'], ['[', ']'], ['{', '}']].forEach(function (pair) {
                    while (label.endsWith(pair[1]) && label.split(pair[1]).length > label.split(pair[0]).length) { label = label.slice(0, -1); }
                });
                var start = match.index + match[1].length, url = /^https?:\/\//i.test(label) ? label : 'https://' + label;
                if (validLink(url)) { html += escape(text.slice(end, start)) + linkMarkup(label, url); end = start + label.length; }
            }
            return html + escape(text.slice(end));
        }
        function formattedText(doc) {
            var lines = [], inline = '', html = '', row = null;
            var ops = doc.textDelta && Array.isArray(doc.textDelta.ops) ? doc.textDelta.ops : [{insert: String(doc.text || '') + '\n'}];
            ops.forEach(function (op) {
                var attrs = op.attributes || {};
                if (op.insert && typeof op.insert === 'object') {
                    if (op.insert.softbreak === true) { inline += '<br>'; return; }
                    if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(op.insert.image || '')) {
                        inline += '<img src="' + escape(op.insert.image) + '" width="' + Math.min(714, Number(attrs.width) || 600) + '" alt="Ảnh trong tài liệu">';
                    }
                    return;
                }
                String(op.insert || '').split('\n').forEach(function (part, index) {
                    if (index) { lines.push({html: inline || '<br>', attrs: attrs}); inline = ''; }
                    var text = linkedText(part, attrs.link);
                    if (attrs.bold) { text = '<strong>' + text + '</strong>'; }
                    if (attrs.italic) { text = '<em>' + text + '</em>'; }
                    if (attrs.underline) { text = '<u>' + text + '</u>'; }
                    if (/^#[a-fA-F0-9]{6}$/.test(attrs.color || '')) { text = '<span style="color:' + attrs.color + '">' + text + '</span>'; }
                    inline += text;
                });
            });
            function endTable() { if (row !== null) { html += '</tr></tbody></table>'; row = null; } }
            lines.forEach(function (line) {
                var attrs = line.attrs;
                var alignment = ['center', 'right', 'justify'].indexOf(attrs.align) >= 0 ? ' style="text-align:' + attrs.align + '"' : '';
                if (attrs.table) {
                    if (row === null) { html += '<table><tbody><tr>'; }
                    else if (row !== attrs.table) { html += '</tr><tr>'; }
                    row = attrs.table;
                    html += '<td' + ['colspan', 'rowspan'].map(function (name) {
                        var span = Number(attrs['table-' + name]); return span > 1 && span <= 50 ? ' ' + name + '="' + span + '"' : '';
                    }).join('') + alignment + '>' + line.html + '</td>';
                } else { endTable(); html += '<p' + alignment + '>' + line.html + '</p>'; }
            });
            endTable();
            return html;
        }
        function markup(title, doc) {
            var landscape = doc.orientation === 'landscape';
            var width = landscape ? 1123 : 794, pageHeight = landscape ? 794 : 1123;
            var height = pageHeight * (doc.pageCount || 3);
            var marks = (doc.strokes || []).map(function (s) {
                var points = s.points || []; points.forEach(function (p) { height = Math.max(height, p[1] + 40); });
                var common = ' stroke="' + escape(s.color) + '" stroke-width="' + Number(s.width) + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + (s.tool === 'highlighter' ? '.25' : '1') + '"';
                return points.length === 1 ? '<circle cx="' + Number(points[0][0]) + '" cy="' + Number(points[0][1]) + '" r="' + Number(s.width) / 2 + '" fill="' + escape(s.color) + '"/>' : '<polyline fill="none"' + common + ' points="' + points.map(function (p) { return Number(p[0]) + ',' + Number(p[1]); }).join(' ') + '"/>';
            }).join('');
            var lines = doc.textDelta ? 0 : String(doc.text || '').split('\n').reduce(function (n, line) { return n + Math.max(1, Math.ceil(line.length / (doc.orientation === 'landscape' ? 110 : 72))); }, 0);
            height = Math.ceil(Math.max(height, lines * 28 + 100) / pageHeight) * pageHeight;
            // Physical A4 dimensions prevent pixel rounding from adding a blank PDF page.
            var printHeight = (height / pageHeight) * (landscape ? 210 : 297) - 0.1;
            var textColor = /^#[0-9a-f]{6}$/i.test(doc.textColor || '') ? doc.textColor : '#17263c';
            var paginate = 'function paginate(){var p=document.querySelector(".paper"),h=Math.ceil(Math.max(' + height + ',document.querySelector(".text").scrollHeight)/' + pageHeight + ')*' + pageHeight + ';p.style.setProperty("--print-height",(h/' + pageHeight + '*' + (landscape ? 210 : 297) + '-.1)+"mm");p.style.minHeight=h+"px";document.querySelector(".ink").setAttribute("viewBox","0 0 ' + width + ' "+h)}window.addEventListener("load",paginate);window.addEventListener("beforeprint",paginate);';
            return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + escape(title) + '</title><style>@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:0}*{box-sizing:border-box}body{margin:0;color:#17263c;font-family:Arial,sans-serif}header{max-width:' + width + 'px;margin:auto;padding:18px 30px;background:#f3eff7;display:flex;justify-content:space-between;align-items:center;gap:20px}h1{font-size:20px;margin:0}.paper{position:relative;margin:auto;width:' + width + 'px;min-height:' + height + 'px;background:white}.text{color:' + textColor + ';margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:17px/28px Arial,sans-serif;padding:40px;position:relative;z-index:1}.text p{margin:0;padding:0}.text table{width:100%;border-collapse:collapse;table-layout:fixed;margin:.4em 0}.text td{border:1px solid #aeb9ca;padding:.25em .5em;vertical-align:top;overflow-wrap:anywhere}.text img{max-width:100%;height:auto;vertical-align:middle}.ink{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}button{padding:9px 14px}@media print{header{display:none}.paper{width:100%;min-height:var(--print-height,' + printHeight + 'mm)!important;margin:0}.text{font-size:17px}.ink{overflow:visible}}</style></head><body><header><h1>' + escape(title) + '</h1><button type="button" onclick="window.print()">In / Lưu PDF</button></header><article class="paper"><div class="text">' + formattedText(doc) + '</div><svg class="ink" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">' + marks + '</svg></article><script>' + paginate + '</script></body></html>';
        }
        function create() { var popup = window.open('', '_blank'); if (!popup) { throw new Error('Cho phép mở cửa sổ in để lưu PDF.'); } popup.opener = null; return popup; }
        function render(popup, title, doc) { popup.document.open(); popup.document.write(markup(title, doc)); popup.document.close(); }
        return {markup: markup, open: function (title, doc) { render(create(), title, doc); }, openAsync: function (load) {
            var popup; try { popup = create(); } catch (error) { return q.reject(error); }
            return load().then(function (row) { if (!popup.closed) { render(popup, row.title, row.document); } }).catch(function (error) { popup.close(); throw error; });
        }};
    }]);
}());
