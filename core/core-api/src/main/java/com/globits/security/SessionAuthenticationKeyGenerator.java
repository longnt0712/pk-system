package com.globits.security;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.security.oauth2.provider.OAuth2Authentication;
import org.springframework.security.oauth2.provider.token.DefaultAuthenticationKeyGenerator;

/** Keep separate browser/device logins independent in the JDBC token store. */
public class SessionAuthenticationKeyGenerator extends DefaultAuthenticationKeyGenerator {
    @Override
    public String extractKey(OAuth2Authentication authentication) {
        Map<String, String> key = new LinkedHashMap<>();
        key.put("authentication", super.extractKey(authentication));
        Object sessionId = authentication.getOAuth2Request().getExtensions().get(ValidatingTokenServices.SESSION_ID);
        key.put("session", sessionId == null ? "legacy" : sessionId.toString());
        return generateKey(key);
    }
}
