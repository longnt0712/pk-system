package com.globits.core.service.impl;

import org.joda.time.LocalDateTime;

import java.util.List;

import org.joda.time.DateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.TrainingBase;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.TrainingBaseDto;
import com.globits.core.repository.TrainingBaseRepository;
import com.globits.core.service.TrainingBaseService;
import com.globits.core.service.impl.GenericServiceImpl;
import com.globits.security.domain.User;

@Transactional
@Service

public class TrainingBaseServiceImpl extends GenericServiceImpl<TrainingBase, Long> implements TrainingBaseService {
	@Autowired
	private TrainingBaseRepository trainingBaseRepository;

	@Override
	public Page<TrainingBaseDto> getListByPage(Integer pageIndex, Integer pageSize) {
		Pageable pageable = new PageRequest(pageIndex-1, pageSize);
		return trainingBaseRepository.getListByPage(pageable);
	}
	public TrainingBaseDto deleteTrainingBase(Long id) {
		TrainingBase t = trainingBaseRepository.findOne(id);
		if(t!=null) {
			trainingBaseRepository.delete(id);
			return new TrainingBaseDto(t);
		}
		return null;
	}
	@Override
	public TrainingBaseDto saveTrainingBase(TrainingBaseDto dto) {
		 Authentication authentication =
		 SecurityContextHolder.getContext().getAuthentication();
		 User modifiedUser = null;
		 LocalDateTime currentDate = LocalDateTime.now();
		 String currentUserName = "Unknown User";
		 if (authentication != null) {
			 modifiedUser = (User) authentication.getPrincipal();
			 currentUserName = modifiedUser.getUsername();
		 }
		if(dto!=null) {
			TrainingBase t = null;
			if(dto.getId()!=null) {
				t= trainingBaseRepository.findOne(dto.getId());
			}
			if(t==null) {
				t= new TrainingBase();
				t.setCreateDate(currentDate);
				t.setCreatedBy(currentUserName);
			}
			if(t.getCreateDate()==null) {
				t.setCreateDate(currentDate);
				t.setCreatedBy(currentUserName);
			}else {
				t.setModifyDate(currentDate);
				t.setModifiedBy(currentUserName);
			}
			
			t.setAddress(dto.getAddress());
			t.setCode(dto.getCode());
			t.setDescription(dto.getDescription());
			t.setName(dto.getName());
			t.setTestDate(org.joda.time.LocalDateTime.now());
			t=trainingBaseRepository.save(t);
			return new TrainingBaseDto(t);
		}
		return null;
	}
	@Override
	public TrainingBaseDto getTrainingBase(Long id) {
		return trainingBaseRepository.getTrainingBaseById(id);
	}
	@Override
	public List<TrainingBaseDto> getAllTrainingBases() {
		// TODO Auto-generated method stub
		return trainingBaseRepository.getTrainingAllBases();
	}
	
	@Override
	public TrainingBaseDto checkDuplicateCode(String code) {
		TrainingBaseDto viewCheckDuplicateCodeDto = new TrainingBaseDto();
		TrainingBase trainingBase = null;
		List<TrainingBase> list = trainingBaseRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			trainingBase = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(trainingBase.getCode());
			viewCheckDuplicateCodeDto.setDupName(trainingBase.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
