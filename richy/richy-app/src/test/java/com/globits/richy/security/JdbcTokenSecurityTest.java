package com.globits.richy.security;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Date;
import java.util.UUID;
import java.lang.reflect.Proxy;
import javax.sql.DataSource;

import com.globits.core.utils.SecurityUtils;
import com.globits.security.CustomUserDetailsService;
import com.globits.security.SessionTokenServices;
import com.globits.security.ValidatingTokenServices;
import com.globits.security.SessionAuthenticationKeyGenerator;
import com.globits.security.config.TokenSecurityConfig;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.service.UserService;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.security.oauth2.common.DefaultOAuth2AccessToken;
import org.springframework.security.oauth2.common.ExpiringOAuth2RefreshToken;
import org.springframework.security.oauth2.provider.ClientDetailsService;
import org.springframework.security.oauth2.common.exceptions.InvalidGrantException;
import org.springframework.security.oauth2.common.exceptions.InvalidTokenException;
import org.springframework.security.oauth2.provider.OAuth2Authentication;
import org.springframework.security.oauth2.provider.OAuth2Request;
import org.springframework.security.oauth2.provider.TokenRequest;
import org.springframework.security.oauth2.provider.token.TokenStore;
import org.springframework.security.oauth2.provider.token.store.JdbcTokenStore;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import static org.junit.Assert.*;

/** The production shared bean configuration with a real, isolated JDBC token database. */
public class JdbcTokenSecurityTest {
    private static User current;
    private AnnotationConfigApplicationContext context;
    private SessionTokenServices services;
    private TokenStore store;

    @Configuration
    @EnableTransactionManagement
    @Import(TokenSecurityConfig.class)
    public static class Config {
        @Bean public DataSource dataSource() {
            DriverManagerDataSource source = new DriverManagerDataSource(
                    "jdbc:h2:mem:auth-security-" + UUID.randomUUID().toString() + ";DB_CLOSE_DELAY=-1", "sa", "");
            source.setDriverClassName("org.h2.Driver");
            JdbcTemplate sql = new JdbcTemplate(source);
            sql.execute("create table oauth_access_token (authentication_id varchar(255) primary key, authentication blob, client_id varchar(255), refresh_token varchar(255), token blob, token_id varchar(255), user_name varchar(255))");
            sql.execute("create table oauth_refresh_token (token_id varchar(255) primary key, token blob, authentication blob)");
            sql.execute("create table oauth_client_details (client_id varchar(255) primary key, resource_ids varchar(255), client_secret varchar(255), scope varchar(255), authorized_grant_types varchar(255), web_server_redirect_uri varchar(255), authorities varchar(255), access_token_validity integer, refresh_token_validity integer, additional_information varchar(4096), autoapprove varchar(255))");
            sql.update("insert into oauth_client_details(client_id,client_secret,scope,authorized_grant_types,access_token_validity,refresh_token_validity) values(?,?,?,?,?,?)",
                    "jdbc-test-client", "jdbc-test-secret", "read,write", "password,refresh_token", 90, 180);
            return source;
        }
        @Bean public PlatformTransactionManager transactionManager(DataSource source) {
            return new DataSourceTransactionManager(source);
        }
        @Bean(name = "userService") public UserDetailsService userDetails() {
            return new CustomUserDetailsService();
        }
        @Bean public UserService applicationUserService() {
            return (UserService) Proxy.newProxyInstance(UserService.class.getClassLoader(), new Class<?>[]{UserService.class},
                    (proxy, method, args) -> {
                if ("findEntityByUsername".equals(method.getName())) {
                    return current != null && current.getUsername().equals(args[0]) ? current : null;
                }
                if ("toString".equals(method.getName())) { return "synthetic-jdbc-user-service"; }
                if ("hashCode".equals(method.getName())) { return System.identityHashCode(proxy); }
                if ("equals".equals(method.getName())) { return proxy == args[0]; }
                throw new UnsupportedOperationException("No application DB access in security tests");
            });
        }
    }

    @Before public void setup() {
        ((ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME))
                .setLevel(ch.qos.logback.classic.Level.WARN);
        current = new User(); current.setId(7L); current.setUsername("jdbc-student"); current.setActive(true);
        current.setPassword(SecurityUtils.getHashPassword("synthetic-jdbc-password"));
        Role role = new Role(); role.setName("ROLE_STUDENT"); current.getRoles().add(role);
        startContext(false);
    }

