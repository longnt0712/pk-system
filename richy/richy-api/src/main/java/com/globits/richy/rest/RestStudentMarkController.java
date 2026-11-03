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
import com.globits.richy.dto.DisplayStudentMarkDto;
import com.globits.richy.dto.StudentMarkDto;
import com.globits.richy.service.StudentMarkService;

@RestController
@RequestMapping("/api/student_mark")
public class RestStudentMarkController {
    @Autowired private com.globits.richy.service.impl.SchoolAccess access;
	@Autowired
	StudentMarkService service;
	
	@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGEMENT","ROLE_STUDENT_MANAGEMENT"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<StudentMarkDto> getPage(@RequestBody StudentMarkDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
        if (!access.isAdmin()) {
            Long program = searchDto != null && searchDto.getMark() != null && searchDto.getMark().getEducationProgram() != null
                ? searchDto.getMark().getEducationProgram().getId() : null;
            access.requireProgram(program, "ROLE_EDUCATION_MANAGEMENT", "ROLE_STUDENT_MANAGEMENT");
        }
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_list_display", method = RequestMethod.POST)
	public List<DisplayStudentMarkDto> getListDisplayStudentMark(@RequestBody DisplayStudentMarkDto searchDto) {
        if (searchDto == null || searchDto.getEnrollmentClass() == null || searchDto.getEducationProgramId() == null) {
            return java.util.Collections.emptyList();
        }
        access.requireBoard(searchDto.getEnrollmentClass(), searchDto.getEducationProgramId());
		return service.getListDisplayStudentMark(searchDto);
	}
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public StudentMarkDto getOne(@PathVariable Long id) {
        access.requireMark(id);
		return service.getObjectById(id);
	}
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public StudentMarkDto saveOne(@RequestBody StudentMarkDto searchDto) {
        access.requireMarkWrite(searchDto.getEnrollmentClass(), searchDto.getId(),
            searchDto.getMark() == null ? null : searchDto.getMark().getId(),
            searchDto.getUser() == null ? null : searchDto.getUser().getId());
		return service.saveObject(searchDto);
	}
	
	@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
        access.requireMark(id);
		return service.deleteObject(id);
	}
}
