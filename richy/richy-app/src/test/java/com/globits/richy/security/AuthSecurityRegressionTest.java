package com.globits.richy.security;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import javax.persistence.EntityManager;
import javax.sql.DataSource;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.core.utils.SecurityUtils;
import com.globits.richy.config.MethodSecurityConfig;
import com.globits.richy.config.OAuth2AuthorizationServerConfig;
import com.globits.richy.config.OAuth2ResourceServerConfig;
import com.globits.richy.config.WebSecurityConfig;
import com.globits.security.CustomUserDetailsService;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.filter.CorsFilter;
import com.globits.security.filter.JsonToUrlEncodedAuthenticationFilter;
import com.globits.security.repository.UserRepository;
import com.globits.security.rest.RestUserController;
import com.globits.security.rest.TokenController;
import com.globits.security.service.UserService;
import com.globits.security.service.impl.UserServiceImpl;
import com.globits.security.SessionAuthenticationKeyGenerator;
import com.globits.security.SessionTokenServices;
import com.globits.security.ValidatingTokenServices;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.datasource.init.DataSourceInitializer;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.common.DefaultOAuth2AccessToken;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.security.oauth2.common.ExpiringOAuth2RefreshToken;
import org.springframework.security.oauth2.common.exceptions.InvalidTokenException;
import org.springframework.security.oauth2.common.exceptions.InvalidGrantException;
import org.springframework.security.oauth2.config.annotation.configurers.ClientDetailsServiceConfigurer;
import org.springframework.security.oauth2.config.annotation.web.configuration.EnableAuthorizationServer;
import org.springframework.security.oauth2.provider.ClientDetailsService;
import org.springframework.security.oauth2.provider.OAuth2Authentication;
import org.springframework.security.oauth2.provider.OAuth2Request;
import org.springframework.security.oauth2.provider.TokenRequest;
import org.springframework.security.oauth2.provider.client.BaseClientDetails;
import org.springframework.security.oauth2.provider.client.InMemoryClientDetailsService;
import org.springframework.security.oauth2.provider.token.TokenStore;
import org.springframework.security.oauth2.provider.token.store.InMemoryTokenStore;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import static org.junit.Assert.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Real security filters, method security and controllers; only persistence is replaced. */
public class AuthSecurityRegressionTest {
    private static final String CLIENT = "security-test-client";
    private static final String SECRET = "security-test-secret";
    private static final String PASSWORD = "security-test-password";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Map<Long, User> USERS = new HashMap<>();
    private AnnotationConfigWebApplicationContext context;
    private MockMvc http;
    private SessionTokenServices tokens;
    private TokenStore store;

