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
