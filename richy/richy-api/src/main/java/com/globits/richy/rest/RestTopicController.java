package com.globits.richy.rest;

import java.util.List;
import java.util.Collections;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.TopicDto;
import com.globits.richy.dto.TopicForListAllDto;
import com.globits.richy.dto.VocabularyLessonBulkActionDto;
import com.globits.richy.service.TopicService;

@RestController
@RequestMapping("/api/topic")
public class RestTopicController {
	@Autowired
	TopicService service;
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<TopicDto> getPage(@RequestBody TopicDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}

	@Secured({"ROLE_ADMIN", "ROLE_USER"})
	@RequestMapping(value = {"/uncategorized/selection", "/category/{sourceCategoryId}/selection"}, method = RequestMethod.GET)
	public List<Long> getLessonSelection(@PathVariable(value = "sourceCategoryId", required = false) Long sourceCategoryId,
			@RequestParam(defaultValue = "") String search) {
		return service.getLessonSelection(sourceCategoryId, search);
	}

	@Secured({"ROLE_ADMIN", "ROLE_USER"})
	@RequestMapping(value = {"/uncategorized/bulk/{action:move|delete}", "/category/{sourceCategoryId}/bulk/{action:move}"},
			method = RequestMethod.POST)
	public ResponseEntity<?> changeLessons(@PathVariable(value = "sourceCategoryId", required = false) Long sourceCategoryId,
			@PathVariable String action, @RequestBody VocabularyLessonBulkActionDto request) {
		try {
			return ResponseEntity.ok("move".equals(action) ? service.moveLessons(sourceCategoryId, request) : service.deleteUncategorizedLessons(request));
		} catch (IllegalArgumentException error) {
			return ResponseEntity.badRequest().body(Collections.singletonMap("message", error.getMessage()));
		} catch (IllegalStateException error) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("message", error.getMessage()));
		} catch (DataIntegrityViolationException error) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("message",
					"Có bài đang được sử dụng hoặc vừa thay đổi. Chưa cập nhật bài nào."));
		}
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_page_for_games/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<TopicDto> getPageForGames(@RequestBody TopicDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObjectForGames(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_all_topics", method = RequestMethod.POST)
	public List<TopicForListAllDto> getAllTopics(@RequestBody TopicDto searchDto) {
		return service.getAllTopics(searchDto);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public TopicDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public TopicDto saveOne(@RequestBody TopicDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
	
}
