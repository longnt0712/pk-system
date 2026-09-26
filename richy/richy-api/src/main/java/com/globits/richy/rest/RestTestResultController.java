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

import com.globits.richy.dto.LearningDraftDto;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.dto.TestResultStudyCalendarItemDto;
import com.globits.richy.service.TestResultService;
import com.globits.richy.service.writing.WritingGradingService;

@RestController
@RequestMapping("/api/test_result")
public class RestTestResultController {
	@Autowired
	TestResultService service;
	@Autowired
	WritingGradingService writingGradingService;
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<TestResultDto> getPage(@RequestBody TestResultDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_ranking", method = RequestMethod.POST)
	public List<TestResultDto> getRanking(@RequestBody TestResultDto searchDto) {
		return service.getRanking(searchDto);
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/study_calendar", method = RequestMethod.POST)
	public List<TestResultStudyCalendarItemDto> getStudyCalendar(@RequestBody TestResultDto searchDto) {
		return service.getStudyCalendar(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public TestResultDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public TestResultDto saveOne(@RequestBody TestResultDto searchDto) {
		return service.saveObject(searchDto);
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT"})
	@RequestMapping(value = "/grade-writing/{id}", method = RequestMethod.POST)
	public TestResultDto gradeWriting(@PathVariable Long id) {
		return writingGradingService.grade(id);
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STAFF","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/writing-feedback/{id}", method = RequestMethod.POST)
	public TestResultDto saveWritingFeedback(@PathVariable Long id, @RequestBody TestResultDto dto) {
		return service.saveWritingFeedback(id, dto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STAFF","ROLE_STAFF_MANAGEMENT","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STAFF","ROLE_STAFF_MANAGEMENT","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/delete-many", method = RequestMethod.POST)
	public int deleteMany(@RequestBody List<Long> ids) {
		return service.deleteObjects(ids);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT"})
	@RequestMapping(value = "/drafts", method = RequestMethod.GET)
	public List<LearningDraftDto> getLearningDrafts() {
		return service.getLearningDrafts();
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT"})
	@RequestMapping(value = "/draft/save", method = RequestMethod.POST)
	public LearningDraftDto saveLearningDraft(@RequestBody LearningDraftDto dto) {
		return service.saveLearningDraft(dto);
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT"})
	@RequestMapping(value = "/draft/delete", method = RequestMethod.POST)
	public boolean deleteLearningDraft(@RequestBody LearningDraftDto dto) {
		return service.deleteLearningDraft(dto);
	}
}
