package com.globits.core.service;

import com.globits.core.domain.DegreeStudent;
import com.globits.core.dto.DegreeStudentDto;

public interface DegreeStudentService extends GenericService<DegreeStudent, Long> {
	DegreeStudentDto checkDuplicateCode(String code);
}