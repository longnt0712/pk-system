package com.globits.core.service;

import com.globits.core.domain.Religion;
import com.globits.core.dto.ReligionDto;

public interface ReligionService extends GenericService<Religion, Long> {
	ReligionDto checkDuplicateCode(String code);
}