package com.globits.richy.service.impl;

import com.globits.richy.domain.School;
import com.globits.richy.dto.SchoolSiteThemeDto;
import com.globits.richy.dto.SiteThemeDto;
import com.globits.richy.service.SiteThemeService;
import java.util.*;
import javax.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SchoolSiteThemeService {
    @PersistenceContext private EntityManager em;
    @Autowired private SchoolAccess access;
    @Autowired private SiteThemeService legacy;

    private void requireAdmin() {
        if (!access.isAdmin()) { throw new AccessDeniedException("Chỉ admin được cấu hình giao diện theo trường."); }
    }
    private boolean valid(String theme) {
        return "NORMAL".equals(theme) || "HALLOWEEN".equals(theme) || "CHRISTMAS".equals(theme);
    }
    private String theme(School school) {
        if (valid(school.getSiteTheme())) { return school.getSiteTheme(); }
        return "ieltsroom.com".equals(school.getDomain()) ? legacy.getIeltsRoomTheme().getTheme() : "NORMAL";
    }
    @Transactional(readOnly = true)
    public SchoolSiteThemeDto forDomain(String value) {
        String domain = SchoolService.normalizeDomain(value);
        List<School> rows = em.createQuery("select s from School s where s.domain=:domain", School.class)
                .setParameter("domain", domain).getResultList();
        if (!rows.isEmpty() && rows.get(0).isActive()) { return new SchoolSiteThemeDto(rows.get(0), theme(rows.get(0))); }
        SchoolSiteThemeDto result = new SchoolSiteThemeDto();
        result.domain = domain; result.setTheme("NORMAL");
        // Preserve the original site until its School row has been registered.
        if (rows.isEmpty() && "ieltsroom.com".equals(domain)) {
            result.name = "IELTS Room"; result.configured = true; result.setTheme(legacy.getIeltsRoomTheme().getTheme());
        }
        return result;
    }
    @Secured("ROLE_ADMIN")
    @Transactional(readOnly = true)
    public List<SchoolSiteThemeDto> list() {
        requireAdmin();
        List<SchoolSiteThemeDto> result = new ArrayList<>();
        for (School school : em.createQuery("select s from School s where s.active=true order by s.id", School.class).getResultList()) {
            result.add(new SchoolSiteThemeDto(school, theme(school)));
        }
        return result;
    }
    @Secured("ROLE_ADMIN")
    public List<SchoolSiteThemeDto> save(String choice, List<Long> schoolIds) {
        requireAdmin();
        if (!valid(choice) || schoolIds == null || schoolIds.isEmpty() || schoolIds.size() > 100) {
            throw new IllegalArgumentException("Chọn giao diện và ít nhất một trường (tối đa 100 trường).");
        }
        SortedSet<Long> ids = new TreeSet<>();
        for (Long id : schoolIds) {
            if (id == null || id <= 0 || id > Integer.MAX_VALUE) { throw new IllegalArgumentException("School ID không hợp lệ."); }
            ids.add(id);
        }
        List<School> schools = new ArrayList<>();
        // Validate and lock all targets before changing any row. A rejected
        // target rolls back the entire selection, never a partial batch.
        for (Long id : ids) {
            School school = em.find(School.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (school == null || !school.isActive()) { throw new IllegalArgumentException("Trường không tồn tại hoặc đã ngừng hoạt động."); }
            schools.add(school);
        }
        List<SchoolSiteThemeDto> result = new ArrayList<>();
        for (School school : schools) {
            school.setSiteTheme(choice);
            if ("ieltsroom.com".equals(school.getDomain())) { legacy.saveIeltsRoomTheme(new SiteThemeDto(choice)); }
            result.add(new SchoolSiteThemeDto(school, choice));
        }
        em.flush();
        return result;
    }
}
