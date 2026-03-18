package com.globits.core.service;

import java.util.List;

import com.globits.core.domain.Ethnics;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.EthnicsDto;
public interface EthnicsService extends GenericService<Ethnics, Long> {

	int deleteEthnicss(List<EthnicsDto> dtos);

	EthnicsDto checkDuplicateCode(String code);
}
