(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').controller('TnttDocumentsController', ['$scope', '$state', '$stateParams', '$q', '$uibModal', '$window', 'settings', 'TnttDocumentApi', 'TnttDocumentNotebookStore', 'TnttNoticeCenter', 'TnttDocumentPrint',
        function (scope, state, params, q, modal, win, settings, api, notebooks, center, printer) {
            var vm = this, alive = true, generation = 0, dialog = null;
            vm.entries = []; vm.notices = []; vm.folderId = null; vm.tab = params.tab === 'notices' ? 'notices' : 'files'; vm.query = ''; vm.searchTerm = ''; vm.trash = false; vm.active = null;
            vm.viewMode = 'grid'; vm.breadcrumbs = []; vm.folderById = {};
            vm.groups = [{id:'ADMIN',name:'Admin'},{id:'EDUCATION',name:'Quản lý đào tạo'},{id:'STUDENT_MANAGEMENT',name:'Quản lý học sinh'},{id:'LEADERS',name:'Giáo lý viên / Huynh trưởng'}];
            vm.statusLabels = {NOT_REQUESTED:'Không chọn email',MISSING:'Thiếu email hợp lệ',PENDING:'Đang chờ gửi',SENDING:'Đang gửi / cần đối soát',SENT:'Đã gửi',FAILED:'Chưa xác nhận gửi được',DUPLICATE:'Địa chỉ đã gửi trong đợt',CANCELLED:'Đã dừng'};
            function error(e) { vm.error = e && e.data && e.data.message || e && e.message || 'Chưa thực hiện được. Vui lòng thử lại.'; if (e && e.status === 409) { vm.reload(); } }
            function request(operation) { if (vm.busy) { return; } vm.busy = true; vm.error = ''; return operation().catch(error).finally(function () { vm.busy = false; }); }
            function closeDialog() { if (dialog) { dialog.close(); dialog = null; } }
            function formDialog(id) { dialog = modal.open({templateUrl:id,scope:scope,size:'lg',backdrop:'static',keyboard:false}); dialog.result.catch(angular.noop); }
            function blank() { return {text:'',orientation:'portrait',pattern:'lined',strokes:[],pageCount:3}; }
            function fresh(item) { return item.kind === 'DOCUMENT' && !item.archived ? api.read(item.id).then(function (row) { return angular.extend({},item,row); }) : q.when(item); }
            vm.switchTab = function (tab) { state.go('application.tntt_documents',{tab:tab==='notices'?'notices':null,notice:null,document:null,mode:null}); };
            vm.reload = function () {
                if (!alive || !vm.caps || !vm.caps.enabled) { return q.when(); } var requestId = ++generation, term = vm.query.trim(); vm.loading = true;
                return q.all([api.list(vm.trash,term),api.notifications(false)]).then(function (rows) { if (!alive || requestId !== generation) { return; } vm.entries=rows[0];vm.notices=rows[1];vm.searchTerm=term;vm.rebuildFolders(); })
                    .catch(function(e){if(alive&&requestId===generation){error(e);}}).finally(function(){if(alive&&requestId===generation){vm.loading=false;}});
            };
            vm.rebuildFolders = function () {
                var byId={},children={},roots=[],seen={},flat=[];vm.entries.forEach(function(e){if(e.kind==='FOLDER'){byId[e.id]=e;children[e.id]=[];}});
                Object.keys(byId).forEach(function(id){var e=byId[id];if(children[e.parentId]){children[e.parentId].push(e);}else{roots.push(e);}});
                function append(e,level,path){if(seen[e.id]){return;}seen[e.id]=true;e.level=level;e.path=path?path+' / '+e.title:e.title;flat.push(e);(children[e.id]||[]).sort(function(a,b){return a.title.localeCompare(b.title,'vi');}).forEach(function(c){append(c,level+1,e.path);});}
                roots.sort(function(a,b){return a.title.localeCompare(b.title,'vi');}).forEach(function(e){append(e,0,'');});vm.folders=flat;
                vm.folderById=byId;if(vm.folderId&&!byId[vm.folderId]){vm.folderId=null;}vm.updateBreadcrumbs();
            };
            vm.updateBreadcrumbs=function(){var folder=vm.folderById[vm.folderId],seen={};vm.breadcrumbs=[];while(folder&&!seen[folder.id]){seen[folder.id]=true;vm.breadcrumbs.unshift(folder);folder=vm.folderById[folder.parentId];}vm.folderName=vm.folderId&&vm.folderById[vm.folderId]?vm.folderById[vm.folderId].path:'Tài liệu chung';};
            vm.chooseFolder=function(folder){var reload=!!vm.searchTerm||!!vm.query.trim()||vm.trash;vm.folderId=folder?folder.id:null;vm.trash=false;vm.query='';vm.searchTerm='';vm.updateBreadcrumbs();if(reload){return vm.reload();}};
            vm.goUp=function(){var current=vm.folderById[vm.folderId];return vm.chooseFolder(current?vm.folderById[current.parentId]:null);};
            vm.toggleView=function(){vm.viewMode=vm.viewMode==='grid'?'list':'grid';};
            vm.visibleEntries=function(kind){
                return vm.entries.filter(function(e){
                    var inFolder=vm.folderId===null?e.parentId==null:e.parentId===vm.folderId;
                    return(!kind||e.kind===kind)&&(!!vm.searchTerm||vm.trash||inFolder);
                }).sort(function(a,b){return a.kind===b.kind?a.title.localeCompare(b.title,'vi'):a.kind==='FOLDER'?-1:1;});
            };
            vm.entryLocation=function(item){return vm.folderById[item.parentId]?vm.folderById[item.parentId].path:'Tài liệu chung';};
            vm.showTrash=function(){vm.trash=!vm.trash;vm.folderId=null;vm.query='';vm.searchTerm='';vm.updateBreadcrumbs();vm.reload();};
            vm.openCreate=function(kind,meeting){vm.form={kind:kind,title:meeting?'Biên bản họp':kind==='FOLDER'?'':'Tài liệu mới',parentId:vm.folderId,meeting:!!meeting};vm.error='';formDialog('tntt-entry-form.html');};
            vm.editMetadata=function(item){vm.error='';fresh(item).then(function(row){vm.form=angular.copy(row);formDialog('tntt-entry-form.html');}).catch(error);};
            vm.saveEntry=function(){return request(function(){var payload={title:vm.form.title,parentId:vm.form.parentId||null,kind:vm.form.kind,revision:vm.form.revision,archived:!!vm.form.archived};
                if(vm.form.meeting){payload.document=blank();payload.document.text='BIÊN BẢN HỌP\n\nThời gian: \nĐịa điểm: \nThành phần tham dự: \nChủ trì: \nThư ký: \n\n1. Nội dung cuộc họp\n\n2. Ý kiến đóng góp\n\n3. Kết luận và công việc được giao\n\nNgười thực hiện: \nThời hạn: \n\nNgười lập biên bản: ';}
                return (vm.form.id?api.metadata(vm.form.id,payload):api.create(payload)).then(function(row){closeDialog();return vm.reload().then(function(){if(!vm.form.id&&row.kind==='DOCUMENT'){vm.openEntry(row);}});});});};
            vm.archive=function(item,restore){vm.confirmEntry=item;vm.restoring=!!restore;formDialog('tntt-archive-form.html');};
            vm.confirmArchive=function(){return request(function(){var item=vm.confirmEntry;return fresh(item).then(function(row){return api.metadata(row.id,{title:row.title,parentId:row.parentId||null,revision:row.revision,archived:!vm.restoring});}).then(function(){closeDialog();return vm.reload();});});};
            vm.openEntry = function (item, mode) {
                if (item.kind === 'FOLDER') { return vm.chooseFolder(item); }
                vm.error = '';
                if (mode === 'edit' && !vm.caps.canEdit) {
                    vm.error = 'Chỉ Admin và Quản lý đào tạo được mở liên kết chỉnh sửa.';
                    return;
                }
                return api.read(item.id).then(function (row) {
                    if (!alive) { return; }
                    if (mode === 'edit' && !row.canEdit) {
                        vm.error = 'Tài khoản này không có quyền chỉnh sửa tài liệu.';
                        return;
                    }
                    var readOnly = mode === 'view' || !row.canEdit;
                    vm.active = {id: row.id, title: row.title, readOnly: readOnly, snapshot: readOnly ? row : null};
                    vm.session = null;
                }).catch(function (e) { if (alive) { error(e); } });
            };
            vm.openLinkSharing = function (item) {
                vm.linkShare = {item: item, mode: 'view'};
                formDialog('tntt-link-share.html');
                vm.managePublicLink('GET');
            };
            vm.updateShareLink = function () {
                var share = vm.linkShare;
                if (share.mode === 'view') {
                    share.url = share.token ? win.location.origin + '/tntt_documents/shared.html#' + share.token : '';
                } else {
                    share.url = state.href('application.tntt_documents', {document: share.item.id, mode: 'edit'},
                        {absolute: true, inherit: false});
                }
                share.status = '';
            };
            vm.managePublicLink = function (method) {
                var share = vm.linkShare;
                if (share.loading) { return; }
                share.loading = true;
                share.error = '';
                return api.publicLink(method, share.item.id).then(function (row) {
                    if (!alive || vm.linkShare !== share) { return; }
                    share.token = row && row.token;
                    vm.updateShareLink();
                    if (method === 'DELETE') { share.status = 'Đã thu hồi liên kết chỉ xem.'; }
                }).catch(function (e) {
                    if (alive && vm.linkShare === share) {
                        share.error = e && e.data && e.data.message || 'Không cập nhật được liên kết. Vui lòng thử lại.';
                    }
                }).finally(function () { share.loading = false; });
            };
            vm.copyShareLink = function () {
                var share = vm.linkShare, url = share.url;
                function report(message) {
                    scope.$evalAsync(function () { if (vm.linkShare === share && share.url === url) { share.status = message; } });
                }
                if (!win.navigator.clipboard || !win.navigator.clipboard.writeText) {
                    report('Hãy chọn và sao chép đường dẫn trong ô bên trên.');
                    return;
                }
                win.navigator.clipboard.writeText(url).then(function () {
                    report('Đã sao chép liên kết.');
                }, function () {
                    report('Hãy chọn và sao chép đường dẫn trong ô bên trên.');
                });
            };
            vm.openSession=function(){if(!vm.active){return null;}if(vm.active.snapshot){var snapshot=vm.active.snapshot;return {document:angular.copy(snapshot.document),revision:snapshot.revision,status:'saved',error:'',ready:q.when(),save:function(){return q.when();},changed:angular.noop,refresh:function(){return q.when();},destroy:angular.noop};}vm.session=notebooks.open({documentId:vm.active.id,userId:vm.caps.userId});return vm.session;};
            vm.closeEditor=function(){var session=vm.session;vm.busy=true;vm.active=null;vm.session=null;return q.when(session?session.save():null).finally(function(){vm.busy=false;return vm.reload();});};
            vm.openNotice=function(notice){vm.error='';api.notification(notice.id).then(function(row){vm.active={id:row.entryId,title:row.title,readOnly:true,snapshot:row};vm.session=null;}).catch(error);};
            vm.markRead=function(notice){return request(function(){return api.markRead(notice.id).then(function(){center.refresh();return vm.reload();});});};
            function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});}
            vm.openPublish=function(item){vm.error='';if(notebooks.hasDraft({documentId:item.id,userId:vm.caps.userId})){vm.error='Hãy mở tài liệu và đồng bộ bản đang viết trước khi công bố.';return;}fresh(item).then(function(row){vm.publishEntry=row;vm.publishForm={requestKey:uuid(),summary:'',start:new Date(Math.floor(Date.now()/60000)*60000),end:new Date(Math.floor(Date.now()/60000)*60000+7*86400000),groups:{ADMIN:true,EDUCATION:true,STUDENT_MANAGEMENT:true,LEADERS:false},users:{},email:false};return api.recipients();}).then(function(rows){vm.candidates=rows;formDialog('tntt-publish-form.html');}).catch(error);};
            vm.selectedRecipients=function(){var f=vm.publishForm;if(!f){return [];}return(vm.candidates||[]).filter(function(u){return f.users[u.id]||(u.groups||[]).some(function(g){return f.groups[g];});});};
            vm.publish=function(){return request(function(){var f=vm.publishForm,e=vm.publishEntry;return api.publish(e.id,{revision:e.revision,requestKey:f.requestKey,summary:f.summary,startsAt:f.start&&f.start.getTime(),endsAt:f.end&&f.end.getTime(),groups:Object.keys(f.groups).filter(function(g){return f.groups[g];}),userIds:Object.keys(f.users).filter(function(id){return f.users[id];}).map(Number),email:!!f.email}).then(function(){closeDialog();center.refresh();return vm.reload();});});};
            vm.toggleSharing=function(item){if(!item.noticeId){vm.openPublish(item);return;}return request(function(){return fresh(item).then(function(row){return api.sharing(row.id,{revision:row.revision,shared:!row.shared});}).then(function(){center.refresh();return vm.reload();});});};
            vm.testEmail=function(){return request(function(){return api.testEmail(vm.publishEntry.id).then(function(){vm.success='Đã gửi email thử đến email đăng ký của bạn.';});});};
            vm.openHistory=function(item){vm.historyEntry=item;vm.preview=null;return api.history(item.id).then(function(rows){vm.versions=rows;formDialog('tntt-history-form.html');}).catch(error);};
            vm.previewVersion=function(version){return api.version(vm.historyEntry.id,version.id).then(function(row){vm.preview=row;vm.active={id:vm.historyEntry.id,title:'Bản xem trước · '+row.title,readOnly:true,snapshot:row};}).catch(error);};
            vm.restoreVersion=function(){return request(function(){return api.read(vm.historyEntry.id).then(function(row){return api.restore(row.id,{revision:row.revision,versionId:vm.preview.id});}).then(function(){closeDialog();vm.preview=null;return vm.reload();});});};
            vm.openDelivery=function(item){return api.delivery(item.id).then(function(row){vm.deliveries=row.recipients;formDialog('tntt-delivery-form.html');}).catch(error);};
            vm.print=function(item){printer.openAsync(function(){return api.read(item.id);}).catch(error);};
            vm.printNotice=function(notice){printer.openAsync(function(){return api.notification(notice.id);}).catch(error);};
            if(settings.campaignsEnabled!==true){state.go('application.dashboard');return;}
            vm.loading = true;
            api.capabilities().then(function (caps) {
                if (!alive) { return; }
                vm.caps = caps;
                if (!caps.enabled) { return; }
                return vm.reload().then(function () {
                    if (!alive) { return; }
                    if (/^[1-9][0-9]*$/.test(String(params.document)) && Number.isSafeInteger(Number(params.document)) &&
                        (params.mode === 'view' || params.mode === 'edit')) {
                        vm.tab = 'files';
                        return vm.openEntry({id: params.document}, params.mode);
                    }
                    if (params.notice && /^[1-9][0-9]*$/.test(String(params.notice))) {
                        vm.tab = 'notices';
                        vm.openNotice({id: Number(params.notice)});
                    }
                });
            }).catch(error).finally(function () { vm.loading = false; });
            scope.$on('$destroy',function(){alive=false;++generation;closeDialog();});
        }]);
}());
