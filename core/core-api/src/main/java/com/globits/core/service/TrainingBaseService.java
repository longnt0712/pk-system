package com.globits.core.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.domain.TrainingBase;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.TrainingBaseDto;
import com.globits.core.service.GenericService;


public interface TrainingBaseService extends GenericService<TrainingBase, Long> {
	Page<TrainingBaseDto> getListByPage(Integer pageIndex, Integer pageSize);
	List<TrainingBaseDto> getAllTrainingBases();
	TrainingBaseDto saveTrainingBase(TrainingBaseDto dto);
	TrainingBaseDto deleteTrainingBase(Long id);
	TrainingBaseDto getTrainingBase(Long id);
	
	TrainingBaseDto checkDuplicateCode(String code);
}
