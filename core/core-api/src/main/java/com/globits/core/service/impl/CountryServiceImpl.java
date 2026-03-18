package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Country;
import com.globits.core.domain.Department;
import com.globits.core.dto.CountryDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.repository.CountryRepository;
import com.globits.core.service.CountryService;

@Transactional
@Service
public class CountryServiceImpl extends GenericServiceImpl<Country, Long> implements CountryService {

	@Autowired
	CountryRepository countryRepository;
	
	@Override
	public CountryDto checkDuplicateCode(String code) {
		CountryDto viewCheckDuplicateCodeDto = new CountryDto();
		Country country = null;
		List<Country> list = countryRepository.findListByCode(code);
		if(list != null && list.size() > 0) {
			country = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(country.getCode());
			viewCheckDuplicateCodeDto.setDupName(country.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
