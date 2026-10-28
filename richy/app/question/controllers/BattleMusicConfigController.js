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
        vm.lumLuckyAppearance = 'PUMPKIN';
        vm.luckyPreviewImage = function () {
            return vm.lumLuckyAppearance === 'LIGHTNING'
                ? 'assets/images/battle-lightning.svg' : 'assets/images/battle-pumpkin.svg';
        };
        vm.sections = [
            {purpose: 'BATTLE', title: 'Nhạc chung', label: 'TẤT CẢ MODE BATTLE ONLINE', icon: 'fa-music',
                description: 'Phát ngẫu nhiên trong các mode Battle Online. Đây là nhạc nền khi trận đấu diễn ra bình thường.', addLabel: 'Thêm nhạc chung'},
            {purpose: 'DEMON_DANGER', title: 'Nhạc lúc nguy hiểm', label: 'MODE DIỆT QUỶ NGU', icon: 'fa-exclamation-triangle',
                description: 'Phát khi có đội còn sống chạm ngưỡng nguy hiểm trong Diệt Quỷ Ngu. Khi an toàn, nhạc chung phát trở lại.', addLabel: 'Thêm nhạc nguy hiểm'},
            {purpose: 'LUM_LIGHTNING', title: 'Nhạc vật phẩm may mắn', label: 'MODE LỤM NGAY', icon: 'fa-gift',
                description: 'Phát trong 30 giây cả phòng hưởng hiệu ứng may mắn. Giữa các đợt, nhạc này tạm dừng và tiếp tục từ vị trí cũ; hết bài mới phát lại.', addLabel: 'Thêm nhạc may mắn'}
        ];

        function setTracks(tracks) {
            vm.tracks = angular.copy(tracks || []);
            vm.tracks.forEach(function (track) { track.purpose = track.purpose || 'BATTLE'; });
        }

        function setConfig(config) {
            setTracks(config && config.tracks);
            vm.lumLuckyAppearance = config && config.lumLuckyAppearance === 'LIGHTNING' ? 'LIGHTNING' : 'PUMPKIN';
        }

        vm.sectionCount = function (purpose) {
            return vm.tracks.filter(function (track) { return track.purpose === purpose; }).length;
        };

        vm.addTrack = function (purpose) {
            vm.tracks.push({
                name: (purpose === 'DEMON_DANGER' ? 'Nhạc nguy hiểm ' : purpose === 'LUM_LIGHTNING' ? 'Nhạc may mắn ' : 'Battle music ') + (vm.tracks.length + 1),
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
            service.saveBattleMusicConfig({tracks: tracks, lumLuckyAppearance: vm.lumLuckyAppearance}).then(function (saved) {
                vm.saving = false;
                setConfig(saved);
                toastr.success('Đã lưu Battle Config.', 'Battle Config');
            }, function (error) {
                vm.saving = false;
                var message = error && error.data && error.data.message
                    ? error.data.message : 'Không lưu được Battle Config.';
                toastr.error(message, 'Battle Config');
            });
        };

        service.getBattleMusicConfig().then(function (config) {
            vm.loading = false;
            vm.loadError = false;
            setConfig(config);
            if (!vm.tracks.length) { vm.addTrack(); }
        }, function () {
            vm.loading = false;
            vm.loadError = true;
            toastr.error('Không tải được cấu hình nhạc.', 'Battle Config');
        });
    }
})();
