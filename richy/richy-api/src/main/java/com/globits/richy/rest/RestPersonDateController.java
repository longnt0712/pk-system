package com.globits.richy.rest;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.PersonDateBulkCreateDto;
import com.globits.richy.dto.PersonDateClassReportDto;
import com.globits.richy.dto.PersonDateDto;
import com.globits.richy.service.PersonDateService;


@RestController
@RequestMapping("/api/person_date")
public class RestPersonDateController {
	@Autowired
	private PersonDateService service;

	@org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<Map<String, String>> invalidAttendanceRequest(IllegalArgumentException error) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(Collections.singletonMap("message", error.getMessage()));
	}
	
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<PersonDateDto> getPage(@RequestBody PersonDateDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public PersonDateDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save_list_by_enrollment_class/{enrollmentClass}/{attendanceDate}", method = RequestMethod.POST)
	public ResponseEntity<Boolean> saveListByEnrollmentClass(
	        @PathVariable("enrollmentClass") int enrollmentClass,
	        @PathVariable("attendanceDate") String attendanceDate) {
	    Boolean result = service.saveListByEnrollmentClass(enrollmentClass, attendanceDate, Integer.valueOf(2));
	    return new ResponseEntity<Boolean>(result, HttpStatus.OK);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save_list_by_enrollment_class/{enrollmentClass}/{attendanceDate}/{schoolId}", method = RequestMethod.POST)
	public ResponseEntity<Boolean> saveListByEnrollmentClassForSchool(
	        @PathVariable("enrollmentClass") int enrollmentClass,
	        @PathVariable("attendanceDate") String attendanceDate,
	        @PathVariable("schoolId") Integer schoolId) {
	    Boolean result = service.saveListByEnrollmentClass(enrollmentClass, attendanceDate, schoolId);
	    return new ResponseEntity<Boolean>(result, HttpStatus.OK);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/attendance_classes/{attendanceDate}/{schoolId}", method = RequestMethod.GET)
	public List<PersonDateClassReportDto> getAttendanceClassStatuses(
	        @PathVariable("attendanceDate") String attendanceDate,
	        @PathVariable("schoolId") Integer schoolId) {
		return service.getAttendanceClassStatuses(attendanceDate, schoolId);
	}

	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save_list_by_enrollment_classes", method = RequestMethod.POST)
	public ResponseEntity<List<PersonDateClassReportDto>> saveListByEnrollmentClasses(@RequestBody PersonDateBulkCreateDto dto) {
		return new ResponseEntity<List<PersonDateClassReportDto>>(service.saveListByEnrollmentClasses(dto), HttpStatus.OK);
	}

	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public PersonDateDto saveOne(@RequestBody PersonDateDto searchDto) {
		return service.saveObject(searchDto);
	}

	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save_by_qr/{attendanceDate}", method = RequestMethod.POST)
	public PersonDateDto saveByQr(
			@RequestBody PersonDateDto dto,
			@PathVariable("attendanceDate") String attendanceDate) {
		return service.saveByQr(dto, attendanceDate);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
}
