(function () {
    'use strict';

    angular.module('Hrm.EnrolmentClass').controller('EnrolmentClassController', EnrolmentClassController);

    EnrolmentClassController.$inject = [
        '$rootScope', '$scope', 'toastr', '$uibModal', 'EnrolmentClassService'
    ];

    function EnrolmentClassController($rootScope, $scope, toastr, modal, service) {
        $scope.$on('$viewContentLoaded', function () {
            App.initAjax();
        });

        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;
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
				|| currentSettings.isEducationManagerment === true;
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
            service.getTree().then(function (data) {
                vm.allClasses = angular.isArray(data) ? data : [];
                angular.forEach(vm.allClasses, function (item) {
                    if (angular.isUndefined(vm.expanded[item.id])) {
                        vm.expanded[item.id] = true;
                    }
                });
                vm.rebuildTree();
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
			return service.getSchedule(vm.scheduleClass.id, firstDay, lastDay).then(function (data) {
				vm.scheduleEntries = angular.isArray(data) ? data : [];
				vm.buildScheduleCalendar();
				vm.scheduleLoading = false;
			}, function () {
				vm.scheduleEntries = [];
				vm.buildScheduleCalendar();
				vm.scheduleLoading = false;
				toastr.error('Không tải được lịch trong tháng.', 'Lỗi');
			});
		};

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
					isClassDay: weeklyDays[dayOfWeek] === true,
					entry: entry,
					classCount: entry && entry.classTopicIds ? entry.classTopicIds.length : 0,
					homeworkCount: entry && entry.homeworkTopicIds ? entry.homeworkTopicIds.length : 0
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
				if (!vm.scheduleLoading) { vm.buildScheduleCalendar(); }
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
			if (!cell || cell.isBlank || vm.scheduleLoading) { return; }
			vm.scheduleDay = angular.copy(cell.entry || {
				enrolmentClassId: vm.scheduleClass.id,
				scheduleDate: cell.dateKey,
				classTopicIds: [],
				homeworkTopicIds: []
			});
			vm.scheduleDay.classTopicIds = vm.scheduleDay.classTopicIds || [];
			vm.scheduleDay.homeworkTopicIds = vm.scheduleDay.homeworkTopicIds || [];
			vm.topicSelectionOpen = {classTopicIds: false, homeworkTopicIds: false};
			vm.scheduleDayModal = modal.open({
				animation: true,
				templateUrl: 'class_schedule_day_modal.html',
				scope: $scope,
				size: 'lg',
				windowClass: 'class-management-modal-window class-schedule-day-modal-window',
				backdrop: 'static'
			});
		};

		vm.scheduleDayLabel = function () {
			return vm.scheduleDay && vm.scheduleDay.scheduleDate
				? moment(vm.scheduleDay.scheduleDate, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
		};

		vm.toggleTopicSelection = function (field) {
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
			if (vm.scheduleDaySaving || !vm.scheduleDay) { return; }
			vm.scheduleDaySaving = true;
			service.saveScheduleDay(vm.scheduleClass.id, {
				id: vm.scheduleDay.id || null,
				scheduleDate: vm.scheduleDay.scheduleDate,
				classTopicIds: vm.scheduleDay.classTopicIds || [],
				homeworkTopicIds: vm.scheduleDay.homeworkTopicIds || []
			}).then(function (saved) {
				vm.scheduleDaySaving = false;
				if (!saved) {
					toastr.error('Không lưu được kế hoạch ngày học.', 'Lỗi');
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
			}, function () {
				vm.scheduleDaySaving = false;
				toastr.error('Không lưu được kế hoạch ngày học.', 'Lỗi');
			});
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
				schoolId: parent ? parent.schoolId : (vm.isAdmin() ? null : 2),
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

        vm.load();
    }
})();
