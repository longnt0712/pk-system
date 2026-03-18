package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Discipline;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.DisciplineDto;
import com.globits.core.repository.DisciplineRepository;
import com.globits.core.service.DisciplineService;

@Transactional
@Service
public class DisciplineServiceImpl extends GenericServiceImpl<Discipline, Long> implements DisciplineService {
	@Autowired
	DisciplineRepository disciplineRepository;
	
	@Override
	public DisciplineDto checkDuplicateCode(String code) {
		DisciplineDto viewCheckDuplicateCodeDto = new DisciplineDto();
		Discipline discipline = null;
		List<Discipline> list = disciplineRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			discipline = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(discipline.getCode());
			viewCheckDuplicateCodeDto.setDupName(discipline.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
