(function () {
    'use strict';

    angular.module('Hrm.EnrolmentClass').factory('TeachingPdf', [
        '$uibModal', '$http', '$q', 'settings',
        function (modal, http, $q, settings) {
            var pdfAssets = new URL('assets/vendor/pdfjs/', document.baseURI);
            var version = encodeURIComponent(window.APP_VERSION || 'dev');
            var engine;
            function pdfEngine() {
                if (!engine) {
                    engine = import(new URL('pdf.min.js?v=' + version, pdfAssets).href).then(function (api) {
                        api.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js?v=' + version, pdfAssets).href;
                        return api;
                    }).catch(function (error) { engine = null; throw error; });
                }
                return engine;
            }

            function sessionUrl(classId, date) {
                return settings.api.baseUrl + settings.api.apiV1Url + 'class_teaching_pdf/' + classId + '/' + date;
            }
            return {
                list: function (classId, date) {
                    return http.get(sessionUrl(classId, date), {cache: false}).then(function (response) { return response.data; });
                },
                open: function (classId, date, previousRun, currentRun) {
                var base = sessionUrl(classId, date);
                return modal.open({
                    templateUrl: 'enrolment_class/views/teaching_pdf.html?v=' + version,
                    controllerAs: 'pdf',
                    windowClass: 'teaching-pdf-window',
                    size: 'lg',
                    backdrop: 'static',
                    keyboard: false,
                    ariaLabelledBy: 'teaching-pdf-title',
                    controller: ['$scope', '$timeout', '$uibModalInstance', function (scope, timer, instance) {
                        var vm = this, root, pdf, api, loadingTask, saveTimer, saveRequest;
                        var editId = 0, savedEditId = 0, destroyed = false, stroke;
                        var batchSize = 5, renderQueue = [], renderingPages = 0, batchTimer, scrollFrame, zoomTimer, selectionTimer;
                        var layoutPending = false, activeStart = 0, activeEnd = 0;
                        vm.pages = [];
                        vm.state = {page: 1, zoom: 1, x: 0, y: 0, marks: []};
                        vm.library = []; vm.current = []; vm.previous = [];

                        function fail(error, fallback) {
                            vm.error = error && error.data && error.data.message || fallback;
                        }
                        function runUrl() { return base + '/run/' + encodeURIComponent(vm.run.id); }
                        function load() {
                            vm.busy = true; vm.error = '';
                            return http.get(base, {cache: false}).then(function (response) {
                                vm.library = response.data.library || [];
                                vm.current = response.data.current || [];
                                vm.previous = (response.data.previous || []).filter(function (item) {
                                    return !vm.current.some(function (current) { return current.id === item.id; });
                                });
                            }, function (error) { fail(error, 'Không tải được kho PDF.'); })
                                .finally(function () { vm.busy = false; });
                        }

                        vm.upload = function (file) {
                            if (!file || vm.busy) { return; }
                            if (file.size > 9 * 1024 * 1024) { vm.error = 'Chọn PDF tối đa 9 MB.'; return; }
                            var body = new FormData();
                            body.append('file', file);
                            vm.busy = true; vm.error = '';
                            http.post(base + '/upload', body, {transformRequest: angular.identity, headers: {'Content-Type': undefined}})
                                .then(function (response) {
                                    vm.library.push(response.data); vm.selected = response.data.id;
                                }, function (error) { fail(error, 'Không tải lên được tệp PDF.'); })
                                .finally(function () { vm.busy = false; });
                        };

                        vm.attach = function (choice) {
                            if (vm.busy) { return; }
                            vm.busy = true; vm.error = '';
                            return http.post(base + '/attach', choice).then(function (response) {
                                vm.changedDay = true;
                                var id = response.data.id;
                                var selected = choice.previousRun
                                    ? vm.previous.find(function (run) { return run.id === choice.previousRun; })
                                    : vm.library.find(function (item) { return item.id === choice.pdfId; });
                                if (selected && !vm.current.some(function (run) { return run.id === id; })) {
                                    vm.current.push({id: id, name: selected.name, completed: false});
                                }
                                vm.previous = vm.previous.filter(function (run) { return run.id !== id; });
                                return open(id);
                            }, function (error) { fail(error, 'Không gắn được PDF vào buổi này.'); })
                                .finally(function () { vm.busy = false; });
                        };
                        vm.open = function (id) {
                            if (vm.busy) { return; }
                            vm.busy = true; vm.error = '';
                            return open(id).finally(function () { vm.busy = false; });
                        };

                        function open(id) {
                            vm.run = {id: id};
                            return $q.all([http.get(runUrl(), {cache: false}), http.get(runUrl() + '/content', {responseType: 'arraybuffer', cache: false}),
                                pdfEngine()]).then(function (data) {
                                if (destroyed) { return; }
                                angular.extend(vm.run, data[0].data);
                                var state = vm.run.progress ? JSON.parse(vm.run.progress) : {};
                                vm.state = angular.extend({page: 1, zoom: 1, x: 0, y: 0, marks: []}, state);
                                vm.zoomInput = vm.state.zoom;
                                api = data[2];
                                loadingTask = api.getDocument({data: data[1].data, isEvalSupported: false, enableXfa: false,
                                    cMapUrl: new URL('cmaps/', pdfAssets).href, cMapPacked: true,
                                    standardFontDataUrl: new URL('standard_fonts/', pdfAssets).href,
                                    wasmUrl: new URL('wasm/', pdfAssets).href, maxImageSize: 16000000});
                                return $q.when(loadingTask.promise).then(function (doc) {
                                    if (destroyed) { return; }
                                    pdf = doc; vm.pageCount = doc.numPages;
                                    vm.state.page = Math.max(1, Math.min(vm.state.page, doc.numPages));
                                    vm.pageInput = vm.state.page;
                                    return setupPages();
                                });
                            }).catch(function (error) {
                                var message = 'Không khởi động được trình đọc PDF. Hãy tải lại trang rồi thử lại.';
                                if (error && error.status > 0) {
                                    message = 'Máy chủ không trả được tài liệu PDF (HTTP ' + error.status + ').';
                                } else if (error && error.name === 'PasswordException') {
                                    message = 'PDF này có mật khẩu. Hãy tải lên bản PDF đã mở khóa.';
                                } else if (error && error.name === 'InvalidPDFException') {
                                    message = 'Dữ liệu tải về không đọc được dưới dạng PDF.';
                                }
                                fail(error, message);
                                release(); vm.run = null;
                            });
                        }

                        function viewport() { return root && root.querySelector('.teaching-pdf-scroll'); }
                        function sheetFor(page) { return viewport().querySelector('[data-pdf-page="' + page + '"]'); }
                        function fitScale(container, width) {
                            return Math.min(1.5, Math.max(160, container.clientWidth - 30) / width) * vm.state.zoom;
                        }
                        function sizeSheet(item, container) {
                            var scale = fitScale(container, item.width);
                            item.style = {width: item.width * scale + 'px', height: item.height * scale + 'px'};
                        }
                        function setupPages() {
                            return $q.when(pdf.getPage(vm.state.page)).then(function (page) {
                                if (destroyed) { return; }
                                var view = page.getViewport({scale: 1});
                                layoutPending = true;
                                vm.pages = Array.from({length: pdf.numPages}, function (_, index) {
                                    var item = {number: index + 1, width: view.width, height: view.height};
                                    sizeSheet(item, viewport());
                                    return item;
                                });
                                return timer(function () {
                                    scrollToState();
                                    layoutPending = false;
                                    updateBatch();
                                });
                            });
                        }
                        function scrollToState() {
                            var container = viewport(), sheet = sheetFor(vm.state.page);
                            if (!sheet) { return; }
                            container.scrollTop = sheet.offsetTop + vm.state.y * sheet.clientHeight;
                            container.scrollLeft = vm.state.x * sheet.clientWidth;
                        }
                        function pageAt(container, y) {
                            var sheets = container.children;
                            var lo = 0, hi = sheets.length - 1;
                            while (lo < hi) {
                                var mid = Math.floor((lo + hi) / 2), sheet = sheets[mid];
                                if (y >= sheet.offsetTop + sheet.offsetHeight) { lo = mid + 1; }
                                else { hi = mid; }
                            }
                            return lo + 1;
                        }
                        function clearPage(item) {
                            var job = item.job;
                            item.job = null; item.ready = false; item.error = false;
                            if (!job) { return; }
                            if (job.paint) { job.paint.cancel(); }
                            if (job.text) { job.text.cancel(); }
                        }
                        function updateBatch() {
                            if (!pdf || !vm.pages.length || layoutPending) { return; }
                            var container = viewport(), margin = container.clientHeight * .28;
                            var first = pageAt(container, Math.max(0, container.scrollTop - margin));
                            var last = pageAt(container, container.scrollTop + container.clientHeight + margin);
                            var start = Math.floor((first - 1) / batchSize) * batchSize + 1;
                            var end = Math.min(vm.pageCount, Math.ceil(last / batchSize) * batchSize);
                            if (start === activeStart && end === activeEnd) { return; }
                            activeStart = start; activeEnd = end;
                            vm.pages.forEach(function (item) {
                                var active = item.number >= start && item.number <= end;
                                if (item.active && !active) { clearPage(item); }
                                item.active = active;
                            });
                            if (batchTimer) { timer.cancel(batchTimer); }
                            batchTimer = timer(function () {
                                batchTimer = null;
                                renderQueue = vm.pages.filter(function (item) { return item.active && !item.job && !item.ready && !item.error; })
                                    .sort(function (a, b) { return Math.abs(a.number - vm.state.page) - Math.abs(b.number - vm.state.page); });
                                pumpPages();
                            });
                        }
                        function pumpPages() {
                            if (!pdf || destroyed) { return; }
                            while (renderingPages < 2 && renderQueue.length) {
                                var item = renderQueue.shift();
                                if (item.active && !item.job && !item.ready) { startPage(item); }
                            }
                        }
                        function startPage(item) {
                            var job = item.job = {}, doc = pdf;
                            renderingPages++;
                            $q.when(doc.getPage(item.number)).then(function (page) {
                                if (destroyed || item.job !== job || pdf !== doc) { return; }
                                var container = viewport(), sheet = sheetFor(item.number);
                                var canvas = sheet && sheet.querySelector('canvas'), text = sheet && sheet.querySelector('.textLayer');
                                if (!canvas || !text) { item.job = null; return; }
                                var original = page.getViewport({scale: 1});
                                var scale = fitScale(container, original.width), view = page.getViewport({scale: scale});
                                var pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4500000 / (view.width * view.height)));
                                if (item.width !== original.width || item.height !== original.height) {
                                    var anchor = sheetFor(vm.state.page);
                                    var anchorTop = anchor && anchor.offsetTop;
                                    item.width = original.width; item.height = original.height;
                                    sizeSheet(item, container);
                                    sheet.style.width = item.style.width; sheet.style.height = item.style.height;
                                    if (anchor) { container.scrollTop += anchor.offsetTop - anchorTop; }
                                }
                                sheet.style.setProperty('--total-scale-factor', String(scale * view.userUnit));
                                canvas.width = Math.max(1, Math.floor(view.width * pixelRatio));
                                canvas.height = Math.max(1, Math.floor(view.height * pixelRatio));
                                text.replaceChildren();
                                job.paint = page.render({canvas: canvas, viewport: view, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]});
                                job.text = new api.TextLayer({textContentSource: page.streamTextContent(), container: text, viewport: view});
                                text.style.width = view.rawDims.pageWidth * scale * view.userUnit + 'px';
                                text.style.height = view.rawDims.pageHeight * scale * view.userUnit + 'px';
                                return $q.all([job.paint.promise, job.text.render()]).then(function () {
                                    if (item.job === job) { item.ready = true; }
                                });
                            }).catch(function () {
                                if (!destroyed && item.job === job) { item.error = true; }
                            }).finally(function () {
                                renderingPages--;
                                pumpPages();
                            });
                        }
                        vm.go = function (page) {
                            page = Math.floor(Number(page));
                            if (!pdf || !Number.isFinite(page)) { return; }
                            page = Math.min(pdf.numPages, Math.max(1, page));
                            vm.state.page = page; vm.state.x = 0; vm.state.y = 0; vm.pageInput = page;
                            vm.selectedMark = null; closeContext();
                            scrollToState(); updateBatch(); changed();
                        };
                        function syncZoomInput() {
                            var input = root && root.querySelector('[data-pdf-zoom]');
                            if (input) { input.value = vm.zoomInput; }
                        }
                        vm.setZoom = function (value) {
                            if (!pdf || !Number.isFinite(value)) { return; }
                            var zoom = Math.max(.5, Math.min(3, Math.round(value * 10) / 10));
                            vm.zoomInput = zoom;
                            syncZoomInput();
                            if (vm.state.zoom === zoom) { return; }
                            layoutPending = true;
                            closeContext();
                            vm.state.zoom = zoom;
                            var container = viewport();
                            vm.pages.forEach(function (item) {
                                clearPage(item); sizeSheet(item, container);
                            });
                            renderQueue = []; activeStart = activeEnd = 0;
                            timer(function () {
                                if (!pdf || destroyed) { return; }
                                scrollToState();
                                layoutPending = false;
                                updateBatch();
                            });
                            changed();
                        };
                        vm.zoom = function (step) { vm.setZoom(vm.state.zoom + step); };
                        function onZoom(event) {
                            if (!event.target.matches('[data-pdf-zoom]') || !pdf || vm.busy) { return; }
                            var value = Number(event.target.value);
                            scope.$evalAsync(function () {
                                vm.zoomInput = value;
                                if (zoomTimer) { timer.cancel(zoomTimer); }
                                if (event.type === 'change') { vm.setZoom(value); }
                                else { zoomTimer = timer(function () { vm.setZoom(value); }, 140); }
                            });
                        }

                        function changed() {
                            if (vm.run.completed) { return; }
                            editId++;
                            vm.saveStatus = 'Chờ đồng bộ';
                            if (saveTimer) { timer.cancel(saveTimer); }
                            saveTimer = timer(function () { save(false).catch(angular.noop); }, 700);
                        }
                        function save(complete) {
                            if (saveTimer) { timer.cancel(saveTimer); saveTimer = null; }
                            if (!vm.run || vm.run.completed) { return $q.when(); }
                            if (saveRequest) { return saveRequest.then(function () { return save(complete); }); }
                            if (editId === savedEditId && !complete) { return $q.when(); }
                            var sent = editId, revision = vm.run.revision;
                            vm.saveStatus = 'Đang đồng bộ…';
                            saveRequest = http.put(runUrl(), {state: angular.copy(vm.state), revision: revision, completed: complete})
                                .then(function (response) {
                                    if (response.data.revision !== revision + 1 || response.data.completed !== complete) {
                                        throw new Error('Invalid save confirmation');
                                    }
                                    vm.run.revision = response.data.revision;
                                    vm.run.completed = complete;
                                    savedEditId = sent;
                                    vm.saveStatus = sent === editId ? 'Đã đồng bộ' : 'Chờ đồng bộ';
                                }).catch(function (error) {
                                    vm.saveStatus = 'Chưa lưu';
                                    fail(error, 'Chưa lưu được tiến trình. Bấm Lưu lại để thử lại.');
                                    return $q.reject(error);
                                }).finally(function () { saveRequest = null; });
                            return saveRequest;
                        }
                        vm.save = function () { vm.error = ''; save(false).catch(angular.noop); };
                        vm.complete = function () {
                            if (!pdf || vm.busy || vm.run.completed || !window.confirm('Đánh dấu hoàn thành lượt dạy PDF này?')) { return; }
                            vm.busy = true;
                            if (vm.editingText) { vm.finishText(vm.editingText); }
                            save(true).then(function () { vm.changedDay = true; }).catch(angular.noop)
                                .finally(function () { vm.busy = false; });
                        };

                        function release() {
                            if (batchTimer) { timer.cancel(batchTimer); batchTimer = null; }
                            if (zoomTimer) { timer.cancel(zoomTimer); zoomTimer = null; }
                            if (scrollFrame) { window.cancelAnimationFrame(scrollFrame); scrollFrame = null; }
                            vm.pages.forEach(clearPage);
                            vm.pages = []; renderQueue = []; activeStart = activeEnd = 0; layoutPending = false;
                            closeContext();
                            if (loadingTask) { loadingTask.destroy().catch(angular.noop); loadingTask = null; }
                            pdf = null;
                        }
                        function leave(close) {
                            if (vm.busy) { return; }
                            vm.busy = true;
                            if (vm.editingText) { vm.finishText(vm.editingText); }
                            save(false).then(function () {
                                release(); vm.run = null; vm.selectedMark = null; vm.drawing = false; vm.notesOpen = false; vm.addingText = false; vm.editingText = null;
                                editId = savedEditId = 0; vm.saveStatus = '';
                                if (close) { instance.close(vm.changedDay); } else { return load(); }
                            }).catch(angular.noop).finally(function () { vm.busy = false; });
                        }
                        vm.back = function () { leave(false); };
                        vm.close = function () { leave(true); };

                        vm.textColors = [
                            {name:'Đỏ', value:'#bc4136'}, {name:'Hồng', value:'#b63f77'},
                            {name:'Cam', value:'#b65b16'}, {name:'Vàng', value:'#946500'},
                            {name:'Xanh lá', value:'#32743a'}, {name:'Xanh ngọc', value:'#157276'},
                            {name:'Xanh dương', value:'#2b62ba'}, {name:'Tím', value:'#7255a8'}
                        ];
                        function anchorContext(mark, rect) {
                            var area = viewport().getBoundingClientRect();
                            var x = (rect.left + rect.right) / 2 - area.left;
                            var top = Math.max(6, rect.top - area.top - 73);
                            var below = rect.bottom - area.top + 7;
                            vm.context = {mark: mark,
                                x: Math.max(8, Math.min(area.width - 294, x - 142)),
                                top: top,
                                noteTop: below + 146 <= area.height ? below : Math.max(6, top - 146)};
                        }
                        function closeContext() { vm.context = null; }
                        function selectedTextContext() {
                            if (!pdf || !root || vm.busy || vm.run.completed || vm.drawing || vm.addingText) { return; }
                            var selection = window.getSelection();
                            if (!selection || !selection.rangeCount || selection.isCollapsed) {
                                if (vm.context && vm.context.draft) { closeContext(); }
                                return;
                            }
                            var range = selection.getRangeAt(0), node = range.startContainer;
                            var start = node.nodeType === 1 ? node : node.parentElement;
                            var sheet = start && start.closest('[data-pdf-page]');
                            if (!sheet || !root.contains(sheet) || !sheet.contains(range.endContainer) || !start.closest('.textLayer')) { return; }
                            var quote = selection.toString().trim().slice(0, 1000);
                            if (!quote) { return; }
                            var box = sheet.getBoundingClientRect();
                            var rects = Array.from(range.getClientRects()).filter(function (rect) {
                                return rect.width > 0 && rect.height > 0 && rect.top >= box.top - 2 && rect.bottom <= box.bottom + 2;
                            }).slice(0, 100).map(function (rect) {
                                return {x: (rect.left - box.left) / box.width, y: (rect.top - box.top) / box.height,
                                    w: rect.width / box.width, h: rect.height / box.height};
                            });
                            if (!rects.length) { return; }
                            anchorContext({page: Number(sheet.dataset.pdfPage), quote: quote, rects: rects, highlight: false, note: ''},
                                range.getBoundingClientRect());
                            vm.context.draft = true;
                        }
                        function queueSelection() {
                            if (selectionTimer) { timer.cancel(selectionTimer); }
                            selectionTimer = timer(function () { selectionTimer = null; selectedTextContext(); }, 130);
                        }
                        function saveContextMark() {
                            var context = vm.context;
                            if (context.draft) {
                                vm.state.marks.push(context.mark);
                                context.draft = false;
                            }
                            var selection = window.getSelection();
                            if (selection && !selection.isCollapsed) { selection.removeAllRanges(); }
                        }
                        vm.highlightSelection = function () {
                            if (!vm.context || vm.run.completed) { return; }
                            var mark = vm.context.mark;
                            mark.highlight = mark.highlight === false;
                            if (!mark.highlight && !mark.note && !mark.noteAnchor && !mark.textColor && !vm.context.draft) {
                                vm.removeMark(mark);
                                vm.context.draft = true;
                                return;
                            }
                            saveContextMark(); changed();
                        };
                        vm.colorSelection = function (color) {
                            if (!vm.context || vm.run.completed) { return; }
                            vm.context.mark.textColor = color;
                            saveContextMark(); changed();
                        };
                        vm.noteSelection = function () {
                            if (!vm.context) { return; }
                            if (vm.context.draft) {
                                vm.context.mark.noteAnchor = true;
                                saveContextMark(); changed();
                            }
                            vm.context.showNote = true;
                            timer(function () {
                                var input = root.querySelector('.teaching-pdf-inline-note textarea');
                                if (input && !vm.run.completed) { input.focus(); }
                            });
                        };
                        vm.removeContextMark = function () {
                            if (!vm.context) { return; }
                            vm.removeMark(vm.context.mark); closeContext();
                        };
                        function clearTextSelection() {
                            var selection = window.getSelection();
                            if (selection && !selection.isCollapsed) { selection.removeAllRanges(); }
                        }
                        vm.startText = function () {
                            vm.addingText = !vm.addingText;
                            vm.drawing = false;
                            clearTextSelection();
                            closeContext();
                        };
                        vm.togglePen = function () {
                            vm.drawing = !vm.drawing;
                            vm.addingText = false;
                            clearTextSelection();
                            closeContext();
                        };
                        vm.editText = function (mark, event) {
                            event.stopPropagation();
                            if (vm.run.completed) { return; }
                            vm.editingText = mark;
                            timer(function () {
                                var input = root.querySelector('.teaching-pdf-free-text textarea');
                                if (input) { input.focus(); }
                            });
                        };
                        vm.finishText = function (mark) {
                            if (vm.editingText === mark) { vm.editingText = null; }
                            if (!(mark.text || '').trim()) { vm.removeMark(mark); }
                        };
                        vm.toggleNotes = function () { vm.notesOpen = !vm.notesOpen; closeContext(); };
                        vm.pageHasMarks = function () {
                            return vm.state.marks.some(function (mark) { return mark.page === vm.state.page; });
                        };
                        vm.removeMark = function (mark) {
                            var index = vm.state.marks.indexOf(mark);
                            if (index < 0 || vm.run.completed) { return; }
                            vm.state.marks.splice(index, 1); vm.selectedMark = null; changed();
                        };
                        vm.markChanged = changed;

                        function point(event, target) {
                            var box = target.getBoundingClientRect();
                            return [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)).toFixed(4),
                                Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)).toFixed(4)];
                        }
                        function onPointer(event) {
                            var overlay = event.target.closest('.teaching-pdf-ink');
                            if (!overlay || !vm.drawing || !vm.run || vm.run.completed || vm.busy) { return; }
                            if (event.type === 'pointerdown' && event.isPrimary && event.button === 0) {
                                overlay.setPointerCapture(event.pointerId);
                                stroke = {page: Number(overlay.closest('[data-pdf-page]').dataset.pdfPage), points: [point(event, overlay)], pointerId: event.pointerId};
                            } else if (stroke && stroke.pointerId === event.pointerId) {
                                if (event.type === 'pointermove' && stroke.points.length < 1000) { stroke.points.push(point(event, overlay)); }
                                if (event.type === 'pointerup' || event.type === 'pointercancel') {
                                    if (stroke.points.length > 1) { vm.state.marks.push(stroke); changed(); }
                                    stroke = null;
                                }
                            }
                            scope.$evalAsync(function () { vm.stroke = stroke; });
                        }
                        vm.inkPoints = function (mark) {
                            return mark.points.map(function (p) { return (1000 * p[0]) + ',' + (1000 * p[1]); }).join(' ');
                        };

                        function onScroll(event) {
                            var container = event.target;
                            if (container !== viewport() || !pdf || layoutPending || scrollFrame) { return; }
                            scrollFrame = window.requestAnimationFrame(function () {
                                scrollFrame = null;
                                scope.$evalAsync(function () {
                                    if (!pdf || layoutPending || destroyed) { return; }
                                    var page = pageAt(container, container.scrollTop + 2);
                                    var sheet = sheetFor(page);
                                    if (!sheet) { return; }
                                    var x = container.scrollLeft / sheet.clientWidth;
                                    var y = Math.max(0, container.scrollTop - sheet.offsetTop) / sheet.clientHeight;
                                    if (vm.state.page !== page) {
                                        vm.selectedMark = null;
                                        if (vm.editingText) { vm.finishText(vm.editingText); }
                                    }
                                    if (vm.state.page !== page || vm.state.x !== x || vm.state.y !== y) {
                                        vm.state.page = page; vm.pageInput = page;
                                        vm.state.x = x; vm.state.y = y; closeContext(); changed();
                                    }
                                    updateBatch();
                                });
                            });
                        }

                        var pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
                        function onPageClick(event) {
                            var selection = window.getSelection();
                            if (event.target.closest('.teaching-pdf-context, .teaching-pdf-inline-note, .teaching-pdf-free-text')) { return; }
                            if (selection && !selection.isCollapsed) { return; }
                            var sheet = event.target.closest('[data-pdf-page]');
                            if (!sheet || vm.drawing || vm.busy) {
                                scope.$evalAsync(closeContext); return;
                            }
                            var position = point(event, sheet).map(Number);
                            var page = Number(sheet.dataset.pdfPage);
                            if (vm.addingText && !vm.run.completed) {
                                scope.$evalAsync(function () {
                                    if (vm.editingText) { vm.finishText(vm.editingText); }
                                    var mark = {page: page, x: position[0], y: position[1], text: ''};
                                    vm.state.marks.push(mark);
                                    vm.addingText = false;
                                    vm.editText(mark, event);
                                });
                                return;
                            }
                            var marks = vm.state.marks;
                            for (var index = marks.length - 1; index >= 0; index--) {
                                var mark = marks[index];
                                if (mark.page === page && (mark.rects || []).some(function (rect) {
                                    return position[0] >= rect.x && position[0] <= rect.x + rect.w
                                        && position[1] >= rect.y && position[1] <= rect.y + rect.h;
                                })) {
                                    scope.$evalAsync(function () {
                                        if (vm.context && vm.context.mark === mark) { closeContext(); return; }
                                        anchorContext(mark, {left: event.clientX, right: event.clientX, top: event.clientY, bottom: event.clientY});
                                        vm.context.showNote = vm.run.completed || !!(mark.note || mark.noteAnchor);
                                    });
                                    return;
                                }
                            }
                            scope.$evalAsync(closeContext);
                        }
                        vm.bindSurface = function (node) {
                            root = node;
                            pointerEvents.forEach(function (name) { root.addEventListener(name, onPointer); });
                            root.addEventListener('scroll', onScroll, true);
                            root.addEventListener('input', onZoom);
                            root.addEventListener('change', onZoom);
                            root.addEventListener('click', onPageClick);
                            document.addEventListener('selectionchange', queueSelection);
                        };
                        function preventUnsavedExit(event) {
                            if (editId !== savedEditId || saveRequest) {
                                event.preventDefault(); event.returnValue = true;
                            }
                        }
                        window.addEventListener('beforeunload', preventUnsavedExit);
                        scope.$on('$destroy', function () {
                            destroyed = true; release();
                            if (saveTimer) { timer.cancel(saveTimer); }
                            window.removeEventListener('beforeunload', preventUnsavedExit);
                            if (root) {
                                root.removeEventListener('scroll', onScroll, true);
                                root.removeEventListener('click', onPageClick);
                                root.removeEventListener('input', onZoom);
                                root.removeEventListener('change', onZoom);
                                document.removeEventListener('selectionchange', queueSelection);
                                if (selectionTimer) { timer.cancel(selectionTimer); }
                                pointerEvents.forEach(function (name) { root.removeEventListener(name, onPointer); });
                            }
                        });
                        load().then(function () {
                            if (destroyed) { return; }
                            if (currentRun && vm.current.some(function (run) { return run.id === currentRun; })) {
                                vm.open(currentRun);
                            } else if (previousRun && vm.previous.some(function (run) { return run.id === previousRun; })) {
                                vm.attach({previousRun: previousRun});
                            }
                        });
                    }]
                }).result;
            }};
        }
    ]).directive('teachingPdfSurface', function () {
        return {link: function (scope, element) { scope.pdf.bindSurface(element[0]); }};
    });
})();
