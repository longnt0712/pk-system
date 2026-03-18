package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Ethnics;
import com.globits.core.dto.AdministrativeUnitDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.EthnicsDto;
import com.globits.core.repository.EthnicsRepository;
import com.globits.core.service.EthnicsService;

@Transactional
@Service
public class EthnicsServiceImpl extends GenericServiceImpl<Ethnics, Long> implements EthnicsService {
	
	@Autowired
	EthnicsRepository ethnicsRepository;
	@Override
	public int deleteEthnicss(List<EthnicsDto> dtos) {
		if(dtos==null) {
			return 0;
		}
		int ret = 0;
		for(EthnicsDto dto:dtos) {
			if(dto.getId()!=null) {
				ethnicsRepository.delete(dto.getId());
			}
			ret++;
		}
		return ret;
	}
	
	@Override
	public EthnicsDto checkDuplicateCode(String code) {
		EthnicsDto viewCheckDuplicateCodeDto = new EthnicsDto();
		Ethnics ethnics = null;
		List<Ethnics> list = ethnicsRepository.findListByCode(code);
		if(list != null && list.size() > 0) {
			ethnics = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(ethnics.getCode());
			viewCheckDuplicateCodeDto.setDupName(ethnics.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
