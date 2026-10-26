(function () {
    'use strict';

    angular.module('Hrm').directive('audioPlayerFor', ['$document', '$timeout', function ($document, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var audio = null, destroyed = false, failure = '';
                var button = element[0].querySelector('.idp-listening-play');
                var icon = button.querySelector('i');
                var time = element[0].querySelector('.idp-listening-time');
                var status = element[0].querySelector('.idp-listening-status');
                var events = ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended', 'emptied', 'error', 'loadstart', 'playing'];

                function clock(seconds) {
                    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
                    if (!isFinite(seconds)) { seconds = 0; }
                    return Math.floor(seconds / 60) + ':' + ('0' + (seconds % 60)).slice(-2);
                }
                function enabled() {
                    return !!audio && !audio.error && !!(audio.getAttribute('src') || audio.querySelector('source[src]')) &&
                        (!attrs.audioPlayerEnabled || scope.$eval(attrs.audioPlayerEnabled));
                }
                function refresh(event) {
                    if (destroyed) { return; }
                    if (event && /^(emptied|loadstart|playing)$/.test(event.type)) { failure = ''; }
                    var playing = !!audio && !audio.paused && !audio.ended;
                    var label = playing ? 'Tạm dừng bài nghe' : 'Phát bài nghe';
                    button.disabled = !enabled();
                    button.setAttribute('aria-label', label);
                    button.title = label;
                    icon.className = playing ? 'fa fa-pause' : 'fa fa-play';
                    time.textContent = clock(audio && audio.currentTime) + ' / ' + clock(audio && audio.duration);
                    status.textContent = audio && audio.error ? 'Không tải được audio. Hãy thử tải lại trang.' : failure;
                    status.hidden = !status.textContent;
                }
                function playFailed(error) {
                    if (destroyed || (error && error.name === 'AbortError')) { return; }
                    failure = 'Chưa phát được audio. Chạm nút phát để thử lại.';
                    refresh();
                }
                function toggle() {
                    if (!enabled()) { refresh(); return; }
                    failure = '';
                    if (!audio.paused) { audio.pause(); }
                    else {
                        try {
                            var result = audio.play();
                            if (result && result.catch) { result.catch(playFailed); }
                        } catch (error) { playFailed(error); }
                    }
                    refresh();
                }
                var pending = $timeout(function () {
                    audio = $document[0].getElementById(attrs.audioPlayerFor);
                    if (audio) { events.forEach(function (name) { audio.addEventListener(name, refresh); }); }
                    refresh();
                }, 0, false);
                var unwatch = scope.$watch(attrs.audioPlayerEnabled || 'true', refresh);
                button.addEventListener('click', toggle);
                scope.$on('$destroy', function () {
                    destroyed = true;
                    $timeout.cancel(pending);
                    unwatch();
                    button.removeEventListener('click', toggle);
                    if (audio) { events.forEach(function (name) { audio.removeEventListener(name, refresh); }); }
                });
            }
        };
    }]).directive('audioSeekFor', ['$document', '$timeout', function ($document, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var slider = element[0], audio = null, dragging = false, pointerId = null;
                var events = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'seeked', 'emptied', 'ended'];

                function duration() {
                    var value = audio ? Number(audio.duration) : 0;
                    return isFinite(value) && value > 0 ? value : 0;
                }
                function enabled() {
                    return !!audio && duration() > 0 && (!attrs.audioSeekEnabled || scope.$eval(attrs.audioSeekEnabled));
                }
                function clock(seconds) {
                    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
                    return Math.floor(seconds / 60) + ':' + ('0' + (seconds % 60)).slice(-2);
                }
                function paint(value, length) {
                    slider.style.setProperty('--seek-position', (length ? value / length * 100 : 0) + '%');
                    slider.setAttribute('aria-valuetext', clock(value) + ' / ' + clock(length));
                }
                function refresh(event) {
                    var length = duration();
                    if (event && event.type === 'emptied') { dragging = false; }
                    slider.disabled = !enabled();
                    slider.max = length;
                    if (!dragging || !length) {
                        var value = Math.max(0, Math.min(length, Number(audio && audio.currentTime) || 0));
                        slider.value = value;
                        paint(value, length);
                    }
                }
                function seek() {
                    if (!enabled()) { refresh(); return; }
                    var value = Math.max(0, Math.min(duration(), Number(slider.value) || 0));
                    try { audio.currentTime = value; } catch (ignoreSeek) { dragging = false; refresh(); return; }
                    paint(value, duration());
                }
                function pointerSeek(event) {
                    var pointer = event.originalEvent || event;
                    var rect = slider.getBoundingClientRect();
                    var travel = Math.max(1, rect.width - 24);
                    var ratio = Math.max(0, Math.min(1, (pointer.clientX - rect.left - 12) / travel));
                    slider.value = Math.round(ratio * duration());
                    seek();
                }
                function start(event) {
                    var pointer = event.originalEvent || event;
                    if (dragging || !enabled() || (pointer.pointerType === 'mouse' && pointer.button !== 0)) { return; }
                    dragging = true;
                    pointerId = pointer.pointerId;
                    try { slider.focus({preventScroll:true}); } catch (ignoreFocusOptions) { slider.focus(); }
                    if (slider.setPointerCapture) {
                        try { slider.setPointerCapture(pointerId); } catch (ignoreCapture) {}
                    }
                    pointerSeek(event);
                    event.preventDefault();
                }
                function move(event) {
                    var pointer = event.originalEvent || event;
                    if (!dragging || pointer.pointerId !== pointerId) { return; }
                    pointerSeek(event);
                    event.preventDefault();
                }
                function finish(event) {
                    var pointer = event && (event.originalEvent || event);
                    if (pointer && pointer.pointerId != null && pointerId != null && pointer.pointerId !== pointerId) { return; }
                    dragging = false;
                    pointerId = null;
                    refresh();
                }
                function change() { seek(); finish(); }
                var pending = $timeout(function () {
                    audio = $document[0].getElementById(attrs.audioSeekFor);
                    if (audio) { events.forEach(function (name) { audio.addEventListener(name, refresh); }); }
                    refresh();
                }, 0, false);
                var unwatch = scope.$watch(attrs.audioSeekEnabled || 'true', refresh);
                slider.disabled = true;
                element.on('pointerdown', start);
                element.on('pointermove', move);
                element.on('lostpointercapture', finish);
                element.on('input', seek);
                element.on('change', change);
                element.on('blur', finish);
                $document[0].addEventListener('pointerup', finish);
                $document[0].addEventListener('pointercancel', finish);

                scope.$on('$destroy', function () {
                    $timeout.cancel(pending);
                    unwatch();
                    if (audio) { events.forEach(function (name) { audio.removeEventListener(name, refresh); }); }
                    element.off('pointerdown', start);
                    element.off('pointermove', move);
                    element.off('lostpointercapture', finish);
                    element.off('input', seek);
                    element.off('change', change);
                    element.off('blur', finish);
                    $document[0].removeEventListener('pointerup', finish);
                    $document[0].removeEventListener('pointercancel', finish);
                });
            }
        };
    }]);
})();
