package com.globits.core.rest;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.domain.Person;
import com.globits.core.service.PersonService;

@RestController
@RequestMapping("/api/person")
public class RestPersonController {
	@PersistenceContext
	private EntityManager manager;

	@Autowired
	private PersonService personService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER" ,"ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	public Page<Person> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Person> page = personService.getList(pageIndex, pageSize);
		return page;
	}

	@RequestMapping(value = "/simple/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Person> getListBasicInfo(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Person> page = personService.getListByPage(pageIndex, pageSize);
		return page;
	}
}
