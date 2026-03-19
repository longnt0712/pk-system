package com.globits.richy.rest;

import java.util.List;

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

import com.globits.richy.dto.PersonDateDto;
import com.globits.richy.service.PersonDateService;


@RestController
@RequestMapping("/api/person_date")
public class RestPersonDateController {
	@Autowired
	private PersonDateService service;
	
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<PersonDateDto> getPage(@RequestBody PersonDateDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public PersonDateDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save_list_by_enrollment_class/{enrollmentClass}", method = RequestMethod.POST)
	public boolean saveListByEnrollmentClass(@PathVariable int enrollmentClass) {
		return service.saveListByEnrollmentClass(enrollmentClass);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public PersonDateDto saveOne(@RequestBody PersonDateDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
}
