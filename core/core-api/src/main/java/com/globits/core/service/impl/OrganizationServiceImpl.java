package com.globits.core.service.impl;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Organization;
import com.globits.core.domain.OrganizationUser;
import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.OrganizationUserDto;
import com.globits.core.repository.OrganizationRepository;
import com.globits.core.repository.OrganizationUserRepository;
import com.globits.core.service.OrganizationService;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.service.UserService;

@Transactional
@Service
public class OrganizationServiceImpl extends GenericServiceImpl<Organization, Long> implements OrganizationService {
	@Autowired
	OrganizationRepository organizationRepository;
	@Autowired
	OrganizationUserRepository organizationUserRepository;
	
	@Autowired
	UserService userService;
	@Override
	public List<Organization> findOrganizationByUserId(Long userId){
		return organizationRepository.findOrganizationByUserId(userId);
	}
	
	private List<Organization> getListSub(Organization dep, int level) {
		ArrayList<Organization> retList = new ArrayList<Organization>();
		dep.setLevel(level);
		retList.add(dep);
		if (dep.getSubOrganizations() != null && dep.getSubOrganizations().size() > 0) {
			Iterator<Organization> iter = dep.getSubOrganizations().iterator();
			while (iter.hasNext()) {
				Organization d = iter.next();
				retList.addAll(getListSub(d, level + 1));
			}
		}
		return retList;
	}

	public Page<Organization> getListOrganizationByTree() {
		List<Organization> list = organizationRepository.getListOrganizationByTree();
		ArrayList<Organization> retList = new ArrayList<Organization>();
		for (int i = 0; i < list.size(); i++) {
			// retList.add(list.get(i));
			if (list.get(i) != null) {
				List<Organization> childs = getListSub(list.get(i), 0);
				if (childs != null && childs.size() > 0) {
					retList.addAll(childs);
				}
			}
		}
		int pageSize = 1;
		if (retList.size() > 0) {
			pageSize = retList.size();
		}
		Pageable pageable = new PageRequest(0, pageSize);
		Page<Organization> page = new PageImpl<Organization>(retList, pageable, pageSize);
		return page;
	}
	@Override
	public Page<OrganizationDto> toDtoPage(Page<Organization> page){		
		Pageable pageable = new PageRequest(page.getNumber(), page.getSize());
		List<OrganizationDto> ret = new ArrayList<OrganizationDto>();
		if(page.getContent()!=null && page.getContent().size()>0) {
			
			for (Organization organization : page.getContent()) {
				OrganizationDto dto = new OrganizationDto(organization);
				ret.add(dto);
			}
		}
		return new PageImpl<OrganizationDto>(ret, pageable, page.getTotalElements());
	}
	
	public OrganizationDto updateOrganization(Organization organization, Long organizationId) {
		Organization updateOrganization = null;
		if (organization.getId() != null) {
			updateOrganization = this.findById(organization.getId());
		} else {
			updateOrganization = this.findById(organizationId);
		}

		updateOrganization.setCode(organization.getCode());
		updateOrganization.setName(organization.getName());
		updateOrganization.setOrganizationType(organization.getOrganizationType());

		if (organization.getParent() != null && organization.getParent().getId() != null) {
			Organization parentOrganization = organizationRepository.findById(organization.getParent().getId());
			if (parentOrganization.getId() != updateOrganization.getId()) {
				updateOrganization.setParent(parentOrganization);
			}
		} else if (updateOrganization.getParent() != null) {
			updateOrganization.setParent(null);
		}
		updateOrganization = this.save(updateOrganization);
		if (updateOrganization.getParent() != null) {
			updateOrganization.setParent(new Organization(updateOrganization.getParent().getId(),
					updateOrganization.getParent().getName(), updateOrganization.getParent().getCode(),
					updateOrganization.getParent().getOrganizationType()));
		}
		return new OrganizationDto(updateOrganization);
	}

	public OrganizationDto saveOrganization(OrganizationDto organization) {
		Organization newOrganization = new Organization();
		newOrganization.setCode(organization.getCode());
		newOrganization.setName(organization.getName());
		newOrganization.setOrganizationType(organization.getOrganizationType());

		if (organization.getParent() != null && organization.getParent().getId() != null) {
			Organization parentOrganization = organizationRepository.findById(organization.getParent().getId());
			if (parentOrganization.getId() != newOrganization.getId()) {
				newOrganization.setParent(parentOrganization);
			}
		}
		Organization org =  this.save(newOrganization);
		return new OrganizationDto(org);
	}
	@Override
	public void deleteOrganizationUser(Long id) {
		organizationUserRepository.delete(id);
	}
	@Override
	public OrganizationUserDto saveOrgnizationUser(OrganizationUserDto orgUserDto) {
		OrganizationUser orgUser = organizationUserRepository.findById(orgUserDto.getId());
		if(orgUser==null) {
			orgUser = new OrganizationUser();
		}
		orgUser.setIsAdminUser(orgUserDto.getIsAdminUser());
		Organization organization =  organizationRepository.findById(orgUserDto.getOrganization().getId());
		if(organization!=null) {
			orgUser.setOrganization(organization);
			User user = userService.saveUser(orgUserDto.getUser());
			orgUser.setUser(user);
			orgUser = organizationUserRepository.save(orgUser);
			return new OrganizationUserDto(orgUser);
		}
		return null;
	}
}
