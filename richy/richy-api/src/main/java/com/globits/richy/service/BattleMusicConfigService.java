package com.globits.richy.service;

import com.globits.richy.dto.BattleMusicConfigDto;

public interface BattleMusicConfigService {
    BattleMusicConfigDto getActiveConfig();
    BattleMusicConfigDto getAdminConfig();
    BattleMusicConfigDto saveConfig(BattleMusicConfigDto dto);
}
