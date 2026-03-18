package com.globits.security.rest;

import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.globits.security.domain.Role;
import com.globits.security.dto.RoleDto;
import com.globits.security.service.RoleService;

@RestController
@RequestMapping("/api/roles")
@Transactional
@Secured({ "ROLE_ADMIN" })
public class RestRoleController {
	@PersistenceContext
	private EntityManager manager;

	@Autowired
	private RoleService roleService;

	@RequestMapping
	public Role findByRoleName(@RequestParam String roleName) {
		return roleService.findByName(roleName);
	}

	@RequestMapping(value = "/{roleId}", method = RequestMethod.GET)
	public Role getRole(@PathVariable("roleId") String roleId) {
		return roleService.findById(new Long(roleId));
	}

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	public Page<Role> getRoles(@PathVariable int pageIndex, @PathVariable int pageSize) {
		return roleService.getList(pageIndex, pageSize);
	}

	@GetMapping(path = "/all")
	@Secured({ "ROLE_ADMIN","ROLE_STUDENT_MANAGERMENT" })
	public List<RoleDto> getAll() {
		return roleService.findAll();
	}

	@RequestMapping(value = "/rolestudent/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	public Page<Role> getRoleStudents(@PathVariable int pageIndex, @PathVariable int pageSize) {
		return roleService.findByRoleStudent(pageIndex, pageSize);
	}

	@RequestMapping(method = RequestMethod.POST)
	public RoleDto createRole(@RequestBody RoleDto roleDto) {
		return roleService.createRole(roleDto);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{roleId}", method = RequestMethod.PUT)
	public RoleDto updateRole(@RequestBody RoleDto roleDto, @PathVariable("roleId") Long roleId) {
		return roleService.updateRole(roleDto, roleId);
	}

	@RequestMapping(value = "/{roleId}", method = RequestMethod.DELETE)
	public Role removeRole(@PathVariable("roleId") String roleId) {
		return roleService.delete(new Long(roleId));
	}
	
	@RequestMapping(value = "/rolestaff/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	public Page<RoleDto> getRoleStaffs(@PathVariable int pageIndex, @PathVariable int pageSize) {
		return roleService.findByRoleStaff(pageIndex, pageSize);
	}
}
