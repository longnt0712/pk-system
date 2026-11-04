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
                        var vm = this, root, pdf, api, loadingTask, renderTask, textLayer, saveTimer, saveRequest;
                        var renderId = 0, editId = 0, savedEditId = 0, destroyed = false, stroke;
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
                                return open(response.data.id);
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
                                api = data[2];
                                loadingTask = api.getDocument({data: data[1].data, isEvalSupported: false, enableXfa: false,
                                    cMapUrl: new URL('cmaps/', pdfAssets).href, cMapPacked: true,
                                    standardFontDataUrl: new URL('standard_fonts/', pdfAssets).href,
                                    wasmUrl: new URL('wasm/', pdfAssets).href, maxImageSize: 16000000});
                                return $q.when(loadingTask.promise).then(function (doc) {
                                    if (destroyed) { return; }
                                    pdf = doc; vm.pageCount = doc.numPages;
                                    vm.state.page = Math.max(1, Math.min(vm.state.page, doc.numPages));
                                    return timer(function () { return render(true); });
                                });
                            }).catch(function (error) {
                                fail(error, 'Không mở được PDF. Hãy kiểm tra tệp có bị khóa hoặc hỏng.');
                                release(); vm.run = null;
                            });
                        }

                        function viewport() { return root.querySelector('.teaching-pdf-scroll'); }
                        function render(restore) {
                            if (!pdf) { return; }
                            var stamp = ++renderId;
                            if (renderTask) { renderTask.cancel(); }
                            if (textLayer) { textLayer.cancel(); }
                            var container = viewport();
                            if (!container) { return; }
                            var sheet = container.querySelector('.teaching-pdf-page');
                            var canvas = sheet.querySelector('canvas'), text = sheet.querySelector('.textLayer');
                            vm.pageInput = vm.state.page; vm.rendering = true;
                            return $q.when(pdf.getPage(vm.state.page)).then(function (page) {
                                if (destroyed || stamp !== renderId) { return; }
                                var original = page.getViewport({scale: 1});
                                var scale = Math.min(1.5, Math.max(240, container.clientWidth - 28) / original.width) * vm.state.zoom;
                                var view = page.getViewport({scale: scale});
                                var pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12000000 / (view.width * view.height)));
                                sheet.style.width = view.width + 'px'; sheet.style.height = view.height + 'px';
                                sheet.style.setProperty('--scale-factor', String(scale));
                                sheet.style.setProperty('--total-scale-factor', String(scale * view.userUnit));
                                canvas.width = Math.max(1, Math.floor(view.width * pixelRatio));
                                canvas.height = Math.max(1, Math.floor(view.height * pixelRatio));
                                text.replaceChildren();
                                renderTask = page.render({canvas: canvas, viewport: view, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]});
                                textLayer = new api.TextLayer({textContentSource: page.streamTextContent(), container: text, viewport: view});
                                text.style.width = view.rawDims.pageWidth * scale * view.userUnit + 'px';
                                text.style.height = view.rawDims.pageHeight * scale * view.userUnit + 'px';
                                return $q.all([renderTask.promise, textLayer.render()]).then(function () {
                                    if (destroyed || stamp !== renderId) { return; }
                                    container.scrollLeft = restore ? vm.state.x * sheet.clientWidth : 0;
                                    container.scrollTop = restore ? vm.state.y * sheet.clientHeight : 0;
                                });
                            }).catch(function (error) {
                                if (stamp === renderId && !destroyed) { fail(error, 'Không hiển thị được trang PDF.'); }
                            }).finally(function () { if (stamp === renderId) { vm.rendering = false; } });
                        }
                        vm.go = function (page) {
                            page = Math.floor(Number(page));
                            if (!pdf || !Number.isFinite(page)) { return; }
                            page = Math.min(pdf.numPages, Math.max(1, page));
                            if (page === vm.state.page) { return; }
                            vm.state.page = page; vm.state.x = 0; vm.state.y = 0; vm.selectedMark = null;
                            render(false); changed();
                        };
                        vm.zoom = function (step) {
                            vm.state.zoom = Math.max(.5, Math.min(3, Math.round((vm.state.zoom + step) * 10) / 10));
                            render(true); changed();
                        };

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
                            save(true).then(function () { vm.changedDay = true; }).catch(angular.noop)
                                .finally(function () { vm.busy = false; });
                        };

                        function release() {
                            renderId++;
                            if (renderTask) { renderTask.cancel(); renderTask = null; }
                            if (textLayer) { textLayer.cancel(); textLayer = null; }
                            if (loadingTask) { loadingTask.destroy().catch(angular.noop); loadingTask = null; }
                            pdf = null;
                        }
                        function leave(close) {
                            if (vm.busy) { return; }
                            vm.busy = true;
                            save(false).then(function () {
                                release(); vm.run = null; vm.selectedMark = null; vm.drawing = false;
                                editId = savedEditId = 0; vm.saveStatus = '';
                                if (close) { instance.close(vm.changedDay); } else { return load(); }
                            }).catch(angular.noop).finally(function () { vm.busy = false; });
                        }
                        vm.back = function () { leave(false); };
                        vm.close = function () { leave(true); };

                        vm.capture = function () {
                            var selected = window.getSelection();
                            var page = root.querySelector('.teaching-pdf-page');
                            if (!page || vm.rendering || !selected || !selected.rangeCount || selected.isCollapsed
                                || !page.contains(selected.anchorNode) || !page.contains(selected.focusNode)) {
                                vm.error = 'Bôi chọn chữ trên trang PDF trước khi thêm highlight.'; return;
                            }
                            var box = page.getBoundingClientRect();
                            var rects = Array.from(selected.getRangeAt(0).getClientRects()).filter(function (rect) {
                                return rect.width > 0 && rect.height > 0;
                            }).slice(0, 100).map(function (rect) {
                                return {x: (rect.left - box.left) / box.width, y: (rect.top - box.top) / box.height,
                                    w: rect.width / box.width, h: rect.height / box.height};
                            });
                            if (!rects.length) { return; }
                            vm.selectedMark = {page: vm.state.page, quote: selected.toString().trim().slice(0, 1000), rects: rects, note: ''};
                            vm.state.marks.push(vm.selectedMark); selected.removeAllRanges(); changed();
                        };
                        vm.addNote = function () {
                            vm.selectedMark = {page: vm.state.page, note: ''};
                            vm.state.marks.push(vm.selectedMark); changed();
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
                            if (!overlay || !vm.drawing || !vm.run || vm.run.completed || vm.busy || vm.rendering) { return; }
                            if (event.type === 'pointerdown' && event.isPrimary && event.button === 0) {
                                overlay.setPointerCapture(event.pointerId);
                                stroke = {page: vm.state.page, points: [point(event, overlay)], pointerId: event.pointerId};
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
                            var target = event.target;
                            if (target !== viewport() || !pdf || vm.rendering || vm.busy || vm.run.completed) { return; }
                            var page = target.firstElementChild;
                            var x = target.scrollLeft / page.clientWidth, y = target.scrollTop / page.clientHeight;
                            if (vm.state.x === x && vm.state.y === y) { return; }
                            scope.$evalAsync(function () { vm.state.x = x; vm.state.y = y; changed(); });
                        }

                        var pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
                        function openHighlight(event) {
                            var page = event.target.closest('.teaching-pdf-page');
                            var selection = window.getSelection();
                            if (!page || vm.drawing || vm.rendering || (selection && !selection.isCollapsed)) { return; }
                            var position = point(event, page).map(Number);
                            var marks = vm.state.marks;
                            for (var index = marks.length - 1; index >= 0; index--) {
                                var mark = marks[index];
                                if (mark.page === vm.state.page && (mark.rects || []).some(function (rect) {
                                    return position[0] >= rect.x && position[0] <= rect.x + rect.w
                                        && position[1] >= rect.y && position[1] <= rect.y + rect.h;
                                })) {
                                    scope.$evalAsync(function () { vm.selectedMark = vm.selectedMark === mark ? null : mark; });
                                    return;
                                }
                            }
                            scope.$evalAsync(function () { vm.selectedMark = null; });
                        }
                        vm.bindSurface = function (node) {
                            root = node;
                            pointerEvents.forEach(function (name) { root.addEventListener(name, onPointer); });
                            root.addEventListener('scroll', onScroll, true);
                            root.addEventListener('click', openHighlight);
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
                                root.removeEventListener('click', openHighlight);
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
