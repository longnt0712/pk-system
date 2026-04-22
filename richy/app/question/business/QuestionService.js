/**
 * Created by nguyen the dat on 23/4/2018.
 */
(function () {
    'use strict';

    angular.module('Hrm.Question').service('QuestionService', QuestionService);

    QuestionService.$inject = [
        '$http',
        '$q',
        '$filter',
        'settings',
        'Utilities',
    ];

    function QuestionService($http, $q, $filter, settings, utils) {
        var self = this;
        var baseUrl = settings.api.baseUrl + settings.api.apiV1Url;
        // console.log(baseUrl);
        self.getPage = getPage;
        self.getPageForGames = getPageForGames;
        self.getPageForTests = getPageForTests;
        self.getPageOnlyQuestion = getPageOnlyQuestion;
        
        self.saveObject = saveObject;
        self.saveMaterial = saveMaterial;
        self.getOne = getOne;
        self.deleteObject = deleteObject;
        self.getTableDefinition = getTableDefinition;
        self.getTableDefinitionCreateIELTSWritingTest = getTableDefinitionCreateIELTSWritingTest;
        self.getTableDefinitionCreateIELTSReadingTest = getTableDefinitionCreateIELTSReadingTest ;
        self.getTableDefinitionCreateIELTSListeningTest = getTableDefinitionCreateIELTSListeningTest;
        self.getTableDefinitionSubFlashCards = getTableDefinitionSubFlashCards;

        self.getTableDefinitionIeltsMaterial = getTableDefinitionIeltsMaterial;

        self.getAnswers = getAnswers;
        self.getQuestionTypes = getQuestionTypes;

        self.getRandomQuestion = getRandomQuestion;
        self.getRandomQuestionQuiz = getRandomQuestionQuiz;
        self.getTopics = getTopics;

        self.getStatisticQuestionUser = getStatisticQuestionUser;
        self.getTableDefinitionStatisticUser = getTableDefinitionStatisticUser;
        self.getTableDefinitionQuestions = getTableDefinitionQuestions;

        self.getPageTopicCategory = getPageTopicCategory;
        function getPageTopicCategory(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'topic_category' + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }


        // self.getBrands = brands;

        function getRandomQuestion(searchDto,successCallback, errorCallback) {
            var url = baseUrl + restUrl+'/' + 'get_random_flash_card/';

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getRandomQuestionQuiz(searchDto,successCallback, errorCallback) {
            var url = baseUrl + restUrl+'/' + 'get_random_flash_card_quiz/';

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getAnswers(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'answer' + '/get_page';
            url += '/'+pageIndex;
            url += '/'+ ((pageSize > 0) ? pageSize : 10000);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        self.getAllTopics = getAllTopics;
        function getAllTopics(searchdto,successCallback, errorCallback) {
            var url = baseUrl + 'topic' + '/get_all_topics';

            return utils.resolveAlt(url, 'POST', null, searchdto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }


        function getTopics(searchdto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'topic' + '/get_page';
            url += '/'+pageIndex;
            url += '/'+ ((pageSize > 0) ? pageSize : 10000);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchdto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getQuestionTypes(searchdto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'question_type' + '/get_page';
            url += '/'+1;
            url += '/'+ 100000000;
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        var restUrl = 'question';
        function getPage(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getPageForGames(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page_for_games';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getPageForTests(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page_for_tests';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getPageOnlyQuestion(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page_only_question';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getStatisticQuestionUser(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_statistic_question_user';
            url += '/'+pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);
            // console.log(url);

            return utils.resolveAlt(url, 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function saveObject(object, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function saveMaterial(object, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/save_material';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getOne(id) {
            if (!id) {
                return $q.when(null);
            }

            var url = baseUrl + restUrl+'/' + 'get_one/' + id;
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        function deleteObject(id, successCallback, errorCallback) {
            if (!id) {
                return $q.when(null);
            }
            var url = baseUrl+ restUrl + '/delete/' + id;
            return utils.resolveAlt(url, 'DELETE', null, null, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        //test_result
        self.saveTestResult = saveTestResult;
        self.getOneTestResult = getOneTestResult;

        function saveTestResult(object, successCallback, errorCallback) {
            var url = baseUrl + 'test_result' + '/save';

            return utils.resolveAlt(url, 'POST', null, object, {
                'Content-Type': 'application/json; charset=utf-8'
            }, successCallback, errorCallback);
        }

        function getOneTestResult(id) {
            if (!id) {
                return $q.when(null);
            }

            var url = baseUrl + 'test_result' +'/' + 'get_one/' + id;
            return utils.resolve(url, 'GET', angular.noop, angular.noop);
        }

        //---------------------------------- table ---------------------------------------//

        function getTableDefinition() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" data-ng-click="$parent.editIELTSWriting(' + "'" + row.id + "'" + ')"><i class="icon-pencil"></i></a>'
                    +  '<a class="green-dark " href="#" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if(value == null) return '';
                var text = '';
                for(var i= 0; i < value.length; i++){
                    if(value[i].topic != null){
                        if(i == value.length - 1){
                            text += value[i].topic.name ;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM/YYYY');
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'title',
                    title: 'Title',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'question',
                //     title: 'Question',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                , {
                    field: 'author',
                    title: 'Author',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'createDate',
                    title: 'Created Date',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _dateFormatter
                }
                , {
                    field: 'questionTopics',
                    title: 'Topic',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _topicFormatter
                }
            ]
        }

        function getTableDefinitionQuestions() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" data-ng-click="$parent.chooseFillingGaps(' + "'" + index + "'" + ')"><i class="icon-pencil"></i></a>';
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if(value == null) return '';
                var text = '';
                for(var i= 0; i < value.length; i++){
                    if(value[i].topic != null){
                        if(i == value.length - 1){
                            text += value[i].topic.name ;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM/YYYY');
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'question',
                    title: 'Title',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }

        function getTableDefinitionIeltsMaterial() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" data-ng-click="$parent.selectToLearn(' + "'" + row.id + "'" + ')"><i class="icon-plus"></i></a>';
                    // +  '<a class="green-dark " href="#" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if(value == null) return '';
                var text = '';
                for(var i= 0; i < value.length; i++){
                    if(value[i].topic != null){
                        if(i == value.length - 1){
                            text += value[i].topic.name ;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM/YYYY');
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'title',
                    title: 'Title',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'question',
                //     title: 'Question',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                , {
                    field: 'author',
                    title: 'Author',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'createDate',
                    title: 'Created Date',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _dateFormatter
                }
                , {
                    field: 'questionTopics',
                    title: 'Topic',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _topicFormatter
                }
            ]
        }

        function getTableDefinitionSubFlashCards() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" data-ng-click="$parent.editFlashCard(' + "'" + row.id + "'" + ')"><i class="icon-pencil"></i></a>'
                    +  '<a class="green-dark " href="#" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if(value == null) return '';
                var text = '';
                for(var i= 0; i < value.length; i++){
                    if(value[i].topic != null){
                        if(i == value.length - 1){
                            text += value[i].topic.name ;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM/YYYY');
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'question',
                    title: 'Word',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'question',
                //     title: 'Question',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                // , {
                //     field: 'author',
                //     title: 'Author',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                // , {
                //     field: 'createDate',
                //     title: 'Created Date',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap,
                //     formatter: _dateFormatter
                // }
                // , {
                //     field: 'questionTopics',
                //     title: 'Topic',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap,
                //     formatter: _topicFormatter
                // }
            ]
        }
        
        
        function getTableDefinitionCreateIELTSWritingTest() {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" ng-show="settings.isAdmin == true" data-ng-click="$parent.editCreateIELTSWritingTest(' + "'" + row.id + "'" + ')"><i class="icon-eye"></i></a>'
                    + '<a target="_blank" class="green-dark margin-right-10" href="#/ielts_writing_actual_test/' + row.id + '" ><i class="icon-pencil"></i></a>'
                    + '<a class="green-dark " href="#" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';
                ;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if (value == null) return '';
                var text = '';
                for (var i = 0; i < value.length; i++) {
                    if (value[i].topic != null) {
                        if (i == value.length - 1) {
                            text += value[i].topic.name;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            var _dateFormatter = function (value, row, index) {
                if (!value) {
                    return '';
                }
                return moment(value).format('DD/MM/YYYY');
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'title',
                    title: 'Title',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'question',
                //     title: 'Question',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
                , {
                    field: 'author',
                    title: 'Author',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'createDate',
                    title: 'Created Date',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _dateFormatter
                }
                , {
                    field: 'questionTopics',
                    title: 'Topic',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap,
                    formatter: _topicFormatter
                }
            ]
        }

        function getTableDefinitionCreateIELTSReadingTest () {

            var _tableOperation = function (value, row, index) {
                return '<a  class="green-dark margin-right-10" href="#" data-ng-click="$parent.editCreateIELTSReadingTest(' + "'" + row.id + "'" + ')"><i class="icon-eye"></i></a>'
                    + '<a target="_blank" class="green-dark margin-right-10" href="ielts_reading_actual_test/' + row.id + '" ><i class="icon-pencil"></i></a>'
                    + '<a ng-show="' + "'" + row.status + "'" + '== 6"  class="green-dark margin-right-10" href="#" data-ng-click="$parent.changeStatus(' + "'" + row.id + "',7" + ')"><i class="fa fa-times"></i></a>'
                    + '<a ng-show="' + "'" + row.status + "'" + '== 7"  class="green-dark margin-right-10" href="#" data-ng-click="$parent.changeStatus(' + "'" + row.id + "',6" + ')"><i class="fa fa-check"></i></a>'
                    + '<a class="green-dark " href="#" ng-show="settings.isAdmin == true" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';
                ;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if (value == null) return '';
                var text = '';
                for (var i = 0; i < value.length; i++) {
                    if (value[i].topic != null) {
                        if (i == value.length - 1) {
                            text += value[i].topic.name;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'title',
                    title: 'Title',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'question',
                //     title: 'Question',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
            ]
        }

        function getTableDefinitionCreateIELTSListeningTest () {

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" data-ng-click="$parent.editCreateIELTSReadingTest(' + "'" + row.id + "'" + ')"><i class="icon-eye"></i></a>'
                    + '<a target="_blank" class="green-dark margin-right-10" href="ielts_listening_actual_test/' + row.id + '" ><i class="icon-pencil"></i></a>'
                    + '<a class="green-dark " href="#" ng-show="settings.isAdmin == true" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';
                ;
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if (value == null) return '';
                var text = '';
                for (var i = 0; i < value.length; i++) {
                    if (value[i].topic != null) {
                        if (i == value.length - 1) {
                            text += value[i].topic.name;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                {
                    field: '',
                    title: 'Thao tác',
                    switchable: true,
                    visible: true,
                    formatter: _tableOperation,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'title',
                    title: 'Title',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                // , {
                //     field: 'question',
                //     title: 'Question',
                //     sortable: true,
                //     switchable: false,
                //     cellStyle: _cellNowrap
                // }
            ]
        }


        function getTableDefinitionStatisticUser () {

            var _tableOperation = function (value, row, index) {
                // return '<a class="green-dark margin-right-10" href="#" data-ng-click="$parent.editCreateIELTSReadingTest(' + "'" + row.id + "'" + ')"><i class="icon-eye"></i></a>'
                //     + '<a target="_blank" class="green-dark margin-right-10" href="ielts_listening_actual_test/' + row.id + '" ><i class="icon-pencil"></i></a>'
                //     + '<a class="green-dark " href="#" ng-show="settings.isAdmin == true" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';
                // ;
                return '';
            };

            var _cellNowrap = function (value, row, index, field) {
                return {
                    classes: '',
                    css: {'white-space': 'nowrap'}
                };
            };

            var _topicFormatter = function (value, row, index, field) {
                // console.log('here');
                if (value == null) return '';
                var text = '';
                for (var i = 0; i < value.length; i++) {
                    if (value[i].topic != null) {
                        if (i == value.length - 1) {
                            text += value[i].topic.name;
                        } else {
                            text += value[i].topic.name + ', ';
                        }
                    }
                }
                return text;
            };

            return [
                // {
                //     field: 'state',
                //     checkbox: true
                // }
                // ,
                // {
                //     field: '',
                //     title: 'Thao tác',
                //     switchable: true,
                //     visible: true,
                //     formatter: _tableOperation,
                //     cellStyle: _cellNowrap
                // }
                // ,
                {
                    field: 'username',
                    title: 'username',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
                , {
                    field: 'numberOfWords',
                    title: 'numberOfWords',
                    sortable: true,
                    switchable: false,
                    cellStyle: _cellNowrap
                }
            ]
        }
    }

})();