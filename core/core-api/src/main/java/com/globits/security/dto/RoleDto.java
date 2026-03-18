package com.globits.security.dto;

import java.io.Serializable;

import com.globits.security.domain.Role;

public class RoleDto implements Serializable {

	private static final long serialVersionUID = 2472975613567232512L;

	private Long id;

	private String name;

	private String description;

	public RoleDto() {

	}

	public RoleDto(Role entity) {
		this.id = entity.getId();
		this.name = entity.getName();
		this.description = entity.getDescription();
	}

	public Role toEntity() {
		Role entity = new Role();

		entity.setId(id);
		entity.setName(name);
		entity.setDescription(description);

		return entity;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getAuthority() {
		return this.name;
	}
}
