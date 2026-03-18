package com.globits.core.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.domain.Building;
import com.globits.core.dto.BuildingDto;

public interface BuildingService extends GenericService<Building, Long> {
	Page<BuildingDto> getListByPage(Integer pageIndex, Integer pageSize);
	List<BuildingDto> getAllBuildingByTrainingBase(Long trainingBaseId);
	BuildingDto saveBuilding(BuildingDto dto);
	BuildingDto deleteBuilding(Long id);
	BuildingDto getBuilding(Long id);
	BuildingDto checkDuplicateCode(String code);
}