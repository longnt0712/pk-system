package com.globits.core.rest;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.domain.DegreeStudent;
import com.globits.core.domain.Discipline;
import com.globits.core.dto.DegreeStudentDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.service.DegreeStudentService;

@RestController
@RequestMapping("/api/degreestudent")
public class RestDegreeStudentController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private DegreeStudentService degreeStudentService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT"})
	public Page<DegreeStudent> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<DegreeStudent> page = degreeStudentService.getList(pageIndex, pageSize);
		return page;
	}
	
	@Secured({"ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/{degreeStudentId}", method = RequestMethod.GET)
	public DegreeStudent getDiscipline(@PathVariable("degreeStudentId") String degreeStudentId) {
		DegreeStudent degreeStudent = degreeStudentService.findById(new Long(degreeStudentId));
		degreeStudent = new DegreeStudent(degreeStudent);
		return degreeStudent;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public DegreeStudent saveDegreeStudent(@RequestBody DegreeStudent degreestudent) {
		return degreeStudentService.save(degreestudent);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{degreeStudentId}", method = RequestMethod.PUT)
	public DegreeStudent updateDegreeStudent(@RequestBody DegreeStudent degreestudent,
			@PathVariable("degreeStudentId") Long degreeStudentId) {
		return degreeStudentService.save(degreestudent);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{degreeStudentId}", method = RequestMethod.DELETE)
	public DegreeStudent removeDegreeStudent(@PathVariable("degreeStudentId") String degreeStudentId) {
		DegreeStudent degreestudent = degreeStudentService.delete(new Long(degreeStudentId));
		return degreestudent;
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public DegreeStudentDto checkDuplicateCode(@PathVariable("code") String code) {
		return degreeStudentService.checkDuplicateCode(code);
	}
}
