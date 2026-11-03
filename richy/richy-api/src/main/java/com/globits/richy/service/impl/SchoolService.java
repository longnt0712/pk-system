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
        Set<Long> allowed = access.schoolsFor(SchoolAccess.EDUCATION, SchoolAccess.STUDENTS);
        for (School school : em.createQuery("select s from School s order by s.id", School.class).getResultList()) {
            if (access.isAdmin() || allowed.contains(school.getId())) { rows.add(new SchoolDto(school)); }
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
        for (Object[] row : em.createQuery("select r.id,r.name from Role r order by r.name", Object[].class).getResultList()) {
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("id", row[0]); item.put("name", row[1]); rows.add(item);
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public Map<String,List<Long>> assignments(Long schoolId) {
        Map<String,List<Long>> result = new LinkedHashMap<>();
        String sql = "select u.username,a.role_id from dbo.tbl_school_user_role a join dbo.tbl_user u on u.id=a.user_id"
            + " where a.school_id=:school order by u.username,a.role_id";
        for (Object value : em.createNativeQuery(sql).setParameter("school", schoolId).getResultList()) {
            Object[] row = (Object[]) value;
            result.computeIfAbsent((String) row[0], key -> new ArrayList<>()).add(((Number) row[1]).longValue());
        }
        return result;
    }

    public Map<String,List<Long>> setRoles(Long schoolId, String username, List<Long> roles) {
        if (em.find(School.class, schoolId, LockModeType.PESSIMISTIC_WRITE) == null
                || username == null || username.trim().isEmpty() || roles == null) {
            throw new IllegalArgumentException("Chọn School, tài khoản và quyền.");
        }
        List<Long> users = em.createQuery("select u.id from User u where u.username=:username", Long.class)
            .setParameter("username", username.trim()).getResultList();
        if (users.size() != 1) { throw new IllegalArgumentException("Không tìm thấy tài khoản."); }
        Set<Long> selected = new LinkedHashSet<>(roles);
        for (Long roleId : selected) {
            if (roleId == null || em.find(com.globits.security.domain.Role.class, roleId) == null) {
                throw new IllegalArgumentException("Role không hợp lệ.");
            }
        }
        Long userId = users.get(0);
        em.createNativeQuery("delete from dbo.tbl_school_user_role where school_id=:school and user_id=:account")
            .setParameter("school", schoolId).setParameter("account", userId).executeUpdate();
        for (Long roleId : selected) {
            em.createNativeQuery("insert into dbo.tbl_school_user_role(school_id,user_id,role_id) values(:school,:account,:role)")
                .setParameter("school", schoolId).setParameter("account", userId).setParameter("role", roleId).executeUpdate();
        }
        return assignments(schoolId);
    }
}
