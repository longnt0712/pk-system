package com.globits.richy.rest;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.MarkDto;
import com.globits.richy.service.MarkService;

@RestController
@RequestMapping("/api/mark")
public class RestMarkController {
    @Autowired private com.globits.richy.service.impl.SchoolAccess access;
	@Autowired
	MarkService service;
	
	@PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<MarkDto> getPage(@RequestBody MarkDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		if (!access.isAdmin() || programId(searchDto) != null) {
            access.requireProgram(programId(searchDto), "ROLE_EDUCATION_MANAGEMENT");
        }
        return service.getPageObject(searchDto, pageIndex, pageSize);
	}

	@PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_ordered/{educationProgramId}", method = RequestMethod.GET)
	public List<MarkDto> getOrderedMarks(@PathVariable Long educationProgramId) {
		access.requireProgram(educationProgramId, "ROLE_EDUCATION_MANAGEMENT");
        return service.getOrderedMarks(educationProgramId);
	}

	@PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/reorder/{educationProgramId}", method = RequestMethod.POST)
	public List<MarkDto> reorderMarks(@PathVariable Long educationProgramId,
			@RequestBody List<Long> orderedMarkIds) {
		access.requireProgram(educationProgramId, "ROLE_EDUCATION_MANAGEMENT");
        return service.reorderMarks(educationProgramId, orderedMarkIds);
	}
	
	@PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public MarkDto getOne(@PathVariable Long id) {
		access.columnProgram(id);
        return service.getObjectById(id);
	}
	
	@PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public MarkDto saveOne(@RequestBody MarkDto searchDto) {
		Long program = programId(searchDto);
        access.requireProgram(program, "ROLE_EDUCATION_MANAGEMENT");
        if (searchDto.getId() != null && !program.equals(access.columnProgram(searchDto.getId()))) {
            throw new IllegalArgumentException("Đầu điểm phải giữ nguyên chương trình.");
        }
        return service.saveObject(searchDto);
	}
	
	@PreAuthorize("isAuthenticated()")
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		access.columnProgram(id);
        return service.deleteObject(id);
	}
    private Long programId(MarkDto request) {
        return request == null || request.getEducationProgram() == null ? null : request.getEducationProgram().getId();
    }
}
