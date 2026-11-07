(function () {
    'use strict';
    angular.module('Hrm.Topic').controller('VocabularyController', VocabularyController);
    angular.module('Hrm.Topic').directive('vocabularySelectPortal', ['$window', function ($window) {
        return {require: 'uiSelect', link: function (scope, element, attrs, select) {
            var scrollBody = angular.element(element[0].closest('.vw-modal-body'));
            var viewport = angular.element($window), openedAt = 0;
            scope.$watch(function () { return select.open; }, function (open) {
                if (open && scrollBody[0]) { openedAt = scrollBody[0].scrollTop; }
            });
            function closeOnScroll() {
                if (select.open && scrollBody[0] && scrollBody[0].scrollTop !== openedAt) {
                    scope.$evalAsync(function () { select.close(); });
                }
            }
            function closeOnResize() { if (select.open) { scope.$evalAsync(function () { select.close(); }); } }
            scrollBody.on('scroll', closeOnScroll); viewport.on('resize', closeOnResize);
            scope.$on('$destroy', function () { scrollBody.off('scroll', closeOnScroll); viewport.off('resize', closeOnResize); });
        }};
    }]);
    angular.module('Hrm.Topic').directive('vocabularyLoadMore', ['$window', function ($window) {
        return {link: function (scope, element, attrs) {
            var list = element[0];
            var sentinel = list.querySelector('.vw-lesson-end');
            var observer;

            function loadMore() {
                scope.$evalAsync(function () { scope.$eval(attrs.vocabularyLoadMore); });
            }
            function onScroll() {
                if (list.scrollHeight - list.scrollTop - list.clientHeight <= 120) {
                    loadMore();
                }
            }
            if ($window.IntersectionObserver) {
                observer = new $window.IntersectionObserver(function (entries) {
                    if (entries.some(function (entry) { return entry.isIntersecting; })) {
                        loadMore();
                    }
                }, {root: list, rootMargin: '0px 0px 120px 0px'});
                observer.observe(sentinel);
            } else {
                list.addEventListener('scroll', onScroll);
            }
            scope.$on('$destroy', function () {
                if (observer) { observer.disconnect(); }
                else { list.removeEventListener('scroll', onScroll); }
            });
        }};
    }]);
    VocabularyController.$inject = ['$scope', '$q', '$uibModal', '$cookies', '$location', 'settings', 'QuestionService', 'TopicService', 'toastr', '$window', '$timeout'];
    function VocabularyController($scope, $q, modal, $cookies, $location, settings, cards, lessons, toastr, $window, $timeout) {
        var vm = this, cardRequest = 0, lessonRequest = 0, usageRequest = 0, lessonSelection = 0, alive = true;
        var cardCancellation = null, cardDeadline = null;
        vm.user = JSON.parse($cookies.get('education.user') || '{}');
        vm.isAdmin = settings.isAdmin === true;
        vm.canDelete = vm.isAdmin || (vm.user.roles || []).some(function (role) { return role.name === 'ROLE_USER'; });
        vm.lessons = []; vm.categories = []; vm.cards = []; vm.selected = {};
        vm.lessonPage = 0; vm.lessonPageSize = 20; vm.lessonTotal = 0;
        vm.page = 1; vm.pageSize = 8; vm.total = 0; vm.status = 0; vm.query = '';
        vm.findExactWord = true;
        vm.pageSizeInput = vm.pageSize;
        vm.pageSizeLimit = 100;
        vm.view = 'all'; vm.lessonQuery = ''; vm.lessonCategory = null;
        vm.levels = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        $scope.vocabularyTinyMce = {height: 200, menubar: false, plugins: 'lists link', toolbar: 'bold italic | bullist numlist | link | removeformat'};
        vm.typeFilters = [{id: 0, name: 'Tất cả thẻ'}, {id: 3, name: 'Từ vựng'}, {id: 5, name: 'Listening'}, {id: 4, name: 'Đánh dấu'}];
        $scope.$on('$destroy', function () {
            alive = false; cardRequest++; lessonRequest++; usageRequest++;
            if (cardCancellation) { cardCancellation.resolve(); }
            if (cardDeadline) { $timeout.cancel(cardDeadline); }
        });
        function errorMessage(error, fallback) { return error && error.data && error.data.message || fallback; }
        vm.describeLength = function (html) {
            var node = $window.document.createElement('template'); node.innerHTML = html || '';
            return (node.content.textContent || '').length;
        };
        vm.cardError = function (card) {
            if (!card || !card.question || !card.question.trim()) { return 'Vui lòng nhập từ cần lưu.'; }
            if (card.question.trim().length > 200) { return 'Từ / cụm từ vượt quá 200 ký tự.'; }
            if ((card.pronounce || '').length > 200) { return 'Phiên âm vượt quá 200 ký tự.'; }
            if ((card.motherTongue || '').length > 500) { return 'Nghĩa tiếng Việt vượt quá 500 ký tự.'; }
            if (vm.isAdmin && vm.describeLength(card.description) > 2000) { return 'Mô tả vượt quá 2.000 ký tự nội dung.'; }
            return '';
        };
        vm.loadUsage = function () {
            var request = ++usageRequest; vm.usageError = '';
            return cards.getVocabularyUsage().then(function (data) {
                if (alive && request === usageRequest) { vm.usage = data; }
            }, function () {
                if (alive && request === usageRequest) { vm.usageError = 'Chưa tải được hạn mức. Máy chủ vẫn kiểm tra khi lưu.'; }
            });
        };
        vm.wordPercent = function () { return vm.usage && vm.usage.wordLimit > 0 ? Math.min(100, vm.usage.wordCount / vm.usage.wordLimit * 100) : 0; };
        vm.lessonPercent = function () { return vm.usage && vm.usage.topicLimit > 0 ? Math.min(100, vm.usage.topicCount / vm.usage.topicLimit * 100) : 0; };
        function fetchLessonPage() {
            var page = vm.lessonPage + 1;
            var request = ++lessonRequest;
            vm.lessonsLoading = true;
            vm.lessonError = '';
            var search = {userId: vm.user.id, username: vm.user.username, textSearch: vm.lessonQuery,
                topicCategory: vm.lessonCategory ? {id: vm.lessonCategory} : null};
            return lessons.getPage(search, page, vm.lessonPageSize).then(function (data) {
                if (!alive || request !== lessonRequest) { return; }
                var incoming = data && data.content || [];
                var seen = new Set(vm.lessons.map(function (lesson) { return lesson.id; }));
                incoming.forEach(function (lesson) {
                    if (!seen.has(lesson.id)) {
                        vm.lessons.push(lesson);
                        seen.add(lesson.id);
                    }
                });
                vm.lessonPage = page;
                vm.lessonTotal = data && data.totalElements || 0;
                vm.hasMoreLessons = incoming.length > 0 && page * vm.lessonPageSize < vm.lessonTotal;
                vm.importTopics = vm.activeLesson ? [vm.activeLesson] : vm.lessons;
            }, function (error) {
                if (alive && request === lessonRequest) { vm.lessonError = errorMessage(error, 'Không tải được danh sách bài. Vui lòng thử lại.'); }
            }).finally(function () {
                if (alive && request === lessonRequest) { vm.lessonsLoading = false; }
            });
        }
        vm.loadLessons = function () {
            vm.lessonPage = 0;
            vm.lessonTotal = 0;
            vm.lessons = [];
            vm.hasMoreLessons = false;
            return fetchLessonPage();
        };
        vm.loadMoreLessons = function () {
            if (vm.hasMoreLessons && !vm.lessonsLoading && !vm.lessonError) {
                return fetchLessonPage();
            }
        };
        vm.retryLessons = function () {
            if (!vm.lessonsLoading && vm.lessonError) {
                return fetchLessonPage();
            }
        };
        vm.searchPayload = function () {
            return {questionType: {id: 6}, status: vm.status, textSearch: vm.query, findExactWord: vm.findExactWord,
                topicId: vm.activeLesson ? vm.activeLesson.id : null, withoutTopics: vm.view === 'unassigned'};
        };
        vm.loadCards = function (reset) {
            if (reset) { vm.page = 1; }
            var request = ++cardRequest; vm.cardsLoading = true; vm.cardLoadError = ''; vm.selected = {};
            if (cardCancellation) { cardCancellation.resolve(); }
            if (cardDeadline) { $timeout.cancel(cardDeadline); }
            var cancellation = $q.defer(), timedOut = false;
            cardCancellation = cancellation;
            cardDeadline = $timeout(function () { timedOut = true; cancellation.resolve(); }, 30000);
            vm.cards = []; vm.total = 0;
            return cards.getVocabularyPage(vm.searchPayload(), vm.page, vm.pageSize, {timeout: cancellation.promise}).then(function (data) {
                if (!alive || request !== cardRequest) { return; }
                vm.cards = data && data.content || []; vm.total = data && data.totalElements || 0;
                if (!vm.cards.length && vm.page > 1) { vm.page = Math.max(1, Math.ceil(vm.total / vm.pageSize)); return vm.loadCards(); }
            }, function (error) {
                if (alive && request === cardRequest) {
                    vm.cardLoadError = timedOut ? 'Tải từ vựng quá 30 giây. Vui lòng bấm Thử lại hoặc chọn bài khác.' :
                        'Chưa tải được từ vựng từ máy chủ. Vui lòng thử lại.';
                }
            }).finally(function () {
                if (alive && request === cardRequest) {
                    vm.cardsLoading = false; $timeout.cancel(cardDeadline); cardDeadline = null; cardCancellation = null;
                }
            });
        };
        vm.selectLesson = function (lesson, view) {
            lessonSelection++;
            vm.activeLesson = lesson || null; vm.view = lesson ? 'lesson' : view || 'all';
            vm.query = ''; vm.lessonPickerOpen = false;
            vm.importTopics = lesson ? [lesson] : vm.lessons;
            $location.search('lesson', lesson ? String(lesson.id) : vm.view).replace();
            return vm.loadCards(true);
        };
        vm.title = function () { return vm.activeLesson ? vm.activeLesson.name : vm.view === 'unassigned' ? 'Từ chưa vào bài' : 'Tất cả từ vựng'; };
        vm.pageCount = function () { return Math.max(1, Math.ceil(vm.total / vm.pageSize)); };
        vm.applyPageSize = function () {
            var size = vm.pageSizeInput;
            if (vm.deleting || !Number.isInteger(size) || size < 1 || size > vm.pageSizeLimit || size === vm.pageSize) {
                return;
            }
            vm.pageSize = size;
            return vm.loadCards(true);
        };
        vm.changePage = function (step) { vm.page += step; return vm.loadCards(); };
        vm.selectedCards = function () { return vm.cards.filter(function (card) { return vm.selected[card.id]; }); };
        vm.allSelected = function () { return !!vm.cards.length && vm.selectedCards().length === vm.cards.length; };
        vm.togglePage = function () {
            var value = !vm.allSelected(); vm.cards.forEach(function (card) { vm.selected[card.id] = value; });
        };
        vm.say = function (card) {
            if (!$window.speechSynthesis || !$window.SpeechSynthesisUtterance) { toastr.info('Trình duyệt này chưa hỗ trợ đọc từ.'); return; }
            $window.speechSynthesis.cancel(); var speech = new $window.SpeechSynthesisUtterance(card.question);
            speech.lang = 'en-US'; $window.speechSynthesis.speak(speech);
        };
        function openDialog(template) {
            var dialog = modal.open({templateUrl: template, scope: $scope, size: 'md', backdrop: 'static', keyboard: false, windowClass: 'vocab-dialog'});
            dialog.result.catch(angular.noop); return dialog;
        }
        vm.newLesson = function () {
            vm.lessonDraft = {userId: vm.user.id, name: '', topicCategory: null, isShow: true};
            vm.lessonSaveError = ''; vm.lessonDialog = openDialog('vocabulary_lesson_modal.html');
            vm.loadUsage();
        };
        vm.editLesson = function () {
            if (!vm.activeLesson || vm.lessonOpening) { return; }
            vm.lessonOpening = true;
            return lessons.getOne(vm.activeLesson.id).then(function (data) {
                if (!data || !data.id) { throw new Error('Bài không còn tồn tại.'); }
                vm.lessonDraft = angular.copy(data); vm.lessonSaveError = ''; vm.lessonDialog = openDialog('vocabulary_lesson_modal.html');
            }).catch(function (error) { toastr.error(errorMessage(error, error.message || 'Không mở được bài từ vựng.')); })
                .finally(function () { vm.lessonOpening = false; });
        };
        vm.cancelLesson = function () { if (!vm.lessonSaving) { vm.lessonDialog.dismiss(); } };
        vm.confirmDeleteLesson = function () {
            if (!vm.canDelete || !vm.lessonDraft.id || vm.lessonSaving) { return; }
            vm.lessonDeleteDraft = angular.copy(vm.lessonDraft); vm.lessonDeleteError = '';
            vm.lessonDialog.dismiss(); vm.lessonDeleteDialog = openDialog('vocabulary_delete_lesson_modal.html');
        };
        vm.cancelDeleteLesson = function () { if (!vm.lessonDeleting) { vm.lessonDeleteDialog.dismiss(); } };
        vm.deleteLesson = function () {
            if (!vm.canDelete || vm.lessonDeleting) { return; }
            vm.lessonDeleting = true; vm.lessonDeleteError = '';
            return lessons.deleteObject(vm.lessonDeleteDraft.id).then(function (ok) {
                if (ok !== true) { vm.lessonDeleteError = 'Máy chủ chưa xác nhận xóa bài. Vui lòng thử lại.'; return; }
                vm.lessonDeleteDialog.close(); vm.selectLesson(null, 'all'); vm.loadLessons(); vm.loadUsage();
                toastr.success('Đã xóa bài. Các từ vựng vẫn được giữ trong thư viện.');
            }, function () { vm.lessonDeleteError = 'Không xóa được bài từ vựng. Bài có thể đang được sử dụng; hãy liên hệ quản trị viên để được hỗ trợ.'; })
                .finally(function () { vm.lessonDeleting = false; });
        };
        vm.saveLesson = function () {
            if (vm.lessonSaving) { return; }
            var draft = vm.lessonDraft; vm.lessonSaveError = '';
            if (!draft.name || !draft.name.trim()) { vm.lessonSaveError = 'Vui lòng nhập tên bài từ vựng.'; return; }
            if (draft.name.trim().length > 200) { vm.lessonSaveError = 'Tên bài tối đa 200 ký tự.'; return; }
            if (!draft.topicCategory || !draft.topicCategory.id) { vm.lessonSaveError = 'Vui lòng chọn nhóm bài từ vựng.'; return; }
            if (!draft.id && vm.usage && vm.usage.topicLimitReached) { vm.lessonSaveError = vm.usage.topicLimitMessage; return; }
            vm.lessonSaving = true;
            var payload = angular.copy(draft); payload.name = payload.name.trim();
            return lessons.saveObject(payload).then(function (data) {
                if (!data || !data.id) { vm.lessonSaveError = data && data.message || 'Chưa lưu được bài từ vựng.'; vm.loadUsage(); return; }
                vm.lessonDialog.close(data); vm.loadLessons(); vm.selectLesson(data); vm.loadUsage(); toastr.success('Đã lưu bài từ vựng.');
            }, function (error) { vm.lessonSaveError = errorMessage(error, 'Không lưu được bài từ vựng. Nội dung của bạn được giữ lại.'); })
                .finally(function () { vm.lessonSaving = false; });
        };
        vm.openCard = function (card) {
            vm.cardDraft = card ? angular.copy(card) : {question: '', pronounce: '', motherTongue: '',
                userId: vm.user.id, questionType: {id: 6}, status: vm.isAdmin && vm.status === 5 ? 5 : 1};
            vm.cardDraft.level = vm.cardDraft.level || '';
            var seenTopics = new Set();
            vm.cardTopics = (vm.cardDraft.questionTopics || []).map(function (link) { return link && link.topic; })
                .filter(function (topic) {
                    if (!topic || !topic.id || seenTopics.has(String(topic.id))) { return false; }
                    seenTopics.add(String(topic.id)); return true;
                }).sort(function (left, right) {
                    return (left.name || '').localeCompare(right.name || '', 'vi', {numeric: true, sensitivity: 'base'});
                });
            vm.cardLesson = card ? null : vm.activeLesson;
            vm.cardLessonChoices = vm.lessons;
            vm.cardSaveError = ''; vm.advancedOpen = false; vm.cardDialog = openDialog('vocabulary_card_modal.html');
            if (!card) { vm.loadUsage(); }
        };
        vm.cancelCard = function () { if (!vm.cardSaving) { vm.cardDialog.dismiss(); } };
        var choiceRequest = 0;
        vm.findLessonChoices = function (query) {
            var request = ++choiceRequest;
            return lessons.getPage({textSearch: query, userId: vm.user.id}, 1, 50).then(function (data) {
                if (alive && request === choiceRequest) { vm.cardLessonChoices = data && data.content || []; }
            }, function () { toastr.error('Không tìm được bài từ vựng. Vui lòng thử lại.'); });
        };
        vm.saveCard = function () {
            if (vm.cardSaving) { return; }
            var draft = vm.cardDraft; vm.cardSaveError = vm.cardError(draft);
            if (vm.cardSaveError) { return; }
            if (!draft.id && vm.usage && vm.usage.wordLimitReached) { vm.cardSaveError = vm.usage.wordLimitMessage; return; }
            var payload = angular.copy(draft); payload.question = payload.question.trim();
            if (!draft.id) { payload.questionTopics = vm.cardLesson ? [{topic: {id: vm.cardLesson.id}}] : []; }
            vm.cardSaving = true;
            return cards.saveObject(payload).then(function (data) {
                if (!data || !data.id) { vm.cardSaveError = data && data.message || 'Máy chủ chưa xác nhận lưu từ. Vui lòng thử lại.'; vm.loadUsage(); return; }
                vm.cardDialog.close(data);
                if (!draft.id && vm.cardLesson && (!vm.activeLesson || vm.cardLesson.id !== vm.activeLesson.id)) { vm.selectLesson(vm.cardLesson); }
                else { if (!draft.id && !vm.isAdmin && vm.status === 5) { vm.status = 0; } vm.loadCards(!draft.id); }
                vm.loadUsage();
                toastr.success(draft.id ? 'Đã lưu thay đổi.' : 'Đã thêm từ' + (vm.cardLesson ? ' vào bài ' + vm.cardLesson.name : '') + '.');
            }, function (error) { vm.cardSaveError = errorMessage(error, 'Không lưu được từ. Nội dung của bạn được giữ lại.'); })
                .finally(function () { vm.cardSaving = false; });
        };
        vm.confirmDelete = function (card) {
            if (!vm.canDelete || vm.deleting || vm.deleteDialogOpen) { return; }
            vm.deleteTargets = angular.copy(card ? [card] : vm.selectedCards());
            if (!vm.deleteTargets.length) { return; }
            vm.deleteError = ''; vm.deleteDialogOpen = true;
            vm.deleteDialog = openDialog('vocabulary_delete_modal.html');
            vm.deleteDialog.result.finally(function () { vm.deleteDialogOpen = false; }).catch(angular.noop);
        };
        vm.cancelDelete = function () { if (!vm.deleting) { vm.deleteDialog.dismiss(); } };
        vm.deleteCards = function () {
            if (vm.deleting || !vm.deleteTargets.length) { return; }
            vm.deleting = true; vm.deleteError = ''; var failed = [], removed = 0;
            var pending = $q.when();
            vm.deleteTargets.forEach(function (card) {
                pending = pending.then(function () {
                    return cards.deleteObject(card.id).then(function (ok) { if (ok === true) { removed++; } else { failed.push(card); } }, function () { failed.push(card); });
                });
            });
            return pending.then(function () {
                if (removed) { vm.loadUsage(); vm.loadCards(); toastr.success('Đã xóa ' + removed + ' thẻ từ vựng.'); }
                if (failed.length) { vm.deleteTargets = failed; vm.deleteError = 'Chưa xóa được ' + failed.length + ' thẻ. Bạn có thể thử lại các thẻ còn lại.'; }
                else { vm.deleteDialog.close(); }
            }).finally(function () { vm.deleting = false; });
        };
        vm.importTopicCreated = function (topic) { vm.loadLessons(); vm.selectLesson(topic); vm.loadUsage(); };
        vm.imported = function () { vm.loadCards(true); vm.loadUsage(); vm.loadLessons(); };
        vm.exportCards = function () {
            if (vm.exporting) { return; }
            if (!$window.ExcelJS || !$window.saveAs) { toastr.error('Chưa tải được thư viện Excel. Vui lòng tải lại trang rồi thử lại.'); return; }
            var filter = angular.copy(vm.searchPayload()), name = vm.title(), words = []; vm.exporting = true;
            function read(page) {
                return cards.getVocabularyPage(filter, page, 500).then(function (data) {
                    var batch = data && data.content || []; words = words.concat(batch);
                    if (words.length < (data && data.totalElements || 0) && batch.length) { return read(page + 1); }
                });
            }
            return read(1).then(function () {
                var book = new $window.ExcelJS.Workbook(), sheet = book.addWorksheet('Flashcards');
                sheet.columns = [{header: 'Word', key: 'word', width: 30}, {header: 'Pronounce', key: 'pronounce', width: 24},
                    {header: 'First language', key: 'meaning', width: 48}, {header: 'CEFR level', key: 'level', width: 14}];
                words.forEach(function (card) { sheet.addRow({word: card.question, pronounce: card.pronounce, meaning: card.motherTongue, level: card.level}); });
                sheet.getRow(1).font = {bold: true}; sheet.views = [{state: 'frozen', ySplit: 1}];
                return book.xlsx.writeBuffer();
            }).then(function (buffer) {
                $window.saveAs(new $window.Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
                    name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) + '.xlsx');
                toastr.success('Đã xuất ' + words.length + ' từ vựng.');
            }).catch(function (error) { toastr.error(errorMessage(error, 'Không xuất được Excel. Vui lòng thử lại.')); })
                .finally(function () { vm.exporting = false; });
        };
        vm.loadCategories = function () {
            vm.categoriesError = ''; vm.categoriesLoading = true; var collected = [];
            function read(page) {
                return lessons.getPageTopicCategory({}, page, 100).then(function (data) {
                    collected = collected.concat(data && data.content || []);
                    if (page < (data && data.totalPages || 1)) { return read(page + 1); }
                    vm.categories = collected;
                });
            }
            return read(1).catch(function () { vm.categoriesError = 'Không tải được nhóm bài từ vựng. Vui lòng thử lại.'; })
                .finally(function () { vm.categoriesLoading = false; });
        };
        vm.loadUsage(); vm.loadLessons(); vm.loadCategories();
        var initial = $location.search().lesson;
        if (initial && /^\d+$/.test(initial)) {
            var initialSelection = lessonSelection;
            lessons.getOne(Number(initial)).then(function (lesson) {
                if (!alive || lessonSelection !== initialSelection) { return; }
                if (alive && lesson && lesson.id) { vm.selectLesson(lesson); }
                else if (alive) { vm.selectLesson(null); toastr.info('Bài không còn khả dụng. Đang hiển thị tất cả từ.'); }
            }, function () { if (alive && lessonSelection === initialSelection) { vm.selectLesson(null); toastr.error('Không mở được bài đã chọn.'); } });
        } else { vm.view = initial === 'unassigned' ? 'unassigned' : 'all'; vm.loadCards(); }
    }
})();
