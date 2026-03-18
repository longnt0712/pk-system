package com.globits.core.service.impl;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Location;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.LocationDto;
import com.globits.core.repository.DepartmentRepository;
import com.globits.core.repository.LocationRepository;
import com.globits.core.service.LocationService;

@Transactional
@Service
public class LocationServiceImpl extends GenericServiceImpl<Location, Long> implements LocationService {

	@Autowired
	LocationRepository locationRepository;
	
	@Override
	public List<LocationDto> getAll() {

		Iterator<Location> itr = repository.findAll().iterator();
		List<LocationDto> list = new ArrayList<LocationDto>();

		while (itr.hasNext()) {
			list.add(new LocationDto(itr.next()));
		}

		return list;
	}

	@Override
	public LocationDto checkDuplicateCode(String code) {
		LocationDto viewCheckDuplicateCodeDto = new LocationDto();
		Location location = null;
		List<Location> list = locationRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			location = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(location.getCode());
			viewCheckDuplicateCodeDto.setDupName(location.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
