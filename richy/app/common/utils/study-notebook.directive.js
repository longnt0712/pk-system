(function () {
    'use strict';

    var notebookSerial = 0, openNotebooks = 0;
    angular.module('Hrm.Common').directive('studyNotebook', ['$window', '$timeout', 'StudyNotebookStore',
        function ($window, $timeout, store) {
            return {
                restrict: 'E',
                scope: { testId: '=', testMode: '@', userId: '=', enabled: '=' },
                bindToController: true, controllerAs: 'notebook', controller: function () {}, require: 'studyNotebook',
                template: [
                    '<button type="button" class="study-notebook-toggle" ng-class="{\'is-active\':notebook.isOpen}" ng-click="notebook.toggle()" ng-disabled="!notebook.canOpen()" ng-attr-aria-expanded="{{notebook.isOpen}}" ng-attr-aria-controls="{{notebook.dialogId}}" aria-haspopup="dialog" aria-label="Mở hoặc ẩn sổ ghi chú" title="Sổ ghi chú học tập">',
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h10.5L20 7v13.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M16 3.5V8h4M8 11h8M8 15h6M7 3.5v17"/></svg></button>',
                    '<div class="study-notebook-overlay ng-hide" ng-show="notebook.isOpen" ng-attr-aria-hidden="{{!notebook.isOpen}}">',
                    '<section class="study-notebook-dialog" role="dialog" aria-modal="true" ng-attr-id="{{notebook.dialogId}}" ng-attr-aria-labelledby="{{notebook.dialogId}}-title">',
                    '<header class="study-notebook-heading"><div class="study-notebook-heading__copy"><h2 ng-attr-id="{{notebook.dialogId}}-title">Sổ tay học tập</h2></div>',
                    '<div class="study-notebook-heading__actions"><span class="study-notebook-status" ng-class="\'is-\'+notebook.session.status" role="status" aria-live="polite">{{notebook.statusText()}}</span>',
                    '<button type="button" class="study-notebook-action" ng-click="notebook.save()" ng-disabled="!notebook.session || notebook.session.status===\'loading\' || notebook.session.status===\'conflict\'" title="Lưu ngay"><i class="fa fa-cloud-upload" aria-hidden="true"></i><span>Lưu ngay</span></button>',
                    '<button type="button" class="study-notebook-close" ng-click="notebook.close()" aria-label="Ẩn sổ ghi chú" title="Ẩn sổ ghi chú">&times;</button></div></header>',
                    '<div class="study-notebook-toolbar" role="group" aria-label="Công cụ ghi chú">',
                    '<div class="study-notebook-tools"><button type="button" ng-repeat="tool in notebook.tools" ng-click="notebook.setTool(tool.id)" ng-class="{\'is-active\':notebook.tool===tool.id}" ng-attr-aria-pressed="{{notebook.tool===tool.id}}" ng-attr-title="{{tool.label}}"><i class="fa" ng-class="tool.icon" aria-hidden="true"></i><span>{{tool.label}}</span></button></div>',
                    '<div class="study-notebook-ink-options"><label class="study-notebook-color" title="Màu bút"><span>Màu</span><input type="color" ng-model="notebook.inkColor" aria-label="Màu bút"></label>',
                    '<label class="study-notebook-stroke"><span>Nét bút</span><select ng-model="notebook.inkWidth" aria-label="Độ rộng nét bút"><option value="2">Mảnh</option><option value="4">Vừa</option><option value="7">Đậm</option></select></label>',
                    '<button type="button" class="study-notebook-history" ng-click="notebook.undo()" ng-disabled="!notebook.canUndo()" title="Hoàn tác nét vẽ" aria-label="Hoàn tác nét vẽ"><i class="fa fa-undo" aria-hidden="true"></i></button>',
                    '<button type="button" class="study-notebook-history" ng-click="notebook.redo()" ng-disabled="!notebook.canRedo()" title="Khôi phục nét vẽ" aria-label="Khôi phục nét vẽ"><i class="fa fa-repeat" aria-hidden="true"></i></button></div>',
                    '<div class="study-notebook-paper-options"><label><span>Khổ giấy A4</span><select ng-model="notebook.session.document.orientation" ng-change="notebook.changed()" ng-disabled="notebook.isLocked()" aria-label="Hướng giấy A4"><option value="portrait">Dọc</option><option value="landscape">Ngang</option></select></label>',
                    '<label><span>Kiểu giấy</span><select ng-model="notebook.session.document.pattern" ng-change="notebook.changed()" ng-disabled="notebook.isLocked()" aria-label="Kiểu kẻ giấy"><option value="blank">Giấy trơn</option><option value="lined">Dòng kẻ ngang</option><option value="vertical">Dòng kẻ dọc</option><option value="grid">Ô ly</option><option value="squares">Ô vuông lớn</option><option value="sketch">Giấy nhám phác thảo</option></select></label></div>',
                    '<div class="study-notebook-zoom" role="group" aria-label="Thu phóng trang giấy"><button type="button" ng-click="notebook.zoomOut()" ng-disabled="notebook.zoomPercent<=50" aria-label="Thu nhỏ trang giấy" title="Thu nhỏ"><i class="fa fa-search-minus" aria-hidden="true"></i></button><output aria-live="polite" aria-label="Mức thu phóng">{{notebook.zoomPercent}}%</output><button type="button" ng-click="notebook.zoomIn()" ng-disabled="notebook.zoomPercent>=200" aria-label="Phóng to trang giấy" title="Phóng to"><i class="fa fa-search-plus" aria-hidden="true"></i></button><button type="button" class="study-notebook-zoom__fit" ng-click="notebook.fitZoom()" title="Đưa trang giấy về vừa màn hình">Vừa trang</button></div></div>',
                    '<div class="study-notebook-notice" ng-if="notebook.session.error || notebook.session.status===\'conflict\'">',
                    '<span>{{notebook.session.error || \'Có bản ghi chú khác vừa được đồng bộ. Chọn bản bạn muốn giữ.\'}}</span>',
                    '<button type="button" ng-if="notebook.session.status!==\'conflict\'" ng-click="notebook.refresh()">Thử đồng bộ lại</button>',
                    '<button type="button" ng-if="notebook.session.status===\'conflict\'" ng-click="notebook.resolve(\'keepLocal\')">Giữ bản trên máy</button>',
                    '<button type="button" ng-if="notebook.session.status===\'conflict\'" ng-click="notebook.resolve(\'useRemote\')">Dùng bản đồng bộ</button></div>',
                    '<div class="study-notebook-scroll"><div class="study-notebook-page-frame"><div class="study-notebook-paper" ng-class="[\'is-\'+notebook.session.document.orientation,\'paper-\'+notebook.session.document.pattern,\'tool-\'+notebook.tool]">',
                    '<textarea class="study-notebook-text" ng-model="notebook.session.document.text" ng-change="notebook.changed()" ng-disabled="notebook.isLocked()" placeholder="Viết những ý chính, từ mới hoặc điều bạn muốn nhớ…" aria-label="Nội dung ghi chú" spellcheck="false"></textarea>',
                    '<canvas class="study-notebook-canvas" ng-class="{\'is-drawing\':notebook.tool!==\'text\'}" aria-label="Vùng viết và vẽ bằng bút" role="img"></canvas>',
                    '</div></div></div>',
                    '<footer class="study-notebook-footer"><span><i class="fa fa-lock" aria-hidden="true"></i> Ghi chú riêng của bạn trong đề này</span><label><input type="checkbox" ng-model="notebook.touchDrawing"> Vẽ bằng ngón tay</label><span class="study-notebook-tip">{{notebook.tool===\'text\' ? \'Gõ chữ hoặc cuộn trang để xem tiếp.\' : \'Dùng bút hoặc chuột. Chọn Gõ chữ để cuộn trang.\'}}</span></footer>',
                    '</section></div>'
                ].join(''),
                link: function (scope, element, attrs, ui) {
                    var document = $window.document, host = element[0], button = host.querySelector('.study-notebook-toggle');
                    var overlay = host.querySelector('.study-notebook-overlay'), dialog = host.querySelector('.study-notebook-dialog');
                    var scroller = host.querySelector('.study-notebook-scroll'), pageFrame = host.querySelector('.study-notebook-page-frame');
                    var paper = host.querySelector('.study-notebook-paper'), textarea = host.querySelector('.study-notebook-text');
                    var canvas = host.querySelector('.study-notebook-canvas'), context = canvas.getContext && canvas.getContext('2d');
                    var inkCache = document.createElement('canvas'), cacheContext = inkCache.getContext && inkCache.getContext('2d');
                    var cacheDirty = true, inkBounds = [];
                    var alive = true, raf = null, layoutTimer = null, observer = null, identity = '';
                    var pointer = null, drawing = null, erasing = null, erasePrevious = null, undo = [], redo = [], knownStrokes = null, restoreFocus = null;
                    var pageWidth = 794, pageHeight = 1123, scale = 1, dpr = 1, logicalWidth = 794, logicalHeight = 1123;
                    var zoomAnchor = null;
                    var requestFrame = $window.requestAnimationFrame || function (callback) { return $window.setTimeout(callback, 16); };
                    var cancelFrame = $window.cancelAnimationFrame || $window.clearTimeout;
                    ui.dialogId = 'study-notebook-' + (++notebookSerial); ui.isOpen = false;
                    ui.tool = 'text'; ui.inkColor = '#315bbe'; ui.inkWidth = '4'; ui.touchDrawing = false;
                    ui.zoomPercent = 100;
                    ui.tools = [{ id: 'text', label: 'Gõ chữ', icon: 'fa-font' }, { id: 'pen', label: 'Bút', icon: 'fa-pencil' },
                        { id: 'highlighter', label: 'Đánh dấu', icon: 'fa-paint-brush' }, { id: 'eraser', label: 'Tẩy', icon: 'fa-eraser' }];
                    // Portal outside the exam header's stacking/overflow contexts.
                    document.body.appendChild(overlay);

                    function digest(callback) { if (alive) { scope.$evalAsync(callback || angular.noop); } }
                    function preventPromiseNoise(result) { if (result && result.catch) { result.catch(angular.noop); } }
                    function strokes() { return (ui.session && ui.session.document && ui.session.document.strokes) || []; }
                    function visible() { return alive && ui.isOpen; }
                    ui.canOpen = function () { return !!ui.enabled && Number(ui.testId) > 0 && Number(ui.userId) > 0; };
                    ui.isLocked = function () { return !ui.session || !ui.session.document || ui.session.status === 'loading' || ui.session.status === 'conflict'; };
                    ui.statusText = function () {
                        if (!ui.session) { return ''; }
                        return { loading: 'Đang tải ghi chú…', ready: 'Sẵn sàng ghi chú', saving: 'Đang đồng bộ…', saved: 'Đã đồng bộ', local: 'Chỉ lưu trên thiết bị · chưa đồng bộ',
                            error: 'Chưa đồng bộ được', conflict: 'Cần chọn bản ghi chú' }[ui.session.status] || '';
                    };
                    function saveNow() { if (ui.session && !ui.isLocked()) { preventPromiseNoise(ui.session.save()); } }
                    function markChanged() { if (ui.session && ui.session.document) { ui.session.changed(); } }
                    function flushText() {
                        if (!ui.session || !ui.session.document) { return; }
                        var wrapped = angular.element && angular.element(textarea);
                        var control = wrapped && wrapped.controller && wrapped.controller('ngModel');
                        var value = textarea.value;
                        // An incoming document may have replaced the model before Angular
                        // rendered it. Never push the previous textarea into that document.
                        if (control && ui.session.document.text !== control.$modelValue) { return; }
                        if (value !== ui.session.document.text) {
                            if (control) { control.$setViewValue(value); if (control.$commitViewValue) { control.$commitViewValue(); } }
                            ui.session.document.text = value; markChanged();
                        }
                    }
                    function positionOverlay() {
                        var bounds = button.getBoundingClientRect();
                        overlay.style.top = Math.max(0, Math.min(Math.max(0, ($window.innerHeight || 800) - 200), bounds.bottom + 10)) + 'px';
                    }
                    function open() {
                        if (!ui.canOpen() || !alive) { return; }
                        restoreFocus = document.activeElement;
                        if (!ui.session) {
                            try { ui.session = store.open({ userId: ui.userId, testId: ui.testId, testMode: ui.testMode }); }
                            catch (error) { return; }
                            knownStrokes = strokes();
                            if (ui.session.ready && ui.session.ready.then) {
                                ui.session.ready.then(function () { if (alive) { undo = []; redo = []; knownStrokes = strokes(); scheduleLayout(); } }, angular.noop);
                            }
                        }
                        ui.isOpen = true; openNotebooks++;
                        document.body.classList.add('study-notebook-open'); positionOverlay(); scheduleLayout();
                        $timeout.cancel(layoutTimer);
                        layoutTimer = $timeout(function () {
                            layoutTimer = null;
                            if (visible()) { var closeButton = dialog.querySelector('.study-notebook-close'); if (closeButton) { closeButton.focus(); } layout(); }
                        }, 0, false);
                    }
                    ui.close = function () {
                        if (!ui.isOpen) { return; }
                        flushText(); finishStroke(true); saveNow(); ui.isOpen = false;
                        openNotebooks = Math.max(0, openNotebooks - 1);
                        if (!openNotebooks) { document.body.classList.remove('study-notebook-open'); }
                        $timeout.cancel(layoutTimer); layoutTimer = null;
                        if (raf) { cancelFrame.call($window, raf); raf = null; }
                        canvas.width = canvas.height = inkCache.width = inkCache.height = 0; cacheDirty = true;
                        var target = restoreFocus && document.documentElement.contains(restoreFocus) ? restoreFocus : button;
                        if (alive && target && target.focus) { try { target.focus({ preventScroll: true }); } catch (ignore) { target.focus(); } }
                    };
                    ui.toggle = function () { if (ui.isOpen) { ui.close(); } else { open(); } };
                    ui.save = function () { flushText(); finishStroke(true); saveNow(); };
                    ui.refresh = function () { flushText(); finishStroke(true); if (ui.session) { preventPromiseNoise(ui.session.refresh()); } };
                    ui.resolve = function (method) {
                        flushText(); finishStroke(true);
                        if (ui.session && typeof ui.session[method] === 'function') {
                            undo = []; redo = []; preventPromiseNoise(ui.session[method]()); scheduleLayout();
                        }
                    };
                    ui.changed = function () { if (!ui.isLocked()) { finishStroke(true); markChanged(); scheduleLayout(); } };
                    ui.setTool = function (tool) { finishStroke(true); ui.tool = tool; scheduleDraw(); };
                    function captureZoomAnchor() {
                        if (!visible() || !scale) { return null; }
                        var viewport = scroller.getBoundingClientRect(), bounds = paper.getBoundingClientRect();
                        var x = (scroller.clientWidth || viewport.width) / 2, y = (scroller.clientHeight || viewport.height) / 2;
                        return { x: (viewport.left + (scroller.clientLeft || 0) + x - bounds.left) / scale,
                            y: (viewport.top + (scroller.clientTop || 0) + y - bounds.top) / scale, viewportX: x, viewportY: y };
                    }
                    ui.setZoom = function (percent) {
                        percent = Number(percent);
                        if (!isFinite(percent)) { return; }
                        percent = Math.max(50, Math.min(200, Math.round(percent)));
                        if (percent === ui.zoomPercent) { return; }
                        flushText(); finishStroke(true); zoomAnchor = captureZoomAnchor(); ui.zoomPercent = percent; layout();
                    };
                    ui.zoomIn = function () { ui.setZoom(ui.zoomPercent + 25); };
                    ui.zoomOut = function () { ui.setZoom(ui.zoomPercent - 25); };
                    ui.fitZoom = function () { ui.setZoom(100); };
                    ui.canUndo = function () { return undo.length > 0 && !ui.isLocked(); };
                    ui.canRedo = function () { return redo.length > 0 && !ui.isLocked(); };
                    function replaceStrokes(next, history) {
                        var previous = strokes();
                        if (history) { undo.push(previous); if (undo.length > 30) { undo.shift(); } redo = []; }
                        ui.session.document.strokes = next; knownStrokes = next; cacheDirty = true; markChanged(); scheduleLayout(); digest();
                    }
                    ui.undo = function () { finishStroke(true); if (ui.canUndo()) { redo.push(strokes()); replaceStrokes(undo.pop(), false); } };
                    ui.redo = function () { finishStroke(true); if (ui.canRedo()) { undo.push(strokes()); replaceStrokes(redo.pop(), false); } };

                    function extent() {
                        var doc = ui.session && ui.session.document;
                        pageWidth = doc && doc.orientation === 'landscape' ? 1123 : 794;
                        pageHeight = doc && doc.orientation === 'landscape' ? 794 : 1123;
                        logicalWidth = pageWidth; logicalHeight = pageHeight;
                        strokes().forEach(function (stroke) { (stroke.points || []).forEach(function (point) {
                            logicalWidth = Math.max(logicalWidth, point[0] + 24); logicalHeight = Math.max(logicalHeight, point[1] + 24);
                        }); });
                    }
                    function layout() {
                        if (!visible() || !ui.session || !ui.session.document) { return; }
                        var previousScale = scale, previousDpr = dpr;
                        positionOverlay(); extent();
                        var viewport = scroller.getBoundingClientRect();
                        var scrollStyle = $window.getComputedStyle ? $window.getComputedStyle(scroller) : null;
                        var paddingX = scrollStyle ? (parseFloat(scrollStyle.paddingLeft) || 0) + (parseFloat(scrollStyle.paddingRight) || 0) : 0;
                        var availableWidth = Math.max(1, (scroller.clientWidth || viewport.width || paper.getBoundingClientRect().width) - paddingX);
                        var width = logicalWidth * Math.min(1, availableWidth / logicalWidth) * (ui.zoomPercent / 100);
                        paper.style.maxWidth = 'none'; paper.style.width = width + 'px';
                        pageFrame.style.width = Math.max(availableWidth, width) + 'px';
                        scale = width / logicalWidth;
                        var pattern = ui.session.document.pattern;
                        var lineHeight = pattern === 'grid' ? 20 : (pattern === 'squares' ? 64 : 28);
                        var ascent = 15, descent = 4;
                        if (context && context.measureText) {
                            var previousFont = context.font; context.font = '17px Arial';
                            var metrics = context.measureText('Mg'); context.font = previousFont;
                            if (isFinite(metrics.fontBoundingBoxAscent) && isFinite(metrics.fontBoundingBoxDescent) && metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent > 0) {
                                ascent = metrics.fontBoundingBoxAscent; descent = metrics.fontBoundingBoxDescent;
                            }
                        }
                        var baseline = (lineHeight - ascent - descent) / 2 + ascent;
                        var paddingTop = 40;
                        if (pattern === 'lined' || pattern === 'grid' || pattern === 'squares') {
                            paddingTop = Math.round((40 + baseline) / lineHeight) * lineHeight - baseline;
                        }
                        paper.style.setProperty('--notebook-line-step', (28 * scale) + 'px');
                        paper.style.setProperty('--notebook-grid-step', (20 * scale) + 'px');
                        paper.style.setProperty('--notebook-square-step', (64 * scale) + 'px');
                        paper.style.setProperty('--notebook-rule-width', Math.min(1, scale) + 'px');
                        paper.style.setProperty('--notebook-text-line-height', (lineHeight * scale) + 'px');
                        paper.style.setProperty('--notebook-rule-offset-y', '0px');
                        paper.style.minHeight = Math.round(logicalHeight * scale) + 'px';
                        textarea.style.fontSize = (17 * scale) + 'px';
                        textarea.style.lineHeight = (lineHeight * scale) + 'px';
                        textarea.style.padding = (40 * scale) + 'px';
                        textarea.style.paddingTop = (paddingTop * scale) + 'px';
                        textarea.style.height = '0px';
                        var textHeight = textarea.scrollHeight;
                        textarea.style.height = Math.max(logicalHeight * scale, textHeight + 4) + 'px';
                        var height = Math.max(logicalHeight * scale, textarea.getBoundingClientRect().height);
                        pageFrame.style.height = Math.ceil(height) + 'px';
                        logicalHeight = Math.max(logicalHeight, height / scale);
                        // Long notes must not allocate a giant iPad canvas. Uniform
                        // raster downscaling keeps canonical ink coordinates unchanged.
                        dpr = Math.min(2, Math.max(1, $window.devicePixelRatio || 1), Math.sqrt(4000000 / (width * height)), 8192 / Math.max(width, height));
                        var pixelsWide = Math.max(1, Math.floor(width * dpr)), pixelsHigh = Math.max(1, Math.floor(height * dpr));
                        if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) { canvas.width = pixelsWide; canvas.height = pixelsHigh; }
                        if (inkCache.width !== pixelsWide || inkCache.height !== pixelsHigh) { inkCache.width = pixelsWide; inkCache.height = pixelsHigh; cacheDirty = true; }
                        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
                        if (scale !== previousScale || dpr !== previousDpr) { cacheDirty = true; }
                        if (zoomAnchor) {
                            var anchor = zoomAnchor; zoomAnchor = null;
                            var updatedPaper = paper.getBoundingClientRect(), updatedViewport = scroller.getBoundingClientRect();
                            scroller.scrollLeft += updatedPaper.left + anchor.x * scale - updatedViewport.left - (scroller.clientLeft || 0) - anchor.viewportX;
                            scroller.scrollTop += updatedPaper.top + anchor.y * scale - updatedViewport.top - (scroller.clientTop || 0) - anchor.viewportY;
                        }
                        scheduleDraw();
                    }
                    function scheduleLayout() {
                        if (!visible()) { return; }
                        $timeout.cancel(layoutTimer);
                        layoutTimer = $timeout(function () { layoutTimer = null; layout(); }, 0, false);
                    }
                    function paintStroke(stroke, target) {
                        target = target || context;
                        var points = stroke.points || [];
                        if (!points.length) { return; }
                        target.strokeStyle = stroke.color; target.fillStyle = stroke.color;
                        target.globalAlpha = stroke.tool === 'highlighter' ? 0.24 : 1;
                        target.lineCap = 'round'; target.lineJoin = 'round';
                        if (points.length === 1) {
                            target.beginPath(); target.arc(points[0][0], points[0][1], Math.max(0.5, stroke.width / 2), 0, Math.PI * 2); target.fill();
                        } else if (stroke.tool === 'highlighter') {
                            target.lineWidth = stroke.width; target.beginPath(); target.moveTo(points[0][0], points[0][1]);
                            for (var mark = 1; mark < points.length; mark++) { target.lineTo(points[mark][0], points[mark][1]); } target.stroke();
                        } else {
                            for (var index = 1; index < points.length; index++) {
                                var before = points[index - 1], point = points[index];
                                var beforePressure = before.length > 2 ? before[2] : 0.5, pointPressure = point.length > 2 ? point[2] : 0.5;
                                var pressure = 0.45 + ((beforePressure + pointPressure) / 2) * 0.9;
                                target.lineWidth = Math.max(0.7, stroke.width * pressure);
                                target.beginPath(); target.moveTo(before[0], before[1]); target.lineTo(point[0], point[1]); target.stroke();
                            }
                        }
                    }
                    function draw() {
                        raf = null;
                        if (!visible() || !context) { return; }
                        context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, canvas.width, canvas.height);
                        if (cacheDirty && cacheContext) {
                            cacheContext.setTransform(1, 0, 0, 1, 0, 0); cacheContext.clearRect(0, 0, inkCache.width, inkCache.height);
                            cacheContext.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0); inkBounds = [];
                            strokes().forEach(function (stroke) {
                                paintStroke(stroke, cacheContext);
                                var box = [Infinity, Infinity, -Infinity, -Infinity];
                                (stroke.points || []).forEach(function (point) { box[0] = Math.min(box[0], point[0]); box[1] = Math.min(box[1], point[1]); box[2] = Math.max(box[2], point[0]); box[3] = Math.max(box[3], point[1]); }); inkBounds.push(box);
                            }); cacheDirty = false;
                        }
                        if (!erasing && cacheContext) { context.drawImage(inkCache, 0, 0); }
                        context.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
                        if (erasing || !cacheContext) { strokes().forEach(function (stroke, index) { if (!erasing || !erasing[index]) { paintStroke(stroke); } }); }
                        if (drawing) { paintStroke(drawing); }
                        context.globalAlpha = 1;
                    }
                    function scheduleDraw() { if (visible() && !raf) { raf = requestFrame.call($window, draw); } }
                    function position(event) {
                        var box = canvas.getBoundingClientRect();
                        return [Math.round(Math.max(0, Math.min(logicalWidth, (event.clientX - box.left) / scale)) * 100) / 100,
                            Math.round(Math.max(0, Math.min(logicalHeight, (event.clientY - box.top) / scale)) * 100) / 100,
                            event.pointerType === 'pen' && event.pressure > 0 ? Math.round(Math.min(1, event.pressure) * 1000) / 1000 : 0.5];
                    }
                    function distanceToSegment(point, a, b) {
                        var dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
                        var t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
                        dx = point[0] - a[0] - t * dx; dy = point[1] - a[1] - t * dy; return dx * dx + dy * dy;
                    }
                    function eraseAt(point) {
                        strokes().forEach(function (stroke, index) {
                            if (erasing[index]) { return; }
                            var points = stroke.points || [], radius = 12 + Number(stroke.width || 1) / 2;
                            var bounds = inkBounds[index];
                            if (bounds && (point[0] + radius < bounds[0] || point[0] - radius > bounds[2] || point[1] + radius < bounds[1] || point[1] - radius > bounds[3]) &&
                                (!erasePrevious || (Math.max(point[0], erasePrevious[0]) + radius < bounds[0] || Math.min(point[0], erasePrevious[0]) - radius > bounds[2] || Math.max(point[1], erasePrevious[1]) + radius < bounds[1] || Math.min(point[1], erasePrevious[1]) - radius > bounds[3]))) { return; }
                            for (var i = 0; i < points.length; i++) {
                                var a = points[Math.max(0, i - 1)], b = points[i], hit = distanceToSegment(point, a, b) <= radius * radius;
                                if (erasePrevious && !hit) {
                                    var first = (point[0] - erasePrevious[0]) * (a[1] - erasePrevious[1]) - (point[1] - erasePrevious[1]) * (a[0] - erasePrevious[0]);
                                    var second = (point[0] - erasePrevious[0]) * (b[1] - erasePrevious[1]) - (point[1] - erasePrevious[1]) * (b[0] - erasePrevious[0]);
                                    var third = (b[0] - a[0]) * (erasePrevious[1] - a[1]) - (b[1] - a[1]) * (erasePrevious[0] - a[0]);
                                    var fourth = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
                                    hit = (first * second < 0 && third * fourth < 0) || distanceToSegment(erasePrevious, a, b) <= radius * radius ||
                                        distanceToSegment(a, erasePrevious, point) <= radius * radius || distanceToSegment(b, erasePrevious, point) <= radius * radius;
                                }
                                if (hit) { erasing[index] = true; break; }
                            }
                        }); erasePrevious = point;
                    }
                    function addPoint(event, force) {
                        var point = position(event);
                        if (erasing) { eraseAt(point); return; }
                        if (!drawing) { return; }
                        var previous = drawing.points[drawing.points.length - 1];
                        if (force || !previous || Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1]) >= 0.8 || Math.abs(point[2] - previous[2]) > 0.15) {
                            if (drawing.points.length >= 2500) {
                                // Decimate the whole old curve, retaining both endpoints;
                                // never replace a long new tail with a single straight line.
                                var compact = [drawing.points[0]];
                                for (var pointIndex = 2; pointIndex < drawing.points.length - 1; pointIndex += 2) { compact.push(drawing.points[pointIndex]); }
                                compact.push(drawing.points[drawing.points.length - 1]); drawing.points = compact;
                            }
                            drawing.points.push(point);
                        }
                    }
                    function pointerDown(event) {
                        if (!visible() || ui.tool === 'text' || ui.isLocked() || !context || pointer !== null ||
                            (event.pointerType === 'touch' && !ui.touchDrawing) || (event.button !== undefined && event.button !== 0)) { return; }
                        event.preventDefault(); event.stopPropagation(); pointer = event.pointerId;
                        if (ui.tool === 'eraser') { erasing = {}; erasePrevious = null; }
                        else { drawing = { id: 'ink-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9), tool: ui.tool,
                            color: ui.inkColor, width: Number(ui.inkWidth) * (ui.tool === 'highlighter' ? 4 : 1), points: [] }; }
                        try { canvas.setPointerCapture(pointer); } catch (ignoreCapture) { /* Pointer delivery still works while inside canvas. */ }
                        addPoint(event, true); scheduleDraw();
                    }
                    function pointerMove(event) {
                        if (pointer === null || event.pointerId !== pointer) { return; }
                        event.preventDefault(); event.stopPropagation();
                        var events = event.getCoalescedEvents ? event.getCoalescedEvents() : null;
                        (events && events.length ? events : [event]).forEach(function (point) { addPoint(point, false); }); scheduleDraw();
                    }
                    function finishStroke(commit) {
                        if (pointer === null) { return; }
                        var next = null, pointerId = pointer; pointer = null;
                        // A gesture that began while unlocked still belongs to the
                        // local notebook if a background refresh starts mid-stroke.
                        if (commit && ui.session && ui.session.document) {
                            if (drawing && drawing.points.length) { next = strokes().concat([drawing]); }
                            else if (erasing && Object.keys(erasing).length) { next = strokes().filter(function (stroke, index) { return !erasing[index]; }); }
                        }
                        drawing = null; erasing = null; erasePrevious = null;
                        try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(pointerId)) { canvas.releasePointerCapture(pointerId); } } catch (ignoreRelease) {}
                        if (next) { replaceStrokes(next, true); } else { scheduleDraw(); }
                    }
                    function pointerUp(event) { if (pointer !== null && event.pointerId === pointer) { addPoint(event, true); finishStroke(true); } }
                    function pointerCancel(event) { if (pointer !== null && event.pointerId === pointer) { finishStroke(true); } }

                    function keydown(event) {
                        if (!visible()) { return; }
                        event.stopPropagation();
                        if ((event.key === 'Escape' || event.keyCode === 27) && !event.isComposing) { event.preventDefault(); digest(ui.close); return; }
                        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's') { event.preventDefault(); digest(ui.save); return; }
                        if (event.key !== 'Tab' && event.keyCode !== 9) { return; }
                        var controls = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]'));
                        controls = controls.filter(function (node) { return node.getClientRects().length > 0; });
                        if (!controls.length) { event.preventDefault(); return; }
                        var first = controls[0], last = controls[controls.length - 1];
                        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                    }
                    function stopKeys(event) { if (visible()) { event.stopPropagation(); } }
                    function backdrop(event) { if (event.target === overlay) { digest(ui.close); } }
                    function blockBackground(event) {
                        if (visible() && !overlay.contains(event.target) && !button.contains(event.target)) { event.preventDefault(); event.stopPropagation(); }
                    }
                    function keepFocus(event) {
                        if (visible() && !overlay.contains(event.target) && !button.contains(event.target)) {
                            var target = dialog.querySelector('.study-notebook-close'); if (target) { target.focus(); }
                        }
                    }
                    function flushBeforeLeave() { if (ui.session) { flushText(); finishStroke(true); saveNow(); } }
                    function visibilityChanged() { if (document.visibilityState === 'hidden') { flushBeforeLeave(); } }
                    function identityChanged() {
                        var next = [ui.userId, ui.testMode, ui.testId, !!ui.enabled].join(':');
                        if (identity === next) { return; }
                        identity = next; ui.close();
                        if (ui.session) { ui.session.destroy(); ui.session = null; }
                        undo = []; redo = []; knownStrokes = null; ui.zoomPercent = 100; zoomAnchor = null;
                    }
                    var unwatchIdentity = scope.$watchGroup(['notebook.userId', 'notebook.testMode', 'notebook.testId', 'notebook.enabled'], identityChanged);
                    var unwatchStrokes = scope.$watchCollection(function () { return strokes(); }, function (value) {
                        if (value !== knownStrokes) { knownStrokes = value; cacheDirty = true; undo = []; redo = []; scheduleLayout(); }
                    });
                    var unwatchStatus = scope.$watch(function () { return ui.session && ui.session.status; }, function () { scheduleLayout(); });
                    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
                    canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerCancel);
                    canvas.addEventListener('lostpointercapture', pointerCancel);
                    overlay.addEventListener('keydown', keydown); overlay.addEventListener('keyup', stopKeys); overlay.addEventListener('keypress', stopKeys);
                    overlay.addEventListener('click', backdrop); document.addEventListener('click', blockBackground, true);
                    document.addEventListener('pointerdown', blockBackground, true); document.addEventListener('mousedown', blockBackground, true);
                    document.addEventListener('focusin', keepFocus, true);
                    $window.addEventListener('pagehide', flushBeforeLeave); document.addEventListener('visibilitychange', visibilityChanged);
                    $window.addEventListener('resize', scheduleLayout);
                    if ($window.ResizeObserver) { observer = new $window.ResizeObserver(scheduleLayout); observer.observe(paper); }
                    scope.$on('$destroy', function () {
                        ui.close(); alive = false; unwatchIdentity(); unwatchStrokes(); unwatchStatus();
                        $timeout.cancel(layoutTimer); if (raf) { cancelFrame.call($window, raf); raf = null; }
                        if (observer) { observer.disconnect(); }
                        if (ui.session) { ui.session.destroy(); ui.session = null; }
                        canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
                        canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerCancel);
                        canvas.removeEventListener('lostpointercapture', pointerCancel);
                        overlay.removeEventListener('keydown', keydown); overlay.removeEventListener('keyup', stopKeys); overlay.removeEventListener('keypress', stopKeys);
                        overlay.removeEventListener('click', backdrop); document.removeEventListener('click', blockBackground, true);
                        document.removeEventListener('pointerdown', blockBackground, true); document.removeEventListener('mousedown', blockBackground, true);
                        document.removeEventListener('focusin', keepFocus, true);
                        $window.removeEventListener('pagehide', flushBeforeLeave); document.removeEventListener('visibilitychange', visibilityChanged);
                        $window.removeEventListener('resize', scheduleLayout);
                        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
                    });
                }
            };
        }]);
}());
