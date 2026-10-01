(function () {
    'use strict';
    angular.module('Hrm.Campaign').directive('campaignQrScanner', ['$window', function ($window) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var scanner = scope.scanner = {visible: false, starting: false, error: ''};
                var reader, starting, running = false, destroyed = false, stopRequested = false;
                var reading = false, lastText = '', lastAt = 0;
                var fileInput = element[0].querySelector('input[type="file"]');
                function digest() { if (!destroyed) { scope.$evalAsync(); } }
                function clear() { if (reader) { try { reader.clear(); } catch (error) {} } }
                function closeCamera() {
                    if (!running) { return Promise.resolve(); }
                    running = false;
                    return Promise.resolve(reader.stop()).catch(function () {}).then(clear);
                }
                scanner.stop = function () {
                    stopRequested = true; scanner.visible = false; digest();
                    return (starting || Promise.resolve()).catch(function () {}).then(closeCamera);
                };
                function accept(text) {
                    if (destroyed || reading || scope.vm.scanBusy) { return; }
                    var now = Date.now();
                    if (text === lastText && now - lastAt < 2500) { return; }
                    lastText = text; lastAt = now; reading = true; scanner.error = '';
                    scope.$evalAsync(function () {
                        if (destroyed) { reading = false; return; }
                        Promise.resolve(scope.vm.useScannedQr(text)).catch(function () {
                            scanner.error = 'Không mở được phiếu. Em hãy thử quét lại.';
                        }).finally(function () { reading = false; digest(); });
                    });
                }
                function cameraError(error) {
                    var name = error && error.name || String(error || '');
                    if (/NotAllowed|Permission|denied/i.test(name)) { return 'Camera chưa được cho phép. Em hãy cho phép camera trong trình duyệt rồi thử lại, hoặc chọn ảnh mã QR.'; }
                    if (/NotFound|DevicesNotFound/i.test(name)) { return 'Không tìm thấy camera. Em có thể chọn ảnh mã QR trên thẻ.'; }
                    return 'Chưa mở được camera. Em hãy đóng ứng dụng khác đang dùng camera rồi thử lại, hoặc chọn ảnh mã QR.';
                }
                function available() {
                    if (!$window.Html5Qrcode) { scanner.error = 'Chưa tải được bộ quét QR. Em hãy tải lại trang.'; digest(); return false; }
                    if (!reader) { reader = new $window.Html5Qrcode('campaign-qr-reader'); }
                    return true;
                }
                scanner.start = function () {
                    if (destroyed || scanner.starting || running) { return; }
                    if ($window.isSecureContext === false) { scanner.error = 'Em hãy mở link hoa thiêng bằng HTTPS để sử dụng camera, hoặc chọn ảnh mã QR.'; digest(); return; }
                    if (!available()) { return; }
                    scanner.error = ''; scope.vm.scanError = ''; scanner.starting = true; scanner.visible = true; stopRequested = false; digest();
                    try {
                        starting = Promise.resolve(reader.start({facingMode: 'environment'}, {
                            fps: 8, qrbox: function (width, height) { var size = Math.floor(Math.min(width, height) * 0.7); return {width: size, height: size}; }
                        }, accept, function () {})).then(function () {
                            running = true;
                            if (destroyed || stopRequested) { return closeCamera(); }
                        }).catch(function (error) {
                            scanner.visible = false; scanner.error = cameraError(error); clear();
                        }).finally(function () { scanner.starting = false; starting = null; digest(); });
                        return starting;
                    } catch (error) { scanner.starting = false; scanner.visible = false; scanner.error = cameraError(error); clear(); digest(); }
                };
                function readFile() {
                    var file = fileInput.files && fileInput.files[0]; fileInput.value = '';
                    if (!file || destroyed || scanner.starting || scope.vm.scanBusy) { return; }
                    if (!available()) { return; }
                    scanner.error = ''; scope.vm.scanError = ''; scanner.starting = true; digest();
                    scanner.stop().then(function () {
                        if (!destroyed) { return reader.scanFile(file, false).then(accept); }
                    }).catch(function () {
                        scanner.error = 'Chưa đọc được mã QR trong ảnh. Em hãy chọn ảnh rõ nét, có đầy đủ mã QR trên thẻ.';
                    }).finally(function () { scanner.starting = false; clear(); digest(); });
                }
                fileInput.addEventListener('change', readFile);
                scope.$on('$destroy', function () { destroyed = true; fileInput.removeEventListener('change', readFile); scanner.stop(); });
            }
        };
    }]);
})();
