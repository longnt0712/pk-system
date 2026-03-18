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

import com.globits.core.domain.Profession;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.ProfessionDto;
import com.globits.core.service.ProfessionService;

@RestController
@RequestMapping("/api/profession")
public class RestProfessionController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private ProfessionService professionService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Profession> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Profession> page = professionService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{professionId}", method = RequestMethod.GET)
	public Profession getProfession(@PathVariable("professionId") String professionId) {
		Profession pro = professionService.findById(new Long(professionId));
		// administrativeUnit = new Profession(administrativeUnit);
		return pro;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Profession saveProfession(@RequestBody Profession profession) {
		return professionService.save(profession);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{professionId}", method = RequestMethod.PUT)
	public Profession updateProfession(@RequestBody Profession profession,
			@PathVariable("professionId") Long professionId) {
		return professionService.save(profession);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{professionId}", method = RequestMethod.DELETE)
	public Profession removeProfession(@PathVariable("professionId") String professionId) {
		Profession profession = professionService.delete(new Long(professionId));
		return profession;
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public ProfessionDto checkDuplicateCode(@PathVariable("code") String code) {
		return professionService.checkDuplicateCode(code);
	}
}
