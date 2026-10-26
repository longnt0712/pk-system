(function () {
    'use strict';
    angular.module('Hrm.Common').directive('classTreePicker', ['$uibModal', function (modal) {
        var dialog = '<div class="class-tree-dialog" role="dialog" aria-modal="true" aria-labelledby="class-tree-title-{{$id}}">' +
            '<div class="modal-header"><button type="button" class="close" ng-click="$dismiss()" aria-label="Đóng">×</button>' +
            '<h4 class="modal-title" id="class-tree-title-{{$id}}"><i class="fa fa-sitemap" aria-hidden="true"></i> Chọn lớp / đội</h4>' +
            '<p>Chọn lớp hoặc mở rộng lớp để tìm đội trực thuộc.</p></div>' +
            '<div class="modal-body"><input type="search" class="form-control class-tree-search" ng-model="picker.query" ng-change="picker.rebuild()" placeholder="Tìm theo tên hoặc mã lớp, đội..." aria-label="Tìm lớp hoặc đội" autofocus />' +
            '<p class="class-tree-message" ng-if="picker.loading" role="status">Đang tải danh sách lớp...</p>' +
            '<div class="alert alert-danger" ng-if="picker.loadError && !picker.loading" role="alert">Không tải được danh sách lớp. <button type="button" class="btn btn-default btn-sm" ng-if="picker.onRetry" ng-click="picker.onRetry()">Tải lại</button></div>' +
            '<div class="class-tree-list" ng-if="!picker.loading && !picker.loadError">' +
            '<div class="class-tree-row" ng-repeat="row in picker.rows track by row.id" ng-class="{\'is-selected\': row.id === picker.selectedId}" ng-style="{\'padding-left\': (row.level * 22) + \'px\'}">' +
            '<span class="class-tree-branch" ng-if="row.level > 0" aria-hidden="true"></span>' +
            '<button type="button" class="class-tree-toggle" ng-if="row.hasChildren" ng-click="picker.toggle(row)" ng-disabled="!!picker.query" ng-attr-aria-expanded="{{row.expanded}}" aria-label="{{row.expanded ? \'Thu gọn\' : \'Mở rộng\'}} {{row.name}}"><i class="fa" ng-class="row.expanded ? \'fa-chevron-down\' : \'fa-chevron-right\'" aria-hidden="true"></i></button>' +
            '<span class="class-tree-spacer" ng-if="!row.hasChildren"></span>' +
            '<button type="button" class="class-tree-option" ng-click="picker.select(row.id)" ng-disabled="picker.disabled" ng-attr-aria-pressed="{{row.id === picker.selectedId}}">' +
            '<i class="fa" ng-class="row.level === 0 ? \'fa-folder-open\' : \'fa-users\'" aria-hidden="true"></i><span class="class-tree-name"><strong>{{row.name}}</strong><small ng-if="row.code">{{row.code}}</small></span>' +
            '<span class="class-tree-kind">{{row.level === 0 ? \'Lớp\' : \'Đội\'}}<span ng-if="row.childCount"> · {{row.childCount}}</span></span><i class="fa fa-check" ng-if="row.id === picker.selectedId" aria-hidden="true"></i></button></div>' +
            '<p class="class-tree-message" ng-if="!picker.rows.length">Không có lớp hoặc đội phù hợp.</p></div></div>' +
            '<div class="modal-footer"><button type="button" class="btn btn-default" ng-if="picker.selectedId !== null && picker.allowClear !== false" ng-disabled="picker.disabled" ng-click="picker.clear()">Bỏ lọc lớp</button><button type="button" class="btn btn-primary" ng-click="$dismiss()">Đóng</button></div></div>';
        return {
            restrict: 'E', require: 'ngModel', scope: {
                classes: '=', schoolId: '=?', disabled: '=?', loading: '=?', loadError: '=?', allowClear: '=?',
                filterClass: '&?', onChange: '&?', onRetry: '&?', placeholder: '@?', label: '@?'
            }, bindToController: true, controllerAs: 'picker', controller: function () {},
            template: '<div class="class-tree-control"><button type="button" class="form-control class-tree-trigger" ng-click="picker.open()" ng-disabled="picker.disabled" aria-haspopup="dialog" aria-label="{{picker.label || picker.placeholder || \'Chọn lớp để lọc\'}}" ng-attr-title="{{picker.selectedLabel || picker.placeholder || \'Chọn lớp để lọc\'}}">' +
                '<i class="fa fa-sitemap" aria-hidden="true"></i><span ng-class="{\'class-tree-placeholder\': !picker.selectedLabel}">{{picker.selectedLabel || picker.placeholder || \'Chọn lớp để lọc\'}}</span><i class="fa fa-angle-down" aria-hidden="true"></i></button>' +
                '<button type="button" class="class-tree-clear" ng-if="picker.selectedId !== null && picker.allowClear !== false" ng-disabled="picker.disabled" ng-click="picker.clear()" aria-label="Bỏ lọc lớp" title="Bỏ lọc lớp"><i class="fa fa-times" aria-hidden="true"></i></button></div>',
            link: function (scope, element, attrs, model) {
                var vm = scope.picker, instance = null, destroyed = false;
                vm.rows = []; vm.query = ''; vm.expanded = {}; vm.selectedId = null;
                function id(value) { return value === null || value === undefined || value === '' || !isFinite(Number(value)) ? null : Number(value); }
                function text(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim(); }
                function eligible() {
                    return (vm.classes || []).filter(function (item) {
                        return item && id(item.id) !== null && (vm.schoolId == null || Number(item.schoolId) === Number(vm.schoolId)) &&
                            (!vm.filterClass || vm.filterClass({item: item}) === true);
                    });
                }
                function selectedLabel() {
                    var byId = {}, parts = [], visited = {};
                    angular.forEach(eligible(), function (item) { byId[id(item.id)] = item; });
                    var current = byId[vm.selectedId];
                    while (current && !visited[current.id]) {
                        visited[current.id] = true; parts.unshift(current.name || current.code || String(current.id)); current = byId[id(current.parentId)];
                    }
                    vm.selectedLabel = parts.join(' / ');
                }
                model.$render = function () { vm.selectedId = id(model.$viewValue); selectedLabel(); };
                vm.rebuild = function () {
                    var nodes = [], byId = {}, children = {}, roots = [], included = {}, query = text(vm.query);
                    angular.forEach(eligible(), function (item) {
                        var value = id(item.id); if (byId[value]) { return; }
                        var node = {id: value, parentId: id(item.parentId), name: item.name || '', code: item.code || ''};
                        nodes.push(node); byId[value] = node; children[value] = [];
                    });
                    angular.forEach(nodes, function (node) {
                        if (node.parentId !== node.id && byId[node.parentId]) { children[node.parentId].push(node); } else { roots.push(node); }
                    });
                    function sort(items) { items.sort(function (a, b) { return a.name.localeCompare(b.name, 'vi') || a.id - b.id; }); }
                    sort(roots); angular.forEach(children, sort);
                    if (query) {
                        angular.forEach(nodes, function (node) {
                            var path = [], current = node, seen = {};
                            while (current && !seen[current.id]) { seen[current.id] = true; path.push(current.name); current = byId[current.parentId]; }
                            if (text(path.join(' ') + ' ' + node.code).indexOf(query) < 0) { return; }
                            current = node; seen = {};
                            while (current && !seen[current.id]) { seen[current.id] = true; included[current.id] = true; current = byId[current.parentId]; }
                        });
                    }
                    var rows = [], visited = {};
                    function append(node, level) {
                        if (visited[node.id] || (query && !included[node.id])) { return; }
                        visited[node.id] = true; node.level = level; node.hasChildren = children[node.id].length > 0;
                        node.childCount = children[node.id].length; node.expanded = !!query || vm.expanded[node.id] === true; rows.push(node);
                        if (node.expanded) { angular.forEach(children[node.id], function (child) { append(child, level + 1); }); }
                    }
                    angular.forEach(roots, function (node) { append(node, 0); });
                    angular.forEach(nodes, function (node) {
                        if (visited[node.id]) { return; }
                        var current = node, seen = {};
                        while (current && !seen[current.id]) { seen[current.id] = true; current = byId[current.parentId]; }
                        if (current) { append(node, 0); }
                    });
                    vm.rows = rows; selectedLabel();
                };
                vm.toggle = function (row) { if (row.hasChildren && !text(vm.query)) { vm.expanded[row.id] = !vm.expanded[row.id]; vm.rebuild(); } };
                vm.open = function () {
                    if (vm.disabled || instance || destroyed) { return; }
                    vm.query = ''; vm.expanded = {}; vm.rebuild();
                    var opened = modal.open({animation: true, template: dialog, scope: scope, size: 'lg', windowClass: 'class-tree-picker-window', backdropClass: 'class-tree-picker-backdrop'});
                    instance = opened;
                    function closed() { if (instance === opened) { instance = null; } }
                    opened.result.then(closed, closed);
                };
                function apply(value) {
                    if (vm.disabled || destroyed) { return; }
                    model.$setViewValue(value); model.$render();
                    if (instance) { instance.close(); }
                    if (vm.onChange) { vm.onChange({selectedId: value}); }
                }
                vm.select = function (value) {
                    if (vm.loading || vm.loadError || !eligible().some(function (item) { return id(item.id) === id(value); })) { return; }
                    apply(id(value));
                };
                vm.clear = function () { if (vm.allowClear !== false) { apply(null); } };
                scope.$watchCollection(eligible, vm.rebuild);
                scope.$on('$destroy', function () { destroyed = true; if (instance) { instance.dismiss('destroy'); instance = null; } });
            }
        };
    }]);
})();