    private void startContext(boolean persistent) {
        if (context != null) { context.close(); }
        context = new AnnotationConfigApplicationContext();
        Map<String, Object> properties = new HashMap<>();
        properties.put("security.auth.persistent-sessions", persistent);
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("session-policy-test", properties));
        context.register(Config.class);
        context.refresh();
        services = context.getBean(SessionTokenServices.class);
        store = context.getBean(TokenStore.class);
    }

    @After public void cleanup() { if (context != null) { context.close(); } current = null; }

    @Test public void productionBeansUseJdbcAndKeepIndependentSessions() {
        assertTrue(store instanceof JdbcTokenStore);
        assertEquals(1, context.getBeansOfType(SessionTokenServices.class).size());
        OAuth2AccessToken first = services.createAccessToken(authentication());
        OAuth2AccessToken second = services.createAccessToken(authentication());
        assertNotEquals(first.getValue(), second.getValue());
        assertNotEquals(first.getRefreshToken().getValue(), second.getRefreshToken().getValue());
        assertNotNull(services.loadAuthentication(first.getValue()));
        assertNotNull(services.loadAuthentication(second.getValue()));
        assertEquals(2, new JdbcTemplate(context.getBean(DataSource.class)).queryForObject("select count(*) from oauth_access_token", Integer.class).intValue());
        assertTrue(services.revokeForClient(first.getRefreshToken().getValue(), "jdbc-test-client"));
        denied(() -> services.loadAuthentication(first.getValue()));
        assertNotNull(services.loadAuthentication(second.getValue()));
    }

    @Test public void jdbcClientLifetimesAndSerializedSnapshotAreApplied() {
        OAuth2AccessToken access = services.createAccessToken(authentication());
        long now = System.currentTimeMillis();
        assertTrue(access.getExpiration().getTime() >= now + 88000L);
        assertTrue(access.getExpiration().getTime() <= now + 91000L);
        long refreshExpiry = ((Number) access.getAdditionalInformation().get("refresh_token_expires_at")).longValue();
        assertTrue(refreshExpiry >= now + 178000L);
        assertTrue(refreshExpiry <= now + 181000L);
        OAuth2Authentication persisted = store.readAuthentication(access);
        assertNotSame(current, persisted.getPrincipal());
        current.getRoles().clear();
        assertFalse(persisted.getAuthorities().isEmpty());
        denied(() -> services.loadAuthentication(access.getValue()));
        try { services.refreshAccessToken(access.getRefreshToken().getValue(), request()); fail("Stale JDBC authority must not refresh"); }
        catch (InvalidGrantException expected) { }
    }

    @Test public void persistentProductionSessionsSurviveJdbcReloadAndExpiredAccessWithoutOutlivingRevocation() {
        startContext(true);
        OAuth2AccessToken first = services.createAccessToken(authentication());
        OAuth2AccessToken otherDevice = services.createAccessToken(authentication());
        assertEquals(Boolean.TRUE, first.getAdditionalInformation().get("persistent_session"));
        assertFalse(first.getAdditionalInformation().containsKey("refresh_token_expires_at"));
        assertFalse(first.getRefreshToken() instanceof ExpiringOAuth2RefreshToken);
        assertFalse(store.readRefreshToken(first.getRefreshToken().getValue()) instanceof ExpiringOAuth2RefreshToken);
        assertTrue(first.getExpiresIn() > 85 && first.getExpiresIn() <= 90);

        // Reload the serialized JDBC rows through an independent service/store,
        // as a restarted backend would, without rewriting the refresh row.
        JdbcTokenStore restartedStore = new JdbcTokenStore(context.getBean(DataSource.class));
        restartedStore.setAuthenticationKeyGenerator(new SessionAuthenticationKeyGenerator());
        ValidatingTokenServices restarted = new ValidatingTokenServices(restartedStore,
                (UserDetailsService) context.getBean("userService"), context.getBean(ClientDetailsService.class));
        restarted.setPersistentSessions(true);
        assertNotNull(restarted.loadAuthentication(first.getValue()));
        DefaultOAuth2AccessToken expired = new DefaultOAuth2AccessToken(first);
        expired.setExpiration(new Date(System.currentTimeMillis() - 1000));
        restartedStore.storeAccessToken(expired, restartedStore.readAuthentication(first));
        denied(() -> restarted.loadAuthentication(first.getValue()));
        OAuth2AccessToken renewed = restarted.refreshAccessToken(first.getRefreshToken().getValue(), request());
        assertEquals(first.getRefreshToken().getValue(), renewed.getRefreshToken().getValue());
        assertEquals(Boolean.TRUE, renewed.getAdditionalInformation().get("persistent_session"));
        assertFalse(renewed.getRefreshToken() instanceof ExpiringOAuth2RefreshToken);
        assertTrue(renewed.getExpiresIn() > 85 && renewed.getExpiresIn() <= 90);
        assertNotNull(restarted.loadAuthentication(renewed.getValue()));
        assertEquals(2, new JdbcTemplate(context.getBean(DataSource.class))
                .queryForObject("select count(*) from oauth_refresh_token", Integer.class).intValue());
        assertTrue(restarted.revokeForClient(renewed.getRefreshToken().getValue(), "jdbc-test-client"));
        denied(() -> services.loadAuthentication(renewed.getValue()));
        assertNotNull(services.loadAuthentication(otherDevice.getValue()));
    }

    @Test public void callerCannotOptIntoPersistenceWhenServerFeatureIsDisabled() {
        OAuth2Authentication supplied = authentication();
        supplied.getOAuth2Request().getExtensions().put("auth_persistent", Boolean.TRUE);
        OAuth2AccessToken finite = services.createAccessToken(supplied);
        assertTrue(finite.getRefreshToken() instanceof ExpiringOAuth2RefreshToken);
        assertFalse(finite.getAdditionalInformation().containsKey("persistent_session"));
        assertFalse(store.readAuthentication(finite).getOAuth2Request().getExtensions().containsKey("auth_persistent"));
    }

    @Test public void enablingPersistenceDoesNotRewriteOrExtendAnExistingFiniteRefresh() {
        OAuth2AccessToken finite = services.createAccessToken(authentication());
        long expiry = ((Number) finite.getAdditionalInformation().get("refresh_token_expires_at")).longValue();
        ValidatingTokenServices enabled = new ValidatingTokenServices(store,
                (UserDetailsService) context.getBean("userService"), context.getBean(ClientDetailsService.class));
        enabled.setPersistentSessions(true);
        OAuth2AccessToken renewed = enabled.refreshAccessToken(finite.getRefreshToken().getValue(), request());
        assertEquals(finite.getRefreshToken().getValue(), renewed.getRefreshToken().getValue());
        assertTrue(renewed.getRefreshToken() instanceof ExpiringOAuth2RefreshToken);
        assertEquals(expiry, ((Number) renewed.getAdditionalInformation().get("refresh_token_expires_at")).longValue());
        assertFalse(renewed.getAdditionalInformation().containsKey("persistent_session"));
    }

    @Test public void accessNeverOutlivesRefreshDeadline() {
        JdbcTemplate sql = new JdbcTemplate(context.getBean(DataSource.class));
        // A client can configure a longer access lifetime than refresh lifetime.
        sql.update("update oauth_client_details set access_token_validity=600, refresh_token_validity=5 where client_id=?", "jdbc-test-client");
        OAuth2AccessToken access = services.createAccessToken(authentication());
        long refreshExpiry = ((Number) access.getAdditionalInformation().get("refresh_token_expires_at")).longValue();
        assertTrue(access.getExpiration().getTime() <= refreshExpiry);
        assertTrue(access.getExpiresIn() <= 5);
        OAuth2AccessToken refreshed = services.refreshAccessToken(access.getRefreshToken().getValue(), request());
        assertEquals(refreshExpiry, ((Number) refreshed.getAdditionalInformation().get("refresh_token_expires_at")).longValue());
        assertTrue(refreshed.getExpiration().getTime() <= refreshExpiry);
    }

    @Test public void restoringAccountOrRoleDoesNotRestoreDormantJdbcSessions() {
        OAuth2AccessToken beforeDisable = services.createAccessToken(authentication());
        current.setActive(false);
        current.setActive(true);
        // No authentication was attempted between disable and reenable.
        denied(() -> services.loadAuthentication(beforeDisable.getValue()));
        try { services.refreshAccessToken(beforeDisable.getRefreshToken().getValue(), request()); fail("Restored account must not restore old refresh"); }
        catch (InvalidGrantException expected) { }
        OAuth2AccessToken beforeRoles = services.createAccessToken(authentication());
        Role student = new Role(); student.setName("ROLE_STUDENT");
        current.replaceRoles(Collections.<Role>emptySet());
        current.replaceRoles(Collections.singleton(student));
        denied(() -> services.loadAuthentication(beforeRoles.getValue()));
        OAuth2AccessToken after = services.createAccessToken(authentication());
        assertNotNull(services.loadAuthentication(after.getValue()));
    }

    @Test public void missingUserRefreshCommitsRevocationDespiteNestedReadOnlyTransaction() {
        OAuth2AccessToken access = services.createAccessToken(authentication());
        User saved = current;
        current = null;
        try { services.refreshAccessToken(access.getRefreshToken().getValue(), request()); fail("Deleted user must not refresh"); }
        catch (InvalidGrantException expected) { }
        // The nested, transactional user lookup must not roll back the refresh-row deletion.
        assertNull(store.readRefreshToken(access.getRefreshToken().getValue()));
        current = saved;
        denied(() -> services.loadAuthentication(access.getValue()));
        try { services.refreshAccessToken(access.getRefreshToken().getValue(), request()); fail("Restoring user must not restore rejected refresh"); }
        catch (InvalidGrantException expected) { }
        assertNotNull(services.loadAuthentication(services.createAccessToken(authentication()).getValue()));
    }

    @Test public void nonPositiveClientLifetimesNeverIssuePermanentCredentials() {
        JdbcTemplate sql = new JdbcTemplate(context.getBean(DataSource.class));
        for (String column : Arrays.asList("access_token_validity", "refresh_token_validity")) {
            for (int invalid : Arrays.asList(0, -1)) {
                sql.update("update oauth_client_details set access_token_validity=90, refresh_token_validity=180 where client_id=?", "jdbc-test-client");
                // Column names come only from the fixed list above, never from external data.
                sql.update("update oauth_client_details set " + column + "=? where client_id=?", invalid, "jdbc-test-client");
                try { services.createAccessToken(authentication()); fail("Nonpositive " + column + " must fail closed"); }
                catch (InvalidGrantException expected) { }
                assertEquals(0, sql.queryForObject("select count(*) from oauth_access_token", Integer.class).intValue());
                assertEquals(0, sql.queryForObject("select count(*) from oauth_refresh_token", Integer.class).intValue());
            }
        }
    }

    @Test public void validatedRequestsUseCurrentProfileAndMembershipWithoutEndingSession() {
        current.setEnrollmentClassIds(new HashSet<>(Arrays.asList(1L)));
        OAuth2AccessToken access = services.createAccessToken(authentication());
        String version = current.getAuthVersion();
        current.setEnrollmentClassIds(new HashSet<>(Arrays.asList(2L, 3L)));
        current.setEmail("updated-synthetic-email@example.invalid");
        assertEquals(version, current.getAuthVersion());
        OAuth2Authentication loaded = services.loadAuthentication(access.getValue());
        User principal = (User) loaded.getPrincipal();
        assertEquals(new HashSet<>(Arrays.asList(2L, 3L)), principal.getEnrollmentClassIds());
        assertEquals("updated-synthetic-email@example.invalid", principal.getEmail());
        assertEquals(store.readAuthentication(access).getOAuth2Request().getExtensions(), loaded.getOAuth2Request().getExtensions());
        OAuth2AccessToken refreshed = services.refreshAccessToken(access.getRefreshToken().getValue(), request());
        User afterRefresh = (User) services.loadAuthentication(refreshed.getValue()).getPrincipal();
        assertEquals(principal.getEnrollmentClassIds(), afterRefresh.getEnrollmentClassIds());
    }

    private OAuth2Authentication authentication() {
        User principal = (User) ((UserDetailsService) context.getBean("userService")).loadUserByUsername(current.getUsername());
        OAuth2Request request = new OAuth2Request(Collections.<String, String>emptyMap(), "jdbc-test-client", null, true,
                new HashSet<>(Arrays.asList("read", "write")), null, null, null, null);
        return new OAuth2Authentication(request,
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
    private TokenRequest request() {
        return new TokenRequest(Collections.<String, String>emptyMap(), "jdbc-test-client", null, "refresh_token");
    }
    private void denied(Runnable operation) {
        try { operation.run(); fail("Revoked/stale JDBC authentication should fail"); }
        catch (InvalidTokenException expected) { }
    }
}
