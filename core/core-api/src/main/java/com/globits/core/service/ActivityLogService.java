package com.globits.core.service;

import com.globits.core.domain.ActivityLog;
import com.globits.core.dto.ActivityLogDto;

public interface ActivityLogService extends GenericService<ActivityLog, Long> {
	public void saveActivityLog(ActivityLogDto dto);
}