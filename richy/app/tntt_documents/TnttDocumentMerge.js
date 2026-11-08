(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').factory('TnttDocumentMerge', ['$window', function (window) {
        function copy(value) { return JSON.parse(JSON.stringify(value)); }
        function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
        function delta(document) {
            if (!window.Quill) { throw new Error('Chưa tải được công cụ ghép nội dung tài liệu.'); }
            var Delta = window.Quill.import('delta');
            return new Delta(copy(document.textDelta ? document.textDelta.ops : [{insert: document.text + '\n'}]));
        }
        function plain(value) { return value.ops.map(function (op) { return typeof op.insert === 'string' ? op.insert : op.insert.softbreak ? '\u2028' : ''; }).join('').slice(0, -1); }
        function strokes(base, local, remote) {
            var before = {}, mine = {}, theirs = {}, result = [];
            base.forEach(function (stroke) { before[stroke.id] = stroke; });
            local.forEach(function (stroke) { mine[stroke.id] = stroke; });
            remote.forEach(function (stroke) { theirs[stroke.id] = stroke; });
            remote.forEach(function (stroke) {
                var old = before[stroke.id], own = mine[stroke.id];
                if (old && !own) { return; } // An eraser wins over a simultaneous move.
                result.push(old && own && !same(old, own) && same(old, stroke) ? copy(own) : copy(stroke));
            });
            local.forEach(function (stroke) {
                if (!before[stroke.id] && !theirs[stroke.id]) { result.push(copy(stroke)); }
            });
            return result;
        }
        function merge(base, local, remote) {
            var start = delta(base), incoming = start.diff(delta(remote)), own = start.diff(delta(local));
            // Every accepted server revision precedes edits that are being rebased onto it.
            var content = delta(remote).compose(incoming.transform(own, true));
            var result = copy(remote);
            result.text = plain(content);
            if (base.textDelta || local.textDelta || remote.textDelta || content.ops.some(function (op) { return op.attributes || typeof op.insert !== 'string'; })) {
                result.textDelta = {ops: content.ops.map(function (op) {
                    var clean = {insert: op.insert}, attributes = {};
                    ['bold', 'italic', 'underline', 'color', 'link', 'table', 'table-colspan', 'table-rowspan', 'width'].forEach(function (key) { if (op.attributes && op.attributes[key]) attributes[key] = op.attributes[key]; });
                    if (Object.keys(attributes).length) clean.attributes = attributes;
                    return clean;
                })};
            } else { delete result.textDelta; }
            result.strokes = strokes(base.strokes, local.strokes, remote.strokes);
            ['orientation', 'pattern', 'textColor', 'pageCount'].forEach(function (key) {
                if (!same(local[key], base[key]) && same(remote[key], base[key])) {
                    if (local[key] === undefined) { delete result[key]; } else { result[key] = local[key]; }
                }
            });
            if (local.pageCount !== undefined && remote.pageCount !== undefined) { result.pageCount = Math.max(local.pageCount, remote.pageCount); }
            return result;
        }
        function selection(range, before, after) {
            if (!range) { return null; }
            var change = delta(before).diff(delta(after)), limit = Math.max(0, delta(after).length() - 1);
            var start = Math.min(limit, change.transformPosition(range.index, false));
            var end = range.length ? Math.min(limit, change.transformPosition(range.index + range.length, true)) : start;
            return {index: start, length: Math.max(0, end - start)};
        }
        return {merge: merge, selection: selection};
    }]);
}());
