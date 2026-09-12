(function () {
    'use strict';

    angular.module('Hrm.EnrolmentClass').controller('EnrolmentClassController', EnrolmentClassController);

    angular.module('Hrm.EnrolmentClass').directive('homeworkProgressWheel', function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var control = element[0];
                function ancestor(node, className) {
                    for (var parent = node.parentElement; parent; parent = parent.parentElement) {
                        if (parent.classList.contains(className)) { return parent; }
                    }
                    return null;
                }
                function wheel(event) {
                    // Keep browser zoom and normal scrolling on unfocused controls.
                    if (event.ctrlKey || !event.cancelable || control.ownerDocument.activeElement !== control || control.disabled) { return; }
                    var table = ancestor(control, 'class-homework-review-table');
                    if (!table) { return; }
                    event.preventDefault(); event.stopPropagation();
                    var dx = event.deltaX || 0, dy = event.deltaY || 0;
                    if (event.deltaMode === 1) { dx *= 20; dy *= 20; }
                    else if (event.deltaMode === 2) { dx *= table.clientWidth; dy *= table.clientHeight; }
                    if (event.shiftKey && !dx) { dx = dy; dy = 0; }
                    var beforeTop = table.scrollTop, beforeLeft = table.scrollLeft;
                    table.scrollTop += dy; table.scrollLeft += dx;
                    var outer = ancestor(table, 'class-day-plan-body');
                    if (outer) {
                        outer.scrollTop += dy - (table.scrollTop - beforeTop);
                        outer.scrollLeft += dx - (table.scrollLeft - beforeLeft);
                    }
                }
                control.addEventListener('wheel', wheel, {passive: false});
                scope.$on('$destroy', function () { control.removeEventListener('wheel', wheel); });
            }
        };
    });

    EnrolmentClassController.$inject = [
        '$rootScope', '$scope', 'toastr', '$uibModal', 'EnrolmentClassService', '$state'
    ];

    function EnrolmentClassController($rootScope, $scope, toastr, modal, service, $state) {
        $scope.$on('$viewContentLoaded', function () {
            App.initAjax();
        });

        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;
        vm.schoolId = Number(($state.current.data || {}).enrolmentSchoolId) === 1 ? 1 : 2;
        vm.listTitle = vm.schoolId === 1 ? 'Lớp tiếng Anh' : 'Lớp nhà thờ';
        vm.canAccessList = function () {
            var s = $rootScope.settings || {};
            var manager = s.isAdmin || s.isEducationManagerment || s.isStudentManagerment || s.isStaff;
            if (vm.schoolId === 1) {
                return window.location.hostname.toLowerCase() === 'ieltsroom.com' && !!(manager || s.isViewer);
            }
            return !!(manager || !s.isViewer);
        };
        var classLoadRequest = 0;
        vm.allClasses = [];
        vm.visibleClasses = [];
        vm.teacherCandidates = [];
        vm.candidatesLoading = false;
        vm.candidatesError = false;
        var candidatesRequest = 0;
        var vietnameseFamilyNames = {
            "nguyen": true, "tran": true, "le": true, "pham": true, "hoang": true,
            "huynh": true, "phan": true, "vu": true, "vo": true, "dang": true,
            "bui": true, "do": true, "ho": true, "ngo": true, "duong": true,
            "ly": true, "dinh": true, "truong": true, "dao": true, "cao": true,
            "mai": true, "doan": true, "luu": true, "trinh": true, "ta": true
        };
        vm.expanded = {};
        vm.searchText = '';
        vm.enrolmentClass = {};
        vm.saving = false;
        vm.modalInstance = null;
        vm.teamBoard = null;
        vm.teamBoardModal = null;
        vm.teamSearchText = '';
        vm.teamBoardSaving = false;
		vm.scheduleClass = null;
		vm.scheduleEntries = [];
		vm.scheduleCalendarDays = [];
		vm.scheduleWeekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
		vm.scheduleMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
		vm.scheduleTopics = [];
		vm.scheduleLoading = false;
		vm.scheduleSettingsLoading = false;
		vm.scheduleSettingsError = false;
		vm.scheduleTopicsLoading = false;
		vm.scheduleSaving = false;
		vm.scheduleDaySaving = false;
		vm.scheduleModal = null;
		vm.scheduleDayModal = null;
		vm.scheduleDay = null;
		vm.scheduleStudents = [];
		vm.scheduleStudentsLoading = false;
		vm.scheduleStudentsError = false;
		vm.scheduleTaskCategories = [];
		vm.taskEditor = null;
		vm.taskEditorIndex = -1;
		vm.taskStatuses = [{id: 'TODO', name: 'Chưa làm'}, {id: 'IN_PROGRESS', name: 'Đang thực hiện'}, {id: 'DONE', name: 'Hoàn thành'}];
		vm.homeworkProgressLevels = [10, 20, 30, 40, 50, 60, 70, 80, 90];
		vm.studentTaskStatuses = [{id: 'UNRECORDED', name: 'Chưa xác nhận'}, {id: 'TODO', name: 'Chưa làm'}, {id: 'DONE', name: 'Đã làm'}, {id: 'NEEDS_REVIEW', name: 'Cần bổ sung'}];
        angular.forEach(vm.homeworkProgressLevels, function (percent) { vm.studentTaskStatuses.push({id: 'PROGRESS_' + percent, name: 'Đã làm ' + percent + '%'}); });
		var scheduleStudentsRequest = 0;
        var homeworkReviewRequest = 0;
        var homeworkCellSaveRequest = 0;
        var homeworkCellDrafts = {};
        vm.homeworkCellSaving = false;
        vm.previousHomeworkDay = null;
        vm.previousHomeworkTasks = [];
        vm.homeworkReviewRows = [];
        vm.homeworkReviewLoading = false;
        vm.homeworkReviewError = false;
        vm.homeworkReviewSearch = '';
        vm.homeworkReviewFilter = 'ALL';
		vm.topicSelectionOpen = {classTopicIds: false, homeworkTopicIds: false};
		vm.weeklyDayOptions = [
			{value: 1, label: 'Thứ 2', shortLabel: 'T2'},
			{value: 2, label: 'Thứ 3', shortLabel: 'T3'},
			{value: 3, label: 'Thứ 4', shortLabel: 'T4'},
			{value: 4, label: 'Thứ 5', shortLabel: 'T5'},
			{value: 5, label: 'Thứ 6', shortLabel: 'T6'},
			{value: 6, label: 'Thứ 7', shortLabel: 'T7'},
			{value: 7, label: 'Chủ nhật', shortLabel: 'CN'}
		];
		vm.originalParentId = null;

		vm.isAdmin = function () {
			var currentSettings = $rootScope.settings || {};
			return currentSettings.isAdmin === true;
		};

		vm.canCreateRootClass = function () {
			var currentSettings = $rootScope.settings || {};
			return currentSettings.isAdmin === true
				|| (vm.schoolId === 2 && currentSettings.isEducationManagerment === true);
		};

		vm.findClass = function (classId) {
			var found = null;
			angular.forEach(vm.allClasses, function (item) {
				if (!found && item.id === classId) {
					found = item;
				}
			});
			return found;
		};

        vm.load = function () {
            var request = ++classLoadRequest;
            if ($rootScope.settings.permissionsLoaded === false || !vm.canAccessList()) {
                vm.allClasses = [];
                vm.rebuildTree();
                return;
            }
            service.getTree(vm.schoolId).then(function (data) {
                if (request !== classLoadRequest || !vm.canAccessList()) { return; }
                vm.allClasses = (angular.isArray(data) ? data : []).filter(function (item) {
                    return Number(item.schoolId) === vm.schoolId;
                });
                angular.forEach(vm.allClasses, function (item) {
                    if (angular.isUndefined(vm.expanded[item.id])) {
                        vm.expanded[item.id] = true;
                    }
                });
                vm.rebuildTree();
            }, function () {
                if (request !== classLoadRequest) { return; }
                vm.allClasses = [];
                vm.rebuildTree();
                toastr.error('Không tải được ' + vm.listTitle.toLowerCase() + '. Vui lòng thử lại.', 'Lỗi');
            });
        };

        vm.loadTeachers = function (parentClassId, pruneSelection, classId) {
            var request = ++candidatesRequest;
            vm.candidatesLoading = true;
            vm.candidatesError = false;
            return service.getResponsibleCandidates(parentClassId, classId).then(function (data) {
                if (request !== candidatesRequest) { return; }
                vm.candidatesLoading = false;
                vm.teacherCandidates = angular.isArray(data) ? data : [];
                angular.forEach(vm.teacherCandidates, function (candidate) {
                    candidate.originalDisplayName = candidate.originalDisplayName || candidate.displayName;
                    candidate.displayName = responsibleDisplayName(candidate);
                });
				vm.teacherCandidates.sort(function (a, b) {
					return (a.displayName || a.username || '').localeCompare(
						b.displayName || b.username || '', 'vi');
				});

				if (pruneSelection && vm.enrolmentClass) {
					var allowed = {};
					angular.forEach(vm.teacherCandidates, function (candidate) {
						allowed[candidate.id] = true;
					});
					vm.enrolmentClass.deputyTeacherIds = (vm.enrolmentClass.deputyTeacherIds || []).filter(function (id) {
						return allowed[id] === true;
					});
                    if (!allowed[vm.enrolmentClass.primaryTeacherId]) {
                        vm.enrolmentClass.primaryTeacherId = null;
                    }
				}
            }, function () {
                if (request !== candidatesRequest) { return; }
                vm.candidatesLoading = false;
                vm.candidatesError = true;
                vm.teacherCandidates = [];
                toastr.error('Không tải được danh sách người phụ trách. Vui lòng thử lại.', 'Lỗi');
            });
        };

        vm.primaryChanged = function () {
            var primary = vm.enrolmentClass.primaryTeacherId;
            vm.enrolmentClass.deputyTeacherIds = (vm.enrolmentClass.deputyTeacherIds || []).filter(function (id) {
                return !sameTeamId(id, primary);
            });
        };

        vm.deputyCandidates = function () {
            return vm.teacherCandidates.filter(function (candidate) {
                return !sameTeamId(candidate.id, vm.enrolmentClass.primaryTeacherId);
            });
        };

		vm.parentChanged = function () {
			vm.loadTeachers(vm.enrolmentClass.parentId, true, vm.enrolmentClass.id);
		};

        vm.rebuildTree = function () {
            var byId = {};
            var children = {};
            var roots = [];
            var query = (vm.searchText || '').toLowerCase().trim();
            var included = {};

            angular.forEach(vm.allClasses, function (item) {
                byId[item.id] = item;
                children[item.id] = [];
            });

            angular.forEach(vm.allClasses, function (item) {
                if (item.parentId && byId[item.parentId] && item.parentId !== item.id) {
                    children[item.parentId].push(item);
                } else {
                    roots.push(item);
                }
            });

			function treeLabel(item, path) {
				path = path || {};
				if (!item || path[item.id]) {
					return item ? (item.name || '') : '';
				}
				path[item.id] = true;
				var parent = item.parentId ? byId[item.parentId] : null;
				return parent
					? treeLabel(parent, path) + ' / ' + (item.name || '')
					: (item.name || '');
			}
			angular.forEach(vm.allClasses, function (item) {
				item.treeLabel = treeLabel(item, {});
			});

            function sortItems(items) {
                items.sort(function (a, b) {
                    return (a.name || '').localeCompare(b.name || '', 'vi');
                });
            }

            sortItems(roots);
            angular.forEach(children, sortItems);

            if (query) {
                angular.forEach(vm.allClasses, function (item) {
                    var haystack = ((item.name || '') + ' ' + (item.code || '')).toLowerCase();
                    if (haystack.indexOf(query) < 0) {
                        return;
                    }
                    var current = item;
                    var guard = {};
                    while (current && !guard[current.id]) {
                        included[current.id] = true;
                        guard[current.id] = true;
                        current = current.parentId ? byId[current.parentId] : null;
                    }
                });
            }

            var result = [];
            var visited = {};
            function append(item, level) {
                if (!item || visited[item.id] || (query && !included[item.id])) {
                    return;
                }
                visited[item.id] = true;
                item.level = level;
                item.levelMarkers = [];
                for (var depth = 0; depth < level; depth++) {
                    item.levelMarkers.push(depth);
                }
                item.hasChildren = children[item.id].length > 0;
                result.push(item);
                if (query || vm.expanded[item.id]) {
                    angular.forEach(children[item.id], function (child) {
                        append(child, level + 1);
                    });
                }
            }

            angular.forEach(roots, function (root) { append(root, 0); });
            vm.visibleClasses = result;
        };

        vm.toggle = function (item) {
            if (!item.hasChildren) {
                return;
            }
            vm.expanded[item.id] = !vm.expanded[item.id];
            vm.rebuildTree();
        };

        vm.teacherNames = function (item, primaryOnly) {
            return (item.teachers || []).filter(function (teacher) {
                return sameTeamId(teacher.id, item.primaryTeacherId) === primaryOnly;
            }).map(function (teacher) {
                return responsibleDisplayName(teacher);
            }).join(', ');
        };

        function responsibleDisplayName(user) {
            if (!user) {
                return '';
            }

            var person = user.person || {};
            var lastName = cleanDisplayText(user.lastName || person.lastName || '');
            var firstName = cleanDisplayText(user.firstName || person.firstName || '');
            var fullName = cleanDisplayText(lastName + ' ' + removeNameNoteKeepCase(firstName));

            if (fullName) {
                return fullName;
            }

            fullName = cleanDisplayText(user.originalDisplayName || user.displayName || '');
            if (fullName) {
                return fixVietnameseDisplayNameOrder(fullName);
            }

            return user.username || '';
        }

        function fixVietnameseDisplayNameOrder(displayName) {
            var parts = displayName.split(' ');
            if (parts.length < 2) {
                return displayName;
            }

            var firstKey = removeVietnameseTone(parts[0]).toLowerCase();
            var lastKey = removeVietnameseTone(parts[parts.length - 1]).toLowerCase();
            if (!vietnameseFamilyNames[firstKey] && vietnameseFamilyNames[lastKey]) {
                return [parts[parts.length - 1]]
                    .concat(parts.slice(0, parts.length - 1))
                    .join(' ');
            }

            return displayName;
        }

        function removeVietnameseTone(value) {
            return cleanDisplayText(value)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D');
        }

        function cleanDisplayText(value) {
            if (value === null || angular.isUndefined(value)) {
                return '';
            }
            return String(value).replace(/\s+/g, ' ').trim();
        }

        function removeNameNoteKeepCase(value) {
            var text = cleanDisplayText(value);
            var oldText;

            do {
                oldText = text;
                text = text
                    .replace(/\s*\([^()]*\)\s*$/g, '')
                    .replace(/\s*\[[^\[\]]*\]\s*$/g, '')
                    .trim();
            } while (text !== oldText);

            return text;
        }

        function sameTeamId(first, second) {
            if (first === null || angular.isUndefined(first)) {
                return second === null || angular.isUndefined(second);
            }
            if (second === null || angular.isUndefined(second)) {
                return false;
            }
            return String(first) === String(second);
        }

        vm.decorateTeamBoard = function (board) {
            if (!board) {
                vm.teamBoard = null;
                return;
            }
            board.unassignedStudents = board.unassignedStudents || [];
            board.teams = board.teams || [];
            board.columns = [{
                id: null,
                name: 'Chưa phân đội',
                code: '',
                unassigned: true,
                students: board.unassignedStudents
            }].concat(board.teams);

            angular.forEach(board.columns, function (column) {
                column.students = column.students || [];
                sortTeamStudents(column.students);
                angular.forEach(column.students, function (student) {
                    student._teamId = column.id;
                    student._targetTeamId = column.id;
                });
            });
            vm.teamBoard = board;
        };

        vm.openTeamBoard = function (item) {
            if (!item || !item.id || item.canManageTeams !== true) {
                toastr.warning('Bạn không được phân đội cho lớp này.', 'Thông báo');
                return;
            }
            vm.teamSearchText = '';
            service.getTeamBoard(item.id).then(function (data) {
                if (!data) {
                    toastr.error('Không tải được danh sách phân đội.', 'Lỗi');
                    return;
                }
                vm.decorateTeamBoard(data);
                vm.teamBoardModal = modal.open({
                    animation: true,
                    templateUrl: 'team_board_modal.html',
                    scope: $scope,
                    size: 'lg',
                    windowClass: 'class-management-modal-window team-board-modal-window',
                    backdrop: 'static'
                });
            }, function () {
                toastr.error('Không tải được danh sách phân đội hoặc bạn không có quyền.', 'Lỗi');
            });
        };

        function normalizeVietnameseText(value) {
            if (value === null || angular.isUndefined(value)) {
                return '';
            }

            var text = String(value)
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

            if (text.normalize) {
                text = text.normalize('NFC');
            }

            return text;
        }

        function removeNameNote(value) {
            var text = normalizeVietnameseText(value);
            var oldText;

            do {
                oldText = text;
                text = text
                    .replace(/\s*\([^()]*\)\s*$/g, '')
                    .replace(/\s*\[[^\[\]]*\]\s*$/g, '')
                    .trim();
            } while (text !== oldText);

            return text;
        }

        function studentNameParts(student) {
            var person = student && student.person ? student.person : {};
            return {
                lastName: student && student.lastName
                    ? student.lastName
                    : (person.lastName || ''),
                firstName: student && student.firstName
                    ? student.firstName
                    : (person.firstName || '')
            };
        }

        function buildTeamStudentNameSortKey(student) {
            var parts = studentNameParts(student);
            var fullName = normalizeVietnameseText(
                normalizeVietnameseText(parts.lastName) + ' ' +
                removeNameNote(parts.firstName)
            );

            if (!fullName) {
                fullName = normalizeVietnameseText(
                    student && (student.displayName || student.username)
                );
            }

            if (!fullName) {
                return '';
            }

            return fullName.split(' ').reverse().join('|');
        }

        function sortTeamStudents(students) {
            students.sort(function (first, second) {
                var firstKey = buildTeamStudentNameSortKey(first);
                var secondKey = buildTeamStudentNameSortKey(second);

                if (firstKey < secondKey) {
                    return -1;
                }
                if (firstKey > secondKey) {
                    return 1;
                }

                return normalizeVietnameseText(first && first.username)
                    .localeCompare(normalizeVietnameseText(second && second.username));
            });
        }

        vm.studentName = function (student) {
            if (!student) {
                return '';
            }

            var parts = studentNameParts(student);
            var fullName = (parts.lastName + ' ' + parts.firstName)
                .replace(/\s+/g, ' ')
                .trim();

            return fullName || student.displayName || student.username || 'Học sinh';
        };

        vm.teamStudentFilter = function (student) {
            var query = (vm.teamSearchText || '').toLowerCase().trim();
            if (!query) {
                return true;
            }
            var value = (vm.studentName(student) + ' ' + (student.username || '')).toLowerCase();
            return value.indexOf(query) >= 0;
        };

        vm.findTeamColumn = function (teamId) {
            var found = null;
            angular.forEach((vm.teamBoard && vm.teamBoard.columns) || [], function (column) {
                if (!found && sameTeamId(column.id, teamId)) {
                    found = column;
                }
            });
            return found;
        };

        vm.removeDraggedStudent = function (sourceColumn, student) {
            if (!sourceColumn || !student) {
                return;
            }
            for (var index = 0; index < sourceColumn.students.length; index++) {
                if (sourceColumn.students[index].id === student.id) {
                    sourceColumn.students.splice(index, 1);
                    return;
                }
            }
        };

        vm.persistStudentMove = function (student, targetTeamId) {
            if (!vm.teamBoard || !student || vm.teamBoardSaving) {
                return;
            }
            vm.teamBoardSaving = true;
            service.moveStudentToTeam(vm.teamBoard.classId, {
                userId: student.id,
                targetTeamId: targetTeamId
            }).then(function (data) {
                if (!data) {
                    toastr.error('Không thể chuyển đội cho học sinh.', 'Lỗi');
                    vm.reloadTeamBoard();
                    return;
                }
                vm.decorateTeamBoard(data);
                vm.teamBoardSaving = false;
            }, function () {
                toastr.error('Không thể chuyển đội. Danh sách sẽ được tải lại.', 'Lỗi');
                vm.reloadTeamBoard();
            });
        };

        vm.dropStudent = function (targetColumn, student) {
            if (!targetColumn || !student || vm.teamBoardSaving || sameTeamId(student._teamId, targetColumn.id)) {
                return false;
            }
            targetColumn.students.push(student);
            student._teamId = targetColumn.id;
            student._targetTeamId = targetColumn.id;
            vm.persistStudentMove(student, targetColumn.id);
            return true;
        };

        vm.moveStudentFromSelect = function (student) {
            if (!student || vm.teamBoardSaving || sameTeamId(student._teamId, student._targetTeamId)) {
                return;
            }
            var sourceColumn = vm.findTeamColumn(student._teamId);
            var targetColumn = vm.findTeamColumn(student._targetTeamId);
            if (!targetColumn) {
                student._targetTeamId = student._teamId;
                return;
            }
            vm.removeDraggedStudent(sourceColumn, student);
            targetColumn.students.push(student);
            student._teamId = targetColumn.id;
            vm.persistStudentMove(student, targetColumn.id);
        };

        vm.reloadTeamBoard = function () {
            if (!vm.teamBoard || !vm.teamBoard.classId) {
                vm.teamBoardSaving = false;
                return;
            }
            service.getTeamBoard(vm.teamBoard.classId).then(function (data) {
                vm.decorateTeamBoard(data);
                vm.teamBoardSaving = false;
            }, function () {
                vm.teamBoardSaving = false;
            });
        };

		vm.openClassSchedule = function (item) {
			if (!item || !item.id || item.canEdit !== true || item.parentId) {
				toastr.warning('Bạn không được thiết lập lịch cho lớp này.', 'Thông báo');
				return;
			}
			vm.scheduleClass = angular.copy(item);
			vm.taskEditor = null;
			vm.scheduleTaskCategories = [];
			vm.loadScheduleStudents();
			vm.scheduleClass.weeklySessions = [];
			vm.scheduleTopics = [];
			vm.scheduleMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
			vm.scheduleMonthLabel = 'THÁNG ' + (vm.scheduleMonthDate.getMonth() + 1)
				+ ' / ' + vm.scheduleMonthDate.getFullYear();
			vm.scheduleSettingsLoading = true;
			vm.scheduleSettingsError = false;
			vm.scheduleTopicsLoading = true;
			vm.scheduleLoading = true;
			vm.scheduleModal = modal.open({
				animation: true,
				templateUrl: 'class_schedule_modal.html',
				scope: $scope,
				size: 'lg',
				windowClass: 'class-management-modal-window class-schedule-modal-window',
				backdrop: 'static'
			});

			service.getOne(item.id).then(function (classData) {
				if (!classData || classData.canEdit !== true) {
					throw new Error('forbidden');
				}
				vm.scheduleClass = angular.extend(vm.scheduleClass, angular.copy(classData));
				vm.scheduleClass.weeklySessions = (classData.weeklySessions || []).map(function (session) {
					return {
						id: session.id,
						dayOfWeek: session.dayOfWeek,
						startTimeValue: parseScheduleTime(session.startTime),
						endTimeValue: parseScheduleTime(session.endTime)
					};
				});
				vm.scheduleSettingsLoading = false;
				vm.scheduleSettingsError = false;
				if (!vm.scheduleLoading) { vm.buildScheduleCalendar(); }
			}, function () {
				vm.scheduleSettingsLoading = false;
				vm.scheduleSettingsError = true;
				toastr.error('Không tải được các buổi học đã thiết lập.', 'Lỗi');
			});

			service.getScheduleTopics().then(function (topics) {
				vm.scheduleTopics = angular.isArray(topics) ? topics : [];
				vm.buildScheduleTaskCategories();
				vm.scheduleTopicsLoading = false;
			}, function () {
				vm.scheduleTopicsLoading = false;
				toastr.error('Không tải được danh sách topic.', 'Lỗi');
			});

			vm.loadScheduleMonth();
		};

		vm.loadScheduleMonth = function () {
			if (!vm.scheduleClass || !vm.scheduleClass.id) { return; }
			var firstDay = moment(vm.scheduleMonthDate).startOf('month').format('YYYY-MM-DD');
			var lastDay = moment(vm.scheduleMonthDate).endOf('month').format('YYYY-MM-DD');
			vm.scheduleLoading = true;
            var request = ++scheduleMonthRequest, classId = vm.scheduleClass.id;
			return service.getSchedule(classId, firstDay, lastDay).then(function (data) {
                if (request !== scheduleMonthRequest || !vm.scheduleClass || vm.scheduleClass.id !== classId) { return; }
				vm.scheduleEntries = angular.isArray(data) ? data : [];
				vm.buildScheduleCalendar();
				vm.scheduleLoading = false;
			}, function () {
                if (request !== scheduleMonthRequest || !vm.scheduleClass || vm.scheduleClass.id !== classId) { return; }
				vm.scheduleEntries = [];
				vm.buildScheduleCalendar();
				vm.scheduleLoading = false;
				toastr.error('Không tải được lịch trong tháng.', 'Lỗi');
			});
		};

        var scheduleMonthRequest = 0, scheduleSessionRequest = 0, scheduleDaySnapshot = '';
		vm.buildScheduleCalendar = function () {
			var year = vm.scheduleMonthDate.getFullYear();
			var month = vm.scheduleMonthDate.getMonth();
			var daysInMonth = new Date(year, month + 1, 0).getDate();
			var firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
			var entriesByDate = {};
			var weeklyDays = {};
			angular.forEach((vm.scheduleClass && vm.scheduleClass.weeklySessions) || [], function (session) {
				if (session.dayOfWeek) { weeklyDays[session.dayOfWeek] = true; }
			});
			angular.forEach(vm.scheduleEntries, function (entry) {
				entriesByDate[entry.scheduleDate] = entry;
			});
			var cells = [];
			for (var blank = 0; blank < firstWeekday; blank++) {
				cells.push({isBlank: true});
			}
			var todayKey = moment().format('YYYY-MM-DD');
			for (var day = 1; day <= daysInMonth; day++) {
				var dayDate = new Date(year, month, day);
				var dateKey = moment(dayDate).format('YYYY-MM-DD');
				var dayOfWeek = ((dayDate.getDay() + 6) % 7) + 1;
				var entry = entriesByDate[dateKey] || null;
				cells.push({
					isBlank: false,
					day: day,
					dateKey: dateKey,
					isToday: dateKey === todayKey,
					isClassDay: !(entry && entry.movedToDate) && (weeklyDays[dayOfWeek] === true || !!entry),
					entry: entry,
					classCount: entry && entry.classTopicIds ? entry.classTopicIds.length : 0,
					homeworkCount: entry && entry.homeworkTopicIds ? entry.homeworkTopicIds.length : 0,
					taskCount: entry && entry.tasks ? entry.tasks.length : 0,
					doneTaskCount: entry && entry.tasks ? entry.tasks.filter(function (task) { return vm.taskIsDone(task); }).length : 0
				});
			}
			while (cells.length % 7) { cells.push({isBlank: true}); }
			vm.scheduleCalendarDays = cells;
			vm.scheduleMonthLabel = 'THÁNG ' + (month + 1) + ' / ' + year;
		};

		vm.changeScheduleMonth = function (offset) {
			vm.scheduleMonthDate = new Date(
				vm.scheduleMonthDate.getFullYear(),
				vm.scheduleMonthDate.getMonth() + offset,
				1
			);
			vm.loadScheduleMonth();
		};

		vm.saveScheduleSettings = function () {
			if (vm.scheduleSaving || vm.scheduleSettingsLoading || vm.scheduleSettingsError || !vm.scheduleClass) { return; }
			var weeklySessions = [];
			var uniqueSessions = {};
			var invalid = false;
			angular.forEach(vm.scheduleClass.weeklySessions || [], function (session, index) {
				var startTime = formatScheduleTime(session.startTimeValue);
				var endTime = formatScheduleTime(session.endTimeValue);
				if (!session.dayOfWeek || !startTime || !endTime || endTime <= startTime) {
					invalid = true;
					return;
				}
				var key = session.dayOfWeek + '|' + startTime + '|' + endTime;
				if (uniqueSessions[key]) { invalid = true; return; }
				uniqueSessions[key] = true;
				weeklySessions.push({
					dayOfWeek: session.dayOfWeek,
					startTime: startTime,
					endTime: endTime,
					displayOrder: index
				});
			});
			if (invalid) {
				toastr.warning('Hãy chọn đủ ngày, giờ học và giờ tan học; giờ tan phải sau giờ học và không được trùng buổi.', 'Thông báo');
				return;
			}
			vm.scheduleSaving = true;
			service.saveScheduleSettings(vm.scheduleClass.id, {
				weeklySessions: weeklySessions
			}).then(function (saved) {
				vm.scheduleSaving = false;
				if (!saved) {
					toastr.error('Không lưu được giờ học.', 'Lỗi');
					return;
				}
				vm.scheduleClass.weeklySessions = (saved.weeklySessions || []).map(function (session) {
					return {
						id: session.id,
						dayOfWeek: session.dayOfWeek,
						startTimeValue: parseScheduleTime(session.startTime),
						endTimeValue: parseScheduleTime(session.endTime)
					};
				});
				vm.loadScheduleMonth();
				toastr.success('Đã lưu lịch học hằng tuần.', 'Thông báo');
			}, function () {
				vm.scheduleSaving = false;
				toastr.error('Không lưu được giờ học.', 'Lỗi');
			});
		};

		vm.addWeeklySession = function () {
			if (vm.scheduleSaving || vm.scheduleSettingsLoading || vm.scheduleSettingsError) { return; }
			var usedDays = {};
			angular.forEach(vm.scheduleClass.weeklySessions || [], function (session) {
				if (session.dayOfWeek) { usedDays[session.dayOfWeek] = true; }
			});
			var suggestedDay = null;
			angular.forEach(vm.weeklyDayOptions, function (option) {
				if (suggestedDay === null && !usedDays[option.value]) { suggestedDay = option.value; }
			});
			vm.scheduleClass.weeklySessions = vm.scheduleClass.weeklySessions || [];
			vm.scheduleClass.weeklySessions.push({
				dayOfWeek: suggestedDay,
				startTimeValue: null,
				endTimeValue: null
			});
		};

		vm.removeWeeklySession = function (index) {
			if (vm.scheduleSaving || vm.scheduleSettingsLoading || vm.scheduleSettingsError) { return; }
			vm.scheduleClass.weeklySessions.splice(index, 1);
		};

		function parseScheduleTime(value) {
			if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) { return null; }
			var parts = value.split(':');
			return new Date(1970, 0, 1, parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
		}

		function formatScheduleTime(value) {
			if (!value || !angular.isFunction(value.getHours)) { return null; }
			var hours = value.getHours();
			var minutes = value.getMinutes();
			return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
		}

		vm.openScheduleDay = function (cell) {
			if (!cell || cell.isBlank || vm.scheduleLoading || vm.scheduleMoving) { return; }
            homeworkCellSaveRequest++; homeworkCellDrafts = {}; vm.homeworkCellSaving = false;
			vm.scheduleDay = angular.copy(cell.entry || {
				enrolmentClassId: vm.scheduleClass.id,
				scheduleDate: cell.dateKey,
				classTopicIds: [],
				homeworkTopicIds: []
			});
			vm.scheduleDay.classTopicIds = vm.scheduleDay.classTopicIds || [];
			vm.scheduleDay.homeworkTopicIds = vm.scheduleDay.homeworkTopicIds || [];
			vm.scheduleDay.tasks = vm.scheduleDay.tasks || [];
			vm.scheduleDay.classNotes = vm.scheduleDay.classNotes || '';
			vm.scheduleDay.homeworkNotes = vm.scheduleDay.homeworkNotes || '';
            vm.scheduleMove = null; vm.scheduleSessionError = false; vm.scheduleSessionLoading = false;
            scheduleDaySnapshot = JSON.stringify(scheduleDayPayload());
			vm.taskEditor = null;
			vm.topicSelectionOpen = {classTopicIds: false, homeworkTopicIds: false};
			vm.scheduleDayModal = modal.open({
				animation: true,
				templateUrl: 'class_schedule_day_modal.html',
				scope: $scope,
				size: 'lg',
				windowClass: 'class-management-modal-window class-schedule-day-modal-window',
				keyboard: false,
				backdrop: 'static'
			});
            if (vm.scheduleDayModal.result && angular.isFunction(vm.scheduleDayModal.result.then)) {
                var openedModal = vm.scheduleDayModal;
                var invalidateSession = function () {
                    if (vm.scheduleDayModal === openedModal) { scheduleSessionRequest++; homeworkReviewRequest++; }
                };
                vm.scheduleDayModal.result.then(invalidateSession, invalidateSession);
            }
            vm.homeworkReviewSearch = ''; vm.homeworkReviewFilter = 'ALL';
            vm.loadPreviousHomework();
            vm.loadScheduleSession();
		};

        function scheduleDayPayload() {
            var day = vm.scheduleDay;
            return {id: day.id || null, scheduleDate: day.scheduleDate, version: day.version == null ? null : day.version,
                classTopicIds: day.classTopicIds || [], homeworkTopicIds: day.homeworkTopicIds || [],
                classNotes: day.classNotes || '', homeworkNotes: day.homeworkNotes || '', tasks: (day.tasks || []).map(scheduleTaskPayload)};
        }

        vm.loadScheduleSession = function () {
            if (!angular.isFunction(service.getScheduleSession)) { return; }
            var request = ++scheduleSessionRequest, classId = vm.scheduleClass.id, date = vm.scheduleDay.scheduleDate;
            vm.scheduleSessionLoading = true; vm.scheduleSessionError = false;
            return service.getScheduleSession(classId, date).then(function (info) {
                if (request !== scheduleSessionRequest || !vm.scheduleClass || vm.scheduleClass.id !== classId
                    || !vm.scheduleDay || vm.scheduleDay.scheduleDate !== date) { return; }
                vm.scheduleSessionLoading = false;
                if (!info || info.scheduleDate !== date || !angular.isArray(info.tasks)) { vm.scheduleSessionError = true; return; }
                vm.scheduleDay = angular.copy(info);
                vm.scheduleDay.classNotes = vm.scheduleDay.classNotes || ''; vm.scheduleDay.homeworkNotes = vm.scheduleDay.homeworkNotes || '';
                scheduleDaySnapshot = JSON.stringify(scheduleDayPayload());
                if (vm.scheduleDay.movedToDate) { vm.previousHomeworkDay = null; vm.previousHomeworkTasks = []; }
            }, function () {
                if (request !== scheduleSessionRequest || vm.scheduleClass.id !== classId || vm.scheduleDay.scheduleDate !== date) { return; }
                vm.scheduleSessionLoading = false; vm.scheduleSessionError = true;
                toastr.error('Không tải được buổi học và hạn mặc định. Hãy thử lại; chưa được lưu kế hoạch.', 'Lỗi');
            });
        };

        vm.openMovedScheduleDay = function () {
            var date = vm.scheduleDay && vm.scheduleDay.movedToDate;
            if (!date || vm.scheduleMoving) { return; }
            if (vm.scheduleDayModal) { vm.scheduleDayModal.close(); }
            vm.openScheduleDay({dateKey: date});
        };

        vm.openScheduleMove = function () {
            if (vm.scheduleDaySaving || vm.homeworkCellSaving || vm.scheduleSessionLoading || vm.scheduleSessionError || vm.taskEditor) { return; }
            vm.scheduleMove = {dateValue: null, startTimeValue: parseScheduleTime(vm.scheduleDay.sessionStartTime),
                endTimeValue: parseScheduleTime(vm.scheduleDay.sessionEndTime), reason: '', shiftManualDeadlines: false};
        };

        vm.moveScheduleDay = function () {
            if (!vm.scheduleMove || vm.scheduleMoving || vm.scheduleDaySaving || vm.homeworkCellSaving
                || vm.scheduleSessionLoading || vm.scheduleSessionError || vm.homeworkHasDrafts() || vm.taskEditor) { return; }
            if (JSON.stringify(scheduleDayPayload()) !== scheduleDaySnapshot) {
                toastr.warning('Có thay đổi kế hoạch chưa lưu. Hãy lưu kế hoạch rồi mở lại ngày này để dời buổi.'); return;
            }
            var move = vm.scheduleMove, date = move.dateValue && moment(move.dateValue).isValid() ? moment(move.dateValue).format('YYYY-MM-DD') : null;
            var start = formatScheduleTime(move.startTimeValue), end = formatScheduleTime(move.endTimeValue);
            if (!date || date === vm.scheduleDay.scheduleDate || !start || !end || end <= start) {
                toastr.warning('Chọn ngày mới và đủ giờ học / giờ tan; giờ tan phải sau giờ học.'); return;
            }
            var classId = vm.scheduleClass.id, fromDate = vm.scheduleDay.scheduleDate;
            vm.scheduleMoving = true;
            service.moveScheduleDay(classId, {dayId: vm.scheduleDay.id || null, dayVersion: vm.scheduleDay.version,
                fromDate: fromDate, toDate: date, startTime: start, endTime: end, reason: move.reason || '',
                shiftManualDeadlines: move.shiftManualDeadlines === true}).then(function (saved) {
                vm.scheduleMoving = false;
                if (!saved || saved.scheduleDate !== date || saved.id == null || saved.version == null || !angular.isArray(saved.tasks)) {
                    toastr.error('Chưa xác nhận dời buổi. Hãy tải lại lịch kiểm tra trước khi thử lại.'); return;
                }
                scheduleSessionRequest++; homeworkReviewRequest++;
                if (vm.scheduleDayModal) { vm.scheduleDayModal.close(); }
                vm.scheduleMonthDate = moment(date, 'YYYY-MM-DD', true).startOf('month').toDate();
                vm.loadScheduleMonth();
                toastr.success('Đã dời buổi sang ' + moment(date, 'YYYY-MM-DD').format('DD/MM/YYYY') + ' · ' + start + '–' + end + '.');
            }, function (error) {
                vm.scheduleMoving = false;
                toastr.error(error && error.data && error.data.message ? error.data.message : 'Không dời được buổi. Kế hoạch chưa bị ghi đè.');
            });
		};

        vm.loadPreviousHomework = function (discardDrafts) {
            if (vm.homeworkCellSaving) { return; }
            if (vm.homeworkHasDrafts() && !discardDrafts) { toastr.warning('Có sửa tiến độ chưa lưu. Hãy thử lưu lại hoặc chọn bỏ sửa và tải lại bảng.'); return; }
            homeworkCellDrafts = {};
            if (!vm.scheduleClass || !vm.scheduleDay || !vm.scheduleDay.scheduleDate) { return; }
            var request = ++homeworkReviewRequest;
            var classId = vm.scheduleClass.id, dateKey = vm.scheduleDay.scheduleDate;
            vm.previousHomeworkDay = null; vm.previousHomeworkTasks = [];
            vm.homeworkReviewLoading = true; vm.homeworkReviewError = false;
            vm.buildHomeworkReviewRows();
            return service.getPreviousScheduleDay(classId, dateKey).then(function (day) {
                if (request !== homeworkReviewRequest || !vm.scheduleClass || vm.scheduleClass.id !== classId
                    || !vm.scheduleDay || vm.scheduleDay.scheduleDate !== dateKey) { return; }
                vm.previousHomeworkDay = day && day.scheduleDate ? day : null;
                vm.previousHomeworkTasks = (day && angular.isArray(day.tasks) ? day.tasks : []).filter(function (task) {
                    return task && task.section === 'HOMEWORK';
                });
                vm.homeworkReviewLoading = false;
                vm.buildHomeworkReviewRows();
            }, function () {
                if (request !== homeworkReviewRequest || !vm.scheduleClass || vm.scheduleClass.id !== classId
                    || !vm.scheduleDay || vm.scheduleDay.scheduleDate !== dateKey) { return; }
                vm.homeworkReviewLoading = false; vm.homeworkReviewError = true;
                vm.buildHomeworkReviewRows();
            });
        };

        vm.previousHomeworkLabel = function () {
            return vm.previousHomeworkDay ? moment(vm.previousHomeworkDay.scheduleDate, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
        };

        vm.homeworkHasDrafts = function () { return Object.keys(homeworkCellDrafts).length > 0; };
        vm.markHomeworkCellDirty = function (cell) {
            cell.dirty = cell.editStatus !== cell.status || (cell.editNotes || '') !== cell.notes;
            cell.error = '';
            if (cell.dirty) { homeworkCellDrafts[cell.key] = cell; }
            else { delete homeworkCellDrafts[cell.key]; }
        };
        vm.saveHomeworkCell = function (row, cell) {
            if (!cell.dirty || vm.homeworkCellSaving || !vm.previousHomeworkDay || vm.scheduleDaySaving) { return; }
            if ((cell.editNotes || '').length > 1000) { cell.error = 'Nhận xét tối đa 1000 ký tự.'; return; }
            var request = ++homeworkCellSaveRequest, reviewRequest = homeworkReviewRequest;
            var classId = vm.scheduleClass.id, dayId = vm.previousHomeworkDay.id;
            var previousDate = vm.previousHomeworkDay.scheduleDate, currentDate = vm.scheduleDay.scheduleDate;
            var status = cell.automatic && cell.editStatus === cell.status ? cell.manualStatus || 'TODO' : cell.editStatus;
            var payload = {studentUserId: row.id, status: status, notes: cell.editNotes || '', dayVersion: vm.previousHomeworkDay.version};
            if (!dayId || !cell.taskId || payload.dayVersion == null) { cell.error = 'Ngày/task chưa được lưu hoặc backend chưa hỗ trợ. Hãy tải lại bảng.'; return; }
            vm.homeworkCellSaving = true; cell.saving = true; cell.error = '';
            function isCurrent() {
                return request === homeworkCellSaveRequest && reviewRequest === homeworkReviewRequest
                    && vm.scheduleClass && vm.scheduleClass.id === classId && vm.scheduleDay && vm.scheduleDay.scheduleDate === currentDate;
            }
            return service.updateTaskProgress(classId, dayId, cell.taskId, payload).then(function (saved) {
                if (!isCurrent()) { return; }
                vm.homeworkCellSaving = false; cell.saving = false;
                if (!saved || saved.id !== dayId || saved.scheduleDate !== previousDate || saved.version == null
                    || saved.version <= payload.dayVersion || !angular.isArray(saved.tasks)) {
                    cell.error = 'Backend chưa xác nhận lưu tiến độ. Hãy tải lại bảng để kiểm tra.'; return;
                }
                delete homeworkCellDrafts[cell.key];
                vm.previousHomeworkDay = saved;
                vm.previousHomeworkTasks = saved.tasks.filter(function (task) { return task.section === 'HOMEWORK'; });
                for (var i = 0; i < vm.scheduleEntries.length; i++) {
                    if (vm.scheduleEntries[i].scheduleDate === previousDate) { vm.scheduleEntries[i] = saved; break; }
                }
                vm.buildHomeworkReviewRows();
                toastr.success('Đã lưu tiến độ và nhận xét của học sinh.');
            }, function (error) {
                if (!isCurrent()) { return; }
                vm.homeworkCellSaving = false; cell.saving = false;
                cell.error = error && error.data && error.data.message ? error.data.message
                    : 'Không xác nhận được lưu. Thử lưu lại; nếu kế hoạch đã thay đổi, hãy tải lại bảng.';
            });
        };

        vm.buildHomeworkReviewRows = function () {
            var lookups = vm.previousHomeworkTasks.map(function (task) {
                var lookup = {};
                angular.forEach(task.studentProgress || [], function (progress) {
                    if (progress && progress.studentUserId != null) { lookup[String(progress.studentUserId)] = progress; }
                });
                return lookup;
            });
            vm.homeworkReviewRows = vm.scheduleStudents.map(function (student) {
                var done = 0, needsReview = 0, recorded = 0, partial = 0, progressTotal = 0;
                var cells = lookups.map(function (lookup, index) {
                    var progress = lookup[String(student.id)];
                    var status = progress ? progress.status : 'UNRECORDED';
                    if (progress && status !== 'UNRECORDED') { recorded++; }
                    var percent = /^PROGRESS_(10|20|30|40|50|60|70|80|90)$/.test(status) ? Number(status.substring(9)) : 0;
                    if (percent) { partial++; progressTotal += percent; }
                    if (status === 'DONE') { done++; progressTotal += 100; }
                    if (status === 'NEEDS_REVIEW') { needsReview++; }
                    var taskId = vm.previousHomeworkTasks[index].id, key = taskId + ':' + student.id;
                    return homeworkCellDrafts[key] || {status: status, notes: progress ? progress.notes || '' : '',
                        taskId: taskId, key: key, editStatus: status, editNotes: progress ? progress.notes || '' : '',
                        automatic: !!(progress && progress.automatic), manualStatus: progress && progress.manualStatus,
                        label: status === 'DONE' ? (progress.automatic ? 'Đã làm — tự động' : 'Đã làm') : status === 'NEEDS_REVIEW' ? 'Cần bổ sung'
                            : percent ? 'Đã làm ' + percent + '%' : status === 'TODO' ? 'Chưa làm' : 'Chưa xác nhận'};
                });
                var total = cells.length;
                var status = !total ? 'NO_TASKS' : done === total ? 'DONE' : needsReview ? 'NEEDS_REVIEW'
                    : recorded ? 'INCOMPLETE' : 'UNRECORDED';
                return {id: student.id, name: student.taskDisplayName || student.displayName || student.username,
                    username: student.username || '', cells: cells, done: done, total: total, status: status,
                    progressPercent: total ? Math.round(progressTotal / total) : 0,
                    label: !total ? 'Chưa có Tasks để đối chiếu' : status === 'DONE' ? 'Đã hoàn thành'
                        : status === 'NEEDS_REVIEW' ? 'Cần bổ sung' : status === 'UNRECORDED' ? 'Chưa xác nhận'
                        : partial ? 'Đang làm — ' + Math.round(progressTotal / total) + '%'
                        : done + '/' + total + ' đã làm'};
            });
            vm.homeworkReviewDoneCount = vm.homeworkReviewRows.filter(function (row) { return row.status === 'DONE'; }).length;
        };

        vm.filteredHomeworkRows = function () {
            var query = (vm.homeworkReviewSearch || '').toLowerCase().trim();
            return vm.homeworkReviewRows.filter(function (row) {
                return (!query || ((row.name || '') + ' ' + row.username).toLowerCase().indexOf(query) !== -1)
                    && (vm.homeworkReviewFilter === 'ALL' || (vm.homeworkReviewFilter === 'DONE' ? row.status === 'DONE'
                        : row.total > 0 && row.status !== 'DONE'));
            });
        };

		vm.scheduleDayLabel = function () {
			return vm.scheduleDay && vm.scheduleDay.scheduleDate
				? moment(vm.scheduleDay.scheduleDate, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
		};

		vm.toggleTopicSelection = function (field) {
            if (vm.scheduleSessionLoading || vm.scheduleSessionError || vm.scheduleMoving) { return; }
			vm.topicSelectionOpen[field] = !vm.topicSelectionOpen[field];
		};

		vm.selectedScheduleTopics = function (field) {
			var selectedIds = vm.scheduleDay && vm.scheduleDay[field] ? vm.scheduleDay[field] : [];
			var selectedLookup = {};
			angular.forEach(selectedIds, function (id) { selectedLookup[String(id)] = true; });
			return vm.scheduleTopics.filter(function (topic) {
				return topic && selectedLookup[String(topic.id)] === true;
			});
		};

		vm.saveScheduleDay = function () {
            if (vm.homeworkCellSaving || vm.homeworkHasDrafts()) { toastr.warning('Hãy lưu hoặc bỏ sửa tiến độ buổi trước trước khi lưu kế hoạch.'); return; }
			if (vm.scheduleDaySaving || vm.scheduleMoving || vm.scheduleSessionLoading || vm.scheduleSessionError
                || !vm.scheduleDay || vm.scheduleDay.movedToDate) { return; }
			if (vm.taskEditor) { toastr.warning('Hãy bấm Thêm task/Cập nhật task hoặc Hủy sửa trước khi lưu kế hoạch.'); return; }
			vm.scheduleDaySaving = true;
			service.saveScheduleDay(vm.scheduleClass.id, scheduleDayPayload()).then(function (saved) {
				vm.scheduleDaySaving = false;
				if (!saved) {
					toastr.error('Không lưu được kế hoạch ngày học.', 'Lỗi');
					return;
				}
				if (!angular.isArray(saved.tasks) || saved.version == null) {
					toastr.error('Backend chưa hỗ trợ Tasks. Chưa xác nhận lưu tasks; hãy cập nhật backend trước.', 'Cần cập nhật');
					return;
				}
				var replaced = false;
				for (var i = 0; i < vm.scheduleEntries.length; i++) {
					if (vm.scheduleEntries[i].scheduleDate === saved.scheduleDate) {
						vm.scheduleEntries[i] = saved;
						replaced = true;
						break;
					}
				}
				if (!replaced) { vm.scheduleEntries.push(saved); }
				vm.buildScheduleCalendar();
				if (vm.scheduleDayModal) { vm.scheduleDayModal.close(); }
				toastr.success('Đã lưu Class và Homework cho ngày ' + vm.scheduleDayLabel() + '.', 'Thông báo');
			}, function (error) {
				vm.scheduleDaySaving = false;
				toastr.error(error && error.data && error.data.message ? error.data.message : 'Không lưu được kế hoạch ngày học.', 'Lỗi');
			});
		};

		vm.loadScheduleStudents = function () {
			var request = ++scheduleStudentsRequest;
			vm.scheduleStudents = []; vm.scheduleStudentsLoading = true; vm.scheduleStudentsError = false;
            vm.buildHomeworkReviewRows();
			return service.getScheduleStudents(vm.scheduleClass.id).then(function (students) {
				if (request !== scheduleStudentsRequest) { return; }
				var seen = {};
				vm.scheduleStudents = (angular.isArray(students) ? students : []).filter(function (student) {
					if (!student || student.id == null || seen[String(student.id)]) { return false; }
					seen[String(student.id)] = true; student.taskDisplayName = responsibleDisplayName(student); return true;
				});
				vm.scheduleStudents.sort(function (a, b) { return (a.taskDisplayName || '').localeCompare(b.taskDisplayName || '', 'vi'); });
				vm.scheduleStudentsLoading = false;
				vm.buildHomeworkReviewRows();
                if (vm.scheduleClass && vm.scheduleMonthDate) { vm.buildScheduleCalendar(); }
			}, function () {
				if (request !== scheduleStudentsRequest) { return; }
				vm.scheduleStudentsLoading = false; vm.scheduleStudentsError = true;
                vm.buildHomeworkReviewRows();
                if (vm.scheduleClass && vm.scheduleMonthDate) { vm.buildScheduleCalendar(); }
			});
		};

		vm.buildScheduleTaskCategories = function () {
			var seen = {}; vm.scheduleTaskCategories = [];
			angular.forEach(vm.scheduleTopics, function (topic) {
				var key = topic.categoryId == null ? 'uncategorized' : String(topic.categoryId);
				if (!seen[key]) {
					seen[key] = true;
					vm.scheduleTaskCategories.push({id: key, name: topic.categoryName || 'Không phân loại'});
				}
			});
			vm.scheduleTaskCategories.sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });
		};

		vm.tasksForSection = function (section) {
			return ((vm.scheduleDay && vm.scheduleDay.tasks) || []).filter(function (task) { return task.section === section; });
		};

		vm.openScheduleTask = function (section, task) {
			if (vm.scheduleDaySaving || vm.scheduleMoving || vm.scheduleSessionLoading || vm.scheduleSessionError || vm.taskEditor) { return; }
			if (!task && vm.scheduleDay.tasks.length >= 100) { toastr.warning('Tối đa 100 tasks cho một ngày.'); return; }
			vm.taskEditorIndex = task ? vm.scheduleDay.tasks.indexOf(task) : -1;
			vm.taskEditor = angular.copy(task || {section: section, title: '', notes: '', status: 'TODO', topicId: null, studentProgress: []});
            vm.taskEditor.deadlineAutomatic = section === 'HOMEWORK' && (task
                ? task.deadlineAutomatic === true || (task.deadlineAutomatic == null && !task.dueDate) : true);
            vm.taskEditor.legacyDateOnly = !!(task && task.dueDate && !task.dueTime);
            vm.taskEditor.dueDateValue = vm.taskEditor.dueDate ? moment(vm.taskEditor.dueDate + 'T' + (vm.taskEditor.dueTime || '23:59'), 'YYYY-MM-DDTHH:mm', true).toDate() : null;
            vm.taskDeadlineChanged();
			vm.taskEditor.categoryKey = vm.taskEditor.topicId == null ? null : (vm.taskEditor.categoryId == null ? 'uncategorized' : String(vm.taskEditor.categoryId));
			vm.taskEditor.studentProgress = vm.taskEditor.studentProgress || [];
			vm.taskEditor.autoCompleteFromTopic = vm.taskEditor.autoCompleteFromTopic !== false;
			vm.taskEditor.showProgress = false;
		};

		vm.cancelScheduleTask = function () { vm.taskEditor = null; vm.taskEditorIndex = -1; };
        vm.taskDeadlineChanged = function () {
            if (!vm.taskEditor) { return; }
            if (vm.taskEditor.deadlineAutomatic) {
                vm.taskEditor.dueDateValue = vm.scheduleDay.defaultHomeworkDeadline
                    ? moment(vm.scheduleDay.defaultHomeworkDeadline, 'YYYY-MM-DDTHH:mm', true).toDate() : null;
                vm.taskEditor.legacyDateOnly = false;
            }
        };
        vm.taskDeadlineEdited = function () { if (vm.taskEditor) { vm.taskEditor.legacyDateOnly = false; } };
		vm.taskCategoryChanged = function () { vm.taskEditor.topicId = null; };
		vm.taskTopics = function () {
			if (!vm.taskEditor || !vm.taskEditor.categoryKey) { return []; }
			return vm.scheduleTopics.filter(function (topic) {
				return (topic.categoryId == null ? 'uncategorized' : String(topic.categoryId)) === vm.taskEditor.categoryKey;
			});
		};

		vm.taskStudentProgress = function (student) {
			var found = null;
			angular.forEach(vm.taskEditor.studentProgress, function (entry) {
				if (String(entry.studentUserId) === String(student.id)) { found = entry; }
			});
			if (!found) {
				found = {studentUserId: student.id, status: 'TODO', notes: ''}; vm.taskEditor.studentProgress.push(found);
			}
			return found;
		};

		function scheduleTaskPayload(task) {
			var progress = (task.studentProgress || []).map(function (entry) {
				return {studentUserId: entry.studentUserId, status: entry.automatic ? entry.manualStatus || 'TODO' : entry.status,
					notes: entry.notes || ''};
			}).filter(function (entry) { return entry.status !== 'TODO' || (entry.notes || '').trim(); });
			return {id: task.id || null, section: task.section, title: task.title, notes: task.notes || '',
				dueDate: task.deadlineAutomatic === true ? null : task.dueDate || null,
                dueTime: task.deadlineAutomatic === true ? null : task.dueTime || null,
                deadlineAutomatic: task.deadlineAutomatic == null ? null : task.deadlineAutomatic,
                status: task.status || 'TODO', topicId: task.topicId || null,
				autoCompleteFromTopic: task.autoCompleteFromTopic !== false,
				studentProgress: progress};
		}

		vm.commitScheduleTask = function () {
			if (!vm.taskEditor || vm.scheduleDaySaving) { return; }
			var task = angular.copy(vm.taskEditor); task.title = (task.title || '').trim();
			if (!task.title || task.title.length > 200) { toastr.warning('Nhập tên task từ 1 đến 200 ký tự.'); return; }
			if (task.dueDateValue && !moment(task.dueDateValue).isValid()) { toastr.warning('Hạn hoàn thành không hợp lệ.'); return; }
            if (task.deadlineAutomatic && !vm.scheduleDay.defaultHomeworkDeadline) {
                toastr.warning('Chưa có giờ tan buổi kế tiếp. Hãy thiết lập lịch hoặc bỏ hạn tự động và nhập ngày giờ.'); return;
            }
			task.dueDate = !task.deadlineAutomatic && task.dueDateValue ? moment(task.dueDateValue).format('YYYY-MM-DD') : null;
            task.dueTime = !task.deadlineAutomatic && task.dueDateValue && !task.legacyDateOnly ? moment(task.dueDateValue).format('HH:mm') : null;
            var assigned = task.id && vm.scheduleDay.movedFromDate && vm.scheduleDay.movedFromDate < vm.scheduleDay.scheduleDate
                ? vm.scheduleDay.movedFromDate : vm.scheduleDay.scheduleDate;
			if (task.dueDate && task.dueDate < assigned) { toastr.warning('Hạn hoàn thành không được trước ngày giao bài.'); return; }
            task.resolvedDueDate = task.deadlineAutomatic ? vm.scheduleDay.defaultHomeworkDeadline.slice(0, 10) : task.dueDate;
            task.resolvedDueTime = task.deadlineAutomatic ? vm.scheduleDay.defaultHomeworkDeadline.slice(11, 16) : task.dueTime;
			var topic = null;
			angular.forEach(vm.scheduleTopics, function (item) { if (String(item.id) === String(task.topicId)) { topic = item; } });
			if (task.topicId != null && !topic) { toastr.warning('Topic không còn tồn tại. Hãy chọn lại.'); return; }
			task.topicName = topic ? topic.name : ''; task.categoryId = topic ? topic.categoryId : null;
			task.categoryName = topic ? topic.categoryName : '';
			task.studentProgress = scheduleTaskPayload(task).studentProgress;
			delete task.showProgress; delete task.dueDateValue; delete task.categoryKey; delete task._confirmDelete; delete task.legacyDateOnly;
			if (vm.taskEditorIndex < 0) { vm.scheduleDay.tasks.push(task); }
			else { vm.scheduleDay.tasks[vm.taskEditorIndex] = task; }
			vm.cancelScheduleTask();
		};

		vm.removeScheduleTask = function (task) {
			if (vm.scheduleDaySaving || vm.taskEditor) { return; }
			if (!task._confirmDelete) { task._confirmDelete = true; return; }
			var index = vm.scheduleDay.tasks.indexOf(task);
			if (index >= 0) { vm.scheduleDay.tasks.splice(index, 1); }
		};

		vm.taskStatusLabel = function (task) {
            if (task.section === 'HOMEWORK') {
                if (vm.scheduleStudentsLoading || vm.scheduleStudentsError || !vm.scheduleStudents.length) { return 'Chưa xác nhận'; }
                var recorded = (task.studentProgress || []).filter(function (entry) { return entry.status !== 'UNRECORDED'
                    && vm.scheduleStudents.some(function (student) { return String(student.id) === String(entry.studentUserId); }); });
                return vm.taskIsDone(task) ? 'Đã hoàn thành' : recorded.length ? 'Chưa hoàn thành' : 'Chưa xác nhận';
            }
			return task.status === 'DONE' ? 'Hoàn thành' : (task.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Chưa làm');
		};
        vm.taskIsDone = function (task) {
            if (task.section !== 'HOMEWORK') { return task.status === 'DONE'; }
            return !vm.scheduleStudentsLoading && !vm.scheduleStudentsError && vm.scheduleStudents.length > 0
                && vm.scheduleStudents.every(function (student) { return (task.studentProgress || []).some(function (entry) {
                    return String(entry.studentUserId) === String(student.id) && entry.status === 'DONE';
                }); });
        };
        function taskDeadline(task) {
            var date = task.resolvedDueDate || task.dueDate, time = task.resolvedDueTime || task.dueTime;
            if (!date) { return null; }
            return time ? moment(date + 'T' + time, 'YYYY-MM-DDTHH:mm', true) : moment(date, 'YYYY-MM-DD', true).endOf('day');
        }
		vm.taskOverdue = function (task) { var due = taskDeadline(task); return !vm.taskIsDone(task) && !!due && due.isBefore(moment()); };
		vm.taskDueLabel = function (task) { var due = taskDeadline(task); return due ? due.format('DD/MM/YYYY HH:mm') + (!task.resolvedDueTime && !task.dueTime ? ' (hết ngày)' : '') : ''; };
		vm.taskCompletion = function (task) {
			if (vm.scheduleStudentsLoading || vm.scheduleStudentsError) { return 'Chưa tải được tiến độ lớp'; }
			var done = {};
			angular.forEach(task.studentProgress || [], function (entry) { if (entry.status === 'DONE') { done[String(entry.studentUserId)] = true; } });
			var count = vm.scheduleStudents.filter(function (student) { return done[String(student.id)]; }).length;
			return count + '/' + vm.scheduleStudents.length + ' học sinh đã làm';
		};

        vm.openEditor = function (item, parentId) {
            if (item && item.id) {
				if (item.canEdit !== true) {
					toastr.warning('Bạn không được sửa lớp này.', 'Thông báo');
					return;
				}
                service.getOne(item.id).then(function (data) {
					var object = data || {};
					if (object.canEdit !== true) {
						toastr.warning('Bạn không được sửa lớp này.', 'Thông báo');
						return;
					}
					vm.loadTeachers(object.parentId, false, object.id).then(function () {
						if (!vm.candidatesError) { vm.showEditor(object); }
					});
                });
                return;
            }
			var parent = parentId ? vm.findClass(parentId) : null;
			if (parentId && (!parent || parent.canAddChild !== true)) {
				toastr.warning('Bạn không được thêm lớp con vào lớp này.', 'Thông báo');
				return;
			}
			if (!parentId && !vm.canCreateRootClass()) {
				toastr.warning('Bạn không được tạo lớp gốc.', 'Thông báo');
				return;
			}
            var newObject = {
                isNew: true,
                parentId: parentId || null,
				schoolId: parent ? parent.schoolId : vm.schoolId,
                teacherIds: []
            };
			vm.loadTeachers(newObject.parentId, false, newObject.id).then(function () {
				if (!vm.candidatesError) { vm.showEditor(newObject); }
			});
        };

        vm.showEditor = function (object) {
            vm.enrolmentClass = angular.copy(object || {});
            vm.enrolmentClass.isNew = !vm.enrolmentClass.id;
            vm.enrolmentClass.teacherIds = vm.enrolmentClass.teacherIds || [];
            vm.enrolmentClass.primaryTeacherId = vm.enrolmentClass.primaryTeacherId || null;
            vm.enrolmentClass.deputyTeacherIds = angular.isArray(vm.enrolmentClass.deputyTeacherIds)
                ? vm.enrolmentClass.deputyTeacherIds : vm.enrolmentClass.teacherIds.slice();
            vm.primaryChanged();
			vm.originalParentId = vm.enrolmentClass.parentId || null;
            vm.modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'lg',
                windowClass: 'class-management-modal-window'
            });
        };

        vm.availableParents = function () {
			var candidates = vm.allClasses.filter(function (item) {
				return item.canAddChild === true || item.id === vm.originalParentId;
			});
            if (!vm.enrolmentClass.id) {
				return candidates;
            }
            var forbidden = {};
            forbidden[vm.enrolmentClass.id] = true;
            var changed = true;
            while (changed) {
                changed = false;
			angular.forEach(candidates, function (item) {
                if (item.parentId && forbidden[item.parentId] && !forbidden[item.id]) {
                        forbidden[item.id] = true;
                        changed = true;
                    }
                });
            }
			return candidates.filter(function (item) { return !forbidden[item.id]; });
        };

        vm.saveObject = function () {
            if (!vm.canAccessList() || Number(vm.enrolmentClass.schoolId) !== vm.schoolId) {
                toastr.warning('Lớp không thuộc danh sách hiện tại.', 'Thông báo');
                return;
            }
            if (vm.saving || vm.candidatesLoading || vm.candidatesError) { return; }
            if (!vm.enrolmentClass.name || !vm.enrolmentClass.name.trim()) {
                toastr.warning('Bạn chưa nhập tên lớp.', 'Thông báo');
                return;
            }
            vm.primaryChanged();
            var assignedIds = vm.enrolmentClass.deputyTeacherIds.slice();
            if (vm.enrolmentClass.primaryTeacherId != null) {
                assignedIds.push(vm.enrolmentClass.primaryTeacherId);
            }
            var allowedIds = {};
            angular.forEach(vm.teacherCandidates, function (candidate) { allowedIds[candidate.id] = true; });
            if (assignedIds.some(function (id) { return !allowedIds[id]; })) {
                toastr.warning('Có người phụ trách không còn thuộc danh sách được phép. Hãy chọn lại.', 'Thông báo');
                return;
            }
            vm.enrolmentClass.teacherIds = assignedIds;
            vm.saving = true;
            service.saveObject(vm.enrolmentClass).then(function (saved) {
                vm.saving = false;
                if (saved !== true) {
                    toastr.error('Không thể lưu. Hãy kiểm tra lớp cha và người phụ trách đã chọn.', 'Lỗi');
                    return;
                }
                toastr.success('Đã lưu lớp học.', 'Thông báo');
                if (vm.modalInstance) {
                    vm.modalInstance.close();
                }
                vm.load();
            }, function () {
                vm.saving = false;
                toastr.error('Có lỗi khi lưu lớp học.', 'Lỗi');
            });
        };

        vm.confirmDelete = function (item) {
			if (!item || item.canEdit !== true) {
				toastr.warning('Bạn không được xóa lớp này.', 'Thông báo');
				return;
			}
            vm.enrolmentClassToDelete = item;
            var confirmModal = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'md',
                windowClass: 'class-management-modal-window'
            });
            confirmModal.result.then(function (answer) {
                if (answer !== 'yes') {
                    return;
                }
                service.deleteObject(item.id).then(function (deleted) {
                    if (deleted !== true) {
                        toastr.warning('Không thể xóa lớp đang có tổ/lớp con hoặc có học sinh.', 'Thông báo');
                        return;
                    }
                    toastr.success('Đã xóa lớp học.', 'Thông báo');
                    vm.load();
                });
            });
        };

        $scope.$watchGroup(['settings.permissionsLoaded', 'settings.isViewer', 'settings.isAdmin',
            'settings.isEducationManagerment', 'settings.isStudentManagerment', 'settings.isStaff'], function () {
            vm.load();
        });
    }
})();
