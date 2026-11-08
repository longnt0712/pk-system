(function () {
    'use strict';
    angular.module('Hrm.Topic').controller('VocabularyDuplicateController', VocabularyDuplicateController);
    VocabularyDuplicateController.$inject = ['$scope', '$uibModal', 'QuestionService', 'toastr', '$q', '$window'];
    function VocabularyDuplicateController($scope, modal, api, toastr, $q, $window) {
        var vm = this, alive = true, generation = 0, sequence = 0, drafts = Object.create(null);
        vm.groups = []; vm.filteredGroups = []; vm.pageGroups = []; vm.page = 1; vm.pageSize = 10;
        vm.query = ''; vm.showAll = false; vm.mergeError = '';
        function key(text) { return (text || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
        function message(error, fallback) { return error && error.data && error.data.message || fallback; }
        function sameIds(left, right) {
            var a = left.slice().sort(function (x,y) { return x-y; }), b = right.slice().sort(function (x,y) { return x-y; });
            return a.length === b.length && a.every(function (id,i) { return id === b[i]; });
        }
        function validGroup(group) {
            return group && typeof group.word === 'string' && key(group.word) && Array.isArray(group.ids)
                && group.ids.length >= (group.reviewed ? 1 : 2) && group.ids.length <= 5000
                && group.ids.every(function (id) { return Number.isSafeInteger(id) && id > 0; })
                && new Set(group.ids).size === group.ids.length;
        }
        function updateCounts() {
            vm.pendingCount = vm.groups.filter(function (group) { return !group.reviewed; }).length;
            vm.reviewedCount = vm.groups.length - vm.pendingCount;
        }
        function stateFor(summary) {
            var name = key(summary.word), state = drafts[name];
            if (!state) {
                state = drafts[name] = {uid: ++sequence, cards: [], selected: {}, chosen: [], topics: [],
                    meaning: '', meaningEdited: false, included: !summary.reviewed, loaded: false, request: 0};
            }
            if (state.summary && !sameIds(state.summary.ids,summary.ids)) { state.loaded = false; state.request++; }
            state.summary = summary;
            if (summary.reviewed) { state.included = false; }
            return state;
        }
        function recalculate(state) {
            state.chosen = state.cards.filter(function (card) { return state.selected[card.id]; });
            if (!state.selected[state.primaryId]) { state.primaryId = state.chosen.length ? state.chosen[0].id : null; }
            state.primaryCard = state.chosen.filter(function (card) { return card.id === state.primaryId; })[0] || null;
            var meanings = [], topics = new Map();
            state.chosen.forEach(function (card) {
                var meaning = (card.motherTongue || '').trim();
                if (meaning && meanings.indexOf(meaning) === -1) { meanings.push(meaning); }
                (card.questionTopics || []).forEach(function (link) {
                    var topic = link && link.topic;
                    if (topic && topic.id) { topics.set(topic.id,topic); }
                });
            });
            state.joinedMeaning = meanings.join(' / ');
            state.topics = Array.from(topics.values()).sort(function (a,b) { return (a.name || '').localeCompare(b.name || '', 'vi', {numeric:true}); });
            if (!state.meaningEdited) { state.meaning = state.primaryCard && state.primaryCard.motherTongue || ''; }
        }
        function load(state, force) {
            if (state.loaded && !force) { return $q.when(); }
            var request = ++state.request, version = generation, ids = state.summary.ids.slice();
            state.loading = true; state.error = ''; state.stale = false;
            return api.getVocabularyDuplicateDetails(ids).then(function (cards) {
                if (!alive || version !== generation || request !== state.request) { return; }
                var seen = new Set();
                if (!Array.isArray(cards) || cards.length !== ids.length || cards.some(function (card) {
                    if (!card || !card.fingerprint || ids.indexOf(card.id) < 0 || seen.has(card.id)
                        || key(card.question) !== key(state.summary.word)) { return true; }
                    seen.add(card.id); return false;
                })) { throw new Error('Incomplete group details'); }
                var previous = state.selected;
                state.cards = cards.slice().sort(function (a,b) { return a.id-b.id; });
                state.selected = {};
                state.cards.forEach(function (card) {
                    state.selected[card.id] = Object.prototype.hasOwnProperty.call(previous,card.id) ? previous[card.id] : true;
                });
                state.loaded = true; recalculate(state);
            }).catch(function (error) {
                if (alive && version === generation && request === state.request) {
                    state.loaded = false; state.error = message(error,'Chưa tải đủ nhóm từ. Bấm Tải lại trước khi lưu.');
                }
            }).finally(function () {
                if (alive && version === generation && request === state.request) { state.loading = false; }
            });
        }
        function render(page) {
            updateCounts();
            var query = key(vm.query);
            vm.filteredGroups = vm.groups.filter(function (group) {
                return (vm.showAll || !group.reviewed) && (!query || key(group.word).indexOf(query) >= 0);
            });
            vm.pageCount = Math.max(1,Math.ceil(vm.filteredGroups.length/vm.pageSize));
            vm.page = Math.max(1,Math.min(page || 1,vm.pageCount));
            vm.pageGroups = vm.filteredGroups.slice((vm.page-1)*vm.pageSize,vm.page*vm.pageSize).map(stateFor);
            return $q.all(vm.pageGroups.map(function (state) { return load(state,false); }));
        }
        vm.busy = function () { return vm.merging || vm.reviewing || vm.groupsLoading || !!vm.confirmDialog; };
        vm.filterGroups = function () { if (!vm.busy()) { return render(1); } };
        vm.showPage = function (page) { if (!vm.busy()) { return render(page); } };
        vm.scrollToGroup = function (state) {
            var node = $window.document.getElementById('vd-group-'+state.uid);
            if (node) { node.scrollIntoView({behavior:'smooth',block:'start'}); }
        };
        vm.refresh = function () {
            if (vm.merging || vm.reviewing || vm.confirmDialog) { return; }
            var version = ++generation;
            vm.groupsLoading = true; vm.groupsError = ''; vm.mergeError = '';
            Object.keys(drafts).forEach(function (name) { drafts[name].loaded = false; drafts[name].request++; });
            return api.getVocabularyDuplicateGroups(true).then(function (groups) {
                if (!alive || version !== generation) { return; }
                var names = new Set(), ids = new Set();
                if (!Array.isArray(groups) || groups.some(function (group) {
                    if (!validGroup(group) || names.has(key(group.word)) || group.ids.some(function (id) { return ids.has(id); })) { return true; }
                    names.add(key(group.word)); group.ids.forEach(function (id) { ids.add(id); }); return false;
                })) { throw new Error('Invalid group list'); }
                vm.groups = groups; vm.groupsLoading = false;
                return render(vm.page);
            }).catch(function (error) {
                if (alive && version === generation) { vm.groupsError = message(error,'Chưa tải được danh sách từ trùng. Hãy thử lại.'); }
            }).finally(function () { if (alive && version === generation) { vm.groupsLoading = false; } });
        };
        vm.reload = function (state) { if (!vm.busy()) { return load(state,true); } };
        vm.changeSelection = function (state) { if (!vm.busy()) { recalculate(state); vm.mergeError = ''; } };
        vm.selectPrimary = function (state,card) {
            if (vm.busy()) { return; } state.primaryId = card.id; state.selected[card.id] = true; recalculate(state);
        };
        vm.toggleAll = function (state) {
            if (vm.busy()) { return; }
            var selected = state.chosen.length !== state.cards.length;
            state.cards.forEach(function (card) { state.selected[card.id] = selected; }); recalculate(state);
        };
        vm.meaningChanged = function (state) { state.meaningEdited = true; vm.mergeError = ''; };
        vm.usePrimaryMeaning = function (state) { state.meaningEdited = false; recalculate(state); };
        vm.joinMeanings = function (state) { state.meaning = state.joinedMeaning; state.meaningEdited = true; };
        vm.selectedGroups = function () { return vm.pageGroups.filter(function (state) { return state.included; }); };
        function ready(state) {
            return state.loaded && !state.loading && !state.error && !state.stale && state.chosen.length >= 2 && state.primaryCard
                && typeof state.meaning === 'string' && !!state.meaning.trim() && state.meaning.length <= 500;
        }
        vm.canMerge = function () {
            var selected = vm.selectedGroups();
            return !vm.merging && !vm.reviewing && !vm.groupsLoading && !vm.groupsError
                && selected.length > 0 && selected.length <= 10 && selected.every(ready);
        };
        function sources(state) { return state.chosen.map(function (card) { return {id:card.id,fingerprint:card.fingerprint}; }); }
        vm.confirmMerge = function () {
            if (!vm.canMerge() || vm.confirmDialog) { return; }
            vm.mergeError = '';
            vm.confirmation = vm.selectedGroups().map(function (state) {
                return {state:state,word:state.summary.word,ids:state.summary.ids.slice(),topics:state.topics.length,
                    payload:{primaryId:state.primaryId,meaning:state.meaning.trim(),groupIds:state.summary.ids.slice(),sources:sources(state)}};
            });
            vm.confirmDialog = modal.open({templateUrl:'vocabulary_merge_confirm.html',scope:$scope,size:'md',
                backdrop:'static',keyboard:false,windowClass:'vocab-dialog vd-confirm-dialog'});
            vm.confirmDialog.result.catch(angular.noop);
        };
        vm.cancelMerge = function () {
            if (vm.merging || !vm.confirmDialog) { return; }
            var dialog = vm.confirmDialog; vm.confirmDialog = null; vm.confirmation = null; dialog.dismiss();
        };
        function replaceGroup(group) {
            var name = key(group.word);
            var index = vm.groups.findIndex(function (item) { return key(item.word) === name; });
            if (index >= 0) {
                if (group.ids.length > 1 || group.reviewed) { vm.groups[index] = group; }
                else { vm.groups.splice(index,1); }
            } else if (group.ids.length > 1 || group.reviewed) { vm.groups.push(group); }
            if (drafts[name]) { drafts[name].loaded = false; drafts[name].request++; }
        }
        vm.merge = function () {
            if (!vm.canMerge() || !vm.confirmDialog || !vm.confirmation) { return; }
            var batch = vm.confirmation.slice();
            vm.merging = true; vm.mergeError = '';
            return api.mergeVocabularyDuplicateBatch(batch.map(function (item) { return item.payload; })).then(function (results) {
                if (!alive) { return; }
                var seen = new Set();
                if (!Array.isArray(results) || results.length !== batch.length || results.some(function (result) {
                    var item = result && result.card && batch.filter(function (entry) { return entry.payload.primaryId === result.card.id; })[0];
                    if (!item || seen.has(result.card.id) || result.mergedCount !== item.payload.sources.length-1
                        || !validGroup(result.group) || result.group.reviewed !== true || key(result.group.word) !== key(item.word)) { return true; }
                    var removed = item.payload.sources.filter(function (source) { return source.id !== item.payload.primaryId; }).map(function (source) { return source.id; });
                    if (!sameIds(result.group.ids,item.ids.filter(function (id) { return removed.indexOf(id) < 0; }))) { return true; }
                    seen.add(result.card.id); return false;
                })) { throw new Error('Unconfirmed merge result'); }
                results.forEach(function (result) { replaceGroup(result.group); });
                vm.lastBatch = {groups:results.length,removed:results.reduce(function (sum,result) { return sum+result.mergedCount; },0)};
                var dialog = vm.confirmDialog; vm.confirmDialog = null; vm.confirmation = null;
                vm.merging = false; dialog.close(results);
                toastr.success('Đã gộp và đánh dấu đã check '+results.length+' nhóm.');
                return render(vm.page);
            }).catch(function (error) {
                if (!alive) { return; }
                if (!error || error.status !== 422) { batch.forEach(function (item) { item.state.stale = true; }); }
                vm.mergeError = message(error,error && error.status === 404
                    ? 'Chức năng này cần cập nhật SQL và JAR mới trước khi lưu.'
                    : 'Chưa xác nhận được kết quả. Phần bạn sửa vẫn được giữ; tải lại danh sách để kiểm tra trước khi lưu lại.');
            }).finally(function () { if (alive) { vm.merging = false; } });
        };
        vm.toggleReview = function (state,event) {
            if (event) { event.preventDefault(); event.stopPropagation(); }
            if (vm.busy() || !state.loaded || state.loading || state.error || state.stale) { return; }
            var target = !state.summary.reviewed, ids = state.summary.ids.slice();
            vm.reviewing = true; state.error = ''; vm.mergeError = '';
            return api.setVocabularyDuplicateReviewed({reviewed:target,sources:state.cards.map(function (card) {
                return {id:card.id,fingerprint:card.fingerprint};
            })}).then(function (group) {
                if (!alive) { return; }
                if (!validGroup(Object.assign({},group,{reviewed:true})) || group.reviewed !== target
                    || key(group.word) !== key(state.summary.word) || !sameIds(group.ids,ids)) { throw new Error('Unconfirmed review result'); }
                state.included = !target; replaceGroup(group); vm.reviewing = false;
                return render(vm.page);
            }).catch(function (error) {
                if (!alive) { return; }
                state.stale = true;
                state.error = message(error,'Chưa xác nhận được dấu đã check. Hãy tải lại nhóm để kiểm tra.');
            }).finally(function () { if (alive) { vm.reviewing = false; } });
        };
        $scope.$on('$locationChangeStart',function (event) {
            if (vm.merging || vm.reviewing) { event.preventDefault(); toastr.info('Đang lưu thay đổi. Vui lòng chờ máy chủ xác nhận.'); }
        });
        $scope.$on('$destroy',function () {
            alive = false; generation++;
            if (vm.confirmDialog) { vm.confirmDialog.dismiss(); }
        });
        vm.refresh();
    }
})();
