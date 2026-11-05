(function () {
    'use strict';
    var module = angular.module('Hrm.Fair');
    var photoLimit = 8 * 1024 * 1024;

    module.component('fairInventory', {
        bindings: {eventId: '<', openOnLoad: '<'},
        templateUrl: 'fair/fair-inventory.html?v=' + window.APP_VERSION,
        controllerAs: 'inventory',
        controller: ['$http', '$q', '$window', '$element', 'settings', function ($http, $q, win, element, settings) {
            var vm = this;
            var base = settings.api.baseUrl + 'api/fairs', dialog, disposed = false;
            var money = new Intl.NumberFormat('vi-VN');
            vm.items = [];
            vm.groups = [{kind: 'CATEGORY', label: 'Thể loại'}, {kind: 'DIFFICULTY', label: 'Mức độ'}];

            vm.$onInit = function () {
                if (vm.openOnLoad) { vm.load(); }
            };
            vm.$postLink = function () {
                dialog = element[0].querySelector('dialog');
                dialog.addEventListener('close', onDialogClose);
            };
            vm.$onDestroy = function () {
                disposed = true;
                if (dialog) { dialog.removeEventListener('close', onDialogClose); }
                clearPreview();
                vm.cancelItem();
            };
            function itemPath(id) { return base + '/' + vm.eventId + '/items' + (id ? '/' + id : ''); }
            function optionPath(id) { return base + '/item-options' + (id ? '/' + id : ''); }
            function errorMessage(error, fallback) {
                return error.data && error.data.message ||
                    (error.status === 403 ? 'Chỉ Admin và Quản lý đào tạo được quản lý mặt hàng.' : fallback);
            }
            function setOptions(options) {
                vm.optionsById = {};
                vm.groups.forEach(function (group) {
                    group.options = options.filter(function (option) { return option.kind === group.kind; });
                    group.options.forEach(function (option) { vm.optionsById[option.id] = option.name; });
                });
            }
            function updateTotals() {
                var quantity = BigInt(0), prices = BigInt(0), value = BigInt(0);
                vm.items.forEach(function (item) {
                    var count = BigInt(item.quantity), price = BigInt(item.unitPrice);
                    quantity += count;
                    prices += price;
                    value += count * price;
                });
                vm.totals = {quantity: money.format(quantity), prices: vm.price(prices), value: vm.price(value)};
            }
            function change(operation, apply, fallback) {
                if (vm.busy) { return; }
                vm.busy = true;
                vm.error = '';
                return operation().then(function (response) {
                    if (!disposed) { apply(response.data); }
                }).catch(function (error) {
                    if (!disposed) { vm.error = errorMessage(error, fallback); }
                }).finally(function () { vm.busy = false; });
            }
            vm.load = function () {
                vm.open = true;
                return change(function () {
                    return $q.all([$http.get(itemPath()), $http.get(optionPath())])
                        .then(function (responses) { return {data: responses}; });
                }, function (responses) {
                    vm.items = responses[0].data;
                    setOptions(responses[1].data);
                    updateTotals();
                    vm.loaded = true;
                }, 'Không tải được mặt hàng và danh mục. Hãy thử lại.');
            };
            vm.count = function (value) { return money.format(value); };
            vm.price = function (value) { return money.format(value) + ' đ'; };
            vm.photoUrl = function (item) { return itemPath(item.id) + '/photo?v=' + item.revision; };
            vm.startItem = function (item) {
                vm.cancelItem();
                vm.error = '';
                vm.itemForm = item ? angular.copy(item) : {unitPrice: 0, quantity: 1};
            };
            vm.cancelItem = function () {
                if (vm.filePreview) { win.URL.revokeObjectURL(vm.filePreview); }
                vm.itemForm = vm.file = vm.filePreview = null;
                vm.fileError = '';
            };
            vm.choosePhoto = function (file) {
                if (vm.busy || !vm.itemForm) { return; }
                if (!/\.(jpe?g|png)$/i.test(file.name) || !file.size || file.size > photoLimit) {
                    vm.fileError = 'Chọn ảnh JPG hoặc PNG có dung lượng tối đa 8 MB.';
                    return;
                }
                vm.fileError = '';
                if (vm.filePreview) { win.URL.revokeObjectURL(vm.filePreview); }
                vm.file = file;
                vm.filePreview = win.URL.createObjectURL(file);
                vm.itemForm.removePhoto = false;
            };
            vm.removePhoto = function () {
                if (vm.filePreview) { win.URL.revokeObjectURL(vm.filePreview); }
                vm.file = vm.filePreview = null;
                vm.fileError = '';
                vm.itemForm.removePhoto = true;
            };
            vm.saveItem = function (valid) {
                if (!valid || vm.fileError) { return; }
                var item = vm.itemForm;
                return change(function () {
                    var data = new win.FormData();
                    ['name', 'unitPrice', 'quantity', 'categoryId', 'difficultyId', 'revision', 'removePhoto'].forEach(function (key) {
                        if (item[key] != null) { data.append(key, item[key]); }
                    });
                    if (vm.file) { data.append('photo', vm.file); }
                    return $http.post(itemPath(item.id), data, {
                        transformRequest: angular.identity, headers: {'Content-Type': undefined}, timeout: 60000
                    });
                }, function (saved) {
                    if (item.id) { vm.items = vm.items.map(function (row) { return row.id === saved.id ? saved : row; }); }
                    else { vm.items.push(saved); }
                    updateTotals();
                    vm.cancelItem();
                }, 'Chưa xác nhận được việc lưu. Hãy tải lại bảng để kiểm tra.');
            };
            vm.deleteItem = function (item) {
                if (!win.confirm('Xóa mặt hàng “' + item.name + '”?')) { return; }
                return change(function () {
                    return $http.delete(itemPath(item.id), {params: {revision: item.revision}});
                }, function () {
                    vm.items = vm.items.filter(function (row) { return row.id !== item.id; });
                    if (vm.itemForm && vm.itemForm.id === item.id) { vm.cancelItem(); }
                    updateTotals();
                }, 'Không xóa được mặt hàng.');
            };
            vm.startOption = function (group, option) {
                vm.error = '';
                vm.optionForm = option ? angular.copy(option) : {kind: group.kind, name: ''};
            };
            function replaceOption(id, saved) {
                var all = vm.groups[0].options.concat(vm.groups[1].options);
                if (id) {
                    all = all.reduce(function (options, option) {
                        if (option.id !== id) { options.push(option); }
                        else if (saved) { options.push(saved); }
                        return options;
                    }, []);
                } else { all.push(saved); }
                setOptions(all);
            }
            vm.saveOption = function (valid) {
                if (!valid) { return; }
                var option = vm.optionForm, data = {kind: option.kind, name: option.name};
                return change(function () {
                    return option.id ? $http.put(optionPath(option.id), data) : $http.post(optionPath(), data);
                }, function (saved) {
                    replaceOption(option.id, saved);
                    vm.optionForm = null;
                }, 'Không lưu được danh mục.');
            };
            vm.deleteOption = function (option) {
                if (!win.confirm('Xóa danh mục “' + option.name + '”?')) { return; }
                return change(function () {
                    return $http.delete(optionPath(option.id), {params: {kind: option.kind}});
                }, function () {
                    replaceOption(option.id, null);
                    if (vm.optionForm && vm.optionForm.id === option.id) { vm.optionForm = null; }
                }, 'Không xóa được danh mục.');
            };
            function clearPreview() {
                if (vm.preview && vm.preview.url) { win.URL.revokeObjectURL(vm.preview.url); }
                vm.preview = null;
            }
            function onDialogClose() {
                if (!dialog.open) { clearPreview(); }
            }
            vm.openPhoto = function (item) {
                clearPreview();
                var preview = vm.preview = {name: item.name, loading: true};
                dialog.showModal();
                $http.get(vm.photoUrl(item), {responseType: 'blob', timeout: 15000}).then(function (response) {
                    if (vm.preview === preview) { preview.url = win.URL.createObjectURL(response.data); }
                }).catch(function () {
                    preview.error = 'Không tải được ảnh. Hãy đóng và thử lại.';
                }).finally(function () { preview.loading = false; });
            };
            vm.closePhoto = function () { dialog.close(); };
        }]
    });

    module.directive('fairItemPhoto', ['$http', '$window', function ($http, win) {
        return function (scope, element, attrs) {
            var observer, url, sequence = 0;
            function reset() {
                sequence++;
                if (observer) { observer.disconnect(); observer = null; }
                if (url) { win.URL.revokeObjectURL(url); url = null; }
                element.removeAttr('src');
            }
            scope.$watch(attrs.fairItemPhoto, function (path) {
                reset();
                if (!path) { return; }
                var request = sequence;
                function load() {
                    $http.get(path, {responseType: 'blob', timeout: 15000}).then(function (response) {
                        if (request !== sequence) { return; }
                        url = win.URL.createObjectURL(response.data);
                        element.attr('src', url);
                    }).catch(angular.noop);
                }
                if (!win.IntersectionObserver) { load(); return; }
                observer = new win.IntersectionObserver(function (entries) {
                    if (request !== sequence || !entries[0].isIntersecting) { return; }
                    observer.disconnect();
                    load();
                });
                observer.observe(element[0]);
            });
            scope.$on('$destroy', reset);
        };
    }]);

    module.directive('fairPhotoDrop', function () {
        return function (scope, element, attrs) {
            var input = angular.element(element[0].querySelector('input[type=file]'));
            function choose(files) {
                if (files && files[0]) { scope.$evalAsync(function () { scope.$eval(attrs.fairPhotoDrop, {file: files[0]}); }); }
            }
            input.on('change', function () {
                var file = this.files[0];
                choose([file]);
                this.value = '';
            });
            element.on('dragover', function (event) { event.preventDefault(); element.addClass('is-over'); });
            element.on('dragleave', function () { element.removeClass('is-over'); });
            element.on('drop', function (event) {
                event.preventDefault();
                element.removeClass('is-over');
                choose((event.originalEvent || event).dataTransfer.files);
            });
        };
    });
}());
