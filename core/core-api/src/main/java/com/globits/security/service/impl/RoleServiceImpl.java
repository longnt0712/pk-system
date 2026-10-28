package com.globits.security.service.impl;


import org.joda.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.service.impl.GenericServiceImpl;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.RoleDto;
import com.globits.security.repository.RoleRepository;
import com.globits.security.repository.UserRepository;
import com.globits.security.service.RoleService;

@Transactional
@Service
public class RoleServiceImpl extends GenericServiceImpl<Role, Long> implements RoleService {

	@Autowired
	RoleRepository roleRepository;

	@Autowired
	UserRepository userRepository;

	// public Role save(Role role) throws RuntimeException {
	// return roleRepository.save(role);
	// }
	//
	// public Role delete(Long roleId) throws RuntimeException {
	// Role role = roleRepository.findOne(roleId);
	// if(role!=null){
	// roleRepository.delete(role);
	// }
	// return role;
	// }

	public Page<Role> findRoles(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return roleRepository.findAll(pageable);
	}

	public Page<Role> findByRoleStudent(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return roleRepository.findByRoleStudent(pageable);
	}

	public Role findByName(String name) {
		return roleRepository.findByName(name);
	}

	public Role findById(Long roleId) {
		return roleRepository.findOne(roleId);
	}

	@Override
	public RoleDto createRole(RoleDto roleDto) {
		String currentUserName = "Unknown User";
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		LocalDateTime currentDate = LocalDateTime.now();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		
		Role role = null;
		if(roleDto.getId() != null && roleDto.getId() > 0) {
			role = roleRepository.getOne(roleDto.getId());
		}
		if(role == null) {
			role = new Role();
			role.setCreateDate(currentDate);
			role.setCreatedBy(currentUserName);
		}
		changeRoleName(role, roleDto.getName());
		
		if(roleDto.getDescription() != null && roleDto.getDescription().length() > 0) {
			role.setDescription(roleDto.getDescription());
		}else if(roleDto.getDescription() == null || roleDto.getDescription().length() <= 0) {
			role.setDescription(null);
		}
		
		role = roleRepository.save(role);
		
		return new RoleDto(role);
	}
	
	@Override
	public RoleDto updateRole(RoleDto roleDto, Long roleId) {
		String currentUserName = "Unknown User";
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		LocalDateTime currentDate = LocalDateTime.now();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		Role updateRole = roleRepository.getOne(roleId);
		if(updateRole != null) {
			updateRole.setModifyDate(currentDate);
			updateRole.setModifiedBy(currentUserName);
			changeRoleName(updateRole, roleDto.getName());
			
			if(roleDto.getDescription() != null && roleDto.getDescription().length() > 0) {
				updateRole.setDescription(roleDto.getDescription());
			}else if(roleDto.getDescription() == null || roleDto.getDescription().length() <= 0) {
				updateRole.setDescription(null);
			}
		}
		
		updateRole = roleRepository.save(updateRole);
		
		return new RoleDto(updateRole);
	}

	private void changeRoleName(Role role, String name) {
		if (name == null || name.isEmpty() || Objects.equals(role.getName(), name)) { return; }
		if (role.getId() != null) {
			for (User user : userRepository.findByRoleId(role.getId())) {
				user.invalidateSessions();
				userRepository.save(user);
			}
		}
		role.setName(name);
	}

	@Override
	public Role delete(Long roleId) {
		Role role = roleRepository.findOne(roleId);
		if (role == null) { return null; }
		for (User user : userRepository.findByRoleId(roleId)) {
			Set<Role> remaining = new HashSet<Role>();
			for (Role assigned : user.getRoles()) {
				if (!Objects.equals(roleId, assigned.getId())) { remaining.add(assigned); }
			}
			user.replaceRoles(remaining);
			user.invalidateSessions();
			userRepository.save(user);
		}
		// Remove user-role join rows before deleting the referenced role.
		userRepository.flush();
		roleRepository.delete(role);
		return role;
	}

	@Override
	public Page<RoleDto> findByRoleStaff(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		Page<Role> domains = roleRepository.findByRoleStaff(pageable);
		List<RoleDto> dtos = new ArrayList<RoleDto>();
		
		for (Role role : domains) {
			dtos.add(new RoleDto(role));
		}
		
		Page<RoleDto> finalPage = new PageImpl<RoleDto>(dtos, pageable, domains.getTotalElements());
		return finalPage;
	}

	@Override
	@Transactional(rollbackFor = Exception.class)
	public List<RoleDto> findAll() {
		List<Role> list = roleRepository.findAll();
		List<RoleDto> ret = new ArrayList<>();

		for (Role r : list) {
			ret.add(new RoleDto(r));
		}

		return ret;
	}
}
