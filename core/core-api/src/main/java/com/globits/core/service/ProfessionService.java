package com.globits.core.service;

import com.globits.core.domain.Profession;
import com.globits.core.dto.ProfessionDto;

public interface ProfessionService extends GenericService<Profession, Long> {
	ProfessionDto checkDuplicateCode(String code);
}
