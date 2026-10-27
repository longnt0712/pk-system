(function () {
    'use strict';
    angular.module('Hrm.Fair').directive('fairScanner', ['$window', function ($window) {
        return {restrict: 'A', link: function (scope) {
            var camera = scope.camera = {running: false, starting: false, error: ''};
            var reader, opening, destroyed = false, stopping = false, accepting = false;
            function digest() { if (!destroyed) { scope.$evalAsync(); } }
            function stopReader() {
                if (!camera.running) { return Promise.resolve(); }
                camera.running = false;
                return Promise.resolve(reader.stop()).catch(function () {}).then(function () { try { reader.clear(); } catch (error) {} });
            }
            camera.stop = function () {
                stopping = true;
                return (opening || Promise.resolve()).catch(function () {}).then(stopReader).then(digest);
            };
            camera.start = function () {
                if (destroyed || camera.starting || camera.running) { return; }
                camera.error = '';
                if ($window.isSecureContext === false) { camera.error = 'Hãy mở đường link bằng HTTPS để bật camera, hoặc nhập mã thẻ bên dưới.'; return; }
                if (!$window.Html5Qrcode) { camera.error = 'Chưa tải được camera. Hãy tải lại trang hoặc nhập mã thẻ.'; return; }
                if (!reader) { reader = new $window.Html5Qrcode('fair-qr-reader'); }
                camera.starting = true; stopping = false;
                try {
                    opening = Promise.resolve(reader.start({facingMode: 'environment'}, {
                        fps: 8, qrbox: function (width, height) { var size = Math.floor(Math.min(width, height) * 0.75); return {width: size, height: size}; }
                    }, function (text) {
                        if (destroyed || accepting || !scope.vm.canScan()) { return; }
                        accepting = true;
                        scope.$evalAsync(function () {
                            Promise.resolve(scope.vm.scan(text)).catch(function () {}).then(function () { accepting = false; digest(); });
                        });
                    }, function () {})).then(function () {
                        camera.running = true;
                        if (destroyed || stopping) { return stopReader(); }
                    }).catch(function (error) {
                        camera.error = /NotAllowed|Permission|denied/i.test(error && error.name || String(error))
                            ? 'Camera chưa được cho phép. Hãy cho phép camera trong trình duyệt hoặc nhập mã thẻ.'
                            : 'Chưa mở được camera. Hãy thử lại hoặc nhập mã thẻ bên dưới.';
                    }).then(function () { camera.starting = false; opening = null; digest(); });
                } catch (error) { camera.starting = false; camera.error = 'Chưa mở được camera. Bạn có thể nhập mã thẻ bên dưới.'; }
                return opening;
            };
            scope.$on('$destroy', function () { destroyed = true; camera.stop(); });
        }};
    }]);
    angular.module('Hrm.Fair').directive('fairQr', ['$window', function ($window) {
        return {restrict: 'A', scope: {fairQr: '<'}, link: function (scope, element) {
            scope.$watch('fairQr', function (code) {
                element.empty();
                if (code && $window.QRCode && $window.QRCode.toCanvas) {
                    var canvas = $window.document.createElement('canvas');
                    canvas.setAttribute('aria-label', 'Mã QR ' + code); canvas.style.display = 'block';
                    element[0].appendChild(canvas);
                    $window.QRCode.toCanvas(canvas, code, {width: 320, margin: 4, errorCorrectionLevel: 'M'}, function (error) {
                        if (error) { element.text('Không tạo được QR. Hãy tải lại trang trước khi in.'); }
                    });
                }
            });
        }};
    }]);
})();
