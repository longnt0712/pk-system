package com.globits.security.service.impl;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import javax.persistence.EntityManager;
import javax.persistence.LockModeType;

import com.globits.core.utils.SecurityUtils;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.Assert.*;

public class UserPasswordSecurityTest {
    private final Map<Long, User> users = new HashMap<>();
    private final UserServiceImpl service = new UserServiceImpl();
    private Long lookedUpId;
    private LockModeType lastLock;
    private int saves;
    private Runnable refresh = () -> { };

    @Before public void setup() throws Exception {
        UserRepository repository = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class[]{UserRepository.class}, (p, method, args) -> {
                    if (method.getName().equals("findOne")) {
                        lookedUpId = (Long) args[0];
                        return users.get(lookedUpId);
                    }
                    if (method.getName().equals("save")) { saves++; return args[0]; }
                    throw new UnsupportedOperationException(method.toString());
                });
        EntityManager manager = (EntityManager) Proxy.newProxyInstance(
                EntityManager.class.getClassLoader(), new Class[]{EntityManager.class}, (p, method, args) -> {
                    if (method.getName().equals("refresh")) {
                        lastLock = args.length > 1 ? (LockModeType) args[1] : null;
                        refresh.run();
                        return null;
                    }
                    throw new UnsupportedOperationException(method.toString());
                });
        inject(service, "userRepository", repository);
        inject(service, "manager", manager);
        users.put(11L, user(11L, "student", "old-password"));
        users.put(22L, user(22L, "other", "other-password"));
        // A token contains a detached user and its earlier password snapshot.
        SecurityUtils.setCurrentUser(user(11L, "student", "old-password"));
    }

    @After public void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test public void selfChangeUsesPrincipalIdEvenWhenPayloadTargetsAnotherUser() {
        String otherHash = users.get(22L).getPassword();
        UserDto payload = password("old-password");
        payload.setId(22L);
        payload.setUsername("other");
        UserDto result = service.changeMyPassword(payload);
        assertEquals(Long.valueOf(11L), lookedUpId);
        assertEquals(Long.valueOf(11L), result.getId());
        assertTrue(SecurityUtils.passwordsMatch(users.get(11L).getPassword(), "new-password"));
        assertEquals(otherHash, users.get(22L).getPassword());
        assertEquals(LockModeType.PESSIMISTIC_WRITE, lastLock);
        assertEquals(1, saves);
    }

    @Test public void wrongOrMissingCurrentPasswordCannotChangeAnyPassword() {
        String hash = users.get(11L).getPassword();
        expectDenied(() -> service.changeMyPassword(password("wrong-password")));
        expectDenied(() -> service.changeMyPassword(password(null)));
        assertEquals(hash, users.get(11L).getPassword());
        assertEquals(0, saves);
    }

    @Test public void passwordCheckUsesFreshLockedDatabaseValueRatherThanTokenOrCachedEntity() {
        refresh = () -> users.get(11L).setPassword(SecurityUtils.getHashPassword("database-password"));
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        assertEquals(0, saves);
        service.changeMyPassword(password("database-password"));
        assertEquals(1, saves);
    }

    @Test public void sameOldPasswordCannotBeReusedAfterACompletedChange() {
        service.changeMyPassword(password("old-password"));
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        assertEquals(1, saves);
    }

    @Test public void selfChangeRetainsExistingDeviceGenerationOnlyWhenExplicitlyRequested() {
        User user = users.get(11L);
        String previousGeneration = user.getAuthVersion();
        UserDto payload = password("old-password"); payload.setLogoutAllDevices(false);
        service.changeMyPassword(payload);
        assertEquals(previousGeneration, user.getAuthVersion());
        assertTrue(SecurityUtils.passwordsMatch(user.getPassword(), "new-password"));
    }

    @Test public void retainingDeviceSessionsAlsoPreservesLegacyNullGeneration() {
        User user = users.get(11L); user.setAuthVersion(null);
        UserDto payload = password("old-password"); payload.setLogoutAllDevices(false);
        service.changeMyPassword(payload);
        assertNull(user.getAuthVersion());
        assertTrue(SecurityUtils.passwordsMatch(user.getPassword(), "new-password"));
    }

    @Test public void defaultCheckedAndNullLogoutOptionsInvalidateAllDeviceGenerations() {
        for (Boolean option : new Boolean[]{null, Boolean.TRUE}) {
            User user = user(11L, "student", "old-password"); users.put(11L, user);
            String previousGeneration = user.getAuthVersion();
            UserDto payload = password("old-password"); payload.setLogoutAllDevices(option);
            service.changeMyPassword(payload);
            assertNotEquals(previousGeneration, user.getAuthVersion());
        }
        User user = user(11L, "student", "old-password"); users.put(11L, user);
        String previousGeneration = user.getAuthVersion();
        service.changeMyPassword(password("old-password"));
        assertNotEquals(previousGeneration, user.getAuthVersion());
    }

    @Test public void retainingDeviceOptionDoesNotBypassCurrentPasswordVerification() {
        String previousGeneration = users.get(11L).getAuthVersion();
        UserDto payload = password("wrong-password"); payload.setLogoutAllDevices(false);
        expectDenied(() -> service.changeMyPassword(payload));
        assertEquals(previousGeneration, users.get(11L).getAuthVersion()); assertEquals(0, saves);
    }

    @Test public void disabledLockedExpiredAndCredentialExpiredUsersCannotChangePassword() {
        User current = users.get(11L);
        current.setActive(false);
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        current.setActive(true); current.setAccountNonLocked(false);
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        current.setAccountNonLocked(true); current.setAccountNonExpired(false);
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        current.setAccountNonExpired(true); current.setCredentialsNonExpired(false);
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        assertEquals(0, saves);
    }

    @Test public void missingAuthenticationAndDeletedAccountsAreDenied() {
        SecurityContextHolder.clearContext();
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        SecurityUtils.setCurrentUser(user(11L, "student", "old-password"));
        users.remove(11L);
        expectDenied(() -> service.changeMyPassword(password("old-password")));
    }

    @Test public void clientOnlyOrUnexpectedPrincipalCannotChangePasswords() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "oauth-client", "", java.util.Collections.emptyList()));
        expectDenied(() -> service.changeMyPassword(password("old-password")));
        assertFalse(service.passwordMatch(password("old-password")));
        assertEquals(0, saves);
    }

    @Test public void passwordValidationIgnoresSuppliedIdAndReadsFreshDatabasePassword() {
        UserDto payload = new UserDto(); payload.setId(22L); payload.setPassword("other-password");
        assertFalse(service.passwordMatch(payload));
        assertEquals(Long.valueOf(11L), lookedUpId);
        refresh = () -> users.get(11L).setPassword(SecurityUtils.getHashPassword("database-password"));
        payload.setPassword("old-password"); assertFalse(service.passwordMatch(payload));
        payload.setPassword("database-password"); assertTrue(service.passwordMatch(payload));
    }

    @Test public void adminResetIsSeparateAndDoesNotRequireTheUsersCurrentPassword() {
        User admin = user(99L, "admin", "admin-password");
        Role role = new Role(); role.setName("ROLE_ADMIN"); admin.getRoles().add(role);
        SecurityUtils.setCurrentUser(admin);
        UserDto payload = password(null); payload.setId(22L); payload.setLogoutAllDevices(false);
        String previousGeneration = users.get(22L).getAuthVersion();
        assertEquals(Long.valueOf(22L), service.changePassword(payload).getId());
        assertTrue(SecurityUtils.passwordsMatch(users.get(22L).getPassword(), "new-password"));
        assertEquals(LockModeType.PESSIMISTIC_WRITE, lastLock);
        assertNotEquals(previousGeneration, users.get(22L).getAuthVersion());
    }

    private static UserDto password(String current) {
        UserDto dto = new UserDto(); dto.setPassword("new-password"); dto.setCurrentPassword(current); return dto;
    }
    private static User user(Long id, String username, String password) {
        User user = new User(); user.setId(id); user.setUsername(username);
        user.setPassword(SecurityUtils.getHashPassword(password)); return user;
    }
    private static void expectDenied(Runnable operation) {
        try { operation.run(); fail("Password operation must be denied"); }
        catch (AccessDeniedException expected) { }
    }
    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name); field.setAccessible(true); field.set(target, value);
    }
}
