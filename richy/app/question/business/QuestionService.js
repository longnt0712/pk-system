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
        var learningDraftSaveInFlight = {};
        var learningDraftQueued = {};
        var learningDraftDeleting = {};
        // console.log(baseUrl);
        self.getPage = getPage;
        self.getPageForGames = getPageForGames;
        self.getPageForTests = getPageForTests;
        self.getPageForDailyVocab = getPageForDailyVocab;
        self.getPageOnlyQuestion = getPageOnlyQuestion;

        // Excel import
        self.previewExcelImport = previewExcelImport;
        self.confirmExcelImport = confirmExcelImport;
        
        self.saveObject = saveObject;
        self.updateTestStatus = updateTestStatus;
        self.getFlashCardLevels = getFlashCardLevels;
        self.updateFlashCardLevel = updateFlashCardLevel;
        self.getLearningDrafts = getLearningDrafts;
        self.saveLearningDraft = saveLearningDraft;
        self.deleteLearningDraft = deleteLearningDraft;
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
        self.getTopicsForGames = getTopicsForGames;

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

        function getTopicsForGames(searchdto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + 'topic' + '/get_page_for_games';
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

        /**
         * Upload Excel lên server để đọc và trả về dữ liệu preview.
         * Topic ID được server đọc trực tiếp trong file Excel.
         */
        function previewExcelImport(file, topicId) {
            if (!file) {
                return $q.reject({
                    data: {
                        message: 'Please choose an Excel file.'
                    }
                });
            }

            if (!topicId) {
                return $q.reject({
                    data: {
                        message: 'Please choose a topic.'
                    }
                });
            }

            var formData = new FormData();
            formData.append('file', file);
            formData.append('topicId', topicId);

            return $http.post(
                baseUrl + restUrl + '/import_excel/preview',
                formData,
                {
                    transformRequest: angular.identity,
                    headers: {
                        // Để browser tự sinh multipart boundary.
                        'Content-Type': undefined
                    }
                }
            ).then(function (response) {
                return response.data;
            });
        }

        /**
         * Xác nhận các dòng được người dùng chọn trong popup preview.
         */
        function confirmExcelImport(importDto) {
            return $http.post(
                baseUrl + restUrl + '/import_excel/confirm',
                importDto,
                {
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                }
            ).then(function (response) {
                return response.data;
            });
        }
        function getLearningDrafts() {
            return $http.get(baseUrl + 'test_result/drafts').then(function (response) {
                return angular.isArray(response.data) ? response.data : [];
            });
        }

        function flushLearningDraftSave(draftKey) {
            if (!draftKey || learningDraftDeleting[draftKey] || learningDraftSaveInFlight[draftKey]
                    || !learningDraftQueued[draftKey]) {
                return learningDraftSaveInFlight[draftKey] || $q.when(null);
            }
            var draft = learningDraftQueued[draftKey];
            learningDraftQueued[draftKey] = null;
            var request = $http.post(baseUrl + 'test_result/draft/save', draft, {
                headers: {'Content-Type': 'application/json; charset=utf-8'}
            }).then(function (response) { return response.data; });
            learningDraftSaveInFlight[draftKey] = request;
            request.finally(function () {
                if (learningDraftSaveInFlight[draftKey] === request) {
                    learningDraftSaveInFlight[draftKey] = null;
                }
                if (!learningDraftDeleting[draftKey] && learningDraftQueued[draftKey]) {
                    flushLearningDraftSave(draftKey).catch(angular.noop);
                }
            });
            return request;
        }

        function saveLearningDraft(draft) {
            if (!draft || !draft.draftKey || learningDraftDeleting[draft.draftKey]) {
                return $q.when(null);
            }
            learningDraftQueued[draft.draftKey] = angular.copy(draft);
            return flushLearningDraftSave(draft.draftKey);
        }

        function deleteLearningDraft(draftKey) {
            if (!draftKey) { return $q.when(true); }
            learningDraftDeleting[draftKey] = true;
            learningDraftQueued[draftKey] = null;
            return $q.when(learningDraftSaveInFlight[draftKey]).catch(angular.noop).then(function () {
                return $http.post(baseUrl + 'test_result/draft/delete', {draftKey: draftKey}, {
                    headers: {'Content-Type': 'application/json; charset=utf-8'}
                }).then(function (response) { return response.data; });
            }).finally(function () {
                learningDraftDeleting[draftKey] = false;
            });
        }
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

        function getPageForDailyVocab(searchDto, pageIndex, pageSize, successCallback, errorCallback) {
            var url = baseUrl + restUrl + '/get_page_for_daily_vocab';
            url += '/' + pageIndex;
            url += '/' + ((pageSize > 0) ? pageSize : 25);

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

        function updateTestStatus(id, status) {
            if (!id) {
                return $q.reject({data: {message: 'Test id is required.'}});
            }
            return utils.resolveAlt(
                baseUrl + restUrl + '/update_test_status/' + id + '/' + status,
                'POST',
                null,
                null,
                {'Content-Type': 'application/json; charset=utf-8'}
            );
        }

        function getFlashCardLevels(searchDto) {
            return utils.resolveAlt(baseUrl + restUrl + '/get_flash_card_levels', 'POST', null, searchDto, {
                'Content-Type': 'application/json; charset=utf-8'
            });
        }

        function updateFlashCardLevel(id, level) {
            return utils.resolveAlt(baseUrl + restUrl + '/update_level/' + id, 'POST', null, {
                level: level || null
            }, {
                'Content-Type': 'application/json; charset=utf-8'
            });
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
        self.saveDailyVocabResult = function (object) {
            // Keep ordinary Listening/IELTS save calls unchanged. A timeout releases
            // the retry button; the attempt key handles an ambiguous lost response.
            return $http({method:'POST',url:baseUrl+'test_result/save',data:angular.copy(object),
                timeout:30000,cache:false,headers:{'Content-Type':'application/json; charset=utf-8'}})
                .then(function (response) { return response.data; });
        };
        self.getOneTestResult = getOneTestResult;
        self.gradeWritingTestResult = gradeWritingTestResult;

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

        function gradeWritingTestResult(id) {
            if (!id) {
                return $q.reject(new Error('Missing Writing test result ID.'));
            }
            return $http({
                method: 'POST',
                url: baseUrl + 'test_result/grade-writing/' + id,
                timeout: 130000,
                cache: false,
                headers: {'Content-Type': 'application/json; charset=utf-8'}
            }).then(function (response) {
                return response.data;
            });
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

        function getTableDefinitionCreateIELTSReadingTest (actualTestPath) {

            actualTestPath = actualTestPath || 'ielts_reading_actual_test/';

            var _tableOperation = function (value, row, index) {
                return '<a class="green-dark margin-right-10" href="#" title="Mở trong trình soạn thảo" data-ng-click="$parent.editCreateIELTSReadingTest(' + "'" + row.id + "'" + ')"><i class="icon-eye"></i></a>'
                    + '<a target="_blank" class="green-dark margin-right-10" title="Xem trước bài test" href="' + actualTestPath + row.id + '"><i class="icon-pencil"></i></a>'
                    + '<a ng-show="' + "'" + row.status + "'" + '== 6" class="green-dark margin-right-10" href="#" title="Xuất bản" data-ng-click="$event.preventDefault(); $parent.changeStatus(' + "'" + row.id + "',7" + ')"><i class="fa fa-times"></i></a>'
                    + '<a ng-show="' + "'" + row.status + "'" + '== 7" class="green-dark margin-right-10" href="#" title="Chuyển về bản nháp" data-ng-click="$event.preventDefault(); $parent.changeStatus(' + "'" + row.id + "',6" + ')"><i class="fa fa-check"></i></a>'
                    + '<a ng-show="' + "'" + row.status + "'" + '!= 8" class="btn btn-xs btn-default margin-right-10" href="#" title="Ẩn khỏi danh sách" data-ng-click="$event.preventDefault(); $parent.hideReadingTest(' + "'" + row.id + "'" + ')"><i class="fa fa-eye-slash"></i> Ẩn</a>'
                    + '<a ng-show="' + "'" + row.status + "'" + '== 8" class="btn btn-xs btn-success margin-right-10" href="#" title="Khôi phục về bản nháp" data-ng-click="$event.preventDefault(); $parent.restoreReadingTest(' + "'" + row.id + "'" + ')"><i class="fa fa-undo"></i> Khôi phục</a>'
                    + '<a class="green-dark" href="#" title="Xóa" data-ng-click="$parent.deleteIELTSWriting(' + "'" + row.id + "'" + ')"><i class="fa fa-trash"></i></a>';
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
