(function () {
    'use strict';
    angular.module('Hrm.Campaign').controller('CampaignController', CampaignController);
    CampaignController.$inject = ['$scope', '$state', '$stateParams', '$window', 'settings', 'CampaignService', 'toastr', '$location'];
    function CampaignController($scope, $state, $stateParams, $window, settings, service, toastr, $location) {
        var vm = this;
        vm.settings = settings;
        if (settings.campaignsEnabled !== true) {
            $state.go('login', {showHome: true}, {location: 'replace'});
            return;
        }
        var requestNumber = 0;
        var studentRequest = 0;
        var prayerIntentions = [
            {intention: 'ông bà, cha mẹ', prayer: 'Xin Chúa ban cho ông bà, cha mẹ sức khỏe và bình an.', image: 'assets/images/flower-prayers-2026/01-grandparents-parents.jpg'},
            {intention: 'những người đang đau ốm', prayer: 'Xin Chúa nâng đỡ và ban cho họ sức mạnh, niềm hy vọng và bình an.', image: 'assets/images/flower-prayers-2026/02-sick.jpg'},
            {intention: 'các bạn nhỏ gặp khó khăn', prayer: 'Xin Chúa giúp các bạn được chăm sóc, yêu thương và đến trường.', image: 'assets/images/flower-prayers-2026/03-children-in-need.jpg'},
            {intention: 'những người đang buồn hoặc cô đơn', prayer: 'Xin Chúa an ủi và giúp họ gặp được những người biết quan tâm, chia sẻ.', image: 'assets/images/flower-prayers-2026/04-lonely.jpg'},
            {intention: 'gia đình của em', prayer: 'Xin Chúa giúp mọi người trong gia đình luôn biết yêu thương và tha thứ cho nhau.', image: 'assets/images/flower-prayers-2026/05-family.jpg'},
            {intention: 'giáo xứ và xứ đoàn', prayer: 'Xin Chúa giúp chúng con luôn hiệp nhất và cùng giúp nhau yêu mến Chúa.', image: 'assets/images/flower-prayers-2026/06-parish.jpg'},
            {intention: 'chính em', prayer: 'Xin Chúa giúp em biết làm việc tốt với lòng yêu thương.', image: 'assets/images/flower-prayers-2026/07-self.jpg'}
        ];
        var lastPrayerIndex = -1;
        vm.flowerPrayer = null;
        vm.closeFlowerPrayer = function () { vm.flowerPrayer = null; vm.flowerPrayerTrigger = null; };
        function showFlowerPrayer(returnFocus) {
            // One reminder for overlapping successful saves; never interrupt another campaign view.
            if (vm.flowerPrayer || vm.sheetLoading || vm.rosaryGuideOpen || vm.gardenOpen || !vm.student) { return; }
            var choices = prayerIntentions.filter(function (value, index) { return index !== lastPrayerIndex; });
            var selected = choices[Math.floor(Math.random() * choices.length)];
            lastPrayerIndex = prayerIntentions.indexOf(selected); vm.flowerPrayerTrigger = returnFocus; vm.flowerPrayer = selected;
        }
        var serverClockOffset = 0, dayTimer;
        var rosaryConfig = $window.RosaryCampaign2026, rosaryContext = '', rosaryStudentContext = '';
        vm.rosaryGuide = null; vm.rosaryGuideOpen = false; vm.rosaryInstructionsOpen = false; vm.rosaryParticipationOpen = false;
        function updateRosaryGuide(refresh) {
            var today = studentToday();
            if (!vm.studentMode || !vm.student || !rosaryConfig || !rosaryConfig.appliesTo(vm.campaign, today)) {
                vm.rosaryGuide = null; vm.rosaryGuideOpen = false; vm.rosaryInstructionsOpen = false; vm.rosaryParticipationOpen = false; rosaryContext = ''; rosaryStudentContext = ''; return;
            }
            var studentContext = [vm.campaign.id, vm.student.studentCode, (vm.student.classes || []).join('|')].join(':');
            var context = studentContext + ':' + today;
            if (context !== rosaryContext) {
                // Show the participation guide first for each student/campaign, including a saved QR link.
                vm.rosaryParticipationOpen = vm.rosaryParticipationOpen || studentContext !== rosaryStudentContext;
                rosaryStudentContext = studentContext;
                rosaryContext = context; vm.rosaryInstructionsOpen = false;
                vm.rosaryGuide = rosaryConfig.select(vm.student, today);
                vm.rosaryGuideOpen = !!vm.rosaryGuide && !vm.gardenOpen;
                if (vm.rosaryGuideOpen && vm.fullscreen && vm.toggleFullscreen) { vm.toggleFullscreen(); }
            } else if (refresh && vm.rosaryGuide && vm.rosaryGuide.randomizable) {
                vm.rosaryGuide = rosaryConfig.select(vm.student, today, null, vm.rosaryGuide);
            }
        }
        vm.refreshRosaryGuide = function () { updateRosaryGuide(true); };
        vm.openRosaryGuide = function () {
            vm.gardenOpen = false;
            vm.rosaryInstructionsOpen = false;
            updateRosaryGuide(); vm.rosaryParticipationOpen = false; vm.rosaryGuideOpen = !!vm.rosaryGuide;
            if (vm.rosaryGuideOpen && vm.fullscreen && vm.toggleFullscreen) { vm.toggleFullscreen(); }
        };
        vm.openRosaryParticipation = function () {
            vm.openRosaryGuide();
            vm.rosaryParticipationOpen = !!vm.rosaryGuide;
        };
        vm.openRosaryInstructions = function () {
            if (vm.rosaryGuideOpen && vm.rosaryGuide && !vm.rosaryParticipationOpen) { vm.rosaryInstructionsOpen = true; }
        };
        vm.closeRosaryInstructions = function () { vm.rosaryInstructionsOpen = false; };
        vm.closeRosaryGuide = function () {
            vm.rosaryGuideOpen = false; vm.rosaryInstructionsOpen = false; vm.rosaryParticipationOpen = false;
            if (vm.rosaryGuide && vm.campaign) {
                var week = Math.floor((Date.parse(studentToday() + 'T00:00:00Z') - Date.parse(vm.campaign.startDate + 'T00:00:00Z')) / (7 * 86400000));
                if (week !== vm.weekIndex) { return vm.setWeek(week); }
            }
        };
        vm.studentMode = $stateParams.studentMode === true;
        var targetId = vm.studentMode ? Number($stateParams.campaignId) || null : null;
        var targetCode = vm.studentMode ? $stateParams.campaignCode : null;
        var hasTarget = !!(targetId || targetCode);
        var studentToken = vm.studentMode ? String($window.location.hash || '').slice(1) : '';
        var gardenConfig = $window.FlowerGarden2026, gardenRequest = 0, gardenEntries = [];
        vm.gardenOpen = false; vm.gardenPalette = gardenConfig ? gardenConfig.palette : [];
        vm.gardenColor = '#F48FB1'; vm.gardenBusy = false; vm.gardenDay = null;
        var gardenExportRequest = 0;
        vm.gardenEraseMode = false;
        vm.gardenEnabled = function () { return !!(vm.studentMode && vm.student && gardenConfig && gardenConfig.enabled(vm.campaign)); };
        vm.fieldEnabled = function (campaign) { return !!(gardenConfig && gardenConfig.enabled(campaign) && /^[a-f0-9]{32}$/.test(campaign.shareCode || '')); };
        vm.openField = function (campaign) {
            if (!vm.fieldEnabled(campaign) || vm.gardenBusy || vm.sheetLoading || vm.scanBusy || Object.keys(vm.pendingChecks || {}).length) { return; }
            if (vm.fullscreen && vm.toggleFullscreen) { vm.toggleFullscreen(); }
            return $state.go('campaign_field', {campaignCode: campaign.shareCode}, {inherit: false});
        };
        function renderGarden() {
            if (!vm.gardenEnabled()) { return; }
            var date = vm.gardenDay && vm.gardenDay.date;
            vm.garden = gardenConfig.build(vm.campaign, gardenEntries, studentToday());
            vm.gardenDay = date ? vm.garden.flowers.filter(function (flower) { return flower.date === date; })[0] : null;
        }
        function receiveGarden(data) {
            vm.campaign = data.campaign; gardenEntries = data.entries || [];
            if (data.serverTime) { serverClockOffset = data.serverTime - Date.now(); }
            // Refresh both views from the same server snapshot after checks changed on another device.
            vm.checks = {}; vm.savedChecks = {};
            gardenEntries.forEach(function (entry) { vm.checks[entry.itemKey + ':' + entry.date] = vm.savedChecks[entry.itemKey + ':' + entry.date] = entry.completed === true; });
            prepareCampaign(vm.weekIndex); renderGarden();
        }
        vm.loadGarden = function () {
            if (!vm.gardenEnabled() || vm.gardenBusy) { return; }
            var request = ++gardenRequest, id = vm.campaign.id, token = studentToken;
            vm.gardenLoading = true; vm.gardenError = ''; vm.gardenNotice = '';
            return service.studentGarden(token, id).then(function (response) {
                if (request === gardenRequest && token === studentToken && vm.campaign && vm.campaign.id === id) { receiveGarden(response.data); }
            }, function (error) { if (request === gardenRequest) { vm.gardenError = errorMessage(error); } })
                .finally(function () { if (request === gardenRequest) { vm.gardenLoading = false; } });
        };
        vm.openGarden = function () {
            if (!vm.gardenEnabled() || Object.keys(vm.pendingChecks || {}).length) { return; }
            vm.rosaryGuideOpen = false; vm.rosaryParticipationOpen = false; vm.rosaryInstructionsOpen = false;
            if (vm.fullscreen && vm.toggleFullscreen) { vm.toggleFullscreen(); }
            vm.gardenOpen = true; vm.gardenDay = null; vm.gardenResetConfirm = false; vm.gardenEraseMode = false;
            return vm.loadGarden();
        };
        vm.closeGarden = function () { if (!vm.gardenBusy) { vm.gardenOpen = false; vm.gardenDay = null; vm.gardenResetConfirm = false; } };
        vm.selectGardenDay = function (flower) { if (!vm.gardenBusy && !vm.gardenLoading) { vm.gardenDay = flower; vm.gardenEraseMode = false; vm.gardenNotice = ''; } };
        vm.selectGardenColor = function (color) { vm.gardenColor = color; vm.gardenEraseMode = false; vm.gardenNotice = ''; };
        vm.selectGardenEraser = function () {
            if (vm.gardenBusy || vm.gardenLoading || !vm.gardenDay || vm.gardenDay.future) { return; }
            vm.gardenEraseMode = !vm.gardenEraseMode;
            vm.gardenNotice = vm.gardenEraseMode ? 'Chạm vào cánh đã tô để xóa màu và nhận lại một lượt tô.' : '';
        };
        vm.paintGardenPetal = function (petal) {
            if (vm.gardenBusy || vm.gardenLoading || !vm.gardenDay || vm.gardenDay.future) { return; }
            var erase = vm.gardenEraseMode;
            if (erase && petal.color === '#FFFFFF') { return; }
            if (!erase && petal.color === '#FFFFFF' && !vm.gardenDay.available) { vm.gardenNotice = 'Ngày này đã hết lượt tô. Em hãy tích những việc đã thực hiện để nhận thêm lượt nhé.'; return; }
            var token = studentToken, id = vm.campaign.id, date = vm.gardenDay.date, request = ++gardenRequest;
            vm.gardenBusy = true; vm.gardenError = ''; vm.gardenNotice = erase ? 'Đang xóa màu cánh hoa…' : 'Đang lưu màu…';
            var change = erase ? service.eraseFlowerPetal(token, id, date, petal.key) : service.paintFlower(token, id, date, petal.key, vm.gardenColor);
            return change.then(function (response) {
                if (request === gardenRequest && token === studentToken) { receiveGarden(response.data); vm.gardenNotice = erase ? 'Đã xóa màu cánh này và hoàn một lượt tô. Các ô tích vẫn được giữ nguyên.' : 'Đã lưu màu của em.'; }
            }, function (error) {
                if (request === gardenRequest) { vm.gardenError = errorMessage(error); vm.gardenNotice = ''; }
            }).finally(function () { if (request === gardenRequest) { vm.gardenBusy = false; } });
        };
        vm.askResetGardenPaint = function () {
            if (!vm.gardenEnabled() || vm.gardenBusy || vm.gardenLoading) { return; }
            vm.gardenResetConfirm = true; vm.gardenError = '';
        };
        vm.resetGardenPaint = function () {
            if (!vm.gardenResetConfirm || vm.gardenBusy || vm.gardenLoading) { return; }
            var token = studentToken, id = vm.campaign.id, request = ++gardenRequest;
            vm.gardenBusy = true; vm.gardenError = ''; vm.gardenNotice = '';
            return service.resetFlowerPaint(token, id).then(function (response) {
                if (request === gardenRequest && token === studentToken) {
                    receiveGarden(response.data); vm.gardenResetConfirm = false;
                    vm.gardenNotice = 'Đã xóa màu và hoàn lại lượt tô. Các việc đã tích vẫn được giữ nguyên.';
                }
            }, function (error) { if (request === gardenRequest) { vm.gardenError = errorMessage(error); } })
                .finally(function () { if (request === gardenRequest) { vm.gardenBusy = false; } });
        };
        vm.exportGardenImage = function () {
            if (!vm.gardenEnabled() || vm.gardenExportBusy || vm.gardenBusy || vm.gardenLoading || Object.keys(vm.pendingChecks || {}).length) { return; }
            var token = studentToken, id = vm.campaign.id, request = ++gardenExportRequest;
            var student = angular.copy(vm.student), exporter = $window.GardenImageExport;
            function current() { return request === gardenExportRequest && token === studentToken && vm.campaign && vm.campaign.id === id; }
            vm.gardenExportBusy = true; vm.gardenExportError = '';
            // Read a fresh snapshot, including checks/colors saved from another device.
            return service.studentGarden(token, id).then(function (response) {
                if (!current()) { return; }
                var snapshot = response.data, garden = gardenConfig.build(snapshot.campaign, snapshot.entries || [], '2026-10-31');
                var card = {saintName: student.saintName, fullName: student.fullName, classes: student.classes, completedCount: garden.earned, colors: snapshot.entries || []};
                return exporter.create(snapshot.campaign, card).then(function (blob) { if (current()) { exporter.download(blob, exporter.fileName(card)); } });
            }).catch(function (error) { if (current()) { vm.gardenExportError = error.message || errorMessage(error); } })
                .finally(function () { if (current()) { vm.gardenExportBusy = false; $scope.$evalAsync(); } });
        };
        vm.needsScan = vm.studentMode && !/^[A-Za-z0-9_-]{43}$/.test(studentToken);
        vm.checks = {}; vm.savedChecks = {}; vm.pendingChecks = {};
        vm.page = 1;
        vm.query = '';
        vm.campaigns = [];
        vm.weekIndex = 0;
        vm.canManage = function () {
            return !vm.studentMode && settings.permissionsLoaded === true && (settings.isAdmin === true || settings.isEducationManagerment === true);
        };
        var imageFields = ['desktopLeftImageUrl', 'desktopRightImageUrl', 'mobileImageUrl'];
        vm.imageOptions = function () { return vm.editor || vm.campaign || {}; };
        vm.backgroundOpacity = function (campaign) {
            var value = campaign && campaign.flowerBackgroundOpacity;
            return value == null ? 0.2 : Math.max(0, Math.min(1, Number(value) / 100));
        };
        function clamp(value, low, high, fallback) { value = Number(value); return isFinite(value) ? Math.max(low, Math.min(high, Math.round(value))) : fallback; }
        vm.imageCrop = function (campaign, field) {
            var crop = campaign && campaign.imageCrops && campaign.imageCrops[field] || {};
            return {zoom: clamp(crop.zoom == null ? 100 : crop.zoom, 50, 300, 100), x: clamp(crop.x || 0, -100, 100, 0), y: clamp(crop.y || 0, -100, 100, 0)};
        };
        vm.imageStyle = function (field, campaign) {
            var crop = vm.imageCrop(campaign, field);
            return {transform: 'translate(' + crop.x + '%, ' + crop.y + '%) scale(' + crop.zoom / 100 + ')'};
        };
        vm.cropFrameStyle = function () {
            if (vm.cropField === 'mobileImageUrl') { return {}; }
            var ratio = 9 / 16;
            return {aspectRatio: ratio, width: 'min(32%, ' + (360 * ratio) + 'px)'};
        };
        vm.previewSideStyle = function (field) {
            var ratio = 9 / 16;
            return {aspectRatio: ratio, flex: ratio + ' 1 0px'};
        };
        vm.backgroundStyle = function (campaign) { var style = vm.imageStyle('mobileImageUrl', campaign); style.opacity = vm.backgroundOpacity(campaign); return style; };
        function initializeCrops() {
            vm.editor.imageCrops = vm.editor.imageCrops || {};
            imageFields.forEach(function (field) { vm.editor.imageCrops[field] = vm.imageCrop(vm.editor, field); });
            vm.cropField = 'mobileImageUrl';
        }
        vm.resetImageCrop = function (field) { if (vm.editor && vm.canManage()) { vm.editor.imageCrops[field] = {zoom: 100, x: 0, y: 0}; } };
        vm.changeImageZoom = function (delta) { if (vm.editor && vm.canManage()) { var crop = vm.editor.imageCrops[vm.cropField]; crop.zoom = clamp(Number(crop.zoom) + delta, 50, 300, 100); } };
        function imageSnapshot(campaign) {
            return JSON.stringify(imageFields.map(function (field) { return [String(campaign[field] || '').trim(), vm.imageCrop(campaign, field)]; }).concat(vm.backgroundOpacity(campaign)));
        }
        vm.hasUnsavedImages = function () { return !!vm.editor && imageSnapshot(vm.editor) !== vm.editorImageBaseline; };
        function beforeUnload(event) { if (vm.hasUnsavedImages()) { event.preventDefault(); event.returnValue = ''; } }
        if ($window.addEventListener) { $window.addEventListener('beforeunload', beforeUnload); }
        if ($scope.$on) { $scope.$on('$stateChangeStart', function (event) {
            if (vm.hasUnsavedImages() && !$window.confirm('Bạn chưa lưu link ảnh, độ mờ hoặc vùng cắt ảnh. Rời trang và bỏ các thay đổi này?')) { event.preventDefault(); }
        }); }

        function validImageUrl(value) {
            try {
                var url = new $window.URL(value);
                return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname && !url.username && !url.password;
            } catch (error) { return false; }
        }
        vm.imageUrl = function (value) {
            var url = typeof value === 'string' ? value.trim() : '';
            return url && validImageUrl(url) ? url : '';
        };
        vm.flowerInstructions = function (campaign) {
            return String(campaign.flowerInstructions || '').replace(/Nộp phiếu theo hướng dẫn của xứ đoàn\./g, '').trim();
        };
        vm.formatDate = function (value) {
            var parts = String(value || '').split('-');
            return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : '';
        };
        function iso(date) {
            return ('0000' + date.getFullYear()).slice(-4) + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
        }
        function date(value) {
            var parts = String(value || '').split('-');
            var result = new Date(0);
            result.setFullYear(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            result.setHours(12, 0, 0, 0);
            return result;
        }
        vm.status = function (campaign) {
            var today = studentToday();
            if (today < campaign.startDate) { return 'Sắp diễn ra'; }
            return today > campaign.endDate ? 'Đã kết thúc' : 'Đang diễn ra';
        };
        vm.isExpired = function (campaign) { return !!campaign && studentToday() > campaign.endDate; };
        vm.canPrint = function () {
            return settings.permissionsLoaded === true && (settings.isAdmin === true || settings.isEducationManagerment === true || settings.isStudentManagerment === true);
        };
        vm.canShare = function (campaign) { return vm.canPrint() && !vm.isExpired(campaign) && /^[a-f0-9]{32}$/.test(campaign.shareCode || ''); };
        vm.campaignLink = function (campaign) { return 'https://tnttphungkhoang.com/hoa-thieng/c/' + campaign.shareCode; };
        vm.copyLink = function (campaign) {
            if (!vm.canShare(campaign)) { return; }
            var link = vm.campaignLink(campaign);
            function copied() { $scope.$evalAsync(function () { toastr.success('Đã sao chép link chiến dịch.'); }); }
            function failed() { $scope.$evalAsync(function () { toastr.error('Chưa sao chép được. Hãy mở QR chiến dịch và sao chép link trong ô.'); }); }
            if ($window.navigator && $window.navigator.clipboard && $window.navigator.clipboard.writeText) {
                return $window.navigator.clipboard.writeText(link).then(copied, failed);
            }
            var input = $window.document.createElement('textarea'), previous = $window.document.activeElement;
            input.value = link; input.style.position = 'fixed'; input.style.opacity = '0';
            $window.document.body.appendChild(input); input.select();
            try { if ($window.document.execCommand('copy')) { copied(); } else { failed(); } }
            catch (error) { failed(); }
            finally { input.remove(); if (previous && previous.focus) { previous.focus(); } }
        };
        vm.showQr = function (campaign) {
            if (!vm.canShare(campaign)) { return; }
            var share = vm.share = {campaign: campaign, link: vm.campaignLink(campaign)};
            return $window.QRCode.toDataURL(share.link, {width: 360, margin: 4, errorCorrectionLevel: 'M'}).then(function (image) {
                $scope.$evalAsync(function () { if (vm.share === share) { share.image = image; } });
            }, function () { $scope.$evalAsync(function () { if (vm.share === share) { share.error = 'Không tạo được QR. Bạn vẫn có thể sao chép link bên dưới.'; } }); });
        };
        function errorMessage(error) {
            if (error.status === 403) { return 'Chỉ Admin hoặc Education Management có quyền tạo, sửa, xóa chiến dịch.'; }
            if (error.status === 404) { return 'Chiến dịch không còn tồn tại.'; }
            if (error.status === 409) { return 'Chiến dịch đã được thay đổi. Hãy tải lại trang trước khi sửa.'; }
            if (error.status === 401) { return 'Vui lòng đăng nhập bằng tài khoản Admin hoặc Education Management.'; }
            return error.data && error.data.message || 'Không thể kết nối. Vui lòng thử lại.';
        }
        vm.load = function (page) {
            vm.page = page || 1;
            vm.loading = true; vm.error = '';
            var request = ++requestNumber;
            return service.list(vm.query, vm.page).then(function (response) {
                if (request !== requestNumber) { return; }
                vm.campaigns = response.data.content;
                vm.totalPages = response.data.totalPages;
                vm.total = response.data.totalElements;
            }, function (error) {
                if (request === requestNumber) { vm.error = errorMessage(error); }
            }).finally(function () { if (request === requestNumber) { vm.loading = false; } });
        };
        function loadDetail() {
            vm.loading = true; vm.error = '';
            return ($stateParams.campaignCode ? service.getByShareCode($stateParams.campaignCode) : service.get($stateParams.id)).then(function (response) {
                vm.campaign = response.data;
                prepareCampaign(0);
            }, function (error) { vm.error = errorMessage(error); }).finally(function () { vm.loading = false; });
        }
        function prepareCampaign(week) {
                var start = date(vm.campaign.startDate), end = date(vm.campaign.endDate);
                // Calculate by calendar days, independent of daylight-saving changes.
                var firstDay = new Date(start.getTime()), lastDay = new Date(end.getTime());
                firstDay.setUTCHours(0, 0, 0, 0); firstDay.setUTCFullYear(start.getFullYear(), start.getMonth(), start.getDate());
                lastDay.setUTCHours(0, 0, 0, 0); lastDay.setUTCFullYear(end.getFullYear(), end.getMonth(), end.getDate());
                vm.weekCount = Math.ceil((Math.round((lastDay - firstDay) / 86400000) + 1) / 7);
                renderWeek(week);
        }
        function renderWeek(index) {
            if (!vm.campaign || index < 0 || index >= vm.weekCount) { return; }
            vm.weekIndex = index;
            var day = date(vm.campaign.startDate);
            day.setDate(day.getDate() + index * 7);
            vm.weekDays = [];
            var names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            for (var i = 0; i < 7 && iso(day) <= vm.campaign.endDate; i++) {
                vm.weekDays.push({date: iso(day), label: names[day.getDay()]});
                day.setDate(day.getDate() + 1);
            }
        }
        function loadStudentSheet(id, week) {
            vm.closeFlowerPrayer();
            var request = ++studentRequest;
            vm.sheetLoading = true; vm.error = ''; vm.checkError = ''; vm.saveNotice = '';
            return service.studentSheet(studentToken, id, week).then(function (response) {
                if (request !== studentRequest) { return; }
                vm.student = response.data.student; vm.campaign = response.data.campaign;
                if (response.data.serverTime) { serverClockOffset = response.data.serverTime - Date.now(); }
                scheduleNewDay();
                vm.checks = {}; vm.savedChecks = {};
                (response.data.entries || []).forEach(function (entry) { vm.checks[entry.itemKey + ':' + entry.date] = vm.savedChecks[entry.itemKey + ':' + entry.date] = entry.completed === true; });
                prepareCampaign(week);
                updateRosaryGuide();
            }, function (error) { if (request === studentRequest) { vm.error = errorMessage(error); } })
                .finally(function () { if (request === studentRequest) { vm.sheetLoading = false; } });
        }
        vm.useScannedQr = function (decoded) {
            if (!vm.studentMode || vm.scanBusy || (hasTarget && (!vm.targetCampaign || vm.loading))) { return; }
            var value = String(decoded || '').trim(), token = '';
            if (/^https?:\/\//i.test(value)) {
                try {
                    var url = new $window.URL(value), currentHost = $window.location.hostname;
                    if ((url.hostname !== currentHost && !/^(www\.)?tnttphungkhoang\.com$/i.test(url.hostname)) || !/^\/hoa-thieng(?:\/(?:[1-9][0-9]*|c\/[a-f0-9]{32}))?\/?$/.test(url.pathname) || !/^[A-Za-z0-9_-]{43}$/.test(url.hash.slice(1))) { throw new Error('Invalid'); }
                    token = url.hash.slice(1);
                } catch (error) { vm.scanError = 'Đây không phải mã QR học sinh. Em hãy quét mã trên thẻ của mình.'; return; }
            } else if (!value || value.length > 100 || /[\x00-\x1f\x7f]/.test(value)) {
                vm.scanError = 'Mã QR học sinh không hợp lệ. Em hãy quét lại thẻ.'; return;
            }
            vm.scanBusy = true; vm.scanError = ''; vm.error = '';
            var request = token ? service.studentLanding(token) : service.scanStudentQr(value);
            return request.then(function (response) {
                var resolved = token || response.data.token;
                if (!/^[A-Za-z0-9_-]{43}$/.test(resolved || '')) { throw new Error('Invalid token'); }
                studentToken = resolved;
                $location.hash(resolved).replace();
                vm.needsScan = false;
                return loadStudentLanding();
            }).catch(function () { vm.needsScan = true; vm.scanError = 'Không mở được phiếu. Em hãy kiểm tra đúng thẻ học sinh và thử quét lại.'; })
                .finally(function () { vm.scanBusy = false; });
        };
        vm.scanAnotherStudent = function () {
            vm.closeFlowerPrayer();
            ++gardenExportRequest; vm.gardenExportBusy = false; vm.gardenExportError = ''; vm.gardenEraseMode = false;
            ++gardenRequest; gardenEntries = []; vm.gardenOpen = false; vm.garden = null; vm.gardenDay = null; vm.gardenBusy = false; vm.gardenLoading = false; vm.gardenResetConfirm = false;
            ++studentRequest; vm.student = null; vm.campaign = null; vm.campaigns = []; studentToken = '';
            vm.rosaryGuide = null; vm.rosaryGuideOpen = false; vm.rosaryInstructionsOpen = false; vm.rosaryParticipationOpen = false; rosaryContext = ''; rosaryStudentContext = '';
            vm.needsScan = true; vm.error = ''; vm.scanError = ''; vm.checkError = ''; vm.saveNotice = '';
            vm.checks = {}; vm.savedChecks = {}; vm.pendingChecks = {};
            if (dayTimer) { $window.clearTimeout(dayTimer); dayTimer = null; }
            $location.hash('').replace();
        };
        function loadTargetCampaign() {
            vm.loading = true; vm.error = ''; vm.targetCampaign = null;
            return (targetCode ? service.getByShareCode(targetCode) : service.get(targetId)).then(function (response) {
                vm.targetCampaign = response.data; targetId = vm.targetCampaign.id;
                return loadStudentLanding();
            }, function (error) { vm.error = errorMessage(error); }).finally(function () { vm.loading = false; });
        }
        function loadStudentLanding() {
            if (!studentToken) { vm.needsScan = true; return; }
            if (!/^[A-Za-z0-9_-]{43}$/.test(studentToken)) {
                vm.error = 'Mã QR học sinh không hợp lệ. Vui lòng quét lại mã QR được cấp.'; return;
            }
            vm.loading = true; vm.error = '';
            return service.studentLanding(studentToken).then(function (response) {
                vm.needsScan = false; vm.student = response.data.student; vm.campaigns = response.data.campaigns;
                if (response.data.serverTime) { serverClockOffset = response.data.serverTime - Date.now(); }
                vm.total = vm.campaigns.length;
                if (hasTarget) { return vm.selectCampaign(targetId); }
                if (vm.campaigns.length === 1) { return vm.selectCampaign(vm.campaigns[0].id); }
                if (!vm.campaigns.length) { return vm.load(1); }
            }, function (error) { vm.needsScan = true; vm.error = error.status === 404 ? 'Mã QR không hợp lệ hoặc tài khoản học sinh đã ngừng hoạt động.' : errorMessage(error); })
                .finally(function () { vm.loading = false; });
        }
        vm.selectCampaign = function (id) {
            if (!vm.studentMode) { return; }
            if (vm.campaign && vm.campaign.id !== id) { ++gardenExportRequest; vm.gardenExportBusy = false; vm.gardenExportError = ''; }
            var campaign = targetId === id ? vm.targetCampaign : vm.campaigns.filter(function (value) { return value.id === id; })[0];
            var week = 0;
            if (campaign) {
                var day = studentToday() < campaign.endDate ? studentToday() : campaign.endDate;
                week = Math.max(0, Math.floor((Date.parse(day + 'T00:00:00Z') - Date.parse(campaign.startDate + 'T00:00:00Z')) / (7 * 86400000)));
            }
            return loadStudentSheet(id, week);
        };
        vm.retry = function () {
            if (vm.studentMode) { if (hasTarget && !vm.targetCampaign) { return loadTargetCampaign(); } return vm.campaign ? loadStudentSheet(vm.campaign.id, vm.weekIndex) : loadStudentLanding(); }
            return ($stateParams.id || $stateParams.campaignCode) ? loadDetail() : vm.load(vm.page);
        };
        vm.setWeek = function (index) {
            if (!vm.campaign || index < 0 || index >= vm.weekCount) { return; }
            return vm.studentMode ? loadStudentSheet(vm.campaign.id, index) : renderWeek(index);
        };
        function studentToday() { return new Date(Date.now() + serverClockOffset + 7 * 3600000).toISOString().slice(0, 10); }
        function scheduleNewDay() {
            if (!$window.setTimeout) { return; }
            if (dayTimer) { $window.clearTimeout(dayTimer); }
            var now = Date.now() + serverClockOffset + 7 * 3600000;
            dayTimer = $window.setTimeout(function () { $scope.$evalAsync(function () { updateRosaryGuide(); renderGarden(); }); scheduleNewDay(); }, 86400000 - (now % 86400000) + 50);
        }
        vm.isDayLocked = function (day) { return day.date !== studentToday(); };
        vm.toggleFlower = function (item, day) {
            var key = item.itemKey + ':' + day.date, campaignId = vm.campaign.id;
            if (!vm.studentMode || vm.sheetLoading || vm.isDayLocked(day)) { vm.checks[key] = vm.savedChecks[key] === true; return; }
            var pendingKey = campaignId + ':' + key, checks = vm.checks, pending = vm.pendingChecks;
            if (pending[pendingKey]) { return; }
            var completed = checks[key] === true, previouslySaved = vm.savedChecks[key] === true;
            var token = studentToken, request = studentRequest;
            // Capture before the pending checkbox is disabled and the browser moves focus away.
            var returnFocus = $window.document && $window.document.activeElement;
            function current() { return request === studentRequest && token === studentToken && vm.checks === checks && vm.campaign && vm.campaign.id === campaignId; }
            pending[pendingKey] = true; vm.checkError = ''; vm.saveNotice = 'Đang lưu…';
            return service.checkFlower(token, campaignId, day.date, item.itemKey, completed).then(function (response) {
                checks[key] = response.data.completed === true;
                if (current()) {
                    vm.savedChecks[key] = checks[key]; vm.saveNotice = 'Đã lưu hoa thiêng.';
                    if (completed && checks[key] && !previouslySaved) { showFlowerPrayer(returnFocus); }
                }
            }, function (error) {
                checks[key] = previouslySaved;
                if (current()) { vm.checkError = errorMessage(error); vm.saveNotice = ''; }
            }).finally(function () { delete pending[pendingKey]; });
        };
        vm.create = function () {
            if (!vm.canManage()) { return; }
            vm.editor = {name: '', theme: '', description: '', startDate: null, endDate: null,
                desktopLeftImageUrl: '', desktopRightImageUrl: '', mobileImageUrl: '', flowerBackgroundOpacity: 20,
                flowerInstructions: 'Mỗi ngày, các em thực hành và ghi lại những việc đã làm vào phiếu hoa thiêng.',
                flowerItems: ['Cầu nguyện', 'Tham dự Thánh lễ', 'Rước lễ', 'Đọc Lời Chúa', 'Hy sinh', 'Làm việc bác ái'].map(function (name) {
                    return {name: name, instructions: ''};
                })};
            initializeCrops();
            vm.editorImageBaseline = imageSnapshot(vm.editor);
            vm.editError = ''; vm.deleteTarget = null;
        };
        vm.edit = function (campaign) {
            if (!vm.canManage() || vm.editLoading) { return; }
            vm.editLoading = true;
            return service.get(campaign.id).then(function (response) {
                if (!vm.canManage()) { return; }
                vm.editor = angular.copy(response.data);
                vm.editor.flowerInstructions = vm.flowerInstructions(vm.editor);
                vm.editor.flowerBackgroundOpacity = vm.editor.flowerBackgroundOpacity == null ? 20 : vm.editor.flowerBackgroundOpacity;
                initializeCrops();
                vm.editorImageBaseline = imageSnapshot(vm.editor);
                vm.editor.startDate = date(vm.editor.startDate);
                vm.editor.endDate = date(vm.editor.endDate);
                vm.editError = ''; vm.deleteTarget = null;
            }, function (error) { toastr.error(errorMessage(error)); }).finally(function () { vm.editLoading = false; });
        };
        vm.cancelEdit = function () { if (vm.hasUnsavedImages() && !$window.confirm('Bạn chưa lưu link ảnh, độ mờ hoặc vùng cắt ảnh. Hủy các thay đổi này?')) { return; } if (!vm.saving) { vm.editor = null; vm.editError = ''; } };
        vm.addItem = function () {
            if (vm.canManage() && vm.editor && vm.editor.flowerItems.length < 30) {
                vm.editor.flowerItems.push({name: '', instructions: ''});
            }
        };
        vm.moveItem = function (index, direction) {
            if (!vm.canManage() || !vm.editor || vm.saving || !Number.isInteger(index) || (direction !== -1 && direction !== 1)) { return; }
            var items = vm.editor.flowerItems, target = index + direction;
            if (index < 0 || index >= items.length || target < 0 || target >= items.length) { return; }
            var item = items.splice(index, 1)[0];
            items.splice(target, 0, item);
        };
        vm.removeItem = function (index) {
            if (vm.canManage() && vm.editor && vm.editor.flowerItems.length > 1) { vm.editor.flowerItems.splice(index, 1); }
        };
        vm.save = function (form) {
            if (!vm.canManage() || vm.saving || !vm.editor) { return; }
            for (var i = 0; i < imageFields.length; i++) {
                var image = vm.editor[imageFields[i]];
                if (image && image.trim() && (image.trim().length > 2048 || !validImageUrl(image.trim()))) {
                    vm.editError = 'Link ảnh cần là địa chỉ http:// hoặc https:// hợp lệ, tối đa 2048 ký tự.'; return;
                }
            }
            if (!Number.isInteger(Number(vm.editor.flowerBackgroundOpacity)) || vm.editor.flowerBackgroundOpacity < 0 || vm.editor.flowerBackgroundOpacity > 100) { vm.editError = 'Độ hiển thị ảnh nền phải từ 0 đến 100%.'; return; }
            for (var j = 0; j < imageFields.length; j++) {
                var crop = vm.editor.imageCrops[imageFields[j]];
                if (!crop || !Number.isInteger(Number(crop.zoom)) || crop.zoom < 50 || crop.zoom > 300 ||
                    !Number.isInteger(Number(crop.x)) || crop.x < -100 || crop.x > 100 ||
                    !Number.isInteger(Number(crop.y)) || crop.y < -100 || crop.y > 100 ||
                    crop.zoom == null || crop.x == null || crop.y == null) {
                    vm.editError = 'Zoom ảnh phải từ 50 đến 300%; vị trí ảnh phải từ -100 đến 100%. Vui lòng nhập số nguyên.';
                    return;
                }
            }
            if (form.$invalid) { vm.editError = 'Vui lòng kiểm tra tên chiến dịch, ngày, các việc hoa thiêng và link ảnh.'; return; }
            if (vm.editor.endDate < vm.editor.startDate) { vm.editError = 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'; return; }
            vm.saving = true; vm.editError = '';
            var payload = angular.copy(vm.editor);
            payload.flowerBackgroundOpacity = Number(vm.editor.flowerBackgroundOpacity);
            payload.imageCrops = {}; imageFields.forEach(function (field) { payload.imageCrops[field] = vm.imageCrop(vm.editor, field); });
            payload.startDate = iso(payload.startDate);
            payload.endDate = iso(payload.endDate);
            imageFields.forEach(function (field) { payload[field] = vm.imageUrl(payload[field]) || null; });
            return service.save(payload).then(function (response) {
                vm.editor = null;
                toastr.success('Đã lưu chiến dịch và hoa thiêng.');
                if ($stateParams.id || $stateParams.campaignCode) { return loadDetail(); }
                return $state.go('campaign_detail_shared', {campaignCode: response.data.shareCode});
            }, function (error) { vm.editError = errorMessage(error); }).finally(function () { vm.saving = false; });
        };
        vm.askDelete = function (campaign) {
            if (vm.canManage() && !vm.deleting) { vm.deleteTarget = campaign; vm.deleteError = ''; }
        };
        vm.deleteCampaign = function () {
            if (!vm.canManage() || vm.deleting || !vm.deleteTarget) { return; }
            vm.deleting = true;
            return service.remove(vm.deleteTarget.id).then(function () {
                vm.deleteTarget = null;
                toastr.success('Đã xóa chiến dịch.');
                if ($stateParams.id || $stateParams.campaignCode) { return $state.go('campaigns'); }
                return vm.load(vm.campaigns.length === 1 && vm.page > 1 ? vm.page - 1 : vm.page);
            }, function (error) { vm.deleteError = errorMessage(error); }).finally(function () { vm.deleting = false; });
        };
        vm.print = function () { if (vm.canPrint() && vm.campaign && !vm.isExpired(vm.campaign)) { $window.print(); } };
        $scope.$watch(vm.canManage, function (allowed) {
            if (!allowed) { vm.editor = null; vm.deleteTarget = null; }
        });
        scheduleNewDay();
        if (hasTarget) { loadTargetCampaign(); }
        else if (vm.studentMode) { loadStudentLanding(); }
        else if ($stateParams.id || $stateParams.campaignCode) { loadDetail(); } else { vm.load(1); }
        if ($scope.$on) { $scope.$on('$destroy', function () { vm.closeFlowerPrayer(); ++studentRequest; ++gardenRequest; ++gardenExportRequest; if (dayTimer) { $window.clearTimeout(dayTimer); } if ($window.removeEventListener) { $window.removeEventListener('beforeunload', beforeUnload); } }); }
    }
    angular.module('Hrm.Campaign').directive('campaignEditor', ['$window', '$timeout', function ($window, $timeout) {
        return {restrict: 'A', link: function (scope, element) {
            var editor = element[0], page = editor.closest('.campaign-page');
            var initial = $timeout(function () {
                if (page && /auto|scroll/.test($window.getComputedStyle(page).overflowY)) {
                    page.scrollTo({top: Math.max(0, editor.offsetTop - 15), behavior: 'auto'});
                } else { editor.scrollIntoView({block: 'start', behavior: 'auto'}); }
            }, 0);
            scope.$on('$destroy', function () { $timeout.cancel(initial); });
        }};
    }]);
    angular.module('Hrm.Campaign').directive('campaignImageCrop', ['$window', function ($window) {
        return {restrict: 'A', link: function (scope, element) {
            var frame = element[0], drag;
            function down(event) {
                if (!scope.vm.editor || scope.vm.saving || !scope.vm.canManage() || !scope.vm.imageUrl(scope.vm.editor[scope.vm.cropField]) || event.button !== 0) { return; }
                var rect = frame.getBoundingClientRect(), layout = frame.closest('.campaign-layout');
                drag = {pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, crop: scope.vm.editor.imageCrops[scope.vm.cropField],
                    rotated: layout && $window.getComputedStyle(layout).transform !== 'none', width: rect.width, height: rect.height};
                drag.x = Number(drag.crop.x); drag.y = Number(drag.crop.y);
                frame.setPointerCapture(event.pointerId); event.preventDefault();
            }
            function move(event) {
                if (!drag || drag.pointer !== event.pointerId || scope.vm.saving) { return; }
                var dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY;
                var current = drag, x = drag.rotated ? -dy / drag.height : dx / drag.width, y = drag.rotated ? dx / drag.width : dy / drag.height;
                scope.$evalAsync(function () { current.crop.x = Math.max(-100, Math.min(100, Math.round(current.x + x * 100))); current.crop.y = Math.max(-100, Math.min(100, Math.round(current.y + y * 100))); });
            }
            function end() { drag = null; }
            frame.addEventListener('pointerdown', down); frame.addEventListener('pointermove', move);
            frame.addEventListener('pointerup', end); frame.addEventListener('pointercancel', end); frame.addEventListener('lostpointercapture', end);
            scope.$on('$destroy', function () { drag = null; frame.removeEventListener('pointerdown', down); frame.removeEventListener('pointermove', move); frame.removeEventListener('pointerup', end); frame.removeEventListener('pointercancel', end); frame.removeEventListener('lostpointercapture', end); });
        }};
    }]);
    // AngularJS 1.5 treats range inputs as strings; number inputs require numeric models.
    angular.module('Hrm.Campaign').directive('campaignNumberRange', function () {
        return {restrict: 'A', require: 'ngModel', link: function (scope, element, attrs, model) {
            model.$parsers.push(function (value) { return Number(value); });
        }};
    });
    angular.module('Hrm.Campaign').directive('campaignRosaryGuide', ['$timeout', function ($timeout) {
        return {restrict: 'A', link: function (scope, element) {
            var heading = element[0].querySelector('h1');
            document.documentElement.classList.add('campaign-rosary-open');
            document.body.classList.add('campaign-rosary-open');
            var focusTimer;
            var stopWatching = scope.$watch('vm.rosaryParticipationOpen + ":" + vm.rosaryInstructionsOpen', function () {
                if (focusTimer) { $timeout.cancel(focusTimer); }
                focusTimer = $timeout(function () {
                    element[0].scrollTop = 0;
                    if (heading) { heading.focus({preventScroll: true}); }
                }, 0, false);
            });
            function keyboard(event) {
                if (event.key !== 'Tab') { return; }
                var buttons = element[0].querySelectorAll('button'), first = buttons[0], last = buttons[buttons.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === heading)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
            element.on('keydown', keyboard);
            scope.$on('$destroy', function () {
                $timeout.cancel(focusTimer); stopWatching(); element.off('keydown', keyboard);
                document.documentElement.classList.remove('campaign-rosary-open');
                document.body.classList.remove('campaign-rosary-open');
            });
        }};
    }]);
    angular.module('Hrm.Campaign').directive('campaignGardenFocus', ['$timeout', function ($timeout) {
        return {restrict: 'A', link: function (scope, element) {
            document.documentElement.classList.add('campaign-garden-open'); document.body.classList.add('campaign-garden-open');
            var timer, returnFocus;
            var unwatch = scope.$watch(function () { return (scope.vm.gardenDay && scope.vm.gardenDay.date || '') + ':' + scope.vm.gardenResetConfirm; }, function () {
                $timeout.cancel(timer);
                timer = $timeout(function () {
                    var panel = element[0].querySelector('.campaign-garden-picker'), heading = (panel || element[0]).querySelector('h2, h1');
                    if (heading) { heading.focus({preventScroll: true}); }
                }, 0, false);
            });
            function keyboard(event) {
                var panel = element[0].querySelector('.campaign-garden-picker') || element[0];
                if (event.key === 'Escape' && !scope.vm.gardenBusy) {
                    event.preventDefault(); scope.$evalAsync(function () {
                        if (scope.vm.gardenResetConfirm) { scope.vm.gardenResetConfirm = false; }
                        else if (scope.vm.gardenDay) { scope.vm.gardenDay = null; }
                        else { scope.vm.closeGarden(); }
                    }); return;
                }
                if (event.key !== 'Tab') { return; }
                var nodes = Array.prototype.filter.call(panel.querySelectorAll('button:not(:disabled), [tabindex="0"]'), function (node) { return node.getClientRects().length > 0; });
                var first = nodes[0], last = nodes[nodes.length - 1], active = document.activeElement;
                if (!first) { event.preventDefault(); return; }
                if (event.shiftKey && (active === first || nodes.indexOf(active) < 0)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (active === last || !panel.contains(active))) { event.preventDefault(); first.focus(); }
            }
            element.on('keydown', keyboard);
            scope.$on('$destroy', function () {
                unwatch(); $timeout.cancel(timer); element.off('keydown', keyboard);
                document.documentElement.classList.remove('campaign-garden-open'); document.body.classList.remove('campaign-garden-open');
                returnFocus = document.querySelector('[data-rosary-reopen]');
                if (returnFocus) { $timeout(function () { returnFocus.focus({preventScroll: true}); }, 0, false); }
            });
        }};
    }]);
    angular.module('Hrm.Campaign').directive('campaignGardenHints', ['$timeout', '$window', function ($timeout, $window) {
        return {restrict: 'A', link: function (scope, element) {
            var document = $window.document, timer, lastDate = '', destroyed = false;
            function readyFlowers() {
                return (scope.vm.garden && scope.vm.garden.flowers || []).filter(function (flower) { return flower.available > 0 && !flower.future; });
            }
            function paused() { return destroyed || document.hidden || scope.vm.gardenLoading || scope.vm.gardenBusy || scope.vm.gardenDay || scope.vm.gardenResetConfirm; }
            function stop() { $timeout.cancel(timer); timer = null; scope.vm.gardenHintDate = null; }
            function show() {
                if (paused() || !readyFlowers().length) { stop(); return; }
                var bounds = element[0].getBoundingClientRect();
                var visible = Array.prototype.filter.call(element[0].querySelectorAll('.campaign-garden-flower-ready'), function (node) {
                    var box = node.getBoundingClientRect();
                    return box.width > 0 && box.top >= bounds.top + 75 && box.bottom <= Math.min(bounds.bottom, $window.innerHeight) - 8;
                });
                if (!visible.length) { timer = $timeout(show, 12000); return; }
                var next = visible.filter(function (node) { return node.getAttribute('data-flower-date') > lastDate; })[0] || visible[0];
                scope.vm.gardenHintDate = lastDate = next.getAttribute('data-flower-date');
                timer = $timeout(function () {
                    scope.vm.gardenHintDate = null;
                    timer = $timeout(show, 12000);
                }, 7000);
            }
            function restart() {
                if (destroyed) { return; }
                stop(); scope.vm.gardenHintsPaused = document.hidden;
                if (!paused() && readyFlowers().length) { timer = $timeout(show, 1800); }
            }
            var unwatch = scope.$watch(function () {
                return [scope.vm.gardenLoading, scope.vm.gardenBusy, !!scope.vm.gardenDay, scope.vm.gardenResetConfirm].join(':') + ':' +
                    readyFlowers().map(function (flower) { return flower.date + ':' + flower.available; }).join('|');
            }, restart);
            function visibilityChanged() { scope.$evalAsync(restart); }
            document.addEventListener('visibilitychange', visibilityChanged);
            scope.$on('$destroy', function () {
                destroyed = true; unwatch(); stop(); document.removeEventListener('visibilitychange', visibilityChanged); scope.vm.gardenHintsPaused = false;
            });
        }};
    }]);
    angular.module('Hrm.Campaign').directive('campaignPrayerDialog', ['$window', '$timeout', function ($window, $timeout) {
        return {restrict: 'A', link: function (scope, element) {
            var document = $window.document, previous = scope.vm.flowerPrayerTrigger || document.activeElement;
            var image = element[0].querySelector('.campaign-prayer-image'), card = element[0].querySelector('.campaign-prayer-card');
            // Image loading must never prevent reading the prayer or continuing with the saved sheet.
            function imageLoaded() { card.classList.remove('campaign-prayer-image-unavailable'); }
            function imageFailed() { card.classList.add('campaign-prayer-image-unavailable'); }
            if (image) { image.addEventListener('load', imageLoaded); image.addEventListener('error', imageFailed); }
            var timer = $timeout(function () {
                var heading = element[0].querySelector('h2'); if (heading) { heading.focus({preventScroll: true}); }
                if (image && image.getAttribute('src') && image.complete && !image.naturalWidth) { imageFailed(); }
            }, 0, false);
            function keyboard(event) {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); scope.$evalAsync(scope.vm.closeFlowerPrayer); }
                if (event.key === 'Tab') {
                    var button = element[0].querySelector('button');
                    if (button) { event.preventDefault(); button.focus(); }
                }
            }
            element.on('keydown', keyboard);
            scope.$on('$destroy', function () {
                $timeout.cancel(timer); element.off('keydown', keyboard);
                if (image) { image.removeEventListener('load', imageLoaded); image.removeEventListener('error', imageFailed); }
                if (previous && previous.isConnected && !previous.disabled) { previous.focus({preventScroll: true}); }
            });
        }};
    }]);
    angular.module('Hrm.Campaign').directive('campaignViewport', ['$window', function ($window) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var document = $window.document, target = element[0];
                var meta = document.querySelector('meta[name="viewport"]');
                var previousViewport = meta && meta.getAttribute('content');
                var layout = target.querySelector('.campaign-layout');
                var campaignViewport = 'width=device-width, initial-scale=1, minimum-scale=0.5, user-scalable=yes';
                if (meta) { meta.setAttribute('content', campaignViewport); }
                scope.vm.viewZoom = 1;
                function applyZoom() {
                    scope.vm.viewStyle = scope.vm.viewZoom === 1 ? {} : {zoom: scope.vm.viewZoom, width: layout.clientWidth + 'px', maxWidth: 'none'};
                    scope.$evalAsync();
                }
                scope.vm.changeZoom = function (delta) {
                    scope.vm.viewZoom = Math.max(0.5, Math.min(3, scope.vm.viewZoom + delta));
                    applyZoom();
                };
                scope.$watch('vm.rosaryGuideOpen', function (open, previous) {
                    if (!open && previous) {
                        $window.setTimeout(function () {
                            var sheet = target.querySelector('.campaign-detail .campaign-flower');
                            var button = target.querySelector('[data-rosary-reopen]');
                            if (sheet) { sheet.scrollIntoView({block: 'start'}); }
                            if (button) { button.focus({preventScroll: true}); }
                        }, 0);
                    }
                });
                $window.addEventListener('resize', applyZoom);
                scope.vm.fullscreenSupported = !!((document.fullscreenEnabled && target.requestFullscreen) ||
                    (document.webkitFullscreenEnabled && target.webkitRequestFullscreen));
                function fullscreenChanged() {
                    scope.vm.fullscreen = (document.fullscreenElement || document.webkitFullscreenElement) === target;
                    applyZoom();
                }
                function failure() {
                    scope.vm.viewError = 'Trình duyệt chưa mở được chế độ toàn màn hình. Bạn vẫn có thể phóng to hoặc thu nhỏ trang bằng hai ngón tay.';
                    scope.$evalAsync();
                }
                scope.vm.toggleFullscreen = function () {
                    scope.vm.viewError = '';
                    try {
                        var result;
                        if ((document.fullscreenElement || document.webkitFullscreenElement) === target) {
                            result = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
                        } else {
                            result = target.requestFullscreen ? target.requestFullscreen({navigationUI: 'hide'}) : target.webkitRequestFullscreen();
                        }
                        if (result && result.catch) { result.catch(failure); }
                    } catch (error) { failure(); }
                };
                document.addEventListener('fullscreenchange', fullscreenChanged);
                document.addEventListener('webkitfullscreenchange', fullscreenChanged);
                fullscreenChanged();
                scope.$on('$destroy', function () {
                    document.removeEventListener('fullscreenchange', fullscreenChanged);
                    document.removeEventListener('webkitfullscreenchange', fullscreenChanged);
                    $window.removeEventListener('resize', applyZoom);
                    if (meta && meta.getAttribute('content') === campaignViewport) {
                        if (previousViewport === null) { meta.removeAttribute('content'); }
                        else { meta.setAttribute('content', previousViewport); }
                    }
                });
            }
        };
    }]);
})();
