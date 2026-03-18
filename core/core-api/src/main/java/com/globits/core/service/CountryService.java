package com.globits.core.service;

import com.globits.core.domain.Country;
import com.globits.core.dto.CountryDto;
import com.globits.core.dto.DepartmentDto;

public interface CountryService extends GenericService<Country, Long> {
	CountryDto checkDuplicateCode(String code);
}