package com.globits.core.dto;

import com.globits.core.domain.OrganizationUser;
import com.globits.security.dto.UserDto;

public class OrganizationUserDto extends BaseObjectDto {
	private OrganizationDto organization;
	private UserDto user;
	private Boolean isAdminUser;
	
	public OrganizationDto getOrganization() {
		return organization;
	}
	public void setOrganization(OrganizationDto organization) {
		this.organization = organization;
	}
	public UserDto getUser() {
		return user;
	}
	public void setUser(UserDto user) {
		this.user = user;
	}
	
	
	public Boolean getIsAdminUser() {
		return isAdminUser;
	}
	public void setIsAdminUser(Boolean isAdminUser) {
		this.isAdminUser = isAdminUser;
	}
	public OrganizationUserDto() {
		
	}
	public OrganizationUserDto(OrganizationUser entity) {
		if(entity!=null) {
			this.setId(entity.getId());
			if(entity.getOrganization()!=null) {
				this.setOrganization(new OrganizationDto());
				this.getOrganization().setId(entity.getOrganization().getId());
				this.organization.setName(entity.getOrganization().getName());
				this.organization.setCode(entity.getOrganization().getCode());				
			}
			
			if(entity.getUser()!=null) {
				this.setUser(new UserDto(entity.getUser()));
			}
			this.isAdminUser = entity.getIsAdminUser();
		}
	}	
}
