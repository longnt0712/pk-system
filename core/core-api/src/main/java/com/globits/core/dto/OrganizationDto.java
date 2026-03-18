package com.globits.core.dto;

import java.util.ArrayList;
import java.util.List;

import com.globits.core.domain.Organization;
import com.globits.core.domain.OrganizationUser;
import com.globits.security.dto.UserDto;

public class OrganizationDto {

	private Long id;

	private String name;

	private String code;

	private Integer organizationType;

	private OrganizationDto parent;

	private List<OrganizationDto> subDepartments;
	private List<OrganizationUserDto> users;
	
	
	public OrganizationDto() {

	}

	public OrganizationDto(Organization c) {
		this.id = c.getId();
		this.code = c.getCode();
		this.name = c.getName();
		this.organizationType = c.getOrganizationType();

		if (c.getParent() != null) {
			this.parent = new OrganizationDto();
			this.parent.setCode(c.getParent().getCode());
			this.parent.setName(c.getParent().getName());
			this.parent.setOrganizationType(c.getParent().getOrganizationType());
			this.parent.setId(c.getParent().getId());
		}

		if (c.getSubOrganizations() != null && c.getSubOrganizations().size() > 0) {
			this.subDepartments = new ArrayList<OrganizationDto>();
			for (Organization o : c.getSubOrganizations()) {
				OrganizationDto cDto = new OrganizationDto();
				cDto.setId(o.getId());
				cDto.setCode(o.getCode());
				cDto.setName(o.getName());
				cDto.setOrganizationType(o.getOrganizationType());

				this.subDepartments.add(cDto);
			}
		}
		if (c.getUsers()!= null && c.getUsers().size() > 0) {
			this.users = new ArrayList<OrganizationUserDto>();
			for (OrganizationUser o : c.getUsers()) {
				OrganizationUserDto cDto = new OrganizationUserDto();
				cDto.setId(o.getId());
				cDto.setIsAdminUser(o.getIsAdminUser());
				cDto.setUser(new UserDto(o.getUser()));
				cDto.setOrganization(new OrganizationDto());
				cDto.getOrganization().setId(o.getOrganization().getId());
				cDto.getOrganization().setName(o.getOrganization().getName());
				cDto.getOrganization().setCode(o.getOrganization().getCode());
				this.users.add(cDto);
			}
		}
	}

	public Organization toEntity() {
		Organization entity = new Organization();

		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);
		entity.setOrganizationType(organizationType);

		if (parent != null) {
			Organization pEntity = new Organization();

			pEntity.setId(parent.getId());
			pEntity.setCode(parent.getCode());
			pEntity.setName(parent.getName());
			pEntity.setOrganizationType(parent.getOrganizationType());

			entity.setParent(pEntity);
		}

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

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public Integer getOrganizationType() {
		return organizationType;
	}

	public void setOrganizationType(Integer organizationType) {
		this.organizationType = organizationType;
	}

	public OrganizationDto getParent() {
		return parent;
	}

	public void setParent(OrganizationDto parent) {
		this.parent = parent;
	}

	public List<OrganizationDto> getSubDepartments() {
		return subDepartments;
	}

	public void setSubDepartments(List<OrganizationDto> subDepartments) {
		this.subDepartments = subDepartments;
	}

	public void setName(String name) {
		this.name = name;
	}

	public List<OrganizationUserDto> getUsers() {
		return users;
	}

	public void setUsers(List<OrganizationUserDto> users) {
		this.users = users;
	}

}
