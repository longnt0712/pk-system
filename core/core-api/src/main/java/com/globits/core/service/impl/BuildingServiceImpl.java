package com.globits.core.service.impl;

import java.util.List;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Building;
import com.globits.core.domain.Department;
import com.globits.core.domain.TrainingBase;
import com.globits.core.dto.BuildingDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.repository.BuildingRepository;
import com.globits.core.repository.TrainingBaseRepository;
import com.globits.core.service.BuildingService;
import com.globits.security.domain.User;

@Transactional
@Service
public class BuildingServiceImpl extends GenericServiceImpl<Building, Long> implements BuildingService {
	@Autowired
	BuildingRepository buildingRepository;
	@Autowired
	TrainingBaseRepository trainingBaseRepository;
	@Override
	public Page<BuildingDto> getListByPage(Integer pageIndex, Integer pageSize) {
		Pageable pageable = new PageRequest(pageIndex-1, pageSize);
		return buildingRepository.getListByPage(pageable);
	}

	@Override
	public List<BuildingDto> getAllBuildingByTrainingBase(Long trainingBaseId) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public BuildingDto saveBuilding(BuildingDto dto) {
		
		 Authentication authentication =
		 SecurityContextHolder.getContext().getAuthentication();
		 User modifiedUser = null;
		 LocalDateTime currentDate = LocalDateTime.now();
		 String currentUserName = "Unknown User";
		 if (authentication != null) {
		 modifiedUser = (User) authentication.getPrincipal();
		 currentUserName = modifiedUser.getUsername();
		 }
		Building building = dto.toEntity();
		if(dto.getTrainingBase()!=null && dto.getTrainingBase().getId()!=null) {
			TrainingBase trainingBase = trainingBaseRepository.findOne(dto.getTrainingBase().getId());
			if(trainingBase!=null) {
				building.setTrainingBase(trainingBase);
			}
		}
		if(building.getCreateDate()==null) {
			building.setCreateDate(currentDate);
			building.setCreatedBy(currentUserName);
		}
		building= buildingRepository.save(building);
		return new BuildingDto(building);
	}

	@Override
	public BuildingDto deleteBuilding(Long id) {
		Building building =buildingRepository.findOne(id);
		if(building!=null) {
			buildingRepository.delete(id);
			return new BuildingDto(building);
		}else {
			return null;
		}
	}

	@Override
	public BuildingDto getBuilding(Long id) {
		Building building =buildingRepository.findOne(id);
		return new BuildingDto(building);
	}

	@Override
	public BuildingDto checkDuplicateCode(String code) {
		BuildingDto viewCheckDuplicateCodeDto = new BuildingDto();
		Building building = null;
		List<Building> list = buildingRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			building = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(building.getCode());
			viewCheckDuplicateCodeDto.setDupName(building.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
