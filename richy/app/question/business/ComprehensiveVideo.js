(function () {
    'use strict';

    angular.module('Hrm.Question').factory('ComprehensiveVideo', ['$window', '$q', function ($window, $q) {
        var youtubePromise;

        function parseUrl(value) {
            var raw = String(value || '').trim(), url;
            if (!raw || raw.length > 2048) { return null; }
            try { url = new $window.URL(raw); } catch (invalid) { return null; }
            if (!/^https?:$/.test(url.protocol) || url.username || url.password) { return null; }
            var host = url.hostname.toLowerCase(), id, match;
            if (/^(?:(?:www|m|music)\.)?youtube\.com$/.test(host) || /^(?:www\.)?youtube-nocookie\.com$/.test(host)) {
                match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/);
                id = match ? match[1] : (url.pathname === '/watch' ? url.searchParams.get('v') : null);
            } else if (/^(?:www\.)?youtu\.be$/.test(host)) {
                id = url.pathname.replace(/^\//, '').replace(/\/$/, '');
            }
            if (id && /^[\w-]{11}$/.test(id)) { return {provider: 'youtube', id: id, url: raw}; }
            if (/^(?:(?:www|m)\.)?tiktok\.com$/.test(host)) {
                match = url.pathname.match(/^\/(?:@[^/]+\/video|player\/v1|embed\/v2)\/(\d{10,25})\/?$/);
                if (match) { return {provider: 'tiktok', id: match[1], url: raw}; }
            }
            if (/\.(mp4|webm|ogg|ogv)$/i.test(url.pathname)) { return {provider: 'file', url: raw}; }
            return null;
        }

        function parseTime(value) {
            var parts = String(value == null ? '' : value).trim().split(':');
            if (parts.length < 2 || parts.length > 3 || !/^\d{1,3}$/.test(parts[0]) ||
                    !parts.slice(1).every(function (part) { return /^\d{2}$/.test(part) && Number(part) < 60; })) { return null; }
            var seconds = parts.reduce(function (total, part) { return total * 60 + Number(part); }, 0);
            return seconds <= 359999 ? seconds : null;
        }

        function formatTime(value) {
            var seconds = Math.max(0, Math.floor(Number(value) || 0));
            function pad(number) { return ('0' + number).slice(-2); }
            return seconds >= 3600 ? Math.floor(seconds / 3600) + ':' + pad(Math.floor(seconds / 60) % 60) + ':' + pad(seconds % 60)
                : pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60);
        }

        // Each single-choice question has its own cue. Other formats share a
        // prompt/answer bank and therefore reveal the complete package together.
        function entries(packages) {
            var result = [];
            (packages || []).forEach(function (pack) {
                var individual = Number(pack.type) === 1;
                (individual ? (pack.subQuestions || []) : [pack]).forEach(function (item) {
                    var seconds = item.videoTimeSeconds;
                    if (seconds == null) { return; }
                    result.push({item: item, pack: pack, seconds: Number(seconds),
                        questions: individual ? [item] : (pack.subQuestions || []), revealed: false});
                });
            });
            return result.sort(function (a, b) { return a.seconds - b.seconds; });
        }

        function timeline(packages) {
            var cues = entries(packages);
            return {
                cues: cues,
                active: [],
                currentSeconds: 0,
                advance: function (seconds) {
                    if (!isFinite(seconds) || seconds < 0) { return []; }
                    this.currentSeconds = seconds;
                    if (this.active.length) { return []; }
                    var next = this.next();
                    if (!next || seconds < next.seconds) { return []; }
                    this.active = cues.filter(function (cue) { return !cue.revealed && cue.seconds === next.seconds; });
                    this.active.forEach(function (cue) { cue.revealed = true; });
                    return this.active;
                },
                next: function () { return cues.filter(function (cue) { return !cue.revealed; })[0] || null; },
                visible: function (item) {
                    return !cues.some(function (cue) { return cue.item === item && !cue.revealed; });
                },
                revealAll: function () { cues.forEach(function (cue) { cue.revealed = true; }); this.active = []; }
            };
        }

        function youtubeReady() {
            if ($window.YT && $window.YT.Player) { return $q.when($window.YT); }
            if (!youtubePromise) {
                var deferred = $q.defer(), previous = $window.onYouTubeIframeAPIReady;
                youtubePromise = deferred.promise;
                $window.onYouTubeIframeAPIReady = function () {
                    try { if (typeof previous === 'function') { previous(); } }
                    finally { deferred.resolve($window.YT); }
                };
                var script = $window.document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.onerror = function () { youtubePromise = null; deferred.reject(); };
                $window.document.head.appendChild(script);
            }
            return youtubePromise;
        }

        return {parseUrl: parseUrl, parseTime: parseTime, formatTime: formatTime,
            entries: entries, timeline: timeline, youtubeReady: youtubeReady};
    }]);

    angular.module('Hrm.Question').directive('comprehensiveVideoPlayer', ['$window', '$interval', '$timeout', 'ComprehensiveVideo',
        function ($window, $interval, $timeout, video) {
            return {
                restrict: 'E',
                scope: {videoLink: '=', videoApi: '=', onVideoProgress: '&', onVideoReady: '&', onVideoState: '&'},
                template: '<div class="comprehensive-video-player"><div class="comprehensive-video-mount"></div>' +
                    '<p class="comprehensive-video-error" ng-if="error" role="alert">{{error}}</p></div>',
                link: function (scope, element) {
                    var mount = element[0].querySelector('.comprehensive-video-mount'), player, frame, timer, timeout, generation = 0;
                    var api = scope.videoApi = {}, cleanups = [];
                    function digest(fn) { scope.$evalAsync(fn); }
                    function error() { digest(function () { scope.error = 'Không phát được video. Kiểm tra link, quyền xem và quyền nhúng của video.'; }); }
                    function progress(seconds, duration) {
                        if (!isFinite(seconds) || !isFinite(duration)) { return; }
                        digest(function () { scope.onVideoProgress({seconds: Number(seconds), duration: Number(duration)}); });
                    }
                    function state(playing) { digest(function () { scope.onVideoState({playing: playing}); }); }
                    function ready() {
                        $timeout.cancel(timeout);
                        digest(function () { scope.error = ''; scope.onVideoReady({api: api}); });
                    }
                    function cleanup() {
                        generation++;
                        $interval.cancel(timer); $timeout.cancel(timeout);
                        cleanups.forEach(function (fn) { fn(); }); cleanups = [];
                        if (player && player.destroy) { player.destroy(); }
                        player = null; frame = null; api.ready = false;
                        api.play = api.pause = api.seek = angular.noop;
                        while (mount.firstChild) { mount.removeChild(mount.firstChild); }
                    }
                    scope.$watch('videoLink', function (link) {
                        cleanup(); scope.error = '';
                        var source = video.parseUrl(link), version = generation;
                        if (!source) {
                            if (link) { scope.error = 'Dùng link YouTube, TikTok đầy đủ (/@.../video/...) hoặc file MP4/WebM/OGG.'; }
                            return;
                        }
                        timeout = $timeout(error, 20000);
                        if (source.provider === 'youtube') {
                            var target = $window.document.createElement('div'); mount.appendChild(target);
                            video.youtubeReady().then(function (YT) {
                                if (version !== generation) { return; }
                                player = new YT.Player(target, {
                                    width: '100%', height: '100%', videoId: source.id,
                                    playerVars: {playsinline: 1, rel: 0, origin: $window.location.origin},
                                    events: {
                                        onReady: function (event) {
                                            if (version !== generation) { return; }
                                            var yt = event.target;
                                            api.ready = true; api.play = function () { yt.playVideo(); };
                                            api.pause = function () { yt.pauseVideo(); };
                                            api.seek = function (seconds) { yt.seekTo(seconds, true); };
                                            ready();
                                            timer = $interval(function () { progress(yt.getCurrentTime(), yt.getDuration()); }, 200);
                                        },
                                        onStateChange: function (event) { if (version === generation) { state(event.data === 1); } },
                                        onError: error
                                    }
                                });
                            }, error);
                        } else if (source.provider === 'tiktok') {
                            frame = $window.document.createElement('iframe');
                            frame.src = 'https://www.tiktok.com/player/v1/' + source.id + '?autoplay=0&loop=0&rel=0';
                            frame.title = 'Video TikTok'; frame.allow = 'autoplay; fullscreen'; frame.allowFullscreen = true;
                            mount.appendChild(frame);
                            var tiktokFrame = frame;
                            function command(type, value) {
                                tiktokFrame.contentWindow.postMessage({'x-tiktok-player': true, type: type, value: value}, 'https://www.tiktok.com');
                            }
                            api.play = function () { command('play'); }; api.pause = function () { command('pause'); };
                            api.seek = function (seconds) { command('seekTo', seconds); };
                            function message(event) {
                                if (version !== generation || event.source !== tiktokFrame.contentWindow || event.origin !== 'https://www.tiktok.com') { return; }
                                var data = event.data;
                                if (!data || data['x-tiktok-player'] !== true) { return; }
                                if (data.type === 'onPlayerReady') { api.ready = true; ready(); }
                                if (data.type === 'onCurrentTime' && data.value) { progress(data.value.currentTime, data.value.duration); }
                                if (data.type === 'onStateChange') { state(data.value === 1); }
                                if (data.type === 'onError' || data.type === 'onPlayerError') { error(); }
                            }
                            $window.addEventListener('message', message);
                            cleanups.push(function () { $window.removeEventListener('message', message); });
                        } else {
                            var media = $window.document.createElement('video');
                            media.controls = true; media.preload = 'metadata'; media.playsInline = true; media.src = source.url;
                            mount.appendChild(media);
                            api.play = function () { var promise = media.play(); if (promise && promise.catch) { promise.catch(error); } };
                            api.pause = function () { media.pause(); }; api.seek = function (seconds) { media.currentTime = seconds; };
                            var listeners = {
                                loadedmetadata: function () { api.ready = true; ready(); progress(media.currentTime, media.duration); },
                                timeupdate: function () { progress(media.currentTime, media.duration); },
                                play: function () { state(true); }, pause: function () { state(false); }, error: error
                            };
                            Object.keys(listeners).forEach(function (name) { media.addEventListener(name, listeners[name]); });
                            cleanups.push(function () {
                                media.pause(); Object.keys(listeners).forEach(function (name) { media.removeEventListener(name, listeners[name]); });
                                media.removeAttribute('src'); media.load();
                            });
                        }
                    });
                    scope.$on('$destroy', cleanup);
                }
            };
        }]);
}());
