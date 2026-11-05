(function () {
    'use strict';
    var module = angular.module('Hrm.Fair');
    var photoLimit = 8 * 1024 * 1024;
    var priceFormat = new Intl.NumberFormat('en-US');

    module.component('fairInventory', {
        bindings: {eventId: '<', openOnLoad: '<'},
        templateUrl: 'fair/fair-inventory.html?v=' + window.APP_VERSION,
        controllerAs: 'inventory',
        controller: ['$http', '$q', '$window', '$element', '$scope', 'settings', 'FairItemImage', '$ocLazyLoad',
            function ($http, $q, win, element, scope, settings, images, lazyLoad) {
            var vm = this;
            var base = settings.api.baseUrl + 'api/fairs', dialog, statsDialog, photoViewport, disposed = false;
            var countFormat = new Intl.NumberFormat('vi-VN');
            var nameOrder = new Intl.Collator('vi', {numeric: true, sensitivity: 'base'});
            vm.items = [];
            vm.visibleItems = [];
            vm.filters = {};
            vm.groups = [
                {kind: 'CATEGORY', field: 'categoryId', label: 'Thể loại', all: 'Tất cả thể loại'},
                {kind: 'DIFFICULTY', field: 'difficultyId', label: 'Mức độ', all: 'Tất cả mức độ'}
            ];
            vm.columns = [
                {label: 'STT'}, {label: 'Mặt hàng', field: 'name'}, {label: 'Ảnh'},
                {label: 'Đơn giá', field: 'unitPrice'}, {label: 'Số lượng', field: 'quantity'},
                {label: 'Thể loại', field: 'categoryId'}, {label: 'Mức độ', field: 'difficultyId'},
                {label: 'Thành tiền', field: 'amount'}
            ];

            vm.$onInit = function () {
                if (vm.openOnLoad) { vm.load(); }
            };
            vm.$postLink = function () {
                dialog = element[0].querySelector('.fair-photo-dialog');
                statsDialog = element[0].querySelector('.fair-stats-dialog');
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
                    if (vm.filters[group.field] != null && !vm.optionsById[vm.filters[group.field]]) {
                        vm.filters[group.field] = null;
                    }
                });
            }
            function searchName(value) {
                return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
            }
            function sortValue(item) {
                switch (vm.sortField) {
                    case 'categoryId': return vm.optionsById[item.categoryId] || '';
                    case 'difficultyId': return vm.optionsById[item.difficultyId] || '';
                    case 'amount': return item.unitPrice * item.quantity;
                    default: return item[vm.sortField];
                }
            }
            function updateTable() {
                var query = searchName(vm.filters.name).trim();
                vm.visibleItems = vm.items.filter(function (item) {
                    return (!query || searchName(item.name).includes(query)) &&
                        vm.groups.every(function (group) {
                            return vm.filters[group.field] == null || vm.filters[group.field] === item[group.field];
                        });
                });
                if (vm.sortField) {
                    vm.visibleItems.sort(function (first, second) {
                        var a = sortValue(first), b = sortValue(second);
                        return vm.sortDirection * (typeof a === 'number' ? a - b : nameOrder.compare(a, b));
                    });
                }
                var totals = {quantity: BigInt(0), prices: BigInt(0), value: BigInt(0)};
                vm.visibleItems.forEach(function (item) {
                    var count = BigInt(item.quantity), price = BigInt(item.unitPrice);
                    totals.quantity += count;
                    totals.prices += price;
                    totals.value += count * price;
                });
                vm.totals = totals;
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
                    updateTable();
                    vm.loaded = true;
                }, 'Không tải được mặt hàng và danh mục. Hãy thử lại.');
            };
            vm.count = function (value) { return countFormat.format(value); };
            vm.price = function (value) { return priceFormat.format(value) + ' đ'; };
            vm.photoUrl = function (item) { return itemPath(item.id) + '/photo?v=' + item.revision; };
            vm.updateTable = updateTable;
            vm.clearFilters = function () {
                vm.filters = {};
                updateTable();
            };
            vm.sortBy = function (field) {
                vm.sortDirection = vm.sortField === field ? -vm.sortDirection : 1;
                vm.sortField = field;
                updateTable();
            };
            vm.sortState = function (field) {
                return field && vm.sortField === field ? (vm.sortDirection === 1 ? 'ascending' : 'descending') : undefined;
            };
            vm.tableItems = function () {
                return vm.itemForm && !vm.itemForm.id ? vm.visibleItems.concat(vm.itemForm) : vm.visibleItems;
            };
            vm.isEditing = function (item) {
                return !!vm.itemForm && item.id === vm.itemForm.id;
            };
            vm.amount = function (item) {
                var row = vm.isEditing(item) ? vm.itemForm : item;
                return row.unitPrice == null || row.quantity == null ? '—' : vm.price(row.unitPrice * row.quantity);
            };
            vm.closeTools = function () {
                var tools = element[0].querySelector('.fair-inventory-tools[open]');
                if (tools) {
                    tools.open = false;
                    tools.querySelector('summary').focus();
                }
            };
            vm.openStatistics = function () {
                vm.closeTools();
                vm.statistics = vm.groups.map(function (group) {
                    var counts = new Map();
                    vm.visibleItems.forEach(function (item) {
                        var id = item[group.field], row = counts.get(id);
                        if (!row) {
                            row = {name: vm.optionsById[id] || 'Chưa phân loại', items: 0, quantity: BigInt(0)};
                            counts.set(id, row);
                        }
                        row.items++;
                        row.quantity += BigInt(item.quantity);
                    });
                    return {
                        label: group.label,
                        rows: Array.from(counts.values()).sort(function (a, b) { return nameOrder.compare(a.name, b.name); })
                    };
                });
                statsDialog.showModal();
            };
            vm.closeStatistics = function () { statsDialog.close(); };

            function makeWorkbook(xlsx, items) {
                function excelTotal(value) {
                    // Excel preserves up to 15 significant digits in numeric cells.
                    return value <= BigInt(999999999999999) ? Number(value) : value.toString();
                }
                var rows = [vm.columns.map(function (column) { return column.label; })];
                items.forEach(function (item, index) {
                    rows.push([index + 1, item.name, null, item.unitPrice, item.quantity, vm.optionsById[item.categoryId],
                        vm.optionsById[item.difficultyId], item.unitPrice * item.quantity]);
                });
                rows.push(['Tổng', null, null, excelTotal(vm.totals.prices), excelTotal(vm.totals.quantity),
                    null, null, excelTotal(vm.totals.value)]);
                var sheet = xlsx.utils.aoa_to_sheet(rows);
                sheet['!cols'] = [{wch: 8}, {wch: 38}, {wpx: 96}, {wch: 17}, {wch: 13}, {wch: 24}, {wch: 16}, {wch: 23}];
                sheet['!rows'] = [{hpt: 20}].concat(items.map(function (item) { return {hpt: item.hasPhoto ? 70 : 20}; }));
                for (var row = 2; row <= rows.length; row++) {
                    sheet['D' + row].z = sheet['H' + row].z = '#,##0" đ"';
                    sheet['E' + row].z = '#,##0';
                }
                var workbook = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(workbook, sheet, 'Mặt hàng hội chợ');
                return workbook;
            }
            function collectWorkbookPhotos(items) {
                var jobs = [];
                items.forEach(function (item, index) {
                    if (item.hasPhoto) { jobs.push({item: item, row: index + 1}); }
                });
                var progress = vm.exportProgress = {done: 0, total: jobs.length};
                var photos = [];
                // Use a 2x canvas for the workbook writer's 90 px square anchor.
                var canvas = win.document.createElement('canvas');
                canvas.width = canvas.height = 180;
                var context = canvas.getContext('2d');
                return jobs.reduce(function (pending, job) {
                    return pending.then(function () {
                        if (disposed) { return; }
                        return images.load(vm.photoUrl(job.item)).then(function (image) {
                            try {
                                var scale = 168 / Math.max(image.width, image.height);
                                var width = image.width * scale, height = image.height * scale;
                                context.clearRect(0, 0, canvas.width, canvas.height);
                                context.drawImage(image.element, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
                                photos.push({row: job.row, col: 2, dataUrl: canvas.toDataURL('image/png')});
                                progress.done++;
                            } finally { win.URL.revokeObjectURL(image.url); }
                        }).catch(function (error) {
                            if (!disposed) { vm.error = 'Không tải được ảnh của “' + job.item.name + '”. Hãy thử xuất lại.'; }
                            return $q.reject(error);
                        });
                    });
                }, $q.when()).then(function () { return photos; });
            }
            vm.exportExcel = function () {
                if (vm.busy || vm.itemForm || !vm.visibleItems.length) { return; }
                vm.closeTools();
                vm.busy = vm.exporting = true;
                vm.error = '';
                var items = vm.visibleItems;
                var loadWriter = win.StudentQrWorkbook ? $q.when() : lazyLoad.load('users/StudentQrWorkbook.js?v=' + win.APP_VERSION);
                return loadWriter.then(function () {
                    if (disposed) { return; }
                    if (!win.XLSX || !win.StudentQrWorkbook) { throw new Error('Missing Excel writer'); }
                    var workbook = makeWorkbook(win.XLSX, items);
                    return collectWorkbookPhotos(items).then(function (photos) {
                        if (disposed) { return; }
                        var bytes = win.StudentQrWorkbook.withImages(win.XLSX, workbook, photos);
                        win.StudentQrWorkbook.download(bytes, 'mat_hang_hoi_cho_' + vm.eventId + '.xlsx');
                    });
                }).catch(function () {
                    if (!disposed && !vm.error) { vm.error = 'Không xuất được Excel. Hãy tải lại trang và thử lại.'; }
                }).finally(function () {
                    vm.busy = vm.exporting = false;
                    vm.exportProgress = null;
                });
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
                    updateTable();
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
                    updateTable();
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
                updateTable();
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
                        return {url: url, width: image.naturalWidth, height: image.naturalHeight, element: image};
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
