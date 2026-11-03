package com.globits.richy.service.impl;

import com.globits.richy.domain.EducationProgram;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.domain.School;
import java.util.*;
import javax.persistence.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SchoolAccess {
    @PersistenceContext private EntityManager em;

    public static final String EDUCATION = "ROLE_EDUCATION_MANAGEMENT";
    public static final String STUDENTS = "ROLE_STUDENT_MANAGEMENT";

    public boolean isAdmin() {
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        return actor != null && actor.isAuthenticated() &&
            actor.getAuthorities().stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getAuthority()));
    }

    public Set<Long> schoolsFor(String... roles) {
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        Set<Long> ids = new LinkedHashSet<>();
        if (actor == null || !actor.isAuthenticated()) { return ids; }
        String sql = "select distinct a.school_id from dbo.tbl_school_user_role a"
            + " join dbo.tbl_user u on u.id=a.user_id join dbo.tbl_role r on r.id=a.role_id"
            + " join dbo.tbl_school s on s.id=a.school_id where u.username=:username and u.active=1"
            + " and s.active=1 and r.role_name in (:roles)";
        for (Object id : em.createNativeQuery(sql).setParameter("username", actor.getName())
                .unwrap(org.hibernate.query.NativeQuery.class).setParameterList("roles", Arrays.asList(roles)).list()) {
            ids.add(((Number) id).longValue());
        }
        return ids;
    }

    public void require(Long schoolId, String... roles) {
        if (isAdmin()) { return; }
        if (schoolId == null || !schoolsFor(roles).contains(schoolId)) {
            throw new AccessDeniedException("Bạn chưa có quyền ở School này.");
        }
    }

    public void requireProgram(Long programId, String... roles) {
        EducationProgram program = programId == null ? null : em.find(EducationProgram.class, programId);
        if (program == null) { throw new IllegalArgumentException("Chương trình đào tạo không hợp lệ."); }
        require(program.getSchoolId(), roles);
    }

    public void requireBoard(Integer classId, Long programId) {
        EnrolmentClass selected = classId == null ? null : em.find(EnrolmentClass.class, classId.longValue());
        EducationProgram program = programId == null ? null : em.find(EducationProgram.class, programId);
        if (selected == null || selected.getSchoolId() == null || program == null
                || !Objects.equals(selected.getSchoolId().longValue(), program.getSchoolId())) {
            throw new AccessDeniedException("Lớp và chương trình phải thuộc cùng School.");
        }
        require(program.getSchoolId(), EDUCATION, STUDENTS);
    }

    public List<Map<String,Object>> classes(Long schoolId) {
        require(schoolId, EDUCATION, STUDENTS);
        List<Map<String,Object>> result = new ArrayList<>();
        for (Object[] row : em.createQuery("select c.id,c.name,c.code,p.id from EnrolmentClass c left join c.parent p"
                + " where c.schoolId=:school order by c.id", Object[].class)
                .setParameter("school", schoolId.intValue()).getResultList()) {
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("id", row[0]); item.put("name", row[1]); item.put("code", row[2]);
            item.put("parentId", row[3]); item.put("schoolId", schoolId); result.add(item);
        }
        return result;
    }

    public void requireMark(Long id) {
        com.globits.richy.domain.StudentMark mark = id == null ? null : em.find(com.globits.richy.domain.StudentMark.class, id);
        if (mark == null || mark.getMark() == null || mark.getMark().getEducationProgram() == null) {
            throw new AccessDeniedException("Không tìm thấy điểm trong School.");
        }
        require(mark.getMark().getEducationProgram().getSchoolId(), EDUCATION, STUDENTS);
    }

    public Long columnProgram(Long id) {
        com.globits.richy.domain.Mark column = id == null ? null : em.find(com.globits.richy.domain.Mark.class, id);
        if (column == null || column.getEducationProgram() == null) {
            throw new IllegalArgumentException("Đầu điểm không thuộc chương trình hợp lệ.");
        }
        Long programId = column.getEducationProgram().getId();
        requireProgram(programId, EDUCATION);
        return programId;
    }

    public void requireMarkWrite(Integer classId, Long id, Long markId, Long userId) {
        com.globits.richy.domain.Mark column = markId == null ? null : em.find(com.globits.richy.domain.Mark.class, markId);
        com.globits.security.domain.User student = userId == null ? null : em.find(com.globits.security.domain.User.class, userId);
        if (column == null || column.getEducationProgram() == null || student == null || classId == null) {
            throw new AccessDeniedException("Chọn lớp, học sinh và đầu điểm hợp lệ.");
        }
        requireBoard(classId, column.getEducationProgram().getId());
        boolean member = student.getEnrollmentClassIds() != null && student.getEnrollmentClassIds().contains(classId.longValue())
            || student.getPerson() != null && classId.equals(student.getPerson().getEnrollmentClassId());
        if (!member) { throw new AccessDeniedException("Học sinh không thuộc lớp đã chọn."); }
        if (id != null) {
            com.globits.richy.domain.StudentMark saved = em.find(com.globits.richy.domain.StudentMark.class, id);
            if (saved == null || saved.getMark() == null || saved.getUser() == null
                    || !markId.equals(saved.getMark().getId()) || !userId.equals(saved.getUser().getId())) {
                throw new AccessDeniedException("Điểm đã lưu không khớp học sinh và đầu điểm.");
            }
        }
    }
}