    @Configuration
    @EnableWebMvc
    @EnableTransactionManagement
    @Import({OAuth2ResourceServerConfig.class, WebSecurityConfig.class,
            MethodSecurityConfig.class, TestAuthorizationServer.class})
    public static class Config {
        @Bean public DataSource dataSource() {
            return (DataSource) Proxy.newProxyInstance(DataSource.class.getClassLoader(),
                    new Class<?>[]{DataSource.class}, (proxy, method, args) -> objectMethod(proxy, method, args));
        }
        @Bean public CorsFilter corsFilter() { return new CorsFilter(); }
        @Bean public JsonToUrlEncodedAuthenticationFilter jsonFilter() { return new JsonToUrlEncodedAuthenticationFilter(); }
        @Bean(name = "userService") public UserDetailsService details() { return new CustomUserDetailsService(); }
        @Bean public PlatformTransactionManager transactionManager() {
            return new AbstractPlatformTransactionManager() {
                @Override protected Object doGetTransaction() { return new Object(); }
                @Override protected void doBegin(Object transaction, TransactionDefinition definition) { }
                @Override protected void doCommit(DefaultTransactionStatus status) { }
                @Override protected void doRollback(DefaultTransactionStatus status) { }
            };
        }
        @Bean public UserRepository userRepository() {
            return (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(),
                    new Class<?>[]{UserRepository.class}, (proxy, method, args) -> {
                String name = method.getName();
                if ("findOne".equals(name) || "findById".equals(name)) { return USERS.get(args[0]); }
                if ("findByUsername".equals(name) || "findByUsernameAndPerson".equals(name)) {
                    for (User user : USERS.values()) {
                        if (user.getUsername().equals(args[0])) { return user; }
                    }
                    return null;
                }
                if ("save".equals(name)) { User user = (User) args[0]; USERS.put(user.getId(), user); return user; }
                return objectMethod(proxy, method, args);
            });
        }
        @Bean public UserService applicationUserService() throws Exception {
            final UserServiceImpl service = new UserServiceImpl();
            field(service, "userRepository", userRepository());
            field(service, "manager", Proxy.newProxyInstance(EntityManager.class.getClassLoader(),
                    new Class<?>[]{EntityManager.class}, (proxy, method, args) -> {
                if ("refresh".equals(method.getName())) { return null; }
                return objectMethod(proxy, method, args);
            }));
            return (UserService) Proxy.newProxyInstance(UserService.class.getClassLoader(),
                    new Class<?>[]{UserService.class}, (proxy, method, args) -> {
                if (method.getDeclaringClass() == Object.class) { return objectMethod(proxy, method, args); }
                try { return method.invoke(service, args); }
                catch (InvocationTargetException failure) { throw failure.getCause(); }
            });
        }
        @Bean public RestUserController usersController() { return new RestUserController(); }
        @Bean public TokenController tokenController() { return new TokenController(); }
        @Bean public TokenStore tokenStore() {
            InMemoryTokenStore value = new InMemoryTokenStore();
            value.setAuthenticationKeyGenerator(new SessionAuthenticationKeyGenerator());
            return value;
        }
        @Bean(name = "oauthClientDetailsService") public ClientDetailsService clients() {
            InMemoryClientDetailsService clients = new InMemoryClientDetailsService();
            BaseClientDetails client = new BaseClientDetails(CLIENT, null, "read,write", "password,refresh_token", null);
            client.setClientSecret(SECRET);
            client.setAccessTokenValiditySeconds(600);
            client.setRefreshTokenValiditySeconds(1200);
            BaseClientDetails other = new BaseClientDetails("other-client", null, "read", "refresh_token", null);
            other.setClientSecret("other-secret");
            Map<String, BaseClientDetails> values = new HashMap<>();
            values.put(CLIENT, client); values.put("other-client", other);
            clients.setClientDetailsStore(values);
            return clients;
        }
        @Bean @Primary public ValidatingTokenServices tokenServices(
                @Value("${security.auth.persistent-sessions:false}") boolean persistentSessions) {
            ValidatingTokenServices services = new ValidatingTokenServices(tokenStore(), details(), clients());
            services.setPersistentSessions(persistentSessions);
            return services;
        }
    }

    /** Uses production endpoint configuration with an in-memory client and no SQL initialization. */
    @Configuration
    @EnableAuthorizationServer
    public static class TestAuthorizationServer extends OAuth2AuthorizationServerConfig {
        @Override public void configure(ClientDetailsServiceConfigurer clients) throws Exception {
            clients.withClientDetails(new Config().clients());
        }
        @Bean @Override public DataSourceInitializer dataSourceInitializer(DataSource source) {
            DataSourceInitializer value = new DataSourceInitializer();
            value.setDataSource(source); value.setEnabled(false); return value;
        }
    }

    @Before public void setup() {
        ((ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME))
                .setLevel(ch.qos.logback.classic.Level.WARN);
        USERS.clear();
        USERS.put(11L, user(11L, "student", "ROLE_STUDENT"));
        USERS.put(22L, user(22L, "admin", "ROLE_ADMIN"));
        startContext(false);
    }

