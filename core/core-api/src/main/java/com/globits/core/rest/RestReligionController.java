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

import com.globits.core.domain.Religion;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.ReligionDto;
import com.globits.core.service.ReligionService;

@RestController
@RequestMapping("/api/religion")
public class RestReligionController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private ReligionService religionService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Religion> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Religion> page = religionService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{religionId}", method = RequestMethod.GET)
	public Religion getReligion(@PathVariable("religionId") String religionId) {
		Religion religion = religionService.findById(new Long(religionId));
		return religion;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Religion saveReligion(@RequestBody Religion religion) {
		return religionService.save(religion);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{religionId}", method = RequestMethod.PUT)
	public Religion updateReligion(@RequestBody Religion Religion, @PathVariable("religionId") Long ReligionId) {
		return religionService.save(Religion);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{religionId}", method = RequestMethod.DELETE)
	public Religion removeReligion(@PathVariable("religionId") String religionId) {
		Religion Religion = religionService.delete(new Long(religionId));
		return Religion;
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public ReligionDto checkDuplicateCode(@PathVariable("code") String code) {
		return religionService.checkDuplicateCode(code);
	}
}
