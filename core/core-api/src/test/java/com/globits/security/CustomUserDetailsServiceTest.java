package com.globits.security;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.HashSet;
import com.globits.core.domain.Person;
import com.globits.core.utils.SecurityUtils;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.service.UserService;
import org.junit.Test;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.Assert.*;

public class CustomUserDetailsServiceTest {
    @Test public void detachedPrincipalPreservesAllAccountFlagsRolesAndProfileClasses() throws Exception {
        User entity = user(); entity.setAccountNonLocked(false); entity.setAccountNonExpired(false); entity.setCredentialsNonExpired(false);
        entity.setEnrollmentClassIds(new HashSet<Long>(Arrays.asList(7L, 9L)));
        Person person = new Person(); person.setFirstName("Test"); person.setEnrollmentClassId(7); entity.setPerson(person);
        Role role = new Role(); role.setName("ROLE_STUDENT"); entity.getRoles().add(role);
        entity.setAuthVersion("persisted-generation");
        User principal = (User) details(entity).loadUserByUsername("student");
        assertNotSame(entity, principal);
        assertFalse(principal.isAccountNonLocked()); assertFalse(principal.isAccountNonExpired()); assertFalse(principal.isCredentialsNonExpired());
        assertEquals(entity.getPassword(), principal.getPassword());
        assertEquals("persisted-generation", principal.getAuthVersion());
        assertEquals("ROLE_STUDENT", principal.getAuthorities().iterator().next().getAuthority());
        assertEquals(new HashSet<Long>(Arrays.asList(7L, 9L)), principal.getEnrollmentClassIds());
        assertEquals(Integer.valueOf(7), principal.getPerson().getEnrollmentClassId());
        entity.getEnrollmentClassIds().clear(); assertEquals(2, principal.getEnrollmentClassIds().size());
    }

    @Test public void passwordLoginRejectsEveryPersistedAccountRestriction() throws Exception {
        User user = user();
        assertTrue(provider(user).authenticate(new UsernamePasswordAuthenticationToken("student", "password")).isAuthenticated());
        user.setActive(false); expectRejected(provider(user), DisabledException.class);
        user.setActive(true); user.setAccountNonLocked(false); expectRejected(provider(user), LockedException.class);
        user.setAccountNonLocked(true); user.setAccountNonExpired(false); expectRejected(provider(user), AccountExpiredException.class);
        user.setAccountNonExpired(true); user.setCredentialsNonExpired(false); expectRejected(provider(user), CredentialsExpiredException.class);
    }

    @Test public void nullableStatusFlagsFailClosedWithoutNullPointerExceptions() {
        User user = new User(); user.setActive(null); user.setAccountNonExpired(null); user.setAccountNonLocked(null); user.setCredentialsNonExpired(null);
        assertFalse(user.isEnabled()); assertFalse(user.isAccountNonExpired()); assertFalse(user.isAccountNonLocked()); assertFalse(user.isCredentialsNonExpired());
    }

    private static User user() {
        User user = new User(); user.setId(11L); user.setUsername("student"); user.setPassword(SecurityUtils.getHashPassword("password")); return user;
    }
    private static CustomUserDetailsService details(User entity) throws Exception {
        UserService service = (UserService) Proxy.newProxyInstance(UserService.class.getClassLoader(), new Class[]{UserService.class}, (p, method, args) -> {
            if (method.getName().equals("findEntityByUsername")) return entity;
            throw new UnsupportedOperationException(method.toString());
        });
        CustomUserDetailsService details = new CustomUserDetailsService();
        Field field = CustomUserDetailsService.class.getDeclaredField("userService"); field.setAccessible(true); field.set(details, service); return details;
    }
    private static DaoAuthenticationProvider provider(User entity) throws Exception {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(); provider.setUserDetailsService(details(entity)); provider.setPasswordEncoder(new BCryptPasswordEncoder()); return provider;
    }
    private static void expectRejected(DaoAuthenticationProvider provider, Class<? extends AuthenticationException> expectedType) {
        try { provider.authenticate(new UsernamePasswordAuthenticationToken("student", "password")); fail("Restricted account was authenticated"); }
        catch (AuthenticationException error) { assertTrue(expectedType.getName(), expectedType.isInstance(error)); }
    }
}
