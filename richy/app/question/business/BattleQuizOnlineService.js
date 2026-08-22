(function () {
    'use strict';

    angular.module('Hrm.Question')
        .service('BattleQuizOnlineService', BattleQuizOnlineService);

    BattleQuizOnlineService.$inject = [
        '$http',
        '$q',
        '$document',
        '$rootScope',
        'settings'
    ];

    function BattleQuizOnlineService(
        $http,
        $q,
        $document,
        $rootScope,
        settings
    ) {
        var self = this;
        var apiUrl = settings.api.baseUrl + settings.api.apiV1Url + 'battle-online';

        var socketClient = null;
        var roomSubscription = null;
        var currentRoomCode = null;

        self.createRoom = function (createDto) {
            return $http.post(apiUrl + '/rooms', createDto || {})
                .then(function (response) { return response.data; });
        };

        self.joinRoom = function (roomCode) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/join',
                {}
            ).then(function (response) { return response.data; });
        };

        self.leaveRoom = function (roomCode) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/leave',
                {}
            ).then(function (response) { return response.data; });
        };

        self.getRoom = function (roomCode) {
            return $http.get(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode)
            ).then(function (response) { return response.data; });
        };

        self.setReady = function (roomCode, ready) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/ready',
                {ready: ready === true}
            ).then(function (response) { return response.data; });
        };

        self.updateSettings = function (roomCode, dto) {
            return $http.put(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/settings',
                dto || {}
            ).then(function (response) { return response.data; });
        };

        self.startMatch = function (roomCode) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/start',
                {}
            ).then(function (response) { return response.data; });
        };

        self.restartMatch = function (roomCode) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/restart',
                {}
            ).then(function (response) { return response.data; });
        };

        self.answer = function (
            roomCode,
            questionId,
            answerKey,
            questionSequence
        ) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/answer',
                {
                    questionId: questionId,
                    answerKey: answerKey,
                    questionSequence: questionSequence
                }
            ).then(function (response) { return response.data; });
        };

        self.useSkill = function (roomCode, targetUsername) {
            return $http.post(
                apiUrl + '/rooms/' + normalizeRoomCode(roomCode) + '/skill',
                {
                    targetUsername: targetUsername
                }
            ).then(function (response) { return response.data; });
        };

        self.connectRealtime = connectRealtime;
        self.disconnectRealtime = disconnectRealtime;

        function normalizeRoomCode(value) {
            return String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .trim();
        }

        function ensureRealtimeLibraries() {
            if (window.SockJS && window.Stomp) {
                return $q.when(true);
            }

            return loadScript(
                'https://cdn.jsdelivr.net/npm/sockjs-client@1.1.5/dist/sockjs.min.js',
                'SockJS'
            ).then(function () {
                return loadScript(
                    'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js',
                    'Stomp'
                );
            }).then(
                function () {
                    return !!window.SockJS && !!window.Stomp;
                },
                function () {
                    return false;
                }
            );
        }

        function loadScript(url, globalName) {
            var deferred = $q.defer();

            if (window[globalName]) {
                deferred.resolve(true);
                return deferred.promise;
            }

            var selector = 'script[data-battle-online-lib="' + globalName + '"]';
            var existing = $document[0].querySelector(selector);

            if (existing) {
                var checks = 0;

                function waitForGlobal() {
                    if (window[globalName]) {
                        deferred.resolve(true);
                        return;
                    }

                    checks += 1;

                    if (checks >= 50) {
                        deferred.reject();
                        return;
                    }

                    window.setTimeout(waitForGlobal, 100);
                }

                waitForGlobal();
                return deferred.promise;
            }

            var script = $document[0].createElement('script');
            script.async = true;
            script.src = url;
            script.setAttribute('data-battle-online-lib', globalName);

            script.onload = function () {
                if (window[globalName]) {
                    deferred.resolve(true);
                } else {
                    deferred.reject();
                }
            };

            script.onerror = function () {
                deferred.reject();
            };

            $document[0].head.appendChild(script);
            return deferred.promise;
        }

        function connectRealtime(roomCode, onRoomUpdate, onConnectionChanged) {
            var deferred = $q.defer();

            roomCode = normalizeRoomCode(roomCode);
            disconnectRealtime();

            if (!roomCode) {
                deferred.resolve(false);
                return deferred.promise;
            }

            ensureRealtimeLibraries().then(function (available) {
                if (!available) {
                    fireConnection(onConnectionChanged, false);
                    deferred.resolve(false);
                    return;
                }

                try {
                    var socketUrl = settings.api.baseUrl + 'public/battle-online-ws';
                    var socket = new window.SockJS(socketUrl);

                    socketClient = window.Stomp.over(socket);
                    socketClient.debug = function () {};
                    currentRoomCode = roomCode;

                    socketClient.connect(
                        {},
                        function () {
                            if (!socketClient || currentRoomCode !== roomCode) {
                                deferred.resolve(false);
                                return;
                            }

                            roomSubscription = socketClient.subscribe(
                                '/topic/battle-online/room/' + roomCode,
                                function (message) {
                                    var room;

                                    try {
                                        room = angular.fromJson(message.body);
                                    } catch (e) {
                                        return;
                                    }

                                    $rootScope.$evalAsync(function () {
                                        if (angular.isFunction(onRoomUpdate)) {
                                            onRoomUpdate(room);
                                        }
                                    });
                                }
                            );

                            fireConnection(onConnectionChanged, true);
                            deferred.resolve(true);
                        },
                        function () {
                            fireConnection(onConnectionChanged, false);
                            deferred.resolve(false);
                        }
                    );

                    socket.onclose = function () {
                        fireConnection(onConnectionChanged, false);
                    };
                } catch (e) {
                    fireConnection(onConnectionChanged, false);
                    deferred.resolve(false);
                }
            });

            return deferred.promise;
        }

        function fireConnection(callback, connected) {
            if (!angular.isFunction(callback)) {
                return;
            }

            $rootScope.$evalAsync(function () {
                callback(connected === true);
            });
        }

        function disconnectRealtime() {
            if (roomSubscription) {
                try {
                    roomSubscription.unsubscribe();
                } catch (e) {}
                roomSubscription = null;
            }

            if (socketClient) {
                try {
                    if (socketClient.connected) {
                        socketClient.disconnect(angular.noop);
                    }
                } catch (e) {}

                socketClient = null;
            }

            currentRoomCode = null;
        }
    }
})();
