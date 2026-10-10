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

        function fingerprint(text) {
            var hash = 2166136261;
            for (var i = 0; i < text.length; i++) { hash = Math.imul(hash ^ text.charCodeAt(i), 16777619); }
            return String(hash >>> 0);
        }

        var responseMarker = 'DAILY_LISTENING_RESPONSE';
        var tokenPattern = /^([^A-Za-z0-9À-ỹ]*)((?:\d+(?:[.,:\-]\d+)*)|(?:[A-Za-zÀ-ỹ][A-Za-z0-9À-ỹ'’\-]*))([^A-Za-z0-9À-ỹ]*)$/;
        var dates = /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?$|^(?:january|february|march|april|may|june|july|august|september|october|november|december)$/i;

        function normalize(value) {
            return String(value || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[`~!@#$%^&£*()_|+\-=?;:'"“”‘’,.<>\{\}\[\]\\\/]/g, '').replace(/\s+/g, ' ').trim();
        }

        function candidates(transcript) {
            var tokens = String(transcript || '').replace(/\r\n?/g, '\n').match(/\s+|\S+/g) || [];
            var ordinary = [], required = [];
            tokens.forEach(function (token, index) {
                var match = token.match(tokenPattern);
                if (!match) { return; }
                var answer = match[2], singleUpper = /^[A-Z]$/.test(answer);
                if (!singleUpper && answer.charAt(0) !== answer.charAt(0).toLowerCase()) { return; }
                if (!singleUpper && answer.length < 2 && !/^\d$/.test(answer)) { return; }
                (singleUpper || /^\d+(?:[.,:\-]\d+)*$/.test(answer) || dates.test(answer) ? required : ordinary).push(index);
            });
            return {tokens: tokens, ordinary: ordinary, required: required,
                count: required.length + Math.ceil(ordinary.length * 0.35)};
        }

        function start(transcript, saved, random) {
            var source = candidates(transcript), snapshot;
            if (!source.count) { throw new Error('Transcript chưa có từ phù hợp để tạo ô trống.'); }
            try { snapshot = typeof saved === 'string' ? JSON.parse(saved) : saved; } catch (invalid) { snapshot = null; }
            var eligible = source.ordinary.concat(source.required), seen = {};
            var valid = snapshot && snapshot.version === 1 && snapshot.source === fingerprint(String(transcript || '')) &&
                Array.isArray(snapshot.gaps) && snapshot.gaps.length === source.count && snapshot.gaps.every(function (gap) {
                    if (!gap || !Number.isInteger(gap.index) || eligible.indexOf(gap.index) < 0 || seen[gap.index] || typeof gap.value !== 'string') { return false; }
                    seen[gap.index] = true; return true;
                }) && source.required.every(function (index) { return seen[index]; });
            var indexes;
            if (valid) { indexes = snapshot.gaps.map(function (gap) { return gap.index; }); }
            else {
                random = random || Math.random;
                var shuffled = source.ordinary.slice();
                for (var i = shuffled.length - 1; i > 0; i--) {
                    var j = Math.floor(random() * (i + 1)), swap = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = swap;
                }
                indexes = source.required.concat(shuffled.slice(0, source.count - source.required.length));
            }
            indexes.sort(function (a, b) { return a - b; });
            var session = {source: fingerprint(String(transcript || '')), gaps: [], tokens: []}, gapMap = {};
            indexes.forEach(function (index) {
                var word = source.tokens[index].match(tokenPattern), value = '';
                if (valid) { snapshot.gaps.forEach(function (gap) { if (gap.index === index) { value = gap.value; } }); }
                var gap = {index: index, answer: word[2], value: value};
                gapMap[index] = gap; session.gaps.push(gap);
            });
            source.tokens.forEach(function (token, index) {
                var gap = gapMap[index], word = gap && token.match(tokenPattern);
                session.tokens.push(gap ? {before: word[1], gap: gap, after: word[3]} : {text: token});
            });
            update(session);
            return session;
        }

        function update(session) {
            session.correct = 0;
            session.gaps.forEach(function (gap) {
                gap.correct = !!normalize(gap.value) && normalize(gap.value) === normalize(gap.answer);
                if (gap.correct) { session.correct++; }
            });
            session.total = session.gaps.length;
            session.percent = Math.round(session.correct * 10000 / session.total) / 100;
            session.passed = session.correct * 100 >= session.total * 90;
        }

        function serialize(session) {
            return JSON.stringify({version: 1, source: session.source,
                gaps: session.gaps.map(function (gap) { return {index: gap.index, value: gap.value || ''}; })});
        }

        function isRuntime(pack) {
            var answer = ((((pack || {}).subQuestions || [])[0] || {}).questionAnswers || [])[0];
            return Number((pack || {}).type) === 18 && answer && answer.answer && answer.answer.answer === responseMarker;
        }

        return {parseUrl: parseUrl,
            responseMarker: responseMarker, candidates: candidates, start: start, update: update, serialize: serialize, isRuntime: isRuntime};
    }]);

    angular.module('Hrm.Question').directive('comprehensiveListeningExercise', ['ComprehensiveListening', '$timeout', function (listening, $timeout) {
        return {
            restrict: 'E', scope: {pack: '=', onChange: '&'},
            template: '<section class="comprehensive-listening-exercise" id="question-number-{{pack.subQuestions[0].ordinalNumber}}">' +
                '<div class="listening-progress" ng-class="{\'is-complete\': session.passed}" role="status">' +
                '<strong>{{session.correct}}/{{session.total}} ô đúng · {{session.percent}}%</strong> ' +
                '<span>{{session.passed ? "Đã hoàn thành" : "Đạt từ 90% ô đúng để hoàn thành"}}</span></div>' +
                '<p class="comprehensive-listening-error" ng-if="error" role="alert">{{error}}</p>' +
                '<div class="listening-transcript"><span ng-repeat="token in session.tokens track by $index">' +
                '<span ng-if="!token.gap">{{token.text}}</span><span ng-if="token.gap">{{token.before}}' +
                '<input ng-if="!token.gap.correct" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
                'ng-model="token.gap.value" ng-change="changed(token.gap)" class="listening-gap-input" ' +
                'aria-label="Ô điền từ {{token.gap.number}}" data-gap-index="{{token.gap.index}}">' +
                '<span ng-if="token.gap.correct" class="listening-gap-correct">{{token.gap.answer}}</span>{{token.after}}</span></span></div></section>',
            link: function (scope, element) {
                var slot, lastValue, focusTimer;
                function publish() {
                    lastValue = listening.serialize(scope.session); slot.clientAnswer = lastValue;
                    scope.pack._listeningSession = scope.session; scope.onChange();
                }
                scope.$watch(function () {
                    slot = (((scope.pack || {}).subQuestions || [])[0] || {}).questionAnswers;
                    slot = slot && slot[0]; return slot && slot.clientAnswer;
                }, function (value) {
                    if (!slot || (scope.session && value === lastValue)) { return; }
                    try {
                        scope.session = listening.start(scope.pack.motherTongue, value); scope.error = '';
                        scope.session.gaps.forEach(function (gap, index) { gap.number = index + 1; });
                        publish();
                    } catch (invalid) { scope.error = invalid.message; }
                });
                scope.changed = function (gap) {
                    listening.update(scope.session); publish();
                    if (gap.correct) {
                        $timeout.cancel(focusTimer);
                        focusTimer = $timeout(function () {
                            var inputs = element[0].querySelectorAll('input[data-gap-index]');
                            for (var i = 0; i < inputs.length; i++) {
                                if (Number(inputs[i].getAttribute('data-gap-index')) > gap.index) { inputs[i].focus(); break; }
                            }
                        }, 80);
                    }
                };
                scope.$on('$destroy', function () { $timeout.cancel(focusTimer); });
            }
        };
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
