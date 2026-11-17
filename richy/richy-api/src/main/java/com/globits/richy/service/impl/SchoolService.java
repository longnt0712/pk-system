package com.globits.richy.service.impl;

import com.globits.richy.domain.School;
import com.globits.richy.dto.SchoolDto;
import java.util.*;
import javax.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SchoolService {
    @PersistenceContext private EntityManager em;
    @org.springframework.beans.factory.annotation.Autowired private SchoolAccess access;

    public static String normalizeDomain(String value) {
        String domain = value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        if (domain.endsWith(".")) { domain = domain.substring(0, domain.length() - 1); }
        if (domain.length() > 253 || !domain.matches("[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*")) {
            throw new IllegalArgumentException("Nhập tên miền hợp lệ, không kèm https://, đường dẫn hoặc cổng.");
        }
        for (String label : domain.split("\\.")) {
            if (label.length() > 63) { throw new IllegalArgumentException("Tên miền không hợp lệ."); }
        }
        return domain;
    }

    @Transactional(readOnly = true)
    public List<SchoolDto> list() {
        List<SchoolDto> rows = new ArrayList<>();
        boolean admin = access.isAdmin();
        Set<Long> allowed = admin ? Collections.emptySet() : access.schoolsFor(SchoolAccess.EDUCATION, SchoolAccess.STUDENTS);
        for (School school : em.createQuery("select s from School s order by s.id", School.class).getResultList()) {
            if (admin || allowed.contains(school.getId())) { rows.add(new SchoolDto(school)); }
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public SchoolDto current(String domain) {
        List<School> rows = em.createQuery("select s from School s where s.domain=:domain and s.active=true", School.class)
            .setParameter("domain", normalizeDomain(domain)).getResultList();
        return rows.isEmpty() ? null : new SchoolDto(rows.get(0));
    }

    public SchoolDto save(SchoolDto request) {
        if (request == null || request.name == null || request.name.trim().isEmpty() || request.name.trim().length() > 255) {
            throw new IllegalArgumentException("Tên trường cần từ 1 đến 255 ký tự.");
        }
        String domain = normalizeDomain(request.domain);
        School school = request.id == null ? new School() : em.find(School.class, request.id, LockModeType.PESSIMISTIC_WRITE);
        if (school == null || request.id != null && (request.id <= 0 || request.id > Integer.MAX_VALUE)) {
            throw new IllegalArgumentException("Không tìm thấy School.");
        }
        List<Long> duplicates = em.createQuery("select s.id from School s where s.domain=:domain", Long.class).setParameter("domain", domain).getResultList();
        if (!duplicates.isEmpty() && !duplicates.get(0).equals(request.id)) {
            throw new IllegalArgumentException("Tên miền đã thuộc một School khác.");
        }
        school.setName(request.name.trim()); school.setDomain(domain);
        school.setActive(request.active); school.setShowAttendance(request.showAttendance);
        if (school.getId() == null) { em.persist(school); }
        em.flush();
        return new SchoolDto(school);
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> roles() {
        List<Map<String,Object>> rows = new ArrayList<>();
        List<?> roles = em.createNativeQuery("select id,role_name from dbo.tbl_role where role_name in (:education,:students) order by role_name")
            .setParameter("education", SchoolAccess.EDUCATION).setParameter("students", SchoolAccess.STUDENTS).getResultList();
        for (Object value : roles) {
            Object[] row = (Object[]) value;
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("id", ((Number) row[0]).longValue());
            item.put("name", row[1]);
            rows.add(item);
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public List<Long> allowedRoleIds(Long schoolId) {
        List<Long> result = new ArrayList<>();
        for (Object id : em.createNativeQuery("select role_id from dbo.tbl_school_role where school_id=:school order by role_id")
                .setParameter("school", schoolId).getResultList()) {
            result.add(((Number) id).longValue());
        }
        return result;
    }

    public List<Long> setAllowedRoles(Long schoolId, List<Long> roleIds) {
        if (roleIds == null || em.find(School.class, schoolId, LockModeType.PESSIMISTIC_WRITE) == null) {
            throw new IllegalArgumentException("Chọn School và gửi danh sách role.");
        }
        Set<Long> valid = new HashSet<>();
        for (Map<String,Object> role : roles()) { valid.add((Long) role.get("id")); }
        if (!valid.containsAll(roleIds)) {
            throw new IllegalArgumentException("Có role không áp dụng cho quyền theo School.");
        }
        Set<Long> selected = new TreeSet<>(roleIds);
        em.createNativeQuery("delete from dbo.tbl_school_role where school_id=:school")
            .setParameter("school", schoolId).executeUpdate();
        for (Long roleId : selected) {
            em.createNativeQuery("insert into dbo.tbl_school_role(school_id,role_id) values(:school,:role)")
                .setParameter("school", schoolId).setParameter("role", roleId).executeUpdate();
        }
        return new ArrayList<>(selected);
    }
}
