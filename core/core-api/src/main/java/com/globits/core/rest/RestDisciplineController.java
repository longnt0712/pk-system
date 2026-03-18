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

import com.globits.core.domain.Discipline;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.DisciplineDto;
import com.globits.core.service.DisciplineService;

@RestController
@RequestMapping("/api/discipline")
public class RestDisciplineController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private DisciplineService disciplineService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT" })
	public Page<Discipline> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Discipline> page = disciplineService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT" })
	@RequestMapping(value = "/{disciplineId}", method = RequestMethod.GET)
	public Discipline getDiscipline(@PathVariable("disciplineId") String disciplineId) {
		Discipline discipline = disciplineService.findById(new Long(disciplineId));
		discipline = new Discipline(discipline);
		return discipline;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Discipline saveDiscipline(@RequestBody Discipline discipline) {
		return disciplineService.save(discipline);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{disciplineId}", method = RequestMethod.PUT)
	public Discipline updateDiscipline(@RequestBody Discipline Discipline,
			@PathVariable("disciplineId") Long DisciplineId) {
		return disciplineService.save(Discipline);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{disciplineId}", method = RequestMethod.DELETE)
	public Discipline removeDiscipline(@PathVariable("disciplineId") String disciplineId) {
		Discipline Discipline = disciplineService.delete(new Long(disciplineId));
		return Discipline;
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public DisciplineDto checkDuplicateCode(@PathVariable("code") String code) {
		return disciplineService.checkDuplicateCode(code);
	}
}
