package com.globits.core.service;

import com.globits.core.domain.Status;
import com.globits.core.dto.StatusDto;

public interface StatusService extends GenericService<Status, Long> {
	StatusDto checkDuplicateCode(String code);
}