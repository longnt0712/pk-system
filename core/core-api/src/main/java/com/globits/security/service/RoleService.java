package com.globits.security.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.service.GenericService;
import com.globits.security.domain.Role;
import com.globits.security.dto.RoleDto;

public interface RoleService extends GenericService<Role, Long> {
	
	Role findByName(String name);

	Role findById(Long roleId);

	Page<Role> findByRoleStudent(int pageIndex, int pageSize);
	
	RoleDto createRole(RoleDto roleDto);
	
	RoleDto updateRole(RoleDto roleDto, Long roleId);
	
	Page<RoleDto> findByRoleStaff(int pageIndex, int pageSize);
	
	public List<RoleDto> findAll();
}
