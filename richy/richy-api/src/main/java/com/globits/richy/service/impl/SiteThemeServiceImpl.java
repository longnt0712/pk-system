package com.globits.richy.service.impl;

import com.globits.richy.domain.SiteTheme;
import com.globits.richy.dto.SiteThemeDto;
import com.globits.richy.repository.SiteThemeRepository;
import com.globits.richy.service.SiteThemeService;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SiteThemeServiceImpl implements SiteThemeService {
    private static final String IELTS_ROOM_DOMAIN = "ieltsroom.com";
    @Autowired
    private SiteThemeRepository repository;

    @Override
    @Transactional(readOnly = true)
    public SiteThemeDto getIeltsRoomTheme() {
        SiteTheme config = repository.findOne(IELTS_ROOM_DOMAIN);
        return new SiteThemeDto(config == null ? "HALLOWEEN" : config.getTheme());
    }

    @Override
    @Secured("ROLE_ADMIN")
    public SiteThemeDto saveIeltsRoomTheme(SiteThemeDto dto) {
        Authentication admin = requireAdmin();
        if (dto == null || !("NORMAL".equals(dto.getTheme()) || "HALLOWEEN".equals(dto.getTheme()))) {
            throw new IllegalArgumentException("Giao diện phải là NORMAL hoặc HALLOWEEN.");
        }
        SiteTheme config = repository.findOne(IELTS_ROOM_DOMAIN);
        if (config == null) { config = new SiteTheme(); }
        config.setTheme(dto.getTheme());
        String username = admin.getName();
        config.setModifiedBy(username == null ? "admin" : username.substring(0, Math.min(255, username.length())));
        config.setModifyDate(LocalDateTime.now());
        return new SiteThemeDto(repository.saveAndFlush(config).getTheme());
    }

    private Authentication requireAdmin() {
        Authentication user = SecurityContextHolder.getContext().getAuthentication();
        if (user != null && user.isAuthenticated() && user.getAuthorities() != null) {
            for (GrantedAuthority role : user.getAuthorities()) {
                if (role != null && "ROLE_ADMIN".equals(role.getAuthority())) { return user; }
            }
        }
        throw new AccessDeniedException("Chỉ admin có thể đổi giao diện dùng chung.");
    }
}
