package com.globits.richy.tntt;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import java.util.Collections;
import java.util.List;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.globits.richy.domain.Mark;
import com.globits.richy.dto.DisplayStudentMarkDto;
import com.globits.richy.repository.MarkRepository;
import com.globits.richy.repository.StudentMarkRepository;
import com.globits.richy.service.impl.StudentMarkServiceImpl;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

public class StudentMarkClassScopeTest {
    private StudentMarkServiceImpl service;
    private EntityManager manager;
    private UserRepository users;
    private MarkRepository marks;
    private StudentMarkRepository studentMarks;

    @Before public void setup() {
        service = new StudentMarkServiceImpl();
        manager = mock(EntityManager.class);
        users = mock(UserRepository.class);
        marks = mock(MarkRepository.class);
        studentMarks = mock(StudentMarkRepository.class);
        ReflectionTestUtils.setField(service, "manager", manager);
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "markRepository", marks);
        ReflectionTestUtils.setField(service, "studentMarkRepository", studentMarks);
    }

    private DisplayStudentMarkDto scope(Integer classId, Long programId, Long groupId) {
        DisplayStudentMarkDto value = new DisplayStudentMarkDto();
        value.setEnrollmentClass(classId);
        value.setEducationProgramId(programId);
        value.setGroupId(groupId);
        return value;
    }

    private List<UserDto> student() {
        UserDto student = new UserDto();
        student.setId(100L);
        student.setUsername("class-student");
        return Collections.singletonList(student);
    }

    @Test public void missingClassOrProgramNeverQueriesStudentsOrGrades() {
        assertTrue(service.getListDisplayStudentMark(null).isEmpty());
        for (Integer classId : new Integer[]{null, 0, -1, 10}) {
            for (Long programId : new Long[]{null, 0L, -1L, 5L}) {
                if (Integer.valueOf(10).equals(classId) && Long.valueOf(5).equals(programId)) continue;
                for (Long groupId : new Long[]{null, 8L}) {
                    for (Long studentId : new Long[]{null, 100L}) {
                        DisplayStudentMarkDto request = scope(classId, programId, groupId);
                        request.setStudentUserId(studentId);
                        assertTrue(service.getListDisplayStudentMark(request).isEmpty());
                    }
                }
            }
        }
        verifyZeroInteractions(manager, users, marks, studentMarks);
    }

    @Test public void classBoardOnlyReadsTheSelectedClass() {
        when(users.getUsersDtoByEnrollmentClass(10)).thenReturn(student());
        when(marks.findMarkBy(5L)).thenReturn(Collections.<Mark>emptyList());
        List<DisplayStudentMarkDto> rows = service.getListDisplayStudentMark(scope(10, 5L, null));
        assertEquals(1, rows.size());
        assertEquals(Integer.valueOf(10), rows.get(0).getEnrollmentClass());
        assertEquals(Long.valueOf(100), rows.get(0).getUser().getId());
        verify(users).getUsersDtoByEnrollmentClass(10);
        verifyNoMoreInteractions(users);
        verifyZeroInteractions(manager, studentMarks);
    }

    @Test public void groupFilterKeepsTheClassRestriction() {
        when(users.getUsersDtoByEnrollmentClassAndGroupId(10, 8L)).thenReturn(student());
        when(marks.findMarkBy(5L)).thenReturn(Collections.<Mark>emptyList());
        List<DisplayStudentMarkDto> rows = service.getListDisplayStudentMark(scope(10, 5L, 8L));
        assertEquals(1, rows.size());
        assertEquals(Long.valueOf(8), rows.get(0).getGroupId());
        verify(users).getUsersDtoByEnrollmentClassAndGroupId(10, 8L);
        verifyNoMoreInteractions(users);
        verifyZeroInteractions(manager, studentMarks);
    }

    @Test public void targetedRowRefreshStillChecksPrimaryAndSecondaryClassMembership() {
        @SuppressWarnings("unchecked") TypedQuery<UserDto> rowQuery = mock(TypedQuery.class);
        when(manager.createQuery(anyString(), eq(UserDto.class))).thenReturn(rowQuery);
        when(rowQuery.setParameter(anyString(), anyObject())).thenReturn(rowQuery);
        when(rowQuery.getResultList()).thenReturn(student());
        when(marks.findMarkBy(5L)).thenReturn(Collections.<Mark>emptyList());
        DisplayStudentMarkDto request = scope(10, 5L, 8L);
        request.setStudentUserId(100L);
        assertEquals(1, service.getListDisplayStudentMark(request).size());
        verify(manager).createQuery(contains("u.person.enrollmentClassId = :classId or ec = :longClassId"), eq(UserDto.class));
        verify(rowQuery).setParameter("studentId", 100L);
        verify(rowQuery).setParameter("classId", 10);
        verify(rowQuery).setParameter("longClassId", 10L);
        verify(rowQuery).setParameter("groupId", 8L);
        verifyZeroInteractions(users, studentMarks);
    }
}
