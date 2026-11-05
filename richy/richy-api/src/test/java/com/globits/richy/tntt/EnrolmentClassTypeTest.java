package com.globits.richy.tntt;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.Matchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.dto.EnrolmentClassDto;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.service.impl.EnrolmentClassServiceImpl;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

public class EnrolmentClassTypeTest {
    private EnrolmentClassServiceImpl service;
    private EnrolmentClassRepository classes;

    @Before
    public void setUp() {
        classes = mock(EnrolmentClassRepository.class);
        UserRepository users = mock(UserRepository.class);
        service = new EnrolmentClassServiceImpl();
        ReflectionTestUtils.setField(service, "enrolmentClassRepository", classes);
        ReflectionTestUtils.setField(service, "userRepository", users);

        User admin = new User();
        admin.setId(1L);
        admin.setUsername("admin");
        Role role = new Role();
        role.setName("ROLE_ADMIN");
        admin.setRoles(Collections.singleton(role));
        when(users.findByUsername("admin")).thenReturn(admin);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null));
    }

    @After
    public void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    public void createAndEditKeepTheStoredTypeIncludingRequestsFromOlderClients() {
        EnrolmentClass[] saved = new EnrolmentClass[1];
        when(classes.save(any(EnrolmentClass.class))).thenAnswer(call -> {
            EnrolmentClass value = (EnrolmentClass) call.getArguments()[0];
            value.setId(10L);
            saved[0] = value;
            return value;
        });

        EnrolmentClassDto request = new EnrolmentClassDto();
        request.setName("Lop moi");
        request.setSchoolId(2);
        request.setStaffClass(true);
        assertTrue(service.saveObject(request));
        assertEquals(Boolean.TRUE, saved[0].getStaffClass());

        when(classes.findOne(10L)).thenReturn(saved[0]);
        when(classes.findAll()).thenReturn(Collections.singletonList(saved[0]));
        request.setId(10L);
        request.setStaffClass(null);
        assertTrue(service.saveObject(request));
        assertEquals(Boolean.TRUE, service.getTreeObjects(2).get(0).getStaffClass());

        request.setStaffClass(false);
        assertTrue(service.saveObject(request));
        assertEquals(Boolean.FALSE, service.getTreeObjects(2).get(0).getStaffClass());
    }

    @Test
    public void teamsInheritTheirRootTypeAndLegacyClassesDefaultToStudent() {
        EnrolmentClass staff = classRow(10L, null);
        staff.setStaffClass(true);
        EnrolmentClass team = classRow(11L, staff);
        EnrolmentClass nested = classRow(12L, team);
        EnrolmentClass legacy = classRow(20L, null);
        when(classes.findAll()).thenReturn(Arrays.asList(staff, team, nested, legacy));

        assertTypes(service.getTreeObjects(2), true);
        staff.setStaffClass(false);
        assertTypes(service.getTreeObjects(2), false);
    }

    private static void assertTypes(List<EnrolmentClassDto> tree, boolean staffType) {
        Map<Long, Boolean> types = tree.stream().collect(
                Collectors.toMap(EnrolmentClassDto::getId, EnrolmentClassDto::getStaffClass));
        assertEquals(4, types.size());
        for (long id : new long[]{10, 11, 12}) {
            assertEquals(Boolean.valueOf(staffType), types.get(id));
        }
        assertEquals(Boolean.FALSE, types.get(20L));
    }

    private static EnrolmentClass classRow(long id, EnrolmentClass parent) {
        EnrolmentClass value = new EnrolmentClass();
        value.setId(id);
        value.setSchoolId(2);
        value.setName("Lop " + id);
        value.setParent(parent);
        return value;
    }
}
