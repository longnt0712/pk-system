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
    @Autowired private com.globits.richy.service.impl.SchoolAccess access;
	@Autowired
	EducationProgramService service;
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<EducationProgramDto> getPage(@RequestBody EducationProgramDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
        if (searchDto == null) { searchDto = new EducationProgramDto(); }
        if (!access.isAdmin()) {
            searchDto.setPermittedSchoolIds(access.schoolsFor("ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT"));
        }
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	
	//Thêm role nè
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public EducationProgramDto getOne(@PathVariable Long id) {
        access.requireProgram(id, "ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT");
		return service.getObjectById(id);
	}
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public boolean saveOne(@RequestBody EducationProgramDto searchDto) {
        access.require(searchDto.getSchoolId(), "ROLE_EDUCATION_MANAGERMENT");
        if (searchDto.getId() != null) { access.requireProgram(searchDto.getId(), "ROLE_EDUCATION_MANAGERMENT"); }
		return service.saveObject(searchDto);
	}
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
        access.requireProgram(id, "ROLE_EDUCATION_MANAGERMENT");
		return service.deleteObject(id);
	}

	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/set_main/{id}", method = RequestMethod.POST)
	public EducationProgramDto setMain(@PathVariable Long id) {
        access.requireProgram(id, "ROLE_EDUCATION_MANAGERMENT");
		return service.setMain(id);
	}
    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    public org.springframework.http.ResponseEntity<java.util.Map<String,String>> invalid(IllegalArgumentException error) {
        return org.springframework.http.ResponseEntity.badRequest().body(java.util.Collections.singletonMap("message", error.getMessage()));
    }
}
