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

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.EducationProgramDto;
import com.globits.richy.service.EducationProgramService;

@RestController
@RequestMapping("/api/education_program")
public class RestEducationProgramController {
	@Autowired
	EducationProgramService service;
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<EducationProgramDto> getPage(@RequestBody EducationProgramDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public EducationProgramDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public boolean saveOne(@RequestBody EducationProgramDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
}
