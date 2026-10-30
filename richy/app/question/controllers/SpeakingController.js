(function () {
    'use strict';
    angular.module('Hrm.Question').directive('speakingFile', ['$parse', function ($parse) {
        return {restrict: 'A', link: function (scope, element, attrs) {
            var callback = $parse(attrs.speakingFile);
            function changed(event) { var file = event.target.files && event.target.files[0]; scope.$evalAsync(function () { callback(scope, {file: file}); }); element.val(''); }
            element.on('change', changed); scope.$on('$destroy', function () { element.off('change', changed); });
        }};
    }]);
    angular.module('Hrm.Question').controller('SpeakingController', ['$scope', '$rootScope', '$window', '$location', '$interval', '$q', 'settings', 'SpeakingService', 'SpeakingRecorder', '$sce', '$state',
        function ($scope, $rootScope, $window, $location, $interval, $q, settings, api, recorder, $sce, $state) {
            var vm = this, alive = true, bankGeneration = 0, practiceGeneration = 0, rosterGeneration = 0, studentViewGeneration = 0, progressQueue = $q.when(), lastTick = Date.now(), tickCount = 0, audioUrl = null;
            vm.managementMode = !!($state && $state.current && $state.current.data && $state.current.data.speakingManagement === true);
            vm.directorySchoolId = 1;
            vm.loading = true; vm.error = ''; vm.sets = []; vm.classes = []; vm.students = []; vm.studentCache = {}; vm.groups = []; vm.questions = [];
            vm.part = 1; vm.query = ''; vm.groupPage = 0; vm.recorder = recorder; vm.importRows = []; vm.importPage = 1;
            vm.adminStudentRows = []; vm.adminPage = 0; vm.adminPageSize = 25; vm.adminTotal = 0; vm.adminStudentQuery = '';
            vm.importLabels = {NEW: 'Chưa import', UNCHANGED: 'Đã import', UPDATE_SAMPLE: 'Sample / liên kết thay đổi', CHANGED: 'Cách hỏi thay đổi', INVALID: 'Cần sửa'};
            vm.newSet = {year: new Date().getFullYear(), number: 1};
            vm.practiceConfig = {parts: {1: true, 2: true, 3: true}, setIds: [], part1Count: 5, part3Count: 4, onlyUnpassed: false};
            $rootScope.settings.layout.pageContentWhite = true;
            function message(error) { return (error && error.data && error.data.message) || (error && error.message) || 'Chưa xử lý được. Hãy kiểm tra kết nối và thử lại.'; }
            function fail(error) { if (alive) { vm.error = message(error); } }
            function owner() { return vm.selectedSet && vm.selectedSet.canManage; }
            vm.canReviewStudents = function () { return vm.managementMode && vm.selectedSet && (vm.selectedSet.canReviewStudents === true || (vm.selectedSet.canReviewStudents == null && vm.selectedSet.canManage)); };
            vm.answerStudentId = function () { return Number((vm.managementMode && vm.studentId) || vm.userId); };
            vm.answerStudentLabel = function () { return vm.managementMode && vm.studentId ? vm.studentLabel(vm.studentId) : 'Câu trả lời của tôi'; };
            vm.canOpenAnswer = function () { return !vm.managementMode || (vm.studentId && (!vm.isAdmin || vm.adminViewedStudent)); };
            vm.toggleAnswer = function (question) { if (vm.loadingBank || !vm.canOpenAnswer()) { return; } vm.answerQuestionId = vm.answerQuestionId === question.id ? null : question.id; };
            vm.toggleNotebook = function (question) {
                if (vm.loadingBank || !vm.canOpenAnswer() || !question ||
                    !vm.questions.some(function (item) { return item.id === question.id; })) { return; }
                vm.notebookQuestionId = vm.notebookQuestionId === question.id ? null : question.id;
            };
            vm.closeNotebook = function () { vm.notebookQuestionId = null; };
            function ownPractice() { return !vm.managementMode && vm.practice && Number(vm.practice.studentId) === Number(vm.userId); }
            vm.ownPractice = ownPractice;
            function normalize(text) { return String(text || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
            function preferenceKey() { return 'speaking-view:v1:' + vm.userId + (vm.managementMode ? ':manage' : ''); }
            function backupKey(id) { return 'speaking-practice:v1:' + vm.userId + ':' + id; }
            function startBackupKey() { return 'speaking-start:v1:' + vm.userId; }
            function saveView() { try { $window.localStorage.setItem(preferenceKey(), JSON.stringify({setId: vm.selectedSetId, part: vm.part})); } catch (ignore) {} }
            function backupPractice() { if (!ownPractice()) { return; } try { $window.localStorage.setItem(backupKey(vm.practice.id), JSON.stringify({index: vm.practice.currentIndex, elapsed: vm.elapsedSeconds})); } catch (ignore) {} }
            function clearAudio() { if (audioUrl) { $window.URL.revokeObjectURL(audioUrl); audioUrl = null; } vm.audioSource = null; }
            function updateClock() {
                var now = Date.now();
                if (ownPractice() && vm.practice.status === 'ACTIVE' && !$window.document.hidden) { vm.elapsedSeconds = Math.min(604800, (vm.elapsedSeconds || 0) + Math.max(0, (now - lastTick) / 1000)); }
                lastTick = now;
            }
            vm.clock = function () { var seconds = Math.floor(vm.elapsedSeconds || 0); return Math.floor(seconds / 60) + ':' + ('0' + seconds % 60).slice(-2); };
            vm.toggleId = function (list, id) { var index = list.indexOf(id); if (index < 0) { list.push(id); } else { list.splice(index, 1); } };
            vm.availableSets = function () { return vm.sets.filter(function (set) { return !vm.yearFilter || set.year === Number(vm.yearFilter); }); };
            vm.studentLabel = function (id) { var student = vm.studentCache[id]; return student ? student.name + ' (' + student.username + ')' : 'Học sinh #' + id; };
            function resetAdminView() {
                studentViewGeneration++; bankGeneration++; vm.studentId = null; vm.adminViewedStudent = null; vm.answerQuestionId = null; vm.notebookQuestionId = null;
                vm.adminViewEmpty = false; vm.questions = []; vm.groups = []; vm.history = []; vm.loadingBank = false;
            }
            function eligibleAdminClass(value) { var id = Number(value); return Number.isInteger(id) && id > 0 && vm.classes.some(function (item) { return Number(item.id) === id && Number(item.schoolId) === vm.directorySchoolId; }); }
            function clearInvalidClass() {
                vm.adminClassId = null; vm.adminStudentRows = []; vm.adminTotal = 0; vm.adminRosterLoading = false;
                vm.answerImportContext = null; if (vm.modal === 'answers') { vm.modal = null; } resetAdminView();
            }
            function rosterMatches(context, generation) {
                return alive && generation === rosterGeneration && context.setId === Number(vm.selectedSetId)
                    && context.classId === Number(vm.adminClassId) && eligibleAdminClass(context.classId) && context.query === String(vm.adminStudentQuery || '').trim();
            }
            vm.loadAdminStudents = function (page) {
                var generation = ++rosterGeneration, context = {setId: Number(vm.selectedSetId), classId: Number(vm.adminClassId), query: String(vm.adminStudentQuery || '').trim(), page: Number(page) || 0};
                vm.adminRosterError = ''; vm.adminPage = Math.max(0, Math.floor(context.page)); context.page = vm.adminPage;
                if (!vm.managementMode || !vm.isAdmin || !Number.isInteger(context.setId) || context.setId <= 0 || !eligibleAdminClass(context.classId)) {
                    if (vm.adminClassId && !eligibleAdminClass(context.classId)) { clearInvalidClass(); }
                    vm.adminStudentRows = []; vm.adminTotal = 0; vm.adminRosterLoading = false; return $q.when();
                }
                vm.adminRosterLoading = true; vm.adminStudentRows = [];
                if (typeof api.adminStudents !== 'function') { vm.adminRosterLoading = false; vm.adminRosterError = 'Cần cập nhật backend để mở danh sách học sinh theo lớp.'; return $q.when(); }
                return api.adminStudents(context.setId, context.classId, context.query, context.page, vm.adminPageSize).then(function (data) {
                    if (!rosterMatches(context, generation)) { return; }
                    var seen = {};
                    if (!data || Number(data.setId) !== context.setId || Number(data.classId) !== context.classId || Number(data.page) !== context.page
                            || Number(data.pageSize) !== vm.adminPageSize || !Number.isInteger(data.total) || data.total < 0 || !Array.isArray(data.students)
                            || data.students.length > vm.adminPageSize || data.students.some(function (student) {
                                if (!student || !Number.isInteger(student.id) || student.id <= 0 || typeof student.canAccess !== 'boolean' || seen[student.id]) { return true; }
                                seen[student.id] = true; return false;
                            })) { throw new Error('Danh sách học sinh không khớp lớp hoặc trang đang chọn. Hãy tải lại.'); }
                    vm.adminStudentRows = data.students; vm.adminTotal = data.total;
                    data.students.forEach(function (student) { vm.studentCache[student.id] = student; });
                }).catch(function (error) { if (rosterMatches(context, generation)) { vm.adminRosterError = message(error); vm.adminStudentRows = []; vm.adminTotal = 0; } })
                    .finally(function () { if (rosterMatches(context, generation)) { vm.adminRosterLoading = false; } });
            };
            vm.changeAdminClass = function () {
                if (!vm.managementMode || !vm.isAdmin) { return $q.when(); } resetAdminView(); vm.adminStudentQuery = ''; vm.adminPage = 0;
                if (!eligibleAdminClass(vm.adminClassId)) { vm.adminClassId = null; }
                vm.answerImportContext = null; if (vm.modal === 'answers') { vm.modal = null; }
                vm.loadBank(); return vm.loadAdminStudents(0);
            };
            vm.searchAdminStudents = function () { if (!vm.managementMode || !vm.isAdmin) { return $q.when(); } resetAdminView(); vm.loadBank(); return vm.loadAdminStudents(0); };
            vm.backToAdminClass = function () { if (!vm.managementMode) { return $q.when(); } resetAdminView(); return vm.loadBank(); };
            vm.viewAdminStudent = function (student) {
                if (!vm.managementMode || !vm.isAdmin || !eligibleAdminClass(vm.adminClassId) || !student || student.canAccess !== true || vm.busy || vm.adminRosterLoading) { return $q.when(); }
                var generation = ++studentViewGeneration, context = {setId: Number(vm.selectedSetId), classId: Number(vm.adminClassId), studentId: student.id};
                vm.studentCache[student.id] = student; vm.studentId = student.id; vm.adminViewedStudent = student;
                vm.adminViewEmpty = !(Number(student.answerCount) > 0); vm.query = ''; vm.answerQuestionId = null;
                return vm.loadBank().then(function (loaded) {
                    if (loaded !== true || !alive || generation !== studentViewGeneration || Number(vm.selectedSetId) !== context.setId
                            || Number(vm.adminClassId) !== context.classId || Number(vm.studentId) !== context.studentId) { return; }
                    var first = vm.questions.filter(function (question) { return question.id === Number(student.firstAnswerQuestionId); })[0];
                    if (first) {
                        vm.part = first.part; vm.rebuildGroups();
                        var groupIndex = vm.groups.findIndex(function (group) { return group.questions.some(function (question) { return question.id === first.id; }); });
                        if (groupIndex >= 0) { vm.groupPage = Math.floor(groupIndex / 6); }
                        vm.answerQuestionId = first.id;
                        if ($window.document.getElementById) { $window.setTimeout(function () { var target = $window.document.getElementById('sp-answer-question-' + first.id); if (alive && generation === studentViewGeneration && target) { target.scrollIntoView({behavior: 'smooth', block: 'center'}); } }, 0); }
                    } else if (Number(student.answerCount) > 0) { vm.error = 'Câu trả lời đã thay đổi sau khi tải danh sách. Bấm Làm mới ở danh sách lớp rồi chọn View lại.'; }
                });
            };
            vm.rebuildGroups = function () {
                var grouped = {}, groups = [], term = normalize(vm.query); vm.groupPage = 0; vm.notebookQuestionId = null;
                vm.questions.forEach(function (question) {
                    if (question.part !== Number(vm.part)) { return; }
                    var key = question.part + ':' + question.topic + ':' + (question.linkedPart2Id || '');
                    if (!grouped[key]) { grouped[key] = {key: key, part: question.part, title: question.topic, questions: [], passed: 0, linkedTitle: ''}; groups.push(grouped[key]); }
                    var group = grouped[key]; group.questions.push(question); if (question.passed) { group.passed++; }
                    if (question.linkedPart2Id) { var cue = vm.questions.filter(function (q) { return q.id === question.linkedPart2Id; })[0]; group.linkedTitle = cue ? cue.topic : 'Part 2 đã liên kết'; }
                });
                groups.forEach(function (group) { group.visible = group.questions.filter(function (q) { return !term || normalize(q.topic + ' ' + q.prompt).indexOf(term) >= 0; }); });
                vm.groups = groups.filter(function (group) { return group.visible.length; });
            };
            vm.changePart = function (part) { vm.part = part; vm.rebuildGroups(); saveView(); $location.search('part', part); };
            vm.loadStudents = function (query) {
                if (!vm.managementMode) { vm.students = []; return $q.when(); }
                if (vm.isAdmin && vm.modal !== 'share') { vm.students = []; return $q.when(); }
                if (!vm.canReviewStudents()) { vm.students = []; return $q.when(); }
                var id = vm.selectedSetId;
                return api.students(id, query).then(function (students) { if (!alive || id !== vm.selectedSetId) { return; } vm.students = students; students.forEach(function (s) { vm.studentCache[s.id] = s; }); }, fail);
            };
            vm.loadHistory = function () {
                var id = vm.selectedSetId, student = vm.managementMode ? vm.studentId : null;
                if (student && !owner()) { vm.history = []; return $q.when(); }
                return api.history(vm.managementMode && owner() ? id : null, vm.managementMode && owner() && student ? student : null).then(function (rows) { if (alive && id === vm.selectedSetId && student === (vm.managementMode ? vm.studentId : null)) { vm.history = rows; } }, fail);
            };
            vm.loadBank = function () {
                if (!vm.managementMode) { vm.studentId = null; vm.adminViewedStudent = null; }
                var generation = ++bankGeneration, id = Number(vm.selectedSetId), student = vm.studentId || null;
                vm.answerQuestionId = null; vm.notebookQuestionId = null;
                vm.selectedSet = vm.sets.filter(function (set) { return set.id === id; })[0]; if (!vm.selectedSet) { vm.questions = []; vm.groups = []; return $q.when(); }
                vm.loadingBank = true; vm.error = ''; vm.questions = []; vm.groups = []; saveView();
                return api.bank(id, student).then(function (data) {
                    if (!alive || generation !== bankGeneration) { return; }
                    if (!data || !data.set || Number(data.set.id) !== id || (student && Number(data.studentId) !== Number(student)) || (!student && data.studentId != null && Number(data.studentId) !== Number(vm.userId))) { throw new Error('Câu hỏi nhận được không khớp bộ đề hoặc học sinh đang xem.'); }
                    vm.selectedSet = data.set; vm.questions = data.questions || []; vm.preview = data.importPreview;
                    vm.rebuildGroups(); vm.loadHistory(); return true;
                }).catch(function (error) { if (alive && generation === bankGeneration) { fail(error); } return false; }).finally(function () { if (alive && generation === bankGeneration) { vm.loadingBank = false; } });
            };
            vm.selectSet = function () { resetAdminView(); rosterGeneration++; vm.adminStudentRows = []; vm.adminTotal = 0; vm.adminRosterLoading = false; vm.answerImportContext = null; if (vm.modal === 'answers') { vm.modal = null; } vm.loadBank().then(function () { return vm.isAdmin ? vm.loadAdminStudents(0) : vm.loadStudents(''); }); $location.search('set', vm.selectedSetId); };
            vm.changeYear = function () { var available = vm.availableSets(); if (!available.some(function (s) { return s.id === vm.selectedSetId; })) { vm.selectedSetId = available.length ? available[0].id : null; vm.selectSet(); } };
            vm.markPass = function (questions, value) {
                if (!vm.canReviewStudents() || !vm.studentId || vm.passSaving || vm.loadingBank) { return; }
                var ids = []; questions.forEach(function (q) { if (ids.indexOf(q.id) < 0) { ids.push(q.id); } });
                var setId = vm.selectedSetId, student = vm.studentId; vm.passSaving = true; vm.error = '';
                return api.markPass(setId, {studentId: student, questionIds: ids, passed: value}).then(function (ack) {
                    if (!ack || ack.updated !== ids.length || ack.studentId !== student || ack.passed !== value) { throw new Error('Chưa xác nhận được dấu Pass. Hãy tải lại để đối chiếu.'); }
                    if (setId === vm.selectedSetId && student === vm.studentId) { vm.questions.forEach(function (q) { if (ids.indexOf(q.id) >= 0) { q.passed = value; } }); vm.rebuildGroups(); }
                }).catch(fail).finally(function () { vm.passSaving = false; });
            };
            vm.openModal = function (name) {
                if (name === 'practice' ? vm.managementMode : (!vm.managementMode || !vm.canManage)) { return; }
                if ((name === 'import' || name === 'answers') && !vm.isAdmin) { return; }
                if ((name === 'import' || name === 'share') && !owner()) { return; }
                vm.modal = name; vm.error = ''; if (name === 'share') { vm.shareForm = {classIds: (vm.selectedSet.classIds || []).slice(), studentIds: (vm.selectedSet.studentIds || []).slice()}; vm.loadStudents(''); } if (name === 'import' && vm.preview) { setPreview(vm.preview); }
            };
            vm.closeModal = function () { if (!vm.busy) { vm.modal = null; } };
            vm.createSet = function () {
                if (!vm.managementMode || !vm.canManage) { return $q.when(); }
                vm.busy = true; vm.error = '';
                api.createSet(vm.newSet).then(function (set) { vm.selectedSetId = set.id; vm.yearFilter = null; vm.modal = null; return refresh(set.id); }).catch(fail).finally(function () { vm.busy = false; });
            };
            vm.saveShare = function () {
                if (!vm.managementMode || !owner()) { return $q.when(); }
                vm.busy = true; vm.error = '';
                api.share(vm.selectedSetId, vm.shareForm).then(function (ack) {
                    if (!ack || ack.id !== vm.selectedSetId) { throw new Error('Chưa xác nhận được chia sẻ.'); }
                    vm.modal = null; vm.studentId = null; return refresh(ack.id);
                }).catch(fail).finally(function () { vm.busy = false; });
            };
            vm.chooseFile = function (file) { if (!vm.managementMode || !vm.isAdmin || !owner() || !file) { return; } if (!/\.xlsx$/i.test(file.name) || file.size > 8 * 1024 * 1024) { vm.error = 'Chọn file .xlsx nhỏ hơn 8 MB.'; return; } vm.importFile = file; };
            function setPreview(preview) {
                vm.preview = preview; vm.importPage = 1; vm.importRows = (preview.rows || []).map(function (item) {
                    item.selected = item.status === 'NEW'; item.action = item.status === 'CHANGED' ? 'NEW_VARIANT' : item.status === 'UPDATE_SAMPLE' ? 'UPDATE_SAMPLE' : 'IMPORT'; return item;
                }); vm.countSelected();
            }
            vm.countSelected = function () { vm.importSelected = vm.importRows.filter(function (item) { return item.selected && item.status !== 'INVALID'; }).length; };
            vm.selectNewRows = function () { vm.importRows.forEach(function (item) { item.selected = item.status === 'NEW'; }); vm.countSelected(); };
            vm.previewFile = function () {
                if (!vm.managementMode || !vm.isAdmin || !owner() || !vm.importFile) { return; } vm.busy = true; vm.error = '';
                api.preview(vm.selectedSetId, vm.importFile).then(setPreview).catch(fail).finally(function () { vm.busy = false; });
            };
            vm.confirmImport = function () {
                if (!vm.managementMode || !vm.isAdmin || !owner()) { return; }
                var choices = vm.importRows.filter(function (item) { return item.selected && item.status !== 'INVALID'; }).map(function (item) { return {rowId: item.row.rowId, action: item.action}; });
                if (!choices.length) { vm.error = 'Chưa chọn dòng cần nhập/cập nhật.'; return; } vm.busy = true; vm.error = '';
                api.confirm(vm.selectedSetId, {token: vm.preview.token, choices: choices}).then(function (ack) {
                    if (!ack || typeof ack.imported !== 'number') { throw new Error('Chưa xác nhận được kết quả import.'); }
                    setPreview(ack.preview); vm.notice = 'Đã nhập/cập nhật ' + ack.imported + ' dòng.'; return vm.loadBank();
                }).catch(fail).finally(function () { vm.busy = false; });
            };
            function download(data, type, filename) {
                var url = $window.URL.createObjectURL(new $window.Blob([data], {type: type})), anchor = $window.document.createElement('a'); anchor.href = url; anchor.download = filename;
                $window.document.body.appendChild(anchor); anchor.click(); anchor.parentNode.removeChild(anchor); $window.setTimeout(function () { $window.URL.revokeObjectURL(url); }, 1000);
            }
            vm.exportSet = function () { if (!vm.managementMode || !owner()) { return $q.when(); } vm.busy = true; return api.exportSet(vm.selectedSetId).then(function (data) { download(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'speaking-' + vm.selectedSet.year + '-bo-' + vm.selectedSet.number + '.xlsx'); }).catch(fail).finally(function () { vm.busy = false; }); };
            function importTarget(student) {
                if (!vm.managementMode || !vm.isAdmin || !vm.selectedSetId || !eligibleAdminClass(vm.adminClassId)) { return null; }
                if (!student && vm.modal === 'answers' && vm.answerImportContext) { return vm.answerImportContext; }
                student = student || vm.adminViewedStudent;
                if (!student || !Number.isInteger(student.id) || student.id <= 0 || student.canAccess !== true) { return null; }
                return {setId: Number(vm.selectedSetId), classId: Number(vm.adminClassId), studentId: student.id, label: student.name + ' (' + student.username + ')'};
            }
            function currentImportContext(context) { return context && eligibleAdminClass(context.classId) && context.classId === Number(vm.adminClassId) && context.setId === Number(vm.selectedSetId); }
            vm.downloadAnswerTemplate = function (student) {
                var context = importTarget(student); if (!context || vm.busy) { return $q.when(); }
                var id = context.setId; student = context.studentId; vm.busy = true; vm.error = '';
                return api.studentAnswerTemplate(id, student).then(function (data) { download(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'speaking-cau-tra-loi-' + student + '-bo-' + id + '.xlsx'); }).catch(fail).finally(function () { vm.busy = false; });
            };
            vm.openAnswerImport = function (student) {
                var context = importTarget(student); if (!context || vm.busy) { return; }
                vm.answerImportContext = context;
                vm.answerImportFile = null; vm.answerImportRows = []; vm.answerImportSelected = 0; vm.answerImportPage = 1; vm.openModal('answers');
            };
            vm.chooseAnswerFile = function (file) {
                if (!vm.managementMode || !vm.isAdmin || !file) { return; } if (!/\.xlsx$/i.test(file.name) || file.size > 8 * 1024 * 1024) { vm.error = 'Chọn file .xlsx nhỏ hơn 8 MB.'; return; }
                vm.answerImportFile = file; vm.answerImportRows = []; vm.answerImportSelected = 0;
            };
            vm.countAnswerImports = function () { vm.answerImportSelected = vm.answerImportRows.filter(function (row) { return row.selected && (row.status === 'NEW' || row.status === 'CHANGED'); }).length; };
            vm.previewAnswers = function () {
                if (!vm.managementMode || !vm.isAdmin || !vm.answerImportFile || vm.busy || !currentImportContext(vm.answerImportContext)) { return; } var context = vm.answerImportContext; vm.busy = true; vm.error = '';
                return api.previewStudentAnswers(context.setId, context.studentId, vm.answerImportFile).then(function (data) {
                    if (!data || Number(data.setId) !== context.setId || Number(data.studentId) !== context.studentId || !Array.isArray(data.rows)) { throw new Error('File đối chiếu không khớp bộ đề hoặc học sinh. Chưa nhập dữ liệu.'); }
                    if (!alive || context !== vm.answerImportContext || !currentImportContext(context) || vm.modal !== 'answers') { return; }
                    vm.answerImportRows = data.rows.map(function (row) { row.selected = row.status === 'NEW'; return row; }); vm.answerImportPage = 1; vm.countAnswerImports();
                }).catch(fail).finally(function () { vm.busy = false; });
            };
            vm.confirmAnswers = function () {
                if (!vm.managementMode || !vm.isAdmin || vm.busy || !currentImportContext(vm.answerImportContext)) { return; } var context = vm.answerImportContext, rows = vm.answerImportRows.filter(function (row) { return row.selected && (row.status === 'NEW' || row.status === 'CHANGED'); }).map(function (row) { return {questionId: row.questionId, html: row.html, notes: [], revision: row.revision}; });
                if (!rows.length) { vm.error = 'Chọn câu trả lời cần nhập; câu đã có chỉ ghi đè khi được tích chọn.'; return; } vm.busy = true; vm.error = '';
                return api.confirmStudentAnswers({setId: context.setId, studentId: context.studentId, rows: rows}).then(function (ack) {
                    if (!ack || Number(ack.setId) !== context.setId || Number(ack.studentId) !== context.studentId || ack.saved !== rows.length || !Array.isArray(ack.answers) || ack.answers.length !== rows.length) { throw new Error('Chưa xác nhận đủ câu trả lời đã nhập. Giữ file và đối chiếu lại trước khi thử tiếp.'); }
                    var expected = rows.map(function (row) { return String(row.questionId); }).sort().join(',');
                    if (ack.answers.map(function (row) { return String(row.questionId); }).sort().join(',') !== expected || ack.answers.some(function (row) { return Number(row.setId) !== context.setId || Number(row.studentId) !== context.studentId || !(Number(row.revision) > 0); })) { throw new Error('Biên nhận nhập câu trả lời không khớp học sinh hoặc câu hỏi. Hãy đối chiếu lại.'); }
                    if (alive && context === vm.answerImportContext && currentImportContext(context)) {
                        vm.notice = 'Đã lưu ' + ack.saved + ' câu trả lời riêng của ' + context.label + '.'; if (vm.modal === 'answers') { vm.modal = null; }
                        if (Number(vm.studentId) === context.studentId) { vm.answerQuestionId = null; }
                        if (Number(vm.selectedSetId) === context.setId && Number(vm.adminClassId) === context.classId) { vm.loadAdminStudents(vm.adminPage); }
                    }
                }).catch(fail).finally(function () { vm.busy = false; });
            };
            vm.openPracticeSetup = function () {
                if (vm.managementMode || !vm.selectedSet) { return; }
                vm.practiceSets = vm.sets.filter(function (set) { return set.ownerId === vm.selectedSet.ownerId; }); vm.practiceConfig.setIds = [vm.selectedSetId]; vm.openModal('practice');
            };
            function attemptKey() { var crypto = $window.crypto; if (crypto && crypto.getRandomValues) { var numbers = new Uint32Array(4); crypto.getRandomValues(numbers); return Array.prototype.map.call(numbers, function (n) { return ('00000000' + n.toString(16)).slice(-8); }).join(''); } return 'practice-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
            function setPractice(data) {
                clearAudio(); vm.practice = data; vm.elapsedSeconds = Number(data.elapsedSeconds) || 0; lastTick = Date.now();
                if (ownPractice() && data.status === 'ACTIVE') { try { var local = JSON.parse($window.localStorage.getItem(backupKey(data.id)) || 'null'); if (local) { vm.elapsedSeconds = Math.min(604800,Math.max(vm.elapsedSeconds, Number(local.elapsed) || 0)); if (Number.isInteger(Number(local.index)) && local.index >= 0 && local.index < data.snapshot.questions.length) { data.currentIndex = Number(local.index); } } } catch (ignore) {} }
                vm.modal = null; $location.search('practice', data.id); recorder.loadPending();
            }
            vm.startPractice = function () {
                if (vm.managementMode) { return $q.when(); }
                var config = vm.practiceConfig, parts = Object.keys(config.parts).filter(function (part) { return config.parts[part]; }).map(Number);
                if (!parts.length || !config.setIds.length) { vm.error = 'Chọn ít nhất một bộ và một Part.'; return; }
                if (!vm.pendingStart) { try { vm.pendingStart = JSON.parse($window.localStorage.getItem(startBackupKey()) || 'null'); } catch (ignore) {} }
                if (!vm.pendingStart) { vm.pendingStart = {clientKey: attemptKey(), setIds: config.setIds.slice(), parts: parts, part1Count: config.part1Count, part3Count: config.part3Count, onlyUnpassed: config.onlyUnpassed}; }
                try { $window.localStorage.setItem(startBackupKey(),JSON.stringify(vm.pendingStart)); } catch (ignore) {}
                vm.busy = true; vm.error = '';
                api.start(vm.pendingStart).then(function (data) {
                    if (!data || !(Number(data.id)>0) || Number(data.studentId) !== Number(vm.userId) || !data.snapshot || !data.snapshot.questions || !data.snapshot.questions.length) { throw new Error('Chưa xác nhận được lượt luyện. Bấm bắt đầu để kiểm tra lại đúng lượt đã gửi.'); }
                    vm.pendingStart = null; try { $window.localStorage.removeItem(startBackupKey()); } catch (ignore) {} if (alive) { setPractice(data); }
                }).catch(function (error) {
                    if (error && error.status>=400 && error.status<500 && error.status!==408 && error.status!==409 && error.status!==429) { vm.pendingStart=null; try { $window.localStorage.removeItem(startBackupKey()); } catch (ignore) {} }
                    fail(error);
                }).finally(function () { vm.busy = false; });
            };
            vm.openPractice = function (id) {
                var generation = ++practiceGeneration; vm.loadingPractice = true; vm.error = '';
                recorder.stop().then(function () { return api.practice(id); }).then(function (data) {
                    if (!alive || generation !== practiceGeneration) { return; }
                    if (!data || Number(data.id) !== Number(id) || (!vm.managementMode && Number(data.studentId) !== Number(vm.userId)) || (vm.managementMode && vm.studentId && Number(data.studentId) !== Number(vm.studentId))) { throw new Error('Lượt luyện không khớp người đang xem.'); }
                    setPractice(data);
                }).catch(fail).finally(function () { if (alive && generation === practiceGeneration) { vm.loadingPractice = false; } });
            };
            function saveProgress(finished) {
                if (!ownPractice() || vm.practice.status !== 'ACTIVE') { return $q.when(); } updateClock(); backupPractice();
                var id = vm.practice.id, payload = {currentIndex: vm.practice.currentIndex, elapsedSeconds: Math.floor(vm.elapsedSeconds || 0), finished: !!finished};
                function send() {
                    return api.progress(id, payload).then(function (ack) {
                        if (!ack || Number(ack.id) !== Number(id) || (finished && ack.status !== 'DONE')) { throw new Error('Chưa xác nhận được tiến độ luyện tập.'); }
                        if (alive && vm.practice && vm.practice.id === id) {
                            vm.progressError = ''; if (ack.status === 'DONE') { vm.practice = ack; try { $window.localStorage.removeItem(backupKey(id)); } catch (ignore) {} }
                        } return ack;
                    }).catch(function (error) { if (alive) { vm.progressError = 'Chưa đồng bộ tiến độ, bản nháp vẫn được giữ trên thiết bị. Hãy thử lưu lại.'; } return $q.reject(error); });
                }
                progressQueue = progressQueue.then(send, send); return progressQueue;
            }
            vm.retryProgress = function () { saveProgress(false).catch(fail); recorder.retry(); };
            vm.moveQuestion = function (direction) {
                if (!vm.practice || vm.moving) { return; } var next = vm.practice.currentIndex + direction;
                if (next < 0 || next >= vm.practice.snapshot.questions.length) { return; } vm.moving = true;
                recorder.stop().then(function () { vm.practice.currentIndex = next; clearAudio(); if (ownPractice()) { backupPractice(); saveProgress(false).catch(angular.noop); } }).finally(function () { vm.moving = false; });
            };
            vm.finishPractice = function () {
                if (!ownPractice() || vm.finishing) { return; } vm.finishing = true; vm.error = '';
                recorder.stop().then(function () { return saveProgress(true); }).then(function () { vm.loadHistory(); recorder.retry(); }).catch(fail).finally(function () { vm.finishing = false; });
            };
            vm.leavePractice = function () {
                updateClock(); backupPractice(); recorder.stop(); saveProgress(false).catch(angular.noop); practiceGeneration++; vm.practice = null; clearAudio(); $location.search('practice', null); vm.loadHistory();
            };
            vm.startRecording = function () { if (ownPractice() && vm.practice.status === 'ACTIVE') { recorder.start(vm.userId, vm.practice.id, vm.practice.currentIndex).catch(angular.noop); } };
            vm.playRecording = function (recording) {
                vm.audioLoading = recording.id; clearAudio(); var id = vm.practice && vm.practice.id;
                api.audio(recording.id).then(function (blob) { if (!alive || !vm.practice || vm.practice.id !== id) { return; } audioUrl = $window.URL.createObjectURL(blob); vm.audioSource = $sce.trustAsResourceUrl(audioUrl); vm.audioLabel = 'Bản thu câu ' + (recording.questionIndex + 1); }).catch(fail).finally(function () { vm.audioLoading = null; });
            };
            vm.refreshPractice = function () { if (!vm.practice) { return; } var id = vm.practice.id; api.practice(id).then(function (data) { if (vm.practice && vm.practice.id === id) { vm.practice.recordings = data.recordings; } }).catch(fail); };
            vm.recoverRecording = function (job) { recorder.recover(job).then(vm.refreshPractice); };
            function refresh(preferred) {
                return api.bootstrap().then(function (data) {
                    if (!alive) { return; } vm.userId = data.userId; vm.canManage = data.canManage; vm.isAdmin = data.isAdmin === true; vm.sets = data.sets || [];
                    vm.classes = (data.classes || []).filter(function (item) { return item && Number(item.schoolId) === vm.directorySchoolId && Number.isInteger(Number(item.id)) && Number(item.id) > 0; });
                    if (vm.adminClassId && !eligibleAdminClass(vm.adminClassId)) { rosterGeneration++; clearInvalidClass(); }
                    if (vm.managementMode && !vm.canManage) { vm.sets = []; vm.error = 'Chỉ giáo viên và admin được quản lý Speaking. Vào Speaking Studio để mở bài của bạn.'; return; }
                    vm.years = []; vm.sets.forEach(function (set) { if (vm.years.indexOf(set.year) < 0) { vm.years.push(set.year); } });
                    var saved; try { saved = JSON.parse($window.localStorage.getItem(preferenceKey()) || '{}'); } catch (ignore) { saved = {}; }
                    vm.part = Number($location.search().part || saved.part) || 1;
                    vm.selectedSetId = Number(preferred || $location.search().set || saved.setId) || (vm.sets[0] && vm.sets[0].id);
                    if (!vm.sets.some(function (set) { return set.id === vm.selectedSetId; })) { vm.selectedSetId = vm.sets.length ? vm.sets[0].id : null; }
                    recorder.loadPending(); return vm.loadBank().then(function () { return vm.isAdmin ? vm.loadAdminStudents(0) : vm.loadStudents(''); });
                });
            }
            var timer = $interval(function () { updateClock(); if (++tickCount % 5 === 0) { backupPractice(); saveProgress(false).catch(angular.noop); } }, 1000);
            function visibility() { updateClock(); if ($window.document.hidden) { recorder.stop(); backupPractice(); saveProgress(false).catch(angular.noop); } lastTick = Date.now(); }
            function leaving() { updateClock(); backupPractice(); recorder.stop(); saveProgress(false).catch(angular.noop); }
            $window.document.addEventListener('visibilitychange', visibility); $window.addEventListener('pagehide', leaving);
            var unwatchPending = $scope.$watch(function () { return recorder.state.pending.length; }, function (value, old) { if (value < old && vm.practice) { vm.refreshPractice(); } });
            refresh().then(function () { var id = Number($location.search().practice); if (id > 0 && !vm.managementMode) { vm.openPractice(id); } }).catch(fail).finally(function () { vm.loading = false; });
            $scope.$on('$destroy', function () { leaving(); alive = false; bankGeneration++; practiceGeneration++; rosterGeneration++; studentViewGeneration++; $interval.cancel(timer); clearAudio(); unwatchPending(); $window.document.removeEventListener('visibilitychange', visibility); $window.removeEventListener('pagehide', leaving); });
        }]);
})();
