package com.globits.core.service;

import com.globits.core.domain.Discipline;
import com.globits.core.dto.DisciplineDto;

public interface DisciplineService extends GenericService<Discipline, Long> {
	DisciplineDto checkDuplicateCode(String code);
}