package com.globits.security.service.impl;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.Collections;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.RoleDto;
import com.globits.security.repository.RoleRepository;
import com.globits.security.repository.UserRepository;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

public class RoleSessionInvalidationTest {
    private final RoleServiceImpl service = new RoleServiceImpl();
    private final Role role = new Role();
    private final User assigned = new User();
    private final User unrelated = new User();
    private int userSaves;
    private boolean flushed;
    private boolean deleted;

    @Before public void setup() throws Exception {
        role.setId(7L); role.setName("ROLE_STUDENT");
        assigned.replaceRoles(Arrays.asList(role)); assigned.setAuthVersion("original-generation");
        unrelated.setAuthVersion("unrelated-generation");
        RoleRepository roles = (RoleRepository) Proxy.newProxyInstance(RoleRepository.class.getClassLoader(), new Class[]{RoleRepository.class}, (p, method, args) -> {
            if (method.getName().equals("findOne") || method.getName().equals("getOne")) return role;
            if (method.getName().equals("save")) return args[0];
            if (method.getName().equals("delete")) { assertTrue(flushed); deleted = true; return null; }
            throw new UnsupportedOperationException(method.toString());
        });
        UserRepository users = (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(), new Class[]{UserRepository.class}, (p, method, args) -> {
            if (method.getName().equals("findByRoleId")) return Long.valueOf(7L).equals(args[0]) ? Arrays.asList(assigned) : Collections.emptyList();
            if (method.getName().equals("save")) { userSaves++; return args[0]; }
            if (method.getName().equals("flush")) { flushed = true; return null; }
            throw new UnsupportedOperationException(method.toString());
        });
        inject(service, "roleRepository", roles); inject(service, "userRepository", users);
    }

    @Test public void renamingAndRestoringAssignedRolePermanentlyChangesUserGeneration() {
        service.updateRole(dto("ROLE_VIEWER"), 7L); String renamed = assigned.getAuthVersion();
        service.updateRole(dto("ROLE_STUDENT"), 7L);
        assertNotEquals("original-generation", renamed);
        assertNotEquals("original-generation", assigned.getAuthVersion());
        assertNotEquals(renamed, assigned.getAuthVersion()); assertEquals(2, userSaves);
        assertEquals("unrelated-generation", unrelated.getAuthVersion());
    }

    @Test public void descriptionOnlyOrSameNameUpdatesDoNotInvalidateUsers() {
        RoleDto description = dto("ROLE_STUDENT"); description.setDescription("New description");
        service.updateRole(description, 7L);
        service.updateRole(dto(null), 7L);
        assertEquals("original-generation", assigned.getAuthVersion()); assertEquals(0, userSaves);
    }

    @Test public void postUpdatingExistingRoleAlsoInvalidatesAssignedUsers() {
        RoleDto update = dto("ROLE_VIEWER"); update.setId(7L);
        service.createRole(update);
        assertNotEquals("original-generation", assigned.getAuthVersion()); assertEquals(1, userSaves);
    }

    @Test public void roleDeletionRemovesAssignmentsAndInvalidatesOnlyAffectedUsers() {
        assertSame(role, service.delete(7L));
        assertTrue(deleted); assertTrue(assigned.getRoles().isEmpty()); assertEquals(1, userSaves);
        assertNotEquals("original-generation", assigned.getAuthVersion());
        assertEquals("unrelated-generation", unrelated.getAuthVersion());
    }

    private static RoleDto dto(String name) { RoleDto dto = new RoleDto(); dto.setName(name); return dto; }
    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name); field.setAccessible(true); field.set(target, value);
    }
}
