package com.globits.security;

import org.springframework.security.oauth2.provider.token.AuthorizationServerTokenServices;
import org.springframework.security.oauth2.provider.token.ConsumerTokenServices;
import org.springframework.security.oauth2.provider.token.ResourceServerTokenServices;

/** Interface retained by Spring's transaction proxy for all token operations. */
public interface SessionTokenServices extends AuthorizationServerTokenServices,
        ResourceServerTokenServices, ConsumerTokenServices {
    boolean revokeForClient(String token, String clientId);
}
