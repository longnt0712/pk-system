package com.globits.security.dto;

import com.globits.core.dto.AuditableEntityDto;
import com.globits.security.domain.UserGroup;

public class UserGroupDto extends AuditableEntityDto {

	private Long id;

	private String name;

	private String description;

	public UserGroupDto() {

	}

	public UserGroupDto(UserGroup entity) {
		if (entity == null) {
			return;
		}
		
		id = entity.getId();
		name = entity.getName();
		description = entity.getDescription();
		
		setCreateDate(entity.getCreateDate());
		setCreatedBy(entity.getCreatedBy());
		setModifyDate(entity.getModifyDate());
		setModifiedBy(entity.getModifiedBy());
	}

	public UserGroup toEntity() {

		UserGroup entity = new UserGroup();
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

}
