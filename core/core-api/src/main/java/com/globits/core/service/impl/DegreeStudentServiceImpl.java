package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.DegreeStudent;
import com.globits.core.domain.Department;
import com.globits.core.dto.DegreeStudentDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.repository.DegreeStudentRepository;
import com.globits.core.service.DegreeStudentService;

@Transactional
@Service
public class DegreeStudentServiceImpl extends GenericServiceImpl<DegreeStudent, Long> implements DegreeStudentService {

	@Autowired
	DegreeStudentRepository degreeStudentReprository;
	
	@Override
	public DegreeStudentDto checkDuplicateCode(String code) {
		DegreeStudentDto viewCheckDuplicateCodeDto = new DegreeStudentDto();
		DegreeStudent degreeStudent = null;
		List<DegreeStudent> list = degreeStudentReprository.findByCode(code);
		if(list != null && list.size() > 0) {
			degreeStudent = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(degreeStudent.getCode());
			viewCheckDuplicateCodeDto.setDupName(degreeStudent.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
