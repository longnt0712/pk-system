package com.globits.security;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.security.oauth2.common.OAuth2RefreshToken;
import org.springframework.security.oauth2.common.exceptions.InvalidGrantException;
import org.springframework.security.oauth2.common.exceptions.InvalidTokenException;
import org.springframework.security.oauth2.provider.ClientDetailsService;
import org.springframework.security.oauth2.provider.OAuth2Authentication;
import org.springframework.security.oauth2.provider.OAuth2Request;
import org.springframework.security.oauth2.provider.TokenRequest;
import org.springframework.security.oauth2.provider.token.DefaultTokenServices;
import org.springframework.security.oauth2.provider.token.TokenStore;
import org.springframework.transaction.annotation.Transactional;

import com.globits.security.domain.User;

/**
 * JDBC authentication is a snapshot. Never authorize a request using that snapshot
 * until its account, credentials and authorities have been checked against the DB.
 */
public class ValidatingTokenServices extends DefaultTokenServices implements SessionTokenServices {
    public static final String SESSION_ID = "auth_session_id";
    private static final String POLICY = "auth_policy";
    private static final String POLICY_VERSION = "2";
    private final TokenStore store;
    private final UserDetailsService users;
    // Bounded locks serialize refresh/logout in one process without retaining secrets.
    private final Object[] sessionLocks = new Object[128];

    public ValidatingTokenServices(TokenStore store, UserDetailsService users, ClientDetailsService clients) {
        this.store = Objects.requireNonNull(store, "tokenStore");
        this.users = Objects.requireNonNull(users, "userDetailsService");
        setTokenStore(store);
        setClientDetailsService(Objects.requireNonNull(clients, "clientDetailsService"));
        setSupportRefreshToken(true);
        // Reuse is intentional: deleting the refresh row is a durable revocation
        // fence even when another process is completing a concurrent refresh.
        setReuseRefreshToken(true);
        setAccessTokenValiditySeconds(86400);
        setRefreshTokenValiditySeconds(30 * 24 * 60 * 60);
        setTokenEnhancer(new CustomTokenEnhancer());
        for (int i = 0; i < sessionLocks.length; i++) { sessionLocks[i] = new Object(); }
    }

    @Override
    @Transactional
    public OAuth2AccessToken createAccessToken(OAuth2Authentication authentication) {
        OAuth2Request request = authentication.getOAuth2Request();
        Map<String, Serializable> extensions = new HashMap<>(request.getExtensions());
        extensions.put(POLICY, POLICY_VERSION);
        extensions.put(SESSION_ID, UUID.randomUUID().toString());
        OAuth2Request sessionRequest = new OAuth2Request(request.getRequestParameters(), request.getClientId(),
                request.getAuthorities(), request.isApproved(), request.getScope(), request.getResourceIds(),
                request.getRedirectUri(), request.getResponseTypes(), extensions);
        OAuth2Authentication session = new OAuth2Authentication(sessionRequest, authentication.getUserAuthentication());
        session.setDetails(authentication.getDetails());
        validate(session);
        return super.createAccessToken(session);
    }

    @Override
    public OAuth2Authentication loadAuthentication(String value) {
        OAuth2AccessToken access = null;
        try {
            OAuth2Authentication authentication = super.loadAuthentication(value);
            access = store.readAccessToken(value);
            if (access == null) { throw invalidToken(); }
            User current = validate(authentication);
            OAuth2RefreshToken refresh = access.getRefreshToken();
            if (refresh != null && store.readRefreshToken(refresh.getValue()) == null) {
                store.removeAccessToken(access);
                throw invalidToken();
            }
            // Business services also read class/profile scope from the principal.
            // Keep those fields current without signing users out on profile edits.
            UsernamePasswordAuthenticationToken currentUser = new UsernamePasswordAuthenticationToken(
                    current, null, current.getAuthorities());
            currentUser.setDetails(authentication.getUserAuthentication().getDetails());
            OAuth2Authentication live = new OAuth2Authentication(authentication.getOAuth2Request(), currentUser);
            live.setDetails(authentication.getDetails());
            return live;
        } catch (InvalidTokenException ex) {
            if (access != null) { revokeToken(value); }
            // Never echo a submitted bearer value in an API error response.
            throw invalidToken();
        }
    }

