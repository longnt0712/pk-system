package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Religion;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.ReligionDto;
import com.globits.core.repository.ReligionRepository;
import com.globits.core.service.ReligionService;

@Transactional
@Service
public class ReligionServiceImpl extends GenericServiceImpl<Religion, Long> implements ReligionService {

	@Autowired
	ReligionRepository religionRepository;
	
	@Override
	public ReligionDto checkDuplicateCode(String code) {
		ReligionDto viewCheckDuplicateCodeDto = new ReligionDto();
		Religion department = null;
		List<Religion> list = religionRepository.findListByCode(code);
		if(list != null && list.size() > 0) {
			department = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(department.getCode());
			viewCheckDuplicateCodeDto.setDupName(department.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
	
}