    private void startContext(boolean persistentSessions) {
        SecurityContextHolder.clearContext();
        if (context != null) { context.close(); }
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        Map<String, Object> properties = new HashMap<>();
        properties.put("endpoints.cors.allowed-headers", "Authorization,Content-Type");
        properties.put("endpoints.cors.allowed-methods", "GET,POST,PUT,DELETE,OPTIONS");
        properties.put("endpoints.cors.allowed-origins", "https://security-test.invalid");
        properties.put("endpoints.cors.allow-credentials", "false");
        properties.put("endpoints.cors.max-age", "60");
        properties.put("security.auth.persistent-sessions", persistentSessions);
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("security-test", properties));
        context.register(Config.class); context.refresh();
        tokens = context.getBean(SessionTokenServices.class);
        store = context.getBean(TokenStore.class);
        http = MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
    }

    @After public void cleanup() {
        SecurityContextHolder.clearContext();
        if (context != null) { context.close(); }
        USERS.clear();
    }

    @Test public void tokenEnumerationAndLegacyRefreshRevocationAreDenied() throws Exception {
        OAuth2AccessToken student = issue("student");
        OAuth2AccessToken admin = issue("admin");
        for (String bearer : Arrays.asList(null, student.getValue(), admin.getValue())) {
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request = get("/tokens/" + CLIENT);
            if (bearer != null) { request.header("Authorization", "Bearer " + bearer); }
            MvcResult result = http.perform(request).andReturn();
            assertTrue("Token enumeration must be unavailable", result.getResponse().getStatus() >= 400);
            assertFalse(result.getResponse().getContentAsString().contains(admin.getValue()));
        }
        MvcResult revoke = http.perform(post("/tokens/revokeRefreshToken/" + admin.getRefreshToken().getValue())
                .header("Authorization", "Bearer " + student.getValue())).andReturn();
        assertTrue(revoke.getResponse().getStatus() >= 400);
        assertNotNull(store.readRefreshToken(admin.getRefreshToken().getValue()));
    }

    @Test public void lookupAndCurrentUserNeverSerializeCredentialFields() throws Exception {
        OAuth2AccessToken student = issue("student");
        for (String path : Arrays.asList("/api/users?username=admin", "/api/users/22", "/api/users/getCurrentUser")) {
            MvcResult result = http.perform(get(path).header("Authorization", "Bearer " + student.getValue())).andReturn();
            assertEquals(200, result.getResponse().getStatus());
            JsonNode user = JSON.readTree(result.getResponse().getContentAsString());
            assertFalse("No password in " + path, user.has("password"));
            assertFalse("No confirmation in " + path, user.has("confirmPassword"));
            assertFalse("No current password in " + path, user.has("currentPassword"));
            assertFalse(result.getResponse().getContentAsString().contains(USERS.get(22L).getPassword()));
        }
    }

    @Test public void selfPasswordIgnoresAttackerControlledTargetAndRequiresFreshCurrentPassword() throws Exception {
        OAuth2AccessToken student = issue("student");
        String victimHash = USERS.get(22L).getPassword();
        String oldHash = USERS.get(11L).getPassword();
        for (String current : Arrays.asList("", "wrong")) {
            MvcResult denied = password(student, "{\"id\":22,\"username\":\"student\",\"password\":\"new-password\",\"currentPassword\":\"" + current + "\"}");
            assertEquals(403, denied.getResponse().getStatus());
            assertEquals(oldHash, USERS.get(11L).getPassword());
            assertEquals(victimHash, USERS.get(22L).getPassword());
        }
        MvcResult changed = password(student, "{\"id\":22,\"username\":\"admin\",\"password\":\"new-password\",\"currentPassword\":\"" + PASSWORD + "\"}");
        assertEquals(200, changed.getResponse().getStatus());
        assertTrue(SecurityUtils.passwordsMatch(USERS.get(11L).getPassword(), "new-password"));
        assertEquals(victimHash, USERS.get(22L).getPassword());
        assertEquals(401, currentUser(student).getResponse().getStatus());
        assertEquals(400, refresh(student).getResponse().getStatus());
    }

    @Test public void studentCannotUseAdministrativePasswordReset() throws Exception {
        OAuth2AccessToken student = issue("student");
        String victimHash = USERS.get(22L).getPassword();
        MvcResult result = http.perform(put("/api/users/password").header("Authorization", "Bearer " + student.getValue())
                .contentType("application/json").content("{\"id\":22,\"password\":\"changed\"}")).andReturn();
        assertEquals(403, result.getResponse().getStatus());
        assertEquals(victimHash, USERS.get(22L).getPassword());
    }

    @Test public void optionalPasswordLogoutRetainsBothPersistentDevicesUntilExplicitOrDefaultLogoutAll() throws Exception {
        for (String logoutAllOption : Arrays.asList(",\"logoutAllDevices\":true", "")) {
            USERS.put(11L, user(11L, "student", "ROLE_STUDENT"));
            startContext(true);
            OAuth2AccessToken first = issue("student"), second = issue("student");
            String originalVersion = USERS.get(11L).getAuthVersion();
            String originalHash = USERS.get(11L).getPassword();
            assertFalse(first.getRefreshToken() instanceof ExpiringOAuth2RefreshToken);
            assertEquals(200, password(first, "{\"password\":\"retained-password\",\"currentPassword\":\"" + PASSWORD
                    + "\",\"logoutAllDevices\":false}").getResponse().getStatus());
            assertEquals(originalVersion, USERS.get(11L).getAuthVersion());
            assertNotEquals(originalHash, USERS.get(11L).getPassword());
            assertEquals(200, currentUser(first).getResponse().getStatus());
            assertEquals(200, currentUser(second).getResponse().getStatus());
            assertEquals("false", http.perform(post("/api/users/password/valid")
                    .header("Authorization", "Bearer " + first.getValue()).contentType("application/json")
                    .content("{\"password\":\"" + PASSWORD + "\"}")).andReturn().getResponse().getContentAsString());
            assertEquals("true", http.perform(post("/api/users/password/valid")
                    .header("Authorization", "Bearer " + first.getValue()).contentType("application/json")
                    .content("{\"password\":\"retained-password\"}")).andReturn().getResponse().getContentAsString());

            // Both persisted token snapshots still contain the old hash. Only
            // the unchanged security generation permits these refreshes.
            OAuth2AccessToken firstRenewed = successfulRefresh(first);
            OAuth2AccessToken secondRenewed = successfulRefresh(second);
            assertEquals(200, currentUser(firstRenewed).getResponse().getStatus());
            assertEquals(200, currentUser(secondRenewed).getResponse().getStatus());
            assertEquals(200, password(firstRenewed,
                    "{\"password\":\"next-password\",\"currentPassword\":\"retained-password\""
                            + logoutAllOption + "}").getResponse().getStatus());
            assertNotEquals(originalVersion, USERS.get(11L).getAuthVersion());
            for (OAuth2AccessToken revoked : Arrays.asList(firstRenewed, secondRenewed)) {
                assertEquals(401, currentUser(revoked).getResponse().getStatus());
                assertEquals(400, refresh(revoked).getResponse().getStatus());
            }
        }
    }

    @Test public void adminPasswordResetAlwaysRevokesBothDevicesEvenWhenLogoutOptionIsFalse() throws Exception {
        startContext(true);
        OAuth2AccessToken first = issue("student"), second = issue("student"), admin = issue("admin");
        String originalVersion = USERS.get(11L).getAuthVersion();
        MvcResult result = http.perform(put("/api/users/password").header("Authorization", "Bearer " + admin.getValue())
                .contentType("application/json")
                .content("{\"id\":11,\"password\":\"admin-reset-password\",\"logoutAllDevices\":false}")).andReturn();
        assertEquals(200, result.getResponse().getStatus());
        assertNotEquals(originalVersion, USERS.get(11L).getAuthVersion());
        for (OAuth2AccessToken revoked : Arrays.asList(first, second)) {
            assertEquals(401, currentUser(revoked).getResponse().getStatus());
            assertEquals(400, refresh(revoked).getResponse().getStatus());
        }
        assertEquals(200, currentUser(admin).getResponse().getStatus());
    }

    @Test public void persistentPasswordLoginReturnsFiniteAccessAndRestoresAfterAccessExpires() throws Exception {
        startContext(true);
        MvcResult login = login("student");
        assertEquals(200, login.getResponse().getStatus());
        JsonNode response = JSON.readTree(login.getResponse().getContentAsString());
        assertTrue(response.get("persistent_session").asBoolean());
        assertFalse(response.has("refresh_token_expires_at"));
        assertTrue(response.get("expires_in").asInt() > 590 && response.get("expires_in").asInt() <= 600);
        OAuth2AccessToken access = store.readAccessToken(response.get("access_token").asText());
        assertFalse(access.getRefreshToken() instanceof ExpiringOAuth2RefreshToken);
        ((DefaultOAuth2AccessToken) access).setExpiration(new java.util.Date(System.currentTimeMillis() - 1000));
        assertEquals(401, currentUser(access).getResponse().getStatus());
        OAuth2AccessToken renewed = successfulRefresh(access);
        assertEquals(access.getRefreshToken().getValue(), renewed.getRefreshToken().getValue());
        assertEquals(Boolean.TRUE, renewed.getAdditionalInformation().get("persistent_session"));
        assertEquals(200, currentUser(renewed).getResponse().getStatus());
    }

    @Test public void passwordLoginUsesConfiguredLifetimeAndRefreshMetadata() throws Exception {
        MvcResult result = login("student");
        assertEquals(200, result.getResponse().getStatus());
        JsonNode response = JSON.readTree(result.getResponse().getContentAsString());
        assertTrue(response.get("expires_in").asInt() <= 600);
        assertTrue(response.get("expires_in").asInt() >= 590);
        assertTrue(response.get("refresh_token_expires_at").asLong() > System.currentTimeMillis() + 1190000L);
        assertTrue(response.get("refresh_token_expires_at").asLong() <= System.currentTimeMillis() + 1201000L);
    }

    @Test public void persistedAccountFlagsBlockFreshPasswordLogin() throws Exception {
        User student = USERS.get(11L);
        student.setActive(false); assertEquals(400, login("student").getResponse().getStatus()); student.setActive(true);
        student.setAccountNonLocked(false); assertEquals(400, login("student").getResponse().getStatus()); student.setAccountNonLocked(true);
        student.setAccountNonExpired(false); assertEquals(400, login("student").getResponse().getStatus()); student.setAccountNonExpired(true);
        student.setCredentialsNonExpired(false); assertEquals(400, login("student").getResponse().getStatus()); student.setCredentialsNonExpired(true);
        assertEquals(200, login("student").getResponse().getStatus());
    }

    @Test public void liveAccountChangesRejectBothAccessAndRefresh() throws Exception {
        for (String change : Arrays.asList("disabled", "locked", "expired", "credentials", "password", "roles", "deleted", "identity")) {
            USERS.put(11L, user(11L, "student", "ROLE_STUDENT"));
            OAuth2AccessToken access = issue("student");
            User student = USERS.get(11L);
            if ("disabled".equals(change)) { student.setActive(false); }
            if ("locked".equals(change)) { student.setAccountNonLocked(false); }
            if ("expired".equals(change)) { student.setAccountNonExpired(false); }
            if ("credentials".equals(change)) { student.setCredentialsNonExpired(false); }
            if ("password".equals(change)) { student.setPassword(SecurityUtils.getHashPassword("different-password")); }
            if ("roles".equals(change)) { student.getRoles().clear(); }
            if ("deleted".equals(change)) { USERS.remove(11L); }
            if ("identity".equals(change)) { USERS.put(11L, user(33L, "student", "ROLE_STUDENT")); }
            assertEquals("Access after " + change, 401, currentUser(access).getResponse().getStatus());
            assertEquals("Refresh after " + change, 400, refresh(access).getResponse().getStatus());
        }
    }

    @Test public void legacyTokensAreRejectedAndFreshSessionsAreIndependent() throws Exception {
        DefaultOAuth2AccessToken legacy = new DefaultOAuth2AccessToken("synthetic-legacy-access");
        store.storeAccessToken(legacy, authentication("student"));
        assertEquals(401, currentUser(legacy).getResponse().getStatus());
        OAuth2AccessToken first = issue("student");
        OAuth2AccessToken second = issue("student");
        assertNotEquals(first.getValue(), second.getValue());
        assertNotEquals(first.getRefreshToken().getValue(), second.getRefreshToken().getValue());
        assertEquals(200, currentUser(first).getResponse().getStatus());
        assertEquals(200, currentUser(second).getResponse().getStatus());
        assertEquals(200, revoke(first.getRefreshToken().getValue(), CLIENT, SECRET).getResponse().getStatus());
        assertEquals(401, currentUser(first).getResponse().getStatus());
        assertEquals(400, refresh(first).getResponse().getStatus());
        assertEquals(200, currentUser(second).getResponse().getStatus());
    }

    @Test public void revokeNeedsMatchingClientAndAcceptsExpiredAccessSession() throws Exception {
        OAuth2AccessToken access = issue("student");
        MvcResult wrongSecret = revoke(access.getRefreshToken().getValue(), CLIENT, "wrong");
        assertTrue(wrongSecret.getResponse().getStatus() >= 400);
        MvcResult wrongClient = revoke(access.getRefreshToken().getValue(), "other-client", "other-secret");
        assertTrue(wrongClient.getResponse().getStatus() == 200 || wrongClient.getResponse().getStatus() >= 400);
        assertEquals(200, currentUser(access).getResponse().getStatus());
        ((DefaultOAuth2AccessToken) access).setExpiration(new java.util.Date(System.currentTimeMillis() - 1000));
        assertEquals(200, revoke(access.getRefreshToken().getValue(), CLIENT, SECRET).getResponse().getStatus());
        assertNull(store.readRefreshToken(access.getRefreshToken().getValue()));
        assertEquals(400, refresh(access).getResponse().getStatus());
        assertEquals(200, revoke("unknown-synthetic-token", CLIENT, SECRET).getResponse().getStatus());
    }

    @Test public void concurrentRefreshInAnotherProcessCannotRestoreARevokedSession() throws Exception {
        concurrentRefreshCannotRestoreRevokedSession(false);
        concurrentRefreshCannotRestoreRevokedSession(true);
    }

    private void concurrentRefreshCannotRestoreRevokedSession(boolean persistentSessions) throws Exception {
        BlockingTokenStore sharedStore = new BlockingTokenStore();
        sharedStore.setAuthenticationKeyGenerator(new SessionAuthenticationKeyGenerator());
        UserDetailsService users = (UserDetailsService) context.getBean("userService");
        ClientDetailsService clients = (ClientDetailsService) context.getBean("oauthClientDetailsService");
        // Separate instances deliberately have independent locks, as on two backend processes.
        ValidatingTokenServices refresher = new ValidatingTokenServices(sharedStore, users, clients);
        ValidatingTokenServices revoker = new ValidatingTokenServices(sharedStore, users, clients);
        refresher.setPersistentSessions(persistentSessions);
        revoker.setPersistentSessions(persistentSessions);
        OAuth2AccessToken original = refresher.createAccessToken(authentication("student"));
        assertEquals(persistentSessions, !(original.getRefreshToken() instanceof ExpiringOAuth2RefreshToken));
        sharedStore.blockWrites = true;
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Future<OAuth2AccessToken> pending = executor.submit(() -> refresher.refreshAccessToken(
                original.getRefreshToken().getValue(), new TokenRequest(Collections.<String, String>emptyMap(), CLIENT, null, "refresh_token")));
        try {
            assertTrue("Refresh should reach the controlled write", sharedStore.writeStarted.await(5, TimeUnit.SECONDS));
            assertTrue(revoker.revokeForClient(original.getRefreshToken().getValue(), CLIENT));
            sharedStore.continueWrite.countDown();
            OAuth2AccessToken racing = null;
            try { racing = pending.get(5, TimeUnit.SECONDS); }
            catch (ExecutionException error) { assertTrue(error.getCause() instanceof InvalidGrantException); }
            assertNull(sharedStore.readRefreshToken(original.getRefreshToken().getValue()));
            if (racing != null) {
                try { revoker.loadAuthentication(racing.getValue()); fail("Racing access token must be unusable"); }
                catch (InvalidTokenException expected) { }
            }
            try {
                revoker.refreshAccessToken(original.getRefreshToken().getValue(),
                        new TokenRequest(Collections.<String, String>emptyMap(), CLIENT, null, "refresh_token"));
                fail("Revoked refresh must remain unusable");
            } catch (InvalidGrantException expected) { }
        } finally {
            sharedStore.continueWrite.countDown(); executor.shutdownNow();
        }
    }

    private static class BlockingTokenStore extends InMemoryTokenStore {
        final CountDownLatch writeStarted = new CountDownLatch(1);
        final CountDownLatch continueWrite = new CountDownLatch(1);
        volatile boolean blockWrites;
        @Override public void storeAccessToken(OAuth2AccessToken access, OAuth2Authentication authentication) {
            if (blockWrites) {
                writeStarted.countDown();
                try {
                    if (!continueWrite.await(5, TimeUnit.SECONDS)) { throw new IllegalStateException("Test write timed out"); }
                } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
            }
            super.storeAccessToken(access, authentication);
        }
    }

    private OAuth2AccessToken issue(String username) { return tokens.createAccessToken(authentication(username)); }
    private OAuth2Authentication authentication(String username) {
        User principal = (User) ((UserDetailsService) context.getBean("userService")).loadUserByUsername(username);
        OAuth2Request request = new OAuth2Request(Collections.<String, String>emptyMap(), CLIENT, null, true,
                new HashSet<>(Arrays.asList("read", "write")), null, null, null, null);
        return new OAuth2Authentication(request,
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
    private MvcResult currentUser(OAuth2AccessToken access) throws Exception {
        return http.perform(get("/api/users/getCurrentUser").header("Authorization", "Bearer " + access.getValue())).andReturn();
    }
    private MvcResult password(OAuth2AccessToken access, String body) throws Exception {
        return http.perform(put("/api/users/password/self").header("Authorization", "Bearer " + access.getValue())
                .contentType("application/json").content(body)).andReturn();
    }
    private MvcResult login(String username) throws Exception {
        return http.perform(post("/oauth/token").param("grant_type", "password").param("client_id", CLIENT)
                .param("client_secret", SECRET).param("username", username).param("password", PASSWORD)).andReturn();
    }
    private MvcResult refresh(OAuth2AccessToken access) throws Exception {
        return http.perform(post("/oauth/token").param("grant_type", "refresh_token").param("client_id", CLIENT)
                .param("client_secret", SECRET).param("refresh_token", access.getRefreshToken().getValue())).andReturn();
    }
    private OAuth2AccessToken successfulRefresh(OAuth2AccessToken access) throws Exception {
        MvcResult result = refresh(access);
        assertEquals(200, result.getResponse().getStatus());
        return store.readAccessToken(JSON.readTree(result.getResponse().getContentAsString()).get("access_token").asText());
    }
    private MvcResult revoke(String value, String client, String secret) throws Exception {
        return http.perform(post("/oauth/revoke").contentType("application/x-www-form-urlencoded")
                .param("token", value).param("client_id", client).param("client_secret", secret)).andReturn();
    }
    private static User user(long id, String username, String roleName) {
        User user = new User(); user.setId(id); user.setUsername(username); user.setActive(true);
        user.setPassword(SecurityUtils.getHashPassword(PASSWORD));
        Role role = new Role(); role.setName(roleName); user.getRoles().add(role); return user;
    }
    private static void field(Object value, String name, Object data) throws Exception {
        java.lang.reflect.Field field = value.getClass().getDeclaredField(name); field.setAccessible(true); field.set(value, data);
    }
    private static Object objectMethod(Object proxy, Method method, Object[] args) {
        if ("toString".equals(method.getName())) { return "security-test-fixture"; }
        if ("hashCode".equals(method.getName())) { return System.identityHashCode(proxy); }
        if ("equals".equals(method.getName())) { return proxy == args[0]; }
        throw new UnsupportedOperationException("No database access in security tests: " + method);
    }
}
