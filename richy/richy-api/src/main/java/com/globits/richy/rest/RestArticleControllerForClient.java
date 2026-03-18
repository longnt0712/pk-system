package com.globits.richy.rest;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.ArticleDto;
import com.globits.richy.dto.ListArticleForCategoryDto;
import com.globits.richy.service.ArticleService;

@RestController
@RequestMapping("/public/article")
public class RestArticleControllerForClient {
	@Autowired
	ArticleService service;
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ArticleDto> getPage(@RequestBody ArticleDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public ArticleDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@RequestMapping(value = "/get_page_side_category/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public ListArticleForCategoryDto getPageSideCategory(@RequestBody ArticleDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObjectSideCategory(searchDto, pageIndex, pageSize);
	}
	
	@RequestMapping(value = "/get_the_latest/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ArticleDto> getTheLatest(@RequestBody ArticleDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getTheLatest(searchDto, pageIndex, pageSize);
	}
	
	@RequestMapping(value = "/get_mass_schedule/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ArticleDto> getMassSchedule(@RequestBody ArticleDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getMassSchedule(searchDto, pageIndex, pageSize);
	}
	
	@RequestMapping(value = "/get_bible_calendar/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ArticleDto> getBibleCalendar(@RequestBody ArticleDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getBibleCalendar(searchDto, pageIndex, pageSize);
	}
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save_views", method = RequestMethod.POST)
	public boolean saveViews(@RequestBody ArticleDto searchDto) {
		return service.saveViews(searchDto);
	}
	
	@RequestMapping(value = "/test/lich-le/lich-le", method = RequestMethod.GET)
	public String getString() {
		return "<!DOCTYPE html>\r\n" + 
				"<!--[if IE 8]> <html lang=\"en\" class=\"ie8 no-js\" data-ng-app=\"Hrm\"> <![endif]-->\r\n" + 
				"<!--[if IE 9]> <html lang=\"en\" class=\"ie9 no-js\" data-ng-app=\"Hrm\"> <![endif]-->\r\n" + 
				"<!--[if !IE]>chan lam roi 2<!-->\r\n" + 
				"<html lang=\"en\" data-ng-app=\"Hrm\">\r\n" + 
				"<!--<![endif]-->\r\n" + 
				"    <head>\r\n" + 
				"\r\n" + 
				"        <title data-ng-bind=\"'Gx.Phùng Khoang | ' + $state.current.data.pageTitle\"></title>\r\n" + 
				"        <base href=\"/\">\r\n" + 
				"        <meta charset=\"utf-8\" />\r\n" + 
				"        <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\r\n" + 
				"        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, shrink-to-fit=no\">\r\n" + 
				"\r\n" + 
				"        <!--<meta property=\"fb:app_id\" content=\"367012131893866\" />-->\r\n" + 
				"        <meta property=\"og:url\" content=\"http://giaoxuphungkhoang.org\" >\r\n" + 
				"        <!--<meta property=\"og:type\" content=\"article\" >-->\r\n" + 
				"        <meta property=\"og:title\" content=\"GIÁO XỨ PHÙNG KHOANG - TRANG CHỦ\" >\r\n" + 
				"        <!--<meta property=\"og:description\" content=\"dessssss\" >-->\r\n" + 
				"        <meta property=\"og:image\" content=\"https://giaophanphucuong.org/Image/Picture/LoiChua/SuyNiemChuaNhat/Suy-Niem-Tin-Mung-Le-Chua-Hien-Dung-Mt-17%2C1-9.jpg\" >\r\n" + 
				"        <!--<meta property=\"og:image:width\" content=\"1200\" >-->\r\n" + 
				"        <!--<meta property=\"og:image:height\" content=\"630\" >-->\r\n" + 
				"\r\n" + 
				"\r\n" + 
				"\r\n" + 
				"        <!--begin::Web font -->\r\n" + 
				"        <!--<script src=\"https://ajax.googleapis.com/ajax/libs/webfont/1.6.16/webfont.js\"></script>-->\r\n" + 
				"        <!--<script>-->\r\n" + 
				"            <!--WebFont.load({-->\r\n" + 
				"                <!--google: {\"families\":[\"Quicksand:300,400,500,700\"]},-->\r\n" + 
				"                <!--active: function() {-->\r\n" + 
				"                    <!--sessionStorage.fonts = true;-->\r\n" + 
				"                <!--}-->\r\n" + 
				"            <!--});-->\r\n" + 
				"        <!--</script>-->\r\n" + 
				"        <!--end::Web font -->\r\n" + 
				"\r\n" + 
				"        <!--<link href=\"http://fonts.googleapis.com/css?family=Open+Sans:400,300,600,700&subset=all\" rel=\"stylesheet\" type=\"text/css\" />-->\r\n" + 
				"        <!--<link href=\"https://fonts.googleapis.com/css?family=Trirong:300,400,500,700\" rel=\"stylesheet\" type=\"text/css\" />-->\r\n" + 
				"\r\n" + 
				"        <!--build:css assets/css/plugins.min.css-->\r\n" + 
				"        <link href=\"assets/css/external/font-awesome.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/simple-line-icons.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/iconsmind.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/bootstrap.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/bootstrap-switch.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/bootstrap-table.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/select.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/angular-bootstrap-datepicker.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/jstree-style.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/angular-toastr.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/jquery.webui-popover.min.css\" rel=\"stylesheet\" type=\"text/css\"/>\r\n" + 
				"        <link href=\"assets/css/external/jquery.orgchart.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/AdminLTE.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/datetimepicker.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/angular-block-ui.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/angucomplete-alt.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/ng-tree-dnd.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/fullcalendar.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/ui-cropper.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/ng-tags-input.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/dx.common.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/external/dx.light.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <!--endbuild-->\r\n" + 
				"\r\n" + 
				"        <link id=\"ng_load_plugins_before\" />\r\n" + 
				"\r\n" + 
				"        <!--build:css assets/css/client.min.css-->\r\n" + 
				"        <link href=\"assets/css/components-md.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/plugins-md.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/layout-hoz.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/default.min.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <link href=\"assets/css/custom.css\" rel=\"stylesheet\" type=\"text/css\" />\r\n" + 
				"        <!--endbuild-->\r\n" + 
				"\r\n" + 
				"        <link rel=\"shortcut icon\" content=\"\" href=\"assets/images/richy.png\" />\r\n" + 
				"\r\n" + 
				"        <!--[if lt IE 9]>\r\n" + 
				"        <script src=\"assets/scripts/external/respond.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/excanvas.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"http://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"http://cdnjs.cloudflare.com/ajax/libs/es5-shim/2.2.0/es5-shim.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/ui-select-ielt9.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <![endif]-->\r\n" + 
				"    </head>\r\n" + 
				"    <body ng-controller=\"AppController\"  class=\"page-container-bg-solid\">\r\n" + 
				"\r\n" + 
				"\r\n" + 
				"        <!--<svg ng-spinner-bar width=\"300px\" height=\"200px\" viewBox=\"0 0 187.3 93.7\" preserveAspectRatio=\"xMidYMid meet\" style=\"left: 50%; top: 50%; position: absolute; transform: translate(-50%, -50%) matrix(1, 0, 0, 1, 0, 0);\">-->\r\n" + 
				"            <!--<path stroke=\"#dc143c\" id=\"outline\" fill=\"none\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\"M93.9,46.4c9.3,9.5,13.8,17.9,23.5,17.9s17.5-7.8,17.5-17.5s-7.8-17.6-17.5-17.5c-9.7,0.1-13.3,7.2-22.1,17.1 				c-8.9,8.8-15.7,17.9-25.4,17.9s-17.5-7.8-17.5-17.5s7.8-17.5,17.5-17.5S86.2,38.6,93.9,46.4z\" />-->\r\n" + 
				"            <!--<path id=\"outline-bg\" opacity=\"0.1\" fill=\"none\" stroke=\"#ccc\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\"				M93.9,46.4c9.3,9.5,13.8,17.9,23.5,17.9s17.5-7.8,17.5-17.5s-7.8-17.6-17.5-17.5c-9.7,0.1-13.3,7.2-22.1,17.1 				c-8.9,8.8-15.7,17.9-25.4,17.9s-17.5-7.8-17.5-17.5s7.8-17.5,17.5-17.5S86.2,38.6,93.9,46.4z\" />-->\r\n" + 
				"        <!--</svg>-->\r\n" + 
				"\r\n" + 
				"        <ui-view></ui-view>\r\n" + 
				"\r\n" + 
				"        <!--<script async defer crossorigin=\"anonymous\" src=\"https://connect.facebook.net/vi_VN/sdk.js#xfbml=1&version=v13.0&appId=1832244337163521&autoLogAppEvents=1\" nonce=\"HLSuRQaX\"></script>-->\r\n" + 
				"\r\n" + 
				"        <!--build:js assets/scripts/core-jquery.min.js-->\r\n" + 
				"        <script src=\"assets/scripts/external/jquery.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-hover-dropdown.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/jquery.slimscroll.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/jquery.blockui.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/jquery-ui.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/js.cookie.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-switch.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-table.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-table-vi-VN.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/jquery.inputmask.bundle.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/jstree.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-tabdrop.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/jquery.webui-popover.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/moment-with-locales.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/accounting.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/moment.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/taffy-min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--<script src=\"assets/scripts/external/tinymce-2.min.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"assets/scripts/external/themes/modern/theme.min.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <script src=\"assets/scripts/external/tinymce.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--<script src=\"assets/scripts/external/tinymce.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"assets/scripts/external/themes/modern/theme.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <script src=\"assets/scripts/external/lodash.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-treeview.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/fullcalendar.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--endbuild-->\r\n" + 
				"\r\n" + 
				"        <!--build:js assets/scripts/core-angular.min.js-->\r\n" + 
				"        <script src=\"assets/scripts/external/angular.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--<script src=\"assets/scripts/external/angular.min.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <script src=\"assets/scripts/external/angular-sanitize.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-touch.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-cookies.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-ui-router.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ocLazyLoad.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/query-string.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-oauth2.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ui-bootstrap-tpls.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/bootstrap-table-angular.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-bootstrap-datepicker.js\" type=\"text/javascript\"  charset=\"utf-8\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/select.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ngJsTree.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-toastr.tpls.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-block-ui.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-ui-tinymce.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ng-file-upload-shim.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ng-file-upload.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-input-masks-standalone.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angucomplete-alt.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/focusIf.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ng-tree-dnd.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ui-cropper.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-idle.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ng-tags-input.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-drag-and-drop-lists.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/angular-drag-and-drop-lists.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"        <script src=\"assets/scripts/external/update-meta.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/external/ngMeta.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"\r\n" + 
				"         <script src=\"assets/scripts/external/FileSaver.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"         <script src=\"assets/scripts/external/angular-file-saver.min.js\" type=\"text/javascript\"></script>\r\n" + 
				"        \r\n" + 
				"        <!--endbuild-->\r\n" + 
				"\r\n" + 
				"        <!--build:js assets/scripts/application.min.js-->\r\n" + 
				"        <script src=\"application.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"application.configs.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"application.services.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"application.controllers.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"        <script src=\"common/common.module.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--<script src=\"dashboard/dashboard.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <script src=\"settings/setting.module.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"users/user.module.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"        <!--<script src=\"account/account.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"		<!--<script src=\"calendar/calendar.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"		<script src=\"users/business/UserService.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"users/business/UserService.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"        <!--<script src=\"answer/answer.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"question/question.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"classical_learning/classical_learning.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"body/body.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"body_learning/body_learning.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"question_type/question_type.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"item/item.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"voucher_crocs/voucher_crocs.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"default_price/default_price.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"shop/shop.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"topic/topic.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"test_result/test_result.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <!--<script src=\"wine/wine.module.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <script src=\"richy/richy.module.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"folder/folder.module.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"article/article.module.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"        <script src=\"common/utils/directives.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"common/utils/utilities.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"common/utils/filters.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/app.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <script src=\"assets/scripts/layout-hoz.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--endbuild-->\r\n" + 
				"\r\n" + 
				"        <!--build:js dx-->\r\n" + 
				"        <script src=\"assets/scripts/external/dx.all.js\" type=\"text/javascript\"></script>\r\n" + 
				"        <!--<script src=\"assets/scripts/external/dx.web.js\" type=\"text/javascript\"></script>-->\r\n" + 
				"        <script src=\"assets/scripts/external/globalize.js\" type=\"text/javascript\"></script>\r\n" + 
				"\r\n" + 
				"        <!--<update-meta property=\"og:title\" content=\"Minions\"></update-meta>-->\r\n" + 
				"\r\n" + 
				"        <!--endbuild-->\r\n" + 
				"    </body>\r\n" + 
				"</html>";
	}
}
