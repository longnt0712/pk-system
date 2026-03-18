package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Status;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.StatusDto;
import com.globits.core.repository.StatusRepository;
import com.globits.core.service.StatusService;

@Transactional
@Service
public class StatusServiceImpl extends GenericServiceImpl<Status, Long> implements StatusService {
	
	@Autowired
	StatusRepository statusRepository;
	
	@Override
	public StatusDto checkDuplicateCode(String code) {
		StatusDto viewCheckDuplicateCodeDto = new StatusDto();
		Status status = null;
		List<Status> list = statusRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			status = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(status.getCode());
			viewCheckDuplicateCodeDto.setDupName(status.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
