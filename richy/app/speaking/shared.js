(function () {
    'use strict';
    angular.module('Hrm.Common', []);
    angular.module('Hrm.Question', ['ngCookies', 'ngSanitize', 'Hrm.Common']);
    angular.module('SpeakingPublic', ['Hrm.Question']).factory('SpeakingService', ['$http', '$q', '$window', function ($http, $q, $window) {
        var token = String($window.location.hash || '').slice(1), access = {key: '', canEdit: false}, data = null;
        function scopeMatches(context) { return data && Number(context.setId) === data.setId && Number(context.studentId) === data.studentId && data.questions.some(function (q) { return q.id === Number(context.questionId); }); }
        access.matches = function (context) { return !!(scopeMatches(context) && Number(context.userId) === data.shareId); };
        function request(method, path, params, body) {
            if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { return $q.reject({data: {message: 'Link Speaking không hợp lệ.'}}); }
            if (method === 'PUT' && (!access.canEdit || !scopeMatches(body || {}))) { return $q.reject({status: 403, data: {message: 'Link không cho phép sửa bài này.'}}); }
            return $http({method: method, url: '/service/public/speaking' + path, params: params || {}, data: body, timeout: 45000, cache: false, headers: {'X-Speaking-Share': token}}).then(function (r) { return r.data; });
        }
        return {
            publicAccess: access,
            bootstrap: function () { return request('GET', '').then(function (result) {
                if (!result || ![result.shareId, result.setId, result.studentId].every(function (id) { return Number.isInteger(id) && id > 0; }) || typeof result.canEdit !== 'boolean' || !Array.isArray(result.questions)) { throw new Error('Chưa xác nhận được bài được chia sẻ.'); }
                data = result; access.key = String(data.shareId); access.canEdit = data.canEdit; return data;
            }); },
            studentAnswers: function (set, student, question) { return request('GET', '/answer', {questionId: question}); },
            studentAnswerSync: function (set, student, question, revision) { return request('GET', '/answer', {questionId: question, revision: revision}); },
            saveStudentAnswer: function (body) { return request('PUT', '/answer', null, body); },
            speakingNotebook: function (set, student, question, revision) { return request('GET', '/notebook', {questionId: question, revision: revision}); },
            saveSpeakingNotebook: function (body) { return request('PUT', '/notebook', null, body); }
        };
    }]).controller('SpeakingPublicController', ['$scope', '$window', 'SpeakingService', function ($scope, $window, api) {
        var vm = this, doc = $window.document, alive = true, topicJumpGeneration = 0;
        vm.topicLinks = []; vm.loading = true; vm.part = 1; vm.groups = []; vm.limit = 6; vm.query = '';
        vm.rebuild = function () {
            var map = Object.create(null), term = vm.query.trim().toLowerCase(); vm.groups = []; vm.limit = 6; topicJumpGeneration++;
            vm.data.questions.forEach(function (q) { if (q.part !== vm.part || term && (q.topic + ' ' + q.prompt).toLowerCase().indexOf(term) < 0) { return; }
                var key = keyFor(q);
                if (!map[key]) { map[key] = {key: key, part: q.part, title: q.topic, anchorId: 'sp-topic-' + encodeURIComponent(key), questions: []}; vm.groups.push(map[key]); } map[key].questions.push(q);
            });
        };
        vm.more = function () { vm.limit = Math.min(vm.groups.length, vm.limit + 6); };
        vm.changePart = function (part) { vm.part = part; vm.answerId = null; vm.notebookId = null; vm.activeTopicKey = null; vm.closeLocator(false); vm.rebuild(); };

        function keyFor(q) { return q.part + ':' + q.topic + ':' + (q.linkedPart2Id || ''); }
        function focus(id, options) { var item = doc.getElementById(id); if (item) { item.focus(options); } }
        function scrollBehavior() {
            return $window.matchMedia && $window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        }
        function touchLocator(event) {
            event = event && (event.originalEvent || event);
            return event && event.detail !== 0 && (event.pointerType === 'touch' || event.pointerType === 'pen'
                || (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents)
                || (!event.pointerType && $window.matchMedia && $window.matchMedia('(pointer: coarse)').matches));
        }
        vm.goToTop = function () {
            topicJumpGeneration++;
            vm.closeLocator(false);
            focus('sp-shared-title', {preventScroll: true});
            $window.scrollTo({top: 0, behavior: scrollBehavior()});
        };
        vm.filterTopics = function () {
            var term = vm.topicQuery.toLowerCase().replace(/\s+/g, ' ').trim();
            vm.topicResults = vm.topicLinks.filter(function (topic) {
                return String(topic.title || '').toLowerCase().replace(/\s+/g, ' ').indexOf(term) >= 0;
            });
        };
        vm.closeLocator = function (restoreFocus) {
            vm.locatorOpen = false;
            if (restoreFocus) { focus('sp-topic-locator-toggle'); }
        };
        vm.toggleLocator = function (event) {
            if (vm.locatorOpen) { vm.closeLocator(false); return; }
            vm.topicQuery = ''; vm.filterTopics(); vm.locatorOpen = true;
            if (touchLocator(event)) { return; }
            $window.setTimeout(function () {
                if (alive && vm.locatorOpen) { focus('sp-topic-locator-search'); }
            }, 0);
        };
        vm.jumpToTopic = function (topic, event) {
            if (!vm.topicLinks.includes(topic) || vm.notebookId) { return; }
            var touch = touchLocator(event), search = doc.activeElement;
            var searchFocused = touch && search && search.id === 'sp-topic-locator-search', visual = $window.visualViewport;
            var dismissKeyboard = searchFocused || (touch && visual && visual.height * visual.scale < $window.innerHeight - 100);
            if (searchFocused) { search.blur(); }
            if (vm.query || vm.part !== topic.part) { vm.query = ''; vm.changePart(topic.part); }
            else { vm.closeLocator(false); }
            var index = vm.groups.findIndex(function (group) { return group.key === topic.key; });
            if (index < 0) { return; }
            vm.limit = Math.min(vm.groups.length, Math.max(vm.limit, (Math.floor(index / 6) + 1) * 6));
            for (var i = 0; i <= index; i++) { vm.groups[i].lazyLoaded = true; }
            vm.activeTopicKey = topic.key;
            var groups = vm.groups, generation = ++topicJumpGeneration;
            $window.setTimeout(function () {
                if (!alive || generation !== topicJumpGeneration || vm.groups !== groups || vm.notebookId) { return; }
                var target = doc.getElementById(groups[index].anchorId);
                if (!target) { return; }
                target.scrollIntoView({behavior: touch ? 'instant' : scrollBehavior(), block: 'start'});
                if (!touch) { target.focus({preventScroll: true}); }
            }, dismissKeyboard ? 280 : 0);
        };
        vm.openNotebook = function (questionId) { topicJumpGeneration++; vm.closeLocator(false); vm.notebookId = questionId; };
        function outside(event) {
            if (vm.locatorOpen && !event.target.closest('.sp-topic-locator')) {
                $scope.$evalAsync(function () { vm.closeLocator(false); });
            }
        }
        function escape(event) {
            if (vm.locatorOpen && event.key === 'Escape') {
                event.preventDefault();
                $scope.$evalAsync(function () { vm.closeLocator(true); });
            }
        }
        doc.addEventListener('click', outside);
        doc.addEventListener('keydown', escape);
        $scope.$on('$destroy', function () {
            alive = false;
            doc.removeEventListener('click', outside);
            doc.removeEventListener('keydown', escape);
        });

        api.bootstrap().then(function (data) { if (!alive) { return; } vm.data = data; vm.ready = true;
            var seen = Object.create(null);
            data.questions.forEach(function (question) {
                var key = keyFor(question);
                if (!seen[key]) { seen[key] = true; vm.topicLinks.push({key: key, part: question.part, title: question.topic}); }
            });
            vm.topicLinks.sort(function (a, b) { return a.part - b.part; });
            var first = data.questions.filter(function (q) { return q.hasAnswer; })[0] || data.questions[0];
            if (first) { vm.part = first.part; vm.answerId = first.id; } vm.rebuild();
        }).catch(function (error) { if (alive) { vm.error = error.data && error.data.message || error.message || 'Chưa mở được bài. Link có thể đã bị thu hồi.'; } }).finally(function () { if (alive) { vm.loading = false; } });
    }]);
}());
