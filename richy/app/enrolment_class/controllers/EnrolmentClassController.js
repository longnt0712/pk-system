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
        vm.expanded = {};
        vm.searchText = '';
        vm.enrolmentClass = {};
        vm.saving = false;
        vm.modalInstance = null;
        vm.teamBoard = null;
        vm.teamBoardModal = null;
        vm.teamSearchText = '';
        vm.teamBoardSaving = false;

        vm.canEditClassStructure = function () {
            var currentSettings = $rootScope.settings || {};
            return currentSettings.isAdmin === true || currentSettings.isEducationManagerment === true;
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

        vm.loadTeachers = function () {
            service.getTeacherCandidates().then(function (data) {
                vm.teacherCandidates = angular.isArray(data) ? data : [];
				vm.teacherCandidates.sort(function (a, b) {
					return (a.displayName || a.username || '').localeCompare(
						b.displayName || b.username || '', 'vi');
				});
            });
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
                item.hasChildren = children[item.id].length > 0;
                result.push(item);
                if (query || vm.expanded[item.id]) {
                    angular.forEach(children[item.id], function (child) {
                        append(child, level + 1);
                    });
                }
            }

            angular.forEach(roots, function (root) { append(root, 0); });
            angular.forEach(vm.allClasses, function (item) { append(item, 0); });
            vm.visibleClasses = result;
        };

        vm.toggle = function (item) {
            if (!item.hasChildren) {
                return;
            }
            vm.expanded[item.id] = !vm.expanded[item.id];
            vm.rebuildTree();
        };

        vm.teacherNames = function (item) {
            return (item.teachers || []).map(function (teacher) {
                return teacher.displayName || teacher.username;
            }).join(', ');
        };

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
                    backdrop: 'static'
                });
            }, function () {
                toastr.error('Không tải được danh sách phân đội hoặc bạn không có quyền.', 'Lỗi');
            });
        };

        vm.studentName = function (student) {
            return student ? (student.displayName || student.username || 'Học sinh') : '';
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
                service.getOne(item.id).then(function (data) {
                    vm.showEditor(data || {});
                });
                return;
            }
            vm.showEditor({
                isNew: true,
                parentId: parentId || null,
                teacherIds: []
            });
        };

        vm.showEditor = function (object) {
            vm.enrolmentClass = angular.copy(object || {});
            vm.enrolmentClass.isNew = !vm.enrolmentClass.id;
            vm.enrolmentClass.teacherIds = vm.enrolmentClass.teacherIds || [];
            vm.modalInstance = modal.open({
                animation: true,
                templateUrl: 'edit_object_modal.html',
                scope: $scope,
                size: 'lg'
            });
        };

        vm.availableParents = function () {
            if (!vm.enrolmentClass.id) {
                return vm.allClasses;
            }
            var forbidden = {};
            forbidden[vm.enrolmentClass.id] = true;
            var changed = true;
            while (changed) {
                changed = false;
                angular.forEach(vm.allClasses, function (item) {
                    if (item.parentId && forbidden[item.parentId] && !forbidden[item.id]) {
                        forbidden[item.id] = true;
                        changed = true;
                    }
                });
            }
            return vm.allClasses.filter(function (item) { return !forbidden[item.id]; });
        };

        vm.saveObject = function () {
            if (!vm.enrolmentClass.name || !vm.enrolmentClass.name.trim()) {
                toastr.warning('Bạn chưa nhập tên lớp.', 'Thông báo');
                return;
            }
            vm.saving = true;
            service.saveObject(vm.enrolmentClass).then(function (saved) {
                vm.saving = false;
                if (saved !== true) {
                    toastr.error('Không thể lưu. Hãy kiểm tra lớp cha và giáo viên phụ trách.', 'Lỗi');
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
            vm.enrolmentClassToDelete = item;
            var confirmModal = modal.open({
                animation: true,
                templateUrl: 'confirm_delete_modal.html',
                scope: $scope,
                size: 'md'
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
        if (vm.canEditClassStructure()) {
            vm.loadTeachers();
        }
    }
})();
