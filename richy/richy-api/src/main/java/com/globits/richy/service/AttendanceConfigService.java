package com.globits.richy.service;

import com.globits.richy.dto.AttendanceConfigDto;

public interface AttendanceConfigService {
    AttendanceConfigDto getConfig();
    AttendanceConfigDto saveConfig(AttendanceConfigDto config);
}