    @Override
    @Transactional(noRollbackFor = {InvalidTokenException.class, InvalidGrantException.class})
    public OAuth2AccessToken refreshAccessToken(String value, TokenRequest request) {
        if (value == null || value.isEmpty()) { throw invalidGrant(); }
        synchronized (lock(value)) {
            OAuth2RefreshToken refresh = store.readRefreshToken(value);
            if (refresh == null) { throw invalidGrant(); }
            OAuth2Authentication authentication = store.readAuthenticationForRefreshToken(refresh);
            if (authentication == null || !Objects.equals(request.getClientId(), authentication.getOAuth2Request().getClientId())) {
                throw invalidGrant();
            }
            try {
                validate(authentication);
                return super.refreshAccessToken(value, request);
            } catch (InvalidTokenException | InvalidGrantException ex) {
                // A rejected security snapshot must not become usable again if
                // an account is subsequently unlocked or its role is restored.
                revokeRefresh(refresh);
                throw invalidGrant();
            }
        }
    }

    /** Possession of this token only revokes its own session and its own client. */
    @Transactional
    public boolean revokeForClient(String value, String clientId) {
        if (value == null || value.isEmpty()) { return false; }
        OAuth2RefreshToken refresh = store.readRefreshToken(value);
        if (refresh != null) {
            synchronized (lock(value)) {
                OAuth2Authentication authentication = store.readAuthenticationForRefreshToken(refresh);
                if (!belongsTo(authentication, clientId)) { return false; }
                revokeRefresh(refresh);
                return true;
            }
        }
        OAuth2AccessToken access = store.readAccessToken(value);
        if (access == null || !belongsTo(store.readAuthentication(access), clientId)) { return false; }
        return revokeToken(value);
    }

    @Override
    @Transactional
    public boolean revokeToken(String value) {
        OAuth2AccessToken access = store.readAccessToken(value);
        if (access == null) { return false; }
        OAuth2RefreshToken refresh = access.getRefreshToken();
        synchronized (lock(refresh == null ? value : refresh.getValue())) {
            if (refresh != null) { revokeRefresh(refresh); }
            store.removeAccessToken(access);
            return true;
        }
    }

    private void revokeRefresh(OAuth2RefreshToken refresh) {
        // Remove the refresh row first. loadAuthentication checks this row as
        // well, so a racing refresh cannot make a revoked session usable again.
        store.removeRefreshToken(refresh);
        store.removeAccessTokenUsingRefreshToken(refresh);
    }

    private User validate(OAuth2Authentication authentication) {
        if (authentication == null || !POLICY_VERSION.equals(authentication.getOAuth2Request().getExtensions().get(POLICY))
                || !(authentication.getOAuth2Request().getExtensions().get(SESSION_ID) instanceof String)) {
            throw invalidToken();
        }
        // This application issues user sessions, not client-credentials sessions.
        if (authentication.isClientOnly() || !(authentication.getPrincipal() instanceof User)) { throw invalidToken(); }
        User stored = (User) authentication.getPrincipal();
        UserDetails current;
        try {
            current = users.loadUserByUsername(stored.getUsername());
        } catch (UsernameNotFoundException ex) {
            throw invalidToken();
        }
        if (!(current instanceof User) || !current.isEnabled() || !current.isAccountNonLocked()
                || !current.isAccountNonExpired() || !current.isCredentialsNonExpired()
                || !Objects.equals(stored.getId(), ((User) current).getId())
                || !Objects.equals(stored.getAuthVersion(), ((User) current).getAuthVersion())
                || !sameSecret(stored.getPassword(), current.getPassword())
                || !authorities(authentication.getAuthorities()).equals(authorities(current.getAuthorities()))) {
            throw invalidToken();
        }
        return (User) current;
    }

    private boolean belongsTo(OAuth2Authentication authentication, String clientId) {
        return authentication != null && clientId != null
                && clientId.equals(authentication.getOAuth2Request().getClientId());
    }

    private Object lock(String value) {
        return sessionLocks[(value.hashCode() & Integer.MAX_VALUE) % sessionLocks.length];
    }

    @Override
    protected int getAccessTokenValiditySeconds(OAuth2Request request) {
        int seconds = super.getAccessTokenValiditySeconds(request);
        if (seconds <= 0) { throw new InvalidGrantException("Access token lifetime must be positive"); }
        return seconds;
    }

    @Override
    protected int getRefreshTokenValiditySeconds(OAuth2Request request) {
        int seconds = super.getRefreshTokenValiditySeconds(request);
        if (seconds <= 0) { throw new InvalidGrantException("Refresh token lifetime must be positive"); }
        return seconds;
    }

    public static boolean sameSecret(String left, String right) {
        return left != null && right != null && MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8),
                right.getBytes(StandardCharsets.UTF_8));
    }

    private Set<String> authorities(Iterable<? extends GrantedAuthority> values) {
        Set<String> names = new TreeSet<>();
        for (GrantedAuthority value : values) { names.add(value.getAuthority()); }
        return names;
    }

    private InvalidTokenException invalidToken() { return new InvalidTokenException("Session is no longer valid"); }
    private InvalidGrantException invalidGrant() { return new InvalidGrantException("Refresh token is no longer valid"); }
}
