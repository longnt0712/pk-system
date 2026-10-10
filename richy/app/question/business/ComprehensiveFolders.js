(function () {
    'use strict';
    angular.module('Hrm.Question').factory('TestFolderService', ['$http', 'settings', function ($http, settings) {
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url + 'test_folder';
        return {
            getTestFolders: function (allTeachers) { return $http.get(baseUrl, {params: {allTeachers: allTeachers === true}}).then(function (response) { return response.data; }); },
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
        function load(allTeachers, refresh) {
            var key = allTeachers ? 'all' : 'mine';
            if (pending[key]) { return pending[key]; }
            if (cached[key] && !refresh) { return $q.when(cached[key]); }
            pending[key] = service.getTestFolders(allTeachers).then(function (items) {
                cached[key] = items || []; return cached[key];
            }).finally(function () { delete pending[key]; });
            return pending[key];
        }
        function applyFilter(dto, id, browsing) {
            dto.testFolderId = id != null && Number(id) > 0 ? Number(id) : null;
            var searching = !!String(dto.textSearch || '').trim();
            dto.withoutTestFolder = Number(id) === -1 || (browsing && id == null && !searching);
            dto.includeSubfolders = !browsing || searching;
            dto.questionTopics = []; dto.topicId = dto.topicOwnerUserId = dto.topicCategoryId = null; dto.withoutTopics = false;
            dto.pageIndex = 1;
        }
        function contains(id, selected) {
            if (selected == null) { return true; }
            if (Number(selected) === -1) { return id == null; }
            var all = cached.all || cached.mine || [], byId = {}, seen = {};
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
        return {options: options, load: load, save: save, applyFilter: applyFilter, contains: contains, moveTest: moveTest};
    }]);

    angular.module('Hrm.Question').directive('testFolderPicker', ['ComprehensiveFolders', function (folders) {
        return {
            restrict: 'E', scope: {folderId: '=', showAll: '=?', manage: '=?', allTeachers: '=?', onChange: '&'},
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
                '<button type="button" class="btn btn-default btn-sm" ng-click="editor=null" ng-disabled="saving">Hủy</button></div></div>',
            link: function (scope) {
                scope.reload = function (refresh) {
                    scope.loading = true; scope.error = '';
                    return folders.load(scope.allTeachers === true, refresh).then(function (items) {
                        scope.options = folders.options(items, scope.allTeachers === true);
                        scope.choices = (scope.showAll ? [{id: -1, label: 'Chưa vào folder'}] : []).concat(scope.options);
                    }, function () { scope.error = 'Không tải được folder.'; }).finally(function () { scope.loading = false; });
                };
                scope.selected = function () { return (scope.options || []).filter(function (folder) { return folder.id == scope.folderId; })[0] || {}; };
                scope.parentLabel = function (id) { var match = (scope.options || []).filter(function (folder) { return folder.id == id; })[0]; return match ? match.label : ''; };
                scope.changed = function () { scope.onChange({folderId: scope.folderId == null ? null : scope.folderId}); };
                scope.create = function (child) { scope.editor = {name: '', parentId: child ? scope.folderId : null}; scope.error = ''; };
                scope.rename = function () { var folder = scope.selected(); scope.editor = {id: folder.id, name: folder.name, parentId: folder.parentId}; scope.error = ''; };
                scope.save = function () {
                    if (scope.saving || !scope.editor) { return; } scope.saving = true; scope.error = '';
                    folders.save(scope.editor).then(function (saved) {
                        scope.folderId = saved.id; scope.editor = null; scope.changed(); return scope.reload(true);
                    }, function (response) { scope.error = (response.data || {}).message || 'Không lưu được folder.'; }).finally(function () { scope.saving = false; });
                };
                scope.$on('comprehensiveFoldersChanged', function () { scope.reload(true); });
                scope.reload();
            }
        };
    }]);

    angular.module('Hrm.Question').directive('testFolderExplorer', ['ComprehensiveFolders', '$window', function (folders, $window) {
        return {
            restrict: 'E', transclude: true,
            scope: {folderId: '=', allTeachers: '=?', manage: '=?', onChange: '&', onMoved: '&?', moving: '=?', moveDisabled: '=?'},
            controller: ['$scope', function (scope) {
                var explorer = this;
                explorer.canDrag = function (test) { return scope.manage === true && !scope.moveDisabled && !explorer.busy && !!(test && test.id); };
                explorer.canDrop = function (id) {
                    if (!explorer.canDrag(explorer.draggedTest)) { return false; }
                    return id == null || (scope.folders || []).some(function (folder) { return String(folder.id) === String(id) && folder.canManage; });
                };
                // Keep feedback visible during dragging so drop targets do not shift under the pointer.
                explorer.startDrag = function (test) { explorer.draggedTest = test; scope.draggingTest = test; };
                explorer.endDrag = function () { explorer.draggedTest = null; scope.draggingTest = null; };
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
            link: function (scope) {
                var storageKey = 'comprehensiveTestFolderView';
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
                scope.openFolder = function (id) { scope.folderId = id == null ? null : id; scope.editor = null; scope.error = ''; scope.onChange({folderId: scope.folderId}); };
                scope.goUp = function () { scope.openFolder(scope.current ? scope.current.parentId : null); };
                scope.reload = function (refresh) {
                    scope.loading = true; scope.error = '';
                    return folders.load(scope.allTeachers === true, refresh).then(function (items) { scope.folders = items; rebuild(); },
                        function () { scope.error = 'Không tải được folder.'; }).finally(function () { scope.loading = false; });
                };
                scope.create = function () { scope.editor = {name: '', parentId: scope.folderId || null}; scope.error = ''; };
                scope.rename = function () { scope.editor = {id: scope.current.id, name: scope.current.name, parentId: scope.current.parentId}; scope.error = ''; };
                scope.save = function () {
                    if (scope.saving || !scope.editor) { return; } scope.saving = true; scope.error = '';
                    folders.save(scope.editor).then(function () { scope.editor = null; return scope.reload(true); },
                        function (response) { scope.error = (response.data || {}).message || 'Không lưu được folder.'; }).finally(function () { scope.saving = false; });
                };
                scope.$watch('folderId', rebuild);
                scope.$on('comprehensiveFoldersChanged', function () { scope.reload(true); });
                scope.reload();
            }
        };
    }]);

    angular.module('Hrm.Question').directive('testFolderDrag', function () {
        return {
            restrict: 'A', require: '^testFolderExplorer',
            link: function (scope, element, attrs, explorer) {
                scope.$watch(function () { return explorer.canDrag(scope.$eval(attrs.testFolderDrag)); }, function (enabled) {
                    element.attr('draggable', enabled ? 'true' : 'false'); element.toggleClass('is-draggable', enabled);
                });
                function start(event) {
                    var nativeEvent = event.originalEvent || event, test = scope.$eval(attrs.testFolderDrag);
                    if (!explorer.canDrag(test) || !nativeEvent.dataTransfer) { event.preventDefault(); return; }
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
                    explorer.dropTest(test, id == null ? null : id);
                    explorer.endDrag(); element.removeClass('is-drop-target'); scope.$evalAsync(angular.noop);
                }
                scope.$watch(function () { return explorer.draggedTest; }, function (test) { if (!test) { element.removeClass('is-drop-target'); } });
                element.on('dragover', over); element.on('dragleave', leave); element.on('drop', drop);
                scope.$on('$destroy', function () { element.off('dragover', over); element.off('dragleave', leave); element.off('drop', drop); });
            }
        };
    });
})();
