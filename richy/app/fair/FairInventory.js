(function () {
    'use strict';
    var module = angular.module('Hrm.Fair');
    var photoLimit = 8 * 1024 * 1024;
    var priceFormat = new Intl.NumberFormat('en-US');

    module.component('fairInventory', {
        bindings: {eventId: '<', openOnLoad: '<'},
        templateUrl: 'fair/fair-inventory.html?v=' + window.APP_VERSION,
        controllerAs: 'inventory',
        controller: ['$http', '$q', '$window', '$element', '$scope', 'settings', 'FairItemImage',
            function ($http, $q, win, element, scope, settings, images) {
            var vm = this;
            var base = settings.api.baseUrl + 'api/fairs', dialog, photoViewport, disposed = false;
            var countFormat = new Intl.NumberFormat('vi-VN');
            vm.items = [];
            vm.groups = [{kind: 'CATEGORY', label: 'Thể loại'}, {kind: 'DIFFICULTY', label: 'Mức độ'}];

            vm.$onInit = function () {
                if (vm.openOnLoad) { vm.load(); }
            };
            vm.$postLink = function () {
                dialog = element[0].querySelector('dialog');
                photoViewport = dialog.querySelector('.fair-photo-viewport');
                dialog.addEventListener('close', onDialogClose);
                win.addEventListener('resize', resizePhoto);
            };
            vm.$onDestroy = function () {
                disposed = true;
                if (dialog) { dialog.removeEventListener('close', onDialogClose); }
                win.removeEventListener('resize', resizePhoto);
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
                vm.totals = {quantity: vm.count(quantity), prices: vm.price(prices), value: vm.price(value)};
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
            vm.count = function (value) { return countFormat.format(value); };
            vm.price = function (value) { return priceFormat.format(value) + ' đ'; };
            vm.photoUrl = function (item) { return itemPath(item.id) + '/photo?v=' + item.revision; };
            vm.tableItems = function () {
                return vm.itemForm && !vm.itemForm.id ? vm.items.concat(vm.itemForm) : vm.items;
            };
            vm.isEditing = function (item) {
                return !!vm.itemForm && item.id === vm.itemForm.id;
            };
            vm.amount = function (item) {
                var row = vm.isEditing(item) ? vm.itemForm : item;
                return row.unitPrice == null || row.quantity == null ? '—' : vm.price(row.unitPrice * row.quantity);
            };
            vm.startItem = function (item) {
                if (vm.busy || vm.itemForm) { return; }
                vm.error = '';
                var draft = vm.itemForm = item ? angular.copy(item) : {unitPrice: 0, quantity: 1};
                win.requestAnimationFrame(function () {
                    if (disposed || vm.itemForm !== draft) { return; }
                    var input = element[0].querySelector('.fair-item-name-input');
                    if (input) { input.focus(); }
                });
            };
            vm.cancelItem = function () {
                if (vm.filePreview) { win.URL.revokeObjectURL(vm.filePreview); }
                vm.itemForm = vm.file = vm.filePreview = null;
                vm.fileError = '';
                vm.error = '';
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
                if (!vm.itemForm || !valid || vm.fileError) { return; }
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
                if (vm.preview && vm.preview.image) { win.URL.revokeObjectURL(vm.preview.image.url); }
                vm.preview = null;
            }
            function onDialogClose() {
                if (!dialog.open) { clearPreview(); }
            }
            vm.openPhoto = function (item) {
                clearPreview();
                var preview = vm.preview = {name: item.name, loading: true, zoom: 100};
                dialog.showModal();
                return images.load(vm.photoUrl(item)).then(function (image) {
                    if (vm.preview !== preview) { win.URL.revokeObjectURL(image.url); return; }
                    preview.image = image;
                    vm.fitPhoto();
                }).catch(function () {
                    preview.error = 'Không tải được ảnh. Hãy đóng và thử lại.';
                }).finally(function () { preview.loading = false; });
            };
            vm.closePhoto = function () { dialog.close(); };
            function updateFitWidth(preview) {
                var width = Math.max(1, photoViewport.clientWidth - 24);
                var height = Math.max(1, photoViewport.clientHeight - 24);
                preview.fitWidth = Math.min(width, height * preview.image.width / preview.image.height);
            }
            function resizePhoto() {
                if (!vm.preview || !vm.preview.image || !dialog.open) { return; }
                scope.$evalAsync(function () {
                    if (vm.preview && vm.preview.image && dialog.open) { updateFitWidth(vm.preview); }
                });
            }
            vm.fitPhoto = function () {
                var preview = vm.preview;
                if (!preview || !preview.image) { return; }
                preview.zoom = 100;
                updateFitWidth(preview);
                photoViewport.scrollLeft = photoViewport.scrollTop = 0;
            };
            vm.zoomPhoto = function (delta) {
                var preview = vm.preview;
                if (!preview || !preview.image) { return; }
                var x = (photoViewport.scrollLeft + photoViewport.clientWidth / 2) / photoViewport.scrollWidth;
                var y = (photoViewport.scrollTop + photoViewport.clientHeight / 2) / photoViewport.scrollHeight;
                preview.zoom = Math.min(400, Math.max(50, preview.zoom + delta));
                win.requestAnimationFrame(function () {
                    if (vm.preview !== preview || !dialog.open) { return; }
                    photoViewport.scrollLeft = x * photoViewport.scrollWidth - photoViewport.clientWidth / 2;
                    photoViewport.scrollTop = y * photoViewport.scrollHeight - photoViewport.clientHeight / 2;
                });
            };
        }]
    });

    module.factory('FairItemImage', ['$http', '$q', '$window', function ($http, $q, win) {
        return {
            load: function (path) {
                return $http.get(path, {responseType: 'blob', timeout: 15000}).then(function (response) {
                    var blob = response.data;
                    if (!blob || !blob.size || !/^image\/(jpeg|png)(;|$)/i.test(blob.type)) {
                        return $q.reject(new Error('Invalid item image response'));
                    }
                    var url = win.URL.createObjectURL(blob), image = new win.Image();
                    image.src = url;
                    return $q.when(image.decode()).then(function () {
                        return {url: url, width: image.naturalWidth, height: image.naturalHeight};
                    }, function (error) {
                        win.URL.revokeObjectURL(url);
                        return $q.reject(error);
                    });
                });
            }
        };
    }]);

    module.directive('fairPriceInput', function () {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, model) {
                var input = element[0];
                function parsePrice(text) {
                    if (model.$isEmpty(text)) { return null; }
                    text = text.trim();
                    if (!text) { return null; }
                    if (/^[\d,]*\d[\d,]*$/.test(text)) { return Number(text.replace(/,/g, '')); }
                    // Amounts copied from the previous display can contain Vietnamese grouping dots.
                    if (/^\d{1,3}(\.\d{3})+$/.test(text)) { return Number(text.replace(/\./g, '')); }
                }
                model.$formatters.push(function (value) {
                    return model.$isEmpty(value) ? '' : priceFormat.format(value);
                });
                model.$parsers.push(parsePrice);
                model.$validators.priceRange = function (value, text) {
                    return model.$isEmpty(text) || Number.isInteger(value) && value >= 0 && value <= 1000000000;
                };

                function formatInput(event) {
                    var text = input.value, value = parsePrice(text);
                    if (!Number.isSafeInteger(value)) { return; }
                    var formatted = priceFormat.format(value);
                    if (formatted === text) { return; }
                    var digitsAfter = text.slice(input.selectionEnd).replace(/\D/g, '').length;
                    var caret = formatted.length;
                    while (digitsAfter && caret > 0) {
                        if (formatted.charAt(--caret) !== ',') { digitsAfter--; }
                    }
                    if (event.inputType === 'deleteContentBackward' && formatted.charAt(caret - 1) === ',') { caret--; }
                    input.value = formatted;
                    input.setSelectionRange(caret, caret);
                }
                // Format before Angular's input listener parses the displayed text.
                input.addEventListener('input', formatInput, true);
                scope.$on('$destroy', function () { input.removeEventListener('input', formatInput, true); });
            }
        };
    });

    module.directive('fairItemPhoto', ['FairItemImage', '$window', function (images, win) {
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
                    images.load(path).then(function (image) {
                        if (request !== sequence) { win.URL.revokeObjectURL(image.url); return; }
                        url = image.url;
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
