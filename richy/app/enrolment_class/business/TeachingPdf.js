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
            function saveRun(url, state, revision, completed) {
                return http.put(url, {state: state, revision: revision, completed: completed}).then(function (response) {
                    if (response.data.revision !== revision + 1 || response.data.completed !== completed) {
                        throw new Error('Invalid save confirmation');
                    }
                    return response.data;
                });
            }

            return {
                list: function (classId, date) {
                    return http.get(sessionUrl(classId, date), {cache: false}).then(function (response) { return response.data; });
                },
                complete: function (classId, date, runId) {
                    var url = sessionUrl(classId, date) + '/run/' + encodeURIComponent(runId);
                    return http.get(url, {cache: false}).then(function (response) {
                        var run = response.data;
                        if (run.completed === true) { return; }
                        var state = run.progress ? JSON.parse(run.progress) : {page: 1, zoom: 1, x: 0, y: 0, marks: []};
                        return saveRun(url, state, run.revision, true);
                    });
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
                        var editId = 0, savedEditId = 0, destroyed = false, inkGesture;
                        var batchSize = 5, renderQueue = [], renderingPages = 0, batchTimer, scrollFrame, zoomTimer, selectionTimer;
                        var layoutPending = false, activeStart = 0, activeEnd = 0;
                        var touchSelection = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
                        var libraryDrag, libraryDropTarget;
                        var lastTextTap;
                        vm.pages = [];
                        vm.textSizes = [12, 14, 16, 18, 22, 26, 32];
                        vm.inkSizes = {pen: '2', eraser: '4'};
                        vm.state = {page: 1, zoom: 1, x: 0, y: 0, marks: []};
                        vm.library = []; vm.folders = []; vm.current = []; vm.previous = [];
                        var foldersById = Object.create(null);
                        var viewKey = 'teaching-pdf-view-mode';
                        vm.libraryView = 'list';
                        try { if (window.localStorage.getItem(viewKey) === 'grid') { vm.libraryView = 'grid'; } } catch (ignore) {}
                        vm.toggleLibraryView = function () {
                            vm.libraryView = vm.libraryView === 'list' ? 'grid' : 'list';
                            try { window.localStorage.setItem(viewKey, vm.libraryView); } catch (ignore) {}
                        };

                        function fail(error, fallback) {
                            vm.error = error && error.data && error.data.message || fallback;
                        }
                        function runUrl() { return base + '/run/' + encodeURIComponent(vm.run.id); }
                        function load() {
                            vm.busy = true; vm.error = '';
                            return http.get(base, {cache: false}).then(function (response) {
                                vm.library = response.data.library || [];
                                vm.foldersEnabled = angular.isArray(response.data.folders);
                                vm.folders = response.data.folders || [];
                                refreshExplorer();
                                vm.current = response.data.current || [];
                                vm.previous = (response.data.previous || []).filter(function (item) {
                                    return !vm.current.some(function (current) { return current.id === item.id; });
                                });
                            }, function (error) { fail(error, 'Không tải được kho PDF.'); })
                                .finally(function () { vm.busy = false; });
                        }

                        function showFolder(folderId) {
                            vm.folderTrail = folderPath(folderId);
                            vm.folderId = vm.folderTrail.length ? vm.folderTrail[vm.folderTrail.length - 1].id : null;
                            vm.visibleFolders = vm.folders.filter(function (folder) { return (folder.parentId || null) === vm.folderId; });
                            vm.visibleFiles = vm.library.filter(function (item) { return (item.folderId || null) === vm.folderId; });
                        }
                        function folderPath(id) {
                            var path = [], folder;
                            while (id && path.length < vm.folders.length && (folder = foldersById[id])) {
                                path.unshift(folder);
                                id = folder.parentId;
                            }
                            return path;
                        }
                        function refreshExplorer() {
                            foldersById = Object.create(null);
                            vm.folders.forEach(function (folder) { foldersById[folder.id] = folder; });
                            showFolder(vm.folderId);
                        }

                        vm.browseFolder = function (folderId) {
                            if (vm.busy) { return; }
                            vm.libraryForm = null;
                            showFolder(folderId);
                        };
                        vm.editLibrary = function (kind, item) {
                            if (vm.busy) { return; }
                            var isFolder = kind === 'folder';
                            var parentId = item ? (isFolder ? item.parentId : item.folderId) : vm.folderId;
                            vm.libraryForm = {kind: kind, id: item && item.id, name: item ? item.name : '', parentId: parentId || null};
                            vm.folderChoices = vm.folders.map(function (folder) {
                                var path = folderPath(folder.id);
                                if (isFolder && item && path.some(function (ancestor) { return ancestor.id === item.id; })) { return null; }
                                return {id: folder.id, path: path.map(function (ancestor) { return ancestor.name; }).join(' / ')};
                            }).filter(Boolean);
                        };
                        vm.saveLibrary = function () {
                            var form = vm.libraryForm;
                            if (!form || !form.name || !form.name.trim() || vm.busy) { return; }
                            return saveLibraryEntry(form);
                        };
                        function saveLibraryEntry(form, move) {
                            var isFolder = form.kind === 'folder';
                            var path = base + (isFolder ? '/folders' : '/files');
                            var data = {name: form.name};
                            var parentKey = isFolder ? 'parentId' : 'folderId';
                            data[parentKey] = form.parentId;
                            vm.busy = true; vm.error = ''; vm.libraryNotice = '';
                            var request = form.id ? http.put(path + '/' + encodeURIComponent(form.id), data) : http.post(path, data);
                            return request.then(function (response) {
                                var saved = response.data;
                                if (!saved || !saved.id || !saved.name || (form.id && saved.id !== form.id) ||
                                        (saved[parentKey] || null) !== (form.parentId || null)) {
                                    vm.error = 'Chưa xác nhận được thay đổi trong kho PDF. Hãy mở lại kho để kiểm tra.';
                                    return;
                                }
                                var entries = isFolder ? vm.folders : vm.library;
                                var existing = entries.find(function (item) { return item.id === saved.id; });
                                saved[parentKey] = saved[parentKey] || null;
                                if (existing) {
                                    if (!isFolder && existing.name !== saved.name) {
                                        vm.changedDay = true;
                                        vm.current.concat(vm.previous).forEach(function (run) {
                                            if (run.pdfId === saved.id) { run.name = saved.name; }
                                        });
                                    }
                                    angular.extend(existing, saved);
                                } else { entries.push(saved); }
                                vm.libraryForm = null;
                                refreshExplorer();
                                if (move) { vm.libraryNotice = 'Đã chuyển ' + saved.name + ' vào ' + (saved[parentKey] ? foldersById[saved[parentKey]].name : 'Kho PDF') + '.'; }
                            }, function (error) { fail(error, 'Không lưu được thay đổi trong kho PDF.'); })
                                .finally(function () { vm.busy = false; });
                        }

                        vm.upload = function (file) {
                            if (file) { return uploadFiles([file], vm.folderId || null); }
                        };
                        function uploadFiles(files, folderId) {
                            if (!files.length || vm.busy || vm.run) { return; }
                            var errors = [], uploaded = 0;
                            vm.busy = true; vm.error = ''; vm.libraryNotice = '';
                            return files.reduce(function (queue, file) {
                                return queue.then(function () {
                                    if ((file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) || file.size > 9 * 1024 * 1024) {
                                        errors.push(file.name + ' (chỉ nhận PDF tối đa 9 MB)');
                                        return;
                                    }
                                    var body = new FormData();
                                    body.append('file', file);
                                    if (folderId) { body.append('folderId', folderId); }
                                    return http.post(base + '/upload', body, {transformRequest: angular.identity, headers: {'Content-Type': undefined}})
                                        .then(function (response) {
                                            var saved = response.data;
                                            if (!saved || !saved.id || !saved.name || (saved.folderId || null) !== folderId) {
                                                errors.push(file.name + ' (chưa xác nhận được)');
                                                return;
                                            }
                                            vm.library.push(saved); vm.selected = saved.id; uploaded++;
                                            showFolder(vm.folderId);
                                        }, function (error) {
                                            errors.push(file.name + (error && error.data && error.data.message ? ' (' + error.data.message + ')' : ''));
                                        });
                                });
                            }, $q.when()).then(function () {
                                if (uploaded) { vm.libraryNotice = 'Đã tải lên ' + uploaded + ' PDF.'; }
                                if (errors.length) { vm.error = 'Không tải lên được: ' + errors.join('; '); }
                            }).finally(function () { vm.busy = false; });
                        }
                        function highlightLibraryDrop(target) {
                            if (libraryDropTarget === target) { return; }
                            if (libraryDropTarget) { libraryDropTarget.classList.remove('is-pdf-drop-target'); }
                            libraryDropTarget = target;
                            if (target) { target.classList.add('is-pdf-drop-target'); }
                        }
                        function endLibraryDrag() {
                            libraryDrag = null;
                            highlightLibraryDrop(null);
                        }
                        function startLibraryDrag(event) {
                            var source = event.target.closest('[data-pdf-drag]');
                            if (!source || !event.dataTransfer || vm.run) { return; }
                            if (vm.busy || vm.libraryForm) { event.preventDefault(); return; }
                            var kind = source.getAttribute('data-pdf-drag');
                            var entries = kind === 'folder' ? vm.visibleFolders : vm.visibleFiles;
                            var entry = entries.find(function (item) { return item.id === source.getAttribute('data-pdf-entry-id'); });
                            if (!entry) { event.preventDefault(); return; }
                            libraryDrag = {kind: kind, entry: entry};
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('application/x-teaching-pdf-item', kind);
                        }
                        function libraryDrop(event) {
                            var transfer = event.dataTransfer;
                            var library = event.target.closest('.teaching-pdf-library');
                            if (!library || !transfer) { return; }
                            var external = Array.prototype.indexOf.call(transfer.types || [], 'Files') !== -1;
                            if (!external && !libraryDrag) { return; }
                            event.preventDefault();
                            var folder = event.target.closest('[data-pdf-destination]');
                            var folderId = folder ? folder.getAttribute('data-pdf-destination') || null : vm.folderId || null;
                            var drag = libraryDrag;
                            var parentKey = drag && drag.kind === 'folder' ? 'parentId' : 'folderId';
                            var canMove = drag && folder && (drag.entry[parentKey] || null) !== folderId
                                && (drag.kind !== 'folder' || !folderPath(folderId).some(function (ancestor) { return ancestor.id === drag.entry.id; }));
                            var allowed = !vm.busy && !vm.run && !vm.libraryForm && (external || canMove);
                            var target = allowed ? folder || library.querySelector('.teaching-pdf-upload-area') : null;
                            if (event.type === 'dragover') {
                                transfer.dropEffect = allowed ? (external ? 'copy' : 'move') : 'none';
                                highlightLibraryDrop(target);
                                return;
                            }
                            endLibraryDrag();
                            if (!allowed) { return; }
                            var files = external && Array.prototype.slice.call(transfer.files);
                            scope.$evalAsync(function () {
                                if (destroyed || vm.busy || vm.run || vm.libraryForm || (folderId && !foldersById[folderId])) { return; }
                                if (external) { uploadFiles(files, folderId); }
                                else { saveLibraryEntry({kind: drag.kind, id: drag.entry.id, name: drag.entry.name, parentId: folderId}, true); }
                            });
                        }
                        function leaveLibraryDrop(event) {
                            if (libraryDropTarget && libraryDropTarget.contains(event.target) &&
                                    !libraryDropTarget.contains(event.relatedTarget)) { highlightLibraryDrop(null); }
                        }
                        var libraryDragEvents = {
                            dragstart: startLibraryDrag, dragover: libraryDrop, drop: libraryDrop,
                            dragleave: leaveLibraryDrop, dragend: endLibraryDrag
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
                                    vm.current.push({id: id, pdfId: choice.pdfId || selected.pdfId, name: selected.name, completed: false});
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
                                vm.state.newTextSize = validTextSize(vm.state.newTextSize);
                                vm.state.marks.forEach(function (mark) {
                                    if (mark.textColor) {
                                        mark.highlightColor = mark.highlightColor || mark.textColor;
                                        mark.highlight = true;
                                        delete mark.textColor;
                                    }
                                });
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
                            if (vm.textDrag && vm.textDrag.mark.page === item.number) { endTextDrag(); }
                            if (inkGesture && inkGesture.page === item.number) { finishInk(false); }
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
                            vm.state.zoom = zoom;
                            refitPages();
                            changed();
                        };
                        function refitPages() {
                            if (!pdf || destroyed) { return; }
                            layoutPending = true;
                            closeContext();
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
                        }
                        vm.zoom = function (step) { vm.setZoom(vm.state.zoom + step); };
                        function nativeFullscreen() {
                            return !!root && (document.fullscreenElement || document.webkitFullscreenElement) === root;
                        }
                        function applyFullscreen(active) {
                            if (!!vm.fullscreen === active) { return; }
                            vm.fullscreen = active;
                            var modalWindow = root && root.closest('.teaching-pdf-window');
                            if (modalWindow) { modalWindow.classList.toggle('is-pdf-fullscreen', active); }
                            if (!pdf || destroyed) { return; }
                            layoutPending = true;
                            timer(refitPages);
                        }
                        function fullscreenChanged() {
                            if (!vm.fullscreen && !nativeFullscreen()) { return; }
                            scope.$evalAsync(function () { applyFullscreen(nativeFullscreen()); });
                        }
                        function exitFullscreen() {
                            if (nativeFullscreen()) {
                                var exit = document.exitFullscreen || document.webkitExitFullscreen;
                                if (exit) { $q.when(exit.call(document)).catch(angular.noop); }
                            }
                            applyFullscreen(false);
                        }
                        vm.toggleFullscreen = function () {
                            if (!pdf || vm.busy) { return; }
                            if (vm.fullscreen || nativeFullscreen()) { exitFullscreen(); return; }
                            var request = root.requestFullscreen || root.webkitRequestFullscreen;
                            if (!request) { applyFullscreen(true); return; }
                            function useViewport() {
                                if (pdf && !destroyed) { scope.$evalAsync(function () { applyFullscreen(true); }); }
                            }
                            try {
                                $q.when(request.call(root)).catch(useViewport);
                            } catch (error) { useViewport(); }
                        };
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
                            saveTimer = timer(function () { save().catch(angular.noop); }, 700);
                        }
                        function save() {
                            if (saveTimer) { timer.cancel(saveTimer); saveTimer = null; }
                            if (!vm.run || vm.run.completed) { return $q.when(); }
                            if (saveRequest) { return saveRequest.then(function () { return save(); }); }
                            if (editId === savedEditId) { return $q.when(); }
                            var sent = editId, revision = vm.run.revision;
                            vm.saveStatus = 'Đang đồng bộ…';
                            saveRequest = saveRun(runUrl(), angular.copy(vm.state), revision, false)
                                .then(function (saved) {
                                    vm.run.revision = saved.revision;
                                    savedEditId = sent;
                                    vm.saveStatus = sent === editId ? 'Đã đồng bộ' : 'Chờ đồng bộ';
                                }).catch(function (error) {
                                    vm.saveStatus = 'Chưa lưu';
                                    fail(error, 'Chưa lưu được tiến trình. Bấm Lưu lại để thử lại.');
                                    return $q.reject(error);
                                }).finally(function () { saveRequest = null; });
                            return saveRequest;
                        }
                        vm.save = function () { vm.error = ''; save().catch(angular.noop); };


                        function release() {
                            endTextDrag();
                            finishInk(false);
                            lastTextTap = null;
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
                            save().then(function () {
                                release(); exitFullscreen(); vm.run = null; vm.selectedMark = null; vm.inkTool = null; vm.notesOpen = false; vm.addingText = false; vm.editingText = null;
                                editId = savedEditId = 0; vm.saveStatus = '';
                                if (close) { instance.close(vm.changedDay); } else { return load(); }
                            }).catch(angular.noop).finally(function () { vm.busy = false; });
                        }
                        vm.back = function () { leave(false); };
                        vm.close = function () { leave(true); };

                        vm.highlightColors = [
                            {name: 'Đỏ đất nhạt', value: '#e6b8af'}, {name: 'Hồng nhạt', value: '#f4cccc'},
                            {name: 'Cam nhạt', value: '#fce5cd'}, {name: 'Vàng nhạt', value: '#fff2cc'},
                            {name: 'Xanh lá nhạt', value: '#d9ead3'}, {name: 'Xanh ngọc nhạt', value: '#d0e0e3'},
                            {name: 'Xanh lam nhạt', value: '#c9daf8'}, {name: 'Xanh da trời nhạt', value: '#cfe2f3'},
                            {name: 'Tím nhạt', value: '#d9d2e9'}, {name: 'Hồng tím nhạt', value: '#ead1dc'}
                        ];
                        vm.highlightOpacity = function (value) {
                            return vm.highlightColors.some(function (color) { return color.value === value; }) ? 1 : .38;
                        };
                        function placeContextPanel(panel, bounds, area, preferAbove, gap) {
                            var width = panel.offsetWidth, height = panel.offsetHeight;
                            var x = Math.max(8, Math.min(area.width - width - 8, (bounds.left + bounds.right - width) / 2));
                            var above = bounds.top - height - gap, below = bounds.bottom + gap;
                            if (above >= 4 && (preferAbove || below + height > area.height - 4)) { return {x: x, y: above}; }
                            if (below + height <= area.height - 4) { return {x: x, y: below}; }
                            var y = Math.max(4, Math.min(area.height - height - 4, (bounds.top + bounds.bottom - height) / 2));
                            if (bounds.right + gap + width <= area.width - 4) { return {x: bounds.right + gap, y: y}; }
                            if (bounds.left - gap - width >= 4) { return {x: bounds.left - gap - width, y: y}; }
                            return {x: x, y: above};
                        }
                        function positionContext() {
                            var context = vm.context, container = viewport();
                            if (!context || !container) { return; }
                            var area = container.getBoundingClientRect(), rect = context.rect;
                            var bounds = {left: rect.left - area.left, right: rect.right - area.left,
                                top: rect.top - area.top, bottom: rect.bottom - area.top};
                            var menu = root.querySelector('.teaching-pdf-context');
                            var note = root.querySelector('.teaching-pdf-inline-note');
                            if (menu) {
                                context.menu = placeContextPanel(menu, bounds, area, true, 10);
                                if (context.draft && touchSelection) {
                                    var upper = (bounds.top + bounds.bottom) / 2 > area.height / 2;
                                    var edge = upper ? 8 : area.height - menu.offsetHeight - 8;
                                    if (edge + menu.offsetHeight + 8 <= bounds.top || edge >= bounds.bottom + 8) {
                                        context.menu.y = edge;
                                    }
                                }
                                if (context.menu.y >= bounds.bottom) {
                                    bounds.bottom = context.menu.y + menu.offsetHeight;
                                } else if (context.menu.y + menu.offsetHeight <= bounds.top) {
                                    bounds.top = context.menu.y;
                                } else {
                                    bounds.left = Math.min(bounds.left, context.menu.x);
                                    bounds.right = Math.max(bounds.right, context.menu.x + menu.offsetWidth);
                                }
                            }
                            if (note) { context.note = placeContextPanel(note, bounds, area, false, 8); }
                        }
                        function anchorContext(mark, rect) {
                            vm.context = {mark: mark, rect: rect};
                            timer(positionContext);
                        }
                        function markBounds(mark, sheet) {
                            var page = sheet.getBoundingClientRect();
                            var bounds = {left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity};
                            mark.rects.forEach(function (rect) {
                                bounds.left = Math.min(bounds.left, page.left + rect.x * page.width);
                                bounds.right = Math.max(bounds.right, page.left + (rect.x + rect.w) * page.width);
                                bounds.top = Math.min(bounds.top, page.top + rect.y * page.height);
                                bounds.bottom = Math.max(bounds.bottom, page.top + (rect.y + rect.h) * page.height);
                            });
                            return bounds;
                        }
                        function closeContext() { vm.context = null; }
                        function selectedTextContext() {
                            if (!pdf || !root || vm.busy || vm.run.completed || vm.inkTool || vm.addingText) { return; }
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
                            if (!mark.highlight && !mark.note && !mark.noteAnchor && !vm.context.draft) {
                                vm.removeMark(mark);
                                vm.context.draft = true;
                                return;
                            }
                            saveContextMark(); changed();
                        };
                        vm.colorSelection = function (color) {
                            if (!vm.context || vm.run.completed) { return; }
                            vm.context.mark.highlightColor = color;
                            vm.context.mark.highlight = true;
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
                                positionContext();
                                var input = root.querySelector('.teaching-pdf-inline-note textarea');
                                if (input && !vm.run.completed) { input.focus(); }
                            });
                        };
                        vm.removeContextMark = function () {
                            if (!vm.context) { return; }
                            vm.removeMark(vm.context.mark); closeContext();
                        };
                        vm.removeInlineNote = function () {
                            if (!vm.context || !vm.run || vm.run.completed || vm.busy) { return; }
                            var mark = vm.context.mark;
                            if (mark.highlight === false) {
                                vm.removeMark(mark);
                            } else if (mark.note || mark.noteAnchor) {
                                delete mark.note;
                                delete mark.noteAnchor;
                                changed();
                            }
                            closeContext();
                        };
                        function clearTextSelection() {
                            var selection = window.getSelection();
                            if (selection && !selection.isCollapsed) { selection.removeAllRanges(); }
                        }
                        vm.startText = function () {
                            finishInk(false);
                            vm.addingText = !vm.addingText;
                            vm.inkTool = null;
                            clearTextSelection();
                            closeContext();
                        };
                        vm.toggleInk = function (tool) {
                            finishInk(false);
                            vm.inkTool = vm.inkTool === tool ? null : tool;
                            vm.addingText = false;
                            clearTextSelection();
                            closeContext();
                        };
                        vm.editText = function (mark, event) {
                            event.stopPropagation();
                            if (!vm.run || vm.run.completed || vm.busy) { return; }
                            if (vm.editingText && vm.editingText !== mark) { vm.finishText(vm.editingText); }
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
                            if (index < 0 || !vm.run || vm.run.completed) { return; }
                            if (vm.editingText === mark) { vm.editingText = null; }
                            if (vm.textDrag && vm.textDrag.mark === mark) { endTextDrag(); }
                            vm.state.marks.splice(index, 1); vm.selectedMark = null; changed();
                        };
                        vm.markChanged = changed;

                        function validTextSize(size) { return vm.textSizes.indexOf(size) >= 0 ? size : 14; }
                        vm.textFontSize = function (mark) { return validTextSize(mark.fontSize) + 'px'; };
                        vm.beginTextDrag = function (mark, event) {
                            if (!vm.run || vm.run.completed || vm.busy || vm.inkTool || vm.textDrag ||
                                    vm.editingText === mark || !event.isPrimary || event.button !== 0) { return; }
                            var label = event.currentTarget;
                            var sheet = label.closest('[data-pdf-page]');
                            var box = label.closest('.teaching-pdf-free-text').getBoundingClientRect();
                            event.preventDefault();
                            label.setPointerCapture(event.pointerId);
                            vm.textDrag = {
                                mark: mark, label: label, sheet: sheet, pointerId: event.pointerId,
                                startX: event.clientX, startY: event.clientY,
                                offsetX: event.clientX - box.left, offsetY: event.clientY - box.top,
                                width: box.width, height: box.height, threshold: event.pointerType === 'touch' ? 8 : 3
                            };
                            vm.addingText = false;
                            closeContext();
                            clearTextSelection();
                            scope.$evalAsync(angular.noop);
                        };
                        function endTextDrag() {
                            var drag = vm.textDrag;
                            vm.textDrag = null;
                            if (drag && drag.label.hasPointerCapture(drag.pointerId)) {
                                drag.label.releasePointerCapture(drag.pointerId);
                            }
                        }
                        function textDragPointer(event, drag) {
                            if (event.type === 'pointermove' || event.type === 'pointerup') {
                                if (drag.position || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= drag.threshold) {
                                    lastTextTap = null;
                                    var page = drag.sheet.getBoundingClientRect();
                                    var width = Math.min(1, drag.width / page.width);
                                    var height = Math.min(1, drag.height / page.height);
                                    var x = Math.max(0, Math.min(1 - width, (event.clientX - drag.offsetX - page.left) / page.width));
                                    var y = Math.max(0, Math.min(1 - height, (event.clientY - drag.offsetY - page.top) / page.height));
                                    drag.position = {x: x, y: y};
                                    if (event.type === 'pointerup') {
                                        // Saved anchors near an edge use the right or bottom of the text box.
                                        drag.mark.x = x > .76 ? x + width : x;
                                        drag.mark.y = y > .9 ? y + height : y;
                                        changed();
                                    }
                                } else if (event.type === 'pointerup') {
                                    var doubleTap = lastTextTap && lastTextTap.mark === drag.mark && event.timeStamp - lastTextTap.time <= 450;
                                    lastTextTap = doubleTap ? null : {mark: drag.mark, time: event.timeStamp};
                                    if (doubleTap) { vm.editText(drag.mark, event); }
                                }
                            } else {
                                lastTextTap = null;
                            }
                            if (event.type !== 'pointermove') { endTextDrag(); }
                            scope.$evalAsync(angular.noop);
                        }
                        vm.textPosition = function (mark) {
                            var drag = vm.textDrag;
                            return drag && drag.mark === mark && drag.position ? drag.position : mark;
                        };
                        function point(event, target) {
                            var box = target.getBoundingClientRect();
                            return [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)).toFixed(4),
                                Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)).toFixed(4)];
                        }
                        function startInk(event, overlay) {
                            var page = Number(overlay.closest('[data-pdf-page]').dataset.pdfPage);
                            var gesture = inkGesture = {page: page, overlay: overlay, pointerId: event.pointerId};
                            if (vm.inkTool === 'pen') {
                                gesture.stroke = {page: page, width: vm.inkWidth({width: vm.inkSizes.pen}), points: []};
                                vm.stroke = gesture.stroke;
                            } else {
                                gesture.erased = new Set();
                                gesture.radius = {'2': 8, '4': 14, '7': 22}[vm.inkSizes.eraser] || 14;
                                var box = overlay.getBoundingClientRect();
                                gesture.candidates = vm.state.marks.filter(function (mark) {
                                    return mark.page === page && angular.isArray(mark.points) && mark.points.length;
                                }).map(function (mark) {
                                    var bounds = {left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity};
                                    var points = mark.points.map(function (p) {
                                        var x = p[0] * box.width, y = p[1] * box.height;
                                        bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
                                        bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
                                        return {x: x, y: y};
                                    });
                                    return {mark: mark, points: points, bounds: bounds, radius: gesture.radius + vm.inkWidth(mark) / 2};
                                });
                            }
                            overlay.setPointerCapture(event.pointerId);
                            moveInk(event);
                            scope.$evalAsync(angular.noop);
                        }
                        function pointSegmentDistanceSquared(p, a, b) {
                            var dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
                            var t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
                            var x = p.x - a.x - t * dx, y = p.y - a.y - t * dy;
                            return x * x + y * y;
                        }
                        function sideOfSegment(a, b, p) {
                            return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
                        }
                        function sweepHitsStroke(from, to, candidate) {
                            var radius = candidate.radius, bounds = candidate.bounds;
                            if (Math.max(from.x, to.x) + radius < bounds.left || Math.min(from.x, to.x) - radius > bounds.right ||
                                    Math.max(from.y, to.y) + radius < bounds.top || Math.min(from.y, to.y) - radius > bounds.bottom) { return false; }
                            var limit = radius * radius;
                            return candidate.points.some(function (b, index, points) {
                                var a = points[Math.max(0, index - 1)];
                                return (sideOfSegment(from, to, a) * sideOfSegment(from, to, b) < 0 &&
                                    sideOfSegment(a, b, from) * sideOfSegment(a, b, to) < 0) ||
                                    pointSegmentDistanceSquared(to, a, b) <= limit || pointSegmentDistanceSquared(from, a, b) <= limit ||
                                    pointSegmentDistanceSquared(a, from, to) <= limit || pointSegmentDistanceSquared(b, from, to) <= limit;
                            });
                        }
                        function moveInk(event) {
                            var gesture = inkGesture;
                            if (gesture.stroke) {
                                var points = gesture.stroke.points, next = point(event, gesture.overlay), last = points[points.length - 1];
                                if (points.length < 1000 && (!last || last[0] !== next[0] || last[1] !== next[1])) { points.push(next); }
                                return;
                            }
                            var box = gesture.overlay.getBoundingClientRect();
                            var to = {x: event.clientX - box.left, y: event.clientY - box.top};
                            var from = gesture.previous || to;
                            gesture.candidates.forEach(function (candidate) {
                                if (!gesture.erased.has(candidate.mark) && sweepHitsStroke(from, to, candidate)) {
                                    gesture.erased.add(candidate.mark);
                                }
                            });
                            gesture.previous = to;
                        }
                        function finishInk(commit) {
                            var gesture = inkGesture;
                            if (!gesture) { return; }
                            inkGesture = null; vm.stroke = null;
                            if (gesture.overlay.hasPointerCapture(gesture.pointerId)) { gesture.overlay.releasePointerCapture(gesture.pointerId); }
                            if (!commit) { return; }
                            if (gesture.stroke && gesture.stroke.points.length > 1) {
                                vm.state.marks.push(gesture.stroke); changed();
                            } else if (gesture.erased && gesture.erased.size) {
                                vm.state.marks = vm.state.marks.filter(function (mark) { return !gesture.erased.has(mark); });
                                changed();
                            }
                        }
                        function onContextMenu(event) {
                            if (vm.run && !vm.run.completed && !vm.inkTool && !vm.addingText && !vm.busy
                                && (touchSelection || event.pointerType === 'touch' || event.pointerType === 'pen')
                                && event.target.closest('.textLayer') && event.cancelable) {
                                event.preventDefault();
                            }
                        }
                        function onPointer(event) {
                            if (vm.textDrag && event.pointerId === vm.textDrag.pointerId && event.type !== 'pointerdown') {
                                textDragPointer(event, vm.textDrag);
                                return;
                            }
                            if (event.type === 'pointerdown') {
                                var touch = event.pointerType === 'touch' || event.pointerType === 'pen';
                                if (event.target.closest('.textLayer')) { touchSelection = touch; }
                                if (touch && vm.context && vm.context.draft && event.target.closest('.teaching-pdf-context') && event.cancelable) {
                                    event.preventDefault();
                                }
                            }
                            if (event.type === 'pointerdown') {
                                var overlay = event.target.closest('.teaching-pdf-ink');
                                if (overlay && vm.inkTool && vm.run && !vm.run.completed && !vm.busy &&
                                        !inkGesture && event.isPrimary && event.button === 0) {
                                    startInk(event, overlay);
                                }
                            } else if (inkGesture && inkGesture.pointerId === event.pointerId) {
                                if (event.type === 'pointermove' || event.type === 'pointerup') { moveInk(event); }
                                if (event.type !== 'pointermove') {
                                    finishInk(event.type === 'pointerup' || event.type === 'pointercancel' && !!inkGesture.stroke);
                                }
                                scope.$evalAsync(angular.noop);
                            }
                        }
                        vm.inkWidth = function (mark) {
                            var width = Number(mark.width);
                            return width === 4 || width === 7 ? width : 2;
                        };
                        vm.inkErased = function (mark) { return !!(inkGesture && inkGesture.erased && inkGesture.erased.has(mark)); };
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

                        var pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'];
                        function onPageClick(event) {
                            var selection = window.getSelection();
                            if (event.target.closest('.teaching-pdf-context, .teaching-pdf-inline-note, .teaching-pdf-free-text')) { return; }
                            if (selection && !selection.isCollapsed) { return; }
                            var sheet = event.target.closest('[data-pdf-page]');
                            if (!sheet || vm.inkTool || vm.busy) {
                                scope.$evalAsync(closeContext); return;
                            }
                            var position = point(event, sheet).map(Number);
                            var page = Number(sheet.dataset.pdfPage);
                            if (vm.addingText && !vm.run.completed) {
                                scope.$evalAsync(function () {
                                    if (vm.editingText) { vm.finishText(vm.editingText); }
                                    var mark = {page: page, x: position[0], y: position[1], text: '', fontSize: validTextSize(vm.state.newTextSize)};
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
                                        anchorContext(mark, markBounds(mark, sheet));
                                        vm.context.showNote = vm.run.completed || !!(mark.note || mark.noteAnchor);
                                    });
                                    return;
                                }
                            }
                            scope.$evalAsync(closeContext);
                        }
                        vm.bindSurface = function (node) {
                            root = node;
                            Object.keys(libraryDragEvents).forEach(function (name) { root.addEventListener(name, libraryDragEvents[name]); });
                            pointerEvents.forEach(function (name) { root.addEventListener(name, onPointer); });
                            root.addEventListener('scroll', onScroll, true);
                            root.addEventListener('input', onZoom);
                            root.addEventListener('change', onZoom);
                            root.addEventListener('click', onPageClick);
                            root.addEventListener('contextmenu', onContextMenu);
                            document.addEventListener('selectionchange', queueSelection);
                            document.addEventListener('fullscreenchange', fullscreenChanged);
                            document.addEventListener('webkitfullscreenchange', fullscreenChanged);
                        };
                        function preventUnsavedExit(event) {
                            if (editId !== savedEditId || saveRequest) {
                                event.preventDefault(); event.returnValue = true;
                            }
                        }
                        window.addEventListener('beforeunload', preventUnsavedExit);
                        scope.$on('$destroy', function () {
                            destroyed = true; release(); exitFullscreen();
                            if (saveTimer) { timer.cancel(saveTimer); }
                            window.removeEventListener('beforeunload', preventUnsavedExit);
                            if (root) {
                                endLibraryDrag();
                                Object.keys(libraryDragEvents).forEach(function (name) { root.removeEventListener(name, libraryDragEvents[name]); });
                                root.removeEventListener('scroll', onScroll, true);
                                root.removeEventListener('click', onPageClick);
                                root.removeEventListener('contextmenu', onContextMenu);
                                root.removeEventListener('input', onZoom);
                                root.removeEventListener('change', onZoom);
                                document.removeEventListener('selectionchange', queueSelection);
                                document.removeEventListener('fullscreenchange', fullscreenChanged);
                                document.removeEventListener('webkitfullscreenchange', fullscreenChanged);
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
    }).directive('teachingPdfTextDrag', function () {
        return {link: function (scope, element) {
            function start(event) { scope.pdf.beginTextDrag(scope.mark, event); }
            element[0].addEventListener('pointerdown', start);
            scope.$on('$destroy', function () { element[0].removeEventListener('pointerdown', start); });
        }};
    });
})();
