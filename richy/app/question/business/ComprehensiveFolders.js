(function () {
    'use strict';
    angular.module('Hrm.Question').factory('TestFolderService', ['$http', 'settings', function ($http, settings) {
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url + 'test_folder';
        return {
            getTestFolders: function (allTeachers, testMode) { return $http.get(baseUrl, {params: {allTeachers: allTeachers === true, testMode: testMode || 'COMPREHENSIVE'}}).then(function (response) { return response.data; }); },
            saveTestFolder: function (folder) { return $http.post(baseUrl + '/save', folder).then(function (response) { return response.data; }); },
            moveTest: function (testId, folderId) { return $http.post(baseUrl + '/move_test', {testId: testId, folderId: folderId == null ? null : folderId}).then(function (response) { return response.data; }); }
        };
    }]);
    angular.module('Hrm.Question').factory('ComprehensiveFolders', ['TestFolderService', '$rootScope', '$q', function (service, $rootScope, $q) {
        var cached = {}, pending = {};
        function options(items, allTeachers) {
            var byId = {}, children = {}, output = [], seen = {};
            (items || []).forEach(function (folder) { byId[folder.id] = folder; });
            (items || []).forEach(function (folder) {
                var parent = byId[folder.parentId] && byId[folder.parentId].ownerId === folder.ownerId ? folder.parentId : 'root';
                (children[parent] = children[parent] || []).push(folder);
            });
            function visit(folder, path, depth) {
                if (seen[folder.id]) { return; } seen[folder.id] = true;
                var label = path ? path + ' / ' + folder.name : (allTeachers ? folder.ownerName + ' / ' : '') + folder.name;
                output.push(angular.extend({}, folder, {label: label, depth: depth}));
                (children[folder.id] || []).sort(sort).forEach(function (child) { visit(child, label, depth + 1); });
            }
            function sort(a, b) { return String(a.ownerName || '').localeCompare(String(b.ownerName || '')) || String(a.name || '').localeCompare(String(b.name || '')); }
            (children.root || []).sort(sort).forEach(function (folder) { visit(folder, '', 0); });
            // Keep orphaned legacy entries selectable without recursing forever.
            (items || []).slice().sort(sort).forEach(function (folder) { if (!seen[folder.id]) { visit(folder, '', 0); } });
            return output;
        }
        function load(allTeachers, refresh, testMode) {
            var key = (testMode || 'COMPREHENSIVE') + ':' + (allTeachers ? 'all' : 'mine');
            if (pending[key]) { return pending[key]; }
            if (cached[key] && !refresh) { return $q.when(cached[key]); }
            pending[key] = service.getTestFolders(allTeachers, testMode || 'COMPREHENSIVE').then(function (items) {
                cached[key] = items || []; return cached[key];
            }).finally(function () { delete pending[key]; });
            return pending[key];
        }
        function applyFilter(dto, id, browsing, keepTopics) {
            dto.testFolderId = id != null && Number(id) > 0 ? Number(id) : null;
            var searching = !!String(dto.textSearch || '').trim();
            dto.withoutTestFolder = Number(id) === -1 || (browsing && id == null && !searching);
            dto.includeSubfolders = !browsing || searching;
            if (!keepTopics) { dto.questionTopics = []; dto.topicId = dto.topicOwnerUserId = dto.topicCategoryId = null; dto.withoutTopics = false; }
            dto.pageIndex = 1;
        }
        function bindUrl(scope, location, target, property, onChange) {
            var path = location.path();
            function read() {
                var value = location.search().folder;
                return typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number(value) < 9007199254740992 ? Number(value) : null;
            }
            target[property] = read();
            var unbind = scope.$on('$locationChangeSuccess', function () {
                if (location.path() !== path) { return; }
                var id = read();
                if (target[property] === id) { return; }
                target[property] = id;
                onChange();
            });
            scope.$on('$destroy', unbind);
            return function () {
                if (location.path() === path) { location.search('folder', target[property] == null ? null : String(target[property])); }
            };
        }
        function contains(id, selected, testMode) {
            if (selected == null) { return true; }
            if (Number(selected) === -1) { return id == null; }
            var prefix = (testMode || 'COMPREHENSIVE') + ':';
            var all = cached[prefix + 'all'] || cached[prefix + 'mine'] || [], byId = {}, seen = {};
            all.forEach(function (folder) { byId[folder.id] = folder; });
            while (id != null && !seen[id]) {
                if (String(id) === String(selected)) { return true; }
                seen[id] = true; id = byId[id] && byId[id].parentId;
            }
            return false;
        }
        function save(dto) {
            return service.saveTestFolder(dto).then(function (saved) {
                cached = {}; $rootScope.$broadcast('comprehensiveFoldersChanged'); return saved;
            });
        }
        function moveTest(testId, folderId) { return service.moveTest(testId, folderId); }
        function moveFolder(folder, parentId) {
            return service.saveTestFolder({id: folder.id, name: folder.name, parentId: parentId, testMode: folder.testMode}).then(function (saved) {
                if (!saved || String(saved.id) !== String(folder.id) || String(saved.parentId == null ? null : saved.parentId) !== String(parentId == null ? null : parentId)) {
                    throw new Error('Máy chủ chưa xác nhận vị trí mới của folder. Bạn có thể thử lại.');
                }
                Object.keys(cached).forEach(function (key) {
                    cached[key].forEach(function (item) { if (String(item.id) === String(saved.id)) { angular.extend(item, saved); } });
                });
                $rootScope.$broadcast('comprehensiveFolderMoved', saved);
                return saved;
            });
        }
        return {options: options, load: load, save: save, applyFilter: applyFilter, bindUrl: bindUrl, contains: contains, moveTest: moveTest, moveFolder: moveFolder};
    }]);

    angular.module('Hrm.Question').directive('testFolderPicker', ['ComprehensiveFolders', '$timeout', function (folders, $timeout) {
        return {
            restrict: 'E', scope: {folderId: '=', showAll: '=?', manage: '=?', allTeachers: '=?', testMode: '=?', onChange: '&'},
            template: '<div class="test-folder-picker">' +
                '<select class="form-control" ng-model="folderId" ng-options="folder.id as folder.label for folder in choices" ng-change="changed()" ng-disabled="loading || saving" aria-label="Chọn folder">' +
                '<option value="">{{showAll ? "Tất cả folder" : "Chưa vào folder"}}</option></select>' +
                '<div class="test-folder-actions" ng-if="manage">' +
                '<button type="button" class="btn btn-default btn-sm" ng-click="create(false)" ng-disabled="loading || saving">+ Folder</button>' +
                '<button type="button" class="btn btn-default btn-sm" ng-if="folderId > 0" ng-click="create(true)" ng-disabled="loading || saving">+ Folder con</button>' +
                '<button type="button" class="btn btn-default btn-sm" ng-if="selected().canManage" ng-click="rename()" ng-disabled="saving">Đổi tên</button></div>' +
                '<p ng-if="loading" role="status">Đang tải folder...</p><p class="test-folder-error" ng-if="error" role="alert">{{error}} <button type="button" class="btn btn-link btn-sm" ng-click="reload(true)">Thử lại</button></p>' +
                '<div class="test-folder-editor" ng-if="editor">' +
                '<label>Tên folder<input class="form-control" type="text" maxlength="200" ng-model="editor.name" aria-label="Tên folder"></label>' +
                '<p>{{editor.parentId ? "Folder cha: " + parentLabel(editor.parentId) : "Folder ở cấp cao nhất"}}</p>' +
                '<button type="button" class="btn btn-primary btn-sm" ng-click="save()" ng-disabled="saving || !editor.name.trim()">{{saving ? "Đang lưu..." : "Lưu folder"}}</button> ' +
                '<button type="button" class="btn btn-default btn-sm" ng-click="cancelEditor()" ng-disabled="saving">Hủy</button></div></div>',
            link: function (scope, element) {
                var editorFocusTimer;
                function focusEditor() {
                    $timeout.cancel(editorFocusTimer);
                    editorFocusTimer = $timeout(function () {
                        var input = element[0].querySelector('.test-folder-editor input');
                        if (scope.editor && input) { input.focus(); input.select(); }
                    });
                }
                scope.cancelEditor = function () { if (!scope.saving) { $timeout.cancel(editorFocusTimer); scope.editor = null; scope.error = ''; } };
                scope.reload = function (refresh) {
                    scope.loading = true; scope.error = '';
                    return folders.load(scope.allTeachers === true, refresh, scope.testMode).then(function (items) {
                        scope.options = folders.options(items, scope.allTeachers === true);
                        scope.choices = (scope.showAll ? [{id: -1, label: 'Chưa vào folder'}] : []).concat(scope.options);
                    }, function () { scope.error = 'Không tải được folder.'; }).finally(function () { scope.loading = false; });
                };
                scope.selected = function () { return (scope.options || []).filter(function (folder) { return folder.id == scope.folderId; })[0] || {}; };
                scope.parentLabel = function (id) { var match = (scope.options || []).filter(function (folder) { return folder.id == id; })[0]; return match ? match.label : ''; };
                scope.changed = function () { scope.onChange({folderId: scope.folderId == null ? null : scope.folderId}); };
                scope.create = function (child) { scope.editor = {name: '', parentId: child ? scope.folderId : null, testMode: scope.testMode || 'COMPREHENSIVE'}; scope.error = ''; focusEditor(); };
                scope.rename = function () { var folder = scope.selected(); scope.editor = {id: folder.id, name: folder.name, parentId: folder.parentId, testMode: scope.testMode || 'COMPREHENSIVE'}; scope.error = ''; focusEditor(); };
                scope.save = function () {
                    if (scope.saving || !scope.editor) { return; } scope.saving = true; scope.error = '';
                    folders.save(scope.editor).then(function (saved) {
                        scope.folderId = saved.id; scope.editor = null; scope.changed(); return scope.reload(true);
                    }, function (response) { scope.error = (response.data || {}).message || 'Không lưu được folder.'; }).finally(function () { scope.saving = false; });
                };
                scope.$on('comprehensiveFoldersChanged', function () { scope.reload(true); });
                scope.$on('comprehensiveFolderMoved', function () { scope.reload(false); });
                scope.$on('$destroy', function () { $timeout.cancel(editorFocusTimer); });
                scope.reload();
            }
        };
    }]);

    angular.module('Hrm.Question').directive('testPublicationStatus', ['QuestionService', function (service) {
        return {
            restrict: 'E', scope: {test: '=', disabled: '=?', onChanged: '&?', onBusyChange: '&?'},
            template: '<div class="test-publication-control">' +
                '<button type="button" class="test-publication-badge" ng-class="{\'is-published\': test.status == 7, \'is-draft\': test.status != 7 && test.status != 8, \'is-hidden\': test.status == 8}" ' +
                'ng-click="toggle()" ng-disabled="disabled || saving || test.status == 8" aria-pressed="{{test.status == 7}}" title="{{test.status == 7 ? \'Chuyển thành bản nháp\' : (test.status == 8 ? \'Bài đang ẩn\' : \'Xuất bản bài test\')}}">' +
                '<i class="fa" ng-class="saving ? \'fa-spinner fa-spin\' : (test.status == 7 ? \'fa-check-circle\' : (test.status == 8 ? \'fa-eye-slash\' : \'fa-pencil\'))" aria-hidden="true"></i> ' +
                '{{saving ? "Đang lưu..." : (test.status == 7 ? "Đã xuất bản" : (test.status == 8 ? "Đã ẩn" : "Bản nháp"))}}</button>' +
                '<p class="test-folder-error" ng-if="error" role="alert" ng-bind="error"></p></div>',
            link: function (scope) {
                scope.toggle = function () {
                    if (scope.disabled || scope.saving || !scope.test || !scope.test.id || Number(scope.test.status) === 8) { return; }
                    var status = Number(scope.test.status) === 7 ? 6 : 7;
                    scope.saving = true; scope.error = '';
                    if (scope.onBusyChange) { scope.onBusyChange({test: scope.test, busy: true}); }
                    return service.updateTestStatus(scope.test.id, status).then(function (saved) {
                        if (!saved || String(saved.id) !== String(scope.test.id) || Number(saved.status) !== status) {
                            throw new Error('Máy chủ chưa xác nhận thay đổi trạng thái. Bạn có thể thử lại.');
                        }
                        var previousStatus = scope.test.status;
                        scope.test.status = status;
                        if (scope.onChanged) { scope.onChanged({test: scope.test, previousStatus: previousStatus}); }
                    }).catch(function (response) {
                        scope.error = ((response || {}).data || {}).message || (response || {}).message || 'Không đổi được trạng thái. Bài vẫn giữ trạng thái cũ, bạn có thể thử lại.';
                    }).finally(function () {
                        scope.saving = false;
                        if (scope.onBusyChange) { scope.onBusyChange({test: scope.test, busy: false}); }
                    });
                };
            }
        };
    }]);

    angular.module('Hrm.Question').directive('testTitleEditor', ['QuestionService', '$timeout', function (service, $timeout) {
        return {
            restrict: 'E', scope: {test: '=', disabled: '=?', saving: '=?', onRenamed: '&?'},
            template: '<div class="test-title-editor" ng-class="{\'is-editing\': editing}">' +
                '<button type="button" class="test-title-display" ng-if="!editing" ng-dblclick="begin()" ng-keydown="beginKey($event)" ng-disabled="disabled" title="{{test.title || test.question}} — Nhấp đúp hoặc nhấn F2 để đổi tên"><span class="test-explorer-name">{{test.title || test.question}}</span></button>' +
                '<div ng-if="editing"><textarea class="form-control" ng-model="draft.title" maxlength="{{maxTitleLength}}" ng-keydown="editKey($event)" ng-disabled="saving" aria-label="Tên bài test"></textarea>' +
                '<div class="test-title-editor-actions"><button type="button" class="btn btn-primary btn-sm" ng-click="save()" ng-disabled="saving">{{saving ? "Đang lưu..." : "Lưu tên"}}</button>' +
                '<button type="button" class="btn btn-default btn-sm" ng-click="cancel()" ng-disabled="saving">Hủy</button></div>' +
                '<small class="test-title-editor-hint">Enter để lưu · Esc để hủy</small><p class="test-folder-error" role="alert" ng-if="error">{{error}}</p></div></div>',
            link: function (scope, element) {
                var focusTimer;
                scope.begin = function () {
                    if (scope.disabled || scope.saving || scope.editing) { return; }
                    scope.maxTitleLength = scope.test.testFormat === 'DAILY_LISTENING' ? 200 : 255;
                    scope.draft = {title: scope.test.title || scope.test.question || ''}; scope.error = ''; scope.editing = true;
                    focusTimer = $timeout(function () { var input = element[0].querySelector('textarea'); if (input) { input.focus(); input.select(); } });
                };
                scope.beginKey = function (event) { if (event.key === 'F2' || event.key === 'Enter') { event.preventDefault(); scope.begin(); } };
                scope.cancel = function () { if (!scope.saving) { scope.editing = false; scope.error = ''; } };
                scope.editKey = function (event) {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); scope.cancel(); }
                    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); scope.save(); }
                };
                scope.save = function () {
                    if (scope.saving || scope.disabled) { return; }
                    var title = String(scope.draft.title || '').trim(), previousTitle = scope.test.title || scope.test.question;
                    if (!title) { scope.error = 'Tên bài test không được để trống.'; return; }
                    if (title.length > scope.maxTitleLength) { scope.error = 'Tên bài test không được quá ' + scope.maxTitleLength + ' ký tự.'; return; }
                    if (title === previousTitle) { scope.cancel(); return; }
                    scope.saving = true; scope.error = '';
                    return service.updateTestTitle(scope.test.id, title).then(function (saved) {
                        scope.test.title = saved.title;
                        if (scope.test.testFormat === 'DAILY_LISTENING') { scope.test.question = saved.title; }
                        scope.editing = false;
                        if (scope.onRenamed) { scope.onRenamed({test: scope.test, previousTitle: previousTitle}); }
                    }, function (response) { scope.error = (response.data || {}).message || 'Không lưu được tên bài. Bạn có thể thử lại.'; })
                        .finally(function () { scope.saving = false; });
                };
                function preventDrag(event) { event.preventDefault(); event.stopPropagation(); }
                element.on('dragstart', preventDrag);
                scope.$on('$destroy', function () { $timeout.cancel(focusTimer); element.off('dragstart', preventDrag); });
            }
        };
    }]);

    // Delay pointer clicks just long enough for a double click to rename instead of opening the folder.
    angular.module('Hrm.Question').directive('testFolderOpen', ['$timeout', function ($timeout) {
        return {restrict: 'A', link: function (scope, element, attrs) {
            var clickTimer;
            function open(event) {
                $timeout.cancel(clickTimer);
                if (event.detail > 1) { return; }
                var name = element[0].querySelector('.test-explorer-name');
                if (event.detail === 0 || !name || !name.contains(event.target)) { scope.$apply(function () { scope.$eval(attrs.testFolderOpen); }); }
                else { clickTimer = $timeout(function () { scope.$eval(attrs.testFolderOpen); }, 500); }
            }
            function cancel() { $timeout.cancel(clickTimer); }
            element.on('click', open); element.on('dblclick', cancel);
            scope.$on('$destroy', function () { cancel(); element.off('click', open); element.off('dblclick', cancel); });
        }};
    }]);

    angular.module('Hrm.Question').directive('testFolderExplorer', ['ComprehensiveFolders', '$window', '$timeout', '$uibModal', '$q', function (folders, $window, $timeout, modal, $q) {
        return {
            restrict: 'E', transclude: true,
            scope: {folderId: '=', files: '=?', allTeachers: '=?', manage: '=?', testMode: '=?', onChange: '&', onMoved: '&?', moving: '=?', moveDisabled: '=?'},
            controller: ['$scope', function (scope) {
                var explorer = this;
                var selected = {};
                explorer.isSelected = function (test) { return !!selected[test.id]; };
                explorer.toggleSelected = function (test) { if (explorer.canDrag(test) && !scope.moving) { if (selected[test.id]) { delete selected[test.id]; } else { selected[test.id] = test; } } };
                scope.selectedCount = function () { return Object.keys(selected).length; };
                scope.clearSelection = function () { if (!scope.moving) { selected = {}; } };
                scope.selectAllFiles = function () { (scope.files || []).forEach(function (test) { if (explorer.canDrag(test)) { selected[test.id] = test; } }); };
                scope.$watchCollection('files', function (files) {
                    var visible = {};
                    (files || []).forEach(function (test) { visible[test.id] = test; });
                    Object.keys(selected).forEach(function (id) { if (visible[id]) { selected[id] = visible[id]; } else { delete selected[id]; } });
                });
                explorer.canDrag = function (test) { return scope.manage === true && !scope.moveDisabled && !explorer.busy && !!(test && test.id); };
                explorer.canDragFolder = function (folder) { return explorer.canDrag(folder) && !scope.saving && !scope.editor && !scope.renamingFolder && !!folder.canManage; };
                explorer.canPlaceFolder = function (source, id) {
                    var destination = (scope.folders || []).filter(function (folder) { return String(folder.id) === String(id); })[0];
                    if (!source || !source.canManage || (id != null && (!destination || !destination.canManage || destination.ownerId !== source.ownerId))) { return false; }
                    var node = destination, seen = {};
                    while (node && !seen[node.id]) {
                        if (String(node.id) === String(source.id)) { return false; }
                        seen[node.id] = true;
                        node = (scope.folders || []).filter(function (folder) { return String(folder.id) === String(node.parentId); })[0];
                    }
                    return !node;
                };
                explorer.canDrop = function (id) {
                    if (explorer.draggedFolder) { return explorer.canDragFolder(explorer.draggedFolder) && explorer.canPlaceFolder(explorer.draggedFolder, id); }
                    if (!explorer.canDrag(explorer.draggedTest)) { return false; }
                    return id == null || (scope.folders || []).some(function (folder) { return String(folder.id) === String(id) && folder.canManage; });
                };
                // Keep feedback visible during dragging so drop targets do not shift under the pointer.
                explorer.startDrag = function (test) { explorer.draggedTest = test; scope.draggingTest = test; };
                explorer.startFolderDrag = function (folder) { explorer.draggedFolder = folder; scope.draggingTest = folder; };
                explorer.endDrag = function () { explorer.draggedTest = explorer.draggedFolder = null; scope.draggingTest = null; };
                explorer.dropFolder = function (folder, id) {
                    if (!explorer.canDrop(id) || String(folder.parentId) === String(id)) { return; }
                    explorer.busy = true; scope.moving = true; scope.moveError = scope.moveMessage = '';
                    scope.$evalAsync(function () {
                        folders.moveFolder(folder, id).then(function () {
                            scope.moveMessage = 'Đã chuyển folder “' + folder.name + '” cùng toàn bộ folder con và bài bên trong.';
                        }, function (response) { scope.moveError = (response.data || {}).message || response.message || 'Không chuyển được folder. Folder vẫn ở vị trí cũ, bạn có thể kéo lại.'; })
                            .finally(function () { explorer.busy = false; scope.moving = false; });
                    });
                };
                scope.moveFolder = function (folder, event) {
                    if (event) { event.preventDefault(); event.stopPropagation(); }
                    if (scope.moving || scope.loading || !explorer.canDragFolder(folder)) { return; }
                    explorer.busy = true; scope.folderMoveDialogOpen = true; scope.moveError = scope.moveMessage = '';
                    var instance = modal.open({
                        templateUrl: 'question/views/comprehensive_move_test_folder_modal.html?v=' + encodeURIComponent($window.APP_VERSION || 'dev'),
                        controllerAs: 'move',
                        controller: ['$scope', '$uibModalInstance', function (dialogScope, dialogInstance) {
                            var dialog = this;
                            dialog.isFolder = true; dialog.testTitle = folder.name;
                            dialog.currentFolderId = folder.parentId == null ? null : folder.parentId;
                            dialog.selectedFolderId = dialog.currentFolderId; dialog.choices = []; dialog.collapsed = {};
                            dialog.load = function () {
                                dialog.loading = true; dialog.error = '';
                                return folders.load(false, false, scope.testMode).then(function (items) {
                                    dialog.choices = folders.options(items.filter(function (item) { return item.canManage && item.ownerId === folder.ownerId; }), false);
                                }, function () { dialog.error = 'Không tải được folder. Bạn có thể thử lại.'; }).finally(function () { dialog.loading = false; });
                            };
                            dialog.label = function (id) { var item = dialog.choices.filter(function (item) { return String(item.id) === String(id); })[0]; return id == null ? 'Folder của tôi (cấp gốc)' : (item || {}).label; };
                            dialog.hasChildren = function (item) { return dialog.choices.some(function (child) { return child.parentId === item.id; }); };
                            dialog.visible = function (item) {
                                var id = item.parentId, seen = {};
                                while (id != null && !seen[id]) { if (dialog.collapsed[id]) { return false; } seen[id] = true; var parent = dialog.choices.filter(function (item) { return item.id === id; })[0]; id = parent ? parent.parentId : null; }
                                return true;
                            };
                            dialog.canSelect = function (id) { return explorer.canPlaceFolder(folder, id); };
                            dialog.select = function (id) { if (!dialog.saving && dialog.canSelect(id)) { dialog.selectedFolderId = id; } };
                            dialog.canMove = function () { return !dialog.loading && !dialog.saving && !scope.moveDisabled && String(dialog.selectedFolderId) !== String(dialog.currentFolderId) && dialog.canSelect(dialog.selectedFolderId); };
                            dialog.save = function () {
                                if (!dialog.canMove()) { return; }
                                dialog.saving = true; scope.moving = true; dialog.error = '';
                                return folders.moveFolder(folder, dialog.selectedFolderId).then(function () {
                                    scope.moveMessage = 'Đã chuyển folder “' + folder.name + '” cùng toàn bộ folder con và bài bên trong.';
                                    dialog.saving = false; scope.moving = false; dialogInstance.close();
                                }, function (response) { dialog.error = (response.data || {}).message || response.message || 'Không chuyển được folder. Vị trí cũ được giữ nguyên, bạn có thể thử lại.'; })
                                    .finally(function () { dialog.saving = false; scope.moving = false; });
                            };
                            dialog.cancel = function () { if (!dialog.saving) { dialogInstance.dismiss('cancel'); } };
                            dialogScope.$on('modal.closing', function (event) { if (dialog.saving) { event.preventDefault(); } });
                            dialog.load();
                        }]
                    });
                    instance.result.finally(function () { explorer.busy = false; scope.folderMoveDialogOpen = false; }).catch(angular.noop);
                };
                scope.moveSelected = function () {
                    if (!scope.selectedCount() || scope.moveDisabled || scope.moving || explorer.busy) { return; }
                    scope.moveError = scope.moveMessage = '';
                    var tests = Object.keys(selected).map(function (id) { return selected[id]; });
                    explorer.busy = true;
                    var instance = modal.open({
                        templateUrl: 'question/views/comprehensive_move_test_folder_modal.html?v=' + encodeURIComponent($window.APP_VERSION || 'dev'),
                        controllerAs: 'move',
                        controller: ['$scope', '$uibModalInstance', function (dialogScope, dialogInstance) {
                            var dialog = this;
                            dialog.multiple = true; dialog.testTitle = 'Đã chọn ' + tests.length + ' bài test';
                            dialog.selectedFolderId = scope.folderId || null; dialog.choices = []; dialog.collapsed = {}; dialog.failures = [];
                            dialog.load = function () {
                                dialog.loading = true; dialog.error = '';
                                return folders.load(false, false, scope.testMode).then(function (items) {
                                    dialog.choices = folders.options(items.filter(function (folder) { return folder.canManage; }), false);
                                }, function () { dialog.error = 'Không tải được folder. Bạn có thể thử lại.'; }).finally(function () { dialog.loading = false; });
                            };
                            dialog.label = function (id) { var folder = dialog.choices.filter(function (item) { return String(item.id) === String(id); })[0]; return id == null ? 'Folder của tôi (cấp gốc)' : (folder || {}).label; };
                            dialog.hasChildren = function (folder) { return dialog.choices.some(function (item) { return item.parentId === folder.id; }); };
                            dialog.visible = function (folder) {
                                var id = folder.parentId, seen = {};
                                while (id != null && !seen[id]) { if (dialog.collapsed[id]) { return false; } seen[id] = true; var parent = dialog.choices.filter(function (item) { return item.id === id; })[0]; id = parent ? parent.parentId : null; }
                                return true;
                            };
                            dialog.select = function (id) { if (!dialog.saving) { dialog.selectedFolderId = id; } };
                            dialog.canMove = function () { return !dialog.loading && !dialog.saving && !scope.moveDisabled && tests.length > 0 && (dialog.selectedFolderId == null || dialog.choices.some(function (folder) { return folder.id === dialog.selectedFolderId; })); };
                            dialog.save = function () {
                                if (!dialog.canMove()) { return; }
                                dialog.saving = true; scope.moving = true; dialog.error = ''; dialog.failures = []; dialog.completed = 0;
                                var destination = dialog.selectedFolderId, succeeded = [], failed = [], queue = $q.when();
                                tests.forEach(function (test) {
                                    queue = queue.then(function () {
                                        var current = test.testFolder ? test.testFolder.id : null;
                                        return (String(current) === String(destination) ? $q.when(test) : folders.moveTest(test.id, destination)).then(function (saved) {
                                            if (!saved || String(saved.id) !== String(test.id) || String(saved.testFolder ? saved.testFolder.id : null) !== String(destination)) { throw new Error('Máy chủ chưa xác nhận vị trí mới.'); }
                                            succeeded.push(saved); delete selected[test.id]; dialog.completed++;
                                        }).catch(function (response) {
                                            failed.push(test); dialog.failures.push({id: test.id, title: test.title || test.question, message: ((response || {}).data || {}).message || (response || {}).message || 'Không chuyển được bài.'});
                                        });
                                    });
                                });
                                return queue.finally(function () {
                                    succeeded.forEach(function (saved, index) { if (scope.onMoved) { scope.onMoved({test: saved, deferFill: index < succeeded.length - 1}); } });
                                    tests = failed; dialog.saving = false; scope.moving = false;
                                    scope.moveMessage = 'Đã chuyển ' + succeeded.length + ' bài đến ' + dialog.label(destination) + '.';
                                    if (failed.length) { dialog.testTitle = 'Còn ' + failed.length + ' bài đã chọn'; dialog.error = 'Còn ' + failed.length + ' bài chưa chuyển. Các bài này vẫn được chọn để thử lại.'; }
                                    else { dialogInstance.close(); }
                                });
                            };
                            dialog.cancel = function () { if (!dialog.saving) { dialogInstance.dismiss('cancel'); } };
                            dialogScope.$on('modal.closing', function (event) { if (dialog.saving) { event.preventDefault(); } });
                            dialog.load();
                        }]
                    });
                    instance.result.finally(function () { explorer.busy = false; }).catch(angular.noop);
                };
                explorer.dropTest = function (test, id) {
                    if (!explorer.canDrop(id)) { return; }
                    var oldId = test.testFolder ? test.testFolder.id : null;
                    if (String(oldId) === String(id)) { return; }
                    explorer.busy = true; scope.moving = true; scope.moveError = scope.moveMessage = '';
                    scope.$evalAsync(function () {
                        folders.moveTest(test.id, id).then(function (saved) {
                            scope.moveMessage = 'Đã chuyển “' + test.title + '” ' + (saved.testFolder ? 'vào folder ' + saved.testFolder.name : 'về cấp gốc') + '.';
                            if (scope.onMoved) { scope.onMoved({test: saved}); }
                        }, function (response) {
                            scope.moveError = (response.data || {}).message || 'Không chuyển được bài. Bài vẫn ở vị trí cũ, bạn có thể kéo lại.';
                        }).finally(function () { explorer.busy = false; scope.moving = false; });
                    });
                };
            }],
            templateUrl: function () { return 'question/views/test_folder_explorer.html?v=' + encodeURIComponent($window.APP_VERSION || 'dev'); },
            link: function (scope, element) {
                var editorFocusTimer;
                function focusEditor() {
                    $timeout.cancel(editorFocusTimer);
                    editorFocusTimer = $timeout(function () {
                        var input = element[0].querySelector('.test-folder-editor input');
                        if (scope.editor && input) { input.focus(); input.select(); }
                    });
                }
                scope.cancelEditor = function () { if (!scope.saving) { $timeout.cancel(editorFocusTimer); scope.editor = null; scope.error = ''; } };
                var storageKey = scope.testMode && scope.testMode !== 'COMPREHENSIVE' ? 'testFolderView:' + scope.testMode : 'comprehensiveTestFolderView';
                scope.viewMode = 'grid';
                try { scope.viewMode = $window.localStorage.getItem(storageKey) === 'list' ? 'list' : 'grid'; } catch (ignoreStorage) {}
                scope.toggleView = function () {
                    scope.viewMode = scope.viewMode === 'grid' ? 'list' : 'grid';
                    try { $window.localStorage.setItem(storageKey, scope.viewMode); } catch (ignoreStorage) {}
                };
                function rebuild() {
                    var byId = {}, seen = {}, current = null;
                    (scope.folders || []).forEach(function (folder) { byId[folder.id] = folder; });
                    scope.current = byId[scope.folderId] || null;
                    scope.breadcrumbs = [];
                    current = scope.current;
                    while (current && !seen[current.id]) {
                        seen[current.id] = true; scope.breadcrumbs.unshift(current); current = byId[current.parentId];
                    }
                    scope.children = (scope.folders || []).filter(function (folder) {
                        var parent = byId[folder.parentId];
                        return scope.folderId == null ? !parent : String(folder.parentId) === String(scope.folderId);
                    }).sort(function (a, b) {
                        return (scope.allTeachers && scope.folderId == null ? String(a.ownerName || '').localeCompare(String(b.ownerName || '')) : 0)
                            || String(a.name || '').localeCompare(String(b.name || ''));
                    });
                }
                scope.openFolder = function (id) { scope.folderId = id == null ? null : id; scope.editor = null; if (!scope.renamingFolderSaving) { scope.renamingFolder = null; } scope.error = ''; scope.onChange({folderId: scope.folderId}); };
                scope.goUp = function () { scope.openFolder(scope.current ? scope.current.parentId : null); };
                scope.reload = function (refresh) {
                    scope.loading = true; scope.error = '';
                    return folders.load(scope.allTeachers === true, refresh, scope.testMode).then(function (items) { scope.folders = items; rebuild(); },
                        function () { scope.error = 'Không tải được folder.'; }).finally(function () { scope.loading = false; });
                };
                scope.create = function () { scope.editor = {name: '', parentId: scope.folderId || null, testMode: scope.testMode || 'COMPREHENSIVE'}; scope.error = ''; focusEditor(); };
                scope.startRenameFolder = function (folder, event) {
                    if (event) { event.preventDefault(); event.stopPropagation(); }
                    if (!scope.manage || !folder.canManage || scope.renamingFolderSaving || scope.moving) { return; }
                    scope.renamingFolder = {id: folder.id, name: folder.name, parentId: folder.parentId, testMode: scope.testMode || 'COMPREHENSIVE'};
                    scope.renameFolderError = '';
                    $timeout(function () { var input = element[0].querySelector('.test-explorer-folder-rename input'); if (input) { input.focus(); input.select(); } });
                };
                scope.cancelRenameFolder = function () { if (!scope.renamingFolderSaving) { scope.renamingFolder = null; scope.renameFolderError = ''; } };
                scope.renameFolderKey = function (event) {
                    if (event.key === 'Escape' && !scope.renamingFolderSaving) { event.preventDefault(); scope.renamingFolder = null; }
                    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); scope.saveRenamedFolder(); }
                };
                scope.saveRenamedFolder = function () {
                    if (!scope.renamingFolder || scope.renamingFolderSaving) { return; }
                    var editor = scope.renamingFolder, name = String(editor.name || '').trim();
                    if (!name) { scope.renameFolderError = 'Tên folder không được để trống.'; return; }
                    scope.renamingFolderSaving = true; scope.renameFolderError = '';
                    return folders.save(angular.extend({}, editor, {name: name})).then(function () {
                        if (scope.renamingFolder === editor) { scope.renamingFolder = null; }
                    }, function (response) { scope.renameFolderError = (response.data || {}).message || 'Không lưu được tên folder. Bạn có thể thử lại.'; })
                        .finally(function () { scope.renamingFolderSaving = false; });
                };
                scope.rename = function () { scope.editor = {id: scope.current.id, name: scope.current.name, parentId: scope.current.parentId, testMode: scope.testMode || 'COMPREHENSIVE'}; scope.error = ''; focusEditor(); };
                scope.save = function () {
                    if (scope.saving || !scope.editor) { return; } scope.saving = true; scope.error = '';
                    folders.save(scope.editor).then(function () { scope.editor = null; return scope.reload(true); },
                        function (response) { scope.error = (response.data || {}).message || 'Không lưu được folder.'; }).finally(function () { scope.saving = false; });
                };
                scope.$watch('folderId', rebuild);
                scope.$on('comprehensiveFoldersChanged', function () { scope.reload(true); });
                scope.$on('comprehensiveFolderMoved', function () { rebuild(); });
                scope.$on('$destroy', function () { $timeout.cancel(editorFocusTimer); });
                scope.reload();
            }
        };
    }]);

    angular.module('Hrm.Question').directive('testFolderSelect', function () {
        return {restrict: 'E', require: '^testFolderExplorer', scope: {test: '=', disabled: '=?'},
            template: '<label class="test-file-select" title="Chọn bài để di chuyển"><input type="checkbox" ng-checked="selected()" ng-click="toggle($event)" ng-disabled="disabled || !canSelect()" aria-label="Chọn bài {{test.title || test.question}}"><span class="sr-only">Chọn bài</span></label>',
            link: function (scope, element, attrs, explorer) {
                scope.selected = function () { return explorer.isSelected(scope.test); };
                scope.canSelect = function () { return explorer.canDrag(scope.test); };
                scope.toggle = function (event) { event.stopPropagation(); if (!scope.disabled) { explorer.toggleSelected(scope.test); } };
                scope.$watch(scope.selected, function (value) { var card = element[0].closest('.test-explorer-file'); if (card) { card.classList.toggle('is-checked', value); } });
            }};
    });
    angular.module('Hrm.Question').directive('testFolderContainerDrag', function () {
        return {restrict: 'A', require: '^testFolderExplorer', link: function (scope, element, attrs, explorer) {
            scope.$watch(function () { return explorer.canDragFolder(scope.$eval(attrs.testFolderContainerDrag)); }, function (enabled) { element.attr('draggable', enabled ? 'true' : 'false'); });
            function start(event) {
                var nativeEvent = event.originalEvent || event, folder = scope.$eval(attrs.testFolderContainerDrag);
                if (!explorer.canDragFolder(folder) || !nativeEvent.dataTransfer) { event.preventDefault(); return; }
                event.stopPropagation(); nativeEvent.dataTransfer.effectAllowed = 'move';
                nativeEvent.dataTransfer.setData('application/x-test-folder', String(folder.id));
                nativeEvent.dataTransfer.setData('text/plain', folder.name);
                explorer.startFolderDrag(folder); element.addClass('is-dragging'); scope.$evalAsync(angular.noop);
            }
            function end() { explorer.endDrag(); element.removeClass('is-dragging'); scope.$evalAsync(angular.noop); }
            element.on('dragstart', start); element.on('dragend', end);
            scope.$on('$destroy', function () { element.off('dragstart', start); element.off('dragend', end); });
        }};
    });
    angular.module('Hrm.Question').directive('testFolderDrag', function () {
        return {
            restrict: 'A', require: '^testFolderExplorer',
            link: function (scope, element, attrs, explorer) {
                scope.$watch(function () { return explorer.canDrag(scope.$eval(attrs.testFolderDrag)); }, function (enabled) {
                    element.attr('draggable', enabled ? 'true' : 'false'); element.toggleClass('is-draggable', enabled);
                });
                function start(event) {
                    var nativeEvent = event.originalEvent || event, test = scope.$eval(attrs.testFolderDrag);
                    if (!explorer.canDrag(test) || !nativeEvent.dataTransfer || element[0].querySelector('.test-title-editor.is-editing')) { event.preventDefault(); return; }
                    nativeEvent.dataTransfer.effectAllowed = 'move';
                    nativeEvent.dataTransfer.setData('application/x-comprehensive-test', String(test.id));
                    nativeEvent.dataTransfer.setData('text/plain', test.title || String(test.id));
                    explorer.startDrag(test); element.addClass('is-dragging'); scope.$evalAsync(angular.noop);
                }
                function end() { explorer.endDrag(); element.removeClass('is-dragging'); scope.$evalAsync(angular.noop); }
                element.on('dragstart', start); element.on('dragend', end);
                scope.$on('$destroy', function () { element.off('dragstart', start); element.off('dragend', end); });
            }
        };
    });
    angular.module('Hrm.Question').directive('testFolderDrop', function () {
        return {
            restrict: 'A', require: '^testFolderExplorer',
            link: function (scope, element, attrs, explorer) {
                function over(event) {
                    if (!explorer.canDrop(scope.$eval(attrs.testFolderDrop))) { return; }
                    event.preventDefault();
                    var nativeEvent = event.originalEvent || event;
                    if (nativeEvent.dataTransfer) { nativeEvent.dataTransfer.dropEffect = 'move'; }
                    element.addClass('is-drop-target');
                }
                function leave(event) {
                    var related = (event.originalEvent || event).relatedTarget;
                    if (!related || !element[0].contains(related)) { element.removeClass('is-drop-target'); }
                }
                function drop(event) {
                    var id = scope.$eval(attrs.testFolderDrop), test = explorer.draggedTest;
                    if (!explorer.canDrop(id)) { return; }
                    event.preventDefault(); event.stopPropagation();
                    if (explorer.draggedFolder) { explorer.dropFolder(explorer.draggedFolder, id == null ? null : id); }
                    else { explorer.dropTest(test, id == null ? null : id); }
                    explorer.endDrag(); element.removeClass('is-drop-target'); scope.$evalAsync(angular.noop);
                }
                scope.$watch(function () { return explorer.draggedTest || explorer.draggedFolder; }, function (test) { if (!test) { element.removeClass('is-drop-target'); } });
                element.on('dragover', over); element.on('dragleave', leave); element.on('drop', drop);
                scope.$on('$destroy', function () { element.off('dragover', over); element.off('dragleave', leave); element.off('drop', drop); });
            }
        };
    });
})();
