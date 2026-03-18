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

import com.globits.core.domain.Ethnics;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.EthnicsDto;
import com.globits.core.service.EthnicsService;

@RestController
@RequestMapping("/api/ethnics")
public class RestEthnicsController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private EthnicsService ethnicsService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Ethnics> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Ethnics> page = ethnicsService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{ethnicsId}", method = RequestMethod.GET)
	public Ethnics getEthnics(@PathVariable("ethnicsId") String ethnicsId) {
		Ethnics ethnics = ethnicsService.findById(new Long(ethnicsId));
		return ethnics;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Ethnics saveEthnics(@RequestBody Ethnics ethnics) {
		return ethnicsService.save(ethnics);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{ethnicsId}", method = RequestMethod.PUT)
	public Ethnics updateEthnics(@RequestBody Ethnics ethnics, @PathVariable("ethnicsId") Long ethnicsId) {
		return ethnicsService.save(ethnics);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{ethnicsId}", method = RequestMethod.DELETE)
	public Ethnics removeEthnics(@PathVariable("ethnicsId") String ethnicsId) {
		Ethnics ethnics = ethnicsService.delete(new Long(ethnicsId));
		return ethnics;
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public EthnicsDto checkDuplicateCode(@PathVariable("code") String code) {
		return ethnicsService.checkDuplicateCode(code);
	}
}
