(function () {
    'use strict';

    var notebookSerial = 0, openNotebooks = 0;
    angular.module('Hrm.Common').directive('studyNotebook', ['$window', '$timeout', '$injector',
        function ($window, $timeout, $injector) {
            return {
                restrict: 'E',
                scope: { testId: '=', testMode: '@', userId: '=', enabled: '=', sessionOpener: '&?', sessionKey: '@?',
                    hideSave: '<?', hideToggle: '<?', autoOpen: '<?', footerLabel: '@?', onClose: '&?', readOnly: '<?', title: '@?', placeholder: '@?',
                    inkSelection: '<?', paged: '<?' },
                bindToController: true, controllerAs: 'notebook', controller: function () {}, require: 'studyNotebook',
                template: [
                    '<button type="button" class="study-notebook-toggle" ng-hide="notebook.hideToggle" ng-class="{\'is-active\':notebook.isOpen}" ng-click="notebook.toggle()" ng-disabled="!notebook.canOpen()" ng-attr-aria-expanded="{{notebook.isOpen}}" ng-attr-aria-controls="{{notebook.dialogId}}" aria-haspopup="dialog" aria-label="Mở hoặc ẩn sổ ghi chú" title="Sổ ghi chú học tập">',
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h10.5L20 7v13.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M16 3.5V8h4M8 11h8M8 15h6M7 3.5v17"/></svg></button>',
                    '<div class="study-notebook-overlay ng-hide" ng-show="notebook.isOpen" ng-attr-aria-hidden="{{!notebook.isOpen}}">',
                    '<section class="study-notebook-dialog" role="dialog" aria-modal="true" ng-attr-id="{{notebook.dialogId}}" ng-attr-aria-labelledby="{{notebook.dialogId}}-title">',
                    '<header class="study-notebook-heading"><div class="study-notebook-heading__copy"><h2 ng-attr-id="{{notebook.dialogId}}-title">{{notebook.title || \'Sổ tay học tập\'}}</h2></div>',
                    '<div class="study-notebook-heading__actions"><span class="study-notebook-status" ng-class="\'is-\'+notebook.session.status" role="status" aria-live="polite">{{notebook.statusText()}}</span>',
                    '<button type="button" class="study-notebook-action" ng-if="!notebook.hideSave && !notebook.readOnly" ng-click="notebook.save()" ng-disabled="!notebook.session || notebook.session.status===\'loading\' || notebook.session.status===\'conflict\'" title="Lưu ngay"><i class="fa fa-cloud-upload" aria-hidden="true"></i><span>Lưu ngay</span></button>',
                    '<button type="button" class="study-notebook-close" ng-click="notebook.close()" aria-label="Ẩn sổ ghi chú" title="Ẩn sổ ghi chú">&times;</button></div></header>',
                    '<div class="study-notebook-toolbar" role="group" aria-label="Công cụ ghi chú">',
                    '<div class="study-notebook-tools" ng-if="!notebook.readOnly"><button type="button" ng-repeat="tool in notebook.tools" ng-click="notebook.setTool(tool.id)" ng-class="{\'is-active\':notebook.tool===tool.id}" ng-attr-aria-pressed="{{notebook.tool===tool.id}}" ng-attr-title="{{tool.label}}"><i class="fa" ng-class="tool.icon" aria-hidden="true"></i><span>{{tool.label}}</span></button></div>',
                    '<div class="study-notebook-ink-options" ng-if="!notebook.readOnly"><div class="study-notebook-color"><span>Màu</span><button type="button" class="study-notebook-color-toggle" ng-click="notebook.togglePalette()" ng-disabled="notebook.isLocked()" aria-label="Màu chữ và bút" aria-haspopup="dialog" ng-attr-aria-expanded="{{notebook.paletteOpen}}" ng-attr-aria-controls="{{notebook.dialogId}}-palette" title="Chọn màu cho chữ và bút"><span ng-style="{\'background-color\':notebook.inkColor}"></span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4 3 3 3-3"/></svg></button></div>',
                    '<button type="button" class="study-notebook-lasso-toggle" ng-if="notebook.inkSelection" ng-click="notebook.setTool(\'lasso\')" ng-disabled="notebook.isLocked()" ng-attr-aria-pressed="{{notebook.tool===\'lasso\'}}" title="Khoanh vùng để di chuyển nét viết tay"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 15C2 14 1 8 4 5c3-3 10-3 13 1 3 5-3 10-8 9H6" stroke-dasharray="2 2"/><path d="M8 14c-3 0-4 3-2 4s4-1 2-4Z"/></svg><span>Khoanh vùng</span></button>',
                    '<label class="study-notebook-stroke"><span>Nét bút</span><select ng-model="notebook.inkWidth" aria-label="Độ rộng nét bút"><option value="2">Mảnh</option><option value="4">Vừa</option><option value="7">Đậm</option></select></label>',
                    '<button type="button" class="study-notebook-history" ng-click="notebook.undo()" ng-disabled="!notebook.canUndo()" title="Hoàn tác nét vẽ" aria-label="Hoàn tác nét vẽ"><i class="fa fa-undo" aria-hidden="true"></i></button>',
                    '<button type="button" class="study-notebook-history" ng-click="notebook.redo()" ng-disabled="!notebook.canRedo()" title="Khôi phục nét vẽ" aria-label="Khôi phục nét vẽ"><i class="fa fa-repeat" aria-hidden="true"></i></button></div>',
                    '<div class="study-notebook-paper-options"><label><span>Khổ giấy A4</span><select ng-model="notebook.session.document.orientation" ng-change="notebook.changed()" ng-disabled="notebook.isLocked()" aria-label="Hướng giấy A4"><option value="portrait">Dọc</option><option value="landscape">Ngang</option></select></label>',
                    '<label><span>Kiểu giấy</span><select ng-model="notebook.session.document.pattern" ng-change="notebook.changed()" ng-disabled="notebook.isLocked()" aria-label="Kiểu kẻ giấy"><option value="blank">Giấy trơn</option><option value="lined">Dòng kẻ ngang</option><option value="vertical">Dòng kẻ dọc</option><option value="grid">Ô ly</option><option value="squares">Ô vuông lớn</option><option value="sketch">Giấy nhám phác thảo</option></select></label></div>',
                    '<div class="study-notebook-zoom" role="group" aria-label="Thu phóng trang giấy"><button type="button" ng-click="notebook.zoomOut()" ng-disabled="notebook.zoomPercent<=50" aria-label="Thu nhỏ trang giấy" title="Thu nhỏ"><i class="fa fa-search-minus" aria-hidden="true"></i></button><input type="range" class="study-notebook-zoom__slider" min="50" max="200" step="5" ng-model="notebook.zoomSliderValue" ng-change="notebook.setZoom(notebook.zoomSliderValue)" aria-label="Kéo để thu phóng trang giấy" ng-attr-aria-valuetext="{{notebook.zoomPercent}} phần trăm"><output aria-live="polite" aria-label="Mức thu phóng">{{notebook.zoomPercent}}%</output><button type="button" ng-click="notebook.zoomIn()" ng-disabled="notebook.zoomPercent>=200" aria-label="Phóng to trang giấy" title="Phóng to"><i class="fa fa-search-plus" aria-hidden="true"></i></button><button type="button" class="study-notebook-zoom__fit" ng-click="notebook.fitZoom()" title="Đưa trang giấy về vừa màn hình">Vừa trang</button></div></div>',
                    '<nav class="study-notebook-pages" ng-if="notebook.paged" aria-label="Các trang tài liệu"><button type="button" ng-click="notebook.goToPage(notebook.currentPage-1)" ng-disabled="notebook.currentPage<=1" aria-label="Trang trước">‹</button><label>Trang<select ng-model="notebook.currentPage" ng-change="notebook.goToPage(notebook.currentPage)" ng-options="page as page for page in notebook.pages" aria-label="Chọn trang tài liệu"></select><span>/ {{notebook.pages.length}}</span></label><button type="button" ng-click="notebook.goToPage(notebook.currentPage+1)" ng-disabled="notebook.currentPage>=notebook.pages.length" aria-label="Trang sau">›</button><button type="button" class="study-notebook-add-page" ng-if="!notebook.readOnly" ng-click="notebook.addPage()" ng-disabled="notebook.isLocked() || notebook.pages.length>=80" title="Thêm trang A4, tối đa 80 trang">+ Thêm trang</button></nav>',
                    '<div class="study-notebook-notice" ng-if="notebook.session.error || notebook.session.status===\'conflict\'">',
                    '<span>{{notebook.session.error || \'Có bản ghi chú khác vừa được đồng bộ. Chọn bản bạn muốn giữ.\'}}</span>',
                    '<button type="button" ng-if="notebook.session.status!==\'conflict\'" ng-click="notebook.refresh()">Thử đồng bộ lại</button>',
                    '<button type="button" ng-if="notebook.session.status===\'conflict\'" ng-click="notebook.resolve(\'keepLocal\')">Giữ bản trên máy</button>',
                    '<button type="button" ng-if="notebook.session.status===\'conflict\'" ng-click="notebook.resolve(\'useRemote\')">Dùng bản đồng bộ</button></div>',
                    '<div class="study-notebook-scroll"><div class="study-notebook-page-frame"><div class="study-notebook-paper" ng-class="[\'is-\'+notebook.session.document.orientation,\'paper-\'+notebook.session.document.pattern,\'tool-\'+notebook.tool]">',
                    '<textarea class="study-notebook-text" ng-model="notebook.session.document.text" ng-change="notebook.changed()" ng-disabled="notebook.isLocked() && !notebook.readOnly" ng-readonly="notebook.readOnly" ng-attr-placeholder="{{notebook.tool===\'text\' && !notebook.session.document.strokes.length ? (notebook.placeholder || \'Viết những ý chính, từ mới hoặc điều bạn muốn nhớ…\') : \'\'}}" aria-label="Nội dung ghi chú" spellcheck="false"></textarea>',
                    '<canvas class="study-notebook-canvas" ng-class="{\'is-drawing\':notebook.tool!==\'text\'}" aria-label="Vùng viết và vẽ bằng bút" role="img"></canvas>',
                    '<div class="study-notebook-page-boundary" ng-if="notebook.paged" ng-repeat="page in notebook.pages track by page" ng-style="{top:((page-1)*notebook.pageStep)+\'px\'}" aria-hidden="true"><span>Trang {{page}}</span></div>',
                    '</div></div></div>',
                    '<footer class="study-notebook-footer" ng-class="{\'is-selecting-ink\':notebook.tool===\'lasso\'}"><span><i class="fa fa-lock" aria-hidden="true"></i> {{notebook.footerLabel || \'Ghi chú riêng của bạn trong đề này\'}}</span><label ng-if="!notebook.readOnly"><input type="checkbox" ng-model="notebook.touchDrawing"> Vẽ bằng ngón tay</label><span class="study-notebook-tip" ng-if="notebook.tool!==\'lasso\'">{{notebook.tool===\'text\' ? \'Gõ chữ hoặc cuộn trang để xem tiếp.\' : \'Dùng bút hoặc chuột. Chọn Gõ chữ để cuộn trang.\'}}</span><span class="study-notebook-tip study-notebook-lasso-tip" ng-if="notebook.tool===\'lasso\'" aria-live="polite">{{notebook.inkSelected ? \'Kéo vùng nét đã chọn đến vị trí mới.\' : \'Vẽ vòng quanh các nét cần di chuyển.\'}}</span></footer>',
                    '</section>',
                    '<div class="study-notebook-palette ng-hide" ng-if="notebook.isOpen && !notebook.readOnly" ng-show="notebook.paletteOpen" role="dialog" aria-label="Bảng màu chữ và bút" ng-attr-id="{{notebook.dialogId}}-palette">',
                    '<div class="study-notebook-palette-grid" role="group" aria-label="Màu có sẵn"><button type="button" class="study-notebook-swatch" ng-repeat="color in notebook.paletteColors track by color" ng-style="{\'background-color\':color,color:notebook.colorContrast(color)}" ng-click="notebook.selectInkColor(color)" ng-keydown="notebook.paletteKey($event,$index)" ng-attr-tabindex="{{notebook.paletteFocusColor===color?0:-1}}" ng-attr-title="{{color.toUpperCase()}}" ng-attr-aria-label="Màu {{color.toUpperCase()}}" ng-attr-aria-pressed="{{notebook.inkColor===color}}"><svg ng-if="notebook.inkColor===color" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></button></div>',
                    '<div class="study-notebook-palette-label">Tùy chỉnh</div><div class="study-notebook-custom-colors"><button type="button" class="study-notebook-swatch" ng-repeat="color in notebook.customColors track by color" ng-style="{\'background-color\':color,color:notebook.colorContrast(color)}" ng-click="notebook.selectInkColor(color)" ng-attr-title="{{color.toUpperCase()}}" ng-attr-aria-label="Màu tùy chỉnh {{color.toUpperCase()}}" ng-attr-aria-pressed="{{notebook.inkColor===color}}"><svg ng-if="notebook.inkColor===color" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></button><button type="button" class="study-notebook-add-color" ng-click="notebook.openCustomColor()" aria-label="Thêm màu tùy chỉnh" ng-attr-aria-expanded="{{notebook.customColorOpen}}" title="Thêm màu tùy chỉnh"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 6v8M6 10h8"/></svg></button></div>',
                    '<form class="study-notebook-custom-form" ng-if="notebook.customColorOpen" ng-submit="notebook.applyCustomColor()"><label>Mã màu HEX<input type="text" ng-model="notebook.customHex" ng-change="notebook.customHexChanged()" placeholder="#315BBE" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Mã màu HEX"></label><div><input type="color" ng-model="notebook.customColor" ng-change="notebook.customHex=notebook.customColor" aria-label="Chọn màu tùy chỉnh"><button type="submit" ng-disabled="!notebook.validCustomColor()">Áp dụng</button></div></form>',
                    '</div></div>'
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
                    var pointer = null, drawing = null, erasing = null, erasePrevious = null, undo = [], redo = [], knownStrokes = null, restoreFocus = null, composing = false;
                    var selectedInk = null, inkGesture = null;
                    var pageWidth = 794, pageHeight = 1123, scale = 1, dpr = 1, logicalWidth = 794, logicalHeight = 1123;
                    var zoomAnchor = null, palette = null, paletteTimer = null;
                    ui.pages = []; ui.currentPage = 1;
                    var requestFrame = $window.requestAnimationFrame || function (callback) { return $window.setTimeout(callback, 16); };
                    var cancelFrame = $window.cancelAnimationFrame || $window.clearTimeout;
                    ui.dialogId = 'study-notebook-' + (++notebookSerial); ui.isOpen = false;
                    ui.tool = 'text'; ui.inkColor = '#315bbe'; ui.inkWidth = '4'; ui.touchDrawing = false;
                    ui.paletteOpen = false; ui.customColorOpen = false; ui.customColors = [ui.inkColor];
                    ui.paletteColors = $window.AppColorPalette ? $window.AppColorPalette.colors.slice() : [];
                    ui.zoomPercent = 100;
                    ui.zoomSliderValue = 100;
                    ui.tools = [{ id: 'text', label: 'Gõ chữ', icon: 'fa-font' }, { id: 'pen', label: 'Bút', icon: 'fa-pencil' },
                        { id: 'highlighter', label: 'Đánh dấu', icon: 'fa-paint-brush' }, { id: 'eraser', label: 'Tẩy', icon: 'fa-eraser' }];
                    // Portal outside the exam header's stacking/overflow contexts.
                    document.body.appendChild(overlay);

                    function digest(callback) { if (alive) { scope.$evalAsync(callback || angular.noop); } }
                    function preventPromiseNoise(result) { if (result && result.catch) { result.catch(angular.noop); } }
                    function strokes() { return (ui.session && ui.session.document && ui.session.document.strokes) || []; }
                    function visible() { return alive && ui.isOpen; }
                    function colorTrigger() { return dialog.querySelector('.study-notebook-color-toggle'); }
                    function normalizedColor(value) { var hex = String(value || '').trim().replace(/^#/, ''); return /^[0-9a-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : null; }
                    ui.colorContrast = function (color) { var hex = color.slice(1); return parseInt(hex.slice(0, 2), 16) * 299 + parseInt(hex.slice(2, 4), 16) * 587 + parseInt(hex.slice(4, 6), 16) * 114 > 150000 ? '#26344d' : '#ffffff'; };
                    ui.closePalette = function (restore) {
                        if (!ui.paletteOpen) { return; } ui.paletteOpen = false; ui.customColorOpen = false;
                        $timeout.cancel(paletteTimer); paletteTimer = null;
                        var trigger = colorTrigger(); if (restore !== false && trigger) { trigger.focus(); }
                    };
                    function positionPalette() {
                        var trigger = colorTrigger();
                        if (!ui.paletteOpen || !palette || !trigger) { return; }
                        var anchor = trigger.getBoundingClientRect(), origin = overlay.getBoundingClientRect();
                        var toolbar = dialog.querySelector('.study-notebook-toolbar'), toolbarBounds = toolbar.getBoundingClientRect();
                        if (anchor.right <= toolbarBounds.left || anchor.left >= toolbarBounds.right) { digest(function () { ui.closePalette(false); }); return; }
                        var viewportWidth = $window.innerWidth || document.documentElement.clientWidth, viewportHeight = $window.innerHeight;
                        var width = Math.min(252, viewportWidth - 16); palette.style.width = width + 'px';
                        var height = palette.getBoundingClientRect().height;
                        var left = Math.max(8, Math.min(anchor.left - 12, viewportWidth - width - 8));
                        var top = anchor.bottom + 7; if (top + height > viewportHeight - 8) { top = Math.max(8, anchor.top - height - 7); }
                        palette.style.left = (left - origin.left) + 'px'; palette.style.top = (top - origin.top) + 'px';
                    }
                    function schedulePalette(focusSelector) {
                        $timeout.cancel(paletteTimer);
                        paletteTimer = $timeout(function () {
                            paletteTimer = null; if (!visible() || !ui.paletteOpen) { return; } positionPalette();
                            var target = focusSelector && palette && (palette.querySelector(focusSelector) || palette.querySelector('.study-notebook-swatch[tabindex="0"]')); if (target) { target.focus(); }
                        }, 0, false);
                    }
                    ui.togglePalette = function () {
                        if (ui.readOnly) { return; } if (ui.paletteOpen) { ui.closePalette(); return; }
                        finishStroke(true); palette = overlay.querySelector('.study-notebook-palette');
                        if (!palette) { return; } ui.paletteOpen = true; ui.customColorOpen = false;
                        ui.paletteFocusColor = ui.paletteColors.indexOf(ui.inkColor) >= 0 ? ui.inkColor : ui.paletteColors[0];
                        schedulePalette('.study-notebook-swatch[aria-pressed="true"]');
                    };
                    ui.selectInkColor = function (color) {
                        color = normalizedColor(color); if (!color || ui.isLocked()) { return; } flushText(); finishStroke(true); ui.inkColor = color;
                        ui.session.document.textColor = color; markChanged(); scheduleLayout();
                        if (ui.paletteColors.indexOf(color) < 0 && ui.customColors.indexOf(color) < 0) { ui.customColors.unshift(color); ui.customColors = ui.customColors.slice(0, 8); }
                        ui.closePalette();
                    };
                    ui.paletteKey = function (event, index) {
                        var next = index;
                        if (event.key === 'ArrowLeft') { next--; } else if (event.key === 'ArrowRight') { next++; }
                        else if (event.key === 'ArrowUp') { next -= 10; } else if (event.key === 'ArrowDown') { next += 10; }
                        else if (event.key === 'Home') { next = event.ctrlKey ? 0 : Math.floor(index / 10) * 10; }
                        else if (event.key === 'End') { next = event.ctrlKey ? ui.paletteColors.length - 1 : Math.floor(index / 10) * 10 + 9; } else { return; }
                        event.preventDefault(); event.stopPropagation(); next = Math.max(0, Math.min(ui.paletteColors.length - 1, next)); ui.paletteFocusColor = ui.paletteColors[next];
                        var choices = palette && palette.querySelectorAll('.study-notebook-palette-grid .study-notebook-swatch'); if (choices && choices[next]) { choices[next].focus(); }
                    };
                    ui.openCustomColor = function () { ui.customColorOpen = true; ui.customColor = ui.inkColor; ui.customHex = ui.inkColor; schedulePalette('input[type="text"]'); };
                    ui.validCustomColor = function () { return !!normalizedColor(ui.customHex); };
                    ui.customHexChanged = function () { var color = normalizedColor(ui.customHex); if (color) { ui.customColor = color; } };
                    ui.applyCustomColor = function () { if (ui.validCustomColor()) { ui.selectInkColor(ui.customHex); } };
                    ui.canOpen = function () {
                        return !!ui.enabled && Number(ui.testId) > 0 &&
                            (Number(ui.userId) > 0 || (ui.readOnly && !!ui.sessionOpener));
                    };
                    ui.isLocked = function () { return !!ui.readOnly || !ui.session || !ui.session.document || ui.session.status === 'loading' || ui.session.status === 'conflict'; };
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
                            try { ui.session = ui.sessionOpener ? ui.sessionOpener() : $injector.get('StudyNotebookStore').open({ userId: ui.userId, testId: ui.testId, testMode: ui.testMode }); }
                            catch (error) { return; }
                            knownStrokes = strokes();
                            if (ui.session.ready && ui.session.ready.then) {
                                ui.session.ready.then(function () {
                                    if (alive) {
                                        undo = []; redo = []; knownStrokes = strokes();
                                        // Loading may finish after a blank frame was cached.
                                        // Invalidate it even when the page dimensions stay the same.
                                        cacheDirty = true; scheduleLayout();
                                    }
                                }, angular.noop);
                            }
                        }
                        ui.isOpen = true; openNotebooks++;
                        if (ui.session.setVisible) { ui.session.setVisible(true); }
                        document.body.classList.add('study-notebook-open'); positionOverlay(); scheduleLayout();
                        $timeout.cancel(layoutTimer);
                        layoutTimer = $timeout(function () {
                            layoutTimer = null;
                            if (visible()) { var closeButton = dialog.querySelector('.study-notebook-close'); if (closeButton) { closeButton.focus(); } layout(); }
                        }, 0, false);
                    }
                    ui.close = function () {
                        if (!ui.isOpen) { return; }
                        ui.closePalette(false);
                        flushText(); finishStroke(true); setInkSelection(null); compositionEnd(); saveNow(); ui.isOpen = false;
                        if (ui.session && ui.session.setVisible) { ui.session.setVisible(false); }
                        openNotebooks = Math.max(0, openNotebooks - 1);
                        if (!openNotebooks) { document.body.classList.remove('study-notebook-open'); }
                        $timeout.cancel(layoutTimer); layoutTimer = null;
                        if (raf) { cancelFrame.call($window, raf); raf = null; }
                        canvas.width = canvas.height = inkCache.width = inkCache.height = 0; cacheDirty = true;
                        var target = restoreFocus && document.documentElement.contains(restoreFocus) ? restoreFocus : button;
                        if (alive && target && target.focus) { try { target.focus({ preventScroll: true }); } catch (ignore) { target.focus(); } }
                        if (ui.onClose) { digest(function () { ui.onClose(); }); }
                    };
                    ui.toggle = function () { if (ui.isOpen) { ui.close(); } else { open(); } };
                    ui.save = function () { flushText(); finishStroke(true); saveNow(); };
                    ui.refresh = function () { flushText(); finishStroke(true); if (ui.session) { preventPromiseNoise(ui.session.refresh()); } };
                    ui.resolve = function (method) {
                        flushText(); finishStroke(true);
                        if (ui.session && typeof ui.session[method] === 'function') {
                            undo = []; redo = []; setInkSelection(null); preventPromiseNoise(ui.session[method]()); scheduleLayout();
                        }
                    };
                    ui.changed = function () { if (!ui.isLocked()) { finishStroke(true); markChanged(); scheduleLayout(); } };
                    ui.setTool = function (tool) {
                        if (tool === 'lasso' && (!ui.inkSelection || ui.isLocked())) { return; }
                        ui.closePalette(false); finishStroke(true);
                        if (tool !== ui.tool) { setInkSelection(null); }
                        ui.tool = tool; scheduleDraw();
                    };
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
                        ui.zoomSliderValue = percent;
                        if (percent === ui.zoomPercent) { return; }
                        flushText(); finishStroke(true); zoomAnchor = captureZoomAnchor(); ui.zoomPercent = percent; layout();
                    };
                    ui.zoomIn = function () { ui.setZoom(ui.zoomPercent + 25); };
                    ui.zoomOut = function () { ui.setZoom(ui.zoomPercent - 25); };
                    ui.fitZoom = function () { ui.setZoom(100); };
                    ui.goToPage = function (page) {
                        if (!ui.paged || !ui.session || !ui.session.document) { return; }
                        page = Number(page);
                        if (!Number.isInteger(page) || page < 1 || page > ui.pages.length) { return; }
                        flushText(); finishStroke(true); layout();
                        var paperTop = paper.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
                        scroller.scrollTop += paperTop + (page - 1) * pageHeight * scale - 10;
                        ui.currentPage = page;
                    };
                    ui.addPage = function () {
                        if (!ui.paged || ui.isLocked()) { return; }
                        flushText(); finishStroke(true); layout();
                        if (ui.pages.length >= 80) { return; }
                        ui.session.document.pageCount = ui.pages.length + 1;
                        markChanged(); layout(); ui.goToPage(ui.pages.length);
                    };
                    ui.canUndo = function () { return undo.length > 0 && !ui.isLocked(); };
                    ui.canRedo = function () { return redo.length > 0 && !ui.isLocked(); };
                    function replaceStrokes(next, history) {
                        var previous = strokes();
                        if (history) { undo.push(previous); if (undo.length > 30) { undo.shift(); } redo = []; }
                        ui.session.document.strokes = next; knownStrokes = next; cacheDirty = true; markChanged(); scheduleLayout(); digest();
                    }
                    ui.undo = function () { finishStroke(true); if (ui.canUndo()) { setInkSelection(null); redo.push(strokes()); replaceStrokes(undo.pop(), false); } };
                    ui.redo = function () { finishStroke(true); if (ui.canRedo()) { setInkSelection(null); undo.push(strokes()); replaceStrokes(redo.pop(), false); } };

                    function extent() {
                        var doc = ui.session && ui.session.document;
                        pageWidth = doc && doc.orientation === 'landscape' ? 1123 : 794;
                        pageHeight = doc && doc.orientation === 'landscape' ? 794 : 1123;
                        var count = ui.paged ? Number(doc && doc.pageCount) || 3 : 1;
                        logicalWidth = pageWidth; logicalHeight = pageHeight * count;
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
                        textarea.style.color = /^#[0-9a-f]{6}$/i.test(ui.session.document.textColor || '') ? ui.session.document.textColor : '#27364d';
                        textarea.style.height = '0px';
                        var textHeight = textarea.scrollHeight;
                        textarea.style.height = Math.max(logicalHeight * scale, textHeight + 4) + 'px';
                        var height = Math.max(logicalHeight * scale, textarea.getBoundingClientRect().height);
                        if (ui.paged) {
                            var count = Math.max(1, Math.ceil((height / scale - 0.1) / pageHeight));
                            height = count * pageHeight * scale;
                            textarea.style.height = height + 'px';
                            ui.pageStep = pageHeight * scale;
                            // A phone can show more than one A4 page at once.
                            // Leave enough room to bring the final page to the top.
                            pageFrame.style.marginBottom = Math.max(0, scroller.clientHeight - ui.pageStep) + 'px';
                            if (ui.pages.length !== count) {
                                ui.pages = Array.from({length: count}, function (_, index) { return index + 1; });
                                digest();
                            }
                            ui.currentPage = Math.min(count, Math.max(1, ui.currentPage));
                        }
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
                        if (ui.paletteOpen) { positionPalette(); }
                    }
                    function scheduleLayout() {
                        if (!visible()) { return; }
                        $timeout.cancel(layoutTimer);
                        layoutTimer = $timeout(function () { layoutTimer = null; layout(); }, 0, false);
                    }
                    function pageScrolled() {
                        if (!visible() || !ui.paged || !ui.pages.length || !scale) { return; }
                        var viewport = scroller.getBoundingClientRect(), bounds = paper.getBoundingClientRect();
                        var page = Math.max(1, Math.min(ui.pages.length, Math.floor((viewport.top + 12 - bounds.top) / (pageHeight * scale)) + 1));
                        if (page !== ui.currentPage) { digest(function () { ui.currentPage = page; }); }
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
                    function boundsFor(points) {
                        var box = [Infinity, Infinity, -Infinity, -Infinity];
                        points.forEach(function (point) {
                            box[0] = Math.min(box[0], point[0]); box[1] = Math.min(box[1], point[1]);
                            box[2] = Math.max(box[2], point[0]); box[3] = Math.max(box[3], point[1]);
                        });
                        return box;
                    }
                    function drawInkSelection() {
                        var path = inkGesture && inkGesture.path;
                        if (!selectedInk && !path) { return; }
                        context.save();
                        context.strokeStyle = '#4369d3'; context.lineWidth = 1.5 / scale; context.setLineDash([5 / scale, 4 / scale]);
                        if (path) {
                            context.beginPath();
                            context.moveTo(path[0][0], path[0][1]);
                            for (var i = 1; i < path.length; i++) { context.lineTo(path[i][0], path[i][1]); }
                            if (path.length > 2) {
                                context.closePath(); context.fillStyle = 'rgba(67,105,211,.12)'; context.fill('evenodd');
                            }
                            context.stroke();
                        } else {
                            var box = selectedInk.bounds, padding = selectionPadding();
                            if (inkGesture) { context.translate(inkGesture.dx, inkGesture.dy); }
                            context.strokeRect(box[0] - padding, box[1] - padding, box[2] - box[0] + 2 * padding, box[3] - box[1] + 2 * padding);
                        }
                        context.restore();
                    }
                    function draw() {
                        raf = null;
                        if (!visible() || !context) { return; }
                        var moving = inkGesture && inkGesture.origin && selectedInk;
                        context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, canvas.width, canvas.height);
                        if (cacheDirty && cacheContext) {
                            cacheContext.setTransform(1, 0, 0, 1, 0, 0); cacheContext.clearRect(0, 0, inkCache.width, inkCache.height);
                            cacheContext.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0); inkBounds = [];
                            strokes().forEach(function (stroke) {
                                if (!moving || !selectedInk.strokes.has(stroke)) { paintStroke(stroke, cacheContext); }
                                inkBounds.push(boundsFor(stroke.points || []));
                            }); cacheDirty = false;
                        }
                        if (!erasing && cacheContext) { context.drawImage(inkCache, 0, 0); }
                        context.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
                        if (erasing || !cacheContext) {
                            strokes().forEach(function (stroke, index) {
                                if ((!erasing || !erasing[index]) && (!moving || !selectedInk.strokes.has(stroke))) { paintStroke(stroke); }
                            });
                        }
                        if (moving) {
                            context.save(); context.translate(inkGesture.dx, inkGesture.dy);
                            selectedInk.strokes.forEach(function (stroke) { paintStroke(stroke); });
                            context.restore();
                        }
                        if (drawing) { paintStroke(drawing); }
                        context.globalAlpha = 1;
                        drawInkSelection();
                    }
                    function scheduleDraw() { if (visible() && !raf) { raf = requestFrame.call($window, draw); } }
                    function roundCoordinate(value) { return Math.round(value * 100) / 100; }
                    function position(event) {
                        var box = canvas.getBoundingClientRect();
                        return [roundCoordinate(Math.max(0, Math.min(logicalWidth, (event.clientX - box.left) / scale))),
                            roundCoordinate(Math.max(0, Math.min(logicalHeight, (event.clientY - box.top) / scale))),
                            event.pointerType === 'pen' && event.pressure > 0 ? Math.round(Math.min(1, event.pressure) * 1000) / 1000 : 0.5];
                    }
                    function selectionPadding() { return selectedInk.radius + 6 / scale; }
                    function insideBounds(point, box, padding) {
                        return point[0] >= box[0] - padding && point[0] <= box[2] + padding &&
                            point[1] >= box[1] - padding && point[1] <= box[3] + padding;
                    }
                    function segmentOverlaps(a, b, box) {
                        return Math.max(a[0], b[0]) >= box[0] && Math.min(a[0], b[0]) <= box[2] &&
                            Math.max(a[1], b[1]) >= box[1] && Math.min(a[1], b[1]) <= box[3];
                    }
                    function sideOf(a, b, point) {
                        return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
                    }
                    function insideOutline(point, path) {
                        var inside = false;
                        for (var i = 0, j = path.length - 1; i < path.length; j = i++) {
                            var a = path[j], b = path[i];
                            if ((a[1] > point[1]) !== (b[1] > point[1]) &&
                                point[0] < a[0] + (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1])) { inside = !inside; }
                        }
                        return inside;
                    }
                    function selectOutlinedInk(path) {
                        var box = boundsFor(path);
                        if (path.length < 3 || Math.min(box[2] - box[0], box[3] - box[1]) * scale < 4) { return null; }
                        var edges = path.map(function (point, index) {
                            var previous = path[index ? index - 1 : path.length - 1];
                            return {a: previous, b: point, bounds: boundsFor([previous, point])};
                        });
                        var source = strokes(), selected = new Set(), bounds = [Infinity, Infinity, -Infinity, -Infinity], radius = 0;
                        source.forEach(function (stroke, index) {
                            var limits = (!cacheDirty && inkBounds[index]) || boundsFor(stroke.points);
                            if (limits[2] < box[0] || limits[0] > box[2] || limits[3] < box[1] || limits[1] > box[3]) { return; }
                            var hit = stroke.points.some(function (point, i) {
                                if (insideBounds(point, box, 0) && insideOutline(point, path)) { return true; }
                                var previous = stroke.points[Math.max(0, i - 1)];
                                // A sparse legacy stroke can cross the outline with both endpoints outside.
                                return segmentOverlaps(previous, point, box) && edges.some(function (edge) {
                                    return segmentOverlaps(previous, point, edge.bounds) &&
                                        sideOf(previous, point, edge.a) * sideOf(previous, point, edge.b) <= 0 &&
                                        sideOf(edge.a, edge.b, previous) * sideOf(edge.a, edge.b, point) <= 0;
                                });
                            });
                            if (hit) {
                                selected.add(stroke); radius = Math.max(radius, stroke.width * 0.7);
                                bounds = [Math.min(bounds[0], limits[0]), Math.min(bounds[1], limits[1]), Math.max(bounds[2], limits[2]), Math.max(bounds[3], limits[3])];
                            }
                        });
                        return selected.size ? {source: source, strokes: selected, bounds: bounds, radius: radius} : null;
                    }
                    function setInkSelection(selection) {
                        var changed = !!selection !== !!selectedInk;
                        selectedInk = selection; ui.inkSelected = !!selection;
                        if (!selection && changed) { canvas.style.cursor = ''; }
                        if (changed) { digest(); scheduleDraw(); }
                    }
                    function beginInkGesture(point) {
                        if (selectedInk && selectedInk.source === strokes() && insideBounds(point, selectedInk.bounds, selectionPadding())) {
                            inkGesture = {origin: point, dx: 0, dy: 0};
                            cacheDirty = true; canvas.style.cursor = 'grabbing';
                        } else {
                            setInkSelection(null); inkGesture = {path: [point]};
                        }
                    }
                    function updateInkGesture(point, force) {
                        if (inkGesture.path) {
                            var path = inkGesture.path, last = path[path.length - 1];
                            var distance = Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]);
                            if (distance && (force || distance * scale >= 3)) {
                                if (path.length >= 256) { path = inkGesture.path = thinPoints(path); }
                                path.push(point);
                            }
                        } else {
                            var box = selectedInk.bounds, maxCoordinate = 100000;
                            inkGesture.dx = Math.max(-box[0], Math.min(Math.min(logicalWidth, maxCoordinate) - box[2], point[0] - inkGesture.origin[0]));
                            inkGesture.dy = Math.max(-box[1], Math.min(Math.min(logicalHeight, maxCoordinate) - box[3], point[1] - inkGesture.origin[1]));
                        }
                    }
                    function completeInkGesture() {
                        if (ui.readOnly) { return; }
                        if (inkGesture.path) { setInkSelection(selectOutlinedInk(inkGesture.path)); return; }
                        if (!selectedInk || selectedInk.source !== strokes()) { setInkSelection(null); return; }
                        var dx = inkGesture.dx, dy = inkGesture.dy;
                        if ((Math.abs(dx) + Math.abs(dy)) * scale < 2) { return; }
                        var shifted = new Set();
                        var next = selectedInk.source.map(function (stroke) {
                            if (!selectedInk.strokes.has(stroke)) { return stroke; }
                            var moved = Object.assign({}, stroke, {points: stroke.points.map(function (point) {
                                var copy = point.slice();
                                copy[0] = roundCoordinate(point[0] + dx); copy[1] = roundCoordinate(point[1] + dy);
                                return copy;
                            })});
                            shifted.add(moved);
                            return moved;
                        });
                        var bounds = selectedInk.bounds.map(function (value, index) { return roundCoordinate(value + (index % 2 ? dy : dx)); });
                        setInkSelection({source: next, strokes: shifted, bounds: bounds, radius: selectedInk.radius});
                        replaceStrokes(next, true);
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
                                    var first = sideOf(erasePrevious, point, a), second = sideOf(erasePrevious, point, b);
                                    var third = sideOf(a, b, erasePrevious), fourth = sideOf(a, b, point);
                                    hit = (first * second < 0 && third * fourth < 0) || distanceToSegment(erasePrevious, a, b) <= radius * radius ||
                                        distanceToSegment(a, erasePrevious, point) <= radius * radius || distanceToSegment(b, erasePrevious, point) <= radius * radius;
                                }
                                if (hit) { erasing[index] = true; break; }
                            }
                        }); erasePrevious = point;
                    }
                    function thinPoints(points) {
                        // Decimate the whole old curve while retaining both endpoints.
                        var compact = [points[0]];
                        for (var index = 2; index < points.length - 1; index += 2) { compact.push(points[index]); }
                        compact.push(points[points.length - 1]);
                        return compact;
                    }
                    function addPoint(event, force) {
                        var point = position(event);
                        if (inkGesture) { updateInkGesture(point, force); return; }
                        if (erasing) { eraseAt(point); return; }
                        if (!drawing) { return; }
                        var previous = drawing.points[drawing.points.length - 1];
                        if (force || !previous || Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1]) >= 0.8 || Math.abs(point[2] - previous[2]) > 0.15) {
                            if (drawing.points.length >= 2500) { drawing.points = thinPoints(drawing.points); }
                            drawing.points.push(point);
                        }
                    }
                    function pointerDown(event) {
                        if (!visible() || ui.tool === 'text' || ui.isLocked() || !context || pointer !== null ||
                            (event.pointerType === 'touch' && !ui.touchDrawing) || (event.button !== undefined && event.button !== 0)) { return; }
                        event.preventDefault(); event.stopPropagation(); pointer = event.pointerId;
                        if (ui.session.setInteraction) { ui.session.setInteraction(true, 'pen'); }
                        if (ui.tool === 'lasso') { beginInkGesture(position(event)); }
                        else if (ui.tool === 'eraser') { erasing = {}; erasePrevious = null; }
                        else { drawing = { id: 'ink-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9), tool: ui.tool,
                            color: ui.inkColor, width: Number(ui.inkWidth) * (ui.tool === 'highlighter' ? 4 : 1), points: [] }; }
                        try { canvas.setPointerCapture(pointer); } catch (ignoreCapture) { /* Pointer delivery still works while inside canvas. */ }
                        addPoint(event, true); scheduleDraw();
                    }
                    function pointerMove(event) {
                        if (pointer === null && selectedInk) {
                            canvas.style.cursor = insideBounds(position(event), selectedInk.bounds, selectionPadding()) ? 'grab' : '';
                        }
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
                        if (inkGesture) {
                            if (inkGesture.origin) { cacheDirty = true; }
                            inkGesture = null; canvas.style.cursor = '';
                        }
                        try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(pointerId)) { canvas.releasePointerCapture(pointerId); } } catch (ignoreRelease) {}
                        if (next) { replaceStrokes(next, true); } else { scheduleDraw(); }
                        if (ui.session && ui.session.setInteraction) { ui.session.setInteraction(false, 'pen'); }
                    }
                    function pointerUp(event) {
                        if (pointer === null || event.pointerId !== pointer) { return; }
                        addPoint(event, true);
                        try { if (inkGesture) { completeInkGesture(); } }
                        finally { finishStroke(true); }
                    }
                    function pointerCancel(event) { if (pointer !== null && event.pointerId === pointer) { finishStroke(true); } }

                    function keydown(event) {
                        if (!visible()) { return; }
                        event.stopPropagation();
                        if ((event.key === 'Escape' || event.keyCode === 27) && !event.isComposing) {
                            event.preventDefault();
                            if (ui.paletteOpen) { digest(ui.closePalette); }
                            else if (inkGesture || selectedInk) { digest(function () { finishStroke(false); setInkSelection(null); }); }
                            else { digest(ui.close); }
                            return;
                        }
                        if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's') { event.preventDefault(); digest(ui.save); return; }
                        if (event.key !== 'Tab' && event.keyCode !== 9) { return; }
                        var controls = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]'));
                        if (ui.paletteOpen && palette) { controls = controls.concat(Array.prototype.slice.call(palette.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),input:not([disabled])'))); }
                        controls = controls.filter(function (node) { return node.getClientRects().length > 0; });
                        if (!controls.length) { event.preventDefault(); return; }
                        var first = controls[0], last = controls[controls.length - 1];
                        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                    }
                    function stopKeys(event) { if (visible()) { event.stopPropagation(); } }
                    function backdrop(event) { if (event.target === overlay) { digest(ui.close); } }
                    function blockBackground(event) {
                        var trigger = ui.paletteOpen && colorTrigger();
                        if (ui.paletteOpen && palette && !palette.contains(event.target) && !(trigger && trigger.contains(event.target))) { digest(function () { ui.closePalette(false); }); }
                        if (visible() && !overlay.contains(event.target) && !button.contains(event.target)) { event.preventDefault(); event.stopPropagation(); }
                    }
                    function keepFocus(event) {
                        if (visible() && !overlay.contains(event.target) && !button.contains(event.target)) {
                            var target = dialog.querySelector('.study-notebook-close'); if (target) { target.focus(); }
                        }
                    }
                    function flushBeforeLeave() { if (ui.session) { flushText(); finishStroke(true); compositionEnd(); saveNow(); } }
                    function visibilityChanged() { if (document.visibilityState === 'hidden') { flushBeforeLeave(); } }
                    function compositionStart() { composing = true; if (ui.session && ui.session.setInteraction) { ui.session.setInteraction(true, 'text'); } }
                    function compositionEnd() { if (!composing) { return; } flushText(); composing = false; if (ui.session && ui.session.setInteraction) { ui.session.setInteraction(false, 'text'); } }
                    function identityChanged() {
                        var next = [ui.userId, ui.testMode, ui.testId, !!ui.enabled, ui.sessionKey || ''].join(':');
                        if (identity === next) { return; }
                        identity = next; ui.close();
                        if (ui.session) { ui.session.destroy(); ui.session = null; }
                        undo = []; redo = []; knownStrokes = null; ui.zoomPercent = 100; ui.zoomSliderValue = 100; zoomAnchor = null;
                        ui.pages = []; ui.currentPage = 1;
                        if (ui.autoOpen && ui.canOpen()) { digest(open); }
                    }
                    var unwatchIdentity = scope.$watchGroup(['notebook.userId', 'notebook.testMode', 'notebook.testId', 'notebook.enabled', 'notebook.sessionKey'], identityChanged);
                    var unwatchStrokes = scope.$watchCollection(function () { return strokes(); }, function (value) {
                        if (value !== knownStrokes) {
                            knownStrokes = value; cacheDirty = true; undo = []; redo = [];
                            if (inkGesture) { finishStroke(false); }
                            setInkSelection(null); scheduleLayout();
                        }
                    });
                    var unwatchStatus = scope.$watch(function () { return ui.session && ui.session.status; }, function () { scheduleLayout(); });
                    var unwatchTextColor = scope.$watch(function () { return ui.session && ui.session.document && ui.session.document.textColor; }, function (color) {
                        if (/^#[0-9a-f]{6}$/i.test(color || '')) { ui.inkColor = color.toLowerCase(); } scheduleLayout();
                    });
                    textarea.addEventListener('compositionstart', compositionStart); textarea.addEventListener('compositionend', compositionEnd);
                    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
                    canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerCancel);
                    canvas.addEventListener('lostpointercapture', pointerCancel);
                    overlay.addEventListener('keydown', keydown); overlay.addEventListener('keyup', stopKeys); overlay.addEventListener('keypress', stopKeys);
                    overlay.addEventListener('click', backdrop); document.addEventListener('click', blockBackground, true);
                    document.addEventListener('pointerdown', blockBackground, true); document.addEventListener('mousedown', blockBackground, true);
                    document.addEventListener('focusin', keepFocus, true);
                    $window.addEventListener('pagehide', flushBeforeLeave); document.addEventListener('visibilitychange', visibilityChanged);
                    $window.addEventListener('resize', scheduleLayout);
                    scroller.addEventListener('scroll', pageScrolled, {passive: true});
                    var toolbar = dialog.querySelector('.study-notebook-toolbar'); if (toolbar) { toolbar.addEventListener('scroll', positionPalette); }
                    if ($window.ResizeObserver) { observer = new $window.ResizeObserver(scheduleLayout); observer.observe(paper); }
                    scope.$on('$destroy', function () {
                        ui.close(); alive = false; unwatchIdentity(); unwatchStrokes(); unwatchStatus(); unwatchTextColor();
                        $timeout.cancel(layoutTimer); if (raf) { cancelFrame.call($window, raf); raf = null; }
                        $timeout.cancel(paletteTimer); if (toolbar) { toolbar.removeEventListener('scroll', positionPalette); }
                        if (observer) { observer.disconnect(); }
                        if (ui.session) { ui.session.destroy(); ui.session = null; }
                        textarea.removeEventListener('compositionstart', compositionStart); textarea.removeEventListener('compositionend', compositionEnd);
                        canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
                        canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerCancel);
                        canvas.removeEventListener('lostpointercapture', pointerCancel);
                        overlay.removeEventListener('keydown', keydown); overlay.removeEventListener('keyup', stopKeys); overlay.removeEventListener('keypress', stopKeys);
                        overlay.removeEventListener('click', backdrop); document.removeEventListener('click', blockBackground, true);
                        document.removeEventListener('pointerdown', blockBackground, true); document.removeEventListener('mousedown', blockBackground, true);
                        document.removeEventListener('focusin', keepFocus, true);
                        $window.removeEventListener('pagehide', flushBeforeLeave); document.removeEventListener('visibilitychange', visibilityChanged);
                        $window.removeEventListener('resize', scheduleLayout);
                        scroller.removeEventListener('scroll', pageScrolled);
                        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
                    });
                }
            };
        }]);
}());
