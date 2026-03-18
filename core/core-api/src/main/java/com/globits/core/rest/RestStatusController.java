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

import com.globits.core.domain.Status;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.StatusDto;
import com.globits.core.service.StatusService;

@RestController
@RequestMapping("/api/status")
public class RestStatusController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private StatusService statusService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured("ROLE_ADMIN")
	public Page<Status> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Status> page = statusService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{statusId}", method = RequestMethod.GET)
	public Status getStatus(@PathVariable("statusId") String statusId) {
		Status status = statusService.findById(new Long(statusId));
		return status;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Status saveStatus(@RequestBody Status status) {
		return statusService.save(status);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{statusId}", method = RequestMethod.PUT)
	public Status updateStatus(@RequestBody Status Status, @PathVariable("statusId") Long statusId) {
		return statusService.save(Status);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{statusId}", method = RequestMethod.DELETE)
	public Status removeStatus(@PathVariable("statusId") String statusId) {
		Status Status = statusService.delete(new Long(statusId));
		return Status;
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public StatusDto checkDuplicateCode(@PathVariable("code") String code) {
		return statusService.checkDuplicateCode(code);
	}
}
