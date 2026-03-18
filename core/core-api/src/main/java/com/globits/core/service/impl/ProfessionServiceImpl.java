package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Profession;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.ProfessionDto;
import com.globits.core.repository.ProfessionRepository;
import com.globits.core.service.ProfessionService;

@Transactional
@Service
public class ProfessionServiceImpl extends GenericServiceImpl<Profession, Long> implements ProfessionService {

	@Autowired
	ProfessionRepository professionRepository;
	
	@Override
	public ProfessionDto checkDuplicateCode(String code) {
		ProfessionDto viewCheckDuplicateCodeDto = new ProfessionDto();
		Profession profession = null;
		List<Profession> list = professionRepository.findListByCode(code);
		if(list != null && list.size() > 0) {
			profession = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(profession.getCode());
			viewCheckDuplicateCodeDto.setDupName(profession.getName());
		}
		return viewCheckDuplicateCodeDto;
	}	
}
