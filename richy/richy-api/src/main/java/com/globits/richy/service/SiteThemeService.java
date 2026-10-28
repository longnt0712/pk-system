package com.globits.richy.service;

import com.globits.richy.dto.SiteThemeDto;

public interface SiteThemeService {
    SiteThemeDto getIeltsRoomTheme();
    SiteThemeDto saveIeltsRoomTheme(SiteThemeDto config);
}
