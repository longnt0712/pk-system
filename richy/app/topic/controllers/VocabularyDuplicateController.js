(function () {
    'use strict';
    angular.module('Hrm.Topic').directive('vocabularyDuplicateMore', ['$window', function ($window) {
        return {link: function (scope, element, attrs) {
            var list = element[0], observer;
            function more() { scope.$evalAsync(function () { scope.$eval(attrs.vocabularyDuplicateMore); }); }
            function scroll() { if (list.scrollHeight - list.scrollTop - list.clientHeight < 120) { more(); } }
            if ($window.IntersectionObserver) {
                observer = new $window.IntersectionObserver(function (entries) {
                    if (entries.some(function (entry) { return entry.isIntersecting; })) { more(); }
                }, {root: list, rootMargin: '0px 0px 120px 0px'});
                observer.observe(list.querySelector('.vd-group-end'));
            } else { list.addEventListener('scroll', scroll); }
            scope.$on('$destroy', function () { if (observer) { observer.disconnect(); } else { list.removeEventListener('scroll', scroll); } });
        }};
    }]);
    angular.module('Hrm.Topic').controller('VocabularyDuplicateController', VocabularyDuplicateController);
    VocabularyDuplicateController.$inject = ['$scope', '$uibModal', 'QuestionService', 'toastr'];
    function VocabularyDuplicateController($scope, modal, api, toastr) {
        var vm = this, alive = true, groupsRequest = 0, detailsRequest = 0;
        vm.groups = []; vm.filteredGroups = []; vm.visibleGroups = []; vm.query = ''; vm.limit = 30;
        vm.cards = []; vm.selected = {}; vm.chosen = []; vm.topics = []; vm.meaning = '';
        function message(error, fallback) { return error && error.data && error.data.message || fallback; }
        vm.filterGroups = function () {
            var key = (vm.query || '').trim().toLowerCase(); vm.limit = 30;
            vm.filteredGroups = vm.groups.filter(function (group) { return !key || group.word.toLowerCase().indexOf(key) !== -1; });
            vm.visibleGroups = vm.filteredGroups.slice(0, vm.limit);
        };
        vm.loadMore = function () {
            if (vm.limit < vm.filteredGroups.length) { vm.limit += 30; vm.visibleGroups = vm.filteredGroups.slice(0, vm.limit); }
        };
        function clearGroup() {
            detailsRequest++; vm.activeGroup = null; vm.cards = []; vm.selected = {}; vm.chosen = []; vm.topics = [];
            vm.primaryId = null; vm.primaryCard = null; vm.meaning = ''; vm.suggestedMeaning = ''; vm.meaningEdited = false;
            vm.groupError = ''; vm.mergeError = ''; vm.stale = false; vm.detailsLoading = false;
        }
        vm.refresh = function () {
            if (vm.merging) { return; }
            var request = ++groupsRequest; clearGroup(); vm.groupsLoading = true; vm.groupsError = '';
            return api.getVocabularyDuplicateGroups().then(function (groups) {
                if (!alive || request !== groupsRequest) { return; }
                if (!Array.isArray(groups)) { throw new Error('Missing duplicate groups'); }
                vm.groups = groups; vm.duplicateCount = groups.reduce(function (sum, group) { return sum + group.ids.length; }, 0);
                vm.filterGroups();
            }).catch(function (error) {
                if (alive && request === groupsRequest) { vm.groupsError = message(error, 'Chưa tải được danh sách từ trùng. Hãy thử lại.'); }
            }).finally(function () { if (alive && request === groupsRequest) { vm.groupsLoading = false; } });
        };
        vm.changeSelection = function () {
            vm.chosen = vm.cards.filter(function (card) { return vm.selected[card.id]; });
            if (!vm.selected[vm.primaryId]) { vm.primaryId = vm.chosen.length ? vm.chosen[0].id : null; }
            vm.primaryCard = vm.chosen.filter(function (card) { return card.id === vm.primaryId; })[0] || null;
            var meanings = [], topicIds = new Set(); vm.topics = [];
            vm.chosen.forEach(function (card) {
                var meaning = (card.motherTongue || '').trim();
                if (meaning && meanings.indexOf(meaning) === -1) { meanings.push(meaning); }
                (card.questionTopics || []).forEach(function (link) {
                    var topic = link && link.topic;
                    if (topic && topic.id && !topicIds.has(topic.id)) { topicIds.add(topic.id); vm.topics.push(topic); }
                });
            });
            vm.topics.sort(function (left, right) { return (left.name || '').localeCompare(right.name || '', 'vi', {numeric: true}); });
            vm.suggestedMeaning = meanings.join(' / ');
            if (!vm.meaningEdited) { vm.meaning = vm.suggestedMeaning; }
            vm.mergeError = '';
        };
        vm.selectPrimary = function (card) { vm.primaryId = card.id; vm.selected[card.id] = true; vm.changeSelection(); };
        vm.toggleAll = function () {
            var value = vm.chosen.length !== vm.cards.length;
            vm.cards.forEach(function (card) { vm.selected[card.id] = value; }); vm.changeSelection();
        };
        vm.useSuggestedMeaning = function () { vm.meaningEdited = false; vm.meaning = vm.suggestedMeaning; };
        vm.meaningChanged = function () { vm.meaningEdited = true; vm.mergeError = ''; };
        vm.openGroup = function (group) {
            if (vm.merging) { return; }
            clearGroup(); vm.activeGroup = group; vm.detailsLoading = true;
            var request = ++detailsRequest;
            return api.getVocabularyDuplicateDetails(group.ids).then(function (cards) {
                if (!alive || request !== detailsRequest) { return; }
                var returnedIds = new Set();
                if (!Array.isArray(cards) || cards.length !== group.ids.length || cards.some(function (card) {
                    if (!card.id || !card.fingerprint || group.ids.indexOf(card.id) === -1 || returnedIds.has(card.id)) { return true; }
                    returnedIds.add(card.id); return false;
                })) {
                    throw new Error('Incomplete word details');
                }
                vm.cards = cards;
                cards.forEach(function (card) { vm.selected[card.id] = true; });
                vm.primaryId = cards[0].id; vm.changeSelection();
            }).catch(function (error) {
                if (alive && request === detailsRequest) { vm.groupError = message(error, 'Chưa tải đủ chi tiết từ. Hãy tải lại danh sách trước khi gộp.'); }
            }).finally(function () { if (alive && request === detailsRequest) { vm.detailsLoading = false; } });
        };
        vm.canMerge = function () {
            return !vm.merging && !vm.detailsLoading && !vm.stale && vm.chosen.length >= 2 && vm.primaryCard
                && typeof vm.meaning === 'string' && vm.meaning.length <= 500;
        };
        vm.confirmMerge = function () {
            if (!vm.canMerge()) { return; }
            vm.mergeError = '';
            vm.confirmDialog = modal.open({templateUrl: 'vocabulary_merge_confirm.html', scope: $scope,
                size: 'md', backdrop: 'static', keyboard: false, windowClass: 'vocab-dialog vd-confirm-dialog'});
            vm.confirmDialog.result.catch(angular.noop);
        };
        vm.cancelMerge = function () { if (!vm.merging) { vm.confirmDialog.dismiss(); } };
        vm.merge = function () {
            if (!vm.canMerge()) { return; }
            var selected = vm.chosen.slice(), primaryId = vm.primaryId;
            var payload = {primaryId: primaryId, meaning: vm.meaning,
                sources: selected.map(function (card) { return {id: card.id, fingerprint: card.fingerprint}; })};
            vm.merging = true; vm.mergeError = '';
            return api.mergeVocabularyDuplicates(payload).then(function (result) {
                if (!alive) { return; }
                if (!result || !result.card || result.card.id !== primaryId || result.mergedCount !== selected.length - 1) {
                    throw new Error('Unconfirmed merge result');
                }
                vm.lastMerge = result; vm.confirmDialog.close(result); vm.merging = false;
                toastr.success('Đã gộp ' + selected.length + ' bản và giữ đầy đủ topic của các bản đã chọn.');
                return vm.refresh();
            }).catch(function (error) {
                if (!alive) { return; }
                vm.stale = error && error.status === 409;
                vm.mergeError = message(error, 'Chưa xác nhận được kết quả gộp. Nội dung bạn chọn vẫn được giữ; hãy tải lại danh sách để kiểm tra.');
            }).finally(function () { if (alive) { vm.merging = false; } });
        };
        $scope.$on('$locationChangeStart', function (event) {
            if (vm.merging) { event.preventDefault(); toastr.info('Đang gộp từ. Vui lòng chờ máy chủ xác nhận.'); }
        });
        $scope.$on('$destroy', function () {
            alive = false; groupsRequest++; detailsRequest++;
            if (vm.confirmDialog && !vm.merging) { vm.confirmDialog.dismiss(); }
        });
        vm.refresh();
    }
})();
