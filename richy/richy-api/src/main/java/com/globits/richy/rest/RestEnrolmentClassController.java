package com.globits.richy.rest;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.EnrolmentClassDto;
import com.globits.richy.dto.EnrolmentClassMoveStudentDto;
import com.globits.richy.dto.EnrolmentClassScheduleDayDto;
import com.globits.richy.dto.EnrolmentClassTeamBoardDto;
import com.globits.richy.dto.TopicForListAllDto;
import com.globits.richy.service.EnrolmentClassService;
import com.globits.security.dto.UserDto;
import com.globits.richy.service.EnrolmentClassScheduleException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import java.util.Map;
import java.util.Collections;

@RestController
@RequestMapping("/api/enrolment_class")
public class RestEnrolmentClassController {
	@Autowired
	EnrolmentClassService service;

	@ExceptionHandler(EnrolmentClassScheduleException.class)
	public ResponseEntity<Map<String, String>> handleScheduleError(EnrolmentClassScheduleException error) {
		return new ResponseEntity<Map<String, String>>(Collections.singletonMap("message", error.getMessage()), error.getStatus());
	}

	@ExceptionHandler({org.springframework.orm.ObjectOptimisticLockingFailureException.class, javax.persistence.OptimisticLockException.class})
	public ResponseEntity<Map<String, String>> handleScheduleConflict(Exception error) {
		return new ResponseEntity<Map<String, String>>(Collections.singletonMap("message",
				"Kế hoạch vừa được cập nhật ở phiên khác. Hãy tải lại lịch."), HttpStatus.CONFLICT);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/schedule/{classId}/students", method = RequestMethod.GET)
	public List<UserDto> getScheduleStudents(@PathVariable Long classId) { return service.getScheduleStudents(classId); }
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STAFF","ROLE_STAFF_MANAGEMENT","ROLE_STUDENT","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<EnrolmentClassDto> getPage(@RequestBody EnrolmentClassDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STAFF","ROLE_STAFF_MANAGEMENT","ROLE_STUDENT","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public EnrolmentClassDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STAFF","ROLE_STAFF_MANAGEMENT","ROLE_STUDENT","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/tree", method = RequestMethod.GET)
	public List<EnrolmentClassDto> getTree(@RequestParam(defaultValue = "2") Integer schoolId) {
		return service.getTreeObjects(schoolId);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT","ROLE_STAFF"})
	@RequestMapping(value = "/team_board/{classId}", method = RequestMethod.GET)
	public EnrolmentClassTeamBoardDto getTeamBoard(@PathVariable Long classId) {
		return service.getTeamBoard(classId);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT","ROLE_STAFF"})
	@RequestMapping(value = "/team_board/{classId}/move", method = RequestMethod.POST)
	public EnrolmentClassTeamBoardDto moveStudentToTeam(
			@PathVariable Long classId,
			@RequestBody EnrolmentClassMoveStudentDto moveDto) {
		return service.moveStudentToTeam(classId, moveDto);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/teacher_candidates", method = RequestMethod.GET)
	public List<UserDto> getTeacherCandidates() {
		return service.getTeacherCandidates();
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/responsible_candidates/{parentClassId}", method = RequestMethod.GET)
	public List<UserDto> getResponsibleCandidates(@PathVariable Long parentClassId) {
		return service.getResponsibleCandidates(parentClassId);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/responsible_candidates/{parentClassId}/{classId}", method = RequestMethod.GET)
	public List<UserDto> getResponsibleCandidates(
			@PathVariable Long parentClassId, @PathVariable Long classId) {
		return service.getResponsibleCandidates(parentClassId, classId);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT","ROLE_STAFF"})
	@RequestMapping(value = "/schedule/{classId}", method = RequestMethod.GET)
	public List<EnrolmentClassScheduleDayDto> getSchedule(
			@PathVariable Long classId,
			@RequestParam String fromDate,
			@RequestParam String toDate) {
		return service.getScheduleDays(classId, fromDate, toDate);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/schedule/{classId}/settings", method = RequestMethod.POST)
	public EnrolmentClassDto saveScheduleSettings(
			@PathVariable Long classId, @RequestBody EnrolmentClassDto dto) {
		return service.saveScheduleSettings(classId, dto);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/schedule/{classId}/day", method = RequestMethod.POST)
	public EnrolmentClassScheduleDayDto saveScheduleDay(
			@PathVariable Long classId, @RequestBody EnrolmentClassScheduleDayDto dto) {
		return service.saveScheduleDay(classId, dto);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/schedule/topics", method = RequestMethod.GET)
	public List<TopicForListAllDto> getScheduleTopics() {
		return service.getScheduleTopics();
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public boolean saveOne(@RequestBody EnrolmentClassDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
}
