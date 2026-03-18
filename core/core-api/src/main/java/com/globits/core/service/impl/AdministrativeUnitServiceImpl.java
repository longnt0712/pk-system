package com.globits.core.service.impl;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.AdministrativeUnit;
import com.globits.core.dto.AdministrativeUnitDto;
import com.globits.core.repository.AdministrativeUnitRepository;
import com.globits.core.service.AdministrativeUnitService;
import com.globits.security.domain.User;
//import com.globits.hr.dto.AcademicTitleDto;
@Transactional
@Service
public class AdministrativeUnitServiceImpl extends GenericServiceImpl<AdministrativeUnit, Long>
		implements AdministrativeUnitService {
	@Autowired
	AdministrativeUnitRepository administrativeUnitRepository;

	private List<AdministrativeUnit> getListSub(AdministrativeUnit dep, int level) {
		ArrayList<AdministrativeUnit> retList = new ArrayList<AdministrativeUnit>();
		dep.setLevel(level);
		retList.add(dep);
		if (dep.getSubAdministrativeUnits() != null && dep.getSubAdministrativeUnits().size() > 0) {
			Iterator<AdministrativeUnit> iter = dep.getSubAdministrativeUnits().iterator();
			while (iter.hasNext()) {
				AdministrativeUnit d = iter.next();
				retList.addAll(getListSub(d, level + 1));
			}
		}
		return retList;
	}

	@Override
	public Page<AdministrativeUnit> getListAdministrativeUnitByTree(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		Page<AdministrativeUnit> page = administrativeUnitRepository.getListRootAdministrativeUnit(pageable);
		ArrayList<AdministrativeUnit> retList = new ArrayList<AdministrativeUnit>();
		for (int i = 0; i < page.getContent().size(); i++) {
			if (page.getContent().get(i) != null) {
				List<AdministrativeUnit> childs = getListSub(page.getContent().get(i), 0);
				if (childs != null && childs.size() > 0) {
					retList.addAll(childs);
				}
			}
		}
		if (retList.size() > 0) {
			pageSize = retList.size();
		}
		page = new PageImpl<AdministrativeUnit>(retList, pageable, pageSize);
		return page;
	}

	@Override
	public Page<AdministrativeUnit> getListAdministrativeUnitbyProvince(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return administrativeUnitRepository.getListRootAdministrativeUnit(pageable);
	}

	@Override
	public Page<AdministrativeUnit> getListAdministrativeUnitbyCity(Long parentId, int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return administrativeUnitRepository.getListdministrativeUnitbyCity(parentId, pageable);
	}

	@Override
	public AdministrativeUnit updateAdministrativeUnit(AdministrativeUnit administrativeUnit,
			Long administrativeUnitId) {
		Authentication authentication =
		SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		AdministrativeUnit updateAdministrativeUnit = null;
		if (administrativeUnit.getId() != null) {
			updateAdministrativeUnit = this.findById(administrativeUnit.getId());
		} else {
			updateAdministrativeUnit = this.findById(administrativeUnitId);
		}
		if(updateAdministrativeUnit.getCreateDate()==null ||updateAdministrativeUnit.getCreatedBy()==null) {
			updateAdministrativeUnit.setCreateDate(currentDate);
			updateAdministrativeUnit.setCreatedBy(currentUserName);
		}
		updateAdministrativeUnit.setModifyDate(currentDate);
		updateAdministrativeUnit.setModifiedBy(currentUserName);
		updateAdministrativeUnit.setCode(administrativeUnit.getCode());
		updateAdministrativeUnit.setName(administrativeUnit.getName());
		// updateAdministrativeUnit.setAdministrativeUnitType(administrativeUnit.getAdministrativeUnitType());

		if (administrativeUnit.getParent() != null && administrativeUnit.getParent().getId() != null) {
			AdministrativeUnit parentAdministrativeUnit = administrativeUnitRepository
					.getOne(administrativeUnit.getParent().getId());
			if (parentAdministrativeUnit.getId() != updateAdministrativeUnit.getId()) {
				updateAdministrativeUnit.setParent(parentAdministrativeUnit);
			}
		} else if (updateAdministrativeUnit.getParent() != null) {
			updateAdministrativeUnit.setParent(null);
		}
		updateAdministrativeUnit = this.save(updateAdministrativeUnit);
		if (updateAdministrativeUnit.getParent() != null) {
			updateAdministrativeUnit.setParent(new AdministrativeUnit(updateAdministrativeUnit.getParent(), false));
		}
		return updateAdministrativeUnit;
	}

	@Override
	public AdministrativeUnit saveAdministrativeUnit(AdministrativeUnit administrativeUnit) {
		AdministrativeUnit newAdministrativeUnit = new AdministrativeUnit();
		newAdministrativeUnit.setCode(administrativeUnit.getCode());
		newAdministrativeUnit.setName(administrativeUnit.getName());
		if (administrativeUnit.getParent() != null && administrativeUnit.getParent().getId() != null) {
			AdministrativeUnit parentAdministrativeUnit = administrativeUnitRepository
					.getOne(administrativeUnit.getParent().getId());
			if (parentAdministrativeUnit.getId() != newAdministrativeUnit.getId()) {
				newAdministrativeUnit.setParent(parentAdministrativeUnit);
			}
		}
		newAdministrativeUnit = save(newAdministrativeUnit);
		return new AdministrativeUnit(newAdministrativeUnit, false);
	}
	
	@Override
	public int deleteAdministrativeUnits(List<AdministrativeUnitDto> dtos) {
		
		if(dtos==null) {
			return 0;
		}
		int ret = 0;
		for(AdministrativeUnitDto dto:dtos) {
			if(dto.getId()!=null) {
				administrativeUnitRepository.delete(dto.getId());
				
			}
			ret++;
		}
		return ret;
	}

	@Override
	public Page<AdministrativeUnitDto> getListTree(Integer pageIndex, Integer pageSize) {
		Pageable pageable = new PageRequest(pageIndex-1, pageSize);
		
		List<AdministrativeUnit> dads = administrativeUnitRepository.findTreeAdministrativeUnit(pageable);
		Long countElement = administrativeUnitRepository.countDadAdministrativeUnit();
		List<AdministrativeUnitDto> dtos = new ArrayList<AdministrativeUnitDto>();
		for (AdministrativeUnit cs : dads) {
			dtos.add(new AdministrativeUnitDto(cs));
		}
		
		Page<AdministrativeUnitDto> finalPage = new PageImpl<AdministrativeUnitDto>(dtos, pageable, countElement);
		
		return finalPage;
	}

	@Override
	public Page<AdministrativeUnitDto> findByPageBasicInfo(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return administrativeUnitRepository.findByPageBasicInfo(pageable);
	}

	@Override
	public AdministrativeUnitDto deleteAdministrativeUnit(Long id) {
		List<AdministrativeUnit> list=new ArrayList<AdministrativeUnit>();
		AdministrativeUnitDto ret =new AdministrativeUnitDto();
		AdministrativeUnit au= administrativeUnitRepository.findOne(id);
		if(au!=null && au.getId()!=null) {
			ret.setId(au.getId());
			ret.setCode(au.getCode());
			ret.setName(au.getName());
			list=administrativeUnitRepository.getListdministrativeUnitbyParent(au.getId());
			if(list!=null && list.size()>0) {
				//không xóa được thư mục cha=> phải xóa thư mục con trước
			}else {
				administrativeUnitRepository.delete(au.getId());
				ret.setCode("-1");
			}
		}
		return ret;
	}

}
