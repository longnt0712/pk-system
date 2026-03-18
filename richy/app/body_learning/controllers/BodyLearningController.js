/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.BodyLearning').controller('BodyLearningController', BodyLearningController);

    BodyLearningController.$inject = [
        '$rootScope',
        '$scope',
        'toastr',
        '$timeout',
        'settings',
        'Utilities',
        '$uibModal',
        'BodyLearningService',
        '$cookies'
    ];

    function BodyLearningController($rootScope, $scope, toastr, $timeout, settings, utils, modal, service,$cookies) {
        $scope.$on('$viewContentLoaded', function () {
            // initialize core components
            App.initAjax();
        });

        // set sidebar closed and body solid layout mode
        $rootScope.settings.layout.pageContentWhite = true;
        $rootScope.settings.layout.pageBodySolid = false;
        $rootScope.settings.layout.pageSidebarClosed = false;

        var vm = this;

        vm.bodies = [];
        vm.left = [];
        vm.right = [];
        vm.answer = {};

        vm.result = {};

        /* TINYMCE */
        vm.tinymceOptions = {
            height: 130,
            theme: 'modern',
            plugins: [
                'lists fullscreen' //autoresize
            ],
            toolbar1: 'bold underline italic | removeformat | bullist numlist outdent indent | fullscreen',
            content_css: [
                '//fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
                '/assets/css/tinymce_content.css'
            ],
            autoresize_bottom_margin: 0,
            statusbar: false,
            menubar: false
        };

        vm.getRandomAllObject = function () {
            service.getRandomAllObject().then(function (data) {
                vm.bsTableLeftControl.options.data = data;
                console.log(vm.bodies);
            });
        };
        vm.getRandomAllObject();

        vm.bsTableLeftControl = {
            options: {
                data: vm.bodys,
                idField: 'id',
                sortable: false,
                striped: true,
                maintainSelected: false,
                clickToSelect: true,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: 10,
                pageList: [5, 10, 25, 50, 100],
                locale: settings.locale,
                sidePagination: 'client',
                columns: service.getTableLeftDefinition(),
                onCheck: function (row, $element) {
                    $scope.$apply(function () {
                        vm.selectedBodys.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedBodys = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedBodys.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedBodys = [];
                    });
                },
                onPageChange: function (index, pageSize) {
                    // vm.pageSize = pageSize;
                    // vm.pageIndex = index;
                    // vm.getPage();
                    var audio = document.getElementById("audio1");
                    audio.load();
                    $scope.refreshTimer();
                }
            }
        };

        vm.bsTableRightControl = {
            options: {
                data: vm.bodys,
                idField: 'id',
                sortable: false,
                striped: true,
                maintainSelected: false,
                clickToSelect: true,
                showColumns: false,
                showToggle: false,
                pagination: true,
                pageSize: 10,
                pageList: [5, 10, 25, 50, 100],
                locale: settings.locale,
                sidePagination: 'client',
                columns: service.getTableRightDefinition(),
                onCheck: function (row, $element) {
                    $scope.$apply(function () {
                        vm.selectedBodys.push(row);
                    });
                },
                onCheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedBodys = rows;
                    });
                },
                onUncheck: function (row, $element) {
                    var index = utils.indexOf(row, vm.selectedpositiontitles);
                    if (index >= 0) {
                        $scope.$apply(function () {
                            vm.selectedBodys.splice(index, 1);
                        });
                    }
                },
                onUncheckAll: function (rows) {
                    $scope.$apply(function () {
                        vm.selectedBodys = [];
                    });
                },
                onPageChange: function (index, pageSize) {
                    // vm.pageSize = pageSize;
                    // vm.pageIndex = index;
                    // vm.getPage();
                    var audio = document.getElementById("audio1");
                    audio.load();
                    $scope.refreshTimer();
                }
            }
        };


        $scope.counter = 65;
        var mytimeout = null; // the current timeoutID
        var audio = document.getElementById("audio1");


        // actual timer method, counts down every second, stops on zero
        $scope.onTimeout = function() {
            if($scope.counter ===  0 || $scope.counter < 0) {
                $scope.counter = 0;
                $scope.$broadcast('timer-stopped', 0);
                $timeout.cancel(mytimeout);
                return;
            }
            $scope.counter--;
            if($scope.counter == 60){
                // var audio = document.getElementById("audio1");
                audio.load();
                audio.play();
            }
            mytimeout = $timeout($scope.onTimeout, 1000);
        };

        $scope.startCount = function() {
            $scope.refreshTimer();
            $scope.isRunning = false;
            mytimeout = $timeout($scope.onTimeout, 1000);
            audio.load();
        };

        $scope.refreshTimer = function () {
            $timeout.cancel(mytimeout);
            $scope.counter = 65;
        }
    }

})();