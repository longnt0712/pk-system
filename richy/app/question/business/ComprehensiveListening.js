(function () {
    'use strict';

    angular.module('Hrm.Question').factory('ComprehensiveListening', ['$window', 'ComprehensiveVideo', function ($window, video) {
        function parseUrl(value) {
            var raw = String(value || '').trim(), url;
            try { url = new $window.URL(raw); } catch (invalid) { return null; }
            if (raw.length > 2048 || !/^https?:$/.test(url.protocol) || url.username || url.password) { return null; }
            var media = video.parseUrl(raw), host = url.hostname.toLowerCase();
            if (media && media.provider === 'youtube') {
                var time = url.searchParams.get('t') || url.searchParams.get('start') || '0';
                var match = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
                media.start = /^\d+$/.test(time) ? Number(time) : (match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0);
                return media;
            }
            if (/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|tiktok\.com)$/.test(host)) { return null; }
            return {provider: 'audio', url: raw, start: 0};
        }

        function settings(pack) {
            // Package description stores authoring settings; the transcript and
            // media URL use the same persisted fields as existing Daily Listening.
            try { var value = JSON.parse(pack.description || '{}'); return value && typeof value === 'object' ? value : {}; } catch (invalid) { return {}; }
        }

        function fingerprint(text) {
            var hash = 2166136261;
            for (var i = 0; i < text.length; i++) { hash = Math.imul(hash ^ text.charCodeAt(i), 16777619); }
            return String(hash >>> 0);
        }

        function gapRate(pack) {
            var value = Number(pack._listeningGapRate == null ? settings(pack).gapRate : pack._listeningGapRate);
            return isFinite(value) && value >= 30 && value <= 100 && value % 5 === 0 ? value : 50;
        }

        function isCurrent(pack) {
            var saved = settings(pack);
            return saved.source === fingerprint(String(pack.motherTongue || '')) && saved.generatedRate === gapRate(pack);
        }

        function configure(pack) {
            var saved = settings(pack);
            saved.gapRate = Number(pack._listeningGapRate);
            pack.description = JSON.stringify(saved);
        }

        function escapeHtml(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
        }

        function generate(transcript, percent, random) {
            var text = String(transcript || '').replace(/\r\n?/g, '\n');
            percent = Number(percent);
            if (!text.trim()) { throw new Error('Hãy nhập transcript tiếng Anh.'); }
            if (!isFinite(percent) || percent < 30 || percent > 100 || percent % 5 !== 0) {
                throw new Error('Tỷ lệ ô trống phải từ 30 đến 100%, theo bước 5%.');
            }
            random = random || Math.random;
            var candidates = [], selected = [], tokens = text.split(/(\s+)/);
            var tokenPattern = /^([^A-Za-z0-9À-ỹ]*)((?:\d+(?:[.,:\-]\d+)*)|(?:[A-Za-zÀ-ỹ][A-Za-z0-9À-ỹ'’\-]*))([^A-Za-z0-9À-ỹ]*)$/;
            var dates = /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?$|^(?:january|february|march|april|may|june|july|august|september|october|november|december)$/i;
            tokens.forEach(function (token, index) {
                var word = token.match(tokenPattern);
                if (!word) { return; }
                var answer = word[2], singleUpper = /^[A-Z]$/.test(answer);
                // Keep the old Daily Listening rule: proper names/words starting
                // with an uppercase letter stay visible, except single letters.
                if (!singleUpper && answer.charAt(0) !== answer.charAt(0).toLowerCase()) { return; }
                if (!singleUpper && answer.length < 2 && !/^\d$/.test(answer)) { return; }
                candidates.push(index);
                if (singleUpper || /^\d+(?:[.,:\-]\d+)*$/.test(answer) || dates.test(answer) || random() < percent / 100) {
                    selected.push(index);
                }
            });
            if (!candidates.length) { throw new Error('Transcript chưa có từ phù hợp để tạo ô trống.'); }
            if (!selected.length) { selected.push(candidates[Math.floor(random() * candidates.length) % candidates.length]); }
            var answers = [], html = '', visible = '';
            function flush() {
                if (visible) { html += '<span ng-non-bindable>' + escapeHtml(visible).replace(/\n/g, '<br>') + '</span>'; visible = ''; }
            }
            tokens.forEach(function (token, index) {
                if (selected.indexOf(index) < 0) { visible += token; return; }
                var word = token.match(tokenPattern);
                visible += word[1]; flush();
                html += '}{SPACE}{'; visible += word[3]; answers.push(word[2]);
            });
            flush();
            return {html: '<p>' + html + '</p>', answers: answers,
                description: JSON.stringify({gapRate: percent, generatedRate: percent, source: fingerprint(String(transcript || ''))})};
        }

        return {parseUrl: parseUrl, generate: generate, gapRate: gapRate, isCurrent: isCurrent, configure: configure};
    }]);

    angular.module('Hrm.Question').directive('comprehensiveListeningPlayer', ['$window', '$interval', '$timeout', 'ComprehensiveListening', 'ComprehensiveVideo',
        function ($window, $interval, $timeout, listening, video) {
            return {
                restrict: 'E',
                scope: {audioLink: '=', position: '=?'},
                template: '<div class="comprehensive-listening-player"><div class="comprehensive-listening-mount"></div>' +
                    '<div class="comprehensive-listening-controls" ng-if="ready">' +
                    '<button type="button" class="btn btn-default btn-sm" ng-click="seek(-3)" aria-label="Lùi 3 giây"><i class="fa fa-backward"></i> 3s</button>' +
                    '<button type="button" class="btn btn-primary btn-sm" ng-click="toggle()">{{playing ? "Tạm dừng" : "Phát audio"}}</button>' +
                    '<button type="button" class="btn btn-default btn-sm" ng-click="seek(3)" aria-label="Tiến 3 giây">3s <i class="fa fa-forward"></i></button>' +
                    '<label>Tốc độ <select ng-model="controls.speed" ng-change="setSpeed()" aria-label="Tốc độ audio"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>' +
                    '</div><p class="comprehensive-listening-error" ng-if="error" role="alert">{{error}}</p></div>',
                link: function (scope, element) {
                    var mount = element[0].querySelector('.comprehensive-listening-mount'), player, audio, timer, timeout, generation = 0, cleanups = [];
                    scope.controls = {speed: '1'};
                    function digest(fn) { if (!scope.$$destroyed) { scope.$evalAsync(fn); } }
                    function cleanup() {
                        generation++; $interval.cancel(timer); $timeout.cancel(timeout);
                        cleanups.forEach(function (fn) { fn(); }); cleanups = [];
                        if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
                        if (player && player.destroy) { player.destroy(); }
                        audio = player = null; scope.ready = scope.playing = false;
                        while (mount.firstChild) { mount.removeChild(mount.firstChild); }
                    }
                    function currentTime() { return audio ? audio.currentTime : (player && player.getCurrentTime ? player.getCurrentTime() : 0); }
                    function play() {
                        if (audio) { var result = audio.play(); if (result && result.catch) { result.catch(function () { digest(function () { scope.playing = false; }); }); } }
                        else if (player) { player.playVideo(); }
                    }
                    scope.toggle = function () {
                        if (scope.playing) { if (audio) { audio.pause(); } else if (player) { player.pauseVideo(); } }
                        else { play(); }
                    };
                    scope.seek = function (delta) {
                        var seconds = Math.max(0, currentTime() + delta), duration = audio ? audio.duration : (player && player.getDuration ? player.getDuration() : 0);
                        if (isFinite(duration) && duration > 0) { seconds = Math.min(seconds, duration); }
                        if (audio) { audio.currentTime = seconds; } else if (player) { player.seekTo(seconds, true); }
                        scope.position = seconds;
                    };
                    scope.setSpeed = function () {
                        if (audio) { audio.playbackRate = Number(scope.controls.speed); }
                        else if (player && player.setPlaybackRate) { player.setPlaybackRate(Number(scope.controls.speed)); }
                    };
                    scope.$watch('audioLink', function (link, previous) {
                        cleanup(); scope.error = '';
                        if (link !== previous) { scope.position = 0; }
                        var source = listening.parseUrl(link), version = generation;
                        if (!source) { if (link) { scope.error = 'Nhập link audio http/https hoặc YouTube hợp lệ.'; } return; }
                        function failure() { if (version === generation) { digest(function () { scope.error = 'Không phát được audio. Kiểm tra link và quyền truy cập.'; }); } }
                        function ready() {
                            if (version !== generation) { return; }
                            $timeout.cancel(timeout); digest(function () { scope.ready = true; scope.error = ''; });
                        }
                        var start = Math.max(0, Number(scope.position) || source.start || 0);
                        timeout = $timeout(failure, 20000);
                        if (source.provider === 'youtube') {
                            var target = $window.document.createElement('div'); mount.appendChild(target);
                            video.youtubeReady().then(function (YT) {
                                if (version !== generation) { return; }
                                player = new YT.Player(target, {width: '100%', height: '180', videoId: source.id,
                                    playerVars: {playsinline: 1, rel: 0, start: Math.floor(start), origin: $window.location.origin},
                                    events: {onReady: function () {
                                        if (version !== generation) { return; }
                                        ready(); scope.setSpeed();
                                        timer = $interval(function () { scope.position = currentTime(); }, 500);
                                    }, onStateChange: function (event) {
                                        if (version === generation) { digest(function () { scope.playing = event.data === 1; }); }
                                    }, onError: failure}});
                            }, failure);
                        } else {
                            audio = $window.document.createElement('audio'); audio.controls = true; audio.preload = 'metadata';
                            audio.setAttribute('aria-label', 'Audio Daily Listening'); mount.appendChild(audio);
                            function on(name, fn) { audio.addEventListener(name, fn); var target = audio; cleanups.push(function () { target.removeEventListener(name, fn); }); }
                            on('loadedmetadata', function () { audio.currentTime = isFinite(audio.duration) ? Math.min(start, audio.duration) : start; ready(); scope.setSpeed(); });
                            on('timeupdate', function () { digest(function () { scope.position = currentTime(); }); });
                            on('play', function () { digest(function () { scope.playing = true; }); });
                            on('pause', function () { digest(function () { scope.playing = false; }); });
                            on('error', failure); audio.src = source.url; audio.load();
                        }
                    });
                    scope.$on('$destroy', cleanup);
                }
            };
        }]);
}());
