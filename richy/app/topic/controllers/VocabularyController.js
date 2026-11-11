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
        var selectionRequest = 0, moveLessonRequest = 0;
        vm.user = JSON.parse($cookies.get('education.user') || '{}');
        vm.isAdmin = settings.isAdmin === true;
        vm.canDelete = vm.isAdmin || (vm.user.roles || []).some(function (role) { return role.name === 'ROLE_USER'; });
        vm.canManageCategories = vm.canDelete || (vm.user.roles || []).some(function (role) { return role.name === 'ROLE_VIEWER'; });
        vm.lessons = []; vm.categories = []; vm.cards = []; vm.selected = {}; vm.selectedCount = 0;
        vm.lessonPage = 0; vm.lessonPageSize = 20; vm.lessonTotal = 0;
        vm.page = 1; vm.pageSize = 8; vm.total = 0; vm.status = 0; vm.query = '';
        vm.findExactWord = true;
        vm.pageSizeInput = vm.pageSize;
        vm.pageSizeLimit = 100;
        var categoriesById = new Map(), childrenByCategory = new Map(), expandedCategories = new Set();
        var uncategorized = {id: 'uncategorized', name: 'Bài chưa phân nhóm'};
        var unassignedWords = {id: 'unassigned', name: 'Chưa vào bài'};
        vm.view = 'browse'; vm.lessonPickerOpen = true;
        vm.isUncategorized = function () { return vm.view === 'category' && vm.lessonCategory === uncategorized; };
        vm.lessonQuery = ''; vm.categoryQuery = ''; vm.categoryRows = [];
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
            if (!vm.lessonCategory || vm.lessonCategory === unassignedWords) { return; }
            var page = vm.lessonPage + 1;
            var request = ++lessonRequest;
            vm.lessonsLoading = true;
            vm.lessonError = '';
            var search = {userId: vm.user.id, username: vm.user.username, textSearch: vm.lessonQuery};
            if (vm.lessonCategory.id === uncategorized.id) { search.withoutCategory = true; }
            else { search.topicCategory = {id: vm.lessonCategory.id}; }
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
                if (vm.view === 'category') { updateSelectAllChecked(); }
                vm.hasMoreLessons = incoming.length > 0 && page * vm.lessonPageSize < vm.lessonTotal;
                vm.importTopics = vm.activeLesson ? [vm.activeLesson] : vm.lessons;
            }, function (error) {
                if (alive && request === lessonRequest) { vm.lessonError = errorMessage(error, 'Không tải được danh sách bài. Vui lòng thử lại.'); }
            }).finally(function () {
                if (alive && request === lessonRequest) { vm.lessonsLoading = false; }
            });
        }
        vm.loadLessons = function () {
            if (vm.view === 'category') { clearSelection(); }
            lessonRequest++;
            vm.lessonPage = 0;
            vm.lessonTotal = 0;
            vm.lessons = [];
            vm.hasMoreLessons = false;
            vm.lessonsLoading = false;
            vm.lessonError = '';
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
        function clearSelection() {
            selectionRequest++;
            vm.selected = {};
            vm.selectedCount = 0;
            vm.selectAllChecked = false;
            vm.selectionLoading = false;
        }
        function updateSelectAllChecked() {
            var total = vm.view === 'category' ? vm.lessonTotal : vm.total;
            vm.selectAllChecked = total > 0 && vm.selectedCount === total;
        }
        function lessonSourceId() {
            return vm.isUncategorized() ? null : vm.lessonCategory.id;
        }
        vm.loadCards = function (reset) {
            if (!vm.activeLesson && vm.view !== 'unassigned') { return; }
            if (reset) { vm.page = 1; clearSelection(); }
            var request = ++cardRequest; vm.cardsLoading = true; vm.cardLoadError = '';
            if (cardCancellation) { cardCancellation.resolve(); }
            if (cardDeadline) { $timeout.cancel(cardDeadline); }
            var cancellation = $q.defer(), timedOut = false;
            cardCancellation = cancellation;
            cardDeadline = $timeout(function () { timedOut = true; cancellation.resolve(); }, 30000);
            vm.cards = []; vm.total = 0;
            return cards.getVocabularyPage(vm.searchPayload(), vm.page, vm.pageSize, {timeout: cancellation.promise}).then(function (data) {
                if (!alive || request !== cardRequest) { return; }
                vm.cards = data && data.content || []; vm.total = data && data.totalElements || 0;
                updateSelectAllChecked();
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
        vm.selectLesson = function (lesson, view, refreshLessons) {
            lessonSelection++;
            vm.activeLesson = lesson || null; vm.view = lesson ? 'lesson' : view || 'browse';
            vm.query = ''; vm.lessonPickerOpen = false;
            if (lesson) {
                var category = lesson.topicCategory;
                var selectedCategory = lessonFolder(category) || uncategorized;
                if (!vm.lessonCategory || String(vm.lessonCategory.id) !== String(selectedCategory.id)) {
                    setLessonCategory(selectedCategory);
                } else if (refreshLessons) {
                    vm.loadLessons();
                }
            }
            vm.importTopics = lesson ? [lesson] : vm.lessons;
            $location.search('lesson', lesson ? String(lesson.id) : vm.view === 'unassigned' ? 'unassigned' : null).replace();
            if (lesson || vm.view === 'unassigned') { return vm.loadCards(true); }
            cardRequest++;
            if (cardCancellation) { cardCancellation.resolve(); cardCancellation = null; }
            if (cardDeadline) { $timeout.cancel(cardDeadline); cardDeadline = null; }
            clearSelection();
            vm.cards = []; vm.total = 0; vm.cardsLoading = false; vm.cardLoadError = '';
        };
        vm.title = function () { return vm.activeLesson ? vm.activeLesson.name : 'Từ chưa vào bài'; };
        function lessonFolder(category) {
            return category ? categoriesById.get(String(category.id)) || (vm.isAdmin ? category : null) : null;
        }
        function categoryPath(category) {
            var path = [], visited = new Set();
            while (category && !visited.has(String(category.id))) {
                visited.add(String(category.id)); path.unshift(category);
                category = categoriesById.get(String(category.parentId));
            }
            return path;
        }
        function setLessonCategory(category) {
            vm.lessonCategory = category;
            vm.lessonQuery = '';
            vm.categoryPath = categoryPath(category);
            vm.categoryChildren = category ? childrenByCategory.get(String(category.id)) || [] : [];
            vm.categoryPath.forEach(function (node) { expandedCategories.add(String(node.id)); });
            vm.rebuildCategoryRows();
            $location.search('category', category ? String(category.id) : null).replace();
            vm.loadLessons();
        }
        vm.selectCategory = function (category) {
            vm.selectLesson(null, category ? 'category' : 'browse');
            setLessonCategory(category);
            if (!category) { vm.lessonPickerOpen = true; }
        };
        vm.selectUncategorized = function () { vm.selectCategory(uncategorized); };
        vm.openUnassigned = function () {
            setLessonCategory(unassignedWords);
            return vm.selectLesson(null, 'unassigned');
        };
        vm.backToCategory = function () { vm.selectLesson(null, 'category'); };
        function categorySearchText(value) {
            return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
        }
        vm.rebuildCategoryRows = function () {
            var query = categorySearchText(vm.categoryQuery);
            var matches = new Set();
            vm.categories.forEach(function (category) {
                if (query && categorySearchText(category.name).indexOf(query) >= 0) {
                    categoryPath(category).forEach(function (node) { matches.add(String(node.id)); });
                }
            });
            var rows = [];
            function append(nodes, level) {
                (nodes || []).forEach(function (category) {
                    var id = String(category.id);
                    if (query && !matches.has(id)) { return; }
                    var descendants = childrenByCategory.get(id) || [];
                    var hasChildren = descendants.some(function (child) { return !query || matches.has(String(child.id)); });
                    var expanded = hasChildren && (query !== '' || expandedCategories.has(id));
                    rows.push({category: category, indent: Math.min(level, 6) * 16, hasChildren: hasChildren, expanded: expanded});
                    if (expanded) { append(descendants, level + 1); }
                });
            }
            append(childrenByCategory.get(''), 0);
            vm.categoryRows = rows;
        };
        vm.toggleCategory = function (row) {
            var id = String(row.category.id);
            if (expandedCategories.has(id)) { expandedCategories.delete(id); }
            else { expandedCategories.add(id); }
            vm.rebuildCategoryRows();
        };
        vm.pageCount = function () { return Math.max(1, Math.ceil(vm.total / vm.pageSize)); };
        vm.applyPageSize = function () {
            var size = vm.pageSizeInput;
            if (vm.bulkSaving || !Number.isInteger(size) || size < 1 || size > vm.pageSizeLimit || size === vm.pageSize) {
                return;
            }
            vm.pageSize = size;
            vm.page = 1;
            return vm.loadCards();
        };
        vm.changePage = function (step) { vm.page += step; return vm.loadCards(); };
        vm.toggleSelection = function (id) {
            if (vm.selected[id]) { vm.selectedCount++; }
            else { delete vm.selected[id]; vm.selectedCount--; }
            updateSelectAllChecked();
        };
        vm.toggleAll = function () {
            if (!vm.selectAllChecked) { clearSelection(); return; }
            var request = ++selectionRequest;
            vm.selectionLoading = true;
            var selection = vm.view === 'category'
                ? lessons.getLessonSelection(lessonSourceId(), vm.lessonQuery)
                : cards.getVocabularySelection(vm.searchPayload());
            return selection.then(function (ids) {
                if (!alive || request !== selectionRequest) { return; }
                if (!angular.isArray(ids)) { throw new Error('Invalid vocabulary selection'); }
                vm.selected = {};
                ids.forEach(function (id) { vm.selected[id] = true; });
                vm.selectedCount = ids.length;
                vm.selectAllChecked = ids.length > 0;
            }).catch(function (error) {
                if (!alive || request !== selectionRequest) { return; }
                vm.selectAllChecked = false;
                toastr.error(errorMessage(error, 'Không chọn được tất cả. Vui lòng thử lại.'));
            }).finally(function () {
                if (alive && request === selectionRequest) { vm.selectionLoading = false; }
            });
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
            var category = vm.lessonCategory;
            vm.lessonDraft = {userId: vm.user.id, name: '', topicCategory: category && categoriesById.get(String(category.id)) || null, isShow: true};
            vm.lessonSaveError = ''; vm.lessonDialog = openDialog('vocabulary_lesson_modal.html');
            vm.loadUsage();
        };
        vm.editLesson = function () {
            if (!vm.activeLesson || vm.lessonOpening) { return; }
            vm.lessonOpening = true;
            return lessons.getOne(vm.activeLesson.id).then(function (data) {
                if (!data || !data.id) { throw new Error('Bài không còn tồn tại.'); }
                vm.lessonDraft = angular.copy(data);
                vm.lessonDraft.topicCategory = lessonFolder(data.topicCategory);
                vm.lessonSaveError = ''; vm.lessonDialog = openDialog('vocabulary_lesson_modal.html');
            }).catch(function (error) { toastr.error(errorMessage(error, error.message || 'Không mở được bài từ vựng.')); })
                .finally(function () { vm.lessonOpening = false; });
        };
        vm.cancelLesson = function () { if (!vm.lessonSaving) { vm.lessonDialog.dismiss(); } };
        vm.confirmDeleteLesson = function (fromEditor) {
            var lesson = fromEditor ? vm.lessonDraft : vm.activeLesson;
            if (!vm.canDelete || !lesson || !lesson.id || vm.lessonOpening || vm.lessonSaving || vm.lessonDeleteDialog) { return; }
            vm.lessonDeleteDraft = {id: lesson.id, name: lesson.name};
            vm.lessonDeleteError = '';
            if (fromEditor) { vm.lessonDialog.dismiss(); }
            var dialog = vm.lessonDeleteDialog = openDialog('vocabulary_delete_lesson_modal.html');
            function clearConfirmation() { vm.lessonDeleteDialog = null; vm.lessonDeleteDraft = null; }
            dialog.result.then(clearConfirmation, clearConfirmation);
        };
        vm.cancelDeleteLesson = function () { if (!vm.lessonDeleting && vm.lessonDeleteDialog) { vm.lessonDeleteDialog.dismiss(); } };
        vm.deleteLesson = function () {
            if (!vm.canDelete || vm.lessonDeleting || !vm.lessonDeleteDialog || !vm.lessonDeleteDraft) { return; }
            var dialog = vm.lessonDeleteDialog;
            vm.lessonDeleting = true; vm.lessonDeleteError = '';
            return lessons.deleteObject(vm.lessonDeleteDraft.id).then(function (ok) {
                if (!alive || vm.lessonDeleteDialog !== dialog) { return; }
                if (ok !== true) { vm.lessonDeleteError = 'Máy chủ chưa xác nhận xóa bài. Vui lòng thử lại.'; return; }
                dialog.close(); vm.backToCategory(); vm.loadLessons(); vm.loadUsage();
                toastr.success('Đã xóa bài. Các từ vựng vẫn được giữ trong thư viện.');
            }, function () { vm.lessonDeleteError = 'Không xóa được bài từ vựng. Bài có thể đang được sử dụng; hãy liên hệ quản trị viên để được hỗ trợ.'; })
                .finally(function () { vm.lessonDeleting = false; });
        };
        vm.saveLesson = function () {
            if (vm.lessonSaving) { return; }
            var draft = vm.lessonDraft; vm.lessonSaveError = '';
            if (!draft.name || !draft.name.trim()) { vm.lessonSaveError = 'Vui lòng nhập tên bài từ vựng.'; return; }
            if (draft.name.trim().length > 200) { vm.lessonSaveError = 'Tên bài tối đa 200 ký tự.'; return; }
            if (!draft.id && (!draft.topicCategory || !draft.topicCategory.id)) {
                vm.lessonSaveError = 'Vui lòng chọn nhóm bài từ vựng.'; return;
            }
            if (!draft.id && vm.usage && vm.usage.topicLimitReached) { vm.lessonSaveError = vm.usage.topicLimitMessage; return; }
            vm.lessonSaving = true;
            var payload = angular.copy(draft); payload.name = payload.name.trim();
            return lessons.saveObject(payload).then(function (data) {
                if (!data || !data.id) { vm.lessonSaveError = data && data.message || 'Chưa lưu được bài từ vựng.'; vm.loadUsage(); return; }
                vm.lessonDialog.close(data);
                vm.selectLesson(data, null, true); vm.loadUsage(); toastr.success('Đã lưu bài từ vựng.');
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
                clearSelection();
                if (!draft.id && vm.cardLesson && (!vm.activeLesson || vm.cardLesson.id !== vm.activeLesson.id)) { vm.selectLesson(vm.cardLesson); }
                else { if (!draft.id && !vm.isAdmin && vm.status === 5) { vm.status = 0; } vm.loadCards(!draft.id); }
                vm.loadUsage();
                toastr.success(draft.id ? 'Đã lưu thay đổi.' : 'Đã thêm từ' + (vm.cardLesson ? ' vào bài ' + vm.cardLesson.name : '') + '.');
            }, function (error) { vm.cardSaveError = errorMessage(error, 'Không lưu được từ. Nội dung của bạn được giữ lại.'); })
                .finally(function () { vm.cardSaving = false; });
        };
        function confirmBulkAction(move, card) {
            if (!vm.canDelete || vm.selectionLoading || vm.bulkDialog) { return; }
            var lessonList = vm.view === 'category';
            if (lessonList && !move && !vm.isUncategorized()) { return; }
            var ids = card ? [card.id] : Object.keys(vm.selected).map(Number);
            if (!ids.length) { return; }
            var sourceCategoryId = lessonList ? lessonSourceId() : null;
            vm.bulkDraft = {move: move, ids: ids, lessons: lessonList, sourceTopicId: vm.activeLesson ? vm.activeLesson.id : null,
                sourceCategoryId: sourceCategoryId, sourceTitle: lessonList ? vm.lessonCategory.name : vm.title(),
                word: card && card.question, target: null};
            if (lessonList && move) {
                vm.moveCategoryChoices = vm.categories.filter(function (category) { return String(category.id) !== String(sourceCategoryId); });
            }
            vm.bulkError = ''; vm.moveLessonError = ''; vm.moveLessonChoices = [];
            var dialog = vm.bulkDialog = openDialog('vocabulary_bulk_modal.html');
            function clearDialog() { vm.bulkDialog = null; vm.bulkDraft = null; moveLessonRequest++; }
            dialog.result.then(clearDialog, clearDialog);
        }
        vm.confirmDelete = function (card) { confirmBulkAction(false, card); };
        vm.confirmMove = function () { confirmBulkAction(true); };
        vm.cancelBulkAction = function () { if (vm.bulkDialog && !vm.bulkSaving) { vm.bulkDialog.dismiss(); } };
        vm.findMoveLessons = function (query) {
            var draft = vm.bulkDraft;
            if (!draft || !draft.move || draft.lessons) { return; }
            var request = ++moveLessonRequest;
            vm.moveLessonError = '';
            return lessons.getPage({textSearch: query, userId: vm.user.id}, 1, 50).then(function (data) {
                if (!alive || request !== moveLessonRequest) { return; }
                vm.moveLessonChoices = (data && data.content || []).filter(function (lesson) {
                    return lesson.id !== draft.sourceTopicId;
                });
            }, function (error) {
                if (alive && request === moveLessonRequest) { vm.moveLessonError = errorMessage(error, 'Không tìm được bài đích. Vui lòng thử lại.'); }
            });
        };
        vm.applyBulkAction = function () {
            var draft = vm.bulkDraft, dialog = vm.bulkDialog;
            if (vm.bulkSaving || !draft || !dialog || (draft.move && !draft.target)) { return; }
            vm.bulkSaving = true; vm.bulkError = '';
            var action = draft.move ? 'move' : 'delete', targetId = draft.move ? draft.target.id : null;
            var change = draft.lessons
                ? lessons.changeLessons(draft.sourceCategoryId, action, {lessonIds: draft.ids, targetCategoryId: targetId})
                : cards.changeVocabularyCards(action, {cardIds: draft.ids, sourceTopicId: draft.sourceTopicId, targetTopicId: targetId});
            return change.then(function (count) {
                if (!alive || vm.bulkDialog !== dialog) { return; }
                if (count !== draft.ids.length) { vm.bulkError = 'Máy chủ chưa xác nhận thao tác. Hãy tải lại danh sách để kiểm tra.'; return; }
                dialog.close();
                if (draft.lessons) { vm.loadLessons(); }
                else { clearSelection(); vm.loadCards(); }
                if (!draft.move) { vm.loadUsage(); }
                var items = count + (draft.lessons ? ' bài từ vựng' : ' thẻ từ vựng');
                var targetName = draft.target && (draft.target.pathLabel || draft.target.name);
                toastr.success(draft.move ? 'Đã di chuyển ' + items + ' vào ' + targetName + '.' : 'Đã xóa ' + items + '.');
            }, function (error) {
                if (alive && vm.bulkDialog === dialog) {
                    vm.bulkError = errorMessage(error, 'Không xác nhận được thao tác. Hãy tải lại danh sách để kiểm tra.');
                }
            }).finally(function () { vm.bulkSaving = false; });
        };
        vm.importTopicCreated = function (topic) { vm.selectLesson(topic, null, true); vm.loadUsage(); };
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
            if (vm.categoriesLoading) { return; }
            vm.categoriesError = ''; vm.categoriesLoading = true; var collected = [];
            function read(page) {
                return lessons.getPageTopicCategory({personalLibrary: true}, page, 100).then(function (data) {
                    collected = collected.concat(data && data.content || []);
                    if (page < (data && data.totalPages || 1)) { return read(page + 1); }
                    if (!alive) { return; }
                    vm.categories = collected.sort(function (left, right) { return (left.name || '').localeCompare(right.name || '', 'vi', {numeric: true}); });
                    categoriesById = new Map(vm.categories.map(function (category) { return [String(category.id), category]; }));
                    childrenByCategory = new Map();
                    vm.categories.forEach(function (category) {
                        var parent = categoriesById.has(String(category.parentId)) ? String(category.parentId) : '';
                        if (!childrenByCategory.has(parent)) { childrenByCategory.set(parent, []); }
                        childrenByCategory.get(parent).push(category);
                        category.pathLabel = categoryPath(category).map(function (node) { return node.name; }).join(' / ');
                    });
                    if (vm.lessonCategory) {
                        vm.lessonCategory = categoriesById.get(String(vm.lessonCategory.id)) || vm.lessonCategory;
                        vm.categoryPath = categoryPath(vm.lessonCategory);
                        vm.categoryChildren = childrenByCategory.get(String(vm.lessonCategory.id)) || [];
                        vm.categoryPath.slice(0, -1).forEach(function (node) { expandedCategories.add(String(node.id)); });
                    }
                    vm.rebuildCategoryRows();
                });
            }
            return read(1).catch(function () { vm.categoriesError = 'Không tải được nhóm bài từ vựng. Vui lòng thử lại.'; })
                .finally(function () { vm.categoriesLoading = false; });
        };
        vm.editCategory = function (category, parent) {
            if (!vm.canManageCategories || vm.categoriesLoading || vm.categoriesError || vm.categorySaving) { return; }
            vm.categoryDraft = {id: category ? category.id : null, name: category ? category.name : '',
                parentId: category ? category.parentId || null : parent ? parent.id : null};
            var personal = !vm.isAdmin || !!((category || parent || {}).personal);
            vm.categoryParentChoices = vm.categories.filter(function (candidate) {
                return (!vm.isAdmin || !!candidate.personal === personal) &&
                    (!category || !categoryPath(candidate).some(function (node) { return node.id === category.id; }));
            });
            vm.categorySaveError = '';
            vm.categoryDialog = openDialog('vocabulary_category_modal.html');
        };
        vm.saveCategory = function () {
            if (!vm.canManageCategories || vm.categorySaving) { return; }
            var draft = vm.categoryDraft;
            vm.categorySaving = true; vm.categorySaveError = '';
            return lessons.saveCategory(draft).then(function (saved) {
                if (saved !== true) { vm.categorySaveError = 'Máy chủ chưa xác nhận lưu nhóm bài.'; return; }
                if (draft.parentId != null) { expandedCategories.add(String(draft.parentId)); }
                vm.categoryQuery = '';
                vm.categoryDialog.close(); vm.loadCategories(); toastr.success('Đã lưu nhóm bài từ vựng.');
            }, function (error) { vm.categorySaveError = errorMessage(error, 'Không lưu được nhóm bài. Vui lòng thử lại.'); })
                .finally(function () { vm.categorySaving = false; });
        };
        vm.confirmDeleteCategory = function (category) {
            if (!vm.canManageCategories || !category || !(category.id > 0) || vm.categoryDeleteDialog) { return; }
            vm.categoryDeleteDraft = category;
            vm.categoryDeleteError = '';
            var dialog = vm.categoryDeleteDialog = openDialog('vocabulary_delete_category_modal.html');
            function clearConfirmation() { vm.categoryDeleteDialog = null; vm.categoryDeleteDraft = null; }
            dialog.result.then(clearConfirmation, clearConfirmation);
        };
        vm.deleteCategory = function () {
            if (!vm.canManageCategories || vm.categoryDeleting || !vm.categoryDeleteDraft || !vm.categoryDeleteDialog) { return; }
            var category = vm.categoryDeleteDraft, dialog = vm.categoryDeleteDialog;
            vm.categoryDeleting = true; vm.categoryDeleteError = '';
            return lessons.deleteCategory(category.id).then(function (ok) {
                if (!alive || vm.categoryDeleteDialog !== dialog) { return; }
                if (ok !== true) { vm.categoryDeleteError = 'Máy chủ chưa xác nhận xóa nhóm. Vui lòng thử lại.'; return; }
                dialog.close();
                expandedCategories.delete(String(category.id));
                if (vm.lessonCategory && String(vm.lessonCategory.id) === String(category.id)) {
                    vm.selectCategory(categoriesById.get(String(category.parentId)) || null);
                }
                vm.loadCategories();
                toastr.success('Đã xóa nhóm bài từ vựng.');
            }, function (error) {
                vm.categoryDeleteError = errorMessage(error, 'Không xóa được nhóm bài. Vui lòng thử lại.');
            }).finally(function () { vm.categoryDeleting = false; });
        };
        vm.loadUsage();
        var initial = $location.search();
        var initialCategory = initial.category, initialLesson = initial.lesson;
        vm.loadCategories().then(function () {
            if (!alive || lessonSelection) { return; }
            if (initialLesson === 'unassigned' || initialCategory === unassignedWords.id) { vm.openUnassigned(); return; }
            var category = categoriesById.get(String(initialCategory));
            if (initialCategory === uncategorized.id || (!category && !vm.isAdmin && /^\d+$/.test(initialCategory || ''))) {
                category = uncategorized;
            }
            if (category) {
                vm.view = 'category'; vm.lessonPickerOpen = false;
                setLessonCategory(category);
            }
            if (initialLesson && /^\d+$/.test(initialLesson)) {
                var initialSelection = lessonSelection;
                lessons.getOne(Number(initialLesson)).then(function (lesson) {
                    if (!alive || lessonSelection !== initialSelection) { return; }
                    if (lesson && lesson.id && (vm.isAdmin || String(lesson.userId) === String(vm.user.id))) { vm.selectLesson(lesson); }
                    else {
                        $location.search('lesson', null).replace();
                        toastr.info('Bài không còn khả dụng. Hãy chọn nhóm để tìm bài khác.');
                    }
                }, function () {
                    if (alive && lessonSelection === initialSelection) { toastr.error('Không mở được bài đã chọn.'); }
                });
            }
        });
    }
})();
