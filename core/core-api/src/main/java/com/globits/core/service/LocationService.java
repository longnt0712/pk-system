package com.globits.core.service;

import java.util.List;

import com.globits.core.domain.Location;
import com.globits.core.dto.LocationDto;

public interface LocationService extends GenericService<Location, Long> {

	/**
	 * Get a list of locations
	 * 
	 * @author Tuan Anh for Calendar
	 */
	public List<LocationDto> getAll();
	
	LocationDto checkDuplicateCode(String code);
}