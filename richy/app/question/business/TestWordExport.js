(function () {
    'use strict';

    angular.module('Hrm.Question').factory('TestWordExport', ['$window', '$q', '$uibModal', 'ComprehensiveListening',
        function ($window, $q, modal, listening) {
            var libraryPromise;
            var modeNames = {READING: 'IELTS Reading', LISTENING: 'IELTS Listening', WRITING: 'IELTS Writing',
                COMPREHENSIVE: 'Bài tập tổng hợp', DAILY_LISTENING: 'Daily Listening'};
            function library() {
                if ($window.docx) { return $q.when($window.docx); }
                if (libraryPromise) { return libraryPromise; }
                var deferred = $q.defer(), script = $window.document.createElement('script');
                var timer = $window.setTimeout(function () { libraryPromise = null; script.remove(); deferred.reject(new Error('Tải thư viện Word quá lâu. Vui lòng thử lại.')); }, 20000);
                libraryPromise = deferred.promise;
                script.src = 'assets/scripts/external/docx-9.6.1.js?v=' + encodeURIComponent($window.APP_VERSION || '1');
                script.onload = function () {
                    $window.clearTimeout(timer);
                    if ($window.docx) { deferred.resolve($window.docx); }
                    else { libraryPromise = null; deferred.reject(new Error('Không tải được thư viện Word. Vui lòng thử lại.')); }
                };
                script.onerror = function () { $window.clearTimeout(timer); libraryPromise = null; script.remove(); deferred.reject(new Error('Không tải được thư viện Word. Vui lòng kiểm tra mạng rồi thử lại.')); };
                $window.document.head.appendChild(script);
                return libraryPromise;
            }
            function escape(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
            function html(value) {
                var text = String(value == null ? '' : value);
                return /<\/?[a-z][^>]*>/i.test(text) ? text : escape(text).replace(/\r\n?|\n/g, '<br>');
            }
            function plain(value) {
                var template = $window.document.createElement('template'); template.innerHTML = html(value);
                Array.prototype.forEach.call(template.content.querySelectorAll('script,style'), function (node) { node.remove(); });
                return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
            }
            function shuffled(items, random) {
                var result = items.slice();
                for (var index = result.length - 1; index > 0; index--) {
                    var target = Math.floor(random() * (index + 1)), previous = result[index]; result[index] = result[target]; result[target] = previous;
                }
                return result;
            }
            function label(index) {
                var value = '';
                do { value = String.fromCharCode(65 + index % 26) + value; index = Math.floor(index / 26) - 1; } while (index >= 0);
                return value;
            }
            function roman(number) {
                var output = '', values = [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
                values.forEach(function (pair) { while (number >= pair[0]) { output += pair[1]; number -= pair[0]; } }); return output;
            }
            function answers(question) {
                return ((question || {}).questionAnswers || []).slice().sort(function (a, b) {
                    return Number(a.ordinalNumberQuestionAnswer || 0) - Number(b.ordinalNumberQuestionAnswer || 0);
                }).map(function (answer) { return String((answer.answer || {}).answer || ''); }).filter(function (value) {
                    return value.trim() && !/^(?:WRITING_TASK_\d+_RESPONSE|DAILY_LISTENING_RESPONSE)$/.test(value.trim());
                });
            }
            function mediaUrl(value) {
                if (!String(value || '').trim()) { return null; }
                try { var url = new $window.URL(String(value || '').trim(), $window.document.baseURI);
                    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
                } catch (invalid) { return null; }
            }
            function plan(test, options) {
                var mode = options.testMode || test.testFormat || 'READING', blocks = [], count = 0;
                var random = typeof options.random === 'function' ? options.random : Math.random;
                function add(kind, value, extra) { blocks.push(angular.extend({kind: kind, value: value}, extra || {})); }
                function reserve(amount) { return Array.from({length: amount}, function () { return ++count; }); }
                function range(numbers) { return numbers.length > 1 ? numbers[0] + '–' + numbers[numbers.length - 1] : String(numbers[0]); }
                function blanked(value, numbers) {
                    var index = 0;
                    return html(value).replace(/}\{\s*ENTER\s*}\{/gi, '<br>').replace(/}\{\s*(?:SPACE|HEADING)\s*}\{/gi, function () {
                        var number = numbers[Math.min(index++, numbers.length - 1)]; return (number ? '(' + number + ') ' : '') + '____________';
                    });
                }
                function addMedia(value, name) { if (String(value || '').trim()) { add('media', value, {name: name}); } }
                function cue(question) {
                    var value = question && question.videoTimeSeconds;
                    if (value != null && value !== '' && isFinite(Number(value))) {
                        var seconds = Math.max(0, Math.floor(Number(value)));
                        return ' [' + Math.floor(seconds / 60) + ':' + ('0' + seconds % 60).slice(-2) + ']';
                    }
                    return '';
                }
                function bank(values, title, romanLabels) {
                    if (!values.length) { return; }
                    if (options.shuffle) { values = shuffled(values, random); }
                    add('paragraph', title || 'Các lựa chọn', {bold: true, keepNext: true});
                    values.forEach(function (value, index) { add('html', html(value), {prefix: (romanLabels ? roman(index + 1) : label(index)) + '. ', option: true}); });
                }
                function gaps(transcript) {
                    var text = listening.transcriptText(transcript), session = listening.start(text, null, options.shuffle ? random : function () { return 0.5; });
                    var numbers = reserve(session.gaps.length), index = 0;
                    return {numbers: numbers, content: session.tokens.map(function (token) {
                        return token.gap ? escape(token.before) + '(' + numbers[index++] + ') ____________' + escape(token.after) : escape(token.text);
                    }).join('').replace(/\r\n?|\n/g, '<br>')};
                }
                if (mode === 'DAILY_LISTENING') {
                    addMedia(test.pronounce, 'Audio');
                    var daily = gaps(test.motherTongue);
                    add('heading', 'Listen and complete the gaps'); add('html', daily.content);
                } else {
                    addMedia(test.pronounce, 'Audio');
                    (test.subQuestions || []).forEach(function (part, partIndex) {
                        if (!part) { return; }
                        var packages = (part.subQuestions || []).filter(function (pack) { return pack && ((pack.subQuestions || []).length || plain(pack.question)); }).sort(function (a, b) { return Number(a.ordinalNumber || 0) - Number(b.ordinalNumber || 0); });
                        if (!packages.length && !plain(part.question) && !part.videoUrl && !part.pronounce) { return; }
                        if (options.shuffle) {
                            var reorderable = shuffled(packages.filter(function (pack) { return Number(pack.type) !== 4; }), random);
                            packages = packages.map(function (pack) { return Number(pack.type) === 4 ? pack : reorderable.shift(); });
                        }
                        var groups = packages.map(function (pack) {
                            var type = Number(pack.type), questions = (pack.subQuestions || []).filter(Boolean).slice().sort(function (a, b) { return Number(a.ordinalNumber || 0) - Number(b.ordinalNumber || 0); });
                            if (options.shuffle && [1,6,8,9,10,12].indexOf(type) >= 0) { questions = shuffled(questions, random); }
                            if (type === 18 && listening.isRuntime(pack)) {
                                var exercise = gaps(pack.motherTongue); return {pack: pack, type: type, questions: questions, numbers: exercise.numbers, listening: exercise.content};
                            }
                            return {pack: pack, type: type, questions: questions, numbers: reserve(type === 16 || type === 17 ? 1 : questions.length)};
                        });
                        var headingNumbers = []; groups.forEach(function (group) { if (group.type === 4) { headingNumbers = headingNumbers.concat(group.numbers); } });
                        var headingIndex = 0;
                        add('heading', mode === 'WRITING' ? 'Writing' : (mode === 'READING' ? 'Reading passage ' : 'Part ') + (partIndex + 1));
                        // Match the student test view: Listening transcripts, hidden
                        // reference text and the text behind a video are not exam prompts.
                        var showPassage = mode !== 'LISTENING' && mode !== 'WRITING' && Number(part.type) !== 6 && !String(part.videoUrl || '').trim();
                        if (showPassage && (plain(part.question) || /<img\b/i.test(String(part.question || '')))) {
                            add('html', html(part.question).replace(/}\{\s*HEADING\s*}\{/gi, function () { return '(' + (headingNumbers[headingIndex++] || '') + ') ____________'; }));
                        }
                        addMedia(part.pronounce, 'Audio'); addMedia(part.videoUrl, 'Video');
                        groups.forEach(function (group) {
                            var pack = group.pack, type = group.type, questions = group.questions, numbers = group.numbers;
                            if (!numbers.length) { return; }
                            add('subheading', type === 16 || type === 17 ? 'Writing Task ' + (type === 16 ? 1 : 2) : 'Questions ' + range(numbers));
                            var instruction = html(pack.question).replace(/\bQuestions?\s+(?:\d+|\?)(?:\s*(?:[-–]|to)\s*(?:\d+|\?))?/gi, 'Questions ' + range(numbers));
                            if (plain(instruction) || /<img\b/i.test(instruction)) { add('html', instruction); }
                            if (type === 16 || type === 17) { add('paragraph', 'Write at least ' + (type === 16 ? '150' : '250') + ' words.'); add('lines', 12); return; }
                            if (group.listening) { addMedia(pack.pronounce, 'Audio'); add('html', group.listening); return; }
                            if ([11,13,18].indexOf(type) >= 0) {
                                if (type === 18) { addMedia(pack.pronounce, 'Audio'); }
                                if (type === 13) { bank(answers(questions[0]).sort(function (a, b) { return plain(a).localeCompare(plain(b)); }), pack.title || 'Word bank'); }
                                add('html', blanked((questions[0] || {}).question, numbers)); return;
                            }
                            if (type === 5 || type === 7) {
                                var first = questions[0] || {};
                                if (plain(first.question) !== plain(pack.question)) { add('html', blanked(first.question, numbers)); }
                                bank(answers(first), pack.title || 'Choose the correct answers');
                                numbers.forEach(function (number) { add('paragraph', number + '. ____________'); }); return;
                            }
                            if ([4,9,10,12,14,15].indexOf(type) >= 0) {
                                bank(answers(questions[0]), pack.title || (type === 4 ? 'List of Headings' : (type === 14 ? 'List of Endings' : 'Các lựa chọn')), type === 4);
                                questions.forEach(function (question, index) { add('html', blanked(question.question, [numbers[index]]) + (!/}\{\s*(?:SPACE|HEADING)\s*}\{/i.test(String(question.question || '')) ? ' ____________' : ''), {prefix: numbers[index] + '.' + cue(question) + ' '}); });
                                return;
                            }
                            if ([1,2,3,6,8].indexOf(type) < 0) { throw new Error('Chưa thể xuất dạng câu hỏi ' + type + '. Nội dung bài chưa được thay đổi.'); }
                            questions.forEach(function (question, index) {
                                var number = numbers[index]; add('html', blanked(question.question, [number]), {prefix: number + '.' + cue(question) + ' ', keepNext: [1,6,8].indexOf(type) >= 0});
                                if ([1,6,8].indexOf(type) >= 0) {
                                    var choices = answers(question); if (options.shuffle) { choices = shuffled(choices, random); }
                                    choices.forEach(function (value, choiceIndex) { add('html', html(value), {prefix: label(choiceIndex) + '. ', option: true}); });
                                } else if (!/}\{\s*SPACE\s*}\{/i.test(String(question.question || ''))) { add('paragraph', '____________'); }
                            });
                        });
                    });
                }
                if (!count) { throw new Error('Bài chưa có câu hỏi để xuất Word.'); }
                return {title: plain(test.title || test.question || 'Bài kiểm tra'), mode: modeNames[mode] || mode, blocks: blocks, questionCount: count};
            }

            async function buildDocument(test, options) {
                options = options || {};
                var outline = plan(angular.copy(test || {}), options), d = await library(), warnings = [], imageCache = {};
                var document = $window.document;
                function warn(message) { if (warnings.indexOf(message) < 0) { warnings.push(message); } }
                function paragraph(text, extra) { return new d.Paragraph(angular.extend({children: [new d.TextRun(angular.extend({text: String(text || '')}, (extra || {}).run || {}))], spacing: {after: 120, line: 276}}, extra || {})); }
                async function image(node) {
                    var src = node.getAttribute('src') || '', url = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(src) ? src : mediaUrl(src);
                    if (!url) { warn('Có hình ảnh không có đường dẫn hợp lệ.'); return new d.TextRun('[Hình ảnh chưa tải được]'); }
                    try {
                        if (!imageCache[url]) { imageCache[url] = (async function () {
                            var controller = new $window.AbortController(), timer = $window.setTimeout(function () { controller.abort(); }, 15000);
                            var response, blob;
                            try { response = await $window.fetch(url, {credentials: 'same-origin', signal: controller.signal});
                                if (!response.ok) { throw new Error('HTTP ' + response.status); }
                                blob = await response.blob(); }
                            finally { $window.clearTimeout(timer); }
                            var objectUrl = $window.URL.createObjectURL(blob), img = new $window.Image();
                            try {
                                await new Promise(function (resolve, reject) {
                                    var decodeTimer = $window.setTimeout(function () { reject(new Error('Image decode timeout')); }, 10000);
                                    img.onload = function () { $window.clearTimeout(decodeTimer); resolve(); };
                                    img.onerror = function (error) { $window.clearTimeout(decodeTimer); reject(error); }; img.src = objectUrl;
                                });
                                var width = img.naturalWidth || 600, height = img.naturalHeight || 400, bytes, type;
                                if (/^image\/(?:png|jpeg)$/i.test(blob.type)) { bytes = new Uint8Array(await blob.arrayBuffer()); type = blob.type === 'image/png' ? 'png' : 'jpg'; }
                                else { var canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0);
                                    var png = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); }); bytes = new Uint8Array(await png.arrayBuffer()); type = 'png'; }
                                return {bytes: bytes, type: type, width: width, height: height};
                            } finally { $window.URL.revokeObjectURL(objectUrl); }
                        })(); }
                        var asset = await imageCache[url], requested = Number(node.getAttribute('width')) || asset.width;
                        var scale = Math.min(1, 600 / asset.width, 760 / asset.height, requested / asset.width);
                        return new d.ImageRun({data: asset.bytes, type: asset.type, transformation: {width: Math.round(asset.width * scale), height: Math.round(asset.height * scale)},
                            altText: {title: node.getAttribute('alt') || 'Hình minh họa', description: node.getAttribute('alt') || 'Hình trong đề bài', name: 'Test image'}});
                    } catch (error) { warn('Không tải được một số hình ảnh. File có ghi vị trí hình cần bổ sung.'); return new d.TextRun('[Hình ảnh chưa tải được: ' + (node.getAttribute('alt') || src) + ']'); }
                }
                function hidden(node) { return node.nodeType === 1 && (node.hidden || node.getAttribute('aria-hidden') === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(node.getAttribute('style') || '')); }
                async function runs(node, formatting) {
                    if (node.nodeType === 3) { return [new d.TextRun(angular.extend({text: (node.nodeValue || '').replace(/\s+/g, ' ')}, formatting))]; }
                    if (node.nodeType !== 1 || hidden(node) || /^(SCRIPT|STYLE|NOSCRIPT|BUTTON|OBJECT|EMBED)$/.test(node.tagName)) { return []; }
                    if (node.tagName === 'BR') { return [new d.TextRun({break: 1})]; }
                    if (node.tagName === 'IMG') { return [await image(node)]; }
                    if (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)) { return [new d.TextRun('____________')]; }
                    if (/^(IFRAME|VIDEO|AUDIO)$/.test(node.tagName)) { var source = node.getAttribute('src'); return source && mediaUrl(source) ? [new d.TextRun(mediaUrl(source))] : []; }
                    var next = angular.extend({}, formatting), style = node.getAttribute('style') || '';
                    if (/^(STRONG|B)$/.test(node.tagName) || /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style)) { next.bold = true; }
                    if (/^(EM|I)$/.test(node.tagName) || /font-style\s*:\s*italic/i.test(style)) { next.italics = true; }
                    if (node.tagName === 'U' || /text-decoration[^;]*underline/i.test(style)) { next.underline = {}; }
                    if (node.tagName === 'SUP') { next.superScript = true; } if (node.tagName === 'SUB') { next.subScript = true; }
                    var children = [];
                    for (var child of Array.from(node.childNodes)) { children = children.concat(await runs(child, next)); }
                    if (node.tagName === 'A' && mediaUrl(node.getAttribute('href'))) { return [new d.ExternalHyperlink({link: mediaUrl(node.getAttribute('href')), children: children})]; }
                    return children;
                }
                async function table(node) {
                    var rows = Array.from(node.querySelectorAll('tr')).filter(function (row) { return row.closest('table') === node; });
                    var columns = Math.max.apply(null, rows.map(function (row) { return Array.from(row.children).reduce(function (sum, cell) { return sum + (Number(cell.getAttribute('colspan')) || 1); }, 0); }).concat([1]));
                    return new d.Table({width: {size: 100, type: d.WidthType.PERCENTAGE}, columnWidths: Array(columns).fill(Math.floor(9360 / columns)),
                        rows: await Promise.all(rows.map(async function (row) { return new d.TableRow({tableHeader: row.parentNode.tagName === 'THEAD', children: await Promise.all(Array.from(row.children).filter(function (cell) { return /^(TD|TH)$/.test(cell.tagName); }).map(async function (cell) {
                            var content = await blocks(cell, {bold: cell.tagName === 'TH'});
                            return new d.TableCell({children: content.length ? content : [paragraph('')], columnSpan: Number(cell.getAttribute('colspan')) || 1, rowSpan: Number(cell.getAttribute('rowspan')) || 1,
                                margins: {top: 80, bottom: 80, left: 100, right: 100}});
                        }))}); }))});
                }
                async function blocks(container, settings) {
                    settings = settings || {};
                    var result = [], pending = [], prefix = settings.prefix ? [new d.TextRun({text: settings.prefix, bold: !settings.option})] : [];
                    function flush() {
                        if (!pending.length && !prefix.length) { return; }
                        result.push(new d.Paragraph({children: prefix.concat(pending), keepNext: settings.keepNext === true,
                            indent: settings.option ? {left: 300} : undefined, spacing: {after: settings.option ? 60 : 120, line: 276}})); pending = []; prefix = [];
                    }
                    for (var node of Array.from(container.childNodes)) {
                        if (hidden(node)) { continue; }
                        if (node.nodeType === 3 && !String(node.nodeValue || '').trim() && !pending.length) { continue; }
                        if (node.nodeType === 1 && node.tagName === 'TABLE') { flush(); result.push(await table(node)); continue; }
                        if (node.nodeType === 1 && /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE)$/.test(node.tagName)) {
                            // Carry the question/option label into its first HTML paragraph.
                            var carryPrefix = !pending.length && prefix.length ? settings.prefix : null;
                            if (carryPrefix) { prefix = []; } else { flush(); }
                            if (/^(UL|OL)$/.test(node.tagName)) {
                                var index = 0;
                                for (var item of Array.from(node.children)) { result = result.concat(await blocks(item, {prefix: node.tagName === 'OL' ? (++index) + '. ' : '• '})); }
                            } else { result = result.concat(await blocks(node, {prefix: carryPrefix, option: settings.option, keepNext: settings.keepNext})); }
                            continue;
                        }
                        pending = pending.concat(await runs(node, {bold: settings.bold === true}));
                    }
                    flush(); return result;
                }
                var children = [paragraph(outline.title, {heading: d.HeadingLevel.TITLE}), paragraph(outline.mode + ' · ' + outline.questionCount + ' câu hỏi'),
                    paragraph('Họ và tên: __________________________________    Lớp: ______________')];
                for (var block of outline.blocks) {
                    if (block.kind === 'html') { var template = document.createElement('template'); template.innerHTML = block.value; children = children.concat(await blocks(template.content, block)); }
                    else if (block.kind === 'heading' || block.kind === 'subheading') { children.push(paragraph(block.value, {heading: block.kind === 'heading' ? d.HeadingLevel.HEADING_1 : d.HeadingLevel.HEADING_2, keepNext: true})); }
                    else if (block.kind === 'lines') { for (var index = 0; index < block.value; index++) { children.push(paragraph('________________________________________________________________________')); } }
                    else if (block.kind === 'media') { var url = mediaUrl(block.value); children.push(new d.Paragraph({children: [new d.TextRun(block.name + ': '), url ? new d.ExternalHyperlink({link: url, children: [new d.TextRun({text: url, style: 'Hyperlink'})]}) : new d.TextRun(plain(block.value))], spacing: {after: 120}})); }
                    else { children.push(paragraph(block.value, {keepNext: block.keepNext === true, run: {bold: block.bold === true}})); }
                }
                var file = new d.Document({creator: 'IELTS ROOM', title: outline.title, styles: {default: {
                    document: {run: {font: 'Arial', size: 22, color: '000000'}, paragraph: {spacing: {after: 120, line: 276}}},
                    title: {run: {size: 32, bold: true, color: '000000'}, paragraph: {spacing: {after: 220}}},
                    heading1: {run: {size: 28, bold: true, color: '000000'}, paragraph: {spacing: {before: 240, after: 160}}},
                    heading2: {run: {size: 24, bold: true, color: '000000'}, paragraph: {spacing: {before: 180, after: 100}}}}},
                    sections: [{properties: {page: {size: {width: 12240, height: 15840}, margin: {top: 1080, bottom: 1080, left: 1440, right: 1440}}}, children: children}]});
                var name = outline.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 120) || 'Bai-kiem-tra';
                return {blob: await d.Packer.toBlob(file), filename: name + (options.shuffle ? '-xao-tron' : '') + '.docx', questionCount: outline.questionCount, warnings: warnings};
            }
            function build(test, options) { return $q.when(buildDocument(test, options)); }
            function download(result) {
                if ($window.saveAs) { $window.saveAs(result.blob, result.filename); return; }
                var url = $window.URL.createObjectURL(result.blob), link = $window.document.createElement('a');
                link.href = url; link.download = result.filename; $window.document.body.appendChild(link); link.click(); link.remove();
                $window.setTimeout(function () { $window.URL.revokeObjectURL(url); }, 30000);
            }
            function open(test, options) {
                return modal.open({templateUrl: 'question/views/test_word_export_modal.html?v=' + ($window.APP_VERSION || '1'), controllerAs: 'exportVm', size: 'md', backdrop: 'static',
                    controller: ['$scope', '$uibModalInstance', function ($scope, dialog) {
                        var vm = this, pendingResult;
                        vm.title = plain(test.title || test.question || 'Bài kiểm tra'); vm.shuffle = false;
                        vm.orderChanged = function () { pendingResult = null; vm.warnings = []; };
                        function finish(result) {
                            try { download(result); dialog.close(); }
                            catch (error) { vm.error = 'Chưa tải được file Word. Vui lòng cho phép tải file rồi thử lại.'; }
                        }
                        vm.cancel = function () { if (!vm.busy) { dialog.dismiss('cancel'); } };
                        vm.confirm = function () {
                            if (vm.busy) { return; }
                            vm.busy = true; vm.error = ''; vm.warnings = [];
                            build(test, angular.extend({}, options, {shuffle: vm.shuffle})).then(function (result) {
                                vm.busy = false;
                                if (result.warnings.length) { pendingResult = result; vm.warnings = result.warnings; return; }
                                finish(result);
                            }, function (error) { vm.busy = false; vm.error = (error && error.message) || 'Không tạo được file Word. Vui lòng thử lại.'; });
                        };
                        vm.downloadWithWarnings = function () { if (pendingResult && !vm.busy) { finish(pendingResult); } };
                        $scope.$on('modal.closing', function (event) { if (vm.busy) { event.preventDefault(); } });
                    }]}).result;
            }
            return {build: build, open: open};
        }]);
})();
