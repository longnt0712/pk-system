(function () {
    'use strict';
    var app = angular.module('Hrm.Campaign');
    app.controller('CampaignFieldController', ['$scope', '$state', '$stateParams', '$window', '$timeout', 'settings', 'CampaignService', 'AuthSession',
        function ($scope, $state, $stateParams, $window, $timeout, settings, service, auth) {
            var vm = this, generation = 0, timer, destroyed = false, deniedManaged = false, seen = {};
            vm.settings = settings;
            vm.gardens = []; vm.classes = []; vm.query = ''; vm.classId = null; vm.hasMore = false;
            if (settings.campaignsEnabled !== true) { $state.go('login', {showHome: true}, {location: 'replace'}); return; }
            vm.canSeeManagers = function () {
                return !deniedManaged && auth.hasCredentials() && settings.permissionsLoaded === true &&
                    (settings.isAdmin === true || settings.isEducationManagerment === true || settings.isStudentManagerment === true);
            };
            function errorMessage(error) { return error.data && error.data.message || 'Chưa tải được cánh đồng hoa. Vui lòng thử lại.'; }
            vm.loadMore = function () {
                if (destroyed || !vm.campaign || vm.loading || !vm.hasMore) { return; }
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
            var stopExpiry = $scope.$on('session:expired', function () { deniedManaged = true; if (vm.campaign) { vm.reload(); } });
            var stopLogout = $scope.$on('$unauthorized', function () { deniedManaged = true; if (vm.campaign) { vm.reload(); } });
            vm.start = function () {
                vm.starting = true; vm.startError = '';
                return service.getByShareCode($stateParams.campaignCode).then(function (response) {
                    if (destroyed) { return; }
                    if (!$window.FlowerGarden2026.enabled(response.data)) { throw {data: {message: 'Chiến dịch này chưa có cánh đồng hoa Mân Côi.'}}; }
                    vm.campaign = response.data;
                    vm.reload();
                    return service.fieldClasses(vm.campaign.id).then(function (result) { if (!destroyed) { vm.classes = result.data; } }, function () {
                        if (!destroyed) { vm.classesError = 'Chưa tải được danh sách lớp.'; }
                    });
                }).catch(function (error) { if (!destroyed) { vm.startError = errorMessage(error); } })
                    .finally(function () { if (!destroyed) { vm.starting = false; } });
            };
            $scope.$on('$destroy', function () { destroyed = true; ++generation; $timeout.cancel(timer); stopPermissions(); stopExpiry(); stopLogout(); vm.selected = null; vm.gardens = []; });
            vm.start();
        }]);

    app.directive('campaignFieldArt', ['$window', function ($window) {
        return {restrict: 'A', scope: {campaign: '=', colors: '='}, link: function (scope, element) {
            var svg = $window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 940 1672'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
            element[0].appendChild(svg);
            var stop = scope.$watchGroup(['campaign', 'colors'], function () {
                if (!scope.campaign) { return; }
                var garden = $window.FlowerGarden2026.build(scope.campaign, scope.colors || [], '2026-10-31');
                // Only generated geometry, numbered dates and whitelisted palette colors enter SVG markup.
                svg.innerHTML = garden.flowers.map(function (flower) {
                    var x = parseFloat(flower.left) * 9.4, y = parseFloat(flower.top) * 16.72;
                    return '<g transform="translate(' + x + ' ' + y + ') scale(.91)">' +
                        '<path d="M 0 35 L 0 115" fill="none" stroke="#33713B" stroke-width="7"/>' +
                        '<path d="M 0 95 Q -55 82 -51 49 Q -9 53 0 95 M 0 103 Q 55 91 50 59 Q 9 65 0 103" fill="#73B950" stroke="#305630" stroke-width="3"/>' +
                        flower.petals.map(function (petal) { return '<path d="' + petal.path + '" fill="' + petal.color + '" stroke="#513E32" stroke-width="2.5"/>'; }).join('') +
                        '<circle r="19" fill="#F6C654" stroke="#9D6B24" stroke-width="2.5"/>' +
                        '<text y="6" text-anchor="middle" fill="#5A3B1F" font-size="19" font-weight="700">' + flower.day + '</text></g>';
                }).join('');
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
            var stop = scope.$watch('vm.loading + ":" + vm.hasMore + ":" + vm.error', function () {
                observer.unobserve(element[0]);
                if (!scope.vm.loading && scope.vm.hasMore && !scope.vm.error) { observer.observe(element[0]); }
            });
            scope.$on('$destroy', function () { stop(); observer.disconnect(); });
        }};
    }]);
    app.directive('campaignFieldDialog', ['$window', '$timeout', function ($window, $timeout) {
        return {restrict: 'A', link: function (scope, element) {
            var previous = $window.document.activeElement;
            var timer = $timeout(function () { var button = element[0].querySelector('button'); if (button) { button.focus(); } }, 0, false);
            function key(event) {
                if (event.key === 'Escape') { scope.$evalAsync(scope.vm.closeGarden); }
                if (event.key === 'Tab') { event.preventDefault(); element[0].querySelector('button').focus(); }
            }
            element.on('keydown', key);
            scope.$on('$destroy', function () { $timeout.cancel(timer); element.off('keydown', key); if (previous && previous.isConnected) { previous.focus({preventScroll: true}); } });
        }};
    }]);
})();
