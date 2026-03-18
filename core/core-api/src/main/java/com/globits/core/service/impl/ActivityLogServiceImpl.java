package com.globits.core.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.ActivityLog;
import com.globits.core.dto.ActivityLogDto;
import com.globits.core.repository.ActivityLogRepository;
import com.globits.core.service.ActivityLogService;

@Transactional
@Service
public class ActivityLogServiceImpl extends GenericServiceImpl<ActivityLog, Long> implements ActivityLogService {

	@Autowired
	ActivityLogRepository activityLogRepository;

	@Override
	public void saveActivityLog(ActivityLogDto dto) {
		ActivityLog entity = dto.toEntity();
		activityLogRepository.save(entity);
	}
}
