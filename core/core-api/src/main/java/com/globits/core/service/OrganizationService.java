package com.globits.core.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.domain.Organization;
import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.OrganizationUserDto;

public interface OrganizationService extends GenericService<Organization, Long> {
	OrganizationDto saveOrganization(OrganizationDto organization);

	OrganizationDto updateOrganization(Organization organization, Long organizationId);

	Page<Organization> getListOrganizationByTree();

	OrganizationUserDto saveOrgnizationUser(OrganizationUserDto orgUserDto);

	void deleteOrganizationUser(Long id);

	public List<Organization> findOrganizationByUserId(Long userId);

	public Page<OrganizationDto> toDtoPage(Page<Organization> page);
}