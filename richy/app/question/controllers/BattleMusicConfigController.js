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
        vm.sections = [
            {purpose: 'BATTLE', title: 'Nhạc chung', label: 'TẤT CẢ MODE BATTLE ONLINE', icon: 'fa-music',
                description: 'Phát ngẫu nhiên trong các mode Battle Online. Đây là nhạc nền khi trận đấu diễn ra bình thường.', addLabel: 'Thêm nhạc chung'},
            {purpose: 'DEMON_DANGER', title: 'Nhạc lúc nguy hiểm', label: 'MODE DIỆT QUỶ NGU', icon: 'fa-exclamation-triangle',
                description: 'Phát khi có đội còn sống chạm ngưỡng nguy hiểm trong Diệt Quỷ Ngu. Khi an toàn, nhạc chung phát trở lại.', addLabel: 'Thêm nhạc nguy hiểm'}
        ];

        function setTracks(tracks) {
            vm.tracks = angular.copy(tracks || []);
            vm.tracks.forEach(function (track) { track.purpose = track.purpose || 'BATTLE'; });
        }

        vm.sectionCount = function (purpose) {
            return vm.tracks.filter(function (track) { return track.purpose === purpose; }).length;
        };

        vm.addTrack = function (purpose) {
            vm.tracks.push({
                name: (purpose === 'DEMON_DANGER' ? 'Nhạc nguy hiểm ' : 'Battle music ') + (vm.tracks.length + 1),
                url: '',
                enabled: true,
                purpose: purpose || 'BATTLE'
            });
        };

        vm.removeTrack = function (track) {
            var index = vm.tracks.indexOf(track);
            if (index < 0 || vm.saving) { return; }
            if (vm.tracks.length <= 1) {
                toastr.warning('Cần giữ lại ít nhất một link nhạc.', 'Battle Config');
                return;
            }
            vm.tracks.splice(index, 1);
        };

        function neighboringTrackIndex(track, direction) {
            var index = vm.tracks.indexOf(track);
            if (index < 0 || (direction !== -1 && direction !== 1)) { return -1; }
            for (var target = index + direction; target >= 0 && target < vm.tracks.length; target += direction) {
                if (vm.tracks[target].purpose === track.purpose) { return target; }
            }
            return -1;
        }

        vm.canMoveTrack = function (track, direction) { return neighboringTrackIndex(track, direction) >= 0; };

        vm.moveTrack = function (track, direction) {
            var target = neighboringTrackIndex(track, direction);
            if (target < 0 || vm.saving) { return; }
            var index = vm.tracks.indexOf(track);
            vm.tracks[index] = vm.tracks[target];
            vm.tracks[target] = track;
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
                setTracks(saved && saved.tracks);
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
            setTracks(config && config.tracks);
            if (!vm.tracks.length) { vm.addTrack(); }
        }, function () {
            vm.loading = false;
            vm.loadError = true;
            toastr.error('Không tải được cấu hình nhạc.', 'Battle Config');
        });
    }
})();
