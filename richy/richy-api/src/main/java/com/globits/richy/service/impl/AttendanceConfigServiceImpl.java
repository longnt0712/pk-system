package com.globits.richy.service.impl;

import com.globits.richy.attendance.AttendanceRules;
import com.globits.richy.domain.AttendanceConfig;
import com.globits.richy.dto.AttendanceConfigDto;
import com.globits.richy.repository.AttendanceConfigRepository;
import com.globits.richy.service.AttendanceConfigService;
import org.joda.time.DateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AttendanceConfigServiceImpl implements AttendanceConfigService {
    @Autowired
    private AttendanceConfigRepository repository;

    @Override
    @Transactional(readOnly = true)
    public AttendanceConfigDto getConfig() {
        return new AttendanceConfigDto(repository.findOne(1));
    }

    @Override
    public AttendanceConfigDto saveConfig(AttendanceConfigDto dto) {
        AttendanceRules.validate(dto);
        AttendanceConfig config = repository.findOne(1);
        if (config == null) { config = new AttendanceConfig(); }
        config.setMassStartTime(dto.getMassStartTime());
        config.setMassLateMinutes(dto.getMassLateMinutes());
        config.setMassAutoLate(dto.getMassAutoLate());
        config.setClassStartTime(dto.getClassStartTime());
        config.setClassLateMinutes(dto.getClassLateMinutes());
        config.setClassAutoLate(dto.getClassAutoLate());
        config.setQrSwitchTime(dto.getQrSwitchTime());
        Authentication user = SecurityContextHolder.getContext().getAuthentication();
        config.setModifiedBy(user == null ? "Unknown User" : user.getName());
        config.setModifyDate(DateTime.now(AttendanceRules.TIME_ZONE).toLocalDateTime());
        return new AttendanceConfigDto(repository.save(config));
    }
}
