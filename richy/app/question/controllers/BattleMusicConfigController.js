(function () {
    'use strict';

    angular.module('Hrm.Question').controller(
        'BattleMusicConfigController',
        BattleMusicConfigController
    );

    BattleMusicConfigController.$inject = ['toastr', 'BattleQuizOnlineService'];

    function BattleMusicConfigController(toastr, service) {
        var vm = this;

        vm.tracks = [];
        vm.loading = true;
        vm.saving = false;
        vm.loadError = false;

        vm.addTrack = function () {
            vm.tracks.push({
                name: 'Battle music ' + (vm.tracks.length + 1),
                url: '',
                enabled: true,
                purpose: 'BATTLE'
            });
        };

        vm.removeTrack = function (index) {
            if (vm.tracks.length <= 1) {
                toastr.warning('Cần giữ lại ít nhất một link nhạc.', 'Battle Config');
                return;
            }
            vm.tracks.splice(index, 1);
        };

        vm.moveTrack = function (index, direction) {
            var target = index + direction;
            if (target < 0 || target >= vm.tracks.length) { return; }
            var item = vm.tracks[index];
            vm.tracks[index] = vm.tracks[target];
            vm.tracks[target] = item;
        };

        vm.enabledCount = function () {
            return vm.tracks.filter(function (track) { return track.enabled !== false; }).length;
        };

        vm.save = function () {
            if (vm.saving) { return; }
            var tracks = vm.tracks.map(function (track, index) {
                return {
                    name: String(track.name || '').trim(),
                    url: String(track.url || '').trim(),
                    enabled: track.enabled !== false,
                    purpose: track.purpose || 'BATTLE',
                    displayOrder: index
                };
            });
            if (!tracks.length || tracks.some(function (track) { return !track.url; })) {
                toastr.warning('Vui lòng nhập đầy đủ link YouTube.', 'Battle Config');
                return;
            }
            if (!tracks.some(function (track) { return track.enabled && track.purpose === 'BATTLE'; })) {
                toastr.warning('Cần bật ít nhất một bài nhạc battle thường.', 'Battle Config');
                return;
            }

            vm.saving = true;
            service.saveBattleMusicConfig({tracks: tracks}).then(function (saved) {
                vm.saving = false;
                vm.tracks = angular.copy((saved && saved.tracks) || []);
                toastr.success('Đã lưu danh sách nhạc battle.', 'Battle Config');
            }, function (error) {
                vm.saving = false;
                var message = error && error.data && error.data.message
                    ? error.data.message : 'Không lưu được cấu hình nhạc.';
                toastr.error(message, 'Battle Config');
            });
        };

        service.getBattleMusicConfig().then(function (config) {
            vm.loading = false;
            vm.loadError = false;
            vm.tracks = angular.copy((config && config.tracks) || []);
            if (!vm.tracks.length) { vm.addTrack(); }
        }, function () {
            vm.loading = false;
            vm.loadError = true;
            toastr.error('Không tải được cấu hình nhạc.', 'Battle Config');
        });
    }
})();
