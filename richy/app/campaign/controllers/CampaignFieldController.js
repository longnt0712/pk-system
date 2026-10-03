(function () {
    'use strict';
    var app = angular.module('Hrm.Campaign');
    app.controller('CampaignFieldController', ['$scope', '$state', '$stateParams', '$window', '$timeout', 'settings', 'CampaignService', 'AuthSession',
        function ($scope, $state, $stateParams, $window, $timeout, settings, service, auth) {
            var vm = this, generation = 0, timer, destroyed = false, deniedManaged = false, seen = {};
            var exportGeneration = 0, exporter = $window.GardenImageExport;
            vm.settings = settings;
            vm.gardens = []; vm.classes = []; vm.query = ''; vm.classId = null; vm.hasMore = false;
            if (settings.campaignsEnabled !== true) { $state.go('login', {showHome: true}, {location: 'replace'}); return; }
            vm.canSeeManagers = function () {
                return !deniedManaged && auth.hasCredentials() && settings.permissionsLoaded === true &&
                    (settings.isAdmin === true || settings.isEducationManagerment === true || settings.isStudentManagerment === true);
            };
            vm.canExport = function () { return !destroyed && !deniedManaged && auth.hasCredentials() && settings.permissionsLoaded === true && settings.isAdmin === true; };
            function exportCurrent(request) { return request === exportGeneration && vm.canExport(); }
            function checkExport(request) { if (!exportCurrent(request)) { throw {cancelled: true}; } }
            vm.cancelExport = function () { ++exportGeneration; vm.exportBusy = false; vm.exportingId = null; };
            vm.closeExport = function () { vm.cancelExport(); vm.exportDialog = false; };
            vm.exportImage = function (garden) {
                if (!vm.canExport() || vm.exportBusy || vm.exportingId != null) { return; }
                var request = ++exportGeneration;
                vm.exportingId = garden.id; vm.exportError = '';
                return exporter.create(vm.campaign, garden).then(function (blob) {
                    if (exportCurrent(request)) { exporter.download(blob, exporter.fileName(garden)); }
                }).catch(function (error) { if (exportCurrent(request)) { vm.exportError = error.message || 'Chưa xuất được ảnh. Vui lòng thử lại.'; } })
                    .finally(function () { if (request === exportGeneration) { vm.exportingId = null; $scope.$evalAsync(); } });
            };
            vm.openExport = function () {
                if (!vm.canExport() || !vm.classesLoaded || vm.exportingId != null) { return; }
                vm.exportOptions = vm.classes.map(function (item) { return {id: item.id, name: item.name, selected: true}; });
                vm.exportOptions.push({id: 0, name: 'Chưa xếp lớp', selected: true});
                vm.exportAll = true; vm.exportDialog = true; vm.exportError = ''; vm.exportStatus = ''; vm.exportCount = 0;
            };
            vm.toggleExportAll = function () { vm.exportOptions.forEach(function (item) { item.selected = vm.exportAll; }); };
            vm.exportSelectionChanged = function () { vm.exportAll = vm.exportOptions.every(function (item) { return item.selected; }); };
            vm.hasExportSelection = function () { return (vm.exportOptions || []).some(function (item) { return item.selected; }); };
            vm.exportClasses = function () {
                if (!vm.canExport() || vm.exportBusy || vm.exportingId != null || !vm.exportDialog || !vm.hasExportSelection()) { return; }
                var request = ++exportGeneration, campaign = vm.campaign, zip = exporter.archive(), count = 0;
                var chosen = vm.exportOptions.filter(function (item) { return item.selected; });
                vm.exportBusy = true; vm.exportError = ''; vm.exportCount = 0;
                function status(message) { checkExport(request); vm.exportStatus = message; vm.exportCount = count; $scope.$evalAsync(); }
                function readClass(option) {
                    var cursors = {}, ids = {}, folder = exporter.safeName(option.name) + '-' + option.id;
                    function page(cursor) {
                        checkExport(request); status('Đang tải lớp ' + option.name + '…');
                        return service.fieldExport(campaign.id, {classId: option.id, cursor: cursor, size: 12}).then(function (response) {
                            checkExport(request); var data = response.data, chain = Promise.resolve();
                            (data.gardens || []).forEach(function (garden) {
                                chain = chain.then(function () {
                                    checkExport(request); if (ids[garden.id]) { return; } ids[garden.id] = true;
                                    status('Đang tạo ảnh: ' + garden.fullName + ' · ' + option.name);
                                    return exporter.create(data.campaign || campaign, garden).then(function (blob) {
                                        checkExport(request); return zip.add(folder + '/' + exporter.fileName(garden), blob);
                                    }).then(function () { checkExport(request); count++; vm.exportCount = count; $scope.$evalAsync(); });
                                });
                            });
                            return chain.then(function () {
                                checkExport(request);
                                if (!data.hasMore) { return; }
                                if (!data.nextCursor || cursors[data.nextCursor] || data.nextCursor === cursor || !(data.gardens || []).length) { throw new Error('Phân trang xuất ảnh bị gián đoạn. Vui lòng thử lại.'); }
                                cursors[data.nextCursor] = true; return page(data.nextCursor);
                            });
                        });
                    }
                    return page('');
                }
                var chain = Promise.resolve();
                chosen.forEach(function (option) { chain = chain.then(function () { return readClass(option); }); });
                return chain.then(function () {
                    checkExport(request);
                    if (!count) { throw new Error('Các lớp đã chọn chưa có vườn hoa để xuất.'); }
                    var blob = zip.finish(); checkExport(request);
                    exporter.download(blob, 'Canh-dong-hoa-Man-Coi-2026.zip'); vm.exportStatus = 'Đã xuất ' + count + ' ảnh trong file ZIP.';
                }).catch(function (error) {
                    if (exportCurrent(request) && !error.cancelled) {
                        vm.exportError = error.message || errorMessage(error); vm.exportStatus = '';
                        if (error.status === 401 || error.status === 403) { deniedManaged = true; vm.closeExport(); vm.reload(); }
                    }
                }).finally(function () { zip = null; if (request === exportGeneration) { vm.exportBusy = false; $scope.$evalAsync(); } });
            };
            function errorMessage(error) { return error.data && error.data.message || 'Chưa tải được cánh đồng hoa. Vui lòng thử lại.'; }
            vm.loadMore = function () {
                if (destroyed || !vm.campaign || vm.loading || !vm.hasMore || vm.exportDialog) { return; }
                var request = generation, managed = vm.canSeeManagers();
                vm.loading = true; vm.error = '';
                return service.field(vm.campaign.id, {classId: vm.classId || undefined, q: vm.query.trim(), cursor: vm.cursor || '', size: 6}, managed)
                    .then(function (response) {
                        if (destroyed || request !== generation || managed !== vm.canSeeManagers()) { return; }
                        (response.data.gardens || []).forEach(function (garden) {
                            if (!seen[garden.id]) { seen[garden.id] = true; vm.gardens.push(garden); }
                        });
                        vm.hasMore = response.data.hasMore === true && !!response.data.nextCursor;
                        vm.cursor = response.data.nextCursor;
                    }, function (error) {
                        if (destroyed || request !== generation) { return; }
                        if (managed && (error.status === 401 || error.status === 403)) {
                            deniedManaged = true; vm.reload(); return;
                        }
                        vm.error = errorMessage(error);
                    }).finally(function () { if (!destroyed && request === generation) { vm.loading = false; } });
            };
            vm.reload = function () {
                $timeout.cancel(timer); ++generation; seen = {}; vm.gardens = []; vm.selected = null;
                vm.cursor = ''; vm.hasMore = true; vm.loading = false; vm.error = '';
                return vm.loadMore();
            };
            vm.searchChanged = function () {
                // Invalidate immediately so old search results cannot arrive during debounce.
                $timeout.cancel(timer); ++generation; vm.loading = false; vm.hasMore = false; vm.selected = null; vm.gardens = [];
                timer = $timeout(vm.reload, 400);
            };
            vm.openGarden = function (garden) { vm.selected = garden; };
            vm.closeGarden = function () { vm.selected = null; };
            vm.back = function () { $state.go('campaigns'); };
            var stopPermissions = $scope.$watch(vm.canSeeManagers, function (allowed, previous) {
                if (allowed !== previous && vm.campaign) { vm.reload(); }
            });
            var stopExportPermissions = $scope.$watch(vm.canExport, function (allowed) { if (!allowed) { vm.closeExport(); } });
            var stopExpiry = $scope.$on('session:expired', function () { deniedManaged = true; vm.closeExport(); if (vm.campaign) { vm.reload(); } });
            var stopLogout = $scope.$on('$unauthorized', function () { deniedManaged = true; vm.closeExport(); if (vm.campaign) { vm.reload(); } });
            vm.start = function () {
                vm.starting = true; vm.startError = '';
                return service.getByShareCode($stateParams.campaignCode).then(function (response) {
                    if (destroyed) { return; }
                    if (!$window.FlowerGarden2026.enabled(response.data)) { throw {data: {message: 'Chiến dịch này chưa có cánh đồng hoa Mân Côi.'}}; }
                    vm.campaign = response.data;
                    vm.reload();
                    return service.fieldClasses(vm.campaign.id).then(function (result) { if (!destroyed) { vm.classes = result.data; vm.classesLoaded = true; vm.classesError = ''; } }, function () {
                        if (!destroyed) { vm.classesError = 'Chưa tải được danh sách lớp.'; }
                    });
                }).catch(function (error) { if (!destroyed) { vm.startError = errorMessage(error); } })
                    .finally(function () { if (!destroyed) { vm.starting = false; } });
            };
            $scope.$on('$destroy', function () { destroyed = true; vm.closeExport(); ++generation; $timeout.cancel(timer); stopPermissions(); stopExportPermissions(); stopExpiry(); stopLogout(); vm.selected = null; vm.gardens = []; });
            vm.start();
        }]);

    app.directive('campaignFieldArt', ['$window', function ($window) {
        return {restrict: 'A', scope: {campaign: '=', colors: '='}, link: function (scope, element) {
            var svg = $window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 940 1672'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
            element[0].appendChild(svg);
            var stop = scope.$watchGroup(['campaign', 'colors'], function () {
                if (!scope.campaign) { return; }
                // Shared with PNG export: only generated geometry and whitelisted colors enter SVG.
                svg.innerHTML = $window.FlowerGarden2026.svgMarkup(scope.campaign, scope.colors || []);
            });
            scope.$on('$destroy', stop);
        }};
    }]);
    app.directive('campaignFieldMore', ['$window', function ($window) {
        return {restrict: 'A', link: function (scope, element) {
            if (!$window.IntersectionObserver) { return; }
            var observer = new $window.IntersectionObserver(function (entries) {
                if (entries.some(function (entry) { return entry.isIntersecting; }) && !scope.vm.error) {
                    scope.$evalAsync(function () { scope.vm.loadMore(); });
                }
            }, {root: element[0].closest('.campaign-field-page'), rootMargin: '300px'});
            var stop = scope.$watch('vm.loading + ":" + vm.hasMore + ":" + vm.error + ":" + vm.exportDialog', function () {
                observer.unobserve(element[0]);
                if (!scope.vm.loading && scope.vm.hasMore && !scope.vm.error && !scope.vm.exportDialog) { observer.observe(element[0]); }
            });
            scope.$on('$destroy', function () { stop(); observer.disconnect(); });
        }};
    }]);
    app.directive('campaignFieldDialog', ['$window', '$timeout', function ($window, $timeout) {
        return {restrict: 'A', link: function (scope, element) {
            var previous = $window.document.activeElement;
            var timer = $timeout(function () { var button = element[0].querySelector('button'); if (button) { button.focus(); } }, 0, false);
            function key(event) {
                if (event.key === 'Escape') { scope.$evalAsync(scope.vm.exportDialog ? scope.vm.closeExport : scope.vm.closeGarden); }
                if (event.key === 'Tab') {
                    var items = Array.prototype.filter.call(element[0].querySelectorAll('button:not([disabled]),input:not([disabled])'), function (item) { return item.getClientRects().length; });
                    if (!items.length) { return; }
                    var first = items[0], last = items[items.length - 1], current = $window.document.activeElement;
                    if (event.shiftKey && (current === first || items.indexOf(current) < 0)) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && (current === last || items.indexOf(current) < 0)) { event.preventDefault(); first.focus(); }
                }
            }
            element.on('keydown', key);
            scope.$on('$destroy', function () { $timeout.cancel(timer); element.off('keydown', key); if (previous && previous.isConnected) { previous.focus({preventScroll: true}); } });
        }};
    }]);
})();
