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

import com.globits.core.domain.Organization;
import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.OrganizationUserDto;
import com.globits.core.service.OrganizationService;

@RestController
@RequestMapping("/api/organization")
public class RestOrganizationController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private OrganizationService organizationService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<OrganizationDto> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<OrganizationDto> page = organizationService.toDtoPage(organizationService.getListOrganizationByTree()); 
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT" , "ROLE_STUDENT"})
	@RequestMapping(value = "/{organizationId}", method = RequestMethod.GET)
	public OrganizationDto getOrganization(@PathVariable("organizationId") String organizationId) {
		Organization orga = organizationService.findById(new Long(organizationId));
		if(orga!=null) {
			return new OrganizationDto(orga);
		}
		return null;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public OrganizationDto saveOrganization(@RequestBody OrganizationDto organization) {
		return organizationService.saveOrganization(organization);
	}
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/saveorganizationuser",method = RequestMethod.POST)
	public OrganizationUserDto saveOrgnizationUser(@RequestBody OrganizationUserDto orgUserDto) {
		return organizationService.saveOrgnizationUser(orgUserDto);
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/organizationuser/{id}",method = RequestMethod.DELETE)
	public void deleteOrgnizationUser(@PathVariable Long id) {
		deleteOrgnizationUser(id);
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{organizationId}", method = RequestMethod.PUT)
	public OrganizationDto updateOrganization(@RequestBody Organization organization,
			@PathVariable("organizationId") Long organizationId) {
		return organizationService.updateOrganization(organization, organizationId);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{organizationId}", method = RequestMethod.DELETE)
	public Organization removeOrganization(@PathVariable("organizationId") String organizationId) {
		Organization organization = organizationService.delete(new Long(organizationId));
		return organization;
	}
}
